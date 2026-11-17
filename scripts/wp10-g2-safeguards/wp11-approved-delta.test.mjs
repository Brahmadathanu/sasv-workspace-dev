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
test("SW: only the v393->v394 line-2 delta is normalised; byte-identity of the rest is then enforced", () => {
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
  drift(c.replace("hub-cache-v394", "hub-cache-v395"));
  drift(c.replace("WP11 PM BOM header toolbar wraps at phone width", "something else"));
});
