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
