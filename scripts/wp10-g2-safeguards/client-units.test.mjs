// WP10 G2 pure-function regressions for the client modules (R4 horizon envelope/continuation, R6 storage getter, R7 asset version stamp).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isWp10SafeguardsV1Enabled, validateHorizonEnvelope, classifyReadinessError } from "../../public/shared/js/wp10-safeguards.js";
import { computeToken, FILES, TOKEN_RE } from "./stamp-asset-version.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// ---- R6 ----
test("R6 storage: exact '1' is ON; anything else, missing or throwing storage is OFF", () => {
  assert.equal(isWp10SafeguardsV1Enabled({ getItem: () => "1" }), true);
  for (const v of ["true", "0", "", "01", " 1", null, undefined, 1]) assert.equal(isWp10SafeguardsV1Enabled({ getItem: () => v }), false, String(v));
  assert.equal(isWp10SafeguardsV1Enabled(null), false);
  assert.equal(isWp10SafeguardsV1Enabled({}), false);
  assert.equal(isWp10SafeguardsV1Enabled({ getItem() { throw new Error("denied"); } }), false);
});
test("R6 a THROWING globalThis.localStorage getter (disabled storage) no longer escapes the default path", () => {
  const desc = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new DOMException("The operation is insecure.", "SecurityError"); } });
  try { assert.equal(isWp10SafeguardsV1Enabled(), false); }
  finally { if (desc) Object.defineProperty(globalThis, "localStorage", desc); else delete globalThis.localStorage; }
});

// ---- R4 ----
const ctx = (over = {}) => ({ date_basis: "CURRENT_IST_DATE", evaluated_from: "2026-11-15", evaluated_through: "2026-12-15", horizon_days: 30, route_boundary_coverage: "COMPLETE", amounts_evaluated: false, ...over });
const ess = (over = {}) => ({ code: "MRP_POLICY", owner_screen: "Pricing Policy Manager > MRP", today_state: "RESOLVED", issue_state: "MISSING", classification: "LAPSES_IN_WINDOW", first_issue_date: "2026-12-01", recovers_on: null, ...over });
const row = (id) => ({ sku_id: id, product_id: 10 + id, essentials: [ess()] });
const page = (over = {}) => ({ assessment_kind: "OPERATIONAL_EXPIRY_HORIZON", context: ctx(), rows: [row(5)], statistics: { scanned_count: 7 }, has_more: false, next_after_sku_id: null, ...over });
const bad = (data, prev, opts, re) => { const v = validateHorizonEnvelope(data, prev, opts); assert.equal(v.ok, false, JSON.stringify(v).slice(0, 120)); if (re) assert.match(v.error, re); return v; };

test("R4 a valid last page and a valid continuation page are accepted", () => {
  assert.equal(validateHorizonEnvelope(page()).ok, true);
  const v = validateHorizonEnvelope(page({ has_more: true, next_after_sku_id: 50 }));
  assert.equal(v.ok, true); assert.equal(v.value.nextAfterSkuId, 50);
});
test("R4 has_more=true with a NULL / missing / non-integral / non-positive cursor is rejected (independently reproduced defect)", () => {
  for (const c of [null, undefined, 0, -3, 2.5, "x", "0"]) bad(page({ has_more: true, next_after_sku_id: c }), null, {}, /continuation cursor/);
});
test("R4 a cursor that does not advance past the page's rows or the cursor that was sent is rejected", () => {
  bad(page({ has_more: true, next_after_sku_id: 5 }), null, {}, /does not advance/);          // equals last row
  bad(page({ rows: [], has_more: true, next_after_sku_id: 40 }), null, { sentCursor: 40 }, /does not advance/); // equals sent cursor
  bad(page({ rows: [], has_more: true, next_after_sku_id: 39 }), null, { sentCursor: 40 }, /does not advance/);
});
test("R4 an EMPTY scanned page with a valid advancing cursor is accepted (flagged rows are sparse); a cursor on the last page is rejected", () => {
  const v = validateHorizonEnvelope(page({ rows: [], has_more: true, next_after_sku_id: 250 }), null, { sentCursor: 50 });
  assert.equal(v.ok, true); assert.equal(v.value.rows.length, 0); assert.equal(v.value.nextAfterSkuId, 250);
  bad(page({ next_after_sku_id: 9 }), null, {}, /cursor on the last page/);
});
test("R4 rows must be positive-integral, strictly ascending, past the sent cursor and not duplicated across pages", () => {
  bad(page({ rows: [{ ...row(5), sku_id: 0 }] }), null, {}, /malformed/);
  bad(page({ rows: [{ ...row(5), sku_id: 1.5 }] }), null, {}, /malformed/);
  bad(page({ rows: [{ ...row(5), product_id: -1 }] }), null, {}, /malformed/);
  bad(page({ rows: [row(8), row(6)] }), null, {}, /out of order/);
  bad(page({ rows: [row(6), row(6)] }), null, {}, /duplicate/);
  bad(page({ rows: [row(40)] }), null, { sentCursor: 40 }, /out of order|move past/);
  bad(page({ rows: [row(7)] }), { context: ctx(), lastSkuId: 9, rowIds: new Set([9]) }, { sentCursor: 9 }, /out of order|move past/);
  bad(page({ rows: [row(9)] }), { context: ctx(), lastSkuId: 5, rowIds: new Set([9]) }, { sentCursor: 5 }, /duplicate/);
});
test("R4 the date window must equal horizon_days; dates must lie inside it; coverage/amount flags must be present", () => {
  bad(page({ context: ctx({ evaluated_through: "2026-12-20" }) }), null, {}, /inconsistent/);
  bad(page({ context: ctx({ horizon_days: 0 }) }), null, {}, /inconsistent/);
  bad(page({ context: ctx({ horizon_days: 120, evaluated_through: "2027-03-15" }) }), null, {}, /inconsistent/);
  bad(page({ context: ctx({ route_boundary_coverage: "CAPTURED_TABLES_ONLY" }) }), null, {}, /coverage/);
  bad(page({ context: ctx({ amounts_evaluated: "no" }) }), null, {}, /amounts_evaluated/);
  bad(page({ rows: [{ ...row(5), essentials: [ess({ first_issue_date: "2027-01-01" })] }] }), null, {}, /outside the evaluated window/);
  bad(page({ rows: [{ ...row(5), essentials: [ess({ recovers_on: "2026-11-01" })] }] }), null, {}, /outside the evaluated window/);
  bad(page({ statistics: {} }), null, {}, /scanned_count/);
});
test("R4 a CHANGED context between pages (window crossing midnight, coverage change) is reported as contextChanged so the caller restarts or stops - never mixed", () => {
  const prev = { context: validateHorizonEnvelope(page()).value.context, lastSkuId: 5, rowIds: new Set([5]) };
  const v = bad(page({ context: ctx({ evaluated_from: "2026-11-16", evaluated_through: "2026-12-16" }), rows: [row(9)] }), prev, { sentCursor: 5 }, /context changed/);
  assert.equal(v.contextChanged, true);
  const v2 = bad(page({ context: ctx({ route_boundary_coverage: "PARTIAL" }), rows: [row(9)] }), prev, { sentCursor: 5 }, /context changed/);
  assert.equal(v2.contextChanged, true);
});
test("R4 classification/state vocabularies stay closed", () => {
  bad(page({ rows: [{ ...row(5), essentials: [ess({ classification: "WHATEVER" })] }] }), null, {}, /unknown classification/);
  bad(page({ rows: [{ ...row(5), essentials: [ess({ today_state: "OK" })] }] }), null, {}, /unknown classification or state/);
});
test("readiness error classification is unchanged", () => {
  assert.equal(classifyReadinessError({ message: "READINESS_BUILD_STALE" }).kind, "STALE");
});

// ---- R7 ----
test("R7 the helper modules are imported with a content-hash version token that is current in every importer (stale cache cannot pair with a new parent)", () => {
  const token = computeToken();
  for (const f of FILES) {
    const text = fs.readFileSync(path.join(root, f), "utf8");
    const found = [...text.matchAll(TOKEN_RE)];
    assert.ok(found.length >= 1, `${f} imports a versioned WP10 helper`);
    for (const m of found) assert.equal(m[2], token, `${f}: ${m[1]} token is stale - run node scripts/wp10-g2-safeguards/stamp-asset-version.mjs`);
  }
  assert.equal(/import\(\s*["']\.\/wp10-safeguards(?:-ui)?\.js["']\s*\)/.test(fs.readFileSync(path.join(root, "public/shared/js/products.js"), "utf8")), false);
});
