import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { pmBomDeltaApproved, normaliseApprovedSwDelta, WP11_PM_BOM_PATH } from "./wp11-approved-delta.mjs";

const git = (...a) => execFileSync("git", a, { encoding: "utf8" });
const lf = (s) => s.replace(/\r\n/g, "\n");
const base = () => lf(git("show", "origin/main:public/sw.js"));
const cur = () => lf(fs.readFileSync("public/sw.js", "utf8"));
const fixture = (gen) => lf(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", `sw-v${gen}.js`), "utf8"));
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
// Deterministic baselines: each approved transition is exercised on fixed fixtures of the two service-worker generations involved
// (fixtures/sw-v393..v396.js), never on whatever public/sw.js currently is on main. The live comparison against origin/main is kept below.
const TRANSITIONS = [
  { name: "v393->v394 (WP11)", from: "393", to: "394" },
  { name: "v394->v395 (PEC v6.5.0)", from: "394", to: "395" },
  { name: "v395->v396 (PEC v6.5.1)", from: "395", to: "396" },
];
const line2 = (s) => s.split("\n")[1];
const nextGen = { 394: "395", 395: "396", 396: "397" };

for (const tr of TRANSITIONS) {
  const b = () => fixture(tr.from), c = () => fixture(tr.to);
  const drift = (s) => assert.notEqual(normaliseApprovedSwDelta(s, b()), b());
  test(`SW ${tr.name}: the exact approved delta is normalised back to the base byte-for-byte`, () => {
    assert.notEqual(line2(c()), line2(b()), "fixtures differ on line 2");
    assert.equal(normaliseApprovedSwDelta(c(), b()), b());
  });
  test(`SW MUTATION ${tr.name}: route / network-first / permission drift and extra lines are NOT hidden by the permit`, () => {
    drift(c().replace("self.skipWaiting();", "/* x */ self.skipWaiting();"));
    drift(c().replace(/\n$/, "\n// extra network-first rule\n"));
    drift(c() + "// extra\n");
    drift(c().replace("self.addEventListener(\"fetch\"", "self.addEventListener(\"fetch2\""));
    drift(c().replace("master-data-platform", "master-data-platfor"));
    drift(c().replace("PRECACHE", "PRECACHE2"));
  });
  test(`SW MUTATION ${tr.name}: a wrong or unexpected cache generation is rejected`, () => {
    drift(c().replace(`hub-cache-v${tr.to}`, `hub-cache-v${nextGen[tr.to] || "999"}`));
    drift(c().replace(`hub-cache-v${tr.to}`, `hub-cache-v${tr.from}x`));
    drift(c().replace(`hub-cache-v${tr.to}`, "hub-cache-v1"));
  });
}
test("SW MUTATION v394->v395: the v6.5.0 permit needs BOTH the cache line and the exact rule block (and nothing extra)", () => {
  const b = fixture("394"), c = fixture("395");
  assert.notEqual(normaliseApprovedSwDelta(c.replace(/\n    \/\/ PEC v6\.5\.0: modules[^\n]*\n[^\n]*\n[^\n]*\n/, "\n"), b), b, "cache line without the rule block");
  assert.notEqual(normaliseApprovedSwDelta(c.replace("pec-modal-stack", "pec-modal-stac"), b), b, "altered module rule");
  assert.notEqual(normaliseApprovedSwDelta(c.replace("pec-purchase-allocations", "pec-purchase-allocation"), b), b, "altered module rule");
  assert.notEqual(normaliseApprovedSwDelta(c.replace("both new PEC modules network-first", "something else"), b), b, "altered comment");
  assert.notEqual(normaliseApprovedSwDelta(c + "// extra\n", b), b, "extra trailing line");
});
test("SW MUTATION v393->v394: the WP11 comment must be verbatim", () => {
  const b = fixture("393"), c = fixture("394");
  assert.notEqual(normaliseApprovedSwDelta(c.replace("WP11 PM BOM header toolbar wraps at phone width", "something else"), b), b);
});
test("SW MUTATION v395->v396: only the number may change; comment and structure must be verbatim, no rule block may ride along", () => {
  const b = fixture("395"), c = fixture("396");
  assert.notEqual(normaliseApprovedSwDelta(c.replace("PEC v6.5.0 Purchase Allocations", "PEC v6.5.1 Purchase Allocations"), b), b, "edited comment");
  assert.notEqual(normaliseApprovedSwDelta(c.replace("    /\\/shared\\/js\\/pec-modal-stack\\.js$/.test(url.pathname) ||\n", ""), b), b, "removed network-first rule");
});
test("SW MUTATION: historical permits do not cross generations", () => {
  assert.notEqual(normaliseApprovedSwDelta(fixture("396"), fixture("394")), fixture("394"), "v394->v396 is not approved");
  assert.notEqual(normaliseApprovedSwDelta(fixture("395"), fixture("393")), fixture("393"), "v393->v395 is not approved");
  assert.notEqual(normaliseApprovedSwDelta(fixture("394"), fixture("396")), fixture("396"), "downgrade is not approved");
});

// Live: the working-tree service worker against origin/main (no-op once the change is merged).
test("SW live: the working-tree sw.js differs from origin/main only by an approved delta", () => {
  const b = base(), c = cur();
  if (line2(c) === line2(b)) return; // already merged into main
  assert.equal(normaliseApprovedSwDelta(c, b), b, "approved delta maps back to base exactly");
});
