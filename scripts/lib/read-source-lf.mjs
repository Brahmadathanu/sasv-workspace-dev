// Test-harness helper: read a repository source file with line endings normalised to LF.
//
// Why: several source-contract tests (Costing review worklist, UX-F1, table tools, ...) read working-tree files and
// compare them with `git show <base>:<path>` or locate code fragments with "\n"-anchored patterns. A Windows checkout
// with core.autocrlf=true materialises the working tree as CRLF, while `git show` always returns the LF blob, so those
// tests fail on Windows although the committed source is correct.
//
// Scope: ONLY the two-character sequence CR LF is rewritten to LF. A lone CR, tabs, trailing spaces and every other
// character are preserved, so a real content change is still seen by the comparison (see read-source-lf.test.mjs).
import fs from "node:fs";
import path from "node:path";
import { stripN1 } from "./n1-nav-strip.mjs";

export function normalizeEolToLf(text) {
  return String(text).replace(/\r\n/g, "\n");
}

export function readSourceLf(root, rel) {
  // MDC-07 N1: the flag-gated navigation additions are removed from the two shared files that historical packages pin.
  return stripN1(rel, normalizeEolToLf(fs.readFileSync(path.join(root, rel), "utf8")));
}
