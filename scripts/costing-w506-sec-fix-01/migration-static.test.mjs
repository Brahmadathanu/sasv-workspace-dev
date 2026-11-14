// WP05-W506-SEC-FIX-01 -- static (no database) checks of the proposed migration, rollback and local runner.
// Run: node --test scripts/costing-w506-sec-fix-01/migration-static.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MIG_NAME = "20261109105557_wp05_w506_sec_fix_01_staff_classification_writer_guard.sql";
const rd = (p) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n"); // LF-normalised so CRLF checkouts judge the same text
const mig = rd(`supabase/migrations/${MIG_NAME}`);
const rb = rd("docs/master-data-costing/prepared/WP05_W506_SEC_FIX_01_ROLLBACK.sql");
const runner = rd("supabase/tests/w506_sec_fix_01/run_local.sh");
const code = (s) => s.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
const INTERNAL_DEF_FP = "553d103a5afedda3191c1aa62c33be7c";
const WRAPPER_DEF_FP = "6ba709477ecc7755fb6005b6e2203a2b";
const fnBlock = (s) => s.match(/create or replace function pg_temp\.w506_guard_patch[\s\S]*?\$f\$;/)?.[0];

test("applied migration version is unique, follows the live baseline and coexists in Save-then-Close order", () => {
  const names = readdirSync(join(root, "supabase/migrations")).filter((n) => n.endsWith(".sql")).sort();
  assert.ok(names.includes(MIG_NAME), "expected applied migration filename present");
  assert.ok(MIG_NAME > "20261108165005_", "applied migration must postdate verified baseline");
  assert.equal(names.filter((n) => n.startsWith(MIG_NAME.slice(0, 14))).length, 1);
  const paired = "20261109105717_wp05_w506_sec_fix_02_staff_classification_close_writer_guard.sql";
  if (names.includes(paired)) assert.ok("20261109105557_wp05_w506_sec_fix_01_staff_classification_writer_guard.sql" < "20261109105717_wp05_w506_sec_fix_02_staff_classification_close_writer_guard.sql", "Save migration must sort before Close");
});
test("runner-compatible framing: NO top-level transaction control; one persistent-change DO statement; helper visibility check", () => {
  for (const t of [mig, rb]) {
    assert.ok(!/^\s*(begin|commit|rollback|start\s+transaction|savepoint\b[^;]*)\s*;/im.test(code(t)), "no top-level transaction statements");
    assert.equal((code(t).match(/^do \$(migration|rollback)\$/gm) || []).length, 1, "exactly one DO statement");
    assert.ok(t.includes("temporary patch helper is not visible on this connection"));
    assert.ok(t.includes("to_regprocedure('pg_temp.w506_guard_patch(text,integer,text)') is null"));
    assert.ok(t.includes("Transaction management: this file deliberately contains NO top-level BEGIN/COMMIT"));
  }
  assert.equal((code(mig).match(/\bexecute v_new_def\b/g) || []).length, 1);
});
test("exact guard statement: CBM module, can_edit required, schema-qualified", () => {
  assert.ok(mig.includes("perform public.require_permission(''module:cost-build-manager'', true);"));
  assert.ok(!/require_permission\([^)]*false/i.test(code(mig)));
});
test("preconditions use FULL-DEFINITION md5 only (no prosrc alternative) for internal and wrapper", () => {
  assert.ok(mig.includes(`c_internal_def_fp constant text := '${INTERNAL_DEF_FP}'`));
  assert.ok(mig.includes(`c_wrapper_def_fp  constant text := '${WRAPPER_DEF_FP}'`));
  const c = code(mig);
  assert.ok(!/md5\(\s*v_src\s*\)\s*<>|md5\(\s*\(?select prosrc/i.test(c), "no md5(prosrc) precondition");
  assert.ok(!/ or md5\(/i.test(c), "no OR-of-fingerprints branch");
  assert.ok(!/prosrc md5|md5\(prosrc\)\s*=\s*'/i.test(c));
});
test("wrapper mismatch is an EXCEPTION, never a warning; exact regprocedure lookups; single overload", () => {
  const c = code(mig);
  assert.ok(!/raise warning/i.test(c));
  assert.match(c, /md5\(v_wrap_pre\) <> c_wrapper_def_fp then\s+raise exception/);
  assert.ok(c.includes("to_regprocedure('costing.rpc_set_staff_costing_classification(bigint,text,text,date,numeric,text)')"));
  assert.ok(c.includes("to_regprocedure('public.rpc_set_staff_costing_classification(bigint,text,text,date,numeric,text)')"));
  assert.match(c, /v_n <> 1 then/);
});
test("idempotent path verifies original+insertion (no early return on guard text alone)", () => {
  const c = code(mig);
  const idx = c.indexOf("verified as already guarded");
  const before = c.slice(0, idx);
  assert.ok(before.includes("md5(v_orig_def) <> c_internal_def_fp"));
  assert.ok(before.includes("pg_temp.w506_guard_patch(v_orig_src, c_live_prefix_len, c_live_prefix_md5) <> v_src"));
  assert.ok(!/if position\(c_guard in v_src\) > 0/.test(c));
});
test("post-install proof: definition minus guard hashes to original; wrapper hash re-checked", () => {
  assert.ok(mig.includes("installed definition minus the guard does not hash to the verified original"));
  assert.ok(mig.includes("wrapper definition changed during migration"));
});
test("shape validation present (DECLARE-only prefix, no comments/quotes/labels, single pure insertion)", () => {
  const f = fnBlock(mig);
  assert.ok(f, "patch function present");
  for (const frag of ["no BEGIN followed by whitespace", "comment, quote or label", "unexpected text before the first BEGIN", "single pure insertion"])
    assert.ok(f.includes(frag), `missing: ${frag}`);
});
test("no privilege/ownership changes; only the temp helper function is created; no function body copied", () => {
  const c = code(mig).toLowerCase();
  for (const bad of [/\bgrant\b/, /\brevoke\b/, /\bdrop\b/, /\balter\b/, /update\s+costing\./, /insert\s+into\s+costing\./])
    assert.ok(!bad.test(c), `forbidden construct ${bad}`);
  const creates = c.match(/create\s+(or\s+replace\s+)?function\s+[\w.]+/g) || [];
  assert.deepEqual(creates, ["create or replace function pg_temp.w506_guard_patch"]);
  assert.equal((c.match(/\bexecute v_new_def\b/g) || []).length, 1);
});
test("rollback: identical patch helper, owner emergency interlock, exact-original proof, wrapper check, security-regression warning", () => {
  assert.equal(fnBlock(rb), fnBlock(mig), "patch helper must be byte-identical in migration and rollback");
  assert.ok(rb.includes("SECURITY REGRESSION"));
  assert.ok(rb.includes("Containment-first"));
  assert.ok(rb.includes("w506.rollback_owner_emergency_approval"));
  assert.ok(rb.includes(INTERNAL_DEF_FP) && rb.includes(WRAPPER_DEF_FP));
  for (const frag of ["md5(v_orig_def) <> c_internal_def_fp", "w506_guard_patch(v_orig_src, c_live_prefix_len, c_live_prefix_md5) <> v_src", "public wrapper definition differs"])
    assert.ok(rb.includes(frag), `rollback missing: ${frag}`);
  assert.ok(!/\bgrant\b|\brevoke\b|\bdrop\b/i.test(code(rb)));
});
test("local runner safety: socket-only host, disposable-cluster marker, unique scratch DB, no DROP IF EXISTS, mktemp + trap", () => {
  assert.ok(runner.includes('case "${PGHOST:-}" in /*)'));
  assert.ok(runner.includes("w506-disposable-"));
  assert.ok(runner.includes("rolsuper"));
  assert.ok(runner.includes('mktemp -d'));
  assert.ok(runner.includes("trap cleanup EXIT"));
  assert.ok(runner.includes("w506_scratch_$(date +%s)_$$"));
  assert.ok(!/drop database if exists/i.test(runner.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n")));
  assert.ok(!/localhost|127\.0\.0\.1/.test(runner.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n")));
  assert.ok(!/\/tmp\/w506_/.test(runner), "no fixed /tmp file names");
  assert.match(runner, /CREATED=1/);
  assert.match(runner, /\[ "\$CREATED" = 1 \]/);
});

test("exact live declaration-prefix proof (no per-initialiser quote exceptions)", () => {
  const f = fnBlock(mig);
  assert.ok(f.includes("p_prefix_len int, p_prefix_md5 text"));
  assert.ok(f.includes("v_pos = p_prefix_len + 1 and md5(substr(p_src, 1, p_prefix_len)) = p_prefix_md5"));
  // no individual initialiser allowances survive
  for (const bad of ["c_live_decls", "v_costing_class", "v_allocation_pool", "v_remarks", "regexp_matches", "foreach"])
    assert.ok(!f.includes(bad), `helper must not contain ${bad}`);
  // generic strict path still rejects comments/quotes/dollar quotes/labels and unexpected leading text
  assert.ok(f.includes("if v_before ~ '(--|/\\*|\\$|<<|'')'"));
  assert.ok(f.includes("unexpected text before the first BEGIN"));
  // verified live values appear in migration and rollback
  for (const text of [mig, rb]) {
    assert.match(text, /c_live_prefix_len\s+constant int\s+:= 507;/);
    assert.match(text, /c_live_prefix_md5\s+constant text\s+:= '22d200f39da7adbe3fc92a1caa32ac66';/);
    assert.ok(text.includes("w506_guard_patch(v_src, c_live_prefix_len, c_live_prefix_md5)") || text.includes("w506_guard_patch(v_orig_src, c_live_prefix_len, c_live_prefix_md5)"));
  }
  // helper only called after the full-definition fingerprint has been established
  const c = code(mig);
  assert.ok(c.indexOf("md5(v_orig_def) <> c_internal_def_fp") < c.indexOf("w506_guard_patch(v_orig_src"));
  assert.ok(c.indexOf("if md5(v_def) <> c_internal_def_fp then") < c.indexOf("v_patched := pg_temp.w506_guard_patch"));
});
test("live prefix reconstructs to length 507 and md5 22d200f3... (CRLF; trailing LF belongs to the BEGIN separator)", () => {
  const lines = ["declare", "  v_staff_id bigint := p_staff_id;",
    "  v_costing_class text := upper(nullif(trim(p_costing_class), ''));",
    "  v_allocation_pool text := upper(nullif(trim(p_allocation_pool), ''));",
    "  v_effective_from date := coalesce(p_effective_from, date_trunc('month', current_date)::date);",
    "  v_allocation_weight numeric := coalesce(p_allocation_weight, 1);",
    "  v_remarks text := nullif(trim(p_remarks), '');",
    "  v_default_pool text;", "  v_existing_id bigint;", "  v_existing_effective_from date;", "  v_new_id bigint;"];
  const full = "\r\n" + lines.join("\r\n") + "\r\n";       // 508 bytes: ends CRLF, the LF is consumed by the BEGIN match
  const prefix = full.slice(0, -1);                              // 507 bytes: ends with CR
  assert.equal(Buffer.byteLength(prefix), 507);
  assert.equal(createHash("md5").update(prefix).digest("hex"), "22d200f39da7adbe3fc92a1caa32ac66");
  const fx = rd("supabase/tests/w506_sec_fix_01/fixture.sql");
  for (const l of lines) assert.ok(fx.includes(l), `fixture missing prefix line: ${l}`);
  assert.ok(fx.includes("22d200f39da7adbe3fc92a1caa32ac66") && fx.includes("<> 507"));
  assert.ok(fx.includes("E'\\n', E'\\r\\n'"), "fixture converts the body to CRLF");
});

const live = rd("supabase/tests/w506_sec_fix_01/run_live_equivalent.sh");
const snap = rd("supabase/tests/w506_sec_fix_01/live_definition_snapshot_20261109.sql");
const nc = (t) => t.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n");
test("live-equivalent runner: no substitution of fingerprints/constants, unchanged migration/rollback/snapshot files", () => {
  const c = nc(live);
  assert.ok(!/\bsed\b/.test(c), "no sed anywhere in the live-equivalent runner");
  assert.ok(!/553d103a5afedda3191c1aa62c33be7c\/|6ba709477ecc7755fb6005b6e2203a2b\//.test(c), "no s/// substitution of fingerprints");
  assert.ok(c.includes('q -f "$MIG"') && c.includes('cat "$RB"') && c.includes('-v W506_LOCAL_ONLY=1 -f "$SNAP"'));
  for (const fp of [INTERNAL_DEF_FP, WRAPPER_DEF_FP, "22d200f39da7adbe3fc92a1caa32ac66"]) assert.ok(live.includes(fp));
  assert.ok(live.includes("STOP"), "stops on definition drift");
});
test("live-equivalent runner: same disposable-cluster interlocks as the synthetic runner", () => {
  const c = nc(live);
  assert.ok(c.includes('case "${PGHOST:-}" in /*)') && c.includes("w506-disposable-") && c.includes("rolsuper"));
  assert.ok(c.includes("mktemp -d") && c.includes("trap cleanup EXIT") && c.includes("w506_live_$(date +%s)_$$"));
  assert.ok(!/drop database if exists/i.test(c));
});
test("snapshot: kept out of supabase/migrations, carries its own local-only interlock, contains unguarded originals only", () => {
  assert.ok(!readdirSync(join(root, "supabase/migrations")).some((n) => /live_definition_snapshot/i.test(n)));
  assert.ok(snap.includes("W506_LOCAL_ONLY") && snap.includes("\\quit 3"));
  assert.ok(!/require_permission/.test(snap), "snapshot is the UNGUARDED original");
  assert.ok(snap.includes(INTERNAL_DEF_FP) && snap.includes(WRAPPER_DEF_FP));
});
test("live scaffold uses synthetic rows/dependencies only", () => {
  const sc = rd("supabase/tests/w506_sec_fix_01/live_scaffold.sql");
  assert.ok(sc.includes("SYNTHETIC") && sc.includes("SYN-001") && !/pg_dump|copy /i.test(sc));
});
