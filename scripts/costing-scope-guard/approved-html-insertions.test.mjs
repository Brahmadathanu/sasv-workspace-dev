// WP06-F8: the scope guard's tolerance for ONE approved HTML insertion must be exact (cannot hide other edits).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { APPROVED_HTML_INSERTIONS, isApprovedHtmlInsertionOnly, costingScopeReport } from "../lib/costing-scope-guard.mjs";

const E = APPROVED_HTML_INSERTIONS[0];
const BASE_PAGE = `<html>\n<style>\n${E.after}      #other { color: red; }\n</style>\n</html>\n`;
function check(headText, { base = BASE_PAGE } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "f8-"));
  fs.mkdirSync(path.dirname(path.join(root, E.rel)), { recursive: true });
  fs.writeFileSync(path.join(root, E.rel), headText);
  const git = (...a) => { if (a[0] === "show") return base; throw new Error(`unexpected git ${a.join(" ")}`); };
  try { return isApprovedHtmlInsertionOnly({ git, root, base: "BASE", rel: E.rel }); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test("exactly the approved block inserted once after its anchor is tolerated (also with CRLF line endings)", () => {
  const head = BASE_PAGE.replace(E.after, E.after + E.insert);
  assert.equal(check(head), true);
  assert.equal(check(head.replace(/\n/g, "\r\n")), true);
});

test("anything else is NOT tolerated: unchanged page, extra edit, altered block, duplicated block, block moved, deletion, other file", () => {
  const ok = BASE_PAGE.replace(E.after, E.after + E.insert);
  assert.equal(check(BASE_PAGE), false, "no change is not an approved insertion (and is reported as unchanged elsewhere)");
  assert.equal(check(ok.replace("color: red", "color: blue")), false, "extra edit next to the block");
  assert.equal(check(ok.replace("display: none;", "display: block;")), false, "altered block");
  assert.equal(check(ok.replace(E.insert, E.insert + E.insert)), false, "duplicated block");
  assert.equal(check(`<!-- x -->\n${ok}`), false, "unrelated addition");
  assert.equal(check(BASE_PAGE.replace(E.after, E.insert + E.after)), false, "block placed before the anchor");
  assert.equal(check(ok.replace("</html>\n", "")), false, "deletion");
  assert.equal(check(ok, { base: BASE_PAGE.replace(E.after, "") }), false, "anchor absent in the base");
  assert.equal(check(ok, { base: BASE_PAGE + E.after }), false, "anchor ambiguous in the base");
});

test("the approval is narrow: one entry, one page, a CSS-only block, no script, no markup", () => {
  assert.equal(APPROVED_HTML_INSERTIONS.length, 1);
  assert.equal(E.package, "WP06-F8");
  assert.equal(E.rel, "public/shared/pricing-policy-manager.html");
  assert.match(E.insert, /^\s*\/\* WP06-F8:[^\n]*\*\/\n\s*#csaDefaultPolicyRegionWrap\[hidden\] \{\n\s*display: none;\n\s*\}\n$/);
  assert.doesNotMatch(E.insert, /<script|<\/|onclick|!important/);
});

test("costingScopeReport still reports an unapproved change to the same page", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "f8r-"));
  fs.mkdirSync(path.join(root, "public/shared"), { recursive: true });
  fs.writeFileSync(path.join(root, E.rel), BASE_PAGE.replace(E.after, E.after + E.insert).replace("color: red", "color: blue"));
  const git = (...a) => {
    if (a[0] === "show") return BASE_PAGE;
    if (a[0] === "diff" && a.includes("--name-only")) return a.includes(E.rel) ? `${E.rel}\n` : "";
    if (a[0] === "ls-files" || a[0] === "ls-tree") return `${E.rel}\n`;
    if (a[0] === "diff" && a.includes("--name-status")) return "";
    return "";
  };
  try {
    const report = costingScopeReport({ git, root, base: "BASE" });
    assert.deepEqual(report.html, [E.rel]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
