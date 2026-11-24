// public/shared/js/pec-purchase-allocations.js
//
// PEC "Purchase Allocations" lens: DOM-free client core (Client PR B preparation).
//
// SCOPE BOUNDARY: this module knows nothing about the server reporting RPCs. It works on a
// CLIENT VIEW-MODEL (typedefs below). A separate adapter, written only after the server
// contract is frozen, maps RPC rows to this view-model. No RPC name, parameter or response
// field is assumed here.
//
// Business rules enforced here (client side, presentation only):
//  - dates are voucher dates in the Asia/Kolkata calendar; default preset is Yesterday;
//  - quantities are never summed across UOMs (totals are always per UOM);
//  - purchase facts are never double counted when one fact feeds several indents (callers
//    pass fact-grain rows to sumByUom for purchased/effective, trail-grain for allocated);
//  - canonical ordering: indent number, then canonical indent serial;
//  - complete-export integrity: refuse to export a partial or drifting dataset;
//  - exports/print distinguish voucher-period allocations from current balances and label
//    opening/closing balances as reconstructed under the current allocation authority.
//
// This lens is read-only; nothing here mutates data.

export const IST_TZ = "Asia/Kolkata";
export const DATE_PRESETS = Object.freeze(["today", "yesterday", "specific", "custom"]);
export const VIEW_MODES = Object.freeze(["indent", "material", "vendor"]);
export const ALLOCATION_STATUSES = Object.freeze(["all", "allocated", "partial", "unallocated"]);
export const DEFAULT_PRESET = "yesterday";
export const DEFAULT_MODE = "indent";

/**
 * @typedef {Object} PaTrailRow  one purchase fact distributed to one indent line (or the unallocated remainder)
 * @property {string|number} purchaseFactId   technical trace id (not a Tally voucher number)
 * @property {string} voucherDate             YYYY-MM-DD
 * @property {string} vendorName
 * @property {string} materialClass           "RM" | "PM" | "IND"
 * @property {string|number} stockItemId
 * @property {string} materialName
 * @property {string} uom
 * @property {number|null} indentNumber       null for the unallocated remainder
 * @property {number|null} indentSerial       canonical serial within the indent
 * @property {number} allocatedQty
 * @property {number|null} periodOpeningBalance   reconstructed; null when not supported
 * @property {number|null} periodClosingBalance   reconstructed; null when not supported
 * @property {number|null} currentBalance
 *
 * @typedef {Object} PaFactRow  one purchase fact (never repeated per indent)
 * @property {string|number} purchaseFactId
 * @property {string} voucherDate
 * @property {string} vendorName
 * @property {string} materialName
 * @property {string} uom
 * @property {number} grossQty
 * @property {number} effectiveQty            return-adjusted receipt quantity
 * @property {number} allocatedQty
 * @property {number} unallocatedQty
 * @property {number} acceptedExcessQty
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
    filters: { materialClass: "", indentQ: "", vendorQ: "", materialQ: "", allocationStatus: "all" },
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
  return [f.materialClass, f.indentQ, f.vendorQ, f.materialQ].filter(Boolean).length +
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
  return `﻿${lines.map((l) => l.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/**
 * Print-friendly indent deduction statement (one section per indent, canonical serial order).
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
      `<td class="n">${formatQty(r.allocatedQty)}</td><td class="n">${formatQty(r.periodOpeningBalance)}</td>` +
      `<td class="n">${formatQty(r.periodClosingBalance)}</td><td class="n">${formatQty(r.currentBalance)}</td></tr>`).join("");
    return `<section><h2>Indent ${escapeHtml(ind)}</h2><table><thead><tr><th>Serial</th><th>Material</th><th>UOM</th>` +
      `<th>Allocated in period</th><th>Opening (reconstructed)</th><th>Closing (reconstructed)</th><th>Current balance</th></tr></thead>` +
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
