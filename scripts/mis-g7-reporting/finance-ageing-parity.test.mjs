// Finance ageing: client/server parity fixtures for the pure rule (docs/executive-intelligence-r2/FINANCE_AGEING_SERVER_SPEC.md; installed
// get_mis_finance_ageing_* contracts). DOM-free: runs everywhere. The same fixtures can be replayed against the SQL objects.
import test from "node:test";
import assert from "node:assert/strict";
import { parseBillDate, billAge, ageBandIndex, ageLabels, parseAgeBounds, parseAgeInt, isUnreferencedBill, ageBillsForParty } from "../../public/shared/js/executive-intelligence-model.js";

const AS_OF = "2026-11-27";
const bill = (date, amount, ref = "R") => ({ bill_date_text: date, outstanding_amount_tally_value: amount, bill_ref: ref });
const day = (n) => { const d = new Date(Date.parse(AS_OF) - n * 86400000); return `${d.getUTCDate()}-${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()]}-${String(d.getUTCFullYear()).slice(2)}`; };

test("dates: D-Mon-YY and D-Mon-YYYY parse; impossible calendar dates and junk are not dates", () => {
  assert.equal(billAge("27-Nov-26", AS_OF), 0);
  assert.equal(billAge("10-Oct-26", AS_OF), 48);
  assert.equal(billAge("1-Apr-2026", AS_OF), 240);
  for (const bad of ["31-Feb-26", "29-Feb-25", "0-Jan-26", "32-Jan-26", "5-Foo-26", "2026-11-27", "", null, undefined, "10/10/26"]) assert.equal(parseBillDate(bad), null, String(bad));
  assert.notEqual(parseBillDate("29-Feb-24"), null, "a real leap day is a date");
});

test("bands: exact boundaries for 30/60/90 and a bill dated after the as-of date counts as current", () => {
  const b = [30, 60, 90];
  const idx = (n) => ageBandIndex(n, b);
  assert.deepEqual([0, 30, 31, 60, 61, 90, 91, 4000].map(idx), [0, 0, 1, 1, 2, 2, 3, 3]);
  assert.equal(idx(-5), 0, "future-dated bill sits in the first band");
  assert.equal(ageBandIndex(null, b), -1);
  assert.deepEqual(ageLabels(b), ["0–30", "31–60", "61–90", "Over 90"]);
  assert.equal(billAge("30-Nov-26", AS_OF), -3);
});

test("bounds validation: 1..5 strictly increasing whole numbers within 1..3650", () => {
  assert.deepEqual(parseAgeBounds("30, 60 ,90").bounds, [30, 60, 90]);
  assert.deepEqual(parseAgeBounds("45;90;180;365").bounds, [45, 90, 180, 365]);
  for (const bad of ["", "0, 30", "30, 30", "60, 30", "10.5", "abc", "1,2,3,4,5,6", "3651"]) assert.ok(parseAgeBounds(bad).error, bad);
  assert.equal(parseAgeInt("").value, null);
  assert.equal(parseAgeInt("0").value, 0);
  assert.ok(parseAgeInt("-1").error);
  assert.ok(parseAgeInt("1.5").error);
});

test("unreferenced lines: missing reference and explicit on-account markers are undated", () => {
  for (const ref of ["", "  ", null, undefined, "On Account", "on-account", "ON  ACCOUNT"]) assert.equal(isUnreferencedBill(ref), true, String(ref));
  for (const ref of ["141", "0.1% TDS", "A-9", "Account-1"]) assert.equal(isUnreferencedBill(ref), false, ref);
  const r = ageBillsForParty([bill(day(10), 100, ""), bill(day(10), 50, "On Account"), bill(day(10), 25, "X1")], { asOf: AS_OF, bounds: [30, 60, 90] });
  assert.equal(r.undated.count, 2);
  assert.equal(r.undated.amount, 150);
  assert.equal(r.bands[0].amount, 25);
});

test("orientation: amounts follow the sign of the party's filtered net, per party, never absolute-valued per bill", () => {
  const b = [30, 60, 90];
  // credit-style party: net negative, one positive line stays opposite after orientation
  const neg = ageBillsForParty([bill(day(10), -500), bill(day(40), -300), bill(day(100), 200)], { asOf: AS_OF, bounds: b });
  assert.equal(neg.orient, -1);
  assert.deepEqual(neg.bands.map((x) => x.amount), [500, 300, 0, -200]);
  assert.equal(neg.bands.reduce((a, x) => a + x.amount, 0) + neg.undated.amount, 600, "bands + undated equal the oriented net");
  // the same lines with a positive net orient the other way
  const pos = ageBillsForParty([bill(day(10), 500), bill(day(40), 300), bill(day(100), -200)], { asOf: AS_OF, bounds: b });
  assert.equal(pos.orient, 1);
  assert.deepEqual(pos.bands.map((x) => x.amount), [500, 300, 0, -200]);
  // zero net keeps the sign as supplied
  const zero = ageBillsForParty([bill(day(10), 100), bill(day(10), -100, "B")], { asOf: AS_OF, bounds: b });
  assert.equal(zero.orient, 1);
  assert.equal(zero.bands[0].amount, 0);
});

test("range filter: inclusive on both ends, undated lines survive, orientation uses the surviving lines", () => {
  const b = [30, 60, 90];
  const bills = [bill(day(29), 10, "a"), bill(day(30), 20, "b"), bill(day(60), 40, "c"), bill(day(61), 80, "d"), bill("31-Feb-26", -500, "e"), bill(day(5), -1000, "f")];
  const r = ageBillsForParty(bills, { asOf: AS_OF, bounds: b, min: 30, max: 60 });
  assert.deepEqual(r.rows.map((x) => x.bill_ref).sort(), ["b", "c", "e"], "30 and 60 are inside; 29, 61 and 5 are out; the undated line stays");
  assert.equal(r.net, 20 + 40 - 500);
  assert.equal(r.orient, -1, "net of the surviving lines is negative");
  assert.equal(r.undated.count, 1);
  assert.equal(r.undated.amount, 500);
  assert.deepEqual(r.bands.map((x) => x.amount), [-20, -40, 0, 0]);
  // open-ended ranges
  assert.equal(ageBillsForParty(bills, { asOf: AS_OF, bounds: b, min: 61 }).rows.length, 2, "61+ keeps d and the undated line");
  assert.equal(ageBillsForParty(bills, { asOf: AS_OF, bounds: b, max: 0 }).rows.length, 1, "only the undated line survives an empty window");
  // an undated-only party survives any range
  const only = ageBillsForParty([bill("bad", 70, "")], { asOf: AS_OF, bounds: b, min: 10, max: 20 });
  assert.equal(only.rows.length, 1);
  assert.equal(only.undated.amount, 70);
});

test("as-of date re-ages the same bills; it never changes the amounts", () => {
  const b = [30, 60, 90];
  const lines = [bill("1-Oct-26", 100), bill("1-Nov-26", 200)];
  const a = ageBillsForParty(lines, { asOf: "2026-11-27", bounds: b });
  const c = ageBillsForParty(lines, { asOf: "2027-02-27", bounds: b });
  assert.equal(a.net, c.net);
  assert.notDeepEqual(a.bands.map((x) => x.amount), c.bands.map((x) => x.amount));
  assert.equal(a.bands.reduce((s, x) => s + x.amount, 0), c.bands.reduce((s, x) => s + x.amount, 0));
});
