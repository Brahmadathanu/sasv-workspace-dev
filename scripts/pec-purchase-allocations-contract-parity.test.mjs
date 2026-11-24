// Contract parity: REAL output of the deployed V1 RPC SQL (captured from the PG fixture by
// scripts/pec-purchase-allocations-pg-export.sql) must pass through the client adapter unchanged in meaning.
// Usage: PA_CONTRACT_JSON=<file> node --test scripts/pec-purchase-allocations-contract-parity.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  PaContractError, mapSummary, mapIndentRow, mapMaterialRow, mapVendorRow, mapTrailRow, receiptStatus, indentLinesFromTrail,
  reconcileTrail, groupTrailByReceipt, sumByUom, sortCanonical,
} from "../public/shared/js/pec-purchase-allocations.js";

const file = process.env.PA_CONTRACT_JSON;
const doc = file ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
const need = { skip: doc ? false : "set PA_CONTRACT_JSON to the exported RPC output" };
const rows = (key, mapper) => (doc[key] || []).map((r) => mapper(r.row_data));
const total = (key) => (doc[key] || [])[0]?.total_count ?? 0;

test("every row of every RPC maps through the adapter without a contract error", need, () => {
  const summary = mapSummary(doc.summary);
  assert.ok(summary.totalsByUom.length >= 3);
  for (const [k, m] of [["indent", mapIndentRow], ["material", mapMaterialRow], ["vendor", mapVendorRow], ["trail", mapTrailRow], ["material_filtered", mapMaterialRow], ["trail_filtered", mapTrailRow]]) {
    const mapped = rows(k, m);
    assert.ok(mapped.length > 0, `${k} returned rows`);
    assert.equal(total(k), mapped.length, `${k}: total_count equals the single page length`);
  }
  assert.doesNotThrow(() => mapSummary(doc.summary_filtered));
});

test("numeric fields arrive as numbers or numeric strings and never as NaN", need, () => {
  for (const r of [...rows("trail", mapTrailRow)]) {
    for (const f of ["grossQty", "effectiveQty", "receiptAllocatedQty", "unallocatedQty", "acceptedQty", "netUnallocatedQty"]) assert.ok(Number.isFinite(r[f]), `${f} finite`);
    if (r.rowKind === "allocation") for (const f of ["allocatedQty", "openingBalance", "periodNewDemandQty", "periodAllocatedQty", "closingBalance", "currentBalance", "requestedQty"]) assert.ok(Number.isFinite(r[f]), `${f} finite on allocation rows`);
  }
  for (const r of rows("material", mapMaterialRow)) assert.ok(Number.isFinite(r.allocatedQty) && Number.isFinite(r.matchingAllocatedQty));
});

test("non-numeric indent numbers are preserved, not turned into NaN (indent X7)", need, () => {
  const ind = rows("indent", mapIndentRow);
  const x7 = ind.find((r) => String(r.indentNumber) === "X7");
  assert.ok(x7, "indent X7 present");
  assert.equal(x7.indentNumber, "X7");
  assert.equal(ind.find((r) => r.indentId === 840).indentNumber, 84);
  const t = rows("trail", mapTrailRow).find((r) => String(r.indentNumber) === "X7");
  assert.equal(t.indentNumber, "X7");
  assert.deepEqual(ind.map((r) => String(r.indentNumber)), ["84", "156", "191", "300", "301", "500", "600", "700", "800", "1000", "X7"], "server order retained");
  // the client's canonical sort agrees with the server order (numeric first, text last)
  assert.deepEqual(sortCanonical(ind).map((r) => String(r.indentNumber)), ind.map((r) => String(r.indentNumber)));
});

test("summary per-UOM totals equal de-duplicated trail receipts and the material/vendor rollups", need, () => {
  const summary = mapSummary(doc.summary).totalsByUom;
  const trail = rows("trail", mapTrailRow);
  const recon = reconcileTrail(trail);
  for (const s of summary) {
    const r = recon.find((x) => x.uom === s.uom);
    assert.ok(r, `trail covers ${s.uom}`);
    assert.equal(r.grossQty, s.grossQty, `${s.uom} gross`); assert.equal(r.effectiveQty, s.effectiveQty, `${s.uom} effective`);
    assert.equal(r.unallocatedQty, s.unallocatedQty, `${s.uom} unallocated`); assert.equal(r.acceptedQty, s.acceptedQty, `${s.uom} accepted`);
    assert.equal(r.receiptAllocatedQty, s.allocatedQty, `${s.uom} receipt allocated`);
    assert.equal(r.shownAllocatedQty, s.allocatedQty, `${s.uom} allocation rows sum`);
    const m = sumByUom(rows("material", mapMaterialRow).filter((x) => x.uom === s.uom), "grossQty")[0].total;
    assert.equal(m, s.grossQty, `${s.uom} material rollup gross`);
    const v = sumByUom(rows("vendor", mapVendorRow).flatMap((x) => x.totalsByUom).filter((x) => x.uom === s.uom), "allocatedQty")[0].total;
    assert.equal(v, s.allocatedQty, `${s.uom} vendor rollup allocated`);
  }
  // naive summing of trail rows would double count receipts (the reason the client de-duplicates)
  assert.ok(sumByUom(trail, "grossQty").find((x) => x.uom === "Kg").total > summary.find((x) => x.uom === "Kg").grossQty);
});

test("fixture facts survive the adapter: 169565 trail, returned receipt, accepted excess, unmapped vendors", need, () => {
  const trail = rows("trail", mapTrailRow);
  const nov = sortCanonical(trail.filter((r) => r.purchaseFactId === 169565));
  assert.deepEqual(nov.map((r) => [r.indentNumber, r.indentSerial, r.allocatedQty]), [[84, 107, 5], [156, 170, 50], [191, 198, 80]]);
  assert.deepEqual(nov.map((r) => r.closingBalance), [0, 0, 20]);
  assert.deepEqual(nov.map((r) => r.currentBalance), [0, 0, 20]);
  assert.ok(nov.every((r) => r.receiptAllocatedQty === 135 && r.unallocatedQty === 0 && r.vendorKey === "vendor:1"));
  const returned = trail.find((r) => r.purchaseFactId === 170030);
  assert.equal(returned.rowKind, "unallocated"); assert.equal(receiptStatus(returned), "returned"); assert.equal(returned.indentId, null);
  const resin = trail.find((r) => r.purchaseFactId === 170031);
  assert.equal(receiptStatus(resin), "unallocated"); assert.equal(resin.acceptedQty, 12.5); assert.equal(resin.netUnallocatedQty, 0);
  const vendors = rows("vendor", mapVendorRow);
  const cash = vendors.filter((v) => v.vendorKey.startsWith("supplier:Cash Purchase"));
  assert.equal(cash.length, 2); assert.ok(cash.every((v) => v.vendorId === null));
  assert.equal(vendors.find((v) => v.vendorKey === "vendor:2").purchaseFactCount, 2);
});

test("repeated period fields collapse to one indent line; multi-receipt line 500", need, () => {
  const trail = rows("trail", mapTrailRow).filter((r) => r.indentId === 5000);
  assert.equal(trail.length, 2);
  const lines = indentLinesFromTrail(trail);
  assert.equal(lines.length, 1);
  assert.deepEqual([lines[0].openingBalance, lines[0].periodNewDemandQty, lines[0].periodAllocatedQty, lines[0].closingBalance], [0, 50, 50, 0]);
  assert.equal(groupTrailByReceipt(trail).length, 2);
});

test("filtered receipt: indent filter 300 keeps receipt-wide numbers and is not excess", need, () => {
  const sum = mapSummary(doc.summary_filtered).totalsByUom.find((t) => t.uom === "Kg");
  assert.equal(sum.allocatedQty, 100); assert.equal(sum.matchingAllocatedQty, 60); assert.equal(sum.unallocatedQty, 0);
  const mat = rows("material_filtered", mapMaterialRow);
  assert.equal(mat.length, 1);
  assert.deepEqual([mat[0].allocatedQty, mat[0].matchingAllocatedQty, mat[0].unallocatedQty, mat[0].netUnallocatedQty], [100, 60, 0, 0]);
  const t = rows("trail_filtered", mapTrailRow);
  assert.equal(t.length, 1); assert.ok(t.every((r) => r.rowKind === "allocation"));
  const [r] = reconcileTrail(t);
  assert.deepEqual([r.receiptAllocatedQty, r.shownAllocatedQty, r.otherIndentAllocatedQty, r.unallocatedQty], [100, 60, 40, 0]);
});

test("a malformed server row is rejected loudly (drift guard still bites on real shapes)", need, () => {
  const bad = { ...doc.trail[0].row_data }; delete bad.receipt_allocated_qty;
  assert.throws(() => mapTrailRow(bad), PaContractError);
});
