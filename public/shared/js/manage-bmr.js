import { supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";
import { bootstrapApp } from "./appBootstrap.js";
import { hasPermission } from "./appAuth.js";

const MODULE_TARGETS = ["module:manage-bmr", "module:bmr"];
const TAB_TARGETS = {
  add: ["module:manage-bmr:add", "module:bmr:add"],
  manage: ["module:manage-bmr:manage", "module:bmr:edit"],
  explore: ["module:manage-bmr:explore", "module:bmr:view"],
};

const state = {
  activeTab: "add",
  allowedTabs: new Set(),
  products: [],
  hierarchyMap: Object.create(null),
  eligibleItems: [],
  csvPreviewData: null,
};

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
  },
  manage: {
    filterItem: $("manageFilterItem"),
    filterBn: $("manageFilterBn"),
    clearBtn: $("manageClearBtn"),
    tableBody: $("manageTableBody"),
  },
  explore: {
    filterCategory: $("filterCategory"),
    filterSubCategory: $("filterSubCategory"),
    filterGroup: $("filterGroup"),
    filterSubGroup: $("filterSubGroup"),
    filterItem: $("filterItem"),
    filterBn: $("filterBn"),
    clearBtn: $("clearExploreBtn"),
    tableBody: $("exploreTableBody"),
    count: $("exploreCount"),
    kpiRows: $("kpiRows"),
    kpiItems: $("kpiItems"),
    kpiBn: $("kpiBn"),
    kpiAvg: $("kpiAvg"),
  },
};

function escHtml(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showStatus(msg, type = "warn") {
  els.statusArea.dataset.type = type;
  els.statusArea.textContent = msg;
}

function clearStatus() {
  els.statusArea.dataset.type = "";
  els.statusArea.style.display = "none";
}

function normalizeRows(rawRows) {
  return Array.isArray(rawRows) ? rawRows : [];
}

async function canAccessAny(targets, mode) {
  for (const t of targets) {
    if (await hasPermission(t, mode)) return true;
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

  const tabChecks = await Promise.all([
    canAccessAny(TAB_TARGETS.add, "create"),
    canAccessAny(TAB_TARGETS.manage, "edit"),
    canAccessAny(TAB_TARGETS.explore, "view"),
  ]);

  if (tabChecks[0]) state.allowedTabs.add("add");
  if (tabChecks[1]) state.allowedTabs.add("manage");
  if (tabChecks[2]) state.allowedTabs.add("explore");

  if (!state.allowedTabs.size) {
    // Fallback: module-level view gives explorer access.
    state.allowedTabs.add("explore");
  }
  return true;
}

function applyTabVisibility() {
  const buttons = els.tabBar.querySelectorAll(".tab-btn");
  buttons.forEach((btn) => {
    const tab = btn.dataset.tab;
    btn.classList.toggle("hidden", !state.allowedTabs.has(tab));
  });
}

function setActiveTab(tab) {
  if (!state.allowedTabs.has(tab)) return;
  state.activeTab = tab;
  els.tabBar.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  for (const [key, panel] of Object.entries(els.panels)) {
    panel.classList.toggle("active", key === tab);
  }
}

function csvToRows(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const expectedHeader = ["item", "bn", "batch_size", "uom"];
  const firstCols = (lines[0] || "")
    .replace(/^\uFEFF/, "")
    .split(",")
    .map((x) => x.trim().replace(/^"|"$/g, "").toLowerCase());
  const hasHeader = expectedHeader.every((h, i) => firstCols[i] === h);
  const body = hasHeader ? lines.slice(1) : lines;
  return body.map((ln, idx) => {
    const [item, bn, batch_size, uom] = ln
      .split(",")
      .map((x) => x.trim().replace(/^"|"$/g, ""));
    if (!item || !bn || !uom) {
      throw new Error(`CSV row ${idx + (hasHeader ? 2 : 1)} is incomplete.`);
    }
    return { item, bn, size: Number(batch_size) || null, uom };
  });
}

function addCreateRow(seed = {}) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="c-item" list="itemList" value="${escHtml(seed.item || "")}" /></td>
    <td><input class="c-bn" value="${escHtml(seed.bn || "")}" /></td>
    <td><input class="c-size" type="number" step="0.01" min="0" value="${escHtml(seed.size ?? "")}" /></td>
    <td>
      <select class="c-uom">
        <option value="">UOM</option>
        <option ${seed.uom === "Kg" ? "selected" : ""}>Kg</option>
        <option ${seed.uom === "L" ? "selected" : ""}>L</option>
        <option ${seed.uom === "Nos" ? "selected" : ""}>Nos</option>
        <option ${seed.uom === "g" ? "selected" : ""}>g</option>
        <option ${seed.uom === "mL" ? "selected" : ""}>mL</option>
      </select>
    </td>
    <td><button class="btn ghost row-del" type="button">Remove</button></td>
  `;
  tr.querySelector(".row-del").addEventListener("click", () => {
    if (els.add.tableBody.children.length > 1) tr.remove();
  });
  els.add.tableBody.appendChild(tr);
}

function clearCreateRows() {
  els.add.tableBody.innerHTML = "";
  addCreateRow();
}

async function loadProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("id,item,sub_group_id")
    .eq("status", "Active")
    .order("item");
  if (error) throw error;
  state.products = normalizeRows(data);
  els.add.itemList.innerHTML = state.products
    .map((r) => `<option value="${escHtml(r.item)}"></option>`)
    .join("");
  const options = `<option value="">All</option>${state.products
    .map((r) => `<option value="${escHtml(r.item)}">${escHtml(r.item)}</option>`)
    .join("")}`;
  els.manage.filterItem.innerHTML = options;
}

async function insertBmr(entry) {
  const { data: prod, error: prodErr } = await supabase
    .from("products")
    .select("id")
    .ilike("item", entry.item)
    .limit(1)
    .single();
  if (prodErr && prodErr.code !== "PGRST116") {
    return { err: true };
  }
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

async function submitCreateEntries(rows) {
  let ok = 0;
  let dup = 0;
  let err = 0;
  const missing = new Set();
  for (const row of rows) {
    const res = await insertBmr(row);
    if (res.ok) ok++;
    else if (res.dup) dup++;
    else {
      err++;
      if (res.missingProduct) missing.add(row.item);
    }
  }
  let msg = `Create complete. Added: ${ok}, duplicates: ${dup}, errors: ${err}.`;
  if (missing.size) {
    msg += ` Missing products: ${Array.from(missing).slice(0, 8).join(", ")}.`;
  }
  showStatus(msg, err ? "warn" : "warn");
}

function getCreateRowsFromTable() {
  const rows = Array.from(els.add.tableBody.querySelectorAll("tr")).map((tr) => ({
    item: tr.querySelector(".c-item").value.trim(),
    bn: tr.querySelector(".c-bn").value.trim(),
    size: tr.querySelector(".c-size").value || null,
    uom: tr.querySelector(".c-uom").value,
  }));
  rows.forEach((r, i) => {
    if (!r.item || !r.bn || !r.uom) {
      throw new Error(`Row ${i + 1} is incomplete.`);
    }
  });
  return rows;
}

async function renderManageTable() {
  let q = supabase
    .from("v_bmr_with_map_flag")
    .select("bmr_id,item,bn,batch_size,uom,is_mapped")
    .order("bmr_id", { ascending: false })
    .limit(100);
  if (els.manage.filterItem.value) q = q.eq("item", els.manage.filterItem.value);
  if (els.manage.filterBn.value.trim()) q = q.eq("bn", els.manage.filterBn.value.trim());
  const { data, error } = await q;
  if (error) throw error;
  const rows = normalizeRows(data);
  els.manage.tableBody.innerHTML = rows
    .map(
      (r) => `
      <tr data-id="${r.bmr_id}" data-mapped="${r.is_mapped}">
        <td>${escHtml(r.item)}</td>
        <td>${escHtml(r.bn)}</td>
        <td>${escHtml(r.batch_size ?? "")}</td>
        <td>${escHtml(r.uom ?? "")}</td>
        <td>${r.is_mapped ? "Yes" : "No"}</td>
        <td>
          <button class="btn ghost act-edit" type="button">Edit</button>
          <button class="btn ghost act-del" type="button">Delete</button>
        </td>
      </tr>
    `,
    )
    .join("");
}

async function handleManageAction(e) {
  const tr = e.target.closest("tr");
  if (!tr) return;
  const id = tr.dataset.id;
  const isMapped = tr.dataset.mapped === "true";
  if (e.target.matches(".act-del")) {
    if (isMapped) {
      showStatus("Mapped BMR cannot be deleted.", "warn");
      return;
    }
    if (!window.confirm(`Delete BMR #${id}?`)) return;
    const { error } = await supabase.from("bmr_details").delete().eq("id", id);
    if (error) throw error;
    await renderManageTable();
    return;
  }
  if (e.target.matches(".act-edit")) {
    const current = {
      item: tr.children[0].textContent,
      bn: tr.children[1].textContent,
      batchSize: tr.children[2].textContent,
      uom: tr.children[3].textContent,
    };
    const item = window.prompt("Item", current.item)?.trim();
    if (!item) return;
    const bn = isMapped
      ? current.bn
      : (window.prompt("BN", current.bn) || "").trim();
    if (!bn) return;
    const batch_size = isMapped
      ? Number(current.batchSize) || null
      : Number(window.prompt("Batch Size", current.batchSize) || "") || null;
    const uom = window.prompt("UOM", current.uom)?.trim();
    if (!uom) return;
    const { error } = await supabase
      .from("bmr_details")
      .update({ item, bn, batch_size, uom })
      .eq("id", id);
    if (error) throw error;
    await renderManageTable();
  }
}

function fillSelect(el, rows, valKey, txtKey, placeholder) {
  el.innerHTML =
    `<option value="">${placeholder}</option>` +
    rows
      .map((r) => `<option value="${escHtml(r[valKey])}">${escHtml(r[txtKey])}</option>`)
      .join("");
}

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
    supabase.from("products").select("item,sub_group_id").eq("status", "Active"),
  ]);

  const catMap = Object.create(null);
  const subMap = Object.create(null);
  const grpMap = Object.create(null);
  const sgMap = Object.create(null);
  (cats || []).forEach((c) => (catMap[c.id] = c.category_name));
  (subs || []).forEach(
    (s) => (subMap[s.id] = { name: s.subcategory_name, category_id: s.category_id }),
  );
  (grps || []).forEach(
    (g) => (grpMap[g.id] = { name: g.group_name, sub_category_id: g.sub_category_id }),
  );
  (sgs || []).forEach(
    (s) => (sgMap[s.id] = { name: s.sub_group_name, product_group_id: s.product_group_id }),
  );
  const map = Object.create(null);
  (prods || []).forEach((p) => {
    const key = String(p.item || "").trim().toLowerCase();
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
    "Category",
  );
}

async function loadSubCategories() {
  const cat = els.explore.filterCategory.value;
  if (!cat) {
    els.explore.filterSubCategory.disabled = true;
    fillSelect(els.explore.filterSubCategory, [], "id", "subcategory_name", "Subcategory");
    return;
  }
  const { data } = await supabase
    .from("sub_categories")
    .select("id,subcategory_name")
    .eq("category_id", cat)
    .order("subcategory_name");
  fillSelect(
    els.explore.filterSubCategory,
    normalizeRows(data),
    "id",
    "subcategory_name",
    "Subcategory",
  );
  els.explore.filterSubCategory.disabled = false;
}

async function loadGroups() {
  const sub = els.explore.filterSubCategory.value;
  if (!sub) {
    els.explore.filterGroup.disabled = true;
    fillSelect(els.explore.filterGroup, [], "id", "group_name", "Group");
    return;
  }
  const { data } = await supabase
    .from("product_groups")
    .select("id,group_name")
    .eq("sub_category_id", sub)
    .order("group_name");
  fillSelect(els.explore.filterGroup, normalizeRows(data), "id", "group_name", "Group");
  els.explore.filterGroup.disabled = false;
}

async function loadSubGroups() {
  const group = els.explore.filterGroup.value;
  if (!group) {
    els.explore.filterSubGroup.disabled = true;
    fillSelect(els.explore.filterSubGroup, [], "id", "sub_group_name", "Sub-group");
    return;
  }
  const { data } = await supabase
    .from("sub_groups")
    .select("id,sub_group_name")
    .eq("product_group_id", group)
    .order("sub_group_name");
  fillSelect(
    els.explore.filterSubGroup,
    normalizeRows(data),
    "id",
    "sub_group_name",
    "Sub-group",
  );
  els.explore.filterSubGroup.disabled = false;
}

async function loadExploreItems() {
  let q = supabase.from("products").select("item,sub_group_id").eq("status", "Active");
  if (els.explore.filterSubGroup.value) {
    q = q.eq("sub_group_id", els.explore.filterSubGroup.value);
  }
  const { data } = await q.order("item");
  const items = normalizeRows(data);
  fillSelect(els.explore.filterItem, items, "item", "item", "Item");
  state.eligibleItems = items.map((r) => r.item);
}

async function loadExploreBns() {
  const item = els.explore.filterItem.value;
  if (!item) {
    els.explore.filterBn.disabled = true;
    fillSelect(els.explore.filterBn, [], "bn", "bn", "BN");
    return;
  }
  const { data } = await supabase
    .from("bmr_details")
    .select("bn", { distinct: true })
    .eq("item", item)
    .order("bn");
  fillSelect(els.explore.filterBn, normalizeRows(data), "bn", "bn", "BN");
  els.explore.filterBn.disabled = false;
}

function naturalCompare(a = "", b = "") {
  return String(a || "").localeCompare(String(b || ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

async function renderExploreTable() {
  let q = supabase.from("bmr_details").select("item,bn,batch_size,uom").limit(5000);
  if (state.eligibleItems.length) q = q.in("item", state.eligibleItems);
  if (els.explore.filterItem.value) q = q.eq("item", els.explore.filterItem.value);
  if (els.explore.filterBn.value) q = q.eq("bn", els.explore.filterBn.value);
  const { data, error } = await q;
  if (error) throw error;
  const rows = normalizeRows(data).map((r) => {
    const h = state.hierarchyMap[String(r.item || "").trim().toLowerCase()] || {};
    return { ...r, ...h };
  });
  rows.sort((a, b) => {
    let c;
    if ((c = naturalCompare(a.category_name, b.category_name)) !== 0) return c;
    if ((c = naturalCompare(a.group_name, b.group_name)) !== 0) return c;
    if ((c = naturalCompare(a.sub_group_name, b.sub_group_name)) !== 0) return c;
    if ((c = naturalCompare(a.subcategory_name, b.subcategory_name)) !== 0) return c;
    if ((c = naturalCompare(a.item, b.item)) !== 0) return c;
    return naturalCompare(a.bn, b.bn);
  });
  els.explore.tableBody.innerHTML = rows
    .map(
      (r) => `<tr><td>${escHtml(r.item)}</td><td>${escHtml(r.bn)}</td><td>${escHtml(
        r.batch_size ?? "",
      )}</td><td>${escHtml(r.uom ?? "")}</td></tr>`,
    )
    .join("");
  const uniqueItems = new Set(rows.map((r) => r.item)).size;
  const uniqueBn = new Set(rows.map((r) => `${r.item}::${r.bn}`)).size;
  const avg = rows.length
    ? rows.reduce((s, r) => s + (Number(r.batch_size) || 0), 0) / rows.length
    : 0;
  els.explore.count.textContent = `${rows.length} row(s)`;
  els.explore.kpiRows.textContent = String(rows.length);
  els.explore.kpiItems.textContent = String(uniqueItems);
  els.explore.kpiBn.textContent = String(uniqueBn);
  els.explore.kpiAvg.textContent = avg.toFixed(2);
}

function wireEvents() {
  els.homeBtn.addEventListener("click", () => Platform.goHome());
  els.refreshBtn.addEventListener("click", async () => {
    try {
      clearStatus();
      if (state.activeTab === "manage") await renderManageTable();
      if (state.activeTab === "explore") await renderExploreTable();
    } catch (e) {
      showStatus(`Refresh failed: ${e.message}`, "error");
    }
  });
  els.tabBar.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      setActiveTab(btn.dataset.tab);
      if (btn.dataset.tab === "manage") await renderManageTable();
      if (btn.dataset.tab === "explore") await renderExploreTable();
    });
  });

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
      showStatus(`Loaded ${rows.length} row(s) from CSV.`, "warn");
    } catch (e) {
      showStatus(e.message, "error");
    }
  });
  els.add.addRowBtn.addEventListener("click", () => addCreateRow());
  els.add.clearRowsBtn.addEventListener("click", clearCreateRows);
  els.add.submitCreateBtn.addEventListener("click", async () => {
    try {
      const rows = getCreateRowsFromTable();
      await submitCreateEntries(rows);
      await renderManageTable();
    } catch (e) {
      showStatus(e.message, "error");
    }
  });

  els.manage.filterItem.addEventListener("change", renderManageTable);
  els.manage.filterBn.addEventListener("input", renderManageTable);
  els.manage.clearBtn.addEventListener("click", async () => {
    els.manage.filterItem.value = "";
    els.manage.filterBn.value = "";
    await renderManageTable();
  });
  els.manage.tableBody.addEventListener("click", async (e) => {
    try {
      await handleManageAction(e);
    } catch (err) {
      showStatus(`Action failed: ${err.message}`, "error");
    }
  });

  els.explore.filterCategory.addEventListener("change", async () => {
    els.explore.filterSubCategory.value = "";
    els.explore.filterGroup.value = "";
    els.explore.filterSubGroup.value = "";
    els.explore.filterItem.value = "";
    els.explore.filterBn.value = "";
    await loadSubCategories();
    await loadExploreItems();
    await loadExploreBns();
    await renderExploreTable();
  });
  els.explore.filterSubCategory.addEventListener("change", async () => {
    els.explore.filterGroup.value = "";
    els.explore.filterSubGroup.value = "";
    els.explore.filterItem.value = "";
    els.explore.filterBn.value = "";
    await loadGroups();
    await loadExploreItems();
    await loadExploreBns();
    await renderExploreTable();
  });
  els.explore.filterGroup.addEventListener("change", async () => {
    els.explore.filterSubGroup.value = "";
    els.explore.filterItem.value = "";
    els.explore.filterBn.value = "";
    await loadSubGroups();
    await loadExploreItems();
    await loadExploreBns();
    await renderExploreTable();
  });
  els.explore.filterSubGroup.addEventListener("change", async () => {
    els.explore.filterItem.value = "";
    els.explore.filterBn.value = "";
    await loadExploreItems();
    await loadExploreBns();
    await renderExploreTable();
  });
  els.explore.filterItem.addEventListener("change", async () => {
    els.explore.filterBn.value = "";
    await loadExploreBns();
    await renderExploreTable();
  });
  els.explore.filterBn.addEventListener("change", renderExploreTable);
  els.explore.clearBtn.addEventListener("click", async () => {
    els.explore.filterCategory.value = "";
    els.explore.filterSubCategory.value = "";
    els.explore.filterSubCategory.disabled = true;
    els.explore.filterGroup.value = "";
    els.explore.filterGroup.disabled = true;
    els.explore.filterSubGroup.value = "";
    els.explore.filterSubGroup.disabled = true;
    els.explore.filterItem.value = "";
    els.explore.filterBn.value = "";
    els.explore.filterBn.disabled = true;
    state.eligibleItems = [];
    await loadExploreItems();
    await renderExploreTable();
  });
}

async function init() {
  const boot = await bootstrapApp({ requireSession: true, debug: false });
  if (!boot.ok) return;

  const allowed = await loadPermissions();
  if (!allowed) return;
  clearStatus();

  applyTabVisibility();
  wireEvents();

  await loadProducts();
  await loadHierarchyMap();
  await loadCategories();
  await loadExploreItems();
  await loadExploreBns();
  clearCreateRows();

  const qs = new URLSearchParams(window.location.search);
  const qsItem = qs.get("item");
  const qsBn = qs.get("bn");
  const qsSize = qs.get("size");
  if (qsItem && state.allowedTabs.has("add")) {
    setActiveTab("add");
    clearCreateRows();
    addCreateRow({ item: qsItem, bn: qsBn || "", size: qsSize || "", uom: "" });
  } else if (qsItem && state.allowedTabs.has("explore")) {
    setActiveTab("explore");
    els.explore.filterItem.value = qsItem;
    await loadExploreBns();
    if (qsBn) els.explore.filterBn.value = qsBn;
    await renderExploreTable();
  } else {
    const first = ["add", "manage", "explore"].find((t) => state.allowedTabs.has(t));
    setActiveTab(first || "explore");
  }

  if (state.activeTab === "manage") await renderManageTable();
  if (state.activeTab === "explore") await renderExploreTable();
}

init().catch((e) => showStatus(`Init failed: ${e.message}`, "error"));
