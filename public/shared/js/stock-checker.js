/***************************************************************************
 * stock-checker.js — SASV Stock Checker (Primary + Quick + Drawers)
 ***************************************************************************/
import { supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";
/* global TomSelect */

// ────────────── Utility functions and variables (move to top) ──────────────
function setMsg(msg) {
  const el = document.getElementById("sc-msg");
  if (el) el.textContent = msg || "";
}
function fmtInt(n) {
  return (n ?? 0).toLocaleString("en-IN");
}
function fmt3(n) {
  return n == null ? "" : Number(n).toFixed(3);
}
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const $ = (id) => document.getElementById(id);

// ---- Quick-chip helpers (TOP-LEVEL; define once) ----
function setChip(btn, pressed) {
  if (!btn) return;
  btn.setAttribute("aria-pressed", String(pressed));
  btn.classList.toggle("is-active", pressed);
}

function toggleChip(btn, stateKey) {
  if (!btn) return;
  const now = btn.getAttribute("aria-pressed") === "true";
  const next = !now;
  setChip(btn, next);

  // reflect to state
  if (stateKey === "mosLt3") state.quick.mosLt3 = next;
  if (stateKey === "raso") state.quick.raso = next;

  page = 1;
  runQuery();
}

// Use names directly for filtering, mirroring your SQL check
const RASO_NAMES = [
  "Bhasmam",
  "Chendooram",
  "Chunnam",
  "Kalimbu",
  "Karpam",
  "Karuppu",
  "Ksharam",
  "Kuzhambu (Siddha)",
  "Louham",
  "Mai",
  "Mandooram",
  "Mathirai",
  "Mezhuku",
  "Parpam",
  "Pasai",
  "Pathangam",
  "Patru",
  "Podi",
  "Rasam",
  "Sindooram",
  "Vennei",
];

/* ───────────────────── DOM refs (match your HTML) ───────────────────── */

// Main filter row elements (unique IDs)
const elItemSel = $("sc-item");
const elPackSize = $("sc-packsize");
const elUOM = $("sc-uom");
// const elStatus = $("sc-status");

// Drawer classification filters
const drawerCat = $("drawer-cat");
const drawerSubcat = $("drawer-subcat");
const drawerPgroup = $("drawer-pgroup");
const drawerSgroup = $("drawer-sgroup");

// Populate and wire up classification filters in the drawer
async function populateDrawerClassificationFilters() {
  if (!drawerCat || !drawerSubcat || !drawerPgroup || !drawerSgroup) return;

  function fillSelect(select, rows, valueKey, labelKey) {
    select.innerHTML = '<option value="">All</option>';
    (rows || []).forEach((row) => {
      const opt = document.createElement("option");
      opt.value = row[valueKey];
      opt.textContent = row[labelKey];
      select.appendChild(opt);
    });
  }

  // 1) Categories
  const { data: cats, error: catErr } = await supabase
    .from("categories")
    .select("id, category_name")
    .order("category_name");
  if (catErr) console.error("Error fetching categories:", catErr);
  fillSelect(drawerCat, cats, "id", "category_name");
  drawerSubcat.innerHTML = '<option value="">All</option>';
  drawerPgroup.innerHTML = '<option value="">All</option>';
  drawerSgroup.innerHTML = '<option value="">All</option>';
  drawerSubcat.disabled = true;
  drawerPgroup.disabled = true;
  drawerSgroup.disabled = true;

  // 2) Category → Sub-categories
  drawerCat.addEventListener("change", async () => {
    const catId = drawerCat.value || "";
    state.category_id = catId;
    state.sub_category_id = "";
    state.product_group_id = "";
    state.sub_group_id = "";

    if (catId) {
      const { data: subcats, error } = await supabase
        .from("sub_categories")
        .select("id, subcategory_name") // <-- IMPORTANT: subcategory_name
        .eq("category_id", catId)
        .order("subcategory_name");
      if (error) console.error("Error fetching subcategories:", error);
      fillSelect(drawerSubcat, subcats, "id", "subcategory_name");
      drawerSubcat.disabled = false;
    } else {
      drawerSubcat.innerHTML = '<option value="">All</option>';
      drawerSubcat.disabled = true;
    }

    drawerPgroup.innerHTML = '<option value="">All</option>';
    drawerSgroup.innerHTML = '<option value="">All</option>';
    drawerPgroup.disabled = true;
    drawerSgroup.disabled = true;

    page = 1;
    runQuery();
  });

  // 3) Sub-category → Product groups
  drawerSubcat.addEventListener("change", async () => {
    const subcatId = drawerSubcat.value || "";
    state.sub_category_id = subcatId;
    state.product_group_id = "";
    state.sub_group_id = "";

    if (subcatId) {
      const { data: pgroups, error } = await supabase
        .from("product_groups")
        .select("id, group_name") // <-- IMPORTANT: group_name
        .eq("sub_category_id", subcatId)
        .order("group_name");
      if (error) console.error("Error fetching product groups:", error);
      fillSelect(drawerPgroup, pgroups, "id", "group_name");
      drawerPgroup.disabled = false;
    } else {
      drawerPgroup.innerHTML = '<option value="">All</option>';
      drawerPgroup.disabled = true;
    }

    drawerSgroup.innerHTML = '<option value="">All</option>';
    drawerSgroup.disabled = true;

    page = 1;
    runQuery();
  });

  // 4) Product group → Sub-groups
  drawerPgroup.addEventListener("change", async () => {
    const pgroupId = drawerPgroup.value || "";
    state.product_group_id = pgroupId;
    state.sub_group_id = "";

    if (pgroupId) {
      const { data: sgroups, error } = await supabase
        .from("sub_groups")
        .select("id, sub_group_name")
        .eq("product_group_id", pgroupId)
        .order("sub_group_name");
      if (error) console.error("Error fetching sub-groups:", error);
      fillSelect(drawerSgroup, sgroups, "id", "sub_group_name");
      drawerSgroup.disabled = false;
    } else {
      drawerSgroup.innerHTML = '<option value="">All</option>';
      drawerSgroup.disabled = true;
    }

    page = 1;
    runQuery();
  });

  // 5) Sub-group change just sets the state and filters
  drawerSgroup.addEventListener("change", () => {
    state.sub_group_id = drawerSgroup.value || "";
    page = 1;
    runQuery();
  });
}

// ...existing code...

const elExport = $("sc-export");
const elHome = $("homeBtn");
const elClear = $("sc-clear");

const elCount = $("sc-count");
const elUpdated = $("sc-updated");
const elPrev = $("sc-prev");
const elNext = $("sc-next");
const elPage = $("sc-page");

const elTable = $("sc-table");
const elBody = $("sc-body");
// (elMsg removed, not used)

// Quick chips
const elQfMosLt3 = $("qf-moslt3");
const elQfRaso = $("qf-raso");

// Advanced drawer controls
const exCat = $("ex-cat");
const exSubcat = $("ex-subcat");
const exPgroup = $("ex-pgroup");
const exSgroup = $("ex-sgroup");

const mosIkEn = $("mosik-en"),
  mosIkOp = $("mosik-op"),
  mosIkV1 = $("mosik-v1"),
  mosIkV2 = $("mosik-v2"),
  mosIkNN = $("mosik-nnull");

const mosOkEn = $("mosok-en"),
  mosOkOp = $("mosok-op"),
  mosOkV1 = $("mosok-v1"),
  mosOkV2 = $("mosok-v2"),
  mosOkNN = $("mosok-nnull");

const mosOvEn = $("mosov-en"),
  mosOvOp = $("mosov-op"),
  mosOvV1 = $("mosov-v1"),
  mosOvV2 = $("mosov-v2"),
  mosOvNN = $("mosov-nnull");

const advApply = $("adv-apply");
const advClear = $("adv-clear");
const advCount = $("adv-count");

/* ─────────────────────────── State ─────────────────────────── */
const PAGE_SIZE = 50;
const VISIBLE_COLS = 11;
let page = 1;

let selectedProductId = ""; // set by TomSelect

const state = {
  // Primary
  pack_size: "",
  uom: "",
  // product_status: "",

  // Quick
  quick: {
    mosLt3: false,
    raso: false,
  },

  // Classification
  category_id: "",
  sub_category_id: "",
  product_group_id: "",
  sub_group_id: "",

  // Advanced
  ex: { cats: [], subcats: [], pgroups: [], sgroups: [] },
  mos: {
    ik: { en: false, op: "gt", v1: "", v2: "", notNull: false },
    ok: { en: false, op: "gt", v1: "", v2: "", notNull: false },
    ov: { en: false, op: "gt", v1: "", v2: "", notNull: false },
  },
};

// Rasoushadhi sub_group IDs resolved at init

init();

let __advExInitDone = false; // guard to prevent double wiring

async function populateAdvancedExclusions() {
  if (__advExInitDone) return;
  __advExInitDone = true;

  const getSel = (el) =>
    Array.from(el?.selectedOptions || []).map((o) => o.value);

  const dedupeById = (rows) => {
    const seen = new Set();
    const out = [];
    for (const r of rows || []) {
      const id = String(r.id);
      if (!seen.has(id)) {
        seen.add(id);
        out.push(r);
      }
    }
    return out;
  };

  const disable = (els, on = true) => {
    (Array.isArray(els) ? els : [els]).forEach((el) => {
      if (el) el.disabled = !!on;
    });
  };

  const fillMulti = (select, rows, valueKey, labelKey) => {
    if (!select) return;
    const prev = new Set(
      Array.from(select.selectedOptions).map((o) => o.value)
    );
    select.innerHTML = "";
    dedupeById(rows).forEach((row) => {
      const val = String(row[valueKey]);
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = row[labelKey];
      if (prev.has(val)) opt.selected = true; // keep still-valid picks
      select.appendChild(opt);
    });
  };

  // --- Loaders with optional parent filters ---
  const loadCats = async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id, category_name")
      .order("category_name");
    if (error) throw error;
    return data;
  };

  const loadSubcats = async (catIds) => {
    let q = supabase
      .from("sub_categories")
      .select("id, subcategory_name, category_id")
      .order("subcategory_name");
    if (catIds?.length) q = q.in("category_id", catIds);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  };

  const loadPgroups = async (subcatIds) => {
    let q = supabase
      .from("product_groups")
      .select("id, group_name, sub_category_id")
      .order("group_name");
    if (subcatIds?.length) q = q.in("sub_category_id", subcatIds);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  };

  const loadSgroups = async (pgroupIds) => {
    let q = supabase
      .from("sub_groups")
      .select("id, sub_group_name, product_group_id")
      .order("sub_group_name");
    if (pgroupIds?.length) q = q.in("product_group_id", pgroupIds);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  };

  // --- Initial bulk load (unfiltered) ---
  disable([exCat, exSubcat, exPgroup, exSgroup], true);
  try {
    const [cats, subs, grps, sgrp] = await Promise.all([
      loadCats(),
      loadSubcats([]),
      loadPgroups([]),
      loadSgroups([]),
    ]);
    fillMulti(exCat, cats, "id", "category_name");
    fillMulti(exSubcat, subs, "id", "subcategory_name");
    fillMulti(exPgroup, grps, "id", "group_name");
    fillMulti(exSgroup, sgrp, "id", "sub_group_name");
  } finally {
    disable([exCat, exSubcat, exPgroup, exSgroup], false);
  }

  // --- Cascade wiring (use onchange to avoid duplicate handlers) ---
  exCat.onchange = async () => {
    disable([exSubcat, exPgroup, exSgroup], true);

    const catIds = getSel(exCat);
    const subs = await loadSubcats(catIds);
    fillMulti(exSubcat, subs, "id", "subcategory_name");

    // After refreshing subcats, clear & reload lower levels based on current (probably none)
    const pg = await loadPgroups(getSel(exSubcat));
    fillMulti(exPgroup, pg, "id", "group_name");

    const sg = await loadSgroups(getSel(exPgroup));
    fillMulti(exSgroup, sg, "id", "sub_group_name");

    disable([exSubcat, exPgroup, exSgroup], false);
  };

  exSubcat.onchange = async () => {
    disable([exPgroup, exSgroup], true);

    const pg = await loadPgroups(getSel(exSubcat));
    fillMulti(exPgroup, pg, "id", "group_name");

    const sg = await loadSgroups(getSel(exPgroup));
    fillMulti(exSgroup, sg, "id", "sub_group_name");

    disable([exPgroup, exSgroup], false);
  };

  exPgroup.onchange = async () => {
    disable(exSgroup, true);

    const sg = await loadSgroups(getSel(exPgroup));
    fillMulti(exSgroup, sg, "id", "sub_group_name");

    disable(exSgroup, false);
  };
}

// ─────────────────────────── Init ─────────────────────────── */
async function init() {
  try {
    // CSV
    elExport.addEventListener("click", exportCSV);

    // Pagination
    elPrev.addEventListener("click", () => {
      if (page > 1) {
        page--;
        runQuery();
      }
    });
    elNext.addEventListener("click", () => {
      page++;
      runQuery();
    });

    // HOME always navigates; CLEAR always clears (same on Electron & Web)
    if (elHome) elHome.addEventListener("click", () => Platform.goHome());
    if (elClear) elClear.addEventListener("click", clearAll);

    // CLEAR always clears filters on both platforms
    if (elClear) {
      elClear.addEventListener("click", clearAll);
    }

    // Primary filters
    elPackSize.addEventListener("input", () => {
      state.pack_size = (elPackSize.value || "").trim();
      autoFillUOM();
      page = 1;
      runQuery();
    });

    if (elQfMosLt3) {
      elQfMosLt3.addEventListener("click", () =>
        toggleChip(elQfMosLt3, "mosLt3")
      );
      // restore initial state
      setChip(elQfMosLt3, state?.quick?.mosLt3 === true);
    }
    if (elQfRaso) {
      elQfRaso.addEventListener("click", () => toggleChip(elQfRaso, "raso"));
      // restore initial state
      setChip(elQfRaso, state?.quick?.raso === true);
    }

    // Classification filters (drawer only)
    wireClassificationFilters();
    await populateDrawerClassificationFilters();
    await populateAdvancedExclusions();

    // Tom Select (Item)
    initTomSelect();

    // Advanced drawer
    wireAdvanced();

    // Stock snapshot label
    updateStockSnapshotLabel();

    // First load
    await runQuery();
  } catch (err) {
    console.error(err);
    setMsg(err.message || String(err));
  }
}

/* ───────────────────── Tom Select (Item) ───────────────────── */
function initTomSelect() {
  if (!elItemSel) return;

  new TomSelect("#sc-item", {
    valueField: "id",
    labelField: "item",
    searchField: ["item"],
    maxItems: 1,
    placeholder: "Type to search item…",
    loadThrottle: 300,
    preload: false,
    load: async (query, callback) => {
      if (!query.length) return callback();
      const { data, error } = await supabase
        .from("products")
        .select("id,item,status")
        .ilike("item", `%${query}%`)
        .order("item", { ascending: true })
        .limit(30);
      if (error) {
        console.error("Item load failed:", error.message);
        return callback();
      }
      callback(data || []);
    },
    onItemAdd: (value) => {
      selectedProductId = value || "";
      page = 1;
      runQuery();
      if (state.pack_size) autoFillUOM();
      setTimeout(() => {
        elPackSize?.focus();
        elPackSize?.select();
      }, 0);
    },
    onChange: (value) => {
      selectedProductId = value || "";
      page = 1;
      runQuery();
      if (state.pack_size) autoFillUOM();
      if (document.activeElement !== elPackSize) {
        setTimeout(() => {
          elPackSize?.focus();
          elPackSize?.select();
        }, 0);
      }
    },
    render: {
      option(item) {
        return `<div>${escapeHtml(item.item || "")}</div>`;
      },
      item(item) {
        return `<div>${escapeHtml(item.item || "")}</div>`;
      },
    },
  });
}

/* ─────────────────── Classification filters ─────────────────── */
function wireClassificationFilters() {
  if (!drawerCat || !drawerSubcat || !drawerPgroup || !drawerSgroup) return;
  drawerCat.addEventListener("change", () => {
    state.category_id = drawerCat.value || "";
    state.sub_category_id = "";
    state.product_group_id = "";
    state.sub_group_id = "";
    page = 1;
    runQuery();
  });
  drawerSubcat.addEventListener("change", () => {
    state.sub_category_id = drawerSubcat.value || "";
    state.product_group_id = "";
    state.sub_group_id = "";
    page = 1;
    runQuery();
  });
  drawerPgroup.addEventListener("change", () => {
    state.product_group_id = drawerPgroup.value || "";
    state.sub_group_id = "";
    page = 1;
    runQuery();
  });
  drawerSgroup.addEventListener("change", () => {
    state.sub_group_id = drawerSgroup.value || "";
    page = 1;
    runQuery();
  });
}

/* ───────────────────── Advanced drawer ───────────────────── */
function wireAdvanced() {
  const wireBetween = (opSel, v2) => {
    if (!opSel || !v2) return;
    const toggle = () => {
      v2.style.display = opSel.value === "between" ? "" : "none";
    };
    opSel.addEventListener("change", toggle);
    toggle();
  };

  wireBetween(mosIkOp, mosIkV2);
  wireBetween(mosOkOp, mosOkV2);
  wireBetween(mosOvOp, mosOvV2);

  if (advApply) {
    advApply.addEventListener("click", () => {
      readAdvancedState();
      const n = countAdvancedActive();
      if (advCount) {
        if (n > 0) {
          advCount.style.display = "";
          advCount.textContent = `Advanced • ${n}`;
        } else {
          advCount.style.display = "none";
        }
      }
      $("drawer-classification")?.removeAttribute("open");
      $("drawer-advanced")?.removeAttribute("open");
      page = 1;
      runQuery();
    });
  }

  if (advClear) {
    advClear.addEventListener("click", () => {
      [exCat, exSubcat, exPgroup, exSgroup].forEach((sel) => {
        if (!sel) return;
        Array.from(sel.options).forEach((o) => (o.selected = false));
      });

      [mosIkEn, mosOkEn, mosOvEn].forEach((el) => el && (el.checked = false));
      [mosIkOp, mosOkOp, mosOvOp].forEach((el) => el && (el.value = "gt"));
      [mosIkV1, mosOkV1, mosOvV1, mosIkV2, mosOkV2, mosOvV2].forEach(
        (el) => el && (el.value = "")
      );
      [mosIkNN, mosOkNN, mosOvNN].forEach((el) => el && (el.checked = false));

      readAdvancedState();
      if (advCount) advCount.style.display = "none";
      page = 1;
      runQuery();
    });
  }
}

function readAdvancedState() {
  state.ex.cats = Array.from(exCat?.selectedOptions || []).map((o) => o.value);
  state.ex.subcats = Array.from(exSubcat?.selectedOptions || []).map(
    (o) => o.value
  );
  state.ex.pgroups = Array.from(exPgroup?.selectedOptions || []).map(
    (o) => o.value
  );
  state.ex.sgroups = Array.from(exSgroup?.selectedOptions || []).map(
    (o) => o.value
  );

  const getMosRule = (opEl, v1El, v2El, nnEl) => {
    const op = opEl.value;
    const v1 = v1El.value;
    const v2 = v2El.value;
    // Rule is active if user entered at least one number (or between with any side)
    const en = v1 !== "" || (op === "between" && v2 !== "");
    return { en, op, v1, v2, notNull: !!nnEl.checked };
  };

  state.mos.ik = getMosRule(mosIkOp, mosIkV1, mosIkV2, mosIkNN);
  state.mos.ok = getMosRule(mosOkOp, mosOkV1, mosOkV2, mosOkNN);
  state.mos.ov = getMosRule(mosOvOp, mosOvV1, mosOvV2, mosOvNN);
}

function countAdvancedActive() {
  let c = 0;
  c += state.ex.cats.length ? 1 : 0;
  c += state.ex.subcats.length ? 1 : 0;
  c += state.ex.pgroups.length ? 1 : 0;
  c += state.ex.sgroups.length ? 1 : 0;
  ["ik", "ok", "ov"].forEach((k) => {
    if (state.mos[k].en) c++;
  });
  return c;
}

/* ─────────────────── Auto-fill UOM ─────────────────── */
async function autoFillUOM() {
  elUOM.textContent = "—";
  state.uom = "";

  if (!selectedProductId || !state.pack_size) return;

  const { data, error } = await supabase
    .from("v_stock_checker")
    .select("uom")
    .eq("product_id", selectedProductId)
    .eq("pack_size", state.pack_size)
    .limit(1);

  if (!error && data && data.length) {
    const uom = data[0].uom || "";
    elUOM.textContent = uom || "—";
    state.uom = uom;
  }
}

/* ───────────────────── Query ───────────────────── */
async function runQuery() {
  try {
    setMsg("");
    elBody.innerHTML = `<tr><td colspan="${VISIBLE_COLS}">Loading…</td></tr>`;

    let q = supabase.from("v_stock_checker").select("*", { count: "exact" });

    // ── Primary
    if (selectedProductId) q = q.eq("product_id", selectedProductId);
    if (state.pack_size) q = q.eq("pack_size", state.pack_size);
    if (state.uom) q = q.eq("uom", state.uom);
    // if (state.product_status) q = q.eq("product_status", state.product_status);

    // ── Quick filters
    if (state.quick.mosLt3) q = q.lt("mos_overall", 3);
    // NEW (filter by names, like your SQL)
    if (state.quick.raso) q = q.in("sub_group_name", RASO_NAMES);

    // ── Classification
    if (state.category_id) q = q.eq("category_id", state.category_id);
    if (state.sub_category_id)
      q = q.eq("sub_category_id", state.sub_category_id);
    if (state.product_group_id)
      q = q.eq("product_group_id", state.product_group_id);
    if (state.sub_group_id) q = q.eq("sub_group_id", state.sub_group_id);

    // ── Advanced: exclusions
    function applyExclusion(col, ids) {
      if (!ids || !ids.length) return;
      if (ids.length === 1) {
        q = q.neq(col, ids[0]);
      } else {
        q = q.not(
          col,
          "in",
          `(${ids.map((x) => JSON.stringify(x)).join(",")})`
        );
      }
    }
    applyExclusion("category_id", state.ex.cats);
    applyExclusion("sub_category_id", state.ex.subcats);
    applyExclusion("product_group_id", state.ex.pgroups);
    applyExclusion("sub_group_id", state.ex.sgroups);

    // ── Advanced: MOS comparators
    function applyMos(col, rule) {
      if (!rule.en) return;
      const v1 = rule.v1 !== "" ? Number(rule.v1) : null;
      const v2 = rule.v2 !== "" ? Number(rule.v2) : null;
      if (rule.notNull) q = q.not(col, "is", null);

      switch (rule.op) {
        case "eq":
          if (v1 != null) q = q.eq(col, v1);
          break;
        case "gt":
          if (v1 != null) q = q.gt(col, v1);
          break;
        case "gte":
          if (v1 != null) q = q.gte(col, v1);
          break;
        case "lt":
          if (v1 != null) q = q.lt(col, v1);
          break;
        case "lte":
          if (v1 != null) q = q.lte(col, v1);
          break;
        case "between":
          if (v1 != null) q = q.gte(col, v1);
          if (v2 != null) q = q.lte(col, v2);
          break;
      }
    }
    applyMos("mos_ik", state.mos.ik);
    applyMos("mos_ok", state.mos.ok);
    applyMos("mos_overall", state.mos.ov);

    // Sort: category → product_group → sub_group → sub_category → item → pack_size
    q = q
      .order("category_name", { ascending: true })
      .order("product_group_name", { ascending: true })
      .order("sub_group_name", { ascending: true })
      .order("sub_category_name", { ascending: true })
      .order("item", { ascending: true })
      .order("pack_size", { ascending: true });

    // Pagination
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    q = q.range(from, to);

    const { data, error, count } = await q;
    if (error) throw error;

    renderRows(data || []);

    // Scroll the results container to top
    if (elTable && elTable.parentElement) {
      elTable.parentElement.scrollTop = 0;
    }

    const total = count ?? 0;
    const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
    page = clamp(page, 1, maxPage);
    elCount.textContent = `${fmtInt(total)} rows`;
    elPage.textContent = `Page ${page} / ${maxPage}`;
    elPrev.disabled = page <= 1;
    elNext.disabled = page >= maxPage;

    if (!data || data.length === 0) {
      elBody.innerHTML = `<tr><td colspan="${VISIBLE_COLS}">No rows found for the selected filters.</td></tr>`;
    }
  } catch (err) {
    console.error(err);
    setMsg(err.message || String(err));
    elBody.innerHTML = `<tr><td colspan="${VISIBLE_COLS}">Error loading data.</td></tr>`;
  }
}

/* ───────────────────── Render ───────────────────── */
function renderRows(rows) {
  elBody.innerHTML = rows
    .map(
      (r, i) => `
    <tr data-row-idx="${i}">
      <td style="text-align:left">${escapeHtml(r.item || "")}</td>
      <td style="text-align:center">${escapeHtml(
        String(r.pack_size ?? "")
      )}</td>
      <td style="text-align:center">${escapeHtml(r.uom || "")}</td>
      <td style="text-align:center">${fmtInt(r.stock_ik)}</td>
      <td style="text-align:center">${fmtInt(r.stock_kkd)}</td>
      <td style="text-align:center">${fmtInt(r.stock_ok)}</td>
      <td style="text-align:center">${fmtInt(r.forecast_ik)}</td>
      <td style="text-align:center">${fmtInt(r.forecast_ok)}</td>
      <td style="text-align:center">${fmt3(r.mos_ik)}</td>
      <td style="text-align:center">${fmt3(r.mos_ok)}</td>
      <td style="text-align:center">${fmt3(r.mos_overall)}</td>
    </tr>`
    )
    .join("");

  // Add row click selection logic
  Array.from(elBody.querySelectorAll("tr")).forEach((tr) => {
    tr.addEventListener("click", function () {
      // Remove selection from all rows
      Array.from(elBody.querySelectorAll("tr.selected-row")).forEach((row) => {
        row.classList.remove("selected-row");
      });
      // Add selection to clicked row
      this.classList.add("selected-row");
    });
  });
}

/* ───────────────────── Export CSV ───────────────────── */
async function exportCSV() {
  try {
    setMsg("");

    let q = supabase.from("v_stock_checker").select("*");

    // Primary
    if (selectedProductId) q = q.eq("product_id", selectedProductId);
    if (state.pack_size) q = q.eq("pack_size", state.pack_size);
    if (state.uom) q = q.eq("uom", state.uom);
    if (state.product_status) q = q.eq("product_status", state.product_status);

    // Quick
    if (state.quick.mosLt3) q = q.lt("mos_overall", 3);
    // NEW
    if (state.quick.raso) q = q.in("sub_group_name", RASO_NAMES);

    // Classification
    if (state.category_id) q = q.eq("category_id", state.category_id);
    if (state.sub_category_id)
      q = q.eq("sub_category_id", state.sub_category_id);
    if (state.product_group_id)
      q = q.eq("product_group_id", state.product_group_id);
    if (state.sub_group_id) q = q.eq("sub_group_id", state.sub_group_id);

    // Advanced: exclusions
    function applyExclusion(col, ids) {
      if (!ids || !ids.length) return;
      if (ids.length === 1) {
        q = q.neq(col, ids[0]);
      } else {
        q = q.not(
          col,
          "in",
          `(${ids.map((x) => JSON.stringify(x)).join(",")})`
        );
      }
    }
    applyExclusion("category_id", state.ex.cats);
    applyExclusion("sub_category_id", state.ex.subcats);
    applyExclusion("product_group_id", state.ex.pgroups);
    applyExclusion("sub_group_id", state.ex.sgroups);

    // Advanced: MOS comparators
    function applyMos(col, rule) {
      if (!rule.en) return;
      const v1 = rule.v1 !== "" ? Number(rule.v1) : null;
      const v2 = rule.v2 !== "" ? Number(rule.v2) : null;
      if (rule.notNull) q = q.not(col, "is", null);
      switch (rule.op) {
        case "eq":
          if (v1 != null) q = q.eq(col, v1);
          break;
        case "gt":
          if (v1 != null) q = q.gt(col, v1);
          break;
        case "gte":
          if (v1 != null) q = q.gte(col, v1);
          break;
        case "lt":
          if (v1 != null) q = q.lt(col, v1);
          break;
        case "lte":
          if (v1 != null) q = q.lte(col, v1);
          break;
        case "between":
          if (v1 != null) q = q.gte(col, v1);
          if (v2 != null) q = q.lte(col, v2);
          break;
      }
    }
    applyMos("mos_ik", state.mos.ik);
    applyMos("mos_ok", state.mos.ok);
    applyMos("mos_overall", state.mos.ov);

    // Sort & size
    q = q
      .order("category_name", { ascending: true })
      .order("product_group_name", { ascending: true })
      .order("sub_group_name", { ascending: true })
      .order("sub_category_name", { ascending: true })
      .order("item", { ascending: true })
      .order("pack_size", { ascending: true })
      .limit(20000);

    const { data, error } = await q;
    if (error) throw error;

    const rows = data || [];
    if (!rows.length) {
      setMsg("No rows to export.");
      return;
    }

    const headers = [
      "Category",
      "Sub-category",
      "Group",
      "Sub-group",
      "Item",
      "Pack Size",
      "UOM",
      "Stock IK",
      "Stock KKD",
      "Stock OK",
      "Forecast IK",
      "Forecast OK",
      "MOS IK",
      "MOS OK",
      "MOS overall",
      "Product ID",
      "SKU ID",
    ];
    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        [
          r.category_name,
          r.sub_category_name,
          r.product_group_name,
          r.sub_group_name,
          r.item,
          r.pack_size,
          r.uom,
          r.stock_ik,
          r.stock_kkd,
          r.stock_ok,
          r.forecast_ik,
          r.forecast_ok,
          r.mos_ik,
          r.mos_ok,
          r.mos_overall,
          r.product_id,
          r.sku_id,
        ]
          .map(csvEscape)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock_checker_export_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
  } catch (err) {
    console.error(err);
    setMsg("Export failed: " + (err.message || String(err)));
  }
}

/* ────────────── Stock snapshot label ────────────── */
async function updateStockSnapshotLabel() {
  try {
    const { data } = await supabase
      .from("sku_stock_snapshot")
      .select("as_of_date")
      .order("as_of_date", { ascending: false })
      .limit(1);
    if (data && data.length) {
      const dt = new Date(data[0].as_of_date);
      const txt = dt.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      elUpdated.textContent = `Last stock snapshot: ${txt}`;
    } else {
      elUpdated.textContent = "Last stock snapshot: —";
    }
  } catch {
    elUpdated.textContent = "Last stock snapshot: —";
  }
}

/* ────────────── CLEAR (for PWA HOME) ────────────── */
function clearAll() {
  // clear TomSelect
  const ts = elItemSel && elItemSel.tomselect;
  ts?.clear();
  selectedProductId = "";

  // reset primary
  elPackSize.value = "";
  elUOM.textContent = "";

  // reset classification (drawer only)
  if (drawerCat) drawerCat.value = "";
  if (drawerSubcat) drawerSubcat.value = "";
  if (drawerPgroup) drawerPgroup.value = "";
  if (drawerSgroup) drawerSgroup.value = "";

  // reset quick chips (UI + state)
  setChip(elQfMosLt3, false);
  setChip(elQfRaso, false);
  state.quick = { mosLt3: false, raso: false };

  // Close classification and advanced drawers if open
  const classifDrawer = $("drawer-classification");
  const advDrawer = $("drawer-advanced");
  // Try both .open property and removeAttribute for compatibility
  if (classifDrawer) {
    if (typeof classifDrawer.open !== "undefined") classifDrawer.open = false;
    classifDrawer.removeAttribute("open");
  }
  if (advDrawer) {
    if (typeof advDrawer.open !== "undefined") advDrawer.open = false;
    advDrawer.removeAttribute("open");
  }

  // reset advanced UI
  [exCat, exSubcat, exPgroup, exSgroup].forEach((sel) => {
    if (!sel) return;
    Array.from(sel.options).forEach((o) => (o.selected = false));
  });
  [mosIkEn, mosOkEn, mosOvEn].forEach((el) => el && (el.checked = false));
  [mosIkOp, mosOkOp, mosOvOp].forEach((el) => el && (el.value = "gt"));
  [mosIkV1, mosOkV1, mosOvV1, mosIkV2, mosOkV2, mosOvV2].forEach(
    (el) => el && (el.value = "")
  );
  [mosIkNN, mosOkNN, mosOvNN].forEach((el) => el && (el.checked = false));
  advCount.style.display = "none";

  // reset state bits
  Object.assign(state, {
    pack_size: "",
    uom: "",
    category_id: "",
    sub_category_id: "",
    product_group_id: "",
    sub_group_id: "",
    // quick already reset above
    ex: { cats: [], subcats: [], pgroups: [], sgroups: [] },
    mos: {
      ik: { en: false, op: "gt", v1: "", v2: "", notNull: false },
      ok: { en: false, op: "gt", v1: "", v2: "", notNull: false },
      ov: { en: false, op: "gt", v1: "", v2: "", notNull: false },
    },
  });

  state.quick = { mosLt3: false, raso: false };
  setChip(elQfMosLt3, false);
  setChip(elQfRaso, false);

  page = 1;
  runQuery();
}
