import pathlib

JS = r"""/**
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
  add:     ["module:manage-bmr:add",    "module:bmr:add"],
  manage:  ["module:manage-bmr:manage", "module:bmr:edit"],
  explore: ["module:manage-bmr:explore","module:bmr:view"],
};

/* ── Module state ────────────────────────────────────────────── */
const state = {
  activeTab: "add",
  allowedTabs: new Set(),
  products: [],          // [{id, item, sub_group_id}]
  hierarchyMap: Object.create(null), // item.toLowerCase() -> {category_name,…}
  eligibleItems: [],     // [] means no upstream hierarchy filter → show all
  editId: null,          // bmr_details.id currently being edited
  editMapped: false,
};

/* ── Element shortcut ────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);

const els = {
  statusArea: $("statusArea"),
  tabBar:     $("tabBar"),
  refreshBtn: $("refreshBtn"),
  homeBtn:    $("homeBtn"),
  panels: {
    add:     $("panel-add"),
    manage:  $("panel-manage"),
    explore: $("panel-explore"),
  },
  add: {
    csvFile:         $("csvFile"),
    downloadTemplate:$("downloadTemplate"),
    uploadCsv:       $("uploadCsv"),
    tableBody:       $("createTableBody"),
    itemList:        $("itemList"),
    addRowBtn:       $("addRowBtn"),
    clearRowsBtn:    $("clearRowsBtn"),
    submitCreateBtn: $("submitCreateBtn"),
    createCount:     $("createCount"),
  },
  manage: {
    filterItem:  $("manageFilterItem"),
    filterBn:    $("manageFilterBn"),
    clearBtn:    $("manageClearBtn"),
    tableBody:   $("manageTableBody"),
    count:       $("manageCount"),
  },
  explore: {
    filterCategory:    $("filterCategory"),
    filterSubCategory: $("filterSubCategory"),
    filterGroup:       $("filterGroup"),
    filterSubGroup:    $("filterSubGroup"),
    filterItem:        $("filterItem"),
    filterBn:          $("filterBn"),
    clearBtn:          $("clearExploreBtn"),
    tableBody:         $("exploreTableBody"),
    count:             $("exploreCount"),
    kpiRows:           $("kpiRows"),
    kpiItems:          $("kpiItems"),
    kpiBn:             $("kpiBn"),
    kpiAvg:            $("kpiAvg"),
  },
  editModal: {
    overlay:    $("editModal"),
    item:       $("editItem"),
    bn:         $("editBn"),
    size:       $("editSize"),
    uom:        $("editUom"),
    closeBtn:   $("editModalClose"),
    cancelBtn:  $("editCancelBtn"),
    saveBtn:    $("editSaveBtn"),
    mappedNote: $("editMappedNote"),
  },
  toastContainer: $("toastContainer"),
};

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
    numeric: true, sensitivity: "base",
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
    showStatus("Access denied. You do not have permission to view Manage BMR.", "error");
    return false;
  }
  const [canAdd, canManage, canExplore] = await Promise.all([
    canAccessAny(TAB_TARGETS.add,     ["edit", "view"]),
    canAccessAny(TAB_TARGETS.manage,  "edit"),
    canAccessAny(TAB_TARGETS.explore, "view"),
  ]);
  if (canAdd)     state.allowedTabs.add("add");
  if (canManage)  state.allowedTabs.add("manage");
  if (canExplore) state.allowedTabs.add("explore");
  // Fallback: module-level view grants explore
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
  if (tab === "manage")  await renderManageTable();
  if (tab === "explore") await renderExploreTable();
}

/* ── SELECT helper ───────────────────────────────────────────── */
function fillSelect(el, rows, valKey, txtKey, placeholder) {
  el.innerHTML =
    `<option value="">${placeholder}</option>` +
    rows.map((r) => `<option value="${escHtml(r[valKey])}">${escHtml(r[txtKey])}</option>`).join("");
}

/* ═══════════════════════════════════════════════════════════════
   CREATE tab
   ═══════════════════════════════════════════════════════════════ */
function csvToRows(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  const expectedHeader = ["item", "bn", "batch_size", "uom"];
  const firstCols = (lines[0] || "")
    .split(",")
    .map((x) => x.trim().replace(/^"|"$/g, "").toLowerCase());
  const hasHeader = expectedHeader.every((h, i) => firstCols[i] === h);
  const body = hasHeader ? lines.slice(1) : lines;
  return body.map((ln, idx) => {
    const [item, bn, batch_size, uom] = ln.split(",").map((x) => x.trim().replace(/^"|"$/g, ""));
    if (!item || !bn || !uom) {
      throw new Error(`CSV row ${idx + (hasHeader ? 2 : 1)} is incomplete (item/bn/uom required).`);
    }
    return { item, bn, size: Number(batch_size) || null, uom };
  });
}

function addCreateRow(seed = {}) {
  const tr = document.createElement("tr");
  const uomOpts = ["Kg", "L", "Nos", "g", "mL"]
    .map((u) => `<option${seed.uom === u ? " selected" : ""}>${u}</option>`)
    .join("");
  tr.innerHTML = `
    <td><input class="c-item" list="itemList" value="${escHtml(seed.item || "")}" autocomplete="off" /></td>
    <td><input class="c-bn"   value="${escHtml(seed.bn   || "")}" /></td>
    <td><input class="c-size" type="number" step="0.01" min="0" value="${escHtml(seed.size ?? "")}" /></td>
    <td><select class="c-uom"><option value="">UOM</option>${uomOpts}</select></td>
    <td><button class="btn ghost row-del" type="button" style="padding:4px 8px;font-size:12px">&#x2715;</button></td>
  `;
  tr.querySelector(".row-del").addEventListener("click", () => {
    if (els.add.tableBody.children.length > 1) {
      tr.remove();
      updateCreateCount();
    }
  });
  els.add.tableBody.appendChild(tr);
  updateCreateCount();
}

function clearCreateRows() {
  els.add.tableBody.innerHTML = "";
  addCreateRow();
}

function updateCreateCount() {
  const n = els.add.tableBody.children.length;
  els.add.createCount.textContent = n > 0 ? `${n} row${n === 1 ? "" : "s"}` : "";
}

function getCreateRowsFromTable() {
  const rows = Array.from(els.add.tableBody.querySelectorAll("tr")).map((tr, i) => {
    const item = tr.querySelector(".c-item").value.trim();
    const bn   = tr.querySelector(".c-bn").value.trim();
    const size = tr.querySelector(".c-size").value.trim();
    const uom  = tr.querySelector(".c-uom").value;
    if (!item || !bn || !uom) throw new Error(`Row ${i + 1}: item, BN and UOM are required.`);
    return { item, bn, size: size ? Number(size) : null, uom };
  });
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

  const { error } = await supabase.from("bmr_details").insert([{
    item:       entry.item,
    bn:         entry.bn,
    batch_size: entry.size,
    uom:        entry.uom,
    product_id: prod.id,
  }]);
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
  if (!rows.length) { showStatus("No rows to create.", "warn"); return; }

  els.add.submitCreateBtn.disabled = true;
  clearStatus();
  let ok = 0, dup = 0, err = 0;
  const missing = new Set();
  for (const row of rows) {
    const res = await insertBmrRow(row);
    if (res.ok)             ok++;
    else if (res.dup)       dup++;
    else { err++; if (res.missingProduct) missing.add(row.item); }
  }
  els.add.submitCreateBtn.disabled = false;

  let msg = `Done. Created: ${ok}`;
  if (dup)  msg += `, duplicates skipped: ${dup}`;
  if (err)  msg += `, errors: ${err}`;
  if (missing.size) msg += `. Unknown products: ${[...missing].slice(0, 5).join(", ")}`;
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
async function renderManageTable() {
  els.manage.tableBody.innerHTML = `<tr><td colspan="6" class="empty-state">Loading…</td></tr>`;
  let q = supabase
    .from("v_bmr_with_map_flag")
    .select("bmr_id,item,bn,batch_size,uom,is_mapped")
    .order("bmr_id", { ascending: false })
    .limit(200);
  if (els.manage.filterItem.value) q = q.eq("item", els.manage.filterItem.value);
  if (els.manage.filterBn.value.trim()) q = q.eq("bn", els.manage.filterBn.value.trim());

  const { data, error } = await q;
  if (error) {
    els.manage.tableBody.innerHTML = `<tr><td colspan="6" class="empty-state">Error loading data.</td></tr>`;
    throw error;
  }
  const rows = normalizeRows(data);
  els.manage.count.textContent = rows.length ? `${rows.length} row${rows.length === 1 ? "" : "s"}` : "";
  if (!rows.length) {
    els.manage.tableBody.innerHTML = `<tr><td colspan="6" class="empty-state">No entries found.</td></tr>`;
    return;
  }
  els.manage.tableBody.innerHTML = rows.map((r) => `
    <tr data-id="${r.bmr_id}" data-mapped="${r.is_mapped}">
      <td>${escHtml(r.item)}</td>
      <td>${escHtml(r.bn)}</td>
      <td>${escHtml(r.batch_size ?? "")}</td>
      <td>${escHtml(r.uom ?? "")}</td>
      <td>${r.is_mapped
        ? '<span class="badge-mapped">Mapped</span>'
        : '<span class="badge-free">Free</span>'}</td>
      <td><div class="td-actions">
        <button class="btn ghost act-edit" type="button" style="padding:4px 8px;font-size:12px">Edit</button>
        <button class="btn ghost act-del danger" type="button" style="padding:4px 8px;font-size:12px">Delete</button>
      </div></td>
    </tr>
  `).join("");
}

async function handleManageAction(e) {
  const tr = e.target.closest("tr[data-id]");
  if (!tr) return;
  const id     = tr.dataset.id;
  const mapped = tr.dataset.mapped === "true";

  if (e.target.matches(".act-del")) {
    if (mapped) { toast("Mapped BMR cannot be deleted.", "warn"); return; }
    if (!confirm(`Delete BMR entry #${id}?\nItem: ${tr.children[0].textContent}`)) return;
    const { error } = await supabase.from("bmr_details").delete().eq("id", id);
    if (error) { toast(`Delete failed: ${error.message}`, "error"); return; }
    toast("BMR entry deleted.", "success");
    await renderManageTable();
    return;
  }

  if (e.target.matches(".act-edit")) {
    openEditModal({
      id,
      mapped,
      item:      tr.children[0].textContent,
      bn:        tr.children[1].textContent,
      batchSize: tr.children[2].textContent,
      uom:       tr.children[3].textContent,
    });
  }
}

/* ── Edit modal ──────────────────────────────────────────────── */
function openEditModal({ id, mapped, item, bn, batchSize, uom }) {
  state.editId     = id;
  state.editMapped = mapped;

  // Populate item dropdown from loaded products list
  const opts = state.products.map((p) =>
    `<option value="${escHtml(p.item)}"${p.item === item ? " selected" : ""}>${escHtml(p.item)}</option>`
  ).join("");
  els.editModal.item.innerHTML = `<option value="">— Select Item —</option>${opts}`;

  els.editModal.bn.value   = bn;
  els.editModal.size.value = batchSize;
  els.editModal.uom.value  = uom;

  // Lock BN + Size when mapped
  els.editModal.bn.disabled   = mapped;
  els.editModal.size.disabled = mapped;
  els.editModal.mappedNote.classList.toggle("hidden", !mapped);

  els.editModal.overlay.classList.remove("hidden");
  els.editModal.item.focus();
}

function closeEditModal() {
  els.editModal.overlay.classList.add("hidden");
  state.editId     = null;
  state.editMapped = false;
}

async function saveEditModal() {
  const item = els.editModal.item.value.trim();
  const bn   = els.editModal.bn.value.trim();
  const size = els.editModal.size.value.trim();
  const uom  = els.editModal.uom.value;

  if (!item) { toast("Item is required.", "warn"); return; }
  if (!bn)   { toast("BN is required.",   "warn"); return; }
  if (!uom)  { toast("UOM is required.",  "warn"); return; }

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

  if (error) { toast(`Save failed: ${error.message}`, "error"); return; }
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
    { data: sgs  },
    { data: prods },
  ] = await Promise.all([
    supabase.from("categories")    .select("id,category_name"),
    supabase.from("sub_categories").select("id,subcategory_name,category_id"),
    supabase.from("product_groups").select("id,group_name,sub_category_id"),
    supabase.from("sub_groups")    .select("id,sub_group_name,product_group_id"),
    supabase.from("products")      .select("item,sub_group_id").eq("status", "Active"),
  ]);
  const catMap = Object.create(null);
  const subMap = Object.create(null);
  const grpMap = Object.create(null);
  const sgMap  = Object.create(null);
  (cats || []).forEach((c) => (catMap[c.id] = c.category_name));
  (subs || []).forEach((s) => (subMap[s.id] = { name: s.subcategory_name, category_id: s.category_id }));
  (grps || []).forEach((g) => (grpMap[g.id] = { name: g.group_name,       sub_category_id: g.sub_category_id }));
  (sgs  || []).forEach((s) => (sgMap[s.id]  = { name: s.sub_group_name,   product_group_id: s.product_group_id }));
  const map = Object.create(null);
  (prods || []).forEach((p) => {
    const key = String(p.item || "").trim().toLowerCase();
    const sg  = sgMap[p.sub_group_id];
    const grp = sg  ? grpMap[sg.product_group_id]  : null;
    const sub = grp ? subMap[grp.sub_category_id]  : null;
    map[key] = {
      category_name:    sub  ? (catMap[sub.category_id] || "") : "",
      subcategory_name: sub?.name  || "",
      group_name:       grp?.name  || "",
      sub_group_name:   sg?.name   || "",
    };
  });
  state.hierarchyMap = map;
}

async function loadCategories() {
  const { data } = await supabase.from("categories").select("id,category_name").order("category_name");
  fillSelect(els.explore.filterCategory, normalizeRows(data), "id", "category_name", "All Categories");
}

async function loadSubCategories() {
  const cat = els.explore.filterCategory.value;
  if (!cat) {
    fillSelect(els.explore.filterSubCategory, [], "id", "subcategory_name", "All Subcategories");
    els.explore.filterSubCategory.disabled = true;
    return;
  }
  const { data } = await supabase
    .from("sub_categories").select("id,subcategory_name")
    .eq("category_id", cat).order("subcategory_name");
  fillSelect(els.explore.filterSubCategory, normalizeRows(data), "id", "subcategory_name", "All Subcategories");
  els.explore.filterSubCategory.disabled = false;
}

async function loadGroups() {
  const sub = els.explore.filterSubCategory.value;
  if (!sub) {
    fillSelect(els.explore.filterGroup, [], "id", "group_name", "All Groups");
    els.explore.filterGroup.disabled = true;
    return;
  }
  const { data } = await supabase
    .from("product_groups").select("id,group_name")
    .eq("sub_category_id", sub).order("group_name");
  fillSelect(els.explore.filterGroup, normalizeRows(data), "id", "group_name", "All Groups");
  els.explore.filterGroup.disabled = false;
}

async function loadSubGroups() {
  const grp = els.explore.filterGroup.value;
  if (!grp) {
    fillSelect(els.explore.filterSubGroup, [], "id", "sub_group_name", "All Sub-groups");
    els.explore.filterSubGroup.disabled = true;
    return;
  }
  const { data } = await supabase
    .from("sub_groups").select("id,sub_group_name")
    .eq("product_group_id", grp).order("sub_group_name");
  fillSelect(els.explore.filterSubGroup, normalizeRows(data), "id", "sub_group_name", "All Sub-groups");
  els.explore.filterSubGroup.disabled = false;
}

async function loadExploreItems() {
  let q = supabase.from("products").select("item,sub_group_id").eq("status", "Active");
  if (els.explore.filterSubGroup.value) q = q.eq("sub_group_id", els.explore.filterSubGroup.value);
  const { data } = await q.order("item");
  const items = normalizeRows(data);
  fillSelect(els.explore.filterItem, items, "item", "item", "All Items");
  // Only restrict explore query when a hierarchy filter is active
  const hasHierarchyFilter =
    els.explore.filterCategory.value ||
    els.explore.filterSubCategory.value ||
    els.explore.filterGroup.value ||
    els.explore.filterSubGroup.value;
  state.eligibleItems = hasHierarchyFilter ? items.map((r) => r.item) : [];
}

async function loadExploreBns() {
  const item = els.explore.filterItem.value;
  if (!item) {
    fillSelect(els.explore.filterBn, [], "bn", "bn", "All BNs");
    els.explore.filterBn.disabled = true;
    return;
  }
  const { data } = await supabase
    .from("bmr_details").select("bn")
    .eq("item", item).order("bn");
  // Deduplicate BNs client-side (view may not support distinct well)
  const unique = [...new Map(normalizeRows(data).map((r) => [r.bn, r])).values()];
  fillSelect(els.explore.filterBn, unique, "bn", "bn", "All BNs");
  els.explore.filterBn.disabled = false;
}

async function renderExploreTable() {
  els.explore.tableBody.innerHTML = `<tr><td colspan="8" class="empty-state">Loading…</td></tr>`;
  let q = supabase.from("bmr_details").select("item,bn,batch_size,uom").limit(5000);
  if (state.eligibleItems.length) q = q.in("item", state.eligibleItems);
  if (els.explore.filterItem.value) q = q.eq("item", els.explore.filterItem.value);
  if (els.explore.filterBn.value)   q = q.eq("bn",   els.explore.filterBn.value);

  const { data, error } = await q;
  if (error) {
    els.explore.tableBody.innerHTML = `<tr><td colspan="8" class="empty-state">Error loading data.</td></tr>`;
    throw error;
  }
  const rows = normalizeRows(data).map((r) => {
    const h = state.hierarchyMap[String(r.item || "").trim().toLowerCase()] || {};
    return { ...r, ...h };
  });
  rows.sort((a, b) => {
    let c;
    if ((c = naturalCompare(a.category_name,    b.category_name))    !== 0) return c;
    if ((c = naturalCompare(a.subcategory_name, b.subcategory_name)) !== 0) return c;
    if ((c = naturalCompare(a.group_name,       b.group_name))       !== 0) return c;
    if ((c = naturalCompare(a.sub_group_name,   b.sub_group_name))   !== 0) return c;
    if ((c = naturalCompare(a.item,             b.item))             !== 0) return c;
    return naturalCompare(a.bn, b.bn);
  });

  const uniqueItems = new Set(rows.map((r) => r.item)).size;
  const uniqueBn    = new Set(rows.map((r) => `${r.item}::${r.bn}`)).size;
  const avg = rows.length
    ? rows.reduce((s, r) => s + (Number(r.batch_size) || 0), 0) / rows.length
    : 0;

  els.explore.kpiRows.textContent  = String(rows.length);
  els.explore.kpiItems.textContent = String(uniqueItems);
  els.explore.kpiBn.textContent    = String(uniqueBn);
  els.explore.kpiAvg.textContent   = avg > 0 ? avg.toFixed(2) : "—";
  els.explore.count.textContent    = rows.length ? `${rows.length} row${rows.length === 1 ? "" : "s"}` : "";

  if (!rows.length) {
    els.explore.tableBody.innerHTML = `<tr><td colspan="8" class="empty-state">No BMR entries found for this filter.</td></tr>`;
    return;
  }
  els.explore.tableBody.innerHTML = rows.map((r) => `
    <tr>
      <td>${escHtml(r.category_name    || "")}</td>
      <td>${escHtml(r.subcategory_name || "")}</td>
      <td>${escHtml(r.group_name       || "")}</td>
      <td>${escHtml(r.sub_group_name   || "")}</td>
      <td>${escHtml(r.item)}</td>
      <td>${escHtml(r.bn)}</td>
      <td>${escHtml(r.batch_size ?? "")}</td>
      <td>${escHtml(r.uom ?? "")}</td>
    </tr>
  `).join("");
}

/* ═══════════════════════════════════════════════════════════════
   Data loading
   ═══════════════════════════════════════════════════════════════ */
async function loadProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("id,item,sub_group_id")
    .eq("status", "Active")
    .order("item");
  if (error) throw error;
  state.products = normalizeRows(data);

  // Datalist for create tab
  els.add.itemList.innerHTML = state.products
    .map((r) => `<option value="${escHtml(r.item)}"></option>`)
    .join("");

  // Manage filter dropdown
  const managOpts = `<option value="">All Items</option>` +
    state.products.map((r) => `<option value="${escHtml(r.item)}">${escHtml(r.item)}</option>`).join("");
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
      if (state.activeTab === "manage")  await renderManageTable();
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
    const csv  = "item,bn,batch_size,uom\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "bmr-template.csv";
    document.body.appendChild(a); a.click(); a.remove();
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
      toast(`Loaded ${rows.length} row${rows.length === 1 ? "" : "s"} from CSV.`, "success");
    } catch (e) {
      showStatus(e.message, "warn");
    }
  });
  els.add.addRowBtn.addEventListener("click", () => addCreateRow());
  els.add.clearRowsBtn.addEventListener("click", clearCreateRows);
  els.add.submitCreateBtn.addEventListener("click", submitCreateEntries);

  // MANAGE tab
  els.manage.filterItem.addEventListener("change",  () => renderManageTable().catch(console.error));
  els.manage.filterBn.addEventListener("input",     () => renderManageTable().catch(console.error));
  els.manage.clearBtn.addEventListener("click", async () => {
    els.manage.filterItem.value = "";
    els.manage.filterBn.value   = "";
    await renderManageTable();
  });
  els.manage.tableBody.addEventListener("click", async (e) => {
    try { await handleManageAction(e); }
    catch (err) { showStatus(`Action failed: ${err.message}`, "error"); }
  });

  // Edit modal
  els.editModal.closeBtn .addEventListener("click", closeEditModal);
  els.editModal.cancelBtn.addEventListener("click", closeEditModal);
  els.editModal.saveBtn  .addEventListener("click", () => saveEditModal().catch(console.error));
  els.editModal.overlay  .addEventListener("click", (e) => {
    if (e.target === els.editModal.overlay) closeEditModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.editModal.overlay.classList.contains("hidden")) closeEditModal();
  });

  // EXPLORE tab
  els.explore.filterCategory.addEventListener("change", async () => {
    els.explore.filterSubCategory.value = "";
    els.explore.filterGroup.value       = "";
    els.explore.filterSubGroup.value    = "";
    els.explore.filterItem.value        = "";
    els.explore.filterBn.value          = "";
    els.explore.filterGroup.disabled    = true;
    els.explore.filterSubGroup.disabled = true;
    els.explore.filterBn.disabled       = true;
    await loadSubCategories();
    await loadExploreItems();
    await loadExploreBns();
    await renderExploreTable();
  });
  els.explore.filterSubCategory.addEventListener("change", async () => {
    els.explore.filterGroup.value       = "";
    els.explore.filterSubGroup.value    = "";
    els.explore.filterItem.value        = "";
    els.explore.filterBn.value          = "";
    els.explore.filterSubGroup.disabled = true;
    els.explore.filterBn.disabled       = true;
    await loadGroups();
    await loadExploreItems();
    await loadExploreBns();
    await renderExploreTable();
  });
  els.explore.filterGroup.addEventListener("change", async () => {
    els.explore.filterSubGroup.value    = "";
    els.explore.filterItem.value        = "";
    els.explore.filterBn.value          = "";
    els.explore.filterBn.disabled       = true;
    await loadSubGroups();
    await loadExploreItems();
    await loadExploreBns();
    await renderExploreTable();
  });
  els.explore.filterSubGroup.addEventListener("change", async () => {
    els.explore.filterItem.value = "";
    els.explore.filterBn.value   = "";
    els.explore.filterBn.disabled = true;
    await loadExploreItems();
    await loadExploreBns();
    await renderExploreTable();
  });
  els.explore.filterItem.addEventListener("change", async () => {
    els.explore.filterBn.value = "";
    await loadExploreBns();
    await renderExploreTable();
  });
  els.explore.filterBn.addEventListener("change", () => renderExploreTable().catch(console.error));
  els.explore.clearBtn.addEventListener("click", async () => {
    els.explore.filterCategory.value    = "";
    els.explore.filterSubCategory.value = ""; els.explore.filterSubCategory.disabled = true;
    els.explore.filterGroup.value       = ""; els.explore.filterGroup.disabled       = true;
    els.explore.filterSubGroup.value    = ""; els.explore.filterSubGroup.disabled    = true;
    els.explore.filterItem.value        = "";
    els.explore.filterBn.value          = ""; els.explore.filterBn.disabled          = true;
    state.eligibleItems = [];
    await loadExploreItems();
    await renderExploreTable();
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
  await Promise.all([
    loadProducts(),
    loadHierarchyMap(),
    loadCategories(),
  ]);
  await loadExploreItems();
  await loadExploreBns();
  clearCreateRows();

  // Handle query-string deep links: ?item=XXX&bn=YYY&size=ZZZ
  const qs     = new URLSearchParams(window.location.search);
  const qsItem = qs.get("item");
  const qsBn   = qs.get("bn");
  const qsSize = qs.get("size");

  if (qsItem && state.allowedTabs.has("add")) {
    await setActiveTab("add");
    clearCreateRows();
    addCreateRow({ item: qsItem, bn: qsBn || "", size: qsSize || "", uom: "" });
  } else if (qsItem && state.allowedTabs.has("explore")) {
    await setActiveTab("explore");
    els.explore.filterItem.value = qsItem;
    await loadExploreBns();
    if (qsBn) els.explore.filterBn.value = qsBn;
    await renderExploreTable();
  } else {
    const first = ["add", "manage", "explore"].find((t) => state.allowedTabs.has(t));
    await setActiveTab(first || "explore");
  }
}

init().catch((e) => {
  console.error("manage-bmr init error:", e);
  const sa = document.getElementById("statusArea");
  if (sa) { sa.className = "sa-error"; sa.textContent = `Failed to load: ${e.message}`; }
});
"""

dest = pathlib.Path(r"d:\ELECTRON PROJECTS\daily-worklog-app\public\shared\js\manage-bmr.js")
dest.write_text(JS, encoding="utf-8")
print(f"Written {len(JS)} chars to {dest}")
