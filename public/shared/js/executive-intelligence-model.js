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
  const unclassifiedCount = num(s.unclassified_item_count) ?? 0;
  const dup = num(s.duplicate_item_row_count) ?? 0;
  const missingId = num(s.missing_item_id_count) ?? 0;
  const gapTotal = num(s.valuation_gap_item_count) ?? 0;
  const zeroQty = num(s.zero_quantity_item_count) ?? 0;
  const totalRows = groups.reduce((a, g) => a + (g.count ?? 0), 0) + unclassifiedCount;
  const identityClean = dup === 0 && missingId === 0;
  const certified = unclassifiedCount === 0 && identityClean && gapTotal === 0;
  return {
    state: "ok",
    groups,
    knownValue: num(s.inventory_known_value),
    unclassified: { count: unclassifiedCount, value: num(s.unclassified_known_value) },
    gapTotal, zeroQty, dup, missingId, totalRows,
    valuedRows: Math.max(0, totalRows - gapTotal),
    // Source rows are item counts only when identity is clean.
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
  return { max, rows: rows.map((r) => ({ ...r, pct: Math.max(2, Math.round((r.value / max) * 100)) })) };
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
export function overviewNarrative(row, pipeline, fmt) {
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
    if (hasValue(row.manufacturing_inventory_value) || hasValue(row.fg_inventory_value_overall)) {
      const parts = [];
      if (hasValue(row.manufacturing_inventory_value)) parts.push(`manufacturing materials ${fmt.currency(row.manufacturing_inventory_value)}`);
      if (hasValue(row.fg_inventory_value_overall)) parts.push(`finished goods ${fmt.currency(row.fg_inventory_value_overall)}`);
      out.push({ lens: "inventory", text: `Stock on hand: ${parts.join("; ")}${row.report_generated_date ? ` (report ${fmt.date(row.report_generated_date)})` : ""}.` });
    }
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
// Management Alerts (R4 server contract NOT frozen). Fixture-only: with no governed source the lens is explicitly
// unavailable, never a false zero or manufactured urgency. No acknowledgement/mutation affordance exists in any state.
// ---------------------------------------------------------------------------------------------------------------------
export function alertsViewModel(source) {
  if (source == null) {
    return {
      state: "unavailable",
      title: "Management Alerts are not connected yet",
      body: "No governed alert source has been approved for this lens, so no alert counts are shown. The absence of figures here does not mean there is nothing to review.",
    };
  }
  if (source.status === "error") return { state: "error", title: "Alerts could not be loaded", body: String(source.message || "") };
  const items = Array.isArray(source.items) ? source.items : null;
  if (!items) return { state: "unavailable", title: "Management Alerts are not connected yet", body: "The alert source returned an unrecognised response." };
  if (!items.length) return { state: "empty", title: "No alerts reported by the source", body: "The governed source returned an empty catalogue for the reported scope." };
  return { state: "ok", items: items.map((i) => ({ id: String(i.id ?? ""), title: String(i.title ?? ""), detail: String(i.detail ?? ""), severity: String(i.severity ?? "info"), asOf: i.as_of ?? null })) };
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
