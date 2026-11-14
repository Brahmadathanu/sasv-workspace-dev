#!/usr/bin/env node
/**
 * PEC-ERP-C1 static guardrails: single shared source, no server/SW changes,
 * no new RPC surface, design-layer wiring present.
 */
import fs from "node:fs";
import { execSync } from "node:child_process";
import { rejectedProtectedPaths } from "./lib/pec-protected-path-guard.mjs";

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.error("FAIL:", m); } else console.log("ok  :", m); };
const read = (p) => fs.readFileSync(p, "utf8");
const sh = (c) => execSync(c, { encoding: "utf8" });

const html = read("public/shared/procurement-execution-console.html");
const js = read("public/shared/js/procurement-execution-console.js");
const css = read("public/shared/css/sasv-procurement-execution-console.css");

ok(/<body class="sasv-pec"/.test(html), "body.sasv-pec scope");
ok(/data-sasv-theme="sasv-core"/.test(html), "sasv-core theme attribute");
ok(html.indexOf("sasv-procurement-execution-console.css") > html.indexOf("</style>"), "PEC CSS linked after inline styles");
ok(/mountModuleHome\(document\.getElementById\("homeBtn"\)\)/.test(js), "HOME mounted via shared mountModuleHome");
ok(/<h1 class="sasv-module-title">/.test(html), "canonical module title class");
ok(!/#[0-9a-fA-F]{6}\b/.test(css), "design layer uses semantic tokens, no raw hex");

// Single shared source: no copies of the module under electron/ or other public dirs
const copies = sh("git ls-files").split("\n").filter((f) => /procurement-execution-console\.(html|js)$/.test(f));
ok(copies.length === 2 && copies.every((f) => f.startsWith("public/shared/")), `no duplicated module sources (${copies.join(", ")})`);

// RPC surface unchanged vs main
const rpcNames = (t) => new Set([...t.matchAll(/\.rpc\(\s*"([a-z0-9_]+)"/g)].map((m) => m[1]));
let mainJs = "";
try { mainJs = sh("git show origin/main:public/shared/js/procurement-execution-console.js"); } catch { /* shallow */ }
if (mainJs) {
  const a = rpcNames(mainJs), b = rpcNames(js);
  const added = [...b].filter((x) => !a.has(x));
  // The only RPC names this client may add are the live paged read contracts (draft server PR #323).
  const ALLOWED_NEW = new Set([
    "proc_pec_pr_headers_filtered_paged", "proc_pec_indent_headers_filtered_paged",
    "proc_pec_purchase_excess_filtered_paged", "proc_pec_excess_acceptance_audit_paged",
    "proc_vendorwise_buylist_operational_paged", "proc_vendorwise_buylist_operational_options",
  ]);
  const unexpected = added.filter((x) => !ALLOWED_NEW.has(x));
  ok(unexpected.length === 0, `no unexpected RPC names introduced (${unexpected.join(",") || "none"}; paged contract names allowed: ${added.filter((x) => ALLOWED_NEW.has(x)).length})`);
}
ok(!/proc_indent_(update|edit|set)_(draft|line)[a-z_]*|proc_pr_replenish|hybrid_replenish/.test(js), "no draft-edit / replenishment RPC wired (server contract pending)");

// PEC-ERP-C2: single vendor-selection writer, reused from the indent modal
ok((js.match(/rpc\("proc_indent_set_vendor_selection"/g) || []).length === 1, "exactly one proc_indent_set_vendor_selection call site (no duplicate implementation)");
ok(/origin === "indent"/.test(js) && /indentAllowsVendorSelection/.test(js), "indent-origin eligibility guard present");

// Protected paths: inspect the CURRENT PR delta, never skip inherited paths.
// Fetch the explicit base ref in CI; fail closed if it is missing.
const gitTry = (command) => { try { return sh(command).trim(); } catch { return ""; } };
const headBranch = process.env.GITHUB_HEAD_REF || gitTry("git branch --show-current");
// CI supplies the exact PR base. Local worktrees derive the base from
// integration ancestry instead of a hard-coded list of branch names.
// This only selects the comparison tree: descendant branches NEVER receive
// an SQL/SW allowlist exemption.
const integrationRef = "refs/remotes/origin/integration/pec-erp-staging-20261112";
let derivedFromIntegration = false;
try {
  execSync("git merge-base --is-ancestor " + integrationRef + " HEAD", { stdio: "ignore" });
  derivedFromIntegration = true;
} catch { /* local remote ref missing or unrelated checkout */ }
const baseBranch = process.env.GITHUB_BASE_REF ||
  (headBranch === "integration/pec-erp-staging-20261112" ? "main" :
    derivedFromIntegration ? "integration/pec-erp-staging-20261112" : "main");
const integrationCandidate = headBranch === "integration/pec-erp-staging-20261112";
const baseRef = "refs/remotes/origin/" + baseBranch;
const present = gitTry("git rev-parse --verify " + baseRef);
ok(Boolean(present), "protected-path comparison base exists (" + baseRef + ")");
if (present) {
  // Two-tree diff deliberately does not need full ancestry (CI uses shallow checkout).
  const committed = gitTry("git diff --name-only " + baseRef + " HEAD");
  // Existing five PEC migrations have mixed CRLF/LF on checkout, despite
  // repository eol=lf normalization. Ignore ONLY line-ending whitespace noise;
  // edits to SQL content and any SW mutation must still fail the guard.
  const uncommitted = gitTry("git diff --ignore-space-at-eol --name-only HEAD");
  const staged = gitTry("git diff --ignore-space-at-eol --name-only --cached");
  const untracked = gitTry("git ls-files --others --exclude-standard");
  const committedPaths = committed.split("\n").filter(Boolean);
  const worktreePaths = [uncommitted, staged, untracked].join("\n").split("\n").filter(Boolean);
  // Reviewed PEC migrations and the prior SW update may exist in the integration
  // candidate's *committed* main-to-HEAD history. Never permit even those paths
  // when they are freshly changed in the working tree (or on a client PR).
  const illegal = [...new Set([
    // Committed paths only: the reviewed server-lane migration exception is pinned to
    // exact path + head branch + content hash (see REVIEWED_SERVER_MIGRATIONS).
    ...rejectedProtectedPaths(committedPaths, integrationCandidate, {
      headBranch,
      readText: (f) => fs.readFileSync(f, "utf8"),
    }),
    ...rejectedProtectedPaths(worktreePaths, false),
  ])];
  ok(illegal.length === 0, "no unauthorized new SQL/SW paths (" + (illegal.join(", ") || "none") + ")");
  const changed = [...committedPaths, ...worktreePaths];
  ok(!changed.some(f => /^(electron\/|package(-lock)?\\.json$)/.test(f)),
    "no Electron/package version changes");
}

// Preserved protections from earlier work
ok(/vwlLoadAbort/.test(js) && /aqRequestSeq/.test(js), "latest-wins/cancellation protections retained (PR #238)");
ok(/canonicalIndentLineSortNo/.test(js), "canonical indent serial helpers retained");
ok(/indentRowsProvideIndentDate/.test(js) && !/indent_date\s*\?\?\s*row\.approved_date|approved_date\s*\?\?\s*row\.indent_date/.test(js), "indent date never derived from approved date");

if (fail) { console.error(`pec-erp-c1-static-smoke: ${fail} FAILED`); process.exit(1); }
console.log("pec-erp-c1-static-smoke: PASS");
