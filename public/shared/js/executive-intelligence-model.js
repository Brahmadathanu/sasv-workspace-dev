// Executive Intelligence (module key executive-mis-dashboard): pure, DOM-free presentation model.
// Everything here is deterministic and unit-testable in Node with fixtures. It performs NO server calls and NO monetary
// arithmetic beyond bar-width ratios; every rupee figure is shown exactly as the server supplied it. Missing is never zero.

export const LENSES = Object.freeze([
  { id: "overview", label: "Overview", short: "Overview" },
  { id: "finance", label: "Finance", short: "Finance" },
  { id: "sales", label: "Sales Performance", short: "Sales" },
  { id: "inventory", label: "Materials Inventory", short: "Materials" },
  { id: "finished-goods", label: "Finished Goods", short: "Finished Goods" },
  { id: "production", label: "Production Performance", short: "Production" },
  { id: "alerts", label: "Management Alerts", short: "Alerts" },
]);
export const DEFAULT_LENS = "overview";

// Unknown/forged hash values fall back to the default; a lens is never invented from user input.
export function lensFromHash(hash) {
  const id = String(hash || "").replace(/^#/, "").trim().toLowerCase();
  return LENSES.some((l) => l.id === id) ? id : DEFAULT_LENS;
}

export const hasValue = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
const num = (v) => (hasValue(v) ? Number(v) : null);

// ---------------------------------------------------------------------------------------------------------------------
// Materials Inventory (R1 pinned contract; see docs/executive-mis-g7-server/R1_ACCEPTANCE.md)
// ---------------------------------------------------------------------------------------------------------------------
export const INVENTORY_CANONICAL_FILTERS = Object.freeze([
  { value: "all", label: "All materials" },
  { value: "RM", label: "Raw Material" },
  { value: "PM", label: "Packing Material" },
  { value: "IND", label: "Indirect Materials & Utilities" },
]);
export const INVENTORY_CATEGORY_LABELS = Object.freeze({
  RM: "Raw Material",
  PM: "Packing Material",
  IND: "Indirect Materials & Utilities",
});
// Every canonical field the R1 candidate appends to v_mis_inventory_tab_summary.
export const CANONICAL_INVENTORY_FIELDS = Object.freeze([
  "canonical_rm_known_value", "canonical_rm_item_count", "canonical_rm_valuation_gap_count",
  "canonical_pm_known_value", "canonical_pm_item_count", "canonical_pm_valuation_gap_count",
  "canonical_ind_known_value", "canonical_ind_item_count", "canonical_ind_valuation_gap_count",
  "inventory_known_value", "unclassified_known_value", "unclassified_item_count", "valuation_gap_item_count",
  "zero_quantity_item_count", "duplicate_item_row_count", "missing_item_id_count", "canonical_inventory_scope_note",
]);

// Canonical contract is "available" only when the appended fields are present AND at least one source-row count is a
// real number. Before install the keys are absent; after forward recovery they are typed NULL. Both => unavailable,
// never zero, and never a fallback to the legacy consumables/fuel split.
export function inventoryCanonicalAvailable(s) {
  if (!s || typeof s !== "object") return false;
  if (!CANONICAL_INVENTORY_FIELDS.every((k) => k in s)) return false;
  return ["canonical_rm_item_count", "canonical_pm_item_count", "canonical_ind_item_count", "unclassified_item_count"].some((k) => hasValue(s[k]));
}

export function analyzeInventorySummary(s) {
  if (!s) return { state: "missing" };
  if (!inventoryCanonicalAvailable(s)) return { state: "unavailable" };
  const groups = ["RM", "PM", "IND"].map((code) => {
    const k = code.toLowerCase();
    const count = num(s[`canonical_${k}_item_count`]);
    const gaps = num(s[`canonical_${k}_valuation_gap_count`]);
    const known = num(s[`canonical_${k}_known_value`]);
    return {
      code, label: INVENTORY_CATEGORY_LABELS[code], count, gaps, known,
      // NULL known value is "not certified zero": no items => "No items", items but nothing valued => unavailable.
      valueState: known !== null ? "value" : count === 0 ? "none" : "unavailable",
    };
  });
  // Diagnostic counts fail closed: a missing/NULL count is "unknown", never an implied zero, and withdraws certification.
  const unclassifiedCount = num(s.unclassified_item_count);
  const dup = num(s.duplicate_item_row_count);
  const missingId = num(s.missing_item_id_count);
  const gapTotal = num(s.valuation_gap_item_count);
  const zeroQty = num(s.zero_quantity_item_count);
  const diagnosticsComplete = [unclassifiedCount, dup, missingId, gapTotal].every((v) => v !== null);
  const groupCountsKnown = groups.every((g) => g.count !== null);
  const totalRows = diagnosticsComplete && groupCountsKnown ? groups.reduce((a, g) => a + g.count, 0) + unclassifiedCount : null;
  const identityClean = dup === 0 && missingId === 0;
  const certified = diagnosticsComplete && groupCountsKnown && unclassifiedCount === 0 && identityClean && gapTotal === 0;
  return {
    state: "ok",
    groups,
    knownValue: num(s.inventory_known_value),
    unclassified: { count: unclassifiedCount, value: num(s.unclassified_known_value) },
    gapTotal, zeroQty, dup, missingId, totalRows, diagnosticsComplete,
    valuedRows: totalRows !== null ? Math.max(0, totalRows - gapTotal) : null,
    // Source rows are item counts only when identity is proven clean.
    rowWord: identityClean ? "items" : "source rows",
    certified,
    scopeNote: s.canonical_inventory_scope_note || "",
    // Mixed-basis or non-positive values cannot be shown as proportions of one total.
    composition: barSeries(
      groups.filter((g) => g.known !== null).map((g) => ({ label: g.label, value: g.known })),
      { minRows: 2 },
    ),
  };
}

// One wording for the canonical Materials Inventory lens AND the Overview, so the two can never disagree.
export function inventoryCoverage(a, fmt) {
  if (!a || a.state !== "ok") return { headline: "Unavailable", detail: "Canonical valuation is not available.", certified: false };
  const reasons = [
    a.gapTotal > 0 && `${fmt.integer(a.gapTotal)} ${a.rowWord} lack a usable valuation`,
    a.unclassified.count > 0 && `${fmt.integer(a.unclassified.count)} unclassified`,
    a.dup > 0 && `${fmt.integer(a.dup)} duplicate item rows`,
    a.missingId > 0 && `${fmt.integer(a.missingId)} rows without an item id`,
  ].filter(Boolean);
  if (!a.diagnosticsComplete) {
    return { headline: a.knownValue !== null ? "Known value" : "Unavailable", detail: "Coverage unavailable: the server did not supply every diagnostic count, so this is not a certified total.", certified: false, reasons };
  }
  return {
    headline: a.certified ? "Stock value" : "Known stock value",
    detail: `${fmt.integer(a.valuedRows)} of ${fmt.integer(a.totalRows)} ${a.rowWord} valued${a.zeroQty ? ` \u00b7 ${fmt.integer(a.zeroQty)} with zero quantity (valid zero)` : ""}${reasons.length ? ` \u00b7 ${reasons.join(" \u00b7 ")}` : ""}`,
    certified: a.certified,
    reasons,
  };
}

// A filter value is only sent if it belongs to the pinned set. Unavailable canonical contract => only "all".
export function sanitizeInventoryFilter(value, canonicalAvailable) {
  if (value === "all") return "all";
  if (canonicalAvailable === false) return "all";
  return INVENTORY_CANONICAL_FILTERS.some((f) => f.value === value) ? value : "all";
}

// ---------------------------------------------------------------------------------------------------------------------
// Charts: only real, same-unit, non-negative current-position series. Anything else returns null (table/value fallback).
// ---------------------------------------------------------------------------------------------------------------------
export function barSeries(items, { minRows = 2 } = {}) {
  const rows = (items || []).filter((i) => i && hasValue(i.value)).map((i) => ({ label: i.label, value: Number(i.value) }));
  if (rows.length < minRows || rows.some((r) => r.value < 0)) return null;
  const max = Math.max(...rows.map((r) => r.value));
  if (!(max > 0)) return null;
  // A zero is drawn as exactly zero width; any positive value keeps a visible minimum sliver.
  return { max, rows: rows.map((r) => ({ ...r, pct: r.value === 0 ? 0 : Math.max(2, Math.round((r.value / max) * 100)) })) };
}

// Signed Tally balances: magnitudes are compared, the signed figure is still the one displayed.
export function financeBars(row) {
  if (!row || !hasValue(row.receivables_sundry_debtors) || !hasValue(row.payables_sundry_creditors)) return null;
  const series = barSeries([
    { label: "Receivables - Sundry Debtors", value: Math.abs(Number(row.receivables_sundry_debtors)), signed: row.receivables_sundry_debtors },
    { label: "Payables - Sundry Creditors", value: Math.abs(Number(row.payables_sundry_creditors)), signed: row.payables_sundry_creditors },
  ]);
  if (!series) return null;
  series.rows[0].signed = Number(row.receivables_sundry_debtors);
  series.rows[1].signed = Number(row.payables_sundry_creditors);
  return series;
}

// Distinct pipeline stages (batches). The active total also includes Not Initiated batches, which the server does not
// supply separately, so it is deliberately not derived here.
export function pipelineBars(p) {
  if (!p) return null;
  return barSeries([
    { label: "Work in Process", value: p.work_in_process_batch_count },
    { label: "Finished Goods Bulk", value: p.finished_goods_bulk_batch_count },
    { label: "Bottled Stock", value: p.bottled_stock_batch_count },
  ], { minRows: 3 });
}

// ---------------------------------------------------------------------------------------------------------------------
// Overview narrative: facts supplied by the server only. No targets, trends, achievement or month-on-month claims.
// ---------------------------------------------------------------------------------------------------------------------
export function overviewNarrative(row, pipeline, fmt, inventory = null) {
  const out = [];
  if (row) {
    if (hasValue(row.net_sundry_position)) {
      const n = Number(row.net_sundry_position);
      out.push({
        lens: "finance",
        text: `Net sundry position is ${fmt.currency(n)}: ${n < 0 ? "payables exceed receivables" : n > 0 ? "receivables exceed payables" : "receivables and payables are level"}${row.financial_position_date ? ` (position ${fmt.date(row.financial_position_date)})` : ""}.`,
      });
    }
    if (hasValue(row.sales_value_month_to_date)) {
      out.push({
        lens: "sales",
        text: `Month-to-date sales are ${fmt.currency(row.sales_value_month_to_date)}${row.sales_position_date ? ` up to ${fmt.date(row.sales_position_date)}` : ""}.`,
      });
    }
    // Manufacturing stock comes ONLY from the canonical valuation (same figure and certification as the Materials lens);
    // the legacy snapshot figure is never narrated.
    const parts = [];
    if (inventory && inventory.state === "ok" && inventory.knownValue !== null) parts.push(`materials ${inventory.certified ? "" : "known value "}${fmt.currency(inventory.knownValue)}${inventory.certified ? "" : " (not a certified total)"}`);
    if (hasValue(row.fg_inventory_value_overall)) parts.push(`finished goods ${fmt.currency(row.fg_inventory_value_overall)}`);
    if (parts.length) out.push({ lens: "inventory", text: `Stock on hand: ${parts.join("; ")}${row.report_generated_date ? ` (report ${fmt.date(row.report_generated_date)})` : ""}.` });
  }
  if (pipeline && pipeline.status === "ok" && pipeline.data) {
    const d = pipeline.data;
    if (hasValue(d.work_in_process_batch_count)) {
      const w = Number(d.work_in_process_batch_count);
      const o = hasValue(d.overdue_work_in_process_batch_count) ? Number(d.overdue_work_in_process_batch_count) : null;
      out.push({
        lens: "production",
        text: `${fmt.integer(w)} batch${w === 1 ? "" : "es"} in Work in Process now${o === null ? "" : o > 0 ? `, ${fmt.integer(o)} beyond the expected production window` : ", none beyond the expected production window"} (live).`,
      });
    }
  } else if (pipeline && pipeline.status === "error") {
    out.push({ lens: "production", text: "Live production counts are unavailable right now." });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// Management Alerts (R4 initial catalogue, review-only). source = { status, data?, message? } from ei_management_alerts.
// No source => explicit unavailable, never a false zero or manufactured urgency. No acknowledgement/mutation affordance exists.
// Historical NOT_VERIFIED evidence signatures are never turned into urgent alerts here.
// ---------------------------------------------------------------------------------------------------------------------
export const ALERT_STATE_LABELS = Object.freeze({ REVIEW: "Needs review", CLEAR: "No findings", UNAVAILABLE: "Unavailable" });
export function alertsViewModel(source) {
  const unavailable = { state: "unavailable", title: "Management Alerts are not connected yet", body: "No governed alert source is available on this server yet, so no alert counts are shown. The absence of figures here does not mean there is nothing to review." };
  if (source == null || source.status === "unavailable" || source.status === "idle") return unavailable;
  if (source.status === "loading") return { state: "loading", title: "Loading alerts", body: "" };
  if (source.status === "denied") return { state: "denied", title: "Alerts are not available to your account", body: "Management Alerts require executive access." };
  if (source.status === "expired") return { state: "expired", title: "Your session has expired", body: "Sign in again, then retry." };
  if (source.status === "error") return { state: "error", title: "Alerts could not be loaded", body: String(source.message || "") };
  const d = source.data;
  const rows = d && Array.isArray(d.rows) ? d.rows : null;
  if (!rows) return { ...unavailable, body: "The alert source returned an unrecognised response. " + unavailable.body };
  const partial = d.coverage === "PARTIAL_CATALOGUE";
  const items = rows.map((r) => {
    const findings = hasValue(r.findings) ? Number(r.findings) : null;
    // A missing count can never read as clear, whatever state label the row carries.
    const state = findings === null ? "UNAVAILABLE" : r.state === "REVIEW" || r.state === "CLEAR" ? r.state : "UNAVAILABLE";
    return { key: String(r.key ?? ""), label: String(r.label ?? ""), evidenceDate: r.evidence_date ?? null, findings, state, severity: String(r.severity ?? "REVIEW_ONLY") };
  });
  return { state: items.length ? "ok" : "empty", title: items.length ? "" : "No alerts reported by the source", body: "", partial, catalogue: String(d.catalogue || ""), items };
}

// ---------------------------------------------------------------------------------------------------------------------
// Sales Performance: label the two average denominators distinctly (summary: sales days in month; product: that
// product's own observed sales days). Null stays null.
// ---------------------------------------------------------------------------------------------------------------------
export function analyzeSalesSummary(s) {
  if (!s) return { state: "missing" };
  if (!s.report_date && !s.month_upto_date) return { state: "unavailable" };
  return {
    state: "ok",
    latestDate: s.report_date || s.month_upto_date,
    monthStart: s.month_start || null,
    uptoDate: s.month_upto_date || s.report_date,
    latest: { value: num(s.latest_day_sales_value), units: num(s.latest_day_sales_units), billed: num(s.latest_day_billed_units) },
    mtd: { value: num(s.month_to_date_sales_value), units: num(s.month_to_date_sales_units), billed: num(s.month_to_date_billed_units) },
    days: num(s.sales_days_available_in_month),
    avgPerDay: num(s.average_daily_sales_value),
    products: num(s.products_sold_month_to_date),
    skus: num(s.skus_sold_month_to_date),
  };
}

// A page request beyond the last page returns no rows (and no total). Reset to page 1 once rather than show "No items".
export function shouldResetPage(rowsLength, currentPage) {
  return rowsLength === 0 && currentPage > 1;
}

// ---------------------------------------------------------------------------------------------------------------------
// Sales analytics contracts (ei_*). Field names are the SQL result keys; nothing is computed or inferred in the browser.
// ---------------------------------------------------------------------------------------------------------------------
// Error classes: 42883 / PGRST202 / 404 = the function is not installed on this server (honest "not available yet").
export function classifyApiError(error) {
  const code = String((error && (error.code || error.status)) || "");
  const msg = String((error && error.message) || "");
  if (code === "42883" || code === "PGRST202" || code === "404" || /could not find the function|does not exist/i.test(msg)) return "unavailable";
  if (code === "42501" || code === "403" || /denied|permission required/i.test(msg)) return "denied";
  if (code === "401" || code === "PGRST301" || /jwt|not authenticated|authentication required/i.test(msg)) return "expired";
  if (code === "22023") return "invalid";
  return "error";
}

// Capability discovery: only an explicit {sales:true} grants the Sales lens; anything else fails closed.
export function salesAccessFromResponse(data, error) {
  if (error) return { state: classifyApiError(error) === "unavailable" ? "unavailable" : "denied", executive: false, sales: false };
  if (!data || typeof data !== "object" || Array.isArray(data) || data.sales !== true) return { state: "denied", executive: false, sales: false };
  return { state: data.executive === true ? "executive" : "sales-only", executive: data.executive === true, sales: true };
}

export const HISTORY_GROUPS = Object.freeze([
  ["month", "Month"], ["region", "Region"], ["godown", "Godown"], ["product", "Product"], ["sku", "SKU"], ["category", "Category"],
  ["subcategory", "Subcategory"], ["group", "Group"], ["subgroup", "Subgroup"], ["region_month", "Region by month"], ["godown_month", "Godown by month"],
  ["product_month", "Product by month"], ["sku_month", "SKU by month"], ["category_month", "Category by month"], ["subcategory_month", "Subcategory by month"],
  ["group_month", "Group by month"], ["subgroup_month", "Subgroup by month"],
].map(([value, label]) => ({ value, label })));
export const HISTORY_SORTS = Object.freeze([{ value: "value_desc", label: "Highest value" }, { value: "value_asc", label: "Lowest value" }, { value: "key", label: "Name / month" }]);
export const isMonthGrouping = (g) => g === "month" || String(g).endsWith("_month");

export const COVERAGE_LABELS = Object.freeze({
  NO_RECORDED_ROWS: "No recorded rows", MISSING_MEASURES: "Missing measures", OBSERVED_NOT_CERTIFIED: "Observed, not certified",
  MISSING_OR_AMBIGUOUS_MEASURES: "Missing or ambiguous measures", NO_MAPPED_DATA: "No mapped data",
  NO_RAW_ROWS_NOT_CERTIFIED: "No raw rows (not certified)", NO_MAPPED_ROWS: "No mapped rows", MAPPING_COUNT_MISMATCH: "Raw and mapped counts differ", MISSING_AMOUNTS: "Missing amounts",
});
export const ELIGIBILITY_LABELS = Object.freeze({
  CURRENT_ELIGIBLE: "Listed now", INACTIVE_CURRENT_MASTER: "Inactive now", NOT_CURRENTLY_LISTED: "Not listed now", ELIGIBILITY_UNKNOWN: "Unknown",
});
export const ACTIVITY_LABELS = Object.freeze({
  NO_RECORDED_SALES_COVERAGE_UNCERTIFIED: "No recorded rows (coverage not certified; not a certified zero seller)",
  MISSING_MEASURES: "Missing measures", BILLED_SALES_OFFSET_BY_RETURNS: "Sales offset by returns", ZERO_NET_BILLED_OTHER_ACTIVITY: "Zero net billed, other activity",
  NET_RETURNS: "Net returns", NET_POSITIVE_BILLED: "Net positive",
});
export const label = (map, key) => map[key] || (key ? String(key).replace(/_/g, " ").toLowerCase() : "Unknown");

// Pivot ONE returned page of a *_month grouping into a grid. A cell that the page did not return stays undefined (rendered as
// "not returned"), never as zero, and months are only those present on the page.
export function pivotMonthGrid(rows) {
  const months = [...new Set((rows || []).map((r) => r.month).filter(Boolean))].sort();
  const byKey = new Map();
  for (const r of rows || []) {
    const k = `${r.dimension_id ?? ""}\u0000${r.dimension_name ?? ""}`;
    if (!byKey.has(k)) byKey.set(k, { id: r.dimension_id, name: r.dimension_name, cells: {} });
    if (r.month) byKey.get(k).cells[r.month] = r;
  }
  return { months, rows: [...byKey.values()] };
}

// Bounded export of the rows already returned: neutralise spreadsheet formula injection and quote safely.
export function csvCell(v) {
  let t = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}
export function buildPageCsv(columns, rows, scopeLine) {
  const lines = [];
  if (scopeLine) lines.push(csvCell(scopeLine));
  lines.push(columns.map((c) => csvCell(c.label)).join(","));
  for (const r of rows) lines.push(columns.map((c) => csvCell(c.get(r))).join(","));
  return lines.join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------------------------------------------------------------
// Product hierarchy filters (installed contracts: p_category, p_subcategory, p_group_id, p_subgroup). `p_group` on history is the
// GROUPING choice, never a hierarchy id. Dimensions from ei_sales_dimensions carry parent ids:
//   categories [{id,name}] · subcategories [{id,category_id,name}] · groups [{id,subcategory_id,name}] · subgroups [{id,group_id,name}]
// ---------------------------------------------------------------------------------------------------------------------
export const HIERARCHY_LEVELS = Object.freeze([
  { key: "category", dims: "categories", parent: null, arg: "p_category", label: "Category", all: "All categories" },
  { key: "subcategory", dims: "subcategories", parent: ["category", "category_id"], arg: "p_subcategory", label: "Subcategory", all: "All subcategories" },
  { key: "group", dims: "groups", parent: ["subcategory", "subcategory_id"], arg: "p_group_id", label: "Group", all: "All groups" },
  { key: "subgroup", dims: "subgroups", parent: ["group", "group_id"], arg: "p_subgroup", label: "Subgroup", all: "All subgroups" },
]);
export const emptyHierarchy = () => ({ category: "", subcategory: "", group: "", subgroup: "" });
const same = (a, b) => String(a) === String(b);

// Options for one level, limited to the selected parent when there is one.
export function hierarchyOptions(dims, sel, key) {
  const lvl = HIERARCHY_LEVELS.find((l) => l.key === key);
  const rows = dims && Array.isArray(dims[lvl.dims]) ? dims[lvl.dims] : [];
  if (!lvl.parent || !sel[lvl.parent[0]]) return rows;
  return rows.filter((r) => same(r[lvl.parent[1]], sel[lvl.parent[0]]));
}

// Clears every selection that is no longer valid: choosing a level clears everything below it, and a stale choice whose parent
// no longer matches (or that the server no longer lists) is dropped. Returns a new object plus the cleared level keys.
export function reconcileHierarchy(dims, sel, changedKey = null) {
  const next = { ...emptyHierarchy(), ...sel };
  const cleared = [];
  const start = changedKey ? HIERARCHY_LEVELS.findIndex((l) => l.key === changedKey) + 1 : 0;
  HIERARCHY_LEVELS.forEach((l, i) => {
    if (!next[l.key]) return;
    const parentChanged = changedKey && i >= start;
    const listed = hierarchyOptions(dims, next, l.key).some((r) => same(r.id, next[l.key]));
    if (parentChanged || (dims && !listed)) { next[l.key] = ""; cleared.push(l.key); }
  });
  return { sel: next, cleared };
}

const idOrNull = (v) => (v === "" || v == null || !Number.isFinite(Number(v)) ? null : Math.trunc(Number(v)));
// RPC arguments for the hierarchy; an empty level is null (never 0, never an empty string).
export function hierarchyArgs(sel) {
  const out = {};
  for (const l of HIERARCHY_LEVELS) out[l.arg] = idOrNull(sel && sel[l.key]);
  return out;
}
export const hierarchyActive = (sel) => HIERARCHY_LEVELS.filter((l) => sel && sel[l.key]).length;

// Human scope line for disclosures (export header, filter summary): names from the server dimensions, ids as fallback.
export function hierarchyLabels(dims, sel) {
  return HIERARCHY_LEVELS.filter((l) => sel && sel[l.key]).map((l) => {
    const row = (dims && Array.isArray(dims[l.dims]) ? dims[l.dims] : []).find((r) => same(r.id, sel[l.key]));
    return `${l.label}: ${row && row.name ? row.name : `#${sel[l.key]}`}`;
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Bounded export: ONE returned page only. The scope line states exactly what is and is not in the file.
// ---------------------------------------------------------------------------------------------------------------------
export function exportScopeLine({ title, rowsOnPage, page, size, total, anchor, filters = [], note = "" }) {
  const t = total === null || total === undefined || total === "" || !Number.isFinite(Number(total)) ? null : Number(total);
  const hasMore = t === null ? null : page * size < t;
  return [
    `Executive Intelligence ${title}`,
    `PAGE ONLY: ${rowsOnPage} row${rowsOnPage === 1 ? "" : "s"} from page ${page} (page size ${size}); not the whole dataset`,
    t === null ? "total rows unknown" : `${t} rows match the filters`,
    hasMore === null ? "has_more unknown" : `has_more=${hasMore}`,
    anchor ? `anchor ${anchor}` : "",
    filters.length ? `filters: ${filters.join("; ")}` : "filters: none",
    note,
    "import completeness not certified",
  ].filter(Boolean).join(" | ");
}

// ---------------------------------------------------------------------------------------------------------------------
// Actual sales refresh intelligence (ei_sales_refresh_status). The pinned pg_cron job's LATEST run is reported as-is. A succeeded
// run proves a run finished, never that the import was complete; no completeness is inferred from any field here.
// ---------------------------------------------------------------------------------------------------------------------
export const REFRESH_JOB_LABELS = Object.freeze({
  succeeded: "Last run succeeded", failed: "Last run failed", running: "Running now", starting: "Starting", connecting: "Connecting", sending: "Sending",
  DISABLED: "Refresh job disabled", NO_RECORDED_RUN: "No recorded run", UNAVAILABLE_JOB_IDENTITY: "Refresh job not found",
});
export function refreshJobModel(d) {
  if (!d || typeof d !== "object") return { state: "missing" };
  const job = d.refresh_job && typeof d.refresh_job === "object" ? d.refresh_job : null;
  const raw = String(d.refresh_job_status ?? (job && job.status) ?? "");
  // Pre-job contracts reported a placeholder; anything unrecognised is shown as unavailable, never as success.
  if (!raw || raw === "UNAVAILABLE_TO_THIS_CONTRACT") return { state: "unavailable", label: "Refresh job status unavailable" };
  const known = Object.prototype.hasOwnProperty.call(REFRESH_JOB_LABELS, raw);
  const tone = raw === "succeeded" ? "ok" : raw === "failed" || raw === "DISABLED" || raw === "UNAVAILABLE_JOB_IDENTITY" ? "bad" : "warn";
  return {
    state: known ? "known" : "unrecognised",
    status: raw,
    label: known ? REFRESH_JOB_LABELS[raw] : `Unrecognised status: ${raw}`,
    tone: known ? tone : "warn",
    active: job && typeof job.active === "boolean" ? job.active : null,
    startedAt: (job && job.last_started_at) || null,
    finishedAt: (job && job.last_finished_at) || null,
  };
}
// Daily vs monthly freshness from the server's own timestamps. Direction only; no "up to date" claim.
export function refreshFreshnessModel(d) {
  if (!d || typeof d !== "object") return { state: "missing" };
  const t = (v) => { const n = v ? Date.parse(v) : NaN; return Number.isFinite(n) ? n : null; };
  const m = t(d.monthly_source_max_inserted_at);
  const dl = t(d.daily_source_max_inserted_at);
  let order = "unknown";
  if (m !== null && dl !== null) order = dl > m ? "daily_newer" : dl < m ? "monthly_newer" : "same";
  const diff = hasValue(d.amount_difference) ? Number(d.amount_difference) : null;
  return { state: "ok", order, difference: diff, differenceZero: diff === 0, monthlyMonth: d.monthly_latest_month || null, dailyLast: d.daily_last_date_in_month || null };
}

// ---------------------------------------------------------------------------------------------------------------------
// Facility sales classification (ei_facility_sales_scope). Facility total is every recorded voucher row (including rows whose godown
// is unresolved); product analytics needs a resolved SKU AND godown. They are DIFFERENT measures and are never presented as equal.
// ---------------------------------------------------------------------------------------------------------------------
export const FACILITY_SCOPE_LABELS = Object.freeze({
  SASV_CANONICAL_PRODUCT: "SASV canonical product", SASV_SAMPLE: "SASV sample", SASV_HISTORICAL_PACK: "SASV historical pack",
  OTHER_MANUFACTURING_UNIT: "Other manufacturing unit", OTHER_MERCHANDISE: "Other merchandise", RAW_MATERIAL: "Raw material",
  PACKING_MATERIAL: "Packing material", EXCLUDE_PRODUCT_ANALYTICS: "Excluded from product analytics", UNCLASSIFIED: "Unclassified (needs review)",
  CLASSIFICATION_CONFLICT: "Classification conflict (needs review)", SKU_MAPPING_UNRESOLVED: "SKU mapping unresolved",
});
const REVIEW_SCOPES = Object.freeze(["UNCLASSIFIED", "CLASSIFICATION_CONFLICT"]);
const PRODUCT_ANALYTICS_SCOPES = Object.freeze(["SASV_CANONICAL_PRODUCT"]);
export function facilityModel(d) {
  if (!d || typeof d !== "object") return { state: "missing" };
  if (d.coverage === "NO_RAW_DATA") return { state: "no-data" };
  const rowsIn = Array.isArray(d.rows) ? d.rows : null;
  if (!rowsIn) return { state: "unrecognised" };
  const rows = rowsIn.map((r) => ({
    scope: String(r.scope ?? ""), label: FACILITY_SCOPE_LABELS[r.scope] || (r.scope ? String(r.scope).replace(/_/g, " ").toLowerCase() : "Unknown"),
    recorded: num(r.recorded_rows), missing: num(r.missing_amount_rows), reported: num(r.source_reported_amount), billed: num(r.billed_value), unresolvedGodown: num(r.godown_unresolved_rows),
    review: REVIEW_SCOPES.includes(r.scope), inProductAnalytics: PRODUCT_ANALYTICS_SCOPES.includes(r.scope),
  }));
  const f = d.facility && typeof d.facility === "object" ? d.facility : null;
  // Review counts are the server's per-scope row counts for the two review scopes, shown as given; a missing count stays unknown.
  const review = rows.filter((r) => r.review);
  return {
    state: "ok", anchor: d.anchor || null, startDate: d.start_date || null, latestRawDate: d.latest_raw_date || null,
    facility: f && { recorded: num(f.recorded_rows), missing: num(f.missing_amount_rows), reported: num(f.source_reported_amount), billed: num(f.billed_value), unresolvedGodown: num(f.godown_unresolved_rows) },
    rows, review: review.map((r) => ({ scope: r.scope, label: r.label, recorded: r.recorded })),
    reviewRowCount: review.length ? review.reduce((a, r) => (a === null || r.recorded === null ? null : a + r.recorded), 0) : 0,
    scopeNote: d.scope_note || "", ownership: d.ownership_classification || "", importCompleteness: d.import_completeness || "NOT_CERTIFIED",
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Consolidated data freshness (header indicator). Pure: the caller supplies what was ALREADY loaded; nothing is requested for it.
// Three kinds are kept apart: snapshot generation (server materialised view), client load time (when this page last read live
// data) and source refresh timestamps (sales monthly/daily sources and the refresh job). No staleness threshold is invented and
// no completeness is inferred: states are only loading, ok, error or unknown.
// input: { executive, summary:{status,at,message}, pipeline:{status,asOf}, sales:{loadedAt,status,refresh:{status,data}} }
// ---------------------------------------------------------------------------------------------------------------------
export function freshnessModel({ executive = false, summary = {}, pipeline = {}, sales = {} } = {}) {
  const rows = [];
  const add = (kind, key, label, value, state = "ok") => rows.push({ kind, key, label, value: value ?? null, state });
  const bad = (st) => st === "error" || st === "denied" || st === "expired" || st === "unavailable" || st === "invalid";
  let loading = false, error = false, anyTime = false;
  if (executive) {
    if (summary.status === "loading" || summary.status === "idle") loading = true;
    if (summary.status === "error") error = true;
    if (summary.at) anyTime = true;
    add("snapshot", "snapshot", "Executive summary snapshot generated", summary.at || null, summary.at ? "ok" : summary.status === "error" ? "error" : summary.status === "loading" || summary.status === "idle" ? "loading" : "unknown");
    if (pipeline.status === "loading" || pipeline.status === "idle") loading = true;
    if (pipeline.status === "error") error = true;
    if (pipeline.asOf) anyTime = true;
    add("client", "pipeline", "Production counts loaded (live read)", pipeline.asOf || null, pipeline.asOf ? "ok" : pipeline.status === "error" ? "error" : "loading");
  }
  if (sales.loadedAt) { anyTime = true; add("client", "sales", "Sales data loaded (live read)", sales.loadedAt, "ok"); }
  else if (sales.status === "loading") loading = true;
  else if (sales.status && bad(sales.status)) { error = true; add("client", "sales", "Sales data loaded (live read)", null, "error"); }
  const rf = sales.refresh && sales.refresh.status === "ok" ? sales.refresh.data : null;
  if (rf) {
    const job = refreshJobModel(rf);
    add("source", "sales-monthly", "Sales monthly source last loaded", rf.monthly_source_max_inserted_at || null, rf.monthly_source_max_inserted_at ? "ok" : "unknown");
    add("source", "sales-daily", "Sales daily source last loaded", rf.daily_source_max_inserted_at || null, rf.daily_source_max_inserted_at ? "ok" : "unknown");
    if (job.state === "known") add("source", "sales-job", `Monthly refresh job: ${job.label}`, job.finishedAt || job.startedAt || null, job.tone === "bad" ? "error" : "ok");
    if (rf.monthly_source_max_inserted_at || rf.daily_source_max_inserted_at) anyTime = true;
  } else {
    add("source", "sales-source", "Sales source refresh timestamps", null, sales.refresh && bad(sales.refresh.status) ? "error" : "unknown");
  }
  // The headline is the snapshot generation time (executive) or the sales load time (sales-only). While that is still loading the state
  // is "loading" even if another read has already finished; the other read then only serves as a fallback time.
  const headlineAt = executive ? summary.at || null : sales.loadedAt || null;
  const fallbackAt = headlineAt || (executive ? pipeline.asOf || null : null);
  const state = error ? "error" : loading && !headlineAt ? "loading" : anyTime ? "ok" : "unknown";
  return { state, headlineAt, fallbackAt, rows, groups: ["snapshot", "client", "source"].map((k) => ({ kind: k, rows: rows.filter((r) => r.kind === k) })).filter((g) => g.rows.length) };
}
export const FRESHNESS_GROUP_LABELS = Object.freeze({ snapshot: "Snapshot generation", client: "Loaded by this page", source: "Source refresh" });

// Activity (exceptions): a short badge label plus the explanatory note, so a long sentence never sits in a single table cell.
export const ACTIVITY_SHORT = Object.freeze({
  NO_RECORDED_SALES_COVERAGE_UNCERTIFIED: { label: "No recorded rows", note: "Coverage not certified; not a certified zero seller" },
});
export function activityParts(key, fullLabels) {
  const short = ACTIVITY_SHORT[key];
  if (short) return short;
  return { label: (fullLabels && fullLabels[key]) || (key ? String(key).replace(/_/g, " ").toLowerCase() : "Unknown"), note: "" };
}

// ---------------------------------------------------------------------------------------------------------------------
// R5 visual intelligence (pure, no I/O). Every visual is built only from fields the loaded contracts already return. A value that
// is missing stays missing (never drawn as zero), a mixed-sign or incomplete series is never charted, and page-only series say so.
// ---------------------------------------------------------------------------------------------------------------------
// Like barSeries but a missing value is kept as a labelled gap row; negatives or fewer than two rows (or no value) => null.
export function barSeriesLoose(items) {
  const rows = (items || []).filter(Boolean).map((i) => ({ label: i.label, value: hasValue(i.value) ? Number(i.value) : null, missing: i.missing || "Not available" }));
  const vals = rows.filter((r) => r.value !== null).map((r) => r.value);
  if (rows.length < 2 || !vals.length || vals.some((v) => v < 0)) return null;
  const max = Math.max(...vals);
  if (!(max > 0)) return null;
  return { max, rows: rows.map((r) => (r.value === null ? { ...r, pct: null } : { ...r, pct: r.value === 0 ? 0 : Math.max(2, Math.round((r.value / max) * 100)) })) };
}

const PERIOD_NAMES = Object.freeze({ CURRENT: "Current", PREVIOUS_MONTH: "Previous month", PREVIOUS_YEAR: "Previous year" });
// Matched-period sales value (server comparison periods). A period without a usable value is a gap, not zero.
export function comparisonBars(d) {
  const periods = d && Array.isArray(d.periods) ? d.periods : [];
  return barSeriesLoose(periods.map((p) => ({
    label: PERIOD_NAMES[p.label] || String(p.label || "Period"), value: p.sales_value,
    missing: p.coverage === "NO_RECORDED_ROWS" ? "No recorded rows" : "Not available",
  })));
}

// Average per complete month for each trailing window the server could value; an unvalued window is a gap.
export function windowBars(d) {
  const wins = d && Array.isArray(d.windows) ? d.windows : [];
  return barSeriesLoose(wins.map((w) => ({
    label: `Last ${w.n} months`, value: w.average_monthly_sales,
    missing: Number(w.observed_months) < Number(w.n) ? "Unavailable: months missing" : "Unavailable: ambiguous amounts",
  })));
}

// Complete chronological month series from the history contract with group = month. Valid only when every month came back in
// one response (total <= rows, first page, no search); otherwise { reason } and the caller shows no chart.
export function monthlyTrend(d, { group, search = "", page = 1 } = {}) {
  if (group !== "month") return { reason: "group" };
  if (!d || !Array.isArray(d.rows)) return { reason: "data" };
  if (search || page !== 1 || Number(d.total) > d.rows.length) return { reason: "partial" };
  const byMonth = new Map();
  for (const r of d.rows) {
    const k = String(r.month || "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(k) || byMonth.has(k)) return { reason: "data" };
    byMonth.set(k, r);
  }
  if (byMonth.size < 2) return { reason: "short" };
  const keys = [...byMonth.keys()].sort();
  const start = String(d.start_date || `${keys[0]}-01`).slice(0, 7);
  const anchorKey = String(d.anchor || "").slice(0, 7) || keys[keys.length - 1];
  const first = start < keys[0] ? start : keys[0], last = anchorKey > keys[keys.length - 1] ? anchorKey : keys[keys.length - 1];
  const months = [];
  for (let [y, m] = first.split("-").map(Number); `${y}-${String(m).padStart(2, "0")}` <= last; m === 12 ? (y++, (m = 1)) : m++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    const r = byMonth.get(key);
    const ok = r && hasValue(r.sales_value);
    months.push({ key, state: !r ? "missing" : ok ? "ok" : "unavailable", value: ok ? Number(r.sales_value) : null, reported: r && hasValue(r.source_reported_amount) ? Number(r.source_reported_amount) : null, partial: key === anchorKey && key === last, coverage: r ? r.coverage || "" : "" });
  }
  const vals = months.filter((x) => x.value !== null).map((x) => x.value);
  if (!vals.length) return { reason: "empty" };
  return { months, hi: Math.max(0, ...vals), lo: Math.min(0, ...vals), anchor: d.anchor || null };
}

// Top rows of ONE response page, labelled page-only by the caller. Returns null with fewer than two valued rows or any negative.
export function rankedPageBars(rows, { limit = 8 } = {}) {
  const all = Array.isArray(rows) ? rows : [];
  const valued = all.filter((r) => hasValue(r.sales_value)).sort((a, b) => Number(b.sales_value) - Number(a.sales_value));
  const series = barSeries(valued.slice(0, limit).map((r) => ({ label: r.dimension_name || "Unmapped", value: r.sales_value })));
  return series ? { series, pageRows: all.length, shown: Math.min(limit, valued.length), unavailable: all.length - valued.length } : null;
}

// Facility billed value by classification scope (the installed reconciliation rows). No billed value => gap, never zero.
export function facilityBars(m) {
  if (!m || m.state !== "ok") return null;
  return barSeriesLoose(m.rows.map((r) => ({ label: r.label, value: r.billed, missing: r.missing ? "Unavailable: rows missing an amount" : "Not reported" })));
}

// A subset drawn inside its parent: only when both are real counts and subset <= total (so it can never read as additive).
export function subsetShare(total, subset) {
  if (!hasValue(total) || !hasValue(subset)) return null;
  const t = Number(total), s = Number(subset);
  return t > 0 && s >= 0 && s <= t ? { total: t, subset: s, pct: Math.round((s / t) * 100) } : null;
}

// Disjoint counts as one stacked bar. Every segment keeps its own text; zero-width segments are omitted from the bar only.
export function segmentSeries(items) {
  const rows = (items || []).filter((i) => i && hasValue(i.value)).map((i) => ({ key: i.key, label: i.label, value: Number(i.value) }));
  if (rows.length < 2 || rows.some((r) => r.value < 0)) return null;
  const total = rows.reduce((a, r) => a + r.value, 0);
  return total > 0 ? { total, rows: rows.map((r) => ({ ...r, pct: (r.value / total) * 100 })) } : null;
}

// Management alerts: counts of checks per state. UNAVAILABLE is its own segment and never merges into CLEAR.
export function alertSegments(items) {
  const list = Array.isArray(items) ? items : [];
  const n = (s) => list.filter((a) => a.state === s).length;
  return list.length ? segmentSeries([{ key: "REVIEW", label: "Needs review", value: n("REVIEW") }, { key: "CLEAR", label: "No findings", value: n("CLEAR") }, { key: "UNAVAILABLE", label: "Unavailable", value: n("UNAVAILABLE") }]) : null;
}

// Finished-goods months-of-stock statuses (disjoint server statuses). The remainder is SKUs minus the listed statuses.
export function fgStatusSegments(s) {
  if (!s || !["sku_count", "zero_stock_sku_count", "below_1_month_cover_count", "above_6_month_cover_count"].every((k) => hasValue(s[k]))) return null;
  const listed = Number(s.zero_stock_sku_count) + Number(s.below_1_month_cover_count) + Number(s.above_6_month_cover_count);
  const rest = Number(s.sku_count) - listed;
  if (rest < 0) return null;
  return segmentSeries([{ key: "ZERO", label: "Zero stock", value: s.zero_stock_sku_count }, { key: "LOW", label: "Below 1 month", value: s.below_1_month_cover_count }, { key: "HIGH", label: "Above 6 months", value: s.above_6_month_cover_count }, { key: "OTHER", label: "Other statuses", value: rest }]);
}

// Overview: known manufacturing-inventory value vs finished-goods value. Different valuation bases; never summed.
export function materialFgBars(row, materialsKnownValue) {
  if (!row) return null;
  // Materials come from the canonical inventory summary (known value), never the legacy snapshot field.
  return barSeriesLoose([{ label: "Materials (canonical known value)", value: materialsKnownValue, missing: "Unavailable" }, { label: "Finished goods", value: row.fg_inventory_value_overall, missing: "Unavailable" }]);
}

// ---------------------------------------------------------------------------------------------------------------------
// R5 maturity: incremental (infinite-scroll) retrieval, record cards and loaded-scope export. Pure helpers; no I/O.
// ---------------------------------------------------------------------------------------------------------------------
// Append a chunk by true row identity. A row whose key is already held is dropped; a chunk that adds nothing is terminal
// (this is what stops a server that repeats a page from looping the scroll sentinel).
export function mergeRows(existing, incoming, keyOf) {
  const seen = new Set(existing.map(keyOf));
  const fresh = [];
  for (const r of incoming || []) { const k = keyOf(r); if (!seen.has(k)) { seen.add(k); fresh.push(r); } }
  return { rows: existing.concat(fresh), added: fresh.length };
}
// Terminal when everything the server reported is held, the chunk was short, or nothing new arrived.
export function listIsDone({ held, total, chunk, size, added }) {
  return added === 0 || chunk < size || (hasValue(total) && held >= Number(total));
}
// Export scope for exactly the rows loaded so far; never claims the whole dataset.
export function exportLoadedScopeLine({ title, rowsLoaded, total, anchor, filters = [], note = "" }) {
  const t = total === null || total === undefined || total === "" || !Number.isFinite(Number(total)) ? null : Number(total);
  return [
    `Executive Intelligence ${title}`,
    `LOADED ROWS ONLY: ${rowsLoaded} row${rowsLoaded === 1 ? "" : "s"} loaded so far by scrolling; not the whole dataset unless every row was loaded`,
    t === null ? "total rows unknown" : `${t} rows match the filters`,
    t === null ? "has_more unknown" : `has_more=${rowsLoaded < t}`,
    anchor ? `anchor ${anchor}` : "",
    filters.length ? `filters: ${filters.join("; ")}` : "filters: none",
    note,
    "import completeness not certified",
  ].filter(Boolean).join(" | ");
}
// Compact record card from a rendered record: spec items are header labels (or column indexes). Every field is also returned so the
// detail view can show the complete record.
export function recordCardModel(labels, texts, spec) {
  const at = (s) => (typeof s === "number" ? s : labels.indexOf(s));
  const val = (s) => { const i = at(s); return i >= 0 && i < texts.length ? texts[i] : null; };
  const present = (v) => v !== null && v !== "" && v !== "-";
  return {
    title: val(spec.title) || "Record",
    sub: (spec.sub || []).map(val).filter(present),
    measure: at(spec.measure) >= 0 ? { label: labels[at(spec.measure)], value: val(spec.measure) } : null,
    chips: (spec.chips || []).filter((s) => at(s) >= 0).map((s) => ({ label: labels[at(s)], value: val(s) })),
    status: spec.status && present(val(spec.status)) ? val(spec.status) : "",
    fields: labels.map((l, i) => ({ label: l, value: texts[i] ?? "" })),
  };
}
// Relative magnitude for an inline data bar (0..100, null when not drawable). Negatives and missing values are never drawn as bars.
export function inlineBarPct(value, max) {
  return hasValue(value) && Number(value) >= 0 && Number(max) > 0 ? (Number(value) === 0 ? 0 : Math.max(2, Math.round((Number(value) / Number(max)) * 100))) : null;
}

// ---------------------------------------------------------------------------------------------------------------------
// Finance ageing (R8.17): pure rules shared by the settings dialog, the bill dialog and the parity fixtures. They mirror the server rule in
// docs/executive-intelligence-r2/FINANCE_AGEING_SERVER_SPEC.md and the installed get_mis_finance_ageing_* contracts.
// ---------------------------------------------------------------------------------------------------------------------
export const AGE_MAX_BOUNDS = 5;
export const ageLabels = (bounds) => bounds.map((v, i) => `${i ? bounds[i - 1] + 1 : 0}–${v}`).concat([`Over ${bounds[bounds.length - 1]}`]);
export function parseAgeBounds(text) {
  const parts = String(text || "").split(/[\s,;]+/).filter(Boolean);
  if (!parts.length || parts.length > AGE_MAX_BOUNDS) return { error: `Enter 1 to ${AGE_MAX_BOUNDS} day limits, for example 30, 60, 90.` };
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isInteger(n) || n < 1 || n > 3650)) return { error: "Day limits must be whole numbers from 1 to 3650." };
  for (let i = 1; i < nums.length; i++) if (nums[i] <= nums[i - 1]) return { error: "Day limits must increase from left to right." };
  return { bounds: nums };
}
export function parseAgeInt(text) {
  const t = String(text ?? "").trim();
  if (t === "") return { value: null };
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 && n <= 36500 ? { value: n } : { error: "Age limits must be whole numbers of days, zero or more." };
}
const AGE_MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
// D-Mon-YY / D-Mon-YYYY (English month abbreviations; two-digit years are 2000+). An impossible calendar date (31-Feb-26) is NOT a date.
export function parseBillDate(text) {
  const m = /^\s*(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})\s*$/.exec(String(text || ""));
  if (!m || !(m[2].toLowerCase() in AGE_MONTHS)) return null;
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const mo = AGE_MONTHS[m[2].toLowerCase()], day = Number(m[1]);
  const d = new Date(Date.UTC(y, mo, day));
  return d.getUTCFullYear() === y && d.getUTCMonth() === mo && d.getUTCDate() === day ? d.getTime() : null;
}
export function billAge(text, asOfISO) {
  const d = parseBillDate(text);
  const a = Date.parse(asOfISO);
  return d === null || !Number.isFinite(a) ? null : Math.round((a - d) / 86400000);
}
// Band 0 holds age <= first limit (including bills dated after the as-of date); the last band holds everything older than the last limit.
export const ageBandIndex = (age, bounds) => { if (age === null) return -1; const i = bounds.findIndex((b) => age <= b); return i < 0 ? bounds.length : i; };
// A line without a bill reference, or an explicit on-account marker, has no bill to age: it is undated.
export const isUnreferencedBill = (ref) => { const t = String(ref ?? "").trim(); return t === "" || /^on[\s-]*account\b/i.test(t); };
// Ages one party's bills exactly as the server does: undated bills (bad/missing date, no reference or on-account) survive any age range;
// dated bills outside [min, max] (inclusive) are dropped; the surviving signed amounts are oriented by the sign of their NET (a net of zero keeps
// the sign as is), independently per party; oriented amounts are banded. Individual bills are never forced to absolute values.
export function ageBillsForParty(bills, { asOf, bounds, min = null, max = null }) {
  const aged = (bills || []).map((b) => {
    const amount = Number(b.outstanding_amount_tally_value);
    const age = isUnreferencedBill(b.bill_ref) ? null : billAge(b.bill_date_text, asOf);
    return { ...b, amount: Number.isFinite(amount) ? amount : 0, age };
  });
  const kept = aged.filter((b) => b.age === null || ((min === null || b.age >= min) && (max === null || b.age <= max)));
  const net = kept.reduce((a, b) => a + b.amount, 0);
  const orient = net < 0 ? -1 : 1;
  const bands = bounds.concat([0]).map(() => ({ amount: 0, count: 0 }));
  const undated = { amount: 0, count: 0 };
  const rows = kept.map((b) => {
    const oriented = b.amount * orient;
    const band = b.age === null ? -1 : ageBandIndex(b.age, bounds);
    if (band < 0) { undated.amount += oriented; undated.count += 1; } else { bands[band].amount += oriented; bands[band].count += 1; }
    return { ...b, oriented, band };
  });
  rows.sort((x, y) => (y.age ?? -Infinity) - (x.age ?? -Infinity));
  return { net, orient, bands, undated, rows };
}
