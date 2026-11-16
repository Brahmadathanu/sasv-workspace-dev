import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { inventoryFromReceipt, verifyAppliedCopies, loadPhase1Inventory, RECEIPT } from "./phase1-applied-inventory.mjs";
const receipt = JSON.parse(fs.readFileSync(RECEIPT, "utf8"));
const clone = () => structuredClone(receipt);
test("applied receipt yields exactly four pinned migration payloads", () => { assert.equal(loadPhase1Inventory().length, 4); });
test("wrong project/stage or missing receipt is rejected", () => {
  for (const r of [null, { ...clone(), project_id: "other" }, { ...clone(), stage: "OTHER" }, { ...clone(), migrations: [] }]) assert.throws(() => inventoryFromReceipt(r));
});
test("unknown name, duplicate version, changed hash or wrong path is rejected", () => {
  for (const mutate of [r => { r.migrations[0].name = "other"; }, r => { r.migrations[0].version = r.migrations[1].version; }, r => { r.migrations[0].sha256 = "0".repeat(64); }, r => { r.migrations[0].path = "supabase/migrations/other.sql"; }]) { const r = clone(); mutate(r); assert.throws(() => inventoryFromReceipt(r)); }
});
test("actual registered copies match immutable payload hashes", () => {
  const inv = loadPhase1Inventory(); assert.equal(verifyAppliedCopies(inv, inv.map(m => m.path), f => fs.readFileSync(f, "utf8")), true);
});
test("changed applied SQL is rejected", () => {
  const inv = loadPhase1Inventory(); assert.equal(verifyAppliedCopies(inv, inv.map(m => m.path), f => fs.readFileSync(f, "utf8") + "\n"), false);
});
test("extra unapproved WP10 guard migration is rejected", () => {
  const inv = loadPhase1Inventory(); assert.equal(verifyAppliedCopies(inv, [...inv.map(m => m.path), "supabase/migrations/20990101000009_wp10_g2_04_guard.sql"], f => fs.readFileSync(f, "utf8")), false);
});
test("a missing applied copy is rejected", () => {
  const inv = loadPhase1Inventory(); assert.equal(verifyAppliedCopies(inv, inv.slice(1).map(m => m.path), f => fs.readFileSync(f, "utf8")), false);
});
