// CW-05 table tools (flag COSTING_TABLE_TOOLS_V1, default OFF).
// Pure helpers only: no DOM access at import, no data-layer access, no clock use.
// Sorting works on rows already loaded in memory; CSV uses displayed labels.

const SORT_DIRS = ["none", "asc", "desc"];

function isBlankValue(v) {
  if (v === null || v === undefined) return true;
  const s = String(v).trim();
  return s === "" || s === "--";
}

/**
 * Compare two cell values. Blank values (null, undefined, "", "--") are not
 * handled here; sortRows keeps them last in both directions.
 * type: "number" | "date" | "text" (default "text").
 * "date" compares server-provided ISO strings lexically (no parsing).
 */
export function compareValues(a, b, type = "text") {
  const aBlank = isBlankValue(a);
  const bBlank = isBlankValue(b);
  if (aBlank && bBlank) return 0;
  if (aBlank) return 1;
  if (bBlank) return -1;
  if (type === "number") {
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) {
      return na < nb ? -1 : na > nb ? 1 : 0;
    }
  } else if (type === "date") {
    const sa = String(a);
    const sb = String(b);
    return sa < sb ? -1 : sa > sb ? 1 : 0;
  }
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

/**
 * Returns a NEW array sorted by row[key]. Stable (ties keep input order).
 * Blank values sort last for both "asc" and "desc". dir "none" returns a copy.
 */
export function sortRows(rows, key, dir, type = "text") {
  return sortRowsWith(rows, key, (row) => row?.[key], dir, type);
}

/**
 * Like sortRows, but for a column `{ key, type, get }`: when `get` is a
 * function the sort value is get(row), otherwise row[key].
 */
export function sortRowsBy(rows, column, dir) {
  const key = column?.key;
  const get =
    typeof column?.get === "function" ? column.get : (row) => row?.[key];
  return sortRowsWith(rows, key, get, dir, column?.type || "text");
}

function sortRowsWith(rows, key, get, dir, type) {
  const list = Array.isArray(rows) ? rows : [];
  if (!key || (dir !== "asc" && dir !== "desc")) return list.slice();
  const sign = dir === "desc" ? -1 : 1;
  return list
    .map((row, index) => ({ row, index }))
    .sort((x, y) => {
      const va = get(x.row);
      const vb = get(y.row);
      const aBlank = isBlankValue(va);
      const bBlank = isBlankValue(vb);
      if (aBlank !== bBlank) return aBlank ? 1 : -1;
      const c = aBlank ? 0 : compareValues(va, vb, type) * sign;
      return c !== 0 ? c : x.index - y.index;
    })
    .map((entry) => entry.row);
}

/** Cycle none -> asc -> desc -> none for `key`; a different key starts at asc. */
export function nextSortState(state, key) {
  const current = state && state.key === key ? state.dir : "none";
  const idx = SORT_DIRS.indexOf(current);
  const dir = SORT_DIRS[(idx < 0 ? 0 : idx + 1) % SORT_DIRS.length];
  return dir === "none" ? { key: null, dir: "none" } : { key, dir };
}

export function ariaSortFor(state, key) {
  if (!state || state.key !== key) return "none";
  if (state.dir === "asc") return "ascending";
  if (state.dir === "desc") return "descending";
  return "none";
}

export function sortIndicatorFor(state, key) {
  if (!state || state.key !== key) return "";
  if (state.dir === "asc") return " ▲";
  if (state.dir === "desc") return " ▼";
  return "";
}

const FORMULA_LEAD = new Set(["=", "+", "-", "@", "\t", "\r"]);

/**
 * Quote every cell and double embedded quotes. String cells whose first
 * character could start a spreadsheet formula get a leading apostrophe.
 * Values of typeof number are never prefixed.
 */
export function neutraliseCsvValue(v) {
  if (typeof v === "string" && v.length && FORMULA_LEAD.has(v[0])) {
    return `'${v}`;
  }
  return v;
}

export function csvCell(v) {
  const n = neutraliseCsvValue(v);
  const s = n === null || n === undefined ? "" : String(n);
  return `"${s.replace(/"/g, '""')}"`;
}

/** columns: [{ key, label }] in displayed order. */
export function buildCsv(columns, rows) {
  const cols = Array.isArray(columns) ? columns : [];
  const list = Array.isArray(rows) ? rows : [];
  return [
    cols.map((c) => csvCell(c.label)).join(","),
    ...list.map((row) => cols.map((c) => csvCell(row?.[c.key])).join(",")),
  ].join("\n");
}

// Pure sort-value accessors. They read raw row fields in the same fallback
// order as the row render code; they never re-derive business values.
function firstPresent(...values) {
  for (const v of values) {
    if (v !== null && v !== undefined && v !== "") return v;
  }
  return "";
}

function joinPresent(...values) {
  return values
    .map((v) => (v === null || v === undefined ? "" : String(v)))
    .filter((v) => v !== "")
    .join(" ");
}

/** Product / SKU cell (shell productSkuLabel): product text, then SKU text. */
export function productSkuSortText(row) {
  return joinPresent(
    firstPresent(row?.product_name, row?.product_id),
    firstPresent(row?.sku_display_name, row?.sku_column_label, row?.sku_id),
  );
}

export function productSortText(row) {
  return firstPresent(row?.product_name, row?.product_id);
}

export function categorySortText(row) {
  return joinPresent(row?.category_name, row?.subcategory_name);
}

export function groupSortText(row) {
  return joinPresent(row?.group_name, row?.sub_group_name);
}

export function stockItemSortText(row) {
  return firstPresent(row?.stock_item_name, row?.stock_item_id);
}

const col = (label, key, type = "text", get) =>
  Object.freeze(get === undefined ? { label, key, type } : { label, key, type, get });

/**
 * Column -> row-key mapping per lens (labels equal the lens header arrays).
 * key: null means the displayed cell has no safe sort value, so the column is
 * not sortable. `get` (function) gives the sort value; `get: null` means the
 * shell must inject the accessor (see withAccessors) and until then the column
 * is not sortable.
 */
export const GENERIC_TABLE_COLUMNS = Object.freeze({
  "sku-cost-sheet": Object.freeze([
    Object.freeze({ label: "", key: null, type: "text" }),
    col("Product / SKU", "product_sku_label", "text", productSkuSortText),
    Object.freeze({ label: "SKU ID", key: "sku_id", type: "text" }),
    Object.freeze({ label: "MRP IK", key: "mrp_ik", type: "number" }),
    Object.freeze({ label: "MRP OK", key: "mrp_ok", type: "number" }),
    Object.freeze({
      label: "Internal Loaded Cost",
      key: "internal_loaded_cost_per_sku",
      type: "number",
    }),
    Object.freeze({ label: "IK Selling Price", key: "ik_selling_price", type: "number" }),
    Object.freeze({ label: "OK Selling Price", key: "ok_selling_price", type: "number" }),
    col("Status", "row_status", "text", null),
  ]),
  "printable-cost-sheet": Object.freeze([
    col("Product", "product_label", "text", productSortText),
    col("Category", "category_label", "text", categorySortText),
    col("Group", "group_label", "text", groupSortText),
    Object.freeze({ label: "SKU Columns", key: "sku_column_labels", type: "text" }),
    Object.freeze({ label: "Status", key: "product_cost_sheet_status", type: "text" }),
    Object.freeze({ label: "Refreshed At", key: "refreshed_at", type: "date" }),
  ]),
  "cost-comparison": Object.freeze([
    Object.freeze({ label: "Product / SKU", key: null, type: "text" }),
    Object.freeze({ label: "Manufacturing COP", key: null, type: "number" }),
    Object.freeze({ label: "Previous Month COP", key: null, type: "number" }),
    Object.freeze({ label: "MoM COP Change %", key: null, type: "number" }),
    Object.freeze({ label: "Internal Loaded Cost", key: null, type: "number" }),
    Object.freeze({
      label: "Previous Month Internal Loaded Cost",
      key: null,
      type: "number",
    }),
    Object.freeze({
      label: "MoM Internal Loaded Cost Change %",
      key: null,
      type: "number",
    }),
    Object.freeze({ label: "Profit IK", key: null, type: "number" }),
    Object.freeze({ label: "MoM Profit IK Change", key: null, type: "number" }),
    Object.freeze({ label: "Profit OK", key: null, type: "number" }),
    Object.freeze({ label: "MoM Profit OK Change", key: null, type: "number" }),
  ]),
  "scheme-comparison": Object.freeze([
    col("Product / SKU", "product_sku_label", "text", productSkuSortText),
    col("Scheme", "scheme_name"),
    col("IK Net Realisation", "ik_net_sales_realisation", "number"),
    col("IK Margin %", "ik_margin_percent_after_scheme", "number"),
    col("IK Margin Band", "ik_scheme_margin_band"),
    col("OK Net Realisation", "ok_net_sales_realisation", "number"),
    col("OK Margin %", "ok_margin_percent_after_scheme", "number"),
    col("OK Margin Band", "ok_scheme_margin_band"),
    col("Status", "scheme_viability_status"),
  ]),
  "costing-review-workbench": Object.freeze([
    col("Material", "stock_item_label", "text", stockItemSortText),
    col("Area", "material_area"),
    col("Severity", "action_severity"),
    col("Route", "recommended_ui_route"),
    col("Affected Lines", "affected_line_count", "number"),
    col("Affected Products", "affected_product_count", "number"),
    col("Affected SKUs", "affected_sku_count", "number"),
    col("Blocking SKUs", "approval_blocking_sku_count", "number"),
    col("Review SKUs", "review_sku_count", "number"),
    col("Action Note", "action_note_summary"),
    col("Snapshot Refreshed", "snapshot_refreshed_at", "date"),
  ]),
  "sku-control-status": Object.freeze([
    col("Product", "product_label", "text", productSortText),
    col("SKU", null),
    col("Pack", null),
    col("Status", "control_severity"),
    col("Primary Control", "first_control_status"),
    col("Recommended Route", "recommended_ui_route"),
  ]),
  "driver-governance": Object.freeze([
    col("Cost Element", "cost_element_label"),
    col("Driver Domain", "driver_domain"),
    col("Formula", "formula_type"),
    col("Lifecycle", "lifecycle_status"),
    col("Validation", "validation_status"),
    col("Effective From", "effective_from", "date"),
    col("Maturity", "maturity_status"),
    col("Client", "client_status"),
    col("DQ", "data_quality_status"),
    col("Cutover", "cutover_status"),
    col("Owner", "owner_module"),
  ]),
});

/** A column is sortable when it has a key and no missing (null) accessor. */
export function isSortableColumn(column) {
  if (!column || !column.key) return false;
  if (!("get" in column)) return true;
  return typeof column.get === "function";
}

/**
 * New frozen column objects with shell-provided accessors injected by key
 * (e.g. { row_status: getRowStatus }). Columns not named are returned as is.
 */
export function withAccessors(columns, accessors) {
  const list = Array.isArray(columns) ? columns : [];
  const map = accessors || {};
  return Object.freeze(
    list.map((c) =>
      c && c.key && typeof map[c.key] === "function"
        ? Object.freeze({ ...c, get: map[c.key] })
        : c,
    ),
  );
}

export function tableColumnsFor(lens) {
  return GENERIC_TABLE_COLUMNS[lens] || null;
}

/**
 * Copies of `rows` with every key kept in its original order and only
 * formula-leading string values neutralised (numbers and other types are left
 * as they are). Fed to the shell's legacy exportCsvForRows, each cell escapes
 * to exactly csvCell(value), while the legacy column derivation (headers and
 * order) and filename are reused unchanged.
 */
export function neutraliseCsvRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return list.map((row) => {
    if (!row || typeof row !== "object") return row;
    const out = {};
    Object.keys(row).forEach((k) => {
      out[k] = neutraliseCsvValue(row[k]);
    });
    return out;
  });
}

// Short plain wording built only from the existing on-screen column labels.
export const COLUMN_HELP = Object.freeze({
  "sku-cost-sheet": Object.freeze({
    sku_id: "SKU ID. Click to sort.",
    mrp_ik: "MRP IK. Click to sort.",
    mrp_ok: "MRP OK. Click to sort.",
    internal_loaded_cost_per_sku: "Internal Loaded Cost. Click to sort.",
    ik_selling_price: "IK Selling Price. Click to sort.",
    ok_selling_price: "OK Selling Price. Click to sort.",
  }),
  "printable-cost-sheet": Object.freeze({
    sku_column_labels: "SKU Columns. Click to sort.",
    product_cost_sheet_status: "Status. Click to sort.",
    refreshed_at: "Refreshed At. Click to sort.",
  }),
});

export function columnHelpFor(lens, key) {
  const byLens = COLUMN_HELP[lens];
  if (!byLens || !key) return "";
  const help = byLens[key];
  return typeof help === "string" ? help : "";
}

/**
 * Header-click state transition. `ctx` = { lens, state, sortedView, unsorted }.
 * If `view` is not the array this helper last produced (filter/search/reload
 * reassigned VIEW), the previous sort is treated as cleared.
 * Returns the new ctx plus the `view` to install as VIEW.
 */
export function applySortClick(ctx, lens, view, column) {
  const fresh =
    ctx && ctx.lens === lens && ctx.sortedView && ctx.sortedView === view;
  const unsorted = fresh ? ctx.unsorted : view;
  const prev = fresh ? ctx.state : { key: null, dir: "none" };
  const state = nextSortState(prev, column.key);
  const next =
    state.dir === "none"
      ? unsorted
      : sortRowsBy(unsorted, column, state.dir);
  return {
    ctx: { lens, state, sortedView: next, unsorted },
    view: next,
  };
}

/** Sort state that still applies to `view`, or a cleared state. */
export function activeSortState(ctx, lens, view) {
  if (ctx && ctx.lens === lens && ctx.sortedView && ctx.sortedView === view) {
    return ctx.state;
  }
  return { key: null, dir: "none" };
}
