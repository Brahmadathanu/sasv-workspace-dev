// Unit tests for the Purchase Allocations core + frozen V1 contract adapter. Offline; no browser, no Supabase.
import test from "node:test";
import assert from "node:assert/strict";
import {
  istDateString, addDays, resolveDateRange, createInitialState, reduceState, activeFilterCount, requestKey, dataKey,
  sumByUom, describeTotals, formatQty, compareCanonical, sortCanonical, assertCompleteRetrieval, buildCsv, buildStatementHtml, EXPORT_NOTICES,
  PA_RPC, PaContractError, buildCommonParams, buildTrailParams, withPaging, mapSummary, mapIndentRow, mapMaterialRow, mapVendorRow, mapTrailRow,
  receiptStatus, receiptsFromTrail, indentLinesFromTrail, reconcileTrail, groupTrailByReceipt, groupTrailByMaterial, describeUomField,
} from "../public/shared/js/pec-purchase-allocations.js";
import * as fx from "./fixtures/pec-purchase-allocations-view-model.mjs";

const trail = (raw) => raw.map(mapTrailRow);
const pick = (r) => ({ from: r.from, to: r.to, valid: r.valid });

// ── dates / state (unchanged semantics) ──────────────────────────────────────────────
test("IST calendar date is independent of machine TZ and rolls at 18:30 UTC", () => {
  assert.equal(istDateString(new Date("2026-11-23T18:29:59Z")), "2026-11-23");
  assert.equal(istDateString(new Date("2026-11-23T18:30:00Z")), "2026-11-24");
});

test("default preset is Yesterday (IST) incl. the IST/UTC boundary and month/year ends", () => {
  const s = createInitialState();
  assert.equal(s.mode, "indent"); assert.equal(s.date.preset, "yesterday");
  assert.deepEqual(pick(resolveDateRange(s.date, new Date("2026-11-23T18:40:00Z"))), { from: "2026-11-23", to: "2026-11-23", valid: true });
  assert.equal(resolveDateRange(s.date, new Date("2026-12-01T05:00:00Z")).from, "2026-11-30");
  assert.equal(resolveDateRange(s.date, new Date("2027-01-01T05:00:00Z")).from, "2026-12-31");
  assert.equal(resolveDateRange({ preset: "today" }, new Date("2026-11-24T05:00:00Z")).from, "2026-11-24");
});

test("specific and custom ranges validate; invalid never yields a range", () => {
  assert.equal(resolveDateRange({ preset: "specific", specific: "2026-02-30" }).valid, false);
  assert.deepEqual(pick(resolveDateRange({ preset: "custom", from: "2026-11-01", to: "2026-11-23" })), { from: "2026-11-01", to: "2026-11-23", valid: true });
  const rev = resolveDateRange({ preset: "custom", from: "2026-11-24", to: "2026-11-23" });
  assert.equal(rev.valid, false); assert.equal(rev.from, null);
  assert.equal(addDays("2026-02-28", 1), "2026-03-01");
});

test("reducer coordinates mode/dates/search/filters; PLM -> PM; unknown input ignored", () => {
  let s = createInitialState();
  s = reduceState(s, { type: "setFilter", key: "materialClass", value: "plm" });
  s = reduceState(s, { type: "setFilter", key: "vendorQ", value: "  kera " });
  s = reduceState(s, { type: "setSearch", value: " sathavari " });
  s = reduceState(s, { type: "setMode", mode: "vendor" });
  assert.deepEqual([s.mode, s.filters.materialClass, s.filters.vendorQ, s.search], ["vendor", "PM", "kera", "sathavari"]);
  assert.equal(reduceState(s, { type: "setMode", mode: "bogus" }), s);
  assert.equal(reduceState(s, { type: "setFilter", key: "materialQ", value: "x" }), s, "no stale materialQ filter (search is p_q)");
  assert.equal(activeFilterCount(s), 2);
  assert.equal(activeFilterCount(reduceState(s, { type: "resetFilters" })), 0);
});

test("requestKey is stable for identical state and changes for any input (latest-response-wins)", () => {
  const now = new Date("2026-11-24T05:00:00Z"); const a = createInitialState();
  assert.equal(requestKey(a, now), requestKey(structuredClone(a), now));
  for (const act of [{ type: "setMode", mode: "material" }, { type: "setSearch", value: "x" }, { type: "setDatePreset", preset: "today" }, { type: "setFilter", key: "indentQ", value: "84" }]) {
    assert.notEqual(requestKey(reduceState(a, act), now), requestKey(a, now), JSON.stringify(act));
  }
});

test("dataKey ignores the view mode (summary/lists survive mode switches) but not data inputs", () => {
  const now = new Date("2026-11-24T05:00:00Z"); const a = createInitialState();
  assert.equal(dataKey(a, now), dataKey(reduceState(a, { type: "setMode", mode: "vendor" }), now));
  assert.notEqual(dataKey(a, now), dataKey(reduceState(a, { type: "setSearch", value: "x" }), now));
  assert.notEqual(dataKey(a, now), dataKey(a, new Date("2026-11-25T05:00:00Z")));
});

// ── V1 request contract ──────────────────────────────────────────────────────────────
test("common RPC arguments follow the frozen V1 names and defaults", () => {
  const now = new Date("2026-11-24T05:00:00Z");
  assert.deepEqual(buildCommonParams(createInitialState(), now), {
    p_date_from: "2026-11-23", p_date_to: "2026-11-23", p_material_class_code: null, p_q: null, p_indent_q: null, p_vendor_q: null, p_status: "all",
  });
  let s = reduceState(createInitialState(), { type: "setFilter", key: "materialClass", value: "ind" });
  s = reduceState(s, { type: "setFilter", key: "indentQ", value: "84" });
  s = reduceState(s, { type: "setFilter", key: "allocationStatus", value: "partial" });
  s = reduceState(s, { type: "setSearch", value: "kizhangu" });
  assert.deepEqual(buildCommonParams(s, now), { p_date_from: "2026-11-23", p_date_to: "2026-11-23", p_material_class_code: "IND", p_q: "kizhangu", p_indent_q: "84", p_vendor_q: null, p_status: "partial" });
  assert.equal(buildCommonParams(reduceState(createInitialState(), { type: "setCustomRange", from: "2026-11-24", to: "2026-11-01" }), now), null, "invalid range sends no request");
});

test("paging is clamped to 1..200 / 0..100000; trail extras only when supplied; summary has no paging", () => {
  const common = buildCommonParams(createInitialState(), new Date("2026-11-24T05:00:00Z"));
  assert.deepEqual([withPaging(common, 999, -5).p_limit, withPaging(common, 999, -5).p_offset], [200, 0]);
  assert.deepEqual([withPaging(common, 0, 10 ** 9).p_limit, withPaging(common, 0, 10 ** 9).p_offset], [50, 100000]);
  const t = buildTrailParams(common, { p_indent_id: 840, p_stock_item_id: null, p_vendor_key: "v:1", p_purchase_fact_id: undefined }, 200, 400);
  assert.equal(t.p_indent_id, 840); assert.equal(t.p_vendor_key, "v:1");
  assert.ok(!("p_stock_item_id" in t) && !("p_purchase_fact_id" in t) && !("p_uom_id" in t));
  assert.ok(!("p_limit" in common) && !("p_offset" in common));
  assert.deepEqual(Object.values(PA_RPC), ["proc_pec_purchase_alloc_summary", "proc_pec_purchase_alloc_indent_paged", "proc_pec_purchase_alloc_material_paged", "proc_pec_purchase_alloc_vendor_paged", "proc_pec_purchase_alloc_trail_paged"]);
});

// ── V1 response mapping ──────────────────────────────────────────────────────────────
test("summary maps per-UOM totals exactly (decimal precision) and keeps UOMs apart", () => {
  const m = mapSummary(fx.SUMMARY_RAW);
  assert.deepEqual(m.totalsByUom.map((t) => t.uom), ["Kg", "L", "Nos"]);
  const kg = m.totalsByUom[0];
  assert.deepEqual([kg.grossQty, kg.allocatedQty, kg.unallocatedQty], [9369.455, 8914.463741, 454.991259]);
  assert.equal(sumByUom([{ uom: "Kg", q: kg.allocatedQty }, { uom: "Kg", q: kg.unallocatedQty }], "q")[0].total, 9369.455);
  assert.equal(describeUomField(m.totalsByUom, "grossQty"), "9,369.455 Kg · 35 L · 41,066 Nos");
  assert.equal(m.purchaseFactCount, 39); assert.match(m.balanceBasis, /reconstructed/);
});

test("contract drift is loud: missing/unknown fields raise PaContractError", () => {
  const bad = { ...fx.SUMMARY_RAW }; delete bad.coverage;
  assert.throws(() => mapSummary(bad), PaContractError);
  assert.throws(() => mapTrailRow({ ...fx.NOV23_TRAIL_RAW[0], row_kind: "weird" }), /unknown row_kind/);
  assert.throws(() => mapTrailRow({ ...fx.NOV23_TRAIL_RAW[0], indent_line_id: null }), /allocation row without an indent line/);
  assert.throws(() => mapVendorRow({ vendor_key: "x" }), PaContractError);
  assert.throws(() => mapMaterialRow({}), PaContractError);
  assert.throws(() => mapIndentRow(null), PaContractError);
});

test("indent rows keep per-UOM allocated totals separate and order is the server's numeric order", () => {
  const rows = fx.INDENT_ROWS_RAW.map(mapIndentRow);
  assert.deepEqual(rows[2].totalsByUom.map((t) => [t.uom, t.allocatedQty]), [["Kg", 80], ["L", 10]]);
  assert.equal(rows[2].indentNumber, 191); assert.equal(typeof rows[0].indentNumber, "number");
});

test("vendor rows: unmapped suppliers with the same name stay separate by vendor_key", () => {
  const unmapped = trail(fx.RETURNED_AND_UNALLOCATED_RAW);
  assert.equal(new Set(unmapped.map((r) => r.supplierName)).size, 1);
  assert.equal(new Set(unmapped.map((r) => r.vendorKey)).size, 2);
  assert.equal(unmapped[0].vendorId, null);
  const v = mapVendorRow({ vendor_key: "name:cash a", vendor_id: null, supplier_name: "Cash Purchase", material_count: 1, purchase_fact_count: 1, totals_by_uom: fx.DECIMAL_TOTALS });
  assert.equal(v.vendorKey, "name:cash a"); assert.equal(v.vendorId, null);
});

// ── receipt / indent de-duplication and reconciliation ───────────────────────────────
test("23 Nov fixture: receipt counted once; allocations 5/50/80 reconcile to 135 Kg; unallocated 0", () => {
  const rows = trail(fx.NOV23_TRAIL_RAW);
  const receipts = receiptsFromTrail(rows);
  assert.equal(receipts.length, 1);
  assert.equal(sumByUom(receipts, "grossQty")[0].total, 135);
  assert.equal(sumByUom(rows, "grossQty")[0].total, 405, "summing trail rows would triple-count the receipt");
  const lines = indentLinesFromTrail(rows);
  assert.deepEqual(lines.map((l) => [l.indentNumber, l.indentSerial, l.periodAllocatedQty, l.closingBalance]), [[84, 107, 5, 0], [156, 170, 50, 0], [191, 198, 80, 20]]);
  const [rec1] = reconcileTrail(rows);
  assert.deepEqual([rec1.grossQty, rec1.receiptAllocatedQty, rec1.shownAllocatedQty, rec1.otherIndentAllocatedQty, rec1.unallocatedQty], [135, 135, 135, 0, 0]);
  for (const l of lines) assert.equal(l.openingBalance + l.periodNewDemandQty - l.periodAllocatedQty, l.closingBalance);
});

test("repeated indent-line balances are de-duplicated by indent line, not summed per receipt", () => {
  const rows = trail(fx.REPEATED_LINE_RAW);
  assert.equal(rows.length, 2);
  const lines = indentLinesFromTrail(rows);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].periodAllocatedQty, 50);
  assert.equal(sumByUom(rows, "periodAllocatedQty")[0].total, 100, "naive sum doubles the period allocation");
  assert.equal(sumByUom(rows, "allocatedQty")[0].total, 50, "per-receipt allocations do sum to the line period allocation");
  assert.equal(lines[0].openingBalance, 0); assert.equal(lines[0].periodNewDemandQty, 50);
});

test("zero-effective returned receipts are distinct from positive unallocated receipts", () => {
  const [returned, positive] = trail(fx.RETURNED_AND_UNALLOCATED_RAW);
  assert.equal(receiptStatus(returned), "returned");
  assert.equal(receiptStatus(positive), "unallocated");
  assert.equal(receiptStatus({ grossQty: 100, effectiveQty: 80, receiptAllocatedQty: 60, unallocatedQty: 20 }), "partial");
  assert.equal(receiptStatus({ grossQty: 10, effectiveQty: 10, receiptAllocatedQty: 10, unallocatedQty: 0 }), "allocated");
  const [r] = reconcileTrail([returned]);
  assert.deepEqual([r.grossQty, r.effectiveQty, r.unallocatedQty], [40, 0, 0]);
  assert.equal(positive.acceptedQty, 12.5); assert.equal(positive.netUnallocatedQty, 0);
});

test("filtered receipt: other-indent allocation is reconciled and never shown as excess", () => {
  const rows = trail(fx.FILTERED_RECEIPT_RAW);
  const [r] = reconcileTrail(rows);
  assert.deepEqual([r.receiptAllocatedQty, r.shownAllocatedQty, r.otherIndentAllocatedQty, r.unallocatedQty], [100, 60, 40, 0]);
  assert.equal(receiptStatus(rows[0]), "allocated", "status is receipt-level, not recomputed from the filtered rows");
  assert.equal(r.unallocatedQty, 0, "unallocated is the server's receipt-wide figure");
});

test("grouping: receipt -> allocations (canonical) and vendor drill material -> receipts", () => {
  const rows = trail([...fx.NOV23_TRAIL_RAW].reverse().concat(fx.REPEATED_LINE_RAW, fx.RETURNED_AND_UNALLOCATED_RAW));
  const g = groupTrailByReceipt(rows);
  const nov = g.find((x) => x.receipt.purchaseFactId === 169565);
  assert.deepEqual(nov.allocations.map((a) => a.indentNumber), [84, 156, 191]);
  assert.equal(g.find((x) => x.receipt.purchaseFactId === 170030).allocations.length, 0);
  const m = groupTrailByMaterial(rows);
  assert.deepEqual(m.map((x) => x.materialName), ["Sathavari Kizhangu (D)", "Synthetic Herb", "Synthetic Resin"]);
  assert.equal(m[1].receipts.length, 2);
});

// ── presentation core ────────────────────────────────────────────────────────────────
test("totals are per UOM, exact in decimals, never mixed", () => {
  const t = sumByUom([{ uom: "Kg", q: 0.1 }, { uom: "Kg", q: 0.2 }, { uom: "L", q: 35 }, { uom: "Nos", q: 41066 }], "q");
  assert.deepEqual(t, [{ uom: "Kg", total: 0.3 }, { uom: "L", total: 35 }, { uom: "Nos", total: 41066 }]);
  assert.equal(describeTotals(t), "0.3 Kg · 35 L · 41,066 Nos"); assert.equal(formatQty(null), "—");
});

test("canonical ordering is numeric with nulls last", () => {
  const rows = [{ indentNumber: 156, indentSerial: 9 }, { indentNumber: 84, indentSerial: 107 }, { indentNumber: 84, indentSerial: 20 }, { indentNumber: null, indentSerial: null }, { indentNumber: 1000, indentSerial: 1 }];
  assert.deepEqual(sortCanonical(rows).map((r) => `${r.indentNumber}/${r.indentSerial}`), ["84/20", "84/107", "156/9", "1000/1", "null/null"]);
  assert.ok(compareCanonical({ indentNumber: 2, indentSerial: 1 }, { indentNumber: 10, indentSerial: 1 }) < 0);
});

test("complete retrieval: partial, drifting or repeated pages are refused", () => {
  const key = (r) => r.id;
  assert.equal(assertCompleteRetrieval([{ rows: [{ id: 1 }, { id: 2 }], total: 3 }, { rows: [{ id: 3 }], total: 3 }], key).length, 3);
  assert.throws(() => assertCompleteRetrieval([{ rows: [{ id: 1 }], total: 3 }], key), /Incomplete retrieval \(1 of 3/);
  assert.throws(() => assertCompleteRetrieval([{ rows: [{ id: 1 }], total: 2 }, { rows: [{ id: 2 }], total: 3 }], key), /total changed/);
  assert.throws(() => assertCompleteRetrieval([{ rows: [{ id: 1 }, { id: 1 }], total: 2 }], key), /repeated rows/);
});

test("CSV export: BOM, range, notices, escaping, per-UOM totals, canonical rows", () => {
  const lines = indentLinesFromTrail(trail(fx.NOV23_TRAIL_RAW)).map((l) => ({ ...l, materialName: l.materialName + ' "x", y' }));
  const csv = buildCsv({
    title: "Purchase allocations", range: { from: "2026-11-23", to: "2026-11-23", label: "x" }, generatedAt: new Date("2026-11-24T05:00:00Z"),
    modeLabel: "Indent-wise", filterSummary: "Vendor: Kera",
    columns: [{ key: "indentNumber", label: "Indent" }, { key: "indentSerial", label: "Serial" }, { key: "materialName", label: "Material" }, { key: "uom", label: "UOM" }, { key: "periodAllocatedQty", label: "Allocated in period" }],
    rows: lines, totals: [{ label: "Allocated in period", items: sumByUom(lines, "periodAllocatedQty") }],
  });
  assert.ok(csv.startsWith("﻿"));
  assert.match(csv, /Voucher date range,2026-11-23\r\n/); assert.match(csv, /Generated,2026-11-24 10:30 IST/);
  for (const n of EXPORT_NOTICES) assert.ok(csv.includes(n));
  assert.match(csv, /"Sathavari Kizhangu \(D\) ""x"", y"/);
  assert.deepEqual(csv.split("\r\n").filter((l) => /^(84|156|191),/.test(l)).map((l) => l.split(",")[0]), ["84", "156", "191"]);
  assert.match(csv, /Allocated in period \(per unit of measure\)\r\nKg,135\r\n/);
});

test("print statement: indent lines in canonical order, reconstructed labels, escaped, empty state", () => {
  const lines = indentLinesFromTrail(trail(fx.NOV23_TRAIL_RAW));
  const evil = { ...lines[0], indentNumber: 99, indentSerial: 1, materialName: "<script>alert(1)</script>" };
  const html = buildStatementHtml({ range: { from: "2026-11-23", to: "2026-11-23" }, generatedAt: new Date("2026-11-24T05:00:00Z"), rows: [...lines].reverse().concat(evil) });
  assert.deepEqual([...html.matchAll(/<h2>Indent (\d+)<\/h2>/g)].map((m) => m[1]), ["84", "99", "156", "191"]);
  assert.ok(!html.includes("<script>alert(1)</script>") && html.includes("&lt;script&gt;"));
  assert.match(html, /Opening \(reconstructed\)/); assert.match(html, /Closing \(reconstructed\)/); assert.match(html, /New demand in period/);
  assert.match(buildStatementHtml({ range: { from: "a", to: "a" }, generatedAt: new Date(), rows: [] }), /No allocations in the selected period/);
});
