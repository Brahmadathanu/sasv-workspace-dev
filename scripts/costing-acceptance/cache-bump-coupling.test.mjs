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

test("sw.js line 2 is exactly the v391 release line and keeps the v390/v389 history in its comment", () => {
  assert.equal(sw.split("\n")[1], 'const CACHE_NAME = "hub-cache-v391"; // Costing #208 mobile Evidence-table scroll CSS; v390 was Costing UX-F1 Dashboard and compact CCC; v389 was WP-07 e-Aushadhi review UX (UX-1 to UX-10, Bundle A)');
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
