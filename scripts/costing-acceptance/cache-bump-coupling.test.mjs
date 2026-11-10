// Issue #208 release coupling. The service worker is cache-first for static CSS, so the mobile Evidence-table CSS fix only reaches clients that
// already hold the previous cache if CACHE_NAME advances in the same release. This test ties the two together and keeps the historical v390 fact.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");
const sw = read("public/sw.js"), css = read("public/shared/css/sasv-costing.css");
const generation = (src) => Number(/const CACHE_NAME = "hub-cache-v(\d+)"/.exec(src)?.[1]);

test("#208 CSS fix is present and the cache generation is at least v391 (coupled release)", () => {
  assert.match(css, /Issue #208:[\s\S]*?body\.sasv-costing \.cp-evidence-table-scroll\s*\{[^}]*overflow-x:\s*auto/);
  assert.ok(generation(sw) >= 391, "CSS fix without a cache advance would stay hidden behind the cache-first v390 CSS");
});

test("sw.js line 2 is exactly the v393 release line and keeps the v392/v391/v390/v389 history in its comment", () => {
  assert.equal(sw.split("\n")[1], 'const CACHE_NAME = "hub-cache-v393"; // WP05-W506 Staff Governance personnel-confidentiality client gate (explicit projections, edit gating); v392 was Costing LOCK-P01 lock-screen CCC-edit guard (#211/#212); v391 was Costing #208 mobile Evidence-table scroll CSS; v390 was Costing UX-F1 Dashboard and compact CCC; v389 was WP-07 e-Aushadhi review UX (UX-1 to UX-10, Bundle A)');
  assert.equal((sw.match(/const CACHE_NAME\b/g) ?? []).length, 1, "exactly one cache declaration");
});

test("service-worker strategy is unchanged: skipWaiting + old-cache purge on activate + clients.claim, static assets cache-first", () => {
  assert.match(sw, /self\.skipWaiting\(\)/);
  assert.match(sw, /k !== CACHE_NAME \? caches\.delete\(k\)/, "activation deletes every cache that is not the current generation (this is what clears the stale CSS)");
  assert.match(sw, /self\.clients\.claim\(\)/);
  assert.match(sw, /\/\/ Static → cache-first/);
  assert.doesNotMatch(sw, /sasv-costing\.css/, "costing CSS is runtime cache-first, not specially precached: the generation bump is what refreshes it");
});

test("#208 CSS block is a single scoped append with no !important", () => {
  const block = css.slice(css.indexOf("/* Issue #208:"));
  assert.ok(block.startsWith("/* Issue #208:"));
  assert.equal((css.match(/Issue #208:/g) ?? []).length, 1);
  assert.doesNotMatch(block, /!important/);
  for (const sel of block.match(/^[^\s/}{][^{]*(?=\{)/gm) ?? []) assert.match(sel.trim(), /^body\.sasv-costing /);
});

test("#212 LOCK-P01 lock-screen edit guard ships with a cache advance (coupled release): static JS is cache-first, so v391 clients would keep the unguarded shell", () => {
  const shell = read("public/shared/js/costing-suite-shell.js"), lock = read("public/shared/js/costing-lock-screen.js");
  assert.match(shell, /canEdit: canEditLockScreen/); assert.match(lock, /canEdit = \(\) => false/);
  assert.ok(generation(sw) >= 392, "the guard without a cache advance past v391 would stay hidden behind the cached v391 shell");
  assert.match(sw.split("\n")[1], /v391 was Costing #208/, "v391 history is kept in the cache-line comment");
});
test("#212 the lock-screen feature flag is still default OFF: this release changes no flag default", () => {
  const flags = read("public/shared/js/costing-feature-flags.js");
  assert.match(flags, /COSTING_LOCK_SCREEN_V1/);
  assert.match(flags, /export function isCostingLockScreenV1Enabled\([^)]*\)\s*\{[\s\S]*?=== "1"/);
});
