import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { pmBomDeltaApproved, normaliseApprovedSwDelta, WP11_PM_BOM_PATH } from "./wp11-approved-delta.mjs";

const git = (...a) => execFileSync("git", a, { encoding: "utf8" });
const lf = (s) => s.replace(/\r\n/g, "\n");
const base = () => lf(git("show", "origin/main:public/sw.js"));
const cur = () => lf(fs.readFileSync("public/sw.js", "utf8"));
const diff = () => git("diff", "-U0", "origin/main", "--", WP11_PM_BOM_PATH);

test("PM BOM: the reviewed WP11 addition (or no change) is approved", () => {
  assert.equal(pmBomDeltaApproved(diff()), true);
  assert.equal(pmBomDeltaApproved(""), true);
});
test("PM BOM: any other addition, any removed line, or a different block is rejected", () => {
  const d = diff();
  if (!d.trim()) return; // already merged into main: only the empty-diff permit applies
  assert.equal(pmBomDeltaApproved(d + "+      .x { color: red; }\n"), false, "extra added line");
  assert.equal(pmBomDeltaApproved(d + "-      old line\n"), false, "removed line");
  assert.equal(pmBomDeltaApproved(d.replace("flex-wrap: wrap;", "flex-wrap: nowrap;")), false, "altered block");
  assert.equal(pmBomDeltaApproved(d.replace("max-width: 1100px", "max-width: 9999px")), false, "widened media query");
});
test("SW: only the approved line-2 deltas (v393->v394, v394->v395 + the exact v6.5.0 rules) is normalised; byte-identity of the rest is then enforced", () => {
  const b = base(), c = cur();
  if (c.split("\n")[1] === b.split("\n")[1]) return; // already merged
  assert.equal(normaliseApprovedSwDelta(c, b), b, "approved delta maps back to base exactly");
});
test("SW MUTATION: route / network-first / permission drift is NOT hidden by the permit", () => {
  const b = base(), c = cur();
  if (c.split("\n")[1] === b.split("\n")[1]) return;
  const drift = (s) => assert.notEqual(normaliseApprovedSwDelta(s, b), b);
  drift(c.replace("self.skipWaiting();", "/* x */ self.skipWaiting();"));
  drift(c.replace(/\n$/, "\n// extra network-first rule\n"));
  drift(c.replace("hub-cache-v395", "hub-cache-v396"));
  drift(c.replace("pec-modal-stack", "pec-modal-stac"));
  drift(c.replace("pec-purchase-allocations", "pec-purchase-allocation"));
  drift(c.replace("both new PEC modules network-first", "something else"));
  drift(c.replace("WP11 PM BOM header toolbar wraps at phone width", "something else"));
});

test("SW: the v6.5.0 permit needs BOTH the cache line and the exact rule block (and nothing extra)", () => {
  const b = base(), c = cur();
  if (c.split("\n")[1] === b.split("\n")[1]) return; // already merged
  const v394 = b.split("\n")[1];
  if (!/hub-cache-v394/.test(v394)) return; // base is not the v394 line (permit does not apply)
  assert.notEqual(normaliseApprovedSwDelta(c.replace(/\n    \/\/ PEC v6\.5\.0: modules[^\n]*\n[^\n]*\n[^\n]*\n/, "\n"), b), b, "cache line without the rule block");
  assert.notEqual(normaliseApprovedSwDelta(c + "// extra\n", b), b, "extra trailing line");
});

test("SW: the v6.5.1 permit is the exact v395->v396 line-2 advance only", () => {
  const b = base(), c = cur();
  const bl = b.split("\n")[1];
  if (!/hub-cache-v395/.test(bl) || c.split("\n")[1] === bl) return; // permit does not apply
  assert.equal(normaliseApprovedSwDelta(c, b), b, "v395->v396 advance maps back to base");
  assert.notEqual(normaliseApprovedSwDelta(c.replace("hub-cache-v396", "hub-cache-v397"), b), b, "another generation");
  assert.notEqual(normaliseApprovedSwDelta(c.replace("self.skipWaiting();", "/* x */ self.skipWaiting();"), b), b, "extra drift");
  assert.notEqual(normaliseApprovedSwDelta(c.replace(/\n$/, "\n// extra\n"), b), b, "extra trailing line");
});
