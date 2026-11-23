import test from "node:test";
import assert from "node:assert/strict";
import {
  STATUS, MANIFEST_SOURCE, KNOWN_TALLY_ERROR, evaluateSnapshot, summarizeLines, diffSnapshots,
} from "./provenance-model.mjs";

const AS_OF = "2026-11-23";
const MONTHS = [
  ["2026-04-01", "2026-04-30"], ["2026-05-01", "2026-05-31"], ["2026-06-01", "2026-06-30"],
  ["2026-07-01", "2026-07-31"], ["2026-08-01", "2026-08-31"], ["2026-09-01", "2026-09-30"],
  ["2026-10-01", "2026-10-31"], ["2026-11-01", AS_OF],
];
const h = (n) => String(n).padStart(64, "a");

function fixture({ store = "IK", source = MANIFEST_SOURCE.INDEPENDENT } = {}) {
  const keys = MONTHS.map(([f]) => `fgt/${store}/${f}`);
  const jobs = [], published = [];
  MONTHS.forEach(([from, to], i) => {
    const key = keys[i];
    jobs.push({ job_type: "FETCH_XML", status: "done", params: { save_key: key, source_size_bytes: 5000 + i, source_hash: h(i + 1) } });
    jobs.push({ job_type: "PARSE_FG_TRANSFER_CHUNK", status: "done", params: {
      source_key: key, as_of_date: AS_OF, store, parse_status: "SUCCESS", source_size_bytes: 5000 + i, source_hash: h(i + 1),
      parse_count: 10 + i, parsed_at: "2026-11-23T01:00:00Z", scope_from: from, scope_to: to, company: "SASV" } });
    published.push({ source_key: key, company: "SASV", rows: 10 + i });
  });
  return { store, asOf: AS_OF, expected: { keys, source }, jobs, published };
}
const parseOf = (f, i) => f.jobs.filter((j) => j.job_type === "PARSE_FG_TRANSFER_CHUNK")[i];
const fetchOf = (f, i) => f.jobs.filter((j) => j.job_type === "FETCH_XML")[i];
const has = (r, prefix) => r.reasons.some((x) => x.startsWith(prefix));

test("eight sequential monthly chunks with independent manifest certify", () => {
  const r = evaluateSnapshot(fixture());
  assert.equal(r.status, STATUS.CERTIFIED);
});

test("keys derived only from published rows never certify (max SOURCE_PARSED_AND_PUBLISHED)", () => {
  const r = evaluateSnapshot(fixture({ source: MANIFEST_SOURCE.DERIVED }));
  assert.equal(r.status, STATUS.PUBLISHED);
  assert.match(r.reasons[0], /NOT_INDEPENDENT/);
});

test("omitted zero-row chunk evades row-derived keys but is caught by an independent manifest", () => {
  const f = fixture();
  const dropped = f.expected.keys[3];
  // Row-derived view: chunk 3 silently missing from jobs, published and keys.
  const derived = {
    ...f, expected: { source: MANIFEST_SOURCE.DERIVED, keys: f.expected.keys.filter((k) => k !== dropped) },
    jobs: f.jobs.filter((j) => (j.params.save_key ?? j.params.source_key) !== dropped),
    published: f.published.filter((p) => p.source_key !== dropped),
  };
  const dr = evaluateSnapshot(derived);
  assert.notEqual(dr.status, STATUS.CERTIFIED);       // scope gap + not independent
  assert.ok(has(dr, "SCOPE_GAP") || dr.status === STATUS.PUBLISHED);
  // Independent manifest still expects all 8 -> hard NOT_CERTIFIED.
  const indep = evaluateSnapshot({ ...derived, expected: { source: MANIFEST_SOURCE.INDEPENDENT, keys: f.expected.keys } });
  assert.equal(indep.status, STATUS.NOT_CERTIFIED);
  assert.ok(has(indep, "MISSING_OR_REJECTED_FETCH"));
});

test("missing expected ninth chunk is withheld", () => {
  const f = fixture();
  f.expected.keys.push("fgt/IK/2026-12-01");
  assert.equal(evaluateSnapshot(f).status, STATUS.NOT_CERTIFIED);
});

test("empty but successfully parsed chunk requires explicit manifest declaration", () => {
  const f = fixture();
  parseOf(f, 2).params.parse_count = 0; f.published[2].rows = 0;
  const r = evaluateSnapshot(f);
  assert.equal(r.status, STATUS.NOT_CERTIFIED);
  assert.ok(has(r, "UNDECLARED_EMPTY_CHUNK"));
  f.expected.zero_row_ok = [f.expected.keys[2]];
  const ok = evaluateSnapshot(f);
  assert.equal(ok.status, STATUS.CERTIFIED);
  assert.deepEqual(ok.warnings, [`DECLARED_EMPTY_CHUNK:${f.expected.keys[2]}`]);
});

test("missing FETCH_XML job, missing PARSE job", () => {
  const f1 = fixture(); f1.jobs.splice(f1.jobs.indexOf(fetchOf(f1, 1)), 1);
  assert.ok(has(evaluateSnapshot(f1), "MISSING_OR_REJECTED_FETCH"));
  const f2 = fixture(); f2.jobs.splice(f2.jobs.indexOf(parseOf(f2, 1)), 1);
  assert.ok(has(evaluateSnapshot(f2), "MISSING_OR_REJECTED_PARSE"));
});

test("rejected 234-byte Tally error fingerprint is treated as error even if marked done", () => {
  for (const which of ["fetch", "parse"]) {
    const f = fixture();
    const j = which === "fetch" ? fetchOf(f, 4) : parseOf(f, 4);
    j.params.source_size_bytes = KNOWN_TALLY_ERROR.size; j.params.source_hash = KNOWN_TALLY_ERROR.hash.toUpperCase();
    const r = evaluateSnapshot(f);
    assert.equal(r.status, STATUS.NOT_CERTIFIED);
    assert.ok(has(r, which === "fetch" ? "MISSING_OR_REJECTED_FETCH" : "MISSING_OR_REJECTED_PARSE"));
  }
});

test("parse status failure", () => {
  const f = fixture(); parseOf(f, 0).params.parse_status = "PARTIAL";
  assert.ok(has(evaluateSnapshot(f), "PARSE_STATUS_NOT_SUCCESS"));
});

test("invalid hash / size / count / timestamp", () => {
  const cases = [
    ["INVALID_PARSE_SOURCE", (f) => { parseOf(f, 0).params.source_hash = "xyz"; }],
    ["INVALID_PARSE_SOURCE", (f) => { parseOf(f, 0).params.source_size_bytes = 0; }],
    ["INVALID_FETCH_SOURCE", (f) => { fetchOf(f, 0).params.source_hash = null; }],
    ["INVALID_PARSE_COUNT", (f) => { parseOf(f, 0).params.parse_count = -1; }],
    ["INVALID_PARSE_TIMESTAMP", (f) => { parseOf(f, 0).params.parsed_at = "not-a-date"; }],
  ];
  for (const [code, mutate] of cases) {
    const f = fixture(); mutate(f);
    const r = evaluateSnapshot(f);
    assert.equal(r.status, STATUS.NOT_CERTIFIED, code);
    assert.ok(has(r, code), code);
  }
});

test("parsed vs published count mismatch", () => {
  const f = fixture(); f.published[5].rows += 1;
  assert.ok(has(evaluateSnapshot(f), "PARSED_PUBLISHED_COUNT_MISMATCH"));
});

test("scope gap, overlap, wrong start and wrong end", () => {
  const gap = fixture(); parseOf(gap, 3).params.scope_from = "2026-07-02";
  assert.ok(has(evaluateSnapshot(gap), "SCOPE_GAP"));
  const overlap = fixture(); parseOf(overlap, 3).params.scope_from = "2026-06-30";
  assert.ok(has(evaluateSnapshot(overlap), "SCOPE_OVERLAP"));
  const start = fixture(); parseOf(start, 0).params.scope_from = "2026-04-02";
  assert.ok(has(evaluateSnapshot(start), "SCOPE_NOT_STARTING"));
  const end = fixture(); parseOf(end, 7).params.scope_to = "2026-11-22";
  assert.ok(has(evaluateSnapshot(end), "SCOPE_NOT_ENDING"));
});

test("mixed company and unexpected published key", () => {
  const f = fixture(); parseOf(f, 1).params.company = "OTHER";
  assert.ok(has(evaluateSnapshot(f), "MIXED_COMPANY"));
  const g = fixture(); g.published.push({ source_key: "fgt/IK/stale", company: "SASV", rows: 3 });
  assert.ok(has(evaluateSnapshot(g), "UNEXPECTED_PUBLISHED_KEY"));
});

test("store and as-of mismatch on the parse job withholds", () => {
  const f = fixture(); parseOf(f, 0).params.store = "OK";
  assert.equal(evaluateSnapshot(f).status, STATUS.NOT_CERTIFIED);
  const g = fixture(); parseOf(g, 0).params.as_of_date = "2026-11-22";
  assert.equal(evaluateSnapshot(g).status, STATUS.NOT_CERTIFIED);
});

test("no expected keys is never certified", () => {
  const f = fixture(); f.expected.keys = [];
  assert.equal(evaluateSnapshot(f).status, STATUS.NOT_CERTIFIED);
});

test("retroactive correction on the same voucher GUID is detected by full-line diff", () => {
  const prior = [{ store: "IK", guid: "g1", line_no: 1, amount: 100 }, { store: "IK", guid: "g2", line_no: 1, amount: 50 }];
  const next = [{ store: "IK", guid: "g1", line_no: 1, amount: 100 }, { store: "IK", guid: "g2", line_no: 1, amount: 45 }];
  const d = diffSnapshots(prior, next);
  assert.deepEqual(d.changed, ["IK|g2|1"]);
  assert.ok(d.correction_detected);
  assert.equal(diffSnapshots(prior, prior).correction_detected, false);
  assert.equal(diffSnapshots(prior, [prior[0]]).removed.length, 1);
});

test("cancelled, optional and negative lines are classified; value is Tally book value only", () => {
  const s = summarizeLines([
    { amount: 100 }, { amount: -20 }, { amount: 999, cancelled: true }, { amount: 777, optional: true },
  ]);
  assert.equal(s.original_lines, 4);
  assert.equal(s.active_lines, 2);
  assert.equal(s.excluded_cancelled, 1);
  assert.equal(s.excluded_optional, 1);
  assert.equal(s.negative_lines, 1);
  assert.equal(s.book_value, 80);
  assert.equal(s.book_value_basis, "TALLY_BOOK_VALUE");
  assert.ok(!("production_value" in s) && !("manufacturing_cop" in s));
});

test("every NOT_CERTIFIED result carries at least one reason", () => {
  const f = fixture(); f.published[0].rows = 0;
  const r = evaluateSnapshot(f);
  assert.equal(r.status, STATUS.NOT_CERTIFIED);
  assert.ok(r.reasons.length > 0);
});
