/***************************************************************************
 * stock-checker.js — SASV Stock Checker (Primary + Quick + Drawers)
 * Drop-in, refactored & robust (Electron + PWA)
 ***************************************************************************/
import { supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";
/* global TomSelect */

// ─────────────────────────── Config (adjust paths if needed) ───────────────────────────
const PDF_LOAD_MODE = "auto"; // "auto" | "umd" | "esm"
const PDF_UMD_PATHS = {
  jsPDF: "/libs/jspdf.umd.min.js",
  autoTable: "/libs/jspdf.plugin.autotable.min.js",
};
const PDF_ESM_PATHS = {
  jsPDF: "/libs/jspdf.es.min.js",
  autoTable: "/libs/jspdf-autotable.es.js",
};
let __pdfExporting = false; // reentrancy guard for exportCoveragePDF

// ────────────── Utility functions ──────────────
function onReady(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  } else fn();
}
function $(id) {
  return document.getElementById(id);
}
function setMsg(msg) {
  const el = $("sc-msg");
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

// ────────────── jsPDF / autoTable loader & guards ──────────────
function ensurePdfReady() {
  const hasJsPDF = !!(window.jspdf && window.jspdf.jsPDF);
  const hasAutoV2 = !!(window.jspdf && window.jspdf.autoTable);
  const hasAutoV3 = !!window.jspdf?.jsPDF?.API?.autoTable;
  const ok = hasJsPDF && (hasAutoV2 || hasAutoV3);
  if (!ok) setMsg("PDF engine not loaded yet. Please try again in a second.");
  return ok;
}
function runAutoTable(doc, opts) {
  if (typeof doc.autoTable === "function") {
    doc.autoTable(opts); // v3 style on doc
  } else if (typeof window.jspdf?.autoTable === "function") {
    window.jspdf.autoTable(doc, opts); // v2 UMD style
  } else {
    throw new Error("autoTable plugin not found");
  }
}
let __pdfLoading = null;
async function loadScriptUMD(src) {
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.defer = true;
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error("Failed to load script: " + src));
    document.head.appendChild(s);
  });
}
async function loadPdfEngine() {
  if (ensurePdfReady()) return;
  if (__pdfLoading) {
    await __pdfLoading;
    return;
  }
  __pdfLoading = (async () => {
    try {
      if (PDF_LOAD_MODE === "umd" || PDF_LOAD_MODE === "auto") {
        await loadScriptUMD(PDF_UMD_PATHS.jsPDF);
        await loadScriptUMD(PDF_UMD_PATHS.autoTable);
      }
      // If still not ready (or forced ESM), try ESM paths
      if (
        !ensurePdfReady() &&
        (PDF_LOAD_MODE === "esm" || PDF_LOAD_MODE === "auto")
      ) {
        const jspdfMod = await import(/* @vite-ignore */ PDF_ESM_PATHS.jsPDF);
        await import(/* @vite-ignore */ PDF_ESM_PATHS.autoTable);
        if (!window.jspdf) window.jspdf = {};
        window.jspdf.jsPDF = jspdfMod.jsPDF;
      }
    } finally {
      // no-op
    }
  })();
  await __pdfLoading;
}

// ---- Quick-chip helpers ----
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
  if (stateKey === "mosLt3") state.quick.mosLt3 = next;
  if (stateKey === "raso") state.quick.raso = next;
  page = 1;
  runQuery();
}

// Use names directly for filtering (mirrors SQL)
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

/* ───────────────────── DOM refs ───────────────────── */
let elItemSel, elPackSize, elUOM;
let drawerCat, drawerSubcat, drawerPgroup, drawerSgroup;

let elExport, elExportPDF, elHome, elClear;
let elCount, elUpdated, elPrev, elNext, elPage;
let elTable, elBody;

let elQfMosLt3, elQfRaso;

// Advanced drawer controls
let exCat, exSubcat, exPgroup, exSgroup;

let mosIkEn, mosIkOp, mosIkV1, mosIkV2, mosIkNN;
let mosKkdEn, mosKkdOp, mosKkdV1, mosKkdV2, mosKkdNN;
let mosOkEn, mosOkOp, mosOkV1, mosOkV2, mosOkNN;
let mosOvEn, mosOvOp, mosOvV1, mosOvV2, mosOvNN;

let advApply, advClear, advCount;

/* ─────────────────────────── State ─────────────────────────── */
const PAGE_SIZE = 50;
const VISIBLE_COLS = 13;
let page = 1;

let selectedProductId = "";

const state = {
  pack_size: "",
  uom: "",
  quick: { mosLt3: false, raso: false },
  category_id: "",
  sub_category_id: "",
  product_group_id: "",
  sub_group_id: "",
  ex: { cats: [], subcats: [], pgroups: [], sgroups: [] },
  mos: {
    ik: { en: false, op: "gt", v1: "", v2: "", notNull: false },
    kkd: { en: false, op: "gt", v1: "", v2: "", notNull: false },
    ok: { en: false, op: "gt", v1: "", v2: "", notNull: false },
    ov: { en: false, op: "gt", v1: "", v2: "", notNull: false },
  },
};

let __advExInitDone = false;

/* ─────────────────────────── Init ─────────────────────────── */
onReady(init);

async function init() {
  try {
    await loadPdfEngine();

    // 0) Grab DOM refs
    elItemSel = $("sc-item");
    elPackSize = $("sc-packsize");
    elUOM = $("sc-uom");

    drawerCat = $("drawer-cat");
    drawerSubcat = $("drawer-subcat");
    drawerPgroup = $("drawer-pgroup");
    drawerSgroup = $("drawer-sgroup");

    elExport = $("sc-export");
    elExportPDF = $("sc-export-pdf");
    elHome = $("homeBtn");
    elClear = $("sc-clear");

    elCount = $("sc-count");
    elUpdated = $("sc-updated");
    elPrev = $("sc-prev");
    elNext = $("sc-next");
    elPage = $("sc-page");

    elTable = $("sc-table");
    elBody = $("sc-body");

    elQfMosLt3 = $("qf-moslt3");
    elQfRaso = $("qf-raso");

    // Advanced
    exCat = $("ex-cat");
    exSubcat = $("ex-subcat");
    exPgroup = $("ex-pgroup");
    exSgroup = $("ex-sgroup");

    mosIkEn = $("mosik-en");
    mosIkOp = $("mosik-op");
    mosIkV1 = $("mosik-v1");
    mosIkV2 = $("mosik-v2");
    mosIkNN = $("mosik-nnull");

    mosKkdEn = $("moskkd-en");
    mosKkdOp = $("moskkd-op");
    mosKkdV1 = $("moskkd-v1");
    mosKkdV2 = $("moskkd-v2");
    mosKkdNN = $("moskkd-nnull");

    mosOkEn = $("mosok-en");
    mosOkOp = $("mosok-op");
    mosOkV1 = $("mosok-v1");
    mosOkV2 = $("mosok-v2");
    mosOkNN = $("mosok-nnull");

    mosOvEn = $("mosov-en");
    mosOvOp = $("mosov-op");
    mosOvV1 = $("mosov-v1");
    mosOvV2 = $("mosov-v2");
    mosOvNN = $("mosov-nnull");

    advApply = $("adv-apply");
    advClear = $("adv-clear");
    advCount = $("adv-count");

    // Wire export buttons early
    elExport && elExport.addEventListener("click", exportCSV);
    elExportPDF && elExportPDF.addEventListener("click", exportCoveragePDF);

    // Pagination
    elPrev &&
      elPrev.addEventListener("click", () => {
        if (page > 1) {
          page--;
          runQuery();
        }
      });
    elNext &&
      elNext.addEventListener("click", () => {
        page++;
        runQuery();
      });

    // Navigation
    elHome && elHome.addEventListener("click", () => Platform.goHome());
    elClear && elClear.addEventListener("click", clearAll);

    // Primary filters
    if (elPackSize) {
      elPackSize.addEventListener("input", () => {
        state.pack_size = (elPackSize.value || "").trim();
        autoFillUOM();
        page = 1;
        runQuery();
      });
    }

    if (elQfMosLt3) {
      elQfMosLt3.addEventListener("click", () =>
        toggleChip(elQfMosLt3, "mosLt3")
      );
      setChip(elQfMosLt3, state.quick.mosLt3 === true);
    }
    if (elQfRaso) {
      elQfRaso.addEventListener("click", () => toggleChip(elQfRaso, "raso"));
      setChip(elQfRaso, state.quick.raso === true);
    }

    wireClassificationFilters();
    await populateDrawerClassificationFilters();
    await populateAdvancedExclusions();
    initTomSelect();
    wireAdvanced();

    updateStockSnapshotLabel();
    await runQuery();
  } catch (err) {
    console.error(err);
    setMsg(err.message || String(err));
  }
}

/* ───────────────────── Tom Select (Item) ───────────────────── */
function initTomSelect() {
  if (!elItemSel || elItemSel.tomselect) return;

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
      if (value && document.activeElement !== elPackSize) {
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

  const resetBelow = (level) => {
    if (level <= 1) {
      state.sub_category_id = "";
      drawerSubcat.value = "";
    }
    if (level <= 2) {
      state.product_group_id = "";
      drawerPgroup.value = "";
    }
    if (level <= 3) {
      state.sub_group_id = "";
      drawerSgroup.value = "";
    }
  };

  drawerCat.addEventListener("change", () => {
    state.category_id = drawerCat.value || "";
    resetBelow(1);
    page = 1;
    runQuery();
  });
  drawerSubcat.addEventListener("change", () => {
    state.sub_category_id = drawerSubcat.value || "";
    resetBelow(2);
    page = 1;
    runQuery();
  });
  drawerPgroup.addEventListener("change", () => {
    state.product_group_id = drawerPgroup.value || "";
    resetBelow(3);
    page = 1;
    runQuery();
  });
  drawerSgroup.addEventListener("change", () => {
    state.sub_group_id = drawerSgroup.value || "";
    page = 1;
    runQuery();
  });
}

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
        .select("id, subcategory_name")
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
        .select("id, group_name")
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
      if (prev.has(val)) opt.selected = true;
      select.appendChild(opt);
    });
  };

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

  exCat.onchange = async () => {
    disable([exSubcat, exPgroup, exSgroup], true);
    const subs = await loadSubcats(getSel(exCat));
    fillMulti(exSubcat, subs, "id", "subcategory_name");
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
  wireBetween(mosKkdOp, mosKkdV2);
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

      [mosIkEn, mosOkEn, mosOvEn, mosKkdEn].forEach(
        (el) => el && (el.checked = false)
      );
      [mosIkOp, mosOkOp, mosOvOp, mosKkdOp].forEach(
        (el) => el && (el.value = "gt")
      );
      [
        mosIkV1,
        mosOkV1,
        mosOvV1,
        mosIkV2,
        mosOkV2,
        mosOvV2,
        mosKkdV1,
        mosKkdV2,
      ].forEach((el) => el && (el.value = ""));
      [mosIkNN, mosOkNN, mosOvNN, mosKkdNN].forEach(
        (el) => el && (el.checked = false)
      );

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
    const op = opEl?.value ?? "gt";
    const v1 = v1El?.value ?? "";
    const v2 = v2El?.value ?? "";
    const en = v1 !== "" || (op === "between" && v2 !== "");
    return { en, op, v1, v2, notNull: !!nnEl?.checked };
  };

  state.mos.ik = getMosRule(mosIkOp, mosIkV1, mosIkV2, mosIkNN);
  state.mos.kkd = getMosRule(mosKkdOp, mosKkdV1, mosKkdV2, mosKkdNN);
  state.mos.ok = getMosRule(mosOkOp, mosOkV1, mosOkV2, mosOkNN);
  state.mos.ov = getMosRule(mosOvOp, mosOvV1, mosOvV2, mosOvNN);
}

function countAdvancedActive() {
  let c = 0;
  c += state.ex.cats.length ? 1 : 0;
  c += state.ex.subcats.length ? 1 : 0;
  c += state.ex.pgroups.length ? 1 : 0;
  c += state.ex.sgroups.length ? 1 : 0;
  ["ik", "kkd", "ok", "ov"].forEach((k) => {
    if (state.mos[k].en) c++;
  });
  return c;
}

/* ─────────────────── Auto-fill UOM ─────────────────── */
async function autoFillUOM() {
  if (elUOM) elUOM.textContent = "—";
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
    if (elUOM) elUOM.textContent = uom || "—";
    state.uom = uom;
  }
}

/* ───────────────────── Query ───────────────────── */
async function runQuery() {
  try {
    setMsg("");
    if (elBody)
      elBody.innerHTML = `<tr><td colspan="${VISIBLE_COLS}">Loading…</td></tr>`;

    let q = supabase.from("v_stock_checker").select("*", { count: "exact" });

    // Primary
    if (selectedProductId) q = q.eq("product_id", selectedProductId);
    if (state.pack_size) q = q.eq("pack_size", state.pack_size);
    if (state.uom) q = q.eq("uom", state.uom);

    // Quick filters
    if (state.quick.mosLt3) q = q.lt("mos_overall", 3);
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
      if (!rule || !rule.en) return;
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
    applyMos("mos_kkd", state.mos.kkd);
    applyMos("mos_ok", state.mos.ok);
    applyMos("mos_overall", state.mos.ov);

    // Sort
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

    if (elTable && elTable.parentElement) {
      elTable.parentElement.scrollTop = 0;
    }

    const total = count ?? 0;
    const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
    page = clamp(page, 1, maxPage);
    if (elCount) elCount.textContent = `${fmtInt(total)} rows`;
    if (elPage) elPage.textContent = `Page ${page} / ${maxPage}`;
    if (elPrev) elPrev.disabled = page <= 1;
    if (elNext) elNext.disabled = page >= maxPage;

    if (!data || data.length === 0) {
      elBody.innerHTML = `<tr><td colspan="${VISIBLE_COLS}">No rows found for the selected filters.</td></tr>`;
    }
  } catch (err) {
    console.error(err);
    setMsg(err.message || String(err));
    if (elBody)
      elBody.innerHTML = `<tr><td colspan="${VISIBLE_COLS}">Error loading data.</td></tr>`;
  }
}

/* ───────────────────── Render ───────────────────── */
function renderRows(rows) {
  if (!elBody) return;
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
      <td style="text-align:center">${fmtInt(r.forecast_kkd)}</td>
      <td style="text-align:center">${fmtInt(r.forecast_ok)}</td>
      <td style="text-align:center">${fmt3(r.mos_ik)}</td>
      <td style="text-align:center">${fmt3(r.mos_kkd)}</td>
      <td style="text-align:center">${fmt3(r.mos_ok)}</td>
      <td style="text-align:center">${fmt3(r.mos_overall)}</td>
    </tr>`
    )
    .join("");

  // iOS-friendly row selection
  Array.from(elBody.querySelectorAll("tr")).forEach((tr) => {
    function selectRowHandler(e) {
      Array.from(elBody.querySelectorAll("tr.selected-row")).forEach((row) =>
        row.classList.remove("selected-row")
      );
      let targetTr = tr;
      if (e && e.target && e.target.tagName === "TD") {
        targetTr = e.target.parentElement;
      }
      targetTr.classList.add("selected-row");
    }
    tr.addEventListener("click", selectRowHandler, { passive: true });
    tr.addEventListener("touchstart", selectRowHandler, { passive: true });
    tr.addEventListener("touchend", selectRowHandler, { passive: true });
    Array.from(tr.children).forEach((td) => {
      if (td.tagName === "TD") {
        td.addEventListener("touchstart", selectRowHandler, { passive: true });
        td.addEventListener("touchend", selectRowHandler, { passive: true });
      }
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

    // Quick
    if (state.quick.mosLt3) q = q.lt("mos_overall", 3);
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
      if (!rule?.en) return;
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
    applyMos("mos_kkd", state.mos.kkd);
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
      "Forecast KKD",
      "Forecast OK",
      "MOS IK",
      "MOS KKD",
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
          r.forecast_kkd,
          r.forecast_ok,
          r.mos_ik,
          r.mos_kkd,
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

/* ───────────────────── Export Coverage PDF (page break at 'SIDDHA') ───────────────────── */
async function exportCoveragePDF() {
  if (__pdfExporting) return;
  __pdfExporting = true;
  const btn = $("sc-export-pdf");
  if (btn) btn.disabled = true;

  try {
    setMsg("");
    await loadPdfEngine();
    if (!ensurePdfReady()) return;

    // 1) FETCH DATA
    const sel =
      "category_name,product_group_name,sub_group_name," +
      "item,pack_size," +
      "stock_ik,forecast_ik,mos_ik," +
      "stock_kkd,forecast_kkd,mos_kkd," +
      "stock_ok,forecast_ok,mos_ok," +
      "shade_flag";

    const { data: rows, error } = await supabase
      .from("v_stock_checker")
      .select(sel)
      .order("category_name")
      .order("product_group_name")
      .order("sub_group_name")
      .order("item")
      .order("pack_size")
      .limit(20000);

    if (error) throw error;
    const records = (rows || []).filter((r) => r && r.item);

    // 2) CONSTANTS / HELPERS
    const HEAD = [
      "SN",
      "ITEM PACK",
      "STOCK\nIK",
      "DEMAND\nIK",
      "MOS\nIK",
      "STOCK\nKKD",
      "DEMAND\nKKD",
      "MOS\nKKD",
      "STOCK\nOK",
      "DEMAND\nOK",
      "MOS\nOK",
    ];
    const I = (v) => (v == null ? "" : Number(v).toFixed(0));
    const M = (v) => (v == null ? "" : Number(v).toFixed(2));
    const itemPack = (r) =>
      `${(r.item || "").trim()}_${String(r.pack_size ?? "").trim()}`;
    const isSiddha = (cat) =>
      String(cat || "")
        .trim()
        .toUpperCase() === "SIDDHA";

    // Build one unified body creator so both tables look the same.
    function buildBody(recs) {
      const body = [];
      let prevCat = null;
      let prevSub = null;
      let sn = 0;

      for (const r of recs) {
        const cat = r.category_name || "";
        const sub = r.sub_group_name || "";

        // Category header, also resets SN
        if (cat !== prevCat) {
          body.push([{ content: String(cat).toUpperCase(), _h: "cat" }]);
          prevCat = cat;
          prevSub = null;
          sn = 0;
        }

        // Sub-group header
        if (sub !== prevSub) {
          body.push([{ content: sub, _h: "sub" }]);
          prevSub = sub;
        }

        const shade = r.shade_flag === true;
        body.push([
          { content: ++sn, __shade: shade },
          { content: itemPack(r), __shade: shade },
          I(r.stock_ik),
          I(r.forecast_ik),
          M(r.mos_ik),
          I(r.stock_kkd),
          I(r.forecast_kkd),
          M(r.mos_kkd),
          I(r.stock_ok),
          I(r.forecast_ok),
          M(r.mos_ok),
        ]);
      }
      return body;
    }

    // 3) SPLIT at first 'SIDDHA'
    let splitIdx = records.findIndex((r) => isSiddha(r.category_name));
    if (splitIdx < 0) splitIdx = records.length; // no SIDDHA → single table

    const partA = records.slice(0, splitIdx); // before SIDDHA
    const partB = records.slice(splitIdx); // SIDDHA and after

    const doc = new window.jspdf.jsPDF({ unit: "pt", format: "a4" });
    const margin = { l: 36, r: 36, t: 56, b: 48 };
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const TITLE = "STOCK COVERAGE REPORT";
    const ORG = "Santhigiri Ayurveda Siddha Vaidyasala";
    const today = new Date().toLocaleDateString("en-GB");

    const drawHeaderFooter = () => {
      // header
      doc.setFont("helvetica", "bold").setFontSize(10);
      doc.text(TITLE, margin.l, margin.t - 26, { baseline: "bottom" });
      doc.setFont("helvetica", "normal");
      doc.text(today, pageW - margin.r, margin.t - 26, {
        align: "right",
        baseline: "bottom",
      });

      // footer
      const y = pageH - 16;
      doc.text(ORG, margin.l, y, { baseline: "bottom" });
      doc.text(
        `Page ${doc.internal.getCurrentPageInfo().pageNumber}`,
        pageW - margin.r,
        y,
        { align: "right", baseline: "bottom" }
      );
    };

    const W_SN = 24;
    const W_PACK = 150;
    const columnStyles = {
      0: { cellWidth: W_SN, halign: "center" },
      1: { cellWidth: W_PACK, halign: "left", overflow: "linebreak" },
    };

    const didParseCell = ({ section, row, cell }) => {
      if (section !== "body" || !row || !cell) return;

      // Expand category/sub headers across all columns
      if (
        Array.isArray(row.raw) &&
        row.raw.length === 1 &&
        row.raw[0] &&
        row.raw[0]._h
      ) {
        cell.colSpan = HEAD.length;
        cell.styles.fontStyle = "bold";
        cell.styles.halign = "left";
        cell.styles.fillColor = [255, 255, 255];
        return;
      }

      // Shading for data rows (marked in first two cells)
      const shaded =
        Array.isArray(row.raw) &&
        ((row.raw[0] && row.raw[0].__shade === true) ||
          (row.raw[1] && row.raw[1].__shade === true));
      if (shaded) cell.styles.fillColor = [235, 235, 235];
    };

    function renderTable(body) {
      runAutoTable(doc, {
        head: [HEAD],
        body,
        margin,
        startY: margin.t + 2,
        tableWidth: "auto",
        theme: "grid",
        styles: {
          fontSize: 8.5,
          halign: "center",
          valign: "middle",
          lineColor: [0, 0, 0],
          lineWidth: 0.5,
          textColor: [0, 0, 0],
          cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
          overflow: "visible",
        },
        headStyles: {
          fontStyle: "bold",
          fontSize: 7.5,
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.5,
          overflow: "linebreak",
        },
        bodyStyles: { fillColor: [255, 255, 255] },
        columnStyles,
        showHead: "everyPage",
        rowPageBreak: "avoid",
        didParseCell,
        didDrawPage: drawHeaderFooter,
      });
    }

    // 4) RENDER
    if (partA.length > 0) {
      renderTable(buildBody(partA));
    }

    if (partB.length > 0) {
      if (partA.length > 0) doc.addPage(); // force new page exactly at SIDDHA
      renderTable(buildBody(partB));
    }

    // 5) SAVE
    doc.save(
      `Stock_Coverage_Report_${new Date().toISOString().slice(0, 10)}.pdf`
    );
  } catch (err) {
    console.error(err);
    setMsg("PDF export failed: " + (err.message || String(err)));
  } finally {
    __pdfExporting = false;
    if (btn) btn.disabled = false;
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
      elUpdated && (elUpdated.textContent = `Last stock snapshot: ${txt}`);
    } else {
      elUpdated && (elUpdated.textContent = "Last stock snapshot: —");
    }
  } catch {
    elUpdated && (elUpdated.textContent = "Last stock snapshot: —");
  }
}

/* ────────────── CLEAR (for PWA HOME) ────────────── */
function clearAll() {
  const ts = elItemSel && elItemSel.tomselect;
  ts?.clear();
  selectedProductId = "";

  if (elPackSize) elPackSize.value = "";
  if (elUOM) elUOM.textContent = "";

  if (drawerCat) drawerCat.value = "";
  if (drawerSubcat) drawerSubcat.value = "";
  if (drawerPgroup) drawerPgroup.value = "";
  if (drawerSgroup) drawerSgroup.value = "";

  setChip(elQfMosLt3, false);
  setChip(elQfRaso, false);
  state.quick = { mosLt3: false, raso: false };

  const classifDrawer = $("drawer-classification");
  const advDrawer = $("drawer-advanced");
  if (classifDrawer) {
    if (typeof classifDrawer.open !== "undefined") classifDrawer.open = false;
    classifDrawer.removeAttribute("open");
  }
  if (advDrawer) {
    if (typeof advDrawer.open !== "undefined") advDrawer.open = false;
    advDrawer.removeAttribute("open");
  }

  [exCat, exSubcat, exPgroup, exSgroup].forEach((sel) => {
    if (!sel) return;
    Array.from(sel.options).forEach((o) => (o.selected = false));
  });
  [mosIkEn, mosOkEn, mosOvEn, mosKkdEn].forEach(
    (el) => el && (el.checked = false)
  );
  [mosIkOp, mosOkOp, mosOvOp, mosKkdOp].forEach(
    (el) => el && (el.value = "gt")
  );
  [
    mosIkV1,
    mosOkV1,
    mosOvV1,
    mosIkV2,
    mosOkV2,
    mosOvV2,
    mosKkdV1,
    mosKkdV2,
  ].forEach((el) => el && (el.value = ""));
  [mosIkNN, mosOkNN, mosOvNN, mosKkdNN].forEach(
    (el) => el && (el.checked = false)
  );
  if (advCount) advCount.style.display = "none";

  Object.assign(state, {
    pack_size: "",
    uom: "",
    category_id: "",
    sub_category_id: "",
    product_group_id: "",
    sub_group_id: "",
    ex: { cats: [], subcats: [], pgroups: [], sgroups: [] },
    mos: {
      ik: { en: false, op: "gt", v1: "", v2: "", notNull: false },
      kkd: { en: false, op: "gt", v1: "", v2: "", notNull: false },
      ok: { en: false, op: "gt", v1: "", v2: "", notNull: false },
      ov: { en: false, op: "gt", v1: "", v2: "", notNull: false },
    },
    quick: { mosLt3: false, raso: false },
  });

  setChip(elQfMosLt3, false);
  setChip(elQfRaso, false);

  page = 1;
  runQuery();
}
