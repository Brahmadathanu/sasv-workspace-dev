import { supabase } from "./supabaseClient.js";
import { showToast } from "./toast.js";
import {
  loadAccessContext,
  canRunOverlay,
  getActorSnapshot,
} from "./mrpAccess.js";
import { ensureDetailModal, openDetailModal } from "./detailModal.js";

/* Lightweight callRpc with timing and tolerant responses */
async function callRpc(rpcName, payload) {
  console.group?.(`[RPC] ${rpcName}`);
  console.log("payload:", payload);
  const t0 =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const { data, error } = await supabase.rpc(rpcName, payload);
  const t1 =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  console.log("data:", data, "error:", error);
  console.log?.(`${rpcName} took ${Math.round(t1 - t0)}ms`);
  console.groupEnd?.();
  if (error) throw error;
  return data;
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

function monthLabel(input) {
  try {
    if (!input && input !== 0) return input;
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return input;
    return d.toLocaleString(undefined, { month: "short", year: "numeric" });
  } catch (err) {
    console.debug(err);
    return input;
  }
}

const els = {
  planStart: () => document.getElementById("planStart"),
  planEnd: () => document.getElementById("planEnd"),
  notes: () => document.getElementById("notes"),
  dryRunBtn: () => document.getElementById("dryRunBtn"),
  runBtn: () => document.getElementById("runBtn"),
  viewLastBtn: () => document.getElementById("viewLastBtn"),
  resultPanel: () => document.getElementById("resultPanel"),
  resultHeader: () => document.getElementById("resultHeader"),
  resultBody: () => document.getElementById("resultBody"),
  homeBtn: () => document.getElementById("homeBtn"),
};

function defaultPlanEndFor(start) {
  try {
    if (!start) return null;
    const d = new Date(start);
    d.setMonth(d.getMonth() + 11);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}`;
  } catch (err) {
    console.debug(err);
    return null;
  }
}

function monthInputToDateString(val) {
  if (!val) return null;
  return `${val}-01`;
}

// Note: dry-run style render is not used; run results use `renderRunResult`.

function renderRunResult(runRow, monthly) {
  const panel = els.resultPanel();
  const header = els.resultHeader();
  const body = els.resultBody();
  if (!runRow) {
    panel.style.display = "none";
    return;
  }
  panel.style.display = "block";
  const planStart = runRow.plan_start || runRow.p_plan_start || null;
  const planEnd = runRow.plan_end || runRow.p_plan_end || null;
  header.textContent = `Plan: ${monthLabel(planStart)} → ${monthLabel(
    planEnd
  )} (Run ${runRow.overlay_run_id || runRow.run_id || "-"})`;

  let html = "";
  html += `<div style="display:flex;gap:12px;flex-wrap:wrap"><div><strong>Run ID</strong><div>${escapeHtml(
    String(runRow.overlay_run_id || runRow.run_id || "-")
  )}</div></div>`;
  const detailCount = Array.isArray(runRow.detail_rows)
    ? runRow.detail_rows.length
    : runRow.detail_rows_count ?? runRow.detail_rows_length ?? 0;
  html += `<div><strong>Detail rows</strong><div style="text-align:right">${detailCount}</div></div>`;
  const monthlyCount = Array.isArray(monthly) ? monthly.length : 0;
  html += `<div><strong>Monthly rows</strong><div style="text-align:right">${monthlyCount}</div></div>`;
  const totalProcure = Array.isArray(monthly)
    ? monthly.reduce(
        (s, m) =>
          s + Number(m.overlay_procure_qty_total ?? m.procure_total ?? 0),
        0
      )
    : 0;
  html += `<div><strong>Procure qty total</strong><div style="text-align:right">${totalProcure}</div></div></div>`;

  if (monthlyCount) {
    html += `<div style='margin-top:12px'><strong>Monthly totals</strong></div>`;
    html += `<table style='width:100%'><thead><tr><th>Month</th><th style='text-align:right'>RM items</th><th style='text-align:right'>Procure qty</th></tr></thead><tbody>`;
    monthly.forEach((m) => {
      const ms = m.month_start || m.month || null;
      html += `<tr><td>${escapeHtml(
        String(monthLabel(ms))
      )}</td><td style='text-align:right'>${
        m.rm_stock_item_id_count ?? m.items ?? 0
      }</td><td style='text-align:right'>${
        m.overlay_procure_qty_total ?? m.procure_total ?? 0
      }</td></tr>`;
    });
    html += `</tbody></table>`;
  }

  html += `<div style="margin-top:10px;display:flex;gap:8px"><button id="dlRun">Download run header JSON</button><button id="dlMonthly">Download monthly JSON</button></div>`;
  body.innerHTML = html;

  setTimeout(() => {
    const dlRun = document.getElementById("dlRun");
    const dlMonthly = document.getElementById("dlMonthly");
    if (dlRun)
      dlRun.addEventListener("click", () => {
        const blob = new Blob([JSON.stringify(runRow, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `rm_season_overlay_run_${
          runRow.overlay_run_id || runRow.run_id || "run"
        }.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      });
    if (dlMonthly)
      dlMonthly.addEventListener("click", () => {
        const blob = new Blob([JSON.stringify(monthly || [], null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `rm_season_overlay_monthly_${
          runRow.overlay_run_id || runRow.run_id || "run"
        }.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      });
  }, 50);
}

// --- Results / Exports helpers ---
function debounce(fn, ms = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

const pageState = { page: 1, pageSize: 50 };

function showSection(name) {
  document.getElementById("runSection").style.display =
    name === "run" ? "" : "none";
  document.getElementById("resultsSection").style.display =
    name === "results" ? "" : "none";
  document.getElementById("exportsSection").style.display =
    name === "exports" ? "" : "none";
  // tab active classes
  document.getElementById("tabRun").classList.toggle("active", name === "run");
  document
    .getElementById("tabResults")
    .classList.toggle("active", name === "results");
  document
    .getElementById("tabExports")
    .classList.toggle("active", name === "exports");
}

async function populateRunSelector() {
  try {
    const { data, error } = await supabase
      .from("mrp_rm_overlay_season_runs")
      .select("overlay_run_id,built_at,plan_start,plan_end")
      .order("built_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    const sel = document.getElementById("selectRun");
    // keep the 'active' option
    sel.innerHTML = '<option value="active">Active (current)</option>';
    if (data && data.length) {
      data.forEach((r) => {
        const opt = document.createElement("option");
        opt.value = String(r.overlay_run_id);
        opt.text = `Run ${r.overlay_run_id} — ${monthLabel(
          r.plan_start
        )} → ${monthLabel(r.plan_end)} (${new Date(
          r.built_at
        ).toLocaleString()})`;
        sel.appendChild(opt);
      });
    }
  } catch (e) {
    console.debug("populateRunSelector failed", e);
  }
}

async function loadResultsPage(page = 1) {
  pageState.page = page;
  const sel = document.getElementById("selectRun");
  const runVal = sel ? sel.value : "active";
  const start = document.getElementById("resultsStart").value;
  const end = document.getElementById("resultsEnd").value;
  const search = document.getElementById("resultsSearch").value;
  const onlyNet = document.getElementById("onlyNetNeed").checked;

  // If runVal === 'active' query view; else query detail for run
  if (runVal === "active") {
    // safe wrapper: attempt server-side filtering, but tolerate missing columns
    try {
      const data = await safeSelectOverlayResultsActive({
        start,
        end,
        search,
        onlyNet,
        page: pageState.page,
        pageSize: pageState.pageSize,
      });
      renderResultsTable(data || []);
    } catch (e) {
      console.debug("loadResultsPage active failed", e);
      const tNode = document.getElementById("resultsTable");
      if (tNode)
        tNode.innerHTML = `<div class="error">Failed to load results: ${escapeHtml(
          String(e?.message || e)
        )}</div>`;
    }
  } else {
    // specific run: try server summary RPC for detail rows; fallback to view
    try {
      const summary = await callRpc("mrp_rm_overlay_season_run_summary", {
        p_overlay_run_id: Number(runVal),
      });
      const rows = Array.isArray(summary)
        ? summary[0]?.detail_rows || []
        : summary?.detail_rows || [];
      const filtered = applyResultsFilters(rows, start, end, search, onlyNet);
      const slice = filtered.slice(
        (pageState.page - 1) * pageState.pageSize,
        pageState.page * pageState.pageSize
      );
      renderResultsTable(slice);
    } catch {
      // fallback to detail table view
      try {
        const q = supabase
          .from("mrp_rm_overlay_season_detail")
          .select("*")
          .eq("overlay_run_id", Number(runVal));
        if (start) q.gte("month_start", monthInputToDateString(start));
        if (end) q.lte("month_start", monthInputToDateString(end));
        if (onlyNet) q.neq("net_need", 0);
        if (search)
          q.or(
            `stock_item_code.ilike.%${search}%,stock_item_name.ilike.%${search}%`
          );
        q.order("month_start", { ascending: true }).range(
          (pageState.page - 1) * pageState.pageSize,
          pageState.page * pageState.pageSize - 1
        );
        const { data, error } = await q;
        if (error) throw error;
        renderResultsTable(data || []);
      } catch (err) {
        console.debug("loadResultsPage fallback failed", err);
      }
    }
  }
}

function applyResultsFilters(rows, start, end, search, onlyNet) {
  let out = Array.isArray(rows) ? rows.slice() : [];
  if (start)
    out = out.filter(
      (r) => (r.month_start || r.month) >= monthInputToDateString(start)
    );
  if (end)
    out = out.filter(
      (r) => (r.month_start || r.month) <= monthInputToDateString(end)
    );
  if (onlyNet) out = out.filter((r) => Number(r.net_need || 0) !== 0);
  if (search) {
    const s = search.toLowerCase();
    out = out.filter(
      (r) =>
        String(r.stock_item_code || "")
          .toLowerCase()
          .includes(s) ||
        String(r.stock_item_name || "")
          .toLowerCase()
          .includes(s)
    );
  }
  return out;
}

/**
 * Safely select rows from v_mrp_rm_overlay_season_monthly_active with tolerant filters.
 * Attempts progressively weaker server filters if the view does not support a column.
 */
async function safeSelectOverlayResultsActive({
  start,
  end,
  search,
  onlyNet,
  page = 1,
  pageSize = 50,
}) {
  const rangeFrom = (page - 1) * pageSize;
  const rangeTo = page * pageSize - 1;

  // Attempt 1: server-side filters including net_need and stock_item_code/name search
  try {
    let q = supabase.from("v_mrp_rm_overlay_season_monthly_active").select("*");
    if (start) q = q.gte("month_start", monthInputToDateString(start));
    if (end) q = q.lte("month_start", monthInputToDateString(end));
    if (onlyNet) q = q.neq("net_need", 0);
    if (search)
      q = q.or(
        `stock_item_code.ilike.%${search}%,stock_item_name.ilike.%${search}%`
      );
    q = q.order("month_start", { ascending: true }).range(rangeFrom, rangeTo);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  } catch (e1) {
    // If column missing or other server-side issues, retry with reduced filters
    console.debug("safeSelect attempt1 failed", e1?.message || e1);
  }

  // Attempt 2: remove net_need filter and only search by stock_item_name (avoid stock_item_code if missing)
  try {
    let q = supabase.from("v_mrp_rm_overlay_season_monthly_active").select("*");
    if (start) q = q.gte("month_start", monthInputToDateString(start));
    if (end) q = q.lte("month_start", monthInputToDateString(end));
    if (search) q = q.ilike("stock_item_name", `%${search}%`);
    q = q.order("month_start", { ascending: true }).range(rangeFrom, rangeTo);
    const { data, error } = await q;
    if (error) throw error;
    // apply onlyNet client-side if necessary
    let out = data || [];
    if (onlyNet)
      out = out.filter((r) => Number(r.net_need || r.net_need_qty || 0) !== 0);
    return out;
  } catch (e2) {
    console.debug("safeSelect attempt2 failed", e2?.message || e2);
  }

  // Final fallback: fetch page without server search filters and apply all filters client-side
  try {
    let q = supabase.from("v_mrp_rm_overlay_season_monthly_active").select("*");
    if (start) q = q.gte("month_start", monthInputToDateString(start));
    if (end) q = q.lte("month_start", monthInputToDateString(end));
    q = q.order("month_start", { ascending: true }).range(rangeFrom, rangeTo);
    const { data, error } = await q;
    if (error) throw error;
    let out = data || [];
    // client-side filters
    out = applyResultsFilters(out, start, end, search, onlyNet);
    return out;
  } catch (e3) {
    console.debug("safeSelect final attempt failed", e3?.message || e3);
    throw e3;
  }
}

function getNetNeed(row) {
  return Number(
    row.net_need ?? row.net_need_qty ?? row.net_need_qty_total ?? 0
  );
}

function getProcureQty(row) {
  return Number(
    row.overlay_procure_qty ??
      row.procure_qty_post_ceiling ??
      row.procure_qty ??
      0
  );
}

function renderResultsTable(rows) {
  const t = document.getElementById("resultsTable");
  if (!t) return;
  if (!rows || !rows.length) {
    t.innerHTML = '<div class="muted">No results</div>';
    return;
  }
  let html =
    '<table style="width:100%"><thead><tr><th>Month</th><th>Stock item</th><th style="text-align:right">Net need</th><th style="text-align:right">Procure</th><th></th></tr></thead><tbody>';
  rows.forEach((r) => {
    const m = r.month_start || r.month || null;
    html += `<tr><td>${escapeHtml(String(monthLabel(m)))}</td><td>${escapeHtml(
      String(r.stock_item_code || "")
    )} — ${escapeHtml(
      String(r.stock_item_name || "")
    )}</td><td style="text-align:right">${Number(
      getNetNeed(r)
    )}</td><td style="text-align:right">${Number(
      getProcureQty(r)
    )}</td><td><button class="viewRow" data-id="${escapeHtml(
      String(r.id || r.rm_stock_item_id || "")
    )}">View</button></td></tr>`;
  });
  html += "</tbody></table>";
  t.innerHTML = html;
  // wire view buttons
  Array.from(t.querySelectorAll(".viewRow")).forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      if (!id) return;
      // Show detail modal; attempt to load row by id
      try {
        const { data, error } = await supabase
          .from("mrp_rm_overlay_season_detail")
          .select("*")
          .eq("id", id)
          .limit(1);
        if (!error && data && data.length) {
          ensureDetailModal();
          openDetailModal({
            title: "Overlay detail",
            subtitle: `id: ${id}`,
            sections: [{ title: "Row", type: "kv", data: data[0] }],
          });
        } else {
          // fallback: open modal with minimal info
          ensureDetailModal();
          openDetailModal({
            title: "Overlay detail",
            subtitle: `id: ${id}`,
            sections: [{ title: "Row", type: "kv", data: { id } }],
          });
        }
      } catch (e) {
        console.debug(e);
      }
    });
  });
}

function onPrevPage() {
  if (pageState.page > 1) loadResultsPage(pageState.page - 1);
}
function onNextPage() {
  loadResultsPage(pageState.page + 1);
}

function downloadJSON(name, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function downloadRunJson() {
  const sel = document.getElementById("selectRun");
  const runVal = sel ? sel.value : "active";
  if (runVal === "active")
    return alert("Active selection has no single run JSON");
  try {
    const { data, error } = await supabase
      .from("mrp_rm_overlay_season_runs")
      .select("*")
      .eq("overlay_run_id", Number(runVal))
      .limit(1);
    if (error) throw error;
    if (data && data.length)
      downloadJSON(`rm_overlay_run_${runVal}.json`, data[0]);
  } catch (e) {
    console.debug(e);
    alert("Download failed");
  }
}

async function downloadMonthlyJson() {
  const sel = document.getElementById("selectRun");
  const runVal = sel ? sel.value : "active";
  if (runVal === "active")
    return alert("Active selection has no single run monthly JSON");
  try {
    // try RPC summary
    try {
      const summary = await callRpc("mrp_rm_overlay_season_run_summary", {
        p_overlay_run_id: Number(runVal),
      });
      const s = Array.isArray(summary) ? summary[0] : summary;
      downloadJSON(`rm_overlay_monthly_${runVal}.json`, s?.monthly || []);
      return;
    } catch {
      /* continue to view */
    }
    const { data, error } = await supabase
      .from("v_mrp_rm_overlay_season_monthly_active")
      .select("*")
      .eq("overlay_run_id", Number(runVal))
      .order("month_start", { ascending: true });
    if (error) throw error;
    downloadJSON(`rm_overlay_monthly_${runVal}.json`, data || []);
  } catch (err) {
    console.debug(err);
    alert("Download failed");
  }
}

async function downloadResultsCsv() {
  // export currently visible table rows
  const t = document.getElementById("resultsTable");
  if (!t) return alert("No results visible");
  const rows = Array.from(t.querySelectorAll("tbody tr"));
  if (!rows.length) return alert("No rows to export");
  const csv = ["Month,Stock Item,Net Need,Procure"];
  rows.forEach((tr) => {
    const cells = tr.querySelectorAll("td");
    const row = [
      cells[0].textContent,
      cells[1].textContent,
      cells[2].textContent,
      cells[3].textContent,
    ];
    csv.push(
      row
        .map((v) => '"' + String((v || "").replace(/"/g, '""')) + '"')
        .join(",")
    );
  });
  const blob = new Blob([csv.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rm_overlay_results_page_${pageState.page}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Dry run is not supported; no function exported.

async function doRun() {
  const ps = els.planStart().value;
  const pe = els.planEnd().value;
  if (!ps) return showToast("Select a plan start month", { type: "error" });
  if (!(await confirmRun())) return;
  const actor = getActorSnapshot();
  const builtBy =
    actor?.actor_email ||
    actor?.actor_display ||
    (actor?.actor_id ? `ui:${actor.actor_id}` : "ui:rm-seasonal-overlay");
  const payload = {
    p_plan_start: monthInputToDateString(ps),
    p_plan_end: monthInputToDateString(pe),
    p_built_by: builtBy,
    p_notes: els.notes().value || null,
    p_activate: true,
  };
  try {
    els.runBtn().disabled = true;
    const data = await callRpc("mrp_rm_overlay_season_build", payload);
    if (!data) {
      showToast("No results returned from run", { type: "error" });
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    // Try server RPC for summarized run (header + monthly aggregates).
    // Fallback to querying the monthly view if RPC is not available.
    let monthly = [];
    try {
      const summary = await callRpc("mrp_rm_overlay_season_run_summary", {
        p_overlay_run_id: row.overlay_run_id,
      });
      const s = Array.isArray(summary) ? summary[0] : summary;
      if (s && Array.isArray(s.monthly)) {
        monthly = s.monthly;
      } else if (s && s.monthly == null) {
        monthly = [];
      }
    } catch {
      // RPC may not exist on older deployments; fall back to client query
      try {
        const q = supabase
          .from("v_mrp_rm_overlay_season_monthly_active")
          .select("*")
          .eq("overlay_run_id", row.overlay_run_id)
          .order("month_start", { ascending: true });
        const { data: monData, error: monErr } = await q;
        if (!monErr && monData) monthly = monData;
      } catch (e) {
        console.debug("fetch monthly failed", e);
      }
    }
    renderRunResult(row, monthly);
    showToast("Overlay run completed", { type: "success" });
  } catch (err) {
    console.error("Run failed", err);
    showToast(err.message || "Overlay run failed", { type: "error" });
  } finally {
    els.runBtn().disabled = false;
  }
}

function confirmRun() {
  return new Promise((resolve) => {
    const ok = confirm(
      "This will write overlay rows to the planning tables. Continue?"
    );
    resolve(ok);
  });
}

async function viewLastRun() {
  try {
    const { data, error } = await supabase
      .from("mrp_rm_overlay_season_runs")
      .select("*")
      .order("built_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    if (!data || !data.length)
      return showToast("No runs found", { type: "error" });
    const run = data[0];
    // Try RPC to fetch aggregated monthly rows; fallback to view query
    let monthly = [];
    try {
      const summary = await callRpc("mrp_rm_overlay_season_run_summary", {
        p_overlay_run_id: run.overlay_run_id,
      });
      const s = Array.isArray(summary) ? summary[0] : summary;
      if (s && Array.isArray(s.monthly)) {
        monthly = s.monthly;
      }
    } catch {
      try {
        const { data: monData, error: monErr } = await supabase
          .from("v_mrp_rm_overlay_season_monthly_active")
          .select("*")
          .eq("overlay_run_id", run.overlay_run_id)
          .order("month_start", { ascending: true });
        if (!monErr && monData) monthly = monData;
      } catch (e) {
        console.debug(e);
      }
    }
    renderRunResult(run, monthly);
    showToast("Loaded last run", { type: "success" });
  } catch (err) {
    console.debug(err);
    showToast("Failed loading last run", { type: "error" });
  }
}

function wireUp() {
  els
    .homeBtn()
    .addEventListener(
      "click",
      () => (window.location.href = "../../index.html")
    );
  try {
    const dr = els.dryRunBtn();
    if (dr) {
      dr.disabled = true;
      dr.title = "Dry run not available; use Run Overlay";
    }
  } catch (err) {
    console.debug(err);
  }
  els.runBtn().addEventListener("click", () => doRun());
  els.viewLastBtn().addEventListener("click", () => viewLastRun());
  els.planStart().addEventListener("change", () => {
    const start = els.planStart().value;
    if (start && !els.planEnd().value) {
      const def = defaultPlanEndFor(start);
      if (def) els.planEnd().value = def;
    }
  });
  // Tab wiring and results controls
  try {
    const tabRun = document.getElementById("tabRun");
    const tabResults = document.getElementById("tabResults");
    const tabExports = document.getElementById("tabExports");
    if (tabRun) tabRun.addEventListener("click", () => showSection("run"));
    if (tabResults)
      tabResults.addEventListener("click", () => showSection("results"));
    if (tabExports)
      tabExports.addEventListener("click", () => showSection("exports"));

    const sel = document.getElementById("selectRun");
    if (sel) sel.addEventListener("change", () => loadResultsPage(1));
    const prev = document.getElementById("resultsPrev");
    const next = document.getElementById("resultsNext");
    if (prev) prev.addEventListener("click", onPrevPage);
    if (next) next.addEventListener("click", onNextPage);
    const search = document.getElementById("resultsSearch");
    if (search)
      search.addEventListener(
        "input",
        debounce(() => loadResultsPage(1), 250)
      );
    const onlyNet = document.getElementById("onlyNetNeed");
    if (onlyNet) onlyNet.addEventListener("change", () => loadResultsPage(1));

    const dlRun = document.getElementById("dlRunJson");
    const dlMonthly = document.getElementById("dlMonthlyJson");
    const dlCsv = document.getElementById("dlResultsCsv");
    if (dlRun) dlRun.addEventListener("click", downloadRunJson);
    if (dlMonthly) dlMonthly.addEventListener("click", downloadMonthlyJson);
    if (dlCsv) dlCsv.addEventListener("click", downloadResultsCsv);
  } catch (e) {
    console.debug("results wiring failed", e);
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  // initialize shared access context and modal
  try {
    await loadAccessContext();
  } catch (e) {
    console.debug("loadAccessContext failed", e);
  }
  try {
    ensureDetailModal();
  } catch (e) {
    console.debug("ensureDetailModal failed", e);
  }

  wireUp();
  showSection("run");
  try {
    await populateRunSelector();
  } catch (e) {
    console.debug(e);
  }
  pageState.page = 1;
  // initialize results start/end to plan range
  try {
    const ps = els.planStart().value;
    const pe = els.planEnd().value;
    const rs = document.getElementById("resultsStart");
    const re = document.getElementById("resultsEnd");
    if (rs && pe) rs.value = ps;
    if (re && pe) re.value = pe;
  } catch (e) {
    console.debug(e);
  }
  // init start to current month
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  els.planStart().value = `${yyyy}-${mm}`;
  els.planEnd().value = defaultPlanEndFor(els.planStart().value) || "";

  // client-side gating for Run button
  try {
    const ok = canRunOverlay();
    const runBtn = els.runBtn();
    if (runBtn) {
      runBtn.disabled = !ok;
      if (!ok) runBtn.title = "Run Overlay disabled for your role";
    }
  } catch (e) {
    console.debug(e);
  }
});
