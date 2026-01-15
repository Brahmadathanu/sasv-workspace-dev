/* eslint-env browser */
import { supabase } from "../public/shared/js/supabaseClient.js";
import { loadAccessContext } from "../public/shared/js/mrpAccess.js";
import { Platform } from "../public/shared/js/platform.js";
import {
  ensureDetailModal,
  openDetailModal,
} from "../public/shared/js/detailModal.js";
import { downloadCSV, downloadJSON } from "../public/shared/js/mrpExports.js";
import {
  monthInputToDateString,
  computePresetRange,
} from "../public/shared/js/mrpPlanRange.js";

// Small adapters
function getStockItemId(row) {
  return (
    row.stock_item_id ??
    row.rm_stock_item_id ??
    row.purchase_stock_item_id ??
    null
  );
}
function getStockItemName(row) {
  return (
    row.stock_item_name ??
    row.rm_name ??
    row.purchase_item_name ??
    row.name ??
    ""
  );
}
function getMonthStart(row) {
  return row.month_start ?? row.period_start ?? null;
}

// DOM helpers
const $ = (id) => document.getElementById(id);

// Global overlay selection + result caches
let selectedOverlayRunId = null;
// cache last rendered rows (for exports to match what user sees)
let fpLastRows = [];
let overlayLastRows = [];
let convLastRows = [];

async function showAccess() {
  const badge = $("accessBadge");
  try {
    const ctx = await loadAccessContext();
    const mods = ctx.module_permissions || {};
    const allowed =
      mods["mrp.procurement_workbench"]?.can_view ||
      mods["mrp.procurement"]?.can_view ||
      (ctx.roles && ctx.roles.length > 0);
    if (!allowed) {
      badge.textContent = "Access denied";
      document.body.innerHTML = '<div style="padding:24px">Access denied</div>';
      return false;
    }
    badge.textContent = `Roles: ${ctx.roles ? ctx.roles.join(", ") : "-"}`;
    return true;
  } catch (e) {
    badge.textContent = "Access check failed";
    console.debug(e);
    return false;
  }
}

function renderTable(theadId, tbodyId, rows) {
  const thead = $(theadId);
  const tbody = $(tbodyId);
  thead.innerHTML = "";
  tbody.innerHTML = "";
  if (!rows || !rows.length) {
    thead.innerHTML = "<tr><th>No data</th></tr>";
    return;
  }
  const keys = Object.keys(rows[0]);
  const tr = document.createElement("tr");
  keys.forEach((k) => {
    const th = document.createElement("th");
    th.textContent = k;
    tr.appendChild(th);
  });
  thead.appendChild(tr);
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    keys.forEach((k) => {
      const td = document.createElement("td");
      const v = r[k];
      td.textContent = v === null || v === undefined ? "" : String(v);
      tr.appendChild(td);
    });
    tr.addEventListener("click", () => onRowClick(r));
    tbody.appendChild(tr);
  });
}

async function onRowClick(row) {
  ensureDetailModal();
  const kind = row.material_kind ?? null;
  const id = getStockItemId(row);
  const month = getMonthStart(row);
  const sections = [];
  sections.push({ title: "Summary", type: "kv", data: row });

  // Contributors
  if (kind === "packaging_material") {
    try {
      const { data } = await supabase
        .from("v_mrp_pm_contrib_detail")
        .select("*")
        .eq("month_start", month)
        .eq("stock_item_id", id)
        .limit(2000);
      sections.push({
        title: "PM Contributors",
        type: "table",
        rows: data || [],
      });
    } catch (err) {
      console.debug(err);
      sections.push({
        title: "PM Contributors",
        type: "html",
        data: "Not available",
      });
    }
  } else {
    // try conversion contrib detail
    try {
      const { data: conv } = await supabase
        .from("v_mrp_rm_conversion_contrib_detail")
        .select("*")
        .eq("month_start", month)
        .eq("consume_stock_item_id", id)
        .limit(2000);
      if (conv && conv.length) {
        sections.push({
          title: "Conversion Contributors",
          type: "table",
          rows: conv,
        });
      }
    } catch (err) {
      console.debug(err);
    }

    // try rm trace
    try {
      const { data: trace } = await supabase
        .from("v_mrp_rm_trace")
        .select("*")
        .eq("rm_stock_item_id", id)
        .limit(2000);
      if (trace && trace.length) {
        sections.push({ title: "RM Trace", type: "table", rows: trace });
      }
    } catch (err) {
      console.debug(err);
    }
  }

  // overlay contribution (if RM)
  if (!kind || kind === "raw_material") {
    try {
      const { data: ov } = await supabase
        .from("v_mrp_rm_seasonal_overlay_monthly_active")
        .select("*")
        .eq("month_start", month)
        .eq("rm_stock_item_id", id)
        .limit(2000);
      if (ov && ov.length)
        sections.push({ title: "Overlay", type: "table", rows: ov });
    } catch (err) {
      console.debug(err);
    }
  }

  openDetailModal({
    title: getStockItemName(row),
    sections,
    actions: [{ label: "Close", onClick: () => {} }],
  });
}

// Tab loaders
async function loadFinalPlan() {
  const preset = $("fp-preset").value;
  const startVal = $("fp-start").value;
  const endVal = $("fp-end").value;
  const search = ($("fp-search").value || "").trim();
  const mk = $("fp-material-kind").value;
  const onlyNet = $("fp-only-net").checked;

  const range = computePresetRange(preset, startVal, new Date().getFullYear());
  const start = monthInputToDateString(range.start || startVal || null);
  const end = monthInputToDateString(range.end || endVal || null);

  let q = supabase.from("v_mrp_procurement_plan").select("*").limit(2000);
  if (start) q = q.gte("month_start", start);
  if (end) q = q.lte("month_start", end);
  if (mk && mk !== "all") q = q.eq("material_kind", mk);
  if (onlyNet) q = q.neq("net_need_qty", 0);
  if (search) q = q.ilike("stock_item_name", `%${search}%`);

  const { data, error } = await q;
  if (error) {
    console.debug(error);
    renderTable("fp-thead", "fp-tbody", []);
    return;
  }
  if (!data || !data.length) {
    renderTable("fp-thead", "fp-tbody", []);
    return;
  }
  fpLastRows = data || [];
  renderTable("fp-thead", "fp-tbody", fpLastRows);
}

async function loadOverlayRuns() {
  const runEl = $("overlay-runs");
  runEl.innerHTML = "Loading runs…";

  const { data: runs, error } = await supabase
    .from("mrp_rm_overlay_season_runs")
    .select("*")
    .order("built_at", { ascending: false })
    .limit(200);

  if (error) {
    console.debug(error);
    runEl.textContent = "Runs not available";
    return;
  }
  if (!runs || !runs.length) {
    runEl.textContent = "No runs";
    overlayLastRows = [];
    renderTable("ov-thead", "ov-tbody", []);
    return;
  }

  // Keep selection if it still exists
  const stillExists =
    selectedOverlayRunId &&
    runs.some((r) => r.overlay_run_id === selectedOverlayRunId);

  if (!stillExists) {
    const active = runs.find((r) => r.is_active) || runs[0];
    selectedOverlayRunId = active?.overlay_run_id ?? null;
  }

  runEl.innerHTML = "";
  runs.forEach((r) => {
    const b = document.createElement("button");
    b.className = "btn";
    b.style.marginRight = "6px";

    const label = `${r.overlay_run_id}${r.is_active ? " (active)" : ""}`;
    b.textContent = label;

    // simple highlight
    if (r.overlay_run_id === selectedOverlayRunId) {
      b.style.outline = "2px solid #3b82f6";
    }

    b.addEventListener("click", () => {
      selectedOverlayRunId = r.overlay_run_id;
      loadOverlayRuns();
      loadOverlayForRun(selectedOverlayRunId);
    });

    runEl.appendChild(b);
  });

  // Load current selection
  if (selectedOverlayRunId) {
    loadOverlayForRun(selectedOverlayRunId);
  }
}

async function loadOverlayForRun(runId) {
  if (!runId) {
    overlayLastRows = [];
    renderTable("ov-thead", "ov-tbody", []);
    return;
  }

  const start = monthInputToDateString($("ov-start").value || null);
  const end = monthInputToDateString($("ov-end").value || null);
  const search = ($("ov-search").value || "").trim().toLowerCase();
  const onlyNonZero = $("ov-only-nonzero").checked;

  let q = supabase
    .from("v_mrp_rm_seasonal_overlay_monthly_active")
    .select("*")
    .eq("overlay_run_id", runId)
    .limit(2000);

  if (start) q = q.gte("month_start", start);
  if (end) q = q.lte("month_start", end);
  if (onlyNonZero) q = q.neq("overlay_procure_qty", 0);

  const { data: baseRows, error } = await q;
  if (error) {
    console.debug(error);
    overlayLastRows = [];
    renderTable("ov-thead", "ov-tbody", []);
    return;
  }

  const rows = baseRows || [];
  if (!rows.length) {
    overlayLastRows = [];
    renderTable("ov-thead", "ov-tbody", []);
    return;
  }

  // Enrich with inv_stock_item code + name
  const ids = [...new Set(rows.map((r) => r.rm_stock_item_id).filter(Boolean))];
  const nameMap = new Map();
  if (ids.length) {
    const { data: items, error: itemErr } = await supabase
      .from("inv_stock_item")
      .select("id,code,name")
      .in("id", ids)
      .limit(5000);

    if (!itemErr && items) {
      items.forEach((it) => nameMap.set(it.id, it));
    } else {
      console.debug(itemErr);
    }
  }

  const enriched = rows.map((r) => {
    const it = nameMap.get(r.rm_stock_item_id);
    return {
      ...r,
      rm_code: it?.code ?? "",
      rm_name: it?.name ?? "",
    };
  });

  // Apply search (name or code) on enriched data
  const filtered = search
    ? enriched.filter(
        (r) =>
          (r.rm_name || "").toLowerCase().includes(search) ||
          (r.rm_code || "").toLowerCase().includes(search)
      )
    : enriched;

  overlayLastRows = filtered;
  renderTable("ov-thead", "ov-tbody", overlayLastRows);
}

async function loadConversionSummary() {
  const preset = $("conv-preset").value;
  const range = computePresetRange(
    preset,
    $("conv-start").value,
    new Date().getFullYear()
  );
  const start = monthInputToDateString(
    range.start || $("conv-start").value || null
  );
  const end = monthInputToDateString(range.end || $("conv-end").value || null);
  const search = ($("conv-search").value || "").trim();

  let q = supabase
    .from("v_mrp_rm_conversion_contrib_summary")
    .select("*")
    .limit(2000);
  if (start) q = q.gte("month_start", start);
  if (end) q = q.lte("month_start", end);
  if (search) q = q.ilike("purchase_item_name", `%${search}%`);
  const { data, error } = await q;
  if (error) {
    console.debug(error);
    renderTable("conv-thead", "conv-tbody", []);
    return;
  }
  convLastRows = data || [];
  renderTable("conv-thead", "conv-tbody", convLastRows);
}

async function loadTraceability() {
  const search = ($("tr-search").value || "").trim();
  const start = monthInputToDateString($("tr-start").value || null);
  const end = monthInputToDateString($("tr-end").value || null);
  const mk = $("tr-material-kind").value;
  const outPlan = $("trace-plan");
  const outOv = $("trace-overlay");
  const outConv = $("trace-conversion");
  const outTrace = $("trace-rm-trace");
  outPlan.innerHTML = "";
  outOv.innerHTML = "";
  outConv.innerHTML = "";
  outTrace.innerHTML = "";
  if (!search) return;

  // Plan rows
  try {
    let q = supabase.from("v_mrp_procurement_plan").select("*").limit(2000);
    if (start) q = q.gte("month_start", start);
    if (end) q = q.lte("month_start", end);
    if (mk && mk !== "all") q = q.eq("material_kind", mk);
    q = q.ilike("stock_item_name", `%${search}%`);
    const { data } = await q;
    outPlan.innerHTML = `<h3>Procurement Plan (${
      data?.length || 0
    })</h3><pre>${JSON.stringify(data || [], null, 2)}</pre>`;
  } catch (err) {
    outPlan.textContent = "Plan not available";
    console.debug(err);
  }

  // Overlay (RM only) — query base overlay view then enrich with stock item names/codes
  try {
    const { data: baseOv, error: baseErr } = await supabase
      .from("v_mrp_rm_seasonal_overlay_monthly_active")
      .select("*")
      .limit(2000);

    let ovEnriched = [];
    if (!baseErr && baseOv && baseOv.length) {
      const ids = [
        ...new Set(baseOv.map((r) => r.rm_stock_item_id).filter(Boolean)),
      ];
      const nameMap = new Map();
      if (ids.length) {
        const { data: items, error: itemErr } = await supabase
          .from("inv_stock_item")
          .select("id,code,name")
          .in("id", ids)
          .limit(5000);
        if (!itemErr && items) items.forEach((it) => nameMap.set(it.id, it));
      }
      ovEnriched = baseOv.map((r) => {
        const it = nameMap.get(r.rm_stock_item_id);
        return { ...r, rm_code: it?.code ?? "", rm_name: it?.name ?? "" };
      });
      const s = search.toLowerCase();
      if (s)
        ovEnriched = ovEnriched.filter(
          (r) =>
            (r.rm_name || "").toLowerCase().includes(s) ||
            (r.rm_code || "").toLowerCase().includes(s)
        );
    }
    outOv.innerHTML = `<h3>Overlay (${
      ovEnriched?.length || 0
    })</h3><pre>${JSON.stringify(ovEnriched || [], null, 2)}</pre>`;
  } catch (err) {
    outOv.textContent = "Overlay not available";
    console.debug(err);
  }

  // Conversion summary
  try {
    const { data } = await supabase
      .from("v_mrp_rm_conversion_contrib_summary")
      .select("*")
      .ilike("purchase_item_name", `%${search}%`)
      .limit(2000);
    outConv.innerHTML = `<h3>Conversion (${
      data?.length || 0
    })</h3><pre>${JSON.stringify(data || [], null, 2)}</pre>`;
  } catch (err) {
    outConv.textContent = "Conversion not available";
    console.debug(err);
  }

  // RM trace
  try {
    const { data } = await supabase
      .from("v_mrp_rm_trace")
      .select("*")
      .ilike("rm_name", `%${search}%`)
      .limit(2000);
    outTrace.innerHTML = `<h3>Trace (${
      data?.length || 0
    })</h3><pre>${JSON.stringify(data || [], null, 2)}</pre>`;
  } catch (err) {
    outTrace.textContent = "Trace not available";
    console.debug(err);
  }
}

// wire up UI
function initUi() {
  document.querySelectorAll(".tab").forEach((t) => {
    t.addEventListener("click", () => {
      document
        .querySelectorAll(".tab")
        .forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      document
        .querySelectorAll(".tab-pane")
        .forEach((p) => (p.style.display = "none"));
      const id = t.dataset.tab;
      $(id).style.display = "";
      if (id === "final-plan") loadFinalPlan();
      if (id === "rm-overlay") {
        loadOverlayRuns();
      }
      if (id === "rm-conversion") loadConversionSummary();
      if (id === "traceability") loadTraceability();
    });
  });

  // filters
  [
    "fp-preset",
    "fp-start",
    "fp-end",
    "fp-search",
    "fp-material-kind",
    "fp-only-net",
  ].forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("change", () => {
      if (document.querySelector(".tab.active").dataset.tab === "final-plan")
        loadFinalPlan();
    });
  });
  ["ov-start", "ov-end", "ov-search", "ov-only-nonzero"].forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("change", () => {
      if (document.querySelector(".tab.active").dataset.tab !== "rm-overlay")
        return;
      if (!selectedOverlayRunId) return;
      loadOverlayForRun(selectedOverlayRunId);
    });
  });
  ["conv-preset", "conv-start", "conv-end", "conv-search"].forEach((id) => {
    const el = $(id);
    if (el)
      el.addEventListener("change", () => {
        if (
          document.querySelector(".tab.active").dataset.tab === "rm-conversion"
        )
          loadConversionSummary();
      });
  });
  ["tr-search", "tr-start", "tr-end", "tr-material-kind"].forEach((id) => {
    const el = $(id);
    if (el)
      el.addEventListener("change", () => {
        if (
          document.querySelector(".tab.active").dataset.tab === "traceability"
        )
          loadTraceability();
      });
  });

  // exports
  $("fp-export-csv").addEventListener("click", () => {
    downloadCSV(`final_procurement_plan_${Date.now()}`, fpLastRows || []);
  });
  $("fp-export-json").addEventListener("click", () => {
    downloadJSON(`final_procurement_plan_${Date.now()}`, {
      generated_at: new Date().toISOString(),
      filters: {},
      rows: fpLastRows || [],
    });
  });

  $("ov-export-csv").addEventListener("click", () => {
    const runId = selectedOverlayRunId || "unknown";
    downloadCSV(`rm_season_overlay_monthly_${runId}`, overlayLastRows || []);
  });
  $("ov-export-json").addEventListener("click", () => {
    const runId = selectedOverlayRunId || "unknown";
    downloadJSON(`rm_season_overlay_run_${runId}`, {
      generated_at: new Date().toISOString(),
      overlay_run_id: runId,
      rows: overlayLastRows || [],
    });
  });

  $("conv-export-csv").addEventListener("click", () => {
    downloadCSV(`rm_conversion_summary_${Date.now()}`, convLastRows || []);
  });
  $("conv-export-json").addEventListener("click", () => {
    downloadJSON(`rm_conversion_summary_${Date.now()}`, {
      generated_at: new Date().toISOString(),
      rows: convLastRows || [],
    });
  });

  $("tr-export-json").addEventListener("click", async () => {
    const search = ($("tr-search").value || "").trim();
    if (!search) return alert("Enter stock item search");
    const start = monthInputToDateString($("tr-start").value || null);
    const end = monthInputToDateString($("tr-end").value || null);
    const { data: plan } = await supabase
      .from("v_mrp_procurement_plan")
      .select("*")
      .ilike("stock_item_name", `%${search}%`)
      .limit(2000);
    // overlay: fetch base rows then enrich with inv_stock_item names/codes and filter by search
    let ov = [];
    try {
      const { data: baseOv, error: baseErr } = await supabase
        .from("v_mrp_rm_seasonal_overlay_monthly_active")
        .select("*")
        .limit(2000);
      if (!baseErr && baseOv && baseOv.length) {
        const ids = [
          ...new Set(baseOv.map((r) => r.rm_stock_item_id).filter(Boolean)),
        ];
        const nameMap = new Map();
        if (ids.length) {
          const { data: items, error: itemErr } = await supabase
            .from("inv_stock_item")
            .select("id,code,name")
            .in("id", ids)
            .limit(5000);
          if (!itemErr && items) items.forEach((it) => nameMap.set(it.id, it));
        }
        ov = baseOv
          .map((r) => {
            const it = nameMap.get(r.rm_stock_item_id);
            return { ...r, rm_code: it?.code ?? "", rm_name: it?.name ?? "" };
          })
          .filter(
            (r) =>
              (r.rm_name || "").toLowerCase().includes(search.toLowerCase()) ||
              (r.rm_code || "").toLowerCase().includes(search.toLowerCase())
          );
      }
    } catch (err) {
      console.debug(err);
      ov = [];
    }
    const { data: conv } = await supabase
      .from("v_mrp_rm_conversion_contrib_summary")
      .select("*")
      .ilike("purchase_item_name", `%${search}%`)
      .limit(2000);
    const { data: trace } = await supabase
      .from("v_mrp_rm_trace")
      .select("*")
      .ilike("rm_name", `%${search}%`)
      .limit(2000);
    const bundle = {
      generated_at: new Date().toISOString(),
      search,
      start,
      end,
      plan: plan || [],
      overlay: ov || [],
      conversion: conv || [],
      trace: trace || [],
    };
    downloadJSON(`trace_bundle_${search}_${Date.now()}`, bundle);
  });
}

// minimal fetch helpers to support exports
async function fetchCurrentFpRows() {
  const preset = $("fp-preset").value;
  const range = computePresetRange(
    preset,
    $("fp-start").value,
    new Date().getFullYear()
  );
  const start = monthInputToDateString(
    range.start || $("fp-start").value || null
  );
  const end = monthInputToDateString(range.end || $("fp-end").value || null);
  const mk = $("fp-material-kind").value;
  const onlyNet = $("fp-only-net").checked;
  let q = supabase.from("v_mrp_procurement_plan").select("*").limit(2000);
  if (start) q = q.gte("month_start", start);
  if (end) q = q.lte("month_start", end);
  if (mk && mk !== "all") q = q.eq("material_kind", mk);
  if (onlyNet) q = q.neq("net_need_qty", 0);
  const { data } = await q;
  return data || [];
}

// fetchCurrentOvRows removed — overlay exports now use cached overlayLastRows

// fetchCurrentConvRows removed — conversion exports use cached convLastRows

// bootstrap
window.addEventListener("DOMContentLoaded", async () => {
  initUi();
  const hb = document.getElementById("homeBtn");
  if (hb) hb.addEventListener("click", () => Platform.goHome());
  const ok = await showAccess();
  if (!ok) return;
  // initial loads
  loadFinalPlan();
});
