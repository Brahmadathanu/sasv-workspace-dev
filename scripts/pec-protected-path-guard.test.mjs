#!/usr/bin/env node
// Mutation-sensitive PEC integration protected-file policy verification.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { rejectedProtectedPaths, INTEGRATION_PROTECTED_PATHS, REVIEWED_SERVER_MIGRATIONS, REVIEWED_WP08_G2_1_PINS, REVIEWED_WP11_V394_PINS } from "./lib/pec-protected-path-guard.mjs";
import fs from "node:fs";
let passed = 0;
function test(name, changed, integration, expected) {
  assert.deepEqual(rejectedProtectedPaths(changed, integration), expected, name);
  console.log("PASS:", name);
  passed++;
}
const migrated = "supabase/migrations/20261112110000_pec_four_gram_material_bom_normalization.sql";
const sw = "public/sw.js";
const illicit = "supabase/migrations/20991231000000_unreviewed_prod_write.sql";
test("integration permits exact inherited G0 migration", [migrated], true, []);
test("integration permits exact reviewed SW change", [sw], true, []);
test("client descendant rejects edited inherited G0 migration", [migrated], false, [migrated]);
test("client descendant rejects edited inherited SW", [sw], false, [sw]);
test("client descendant rejects newly added unreviewed migration", [illicit], false, [illicit]);
test("integration branch rejects arbitrary new migration", [illicit], true, [illicit]);
test("main-based client branch rejects SW change", [sw], false, [sw]);
test("unrelated client sources allowed", ["public/shared/js/procurement-execution-console.js"], false, []);
test("new protected paths never masked by reviewed inherited paths",
 [migrated, sw, illicit], true, [illicit]);
assert.equal(INTEGRATION_PROTECTED_PATHS.size, 12, "exact 10 G0/G1 migrations + #374 Add Line migration + SW");

// --- R13: reviewed server-lane migration (#374) exception: exact path + head branch + content hash.
const addLine = "supabase/migrations/20261112220000_pec_r2_add_line_new_row_status_guard.sql";
const entry = REVIEWED_SERVER_MIGRATIONS[addLine];
assert.ok(entry, "reviewed entry exists");
const goodText = fs.readFileSync(addLine, "utf8");
const ctx = (over = {}) => ({ headBranch: entry.heads[0], readText: () => goodText, ...over });
const t2 = (name, changed, expected, c) => { assert.deepEqual(rejectedProtectedPaths(changed, false, c), expected, name); console.log("PASS:", name); passed++; };
t2("reviewed #374 migration allowed on its named head with exact content", [addLine], [], ctx());
t2("allowed on the dedicated integration head too", [addLine], [], ctx({ headBranch: entry.heads[1] }));
t2("same file rejected on a client descendant branch", [addLine], [addLine], ctx({ headBranch: "claude/pec-r12-resync-collision-ux-20261113" }));
t2("same file rejected when content differs by one byte", [addLine], [addLine], ctx({ readText: () => goodText + "\n-- x" }));
t2("same file rejected when unreadable", [addLine], [addLine], ctx({ readText: () => { throw new Error("nope"); } }));
t2("same file rejected without context (worktree / legacy callers)", [addLine], [addLine], null);
t2("CRLF checkout of identical content still matches", [addLine], [], ctx({ readText: () => goodText.replace(/\n/g, "\r\n") }));
t2("other migrations are NOT exempted by the #374 entry", [illicit, migrated, sw], [illicit, migrated, sw], ctx());
t2("renamed copy of the reviewed SQL is rejected", ["supabase/migrations/20261112220001_copy.sql"], ["supabase/migrations/20261112220001_copy.sql"], ctx());
t2("SW stays protected on the reviewed head", [sw, addLine], [sw], ctx());
const r10 = [
  "supabase/migrations/20261113170715_pec_safe_resync_collision_guard_lock_order.sql",
  "supabase/migrations/20261113172424_pec_safe_resync_collision_preview_ro.sql",
  "supabase/migrations/20261114013211_pec_indent_set_source_pr_lock_prelude.sql",
];
for (const migration of r10) {
  const pin = REVIEWED_SERVER_MIGRATIONS[migration];
  assert.ok(pin && /^[a-f0-9]{64}$/.test(pin.sha256), "R10 reviewed SHA256 pin exists");
  assert.deepEqual(pin.heads, ["integration/pec-erp-staging-20261112"], "R10 restricted to staging branch");
  const text = fs.readFileSync(migration, "utf8");
  const context = { headBranch: "integration/pec-erp-staging-20261112", readText: () => text };
  t2("R10 exact file accepted on integration branch: " + migration, [migration], [], context);
  t2("R10 changed content rejected: " + migration, [migration], [migration],
    { ...context, readText: () => text + "\\n-- malicious change" });
  t2("R10 wrong branch rejected: " + migration, [migration], [migration],
    { ...context, headBranch: "claude/pec-r12-resync-collision-ux-20261113" });
  t2("R10 no context rejected: " + migration, [migration], [migration], null);
  t2("R10 uncommitted content rejected: " + migration, [migration], [migration], null);
}
t2("R10 staging-only pins do not weaken SW or arbitrary SQL rejection",
  [...r10, sw, illicit], [sw, illicit],
  { headBranch: "integration/pec-erp-staging-20261112",
    readText: (p) => fs.readFileSync(p, "utf8") });
// R-2 approval-race correction (#412): proposed, pinned to its own branch and exact content.
const r2fix = "supabase/migrations/20261114135500_pec_indent_set_status_header_lock.sql";
{
  const pin = REVIEWED_SERVER_MIGRATIONS[r2fix];
  assert.ok(pin && /^[a-f0-9]{64}$/.test(pin.sha256), "R-2 reviewed SHA256 pin exists");
  assert.deepEqual(pin.heads, ["claude/pec-r2-approval-race-fix-20261114", "integration/pec-erp-staging-20261112"], "R-2 restricted to its own branch and the staging branch");
  const text = fs.readFileSync(r2fix, "utf8");
  const context = { headBranch: "claude/pec-r2-approval-race-fix-20261114", readText: () => text };
  t2("R-2 exact file accepted on its own branch", [r2fix], [], context);
  t2("R-2 changed content rejected", [r2fix], [r2fix], { ...context, readText: () => text + "\n-- malicious change" });
  t2("R-2 exact file accepted on the staging branch (integration after production approval)", [r2fix], [], { ...context, headBranch: "integration/pec-erp-staging-20261112" });
  t2("R-2 changed content rejected on the staging branch", [r2fix], [r2fix], { ...context, headBranch: "integration/pec-erp-staging-20261112", readText: () => text + "\n-- malicious change" });
  t2("R-2 rejected on another client branch", [r2fix], [r2fix], { ...context, headBranch: "claude/pec-r12-resync-collision-ux-20261113" });
  t2("R-2 rejected without context", [r2fix], [r2fix], null);
  t2("R-2 renamed copy rejected", ["supabase/migrations/20261114135501_copy.sql"], ["supabase/migrations/20261114135501_copy.sql"], context);
}
// Reviewed WP08 G2-1 exception for public/sw.js: exact content + the WP08 G2-1 branch only (mutation-negative).
{
  const pin = REVIEWED_WP08_G2_1_PINS[sw];
  const head = "claude/blissful-thompson-lv1ekb";
  assert.ok(pin && /^[a-f0-9]{64}$/.test(pin.sha256), "WP08 G2-1 sw.js SHA256 pin exists");
  assert.deepEqual(pin.heads, [head], "WP08 G2-1 sw.js exception restricted to its own branch");
  const live = fs.readFileSync(sw, "utf8");
  const lf = live.replace(/\r\n/g, "\n");
  const liveSha = createHash("sha256").update(lf).digest("hex");
  const ctx = (over = {}) => ({ headBranch: head, readText: () => live, ...over });
  const check = (name, changed, expected, c) => { assert.deepEqual(rejectedProtectedPaths(changed, false, c), expected, name); console.log("PASS:", name); passed++; };
  if (liveSha === pin.sha256) {
    assert.ok(lf.includes('const CACHE_NAME = "hub-cache-v393"'), "cache version unchanged");
    for (const m of ["costing-suite-recommended-ui-route", "costing-destination-access", "master-data-selection", "costing-suite-control-center", "master-data-platform|master-data-write-guard", "procurement-execution-console"]) assert.ok(lf.includes(m), `network-first rule present: ${m}`);
    check("WP08 G2-1 sw.js exact reviewed content accepted on its branch", [sw], [], ctx());
    check("WP08 G2-1 sw.js CRLF checkout accepted", [sw], [], ctx({ readText: () => lf.replace(/\n/g, "\r\n") }));
    check("WP08 G2-1 sw.js beside an unrelated migration: migration still rejected", [sw, illicit], [illicit], ctx());
  } else {
    console.log("NOTE: working-tree public/sw.js differs from the WP08 G2-1 pin; acceptance cases skipped (rejection cases below always run)");
  }
  check("WP08 G2-1 sw.js one extra character rejected", [sw], [sw], ctx({ readText: () => lf + "\n// x" }));
  check("WP08 G2-1 sw.js with a bumped cache version rejected", [sw], [sw], ctx({ readText: () => lf.replace("hub-cache-v393", "hub-cache-v394") }));
  check("WP08 G2-1 sw.js with a network-first rule removed rejected", [sw], [sw], ctx({ readText: () => lf.replace("master-data-selection", "master-data-selectio") }));
  check("WP08 G2-1 sw.js rejected on another branch", [sw], [sw], ctx({ headBranch: "claude/pec-r12-resync-collision-ux-20261113" }));
  check("WP08 G2-1 sw.js rejected on the staging branch", [sw], [sw], ctx({ headBranch: "integration/pec-erp-staging-20261112" }));
  check("WP08 G2-1 sw.js rejected without context", [sw], [sw], null);
  check("WP08 G2-1 pin never exempts a migration", [migrated, illicit], [migrated, illicit], ctx());
  check("WP08 G2-1 pin never exempts uncommitted/working-tree changes", [sw], [sw], undefined);
}
// Reviewed main-sync exception for public/sw.js: exact merged content + sync branch only.
{
  const pin = REVIEWED_SERVER_MIGRATIONS[sw];
  const syncHead = "claude/pec-staging-main-sync-20261114";
  assert.ok(pin && /^[a-f0-9]{64}$/.test(pin.sha256), "sw.js reviewed SHA256 pin exists");
  assert.deepEqual(pin.heads, [syncHead], "sw.js exception restricted to the sync branch only");
  const live = fs.readFileSync(sw, "utf8");
  const liveSha = createHash("sha256").update(live.replace(/\r\n/g, "\n")).digest("hex");
  if (liveSha === pin.sha256) {
    const ctx = (over = {}) => ({ headBranch: syncHead, readText: () => live, ...over });
    // content properties of the reviewed merge
    const lf = live.replace(/\r\n/g, "\n");
    assert.ok(lf.includes('const CACHE_NAME = "hub-cache-v393"'), "cache version unchanged");
    assert.ok(/procurement-execution-console\\\.js\$\/\.test\(url\.pathname\)/.test(lf) && /sasv-procurement-execution-console\\\.css\$\/\.test\(url\.pathname\)/.test(lf), "PEC network-first rules present");
    assert.ok(lf.includes("WP08 G2-0") && lf.includes("master-data-platform") && lf.includes("master-data-write-guard") && lf.includes("(?:shared-ui|sasv-bom)"), "main (WP08 G2-0) network-first rules present, including the write-guard module");
    assert.ok(!/<<<<<<<|>>>>>>>/.test(lf), "no conflict markers");
    t2("sw.js exact reviewed merge accepted on the sync branch", [sw], [], ctx());
    t2("sw.js CRLF checkout of the same content accepted", [sw], [], ctx({ readText: () => lf.replace(/\n/g, "\r\n") }));
    t2("sw.js one extra character rejected", [sw], [sw], ctx({ readText: () => lf + "\n// x" }));
    t2("sw.js with the PEC rules removed rejected", [sw], [sw], ctx({ readText: () => lf.replace("procurement-execution-console", "procurement-execution-consolX") }));
    t2("sw.js with the main WP08 rules removed rejected", [sw], [sw], ctx({ readText: () => lf.replace("master-data-platform", "master-data-platfor") }));
    t2("sw.js with a bumped cache version rejected", [sw], [sw], ctx({ readText: () => lf.replace("hub-cache-v393", "hub-cache-v394") }));
    t2("unrelated protected migration still rejected beside the sw.js exception", [sw, illicit, migrated], [illicit, migrated], ctx());
  } else {
    console.log("NOTE: working-tree public/sw.js differs from the reviewed merge pin; acceptance cases skipped (rejection cases below always run)");
  }
  const text = fs.readFileSync(sw, "utf8");
  t2("sw.js rejected on the staging branch itself via the sync pin (integration candidates use the separate inherited list)", [sw], [sw], { headBranch: "integration/pec-erp-staging-20261112", readText: () => text });
  t2("sw.js rejected on another client branch", [sw], [sw], { headBranch: "claude/pec-r12-resync-collision-ux-20261113", readText: () => text });
  t2("sw.js rejected on the R-2 branch", [sw], [sw], { headBranch: "claude/pec-r2-approval-race-fix-20261114", readText: () => text });
  t2("sw.js rejected without context", [sw], [sw], null);
  t2("sw.js rejected when unreadable", [sw], [sw], { headBranch: syncHead, readText: () => { throw new Error("nope"); } });
  t2("sw.js altered on the sync branch rejected", [sw], [sw], { headBranch: syncHead, readText: () => text + "\n// tampered" });
}
// WP11 v394 exception for public/sw.js (PR #467): exact content hash + its own branch only; negative mutations always run.
{
  const pin = REVIEWED_WP11_V394_PINS[sw];
  const head = "review/wp11-pm-bom-v394-minimal-20261117";
  assert.ok(pin && /^[a-f0-9]{64}$/.test(pin.sha256), "WP11 sw.js SHA256 pin exists");
  assert.deepEqual(pin.heads, [head], "WP11 sw.js exception restricted to its own branch");
  const live = fs.readFileSync(sw, "utf8");
  const lf = live.replace(/\r\n/g, "\n");
  assert.equal(createHash("sha256").update(lf).digest("hex"), pin.sha256, "working-tree sw.js is the pinned WP11 v394 file (re-pin only with owner review)");
  assert.ok(lf.includes('const CACHE_NAME = "hub-cache-v394"'), "v394 cache line");
  const ctx = (over = {}) => ({ headBranch: head, readText: () => live, ...over });
  const c = (name, changed, expected, context) => { assert.deepEqual(rejectedProtectedPaths(changed, false, context), expected, name); console.log("PASS:", name); passed++; };
  c("WP11 sw.js exact content accepted on its branch", [sw], [], ctx());
  c("WP11 sw.js CRLF checkout accepted", [sw], [], ctx({ readText: () => lf.replace(/\n/g, "\r\n") }));
  c("WP11 sw.js one extra character rejected", [sw], [sw], ctx({ readText: () => lf + "\n// x" }));
  c("WP11 sw.js with a network-first rule removed rejected", [sw], [sw], ctx({ readText: () => lf.replace("master-data-platform", "master-data-platfor") }));
  c("WP11 sw.js with another cache generation rejected", [sw], [sw], ctx({ readText: () => lf.replace("hub-cache-v394", "hub-cache-v395") }));
  c("WP11 sw.js previous v393 content rejected", [sw], [sw], ctx({ readText: () => lf.replace("hub-cache-v394", "hub-cache-v393") }));
  c("WP11 sw.js rejected on another branch", [sw], [sw], ctx({ headBranch: "claude/pec-r12-resync-collision-ux-20261113" }));
  c("WP11 sw.js rejected on the staging branch", [sw], [sw], ctx({ headBranch: "integration/pec-erp-staging-20261112" }));
  c("WP11 sw.js rejected without context", [sw], [sw], null);
  c("WP11 pin never exempts a migration", [migrated, illicit], [migrated, illicit], ctx());
  c("WP11 pin never exempts a migration beside sw.js", [sw, illicit, migrated], [illicit, migrated], ctx());
  c("WP11 pin never exempts uncommitted/working-tree changes", [sw], [sw], undefined);
}
// #400 authenticated-DML correction: proposed, pinned to its own branch (and staging for later integration) and exact content.
const sec400 = "supabase/migrations/20261114160000_pec_revoke_authenticated_dml_policy_link_tables.sql";
{
  const pin = REVIEWED_SERVER_MIGRATIONS[sec400];
  assert.ok(pin && /^[a-f0-9]{64}$/.test(pin.sha256), "#400 reviewed SHA256 pin exists");
  assert.deepEqual(pin.heads, ["claude/pec-400-dml-hardening-20261114", "integration/pec-erp-staging-20261112"], "#400 restricted to its own branch and staging");
  const text = fs.readFileSync(sec400, "utf8");
  const context = { headBranch: "claude/pec-400-dml-hardening-20261114", readText: () => text };
  t2("#400 exact file accepted on its own branch", [sec400], [], context);
  t2("#400 changed content rejected", [sec400], [sec400], { ...context, readText: () => text + "\n-- malicious change" });
  t2("#400 rejected on another client branch", [sec400], [sec400], { ...context, headBranch: "claude/pec-r12-resync-collision-ux-20261113" });
  t2("#400 rejected without context", [sec400], [sec400], null);
}
// Owner-requested PEC S4: two registered production migrations, pinned to the
// dedicated review branch only. Even an additional newline or a different
// branch must fail protected-path authorization.
// Full S4 new plan, atomic generation, and draft reconciliation — exact applied blobs.
const s4horizonguard = [
 ["supabase/migrations/20261122084655_pec_s4_duplicate_pr_horizon_guard.sql",
  "0c29d28eb377b770d112fa69c14da7ca30265bf2d7859d64fbcd5cabe4832685"]
];
for(const [file,sha] of s4horizonguard){
 const content=fs.readFileSync(file,"utf8");
 assert.deepEqual(REVIEWED_SERVER_MIGRATIONS[file],{sha256:sha,heads:["feat/pec-s4-end-to-end-20261122"]});
 assert.equal(createHash("sha256").update(content.replace(/\r\n/g,"\n")).digest("hex"),sha);
 const ctx={headBranch:"feat/pec-s4-end-to-end-20261122",readText:()=>content};
 t2("S4 horizon lock exact accepted",[file],[],ctx);
 t2("S4 horizon lock changed rejected",[file],[file],{...ctx,readText:()=>content+"\n-- tamper"});
 t2("S4 horizon lock wrong branch rejected",[file],[file],{...ctx,headBranch:"main"});
}
const s4uomguard = [
  ["supabase/migrations/20261122084452_pec_s4_duplicate_uom_candidate_guard.sql",
    "bed758b746cfdfe675d85d9205f8c70d89269caf33c9e232eb6561fb34331eca"]
];
for(const [file,sha] of s4uomguard){
 const content=fs.readFileSync(file,"utf8");
 assert.deepEqual(REVIEWED_SERVER_MIGRATIONS[file],{sha256:sha,heads:["feat/pec-s4-end-to-end-20261122"]});
 assert.equal(createHash("sha256").update(content.replace(/\r\n/g,"\n")).digest("hex"),sha);
 const ctx={headBranch:"feat/pec-s4-end-to-end-20261122",readText:()=>content};
 t2("S4 UOM guard exact accepted",[file],[],ctx);
 t2("S4 UOM guard edited rejected",[file],[file],{...ctx,readText:()=>content+"\n-- alter"});
 t2("S4 UOM guard wrong branch rejected",[file],[file],{...ctx,headBranch:"main"});
}
const s4retired = [
  ["supabase/migrations/20261122083956_pec_s4_retire_old_ccf_writer.sql",
   "a19f196fb1230f92563779b223cc509214f704f2b22a0c999e903b100c891f33"]
];
for(const [file,sha] of s4retired){
 const content=fs.readFileSync(file,"utf8");
 assert.deepEqual(REVIEWED_SERVER_MIGRATIONS[file],{sha256:sha,heads:["feat/pec-s4-end-to-end-20261122"]});
 assert.equal(createHash("sha256").update(content.replace(/\r\n/g,"\n")).digest("hex"),sha);
 const ctx={headBranch:"feat/pec-s4-end-to-end-20261122",readText:()=>content};
 t2("S4 retired writer exact content accepted", [file],[],ctx);
 t2("S4 retired writer changed content rejected",[file],[file],{...ctx,readText:()=>content+"\n-- tamper"});
 t2("S4 retired writer other branch rejected",[file],[file],{...ctx,headBranch:"main"});
}
const s4compat = [
  ["supabase/migrations/20261122083237_pec_s4_legacy_electron_compatibility.sql","5aede676c2442410eedfa20ee4f9307f6aebd84f8bfd86223db544f36013ce2e"]
];
const s4e2e = [
  ["supabase/migrations/20261122082353_pec_s4_new_pr_hybrid_plan.sql", "2ef75c2953eea7e6d79b096c549f834acb15b71cae277ff8b2385ab3bea3301b"],
  ["supabase/migrations/20261122082532_pec_s4_hybrid_generator_evidence.sql", "7296a87c0e603c0c9919dcc95ef7a6e690380676c6c552e97b1964eee8f98d70"],
  ["supabase/migrations/20261122082653_pec_s4_reconcile_existing_draft.sql", "dea0c1e12ff1aa909997a0eaf9bfcbdd6f84b3c70e66d8dd5a635f7c3fa59b51"],
];
for (const [file,sha] of s4compat) {
 const pin=REVIEWED_SERVER_MIGRATIONS[file];
 assert.deepEqual(pin,{sha256:sha,heads:["feat/pec-s4-end-to-end-20261122"]});
 const content=fs.readFileSync(file,"utf8");
 assert.equal(createHash("sha256").update(content.replace(/\r\n/g,"\n")).digest("hex"),sha);
 const ctx={headBranch:"feat/pec-s4-end-to-end-20261122",readText:()=>content};
 t2("S4 legacy RPC exact guard accepted: "+file,[file],[],ctx);
 t2("S4 legacy RPC changed SQL rejected: "+file,[file],[file],{...ctx,readText:()=>content+"\n-- extra"});
 t2("S4 legacy RPC wrong branch rejected: "+file,[file],[file],{...ctx,headBranch:"main"});
 t2("S4 legacy RPC unrelated SQL rejected: "+file,[illicit],[illicit],ctx);
}
for (const [file,sha] of s4e2e) {
  assert.deepEqual(REVIEWED_SERVER_MIGRATIONS[file], {sha256:sha,heads:["feat/pec-s4-end-to-end-20261122"]});
  const content=fs.readFileSync(file,"utf8");
  assert.equal(createHash("sha256").update(content.replace(/\r\n/g,"\n")).digest("hex"),sha);
  const ctx={headBranch:"feat/pec-s4-end-to-end-20261122",readText:()=>content};
  t2("S4 E2E exact file accepted: "+file,[file],[],ctx);
  t2("S4 E2E altered file rejected: "+file,[file],[file],{...ctx,readText:()=>content+"\n-- unsafe"});
  t2("S4 E2E wrong branch rejected: "+file,[file],[file],{...ctx,headBranch:"main"});
  t2("S4 E2E no context rejected: "+file,[file],[file],null);
  t2("S4 E2E no unrelated SQL/SW exemption: "+file,[illicit,sw],[illicit,sw],ctx);
}
const s4 = [
  ["supabase/migrations/20261122075009_pec_s4_ccf_pr_preview_readonly.sql", "2aeee1b1c4e1749d59aef3b4f8ec29e16c315f5e9babb7c8853cea58d8c58823"],
  ["supabase/migrations/20261122075447_pec_s4_ccf_apply_draft_line_guarded.sql", "818a672522542a12d651847b3af34ca58457dd299ce43d681214df9811134f5a"],
];
for (const [file, expectedSha] of s4) {
  const pin = REVIEWED_SERVER_MIGRATIONS[file];
  assert.deepEqual(pin, { sha256: expectedSha, heads: ["feat/pec-s4-ccf-preview-20261122"] });
  const content = fs.readFileSync(file, "utf8");
  assert.equal(createHash("sha256").update(content.replace(/\r\n/g, "\n")).digest("hex"), expectedSha);
  const context = { headBranch: "feat/pec-s4-ccf-preview-20261122", readText: () => content };
  t2("S4 exact registered payload accepted only on reviewed branch: " + file, [file], [], context);
  t2("S4 modified payload rejected: " + file, [file], [file], { ...context, readText: () => content + "\n-- altered" });
  t2("S4 unrelated branch rejected: " + file, [file], [file], { ...context, headBranch: "main" });
  t2("S4 no context rejected: " + file, [file], [file], null);
  t2("S4 does not exempt arbitrary SQL/SW: " + file, [illicit, sw], [illicit, sw], context);
}
// Owner-approved WP10 Phase 1: exact applied payloads on one server lane, not a general SQL exception.
const wp10 = [
  ["supabase/migrations/20261116022440_wp10_g2_01_clock_and_batch_size_contract.sql", "0077b90fffbf9bd9c770ab55b85e81e8110d1c6c0a8a17135ba71bee4620dab3"],
  ["supabase/migrations/20261116022501_wp10_g2_02_essential_states_and_boundaries.sql", "ef4cd91f693c220a614db3f7640afb301126b47626cde93e792b393b27c74b31"],
  ["supabase/migrations/20261116022517_wp10_g2_03_operational_expiry_horizon_rpc.sql", "dea309c07d0ff6726b04d9ed4d56e190c6d2afda9628a06996df133e7dfb0ce5"],
  ["supabase/migrations/20261116022528_wp10_g2_06_subgroup_impact_preview.sql", "abb291fe26bce9ac2618eca5325b4cb82392a262d895585e87b9746cc8f9217f"],
];
for (const [file, expectedSha] of wp10) {
  const pin = REVIEWED_SERVER_MIGRATIONS[file];
  assert.deepEqual(pin, { sha256: expectedSha, heads: ["server/wp10-g2-read-only-phase1"] });
  const content = fs.readFileSync(file, "utf8");
  assert.equal(createHash("sha256").update(content.replace(/\r\n/g, "\n")).digest("hex"), expectedSha);
  const context = { headBranch: "server/wp10-g2-read-only-phase1", readText: () => content };
  t2("WP10 exact payload accepted only on its server lane: " + file, [file], [], context);
  t2("WP10 changed payload rejected: " + file, [file], [file], { ...context, readText: () => content + "\n-- changed" });
  t2("WP10 other branch rejected: " + file, [file], [file], { ...context, headBranch: "main" });
  t2("WP10 missing context rejected: " + file, [file], [file], null);
  t2("WP10 entry grants no unrelated SQL/SW exception: " + file, [illicit, sw], [illicit, sw], context);
}
// Issue #502: additive JIT MRP route migration, exact path + branch + LF SHA-256 only.
{
  const file = "supabase/migrations/20261122153109_pec_jit_mrp_route_plan_and_generator.sql";
  const content = fs.readFileSync(file, "utf8");
  const sha = createHash("sha256").update(content.replace(/\r\n/g, "\n")).digest("hex");
  assert.deepEqual(REVIEWED_SERVER_MIGRATIONS[file], { sha256: sha, heads: ["feat/pec-jit-route-server-20261122"] });
  const context = { headBranch: "feat/pec-jit-route-server-20261122", readText: () => content };
  t2("JIT route payload accepted only on its server branch", [file], [], context);
  t2("JIT route modified payload rejected", [file], [file], { ...context, readText: () => content + "\n-- altered" });
  t2("JIT route other branch rejected", [file], [file], { ...context, headBranch: "main" });
  t2("JIT route client descendant branch rejected", [file], [file], { ...context, headBranch: "feat/pec-jit-route-client-20261122" });
  t2("JIT route missing context rejected", [file], [file], null);
  t2("JIT route entry grants no unrelated SQL/SW exception", [illicit, sw], [illicit, sw], context);
}
assert.deepEqual(Object.keys(REVIEWED_SERVER_MIGRATIONS), ["supabase/migrations/20261122153109_pec_jit_mrp_route_plan_and_generator.sql", ...s4horizonguard.map(([file]) => file), ...s4uomguard.map(([file]) => file), ...s4retired.map(([file]) => file), ...s4compat.map(([file]) => file), ...s4e2e.map(([file]) => file), ...s4.map(([file]) => file), ...wp10.map(([file]) => file), addLine, sw, ...r10, r2fix, sec400], "exact five registered S4 payloads, four WP10 payloads and unchanged legacy server/SW pins");

console.log(`pec-protected-path-guard: ${passed}/${passed} PASS`);
