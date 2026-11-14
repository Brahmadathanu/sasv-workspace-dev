// PEC export: extract and execute production collector with deterministic transport.
// Deliberately tests an OFFSET shift giving duplicate+omission while row count stays constant.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "public/shared/js/procurement-execution-console.js"), "utf8");
const begin = source.indexOf("async function fetchAllVendorBuylistPagedRows(");
const end = source.indexOf("\nasync function fetchVendorBuylistFilteredRows(", begin);
assert.ok(begin >= 0 && end > begin, "real multi-page collector available");
const productionFunction = source.slice(begin, end);
const limit = 200;
const makeRow = (i) => ({
  vendor_bucket_key: "vendor:75", vendor_bucket_type: "ACTUAL_VENDOR",
  material_class_id: 1, stock_item_id: i + 1000, uom_id: 1,
  stock_item_name: `VItem ${i}`, total_qty_to_buy: 5,
});
const rows = Array.from({ length: 205 }, (_, i) => makeRow(i));

function collector(pages) {
  const ctx = {
    PEC_PAGE_LIMIT_MAX: limit,
    PEC_EXPORT_MAX_ROWS: 50000,
    buildVwlRpcFilterParams: () => ({}),
    getVwlOperationalBucketKey: (r) => r.vendor_bucket_key,
    getVwlOperationalRowKey: (r) => [r.vendor_bucket_key ?? "", r.material_class_id ?? "", r.stock_item_id ?? "", r.uom_id ?? ""].join("|"),
    rpcPecPaged: async (_rpc, params) => {
      const page = pages.get(params.p_offset);
      return page ?? { rows: [], total: 0 };
    },
  };
  return vm.runInNewContext("(" + productionFunction + ")", ctx);
}
const good = new Map([
  [0, { rows: rows.slice(0, 200), total: 205 }],
  [200, { rows: rows.slice(200), total: 205 }],
]);
test("complete two-page export returns 205 unique groups", async () => {
  const result = await collector(good)();
  assert.equal(result.length, 205);
  assert.equal(new Set(result.map(r => r.stock_item_id)).size, 205);
});
test("duplicate plus omission cannot pass unchanged total-count guard", async () => {
  const shifted = new Map(good);
  shifted.set(200, { rows: [rows[0], ...rows.slice(201)], total: 205 });
  await assert.rejects(collector(shifted)(), /missing or repeated vendor\/item\/UOM group.*nothing was exported/);
});
test("changed total between two populated pages fails closed", async () => {
  const changed = new Map(good);
  changed.set(200, { rows: rows.slice(200), total: 204 });
  await assert.rejects(collector(changed)(), /total changed.*nothing was exported/);
});
test("invalid composite identity rejects rather than producing incomplete file", async () => {
  const corrupted = new Map(good);
  corrupted.set(200, { rows: [{ ...rows[200], stock_item_id: null }, ...rows.slice(201)], total: 205 });
  await assert.rejects(collector(corrupted)(), /missing or repeated vendor\/item\/UOM group/);
});
test("early truncation of transport is an error, not a successful download", async () => {
  const short = new Map([[0, { rows: rows.slice(0, 100), total: 205 }]]);
  await assert.rejects(collector(short)(), /Incomplete retrieval \(100 of 205 rows\)/);
});
test("over 50,000-row announced export is rejected before downloading", async () => {
  const huge = new Map([[0, { rows: rows.slice(0, 200), total: 50001 }]]);
  await assert.rejects(collector(huge)(), /safe limit of 50000.*nothing was truncated/);
});
