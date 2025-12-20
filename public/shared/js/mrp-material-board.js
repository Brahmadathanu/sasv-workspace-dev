// Lightweight UI glue for the shared MRP board
// - Implements tabs, filter <-> querystring sync, and placeholder table rendering
// - Data loading remains disabled (Load button tooltip: "Coming soon")

function activateTab(mode) {
  const tabs = document.querySelectorAll("#boardTabs .tab");
  tabs.forEach((t) => {
    const m = t.dataset.mode || "all";
    const active = m === mode;
    t.classList.toggle("active", active);
    t.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

// Legacy query/placeholder helpers removed - use unified `state` + read/write helpers below

function switchView(view) {
  if (view === viewMode) return;
  const viewTabs = document.querySelectorAll("#viewTabs .subtab");
  viewTabs.forEach((b) => {
    const is = b.dataset.view === view;
    b.classList.toggle("active", is);
    b.setAttribute("aria-pressed", is ? "true" : "false");
  });

  if (view === "exceptions") {
    // backup current checkbox state
    _backupFilters = {
      allocation: document.getElementById("filterAllocationIssues")?.checked,
      noPlan: document.getElementById("filterNoPlanButIssued")?.checked,
      plannedNotIssued: document.getElementById("filterPlannedButNotIssued")
        ?.checked,
      overIssued: document.getElementById("filterOverIssued")?.checked,
    };
    viewMode = "exceptions";
  } else {
    // restore
    if (_backupFilters) {
      const a = document.getElementById("filterAllocationIssues");
      if (a) a.checked = !!_backupFilters.allocation;
      const n = document.getElementById("filterNoPlanButIssued");
      if (n) n.checked = !!_backupFilters.noPlan;
      const p = document.getElementById("filterPlannedButNotIssued");
      if (p) p.checked = !!_backupFilters.plannedNotIssued;
      const o = document.getElementById("filterOverIssued");
      if (o) o.checked = !!_backupFilters.overIssued;
    }
    viewMode = "summary";
  }
  // keep canonical state in sync (do not trigger rendering here)
  state.view = viewMode;
  // update view hint
  try {
    const hint = document.getElementById("viewHint");
    if (hint) {
      hint.textContent =
        viewMode === "exceptions" ? "Showing exception rows" : "";
    }
  } catch (e) {
    void 0;
  }
}

// legacy initBindings removed; `wireUp()` is the single event binder

export {};
import { supabase } from "./supabaseClient.js";

let allRows = [];
let filteredRows = [];
let selectedRowId = null;
let sortKey = "material_kind";
let sortDir = "asc";
let viewMode = "summary"; // 'summary' or 'exceptions'
let _backupFilters = null;

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
};

let lastLoadedHorizonStart = "";

function readStateFromUrl() {
  const q = Object.fromEntries(new URLSearchParams(location.search));
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
}

function writeStateToUrl(replace = false) {
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

  const qs = "?" + p.toString();
  const newUrl = location.pathname + qs + location.hash;
  if (replace) history.replaceState({}, "", newUrl);
  else history.pushState({}, "", newUrl);
}

function applyStateToUI() {
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
  if (net) net.checked = !!state.netpos;

  const a = document.getElementById("filterAllocationIssues");
  if (a) a.checked = !!state.alloc;

  const n = document.getElementById("filterNoPlanButIssued");
  if (n) n.checked = !!state.noplan;

  const pni = document.getElementById("filterPlannedButNotIssued");
  if (pni) pni.checked = !!state.pni;

  const o = document.getElementById("filterOverIssued");
  if (o) o.checked = !!state.over;

  // tabs
  activateTab(state.mode);
  // view tabs (do not trigger rendering here)
  switchView(state.view);
  // Update view hint per semantics
  try {
    const hint = document.getElementById("viewHint");
    if (hint) {
      hint.textContent =
        state.view === "exceptions"
          ? "Only exception rows (unassigned/approx/no-plan/pni/over)"
          : "All rows, refine using filters";
    }
  } catch (e) {
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
    if (state.view === "exceptions") {
      if (lab) lab.style.display = "none";
      else el.style.display = "none";
    } else {
      if (lab) lab.style.display = "";
      else el.style.display = "";
    }
  });

  renderStateBadge();
}

function readStateFromUI() {
  const m = document.getElementById("horizonMonth")?.value || "";
  state.horizon_start = m ? `${m}-01` : "";

  const kind = document.getElementById("kindFilter")?.value || "ALL";
  state.material_type = kind === "ALL" ? "" : kind;

  state.q = (document.getElementById("textSearch")?.value || "").trim();

  state.netpos = !!document.getElementById("filterNetPositive")?.checked;
  state.alloc = !!document.getElementById("filterAllocationIssues")?.checked;
  state.noplan = !!document.getElementById("filterNoPlanButIssued")?.checked;
  state.pni = !!document.getElementById("filterPlannedButNotIssued")?.checked;
  state.over = !!document.getElementById("filterOverIssued")?.checked;
}

async function onStateChanged({ reload = false, replace = false } = {}) {
  // read UI into state (preserve state.mode and state.view which may be set directly)
  readStateFromUI();
  writeStateToUrl(replace);

  if (reload) await loadAndRender();
  else applyFiltersAndRender();
}

function rowHasAnyException(r) {
  return Boolean(
    r.has_unassigned_issues ||
      r.allocation_approx_present ||
      r.no_plan_but_issued ||
      r.planned_but_not_issued ||
      r.over_issued
  );
}

function rowMatchesSelectedExceptions(r, filters) {
  const { onlyAllocIssues, noPlanButIssued, plannedButNotIssued, overIssued } =
    filters;

  const hasAlloc = Boolean(
    r.has_unassigned_issues || r.allocation_approx_present
  );
  const hasNoPlan = Boolean(r.no_plan_but_issued);
  const hasPlannedNotIssued = Boolean(r.planned_but_not_issued);
  const hasOver = Boolean(r.over_issued);

  const anySelected =
    onlyAllocIssues || noPlanButIssued || plannedButNotIssued || overIssued;

  if (!anySelected) return rowHasAnyException(r);

  if (onlyAllocIssues && hasAlloc) return true;
  if (noPlanButIssued && hasNoPlan) return true;
  if (plannedButNotIssued && hasPlannedNotIssued) return true;
  if (overIssued && hasOver) return true;

  return false;
}

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
  all: (r, f) => true,
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
  const candidates = [
    "v_mrp_material_monthly_overview",
    "v_mrp_material_summary_monthly",
  ];

  let lastError = null;
  for (const viewName of candidates) {
    try {
      const { data, error } = await supabase
        .from(viewName)
        .select("*")
        .eq("horizon_start", horizonStart);

      if (!error) {
        // normalize rows to be resilient to view column name differences
        const normalized = (data || []).map((r) => ({
          ...r,
          material_kind:
            r.material_kind || r.material_type || r.materialType || "",
        }));
        if (viewName === "v_mrp_material_monthly_overview") {
          allRows = normalized;
          lastLoadedHorizonStart = horizonStart;
          return;
        }
        // fallback diagnostic: summary-only view exists
        showToast("Summary-only view found; overview view missing");
        allRows = normalized.length ? normalized : [];
        lastLoadedHorizonStart = horizonStart;
        return;
      }
      lastError = error;
    } catch (err) {
      lastError = err;
    }
  }

  console.error("Failed to load MRB rows", lastError);
  allRows = [];
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
  const mode = state.mode || "all";
  const view = state.view || "summary";

  const flags = [];
  if (state.netpos) flags.push("net>0");
  if (state.alloc) flags.push("alloc");
  if (state.noplan) flags.push("no-plan");
  if (state.pni) flags.push("pni");
  if (state.over) flags.push("over");

  const f = flags.length ? ` • ${flags.join(",")}` : "";
  el.textContent = `${m} • ${kind} • ${mode} • ${view}${f}`;
}

function applyFiltersAndRender() {
  // Use canonical state values rather than reading controls directly
  const kind = state.material_type === "" ? "ALL" : state.material_type;
  const onlyNetPositive = !!state.netpos;
  const onlyAllocIssues = !!state.alloc;
  const noPlanButIssued = !!state.noplan;
  const plannedButNotIssued = !!state.pni;
  const overIssued = !!state.over;
  const q = (state.q || "").trim().toLowerCase();

  filteredRows = allRows.filter((r) => {
    // Derived flags
    const f = rowFlags(r);

    // Material type mapping: PM means PM or PLM
    if (kind === "RM" && r.material_kind !== "RM") return false;
    if (
      kind === "PM" &&
      !(r.material_kind === "PM" || r.material_kind === "PLM")
    )
      return false;

    // base view predicate: exceptions view shows only exception rows
    if (state.view === "exceptions" && !f.anyException) return false;

    // mode tab predicate (primary slice)
    const mode = state.mode || "all";
    const pred = MODE_PREDICATES[mode] || MODE_PREDICATES.all;
    if (!pred(r, f)) return false;

    // checkbox refiners (apply in both views but note in exceptions view boxes are hidden)
    if (onlyNetPositive && !(f.net > 0)) return false;
    if (onlyAllocIssues && !(f.unassigned || f.approx)) return false;
    if (noPlanButIssued && !f.noPlanButIssued) return false;
    if (plannedButNotIssued && !f.plannedNotIssued) return false;
    if (overIssued && !f.overIssued) return false;

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
  renderStateBadge();
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

  document.getElementById("rowCount").textContent = filteredRows.length;

  filteredRows.forEach((r, idx) => {
    const tr = document.createElement("tr");
    tr.dataset.idx = idx;
    tr.tabIndex = 0;

    const itemLabel = r.stock_item_code
      ? `${escapeHtml(r.stock_item_code)} — ${escapeHtml(
          r.stock_item_name || ""
        )}`
      : escapeHtml(r.stock_item_name || "");

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
      <td>${itemLabel}</td>
      <td>${typeLabel}</td>
      <td>${uomLabel}</td>
      <td style="text-align:right">${formatNumber(r.planned_total_qty)}</td>
      <td style="text-align:right">${formatNumber(r.issued_total_qty)}</td>
      <td style="text-align:right">${formatNumber(r.net_requirement)}</td>
      <td><div class="flags">${flags.join("")}</div></td>
      <td>${previewTopConsumers(r.top_consumers)}</td>
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
}

function previewTopConsumers(val) {
  const arr = parseTopConsumers(val);
  if (!arr || arr.length === 0) return "";
  // show first 1-2 names
  const names = arr
    .slice(0, 2)
    .map((x) => x.product_name || x.sku || x.name || "")
    .filter(Boolean);
  return names
    .map((n) => `<span title="${escapeHtml(n)}">${escapeHtml(n)}</span>`)
    .join(", ");
}

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

function selectRow(idx) {
  const r = filteredRows[idx];
  if (!r) return;
  selectedRowId = r.stock_item_id;
  // highlight
  document.querySelectorAll("#mrpTableBody tr").forEach((tr, i) => {
    tr.classList.toggle("selected", i === idx);
  });
  // update deep link via canonical state
  state.stock_item_id = r.stock_item_id;
  writeStateToUrl(false);
  populateDetailPanel(r);
}

function populateDetailPanel(r) {
  const panel = document.getElementById("detailPanel");
  const content = document.getElementById("detailContent");
  const title = document.getElementById("detailTitle");
  const summary = document.getElementById("detailSummary");
  const barInner = document.getElementById("barInner");
  const barLabel = document.getElementById("barLabel");
  const topConsumersEl = document.getElementById("topConsumers");
  const openBtn = document.getElementById("openIssueAllocationBtn");

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
  barInner.style.width = `${coveragePct}%`;
  barLabel.textContent = `${coveragePct}%`;

  // top consumers: RM and PLM have slightly different shapes
  const arr = parseTopConsumers(r.top_consumers);
  if (!arr || arr.length === 0) {
    topConsumersEl.innerHTML = "<em>No top consumers available</em>";
  } else {
    const list = document.createElement("ol");
    arr.forEach((it) => {
      const li = document.createElement("li");
      if (r.material_kind === "RM") {
        const name = it.product_name || it.name || "Product";
        const qty = formatNumber(it.planned_rm_qty ?? it.planned_qty ?? 0);
        li.textContent = `${name} — ${qty} ${r.stock_uom || ""}`;
      } else {
        const sku =
          it.sku_name || it.sku || it.name || it.product_name || "SKU";
        const region = it.region_code ? ` [${it.region_code}]` : "";
        const qty = formatNumber(it.planned_plm_qty ?? it.planned_qty ?? 0);
        li.textContent = `${sku}${region} — ${qty} ${r.stock_uom || ""}`;
      }
      list.appendChild(li);
    });
    topConsumersEl.innerHTML = "";
    topConsumersEl.appendChild(list);
  }

  // Configure single action button
  if (!openBtn) {
    // nothing to do
  } else if (r.material_kind === "RM") {
    openBtn.disabled = true;
    openBtn.title = "RM allocation coming soon";
    openBtn.dataset.href = "";
  } else if (r.material_kind === "PLM" || r.material_kind === "PM") {
    const href = `plm-issue-allocation.html?horizon_start=${encodeURIComponent(
      r.horizon_start
    )}&stock_item_id=${encodeURIComponent(r.stock_item_id)}`;
    openBtn.disabled = false;
    openBtn.title = "Open Issue Allocation Console";
    openBtn.dataset.href = href;
    openBtn.onclick = () => {
      if (!openBtn.disabled && openBtn.dataset.href) {
        window.location.href = openBtn.dataset.href;
      }
    };
  } else {
    openBtn.disabled = true;
    openBtn.title = "Allocation console unavailable";
    openBtn.dataset.href = "";
  }

  content.style.display = "block";
  panel.setAttribute("aria-hidden", "false");
}

function wireUp() {
  document
    .getElementById("homeBtn")
    ?.addEventListener(
      "click",
      () => (window.location.href = "../../index.html")
    );

  document.getElementById("clearFilters")?.addEventListener("click", () => {
    document.getElementById("kindFilter").value = "ALL";
    document.getElementById("filterNetPositive").checked = false;
    document.getElementById("filterAllocationIssues").checked = false;
    document.getElementById("filterNoPlanButIssued").checked = false;
    document.getElementById("filterPlannedButNotIssued").checked = false;
    document.getElementById("filterOverIssued").checked = false;
    document.getElementById("textSearch").value = "";
    document.getElementById("horizonMonth").value = "";
    // ensure state and reload
    readStateFromUI();
    writeStateToUrl();
    onStateChanged({ reload: true });
  });

  // board tabs
  document.querySelectorAll("#boardTabs .tab").forEach((t) => {
    t.addEventListener("click", () => {
      const mode = t.dataset.mode || "all";
      state.mode = mode;
      activateTab(mode);
      writeStateToUrl();
      applyFiltersAndRender();
    });
  });

  // view tabs (Summary / Exceptions)
  document.querySelectorAll("#viewTabs .subtab").forEach((btn) => {
    const activate = () => {
      const view = btn.dataset.view || "summary";
      // update state and UI, then re-render
      state.view = view;
      switchView(view);
      writeStateToUrl();
      applyFiltersAndRender();
    };
    btn.addEventListener("click", activate);
    btn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activate();
      }
    });
  });

  // controls that trigger filtering only
  [
    "kindFilter",
    "filterNetPositive",
    "filterAllocationIssues",
    "filterNoPlanButIssued",
    "filterPlannedButNotIssued",
    "filterOverIssued",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el)
      el.addEventListener("change", () => onStateChanged({ reload: false }));
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

  // header sort
  document.querySelectorAll("#mrpTable thead th[data-key]").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.key;
      if (sortKey === key) sortDir = sortDir === "asc" ? "desc" : "asc";
      else {
        sortKey = key;
        sortDir = "asc";
      }
      sortRows();
      renderTable();
    });
  });

  // reflect back/forward navigation
  window.addEventListener("popstate", async () => {
    readStateFromUrl();
    applyStateToUI();
    if (state.horizon_start !== lastLoadedHorizonStart) await loadAndRender();
    else applyFiltersAndRender();
  });
}

async function loadAndRender() {
  showLoading();
  try {
    await fetchRows();
  } finally {
    hideLoading();
  }
  // set default sort
  sortKey = "material_kind";
  sortDir = "asc";
  applyFiltersAndRender();
}

function showLoading(msg = "Loading") {
  try {
    const ov = document.getElementById("mrpLoadingOverlay");
    try {
      if (state.stock_item_id) {
        const idx = filteredRows.findIndex(
          (r) => String(r.stock_item_id) === String(state.stock_item_id)
        );
        if (idx >= 0) selectRow(idx);
      }
    } catch (e) {
      void 0;
    }
    renderStateBadge();
    const m = document.getElementById("mrpLoadingMessage");
    if (m) m.textContent = msg;
    if (ov) {
      ov.style.display = "flex";
      ov.setAttribute("aria-hidden", "false");
    }
  } catch (e) {
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
    /* ignore */
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

  applyStateToUI();
  wireUp();
  await loadAndRender();
  window.mrpUIReady = true;
});
