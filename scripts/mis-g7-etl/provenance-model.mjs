// Offline, pure model of the G7 Tally FG-transfer snapshot provenance checks.
// REVIEW ONLY: models the live finalize_fg_transfer_snapshot evidence checks as
// described in the G7 handoff (the finalizer body is NOT in repo migrations) plus
// the independent-manifest requirement. No DB, network or Supabase access.

export const KNOWN_TALLY_ERROR = Object.freeze({
  size: 234,
  hash: "4f76840aa1ed0389d125f2fd7f92b3f11d8cf3e046adda37b4d7b745d1cbd093",
});
export const STATUS = Object.freeze({
  CERTIFIED: "SNAPSHOT_CERTIFIED_COMPLETE",
  PUBLISHED: "SOURCE_PARSED_AND_PUBLISHED",
  NOT_CERTIFIED: "NOT_CERTIFIED",
});
export const MANIFEST_SOURCE = Object.freeze({
  INDEPENDENT: "INDEPENDENT_MANIFEST",
  DERIVED: "DERIVED_FROM_PUBLISHED_ROWS",
});

const HASH = /^[0-9a-f]{64}$/;
const day = (s) => Date.parse(`${s}T00:00:00Z`);
const addDays = (s, n) => new Date(day(s) + n * 86400000).toISOString().slice(0, 10);

export const isKnownTallyErrorFingerprint = (size, hash) =>
  size === KNOWN_TALLY_ERROR.size && String(hash ?? "").toLowerCase() === KNOWN_TALLY_ERROR.hash;

// Mirrors public.etl_jobs_validate_terminal_state: a "done" job with the error
// fingerprint is rewritten to status 'error'.
export function applyTerminalValidation(job) {
  if (job.status !== "done") return job;
  const p = job.params ?? {};
  return isKnownTallyErrorFingerprint(p.source_size_bytes, p.source_hash) ? { ...job, status: "error" } : job;
}

function validSource(p) {
  return Number.isInteger(p.source_size_bytes) && p.source_size_bytes > 0 && HASH.test(String(p.source_hash ?? "").toLowerCase())
    && !isKnownTallyErrorFingerprint(p.source_size_bytes, p.source_hash);
}

/**
 * input: { store, asOf, expected: {keys:[...], source}, jobs:[{job_type,status,params}],
 *          published: [{source_key, company, rows}], fiscalStart }
 * Returns { status, reasons[], warnings[] }. Never certifies unless the expected
 * key list is an INDEPENDENT manifest and every per-chunk check passes.
 */
export function evaluateSnapshot(input) {
  const { store, asOf, expected, published = [], fiscalStart = "2026-04-01" } = input;
  const jobs = (input.jobs ?? []).map(applyTerminalValidation);
  const reasons = [];
  const warnings = [];
  const keys = expected?.keys ?? [];
  if (!store || !asOf) reasons.push("MISSING_STORE_OR_AS_OF");
  if (!Array.isArray(keys) || keys.length === 0) reasons.push("NO_EXPECTED_KEYS");

  const scopes = [];
  const companies = new Set();
  for (const key of keys) {
    const fetch = jobs.find((j) => j.job_type === "FETCH_XML" && j.status === "done" && j.params?.save_key === key);
    if (!fetch) { reasons.push(`MISSING_OR_REJECTED_FETCH:${key}`); continue; }
    if (!validSource(fetch.params)) reasons.push(`INVALID_FETCH_SOURCE:${key}`);
    const parse = jobs.find((j) => j.job_type === "PARSE_FG_TRANSFER_CHUNK" && j.status === "done" && j.params?.source_key === key
      && j.params?.as_of_date === asOf && String(j.params?.store).toUpperCase() === String(store).toUpperCase());
    if (!parse) { reasons.push(`MISSING_OR_REJECTED_PARSE:${key}`); continue; }
    const p = parse.params;
    if (String(p.parse_status ?? "").trim().toUpperCase() !== "SUCCESS") reasons.push(`PARSE_STATUS_NOT_SUCCESS:${key}`);
    if (!validSource(p)) reasons.push(`INVALID_PARSE_SOURCE:${key}`);
    if (!Number.isInteger(p.parse_count) || p.parse_count < 0) reasons.push(`INVALID_PARSE_COUNT:${key}`);
    if (!p.parsed_at || Number.isNaN(Date.parse(p.parsed_at))) reasons.push(`INVALID_PARSE_TIMESTAMP:${key}`);
    const pub = published.find((r) => r.source_key === key);
    const pubRows = pub?.rows ?? 0;
    if (Number.isInteger(p.parse_count) && pubRows !== p.parse_count) reasons.push(`PARSED_PUBLISHED_COUNT_MISMATCH:${key}`);
    if (p.parse_count === 0 && !(expected?.zero_row_ok ?? []).includes(key)) reasons.push(`UNDECLARED_EMPTY_CHUNK:${key}`);
    if (p.parse_count === 0 && (expected?.zero_row_ok ?? []).includes(key)) warnings.push(`DECLARED_EMPTY_CHUNK:${key}`);
    if (p.company) companies.add(p.company);
    if (pub?.company) companies.add(pub.company);
    scopes.push({ key, from: p.scope_from, to: p.scope_to });
  }
  if (companies.size > 1) reasons.push("MIXED_COMPANY");

  const sorted = scopes.filter((s) => s.from && s.to).sort((a, b) => day(a.from) - day(b.from));
  if (sorted.length !== scopes.length) reasons.push("MISSING_SCOPE_DATES");
  if (sorted.length) {
    if (sorted[0].from !== fiscalStart) reasons.push("SCOPE_NOT_STARTING_AT_FISCAL_START");
    if (sorted.at(-1).to !== asOf) reasons.push("SCOPE_NOT_ENDING_AT_AS_OF");
    for (let i = 1; i < sorted.length; i++) {
      const want = addDays(sorted[i - 1].to, 1);
      if (sorted[i].from > want) reasons.push(`SCOPE_GAP:${sorted[i - 1].to}..${sorted[i].from}`);
      if (sorted[i].from < want) reasons.push(`SCOPE_OVERLAP:${sorted[i - 1].to}..${sorted[i].from}`);
    }
  }

  // Published chunks the expected list does not cover (e.g. extra/stale source key).
  for (const r of published) if (r.rows > 0 && !keys.includes(r.source_key)) reasons.push(`UNEXPECTED_PUBLISHED_KEY:${r.source_key}`);

  if (reasons.length) return { status: STATUS.NOT_CERTIFIED, reasons, warnings };
  if (expected?.source !== MANIFEST_SOURCE.INDEPENDENT) {
    return { status: STATUS.PUBLISHED, reasons: ["EXPECTED_KEYS_NOT_INDEPENDENT_OF_PUBLISHED_ROWS"], warnings };
  }
  return { status: STATUS.CERTIFIED, reasons: [], warnings };
}

/** Voucher-line summary. Tally book value only; no manufacturing COP is derived. */
export function summarizeLines(lines) {
  const out = { original_lines: lines.length, active_lines: 0, excluded_cancelled: 0, excluded_optional: 0,
    negative_lines: 0, book_value: 0, book_value_basis: "TALLY_BOOK_VALUE" };
  for (const l of lines) {
    if (l.cancelled) { out.excluded_cancelled++; continue; }
    if (l.optional) { out.excluded_optional++; continue; }
    out.active_lines++;
    if (l.amount < 0) out.negative_lines++;
    out.book_value = Math.round((out.book_value + l.amount) * 100) / 100;
  }
  return out;
}

/** Full original-line comparison (same GUID/line_no can change amount retroactively). */
export function diffSnapshots(prior, next) {
  const k = (l) => `${l.store}|${l.guid}|${l.line_no}`;
  const pm = new Map(prior.map((l) => [k(l), l]));
  const nm = new Map(next.map((l) => [k(l), l]));
  const changed = [], removed = [], added = [];
  for (const [key, l] of pm) {
    const n = nm.get(key);
    if (!n) removed.push(key);
    else if (JSON.stringify(n) !== JSON.stringify(l)) changed.push(key);
  }
  for (const key of nm.keys()) if (!pm.has(key)) added.push(key);
  return { changed, removed, added, correction_detected: changed.length + removed.length + added.length > 0 };
}
