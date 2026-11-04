// SEC-A2 historical-guard helper (scripts/lib/sec-a2-strip.mjs): it must reverse exactly the SEC-A2 text and nothing else.
// Base text is the immutable commit before SEC-A2 (main after #173). Needs full git history, like the other base-pinned tests.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { stripSecA2Approval, stripSecA2Shell, stripSecA2, SEC_A2_APPROVAL_HUNKS, SEC_A2_SHELL_LINE } from "../lib/sec-a2-strip.mjs";
import { stripN1 } from "../lib/n1-nav-strip.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PRE_SEC_A2 = "735ea40c9a372c65016e197b6bbacb9c1b689b15";
const APPROVAL = "public/shared/js/costing-approval-screen.js";
const SHELL = "public/shared/js/costing-suite-shell.js";
const lf = (t) => t.replace(/\r\n/g, "\n");
const head = (rel) => lf(fs.readFileSync(path.join(root, rel), "utf8"));
const base = (rel) => lf(execFileSync("git", ["show", `${PRE_SEC_A2}:${rel}`], { encoding: "utf8", cwd: root, maxBuffer: 64 * 1024 * 1024 }));

test("approval screen: stripping the seven SEC-A2 hunks restores the pre-SEC-A2 file exactly", () => {
  assert.notEqual(head(APPROVAL), base(APPROVAL), "fixture assumption: SEC-A2 is present");
  assert.equal(stripSecA2Approval(head(APPROVAL)), base(APPROVAL));
  assert.equal(stripSecA2Approval(base(APPROVAL)), base(APPROVAL), "idempotent on the pre-SEC-A2 text");
  assert.equal(stripSecA2Approval(head(APPROVAL).replace(/\n/g, "\r\n")), base(APPROVAL), "CRLF input");
  assert.equal(SEC_A2_APPROVAL_HUNKS.length, 7);
});

test("shell: the single injected permission line is the only SEC-A2 difference", () => {
  assert.equal(stripSecA2Shell(head(SHELL)), base(SHELL));
  assert.equal(stripSecA2Shell(base(SHELL)), base(SHELL));
  assert.equal(head(SHELL).split(SEC_A2_SHELL_LINE).length - 1, 1);
});

test("routing: stripSecA2 and stripN1 reverse SEC-A2 for these two files only", () => {
  assert.equal(stripSecA2(APPROVAL, head(APPROVAL)), base(APPROVAL));
  assert.equal(stripN1(APPROVAL, head(APPROVAL)), base(APPROVAL));
  assert.equal(stripSecA2("public/shared/js/other.js", "x"), "x");
});

test("tamper: any other change is left in place, so the historical comparison still fails", () => {
  const a = head(APPROVAL);
  const sneaky = [
    ["extra code after a hunk", a.replace("    if (canEdit() !== true) return;\n", "    if (canEdit() !== true) return;\n    sneaky();\n")],
    ["altered toast text", a.replace("Approval preview requires Costing Control Center edit permission.", "Approval preview requires nothing.")],
    ["unrelated edit", a.replace("function canSubmitApprove() {", "function canSubmitApprove() { /* x */")],
    ["a call to a different RPC", a.replace("const { data, error } = await costingRpc(RPC.preview, {", "const { data, error } = await costingRpc(RPC.approve, {")],
  ];
  for (const [name, text] of sneaky) assert.notEqual(stripSecA2Approval(text), base(APPROVAL), name);
  const dup = a + "\n" + SEC_A2_APPROVAL_HUNKS[1][0];
  assert.notEqual(stripSecA2Approval(dup), base(APPROVAL), "a duplicated hunk is not stripped");
  const s = head(SHELL);
  assert.notEqual(stripSecA2Shell(s.replace(SEC_A2_SHELL_LINE, SEC_A2_SHELL_LINE + SEC_A2_SHELL_LINE)), base(SHELL), "duplicated line is left in place");
  assert.notEqual(stripSecA2Shell(s.replace(SEC_A2_SHELL_LINE, SEC_A2_SHELL_LINE.replace("PERM_CONTROL_CENTER_EDIT === true", "true"))), base(SHELL), "altered line is left in place");
  assert.notEqual(stripSecA2Shell(s + "\nvoid 0;\n"), base(SHELL), "unrelated shell edit is not masked");
});
