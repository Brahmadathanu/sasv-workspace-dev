// sales-viewer.js
// A simple viewer for sales data with filtering, KPIs, trends, top N, and detail grid.
// Uses Supabase as the backend data source.
import { supabase } from "./supabaseClient.js";

// ---------- Tiny helpers ----------
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
function addMonths(d, m) {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + m);
  return x;
}
function ymd(date) {
  return date.toISOString().slice(0, 10);
}
function monthKey(dateStr) {
  // '2025-09-01' -> 'Sep-2025'
  const d = new Date(dateStr + "T00:00:00Z");
  return d
    .toLocaleString("en-GB", { month: "short", year: "numeric" })
    .replace(" ", "-");
}

function groupBy(arr, keyFn) {
  const m = new Map();
  for (const r of arr) {
    const k = keyFn(r);
    const a = m.get(k);
    if (a) a.push(r);
    else m.set(k, [r]);
  }
  return m; // Map
}
function sumBy(arr, sel) {
  let s = 0;
  for (const r of arr || []) s += +sel(r) || 0;
  return s;
}

// ---------- Filters state ----------
const state = {
  anchor: startOfMonth(new Date()),
  range: 12,
  regionId: "",
  godownId: "",
  mode: "qty_billed",
  activeOnly: true,
};

// ---------- UI wiring ----------
function bindFilters() {
  const m = $("f-anchor");
  // set default to current month (YYYY-MM)
  m.value = state.anchor.toISOString().slice(0, 7);
  m.addEventListener("change", () => {
    state.anchor = startOfMonth(new Date(m.value + "-01T00:00:00Z"));
  });

  // chips
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

  $("btn-apply").addEventListener("click", runAll);
  $("btn-export").addEventListener("click", exportCSV);
}

// ---------- Data fetchers ----------
async function fetchWindowed() {
  const start = addMonths(state.anchor, -state.range);
  const from = ymd(start);
  const to = ymd(state.anchor);
  let q = supabase
    .from("v_sdv_sales_enriched")
    .select(
      "month_start, region_code, region_id, godown_id, product_name, sku_id, is_active, qty_billed, qty_units, qty_base"
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
  const { data, error } = await supabase
    .from("v_sdv_freshness")
    .select("*")
    .single();
  if (error) return null;
  return data;
}

// ---------- KPI compute & render ----------
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

// ---------- Trend (IK vs OK) ----------
function renderTrend(rows) {
  const measure = state.mode;
  const byMonthRegion = new Map(); // key: month -> {IK:sum, OK:sum}
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
    const label = monthKey(m);
    tr.innerHTML = `<td>${label}</td><td>${fmtInt(b.IK)}</td><td>${fmtInt(
      b.OK
    )}</td><td>${fmtInt(total)}</td>`;
    tb.appendChild(tr);
  }
}

// ---------- Top N ----------
function renderTopN(rows) {
  const measure = state.mode;
  const bySku = new Map();
  for (const r of rows) {
    const k = r.sku_id + "";
    const prev = bySku.get(k) || { name: r.product_name, total: 0 };
    prev.total += +r[measure] || 0;
    bySku.set(k, prev);
  }
  const top = Array.from(bySku.entries())
    .map(([sku, { name, total }]) => ({ sku, name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);
  const tb = $("tb-topn");
  tb.innerHTML = "";
  for (const r of top) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${r.name}</td><td>${fmtInt(r.total)}</td>`;
    tb.appendChild(tr);
  }
}

// ---------- Detail grid ----------
function renderDetail(rows) {
  const measure = state.mode;
  const monthsSet = new Set(rows.map((r) => r.month_start));
  const months = Array.from(monthsSet).sort();
  const monthLabels = months.map((m) => monthKey(m));

  const th = $("th-detail");
  th.innerHTML =
    "<th>SKU / Product</th>" +
    monthLabels.map((l) => `<th>${l}</th>`).join("") +
    "<th>Total</th>";

  const g = groupBy(rows, (r) => r.sku_id + "|" + r.product_name);
  const tb = $("tb-detail");
  tb.innerHTML = "";

  for (const [key, arr] of g.entries()) {
    const [sku, name] = key.split("|");
    const byMonth = groupBy(arr, (r) => r.month_start);
    let total = 0;
    const tds = months
      .map((m) => {
        const v = sumBy(byMonth.get(m), (r) => r[measure]);
        total += v;
        return `<td>${fmtInt(v)}</td>`;
      })
      .join("");
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${name}</td>${tds}<td>${fmtInt(total)}</td>`;
    tb.appendChild(tr);
  }
}

// ---------- Freshness ----------
function renderFreshness(info) {
  const el = $("freshness");
  if (!info) {
    el.textContent = "Freshness: —";
    return;
  }
  const ts = new Date(info.max_source_at).toLocaleString();
  el.textContent = `Freshness: ${info.freshness_status} · ${ts}`;
}

// ---------- Export ----------
async function exportCSV() {
  const rows = await fetchWindowed();
  const measure = state.mode;
  const months = Array.from(new Set(rows.map((r) => r.month_start))).sort();
  const header = ["product_name", ...months.map((m) => monthKey(m)), "total"];

  const g = groupBy(rows, (r) => r.sku_id + "|" + r.product_name);
  const data = [];
  for (const [key, arr] of g.entries()) {
    const [sku, name] = key.split("|");
    const byMonth = groupBy(arr, (r) => r.month_start);
    const row = [name];
    let total = 0;
    for (const m of months) {
      const v = sumBy(byMonth.get(m), (r) => r[measure]);
      row.push(v);
      total += v;
    }
    row.push(total);
    data.push(row);
  }
  const csv = [header.join(","), ...data.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sales_window.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- Main runner ----------
async function runAll() {
  const rows = await fetchWindowed();
  renderTrend(rows);
  renderTopN(rows);
  renderDetail(rows);
  renderKPIs(computeKPIs(rows));
  renderFreshness(await fetchFreshness());
}

// ---------- Boot ----------
bindFilters();
runAll().catch((err) => {
  console.error(err);
  alert("Error: " + err.message);
});
