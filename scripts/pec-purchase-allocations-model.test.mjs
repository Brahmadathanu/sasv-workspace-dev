// Unit tests for the DOM-free Purchase Allocations core. Offline; no browser, no Supabase.
import test from "node:test";
import assert from "node:assert/strict";
import {
  istDateString, addDays, resolveDateRange, createInitialState, reduceState, activeFilterCount, requestKey,
  sumByUom, describeTotals, formatQty, compareCanonical, sortCanonical, assertCompleteRetrieval,
  buildCsv, buildStatementHtml, EXPORT_NOTICES,
} from "../public/shared/js/pec-purchase-allocations.js";
import { NOV23_TRAIL, NOV23_FACTS, MIXED_FACTS } from "./fixtures/pec-purchase-allocations-view-model.mjs";

test("IST calendar date is independent of machine TZ and rolls at 18:30 UTC", () => {
  assert.equal(istDateString(new Date("2026-11-23T18:29:59Z")), "2026-11-23");
  assert.equal(istDateString(new Date("2026-11-23T18:30:00Z")), "2026-11-24");
  assert.equal(istDateString(new Date("2026-11-23T00:00:00Z")), "2026-11-23");
});

test("default preset is Yesterday (IST), including across the IST/UTC boundary and month/year ends", () => {
  const s = createInitialState();
  assert.equal(s.mode, "indent");
  assert.equal(s.date.preset, "yesterday");
  // 24 Nov 00:10 IST == 23 Nov 18:40 UTC: yesterday is 23 Nov
  assert.deepEqual(pick(resolveDateRange(s.date, new Date("2026-11-23T18:40:00Z"))), { from: "2026-11-23", to: "2026-11-23", valid: true });
  // 24 Nov 00:10 IST must NOT be treated as 22 Nov (what a UTC-based "yesterday" would give)
  assert.notEqual(resolveDateRange(s.date, new Date("2026-11-23T18:40:00Z")).from, "2026-11-22");
  assert.equal(resolveDateRange(s.date, new Date("2026-12-01T05:00:00Z")).from, "2026-11-30");
  assert.equal(resolveDateRange(s.date, new Date("2027-01-01T05:00:00Z")).from, "2026-12-31");
  assert.equal(resolveDateRange({ preset: "today" }, new Date("2026-11-24T05:00:00Z")).from, "2026-11-24");
});

test("specific and custom ranges validate; inclusive; invalid never yields a range", () => {
  assert.deepEqual(pick(resolveDateRange({ preset: "specific", specific: "2026-11-23" })), { from: "2026-11-23", to: "2026-11-23", valid: true });
  assert.equal(resolveDateRange({ preset: "specific", specific: "2026-02-30" }).valid, false);
  assert.equal(resolveDateRange({ preset: "specific", specific: "" }).valid, false);
  assert.deepEqual(pick(resolveDateRange({ preset: "custom", from: "2026-11-01", to: "2026-11-23" })), { from: "2026-11-01", to: "2026-11-23", valid: true });
  const rev = resolveDateRange({ preset: "custom", from: "2026-11-24", to: "2026-11-23" });
  assert.equal(rev.valid, false); assert.equal(rev.from, null);
  assert.equal(addDays("2026-02-28", 1), "2026-03-01");
  assert.throws(() => addDays("nope", 1));
});

test("reducer: one coordinated state across modes; unknown input is ignored; PLM normalises to PM", () => {
  let s = createInitialState();
  s = reduceState(s, { type: "setFilter", key: "materialClass", value: "plm" });
  s = reduceState(s, { type: "setFilter", key: "vendorQ", value: "  kera " });
  s = reduceState(s, { type: "setSearch", value: " sathavari " });
  s = reduceState(s, { type: "setMode", mode: "vendor" });
  assert.equal(s.mode, "vendor"); assert.equal(s.filters.materialClass, "PM");
  assert.equal(s.filters.vendorQ, "kera"); assert.equal(s.search, "sathavari");
  assert.equal(reduceState(s, { type: "setMode", mode: "bogus" }), s);
  assert.equal(reduceState(s, { type: "setFilter", key: "nope", value: "x" }), s);
  assert.equal(reduceState(s, { type: "setFilter", key: "allocationStatus", value: "weird" }).filters.allocationStatus, "all");
  assert.equal(activeFilterCount(s), 2);
  assert.equal(activeFilterCount(reduceState(s, { type: "resetFilters" })), 0);
  s = reduceState(s, { type: "setCustomRange", from: "2026-11-01", to: "2026-11-23" });
  assert.equal(s.date.preset, "custom");
});

test("requestKey is stable for identical state and changes for any input (latest-response-wins)", () => {
  const now = new Date("2026-11-24T05:00:00Z");
  const a = createInitialState();
  assert.equal(requestKey(a, now), requestKey(structuredClone(a), now));
  for (const act of [{ type: "setMode", mode: "material" }, { type: "setSearch", value: "x" }, { type: "setDatePreset", preset: "today" },
    { type: "setFilter", key: "indentQ", value: "84" }]) {
    assert.notEqual(requestKey(reduceState(a, act), now), requestKey(a, now), JSON.stringify(act));
  }
  // yesterday resolves differently once the IST day changes
  assert.notEqual(requestKey(a, now), requestKey(a, new Date("2026-11-25T05:00:00Z")));
});

test("totals are per UOM, exact in decimals, and never mixed", () => {
  const t = sumByUom(MIXED_FACTS, "grossQty");
  assert.deepEqual(t, [
    { uom: "Kg", total: 247.5 }, { uom: "L", total: 35 }, { uom: "Nos", total: 41066 },
  ]);
  assert.equal(describeTotals(t), "247.5 Kg · 35 L · 41,066 Nos");
  const drift = sumByUom([{ uom: "Kg", q: 0.1 }, { uom: "Kg", q: 0.2 }, { uom: "Kg", q: 9369.455 }], "q");
  assert.equal(drift[0].total, 9369.755);
  assert.equal(formatQty(null), "—");
});

test("one fact distributed to several indents is counted once in fact totals", () => {
  const fromFacts = sumByUom(NOV23_FACTS, "grossQty")[0].total;
  const fromTrailWrong = sumByUom(NOV23_TRAIL.map((r) => ({ uom: r.uom, q: 135 })), "q")[0].total; // what double counting would give
  assert.equal(fromFacts, 135);
  assert.equal(fromTrailWrong, 405);
  assert.equal(sumByUom(NOV23_TRAIL, "allocatedQty")[0].total, 135);
  assert.equal(NOV23_FACTS[0].unallocatedQty, 0);
});

test("23 Nov fixture: allocation trail reconciles to the fact (synthetic)", () => {
  const sorted = sortCanonical(NOV23_TRAIL);
  assert.deepEqual(sorted.map((r) => [r.indentNumber, r.indentSerial, r.allocatedQty, r.periodClosingBalance]),
    [[84, 107, 5, 0], [156, 170, 50, 0], [191, 198, 80, 20]]);
  for (const r of NOV23_TRAIL) assert.equal(r.periodOpeningBalance - r.allocatedQty, r.periodClosingBalance);
  for (const f of MIXED_FACTS) {
    assert.ok(f.effectiveQty <= f.grossQty, `effective <= gross for ${f.purchaseFactId}`);
    assert.equal(f.allocatedQty + f.unallocatedQty, f.effectiveQty, `alloc + unalloc = effective for ${f.purchaseFactId}`);
  }
});

test("canonical ordering is numeric (indent 84 < 156 < 191; serial 107 < 170), nulls last", () => {
  const rows = [
    { indentNumber: 156, indentSerial: 9 }, { indentNumber: 84, indentSerial: 107 }, { indentNumber: 84, indentSerial: 20 },
    { indentNumber: null, indentSerial: null }, { indentNumber: 1000, indentSerial: 1 }, { indentNumber: 156, indentSerial: 10 },
  ];
  assert.deepEqual(sortCanonical(rows).map((r) => `${r.indentNumber}/${r.indentSerial}`), ["84/20", "84/107", "156/9", "156/10", "1000/1", "null/null"]);
  assert.ok(compareCanonical({ indentNumber: 2, indentSerial: 1 }, { indentNumber: 10, indentSerial: 1 }) < 0, "lexical order would put 10 before 2");
});

test("complete retrieval: partial, drifting or repeated pages are refused", () => {
  const key = (r) => r.id;
  const ok = [{ rows: [{ id: 1 }, { id: 2 }], total: 3 }, { rows: [{ id: 3 }], total: 3 }];
  assert.equal(assertCompleteRetrieval(ok, key).length, 3);
  assert.throws(() => assertCompleteRetrieval([{ rows: [{ id: 1 }], total: 3 }], key), /Incomplete retrieval \(1 of 3/);
  assert.throws(() => assertCompleteRetrieval([{ rows: [{ id: 1 }], total: 2 }, { rows: [{ id: 2 }], total: 3 }], key), /total changed/);
  assert.throws(() => assertCompleteRetrieval([{ rows: [{ id: 1 }, { id: 1 }], total: 2 }], key), /repeated rows/);
  assert.equal(assertCompleteRetrieval([], key).length, 0);
});

test("CSV export: BOM, range, notices, escaping, per-UOM totals, canonical rows", () => {
  const rows = sortCanonical(NOV23_TRAIL).map((r) => ({ ...r, materialName: r.materialName + ' "x", y' }));
  const csv = buildCsv({
    title: "Purchase allocations — indent-wise", range: { from: "2026-11-23", to: "2026-11-23", label: "x" },
    generatedAt: new Date("2026-11-24T05:00:00Z"), modeLabel: "Indent-wise", filterSummary: "Vendor: Kera",
    columns: [{ key: "indentNumber", label: "Indent" }, { key: "indentSerial", label: "Serial" }, { key: "materialName", label: "Material" },
      { key: "uom", label: "UOM" }, { key: "allocatedQty", label: "Allocated" }],
    rows, totals: [{ label: "Allocated", items: sumByUom(rows, "allocatedQty") }],
  });
  assert.ok(csv.startsWith("﻿"));
  assert.match(csv, /Voucher date range,2026-11-23\r\n/);
  assert.match(csv, /Generated,2026-11-24 10:30 IST/);
  for (const n of EXPORT_NOTICES) assert.ok(csv.includes(n.replace(/"/g, '""')) || csv.includes(n), n);
  assert.match(csv, /"Sathavari Kizhangu \(D\) ""x"", y"/);
  const dataLines = csv.split("\r\n").filter((l) => /^(84|156|191),/.test(l));
  assert.deepEqual(dataLines.map((l) => l.split(",")[0]), ["84", "156", "191"]);
  assert.match(csv, /Allocated \(per unit of measure\)\r\nKg,135\r\n/);
});

test("print statement: grouped by indent in canonical order, escaped, empty state", () => {
  const html = buildStatementHtml({ range: { from: "2026-11-23", to: "2026-11-23" }, generatedAt: new Date("2026-11-24T05:00:00Z"),
    rows: [...NOV23_TRAIL].reverse().concat([{ ...NOV23_TRAIL[0], indentNumber: 99, indentSerial: 1, materialName: "<script>alert(1)</script>" }]) });
  const order = [...html.matchAll(/<h2>Indent (\d+)<\/h2>/g)].map((m) => m[1]);
  assert.deepEqual(order, ["84", "99", "156", "191"]);
  assert.ok(!html.includes("<script>alert(1)</script>") && html.includes("&lt;script&gt;"));
  assert.match(html, /Opening \(reconstructed\)/);
  assert.match(buildStatementHtml({ range: { from: "a", to: "a" }, generatedAt: new Date(), rows: [] }), /No allocations in the selected period/);
});

function pick(r) { return { from: r.from, to: r.to, valid: r.valid }; }
