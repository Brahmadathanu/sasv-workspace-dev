/**
 * manage-bmr.js
 * Canonical BMR module: Create / Manage / Explore
 * Replaces add-bmr-entry, edit-bmr-entry, view-bmr-entry pages.
 */
import { supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";
import { bootstrapApp } from "./appBootstrap.js";
import { hasPermission } from "./appAuth.js";

/* ── Permission targets ──────────────────────────────────────── */
const MODULE_TARGETS = ["module:manage-bmr", "module:bmr"];
const TAB_TARGETS = {
  add: ["module:manage-bmr:add", "module:bmr:add"],
  manage: ["module:manage-bmr:manage", "module:bmr:edit"],
  explore: ["module:manage-bmr:explore", "module:bmr:view"],
};

/* ── Module state ────────────────────────────────────────────── */
const state = {
  activeTab: "explore",
  allowedTabs: new Set(),
  products: [], // [{id, item, sub_group_id, uom_base}]
  hierarchyMap: Object.create(null), // item.toLowerCase() -> {category_name,…}
  hierarchyData: { cats: [], subs: [], grps: [], sgs: [] }, // raw hierarchy tables
  eligibleItems: [], // [] means no upstream hierarchy filter → show all
  editId: null, // bmr_details.id currently being edited
  editMapped: false,
  detailRow: null, // currently open detail modal row data
  // Cursor-based pagination state for Manage and Explorer tabs
  managePg: {
    pageSize: 50,
    page: 1,
    cursorStack: [],
    currentCursor: null,
    nextCursor: null,
  },
  explorePg: {
    pageSize: 50,
    page: 1,
    cursorStack: [],
    currentCursor: null,
    nextCursor: null,
  },
};

/* ── Element shortcut ────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);

const els = {
  statusArea: $("statusArea"),
  tabBar: $("tabBar"),
  refreshBtn: $("refreshBtn"),
  homeBtn: $("homeBtn"),
  panels: {
    add: $("panel-add"),
    manage: $("panel-manage"),
    explore: $("panel-explore"),
  },
  add: {
    csvFile: $("csvFile"),
    downloadTemplate: $("downloadTemplate"),
    uploadCsv: $("uploadCsv"),
    tableBody: $("createTableBody"),
    itemList: $("itemList"),
    addRowBtn: $("addRowBtn"),
    clearRowsBtn: $("clearRowsBtn"),
    submitCreateBtn: $("submitCreateBtn"),
    createCount: $("createCount"),
  },
  manage: {
    filterItem: $("manageFilterItem"),
    filterBn: $("manageFilterBn"),
    clearBtn: $("manageClearBtn"),
    tableBody: $("manageTableBody"),
    count: $("manageCount"),
    pageSizeSelect: $("managePageSize"),
    prevBtn: $("managePrevBtn"),
    nextBtn: $("manageNextBtn"),
    pageInfo: $("managePageInfo"),
  },
  explore: {
    filterCategory: $("filterCategory"),
    filterSubCategory: $("filterSubCategory"),
    filterGroup: $("filterGroup"),
    filterSubGroup: $("filterSubGroup"),
    filterItem: $("filterItem"),
    filterBn: $("filterBn"),
    clearItemBnBtn: $("clearItemBnBtn"),
    openHierarchyBtn: $("openHierarchyModalBtn"),
    clearBtn: $("clearExploreBtn"),
    applyHierarchyBtn: $("applyHierarchyBtn"),
    hierarchyModal: $("hierarchyModal"),
    hierarchyModalClose: $("hierarchyModalClose"),
    tableBody: $("exploreTableBody"),
    count: $("exploreCount"),
    pageSizeSelect: $("explorePageSize"),
    prevBtn: $("explorePrevBtn"),
    nextBtn: $("exploreNextBtn"),
    pageInfo: $("explorePageInfo"),
  },
  editModal: {
    overlay: $("editModal"),
    item: $("editItem"),
    bn: $("editBn"),
    size: $("editSize"),
    uom: $("editUom"),
    closeBtn: $("editModalClose"),
    cancelBtn: $("editCancelBtn"),
    saveBtn: $("editSaveBtn"),
    mappedNote: $("editMappedNote"),
  },
  detailModal: {
    overlay: $("detailModal"),
    closeBtn: $("detailModalClose"),
    cancelBtn: $("detailCloseBtn"),
    copyBtn: $("detailCopyBtn"),
    editBtn: $("detailEditBtn"),
    deleteBtn: $("detailDeleteBtn"),
    item: $("dtItem"),
    bn: $("dtBn"),
    size: $("dtSize"),
    uom: $("dtUom"),
    category: $("dtCategory"),
    subcategory: $("dtSubcategory"),
    group: $("dtGroup"),
    subGroup: $("dtSubGroup"),
    statusRow: $("dtStatusRow"),
    status: $("dtStatus"),
  },
  confirmModal: {
    overlay: $("confirmModal"),
    closeBtn: $("confirmModalClose"),
    cancelBtn: $("confirmCancelBtn"),
    okBtn: $("confirmOkBtn"),
    msg: $("confirmModalMsg"),
    item: $("confirmModalItem"),
  },
  toastContainer: $("toastContainer"),
};

/* ── In-page confirm dialog ──────────────────────────────────── */
// Returns a Promise<boolean>. Shows the confirm modal and resolves true on OK.
function confirmDialog(message, itemLabel = "") {
  return new Promise((resolve) => {
    const cm = els.confirmModal;
    cm.msg.textContent = message;
    if (itemLabel) {
      cm.item.textContent = itemLabel;
      cm.item.classList.remove("hidden");
    } else {
      cm.item.classList.add("hidden");
    }
    cm.overlay.classList.remove("hidden");
    cm.okBtn.focus();

    function finish(result) {
      cm.overlay.classList.add("hidden");
      cm.okBtn.removeEventListener("click", onOk);
      cm.cancelBtn.removeEventListener("click", onCancel);
      cm.closeBtn.removeEventListener("click", onCancel);
      resolve(result);
    }
    const onOk = () => finish(true);
    const onCancel = () => finish(false);
    cm.okBtn.addEventListener("click", onOk, { once: true });
    cm.cancelBtn.addEventListener("click", onCancel, { once: true });
    cm.closeBtn.addEventListener("click", onCancel, { once: true });
  });
}

/* ── Utility helpers ─────────────────────────────────────────── */
function escHtml(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeRows(data) {
  return Array.isArray(data) ? data : [];
}

function naturalCompare(a = "", b = "") {
  return String(a || "").localeCompare(String(b || ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

/* ── Status bar ──────────────────────────────────────────────── */
function showStatus(msg, type = "warn") {
  // type: error | warn | success
  els.statusArea.className = `sa-${type}`;
  els.statusArea.textContent = msg;
}

function clearStatus() {
  els.statusArea.className = "";
  els.statusArea.textContent = "";
}

/* ── Toast ───────────────────────────────────────────────────── */
function toast(msg, type = "success", durationMs = 3500) {
  const div = document.createElement("div");
  div.className = `toast toast-${type}`;
  div.textContent = msg;
  els.toastContainer.appendChild(div);
  setTimeout(() => {
    div.classList.add("toast-out");
    div.addEventListener("animationend", () => div.remove(), { once: true });
  }, durationMs);
}

/* ── Permission helpers ──────────────────────────────────────── */
async function canAccessAny(targets, modes) {
  const modeList = Array.isArray(modes) ? modes : [modes];
  for (const t of targets) {
    for (const m of modeList) {
      if (await hasPermission(t, m)) return true;
    }
  }
  return false;
}

async function loadPermissions() {
  const moduleView = await canAccessAny(MODULE_TARGETS, "view");
  if (!moduleView) {
    showStatus(
      "Access denied. You do not have permission to view Manage BMR.",
      "error",
    );
    return false;
  }
  // Module-level "edit" (Full Access) unlocks all three tabs without requiring
  // granular sub-target entries (module:manage-bmr:add etc.).
  const [moduleEdit, canAdd, canManage, canExplore] = await Promise.all([
    canAccessAny(MODULE_TARGETS, "edit"),
    canAccessAny(TAB_TARGETS.add, ["edit", "view"]),
    canAccessAny(TAB_TARGETS.manage, "edit"),
    canAccessAny(TAB_TARGETS.explore, "view"),
  ]);
  if (moduleEdit || canAdd) state.allowedTabs.add("add");
  if (moduleEdit || canManage) state.allowedTabs.add("manage");
  if (moduleEdit || canExplore) state.allowedTabs.add("explore");
  // Fallback: at minimum grant explore
  if (!state.allowedTabs.size) state.allowedTabs.add("explore");
  return true;
}

/* ── Tab management ──────────────────────────────────────────── */
function applyTabVisibility() {
  els.tabBar.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("hidden", !state.allowedTabs.has(btn.dataset.tab));
  });
}

async function setActiveTab(tab) {
  if (!state.allowedTabs.has(tab)) return;
  state.activeTab = tab;
  els.tabBar.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  for (const [key, panel] of Object.entries(els.panels)) {
    panel.classList.toggle("active", key === tab);
  }
  if (tab === "manage") await renderManageTable();
  if (tab === "explore") await renderExploreTable();
}

/* ── SELECT helper ───────────────────────────────────────────── */
function fillSelect(el, rows, valKey, txtKey, placeholder) {
  el.innerHTML =
    `<option value="">${placeholder}</option>` +
    rows
      .map(
        (r) =>
          `<option value="${escHtml(r[valKey])}">${escHtml(r[txtKey])}</option>`,
      )
      .join("");
}

/* ═══════════════════════════════════════════════════════════════
   CREATE tab
   ═══════════════════════════════════════════════════════════════ */
function csvToRows(text) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim());
  const expectedHeader = ["item", "bn", "batch_size", "uom"];
  const firstCols = (lines[0] || "")
    .split(",")
    .map((x) => x.trim().replace(/^"|"$/g, "").toLowerCase());
  const hasHeader = expectedHeader.every((h, i) => firstCols[i] === h);
  const body = hasHeader ? lines.slice(1) : lines;
  return body.map((ln, idx) => {
    const [item, bn, batch_size, uom] = ln
      .split(",")
      .map((x) => x.trim().replace(/^"|"$/g, ""));
    if (!item || !bn || !uom) {
      throw new Error(
        `CSV row ${idx + (hasHeader ? 2 : 1)} is incomplete (item/bn/uom required).`,
      );
    }
    return { item, bn, size: Number(batch_size) || null, uom };
  });
}

function fillRowUom(tr, itemName) {
  const match = state.products.find(
    (p) =>
      p.item.toLowerCase() ===
      String(itemName || "")
        .trim()
        .toLowerCase(),
  );
  const span = tr.querySelector(".c-uom-text");
  if (match?.uom_base) {
    span.textContent = match.uom_base;
    span.dataset.uom = match.uom_base;
    span.classList.remove("c-uom-empty");
  } else {
    span.textContent = "—";
    span.dataset.uom = "";
    span.classList.add("c-uom-empty");
  }
}

function addCreateRow(seed = {}) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="c-item" list="itemList" value="${escHtml(seed.item || "")}" autocomplete="off" /></td>
    <td><input class="c-bn"   value="${escHtml(seed.bn || "")}" /></td>
    <td><input class="c-size" type="number" step="0.01" min="0" value="${escHtml(seed.size ?? "")}" /></td>
    <td class="uom-cell"><span class="c-uom-text c-uom-empty" data-uom="">—</span></td>
    <td><button class="btn ghost row-del" type="button" style="padding:4px 8px;font-size:12px">&#x2715;</button></td>
  `;
  tr.querySelector(".row-del").addEventListener("click", () => {
    if (els.add.tableBody.children.length > 1) {
      tr.remove();
      updateCreateCount();
    }
  });
  // Auto-fill UOM from product on item input
  tr.querySelector(".c-item").addEventListener("input", function () {
    fillRowUom(tr, this.value);
  });
  // If seeded with an item, try to auto-fill immediately
  if (seed.item) fillRowUom(tr, seed.item);
  els.add.tableBody.appendChild(tr);
  updateCreateCount();
}

function clearCreateRows() {
  els.add.tableBody.innerHTML = "";
  addCreateRow();
}

function updateCreateCount() {
  const n = els.add.tableBody.children.length;
  els.add.createCount.textContent =
    n > 0 ? `${n} row${n === 1 ? "" : "s"}` : "";
}

function getCreateRowsFromTable() {
  const rows = Array.from(els.add.tableBody.querySelectorAll("tr")).map(
    (tr, i) => {
      const item = tr.querySelector(".c-item").value.trim();
      const bn = tr.querySelector(".c-bn").value.trim();
      const size = tr.querySelector(".c-size").value.trim();
      const uomSpan = tr.querySelector(".c-uom-text");
      const uom = uomSpan ? uomSpan.dataset.uom || "" : "";
      if (!item || !bn || !uom)
        throw new Error(
          `Row ${i + 1}: item, BN and UOM are required. Select a valid item first.`,
        );
      return { item, bn, size: size ? Number(size) : null, uom };
    },
  );
  return rows;
}

async function insertBmrRow(entry) {
  // Look up product_id
  const { data: prod, error: prodErr } = await supabase
    .from("products")
    .select("id")
    .ilike("item", entry.item)
    .limit(1)
    .single();
  if (prodErr && prodErr.code !== "PGRST116") return { err: true };
  if (!prod?.id) return { missingProduct: true };

  const { error } = await supabase.from("bmr_details").insert([
    {
      item: entry.item,
      bn: entry.bn,
      batch_size: entry.size,
      uom: entry.uom,
      product_id: prod.id,
    },
  ]);
  if (error) {
    if (error.code === "23505") return { dup: true };
    return { err: true };
  }
  return { ok: true };
}

async function submitCreateEntries() {
  let rows;
  try {
    rows = getCreateRowsFromTable();
  } catch (e) {
    showStatus(e.message, "warn");
    return;
  }
  if (!rows.length) {
    showStatus("No rows to create.", "warn");
    return;
  }

  els.add.submitCreateBtn.disabled = true;
  clearStatus();
  let ok = 0,
    dup = 0,
    err = 0;
  const missing = new Set();
  for (const row of rows) {
    const res = await insertBmrRow(row);
    if (res.ok) ok++;
    else if (res.dup) dup++;
    else {
      err++;
      if (res.missingProduct) missing.add(row.item);
    }
  }
  els.add.submitCreateBtn.disabled = false;

  let msg = `Done. Created: ${ok}`;
  if (dup) msg += `, duplicates skipped: ${dup}`;
  if (err) msg += `, errors: ${err}`;
  if (missing.size)
    msg += `. Unknown products: ${[...missing].slice(0, 5).join(", ")}`;
  msg += ".";

  const type = err ? "warn" : ok ? "success" : "warn";
  toast(msg, type);
  if (ok) clearCreateRows();

  // Refresh manage table data in background if visible
  if (state.activeTab === "manage") await renderManageTable();
}

/* ═══════════════════════════════════════════════════════════════
   MANAGE tab
   ═══════════════════════════════════════════════════════════════ */
/* ── Manage pagination helpers ────────────────────────────── */
function resetManagePg() {
  Object.assign(state.managePg, {
    page: 1,
    cursorStack: [],
    currentCursor: null,
    nextCursor: null,
  });
}

function updateManagePager({
  hasNext = false,
  hasPrev = false,
  loading = false,
} = {}) {
  els.manage.prevBtn.disabled = loading || !hasPrev;
  els.manage.nextBtn.disabled = loading || !hasNext;
  els.manage.pageInfo.textContent = loading
    ? "Loading…"
    : `Page ${state.managePg.page}`;
}

async function renderManageTable(cursor = null) {
  els.manage.tableBody.innerHTML = `<tr><td colspan="4" class="empty-state">Loading…</td></tr>`;
  updateManagePager({ loading: true });

  const ps = state.managePg.pageSize;

  const applyFilters = (q) => {
    if (els.manage.filterItem.value)
      q = q.eq("item", els.manage.filterItem.value);
    if (els.manage.filterBn.value.trim())
      q = q.eq("bn", els.manage.filterBn.value.trim());
    return q;
  };

  // Run data fetch and total-count HEAD query in parallel
  let dataQ = supabase
    .from("v_bmr_with_map_flag")
    .select("bmr_id,item,bn,batch_size,uom,is_mapped")
    .order("bmr_id", { ascending: false })
    .limit(ps + 1);
  if (cursor !== null) dataQ = dataQ.lt("bmr_id", cursor);
  dataQ = applyFilters(dataQ);

  const countQ = applyFilters(
    supabase
      .from("v_bmr_with_map_flag")
      .select("*", { count: "exact", head: true }),
  );
  const [{ data, error }, { count }] = await Promise.all([dataQ, countQ]);

  if (error) {
    els.manage.tableBody.innerHTML = `<tr><td colspan="4" class="empty-state">Error loading data.</td></tr>`;
    updateManagePager({ loading: false });
    throw error;
  }

  const fetched = normalizeRows(data);
  const hasNext = fetched.length > ps;
  const rows = hasNext ? fetched.slice(0, ps) : fetched;
  state.managePg.nextCursor = hasNext ? rows[rows.length - 1].bmr_id : null;

  const totalCount = count ?? 0;
  els.manage.count.textContent = totalCount
    ? `${totalCount.toLocaleString()} row${totalCount === 1 ? "" : "s"} total`
    : "";

  const hasPrev = state.managePg.page > 1;
  if (!rows.length) {
    els.manage.tableBody.innerHTML = `<tr><td colspan="4" class="empty-state">No entries found.</td></tr>`;
    updateManagePager({ hasNext: false, hasPrev });
    return;
  }

  els.manage.tableBody.innerHTML = rows
    .map(
      (r) => `
    <tr class="clickable-row" data-id="${r.bmr_id}" data-mapped="${r.is_mapped}"
        data-item="${escHtml(r.item)}" data-bn="${escHtml(r.bn)}"
        data-size="${escHtml(r.batch_size ?? "")}" data-uom="${escHtml(r.uom ?? "")}">
      <td>${escHtml(r.item)}</td>
      <td>${escHtml(r.bn)}</td>
      <td>${escHtml(r.batch_size ?? "")}</td>
      <td>${escHtml(r.uom ?? "")}</td>
    </tr>`,
    )
    .join("");

  updateManagePager({ hasNext, hasPrev });
}

/* ── Detail modal ────────────────────────────────────────────── */
function openDetailModal(row) {
  // row: { source, id?, item, bn, batchSize, uom, isMapped?,
  //        category, subcategory, group, subGroup }
  state.detailRow = row;
  const dm = els.detailModal;

  dm.item.textContent = row.item || "—";
  dm.bn.textContent = row.bn || "—";
  dm.size.textContent =
    row.batchSize != null && row.batchSize !== "" ? row.batchSize : "—";
  dm.uom.textContent = row.uom || "—";
  dm.category.textContent = row.category || "—";
  dm.subcategory.textContent = row.subcategory || "—";
  dm.group.textContent = row.group || "—";
  dm.subGroup.textContent = row.subGroup || "—";

  const isManage = row.source === "manage";
  dm.statusRow.classList.toggle("hidden", !isManage);
  if (isManage) {
    dm.status.innerHTML = row.isMapped
      ? '<span class="badge-mapped">Mapped</span>'
      : '<span class="badge-free">Free</span>';
  }

  const canEditManage = isManage && state.allowedTabs.has("manage");
  dm.editBtn.classList.toggle("hidden", !canEditManage);
  dm.deleteBtn.classList.toggle("hidden", !canEditManage);

  dm.overlay.classList.remove("hidden");
}

function closeDetailModal() {
  els.detailModal.overlay.classList.add("hidden");
  state.detailRow = null;
}

function copyBmrForWhatsApp() {
  const row = state.detailRow;
  if (!row) return;
  const hier = [row.category, row.subcategory, row.group, row.subGroup]
    .filter(Boolean)
    .join(" › ");
  const sizeUom = [
    row.batchSize != null && row.batchSize !== "" ? row.batchSize : null,
    row.uom || null,
  ]
    .filter(Boolean)
    .join(" ");

  const lines = [
    `*BMR DETAILS*`,
    ``,
    `*Item:* ${row.item}`,
    `*Batch Number:* ${row.bn}`,
    `*Batch Size:* ${sizeUom || "—"}`,
  ];
  if (hier) lines.push(`*Product Hierarchy:* ${hier}`);
  if (row.source === "manage")
    lines.push(`*Status:* ${row.isMapped ? "Mapped to batch plan" : "Free"}`);

  const text = lines.join("\n");
  navigator.clipboard
    .writeText(text)
    .then(() => {
      toast("Copied! Paste directly into WhatsApp.", "success");
    })
    .catch(() => {
      // Fallback for environments without clipboard API
      const ta = document.createElement("textarea");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      toast("Copied! Paste directly into WhatsApp.", "success");
    });
}

/* ── Edit modal ──────────────────────────────────────────────── */
function resolveProductUom(itemName) {
  const match = state.products.find(
    (p) =>
      p.item.toLowerCase() ===
      String(itemName || "")
        .trim()
        .toLowerCase(),
  );
  return match?.uom_base || null;
}

function applyEditUom(itemName) {
  const uom = resolveProductUom(itemName);
  if (uom) {
    // Ensure the option exists (add it dynamically if needed)
    const sel = els.editModal.uom;
    let opt = Array.from(sel.options).find(
      (o) => o.value.toLowerCase() === uom.toLowerCase(),
    );
    if (!opt) {
      opt = new Option(uom, uom);
      sel.appendChild(opt);
    }
    sel.value = opt.value;
  }
}

function openEditModal({ id, mapped, item, bn, batchSize, uom }) {
  state.editId = id;
  state.editMapped = mapped;

  // Populate item dropdown from loaded products list
  const opts = state.products
    .map(
      (p) =>
        `<option value="${escHtml(p.item)}"${p.item === item ? " selected" : ""}>${escHtml(p.item)}</option>`,
    )
    .join("");
  els.editModal.item.innerHTML = `<option value="">— Select Item —</option>${opts}`;

  els.editModal.bn.value = bn;
  els.editModal.size.value = batchSize;

  // UOM is product-specific — derive from product lookup, always locked
  applyEditUom(item);
  els.editModal.uom.disabled = true;

  // Lock BN + Size when mapped
  els.editModal.bn.disabled = mapped;
  els.editModal.size.disabled = mapped;
  els.editModal.mappedNote.classList.toggle("hidden", !mapped);

  els.editModal.overlay.classList.remove("hidden");
  els.editModal.item.focus();
}

function closeEditModal() {
  els.editModal.overlay.classList.add("hidden");
  els.editModal.uom.disabled = false; // reset for next open
  state.editId = null;
  state.editMapped = false;
}

async function saveEditModal() {
  const item = els.editModal.item.value.trim();
  const bn = els.editModal.bn.value.trim();
  const size = els.editModal.size.value.trim();
  const uom = els.editModal.uom.value;

  if (!item) {
    toast("Item is required.", "warn");
    return;
  }
  if (!bn) {
    toast("BN is required.", "warn");
    return;
  }
  if (!uom) {
    toast("UOM is required.", "warn");
    return;
  }

  els.editModal.saveBtn.disabled = true;
  const updates = { item, uom };
  if (!state.editMapped) {
    updates.bn = bn;
    updates.batch_size = size ? Number(size) : null;
  }
  const { error } = await supabase
    .from("bmr_details")
    .update(updates)
    .eq("id", state.editId);
  els.editModal.saveBtn.disabled = false;

  if (error) {
    toast(`Save failed: ${error.message}`, "error");
    return;
  }
  toast("BMR entry updated.", "success");
  closeEditModal();
  await renderManageTable();
}

/* ═══════════════════════════════════════════════════════════════
   EXPLORE tab — hierarchy chain
   ═══════════════════════════════════════════════════════════════ */
async function loadHierarchyMap() {
  const [
    { data: cats },
    { data: subs },
    { data: grps },
    { data: sgs },
    { data: prods },
  ] = await Promise.all([
    supabase.from("categories").select("id,category_name"),
    supabase.from("sub_categories").select("id,subcategory_name,category_id"),
    supabase.from("product_groups").select("id,group_name,sub_category_id"),
    supabase.from("sub_groups").select("id,sub_group_name,product_group_id"),
    supabase
      .from("products")
      .select("item,sub_group_id")
      .eq("status", "Active"),
  ]);
  const catMap = Object.create(null);
  const subMap = Object.create(null);
  const grpMap = Object.create(null);
  const sgMap = Object.create(null);
  (cats || []).forEach((c) => (catMap[c.id] = c.category_name));
  (subs || []).forEach(
    (s) =>
      (subMap[s.id] = { name: s.subcategory_name, category_id: s.category_id }),
  );
  (grps || []).forEach(
    (g) =>
      (grpMap[g.id] = {
        name: g.group_name,
        sub_category_id: g.sub_category_id,
      }),
  );
  (sgs || []).forEach(
    (s) =>
      (sgMap[s.id] = {
        name: s.sub_group_name,
        product_group_id: s.product_group_id,
      }),
  );
  const map = Object.create(null);
  (prods || []).forEach((p) => {
    const key = String(p.item || "")
      .trim()
      .toLowerCase();
    const sg = sgMap[p.sub_group_id];
    const grp = sg ? grpMap[sg.product_group_id] : null;
    const sub = grp ? subMap[grp.sub_category_id] : null;
    map[key] = {
      category_name: sub ? catMap[sub.category_id] || "" : "",
      subcategory_name: sub?.name || "",
      group_name: grp?.name || "",
      sub_group_name: sg?.name || "",
    };
  });
  state.hierarchyMap = map;
  // Also store raw arrays for client-side ERP-style filter narrowing
  state.hierarchyData = {
    cats: cats || [],
    subs: subs || [],
    grps: grps || [],
    sgs: sgs || [],
  };
}

async function loadCategories() {
  const { data } = await supabase
    .from("categories")
    .select("id,category_name")
    .order("category_name");
  fillSelect(
    els.explore.filterCategory,
    normalizeRows(data),
    "id",
    "category_name",
    "All Categories",
  );
}

/* ERP-style client-side hierarchy populate functions.
 * All dropdowns are always enabled. Selecting a parent narrows child options
 * without locking them — you can jump to any level directly.
 *
 * Option VALUES are the display NAME (not database ID) for subcategory/group/
 * sub-group levels. This prevents duplicate entries when the same name exists
 * under multiple parents (e.g. "Classical" under both Ayurveda and Siddha).
 * The name-to-ID resolution happens in resolveEligibleSubGroupIds().
 */

/** Deduplicate rows by a name key, return sorted unique rows. */
function dedupByName(rows, nameKey) {
  const seen = new Set();
  return rows
    .filter((r) => {
      if (seen.has(r[nameKey])) return false;
      seen.add(r[nameKey]);
      return true;
    })
    .sort((a, b) => naturalCompare(a[nameKey], b[nameKey]));
}

function populateSubCategories() {
  const catId = els.explore.filterCategory.value;
  let rows = catId
    ? state.hierarchyData.subs.filter((s) => String(s.category_id) === catId)
    : state.hierarchyData.subs;
  // Value = name (deduped); multiple IDs behind the same name resolved later
  fillSelect(
    els.explore.filterSubCategory,
    dedupByName(rows, "subcategory_name"),
    "subcategory_name",
    "subcategory_name",
    "All Subcategories",
  );
}

function populateGroups() {
  const catId = els.explore.filterCategory.value;
  const subName = els.explore.filterSubCategory.value; // name, not ID
  let rows = state.hierarchyData.grps;
  if (subName) {
    // Resolve the subcategory name to all matching IDs (narrowed by category if set)
    let subRows = state.hierarchyData.subs.filter(
      (s) => s.subcategory_name === subName,
    );
    if (catId) subRows = subRows.filter((s) => String(s.category_id) === catId);
    const subIds = new Set(subRows.map((s) => String(s.id)));
    rows = rows.filter((g) => subIds.has(String(g.sub_category_id)));
  } else if (catId) {
    const subIds = new Set(
      state.hierarchyData.subs
        .filter((s) => String(s.category_id) === catId)
        .map((s) => String(s.id)),
    );
    rows = rows.filter((g) => subIds.has(String(g.sub_category_id)));
  }
  fillSelect(
    els.explore.filterGroup,
    dedupByName(rows, "group_name"),
    "group_name",
    "group_name",
    "All Groups",
  );
}

function populateSubGroups() {
  const catId = els.explore.filterCategory.value;
  const subName = els.explore.filterSubCategory.value;
  const grpName = els.explore.filterGroup.value; // name, not ID
  let rows = state.hierarchyData.sgs;
  if (grpName) {
    // Resolve group name → group IDs (narrowed by subcategory/category context)
    let grpRows = state.hierarchyData.grps.filter(
      (g) => g.group_name === grpName,
    );
    if (subName) {
      let subRows = state.hierarchyData.subs.filter(
        (s) => s.subcategory_name === subName,
      );
      if (catId)
        subRows = subRows.filter((s) => String(s.category_id) === catId);
      const subIds = new Set(subRows.map((s) => String(s.id)));
      grpRows = grpRows.filter((g) => subIds.has(String(g.sub_category_id)));
    } else if (catId) {
      const subIds = new Set(
        state.hierarchyData.subs
          .filter((s) => String(s.category_id) === catId)
          .map((s) => String(s.id)),
      );
      grpRows = grpRows.filter((g) => subIds.has(String(g.sub_category_id)));
    }
    const grpIds = new Set(grpRows.map((g) => String(g.id)));
    rows = rows.filter((sg) => grpIds.has(String(sg.product_group_id)));
  } else if (subName) {
    let subRows = state.hierarchyData.subs.filter(
      (s) => s.subcategory_name === subName,
    );
    if (catId) subRows = subRows.filter((s) => String(s.category_id) === catId);
    const subIds = new Set(subRows.map((s) => String(s.id)));
    const grpIds = new Set(
      state.hierarchyData.grps
        .filter((g) => subIds.has(String(g.sub_category_id)))
        .map((g) => String(g.id)),
    );
    rows = rows.filter((sg) => grpIds.has(String(sg.product_group_id)));
  } else if (catId) {
    const subIds = new Set(
      state.hierarchyData.subs
        .filter((s) => String(s.category_id) === catId)
        .map((s) => String(s.id)),
    );
    const grpIds = new Set(
      state.hierarchyData.grps
        .filter((g) => subIds.has(String(g.sub_category_id)))
        .map((g) => String(g.id)),
    );
    rows = rows.filter((sg) => grpIds.has(String(sg.product_group_id)));
  }
  fillSelect(
    els.explore.filterSubGroup,
    dedupByName(rows, "sub_group_name"),
    "sub_group_name",
    "sub_group_name",
    "All Sub-groups",
  );
}

/**
 * Resolve the four filter values (catId + three names) to a set of
 * qualifying sub_group IDs (or null = unconstrained).
 * Names are matched against all matching IDs at their level.
 */
function resolveEligibleSubGroupIds() {
  const catId = els.explore.filterCategory.value;
  const subName = els.explore.filterSubCategory.value;
  const grpName = els.explore.filterGroup.value;
  const sgName = els.explore.filterSubGroup.value;

  if (!catId && !subName && !grpName && !sgName) return null; // fully unconstrained

  // Helper: get sub_category rows matching current context
  const getSubRows = () => {
    let rows = subName
      ? state.hierarchyData.subs.filter((s) => s.subcategory_name === subName)
      : state.hierarchyData.subs;
    if (catId) rows = rows.filter((s) => String(s.category_id) === catId);
    return rows;
  };

  // Helper: get group rows matching current context
  const getGrpRows = () => {
    let rows = grpName
      ? state.hierarchyData.grps.filter((g) => g.group_name === grpName)
      : state.hierarchyData.grps;
    if (subName || catId) {
      const subIds = new Set(getSubRows().map((s) => String(s.id)));
      rows = rows.filter((g) => subIds.has(String(g.sub_category_id)));
    }
    return rows;
  };

  // Get qualifying sub-group IDs
  let sgRows = sgName
    ? state.hierarchyData.sgs.filter((sg) => sg.sub_group_name === sgName)
    : state.hierarchyData.sgs;

  if (grpName || subName || catId) {
    const grpIds = new Set(getGrpRows().map((g) => String(g.id)));
    sgRows = sgRows.filter((sg) => grpIds.has(String(sg.product_group_id)));
  }

  return sgRows.map((sg) => sg.id);
}

async function loadExploreItems() {
  const sgIds = resolveEligibleSubGroupIds();

  let q = supabase
    .from("products")
    .select("item,sub_group_id")
    .eq("status", "Active");
  if (sgIds !== null) {
    if (!sgIds.length) {
      fillSelect(els.explore.filterItem, [], "item", "item", "All Items");
      state.eligibleItems = [];
      return;
    }
    q = q.in("sub_group_id", sgIds);
  }
  const { data } = await q.order("item");
  const items = normalizeRows(data);
  fillSelect(els.explore.filterItem, items, "item", "item", "All Items");
  state.eligibleItems = sgIds !== null ? items.map((r) => r.item) : [];
}

/* ── Explorer pagination helpers ───────────────────────────── */
function resetExplorePg() {
  Object.assign(state.explorePg, {
    page: 1,
    cursorStack: [],
    currentCursor: null,
    nextCursor: null,
  });
}

function updateExplorePager({
  hasNext = false,
  hasPrev = false,
  loading = false,
} = {}) {
  els.explore.prevBtn.disabled = loading || !hasPrev;
  els.explore.nextBtn.disabled = loading || !hasNext;
  els.explore.pageInfo.textContent = loading
    ? "Loading…"
    : `Page ${state.explorePg.page}`;
}

async function renderExploreTable(cursor = null) {
  els.explore.tableBody.innerHTML = `<tr><td colspan="5" class="empty-state">Loading…</td></tr>`;
  updateExplorePager({ loading: true });

  const ps = state.explorePg.pageSize;

  const applyFilters = (q) => {
    if (state.eligibleItems.length) q = q.in("item", state.eligibleItems);
    if (els.explore.filterItem.value)
      q = q.eq("item", els.explore.filterItem.value);
    if (els.explore.filterBn.value) q = q.eq("bn", els.explore.filterBn.value);
    return q;
  };

  // Cursor on `id` (sequential PK) — order by id desc for stable keyset pagination.
  // Client-side sort within each page applies the full multi-key sort for visual order.
  let dataQ = supabase
    .from("bmr_details")
    .select("id,item,bn,batch_size,uom,created_at")
    .order("id", { ascending: false })
    .limit(ps + 1);
  if (cursor !== null) dataQ = dataQ.lt("id", cursor);
  dataQ = applyFilters(dataQ);

  const countQ = applyFilters(
    supabase.from("bmr_details").select("*", { count: "exact", head: true }),
  );

  const [{ data, error }, { count }] = await Promise.all([dataQ, countQ]);
  if (error) {
    els.explore.tableBody.innerHTML = `<tr><td colspan="5" class="empty-state">Error loading data.</td></tr>`;
    updateExplorePager({ loading: false });
    throw error;
  }

  const fetched = normalizeRows(data);
  const hasNext = fetched.length > ps;
  const pageRows = hasNext ? fetched.slice(0, ps) : fetched;
  state.explorePg.nextCursor = hasNext
    ? pageRows[pageRows.length - 1].id
    : null;

  // Enrich with hierarchy and apply multi-key client-side sort within page
  const rows = pageRows.map((r) => {
    const h =
      state.hierarchyMap[
        String(r.item || "")
          .trim()
          .toLowerCase()
      ] || {};
    return { ...r, ...h };
  });
  rows.sort((a, b) => {
    let c;
    const da = a.created_at || "";
    const db = b.created_at || "";
    if (da > db) return -1;
    if (da < db) return 1;
    if ((c = naturalCompare(a.category_name, b.category_name)) !== 0) return c;
    if ((c = naturalCompare(a.group_name, b.group_name)) !== 0) return c;
    if ((c = naturalCompare(a.sub_group_name, b.sub_group_name)) !== 0)
      return c;
    if ((c = naturalCompare(a.subcategory_name, b.subcategory_name)) !== 0)
      return c;
    if ((c = naturalCompare(a.item, b.item)) !== 0) return c;
    if ((c = naturalCompare(a.bn, b.bn)) !== 0) return c;
    return (Number(a.batch_size) || 0) - (Number(b.batch_size) || 0);
  });

  const hasPrev = state.explorePg.page > 1;
  const totalCount = count ?? 0;
  els.explore.count.textContent = totalCount
    ? `${totalCount.toLocaleString()} row${totalCount === 1 ? "" : "s"} total`
    : "";

  if (!rows.length) {
    els.explore.tableBody.innerHTML = `<tr><td colspan="5" class="empty-state">No BMR entries found for this filter.</td></tr>`;
    updateExplorePager({ hasNext: false, hasPrev });
    return;
  }

  els.explore.tableBody.innerHTML = rows
    .map((r) => {
      const dateStr = r.created_at ? r.created_at.slice(0, 10) : "—";
      return `
    <tr class="clickable-row"
        data-item="${escHtml(r.item)}" data-bn="${escHtml(r.bn)}"
        data-size="${escHtml(r.batch_size ?? "")}" data-uom="${escHtml(r.uom ?? "")}"
        data-cat="${escHtml(r.category_name || "")}" data-sub="${escHtml(r.subcategory_name || "")}"
        data-grp="${escHtml(r.group_name || "")}" data-sg="${escHtml(r.sub_group_name || "")}"
        data-date="${escHtml(r.created_at || "")}">
      <td>${escHtml(dateStr)}</td>
      <td>${escHtml(r.item)}</td>
      <td>${escHtml(r.bn)}</td>
      <td>${escHtml(r.batch_size ?? "")}</td>
      <td>${escHtml(r.uom ?? "")}</td>
    </tr>`;
    })
    .join("");

  updateExplorePager({ hasNext, hasPrev });
}

/* ═══════════════════════════════════════════════════════════════
   Data loading
   ═══════════════════════════════════════════════════════════════ */
async function loadProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("id,item,sub_group_id,uom_base")
    .eq("status", "Active")
    .order("item");
  if (error) throw error;
  state.products = normalizeRows(data);

  // Datalist for create tab
  els.add.itemList.innerHTML = state.products
    .map((r) => `<option value="${escHtml(r.item)}"></option>`)
    .join("");

  // Manage filter dropdown
  const managOpts =
    `<option value="">All Items</option>` +
    state.products
      .map(
        (r) => `<option value="${escHtml(r.item)}">${escHtml(r.item)}</option>`,
      )
      .join("");
  els.manage.filterItem.innerHTML = managOpts;
}

/* ═══════════════════════════════════════════════════════════════
   Event wiring
   ═══════════════════════════════════════════════════════════════ */
function wireEvents() {
  // Navigation
  els.homeBtn.addEventListener("click", () => Platform.goHome());
  els.refreshBtn.addEventListener("click", async () => {
    try {
      clearStatus();
      await loadProducts();
      if (state.activeTab === "manage") await renderManageTable();
      if (state.activeTab === "explore") await renderExploreTable();
      toast("Refreshed.", "success", 2000);
    } catch (e) {
      showStatus(`Refresh failed: ${e.message}`, "error");
    }
  });

  // Tab bar
  els.tabBar.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });

  // CREATE tab
  els.add.downloadTemplate.addEventListener("click", () => {
    const csv = "item,bn,batch_size,uom\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bmr-template.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
  els.add.uploadCsv.addEventListener("click", async () => {
    try {
      const file = els.add.csvFile.files?.[0];
      if (!file) throw new Error("Select a CSV file first.");
      const text = await file.text();
      const rows = csvToRows(text);
      clearCreateRows();
      rows.forEach((r) => addCreateRow(r));
      toast(
        `Loaded ${rows.length} row${rows.length === 1 ? "" : "s"} from CSV.`,
        "success",
      );
    } catch (e) {
      showStatus(e.message, "warn");
    }
  });
  els.add.addRowBtn.addEventListener("click", () => addCreateRow());
  els.add.clearRowsBtn.addEventListener("click", clearCreateRows);
  els.add.submitCreateBtn.addEventListener("click", submitCreateEntries);

  // MANAGE tab
  els.manage.filterItem.addEventListener("change", () => {
    resetManagePg();
    renderManageTable().catch(console.error);
  });
  els.manage.filterBn.addEventListener("input", () => {
    resetManagePg();
    renderManageTable().catch(console.error);
  });
  els.manage.clearBtn.addEventListener("click", async () => {
    els.manage.filterItem.value = "";
    els.manage.filterBn.value = "";
    resetManagePg();
    await renderManageTable();
  });
  els.manage.pageSizeSelect.addEventListener("change", () => {
    state.managePg.pageSize = Number(els.manage.pageSizeSelect.value);
    resetManagePg();
    renderManageTable().catch(console.error);
  });
  els.manage.nextBtn.addEventListener("click", async () => {
    if (!state.managePg.nextCursor) return;
    state.managePg.cursorStack.push(state.managePg.currentCursor);
    state.managePg.currentCursor = state.managePg.nextCursor;
    state.managePg.page++;
    await renderManageTable(state.managePg.currentCursor);
  });
  els.manage.prevBtn.addEventListener("click", async () => {
    if (!state.managePg.cursorStack.length) return;
    state.managePg.currentCursor = state.managePg.cursorStack.pop();
    state.managePg.page--;
    await renderManageTable(state.managePg.currentCursor);
  });
  els.manage.tableBody.addEventListener("click", (e) => {
    const tr = e.target.closest("tr.clickable-row");
    if (!tr) return;
    const h =
      state.hierarchyMap[
        String(tr.dataset.item || "")
          .trim()
          .toLowerCase()
      ] || {};
    openDetailModal({
      source: "manage",
      id: tr.dataset.id,
      item: tr.dataset.item,
      bn: tr.dataset.bn,
      batchSize: tr.dataset.size,
      uom: tr.dataset.uom,
      isMapped: tr.dataset.mapped === "true",
      category: h.category_name || "",
      subcategory: h.subcategory_name || "",
      group: h.group_name || "",
      subGroup: h.sub_group_name || "",
    });
  });

  // Edit modal
  els.editModal.closeBtn.addEventListener("click", closeEditModal);
  els.editModal.cancelBtn.addEventListener("click", closeEditModal);
  els.editModal.saveBtn.addEventListener("click", () =>
    saveEditModal().catch(console.error),
  );
  els.editModal.item.addEventListener("change", () => {
    applyEditUom(els.editModal.item.value);
  });
  els.editModal.overlay.addEventListener("click", (e) => {
    if (e.target === els.editModal.overlay) closeEditModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!els.confirmModal.overlay.classList.contains("hidden"))
        els.confirmModal.cancelBtn.click();
      else if (!els.editModal.overlay.classList.contains("hidden"))
        closeEditModal();
      else if (!els.detailModal.overlay.classList.contains("hidden"))
        closeDetailModal();
    }
  });

  // Detail modal
  els.detailModal.closeBtn.addEventListener("click", closeDetailModal);
  els.detailModal.cancelBtn.addEventListener("click", closeDetailModal);
  els.detailModal.overlay.addEventListener("click", (e) => {
    if (e.target === els.detailModal.overlay) closeDetailModal();
  });
  // Confirm modal — backdrop click cancels (triggers cancel which resolves false)
  els.confirmModal.overlay.addEventListener("click", (e) => {
    if (e.target === els.confirmModal.overlay)
      els.confirmModal.cancelBtn.click();
  });
  els.detailModal.copyBtn.addEventListener("click", copyBmrForWhatsApp);
  els.detailModal.editBtn.addEventListener("click", () => {
    const row = state.detailRow;
    closeDetailModal();
    openEditModal({
      id: row.id,
      mapped: row.isMapped,
      item: row.item,
      bn: row.bn,
      batchSize: row.batchSize,
      uom: row.uom,
    });
  });
  els.detailModal.deleteBtn.addEventListener("click", async () => {
    const row = state.detailRow;
    if (row.isMapped) {
      toast("Mapped BMR cannot be deleted.", "warn");
      return;
    }
    const confirmed = await confirmDialog(
      "This will permanently remove the BMR entry. This action cannot be undone.",
      `${row.item} / BN: ${row.bn}`,
    );
    if (!confirmed) return;
    const { error } = await supabase
      .from("bmr_details")
      .delete()
      .eq("id", row.id);
    if (error) {
      toast(`Delete failed: ${error.message}`, "error");
      return;
    }
    toast("BMR entry deleted.", "success");
    closeDetailModal();
    await renderManageTable();
  });

  // EXPLORE tab — hierarchy filters are inside the hierarchy modal.
  // Item / BN / table-row listeners are wired in the modal section below.
  els.explore.tableBody.addEventListener("click", (e) => {
    const tr = e.target.closest("tr.clickable-row");
    if (!tr || !tr.dataset.item) return;
    openDetailModal({
      source: "explore",
      item: tr.dataset.item,
      bn: tr.dataset.bn,
      batchSize: tr.dataset.size,
      uom: tr.dataset.uom,
      category: tr.dataset.cat,
      subcategory: tr.dataset.sub,
      group: tr.dataset.grp,
      subGroup: tr.dataset.sg,
    });
  });

  // ── Hierarchy filter modal ──────────────────────────────────
  /** Reflect whether any hierarchy filter is active on the funnel button */
  function updateHierarchyBadge() {
    const active =
      els.explore.filterCategory.value ||
      els.explore.filterSubCategory.value ||
      els.explore.filterGroup.value ||
      els.explore.filterSubGroup.value;
    els.explore.openHierarchyBtn.classList.toggle("has-filter", !!active);
    els.explore.openHierarchyBtn.title = active
      ? "Hierarchy filter active – click to change"
      : "Filter by Hierarchy";
  }

  function openHierarchyModal() {
    els.explore.hierarchyModal.classList.remove("hidden");
    els.explore.hierarchyModal.addEventListener(
      "click",
      (e) => {
        if (e.target === els.explore.hierarchyModal) closeHierarchyModal();
      },
      { once: true },
    );
  }

  function closeHierarchyModal() {
    els.explore.hierarchyModal.classList.add("hidden");
  }

  els.explore.openHierarchyBtn.addEventListener("click", openHierarchyModal);
  els.explore.hierarchyModalClose.addEventListener(
    "click",
    closeHierarchyModal,
  );

  // "Clear Hierarchy" — resets only the 4 hierarchy selects inside the modal
  els.explore.clearBtn.addEventListener("click", async () => {
    els.explore.filterCategory.value = "";
    els.explore.filterSubCategory.value = "";
    els.explore.filterGroup.value = "";
    els.explore.filterSubGroup.value = "";
    state.eligibleItems = [];
    populateSubCategories();
    populateGroups();
    populateSubGroups();
    await loadExploreItems();
    updateHierarchyBadge();
  });

  // "Apply" — closes modal and refreshes table
  els.explore.applyHierarchyBtn.addEventListener("click", async () => {
    closeHierarchyModal();
    state.eligibleItems = [];
    await loadExploreItems();
    updateHierarchyBadge();
    resetExplorePg();
    await renderExploreTable();
  });

  // Each hierarchy dropdown also refreshes its children live (no Apply needed
  // for narrowing the dropdowns themselves — Apply commits to the table)
  els.explore.filterCategory.addEventListener("change", () => {
    els.explore.filterSubCategory.value = "";
    els.explore.filterGroup.value = "";
    els.explore.filterSubGroup.value = "";
    populateSubCategories();
    populateGroups();
    populateSubGroups();
  });
  els.explore.filterSubCategory.addEventListener("change", () => {
    els.explore.filterGroup.value = "";
    els.explore.filterSubGroup.value = "";
    populateGroups();
    populateSubGroups();
  });
  els.explore.filterGroup.addEventListener("change", () => {
    els.explore.filterSubGroup.value = "";
    populateSubGroups();
  });

  // ── Inline Item / BN controls ───────────────────────────────
  // Clear Item + BN only
  els.explore.clearItemBnBtn.addEventListener("click", async () => {
    els.explore.filterItem.value = "";
    els.explore.filterBn.value = "";
    resetExplorePg();
    await renderExploreTable();
  });

  els.explore.filterItem.addEventListener("change", () => {
    resetExplorePg();
    renderExploreTable().catch(console.error);
  });

  // BN is free-text — debounced so typing doesn't fire a query on every keystroke
  let bnDebounce;
  els.explore.filterBn.addEventListener("input", () => {
    clearTimeout(bnDebounce);
    bnDebounce = setTimeout(() => {
      resetExplorePg();
      renderExploreTable().catch(console.error);
    }, 350);
  });

  els.explore.pageSizeSelect.addEventListener("change", () => {
    state.explorePg.pageSize = Number(els.explore.pageSizeSelect.value);
    resetExplorePg();
    renderExploreTable().catch(console.error);
  });
  els.explore.nextBtn.addEventListener("click", async () => {
    if (!state.explorePg.nextCursor) return;
    state.explorePg.cursorStack.push(state.explorePg.currentCursor);
    state.explorePg.currentCursor = state.explorePg.nextCursor;
    state.explorePg.page++;
    await renderExploreTable(state.explorePg.currentCursor);
  });
  els.explore.prevBtn.addEventListener("click", async () => {
    if (!state.explorePg.cursorStack.length) return;
    state.explorePg.currentCursor = state.explorePg.cursorStack.pop();
    state.explorePg.page--;
    await renderExploreTable(state.explorePg.currentCursor);
  });
}

/* ═══════════════════════════════════════════════════════════════
   Boot
   ═══════════════════════════════════════════════════════════════ */
async function init() {
  showStatus("Loading…", "warn");
  const boot = await bootstrapApp({ requireSession: true, debug: false });
  if (!boot.ok) return;

  const allowed = await loadPermissions();
  if (!allowed) return;
  clearStatus();

  applyTabVisibility();
  wireEvents();

  // Load all shared data in parallel
  await Promise.all([loadProducts(), loadHierarchyMap(), loadCategories()]);
  // Populate all hierarchy dropdowns (ERP-style: all open at startup)
  populateSubCategories();
  populateGroups();
  populateSubGroups();
  await loadExploreItems();
  clearCreateRows();

  // Handle query-string deep links: ?item=XXX&bn=YYY&size=ZZZ
  const qs = new URLSearchParams(window.location.search);
  const qsItem = qs.get("item");
  const qsBn = qs.get("bn");
  const qsSize = qs.get("size");

  if (qsItem && state.allowedTabs.has("add")) {
    await setActiveTab("add");
    clearCreateRows();
    addCreateRow({ item: qsItem, bn: qsBn || "", size: qsSize || "", uom: "" });
  } else if (qsItem && state.allowedTabs.has("explore")) {
    await setActiveTab("explore");
    els.explore.filterItem.value = qsItem;
    if (qsBn) els.explore.filterBn.value = qsBn;
    await renderExploreTable();
  } else {
    const first = ["explore", "manage", "add"].find((t) =>
      state.allowedTabs.has(t),
    );
    await setActiveTab(first || "explore");
  }
}

init().catch((e) => {
  console.error("manage-bmr init error:", e);
  const sa = document.getElementById("statusArea");
  if (sa) {
    sa.className = "sa-error";
    sa.textContent = `Failed to load: ${e.message}`;
  }
});
