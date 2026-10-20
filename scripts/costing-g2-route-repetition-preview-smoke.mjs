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
  const isDelta = file.includes("delta-form");
  const begin = source.indexOf(isDelta ? "  const repetitionPanels =" : "  const occurrencesInput = host.querySelector");
  const end = source.indexOf(isDelta ? "  enhanceIfNeeded(activityEl);" : "  refreshRepetitions();", begin);
  assert.ok(begin > 0 && end > begin, `${file}: preview binding found`);
  const binding = source.slice(begin, end + (isDelta ? 0 : "  refreshRepetitions();".length));
  if (isDelta) assert.ok(source.includes('id="${prefix}AlterCycles"') && source.includes("data-prm-repetitions-preview"), "ALTER_CYCLE preview markup");
  function check(occ, cycles, expected, warning, operation = "ADD_STEP") {
    const events = new Map();
    const nodes = new Map();
    function input(value, key) {
      return {value, addEventListener(type, cb) {events.set(key + type, cb);}};
    }
    const addOcc = input(occ, "addOcc"), addCycles = input(cycles, "addCycles");
    const cycleOcc = input(occ, "cycleOcc"), cycleCycles = input(cycles, "cycleCycles");
    const panels = new Map();
    for (const [name, x, y] of [["add",addOcc,addCycles],["cycle",cycleOcc,cycleCycles]]) {
      const suffix = name === "cycle" ? "Alter" : "";
      const total = {textContent:""}, warningNode = {hidden:true};
      const fields = new Map([
        [`#test${suffix}Occ`, x], [`#test${suffix}Cycles`,y],
        ["[data-prm-repetitions-total]",total],
        ["[data-prm-repetitions-warning]",warningNode]
      ]);
      panels.set(name,{total,warningNode,querySelector:(key)=>fields.get(key)??null});
    }
    const operationEl = input(operation, "operation");
    const host = {querySelector(selector) {
      if (selector === "#testOperation") return operationEl;
      if (selector.startsWith("[data-prm-delta-panel=")) {
        return panels.get(selector.includes('"cycle"') ? "cycle" : "add") ?? null;
      }
      const map = new Map([
        ["#testOcc",addOcc], ["#testCycles",addCycles],
        ["[data-prm-repetitions-total]",panels.get("add").total],
        ["[data-prm-repetitions-warning]",panels.get("add").warningNode]
      ]);
      return map.get(selector)??null;
    }};
    runInNewContext(binding,{host,prefix:"test",Number,normalizePrmCode:(x)=>x,operationEl});
    const target = panels.get(operation === "ALTER_CYCLE" ? "cycle" : "add");
    assert.equal(target.total.textContent, expected, file);
    assert.equal(target.warningNode.hidden, !warning, file);
    const key = operation === "ALTER_CYCLE" ? "cycleOccinput" : "addOccinput";
    assert.ok(events.has(key),file);
    if (isDelta) {
      assert.ok(events.has("addOccinput") && events.has("cycleOccinput"),file);
      operationEl.value = operation === "ALTER_CYCLE" ? "ADD_STEP" : "ALTER_CYCLE";
      events.get("operationchange")();
    }
    (operation === "ALTER_CYCLE" ? cycleOcc : addOcc).value="2";
    events.get(key)();
    assert.ok(target.total.textContent.length>0,file);
  }
  check("8", "1", "8", false);
  check("1", "8", "8", false);
  check("8", "8", "64", true);
  check("", "8", "Enter valid whole-number counts", false);
  check("0", "8", "Enter valid whole-number counts", false);
  check("-1", "8", "Enter valid whole-number counts", false);
  check("1.5", "8", "Enter valid whole-number counts", false);
  check("8", "0", "Enter valid whole-number counts", false);
  check("8", "-1", "Enter valid whole-number counts", false);
  check("8", "1.5", "Enter valid whole-number counts", false);
  check("9007199254740992", "8", "Enter valid whole-number counts", false);
  if (isDelta) {
    check("8","8","64",true,"ALTER_CYCLE");
    check("8","1","8",false,"ALTER_CYCLE");
  }
  process.stdout.write(`PASS ${file}: ${isDelta ? 13 : 11} cases and listeners\n`);
}
