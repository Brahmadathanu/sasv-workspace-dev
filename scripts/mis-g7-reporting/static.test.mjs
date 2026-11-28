// Executive MIS G7 reporting-only boundary guards (no browser, no network).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const sha256 = (b) => createHash("sha256").update(b).digest("hex");
const root = new URL("../../", import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), "utf8");
const exists = (p) => fs.existsSync(new URL(p, root));
const git = (...a) => execFileSync("git", a, { encoding: "utf8", cwd: root });

test("operational UI, hand-off and operational contract are NOT part of the reporting candidate", () => {
  for (const f of ["public/shared/mis-batch-governance.html", "public/shared/js/mis-batch-governance.js", "public/shared/js/mis-governed-handoff.js", "public/shared/js/mis-g7-contract.js", "public/shared/css/sasv-mis-batch-governance.css"])
    assert.equal(exists(f), false, `${f} must live only on the preserved PWL reference branch`);
});

test("existing logging modules and the service worker are byte-identical to main (no change, no hand-off hooks)", { skip: (() => { try { git("rev-parse", "origin/main"); return false; } catch { return "origin/main unavailable"; } })() }, () => {
  for (const f of ["js/log-add.js", "js/log-edit.js", "public/sw.js", "package.json"]) {
    if (f === "package.json") continue;                                       // version is bumped only by the separate release commit
    assert.equal(git("diff", "--stat", "origin/main", "--", f).trim(), "", `${f} must be unchanged`);
  }
  for (const f of ["js/log-add.js", "js/log-edit.js"]) assert.doesNotMatch(read(f), /mis-governed-handoff|mis_sign_batch_stage|mis_pack_fg_bulk/);
});

test("reporting client is read-only: no writer RPC, no table write, no service role, no private schema, no operational link or module id", () => {
  const files = { report: read("public/shared/js/mis-evidence-report.js"), dash: read("public/shared/js/executive-mis-dashboard.js"), html: read("public/shared/executive-mis-dashboard.html") };
  for (const [n, src] of Object.entries(files)) {
    assert.doesNotMatch(src, /\.(insert|upsert|delete)\(\s*[\[{"'`]|\.update\(\s*\{/, `${n}: table write`);
    assert.doesNotMatch(src, /service_role|SERVICE_ROLE|app_private|\.schema\(/, `${n}: privileged access`);
    assert.doesNotMatch(src, /mis_sign_batch_stage_v1|mis_correct_batch_stage_v1|mis_pack_fg_bulk_v1|mis_correct_pack_line_v1|mis_g7_set_enforcement_v1|mis_g7_record_core_migration_acceptance_v1|fn_fg_/, `${n}: operational RPC`);
    assert.doesNotMatch(src, /mis-batch-governance|mis-governed-handoff|mis-g7-contract/, `${n}: operational route/module reference`);
  }
  assert.deepEqual([...files.report.matchAll(/["'](mis_[a-z0-9_]+_v1)["']/g)].map((m) => m[1]), ["mis_get_governance_exception_summary_v1"]);
  assert.doesNotMatch(files.report, /module:[a-z-]+/, "no permission target is introduced or assigned by the client");
});

test("dashboard cache keys are bumped so installed PWAs never pair new HTML with the cached old script (service worker untouched)", () => {
  const html = read("public/shared/executive-mis-dashboard.html"); assert.match(html, /executive-mis-dashboard\.js\?mis-c1=ei-r8-kyc-3/);
  assert.match(read("public/shared/js/executive-mis-dashboard.js"), /from "\.\/mis-evidence-report\.js\?mis-g7r=1"/);
  assert.match(read("public/shared/js/executive-mis-dashboard.js"), /from "\.\/executive-intelligence-model\.js\?ei-r8=3"/);
});

test("theme: reporting CSS additions use semantic tokens only", () => {
  const html = read("public/shared/executive-mis-dashboard.html"); const block = html.slice(html.indexOf("MIS G7: production evidence status"), html.indexOf("html,\n      body {"));
  assert.ok(block.includes(".mis-gov-table")); assert.doesNotMatch(block, /#[0-9a-fA-F]{3,8}\b|rgba?\(/); assert.match(block, /max-width: 520px/);
});

test("all eleven G7 migrations are LIVE with registered versions; none pending; installed files carry recorded hashes; none was edited or renamed", () => {
  const man = JSON.parse(read("docs/executive-mis-g7-server/MIGRATION_IDENTITIES.json")); assert.equal(man.migrations.length, 11); assert.deepEqual(man.pending_migrations, []);
  assert.deepEqual(man.migrations.slice(8).map((m) => [m.repo_file.slice(0, 14), m.registered_version]), [["20261124120000", "20261124125626"], ["20261124121000", "20261124125644"], ["20261124122000", "20261124125704"]]);
  for (const m of man.migrations) { const b = fs.readFileSync(new URL(`supabase/migrations/${m.repo_file}`, root)); assert.equal(sha256(b), m.sha256, m.repo_file); assert.equal(b.length, m.bytes); assert.match(m.status, /^LIVE/); assert.match(m.registered_version, /^\d{14}$/); }
  assert.match(read("docs/executive-mis-g7-server/CLIENT_PERMISSION_REGISTRY_PROPOSAL_NOT_APPLIED.sql"), /APPLIED IN PRODUCTION/);
});

test("registry proposal is outside supabase/migrations and assigns no user", () => {
  const sql = read("docs/executive-mis-g7-server/CLIENT_PERMISSION_REGISTRY_PROPOSAL_NOT_APPLIED.sql");
  assert.doesNotMatch(sql.replace(/^\s*--.*$/gm, ""), /(insert\s+into|update|delete\s+from)\s+public\.user_permissions/i);
  assert.ok(!fs.readdirSync(new URL("supabase/migrations/", root)).some((f) => /mis_g7_client|permission_registry|registry_dormancy/.test(f)));
});

test("WP10 / PEC guard approved-delta is narrow: exact content on the MIS branch only; edits, other branches, renames, the service worker and other migrations stay rejected", async () => {
  const { rejectedProtectedPaths, REVIEWED_MIS_G7_FILES } = await import("../lib/pec-protected-path-guard.mjs");
  const HEAD = "claude/executive-mis-g7-client-dmijyz", mig = "supabase/migrations/20261124122000_mis_g7_s7c_governed_previews_and_exception_summary.sql";
  const ctx = (branch, text) => ({ headBranch: branch, readText: () => text });
  const ok = read(mig);
  assert.equal(Object.keys(REVIEWED_MIS_G7_FILES).filter((f) => f.startsWith("supabase/migrations/")).length, 11);
  assert.deepEqual(rejectedProtectedPaths([mig], false, ctx(HEAD, ok)), []);
  assert.deepEqual(rejectedProtectedPaths([mig], false, ctx(HEAD, ok + "\n-- edit")), [mig], "one-byte edit rejected");
  assert.deepEqual(rejectedProtectedPaths([mig], false, ctx("claude/other", ok)), [mig], "other branch rejected");
  assert.deepEqual(rejectedProtectedPaths([mig], false, null), [mig], "no context rejected");
  assert.deepEqual(rejectedProtectedPaths(["supabase/migrations/20261124999999_renamed_copy.sql"], false, ctx(HEAD, ok)), ["supabase/migrations/20261124999999_renamed_copy.sql"]);
  assert.deepEqual(rejectedProtectedPaths(["public/sw.js"], false, ctx(HEAD, "x")), ["public/sw.js"], "service worker stays protected");
});
