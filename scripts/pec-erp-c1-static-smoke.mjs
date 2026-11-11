#!/usr/bin/env node
/**
 * PEC-ERP-C1 static guardrails: single shared source, no server/SW changes,
 * no new RPC surface, design-layer wiring present.
 */
import fs from "node:fs";
import { execSync } from "node:child_process";

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
  ok(added.length === 0, `no new RPC names introduced (${added.join(",") || "none"})`);
}
ok(!/proc_indent_(update|edit|set)_(draft|line)[a-z_]*|proc_pr_replenish|hybrid_replenish/.test(js), "no draft-edit / replenishment RPC wired (server contract pending)");

// Protected paths untouched
if (mainJs) {
  const changed = sh("git diff --name-only origin/main...HEAD; git diff --name-only; git ls-files --others --exclude-standard").split("\n").filter(Boolean);
  ok(!changed.some((f) => /^supabase\//.test(f)), "no supabase/ changes");
  ok(!changed.includes("public/sw.js"), "public/sw.js untouched (no cache bump)");
  ok(!changed.some((f) => /^(electron|package(-lock)?\.json)/.test(f)), "no Electron/package version changes");
}

// Preserved protections from earlier work
ok(/vwlLoadAbort/.test(js) && /aqRequestSeq/.test(js), "latest-wins/cancellation protections retained (PR #238)");
ok(/canonicalIndentLineSortNo/.test(js), "canonical indent serial helpers retained");
ok(/indentRowsProvideIndentDate/.test(js) && !/indent_date\s*\?\?\s*row\.approved_date|approved_date\s*\?\?\s*row\.indent_date/.test(js), "indent date never derived from approved date");

if (fail) { console.error(`pec-erp-c1-static-smoke: ${fail} FAILED`); process.exit(1); }
console.log("pec-erp-c1-static-smoke: PASS");
