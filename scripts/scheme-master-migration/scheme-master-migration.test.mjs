// Scheme Master register migration (issue #211 B / PR #213): static, scope and regression checks. No database, no network. NOTHING here applies SQL.
// A missing PostgreSQL is NOT evidence: behaviour is verified by the owner's read-only pre/post packages and the documented apply procedure.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { APPROVED_COSTING_SUPABASE_FILES, costingScopeReport } from "../lib/costing-scope-guard.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const lf = (t) => t.replace(/\r\n/g, "\n");
const read = (rel) => lf(fs.readFileSync(path.join(root, rel), "utf8"));
const sha = (t) => crypto.createHash("sha256").update(t).digest("hex");
const code = (s) => s.split("\n").filter((l) => !/^\s*--/.test(l)).join("\n");
const VERSION = "20261108082334" /* live Supabase migration-history version (issue #211, 8 Nov 2026) */, PREPARED_VERSION = "20261108132312", NAME = "costing_scheme_master_register_viability_lateral";
const MIG = `supabase/migrations/${VERSION}_${NAME}.sql`, ROLL = `supabase/rollback-evidence/${VERSION}_${NAME}_pre.sql`;
const TB2 = "supabase/migrations/20261019134900_tb2_costing_view_permission_gate.sql";
const CAND_COMMIT = "e73e9e2bd716c7e01ae7fef05b31797a615abe7f";
const CAND_PATH = "docs/master-data-costing/scheme-master-perf-candidate/scheme_master_register_viability_lateral.candidate.sql";
const BLOCK_SHA256 = "588385052871d3c2c6ebae6956e73a64b1e4e5e8948d00f888ec20dd864dcfc6";   // sha256 of the reviewed candidate DO block at e73e9e2b
const FINGERPRINT = "a9f6a128427a704e9bea97fc01e7b5f3";                     // live pre-change definition
const POST_FINGERPRINT = "8fdc0306bd2f1efbe0638c7c13ba4dda";                // live post-apply definition (independently recorded)
const mig = read(MIG), block = mig.slice(mig.indexOf("do $apply$")), c = code(mig);
const COLS = ["scheme_id", "scheme_name", "paid_qty", "free_qty", "total_qty", "free_per_paid_ratio", "effective_free_discount_percent", "is_active", "is_system_defined", "remarks", "approval_reference", "direct_policy_count", "active_direct_policy_count", "hierarchy_rule_count", "active_hierarchy_rule_count", "replacement_reference_count", "active_replacement_reference_count", "viability_snapshot_count", "viability_snapshot_period_count", "latest_viability_snapshot_period", "can_edit_metadata", "can_deactivate", "can_reactivate", "created_at", "created_by", "updated_at", "updated_by", "metadata_update_reason", "deactivated_at", "deactivated_by", "deactivation_reason", "reactivated_at", "reactivated_by", "reactivation_reason"];

test("naming and placement follow the repo convention: timestamped file, strictly newest migration, rollback only under rollback-evidence", () => {
  assert.match(path.basename(MIG), /^\d{14}_[a-z0-9_]+\.sql$/);
  const all = fs.readdirSync(path.join(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
  assert.equal(all[all.length - 1], path.basename(MIG), "newest migration, applies last");
  assert.equal(all.filter((f) => /scheme_master/.test(f) && f > "20261108").length, 1, "exactly one Scheme Master migration of this change");
  assert.ok(fs.existsSync(path.join(root, ROLL))); assert.ok(!fs.readdirSync(path.join(root, "supabase/migrations")).some((f) => /_pre\.sql$/.test(f)), "no rollback file among forward migrations");
  assert.ok(fs.existsSync(path.join(root, "supabase/rollback-evidence/20261002064432_rpc_get_product_sku_readiness_pre.sql")), "existing convention still present");
});

test("the migration statement is the reviewed candidate DO block BYTE FOR BYTE (pinned sha256; and equal to the PR #213 blob when that commit is reachable)", () => {
  assert.equal(sha(block), BLOCK_SHA256);
  assert.ok(block.startsWith("do $apply$\ndeclare\n")); assert.ok(block.endsWith("$apply$;\n"));
  let blob = null; try { blob = lf(execFileSync("git", ["show", `${CAND_COMMIT}:${CAND_PATH}`], { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] })); } catch { /* commit not fetched: the pinned hash above still holds */ }
  if (blob) assert.equal(block, blob.slice(blob.indexOf("do $apply$")));
});

test("exact pre-change definition is verified inside the same single statement: fingerprint, 34 names in order, reloptions exactly {security_invoker=true}, gate, 3 references; no sentinel", () => {
  assert.ok(c.includes(`c_expected_md5 constant text := '${FINGERPRINT}';`)); assert.ok(!/UNRECORDED/.test(mig));
  assert.ok(c.includes("c_expected_cols constant text[] := array[" + COLS.map((x) => `'${x}'`).join(", ") + "];"));
  assert.match(c, /md5\(v_def\) <> c_expected_md5 then raise exception/); assert.match(c, /v_opts is distinct from array\['security_invoker=true'\]::text\[\] then raise/);
  assert.match(c, /v_def !~ 'fn_costing_view_allowed' then raise/); assert.match(c, /<> 3 then raise/);
  assert.equal((c.match(/raise exception/g) ?? []).length, 11);
  assert.equal((c.match(/\bdo \$apply\$/g) ?? []).length, 1); assert.equal(c.slice(0, c.indexOf("do $apply$")).trim(), ""); assert.equal(c.slice(c.indexOf("$apply$;") + 8).trim(), "");
  assert.ok(c.indexOf("raise exception 'scheme-master candidate precondition") < c.indexOf("execute $view$") && c.indexOf("execute $view$") < c.indexOf("scheme-master candidate postcondition"));
});

test("no transaction control, lock, grant, DML or other DDL: only the guarded view replacement", () => {
  assert.doesNotMatch(c, /\b(commit|rollback|savepoint|pg_sleep)\b|\block\s+table\b|\bset\s+(local|session)\b|\bgrant\b|\brevoke\b|\binsert\s+into\b|\bupdate\s+\S+\s+set\b|\bdelete\s+from\b|\btruncate\b|\bdrop\b|\balter\b|\bcreate\s+(table|index|policy|trigger|function|extension)\b/i);
  assert.equal((c.match(/create or replace view/gi) ?? []).length, 1);
  assert.doesNotMatch(c, /\bbegin\s*;/i);
});

test("view contract preserved: security_invoker, one gate, 34 columns, no ORDER BY/LIMIT, three viability columns now from one lateral aggregate (1 table reference)", () => {
  const m = /execute \$view\$\n([\s\S]*?)\n\$view\$;/.exec(block); assert.ok(m); const view = m[1];
  assert.ok(view.startsWith("create or replace view public.v_costing_scheme_master_register with (security_invoker=true) as"));
  assert.ok(view.endsWith("where (select public.fn_costing_view_allowed());")); assert.equal(view.split("fn_costing_view_allowed").length - 1, 1);
  assert.doesNotMatch(code(view), /\bORDER BY\b|\bLIMIT\b|\bOFFSET\b|\bGROUP BY\b/i);
  assert.equal((view.match(/sku_scheme_viability_snapshot/g) ?? []).length, 1); assert.equal((view.match(/LEFT JOIN LATERAL/g) ?? []).length, 1);
  for (const col of COLS) assert.ok(new RegExp(`(AS ${col}\\b|^\\s+${col},?$)`, "m").test(view), col);
  const tb2 = read(TB2), a = tb2.indexOf("create or replace view public.v_costing_scheme_master_register"), b = tb2.indexOf("create or replace view public.v_costing_scheme_policy_rule_register");
  assert.equal((tb2.slice(a, b).match(/sku_scheme_viability_snapshot/g) ?? []).length, 3, "the TB2 source still has the 3 references this migration replaces");
});

test("rollback evidence is the exact TB2 definition (recovery only, single statement, not a forward migration)", () => {
  const r = read(ROLL), tb2 = read(TB2), a = tb2.indexOf("create or replace view public.v_costing_scheme_master_register"), b = tb2.indexOf("create or replace view public.v_costing_scheme_policy_rule_register");
  assert.ok(r.endsWith(tb2.slice(a, b).trim() + "\n")); assert.match(r, /^-- Recovery only\. Do not apply as a forward migration\./);
  assert.equal((code(r).match(/create or replace view/gi) ?? []).length, 1); assert.equal(code(r).replace(tb2.slice(a, b).trim(), "").trim(), "");
  assert.ok(r.includes(FINGERPRINT));
});

test("header records the live apply: version, do-not-rerun, reconciliation, both fingerprints, source commit, rollback file and runbook; comments only", () => {
  const head = mig.slice(0, mig.indexOf("do $apply$"));
  for (const k of [`Applied to live Supabase as migration ${VERSION}`, "ALREADY APPLIED", "supabase db push", `${PREPARED_VERSION}_${NAME}.sql`, CAND_COMMIT, FINGERPRINT, POST_FINGERPRINT, `rollback-evidence/${VERSION}_${NAME}_pre.sql`, "scheme-master-register-migration"]) assert.ok(head.includes(k), k);
  assert.doesNotMatch(head, /PREPARED, NOT APPLIED/); assert.ok(!fs.existsSync(path.join(root, `supabase/migrations/${PREPARED_VERSION}_${NAME}.sql`)), "the prepared-name file no longer exists");
  assert.ok(!fs.existsSync(path.join(root, `supabase/rollback-evidence/${PREPARED_VERSION}_${NAME}_pre.sql`)));
  assert.ok(head.split("\n").every((l) => l === "" || l.startsWith("--")), "everything before the statement is a comment");
});

test("pre/post verification files are read-only (begin read only ... rollback), expect the fingerprint before and a changed definition after, and compare the three columns to an independent recomputation", () => {
  for (const f of ["pre_apply_verification.sql", "post_apply_verification.sql"]) {
    const s = read(`docs/master-data-costing/scheme-master-register-migration/${f}`), x = code(s);
    assert.equal((x.match(/begin read only;/g) ?? []).length, (x.match(/\brollback;/g) ?? []).length); assert.ok((x.match(/begin read only;/g) ?? []).length >= 1);
    assert.doesNotMatch(x, /\bcommit\b|\binsert\s+into\b|\bupdate\s+\S+\s+set\b|\bdelete\s+from\b|\bcreate\s|\bdrop\s|\balter\s|\bgrant\b|\brevoke\b|\btruncate\b/i);
    assert.match(x, /count\(distinct period_start\)/); assert.match(x, /explain \(analyze, buffers, timing off\)/);
  }
  assert.ok(read("docs/master-data-costing/scheme-master-register-migration/pre_apply_verification.sql").includes(`= '${FINGERPRINT}' as fingerprint_matches`));
  const post = read("docs/master-data-costing/scheme-master-register-migration/post_apply_verification.sql");
  assert.ok(post.includes(`<> '${FINGERPRINT}' as fingerprint_changed`)); assert.ok(post.includes(`= '${POST_FINGERPRINT}' as fingerprint_post_apply`)); assert.match(post, /viability_references/); assert.match(post, /<ID_V_UUID>/);
  const readme = read("docs/master-data-costing/scheme-master-register-migration/README.md");
  for (const k of [`APPLIED LIVE 8 Nov 2026 as ${VERSION}`, POST_FINGERPRINT, FINGERPRINT, "Reconciliation", "Rollback", "Apply procedure", "pre_apply_verification.sql", "post_apply_verification.sql", "272.464", "128.035", "128.333", "do not use `supabase db push`".replace("do not", "do not"), "Post-application ID-V"]) assert.ok(readme.includes(k), k);
});

test("scope guard: the two new supabase files are approved by exact path and content hash, nothing else is, and the historical Costing scope report is clean for this change", () => {
  const rels = APPROVED_COSTING_SUPABASE_FILES.map((e) => e.rel).sort(); assert.deepEqual(rels, [MIG, ROLL].sort());
  for (const e of APPROVED_COSTING_SUPABASE_FILES) assert.equal(e.sha256, sha(read(e.rel)), e.rel);
  const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  let base = null; try { base = git("merge-base", "HEAD", "origin/main").trim(); } catch { /* no remote ref in this checkout */ }
  if (base) { const r = costingScopeReport({ git, root, base }); assert.deepEqual(r.supabase, [], JSON.stringify(r.supabase)); assert.deepEqual(r.html, []); assert.deepEqual(r.css, []); assert.deepEqual(r.packageJson, []); }
});

test("no client, flag or production-code change: this change adds no file under public/ and does not touch the service worker", () => {
  const sw = read("public/sw.js"); assert.match(sw, /const CACHE_NAME = "hub-cache-v392"/);
  const flags = read("public/shared/js/costing-feature-flags.js"); assert.match(flags, /export function isCostingLockScreenV1Enabled/);
  const client = read("public/shared/js/costing-suite-pricing-policy.js"); assert.match(client, /costingFrom\("v_costing_scheme_master_register"\)\s*\.select\("\*"\)\s*\.order\("scheme_name", \{ ascending: true \}\)/);
});

test("reconciliation: the applied statement is untouched, the live version is the only version used, and the recovery file body is the unchanged TB2 definition", () => {
  assert.equal(sha(block), BLOCK_SHA256, "executable DO statement byte-identical to what was applied");
  for (const f of ["scripts/lib/costing-scope-guard.mjs", "docs/master-data-costing/scheme-master-register-migration/post_apply_verification.sql", "docs/master-data-costing/scheme-master-register-migration/pre_apply_verification.sql"]) assert.ok(!read(f).includes(PREPARED_VERSION), f + " must not reference the prepared version");
  for (const e of APPROVED_COSTING_SUPABASE_FILES) assert.ok(e.rel.includes(VERSION) && !e.rel.includes(PREPARED_VERSION), e.rel);
  const r = read(ROLL); assert.ok(r.includes(POST_FINGERPRINT) && r.includes(FINGERPRINT)); assert.ok(r.includes(`${VERSION}_${NAME}.sql (APPLIED 8 Nov 2026)`));
});
