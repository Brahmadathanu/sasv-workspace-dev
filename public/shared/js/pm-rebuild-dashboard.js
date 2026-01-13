import { supabase } from "./supabaseClient.js";
import { showToast } from "./toast.js";
import { loadAccessContext, canEditPM } from "./mrpAccess.js";
import { ensureDetailModal } from "./detailModal.js";

// Preferred view name; if the view isn't present on the server we'll try
// a short list of fallbacks to remain resilient during early deployments.
const PLM_OVERVIEW_VIEW_CANDIDATES = [
  "v_mrp_plm_planned_vs_issued_overview",
  "v_mrp_plm_issue_monthly_enriched",
  "v_mrp_plm_issue_monthly_allocated",
];
const RPC_DRY_RUN_ALL = "mrp_plm_rebuild_dry_run_all";
const RPC_REBUILD_ALL = "mrp_plm_rebuild_all";
const RPC_REBUILD_FOR_ITEM = "mrp_plm_rebuild_for_item";

// RPC wrapper for consistent logging and error propagation
async function callRpc(rpcName, payload) {
  console.group(`[RPC] ${rpcName}`);
  console.log("payload:", payload);
  const { data, error } = await supabase.rpc(rpcName, payload);
  console.log("data:", data);
  console.log("error:", error);
  console.groupEnd();
  if (error) throw error;
  return data;
}

let overviewRows = [];
let filteredOverview = [];
let currentHorizonStart = null;

/* Helpers */
function formatNumber(n) {
  if (n === null || n === undefined) return "-";
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function firstDayFromMonthInput(val) {
  if (!val) return null;
  return `${val}-01`;
}

function monthDisplayFromHorizon(h) {
  try {
    const d = new Date(h);
    return d.toLocaleString(undefined, { month: "short", year: "numeric" });
  } catch (err) {
    console.warn("monthDisplayFromHorizon failed", err);
    return h;
  }
}

function escapeHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* DOM helpers */
const els = {
  horizonMonth: () => document.getElementById("horizonMonth"),
  plmFilter: () => document.getElementById("plmFilter"),
  filterUnassigned: () => document.getElementById("filterUnassigned"),
  filterApprox: () => document.getElementById("filterApprox"),
  filterNetNonZero: () => document.getElementById("filterNetNonZero"),
  textSearch: () => document.getElementById("textSearch"),
  clearFilters: () => document.getElementById("clearFilters"),
  rowCount: () => document.getElementById("rowCount"),
  plmOverviewBody: () => document.getElementById("plmOverviewBody"),
  dryRunPanel: () => document.getElementById("dryRunPanel"),
  dryRunHeader: () => document.getElementById("dryRunHeader"),
  dryRunBody: () => document.getElementById("dryRunBody"),
  dryRunAllBtn: () => document.getElementById("dryRunAllBtn"),
  rebuildAllBtn: () => document.getElementById("rebuildAllBtn"),
  refreshBtn: () => document.getElementById("refreshBtn"),
  homeBtn: () => document.getElementById("homeBtn"),
};

/* Simple in-page modal helpers (created dynamically) */
function _ensureModalRoot() {
  let root = document.getElementById("plm-modal-root");
  if (root) return root;
  root = document.createElement("div");
  root.id = "plm-modal-root";
  Object.assign(root.style, {
    position: "fixed",
    inset: "0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    pointerEvents: "none",
  });
  document.body.appendChild(root);
  return root;
}

function showHtmlModal(title, htmlContent) {
  return new Promise((resolve) => {
    const root = _ensureModalRoot();
    root.innerHTML = "";
    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "absolute",
      inset: 0,
      background: "rgba(0,0,0,0.4)",
      pointerEvents: "auto",
    });

    const box = document.createElement("div");
    Object.assign(box.style, {
      background: "#fff",
      padding: "16px",
      borderRadius: "6px",
      maxWidth: "900px",
      width: "min(96%,900px)",
      maxHeight: "80%",
      overflow: "auto",
      zIndex: 10000,
      boxShadow: "0 6px 24px rgba(0,0,0,0.25)",
      pointerEvents: "auto",
    });

    const hdr = document.createElement("div");
    hdr.style.display = "flex";
    hdr.style.justifyContent = "space-between";
    hdr.style.alignItems = "center";
    hdr.innerHTML = `<strong>${escapeHtml(title)}</strong>`;

    const closeBtn = document.createElement("button");
    closeBtn.style.marginLeft = "12px";
    closeBtn.setAttribute("aria-label", "Close dialog");
    closeBtn.title = "Close";
    closeBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>`;
    closeBtn.addEventListener("click", () => {
      root.innerHTML = "";
      resolve();
    });

    hdr.appendChild(closeBtn);

    const body = document.createElement("div");
    body.innerHTML = htmlContent || "";
    body.style.marginTop = "12px";

    box.appendChild(hdr);
    box.appendChild(body);

    root.appendChild(overlay);
    root.appendChild(box);
  });
}

function showConfirmModal(message) {
  return new Promise((resolve) => {
    const root = _ensureModalRoot();
    root.innerHTML = "";
    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "absolute",
      inset: 0,
      background: "rgba(0,0,0,0.4)",
      pointerEvents: "auto",
    });

    const box = document.createElement("div");
    Object.assign(box.style, {
      background: "#fff",
      padding: "16px",
      borderRadius: "6px",
      maxWidth: "640px",
      width: "min(96%,640px)",
      zIndex: 10000,
      boxShadow: "0 6px 24px rgba(0,0,0,0.25)",
      pointerEvents: "auto",
    });

    const msg = document.createElement("div");
    msg.innerHTML = escapeHtml(message);

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.justifyContent = "flex-end";
    actions.style.gap = "8px";
    actions.style.marginTop = "12px";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => {
      root.innerHTML = "";
      resolve(false);
    });

    const okBtn = document.createElement("button");
    okBtn.textContent = "OK";
    okBtn.addEventListener("click", () => {
      root.innerHTML = "";
      resolve(true);
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(okBtn);

    box.appendChild(msg);
    box.appendChild(actions);

    root.appendChild(overlay);
    root.appendChild(box);
  });
}

/* Build PLM dropdown */
function buildPlmDropdown() {
  const select = els.plmFilter();
  // clear leaving first option
  select.innerHTML = '<option value="">-- All PLM items --</option>';
  const seen = new Map();
  overviewRows.forEach((r) => {
    if (!r.stock_item_id) return;
    if (seen.has(r.stock_item_id)) return;
    seen.set(r.stock_item_id, r);
  });
  Array.from(seen.values()).forEach((r) => {
    const opt = document.createElement("option");
    opt.value = String(r.stock_item_id);
    opt.textContent = `${r.stock_item_code || r.stock_item_id} — ${
      r.stock_item_name || ""
    }`;
    select.appendChild(opt);
  });
}

function getPlmLabel(row) {
  const code = row.stock_item_code || row.stock_item_id || "";
  const name = row.stock_item_name || "";
  return name ? `${code} — ${name}` : String(code);
}

function summarizeFlags(row) {
  const parts = [];
  if (row.net_requirement && Number(row.net_requirement) > 0.0001) {
    parts.push('<span class="badge-warning">Shortage</span>');
  }
  if (row.has_unassigned_issues) {
    parts.push('<span class="badge-warning">Unassigned</span>');
  }
  if (row.allocation_approx_present) {
    parts.push('<span class="badge-info">Approx</span>');
  }
  return parts.join(" ");
}

function summarizeTopConsumers(row) {
  const v = row.top_consumers;
  let arr = [];
  try {
    if (!v) return "";
    arr = Array.isArray(v) ? v : JSON.parse(v);
  } catch (err) {
    console.warn("summarizeTopConsumers parse failed", err);
    return escapeHtml(String(v));
  }
  if (!arr.length) return "";
  const parts = arr.slice(0, 3).map((it) => {
    const name = it.product_name || it.product || "?";
    const qty = it.planned_plm_qty ?? it.planned_rm_qty ?? it.qty ?? 0;
    return `${name} (${formatNumber(qty)})`;
  });
  if (arr.length > 3) parts.push(`+ ${arr.length - 3} more`);
  return escapeHtml(parts.join(", "));
}

/* Data loading */
async function fetchOverview(horizonStart) {
  // Try candidate views in order until one succeeds. This helps when the
  // preferred view hasn't been created on the backend yet.
  overviewRows = [];
  for (const candidate of PLM_OVERVIEW_VIEW_CANDIDATES) {
    try {
      const { data, error } = await supabase
        .from(candidate)
        .select("*")
        .eq("horizon_start", horizonStart);
      if (error) {
        // Relation missing -> try next candidate
        if (String(error.code) === "42P01") {
          console.warn(`View ${candidate} not found, trying next candidate.`);
          continue;
        }
        console.error("Failed loading PLM overview", error);
        showToast("Failed to load PLM overview", {
          type: "error",
          duration: 4000,
        });
        overviewRows = [];
        return;
      }
      overviewRows = data || [];
      console.info(`Using PLM overview view: ${candidate}`);
      return;
    } catch (err) {
      console.error(`Error fetching from ${candidate}`, err);
      // try next candidate
    }
  }
  showToast("PLM overview view not found on server", {
    type: "error",
    duration: 6000,
  });
}

function applyFiltersAndRender() {
  const plm = els.plmFilter().value;
  const onlyUnassigned = els.filterUnassigned().checked;
  const onlyApprox = els.filterApprox().checked;
  const onlyNetNonZero = els.filterNetNonZero().checked;
  const txt = (els.textSearch().value || "").toLowerCase().trim();

  filteredOverview = overviewRows.filter((row) => {
    if (plm && String(row.stock_item_id) !== String(plm)) return false;
    if (onlyUnassigned && !row.has_unassigned_issues) return false;
    if (onlyApprox && !row.allocation_approx_present) return false;
    if (onlyNetNonZero && Math.abs(Number(row.net_requirement || 0)) <= 0.0001)
      return false;
    if (txt) {
      const hay = [row.stock_item_name, row.stock_item_code]
        .join(" ")
        .toLowerCase();
      if (hay.includes(txt)) return true;
      // check top consumers
      try {
        const tc = Array.isArray(row.top_consumers)
          ? row.top_consumers
          : JSON.parse(row.top_consumers || "[]");
        if (Array.isArray(tc)) {
          for (const t of tc) {
            const name = (t.product_name || t.product || "").toLowerCase();
            if (name.includes(txt)) return true;
          }
        }
      } catch (err) {
        console.debug("Failed parsing top_consumers for search", err);
      }
      return false;
    }
    return true;
  });

  // default sort: net_requirement descending (largest shortage first)
  filteredOverview.sort(
    (a, b) => Number(b.net_requirement || 0) - Number(a.net_requirement || 0)
  );

  renderOverviewTable();
  els.rowCount().textContent = String(filteredOverview.length);
}

function renderOverviewTable() {
  const tbody = els.plmOverviewBody();
  tbody.innerHTML = "";
  filteredOverview.forEach((row) => {
    const tr = document.createElement("tr");
    tr.tabIndex = 0;
    const plmLabel = escapeHtml(getPlmLabel(row));
    const flagsHtml = summarizeFlags(row);
    const consumersHtml = summarizeTopConsumers(row);

    tr.innerHTML = `
      <td>${plmLabel}</td>
      <td style="text-align:right">${formatNumber(row.planned_total_qty)}</td>
      <td style="text-align:right">${formatNumber(row.issued_total_qty)}</td>
      <td style="text-align:right">${formatNumber(row.net_requirement)}</td>
      <td>${flagsHtml}</td>
      <td>${consumersHtml}</td>
      <td>
        <button class="link-btn dry-run-one">Dry run</button>
        <button class="link-btn rebuild-one">Rebuild</button>
        <button class="link-btn open-allocation">Open allocation</button>
      </td>
    `;

    tr.querySelector(".dry-run-one").addEventListener("click", (e) => {
      e.stopPropagation();
      dryRunForItem(row);
    });

    tr.querySelector(".rebuild-one").addEventListener("click", (e) => {
      e.stopPropagation();
      rebuildForItem(row);
    });

    // Disable rebuild button for users without PM edit rights
    try {
      const rb = tr.querySelector(".rebuild-one");
      if (rb) rb.disabled = !canEditPM();
    } catch {
      void 0;
    }

    tr.querySelector(".open-allocation").addEventListener("click", (e) => {
      e.stopPropagation();
      openAllocationForItem(row);
    });

    tr.addEventListener("keydown", (e) => {
      if (e.key === "Enter") openAllocationForItem(row);
    });

    tbody.appendChild(tr);
  });
}

/* Actions & RPCs */
async function dryRunAll() {
  if (!currentHorizonStart) {
    showToast("Select a month first", { type: "error" });
    return;
  }
  const btn = els.dryRunAllBtn();
  btn.disabled = true;
  try {
    const data = await callRpc(RPC_DRY_RUN_ALL, {
      p_horizon_start: currentHorizonStart,
    });
    const header = `Dry run result for ${monthDisplayFromHorizon(
      currentHorizonStart
    )} (All PLM items)`;
    showDryRunResult(data, header);
  } catch (err) {
    console.error(err);
    showToast("Dry run failed", { type: "error" });
    // ensure any existing modal removed
    const root = document.getElementById("plm-modal-root");
    if (root) root.innerHTML = "";
  } finally {
    btn.disabled = false;
  }
}

async function dryRunForItem(row) {
  if (!currentHorizonStart) return;
  try {
    const payload = {
      p_horizon_start: currentHorizonStart,
      p_stock_item_id: parseInt(row.stock_item_id, 10),
      p_dry_run: true,
    };
    const data = await callRpc(RPC_REBUILD_FOR_ITEM, payload);
    const header = `Dry run result for ${getPlmLabel(
      row
    )} (${monthDisplayFromHorizon(currentHorizonStart)})`;
    showDryRunResult(data, header);
  } catch (err) {
    console.error(err);
    showToast("Dry run failed for item", { type: "error" });
  }
}

function showDryRunResult(data, headerText) {
  // Render dry-run result into an HTML string and show in modal
  let html = "";
  if (!data || !data.length) {
    html = "<div>No changes reported.</div>";
  } else {
    const rows = data
      .map((r) => {
        const before = formatNumber(
          r.before_net_requirement ?? r.before_net ?? r.before_net_requirement
        );
        const after = formatNumber(
          r.after_net_requirement ?? r.after_net ?? r.after_net_requirement
        );
        const comment = escapeHtml(r.changes_summary || r.message || "");
        const plm = escapeHtml(r.stock_item_code || r.stock_item_name || "PLM");
        return `<tr><td>${plm}</td><td style="text-align:right">${before}</td><td style="text-align:right">${after}</td><td>${comment}</td></tr>`;
      })
      .join("");
    html = `<table style="width:100%"><thead><tr><th>PLM</th><th>Before net</th><th>After net</th><th>Comment</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  showHtmlModal(headerText || "Dry run result", html);
}

async function rebuildAll() {
  if (!currentHorizonStart) {
    showToast("Select a month first", { type: "error" });
    return;
  }
  if (!canEditPM()) {
    showToast("You do not have permission to rebuild PLM allocations", {
      type: "error",
    });
    return;
  }
  if (
    !(await showConfirmModal(
      "This will rebuild PLM allocations for the selected month using the latest templates. Continue?"
    ))
  )
    return;
  const btn = els.rebuildAllBtn();
  btn.disabled = true;
  try {
    await callRpc(RPC_REBUILD_ALL, { p_horizon_start: currentHorizonStart });
    showToast("Rebuild complete", { type: "success", duration: 3200 });
    await loadAndRenderOverview();
    const root = document.getElementById("plm-modal-root");
    if (root) root.innerHTML = "";
  } catch (err) {
    console.error(err);
    showToast("Rebuild failed", { type: "error" });
  } finally {
    btn.disabled = false;
  }
}

async function rebuildForItem(row) {
  if (!currentHorizonStart) return;
  if (!canEditPM()) {
    showToast("You do not have permission to rebuild PLM allocations", {
      type: "error",
    });
    return;
  }
  if (
    !(await showConfirmModal(
      `Rebuild PLM allocations for ${getPlmLabel(row)} in this month?`
    ))
  )
    return;
  try {
    await callRpc(RPC_REBUILD_FOR_ITEM, {
      p_horizon_start: currentHorizonStart,
      p_stock_item_id: parseInt(row.stock_item_id, 10),
      p_dry_run: false,
    });
    showToast(`Rebuild complete for ${getPlmLabel(row)}`, { type: "success" });
    await loadAndRenderOverview();
  } catch (err) {
    console.error(err);
    showToast("Rebuild failed for item", { type: "error" });
  }
}

function openAllocationForItem(row) {
  if (!currentHorizonStart || !row.stock_item_id) return;
  const url = `plm-issue-allocation.html?horizon_start=${encodeURIComponent(
    currentHorizonStart
  )}&stock_item_id=${encodeURIComponent(row.stock_item_id)}`;
  window.location.href = url;
}

/* Wiring */
function wireUp() {
  els.homeBtn().addEventListener("click", () => {
    window.location.href = "../../index.html";
  });
  els.clearFilters().addEventListener("click", () => {
    els.plmFilter().value = "";
    els.filterUnassigned().checked = false;
    els.filterApprox().checked = false;
    els.filterNetNonZero().checked = false;
    els.textSearch().value = "";
    applyFiltersAndRender();
  });

  els.horizonMonth().addEventListener("change", () => loadAndRenderOverview());
  els.plmFilter().addEventListener("change", () => applyFiltersAndRender());
  els
    .filterUnassigned()
    .addEventListener("change", () => applyFiltersAndRender());
  els.filterApprox().addEventListener("change", () => applyFiltersAndRender());
  els
    .filterNetNonZero()
    .addEventListener("change", () => applyFiltersAndRender());
  els.textSearch().addEventListener("input", () => applyFiltersAndRender());

  els.dryRunAllBtn().addEventListener("click", () => dryRunAll());
  els.rebuildAllBtn().addEventListener("click", () => rebuildAll());
  els.refreshBtn().addEventListener("click", () => loadAndRenderOverview());
}

/* Load + render */
async function loadAndRenderOverview() {
  const monthVal = els.horizonMonth().value;
  const horizonStart =
    firstDayFromMonthInput(monthVal) || currentHorizonStart || null;
  if (!horizonStart) return;
  currentHorizonStart = horizonStart;
  await fetchOverview(currentHorizonStart);
  buildPlmDropdown();
  applyFiltersAndRender();
}

function getQueryParam(name) {
  try {
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  } catch (err) {
    console.warn("getQueryParam failed", err);
    return null;
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  // load access context and initialize shared detail modal
  await loadAccessContext();
  try {
    ensureDetailModal();
  } catch {
    void 0;
  }

  wireUp();
  // initialise month input
  const qH = getQueryParam("horizon_start");
  if (qH) {
    // try to set month input to YYYY-MM
    const d = new Date(qH);
    if (!Number.isNaN(d.getTime())) {
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      els.horizonMonth().value = `${yyyy}-${mm}`;
      currentHorizonStart = `${yyyy}-${mm}-01`;
    }
  } else {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    els.horizonMonth().value = `${yyyy}-${mm}`;
    currentHorizonStart = `${yyyy}-${mm}-01`;
  }

  await loadAndRenderOverview();

  // Apply client-side gating for rebuild actions
  try {
    els.rebuildAllBtn().disabled = !canEditPM();
  } catch {
    void 0;
  }
});
