// Fails unless a node:test TAP report shows a genuine, complete, zero-skip pass.
// Usage: node scripts/costing-preview/assert-tap.mjs <report.tap> <minimum-passing-tests>
// An all-skipped or empty report can never satisfy this gate.
import { readFileSync } from "node:fs";
const [file, minimum] = process.argv.slice(2);
const text = readFileSync(file, "utf8");
const n = (key) => Number(text.match(new RegExp("^# " + key + " (\\d+)$", "m"))?.[1] ?? NaN);
const c = { tests: n("tests"), pass: n("pass"), fail: n("fail"), cancelled: n("cancelled"), skipped: n("skipped"), todo: n("todo") };
const problems = [];
if (Object.values(c).some(Number.isNaN)) problems.push("TAP summary incomplete");
if (c.fail || c.cancelled || c.skipped || c.todo) problems.push("fail/cancelled/skipped/todo must all be 0");
if (c.pass !== c.tests) problems.push("every test must pass");
if (!(c.pass >= Number(minimum))) problems.push("expected at least " + minimum + " passing tests, saw " + c.pass);
console.log(file + ": " + JSON.stringify(c) + (problems.length ? " FAIL: " + problems.join("; ") : " OK (min " + minimum + ")"));
process.exit(problems.length ? 1 : 0);
