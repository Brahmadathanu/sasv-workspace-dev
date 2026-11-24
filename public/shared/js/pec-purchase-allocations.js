// public/shared/js/pec-purchase-allocations.js
//
// PEC "Purchase Allocations" lens: view-model core, V1 contract adapter and lens controller.
//
// Layers (one file so the service worker / cache treatment is a single module):
//   1. core      - DOM-free: IST dates, coordinated state, per-UOM totals, ordering, export builders
//   2. adapter   - DOM-free: maps the frozen V1 reporting RPC rows to the client view-model
//   3. lens      - DOM controller, created through initPurchaseAllocationsLens(ctx); touches no
//                  global at import time, so the first two layers are unit-testable in Node.
//
// Business rules enforced here (presentation only; the server is the allocation authority):
//  - dates are voucher dates in the Asia/Kolkata calendar; default preset is Yesterday;
//  - quantities are never summed across UOMs (totals are always per UOM);
//  - receipt-level quantities repeat on every trail row of a receipt and are de-duplicated by
//    purchase fact; period indent balances repeat per receipt and are de-duplicated by indent line;
//  - allocations to indents outside an active indent filter are never presented as excess;
//  - no FIFO recalculation, ever; balances are server values labelled "reconstructed";
//  - canonical ordering: numeric indent number, then canonical indent serial;
//  - complete-export integrity: refuse to export a partial or drifting dataset.
// This lens is read-only; nothing here mutates data.

export const IST_TZ = "Asia/Kolkata";
export const DATE_PRESETS = Object.freeze(["today", "yesterday", "specific", "custom"]);
export const VIEW_MODES = Object.freeze(["indent", "material", "vendor"]);
export const ALLOCATION_STATUSES = Object.freeze(["all", "allocated", "partial", "unallocated"]);
export const DEFAULT_PRESET = "yesterday";
export const DEFAULT_MODE = "indent";

/**
 * @typedef {Object} PaTrailRow  V1 trail row, camelCase (one purchase fact x one indent line, or the receipt-only remainder)
 * @property {number} purchaseFactId   technical trace id (not a Tally voucher number)
 * @property {string} voucherDate  @property {string} vendorKey  @property {number|null} vendorId  @property {string} supplierName
 * @property {number} materialClassId  @property {string} materialClass  @property {number} stockItemId  @property {string} materialName
 * @property {number} uomId  @property {string} uom
 * @property {number} grossQty  @property {number} effectiveQty  @property {number} receiptAllocatedQty
 * @property {number} unallocatedQty  @property {number} acceptedQty  @property {number} netUnallocatedQty   receipt-level (repeat per row)
 * @property {number|null} indentId  @property {number|null} indentNumber  @property {number|null} indentLineId  @property {number|null} indentSerial
 * @property {string|null} approvedDate  @property {number|null} requestedQty  @property {number|null} allocatedQty  allocation of this receipt to this line
 * @property {number|null} openingBalance  @property {number|null} periodNewDemandQty  @property {number|null} periodAllocatedQty
 * @property {number|null} closingBalance  @property {number|null} currentBalance      period-level (repeat per receipt)
 * @property {"allocation"|"unallocated"} rowKind
 */

// ── dates (Asia/Kolkata calendar) ─────────────────────────────────────────────────────
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidYmd(s) {
  const m = YMD.exec(String(s ?? ""));
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/** Calendar date (YYYY-MM-DD) of an instant in Asia/Kolkata, independent of the machine time zone. */
export function istDateString(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addDays(ymd, n) {
  if (!isValidYmd(ymd)) throw new RangeError(`invalid date ${ymd}`);
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Resolve the date control into an inclusive voucher-date range.
 * @returns {{preset:string, from:string|null, to:string|null, valid:boolean, error:string|null, label:string}}
 */
export function resolveDateRange(date, now = new Date()) {
  const preset = DATE_PRESETS.includes(date?.preset) ? date.preset : DEFAULT_PRESET;
  const bad = (error) => ({ preset, from: null, to: null, valid: false, error, label: "" });
  if (preset === "today" || preset === "yesterday") {
    const today = istDateString(now);
    const d = preset === "today" ? today : addDays(today, -1);
    return { preset, from: d, to: d, valid: true, error: null, label: `${preset === "today" ? "Today" : "Yesterday"} (${d})` };
  }
  if (preset === "specific") {
    if (!isValidYmd(date?.specific)) return bad("Select a valid date.");
    return { preset, from: date.specific, to: date.specific, valid: true, error: null, label: date.specific };
  }
  if (!isValidYmd(date?.from) || !isValidYmd(date?.to)) return bad("Select a valid start and end date.");
  if (date.from > date.to) return bad("Start date must not be after end date.");
  return {
    preset, from: date.from, to: date.to, valid: true, error: null,
    label: date.from === date.to ? date.from : `${date.from} to ${date.to}`,
  };
}

// ── coordinated lens state ────────────────────────────────────────────────────────────
export function createInitialState() {
  return {
    mode: DEFAULT_MODE,
    date: { preset: DEFAULT_PRESET, specific: null, from: null, to: null },
    search: "",
    filters: { materialClass: "", indentQ: "", vendorQ: "", allocationStatus: "all" },
  };
}

const norm = (v) => String(v ?? "").trim();

/** Pure reducer. Mode, dates, search and filters are one coordinated state across the three modes. */
export function reduceState(state, action) {
  switch (action?.type) {
    case "setMode":
      return VIEW_MODES.includes(action.mode) ? { ...state, mode: action.mode } : state;
    case "setDatePreset":
      return DATE_PRESETS.includes(action.preset) ? { ...state, date: { ...state.date, preset: action.preset } } : state;
    case "setSpecificDate":
      return { ...state, date: { ...state.date, preset: "specific", specific: norm(action.value) } };
    case "setCustomRange":
      return { ...state, date: { ...state.date, preset: "custom", from: norm(action.from), to: norm(action.to) } };
    case "setSearch":
      return { ...state, search: norm(action.value) };
    case "setFilter": {
      if (!(action.key in state.filters)) return state;
      let value = norm(action.value);
      if (action.key === "allocationStatus" && !ALLOCATION_STATUSES.includes(value)) value = "all";
      if (action.key === "materialClass") value = value.toUpperCase() === "PLM" ? "PM" : value.toUpperCase();
      return { ...state, filters: { ...state.filters, [action.key]: value } };
    }
    case "resetFilters":
      return { ...state, filters: createInitialState().filters, search: "" };
    default:
      return state;
  }
}

/** Number of active filters (search excluded; it has its own clear control). */
export function activeFilterCount(state) {
  const f = state.filters;
  return [f.materialClass, f.indentQ, f.vendorQ].filter(Boolean).length +
    (f.allocationStatus && f.allocationStatus !== "all" ? 1 : 0);
}

/**
 * Stable identity of what the lens is asking for. Used for latest-response-wins: a response whose
 * key differs from the current key is stale and must be discarded.
 */
export function requestKey(state, now = new Date()) {
  const r = resolveDateRange(state.date, now);
  return JSON.stringify({
    mode: state.mode, from: r.from, to: r.to, valid: r.valid,
    search: state.search, filters: state.filters,
  });
}

/** Like requestKey but independent of the view mode: what the DATA depends on (summary, per-mode lists). */
export function dataKey(state, now = new Date()) {
  const r = resolveDateRange(state.date, now);
  return JSON.stringify({ from: r.from, to: r.to, valid: r.valid, search: state.search, filters: state.filters });
}

// ── quantities: per-UOM only ──────────────────────────────────────────────────────────
const MICRO = 1e6;
const toMicro = (n) => Math.round(Number(n || 0) * MICRO);

/** Sum a quantity field per UOM using integer micro-units (no float drift). Never mixes UOMs. */
export function sumByUom(rows, field, uomKey = "uom") {
  const acc = new Map();
  for (const r of rows || []) {
    const u = norm(r?.[uomKey]) || "—";
    acc.set(u, (acc.get(u) || 0) + toMicro(r?.[field]));
  }
  return [...acc.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([uom, micro]) => ({ uom, total: micro / MICRO }));
}

export function formatQty(n) {
  if (n === null || n === undefined || n === "" || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 6 }).format(Number(n));
}

/** "9,369.455 Kg · 35 L · 41,066 Nos" — one entry per UOM. */
export function describeTotals(totals) {
  return (totals || []).map((t) => `${formatQty(t.total)} ${t.uom}`).join(" · ") || "—";
}

// ── canonical ordering ────────────────────────────────────────────────────────────────
const numOrNull = (v) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
const cmpNum = (a, b) => (a === b ? 0 : a === null ? 1 : b === null ? -1 : a - b);

/** indent number (numeric), canonical indent serial (numeric), voucher date, purchase fact id. */
export function compareCanonical(a, b) {
  return (
    cmpNum(numOrNull(a.indentNumber), numOrNull(b.indentNumber)) ||
    cmpNum(numOrNull(a.indentSerial), numOrNull(b.indentSerial)) ||
    String(a.voucherDate ?? "").localeCompare(String(b.voucherDate ?? "")) ||
    cmpNum(numOrNull(a.purchaseFactId), numOrNull(b.purchaseFactId))
  );
}
export const sortCanonical = (rows) => [...(rows || [])].sort(compareCanonical);

// ── complete retrieval (exports) ──────────────────────────────────────────────────────
/**
 * Refuse a partial or drifting export. `pages` are the page results in order, each
 * `{rows, total}`; `keyOf` identifies a row. Mirrors the vendor-buylist export contract.
 */
export function assertCompleteRetrieval(pages, keyOf) {
  const rows = pages.flatMap((p) => p.rows);
  const totals = new Set(pages.map((p) => p.total));
  if (totals.size > 1) {
    throw new Error(`Incomplete retrieval: total changed from ${pages[0].total} to ${pages[pages.length - 1].total} while loading; nothing was exported. Please retry.`);
  }
  const total = pages.length ? pages[0].total : 0;
  const keys = new Set(rows.map(keyOf));
  if (keys.size !== rows.length) {
    throw new Error("Incomplete retrieval: repeated rows across pages; nothing was exported. Please retry.");
  }
  if (rows.length !== total) {
    throw new Error(`Incomplete retrieval (${rows.length} of ${total} rows); nothing was exported. The list changed while loading - please retry.`);
  }
  return rows;
}

// ── export / print builders (pure) ────────────────────────────────────────────────────
export const EXPORT_NOTICES = Object.freeze([
  "Quantities are voucher-period allocations (purchase voucher dates), not current balances.",
  "Opening and closing balances are reconstructed under the current allocation authority, not immutable historical snapshots.",
  "Current balance is the live indent balance at generation time.",
  "Quantities are never totalled across different units of measure.",
]);

const BOM = String.fromCharCode(0xfeff); // UTF-8 byte-order mark so Excel opens the file as UTF-8

function csvCell(value) {
  const s = String(value ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * @param {{title:string, range:{label:string,from:string,to:string}, generatedAt:Date, modeLabel:string,
 *          filterSummary?:string, columns:{key:string,label:string}[], rows:object[],
 *          totals?:{label:string, items:{uom:string,total:number}[]}[]}} spec
 * @returns {string} Excel-compatible CSV (UTF-8 BOM, CRLF)
 */
export function buildCsv(spec) {
  const gen = `${istDateString(spec.generatedAt)} ${new Intl.DateTimeFormat("en-GB", { timeZone: IST_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(spec.generatedAt)} IST`;
  const lines = [
    [spec.title],
    ["Voucher date range", spec.range.from === spec.range.to ? spec.range.from : `${spec.range.from} to ${spec.range.to}`],
    ["View", spec.modeLabel],
    ["Filters", spec.filterSummary || "None"],
    ["Generated", gen],
    ...EXPORT_NOTICES.map((n) => ["Note", n]),
    [],
    spec.columns.map((c) => c.label),
    ...spec.rows.map((r) => spec.columns.map((c) => r[c.key] ?? "")),
  ];
  for (const t of spec.totals || []) {
    lines.push([]);
    lines.push([`${t.label} (per unit of measure)`]);
    for (const it of t.items) lines.push([it.uom, it.total]);
  }
  return `${BOM}${lines.map((l) => l.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/**
 * Print-friendly indent deduction statement (one section per indent, canonical serial order).
 * `rows` are INDENT LINES (see indentLinesFromTrail), one per indent line.
 * @param {{range:{from:string,to:string}, generatedAt:Date, filterSummary?:string, rows:PaTrailRow[]}} spec
 */
export function buildStatementHtml(spec) {
  const rows = sortCanonical(spec.rows.filter((r) => r.indentNumber !== null));
  const byIndent = new Map();
  for (const r of rows) {
    if (!byIndent.has(r.indentNumber)) byIndent.set(r.indentNumber, []);
    byIndent.get(r.indentNumber).push(r);
  }
  const range = spec.range.from === spec.range.to ? spec.range.from : `${spec.range.from} to ${spec.range.to}`;
  const sections = [...byIndent.entries()].map(([ind, lines]) => {
    const body = lines.map((r) => `<tr><td>${escapeHtml(r.indentSerial)}</td><td>${escapeHtml(r.materialName)}</td><td>${escapeHtml(r.uom)}</td>` +
      `<td class="n">${formatQty(r.openingBalance)}</td><td class="n">${formatQty(r.periodNewDemandQty)}</td>` +
      `<td class="n">${formatQty(r.periodAllocatedQty)}</td><td class="n">${formatQty(r.closingBalance)}</td>` +
      `<td class="n">${formatQty(r.currentBalance)}</td></tr>`).join("");
    return `<section><h2>Indent ${escapeHtml(ind)}</h2><table><thead><tr><th>Serial</th><th>Material</th><th>UOM</th>` +
      `<th>Opening (reconstructed)</th><th>New demand in period</th><th>Allocated in period</th><th>Closing (reconstructed)</th><th>Current balance</th></tr></thead>` +
      `<tbody>${body}</tbody></table></section>`;
  }).join("");
  const gen = `${istDateString(spec.generatedAt)} IST`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Indent deduction statement</title>` +
    `<style>body{font:12px/1.4 system-ui,sans-serif;margin:16px}h1{font-size:16px}h2{font-size:13px;margin:14px 0 4px}` +
    `table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:3px 6px;text-align:left}.n{text-align:right}` +
    `section{break-inside:avoid}.note{color:#444;margin:2px 0}@media print{body{margin:0}}</style></head><body>` +
    `<h1>Indent deduction statement</h1><div>Voucher date range: ${escapeHtml(range)}</div>` +
    `<div>Filters: ${escapeHtml(spec.filterSummary || "None")}</div><div>Generated: ${escapeHtml(gen)}</div>` +
    EXPORT_NOTICES.map((n) => `<div class="note">${escapeHtml(n)}</div>`).join("") +
    (sections || "<p>No allocations in the selected period.</p>") + `</body></html>`;
}

// ═════════════════════════════════════════════════════════════════════════════════════
// 2. V1 contract adapter (frozen interface; production calls stay behind this seam)
// ═════════════════════════════════════════════════════════════════════════════════════

export const PA_RPC = Object.freeze({
  summary: "proc_pec_purchase_alloc_summary",
  indent: "proc_pec_purchase_alloc_indent_paged",
  material: "proc_pec_purchase_alloc_material_paged",
  vendor: "proc_pec_purchase_alloc_vendor_paged",
  trail: "proc_pec_purchase_alloc_trail_paged",
});
export const PA_PAGE_LIMIT_MAX = 200;
export const PA_OFFSET_MAX = 100000;

export class PaContractError extends Error {
  constructor(message) { super(message); this.name = "PaContractError"; }
}

const emptyToNull = (v) => { const s = String(v ?? "").trim(); return s === "" ? null : s; };

/**
 * Common V1 arguments from the lens state. Returns null when the date range is invalid
 * (no request must be sent). Dates are inclusive voucher dates.
 */
export function buildCommonParams(state, now = new Date()) {
  const r = resolveDateRange(state.date, now);
  if (!r.valid) return null;
  const f = state.filters;
  return {
    p_date_from: r.from,
    p_date_to: r.to,
    p_material_class_code: emptyToNull(f.materialClass),
    p_q: emptyToNull(state.search),
    p_indent_q: emptyToNull(f.indentQ),
    p_vendor_q: emptyToNull(f.vendorQ),
    p_status: ALLOCATION_STATUSES.includes(f.allocationStatus) ? f.allocationStatus : "all",
  };
}

/** Trail-only extras; only supplied (non-null) keys are sent. */
export function buildTrailParams(common, extra = {}, limit = 50, offset = 0) {
  const out = { ...common };
  for (const k of ["p_indent_id", "p_stock_item_id", "p_uom_id", "p_vendor_key", "p_purchase_fact_id"]) {
    if (extra[k] !== undefined && extra[k] !== null && extra[k] !== "") out[k] = extra[k];
  }
  return withPaging(out, limit, offset);
}

export function withPaging(params, limit = 50, offset = 0) {
  const l = Math.min(PA_PAGE_LIMIT_MAX, Math.max(1, Math.floor(Number(limit) || 50)));
  const o = Math.min(PA_OFFSET_MAX, Math.max(0, Math.floor(Number(offset) || 0)));
  return { ...params, p_limit: l, p_offset: o };
}

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
const num0 = (v) => num(v) ?? 0;
function need(obj, fields, what) {
  if (!obj || typeof obj !== "object") throw new PaContractError(`${what}: expected an object`);
  const missing = fields.filter((f) => !(f in obj));
  if (missing.length) throw new PaContractError(`${what}: missing field(s) ${missing.join(", ")}`);
  return obj;
}

const UOM_QTY_FIELDS = ["uom_id", "uom_code", "gross_qty", "effective_qty", "allocated_qty", "matching_allocated_qty", "unallocated_qty", "accepted_qty", "net_unallocated_qty"];

export function mapUomTotals(list, what = "totals_by_uom") {
  if (!Array.isArray(list)) throw new PaContractError(`${what}: expected an array`);
  return list.map((t) => {
    need(t, ["uom_id", "uom_code", "allocated_qty"], what);
    return {
      uomId: num(t.uom_id), uom: String(t.uom_code ?? ""),
      grossQty: num0(t.gross_qty), effectiveQty: num0(t.effective_qty), allocatedQty: num0(t.allocated_qty),
      matchingAllocatedQty: num0(t.matching_allocated_qty), unallocatedQty: num0(t.unallocated_qty),
      acceptedQty: num0(t.accepted_qty), netUnallocatedQty: num0(t.net_unallocated_qty),
    };
  }).sort((a, b) => a.uom.localeCompare(b.uom));
}
export { UOM_QTY_FIELDS };

export function mapSummary(o) {
  need(o, ["date_from", "date_to", "purchase_fact_count", "affected_indent_count", "affected_indent_line_count", "totals_by_uom", "coverage", "balance_basis"], "summary");
  return {
    dateFrom: o.date_from, dateTo: o.date_to,
    purchaseFactCount: num0(o.purchase_fact_count), affectedIndentCount: num0(o.affected_indent_count),
    affectedIndentLineCount: num0(o.affected_indent_line_count),
    totalsByUom: mapUomTotals(o.totals_by_uom), coverage: String(o.coverage ?? ""), balanceBasis: String(o.balance_basis ?? ""),
  };
}

export function mapIndentRow(o) {
  need(o, ["indent_id", "indent_number", "approved_date", "material_line_count", "totals_by_uom"], "indent row");
  return {
    indentId: num(o.indent_id), indentNumber: num(o.indent_number), approvedDate: o.approved_date ?? null,
    materialLineCount: num0(o.material_line_count),
    totalsByUom: (o.totals_by_uom || []).map((t) => (need(t, ["uom_id", "uom_code", "allocated_qty"], "indent totals"),
      { uomId: num(t.uom_id), uom: String(t.uom_code ?? ""), allocatedQty: num0(t.allocated_qty) })).sort((a, b) => a.uom.localeCompare(b.uom)),
  };
}

export function mapMaterialRow(o) {
  need(o, ["material_class_id", "material_class_code", "stock_item_id", "stock_item_name", "uom_id", "uom_code", "purchase_fact_count",
    "gross_qty", "effective_qty", "allocated_qty", "matching_allocated_qty", "unallocated_qty", "accepted_qty", "net_unallocated_qty"], "material row");
  return {
    materialClassId: num(o.material_class_id), materialClass: String(o.material_class_code ?? ""),
    stockItemId: num(o.stock_item_id), materialName: String(o.stock_item_name ?? ""),
    uomId: num(o.uom_id), uom: String(o.uom_code ?? ""), purchaseFactCount: num0(o.purchase_fact_count),
    grossQty: num0(o.gross_qty), effectiveQty: num0(o.effective_qty), allocatedQty: num0(o.allocated_qty),
    matchingAllocatedQty: num0(o.matching_allocated_qty), unallocatedQty: num0(o.unallocated_qty),
    acceptedQty: num0(o.accepted_qty), netUnallocatedQty: num0(o.net_unallocated_qty),
  };
}

export function mapVendorRow(o) {
  need(o, ["vendor_key", "vendor_id", "supplier_name", "material_count", "purchase_fact_count", "totals_by_uom"], "vendor row");
  return {
    vendorKey: String(o.vendor_key), vendorId: num(o.vendor_id), supplierName: String(o.supplier_name ?? ""),
    materialCount: num0(o.material_count), purchaseFactCount: num0(o.purchase_fact_count),
    totalsByUom: mapUomTotals(o.totals_by_uom, "vendor totals_by_uom"),
  };
}

export function mapTrailRow(o) {
  need(o, ["purchase_fact_id", "voucher_date", "vendor_key", "supplier_name", "stock_item_id", "stock_item_name", "uom_id", "uom_code",
    "gross_qty", "effective_qty", "receipt_allocated_qty", "unallocated_qty", "accepted_qty", "net_unallocated_qty", "indent_id", "indent_number",
    "indent_line_id", "indent_line_sort_no", "allocated_qty", "row_kind"], "trail row");
  if (o.row_kind !== "allocation" && o.row_kind !== "unallocated") throw new PaContractError(`trail row: unknown row_kind ${o.row_kind}`);
  const alloc = o.row_kind === "allocation";
  if (alloc && (o.indent_line_id === null || o.indent_id === null)) throw new PaContractError("trail row: allocation row without an indent line");
  return {
    purchaseFactId: num(o.purchase_fact_id), voucherDate: o.voucher_date, vendorKey: String(o.vendor_key), vendorId: num(o.vendor_id),
    supplierName: String(o.supplier_name ?? ""), materialClassId: num(o.material_class_id), materialClass: String(o.material_class_code ?? ""),
    stockItemId: num(o.stock_item_id), materialName: String(o.stock_item_name ?? ""), uomId: num(o.uom_id), uom: String(o.uom_code ?? ""),
    grossQty: num0(o.gross_qty), effectiveQty: num0(o.effective_qty), receiptAllocatedQty: num0(o.receipt_allocated_qty),
    unallocatedQty: num0(o.unallocated_qty), acceptedQty: num0(o.accepted_qty), netUnallocatedQty: num0(o.net_unallocated_qty),
    indentId: num(o.indent_id), indentNumber: num(o.indent_number), indentLineId: num(o.indent_line_id), indentSerial: num(o.indent_line_sort_no),
    approvedDate: o.approved_date ?? null, requestedQty: num(o.requested_qty), allocatedQty: alloc ? num(o.allocated_qty) : null,
    openingBalance: num(o.opening_balance), periodNewDemandQty: num(o.period_new_demand_qty), periodAllocatedQty: num(o.period_allocated_qty),
    closingBalance: num(o.closing_balance), currentBalance: num(o.current_balance), rowKind: o.row_kind,
  };
}

// ── contract-derived presentation helpers ─────────────────────────────────────────────

/**
 * Receipt status. A receipt returned down to nil effective quantity is NOT "unallocated":
 * there is nothing left to allocate, so it is reported separately from positive unallocated receipts.
 * @returns {"returned"|"unallocated"|"partial"|"allocated"}
 */
export function receiptStatus({ grossQty, effectiveQty, receiptAllocatedQty, allocatedQty, unallocatedQty }) {
  const eff = micro(effectiveQty), alloc = micro(receiptAllocatedQty ?? allocatedQty), un = micro(unallocatedQty);
  if (eff === 0 && micro(grossQty) > 0) return "returned";
  if (un > 0 && alloc === 0) return "unallocated";
  if (un > 0) return "partial";
  return "allocated";
}
export const RECEIPT_STATUS_LABEL = Object.freeze({
  returned: "Returned (nil effective)", unallocated: "Unallocated", partial: "Partly allocated", allocated: "Fully allocated",
});
const micro = (n) => Math.round(Number(n || 0) * MICRO);

function dedupeBy(rows, keyFn) {
  const seen = new Set(); const out = [];
  for (const r of rows) { const k = keyFn(r); if (seen.has(k)) continue; seen.add(k); out.push(r); }
  return out;
}

/** Receipt aggregates: one entry per purchase fact (receipt-level quantities repeat on trail rows). */
export const receiptsFromTrail = (rows) => dedupeBy(rows, (r) => r.purchaseFactId);

/** Indent-line summaries: one entry per indent line (period balances repeat per receipt), canonical order. */
export const indentLinesFromTrail = (rows) =>
  sortCanonical(dedupeBy(rows.filter((r) => r.rowKind === "allocation"), (r) => r.indentLineId));

/**
 * Reconcile a trail: per-UOM receipt totals from de-duplicated receipts, the allocation that is
 * visible in this (possibly indent-filtered) trail, and the remainder allocated to other indents.
 * The remainder is NOT excess; unallocated stays the server's receipt-wide figure.
 */
export function reconcileTrail(rows) {
  const receipts = receiptsFromTrail(rows);
  const alloc = rows.filter((r) => r.rowKind === "allocation");
  const byUom = new Map();
  const slot = (u) => { if (!byUom.has(u)) byUom.set(u, { uom: u, gross: 0, effective: 0, receiptAllocated: 0, unallocated: 0, accepted: 0, shown: 0 }); return byUom.get(u); };
  for (const r of receipts) {
    const s = slot(r.uom);
    s.gross += micro(r.grossQty); s.effective += micro(r.effectiveQty); s.receiptAllocated += micro(r.receiptAllocatedQty);
    s.unallocated += micro(r.unallocatedQty); s.accepted += micro(r.acceptedQty);
  }
  for (const r of alloc) slot(r.uom).shown += micro(r.allocatedQty);
  return [...byUom.values()].sort((a, b) => a.uom.localeCompare(b.uom)).map((s) => ({
    uom: s.uom, grossQty: s.gross / MICRO, effectiveQty: s.effective / MICRO, receiptAllocatedQty: s.receiptAllocated / MICRO,
    unallocatedQty: s.unallocated / MICRO, acceptedQty: s.accepted / MICRO, shownAllocatedQty: s.shown / MICRO,
    otherIndentAllocatedQty: (s.receiptAllocated - s.shown) / MICRO,
  }));
}

/** Trail -> [{receipt, allocations}] in canonical receipt order (voucher date, fact id); allocations canonical. */
export function groupTrailByReceipt(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.purchaseFactId)) map.set(r.purchaseFactId, { receipt: r, allocations: [] });
    if (r.rowKind === "allocation") map.get(r.purchaseFactId).allocations.push(r);
  }
  const groups = [...map.values()].sort((a, b) =>
    String(a.receipt.voucherDate).localeCompare(String(b.receipt.voucherDate)) || a.receipt.purchaseFactId - b.receipt.purchaseFactId);
  groups.forEach((g) => { g.allocations = sortCanonical(g.allocations); });
  return groups;
}

/** Vendor drill: material (item + UOM) -> receipts -> allocations. */
export function groupTrailByMaterial(rows) {
  const map = new Map();
  for (const r of rows) {
    const k = `${r.stockItemId}|${r.uomId}`;
    if (!map.has(k)) map.set(k, { key: k, materialName: r.materialName, materialClass: r.materialClass, uom: r.uom, rows: [] });
    map.get(k).rows.push(r);
  }
  return [...map.values()]
    .sort((a, b) => a.materialName.localeCompare(b.materialName) || a.uom.localeCompare(b.uom))
    .map((g) => ({ ...g, receipts: groupTrailByReceipt(g.rows) }));
}

/** Aggregate trail-style per-UOM entries into display text for one field, e.g. "135 Kg · 35 L". */
export function describeUomField(totalsByUom, field) {
  return (totalsByUom || []).map((t) => `${formatQty(t[field])} ${t.uom}`).join(" · ") || "—";
}

// ═════════════════════════════════════════════════════════════════════════════════════
// 3. Lens controller (DOM). Created once by the console through initPurchaseAllocationsLens(ctx).
//    ctx supplies the console's shared infrastructure (feeds, RPC, modals, toasts, export helpers),
//    so the lens reuses - never re-implements - paging, latest-wins, filter drawers and dialogs.
// ═════════════════════════════════════════════════════════════════════════════════════

const MODE_LABEL = { indent: "Indent-wise", material: "Material-wise", vendor: "Vendor-wise" };
const MODE_NOUN = { indent: ["indent", "indents"], material: ["material", "materials"], vendor: ["supplier", "suppliers"] };
const plural = (n, [one, many]) => `${n} ${n === 1 ? one : many}`;
const TRAIL_KEY = (r) => `${r.purchaseFactId}|${r.indentLineId ?? "u"}`;

export function initPurchaseAllocationsLens(ctx) {
  const { qs, esc, toast, createFeed, rpcPecPaged, rpcPecJson, openIndent, hideModalBackdrop, applyRowCards, setTab,
    downloadText, makeExportTimestamp, toggleExportMenu, closeAllExportMenus, errText } = ctx;
  const nowFn = ctx.now || (() => new Date());
  const pageSize = () => Math.min(PA_PAGE_LIMIT_MAX, Math.max(1, Number(ctx.pageSize?.() || 50)));

  let st = createInitialState();
  const loadedKey = { indent: null, material: null, vendor: null };
  let summaryKey = null;
  let summarySeq = 0;
  let drillSeq = 0;
  let lastDrill = null;
  let pendingReturn = null;
  let wired = false;
  let searchTimer = 0;
  const expanded = new Map(); // indentId -> { open, status, lines, error }
  const scrollPos = { indent: 0, material: 0, vendor: 0 };

  const common = () => buildCommonParams(st, nowFn());
  const indentFilterActive = () => Boolean(st.filters.indentQ);
  const errMsg = (e) => (e instanceof PaContractError ? `Server contract mismatch (${e.message}).` : (errText ? errText(e) : e?.message || String(e)));

  // ── data access ────────────────────────────────────────────────────────────────────
  async function fetchPage(name, params, limit, offset, signal, mapper) {
    if (!params) return { rows: [], total: 0 };
    const page = await rpcPecPaged(name, withPaging(params, limit, offset), signal);
    return { rows: page.rows.map(mapper), total: page.total };
  }

  /** Every page of a paged RPC, refusing a partial or drifting dataset (exports and drill-downs). */
  async function fetchAll(name, paramsFor, mapper, keyOf, signal = null) {
    const pages = [];
    let offset = 0;
    for (;;) {
      const page = await fetchPage(name, paramsFor(offset), 200, offset, signal, mapper);
      pages.push(page);
      offset += page.rows.length;
      if (!page.rows.length || offset >= page.total) break;
      if (offset >= PA_OFFSET_MAX) throw new Error("Too many rows to retrieve in one pass; narrow the date range or filters.");
    }
    return assertCompleteRetrieval(pages, keyOf);
  }
  const fetchTrail = (c, extra) => fetchAll(PA_RPC.trail, (off) => buildTrailParams(c, extra, 200, off), mapTrailRow, TRAIL_KEY);

  // ── feeds (shared createFeed: latest-response-wins, abort, infinite scroll) ───────
  const mkFeed = (mode, name, scrollId, rpc, mapper, keyOf) => createFeed({
    name, scrollId, pageSize,
    snapshotParams: () => common(),
    fetchPage: ({ params, limit, offset, signal }) => fetchPage(rpc, params, limit, offset, signal, mapper),
    keyOf,
    onUpdate: (f) => renderMode(mode, f),
  });
  const feeds = {
    indent: mkFeed("indent", "paIndent", "paScrollIndent", PA_RPC.indent, mapIndentRow, (r) => r.indentId),
    material: mkFeed("material", "paMaterial", "paScrollMaterial", PA_RPC.material, mapMaterialRow, (r) => `${r.materialClassId}|${r.stockItemId}|${r.uomId}`),
    vendor: mkFeed("vendor", "paVendor", "paScrollVendor", PA_RPC.vendor, mapVendorRow, (r) => r.vendorKey),
  };

  // ── rendering ──────────────────────────────────────────────────────────────────────
  const q = (n) => formatQty(n);
  const stateBox = (html, kind = "") => `<div class="pa-state ${kind}" role="${kind === "is-error" ? "alert" : "status"}">${html}</div>`;
  const retryHtml = (msg) => `${esc(msg)} <button type="button" class="pa-link-btn" data-pa-retry>Retry</button>`;
  const stack = (totals, field) => `<div class="pa-uom-stack">${(totals || []).map((t) => `<span>${esc(q(t[field]))} ${esc(t.uom)}</span>`).join("") || "—"}</div>`;

  function renderControls() {
    const r = resolveDateRange(st.date, nowFn());
    qs("paModeSeg").querySelectorAll("[data-pa-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.paMode === st.mode)));
    qs("paDateSeg").querySelectorAll("[data-pa-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.paPreset === r.preset)));
    qs("paDateSpecific").hidden = r.preset !== "specific";
    qs("paDateFrom").hidden = r.preset !== "custom";
    qs("paDateTo").hidden = r.preset !== "custom";
    if (r.preset === "specific") qs("paDateSpecific").value = st.date.specific || "";
    if (r.preset === "custom") { qs("paDateFrom").value = st.date.from || ""; qs("paDateTo").value = st.date.to || ""; }
    const lab = qs("paRangeLabel");
    lab.textContent = r.valid ? `Voucher dates (Asia/Kolkata): ${r.label}` : r.error;
    lab.classList.toggle("is-error", !r.valid);
    const n = activeFilterCount(st);
    const badge = qs("paFilterBadge");
    badge.style.display = n ? "" : "none";
    badge.textContent = n ? String(n) : "";
    qs("paSearchClear").style.display = st.search ? "" : "none";
    for (const m of VIEW_MODES) qs({ indent: "paScrollIndent", material: "paScrollMaterial", vendor: "paScrollVendor" }[m]).hidden = m !== st.mode;
    const matchHidden = !indentFilterActive();
    document.querySelectorAll("#tab-purchase-allocations .pa-col-match").forEach((el) => { el.hidden = matchHidden; });
  }

  function renderMeta() {
    const f = feeds[st.mode].state;
    qs("paMeta").textContent = f.loadedOnce || f.total ? plural(f.total, MODE_NOUN[st.mode]) : "";
  }

  function emptyOrError(f, mode) {
    if (!common()) return { html: "Select a valid voucher date range to see purchase allocations." };
    if (f.error) return { err: true, html: retryHtml(`Could not load purchase allocations: ${errMsg(f.error)}`) };
    if (f.loading || !f.loadedOnce) return { html: "" };
    const hint = mode === "material"
      ? "Purchases with no allocation still appear here; none match the current filters."
      : "Tally vouchers usually arrive with the next synchronisation - try Yesterday, or widen the date range or clear filters.";
    return { html: `No ${mode === "indent" ? "allocations" : "purchases"} in the selected period match the current filters. ${hint}` };
  }

  function renderMode(mode, f) {
    if (mode === "indent") renderIndent(f);
    else if (mode === "material") renderMaterial(f);
    else renderVendor(f);
    if (mode === st.mode) renderMeta();
  }

  function renderIndent(f) {
    const host = qs("paIndentList");
    host.innerHTML = "";
    if (!f.rows.length) {
      const s = emptyOrError(f, "indent");
      if (s.html) host.innerHTML = stateBox(s.html, s.err ? "is-error" : "");
    }
    for (const row of f.rows) {
      const card = document.createElement("div");
      card.className = "pa-indent-card";
      card.dataset.indentId = String(row.indentId);
      const bodyId = `paLines-${row.indentId}`;
      const open = expanded.get(row.indentId)?.open;
      card.innerHTML = `
        <div class="pa-indent-head">
          <button type="button" class="pa-indent-toggle" aria-expanded="${open ? "true" : "false"}" aria-controls="${bodyId}">
            <span class="pa-chev" aria-hidden="true">▸</span>
            <span class="pa-indent-title">Indent ${esc(row.indentNumber)}</span>
            <span class="pa-indent-meta">${row.approvedDate ? `Approved ${esc(row.approvedDate)} · ` : ""}${esc(plural(row.materialLineCount, ["material line", "material lines"]))}</span>
            <span class="pa-indent-meta">Allocated: ${esc(describeUomField(row.totalsByUom, "allocatedQty"))}</span>
          </button>
          <button type="button" class="pa-link-btn" data-open-indent="${esc(row.indentId)}" data-indent-number="${esc(row.indentNumber)}">Open indent</button>
        </div>
        <div class="pa-indent-lines" id="${bodyId}" ${open ? "" : "hidden"}></div>`;
      host.appendChild(card);
      if (open) paintLines(card, expanded.get(row.indentId));
    }
  }

  function paintLines(card, entry) {
    const body = card.querySelector(".pa-indent-lines");
    if (!body || !entry) return;
    if (entry.status === "loading") { body.innerHTML = stateBox("Loading material lines…"); return; }
    if (entry.status === "error") { body.innerHTML = stateBox(retryHtml(`Could not load the lines: ${entry.error}`), "is-error"); return; }
    if (!entry.lines.length) { body.innerHTML = stateBox("No allocated material lines for this indent in the selected period."); return; }
    body.innerHTML = `
      <table class="pa-lines-table">
        <thead><tr><th>Serial</th><th>Material</th><th>UOM</th>
          <th class="pa-num" title="Reconstructed under the current allocation authority">Opening*</th><th class="pa-num">New demand</th>
          <th class="pa-num">Allocated in period</th><th class="pa-num" title="Reconstructed under the current allocation authority">Closing*</th><th class="pa-num">Current balance</th></tr></thead>
        <tbody>${entry.lines.map((l) => `<tr><td>${esc(l.indentSerial)}</td><td>${esc(l.materialName)}</td><td>${esc(l.uom)}</td>
          <td class="pa-num">${esc(q(l.openingBalance))}</td><td class="pa-num">${esc(q(l.periodNewDemandQty))}</td><td class="pa-num">${esc(q(l.periodAllocatedQty))}</td>
          <td class="pa-num">${esc(q(l.closingBalance))}</td><td class="pa-num">${esc(q(l.currentBalance))}</td></tr>`).join("")}</tbody>
      </table>
      <p class="pa-note">* Opening and closing balances are reconstructed under the current allocation authority, not immutable historical snapshots. Current balance is the live indent balance.</p>`;
  }

  async function toggleIndent(card) {
    const id = Number(card.dataset.indentId);
    const entry = expanded.get(id);
    if (entry?.open) { entry.open = false; card.querySelector(".pa-indent-toggle").setAttribute("aria-expanded", "false"); card.querySelector(".pa-indent-lines").hidden = true; return; }
    const c = common();
    if (!c) return;
    const mine = { open: true, status: "loading", lines: [], error: "" };
    expanded.set(id, mine);
    card.querySelector(".pa-indent-toggle").setAttribute("aria-expanded", "true");
    card.querySelector(".pa-indent-lines").hidden = false;
    paintLines(card, mine);
    const key = dataKey(st, nowFn());
    try {
      const rows = await fetchTrail(c, { p_indent_id: id });
      if (expanded.get(id) !== mine || key !== dataKey(st, nowFn())) return; // stale
      mine.lines = indentLinesFromTrail(rows); mine.status = "ready";
    } catch (e) {
      if (expanded.get(id) !== mine) return;
      mine.status = "error"; mine.error = errMsg(e);
    }
    const live = qs("paIndentList").querySelector(`[data-indent-id="${id}"]`);
    if (live) paintLines(live, mine);
  }

  const statusBadge = (s) => `<span class="pa-badge" data-status="${s}">${esc(RECEIPT_STATUS_LABEL[s])}</span>`;
  const differs = (a, b) => micro(a) !== micro(b);

  function renderMaterial(f) {
    const tbody = qs("paMaterialTbody");
    tbody.innerHTML = "";
    const cols = 9;
    if (!f.rows.length) {
      const s = emptyOrError(f, "material");
      if (s.html) tbody.innerHTML = `<tr class="pec-table-state-row"><td colspan="${cols}">${stateBox(s.html, s.err ? "is-error" : "")}</td></tr>`;
    }
    const match = indentFilterActive();
    for (const r of f.rows) {
      const tr = document.createElement("tr");
      tr.className = "clickable-row";
      tr.style.cursor = "pointer";
      const status = receiptStatus(r);
      tr.innerHTML = `
        <td><div>${esc(r.materialName)}</div><div class="muted">${esc(r.materialClass)}</div></td>
        <td>${esc(r.uom)}</td>
        <td class="pa-num">${esc(q(r.grossQty))}</td>
        <td class="pa-num">${differs(r.effectiveQty, r.grossQty) ? esc(q(r.effectiveQty)) : "—"}</td>
        <td class="pa-num">${esc(q(r.allocatedQty))}</td>
        ${match ? `<td class="pa-num pa-col-match">${esc(q(r.matchingAllocatedQty))}</td>` : ""}
        <td class="pa-num">${esc(q(r.unallocatedQty))}</td>
        <td class="pa-num">${r.acceptedQty ? esc(q(r.acceptedQty)) : "—"}</td>
        <td>${statusBadge(status)}</td>`;
      tr.addEventListener("click", () => openDrill({ kind: "material", title: `${r.materialName} · ${r.uom}`,
        extra: { p_stock_item_id: r.stockItemId, p_uom_id: r.uomId } }));
      tbody.appendChild(tr);
    }
    applyRowCards(qs("tab-purchase-allocations"));
  }

  function renderVendor(f) {
    const tbody = qs("paVendorTbody");
    tbody.innerHTML = "";
    if (!f.rows.length) {
      const s = emptyOrError(f, "vendor");
      if (s.html) tbody.innerHTML = `<tr class="pec-table-state-row"><td colspan="8">${stateBox(s.html, s.err ? "is-error" : "")}</td></tr>`;
    }
    for (const r of f.rows) {
      const tr = document.createElement("tr");
      tr.className = "clickable-row";
      tr.style.cursor = "pointer";
      const unmapped = r.vendorId === null;
      tr.innerHTML = `
        <td><div>${esc(r.supplierName || "(no supplier name)")}</div>${unmapped ? '<div class="muted">Unmapped supplier</div>' : ""}</td>
        <td class="pa-num">${esc(r.materialCount)}</td><td class="pa-num">${esc(r.purchaseFactCount)}</td>
        <td class="pa-num">${stack(r.totalsByUom, "grossQty")}</td><td class="pa-num">${stack(r.totalsByUom, "effectiveQty")}</td>
        <td class="pa-num">${stack(r.totalsByUom, "allocatedQty")}</td><td class="pa-num">${stack(r.totalsByUom, "unallocatedQty")}</td>
        <td class="pa-num">${stack(r.totalsByUom, "acceptedQty")}</td>`;
      tr.addEventListener("click", () => openDrill({ kind: "vendor", title: r.supplierName || "(no supplier name)", extra: { p_vendor_key: r.vendorKey } }));
      tbody.appendChild(tr);
    }
    applyRowCards(qs("tab-purchase-allocations"));
  }

  function renderSummary(sum, err) {
    const box = qs("paSummary");
    if (err) { box.innerHTML = stateBox(retryHtml(`Could not load the period summary: ${err}`), "is-error"); return; }
    if (!sum) { box.innerHTML = ""; return; }
    const match = indentFilterActive();
    const head = `<tr><th>UOM</th><th>Purchased</th><th>Effective</th><th>${match ? "Allocated (any indent)" : "Allocated"}</th>${match ? "<th>Allocated to filtered indent</th>" : ""}<th>Unallocated</th><th>Accepted excess</th></tr>`;
    const rows = sum.totalsByUom.map((t) => `<tr><td>${esc(t.uom)}</td><td>${esc(q(t.grossQty))}</td><td>${esc(q(t.effectiveQty))}</td><td>${esc(q(t.allocatedQty))}</td>${match ? `<td>${esc(q(t.matchingAllocatedQty))}</td>` : ""}<td>${esc(q(t.unallocatedQty))}</td><td>${esc(q(t.acceptedQty))}</td></tr>`).join("");
    box.innerHTML = `
      <div class="pa-summary-counts">${esc(plural(sum.purchaseFactCount, ["receipt", "receipts"]))} · ${esc(plural(sum.affectedIndentCount, ["indent", "indents"]))} · ${esc(plural(sum.affectedIndentLineCount, ["indent line", "indent lines"]))}</div>
      ${sum.totalsByUom.length ? `<table class="pa-uom-table"><thead>${head}</thead><tbody>${rows}</tbody></table>` : ""}
      <p class="pa-note">${esc(sum.coverage)} ${esc(sum.balanceBasis)}${match ? " Unallocated is receipt-wide; allocations to other indents are not excess." : ""} Quantities are never totalled across units of measure.</p>`;
  }

  async function loadSummary(c) {
    const mine = ++summarySeq;
    summaryKey = dataKey(st, nowFn());
    qs("paSummary").setAttribute("aria-busy", "true");
    try {
      const data = await rpcPecJson(PA_RPC.summary, c);
      if (mine !== summarySeq) return;
      renderSummary(mapSummary(Array.isArray(data) ? data[0] : data));
    } catch (e) {
      if (mine !== summarySeq) return;
      renderSummary(null, errMsg(e));
    } finally {
      if (mine === summarySeq) qs("paSummary").removeAttribute("aria-busy");
    }
  }

  // ── reload / state wiring ──────────────────────────────────────────────────────────
  function reload() {
    renderControls();
    const c = common();
    expanded.clear();
    for (const m of VIEW_MODES) loadedKey[m] = null;
    summarySeq += 1;
    if (!c) {
      // Invalid date range: no request is sent. reset() cancels anything in flight and renders the
      // "select a valid date range" state from the (null) snapshot.
      qs("paSummary").innerHTML = "";
      for (const m of VIEW_MODES) feeds[m].reset();
      return;
    }
    loadSummary(c);
    ensureMode();
  }

  function ensureMode() {
    const key = dataKey(st, nowFn());
    if (loadedKey[st.mode] === key) { renderMeta(); return; }
    loadedKey[st.mode] = key;
    feeds[st.mode].reset();
  }

  const dispatch = (action, { reloadAll = true } = {}) => {
    const next = reduceState(st, action);
    if (next === st) return;
    st = next;
    if (reloadAll) reload(); else { renderControls(); ensureMode(); }
  };

  function selectPreset(preset) {
    const cur = resolveDateRange(st.date, nowFn());
    if (preset === "specific") dispatch({ type: "setSpecificDate", value: cur.valid ? cur.from : "" });
    else if (preset === "custom") dispatch({ type: "setCustomRange", from: cur.valid ? cur.from : "", to: cur.valid ? cur.to : "" });
    else dispatch({ type: "setDatePreset", preset });
  }

  // ── drill-down ─────────────────────────────────────────────────────────────────────
  function receiptBlockHtml(g, withFilterNote) {
    const r = g.receipt;
    const shown = g.allocations.reduce((a, x) => a + micro(x.allocatedQty), 0);
    const other = micro(r.receiptAllocatedQty) - shown;
    const status = receiptStatus(r);
    const parts = [`Purchased ${q(r.grossQty)} ${r.uom}`];
    if (differs(r.effectiveQty, r.grossQty)) parts.push(`Effective ${q(r.effectiveQty)} ${r.uom}`);
    parts.push(`Allocated ${q(r.receiptAllocatedQty)} ${r.uom}`, `Unallocated ${q(r.unallocatedQty)} ${r.uom}`);
    if (r.acceptedQty) parts.push(`Accepted excess ${q(r.acceptedQty)} ${r.uom}`);
    let alloc;
    if (g.allocations.length) {
      alloc = `<table class="pa-lines-table"><thead><tr><th>Indent</th><th>Serial</th><th class="pa-num">Allocated from this receipt</th>
        <th class="pa-num" title="Reconstructed under the current allocation authority">Closing*</th><th class="pa-num">Current balance</th><th></th></tr></thead><tbody>
        ${g.allocations.map((a) => `<tr><td>${esc(a.indentNumber)}</td><td>${esc(a.indentSerial)}</td><td class="pa-num">${esc(q(a.allocatedQty))} ${esc(a.uom)}</td>
          <td class="pa-num">${esc(q(a.closingBalance))}</td><td class="pa-num">${esc(q(a.currentBalance))}</td>
          <td><button type="button" class="pa-link-btn" data-open-indent="${esc(a.indentId)}" data-indent-number="${esc(a.indentNumber)}">Open indent</button></td></tr>`).join("")}
        </tbody></table>`;
    } else if (status === "returned") alloc = stateBox("Returned: nil effective quantity, so there is nothing to allocate.");
    else if (status === "unallocated") alloc = stateBox("Not allocated to any indent.");
    else alloc = stateBox("No allocation rows match the current filters.");
    const note = withFilterNote && other > 0
      ? `<p class="pa-note">${esc(q(other / MICRO))} ${esc(r.uom)} of this receipt is allocated to other indents (not excess). Unallocated above is receipt-wide.</p>` : "";
    return `<div class="pa-receipt"><div class="pa-receipt-head"><strong>${esc(r.voucherDate)}</strong><span>${esc(r.supplierName || "(no supplier name)")}</span>
      <span class="pa-indent-meta" title="Technical trace identifier (purchase fact), not a Tally voucher number">Purchase fact ${esc(r.purchaseFactId)}</span>${statusBadge(status)}</div>
      <div class="pa-receipt-body"><div class="pa-indent-meta">${esc(parts.join(" · "))}</div>${alloc}${note}</div></div>`;
  }

  async function openDrill(desc) {
    const c = common();
    if (!c) return;
    lastDrill = desc;
    const mine = ++drillSeq;
    const backdrop = qs("paDrillModalBackdrop");
    qs("paDrillTitle").textContent = desc.title;
    qs("paDrillRef").textContent = `Voucher dates ${resolveDateRange(st.date, nowFn()).label}`;
    const body = qs("paDrillBody");
    body.innerHTML = stateBox("Loading allocation trail…");
    backdrop.classList.add("show");
    backdrop.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => qs("btnPaDrillClose")?.focus());
    try {
      const rows = await fetchTrail(c, desc.extra);
      if (mine !== drillSeq) return;
      if (!rows.length) { body.innerHTML = stateBox("No receipts match the current period and filters."); return; }
      const note = '<p class="pa-note">* Closing balance is reconstructed under the current allocation authority, not an immutable historical snapshot. Technical identifiers are purchase fact IDs.</p>';
      const withNote = indentFilterActive();
      if (desc.kind === "vendor") {
        body.innerHTML = groupTrailByMaterial(rows).map((m) => `<div class="pa-drill-material">${esc(m.materialName)} · ${esc(m.uom)}</div>${m.receipts.map((g) => receiptBlockHtml(g, withNote)).join("")}`).join("") + note;
      } else {
        body.innerHTML = groupTrailByReceipt(rows).map((g) => receiptBlockHtml(g, withNote)).join("") + note;
      }
    } catch (e) {
      if (mine !== drillSeq) return;
      body.innerHTML = stateBox(retryHtml(`Could not load the allocation trail: ${errMsg(e)}`), "is-error");
    }
  }

  function closeDrill() {
    drillSeq += 1;
    hideModalBackdrop(qs("paDrillModalBackdrop"), []);
  }

  function openIndentFromLens(id, number) {
    const drillOpen = qs("paDrillModalBackdrop").classList.contains("show");
    pendingReturn = { drill: drillOpen ? lastDrill : null };
    if (drillOpen) closeDrill();
    openIndent(id, number);
  }

  // ── exports ────────────────────────────────────────────────────────────────────────
  let exporting = false;
  async function runExport(kind) {
    if (exporting) return;
    const c = common();
    if (!c) { toast("Select a valid voucher date range first.", "error"); return; }
    exporting = true;
    const btns = [qs("btnPaExportCsv"), qs("btnPaPrint")];
    btns.forEach((b) => { b.disabled = true; });
    toast(kind === "print" ? "Preparing the statement…" : "Preparing export of the complete filtered data…", "info");
    try {
      const range = resolveDateRange(st.date, nowFn());
      const generatedAt = nowFn();
      const filterSummary = describeFilters(st);
      if (kind === "print") {
        const rows = await fetchTrail(c, {});
        printHtml(buildStatementHtml({ range, generatedAt, filterSummary, rows: indentLinesFromTrail(rows) }));
        return;
      }
      let spec;
      if (st.mode === "indent") {
        const lines = indentLinesFromTrail(await fetchTrail(c, {}));
        spec = { title: "Purchase allocations - indent-wise", modeLabel: MODE_LABEL.indent,
          columns: [{ key: "indentNumber", label: "Indent" }, { key: "indentSerial", label: "Serial" }, { key: "materialName", label: "Material" }, { key: "materialClass", label: "Class" }, { key: "uom", label: "UOM" },
            { key: "openingBalance", label: "Opening balance (reconstructed)" }, { key: "periodNewDemandQty", label: "New demand in period" }, { key: "periodAllocatedQty", label: "Allocated in period" },
            { key: "closingBalance", label: "Closing balance (reconstructed)" }, { key: "currentBalance", label: "Current balance" }],
          rows: lines, totals: [{ label: "Allocated in period", items: sumByUom(lines, "periodAllocatedQty") }] };
      } else if (st.mode === "material") {
        const rows = await fetchAll(PA_RPC.material, (off) => withPaging(c, 200, off), mapMaterialRow, (r) => `${r.materialClassId}|${r.stockItemId}|${r.uomId}`);
        const withStatus = rows.map((r) => ({ ...r, status: RECEIPT_STATUS_LABEL[receiptStatus(r)] }));
        const match = indentFilterActive();
        spec = { title: "Purchase allocations - material-wise", modeLabel: MODE_LABEL.material,
          columns: [{ key: "materialName", label: "Material" }, { key: "materialClass", label: "Class" }, { key: "uom", label: "UOM" }, { key: "purchaseFactCount", label: "Receipts" },
            { key: "grossQty", label: "Purchased (gross)" }, { key: "effectiveQty", label: "Effective (return-adjusted)" }, { key: "allocatedQty", label: match ? "Allocated (any indent)" : "Allocated" },
            ...(match ? [{ key: "matchingAllocatedQty", label: "Allocated to filtered indent" }] : []),
            { key: "unallocatedQty", label: "Unallocated" }, { key: "acceptedQty", label: "Accepted excess" }, { key: "netUnallocatedQty", label: "Net unallocated" }, { key: "status", label: "Status" }],
          rows: withStatus, totals: [{ label: "Purchased (gross)", items: sumByUom(rows, "grossQty") }, { label: "Effective", items: sumByUom(rows, "effectiveQty") },
            { label: "Allocated", items: sumByUom(rows, "allocatedQty") }, { label: "Unallocated", items: sumByUom(rows, "unallocatedQty") }] };
      } else {
        const rows = await fetchAll(PA_RPC.vendor, (off) => withPaging(c, 200, off), mapVendorRow, (r) => r.vendorKey);
        const flat = rows.flatMap((v) => v.totalsByUom.map((t) => ({ supplierName: v.supplierName, vendorKey: v.vendorKey, materialCount: v.materialCount, purchaseFactCount: v.purchaseFactCount, ...t })));
        spec = { title: "Purchase allocations - vendor-wise", modeLabel: MODE_LABEL.vendor,
          columns: [{ key: "supplierName", label: "Supplier" }, { key: "vendorKey", label: "Vendor key (technical)" }, { key: "uom", label: "UOM" }, { key: "materialCount", label: "Materials" }, { key: "purchaseFactCount", label: "Receipts" },
            { key: "grossQty", label: "Purchased (gross)" }, { key: "effectiveQty", label: "Effective (return-adjusted)" }, { key: "allocatedQty", label: "Allocated" },
            { key: "unallocatedQty", label: "Unallocated" }, { key: "acceptedQty", label: "Accepted excess" }],
          rows: flat, totals: [{ label: "Purchased (gross)", items: sumByUom(flat, "grossQty") }, { label: "Allocated", items: sumByUom(flat, "allocatedQty") }, { label: "Unallocated", items: sumByUom(flat, "unallocatedQty") }] };
      }
      const csv = buildCsv({ ...spec, range, generatedAt, filterSummary });
      downloadText(`purchase-allocations_${st.mode}_${range.from}_${range.to}_${makeExportTimestamp()}.csv`, csv, "text/csv;charset=utf-8");
      toast(`Exported ${spec.rows.length} row${spec.rows.length === 1 ? "" : "s"} (complete filtered data).`, "success");
    } catch (e) {
      toast(`Export failed: ${errMsg(e)}`, "error");
    } finally {
      exporting = false;
      btns.forEach((b) => { b.disabled = false; });
    }
  }

  function printHtml(html) {
    const f = document.createElement("iframe");
    f.setAttribute("aria-hidden", "true");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    f.onload = () => {
      try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { toast(`Print failed: ${errMsg(e)}`, "error"); }
      setTimeout(() => f.remove(), 60000);
    };
    document.body.appendChild(f);
    f.srcdoc = html;
  }

  // ── wiring ─────────────────────────────────────────────────────────────────────────
  function wire() {
    if (wired) return;
    wired = true;
    qs("paModeSeg").addEventListener("click", (e) => { const b = e.target.closest("[data-pa-mode]"); if (b) dispatch({ type: "setMode", mode: b.dataset.paMode }, { reloadAll: false }); });
    qs("paDateSeg").addEventListener("click", (e) => { const b = e.target.closest("[data-pa-preset]"); if (b) selectPreset(b.dataset.paPreset); });
    qs("paDateSpecific").addEventListener("change", (e) => dispatch({ type: "setSpecificDate", value: e.target.value }));
    const range = () => dispatch({ type: "setCustomRange", from: qs("paDateFrom").value, to: qs("paDateTo").value });
    qs("paDateFrom").addEventListener("change", range);
    qs("paDateTo").addEventListener("change", range);
    const debounced = (fn) => { clearTimeout(searchTimer); searchTimer = setTimeout(fn, 300); };
    qs("paSearch").addEventListener("input", (e) => { qs("paSearchClear").style.display = e.target.value ? "" : "none"; debounced(() => dispatch({ type: "setSearch", value: qs("paSearch").value })); });
    qs("paSearch").addEventListener("keydown", (e) => { if (e.key === "Enter") { clearTimeout(searchTimer); dispatch({ type: "setSearch", value: qs("paSearch").value }); } });
    qs("paSearchClear").addEventListener("click", () => { qs("paSearch").value = ""; clearTimeout(searchTimer); dispatch({ type: "setSearch", value: "" }); qs("paSearch").focus(); });
    qs("paFClass").addEventListener("change", (e) => dispatch({ type: "setFilter", key: "materialClass", value: e.target.value }));
    qs("paFStatus").addEventListener("change", (e) => dispatch({ type: "setFilter", key: "allocationStatus", value: e.target.value }));
    qs("paFIndent").addEventListener("input", (e) => debounced(() => dispatch({ type: "setFilter", key: "indentQ", value: e.target.value })));
    qs("paFVendor").addEventListener("input", (e) => debounced(() => dispatch({ type: "setFilter", key: "vendorQ", value: e.target.value })));
    qs("paFClear").addEventListener("click", () => {
      ["paFClass", "paFIndent", "paFVendor"].forEach((id) => { qs(id).value = ""; });
      qs("paFStatus").value = "all"; qs("paSearch").value = "";
      dispatch({ type: "resetFilters" });
    });
    qs("btnPaExportMenu").addEventListener("click", (e) => { e.stopPropagation(); toggleExportMenu("paExportMenu", qs("btnPaExportMenu")); });
    qs("btnPaExportCsv").addEventListener("click", () => { closeAllExportMenus(); runExport("csv"); });
    qs("btnPaPrint").addEventListener("click", () => { closeAllExportMenus(); runExport("print"); });
    const panel = qs("tab-purchase-allocations");
    panel.addEventListener("click", (e) => {
      const open = e.target.closest("[data-open-indent]");
      if (open) { openIndentFromLens(Number(open.dataset.openIndent), open.dataset.indentNumber); return; }
      const retry = e.target.closest("[data-pa-retry]");
      if (retry) { const card = retry.closest(".pa-indent-card"); if (card) { expanded.delete(Number(card.dataset.indentId)); toggleIndent(card); } else reload(); return; }
      const toggle = e.target.closest(".pa-indent-toggle");
      if (toggle) toggleIndent(toggle.closest(".pa-indent-card"));
    });
    qs("paDrillBody").addEventListener("click", (e) => {
      const open = e.target.closest("[data-open-indent]");
      if (open) openIndentFromLens(Number(open.dataset.openIndent), open.dataset.indentNumber);
      else if (e.target.closest("[data-pa-retry]") && lastDrill) openDrill(lastDrill);
    });
    qs("btnPaDrillClose").addEventListener("click", closeDrill);
    qs("btnPaDrillDone").addEventListener("click", closeDrill);
    qs("paDrillModalBackdrop").addEventListener("click", (e) => { if (e.target.id === "paDrillModalBackdrop") closeDrill(); });
    for (const m of VIEW_MODES) {
      const sc = qs({ indent: "paScrollIndent", material: "paScrollMaterial", vendor: "paScrollVendor" }[m]);
      sc.addEventListener("scroll", () => { scrollPos[m] = sc.scrollTop; }, { passive: true });
    }
  }

  return {
    /** Called whenever the lens tab becomes active. Reloads only if what is asked for has changed. */
    activate() {
      wire();
      renderControls();
      const key = dataKey(st, nowFn());
      const c = common();
      if (!c) return;
      if (summaryKey !== key) { loadSummary(c); expanded.clear(); for (const m of VIEW_MODES) loadedKey[m] = null; }
      ensureMode();
      const sc = qs({ indent: "paScrollIndent", material: "paScrollMaterial", vendor: "paScrollVendor" }[st.mode]);
      requestAnimationFrame(() => { sc.scrollTop = scrollPos[st.mode] || 0; });
    },
    /** The full-page indent modal closed: return to this lens (state, filters and scroll preserved). */
    onIndentViewClosed() {
      if (!pendingReturn) return;
      const back = pendingReturn;
      pendingReturn = null;
      setTab("purchase-allocations");
      if (back.drill) openDrill(back.drill);
    },
    /** Dismiss the drill-down dialog (registered with the console's modal stack). */
    closeDrill,
    /** test seam */
    _state: () => st,
  };
}

/** One-line description of the active filters for export headers. */
export function describeFilters(state) {
  const f = state.filters;
  const parts = [];
  if (state.search) parts.push(`Material: ${state.search}`);
  if (f.materialClass) parts.push(`Class: ${f.materialClass}`);
  if (f.indentQ) parts.push(`Indent: ${f.indentQ}`);
  if (f.vendorQ) parts.push(`Vendor: ${f.vendorQ}`);
  if (f.allocationStatus && f.allocationStatus !== "all") parts.push(`Status: ${f.allocationStatus}`);
  return parts.join("; ") || "None";
}
