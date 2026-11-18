// WP10 four-master Stage A reconciliation: static / source-governance checks (no database). Run: node --test scripts/wp10-four-master-stage-a/reconciliation-governance.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { REVIEWED_SERVER_MIGRATIONS, rejectedProtectedPaths } from "../lib/pec-protected-path-guard.mjs";
import { root, MIGRATION as MIG } from "./fixture.mjs";

const VERSION = "20261118161406";
// quoted from the PR #477 reconciliation document (read-only production observation, NOT re-tested here): latest REGISTERED production version
const PRODUCTION_LATEST_REGISTERED = "20261116143310";
const text = fs.readFileSync(path.join(root, MIG), "utf8");
const sha = (t) => createHash("sha256").update(t.replace(/\r\n/g, "\n")).digest("hex");
const git = (...a) => { try { return execFileSync("git", a, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { return null; } };
const code = text.split("\n").map((l) => l.replace(/--.*$/, "")).join("\n").replace(/\$[a-z0-9_]*\$/g, "").replace(/'(?:[^']|'')*'/g, "''");

test("V1 version is a unique 14-digit CLI-style timestamp, later than every committed migration and than production's latest registered version", () => {
  assert.match(path.basename(MIG), /^\d{14}_wp10_four_master_stage_a_state_reconciliation\.sql$/);
  const versions = fs.readdirSync(path.join(root, "supabase/migrations")).map((f) => f.split("_")[0]);
  assert.equal(versions.filter((v) => v === VERSION).length, 1, "version unique");
  assert.equal(versions.filter((v) => v > VERSION).length, 0, "no committed migration is later");
  assert.ok(VERSION > PRODUCTION_LATEST_REGISTERED);
  assert.equal(new Set(versions).size, versions.length, "all committed versions unique");
  assert.equal(text.includes("\r"), false, "LF only");
});
test("V2 pin: guard entry has the exact path, SHA-256 of the committed file and only the two named heads", () => {
  const pin = REVIEWED_SERVER_MIGRATIONS[MIG];
  assert.ok(pin); assert.equal(pin.sha256, sha(text));
  assert.deepEqual([...pin.heads], ["claude/blissful-mendel-ty92mw", "server/wp10-four-master-stage-a-reconciliation"]);
  const ctx = (over = {}) => ({ headBranch: pin.heads[0], readText: () => text, ...over });
  assert.deepEqual(rejectedProtectedPaths([MIG], false, ctx()), []);
  assert.deepEqual(rejectedProtectedPaths([MIG], false, ctx({ headBranch: "main" })), [MIG]);
  assert.deepEqual(rejectedProtectedPaths([MIG], false, ctx({ readText: () => text + " " })), [MIG]);
  assert.deepEqual(rejectedProtectedPaths([MIG], false, null), [MIG]);
  const sibling = "supabase/migrations/20261118161407_other.sql";
  assert.deepEqual(rejectedProtectedPaths([MIG, sibling, "public/sw.js"], false, ctx()), [sibling, "public/sw.js"], "no wildcard / sibling exemption");
});
test("V3 statements: transactional; no GRANT/REVOKE/TRUNCATE/DROP TABLE/COMMENT/data DML; only the transient temp table is altered; no Stage B", () => {
  assert.match(code, /^\s*begin;/m); assert.match(code, /commit;\s*$/);
  for (const re of [/\bgrant\b/i, /\brevoke\b/i, /\btruncate\b/i, /\bdrop\s+table\b/i, /\bcomment\s+on\b/i, /\bcreate\s+or\s+replace\b/i, /\bcreate\s+(unique\s+)?index\b/i, /\bcreate\s+trigger\b/i, /\balter\s+(function|role|default)\b/i, /\bset\s+role\b/i, /\bsecurity\s+definer\b/i])
    assert.doesNotMatch(code, re, String(re));
  const alters = [...code.matchAll(/\balter\s+table\s+([\w.]+)/gi)].map((m) => m[1]); assert.deepEqual(alters, ["wp10_stage_a_ref"], "only the transient reference table is altered");
  assert.doesNotMatch(code, /\b(insert\s+into|delete\s+from|update)\s+(public\.)?(categories|sub_categories|product_groups|sub_groups)\b/i);
  assert.equal([...code.matchAll(/create temp table/gi)].length, 1); assert.match(code, /on commit drop/);
  assert.match(code, /create temp table wp10_stage_a_ref/);
  for (const fn of ["wp10_pred", "wp10_policy_ddl", "wp10_table_state"]) { assert.match(code, new RegExp(`create function pg_temp\\.${fn}\\b`)); assert.match(code, new RegExp(`drop function pg_temp\\.${fn}\\b`)); }
});
test("V4 security invariants are present in the single predicate template: View AND Edit, own module key, all four write operations; SELECT identity-only", () => {
  assert.match(text, /app_has_permission\(%L, ''view''\)\)\s+and\s+\(select public\.app_has_permission\(%L, ''edit''\)/);
  for (const k of ["categories", "subcategories", "product-groups", "subgroups"]) assert.ok(text.includes(`'module:manage-${k}'`), k);
  for (const op of ["insert", "update", "delete"]) assert.match(text, new RegExp(`for ${op} to authenticated`));
  assert.match(text, /for select to authenticated using \(\(select auth\.uid\(\)\) is not null\)/);
  assert.match(text, /using \(%s\) with check \(%s\)/, "UPDATE has both USING and WITH CHECK");
  assert.match(text, /REFUSED \(state C/); assert.match(text, /STATE B/); assert.match(text, /STATE A/);
});
const base = (() => { const b = git("merge-base", "HEAD", "origin/main"); return b ? b.trim() : null; })();
test("V5 only ONE supabase/migrations path is added vs main; no historical migration (incl. the five PEC files) is modified", { skip: base ? false : "NOT TESTED: origin/main not available (shallow clone)" }, () => {
  const ns = git("diff", "--name-status", base, "HEAD", "--", "supabase").split("\n").filter(Boolean);
  assert.deepEqual(ns, [`A\t${MIG}`]);
  const pec = fs.readdirSync(path.join(root, "supabase/migrations")).filter((f) => /^20261112\d{6}_pec_/.test(f));
  assert.ok(pec.length >= 5); for (const f of pec) assert.equal(git("diff", "--name-only", base, "HEAD", "--", `supabase/migrations/${f}`).trim(), "");
});
test("V6 guard registry: every pre-existing pin is byte-identical to main (only the one new entry added)", { skip: base ? false : "NOT TESTED: origin/main not available (shallow clone)" }, async () => {
  const old = git("show", `${base}:scripts/lib/pec-protected-path-guard.mjs`);
  const mod = await import(`data:text/javascript;base64,${Buffer.from(old).toString("base64")}`);
  const now = { ...REVIEWED_SERVER_MIGRATIONS }; delete now[MIG];
  assert.deepEqual(JSON.parse(JSON.stringify(now)), JSON.parse(JSON.stringify(mod.REVIEWED_SERVER_MIGRATIONS)));
  assert.equal(Object.keys(REVIEWED_SERVER_MIGRATIONS).length, Object.keys(mod.REVIEWED_SERVER_MIGRATIONS).length + 1);
});
test("V7 the already-reviewed original apply script 02 is unchanged and is NOT referenced as a migration; reconciliation never executes it", () => {
  const apply = fs.readFileSync(path.join(root, "docs/master-data-costing/WP10_FOUR_MASTER_STAGE_A_UNAPPLIED_SQL/02_stage_a_apply.sql"), "utf8");
  assert.equal(git("rev-parse", "HEAD:docs/master-data-costing/WP10_FOUR_MASTER_STAGE_A_UNAPPLIED_SQL/02_stage_a_apply.sql")?.trim(), "a2239914fb910fab3142842d02765741c3c90769", "02 blob is the exact owner-applied reviewed blob (git blob a2239914…)");
  assert.ok(apply.includes("drop policy categories_authenticated_crud")); assert.equal(text.includes("categories_authenticated_crud on public.categories"), false);
});
test("V8 the reconciliation package document states the exact version, name and SHA-256 of the committed migration", () => {
  const doc = fs.readFileSync(path.join(root, "docs/master-data-costing/WP10_STAGE_A_MIGRATION_RECONCILIATION_PACKAGE_2026-11-18.md"), "utf8");
  assert.ok(doc.includes(sha(text))); assert.ok(doc.includes(VERSION)); assert.ok(doc.includes("wp10_four_master_stage_a_state_reconciliation"));
  assert.ok(fs.existsSync(path.join(root, "docs/master-data-costing/WP10_STAGE_A_RECONCILIATION_SQL/R1_reconciliation_verify_readonly.sql")));
});
