/** G2 client-only smoke: run with node scripts/costing-g2-route-repetition-preview-smoke.mjs
 * Exercises the actual inline update function extracted from both forms. No server or DB.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const files = [
  "public/shared/js/costing-suite-production-route-step-form.js",
  "public/shared/js/costing-suite-production-route-delta-form.js",
];

for (const file of files) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  assert.match(source, /Cycles within each occurrence/);
  assert.match(source, /data-prm-repetitions-total/);
  assert.match(source, /data-prm-repetitions-warning/);
  const begin = source.indexOf("  const occurrencesInput = host.querySelector");
  const end = source.indexOf("  refreshRepetitions();", begin);
  assert.ok(begin > 0 && end > begin, `${file}: preview binding found`);
  const binding = source.slice(begin, end + "  refreshRepetitions();".length);
  function check(occ, cycles, expected, warning) {
    const nodes = new Map();
    const events = new Map();
    for (const [selector, value] of [
      ["#testOcc", occ], ["#testCycles", cycles]
    ]) nodes.set(selector, {value, addEventListener(type, cb) {events.set(selector + type, cb);}});
    nodes.set("[data-prm-repetitions-total]", {textContent:""});
    nodes.set("[data-prm-repetitions-warning]", {hidden:true});
    const host = {querySelector(selector) {return nodes.get(selector) ?? null;}};
    runInNewContext(binding, {host, prefix:"test", Number});
    assert.equal(nodes.get("[data-prm-repetitions-total]").textContent, expected, file);
    assert.equal(nodes.get("[data-prm-repetitions-warning]").hidden, !warning, file);
    assert.ok(events.has("#testOccinput") && events.has("#testCyclesinput"), file);
    nodes.get("#testOcc").value = "2";
    events.get("#testOccinput")();
    assert.ok(nodes.get("[data-prm-repetitions-total]").textContent.length > 0);
  }
  check("8", "1", "8", false);
  check("1", "8", "8", false);
  check("8", "8", "64", true);
  check("", "8", "Enter valid whole-number counts", false);
  check("0", "8", "Enter valid whole-number counts", false);
  check("-1", "8", "Enter valid whole-number counts", false);
  check("1.5", "8", "Enter valid whole-number counts", false);
  check("9007199254740992", "8", "Enter valid whole-number counts", false);
  process.stdout.write(`PASS ${file}: 8 cases and listeners\n`);
}
