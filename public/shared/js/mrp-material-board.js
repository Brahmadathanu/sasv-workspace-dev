// Lightweight UI glue for the shared MRP board
// - Implements tabs, filter <-> querystring sync, and placeholder table rendering
// - Data loading remains disabled (Load button tooltip: "Coming soon")

function activateTab(mode) {
  // mode may be a string or an array of mode keys
  const tabs = document.querySelectorAll("#boardTabs .tab");
  const modes = Array.isArray(mode) ? mode : [mode];
  tabs.forEach((t) => {
    const m = t.dataset.mode || "all";
    const active = modes.includes(m);
    t.classList.toggle("active", active);
    t.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

// setTabActiveSingle removed — use `activateTab` or `setTabRefinerDot`.

function setTabRefinerDot(mode, enabled) {
  const tab = document.querySelector(`#boardTabs .tab[data-mode="${mode}"]`);
  if (!tab) return;
  tab.classList.toggle("refiner-dot", !!enabled);
  // do not change aria-pressed for refiner dots; they are a secondary indicator
}

function clearAllRefinerDots() {
  document.querySelectorAll(`#boardTabs .tab.refiner-dot`).forEach((t) => {
    t.classList.remove("refiner-dot");
  });
}

// Set the active view tab (Summary / Exceptions) and update aria state
function setActiveView(view) {
  document.querySelectorAll("#viewTabs .subtab").forEach((b) => {
    const is = b.dataset.view === view;
    b.classList.toggle("active", is);
    b.setAttribute("aria-pressed", is ? "true" : "false");
  });
  try {
    updateMasterTabMuting();
  } catch {
    void 0;
  }
  // switchView is defined at top-level to handle exception-specific semantics.
}

// switchView focuses on exception-specific semantics. UI activation
// (which tab appears active) is handled by `setActiveView` to avoid
// duplicated/contradictory code paths that could leave multiple tabs
// marked active.
function switchView(view) {
  if (DEBUG)
    console.debug(
      "switchView() called with",
      view,
      "current viewMode=",
      viewMode
    );
  if (view === viewMode) {
    // still ensure the active tab class is correct
    setActiveView(view);
    return;
  }

  if (view === "exceptions") {
    // Enter Exceptions master view: do not mutate checkboxes. Keep a
    // clean master list by resetting mode/selectedModes.
    viewMode = "exceptions";
    state.mode = "all";
    state.selectedModes = [];
    // stagingFilters remain untouched to avoid surprising the user.
  } else {
    // Summary master view: restore to summary semantics without touching
    // user checkbox choices (they are preserved). Clear refiner dots.
    viewMode = "summary";
    state.mode = "all";
    state.selectedModes = [];
    clearAllRefinerDots();
  }
  // keep canonical state in sync (do not trigger rendering here)
  state.view = viewMode;
  if (DEBUG) console.debug("switchView: state.view set to", state.view);
  // update view hint
  try {
    const hint = document.getElementById("viewHint");
    if (hint) {
      hint.textContent =
        viewMode === "exceptions" ? "Showing exception rows" : "";
    }
  } catch {
    void 0;
  }
}

// legacy initBindings removed; `wireUp()` is the single event binder

export {};
import { supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

// Toggle to enable compact debug traces
const DEBUG = false;
// Governance debug traces
const DEBUG_GOV = false;

// Cache monthly stats keyed by horizon_start
const statsCache = {};
let lastMonthlyStats = null;

let allRows = [];
let filteredRows = [];
let matchedTotal = null; // total matching rows across all pages after client-side filters
let selectedRowId = null;
const DEFAULT_SORT_KEY = "material_kind";
const DEFAULT_SORT_DIR = "asc";
let sortKey = DEFAULT_SORT_KEY;
let sortDir = DEFAULT_SORT_DIR;
let viewMode = "summary"; // 'summary' or 'exceptions'
// _backupFilters removed; master views no longer auto-backup/restore

// unified UI state
const state = {
  horizon_start: "",
  material_type: "",
  mode: "all",
  view: "summary",
  q: "",
  stock_item_id: "",
  netpos: false,
  alloc: false,
  noplan: false,
  pni: false,
  over: false,
  // when in 'all' mode this array can hold multiple refinement modes
  selectedModes: [],
};

let lastLoadedHorizonStart = "";
// stagingFilters holds checkbox choices while the user is editing filters
// in the drawer; only when Apply is pressed do these get committed into
// the canonical `state` and cause the table to be re-filtered.
let stagingFilters = null;
// pagination state
let pageSize = 100;
let currentPage = 0; // zero-based
let totalCount = 0;

// Preserve the default checkbox filter values so Clear restores them.
const DEFAULT_CHECKBOX_FILTERS = {
  netpos: !!state.netpos,
  alloc: !!state.alloc,
  noplan: !!state.noplan,
  pni: !!state.pni,
  over: !!state.over,
};

function commitStagingToState() {
  stagingFilters = stagingFilters || {};
  state.netpos = !!stagingFilters.netpos;
  state.alloc = !!stagingFilters.alloc;
  state.noplan = !!stagingFilters.noplan;
  state.pni = !!stagingFilters.pni;
  state.over = !!stagingFilters.over;

  if (state.mode === "all") {
    const sel = [];
    if (state.netpos) sel.push("shortage");
    if (state.alloc) sel.push("unassigned");
    if (state.noplan) sel.push("no_plan");
    if (state.pni) sel.push("planned_not_issued");
    if (state.over) sel.push("over_issued");
    state.selectedModes = sel;
  } else {
    state.selectedModes = [];
  }
}

function readStateFromUrl() {
  if (DEBUG)
    console.debug("readStateFromUrl() called, current URL:", location.search);
  const q = Object.fromEntries(new URLSearchParams(location.search));
  if (DEBUG) console.debug("readStateFromUrl: parsed params:", q);

  state.horizon_start = q.horizon_start || "";
  state.material_type = q.material_type || "";
  state.mode = q.mode || "all";
  state.view = q.view || "summary";
  state.q = q.q || "";
  state.stock_item_id = q.stock_item_id || "";

  state.netpos = q.netpos === "1";
  state.alloc = q.alloc === "1";
  state.noplan = q.noplan === "1";
  state.pni = q.pni === "1";
  state.over = q.over === "1";

  if (DEBUG)
    console.debug("readStateFromUrl: updated state:", {
      netpos: state.netpos,
      alloc: state.alloc,
      noplan: state.noplan,
      pni: state.pni,
      over: state.over,
      view: state.view,
    });

  // selectedModes: comma-separated list of mode keys (only used when mode==='all')
  if (q.modes) {
    state.selectedModes = String(q.modes)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  } else {
    state.selectedModes = [];
  }
}

function writeStateToUrl(replace = false) {
  if (DEBUG)
    console.debug("writeStateToUrl() called with state:", {
      netpos: state.netpos,
      alloc: state.alloc,
      noplan: state.noplan,
      pni: state.pni,
      over: state.over,
      view: state.view,
    });
  if (DEBUG) console.debug("writeStateToUrl() stack trace:", new Error().stack);

  const p = new URLSearchParams();
  if (state.horizon_start) p.set("horizon_start", state.horizon_start);
  if (state.material_type) p.set("material_type", state.material_type);
  if (state.mode) p.set("mode", state.mode);
  if (state.view) p.set("view", state.view);
  if (state.q) p.set("q", state.q);
  if (state.stock_item_id) p.set("stock_item_id", state.stock_item_id);

  p.set("netpos", state.netpos ? "1" : "0");
  p.set("alloc", state.alloc ? "1" : "0");
  p.set("noplan", state.noplan ? "1" : "0");
  p.set("pni", state.pni ? "1" : "0");
  p.set("over", state.over ? "1" : "0");

  if (Array.isArray(state.selectedModes) && state.selectedModes.length)
    p.set("modes", state.selectedModes.join(","));

  const qs = "?" + p.toString();
  const newUrl = location.pathname + qs + location.hash;
  if (DEBUG) console.debug("writeStateToUrl: new URL will be:", newUrl);

  if (replace) history.replaceState({}, "", newUrl);
  else history.pushState({}, "", newUrl);

  if (DEBUG)
    console.debug("writeStateToUrl: URL after update:", location.search);
}

function applyStateToUI() {
  if (DEBUG) console.debug("applyStateToUI() called");
  // Month input uses YYYY-MM
  const m = document.getElementById("horizonMonth");
  if (m) m.value = state.horizon_start ? state.horizon_start.slice(0, 7) : "";

  const kind = document.getElementById("kindFilter");
  if (kind) {
    if (state.material_type === "RM") kind.value = "RM";
    else if (state.material_type === "PM" || state.material_type === "PLM")
      kind.value = "PM";
    else kind.value = "ALL";
  }

  const t = document.getElementById("textSearch");
  if (t) t.value = state.q || "";
  const net = document.getElementById("filterNetPositive");
  const a = document.getElementById("filterAllocationIssues");
  const n = document.getElementById("filterNoPlanButIssued");
  const pni = document.getElementById("filterPlannedButNotIssued");
  const o = document.getElementById("filterOverIssued");

  // If the drawer is open we should reflect staged checkbox choices
  // (so toggling a checkbox immediately shows checked/unchecked) and
  // avoid clobbering the user's in-drawer edits with canonical `state`.
  const drawer = document.getElementById("filterDrawer");
  const drawerOpen = drawer && drawer.getAttribute("aria-hidden") === "false";
  if (DEBUG)
    console.debug(
      "applyStateToUI: drawer state - element found:",
      !!drawer,
      "drawerOpen:",
      drawerOpen
    );

  if (drawerOpen && stagingFilters) {
    if (DEBUG)
      console.debug("applyStateToUI: drawer open, using stagingFilters");
    if (net) net.checked = !!stagingFilters.netpos;
    if (a) a.checked = !!stagingFilters.alloc;
    if (n) n.checked = !!stagingFilters.noplan;
    if (pni) pni.checked = !!stagingFilters.pni;
    if (o) o.checked = !!stagingFilters.over;
  } else {
    if (DEBUG)
      console.debug("applyStateToUI: drawer closed, using canonical state", {
        netpos: state.netpos,
        alloc: state.alloc,
        noplan: state.noplan,
        pni: state.pni,
        over: state.over,
      });
    if (net) net.checked = !!state.netpos;
    if (a) a.checked = !!state.alloc;
    if (n) n.checked = !!state.noplan;
    if (pni) pni.checked = !!state.pni;
    if (o) o.checked = !!state.over;
  }

  // Initialize stagingFilters to mirror canonical state so the drawer
  // edits are staged until the user clicks Apply.
  if (!stagingFilters) {
    stagingFilters = {
      netpos: !!state.netpos,
      alloc: !!state.alloc,
      noplan: !!state.noplan,
      pni: !!state.pni,
      over: !!state.over,
    };
  }

  // tabs
  if (state.mode === "all") {
    activateTab("all");
    // clear existing dots then set per selectedModes
    clearAllRefinerDots();
    if (state.view === "exceptions") {
      // In Exceptions master view, visually indicate all refiners across
      // mode tabs so users see which exception types are included.
      [
        "shortage",
        "unassigned",
        "approx",
        "no_plan",
        "planned_not_issued",
        "over_issued",
      ].forEach((m) => setTabRefinerDot(m, true));
    } else if (
      Array.isArray(state.selectedModes) &&
      state.selectedModes.length
    ) {
      state.selectedModes.forEach((m) => setTabRefinerDot(m, true));
    }
  } else {
    // not in all mode: show single active preset and clear any refiner dots
    activateTab(state.mode);
    clearAllRefinerDots();
  }
  // view tabs (do not trigger rendering here). If the canonical state
  // requests the Exceptions master view and we aren't already in that
  // internal viewMode, call `switchView` to apply exception semantics.
  if (state.view === "exceptions" && viewMode !== "exceptions") {
    switchView("exceptions");
  } else {
    setActiveView(state.view);
  }
  // Update view hint per semantics
  try {
    const hint = document.getElementById("viewHint");
    if (hint) {
      hint.textContent =
        state.view === "exceptions"
          ? "Only exception rows (unassigned/approx/no-plan/pni/over)"
          : "All rows, refine using filters";
    }
  } catch {
    void 0;
  }

  // Hide exception-specific checkboxes in Exceptions view to avoid confusing state
  [
    "filterAllocationIssues",
    "filterNoPlanButIssued",
    "filterPlannedButNotIssued",
    "filterOverIssued",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const lab = el.closest("label");
    // Always show exception checkboxes. Exceptions acts as a master view
    // (showing only rows with exception flags) while the checkboxes act as
    // additional refiners the user can toggle to narrow the exception set.
    if (lab) lab.style.display = "";
    else el.style.display = "";
  });

  renderStateBadge();
  // Ensure checkboxes reflect current mode (tick & disable as needed)
  try {
    syncModeToCheckboxes(state.mode || "all");
  } catch {
    void 0;
  }

  // ERP-style master tab behavior: determine which tab should be unmuted
  // based on whether current state matches pure Summary or pure Exceptions.
  // update muting and refiner-dot presentation consistently
  try {
    updateMasterTabMuting();
  } catch {
    void 0;
  }
}

// Update master view muting based on canonical state or staging filters
function updateMasterTabMuting(stats) {
  const viewTabs = document.querySelectorAll("#viewTabs .subtab");
  // If drawer open, use stagingFilters to determine 'pure' state
  const drawer = document.getElementById("filterDrawer");
  const drawerOpen = drawer && drawer.getAttribute("aria-hidden") === "false";

  const useStaging = drawerOpen && stagingFilters;

  const hasAnyStaging = stagingFilters
    ? Object.values(stagingFilters).some(Boolean)
    : false;

  // Determine pure Summary state (no refiners active)
  const isPureSummary = useStaging
    ? state.view === "summary" &&
      state.mode === "all" &&
      !hasAnyStaging &&
      (!Array.isArray(state.selectedModes) || state.selectedModes.length === 0)
    : state.view === "summary" &&
      state.mode === "all" &&
      (!Array.isArray(state.selectedModes) ||
        state.selectedModes.length === 0) &&
      !state.netpos &&
      !state.alloc &&
      !state.noplan &&
      !state.pni &&
      !state.over;

  // Determine governed defaults (if stats provided or cached)
  const statsForGov = stats || lastMonthlyStats || null;
  const governed = statsForGov
    ? applyGovernedExceptionsDefaults(statsForGov)
    : null;

  // Use staging or canonical values for comparison
  const check = useStaging ? stagingFilters || {} : state || {};

  let isPureExceptions = false;
  if (state.view === "exceptions" && state.mode === "all") {
    const noSelectedModes =
      !Array.isArray(state.selectedModes) || state.selectedModes.length === 0;
    if (governed) {
      const matchesGoverned = [
        "alloc",
        "noplan",
        "pni",
        "over",
        "netpos",
      ].every((k) => !!check[k] === !!governed.defaults[k]);
      isPureExceptions = noSelectedModes && matchesGoverned;
    } else {
      isPureExceptions = noSelectedModes;
    }
  }

  viewTabs.forEach((b) => {
    const view = b.dataset.view;
    let shouldMute = true;
    if (isPureSummary && view === "summary") shouldMute = false;
    else if (isPureExceptions && view === "exceptions") shouldMute = false;

    if (shouldMute) {
      b.classList.add("muted");
      b.style.opacity = "0.65";
      b.title = "Filters active — click to restore master view";
    } else {
      b.classList.remove("muted");
      b.style.opacity = "";
      b.title = b.getAttribute("data-tooltip") || "";
    }
  });
}

// Set checkbox states and disabled status according to a selected mode.
function syncModeToCheckboxes(mode) {
  // Skip checkbox sync when in exceptions view to preserve exception state
  if (state.view === "exceptions") {
    return;
  }

  const netEl = document.getElementById("filterNetPositive");
  const allocEl = document.getElementById("filterAllocationIssues");
  const noPlanEl = document.getElementById("filterNoPlanButIssued");
  const pniEl = document.getElementById("filterPlannedButNotIssued");
  const overEl = document.getElementById("filterOverIssued");

  // helper to clear all
  function clearAll() {
    state.netpos = false;
    state.alloc = false;
    state.noplan = false;
    state.pni = false;
    state.over = false;
  }

  if (mode === "all") {
    // In 'all' mode we allow multiple refiners. Keep any previously
    // selectedModes and reflect them on the checkbox UI.
    clearAll();
    const sel = Array.isArray(state.selectedModes) ? state.selectedModes : [];
    if (sel.includes("shortage")) state.netpos = true;
    if (sel.includes("unassigned") || sel.includes("approx"))
      state.alloc = true;
    if (sel.includes("no_plan")) state.noplan = true;
    if (sel.includes("planned_not_issued")) state.pni = true;
    if (sel.includes("over_issued")) state.over = true;

    // apply DOM checked state and ensure all checkboxes are enabled
    if (netEl) {
      netEl.checked = !!state.netpos;
      netEl.disabled = false;
    }
    if (allocEl) {
      allocEl.checked = !!state.alloc;
      allocEl.disabled = false;
    }
    if (noPlanEl) {
      noPlanEl.checked = !!state.noplan;
      noPlanEl.disabled = false;
    }
    if (pniEl) {
      pniEl.checked = !!state.pni;
      pniEl.disabled = false;
    }
    if (overEl) {
      overEl.checked = !!state.over;
      overEl.disabled = false;
    }
  } else {
    // start from cleared state
    clearAll();
    // map modes to checkbox
    if (mode === "shortage") state.netpos = true;
    if (mode === "unassigned" || mode === "approx") state.alloc = true;
    if (mode === "no_plan") state.noplan = true;
    if (mode === "planned_not_issued") state.pni = true;
    if (mode === "over_issued") state.over = true;

    // apply to DOM: set checked and disable others
    if (netEl) netEl.checked = !!state.netpos;
    if (allocEl) allocEl.checked = !!state.alloc;
    if (noPlanEl) noPlanEl.checked = !!state.noplan;
    if (pniEl) pniEl.checked = !!state.pni;
    if (overEl) overEl.checked = !!state.over;

    // determine the active checkbox element(s)
    const activeEls = [];
    if (state.netpos) activeEls.push(netEl);
    if (state.alloc) activeEls.push(allocEl);
    if (state.noplan) activeEls.push(noPlanEl);
    if (state.pni) activeEls.push(pniEl);
    if (state.over) activeEls.push(overEl);

    [netEl, allocEl, noPlanEl, pniEl, overEl].forEach((el) => {
      if (!el) return;
      // enabled only if in activeEls
      const shouldEnable = activeEls.includes(el);
      el.disabled = !shouldEnable;
    });
  }
}

function readStateFromUI() {
  if (DEBUG)
    console.debug(
      "readStateFromUI() called - reading checkbox states from DOM"
    );
  const m = document.getElementById("horizonMonth")?.value || "";
  state.horizon_start = m ? `${m}-01` : "";

  const kind = document.getElementById("kindFilter")?.value || "ALL";
  state.material_type = kind === "ALL" ? "" : kind;

  state.q = (document.getElementById("textSearch")?.value || "").trim();

  const netpos = !!document.getElementById("filterNetPositive")?.checked;
  const alloc = !!document.getElementById("filterAllocationIssues")?.checked;
  const noplan = !!document.getElementById("filterNoPlanButIssued")?.checked;
  const pni = !!document.getElementById("filterPlannedButNotIssued")?.checked;
  const over = !!document.getElementById("filterOverIssued")?.checked;

  if (DEBUG)
    console.debug("readStateFromUI: checkbox values read from DOM:", {
      netpos,
      alloc,
      noplan,
      pni,
      over,
    });

  state.netpos = netpos;
  state.alloc = alloc;
  state.noplan = noplan;
  state.pni = pni;
  state.over = over;

  if (DEBUG)
    console.debug("readStateFromUI: updated canonical state to:", {
      netpos: state.netpos,
      alloc: state.alloc,
      noplan: state.noplan,
      pni: state.pni,
      over: state.over,
    });

  // when in All mode, build selectedModes from checked boxes so
  // keyboard/URL-driven flows stay consistent
  state.selectedModes = state.selectedModes || [];
  if (state.mode === "all") {
    const sel = [];
    if (state.netpos) sel.push("shortage");
    if (state.alloc) sel.push("unassigned");
    if (state.noplan) sel.push("no_plan");
    if (state.pni) sel.push("planned_not_issued");
    if (state.over) sel.push("over_issued");
    state.selectedModes = sel;
  } else {
    // if using a preset mode, ensure selectedModes is empty
    state.selectedModes = [];
  }
}

async function onStateChanged({ reload = false, replace = false } = {}) {
  if (DEBUG)
    console.debug("onStateChanged() called with options:", { reload, replace });
  if (DEBUG) console.debug("onStateChanged() stack trace:", new Error().stack);
  // read UI into state (preserve state.mode and state.view which may be set directly)
  readStateFromUI();
  writeStateToUrl(replace);

  // Defer actual rendering work to the next animation frame so any
  // immediate visual feedback (e.g. active class set on pointerdown)
  // can paint first. For reload we still call the async loader but
  // from inside rAF so the browser isn't blocked before paint.
  if (reload) {
    requestAnimationFrame(() => {
      // fire-and-forget the async loader; callers generally don't rely on
      // the returned promise here. Ensure errors are logged.
      loadAndRender().catch((err) => console.error(err));
    });
  } else {
    requestAnimationFrame(() => applyFiltersAndRender());
  }
}

// Legacy exception functions removed - now using rowFlags() and MODE_PREDICATES

/**
 * Derive consistent row flags so filtering doesn't depend on view column presence
 */
function rowFlags(r) {
  const planned = Number(r.planned_total_qty) || 0;
  const issued = Number(r.issued_total_qty) || 0;
  const net = Number(r.net_requirement) || 0;

  const unassigned = !!r.has_unassigned_issues;
  const approx = !!r.allocation_approx_present;

  const noPlanButIssued =
    r.no_plan_but_issued != null
      ? !!r.no_plan_but_issued
      : planned <= 0 && issued > 0;

  const plannedNotIssued =
    r.planned_but_not_issued != null
      ? !!r.planned_but_not_issued
      : planned > 0 && issued <= 0;

  const overIssued =
    r.over_issued != null ? !!r.over_issued : planned > 0 && issued > planned;

  const shortage = net > 0;

  const anyException =
    unassigned || approx || noPlanButIssued || plannedNotIssued || overIssued;

  return {
    planned,
    issued,
    net,
    unassigned,
    approx,
    noPlanButIssued,
    plannedNotIssued,
    overIssued,
    shortage,
    anyException,
  };
}

/**
 * MRP Material Board semantics:
 * - view=summary: show all rows (unless mode/filters narrow it)
 * - view=exceptions: only rows with any exception flag true
 * - mode tabs apply additional slicing
 * - netpos filter means net_requirement > 0
 */
const MODE_PREDICATES = {
  all: () => true,
  unassigned: (r, f) => f.unassigned,
  approx: (r, f) => f.approx,
  shortage: (r, f) => f.shortage,
  no_plan: (r, f) => f.noPlanButIssued,
  planned_not_issued: (r, f) => f.plannedNotIssued,
  over_issued: (r, f) => f.overIssued,
};

function formatNumber(n) {
  if (n === null || n === undefined) return "";
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function parseTopConsumers(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    return JSON.parse(val);
  } catch {
    return [];
  }
}

function getHorizonStartFromInput() {
  const el = document.getElementById("horizonMonth");
  const v = el.value; // YYYY-MM
  if (!v) {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}-01`;
  }
  return `${v}-01`;
}

async function fetchRows() {
  const horizonStart = state.horizon_start || getHorizonStartFromInput();
  const materialKind =
    state.material_type === "RM"
      ? "RM"
      : state.material_type === "PM"
      ? "PM"
      : "ALL";

  const p_page_index = currentPage;
  const p_page_size = pageSize;

  const args = {
    p_horizon_start: horizonStart,
    p_material_kind: materialKind,
    p_view: state.view || "summary",
    p_mode: state.mode || "all",
    p_modes:
      (state.mode || "all") === "all" &&
      Array.isArray(state.selectedModes) &&
      state.selectedModes.length
        ? state.selectedModes
        : null,
    p_netpos: !!state.netpos,
    p_alloc: !!state.alloc,
    p_noplan: !!state.noplan,
    p_pni: !!state.pni,
    p_over: !!state.over,
    p_q: (state.q || "").trim() ? (state.q || "").trim() : null,
    p_page_index,
    p_page_size,
  };

  try {
    const startTs = Date.now();
    if (DEBUG) {
      try {
        console.debug(
          "fetchRows: calling RPC mrp_material_overview_page with args:",
          args
        );
      } catch {
        void 0;
      }
    }
    const { data, error } = await supabase.rpc(
      "mrp_material_overview_page",
      args
    );
    const took = Date.now() - startTs;
    if (error) {
      console.error("fetchRows RPC error:", error);
      showToast(
        "Failed to load data: " + (error.message || String(error)),
        6000
      );
      allRows = [];
      totalCount = 0;
      matchedTotal = 0;
      return;
    }

    // Normalize payload: some environments return a single-element wrapper
    // or JSON strings. Coerce into { rows, total_count } shape.
    let payload = data;
    if (Array.isArray(payload) && payload.length === 1) payload = payload[0];
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch {
        // ignore parse errors
      }
    }

    let rows = [];
    if (payload && Array.isArray(payload.rows)) rows = payload.rows;
    else if (Array.isArray(payload)) rows = payload;
    else if (payload && typeof payload.rows === "string") {
      try {
        rows = JSON.parse(payload.rows);
      } catch {
        rows = [];
      }
    }

    totalCount = Number(payload?.total_count ?? 0) || 0;
    matchedTotal = totalCount;

    // Heuristic fallback: some governed defaults (p_pni/p_over) may be
    // too restrictive for certain months. If Exceptions view returned
    // zero rows while those flags are set, retry with them disabled so
    // users still see exception rows rather than an empty table.
    if (
      (state.view === "exceptions" || args.p_view === "exceptions") &&
      totalCount === 0 &&
      (args.p_pni === true || args.p_over === true)
    ) {
      try {
        if (DEBUG)
          console.info(
            "fetchRows: Exceptions returned 0 — retrying with p_pni/p_over disabled"
          );
        const retryArgs = { ...args, p_pni: false, p_over: false };
        const start2 = Date.now();
        const { data: data2, error: error2 } = await supabase.rpc(
          "mrp_material_overview_page",
          retryArgs
        );
        const took2 = Date.now() - start2;
        if (!error2) {
          let payload2 = data2;
          if (Array.isArray(payload2) && payload2.length === 1)
            payload2 = payload2[0];
          if (typeof payload2 === "string") {
            try {
              payload2 = JSON.parse(payload2);
            } catch (e) {
              if (DEBUG)
                console.debug("fetchRows: failed to parse payload2", e);
            }
          }
          const rows2 = Array.isArray(payload2?.rows)
            ? payload2.rows
            : Array.isArray(payload2)
            ? payload2
            : [];
          const total2 = Number(payload2?.total_count ?? 0) || 0;
          if (Array.isArray(rows2) && rows2.length > 0) {
            if (DEBUG)
              console.info("fetchRows: retry returned rows", {
                tookMs: took2,
                total2,
                sample: rows2.slice(0, 5),
              });
            rows = rows2;
            totalCount = total2;
            matchedTotal = totalCount;
          } else {
            if (DEBUG)
              console.info("fetchRows: retry also empty", {
                tookMs: took2,
                total2,
              });
          }
        } else {
          if (DEBUG) console.warn("fetchRows: retry RPC error", error2);
        }
      } catch (e) {
        if (DEBUG) console.warn("fetchRows: retry exception", e);
      }
    }

    if (DEBUG) {
      try {
        console.debug("fetchRows: normalized payload", {
          tookMs: took,
          horizonStart,
          pageSize,
          currentPage,
          totalCount,
          rowsSample: Array.isArray(rows) ? rows.slice(0, 5) : rows,
        });
      } catch {
        void 0;
      }
    }

    // If server returned zero rows for Exceptions view, log details to help diagnose
    if (
      (state.view === "exceptions" || args.p_view === "exceptions") &&
      Number(totalCount) === 0
    ) {
      try {
        // Stringify to ensure the console shows full objects in Electron
        let argsJson = "(unserializable)";
        try {
          argsJson = JSON.stringify(args, null, 2);
        } catch {
          argsJson = String(args);
        }
        let payloadJson = "[]";
        try {
          payloadJson = JSON.stringify(rows || [], null, 2);
        } catch {
          payloadJson = String(rows || []);
        }
        console.warn(
          "fetchRows: Exceptions RPC returned zero rows - args:\n" +
            argsJson +
            "\npayloadPreview:\n" +
            payloadJson +
            "\ntotalCount:" +
            totalCount
        );
      } catch {
        void 0;
      }
    }

    const normalized = (rows || []).map((r) => ({
      ...r,
      material_kind: r.material_kind || r.material_type || r.materialType || "",
    }));

    allRows = normalized;
    lastLoadedHorizonStart = horizonStart;

    console.info("mrp_material_overview_page ok", {
      tookMs: took,
      horizonStart,
      pageSize,
      currentPage,
      totalCount,
      rows: normalized.length,
      args,
    });
  } catch (err) {
    console.error("fetchRows RPC exception:", err);
    showToast("Failed to load data. See console for details.", 6000);
    allRows = [];
    totalCount = 0;
    matchedTotal = 0;
  }
}

// Fetch all rows from server for current server-side filters (no paging)
// fetchAllMatchingRows removed: server-side RPC paging provides authoritative counts

// Fetch monthly governance stats and cache them
async function fetchMonthlyStats(horizonStart) {
  try {
    const hs =
      horizonStart || state.horizon_start || getHorizonStartFromInput();
    if (!hs) return null;
    if (statsCache[hs]) {
      if (DEBUG_GOV) console.debug("fetchMonthlyStats: cache hit for", hs);
      lastMonthlyStats = statsCache[hs];
      return lastMonthlyStats;
    }

    const view = "v_mrp_material_monthly_stats";
    const { data, error } = await supabase
      .from(view)
      .select("*")
      .eq("horizon_start", hs);

    if (error) {
      if (DEBUG_GOV) console.debug("fetchMonthlyStats: server error", error);
      return null;
    }

    // Normalize rows by material kind (map PLM -> PM)
    const byKind = {};
    (data || []).forEach((r) => {
      const k = r.material_kind === "PLM" ? "PM" : r.material_kind || "PM";
      byKind[k] = r;
    });

    const rows = Object.values(byKind);
    const hasAnyPlanOverall = rows.some((r) => !!r.has_any_plan);
    const isNoPlanMonthOverall =
      rows.length > 0 &&
      rows.every(
        (r) =>
          !!r.is_no_plan_month ||
          (Number(r.planned_items) === 0 && Number(r.issued_items) > 0)
      );

    const normalized = {
      horizon_start: hs,
      byKind,
      hasAnyPlanOverall,
      isNoPlanMonthOverall,
    };

    statsCache[hs] = normalized;
    lastMonthlyStats = normalized;
    if (DEBUG_GOV) console.debug("fetchMonthlyStats: loaded", normalized);
    return normalized;
  } catch (err) {
    if (DEBUG_GOV) console.debug("fetchMonthlyStats: exception", err);
    return null;
  }
}

// Render a small governance banner explaining month-level signals
function renderGovernanceBanner(stats) {
  try {
    const el = document.getElementById("mrpGovernanceBanner");
    if (!el) return;
    if (!stats) {
      el.style.display = "none";
      return;
    }
    if (stats.isNoPlanMonthOverall) {
      el.style.display = "block";
      el.style.background = "var(--warning-bg, #fff4e5)";
      el.style.color = "var(--warning-fg, #7a4900)";
      el.style.padding = "8px 12px";
      el.style.borderRadius = "6px";
      el.textContent =
        "Planning not available for this month. Issues exist without plan; Exceptions view will naturally include most items.";
      if (DEBUG_GOV)
        console.debug("renderGovernanceBanner: no-plan month banner shown");
    } else {
      // Only show the warning banner; suppress neutral/info messages.
      el.style.display = "none";
    }
  } catch (e) {
    if (DEBUG_GOV) console.debug("renderGovernanceBanner: failed", e);
  }
}

// Compute governed defaults and disabled mask for Exceptions master view
function applyGovernedExceptionsDefaults(stats) {
  // defaults and disabled flags
  const defaults = {
    alloc: true,
    noplan: true,
    pni: false,
    over: false,
    netpos: false,
  };
  const disabled = {
    alloc: false,
    noplan: false,
    pni: false,
    over: false,
    netpos: false,
  };

  if (!stats) return { defaults, disabled };

  const kinds = Object.values(stats.byKind || {});
  const totals = kinds.reduce(
    (acc, k) => {
      acc.planned_items += Number(k.planned_items) || 0;
      acc.issued_items += Number(k.issued_items) || 0;
      acc.planned_not_issued_items += Number(k.planned_not_issued_items) || 0;
      acc.over_issued_items += Number(k.over_issued_items) || 0;
      acc.no_plan_but_issued_items += Number(k.no_plan_but_issued_items) || 0;
      return acc;
    },
    {
      planned_items: 0,
      issued_items: 0,
      planned_not_issued_items: 0,
      over_issued_items: 0,
      no_plan_but_issued_items: 0,
    }
  );

  if (stats.isNoPlanMonthOverall) {
    // In a no-plan month PNI/Over are meaningless by default
    defaults.alloc = true;
    defaults.noplan = true;
    defaults.pni = false;
    defaults.over = false;
    defaults.netpos = false;

    disabled.pni =
      totals.planned_items === 0 || totals.planned_not_issued_items === 0;
    disabled.over =
      totals.planned_items === 0 || totals.over_issued_items === 0;
    // noplan is meaningful in this scenario if there are no-plan items
    disabled.noplan = totals.no_plan_but_issued_items === 0;
  } else if (stats.hasAnyPlanOverall) {
    // Plan exists: enable most exception filters by default except shortage
    defaults.alloc = true;
    defaults.noplan = true;
    defaults.pni = true;
    defaults.over = true;
    defaults.netpos = false;

    disabled.pni = totals.planned_not_issued_items === 0;
    disabled.over = totals.over_issued_items === 0;
    disabled.noplan = totals.no_plan_but_issued_items === 0;
  }

  return { defaults, disabled };
}

// Apply disabled/tooltip state to checkbox elements
function applyDisabledCheckboxes(disabledMap) {
  try {
    const map = {
      pni: "filterPlannedButNotIssued",
      over: "filterOverIssued",
      noplan: "filterNoPlanButIssued",
      alloc: "filterAllocationIssues",
      netpos: "filterNetPositive",
    };
    Object.keys(map).forEach((k) => {
      const id = map[k];
      const el = document.getElementById(id);
      if (!el) return;
      const disabled = !!(disabledMap && disabledMap[k]);
      el.disabled = disabled;
      if (disabled) {
        const reason =
          k === "pni"
            ? "No planned-not-issued items for this month"
            : k === "over"
            ? "No over-issued items for this month"
            : k === "noplan"
            ? "No no-plan-but-issued items for this month"
            : "";
        if (reason) el.title = reason;
      } else {
        // restore tooltip from data-tooltip if present
        const attr = el.getAttribute("data-tooltip") || "";
        el.title = attr || "";
      }
    });
  } catch (e) {
    if (DEBUG_GOV) console.debug("applyDisabledCheckboxes failed", e);
  }
}

function showToast(msg, timeout = 5000) {
  try {
    let t = document.getElementById("mrpToast");
    if (!t) {
      t = document.createElement("div");
      t.id = "mrpToast";
      t.style.position = "fixed";
      t.style.right = "16px";
      t.style.bottom = "16px";
      t.style.padding = "10px 14px";
      t.style.borderRadius = "6px";
      t.style.background = "var(--panel-bg)";
      t.style.color = "var(--text-color)";
      t.style.boxShadow = "0 6px 18px rgba(0,0,0,0.08)";
      t.style.zIndex = 9999;
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.display = "block";
    clearTimeout(t._tm);
    t._tm = setTimeout(() => {
      t.style.display = "none";
    }, timeout);
  } catch (e) {
    console.warn("Toast failed", e, msg);
  }
}

function renderStateBadge() {
  const el = document.getElementById("stateBadge");
  if (!el) return;

  const m = state.horizon_start ? state.horizon_start.slice(0, 7) : "—";
  const kind = state.material_type || "ALL";
  const mode =
    state.mode === "all"
      ? "All"
      : state.mode.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
  const view = state.view === "summary" ? "Summary" : "Exceptions";

  const activeFilters = [];
  if (state.netpos) activeFilters.push("Net>0");
  if (state.alloc) activeFilters.push("Alloc");
  if (state.noplan) activeFilters.push("No-plan");
  if (state.pni) activeFilters.push("PNI");
  if (state.over) activeFilters.push("Over");
  if (state.q) activeFilters.push(`"${state.q}"`);

  const filters = activeFilters.length ? ` | ${activeFilters.join(", ")}` : "";
  const filtered = filteredRows.length;
  // Prefer authoritative server total when available, otherwise fall back
  // to the client-side filtered count.
  const usedTotal =
    typeof totalCount === "number" && totalCount >= 0 ? totalCount : filtered;

  // Show the number of matching rows based on active filters as "N Rows"
  const rowsLabel = `${usedTotal} Row${usedTotal === 1 ? "" : "s"}`;
  el.textContent = `${m} • ${kind} • ${mode} • ${view}${filters} (${rowsLabel})`;
}

function applyFiltersAndRender() {
  if (DEBUG) {
    console.debug("applyFiltersAndRender() start", {
      state: { ...state },
      stagingFilters,
    });
    try {
      const stats = allRows.reduce(
        (acc, r) => {
          const f = rowFlags(r);
          acc.total += 1;
          if (f.anyException) acc.exceptions += 1;
          if (f.net > 0) acc.netpos += 1;
          if (f.unassigned) acc.unassigned += 1;
          if (f.approx) acc.approx += 1;
          return acc;
        },
        { total: 0, exceptions: 0, netpos: 0, unassigned: 0, approx: 0 }
      );
      console.debug("applyFiltersAndRender: data flags summary", {
        totalRows: stats.total,
        exceptionRows: stats.exceptions,
        netposRows: stats.netpos,
        unassignedRows: stats.unassigned,
        approxRows: stats.approx,
        stateView: state.view,
        stateMode: state.mode,
        stateFlags: {
          netpos: state.netpos,
          alloc: state.alloc,
          noplan: state.noplan,
          pni: state.pni,
          over: state.over,
        },
        selectedModes: state.selectedModes,
      });
      console.debug("applyFiltersAndRender: server already filtered", {
        serverRows: allRows.length,
        totalCount,
      });
    } catch (e) {
      console.debug("applyFiltersAndRender: stats failed", e);
    }
  }
  // Use canonical state values rather than reading controls directly
  const kind = state.material_type === "" ? "ALL" : state.material_type;
  const onlyNetPositive = !!state.netpos;
  const onlyAllocIssues = !!state.alloc;
  const noPlanButIssued = !!state.noplan;
  const plannedButNotIssued = !!state.pni;
  const overIssued = !!state.over;
  const q = (state.q || "").trim().toLowerCase();

  // Shadow local refiner flags. In Exceptions master view we DO apply the
  // checkbox refiners as additional narrowing controls (logical AND).
  let _onlyNetPositive = onlyNetPositive;
  let _onlyAllocIssues = onlyAllocIssues;
  let _noPlanButIssued = noPlanButIssued;
  let _plannedButNotIssued = plannedButNotIssued;
  let _overIssued = overIssued;

  filteredRows = allRows.filter((r) => {
    // Derived flags
    const f = rowFlags(r);

    // Material type mapping: PM (Packing Material) includes PM and PLM
    if (kind === "RM" && r.material_kind !== "RM") return false;
    if (
      kind === "PM" &&
      !(r.material_kind === "PM" || r.material_kind === "PLM")
    )
      return false;

    // base view predicate: exceptions view shows only exception rows
    if (state.view === "exceptions" && !f.anyException) return false;

    // mode tab predicate (primary slice)
    if (
      state.mode === "all" &&
      Array.isArray(state.selectedModes) &&
      state.selectedModes.length
    ) {
      // when in All and user selected multiple mode refiners, accept rows
      // that match any selected mode (logical OR)
      const ok = state.selectedModes.some((m) => {
        const p = MODE_PREDICATES[m] || MODE_PREDICATES.all;
        return p(r, f);
      });
      if (!ok) return false;
    } else {
      const mode = state.mode || "all";
      const pred = MODE_PREDICATES[mode] || MODE_PREDICATES.all;
      if (!pred(r, f)) return false;
    }

    // checkbox refiners
    // - In Exceptions master view, governed defaults may enable multiple
    //   refiners. Treat multiple refiners as OR (match any) so rows with
    //   any of the active exception flags are shown. In Summary view
    //   behave as before (AND semantics when specific refiners are set).
    if (state.view === "exceptions") {
      // collect active exception checks
      const activeChecks = [];
      if (_onlyNetPositive) activeChecks.push(f.net > 0);
      if (_onlyAllocIssues) activeChecks.push(f.unassigned || f.approx);
      if (_noPlanButIssued) activeChecks.push(f.noPlanButIssued);
      if (_plannedButNotIssued) activeChecks.push(f.plannedNotIssued);
      if (_overIssued) activeChecks.push(f.overIssued);
      if (activeChecks.length) {
        // require at least one matching exception when refiners present
        const anyMatch = activeChecks.some(Boolean);
        if (!anyMatch) return false;
      }
    } else {
      // Summary semantics: apply each refiner as AND
      if (_onlyNetPositive && !(f.net > 0)) return false;
      if (_onlyAllocIssues && !(f.unassigned || f.approx)) return false;
      if (_noPlanButIssued && !f.noPlanButIssued) return false;
      if (_plannedButNotIssued && !f.plannedNotIssued) return false;
      if (_overIssued && !f.overIssued) return false;
    }

    // text search
    if (q) {
      const name = (r.stock_item_name || "").toLowerCase();
      const code = (r.stock_item_code || "").toLowerCase();
      const idstr = String(r.stock_item_id || "").toLowerCase();
      if (!name.includes(q) && !code.includes(q) && !idstr.includes(q))
        return false;
    }

    return true;
  });

  // default sort: material_kind (RM first) then net_requirement desc
  sortRows();
  renderTable();
  if (DEBUG)
    console.debug("applyFiltersAndRender() done", {
      filtered: filteredRows.length,
      all: allRows.length,
    });

  if (DEBUG) {
    const exceptionCount = allRows.reduce(
      (acc, r) => acc + (rowFlags(r).anyException ? 1 : 0),
      0
    );
    console.debug("applyFiltersAndRender: counts", {
      loadedRows: allRows.length,
      filteredRows: filteredRows.length,
      exceptionRows: exceptionCount,
    });
  }
  // Server provides authoritative total_count for current filters/paging
  matchedTotal =
    typeof totalCount === "number" ? totalCount : filteredRows.length;
  renderStateBadge();
  try {
    const rc = document.getElementById("rowCount");
    if (rc)
      rc.textContent = `${matchedTotal} Row${matchedTotal === 1 ? "" : "s"}`;
  } catch {
    void 0;
  }
}

function sortRows() {
  filteredRows.sort((a, b) => {
    if (sortKey === "material_kind") {
      if (a.material_kind === b.material_kind) {
        return Number(b.net_requirement) - Number(a.net_requirement);
      }
      // RM first
      if (a.material_kind === "RM") return -1;
      if (b.material_kind === "RM") return 1;
      return a.material_kind.localeCompare(b.material_kind);
    }

    const av = a[sortKey];
    const bv = b[sortKey];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;

    if (
      typeof av === "number" ||
      typeof bv === "number" ||
      !isNaN(Number(av))
    ) {
      const na = Number(av);
      const nb = Number(bv);
      return sortDir === "asc" ? na - nb : nb - na;
    }

    const sa = String(av).toLowerCase();
    const sb = String(bv).toLowerCase();
    return sortDir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
  });
}

function renderTable() {
  const tbody = document.getElementById("mrpTableBody");
  tbody.innerHTML = "";

  // show rows shown / total (if known)
  const rc = document.getElementById("rowCount");
  if (rc) {
    // Prefer matchedTotal when known. Otherwise prefer server totalCount
    // when no client-only refiners are active; fallback to filteredRows.
    const needsClientTotal = !!(state.noplan || state.pni || state.over);
    let usedTotal = filteredRows.length;
    if (typeof matchedTotal === "number" && matchedTotal >= 0)
      usedTotal = matchedTotal;
    else if (
      !needsClientTotal &&
      typeof totalCount === "number" &&
      totalCount >= 0
    )
      usedTotal = totalCount;
    const rowsLabel = `${usedTotal} Row${usedTotal === 1 ? "" : "s"}`;
    rc.textContent = rowsLabel;
  }

  // Show professional empty state
  if (filteredRows.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `
      <td colspan="8" style="text-align:center; padding:32px; color:var(--muted)">
        <div style="font-size:1.1rem; margin-bottom:8px">📄 No items found</div>
        <div style="font-size:0.9rem">
          ${
            allRows.length === 0
              ? "No data loaded for selected month"
              : "Try adjusting your filters or mode selection"
          }
        </div>
      </td>
    `;
    tbody.appendChild(emptyRow);
    return;
  }

  if (DEBUG) {
    console.debug("renderTable(): rendering rows", {
      shown: filteredRows.length,
      totalCount,
      page: currentPage,
      pageSize,
    });
  }

  filteredRows.forEach((r, idx) => {
    const tr = document.createElement("tr");
    tr.dataset.idx = idx;
    tr.tabIndex = 0;

    const codeLabel = escapeHtml(r.stock_item_code || "");
    const nameLabel = escapeHtml(r.stock_item_name || "");

    const typeLabel =
      r.material_kind === "PLM" ? "PM" : escapeHtml(r.material_kind || "");
    const uomLabel = escapeHtml(r.stock_uom || r.stock_uom_code || "");

    const flags = [];
    if (r.has_unassigned_issues)
      flags.push('<span class="badge-warning">Unassigned</span>');
    if (r.allocation_approx_present)
      flags.push('<span class="badge-info">Approx</span>');
    if (r.no_plan_but_issued)
      flags.push('<span class="badge-warning">No plan</span>');
    if (r.over_issued) flags.push('<span class="badge-warning">Over</span>');
    if (r.planned_but_not_issued)
      flags.push('<span class="badge-info">Not issued</span>');

    tr.innerHTML = `
      <td>${codeLabel}</td>
      <td>${nameLabel}</td>
      <td>${typeLabel}</td>
      <td>${uomLabel}</td>
      <td style="text-align:right">${formatNumber(r.planned_total_qty)}</td>
      <td style="text-align:right">${formatNumber(r.issued_total_qty)}</td>
      <td style="text-align:right">${formatNumber(r.net_requirement)}</td>
      <td><div class="flags">${flags.join("")}</div></td>
    `;

    tr.addEventListener("click", () => selectRow(idx));
    tr.addEventListener("keydown", (e) => {
      if (e.key === "Enter") selectRow(idx);
    });

    if (selectedRowId !== null && selectedRowId === (r.stock_item_id || "")) {
      tr.classList.add("selected");
    }

    tbody.appendChild(tr);
  });

  // Update inline paginator (simple renderer) so paginator is visible after table renders
  try {
    renderPaginator();
  } catch {
    void 0;
  }

  // Reveal table container (was hidden during load to avoid flicker)
  try {
    const container = document.getElementById("mrpTableContainer");
    if (container) container.style.visibility = "visible";
    // Ensure table container height recalculated
    try {
      adjustTableHeight();
    } catch {
      void 0;
    }
  } catch {
    void 0;
  }
}

// Top-level paginator renderer used by renderTable and wireUp
function renderPaginator() {
  const el = document.getElementById("paginator");
  if (!el) return;
  el.innerHTML = "";
  const from = currentPage * pageSize + 1;
  const to = Math.min((currentPage + 1) * pageSize, totalCount || 0);

  const info = document.createElement("div");
  info.className = "pg-info";
  info.textContent = totalCount ? `Showing ${from}–${to} of ${totalCount}` : "";
  el.appendChild(info);

  const prev = document.createElement("button");
  prev.className = "pg-btn";
  prev.textContent = "Prev";
  prev.disabled = currentPage <= 0;
  prev.addEventListener("click", () => {
    if (currentPage > 0) currentPage -= 1;
    loadAndRender();
  });
  el.appendChild(prev);

  const next = document.createElement("button");
  next.className = "pg-btn";
  next.textContent = "Next";
  const maxPage = totalCount
    ? Math.max(0, Math.ceil(totalCount / pageSize) - 1)
    : 0;
  next.disabled = currentPage >= maxPage;
  next.addEventListener("click", () => {
    if (currentPage < maxPage) currentPage += 1;
    loadAndRender();
  });
  el.appendChild(next);

  // page size selector
  const sel = document.createElement("select");
  [25, 50, 100, 250].forEach((n) => {
    const o = document.createElement("option");
    o.value = String(n);
    o.textContent = `${n} / page`;
    if (n === pageSize) o.selected = true;
    sel.appendChild(o);
  });
  sel.addEventListener("change", () => {
    pageSize = Number(sel.value) || 100;
    currentPage = 0;
    loadAndRender();
  });
  el.appendChild(sel);
}

// `previewTopConsumers` helper removed — top consumers are shown in the modal

function escapeHtml(s) {
  if (!s) return "";
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ])
  );
}

function selectRow(idx, openModal = true) {
  const r = filteredRows[idx];
  if (!r) return;
  selectedRowId = r.stock_item_id;
  // highlight
  document.querySelectorAll("#mrpTableBody tr").forEach((tr, i) => {
    tr.classList.toggle("selected", i === idx);
  });

  if (openModal) {
    // update deep link via canonical state and open detail modal
    state.stock_item_id = r.stock_item_id;
    writeStateToUrl(false);
    populateDetailPanel(r);
  } else {
    // only highlight; do not change URL or open modal
    try {
      state.stock_item_id = r.stock_item_id;
    } catch {
      void 0;
    }
  }
}

function populateDetailPanel(r) {
  // Modal-based detail target
  const modal = document.getElementById("itemDetailModal");
  const content = document.getElementById("modalContent");
  const title = document.getElementById("modalItemTitle");
  const summary = document.getElementById("modalSummary");
  const barInner = document.getElementById("modalBarInner");
  const barLabel = document.getElementById("modalBarLabel");
  const topConsumersEl = document.getElementById("modalTopConsumers");
  const openBtn = document.getElementById("modalAllocationBtn");

  const titleName = r.stock_item_code
    ? `${escapeHtml(r.stock_item_code)} — ${escapeHtml(
        r.stock_item_name || ""
      )}`
    : escapeHtml(r.stock_item_name || "");
  const typeLabel =
    r.material_kind === "PLM" ? "PM" : escapeHtml(r.material_kind || "");
  title.innerHTML = `<strong>${titleName}</strong> <div style="font-size:0.9rem;color:var(--muted)">${typeLabel}</div>`;
  summary.innerHTML = `Planned: <strong>${formatNumber(
    r.planned_total_qty
  )}</strong> • Issued: <strong>${formatNumber(
    r.issued_total_qty
  )}</strong> • Net: <strong>${formatNumber(r.net_requirement)}</strong>`;

  const planned = Number(r.planned_total_qty) || 0;
  const issued = Number(r.issued_total_qty) || 0;
  // Coverage = issued / planned (how much of the plan has been issued)
  let coveragePct = 0;
  if (planned > 0) {
    coveragePct = Math.round((issued / planned) * 100);
    coveragePct = Math.max(0, Math.min(coveragePct, 999));
  }
  // visually cap the bar to 100% while still showing the actual percent label
  const displayPct = Math.min(coveragePct, 100);
  barInner.style.width = `${displayPct}%`;
  barLabel.textContent = `${coveragePct}%`;
  if (coveragePct > 100) barInner.classList.add("overfull");
  else barInner.classList.remove("overfull");

  // top consumers: RM and PLM have slightly different shapes
  const arr = parseTopConsumers(r.top_consumers);
  if (!arr || arr.length === 0) {
    topConsumersEl.innerHTML = "<em>No top consumers available</em>";
  } else {
    const table = document.createElement("table");
    table.className = "consumers-table";
    const thead = document.createElement("thead");
    thead.innerHTML = `<tr><th>Consumer</th><th style="text-align:right">Qty</th></tr>`;
    table.appendChild(thead);
    const tbody = document.createElement("tbody");

    arr.forEach((it) => {
      const tr = document.createElement("tr");
      const tdName = document.createElement("td");
      const tdQty = document.createElement("td");
      tdQty.className = "qty";

      if (r.material_kind === "RM") {
        const name = it.product_name || it.name || "Product";
        const qty = formatNumber(it.planned_rm_qty ?? it.planned_qty ?? 0);
        tdName.innerHTML = escapeHtml(name);
        tdQty.textContent = `${qty} ${r.stock_uom || ""}`;
      } else {
        const sku =
          it.sku_name || it.sku || it.name || it.product_name || "SKU";
        const region = it.region_code || "";
        const qty = formatNumber(it.planned_plm_qty ?? it.planned_qty ?? 0);
        tdName.innerHTML = `${escapeHtml(sku)}`;
        if (region)
          tdName.innerHTML += `<span class="consumer-region">${escapeHtml(
            region
          )}</span>`;
        tdQty.textContent = `${qty} ${r.stock_uom || ""}`;
      }

      tr.appendChild(tdName);
      tr.appendChild(tdQty);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    topConsumersEl.innerHTML = "";
    topConsumersEl.appendChild(table);
  }

  // Configure single action button
  if (!openBtn) {
    // nothing to do
  } else if (r.material_kind === "RM") {
    // Build deep-link to RM allocation console including return_to + open flag
    const currentFullHref = window.location.href;
    const href = `rm-issue-allocation.html?horizon_start=${encodeURIComponent(
      r.horizon_start
    )}&stock_item_id=${encodeURIComponent(
      r.stock_item_id
    )}&return_to=${encodeURIComponent(
      currentFullHref
    )}&return_label=${encodeURIComponent("MRP Board")}&open=1`;
    openBtn.disabled = false;
    openBtn.title = "Open RM Issue Allocation Console";
    openBtn.dataset.href = href;
    try {
      if (DEBUG)
        console.debug("[mrp-material-board] RM allocation href:", href);
    } catch (e) {
      void e;
    }
    openBtn.onclick = () => {
      if (!openBtn.disabled && openBtn.dataset.href) {
        try {
          if (DEBUG)
            console.debug(
              "[mrp-material-board] navigating to allocation:",
              openBtn.dataset.href
            );
        } catch (e) {
          void e;
        }
        window.location.href = openBtn.dataset.href;
      }
    };
  } else if (r.material_kind === "PLM" || r.material_kind === "PM") {
    // include a return_to so the allocation page can show a Back button
    // Use full href (including query/hash) to reliably return to the exact board state
    const currentFullHref = window.location.href;
    const href = `pm-issue-allocation.html?horizon_start=${encodeURIComponent(
      r.horizon_start
    )}&stock_item_id=${encodeURIComponent(
      r.stock_item_id
    )}&return_to=${encodeURIComponent(
      currentFullHref
    )}&return_label=${encodeURIComponent("MRP Board")}`;
    openBtn.disabled = false;
    openBtn.title = "Open Issue Allocation Console";
    openBtn.dataset.href = href;
    // Debug log to help trace missing return_to behaviour
    try {
      if (DEBUG) console.debug("[mrp-material-board] allocation href:", href);
    } catch (e) {
      void e;
    }
    openBtn.onclick = () => {
      if (!openBtn.disabled && openBtn.dataset.href) {
        try {
          if (DEBUG)
            console.debug(
              "[mrp-material-board] navigating to allocation:",
              openBtn.dataset.href
            );
        } catch (e) {
          void e;
        }
        window.location.href = openBtn.dataset.href;
      }
    };
  } else {
    openBtn.disabled = true;
    openBtn.title = "Allocation console unavailable";
    openBtn.dataset.href = "";
  }

  if (content) content.style.display = "block";
  if (modal) modal.setAttribute("aria-hidden", "false");
  // focus for accessibility
  const close = modal?.querySelector(".modal-close");
  if (close) close.focus();

  // install a focus trap for the open modal so Tab/Shift+Tab cycles
  // inside the dialog. The trap is removed when the modal is closed.
  try {
    addModalFocusTrap(modal);
  } catch {
    void 0;
  }
}

// Focus trap helpers
function addModalFocusTrap(modal) {
  if (!modal) return;
  const dialog = modal.querySelector(".modal-dialog");
  if (!dialog) return;
  // Avoid duplicate handlers
  if (modal._trapHandler) return;

  const selector =
    'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"])';

  const handler = function (e) {
    if (e.key !== "Tab") return;
    const focusables = Array.from(dialog.querySelectorAll(selector)).filter(
      (el) =>
        el.offsetWidth > 0 ||
        el.offsetHeight > 0 ||
        el === document.activeElement
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey) {
      if (
        document.activeElement === first ||
        document.activeElement === modal
      ) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  modal._trapHandler = handler;
  modal.addEventListener("keydown", handler);
}

function removeModalFocusTrap(modal) {
  if (!modal) return;
  if (!modal._trapHandler) return;
  modal.removeEventListener("keydown", modal._trapHandler);
  modal._trapHandler = null;
}

// Focus fallback after closing modal to avoid aria-hidden on focused element
function focusAfterModalClose() {
  // Try to focus the selected table row first
  try {
    const sel = document.querySelector("#mrpTableBody tr.selected");
    if (sel) {
      sel.focus();
      return;
    }
  } catch {
    void 0;
  }

  // Next try load button, then home button, then body
  const tryIds = ["loadDataBtn", "homeBtn"];
  for (const id of tryIds) {
    try {
      const el = document.getElementById(id);
      if (el) {
        el.focus();
        return;
      }
    } catch {
      void 0;
    }
  }

  try {
    document.body.focus();
  } catch {
    void 0;
  }
}

function wireUp() {
  // Platform-aware HOME button: delegate to shared Platform helper
  document.getElementById("homeBtn")?.addEventListener("click", () => {
    try {
      Platform.goHome();
    } catch {
      // fallback if Platform unavailable
      window.location.href = "../../index.html";
    }
  });

  document.getElementById("clearFilters")?.addEventListener("click", () => {
    // Reset everything to module defaults (as if re-accessing the module)
    // default horizon_start = current month first day
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}-01`;
    state.horizon_start = defaultMonth;
    state.material_type = "";
    state.mode = "all";
    state.view = "summary";
    state.q = "";
    state.netpos = false;
    state.alloc = false;
    state.noplan = false;
    state.pni = false;
    state.over = false;
    state.selectedModes = [];
    state.stock_item_id = "";
    // reset to first page
    currentPage = 0;

    // Reset sorting to defaults
    sortKey = DEFAULT_SORT_KEY;
    sortDir = DEFAULT_SORT_DIR;
    // clear header sort indicators and restore SVG opacities
    document
      .querySelectorAll("#mrpTableContainer th[data-key]")
      .forEach((h) => {
        h.classList.remove("sorted-asc", "sorted-desc");
        const icon = h.querySelector(".sort-icon");
        if (icon) {
          icon.querySelectorAll("polyline").forEach((p) => {
            try {
              p.style.opacity = "0.5";
            } catch {
              void 0;
            }
          });
        }
      });

    // Update UI and reload with replace so history isn't polluted
    applyStateToUI();
    writeStateToUrl(true);
    onStateChanged({ reload: true, replace: true });
  });

  // Enable reload button. Use a direct reload call and prevent event
  // propagation to avoid accidental delegated handlers opening the
  // detail modal.
  document.getElementById("loadDataBtn")?.addEventListener("click", (ev) => {
    try {
      ev.stopPropagation();
      ev.preventDefault();
    } catch {
      void 0;
    }
    // Clear any selected deep-link so reload doesn't auto-open the
    // detail modal, and ensure any open modal is closed.
    try {
      state.stock_item_id = "";
      const modal = document.getElementById("itemDetailModal");
      if (modal) {
        try {
          removeModalFocusTrap(modal);
        } catch {
          void 0;
        }
        focusAfterModalClose();
        modal.setAttribute("aria-hidden", "true");
      }
    } catch {
      void 0;
    }
    // call the loader directly
    loadAndRender();
  });

  // board tabs
  document.querySelectorAll("#boardTabs .tab").forEach((t) => {
    t.addEventListener("click", () => {
      const mode = t.dataset.mode || "all";
      state.mode = mode;
      // when selecting a concrete preset clear any multi-selected modes
      if (mode !== "all") {
        state.selectedModes = [];
        clearAllRefinerDots();
      }
      // sync the checkbox UI to reflect the semantic of this mode
      try {
        syncModeToCheckboxes(mode);
        // keep staging in sync with the mode-driven checkbox state
        stagingFilters = {
          netpos: !!state.netpos,
          alloc: !!state.alloc,
          noplan: !!state.noplan,
          pni: !!state.pni,
          over: !!state.over,
        };
      } catch {
        void 0;
      }
      activateTab(mode);
      // Update UI to reflect muting changes when mode changes
      try {
        applyStateToUI();
      } catch {
        void 0;
      }
      writeStateToUrl();
      // defer heavy filtering/rendering to next frame so activation paints
      requestAnimationFrame(() => applyFiltersAndRender());
    });
  });

  // paginator rendering handled by top-level renderPaginator()

  // view tabs (Summary / Exceptions)
  document.querySelectorAll("#viewTabs .subtab").forEach((btn) => {
    const activate = async () => {
      const view = btn.dataset.view || "summary";
      // Master view semantics: set to a clean master list and clear selected modes
      state.view = view;
      state.mode = "all";
      state.selectedModes = [];

      // When switching master tabs, force-commit staging to canonical state so
      // the drawer doesn't overwrite governed defaults.
      stagingFilters = stagingFilters || {
        netpos: !!state.netpos,
        alloc: !!state.alloc,
        noplan: !!state.noplan,
        pni: !!state.pni,
        over: !!state.over,
      };

      // Governance for Exceptions: compute governed defaults and disabled map
      if (view === "exceptions") {
        let stats = lastMonthlyStats;
        try {
          // attempt to fetch fresh stats for the current horizon
          stats =
            (await fetchMonthlyStats(state.horizon_start).catch(() => null)) ||
            stats;
        } catch {
          stats = stats || null;
        }
        if (DEBUG_GOV) console.debug("activate(exceptions): stats=", stats);
        const gov = applyGovernedExceptionsDefaults(stats);
        // Apply defaults into canonical state
        state.alloc = !!gov.defaults.alloc;
        state.noplan = !!gov.defaults.noplan;
        state.pni = !!gov.defaults.pni;
        state.over = !!gov.defaults.over;
        state.netpos = !!gov.defaults.netpos;

        // staging should reflect governed defaults
        stagingFilters = {
          alloc: !!gov.defaults.alloc,
          noplan: !!gov.defaults.noplan,
          pni: !!gov.defaults.pni,
          over: !!gov.defaults.over,
          netpos: !!gov.defaults.netpos,
        };

        // Apply disabled state to relevant checkboxes
        applyDisabledCheckboxes(gov.disabled);
        if (DEBUG_GOV)
          console.debug(
            "activate(exceptions): governed defaults/disabled",
            gov
          );
      } else {
        // Summary: pure summary semantics - clear filters and ensure enabled
        state.netpos = false;
        state.alloc = false;
        state.noplan = false;
        state.pni = false;
        state.over = false;
        stagingFilters = {
          netpos: false,
          alloc: false,
          noplan: false,
          pni: false,
          over: false,
        };
        // Ensure checkboxes are enabled in Summary
        applyDisabledCheckboxes({});
      }

      // Apply and persist URL, reset pagination/totals, then reload data
      applyStateToUI();
      writeStateToUrl(true);
      // reset pagination and cached totals so the UI doesn't show stale page counts
      currentPage = 0;
      totalCount = 0;
      matchedTotal = null;
      renderStateBadge();
      try {
        await loadAndRender();
      } catch {
        requestAnimationFrame(() => loadAndRender());
      }
    };
    btn.addEventListener("click", activate);
    btn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activate();
      }
    });
  });

  // Modal close buttons
  document.querySelectorAll(".modal-close").forEach((btn) => {
    btn.addEventListener("click", () => {
      const modal = document.getElementById("itemDetailModal");
      if (modal) {
        try {
          removeModalFocusTrap(modal);
        } catch {
          void 0;
        }
        // move focus before hiding to avoid aria-hidden on focused element
        focusAfterModalClose();
        modal.setAttribute("aria-hidden", "true");
      }
    });
  });

  // Close modal on ESC
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const modal = document.getElementById("itemDetailModal");
      if (modal && modal.getAttribute("aria-hidden") === "false") {
        try {
          removeModalFocusTrap(modal);
        } catch {
          void 0;
        }
        focusAfterModalClose();
        modal.setAttribute("aria-hidden", "true");
      }
    }
  });
  // Close when clicking on overlay outside dialog (safe handler)
  const modalOverlay = document.getElementById("itemDetailModal");
  if (modalOverlay) {
    modalOverlay.addEventListener("click", (ev) => {
      if (ev.target !== modalOverlay) return;

      try {
        removeModalFocusTrap(modalOverlay);
      } catch {
        void 0;
      }
      focusAfterModalClose();
      modalOverlay.setAttribute("aria-hidden", "true");
    });
  }

  // Make certain headers sortable: Code, Item, Net (use SVG icons and keyboard support)
  try {
    const sortableKeys = new Set([
      "stock_item_code",
      "stock_item_name",
      "net_requirement",
    ]);

    function createIconNode() {
      const span = document.createElement("span");
      span.className = "sort-icon";
      span.setAttribute("aria-hidden", "true");
      span.innerHTML = `
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <polyline points="7 10 12 5 17 10"></polyline>
          <polyline points="7 14 12 19 17 14"></polyline>
        </svg>`;
      return span;
    }

    function updateHeaderStates(activeTh) {
      document
        .querySelectorAll("#mrpTableContainer th[data-key]")
        .forEach((h) => {
          h.classList.remove("sorted-asc", "sorted-desc");
          const icon = h.querySelector(".sort-icon");
          if (!icon) return;
          icon
            .querySelectorAll("polyline")
            .forEach((p) => (p.style.opacity = "0.5"));
        });
      if (!activeTh) return;
      activeTh.classList.add(sortDir === "asc" ? "sorted-asc" : "sorted-desc");
      const icon = activeTh.querySelector(".sort-icon");
      if (icon) {
        // highlight appropriate chevron by adjusting opacity
        const polys = icon.querySelectorAll("polyline");
        if (polys.length >= 2) {
          // polys[0] = up, polys[1] = down
          polys[0].style.opacity = sortDir === "asc" ? "1" : "0.35";
          polys[1].style.opacity = sortDir === "desc" ? "1" : "0.35";
        }
      }
    }

    document
      .querySelectorAll("#mrpTableContainer th[data-key]")
      .forEach((th) => {
        const key = th.dataset.key;
        if (!sortableKeys.has(key)) return;
        th.classList.add("sortable");
        // append SVG icon container if missing
        if (!th.querySelector(".sort-icon")) th.appendChild(createIconNode());

        const doSort = () => {
          if (sortKey !== key) {
            // First click on this column: sort ascending
            sortKey = key;
            sortDir = "asc";
            updateHeaderStates(th);
          } else if (sortDir === "asc") {
            // Second click: sort descending
            sortDir = "desc";
            updateHeaderStates(th);
          } else {
            // Third click: clear custom sorting, revert to defaults
            sortKey = DEFAULT_SORT_KEY;
            sortDir = DEFAULT_SORT_DIR;
            // clear visual indicators
            updateHeaderStates(null);
          }
          sortRows();
          renderTable();
        };

        th.addEventListener("click", doSort);
        th.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            doSort();
          }
        });
      });
    // initialize indicator for current sort state only when non-default
    if (sortKey !== DEFAULT_SORT_KEY || sortDir !== DEFAULT_SORT_DIR) {
      const active = document.querySelector(
        `#mrpTableContainer th[data-key="${sortKey}"]`
      );
      if (active) updateHeaderStates(active);
    }
  } catch {
    void 0;
  }

  // controls that trigger filtering only
  const CHECKBOX_TO_MODE = {
    filterNetPositive: "shortage",
    filterAllocationIssues: "unassigned",
    filterNoPlanButIssued: "no_plan",
    filterPlannedButNotIssued: "planned_not_issued",
    filterOverIssued: "over_issued",
  };

  // generic handler for kind filter
  const kindEl = document.getElementById("kindFilter");
  if (kindEl)
    // changing material kind affects server-side query -> reload
    kindEl.addEventListener("change", () => onStateChanged({ reload: true }));

  // wire checkboxes: when in Summary view and mode==='all' we toggle the corresponding mode chip
  // Ensure stagingFilters exists (mirrors checkbox choices while editing)
  stagingFilters = stagingFilters || {
    netpos: !!state.netpos,
    alloc: !!state.alloc,
    noplan: !!state.noplan,
    pni: !!state.pni,
    over: !!state.over,
  };

  Object.keys(CHECKBOX_TO_MODE).forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    // reflect staging state in the checkbox DOM
    const fieldMap = {
      filterNetPositive: "netpos",
      filterAllocationIssues: "alloc",
      filterNoPlanButIssued: "noplan",
      filterPlannedButNotIssued: "pni",
      filterOverIssued: "over",
    };

    const field = fieldMap[id];
    if (
      field &&
      stagingFilters &&
      typeof stagingFilters[field] !== "undefined"
    ) {
      el.checked = !!stagingFilters[field];
    }

    // When the user toggles a checkbox, only update the stagingFilters and
    // the small UI hint (refiner dot). Do NOT immediately apply the filters.
    el.addEventListener("change", () => {
      stagingFilters = stagingFilters || {};
      const checked = !!el.checked;
      if (field) stagingFilters[field] = checked;

      // Update the small refiner dot on the mode tab to reflect intent
      const mode = CHECKBOX_TO_MODE[id];
      // Only show a refiner dot when in 'all' mode; preserve others
      if (state.mode === "all") setTabRefinerDot(mode, checked);
      else setTabRefinerDot(mode, checked);

      // Reflect staging changes immediately in the UI (muting of master
      // tabs, refiner dots) so users get immediate feedback without
      // committing the filters. Do NOT commit state here — Apply will.
      try {
        // update badge and master-tab muting without overwriting checkbox DOM
        renderStateBadge();
        updateMasterTabMuting();
      } catch {
        void 0;
      }
      // If the filter drawer is not open, commit the staged filter immediately
      // so the table updates without requiring the user to click Apply.
      try {
        const drawer = document.getElementById("filterDrawer");
        const drawerOpen =
          drawer && drawer.getAttribute("aria-hidden") === "false";
        if (!drawerOpen) {
          // commit staging into canonical state and trigger reload
          commitStagingToState();
          applyStateToUI();
          writeStateToUrl();
          // reload to ensure server-side filtering and counts update
          try {
            loadAndRender();
          } catch {
            requestAnimationFrame(() => loadAndRender());
          }
        }
      } catch {
        void 0;
      }
      // Ensure the input's checked attribute/property and force a paint
      try {
        el.checked = checked;
        if (checked) el.setAttribute("checked", "");
        else el.removeAttribute("checked");
        void el.offsetWidth;
      } catch {
        void 0;
      }
    });
  });

  // Apply button handler (committed from drawer): copy staging -> state and apply
  document.addEventListener("drawer:apply", () => {
    if (DEBUG)
      console.debug(
        "drawer:apply event received, stagingFilters=",
        stagingFilters
      );
    if (!stagingFilters) return;
    commitStagingToState();

    // Update UI to reflect canonical state and then re-render.
    applyStateToUI();
    writeStateToUrl();
    // Reload from server so filters are applied consistently across the
    // full dataset and the table updates immediately.
    try {
      loadAndRender();
    } catch {
      requestAnimationFrame(() => loadAndRender());
    }
  });

  // Clear (in-drawer) button: reset staged filters and UI indications
  document.addEventListener("drawer:cleared", () => {
    if (DEBUG) console.debug("drawer:cleared event received");
    // Reset staging to module defaults and update DOM/UI immediately
    stagingFilters = {
      netpos: DEFAULT_CHECKBOX_FILTERS.netpos,
      alloc: DEFAULT_CHECKBOX_FILTERS.alloc,
      noplan: DEFAULT_CHECKBOX_FILTERS.noplan,
      pni: DEFAULT_CHECKBOX_FILTERS.pni,
      over: DEFAULT_CHECKBOX_FILTERS.over,
    };

    // Update checkbox DOMs to reflect stagingFilters and update refiner dots.
    const map = {
      filterNetPositive: "netpos",
      filterAllocationIssues: "alloc",
      filterNoPlanButIssued: "noplan",
      filterPlannedButNotIssued: "pni",
      filterOverIssued: "over",
    };
    Object.keys(map).forEach((id) => {
      const el = document.getElementById(id);
      const field = map[id];
      if (!el) return;
      const checked = !!stagingFilters[field];
      el.checked = checked;
      if (checked) el.setAttribute("checked", "");
      else el.removeAttribute("checked");
      // update small refiner dot
      const mode = CHECKBOX_TO_MODE[id];
      setTabRefinerDot(mode, checked);
    });

    // update badge and master-tab muting to reflect cleared staging
    try {
      renderStateBadge();
      updateMasterTabMuting();
    } catch {
      void 0;
    }
  });

  const textSearch = document.getElementById("textSearch");
  if (textSearch) {
    let tmr = null;
    textSearch.addEventListener("input", () => {
      clearTimeout(tmr);
      tmr = setTimeout(() => {
        onStateChanged({ reload: false });
      }, 300);
    });
  }

  const month = document.getElementById("horizonMonth");
  if (month) {
    month.addEventListener("change", () => {
      // month change requires reload
      // state will be read inside onStateChanged
      onStateChanged({ reload: true });
    });
  }

  // legacy header-sort handlers removed; new sortable headers are wired
  // higher in `wireUp()` using SVG indicators and tri-state behavior.

  // reflect back/forward navigation
  window.addEventListener("popstate", async () => {
    readStateFromUrl();
    applyStateToUI();
    if (state.horizon_start !== lastLoadedHorizonStart) await loadAndRender();
    else applyFiltersAndRender();
  });
}

async function loadAndRender() {
  // reset previous counts to avoid showing stale totals before load
  try {
    totalCount = 0;
    matchedTotal = null;
    const rc = document.getElementById("rowCount");
    if (rc) rc.textContent = "Loading…";
    // hide table container until we render fresh data to avoid flicker
    const container = document.getElementById("mrpTableContainer");
    if (container) container.style.visibility = "hidden";
  } catch {
    void 0;
  }
  showLoading();
  try {
    await fetchRows();
  } finally {
    hideLoading();
  }

  // Fetch monthly governance stats (fail-open) then apply client-side predicates and render.
  try {
    await fetchMonthlyStats(state.horizon_start).catch(() => null);
  } catch {
    // ignore failures - fail open
  }

  // Update governance banner based on lastMonthlyStats
  try {
    renderGovernanceBanner(lastMonthlyStats);
  } catch {
    void 0;
  }

  // After loading data, apply client-side predicates and render the table.
  applyFiltersAndRender();

  // If the URL contained a deep-linked stock_item_id, select it in the
  // rendered results so the modal can open or the row is highlighted.
  try {
    if (state.stock_item_id) {
      const params = new URLSearchParams(location.search);
      const shouldAutoOpen = params.get("open") === "1";
      const idx = filteredRows.findIndex(
        (r) => String(r.stock_item_id) === String(state.stock_item_id)
      );
      if (idx >= 0) {
        if (shouldAutoOpen) selectRow(idx, true);
        else selectRow(idx, false);
      }
    }
  } catch {
    void 0;
  }

  // Expose debug snapshot for interactive inspection in DevTools
  try {
    window.__mrp_debug = {
      state: JSON.parse(JSON.stringify(state || {})),
      totalCount,
      matchedTotal,
      lastLoadedHorizonStart,
      allRowsSample: Array.isArray(allRows) ? allRows.slice(0, 20) : allRows,
      filteredRowsSample: Array.isArray(filteredRows)
        ? filteredRows.slice(0, 20)
        : filteredRows,
    };
  } catch {
    try {
      // best-effort fallback
      window.__mrp_debug = { totalCount, matchedTotal };
    } catch {
      void 0;
    }
  }
}

function showLoading(msg = "Loading") {
  try {
    const ov = document.getElementById("mrpLoadingOverlay");
    const m = document.getElementById("mrpLoadingMessage");
    // Avoid showing stale totals while loading
    try {
      const rc = document.getElementById("rowCount");
      if (rc) rc.textContent = "Loading…";
    } catch {
      void 0;
    }
    if (m) m.textContent = msg;
    if (ov) {
      ov.style.display = "flex";
      ov.setAttribute("aria-hidden", "false");
    }
  } catch {
    void 0;
  }
}

function hideLoading() {
  try {
    const ov = document.getElementById("mrpLoadingOverlay");
    if (ov) {
      ov.style.display = "none";
      ov.setAttribute("aria-hidden", "true");
    }
  } catch {
    void 0;
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  // initialize state from URL, default horizon_start if missing
  readStateFromUrl();
  if (!state.horizon_start) {
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}-01`;
    state.horizon_start = defaultMonth;
    writeStateToUrl(true);
  }

  // Enable load button
  const loadBtn = document.getElementById("loadDataBtn");
  if (loadBtn) {
    loadBtn.disabled = false;
    loadBtn.setAttribute(
      "data-tooltip",
      "Reload data for current month and filters"
    );
  }

  applyStateToUI();
  wireUp();
  // adjust table height to fit viewport naturally
  try {
    adjustTableHeight();
  } catch {
    void 0;
  }
  await loadAndRender();
  window.mrpUIReady = true;
});

// Ensure table container uses a natural height that fits in the viewport
function adjustTableHeight() {
  try {
    const container = document.getElementById("mrpTableContainer");
    if (!container) return;
    // distance from top of viewport to the top of container
    const rect = container.getBoundingClientRect();
    const top = Math.max(0, rect.top);
    // reserve a small gutter for footer/padding (24px)
    const gutter = 24;
    const avail = Math.max(200, window.innerHeight - top - gutter);
    container.style.maxHeight = avail + "px";
    container.style.overflowY = "auto";
  } catch (e) {
    if (DEBUG) console.debug("adjustTableHeight failed", e);
  }
}

// debounce helper
function debounce(fn, wait = 120) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

// update on resize/orientation changes
try {
  const debAdj = debounce(() => adjustTableHeight(), 120);
  window.addEventListener("resize", debAdj);
  window.addEventListener("orientationchange", debAdj);
} catch {
  void 0;
}
