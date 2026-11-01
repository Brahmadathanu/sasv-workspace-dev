// Guards the line-ending helper used by the source-contract tests: it must remove CRLF-vs-LF noise and nothing else.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { normalizeEolToLf, readSourceLf } from "./read-source-lf.mjs";

test("CRLF is normalised to LF; LF input is untouched", () => {
  assert.equal(normalizeEolToLf("a\r\nb\r\n"), "a\nb\n");
  assert.equal(normalizeEolToLf("a\nb\n"), "a\nb\n");
});

test("only CRLF changes: lone CR, whitespace and content differences survive", () => {
  assert.equal(normalizeEolToLf("a\rb"), "a\rb");
  assert.equal(normalizeEolToLf("a \r\nb\t\r\n"), "a \nb\t\n");
  // negative control: a genuine content change must still be detected after normalisation
  assert.notEqual(normalizeEolToLf("function f() {\r\n  return 1;\r\n}\r\n"), "function f() {\n  return 2;\n}\n");
  assert.notEqual(normalizeEolToLf("x\r\n"), "x\n\n");
});

test("readSourceLf reads from the given root, tolerates spaces in the path and rejects a missing file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "read source lf-"));
  try {
    fs.mkdirSync(path.join(dir, "sub dir"), { recursive: true });
    fs.writeFileSync(path.join(dir, "sub dir", "f.js"), "one\r\ntwo\r\n");
    assert.equal(readSourceLf(dir, "sub dir/f.js"), "one\ntwo\n");
    assert.throws(() => readSourceLf(dir, "missing.js"), { code: "ENOENT" });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
