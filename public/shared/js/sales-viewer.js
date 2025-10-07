/* global Chart */

// Adjust this path if your Supabase client lives elsewhere
import { supabase } from "./supabaseClient.js";

// ---------- Helpers ----------
const $ = (id) => document.getElementById(id);
const fmtInt = (n) =>
  n == null || Number.isNaN(n) ? "—" : Math.round(n).toLocaleString();
const pct = (v) =>
  v == null || !isFinite(v) ? "—" : (v * 100).toFixed(1) + "%";

function startOfMonth(d) {
  const x = new Date(d);
  x.setUTCDate(1);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function bindDetailSearch() {
  const input = $("dg-search");
  const btnClear = $("dg-clear");
  if (!input) return;
  input.addEventListener("input", () => {
    state.detailQuery = input.value || "";
    state.pageIndex = 0;
    renderDetailPage();
  });
  btnClear?.addEventListener("click", () => {
    state.detailQuery = "";
    input.value = "";
    state.pageIndex = 0;
    renderDetailPage();
  });
}
function addMonths(d, m) {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + m);
  return x;
}
function ymd(date) {
  return date.toISOString().slice(0, 10);
}
function monthKey(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  return d
    .toLocaleString("en-GB", { month: "short", year: "numeric" })
    .replace(" ", "-");
}
function fmtDateTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function groupBy(arr, keyFn) {
  const m = new Map();
  for (const r of arr) {
    const k = keyFn(r);
    const a = m.get(k);
    if (a) a.push(r);
    else m.set(k, [r]);
  }
  return m;
}
function sumBy(arr, sel) {
  let s = 0;
  for (const r of arr || []) s += +sel(r) || 0;
  return s;
}
function distinct(arr) {
  return Array.from(new Set(arr));
}
function titleCase(s) {
  return (s || "").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------- State ----------
const state = {
  anchor: startOfMonth(new Date()),
  range: 12,
  regionId: "",
  godownId: "",
  mode: "qty_billed",
  activeOnly: true,
  tab: "overview",
  rows: [],
  freshness: null,
  detailQuery: "", // <- add this line
  // detail pagination
  pageIndex: 0,
  pageSize: 50,
};

// ---------- Filters UI ----------
function bindFilters() {
  const m = $("f-anchor");
  m.value = state.anchor.toISOString().slice(0, 7);
  m.addEventListener(
    "change",
    () => (state.anchor = startOfMonth(new Date(m.value + "-01T00:00:00Z")))
  );

  [$("chip-3"), $("chip-6"), $("chip-12")].forEach((ch) => {
    ch.addEventListener("click", () => {
      [$("chip-3"), $("chip-6"), $("chip-12")].forEach((x) =>
        x.classList.remove("active")
      );
      ch.classList.add("active");
      state.range = +ch.dataset.range;
    });
  });

  $("f-region").addEventListener(
    "change",
    (e) => (state.regionId = e.target.value)
  );
  $("f-godown").addEventListener(
    "change",
    (e) => (state.godownId = e.target.value)
  );
  $("f-mode").addEventListener("change", (e) => (state.mode = e.target.value));
  $("f-active").addEventListener(
    "change",
    (e) => (state.activeOnly = e.target.checked)
  );

  $("btn-apply").addEventListener("click", () => {
    state.pageIndex = 0;
    runAll();
  });
  $("btn-export").addEventListener("click", exportCSV);

  // small-screen filter toggle
  const rail = $("filter-rail");
  $("btn-toggle-filters")?.addEventListener("click", () =>
    rail.classList.toggle("open")
  );
}

// ---------- Tabs ----------
function bindTabs() {
  const pills = Array.from(document.querySelectorAll('.tab-pill[role="tab"]'));
  function activate(tab) {
    state.tab = tab;
    pills.forEach((p) =>
      p.setAttribute("aria-selected", String(p.dataset.tab === tab))
    );
    document
      .querySelectorAll(".tabpanel")
      .forEach((tp) => tp.classList.toggle("active", tp.id === "tab-" + tab));
    renderActiveTab();
    location.hash = tab;
  }
  pills.forEach((p) =>
    p.addEventListener("click", () => activate(p.dataset.tab))
  );
  const initial = (location.hash || "").replace("#", "");
  if (
    [
      "overview",
      "trends",
      "mix",
      "top",
      "detail",
      "exceptions",
      "status",
    ].includes(initial)
  ) {
    activate(initial);
  } else {
    activate("overview");
  }
}

// ---------- Data fetchers ----------
async function fetchWindowed() {
  const start = addMonths(state.anchor, -state.range);
  const from = ymd(start);
  const to = ymd(state.anchor);
  let q = supabase
    .from("v_sdv_sales_enriched")
    .select(
      "month_start, month_label_short, region_code, region_id, godown_id, godown_code, product_id, product_name, category_name, subcategory_name, sku_id, pack_size, uom, is_active, qty_billed, qty_units, qty_base"
    )
    .gte("month_start", from)
    .lte("month_start", to);
  if (state.activeOnly) q = q.eq("is_active", true);
  if (state.regionId) q = q.eq("region_id", +state.regionId);
  if (state.godownId) q = q.eq("godown_id", +state.godownId);
  const { data, error } = await q.limit(100000);
  if (error) throw error;
  return data || [];
}

async function fetchFreshness() {
  const { data } = await supabase
    .from("v_sdv_freshness")
    .select("*")
    .maybeSingle();
  return data || null;
}

// ---------- KPI compute & render (Overview) ----------
function computeKPIs(rows) {
  const measure = state.mode;
  const mm = groupBy(rows, (r) => r.month_start);
  const months = Array.from(mm.keys()).sort();
  const anchorKey = ymd(state.anchor);
  const prevKey = ymd(addMonths(state.anchor, -1));
  const yoyKey = ymd(addMonths(state.anchor, -12));

  const series = months.map((k) => ({
    key: k,
    qty: sumBy(mm.get(k), (r) => r[measure]),
  }));
  const find = (k) => series.find((s) => s.key === k)?.qty ?? 0;

  const MTD = find(anchorKey);
  const PREV = find(prevKey);
  const YOY = find(yoyKey);
  const MoM = PREV ? (MTD - PREV) / PREV : null;
  const YoY = YOY ? (MTD - YOY) / YOY : null;

  const last3Keys = [0, -1, -2].map((i) => ymd(addMonths(state.anchor, i)));
  const L3Mvals = last3Keys.map(find);
  const L3Mavg = L3Mvals.filter((v) => v != null).length
    ? L3Mvals.reduce((a, b) => a + b, 0) / L3Mvals.length
    : null;

  const last12Keys = Array.from({ length: 12 }, (_, i) =>
    ymd(addMonths(state.anchor, -i))
  ).reverse();
  const L12M = last12Keys.map(find).reduce((a, b) => a + b, 0);

  return { MTD, PREV, MoM, YoY, L3Mavg, L12M };
}
function renderKPIs(k) {
  $("k-mtd").textContent = fmtInt(k.MTD);
  $("k-prev").textContent = fmtInt(k.PREV);
  $("k-mom").textContent = pct(k.MoM);
  $("k-yoy").textContent = pct(k.YoY);
  $("k-l3m").textContent = fmtInt(k.L3Mavg);
  $("k-l12m").textContent = fmtInt(k.L12M);
}

// ---------- Overview: IK/OK trend table ----------
function renderIkOkTable(rows) {
  const measure = state.mode;
  const byMonthRegion = new Map();
  for (const r of rows) {
    const m = r.month_start;
    const reg = r.region_code || "—";
    if (!byMonthRegion.has(m)) byMonthRegion.set(m, { IK: 0, OK: 0 });
    const bucket = byMonthRegion.get(m);
    bucket[reg] = (bucket[reg] || 0) + (+r[measure] || 0);
  }
  const months = Array.from(byMonthRegion.keys()).sort();
  const th = $("th-trend");
  th.innerHTML = "<th>Month</th><th>IK</th><th>OK</th><th>Total</th>";
  const tb = $("tb-trend");
  tb.innerHTML = "";
  for (const m of months) {
    const b = byMonthRegion.get(m);
    const total = (b.IK || 0) + (b.OK || 0);
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${monthKey(m)}</td><td>${fmtInt(b.IK)}</td><td>${fmtInt(
      b.OK
    )}</td><td>${fmtInt(total)}</td>`;
    tb.appendChild(tr);
  }
}

// ---------- Detail grid with pagination ----------
let detailMonths = [];
let detailRowsGrouped = [];
function buildDetail(rows) {
  const measure = state.mode;
  const monthsSet = new Set(rows.map((r) => r.month_start));
  detailMonths = Array.from(monthsSet).sort();

  // group per SKU including pack & uom in the display label
  const g = groupBy(
    rows,
    (r) =>
      r.sku_id +
      "|" +
      r.product_name +
      "|" +
      (r.pack_size ?? "") +
      "|" +
      (r.uom ?? "")
  );
  detailRowsGrouped = Array.from(g.entries())
    .map(([key, arr]) => {
      const [sku, name, pack, uom] = key.split("|");
      const byMonth = groupBy(arr, (r) => r.month_start);
      const series = detailMonths.map((m) =>
        sumBy(byMonth.get(m), (r) => r[measure])
      );
      const total = series.reduce((a, b) => a + b, 0);

      // Build a nice label like: "SKU 1234 · Product Name (450 mL)"
      const packText =
        pack && uom ? ` (${pack} ${uom})` : pack ? ` (${pack})` : "";
      const display = `SKU ${sku} · ${name}${packText}`;

      return { sku, name, pack, uom, display, series, total };
    })
    .sort((a, b) => b.total - a.total);
}

function getDetailFilteredRows() {
  const q = (state.detailQuery || "").trim().toLowerCase();
  if (!q) return detailRowsGrouped;
  return detailRowsGrouped.filter((r) => {
    // Search in name we render (includes product, pack, UOM) and sku id
    return (
      (r.display || "").toLowerCase().includes(q) ||
      String(r.sku || "").includes(q)
    );
  });
}

function renderDetailHeader() {
  const th = $("th-detail");
  if (!th) return;
  th.innerHTML =
    "<th>SKU · Product (Pack)</th>" +
    detailMonths
      .map((m) => `<th title="${monthKey(m)}">${monthKey(m)}</th>`)
      .join("") +
    "<th>Total</th>";
}

function renderDetailPage() {
  const tb = $("tb-detail");
  if (!tb) return;
  tb.innerHTML = "";

  const filtered = getDetailFilteredRows();
  const start = state.pageIndex * state.pageSize;
  const slice = filtered.slice(start, start + state.pageSize);

  for (const row of slice) {
    const tds = row.series.map((v) => `<td>${fmtInt(v)}</td>`).join("");
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${row.display}</td>${tds}<td>${fmtInt(row.total)}</td>`;
    tb.appendChild(tr);
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  $("pg-info").textContent = `Page ${state.pageIndex + 1} of ${totalPages} — ${
    filtered.length
  } SKUs`;
  $("pg-prev").disabled = state.pageIndex === 0;
  $("pg-next").disabled = state.pageIndex >= totalPages - 1;
}

function bindDetailPager() {
  $("pg-prev").addEventListener("click", () => {
    if (state.pageIndex > 0) {
      state.pageIndex--;
      renderDetailPage();
    }
  });
  $("pg-next").addEventListener("click", () => {
    const totalPages = Math.max(
      1,
      Math.ceil(detailRowsGrouped.length / state.pageSize)
    );
    if (state.pageIndex < totalPages - 1) {
      state.pageIndex++;
      renderDetailPage();
    }
  });
  $("pg-size").addEventListener("change", (e) => {
    state.pageSize = Math.max(20, Math.min(200, +e.target.value || 50));
    state.pageIndex = 0;
    renderDetailPage();
  });
}

// ---------- Freshness ----------
function renderFreshness(info) {
  const el = $("freshness");
  if (!info) {
    el.className = "tag";
    el.textContent = "Freshness: —";
    return;
  }
  const status = String(info.freshness_status || "").toLowerCase(); // green|amber|red
  const nice = titleCase(status);
  const ts = fmtDateTime(info.max_source_at);
  el.className = `tag ${status}`;
  el.textContent = `Freshness: ${nice} • ${ts}`;
}

// ---------- Export (detail CSV) ----------
async function exportCSV() {
  const header = [
    "product_name",
    ...detailMonths.map((m) => monthKey(m)),
    "total",
  ];
  const data = detailRowsGrouped.map((r) => [r.name, ...r.series, r.total]);
  const csv = [header.join(","), ...data.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sales_window.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- Trends: Chart.js (line) ----------
let trendChart = null;
function destroyTrendChart() {
  if (trendChart) {
    trendChart.destroy();
    trendChart = null;
  }
}

function buildSeriesForLevel(rows, level) {
  const measure = state.mode;
  const months = distinct(rows.map((r) => r.month_start)).sort();
  const labels = months.map((m) => monthKey(m));

  let keyFn = null,
    labelFn = null;
  if (level === "region") {
    keyFn = (r) => r.region_code || "—";
    labelFn = (k) => k;
  } else if (level === "godown") {
    keyFn = (r) => r.godown_code || "G" + (r.godown_id || "");
    labelFn = (k) => k;
  } else if (level === "product") {
    keyFn = (r) => r.product_name || "Product " + (r.product_id || "");
    labelFn = (k) => k;
  } else {
    // sku
    keyFn = (r) => (r.sku_id || "") + " · " + (r.product_name || "");
    labelFn = (k) => k;
  }

  const byKey = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    const current = byKey.get(k) || { total: 0, byMonth: new Map() };
    current.total += +r[measure] || 0;
    current.byMonth.set(
      r.month_start,
      (current.byMonth.get(r.month_start) || 0) + (+r[measure] || 0)
    );
    byKey.set(k, current);
  }

  const topK = Math.max(1, Math.min(50, +($("t-topk")?.value || 10)));
  const top = Array.from(byKey.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, topK);

  const datasets = top.map(([k, obj]) => {
    const data = months.map((m) => obj.byMonth.get(m) || 0);
    return { label: labelFn(k), data, tension: 0.25, fill: false };
  });

  return { labels, datasets };
}

function renderTrendChart(rows) {
  destroyTrendChart();
  const ctx = $("trend-canvas").getContext("2d");
  const level = $("t-level").value;
  const { labels, datasets } = buildSeriesForLevel(rows, level);
  trendChart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "nearest", intersect: false },
      plugins: { legend: { position: "top" }, title: { display: false } },
      scales: { x: { ticks: { maxRotation: 0 } }, y: { beginAtZero: true } },
    },
  });
}

// ---------- Mix: Chart.js (stacked bars) ----------
let mixChart = null;
function destroyMixChart() {
  if (mixChart) {
    mixChart.destroy();
    mixChart = null;
  }
}

function buildMixSeries(rows) {
  const measure = state.mode;
  const months = distinct(rows.map((r) => r.month_start)).sort();
  const labels = months.map((m) => monthKey(m));

  // Rank subcategories by total over window
  const bySub = new Map();
  for (const r of rows) {
    const sub = r.subcategory_name || "—";
    const cur = bySub.get(sub) || { total: 0, byMonth: new Map() };
    const val = +r[measure] || 0;
    cur.total += val;
    cur.byMonth.set(r.month_start, (cur.byMonth.get(r.month_start) || 0) + val);
    bySub.set(sub, cur);
  }

  const topK = Math.max(2, Math.min(20, +($("m-topk")?.value || 8)));
  const sorted = Array.from(bySub.entries()).sort(
    (a, b) => b[1].total - a[1].total
  );
  const top = sorted.slice(0, topK).map(([k, v]) => ({ k, v }));
  const others = sorted.slice(topK);

  // Build datasets for topK + one 'Other'
  const datasets = top.map(({ k, v }) => {
    const data = months.map((m) => v.byMonth.get(m) || 0);
    return { label: k, data, stack: "mix" };
  });

  if (others.length) {
    const byMonthOther = new Map();
    for (const [, v] of others) {
      for (const m of months) {
        byMonthOther.set(
          m,
          (byMonthOther.get(m) || 0) + (v.byMonth.get(m) || 0)
        );
      }
    }
    datasets.push({
      label: "Other",
      data: months.map((m) => byMonthOther.get(m) || 0),
      stack: "mix",
    });
  }

  return { labels, datasets };
}

function renderMixChart(rows) {
  destroyMixChart();
  const ctx = $("mix-canvas").getContext("2d");
  const { labels, datasets } = buildMixSeries(rows);
  mixChart = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "top" } },
      scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
    },
  });
}

// ---------- Top / Bottom ----------
function renderTopBottom(rows) {
  const measure = state.mode;
  const entity = $("tb-entity").value; // sku|product
  const order = $("tb-order").value; // asc|desc
  const N = Math.max(5, Math.min(100, +($("tb-n").value || 20)));

  const map = new Map();
  for (const r of rows) {
    const key =
      entity === "product"
        ? r.product_name || `Product ${r.product_id || ""}`
        : `${r.product_name || ""}`;
    const cur = map.get(key) || 0;
    map.set(key, cur + (+r[measure] || 0));
  }

  let arr = Array.from(map.entries()).map(([name, total]) => ({ name, total }));
  arr.sort((a, b) => (order === "asc" ? a.total - b.total : b.total - a.total));
  arr = arr.slice(0, N);

  const tb = $("tb-topn");
  tb.innerHTML = "";
  for (const r of arr) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${r.name}</td><td>${fmtInt(r.total)}</td>`;
    tb.appendChild(tr);
  }
}

// ---------- Exceptions: zero sellers ----------
async function renderZeroSellers() {
  const n = Math.max(1, Math.min(12, +($("ex-n").value || 3)));

  // Call the RPC to get absolute-zero sellers
  const { data, error } = await supabase.rpc("sdv_zero_sellers_abs", {
    p_anchor_date: ymd(state.anchor),
    p_months: n,
    p_region_id: state.regionId ? +state.regionId : null,
    p_godown_id: state.godownId ? +state.godownId : null,
    p_active_only: state.activeOnly, // respects the "Active SKUs only" filter
  });

  const tb = $("tb-zero");
  tb.innerHTML = "";

  if (error) {
    console.error(error);
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4" class="muted">Error: ${error.message}</td>`;
    tb.appendChild(tr);
    return;
  }

  const rows = data || [];
  if (!rows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4" class="muted">No absolute zero-sellers found for last ${n} months in this scope.</td>`;
    tb.appendChild(tr);
    return;
  }

  // Sort A–Z
  rows.sort((a, b) =>
    (a.product_name || "").localeCompare(b.product_name || "")
  );

  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.product_name || "—"}</td>
      <td>${r.is_active ? "Yes" : "No"}</td>
      <td>${
        state.regionId
          ? state.regionId === "1"
            ? "IK"
            : state.regionId === "2"
            ? "OK"
            : state.regionId
          : "—"
      }</td>
      <td>${
        state.godownId
          ? { 1: "HO_IK", 2: "HO_OK", 3: "KKD" }[state.godownId] ||
            state.godownId
          : "—"
      }</td>
    `;
    tb.appendChild(tr);
  }
}

// ---------- Status ----------
function renderStatus() {
  const f = state.freshness;
  const from = ymd(addMonths(state.anchor, -state.range));
  const to = ymd(state.anchor);
  const scope = [
    state.regionId ? `Region=${state.regionId}` : null,
    state.godownId ? `Godown=${state.godownId}` : null,
    state.activeOnly ? "ActiveOnly" : "All SKUs",
    `Measure=${state.mode}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const counts = {
    rows: state.rows.length,
    months: distinct(state.rows.map((r) => r.month_start)).length,
    skus: distinct(state.rows.map((r) => r.sku_id)).length,
    products: distinct(state.rows.map((r) => r.product_id)).length,
  };

  const html = `
    <p><strong>Window:</strong> ${from} → ${to}</p>
    <p><strong>Scope:</strong> ${
      scope || "All regions/godowns; active-only on"
    }</p>
    <p><strong>Counts:</strong> Rows=${counts.rows.toLocaleString()} · Months=${
    counts.months
  } · SKUs=${counts.skus} · Products=${counts.products}</p>
    <p><strong>Freshness:</strong> ${
      f
        ? `${titleCase(f.freshness_status)} • ${fmtDateTime(f.max_source_at)}`
        : "—"
    }</p>
    <p class="muted">Measures: qty_billed, qty_units, qty_base (selected via Qty Mode). Tabs compute client-side from the windowed dataset.</p>
  `;
  $("status-content").innerHTML = html;
}

// ---------- Run & Render ----------
async function runAll() {
  const [rows, fresh] = await Promise.all([fetchWindowed(), fetchFreshness()]);
  state.rows = rows;
  state.freshness = fresh;

  // Overview
  renderKPIs(computeKPIs(rows));
  renderIkOkTable(rows);
  renderFreshness(fresh);

  // Detail grid (build + first page)
  buildDetail(rows);
  renderDetailHeader();
  renderDetailPage();

  // Active tab-specific
  if (state.tab === "trends") renderTrendChart(rows);
  if (state.tab === "mix") renderMixChart(rows);
  if (state.tab === "top") renderTopBottom(rows);
  if (state.tab === "exceptions") {
    renderZeroSellers();
    return;
  }
  if (state.tab === "status") renderStatus();
}

function renderActiveTab() {
  if (state.tab === "overview") return;
  if (state.tab === "trends") {
    renderTrendChart(state.rows);
    return;
  }
  if (state.tab === "mix") {
    renderMixChart(state.rows);
    return;
  }
  if (state.tab === "top") {
    renderTopBottom(state.rows);
    return;
  }
  if (state.tab === "detail") {
    renderDetailHeader();
    renderDetailPage();
    return;
  }
  if (state.tab === "exceptions") {
    renderZeroSellers(state.rows);
    return;
  }
  if (state.tab === "status") {
    renderStatus();
    return;
  }
}

// ---------- Bind per-tab controls ----------
function bindTrendsControls() {
  $("t-level").addEventListener("change", () => renderTrendChart(state.rows));
  $("t-topk").addEventListener("change", () => renderTrendChart(state.rows));
  $("t-refresh").addEventListener("click", () => renderTrendChart(state.rows));
}
function bindMixControls() {
  $("m-topk").addEventListener("change", () => renderMixChart(state.rows));
  $("m-refresh").addEventListener("click", () => renderMixChart(state.rows));
}
function bindTopControls() {
  $("tb-entity").addEventListener("change", () => renderTopBottom(state.rows));
  $("tb-order").addEventListener("change", () => renderTopBottom(state.rows));
  $("tb-n").addEventListener("change", () => renderTopBottom(state.rows));
  $("tb-refresh").addEventListener("click", () => renderTopBottom(state.rows));
}
function bindExceptionsControls() {
  $("ex-n").addEventListener("change", () => renderZeroSellers());
  $("ex-refresh").addEventListener("click", () => renderZeroSellers());
}

// ---------- Boot ----------
bindFilters();
bindTabs();
bindDetailPager();
bindDetailSearch();
bindTrendsControls();
bindMixControls();
bindTopControls();
bindExceptionsControls();
runAll().catch((err) => {
  console.error(err);
  alert("Error: " + err.message);
});
