import { supabase } from "./supabaseClient.js";
import { $, toast } from "./ui-helpers.js";

// Elements
const tbody = $("#tbl tbody");
const q = $("#q");
const filterCategory = $("#filterCategory");
const filterSubcategory = $("#filterSubcategory");
const filterGroup = $("#filterGroup");
const filterSubgroup = $("#filterSubgroup");
const btnResetFilters = $("#btnResetFilters");
const btnNew = $("#btnNew");
const rowCount = $("#rowCount");
// pageSizeSel may be created dynamically inside the paginator; use getElementById
const pageSizeSel = document.getElementById("pageSizeSel");
const paginatorEl = $("#paginator");

const editor = $("#editor");
const editorTitle = $("#editorTitle");
const nameEl = $("#name");
const uomEl = $("#uom");
const activeEl = $("#active");
const notesEl = $("#notes");
const rowIdEl = $("#rowId");
const btnSave = $("#btnSave");
const btnCancel = $("#btnCancel");

const pop = $("#catPopover");
const catClose = $("#catClose");
const catFor = $("#catFor");
const catRowId = $("#catRowId");
const catSel = $("#cat");
const subcatSel = $("#subcat");
const grpSel = $("#grp");
const sgrpSel = $("#sgrp");
const btnCatSave = $("#btnCatSave");
const btnCatClear = $("#btnCatClear");

// Confirmation modal elements (in-page confirm dialog)
const confirmModal = $("#confirmModal");
const confirmMessageEl = $("#confirmMessage");
const confirmOkBtn = $("#confirmOk");
const confirmCancelBtn = $("#confirmCancel");
const confirmCloseBtn = $("#confirmClose");
const confirmTitleEl = $("#confirmTitle");

// sessionUser not required in this module; remove unused variable to satisfy linter
let cacheUOM = [];
let cacheCat = new Map();
let cacheSub = new Map();
let cacheGrp = new Map();
let cacheSGrp = new Map();
let cacheSGrpByCode = new Map();
let cacheSubByCategory = new Map();
let cacheGrpBySubcat = new Map();
let cacheSGrpByGroup = new Map();
let refreshTimer = null;
let realtimeChannel = null;
let currentPage = 1;
let pageSize = 50;
let totalRows = 0;
let totalPages = 1;
// Focus trap helpers for modal accessibility
let _lastActiveElement = null;
let _focusHandler = null;
function enableFocusTrap(modal, onEscape) {
  try {
    _lastActiveElement = document.activeElement;
    const focusable = Array.from(
      modal.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => el.offsetParent !== null);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (first) first.focus();
    _focusHandler = function (e) {
      if (e.key === "Escape") {
        e.preventDefault();
        try {
          if (typeof onEscape === "function") onEscape();
          else {
            const closeBtn = modal.querySelector(".modal-close");
            if (closeBtn) closeBtn.click();
            else modal.style.display = "none";
          }
        } catch {
          /* ignore */
        }
        return;
      }
      if (e.key === "Tab") {
        if (!first || !last) {
          e.preventDefault();
          return;
        }
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener("keydown", _focusHandler);
  } catch (e) {
    void e;
    /* best-effort */
  }
}
function disableFocusTrap() {
  try {
    if (_focusHandler) document.removeEventListener("keydown", _focusHandler);
    _focusHandler = null;
    if (_lastActiveElement && typeof _lastActiveElement.focus === "function")
      _lastActiveElement.focus();
    _lastActiveElement = null;
  } catch (e) {
    void e;
    /* ignore */
  }
}

// In-page confirmation helper that uses the confirmModal markup.
// Returns a Promise that resolves to true when user confirms, false otherwise.
function showConfirm(message, title) {
  return new Promise((resolve) => {
    try {
      if (!confirmModal) return resolve(false);
      if (confirmTitleEl) confirmTitleEl.textContent = title || "Confirm";
      if (confirmMessageEl) confirmMessageEl.textContent = message || "";

      // show modal
      try {
        confirmModal.style.display = "flex";
      } catch {
        confirmModal.style.display = "block";
      }

      // cleanup function to remove handlers and hide
      const cleanup = () => {
        try {
          confirmOkBtn.removeEventListener("click", onOk);
        } catch (e) {
          void e;
        }
        try {
          confirmCancelBtn.removeEventListener("click", onCancel);
        } catch (e) {
          void e;
        }
        try {
          confirmCloseBtn.removeEventListener("click", onCancel);
        } catch (e) {
          void e;
        }
        try {
          confirmModal.removeEventListener("click", backdropHandler);
        } catch (e) {
          void e;
        }
        try {
          disableFocusTrap();
        } catch (e) {
          void e;
        }
        try {
          confirmModal.style.display = "none";
        } catch (e) {
          void e;
        }
      };

      const onOk = () => {
        cleanup();
        resolve(true);
      };
      const onCancel = () => {
        cleanup();
        resolve(false);
      };

      const backdropHandler = (e) => {
        if (e.target === confirmModal) onCancel();
      };

      // wire events
      confirmOkBtn.addEventListener("click", onOk);
      confirmCancelBtn.addEventListener("click", onCancel);
      confirmCloseBtn.addEventListener("click", onCancel);
      confirmModal.addEventListener("click", backdropHandler);

      // enable focus trap and make Escape trigger cancel
      try {
        enableFocusTrap(confirmModal, onCancel);
      } catch {
        /* best-effort */
      }
    } catch (e) {
      void e;
      // if anything goes wrong, resolve false so caller can continue
      resolve(false);
    }
  });
}

// initialize page-size selector if present
if (pageSizeSel) {
  pageSizeSel.value = String(pageSize);
  pageSizeSel.addEventListener("change", () => {
    const v = Number(pageSizeSel.value) || pageSize;
    if (v !== pageSize) {
      pageSize = v;
      currentPage = 1;
      refresh();
    }
  });
}

async function initAuth() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return (window.location.href = "login.html");
  // intentionally not storing session user in this module
}

// ---------- Lookups ----------
async function loadUOM() {
  // inv_uom uses `is_base` (not `is_active`). We load available UOMs and
  // avoid throwing so that page boot continues even if lookup fails.
  const { data, error } = await supabase
    .from("inv_uom")
    .select("id, code, is_base")
    .order("code");
  if (error) {
    console.warn("loadUOM failed:", error.message || error);
    cacheUOM = [];
    uomEl.innerHTML = "";
    return;
  }
  cacheUOM = data || [];
  // show all UOMs; if you want to filter to only base units use is_base
  uomEl.innerHTML = cacheUOM
    .map((u) => `<option value="${u.id}">${u.code}</option>`)
    .join("");
  // Try to default-select 'Kg' if present (case-insensitive)
  try {
    const opts = Array.from(uomEl.options || []);
    const kgIdx = opts.findIndex(
      (o) => String(o.text || "").toLowerCase() === "kg"
    );
    if (kgIdx >= 0) uomEl.selectedIndex = kgIdx;
  } catch {
    /* ignore */
  }
}

async function loadCategories() {
  // Prefer the new nested JSON RPC; fall back to the existing flat rows RPC
  const { data: hierarchy, error } = await supabase.rpc(
    "get_inv_classification_hierarchy_json"
  );

  if (error) {
    console.error(
      "Error loading inventory classification hierarchy (json rpc):",
      error
    );
    return;
  }

  // Clear existing caches
  cacheCat.clear();
  cacheSub.clear();
  cacheGrp.clear();
  cacheSGrp.clear();
  cacheSubByCategory.clear();
  cacheGrpBySubcat.clear();
  cacheSGrpByGroup.clear();

  // If server returned nested JSON (categories array with subcategories),
  // consume it directly to preserve authoritative ordering. Otherwise
  // fall back to the older flat-row handling used previously.
  if (
    Array.isArray(hierarchy) &&
    hierarchy.length &&
    hierarchy[0]?.subcategories
  ) {
    // hierarchy is nested: categories -> subcategories -> groups -> subgroups
    const cats = hierarchy;
    for (const c of cats) {
      const cid = String(c.id);
      cacheCat.set(cid, {
        id: c.id,
        code: c.code,
        label: c.label,
        sort_order: c.sort_order,
      });

      const subs = Array.isArray(c.subcategories) ? c.subcategories : [];
      const subArr = [];
      for (const sc of subs) {
        const sid = String(sc.id);
        cacheSub.set(sid, {
          id: sc.id,
          code: sc.code,
          label: sc.label,
          category_id: c.id,
          sort: sc.sort_order,
        });
        subArr.push({
          id: sc.id,
          code: sc.code,
          label: sc.label,
          category_id: c.id,
          sort: sc.sort_order,
        });

        const groups = Array.isArray(sc.groups) ? sc.groups : [];
        const grpArr = [];
        for (const g of groups) {
          const gid = String(g.id);
          cacheGrp.set(gid, {
            id: g.id,
            code: g.code,
            label: g.label,
            subcategory_id: sc.id,
            sort: g.sort_order,
          });
          grpArr.push({
            id: g.id,
            code: g.code,
            label: g.label,
            subcategory_id: sc.id,
            sort: g.sort_order,
          });

          const sgs = Array.isArray(g.subgroups) ? g.subgroups : [];
          const sgrpArr = [];
          for (const sg of sgs) {
            const sgid = String(sg.id);
            cacheSGrp.set(sgid, {
              id: sg.id,
              code: sg.code,
              label: sg.label,
              group_id: g.id,
              sort: sg.sort_order,
            });
            sgrpArr.push({
              id: sg.id,
              code: sg.code,
              label: sg.label,
              group_id: g.id,
              sort: sg.sort_order,
            });
          }
          if (sgrpArr.length) cacheSGrpByGroup.set(String(g.id), sgrpArr);
        }
        if (grpArr.length) cacheGrpBySubcat.set(String(sc.id), grpArr);
      }
      if (subArr.length) cacheSubByCategory.set(cid, subArr);
    }

    // Build SGrpByCode index
    cacheSGrpByCode.clear();
    Array.from(cacheSGrp.values()).forEach((s) => {
      if (!s || !s.code) return;
      const key = String(s.code || "")
        .toLowerCase()
        .trim();
      const existing = cacheSGrpByCode.get(key) || [];
      existing.push(s);
      cacheSGrpByCode.set(key, existing);
    });

    // Populate selects using the server-provided order
    filterCategory.innerHTML =
      `<option value="">All categories</option>` +
      Array.from(cacheCat.values())
        .map((c) => `<option value="${c.id}">${c.code} — ${c.label}</option>`)
        .join("");

    catSel.innerHTML =
      `<option value="">(none)</option>` +
      Array.from(cacheCat.values())
        .map((c) => `<option value="${c.id}">${c.code} — ${c.label}</option>`)
        .join("");

    // Initialize toolbar filters (empty until user selects a parent)
    if (filterSubcategory)
      filterSubcategory.innerHTML = `<option value="">All sub-categories</option>`;
    if (filterGroup)
      filterGroup.innerHTML = `<option value="">All groups</option>`;
    if (filterSubgroup)
      filterSubgroup.innerHTML = `<option value="">All sub-groups</option>`;
    if (filterSubcategory) filterSubcategory.disabled = true;
    if (filterGroup) filterGroup.disabled = true;
    if (filterSubgroup) filterSubgroup.disabled = true;

    subcatSel.innerHTML = `<option value="(none)"></option>`;
    grpSel.innerHTML = `<option value="(none)"></option>`;
    sgrpSel.innerHTML = `<option value="(none)"></option>`;
    return;
  }

  // Fallback: older flat-row shape (maintain previous logic)
  // helper: try several common sort-order field name patterns
  function getSortVal(row, prefix) {
    if (!row) return null;
    const candidates = [
      `${prefix}_sort_order`,
      `${prefix}_order`,
      `${prefix}_sort`,
      `${prefix}_sortorder`,
      `${prefix}SortOrder`,
      `${prefix}Order`,
      `sort_order`,
      `sortorder`,
      `sort`,
    ];
    for (const k of candidates) {
      if (Object.prototype.hasOwnProperty.call(row, k)) {
        const v = row[k];
        if (v !== null && v !== undefined && v !== "") return Number(v);
      }
    }
    return null;
  }

  const catSortById = new Map();
  (hierarchy || []).forEach((row) => {
    // Category
    if (row.category_id && !cacheCat.has(String(row.category_id))) {
      cacheCat.set(String(row.category_id), {
        id: row.category_id,
        code: row.category_code,
        label: row.category_label,
      });
    }

    // Subcategory
    if (row.subcategory_id && !cacheSub.has(String(row.subcategory_id))) {
      cacheSub.set(String(row.subcategory_id), {
        id: row.subcategory_id,
        code: row.subcategory_code,
        label: row.subcategory_label,
        category_id: row.category_id,
      });
      // record subcategory sort value (if provided)
      const ssort = getSortVal(row, "subcategory");
      // preserve server order per category
      try {
        const key = String(row.category_id);
        const arr = cacheSubByCategory.get(key) || [];
        // avoid duplicates
        if (!arr.some((s) => String(s.id) === String(row.subcategory_id))) {
          arr.push({
            id: row.subcategory_id,
            code: row.subcategory_code,
            label: row.subcategory_label,
            category_id: row.category_id,
            sort: ssort,
          });
          cacheSubByCategory.set(key, arr);
        }
      } catch {
        /* ignore */
      }
    }

    // Group
    if (row.group_id && !cacheGrp.has(String(row.group_id))) {
      cacheGrp.set(String(row.group_id), {
        id: row.group_id,
        code: row.group_code,
        label: row.group_label,
        subcategory_id: row.subcategory_id,
      });
      const gsort = getSortVal(row, "group");
      // preserve server order per subcategory
      try {
        const key = String(row.subcategory_id);
        const arr = cacheGrpBySubcat.get(key) || [];
        if (!arr.some((g) => String(g.id) === String(row.group_id))) {
          arr.push({
            id: row.group_id,
            code: row.group_code,
            label: row.group_label,
            subcategory_id: row.subcategory_id,
            sort: gsort,
          });
          cacheGrpBySubcat.set(key, arr);
        }
      } catch {
        /* ignore */
      }
    }

    // Subgroup
    if (row.subgroup_id && !cacheSGrp.has(String(row.subgroup_id))) {
      const subgroup = {
        id: row.subgroup_id,
        code: row.subgroup_code,
        label: row.subgroup_label,
        group_id: row.group_id,
      };
      cacheSGrp.set(String(row.subgroup_id), subgroup);
      // preserve server order per group
      try {
        const key = String(row.group_id);
        const arr = cacheSGrpByGroup.get(key) || [];
        const sgsort = getSortVal(row, "subgroup");
        if (!arr.some((s) => String(s.id) === String(row.subgroup_id))) {
          arr.push(Object.assign({ sort: sgsort }, subgroup));
          cacheSGrpByGroup.set(key, arr);
        }
      } catch {
        /* ignore */
      }
    }
  });

  // After populating, sort the per-parent arrays if sort values exist
  try {
    for (const [k, arr] of cacheSubByCategory.entries()) {
      arr.sort(
        (a, b) =>
          (a.sort != null ? a.sort : Infinity) -
          (b.sort != null ? b.sort : Infinity)
      );
      cacheSubByCategory.set(k, arr);
    }
    for (const [k, arr] of cacheGrpBySubcat.entries()) {
      arr.sort(
        (a, b) =>
          (a.sort != null ? a.sort : Infinity) -
          (b.sort != null ? b.sort : Infinity)
      );
      cacheGrpBySubcat.set(k, arr);
    }
    for (const [k, arr] of cacheSGrpByGroup.entries()) {
      arr.sort(
        (a, b) =>
          (a.sort != null ? a.sort : Infinity) -
          (b.sort != null ? b.sort : Infinity)
      );
      cacheSGrpByGroup.set(k, arr);
    }
  } catch {
    /* ignore sorting errors */
  }

  // Preserve category ordering: if sort values exist, sort categories accordingly
  try {
    // build map of category sort from hierarchy rows (last seen value wins)
    (hierarchy || []).forEach((row) => {
      const cv = getSortVal(row, "category");
      if (row.category_id && cv != null)
        catSortById.set(String(row.category_id), cv);
    });
    // produce ordered categories array
    const orderedCats = Array.from(cacheCat.values()).sort((a, b) => {
      const sa = catSortById.get(String(a.id));
      const sb = catSortById.get(String(b.id));
      return (sa != null ? sa : Infinity) - (sb != null ? sb : Infinity);
    });
    // Replace category select population below to use orderedCats
    filterCategory.innerHTML =
      `<option value="">All categories</option>` +
      orderedCats
        .map((c) => `<option value="${c.id}">${c.code} — ${c.label}</option>`)
        .join("");
    catSel.innerHTML =
      `<option value="">(none)</option>` +
      orderedCats
        .map((c) => `<option value="${c.id}">${c.code} — ${c.label}</option>`)
        .join("");
  } catch {
    // fallback to default population below
  }
  // Build a code-based index for subgroups (codes may repeat across groups)
  cacheSGrpByCode.clear();
  Array.from(cacheSGrp.values()).forEach((s) => {
    if (!s || !s.code) return;
    const key = String(s.code || "")
      .toLowerCase()
      .trim();
    const existing = cacheSGrpByCode.get(key) || [];
    existing.push(s);
    cacheSGrpByCode.set(key, existing);
  });

  // Debug: log counts of classification caches
  try {
    // Log a few complete entries from the cache to verify structure
    console.log("Sample cache entries:", {
      byId: Array.from(cacheSGrp.entries()).slice(0, 3),
      byCode: Array.from(cacheSGrp.entries())
        .filter(([key]) => isNaN(key))
        .slice(0, 3),
    });

    console.info("loadCategories: cache sizes", {
      categories: cacheCat.size,
      subcategories: cacheSub.size,
      groups: cacheGrp.size,
      subgroups: cacheSGrp.size,
      subgroup_keys_sample: Array.from(cacheSGrp.keys()).slice(0, 5),
      subgroup_codes_indexed: cacheSGrpByCode.size,
    });
  } catch {
    /* ignore */
  }

  filterCategory.innerHTML =
    `<option value="">All categories</option>` +
    Array.from(cacheCat.values())
      .map((c) => `<option value="${c.id}">${c.code} — ${c.label}</option>`)
      .join("");

  // Initialize toolbar filters (empty until user selects a parent)
  if (filterSubcategory)
    filterSubcategory.innerHTML = `<option value="">All sub-categories</option>`;
  if (filterGroup)
    filterGroup.innerHTML = `<option value="">All groups</option>`;
  if (filterSubgroup)
    filterSubgroup.innerHTML = `<option value="">All sub-groups</option>`;
  // start disabled until a parent is chosen
  if (filterSubcategory) filterSubcategory.disabled = true;
  if (filterGroup) filterGroup.disabled = true;
  if (filterSubgroup) filterSubgroup.disabled = true;

  catSel.innerHTML =
    `<option value="">(none)</option>` +
    Array.from(cacheCat.values())
      .map((c) => `<option value="${c.id}">${c.code} — ${c.label}</option>`)
      .join("");
  subcatSel.innerHTML = `<option value="(none)"></option>`;
  grpSel.innerHTML = `<option value="(none)"></option>`;
  sgrpSel.innerHTML = `<option value="(none)"></option>`;
  // no debug exposure in production; keep caches internal
}

function fillSubcats(categoryId) {
  const sid = String(categoryId);
  const rows = cacheSubByCategory.get(sid) || [];
  subcatSel.innerHTML =
    `<option value="">(none)</option>` +
    rows
      .map((s) => `<option value="${s.id}">${s.code} — ${s.label}</option>`)
      .join("");
  grpSel.innerHTML = `<option value="">(none)</option>`;
  sgrpSel.innerHTML = `<option value="">(none)</option>`;
}
function fillGroups(subcatId) {
  const sid = String(subcatId);
  const rows = cacheGrpBySubcat.get(sid) || [];
  grpSel.innerHTML =
    `<option value="">(none)</option>` +
    rows
      .map((g) => `<option value="${g.id}">${g.code} — ${g.label}</option>`)
      .join("");
  sgrpSel.innerHTML = `<option value="">(none)</option>`;
}
function fillSubgroups(groupId) {
  const sid = String(groupId);
  const rows = cacheSGrpByGroup.get(sid) || [];
  sgrpSel.innerHTML =
    `<option value="">(none)</option>` +
    rows
      .map((x) => `<option value="${x.id}">${x.code} — ${x.label}</option>`)
      .join("");
}

// Toolbar filter population helpers (cascade)
function fillFilterSubcats(categoryId) {
  if (!filterSubcategory) return;
  // if no category selected, reset and disable downstream filters
  if (!categoryId) {
    filterSubcategory.innerHTML = `<option value="">All sub-categories</option>`;
    filterSubcategory.disabled = true;
    if (filterGroup) {
      filterGroup.innerHTML = `<option value="">All groups</option>`;
      filterGroup.disabled = true;
    }
    if (filterSubgroup) {
      filterSubgroup.innerHTML = `<option value="">All sub-groups</option>`;
      filterSubgroup.disabled = true;
    }
    return;
  }
  const sid = String(categoryId);
  const rows = cacheSubByCategory.get(sid) || [];
  filterSubcategory.innerHTML =
    `<option value="">All sub-categories</option>` +
    rows
      .map((s) => `<option value="${s.id}">${s.code} — ${s.label}</option>`)
      .join("");
  filterSubcategory.disabled = false;
  if (filterGroup) {
    filterGroup.innerHTML = `<option value="">All groups</option>`;
    filterGroup.disabled = true;
  }
  if (filterSubgroup) {
    filterSubgroup.innerHTML = `<option value="">All sub-groups</option>`;
    filterSubgroup.disabled = true;
  }
}

function fillFilterGroups(subcatId) {
  if (!filterGroup) return;
  if (!subcatId) {
    filterGroup.innerHTML = `<option value="">All groups</option>`;
    filterGroup.disabled = true;
    if (filterSubgroup) {
      filterSubgroup.innerHTML = `<option value="">All sub-groups</option>`;
      filterSubgroup.disabled = true;
    }
    return;
  }
  const sid = String(subcatId);
  const rows = cacheGrpBySubcat.get(sid) || [];
  filterGroup.innerHTML =
    `<option value="">All groups</option>` +
    rows
      .map((g) => `<option value="${g.id}">${g.code} — ${g.label}</option>`)
      .join("");
  filterGroup.disabled = false;
  if (filterSubgroup) {
    filterSubgroup.innerHTML = `<option value="">All sub-groups</option>`;
    filterSubgroup.disabled = true;
  }
}

function fillFilterSubgroups(groupId) {
  if (!filterSubgroup) return;
  if (!groupId) {
    filterSubgroup.innerHTML = `<option value="">All sub-groups</option>`;
    filterSubgroup.disabled = true;
    return;
  }
  const sid = String(groupId);
  const rows = cacheSGrpByGroup.get(sid) || [];
  filterSubgroup.innerHTML =
    `<option value="">All sub-groups</option>` +
    rows
      .map((x) => `<option value="${x.id}">${x.code} — ${x.label}</option>`)
      .join("");
  filterSubgroup.disabled = false;
}

catSel.addEventListener("change", () => fillSubcats(catSel.value || null));
subcatSel.addEventListener("change", () => fillGroups(subcatSel.value || null));
grpSel.addEventListener("change", () => fillSubgroups(grpSel.value || null));
// Toolbar filter handlers - cascade selection and refresh
if (filterCategory) {
  filterCategory.addEventListener("change", () => {
    fillFilterSubcats(filterCategory.value || null);
    currentPage = 1;
    refresh();
  });
}
if (filterSubcategory) {
  filterSubcategory.addEventListener("change", () => {
    fillFilterGroups(filterSubcategory.value || null);
    currentPage = 1;
    refresh();
  });
}
if (filterGroup) {
  filterGroup.addEventListener("change", () => {
    fillFilterSubgroups(filterGroup.value || null);
    currentPage = 1;
    refresh();
  });
}
if (filterSubgroup) {
  filterSubgroup.addEventListener("change", () => {
    currentPage = 1;
    refresh();
  });
}

// Reset filters button handler
function resetFilters() {
  // clear search
  if (q) q.value = "";
  // clear selects
  if (filterCategory) filterCategory.value = "";
  // trigger cascade helpers to reset and disable downstream filters
  fillFilterSubcats(null);
  fillFilterGroups(null);
  fillFilterSubgroups(null);
  // ensure category change also resets popover mapping selectors if needed
  currentPage = 1;
  refresh();
}

if (btnResetFilters) {
  btnResetFilters.addEventListener("click", (e) => {
    e.preventDefault();
    resetFilters();
  });
}

// ---------- Fetch & Render ----------
async function fetchItems(page = 1) {
  const catFilter =
    filterCategory && filterCategory.value
      ? Number(filterCategory.value)
      : null;
  const subFilter =
    filterSubcategory && filterSubcategory.value
      ? Number(filterSubcategory.value)
      : null;
  const grpFilter =
    filterGroup && filterGroup.value ? Number(filterGroup.value) : null;
  const sgrpFilter =
    filterSubgroup && filterSubgroup.value
      ? Number(filterSubgroup.value)
      : null;
  const qv = (q.value || "").trim().toLowerCase();

  // If there are no client-side filters, use server-side range + count for efficient pagination
  if (!qv && !catFilter && !subFilter && !grpFilter && !sgrpFilter) {
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;
    const { data, error, count } = await supabase
      .from("inv_stock_item")
      .select(
        `
      id, code, name, default_uom_id, active, notes,
      uom:inv_uom!inv_stock_item_default_uom_id_fkey ( id, code ),
      map:inv_stock_item_class_map ( category_id, subcategory_id, group_id, subgroup_id )
    `,
        { count: "exact" }
      )
      .order("code")
      .range(start, end);
    if (error) throw error;
    // normalize related objects (PostgREST may return related rows as arrays)
    const norm = (data || []).map((r) => {
      if (Array.isArray(r.map)) r.map = r.map[0] || null;
      if (Array.isArray(r.uom)) r.uom = r.uom[0] || null;
      return r;
    });
    totalRows = count || (norm ? norm.length : 0);
    totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    return { rows: norm, totalRows, startIndex: start };
  }
  // If user has active classification filters, prefer server-side queries to avoid the 1000-row default limit.
  if (catFilter || subFilter || grpFilter || sgrpFilter) {
    // Use server-side RPC that returns paginated stock_item rows plus an exact
    // full_count for the matched set. This avoids client-side id collection and
    // deduplication and performs the DISTINCT/count on the DB side.
    const start = (page - 1) * pageSize;
    const params = {
      p_category_id: catFilter || null,
      p_subcategory_id: subFilter || null,
      p_group_id: grpFilter || null,
      p_subgroup_id: sgrpFilter || null,
      p_limit: pageSize,
      p_offset: start,
    };
    const { data: rows, error: rpcErr } = await supabase.rpc(
      "get_stock_items_by_classification",
      params
    );
    if (rpcErr) throw rpcErr;
    // Normalize related objects if RPC included them as arrays or returned
    // classification/uom fields at top-level. RPC shapes can vary (map may
    // be top-level columns or nested; uom may be nested as inv_uom). Make the
    // renderer's expectations consistent: r.map = { category_id, subcategory_id, group_id, subgroup_id }
    // and r.uom = { id, code } when possible.
    const norm = (rows || []).map((r) => {
      // If map came back as an array, unwrap
      if (Array.isArray(r.map)) r.map = r.map[0] || null;
      // If uom came back as an array, unwrap
      if (Array.isArray(r.uom)) r.uom = r.uom[0] || null;

      // If RPC returned classification columns at top-level (not under r.map),
      // move them into r.map so render()/codeFor* helpers work unchanged.
      if (!r.map) {
        const cat =
          r.category_id ?? r.category ?? r.categoryId ?? r.categoryid ?? null;
        const sub =
          r.subcategory_id ??
          r.subcategory ??
          r.subcategoryId ??
          r.subcategoryid ??
          null;
        const grp = r.group_id ?? r.group ?? r.groupId ?? r.groupid ?? null;
        const sgrp =
          r.subgroup_id ?? r.subgroup ?? r.subgroupId ?? r.subgroupid ?? null;
        if (cat || sub || grp || sgrp) {
          r.map = {
            category_id: cat ?? null,
            subcategory_id: sub ?? null,
            group_id: grp ?? null,
            subgroup_id: sgrp ?? null,
          };
        }
      } else {
        // Ensure the map object uses the expected key names (some RPCs may
        // return keys with slightly different casing). Normalize common aliases.
        const m = r.map;
        if (m) {
          if (m.category) m.category_id = m.category_id ?? m.category;
          if (m.subcategory)
            m.subcategory_id = m.subcategory_id ?? m.subcategory;
          if (m.group) m.group_id = m.group_id ?? m.group;
          if (m.subgroup) m.subgroup_id = m.subgroup_id ?? m.subgroup;
        }
      }

      // If uom wasn't provided nested, try common top-level alternatives.
      if (!r.uom) {
        if (r.inv_uom) {
          // unwrap array if necessary
          if (Array.isArray(r.inv_uom)) r.inv_uom = r.inv_uom[0] || null;
          r.uom = r.inv_uom || null;
        } else if (r.default_uom_id || r.uom_code || r.uomCode) {
          r.uom = {
            id: r.default_uom_id ?? null,
            code: r.uom_code ?? r.uomCode ?? "",
          };
        }
      }

      return r;
    });
    // Helpful debug: show a sample row returned by the RPC so we can inspect
    // the exact shape when troubleshooting blank classification/UOM fields.
    try {
      console.debug("get_stock_items_by_classification sample:", norm[0]);
    } catch {
      /* ignore logging errors */
    }

    // If the RPC didn't include the classification mapping (`map`) attach
    // it by fetching maps for the returned page of stock_item ids in one batch.
    // This keeps the additional request small (page-sized) and avoids per-row queries.
    try {
      const ids = norm.map((r) => r?.id).filter(Boolean);
      if (ids.length) {
        const { data: maps, error: mapsErr } = await supabase
          .from("inv_stock_item_class_map")
          .select(
            "stock_item_id, category_id, subcategory_id, group_id, subgroup_id"
          )
          .in("stock_item_id", ids);
        if (mapsErr) {
          console.warn(
            "Failed to load class maps for RPC rows:",
            mapsErr.message || mapsErr
          );
        } else if (maps && maps.length) {
          const mapById = new Map();
          maps.forEach((m) => mapById.set(String(m.stock_item_id), m));
          norm.forEach((r) => {
            if (!r.map) {
              const m = mapById.get(String(r.id)) || null;
              r.map = m;
            } else {
              // normalize aliases inside nested map
              const m = r.map;
              if (m) {
                if (m.category) m.category_id = m.category_id ?? m.category;
                if (m.subcategory)
                  m.subcategory_id = m.subcategory_id ?? m.subcategory;
                if (m.group) m.group_id = m.group_id ?? m.group;
                if (m.subgroup) m.subgroup_id = m.subgroup_id ?? m.subgroup;
              }
            }
          });
        }
      }
    } catch (e) {
      console.warn("Error attaching class maps to RPC rows:", e?.message || e);
    }

    // Fill missing UOM codes from the local cache (loadUOM loads cacheUOM at boot).
    try {
      if (cacheUOM && cacheUOM.length) {
        const byId = new Map(cacheUOM.map((u) => [String(u.id), u]));
        norm.forEach((r) => {
          // prefer nested uom.code; if empty, try cache via default_uom_id
          if (!r.uom || !r.uom.code) {
            const uid = r.default_uom_id ?? r.uom?.id ?? null;
            if (uid != null) {
              const found = byId.get(String(uid));
              if (found) {
                r.uom = r.uom || {};
                r.uom.code = r.uom.code || found.code || "";
                r.uom.id = r.uom.id || found.id;
              }
            }
          }
        });
      }
    } catch (e) {
      console.warn("Error filling UOM codes from cache:", e?.message || e);
    }

    // RPC returns full_count per row (same for every row). If no rows are
    // returned, full_count may be undefined; treat as 0.
    const fullCount = norm.length ? Number(norm[0].full_count || 0) : 0;
    totalRows = fullCount;
    totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    return { rows: norm, totalRows, startIndex: start };
  }

  if (qv) {
    // server-side free-text search with ilike and pagination
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;
    const { data, error, count } = await supabase
      .from("inv_stock_item")
      .select(
        `
      id, code, name, default_uom_id, active, notes,
      uom:inv_uom!inv_stock_item_default_uom_id_fkey ( id, code ),
      map:inv_stock_item_class_map ( category_id, subcategory_id, group_id, subgroup_id )
    `,
        { count: "exact" }
      )
      .or(`code.ilike.%${qv}%,name.ilike.%${qv}%`)
      .order("code")
      .range(start, end);
    if (error) throw error;
    const norm = (data || []).map((r) => {
      if (Array.isArray(r.map)) r.map = r.map[0] || null;
      if (Array.isArray(r.uom)) r.uom = r.uom[0] || null;
      return r;
    });
    totalRows = count || (norm ? norm.length : 0);
    totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    return { rows: norm, totalRows, startIndex: start };
  }

  // fallback (shouldn't reach here) - return empty
  return { rows: [], totalRows: 0, startIndex: 0 };
}

function codeForCategory(id) {
  if (!id) return "";
  const sid = String(id);
  const c = cacheCat.get(sid);
  return c ? `${c.label}` : "";
}
function codeForSubcategory(id) {
  if (!id) return "";
  const sid = String(id);
  const s = cacheSub.get(sid);
  return s ? `${s.label}` : "";
}
function codeForGroup(id) {
  if (!id) return "";
  const sid = String(id);
  const g = cacheGrp.get(sid);
  return g ? `${g.label}` : "";
}
function codeForSubgroup(id) {
  if (!id) return "";
  const sid = String(id).trim();

  // Try lookup by ID (stringified)
  let sg = cacheSGrp.get(sid);

  // If not found, try normalized code lookup (case-insensitive)
  if (!sg) {
    const key = sid.toLowerCase();
    const matches = cacheSGrpByCode.get(key) || [];
    if (matches.length) sg = matches[0];
  }

  return sg ? sg.label || sg.code || "" : "";
}

// Resolve subgroup label from a mapping object using heuristics.
// Accepts mapping objects that may store subgroup as id, code, nested object, or array.
// Note: subgroup resolution simplified to mirror category/subcategory/group helpers.
// If future needs require richer heuristics, reintroduce a resolver.

// Helper: tolerant mapping value getter (checks several possible property names)
function mapVal(mapObj, ...names) {
  if (!mapObj) return null;
  for (const n of names) {
    if (Object.prototype.hasOwnProperty.call(mapObj, n)) {
      const v = mapObj[n];
      if (v !== null && v !== undefined && v !== "") return v;
    }
  }
  return null;
}

function render(rows, startIndex = 0, total = null) {
  // Debugging: inspect rows and classification caches when subgroup labels are missing
  try {
    console.debug("render: starting render with data", {
      rowsCount: rows.length,
      currentPage,
      pageSize,
      totalPages,
      cacheSizes: {
        categories: cacheCat.size,
        subcategories: cacheSub.size,
        groups: cacheGrp.size,
        subgroups: cacheSGrp.size,
      },
      firstRow: rows[0],
    });

    const bad = rows.filter((r) => {
      const sid = mapVal(
        r?.map,
        "subgroup_id",
        "subgroup",
        "subgroup_code",
        "subgroupid",
        "subgroupId"
      );
      console.debug("Checking subgroup for row:", {
        rowId: r.id,
        map: r.map,
        extractedSubgroupId: sid,
        hasValidLabel: sid ? Boolean(codeForSubgroup(sid)) : null,
      });
      return sid && !codeForSubgroup(sid);
    });
    // Additionally detect when a mapping exists but none of the four labels
    // (category/sub/subgroup/group) resolved — this may indicate different
    // column names in the mapping (e.g. storing `subgroup_code` instead of
    // `subgroup_id`). This runs even when `bad` is empty so we can catch
    // missing labels caused by unexpected mapping field names.
    const unlabeled = rows.filter((r) => {
      if (!r?.map) return false;
      const m = r.map;
      const anyLabel =
        codeForCategory(
          mapVal(m, "category_id", "category", "category_code", "categoryId")
        ) ||
        codeForSubcategory(
          mapVal(
            m,
            "subcategory_id",
            "subcategory",
            "subcategory_code",
            "subcategoryId"
          )
        ) ||
        codeForGroup(mapVal(m, "group_id", "group", "group_code", "groupId")) ||
        codeForSubgroup(
          mapVal(m, "subgroup_id", "subgroup", "subgroup_code", "subgroupId")
        );
      return !anyLabel;
    });
    if (unlabeled.length) {
      console.info(
        "render: mapping objects that did not resolve to labels",
        unlabeled.slice(0, 5).map((r) => ({ id: r.id }))
      );
    }
    if (bad.length) {
      console.info(
        "render: rows with subgroup id but missing label",
        bad.slice(0, 5)
      );
    }
  } catch (e) {
    console.debug("render debug error", e);
  }
  tbody.innerHTML = "";
  rows.forEach((r) => {
    const uomCode = r.uom?.code ?? "";
    const mapObj = r.map || null;
    const catText = mapObj ? codeForCategory(mapObj.category_id) : "";
    const subText = mapObj ? codeForSubcategory(mapObj.subcategory_id) : "";
    const grpText = mapObj ? codeForGroup(mapObj.group_id) : "";
    const sgrpText = mapObj
      ? codeForSubgroup(
          mapVal(
            mapObj,
            "subgroup_id",
            "subgroup",
            "subgroup_code",
            "subgroupId"
          )
        )
      : "";
    const tr = document.createElement("tr");
    // store some row metadata on the tr so delegated handlers can access it
    tr.dataset.id = String(r.id);
    tr.dataset.code = String(r.code || "");
    tr.dataset.name = String(r.name || "");
    tr.dataset.active = r.active ? "1" : "0";
    tr.innerHTML = `
      <td><code>${r.code}</code></td>
      <td>${r.name ?? ""}</td>
      <td>${uomCode}</td>
      <td>${catText}</td>
      <td>${subText}</td>
      <td>${grpText}</td>
      <td>${sgrpText}</td>
      <td>${r.active ? "Active" : "Inactive"}</td>
      <td class="actions" style="position:relative">
        <div style="position:relative; display:inline-block;">
          <button class="kebab-btn" aria-haspopup="true" aria-expanded="false" title="Actions">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
              <circle cx="12" cy="5" r="2" fill="currentColor"/>
              <circle cx="12" cy="12" r="2" fill="currentColor"/>
              <circle cx="12" cy="19" r="2" fill="currentColor"/>
            </svg>
          </button>
          <div class="action-menu" role="menu" style="display: none;">
            <button data-action="edit" role="menuitem">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Edit
            </button>
            <button data-action="map" role="menuitem">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                <path d="M16 3h5v5M4 20L20 4M21 16v5h-5M8 8l-4 4m0 0l4 4m-4-4h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Assign Category
            </button>
            <button data-action="delmap" role="menuitem">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                <path d="M9 3V2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M21 5H3M19 5v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="m10 11 4 4m0-4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
              Delete Mapping
            </button>
            <button data-action="delete" role="menuitem">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Delete Item
            </button>
            <button data-action="toggle" role="menuitem">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                <path d="M21 6.5a4.5 4.5 0 0 1-9 0A4.5 4.5 0 0 1 21 6.5zM3 17.5a4.5 4.5 0 0 0 9 0A4.5 4.5 0 0 0 3 17.5z" fill="currentColor"/>
                <circle cx="7.5" cy="17.5" r="2.5" fill="white"/>
              </svg>
              ${r.active ? "Deactivate" : "Activate"}
            </button>
          </div>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  // Helper wrappers so delegated handlers can call existing functions that expect events
  async function doEdit(id) {
    return onEdit({ currentTarget: { dataset: { id: String(id) } } });
  }
  function openMapById(id, code, name) {
    return openMap({
      currentTarget: {
        dataset: {
          id: String(id),
          code: String(code || ""),
          name: String(name || ""),
        },
      },
    });
  }
  async function doDeleteMapping(id) {
    return onDeleteMapping({ currentTarget: { dataset: { id: String(id) } } });
  }
  async function doDeleteItem(id) {
    return onDeleteItem({ currentTarget: { dataset: { id: String(id) } } });
  }
  async function doToggle(id) {
    const tr = document.querySelector(`#tbl tbody tr[data-id="${id}"]`);
    const active = tr ? tr.dataset.active || "0" : "0";
    return onToggle({ currentTarget: { dataset: { id: String(id), active } } });
  }
  // Action menu positioning helpers - use fixed positioning so menu isn't clipped by the scrollable table container
  function openActionMenu(menu, button) {
    try {
      if (!menu || !button) return;

      // capture button rect for positioning calculations (recompute on resize)
      let btnRect = button.getBoundingClientRect();

      // make the menu fixed so it's not clipped by overflow: auto containers
      menu.style.position = "fixed";
      menu.style.display = "block";
      // hide while measuring to avoid flicker
      menu.style.visibility = "hidden";

      const reposition = () => {
        try {
          // clear sizing constraints
          menu.style.maxWidth = "";
          menu.style.maxHeight = "";
          menu.style.overflow = "";

          const mRect = menu.getBoundingClientRect();

          // horizontal: center menu under the button when possible; flip to fit viewport
          let desiredLeft = Math.round(
            btnRect.left + btnRect.width / 2 - mRect.width / 2
          );
          // clamp to viewport with small padding
          if (desiredLeft < 6) desiredLeft = 6;
          if (desiredLeft + mRect.width > window.innerWidth - 6) {
            desiredLeft = Math.max(6, window.innerWidth - mRect.width - 6);
          }
          // if menu is still wider than viewport, clamp width and allow internal scroll
          if (mRect.width > window.innerWidth - 12) {
            desiredLeft = 6;
            menu.style.maxWidth = `${Math.max(100, window.innerWidth - 12)}px`;
            menu.style.overflow = "auto";
          }
          menu.style.left = `${desiredLeft}px`;

          // vertical: prefer below button; flip above if not enough space
          let desiredTop = Math.max(6, btnRect.bottom + 6);
          if (desiredTop + mRect.height > window.innerHeight - 6) {
            const above = btnRect.top - mRect.height - 6;
            if (above >= 6) desiredTop = above;
            else {
              desiredTop = 6;
              menu.style.maxHeight = `${Math.max(
                100,
                window.innerHeight - 12
              )}px`;
              menu.style.overflow = menu.style.overflow || "auto";
            }
          }
          menu.style.top = `${desiredTop}px`;
        } catch (e) {
          void e;
        }
      };

      // initial placement
      reposition();
      menu.style.visibility = "";
      menu.style.right = "auto";
      menu.style.zIndex = "12000";
      // Don't use aria-hidden="false" as it conflicts with focusable descendants
      menu.removeAttribute("aria-hidden");
      button.setAttribute("aria-expanded", "true");
      // focus first
      const first = menu.querySelector("[role=menuitem]");
      if (first) first.focus();

      // attach handlers to close when clicking outside, Esc, resizing or scrolling
      const docHandler = (e) => {
        if (!menu.contains(e.target) && e.target !== button)
          closeActionMenu(menu, button);
      };
      const keyHandler = (e) => {
        if (e.key === "Escape" || e.key === "Esc")
          closeActionMenu(menu, button);
      };
      const relayoutHandler = (ev) => {
        try {
          if (ev && ev.type === "resize") {
            btnRect = button.getBoundingClientRect();
            reposition();
          } else {
            // on scroll, close the menu since viewport moved
            closeActionMenu(menu, button);
          }
        } catch (e) {
          void e;
        }
      };

      menu._docHandler = docHandler;
      menu._keyHandler = keyHandler;
      menu._relayoutHandler = relayoutHandler;
      document.addEventListener("click", docHandler);
      document.addEventListener("keydown", keyHandler);
      window.addEventListener("resize", relayoutHandler);
      // capture scroll on window to close menu if viewport moves
      window.addEventListener("scroll", relayoutHandler, true);
    } catch (e) {
      console.warn("openActionMenu failed", e);
    }
  }

  function closeActionMenu(menu, button) {
    try {
      if (!menu) return;
      // Don't use aria-hidden="true" on elements with focusable descendants
      // Instead, hide the menu with display:none and manage focus properly
      menu.style.display = "none";
      if (button) button.setAttribute("aria-expanded", "false");
      // remove inline fixed positioning so menu returns to flow
      menu.style.position = "";
      menu.style.left = "";
      menu.style.top = "";
      menu.style.right = "";
      menu.style.zIndex = "";
      // remove attached handlers
      try {
        if (menu._docHandler)
          document.removeEventListener("click", menu._docHandler);
      } catch (e) {
        void e;
      }
      try {
        if (menu._keyHandler)
          document.removeEventListener("keydown", menu._keyHandler);
      } catch (e) {
        void e;
      }
      try {
        if (menu._relayoutHandler)
          window.removeEventListener("resize", menu._relayoutHandler);
      } catch (e) {
        void e;
      }
      try {
        if (menu._relayoutHandler)
          window.removeEventListener("scroll", menu._relayoutHandler, true);
      } catch (e) {
        void e;
      }
      menu._docHandler = null;
      menu._relayoutHandler = null;
      menu._keyHandler = null;
      // hide the menu element from view
      try {
        menu.style.display = "none";
      } catch (e) {
        void e;
      }
    } catch (e) {
      void e;
      /* ignore */
    }
  }

  function closeAllActionMenus() {
    try {
      document.querySelectorAll(".action-menu").forEach((m) => {
        if (m.style.display !== "none") {
          const kb = m.parentElement
            ? m.parentElement.querySelector(".kebab-btn")
            : null;
          closeActionMenu(m, kb);
        }
      });
    } catch (e) {
      void e;
      /* ignore */
    }
  }
  // Ensure helper functions are referenced so linters don't flag them as unused
  void openActionMenu;
  void closeAllActionMenus;
  // Delegated click handler for the action kebab/menu
  // Remove any previous delegated listener by cloning and replacing (safe idempotent approach)
  try {
    if (tbody && tbody.parentNode) {
      const newTbody = tbody.cloneNode(false);
      // move existing rows into the new tbody
      while (tbody.firstChild) newTbody.appendChild(tbody.firstChild);
      tbody.parentNode.replaceChild(newTbody, tbody);
      // reassign tbody variable to the new element for future operations
      // (note: this keeps other references intact in this module)
      // re-query the tbody from DOM
      const _tbodyRef = document.querySelector("#tbl tbody");
      if (_tbodyRef) {
        // Attach a single document-level delegated handler for kebab/menu actions.
        // This ensures kebab menus across all tables (stock items + classification
        // tabs) are handled consistently and avoids duplicating per-tbody listeners.
        if (!window.__msi_kebab_handler_attached) {
          window.__msi_kebab_handler_attached = true;
          document.addEventListener("click", async (evt) => {
            // Robust kebab detection: prefer direct closest lookup, but also
            // handle small near-miss clicks inside the actions cell by
            // checking the kebab bounding rect (expanded by a few px).
            let kebab = evt.target.closest(".kebab-btn");
            if (!kebab) {
              const actionsCell = evt.target.closest("td.actions");
              if (actionsCell) {
                const kb = actionsCell.querySelector(".kebab-btn");
                if (kb) {
                  try {
                    const r = kb.getBoundingClientRect();
                    const pad = 6; // allow small tolerance for clicks near edge
                    const x = evt.clientX || 0;
                    const y = evt.clientY || 0;
                    if (
                      x >= r.left - pad &&
                      x <= r.right + pad &&
                      y >= r.top - pad &&
                      y <= r.bottom + pad
                    ) {
                      kebab = kb;
                    }
                  } catch (e) {
                    void e;
                  }
                }
              }
            }

            if (kebab) {
              const container = kebab.parentElement;
              const menu = container.querySelector(".action-menu");
              const expanded = kebab.getAttribute("aria-expanded") === "true";
              // close any other open menus (use closeActionMenu so handlers are removed cleanly)
              document.querySelectorAll(".action-menu").forEach((m) => {
                const kb = m.parentElement
                  ? m.parentElement.querySelector(".kebab-btn")
                  : null;
                if (m.style.display !== "none") {
                  try {
                    closeActionMenu(m, kb);
                  } catch (err) {
                    void err;
                    // fallback: hide and collapse
                    m.style.display = "none";
                    if (kb) kb.setAttribute("aria-expanded", "false");
                  }
                }
              });
              if (!expanded) {
                // use positioning helper so menu is fixed and not clipped by overflow
                try {
                  openActionMenu(menu, kebab);
                } catch (e) {
                  void e;
                  // fallback to simple toggle
                  menu.style.display = "block";
                  menu.removeAttribute("aria-hidden");
                  kebab.setAttribute("aria-expanded", "true");
                  const first = menu.querySelector("[role=menuitem]");
                  if (first) first.focus();
                }
              } else {
                try {
                  closeActionMenu(menu, kebab);
                } catch (e) {
                  void e;
                  menu.style.display = "none";
                  kebab.setAttribute("aria-expanded", "false");
                }
              }
              return;
            }

            const actionBtn = evt.target.closest("[data-action]");
            if (!actionBtn) return;
            const action = actionBtn.dataset.action;
            const tr = actionBtn.closest("tr");
            if (!tr) return;
            const id = Number(tr.dataset.id);
            // close menu
            const menu = tr.querySelector(".action-menu");
            const kb = tr.querySelector(".kebab-btn");
            if (menu) menu.style.display = "none";
            if (kb) kb.setAttribute("aria-expanded", "false");

            try {
              if (action === "edit") {
                await doEdit(id);
              } else if (action === "map") {
                openMapById(id, tr.dataset.code, tr.dataset.name);
              } else if (action === "delmap") {
                await doDeleteMapping(id);
              } else if (action === "delete") {
                await doDeleteItem(id);
              } else if (action === "toggle") {
                await doToggle(id);
              }
            } catch (err) {
              console.error("action handler error:", err);
            }
          });
        }
      }
    }
  } catch (e) {
    // if delegation wiring fails, fall back to adding direct listeners (best-effort)
    console.warn("delegated action wiring failed", e);
  }
  const totalShown = typeof total === "number" ? total : rows.length;
  const from = startIndex + 1;
  const to = startIndex + rows.length;
  // Display only the total server count in a compact pill. The previous
  // behaviour showed a range (e.g. "1-50 of 2430"). For clarity and to
  // match the new design, show only the full count (e.g. "2,430 Rows").
  try {
    if (typeof totalRows === "number" && totalRows > 0) {
      rowCount.textContent = `${Number(totalRows).toLocaleString()} Rows`;
    } else {
      rowCount.textContent = "No rows";
    }
    rowCount.classList.add("row-count-pill");
  } catch {
    // Fallback to the old display if anything goes wrong
    rowCount.textContent = `${from}-${to} of ${totalShown}`;
  }
  renderPaginator();
}

function renderPaginator() {
  if (!paginatorEl) return;
  // ensure the compact page-size selector exists at the left of paginator
  if (!document.getElementById("pageSizeSel")) {
    const sel = document.createElement("select");
    sel.id = "pageSizeSel";
    sel.title = "Rows per page";
    sel.innerHTML = `<option value="25">25</option><option value="50">50</option><option value="100">100</option><option value="200">200</option>`;
    sel.style.marginRight = "8px";
    paginatorEl.appendChild(sel);
    // wire change handler
    sel.value = String(pageSize);
    sel.addEventListener("change", () => {
      const v = Number(sel.value) || pageSize;
      if (v !== pageSize) {
        pageSize = v;
        currentPage = 1;
        refresh();
      }
    });
  }
  const existingSel = document.getElementById("pageSizeSel");
  if (existingSel) existingSel.value = String(pageSize);
  // remove previous pagination buttons/info but keep the select element
  Array.from(paginatorEl.children).forEach((n) => {
    if (n.id !== "pageSizeSel") n.remove();
  });
  const createBtn = (label, disabled, action) => {
    const b = document.createElement("button");
    b.className = "ghost";
    b.textContent = label;
    if (disabled) b.disabled = true;
    b.addEventListener("click", action);
    return b;
  };

  const first = createBtn("⏮", currentPage <= 1, () => goToPage(1));
  const prev = createBtn("◀", currentPage <= 1, () =>
    goToPage(currentPage - 1)
  );
  const next = createBtn("▶", currentPage >= totalPages, () =>
    goToPage(currentPage + 1)
  );
  const last = createBtn("⏭", currentPage >= totalPages, () =>
    goToPage(totalPages)
  );

  const info = document.createElement("div");
  info.style.fontSize = "0.95rem";
  info.style.color = "var(--muted)";
  info.textContent = `Page ${currentPage} / ${totalPages}`;

  paginatorEl.appendChild(first);
  paginatorEl.appendChild(prev);
  paginatorEl.appendChild(info);
  paginatorEl.appendChild(next);
  paginatorEl.appendChild(last);
}

function goToPage(p) {
  const np = Math.max(1, Math.min(totalPages, p));
  if (np === currentPage) return;
  currentPage = np;
  refresh();
}

// ---------- Editor ----------
function openEditor(mode, row = null) {
  // show modal editor as an overlay
  editor.style.display = "flex";
  // enable keyboard focus trap and esc handling
  try {
    enableFocusTrap(editor);
  } catch {
    /* ignore */
  }
  if (mode === "new") {
    editorTitle.textContent = "New Stock Item";
    rowIdEl.value = "";
    nameEl.value = "";
    notesEl.value = "";
    activeEl.value = "true";
    if (uomEl.options.length) {
      const opts = Array.from(uomEl.options);
      const kgIdx = opts.findIndex(
        (o) => String(o.text || "").toLowerCase() === "kg"
      );
      uomEl.selectedIndex = kgIdx >= 0 ? kgIdx : 0;
    }
  } else {
    editorTitle.textContent = `Edit: ${row.code}`;
    rowIdEl.value = row.id;
    nameEl.value = row.name ?? "";
    notesEl.value = row.notes ?? "";
    activeEl.value = row.active ? "true" : "false";
    const idx = Array.from(uomEl.options).findIndex(
      (o) => Number(o.value) === row.default_uom_id
    );
    if (idx >= 0) uomEl.selectedIndex = idx;
  }
  // Focus first input for keyboard users
  try {
    // Focus the name field for both new and edit (code is auto-generated)
    setTimeout(() => nameEl.focus(), 60);
  } catch {
    /* ignore focus errors */
  }
}
function closeEditor() {
  try {
    disableFocusTrap();
  } catch {
    /* ignore */
  }
  editor.style.display = "none";
}

// Close modal when clicking on backdrop (outside the dialog)
try {
  editor.addEventListener("click", (e) => {
    if (e.target === editor) closeEditor();
  });
  // wire the explicit close control inside the modal header
  const editorCloseBtn = document.getElementById("editorClose");
  if (editorCloseBtn) editorCloseBtn.addEventListener("click", closeEditor);
} catch {
  /* ignore if editor not present at script parse time */
}

// Backdrop click for category popover/modal
try {
  pop.addEventListener("click", (e) => {
    if (e.target === pop) closeMap();
  });
} catch {
  /* ignore if pop not present */
}

async function onEdit(e) {
  const id = Number(e.currentTarget.dataset.id);
  const { data, error } = await supabase
    .from("inv_stock_item")
    .select("id, code, name, default_uom_id, active, notes")
    .eq("id", id)
    .single();
  if (error) return toast(error.message, "error");
  openEditor("edit", data);
}

async function onSave() {
  const payload = {
    name: nameEl.value.trim(),
    default_uom_id: uomEl.value ? Number(uomEl.value) : null,
    active: activeEl.value === "true",
    notes: (notesEl.value || "").trim() || null,
  };
  if (!payload.name) return toast("Name required", "error");
  if (!payload.default_uom_id) return toast("Default UOM required", "error");
  if (!rowIdEl.value) {
    const { error } = await supabase.from("inv_stock_item").insert(payload);
    if (error) return toast(error.message, "error");
    toast("Created", "success");
  } else {
    const id = Number(rowIdEl.value);
    const { error } = await supabase
      .from("inv_stock_item")
      .update({
        name: payload.name,
        default_uom_id: payload.default_uom_id,
        active: payload.active,
        notes: payload.notes,
      })
      .eq("id", id);
    if (error) return toast(error.message, "error");
    toast("Saved", "success");
  }
  closeEditor();
  await refresh();
}

async function onToggle(e) {
  const id = Number(e.currentTarget.dataset.id);
  const isActive = e.currentTarget.dataset.active === "1";
  const ok = await showConfirm(
    `${isActive ? "Deactivate" : "Activate"} this item?`,
    `${isActive ? "Deactivate" : "Activate"} Item`
  );
  if (!ok) return;
  const { error } = await supabase
    .from("inv_stock_item")
    .update({ active: !isActive })
    .eq("id", id);
  if (error) return toast(error.message, "error");
  toast("Updated");
  await refresh();
}

// ---------- Category Popover ----------
function openMap(e) {
  const id = Number(e.currentTarget.dataset.id);
  const code = e.currentTarget.dataset.code;
  const name = e.currentTarget.dataset.name;
  catRowId.value = id;
  catFor.textContent = `Item: ${code} — ${name}`;
  // show as centered modal overlay and enable focus trap
  try {
    pop.style.display = "flex";
    enableFocusTrap(pop);
  } catch {
    pop.style.display = "block";
  }
  loadCurrentMap(id);
}
async function loadCurrentMap(id) {
  const { data: map } = await supabase
    .from("inv_stock_item_class_map")
    .select("category_id, subcategory_id, group_id, subgroup_id")
    .eq("stock_item_id", id)
    .maybeSingle();
  catSel.value = map?.category_id ?? "";
  if (map?.category_id) {
    fillSubcats(map.category_id);
    subcatSel.value = map.subcategory_id ?? "";
  } else {
    subcatSel.innerHTML = `<option value="">(none)</option>`;
  }
  if (map?.subcategory_id) {
    fillGroups(map.subcategory_id);
    grpSel.value = map.group_id ?? "";
  } else {
    grpSel.innerHTML = `<option value="">(none)</option>`;
  }
  if (map?.group_id) {
    fillSubgroups(map.group_id);
    sgrpSel.value = map.subgroup_id ?? "";
  } else {
    sgrpSel.innerHTML = `<option value="">(none)</option>`;
  }
}
function closeMap() {
  try {
    disableFocusTrap();
  } catch {
    /* ignore */
  }
  pop.style.display = "none";
}

async function saveMap() {
  const id = Number(catRowId.value);
  const payload = {
    stock_item_id: id,
    category_id: catSel.value ? Number(catSel.value) : null,
    subcategory_id: subcatSel.value ? Number(subcatSel.value) : null,
    group_id: grpSel.value ? Number(grpSel.value) : null,
    subgroup_id: sgrpSel.value ? Number(sgrpSel.value) : null,
  };
  const { error } = await supabase
    .from("inv_stock_item_class_map")
    .upsert(payload, { onConflict: "stock_item_id" });
  if (error) return toast(error.message, "error");
  toast("Mapping saved", "success");
  closeMap();
  await refresh();
}

async function clearMap() {
  const id = Number(catRowId.value);
  const ok = await showConfirm("Clear category mapping?", "Clear Mapping");
  if (!ok) return;
  const { error } = await supabase
    .from("inv_stock_item_class_map")
    .delete()
    .eq("stock_item_id", id);
  if (error) return toast(error.message, "error");
  toast("Mapping cleared");
  closeMap();
  await refresh();
}

// Delete only the mapping for a given stock item (leave the stock item intact)
async function onDeleteMapping(e) {
  const id = Number(e.currentTarget.dataset.id);
  const ok = await showConfirm(
    "Delete mapping for this item?\nThis will remove the category mapping but keep the stock item.",
    "Delete Mapping"
  );
  if (!ok) return;
  const { error } = await supabase
    .from("inv_stock_item_class_map")
    .delete()
    .eq("stock_item_id", id);
  if (error) return toast(error.message || String(error), "error");
  toast("Mapping deleted", "success");
  await refresh();
}

// Delete the stock item (this will cascade-delete the mapping via FK ON DELETE CASCADE)
async function onDeleteItem(e) {
  const id = Number(e.currentTarget.dataset.id);
  const ok = await showConfirm(
    "Delete this stock item?\nThis will permanently delete the item and any category mapping.",
    "Delete Item"
  );
  if (!ok) return;
  const { error } = await supabase.from("inv_stock_item").delete().eq("id", id);
  if (error) return toast(error.message || String(error), "error");
  toast("Item deleted", "success");
  await refresh();
}

// ---------- Refresh ----------
async function refresh() {
  try {
    const { rows, totalRows: tot, startIndex } = await fetchItems(currentPage);
    render(rows, startIndex, tot);
  } catch (err) {
    console.error("refresh error:", err);
    toast(err.message || String(err), "error");
  }
}

function refreshDebounced(delay = 250) {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(
    () => refresh().catch((e) => console.error(e)),
    delay
  );
}

async function setupRealtime() {
  try {
    // create a single channel and listen for changes on relevant tables
    realtimeChannel = supabase.channel("public:manage-stock-items");

    realtimeChannel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inv_stock_item" },
        () => {
          // reload when stock items change
          refreshDebounced();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inv_stock_item_class_map",
        },
        () => refreshDebounced()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inv_uom" },
        () => refreshDebounced()
      );

    await realtimeChannel.subscribe();
    // best-effort: log channel state for debugging
    realtimeChannel.on("subscription_succeeded", () => {
      console.debug("Realtime subscription established for manage-stock-items");
    });
  } catch (err) {
    console.warn("Realtime setup failed:", err?.message || err);
  }
}

// ---------- Events ----------
btnNew.addEventListener("click", () => openEditor("new"));
btnSave.addEventListener("click", onSave);
btnCancel.addEventListener("click", closeEditor);

catClose.addEventListener("click", closeMap);
btnCatSave.addEventListener("click", saveMap);
btnCatClear.addEventListener("click", clearMap);

q.addEventListener("input", () => {
  currentPage = 1;
  refresh();
});
filterCategory.addEventListener("change", () => {
  currentPage = 1;
  refresh();
});

// Tabs and classification management removed; only Stock Items remain

// ---------- Boot ----------
(async () => {
  await initAuth();
  await loadUOM();
  await loadCategories();
  await refresh();
  // start realtime updates so the table reloads automatically on DB changes
  await setupRealtime();
  // cleanup realtime subscription on page unload
  window.addEventListener("beforeunload", () => {
    try {
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    } catch {
      /* ignore */
    }
  });
})();
