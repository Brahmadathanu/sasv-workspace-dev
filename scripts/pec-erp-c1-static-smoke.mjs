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
    // R12: read-only SAFE/RESET collision preview (proposed server contract, draft server PR; client degrades if absent)
    "proc_indent_resync_collision_preview",
    // S4: owner-requested live server contracts. The SQL blobs are separately
    // pinned to this branch and their exact sha256 in pec-protected-path-guard.
    "proc_pec_ccf_pr_preview", "proc_pec_ccf_apply_draft_line",
    "proc_pec_s4_new_pr_plan", "proc_pec_s4_generate_pr",
    "proc_pec_s4_reconcile_draft", "proc_pec_s4_pr_evidence",
    // Issue #502: server-owned JIT MRP route (pinned server PR; client falls back to hybrid if absent).
    "proc_pec_jit_mrp_plan", "proc_pec_jit_generate_pr",
  ]);
  const unexpected = added.filter((x) => !ALLOWED_NEW.has(x));
  ok(unexpected.length === 0, `no unexpected RPC names introduced (${unexpected.join(",") || "none"}; paged contract names allowed: ${added.filter((x) => ALLOWED_NEW.has(x)).length})`);
}
ok(!/proc_indent_(update|edit|set)_(draft|line)[a-z_]*|proc_pr_replenish|hybrid_replenish/.test(js), "no draft-edit / replenishment RPC wired (server contract pending)");
if (js.includes('rpc("proc_pec_ccf_apply_draft_line"')) {
  const previewSql = read("supabase/migrations/20261122075009_pec_s4_ccf_pr_preview_readonly.sql");
  const writerSql = read("supabase/migrations/20261122075447_pec_s4_ccf_apply_draft_line_guarded.sql");
  ok(/proc_pec_ccf_pr_preview\(p_pr_id bigint\)/.test(previewSql) &&
      /LANGUAGE plpgsql STABLE SECURITY DEFINER/.test(previewSql) &&
      /require_permission\('module:procurement-execution-console',false\)/.test(previewSql) &&
      /REVOKE ALL ON FUNCTION public\.proc_pec_ccf_pr_preview\(bigint\) FROM anon/.test(previewSql),
      "S4 preview: exact read-only signature, canonical View guard and anon revoke");
  ok(/proc_pec_ccf_apply_draft_line\(/.test(writerSql) &&
      /require_permission\('module:procurement-execution-console',true\)/.test(writerSql) &&
      /v_pr_status IS DISTINCT FROM 'draft'/.test(writerSql) &&
      /p_confirm IS DISTINCT FROM true/.test(writerSql) &&
      /proc_pr_set_manual_delta_pec_internal/.test(writerSql) &&
      /REVOKE ALL ON FUNCTION public\.proc_pec_ccf_apply_draft_line/.test(writerSql),
      "S4 writer: exact guarded draft-only audited single-line contract");
  ok(/ccfApplyAcknowledged/.test(html) && /ccfApplyReason/.test(html) &&
      /p_expected_ccf_floor/.test(js) && /p_expected_stock_as_of/.test(js),
      "S4 client: explicit confirmation, audit reason and stale evidence fields");
}

// S4 E2E: three exact installed server payloads; no other SQL exceptions.
// These are additional to the prior S4 single-line preview/approval guards.
if(js.includes('rpc("proc_pec_s4_generate_pr"')){
  const plan=read("supabase/migrations/20261122082353_pec_s4_new_pr_hybrid_plan.sql");
  const gen=read("supabase/migrations/20261122082532_pec_s4_hybrid_generator_evidence.sql");
  const rec=read("supabase/migrations/20261122082653_pec_s4_reconcile_existing_draft.sql");
  ok(plan.includes("proc_pec_s4_new_pr_plan") &&
    plan.includes("require_permission('module:procurement-execution-console',false)") &&
    plan.includes("v_proc_indent_line_balance") &&
    plan.includes("v_item_consumption_monthly_by_item"),
    "S4 E2E plan checks exact View permission, consumption and approved indent balances");
  ok(gen.includes("proc_pec_s4_generate_pr") &&
    gen.includes("require_permission('module:procurement-execution-console',true)") &&
    gen.includes("proc_pr_ccf_generation_evidence") &&
    gen.includes("ALTER TABLE public.proc_pr_ccf_generation_evidence ENABLE ROW LEVEL SECURITY") &&
    gen.includes("REVOKE ALL ON public.proc_pr_ccf_generation_evidence FROM PUBLIC,anon,authenticated"),
    "S4 E2E writer has Edit guard, atomic evidence and RLS");
  ok(rec.includes("proc_pec_s4_reconcile_draft") &&
    rec.includes("p_confirm IS DISTINCT FROM true") &&
    rec.includes("h.updated_at IS DISTINCT FROM p_expected_updated_at") &&
    rec.includes("l.manual_delta_qty=0") &&
    rec.includes("l.updated_at<=l.created_at+interval '1 second'"),
    "S4 E2E same-day draft reconciliation guards, no silent manual overwrite");
  ok(js.includes('rpc("proc_pec_s4_new_pr_plan"') &&
     js.includes('rpc("proc_pec_s4_generate_pr"') &&
     js.includes('rpc("proc_pec_s4_reconcile_draft"') &&
     !js.includes('rpc("create_pr_from_mrp_plan"'),
    "S4 E2E client uses governed generator and never legacy MRP-only generation");
}
if (js.includes('rpc("proc_pec_jit_generate_pr"')) {
  const jit = read("supabase/migrations/20261122153109_pec_jit_mrp_route_plan_and_generator.sql");
  ok(jit.includes("require_permission('module:procurement-execution-console',true)") &&
     jit.includes("require_permission('module:procurement-execution-console',false)") &&
     jit.includes("rm_procurement_mode='jit_procured'") &&
     jit.includes("p_confirm IS DISTINCT FROM true"),
    "JIT route: server contract is permission-gated, confirmation-gated and jit_procured-only");
  ok(js.includes("s4IsMissingRpc") && js.includes('rpc("proc_pec_jit_mrp_plan"') &&
     js.includes('rpc("proc_pec_s4_generate_pr"'),
    "JIT route: client falls back to the existing hybrid review when the server functions are absent");
  ok(!js.includes('reasonText = "Quantity adjustment"') && js.includes("pecReasonIsPlaceholderOnly"),
    "reason templates: no silent generic override reason; placeholder-only input is rejected");
}
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
