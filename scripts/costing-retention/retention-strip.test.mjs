import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { stripRetentionR3R7, RETENTION_R3R7_FILES } from "../lib/retention-r3r7-strip.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PRE = "8d3570dad9b99a1f322dc753e2da0681dc55872d"; // tested checkpoint before R3 integration / R7 retirement
const lf = (t) => t.replace(/\r\n/g, "\n");
let haveHistory = true;
try { execFileSync("git", ["cat-file", "-e", `${PRE}^{commit}`], { cwd: root, stdio: "ignore" }); } catch { haveHistory = false; }

test("strip reverses exactly the R3/R7 edits: stripped current file == the pre-R3/R7 checkpoint, byte for byte (needs full history)", { skip: !haveHistory && "checkpoint commit unavailable (shallow clone)" }, () => {
  assert.ok(RETENTION_R3R7_FILES.length >= 7);
  for (const rel of RETENTION_R3R7_FILES) {
    const cur = lf(fs.readFileSync(path.join(root, rel), "utf8"));
    const pre = lf(execFileSync("git", ["show", `${PRE}:${rel}`], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
    assert.notEqual(cur, pre, `${rel}: fixture assumption, R3/R7 edits present`);
    assert.equal(stripRetentionR3R7(rel, cur), pre, rel);
    assert.equal(stripRetentionR3R7(rel, pre), pre, `${rel}: idempotent on pre-R3/R7 text`);
    assert.equal(stripRetentionR3R7(rel, cur.replace(/\n/g, "\r\n")), pre, `${rel}: CRLF input`);
  }
});
test("unrelated files are untouched", () => {
  assert.equal(stripRetentionR3R7("public/shared/js/other.js", "x\r\ny"), "x\r\ny");
});
