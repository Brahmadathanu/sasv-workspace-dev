// No database calls, file writes or actual guard edits. Exercise proposed receipt registration against the real guard in memory.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { preparePhase1Registration, FILES, BRANCH, PROJECT, GUARD } from "./prepare-phase1-registration.mjs";
import { rejectedProtectedPaths } from "../lib/pec-protected-path-guard.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");
const receipts = FILES.map((f, i) => ({ name: f.name, version: `2099010100000${i}` })); // synthetic, never used for application
const input = over => ({ projectId: PROJECT, headBranch: BRANCH, receipts, exists: () => false, ...over });

test("exact four reviewed files and returned versions map to new source paths without writes", () => {
  const before = read(GUARD), result = preparePhase1Registration(input());
  assert.equal(result.migrations.length, 4);
  assert.deepEqual(result.migrations.map(m => m.path), receipts.map(r => `supabase/migrations/${r.version}_${r.name}.sql`));
  assert.equal(read(GUARD), before);
  for (let i = 0; i < FILES.length; i++) assert.equal(result.migrations[i].content, read(FILES[i].file).replace(/\r\n/g, "\n"));
});
test("wrong project or branch is refused", () => {
  assert.throws(() => preparePhase1Registration(input({ projectId: "other" })), /Wrong/);
  assert.throws(() => preparePhase1Registration(input({ headBranch: "main" })), /Wrong/);
});
test("missing/extra/unknown/duplicate/non-version receipt is refused", () => {
  for (const rows of [receipts.slice(1), [...receipts, receipts[0]], [{ ...receipts[0], name: "other" }, ...receipts.slice(1)], [receipts[0], receipts[0], ...receipts.slice(2)], [{ ...receipts[0], version: "../file" }, ...receipts.slice(1)], [{ ...receipts[0], version: receipts[1].version }, ...receipts.slice(1)]]) {
    assert.throws(() => preparePhase1Registration(input({ receipts: rows })));
  }
});
test("changed source hash, existing path or changed guard structure is refused", () => {
  assert.throws(() => preparePhase1Registration(input({ readText: f => read(f) + (f === FILES[0].file ? "\n" : "") })), /hash changed/);
  assert.throws(() => preparePhase1Registration(input({ exists: () => true })), /already exists/);
  assert.throws(() => preparePhase1Registration(input({ readText: f => f === GUARD ? "changed" : read(f) })), /structure changed/);
});
test("real current guard rejects unregistered WP10 source even on the proposed lane", () => {
  const p = preparePhase1Registration(input()), files = p.migrations.map(m => m.path);
  assert.deepEqual(rejectedProtectedPaths(files, false, { headBranch: BRANCH, readText: f => p.migrations.find(m => m.path === f).content }), files);
});
test("proposed in-memory guard accepts only the exact four hashes on the one proposed lane", async () => {
  const p = preparePhase1Registration(input());
  const mod = await import(`data:text/javascript;base64,${Buffer.from(p.guardContent).toString("base64")}`);
  const files = p.migrations.map(m => m.path), ctx = { headBranch: BRANCH, readText: f => p.migrations.find(m => m.path === f)?.content || "unrelated" };
  assert.deepEqual(mod.rejectedProtectedPaths(files, false, ctx), []);
  assert.deepEqual(mod.rejectedProtectedPaths(files, false, { ...ctx, headBranch: "main" }), files);
  assert.deepEqual(mod.rejectedProtectedPaths(files, false), files);
  assert.deepEqual(mod.rejectedProtectedPaths(files, false, { ...ctx, readText: f => ctx.readText(f) + "\n" }), files);
});
test("proposed registry adds no unrelated SQL/SW exemption and preserves prior metadata", async () => {
  const p = preparePhase1Registration(input());
  const mod = await import(`data:text/javascript;base64,${Buffer.from(p.guardContent).toString("base64")}`);
  const actual = await import("../lib/pec-protected-path-guard.mjs");
  for (const [k, v] of Object.entries(actual.REVIEWED_SERVER_MIGRATIONS)) assert.deepEqual(mod.REVIEWED_SERVER_MIGRATIONS[k], v);
  const unrelated = ["supabase/migrations/20990101000009_unrelated.sql", "public/sw.js"];
  assert.deepEqual(mod.rejectedProtectedPaths(unrelated, false, { headBranch: BRANCH, readText: () => "" }), unrelated);
});
