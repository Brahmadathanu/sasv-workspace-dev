import { supabase } from "./supabaseClient.js";
import { showToast } from "./toast.js";

const RM_OVERVIEW_VIEW = "v_mrp_rm_planned_vs_issued_overview";
const RPC_DRY_RUN_ALL = "mrp_rm_rebuild_dry_run_all";
const RPC_REBUILD_ALL_ERP = "mrp_rm_rebuild_all_erp";
const RPC_REBUILD_FOR_ITEM = "mrp_rm_rebuild_for_item";

async function callRpc(rpcName, payload) {
  try {
    console.group(`[RPC] ${rpcName}`);
  } catch (err) {
    console.debug(err);
  }

  console.log("payload:", payload);
  const t0 =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const { data, error } = await supabase.rpc(rpcName, payload);
  const t1 =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  console.log("data:", data);
  console.log("error:", error);

  try {
    console.log(`${rpcName} took ${Math.round(t1 - t0)}ms`);
  } catch (err) {
    console.debug(err);
  }

  try {
    console.groupEnd();
  } catch (err) {
    console.debug(err);
  }

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

function firstDayFromMonthInputOrNull(val) {
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

/*
 * Return a short month label like "Jan 2026" for a date string or Date.
 * If the input is invalid, return the original input unchanged.
 */
function monthLabel(input) {
  try {
    if (!input && input !== 0) return input;
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return input;
    return d.toLocaleString(undefined, { month: "short", year: "numeric" });
  } catch (err) {
    console.debug("monthLabel failed", err);
    return input;
  }
}

/*
 * Return a plan range label like "Jan 2026 → Dec 2026".
 * If one side is missing, gracefully fall back to the available label.
 */
function planRangeLabel(start, end) {
  try {
    const s = start ? monthLabel(start) : null;
    const e = end ? monthLabel(end) : null;
    if (s && e) return `${s} → ${e}`;
    if (s) return s;
    if (e) return e;
    return "-";
  } catch (err) {
    console.debug("planRangeLabel failed", err);
    return `${start || ""}${end ? ` → ${end}` : ""}`;
  }
}

function escapeHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* DOM helpers */
const els = {
  horizonMonth: () => document.getElementById("horizonMonth"),
  planEndMonth: () => document.getElementById("planEndMonth"),
  rebuildStatus: () => document.getElementById("rebuildStatus"),
  rmFilter: () => document.getElementById("rmFilter"),
  filterUnassigned: () => document.getElementById("filterUnassigned"),
  filterApprox: () => document.getElementById("filterApprox"),
  filterNetNonZero: () => document.getElementById("filterNetNonZero"),
  textSearch: () => document.getElementById("textSearch"),
  notes: () => document.getElementById("notes"),
  clearFilters: () => document.getElementById("clearFilters"),
  rowCount: () => document.getElementById("rowCount"),
  rmOverviewBody: () => document.getElementById("rmOverviewBody"),
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
  let root = document.getElementById("rm-modal-root");
  if (root) return root;
  root = document.createElement("div");
  root.id = "rm-modal-root";
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

/* Build RM dropdown */
function buildRmDropdown() {
  const select = els.rmFilter();
  // clear leaving first option
  select.innerHTML = '<option value="">-- All RM items --</option>';
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

function getRmLabel(row) {
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
  const v = row.top_consumers ?? row.consumers_json ?? null;
  let arr = [];
  try {
    if (!v) return "";
    arr = Array.isArray(v) ? v : JSON.parse(v);
  } catch (err) {
    console.warn("summarizeTopConsumers parse failed", err);
    return escapeHtml(String(v));
  }
  if (!arr || !arr.length) return "";
  const parts = arr.slice(0, 3).map((it) => {
    const name = it.product_name || it.product || "?";
    const qty = it.qty_issued ?? it.qty ?? it.planned_rm_qty ?? 0;
    return `${escapeHtml(name)} (${formatNumber(qty)})`;
  });
  if (arr.length > 3) parts.push(`+ ${arr.length - 3} more`);
  return parts.join(", ");
}

/* Normalization helper for RM row shapes -> stable UI shape */
function normalizeRmRow(r) {
  const stock_item_id = r.rm_stock_item_id ?? r.stock_item_id ?? null;
  const stock_item_code = r.rm_code ?? r.stock_item_code ?? null;
  const stock_item_name = r.rm_name ?? r.stock_item_name ?? null;
  const planned_total_qty = r.planned_rm_qty ?? r.planned_total_qty ?? 0;
  const issued_total_qty = r.issued_rm_qty ?? r.issued_total_qty ?? 0;
  const net_requirement =
    r.remaining_rm_qty ?? r.net_requirement ?? r.qty_variance ?? 0;
  const allocation_approx_present =
    r.allocation_approx ?? r.allocation_approx_present ?? false;
  const top_consumers = r.consumers_json ?? r.top_consumers ?? null;

  return {
    ...r,
    stock_item_id,
    stock_item_code,
    stock_item_name,
    planned_total_qty,
    issued_total_qty,
    net_requirement,
    allocation_approx_present: !!allocation_approx_present,
    top_consumers,
    over_issued: !!r.over_issued,
    no_plan_but_issued: !!r.no_plan_but_issued,
    planned_but_not_issued: !!r.planned_but_not_issued,
    has_unassigned_issues: !!r.has_unassigned_issues,
    rm_uom_code: r.rm_uom_code ?? r.stock_uom ?? r.stock_uom_code ?? "",
  };
}

/* Data loading */
async function fetchOverview(horizonStart) {
  overviewRows = [];
  try {
    const { data, error } = await supabase
      .from(RM_OVERVIEW_VIEW)
      .select("*")
      .eq("horizon_start", horizonStart);
    if (error) {
      console.error("Failed loading RM overview", error);
      showToast(error.message || "Failed to load RM overview", 4000);
      overviewRows = [];
      return;
    }
    overviewRows = (data || []).map(normalizeRmRow);
    console.info(`Using RM overview view: ${RM_OVERVIEW_VIEW}`);
  } catch (err) {
    console.error("Error fetching RM overview", err);
    showToast(err.message || "Failed to load RM overview", 4000);
    overviewRows = [];
  }
}

function applyFiltersAndRender() {
  const rm = els.rmFilter().value;
  const onlyUnassigned = els.filterUnassigned().checked;
  const onlyApprox = els.filterApprox().checked;
  const onlyNetNonZero = els.filterNetNonZero().checked;
  const txt = (els.textSearch().value || "").toLowerCase().trim();

  filteredOverview = overviewRows.filter((row) => {
    if (rm && String(row.stock_item_id) !== String(rm)) return false;
    if (onlyUnassigned && !row.has_unassigned_issues) return false;
    if (onlyApprox && !row.allocation_approx_present) return false;
    if (onlyNetNonZero && Math.abs(Number(row.net_requirement || 0)) <= 0.0001)
      return false;
    if (txt) {
      const hay = [row.stock_item_name || "", row.stock_item_code || ""]
        .join(" ")
        .toLowerCase();
      if (hay.includes(txt)) return true;
      try {
        const tc = Array.isArray(row.top_consumers)
          ? row.top_consumers
          : Array.isArray(row.consumers_json)
          ? row.consumers_json
          : JSON.parse(row.top_consumers || row.consumers_json || "[]");
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

  // default sort: net_requirement descending (largest shortage first), then name
  filteredOverview.sort((a, b) => {
    const na = Number(b.net_requirement || 0) - Number(a.net_requirement || 0);
    if (na !== 0) return na;
    const aName = (a.stock_item_name || "").toLowerCase();
    const bName = (b.stock_item_name || "").toLowerCase();
    return aName.localeCompare(bName);
  });

  renderOverviewTable();
  els.rowCount().textContent = String(filteredOverview.length);
}

function renderOverviewTable() {
  const tbody = els.rmOverviewBody();
  tbody.innerHTML = "";
  filteredOverview.forEach((row) => {
    const tr = document.createElement("tr");
    tr.tabIndex = 0;
    const rmLabel = escapeHtml(getRmLabel(row));
    const flagsHtml = summarizeFlags(row);
    const consumersHtml = summarizeTopConsumers(row);

    tr.innerHTML = `
      <td>${rmLabel}</td>
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
    )} (All RM items)`;
    showDryRunResult(data, header);
  } catch (err) {
    console.error(err);
    showToast("Dry run failed", { type: "error" });
    // ensure any existing modal removed
    const root = document.getElementById("rm-modal-root");
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
    const header = `Dry run result for ${getRmLabel(
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
        const rm = escapeHtml(r.stock_item_code || r.stock_item_name || "RM");
        return `<tr><td>${rm}</td><td style="text-align:right">${before}</td><td style="text-align:right">${after}</td><td>${comment}</td></tr>`;
      })
      .join("");
    html = `<table style="width:100%"><thead><tr><th>RM</th><th>Before net</th><th>After net</th><th>Comment</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  showHtmlModal(headerText || "Dry run result", html);
}

function showRebuildAllResult(row, headerText) {
  // row: single RPC row with horizon_start, plan_start, allocations, plan_runs
  const allocations = row.allocations ?? null;
  const planRuns = Array.isArray(row.plan_runs)
    ? row.plan_runs
    : row.plan_runs ?? [];

  let html = "";
  html += `<div style="margin-bottom:8px">`;
  // show month-style labels
  html += `<div><strong>Horizon:</strong> ${escapeHtml(
    String(monthLabel(row.horizon_start ?? row.horizon_end ?? "-"))
  )}</div>`;
  html += `<div><strong>Plan:</strong> ${escapeHtml(
    String(planRangeLabel(row.plan_start, row.plan_end))
  )}</div>`;
  html += `<div><strong>Plan runs:</strong> ${planRuns.length}</div>`;
  html += `</div>`;

  // Allocations summary
  if (allocations && typeof allocations === "object") {
    html += `<div style="margin-top:10px"><strong>Allocations summary</strong></div>`;
    html += `<table style="width:100%;margin-top:6px">`;
    const keys = [
      "items_seen",
      "items_changed",
      "issue_lines_total",
      "issue_lines_affected",
      "unassigned_before",
      "unassigned_after",
      "approx_before",
      "approx_after",
    ];
    keys.forEach((k) => {
      if (k in allocations) {
        html += `<tr><td style="width:50%">${escapeHtml(
          k
        )}</td><td style="text-align:right">${formatNumber(
          allocations[k]
        )}</td></tr>`;
      }
    });
    html += `</table>`;
  } else {
    html += `<div style="margin-top:8px"><em>Allocations not returned</em></div>`;
  }

  // Plan runs table (limit show to first 200)
  if (Array.isArray(planRuns) && planRuns.length) {
    const total = planRuns.length;
    const showCount = Math.min(200, total);
    html += `<div style="margin-top:12px"><strong>Plan runs (showing ${showCount} of ${total})</strong></div>`;
    html += `<table style="width:100%;margin-top:6px"><thead><tr><th>Month</th><th style="text-align:right">Rows Inserted</th><th>Run ID</th></tr></thead><tbody>`;
    const sorted = planRuns
      .slice()
      .sort((a, b) => (a.month_start || "").localeCompare(b.month_start || ""));
    sorted.slice(0, showCount).forEach((pr) => {
      const rawMonth = pr.month_start || pr.month || "-";
      html += `<tr><td>${escapeHtml(
        String(monthLabel(rawMonth))
      )}</td><td style="text-align:right">${formatNumber(
        pr.rows_inserted ?? pr.rows ?? 0
      )}</td><td>${escapeHtml(
        String(pr.mrp_run_id ?? pr.run_id ?? "-")
      )}</td></tr>`;
    });
    html += `</tbody></table>`;
  } else {
    html += `<div style="margin-top:8px"><em>No plan runs returned</em></div>`;
  }

  // Download buttons
  html += `<div style="margin-top:12px;display:flex;gap:8px"><button id="dlAlloc">Download allocations.json</button><button id="dlPlanRuns">Download plan_runs.json</button></div>`;

  const modalPromise = showHtmlModal(headerText || "Rebuild result", html);

  // attach download handlers
  setTimeout(() => {
    const root = document.getElementById("rm-modal-root");
    if (!root) return;
    const dlAlloc = root.querySelector("#dlAlloc");
    const dlPlanRuns = root.querySelector("#dlPlanRuns");
    if (dlAlloc) {
      dlAlloc.addEventListener("click", () => {
        const payload = allocations ?? {};
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "allocations.json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      });
    }
    if (dlPlanRuns) {
      dlPlanRuns.addEventListener("click", () => {
        const payload = planRuns ?? [];
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "plan_runs.json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      });
    }
  }, 50);
  return modalPromise;
}

async function rebuildAll() {
  if (!currentHorizonStart) {
    showToast("Select a month first", { type: "error" });
    return;
  }
  if (
    !(await showConfirmModal(
      "This will rebuild RM allocations/requirements for the selected month using the latest RM BOM/templates. Continue?"
    ))
  )
    return;
  const btn = els.rebuildAllBtn();
  btn.disabled = true;
  // show immediate status
  try {
    els.rebuildStatus().textContent = `Rebuilding allocations for ${monthDisplayFromHorizon(
      currentHorizonStart
    )}`;
  } catch (err) {
    console.debug(err);
  }
  try {
    // build payload with optional plan end, built_by and notes
    const payload = {
      p_horizon_start: currentHorizonStart,
      p_built_by: "rm-rebuild-dashboard",
      p_notes: `UI rebuild for ${currentHorizonStart}`,
    };
    const planEndVal = els.planEndMonth()?.value || "";
    const p_end_month = firstDayFromMonthInputOrNull(planEndVal);
    if (p_end_month) payload.p_end_month = p_end_month;

    btn.textContent = "Rebuilding...";
    const data = await callRpc(RPC_REBUILD_ALL_ERP, payload);

    // PostgREST returns an array with one row
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      showToast("No result returned from ERP rebuild", { type: "error" });
      return;
    }

    showToast("Rebuild completed (server returned results)", {
      type: "success",
      duration: 3200,
    });

    // update status to plan range
    if (row.plan_start || row.plan_end) {
      try {
        els.rebuildStatus().textContent = `Rebuilding RM plan for ${monthDisplayFromHorizon(
          row.plan_start
        )} → ${monthDisplayFromHorizon(row.plan_end)}`;
      } catch (err) {
        console.debug(err);
      }
    }

    await showRebuildAllResult(
      row,
      `ERP rebuild result: ${monthDisplayFromHorizon(currentHorizonStart)}`
    );
    // clear status after modal closed
    try {
      els.rebuildStatus().textContent = "";
    } catch (err) {
      console.debug(err);
    }

    await loadAndRenderOverview();
  } catch (err) {
    console.error(err);
    try {
      els.rebuildStatus().textContent = "";
    } catch (e) {
      console.debug(e);
    }

    const isTimeout =
      err &&
      (err.code === "57014" ||
        (err.message &&
          String(err.message).toLowerCase().includes("statement timeout")));

    const msg = isTimeout
      ? "ERP rebuild timed out (PostgREST statement_timeout). Ask admin to raise statement_timeout in RPC (SET statement_timeout TO '5min') or reduce Plan End."
      : err.message || "Rebuild failed";

    showToast(msg, { type: "error" });
  } finally {
    btn.disabled = false;
    btn.textContent = "Rebuild All";
    try {
      els.rebuildStatus().textContent = "";
    } catch (e) {
      console.debug(e);
    }
  }
}

async function rebuildForItem(row) {
  if (!currentHorizonStart) return;
  if (
    !(await showConfirmModal(
      `Rebuild RM allocations for ${getRmLabel(row)} in this month?`
    ))
  )
    return;
  try {
    await callRpc(RPC_REBUILD_FOR_ITEM, {
      p_horizon_start: currentHorizonStart,
      p_stock_item_id: parseInt(row.stock_item_id, 10),
      p_dry_run: false,
    });
    showToast(`Rebuild complete for ${getRmLabel(row)}`, { type: "success" });
    await loadAndRenderOverview();
  } catch (err) {
    console.error(err);
    showToast("Rebuild failed for item", { type: "error" });
  }
}

function openAllocationForItem(row) {
  if (!currentHorizonStart || !row.stock_item_id) return;

  const returnTo = encodeURIComponent(
    "rm-rebuild-dashboard.html?horizon_start=" + currentHorizonStart
  );
  const returnLabel = encodeURIComponent("RM Rebuild");

  const url =
    `rm-issue-allocation.html` +
    `?horizon_start=${encodeURIComponent(currentHorizonStart)}` +
    `&stock_item_id=${encodeURIComponent(row.stock_item_id)}` +
    `&open=1` +
    `&return_to=${returnTo}` +
    `&return_label=${returnLabel}`;

  window.location.href = url;
}

/* Wiring */
function wireUp() {
  els.homeBtn().addEventListener("click", () => {
    window.location.href = "../../index.html";
  });
  els.clearFilters().addEventListener("click", () => {
    els.rmFilter().value = "";
    els.filterUnassigned().checked = false;
    els.filterApprox().checked = false;
    els.filterNetNonZero().checked = false;
    els.textSearch().value = "";
    if (els.planEndMonth()) els.planEndMonth().value = "";
    if (els.notes()) els.notes().value = "";
    applyFiltersAndRender();
  });

  els.horizonMonth().addEventListener("change", () => loadAndRenderOverview());
  if (els.planEndMonth())
    els.planEndMonth().addEventListener("change", () => {});
  els.rmFilter().addEventListener("change", () => applyFiltersAndRender());
  els
    .filterUnassigned()
    .addEventListener("change", () => applyFiltersAndRender());
  els.filterApprox().addEventListener("change", () => applyFiltersAndRender());
  els
    .filterNetNonZero()
    .addEventListener("change", () => applyFiltersAndRender());
  els.textSearch().addEventListener("input", () => applyFiltersAndRender());

  els.dryRunAllBtn().addEventListener("click", () => dryRunAll());
  // add tooltip on Rebuild All to surface the helper text non-intrusively
  try {
    const rb = els.rebuildAllBtn();
    if (rb) {
      rb.title = "Rebuild updates RM plan for future months (plan horizon).";
    }
  } catch (err) {
    console.debug(err);
  }
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
  buildRmDropdown();
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
});
