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
  const list = Array.isArray(rows) ? rows : [];
  if (!key || (dir !== "asc" && dir !== "desc")) return list.slice();
  const sign = dir === "desc" ? -1 : 1;
  return list
    .map((row, index) => ({ row, index }))
    .sort((x, y) => {
      const va = x.row?.[key];
      const vb = y.row?.[key];
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

/**
 * Column -> row-key mapping for lenses listed in the shell's generic header map.
 * key: null means the displayed cell is not a single row field (composite,
 * fallback chain or client-derived), so the column is not sortable.
 */
export const GENERIC_TABLE_COLUMNS = Object.freeze({
  "sku-cost-sheet": Object.freeze([
    Object.freeze({ label: "", key: null, type: "text" }),
    Object.freeze({ label: "Product / SKU", key: null, type: "text" }),
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
    Object.freeze({ label: "Status", key: null, type: "text" }),
  ]),
  "printable-cost-sheet": Object.freeze([
    Object.freeze({ label: "Product", key: null, type: "text" }),
    Object.freeze({ label: "Category", key: null, type: "text" }),
    Object.freeze({ label: "Group", key: null, type: "text" }),
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
});

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
      : sortRows(unsorted, state.key, state.dir, column.type || "text");
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
