// WP05-W506-SEC-FIX-02 -- static (no database) checks of the Close-writer migration, rollback, runner and snapshot.
// Run: node --test scripts/costing-w506-sec-fix-02/migration-static.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MIG_NAME = "20261109050000_wp05_w506_sec_fix_02_staff_classification_close_writer_guard.sql";
const rd = (p) => readFileSync(join(root, p), "utf8");
const mig = rd(`supabase/migrations/${MIG_NAME}`);
const rb = rd("docs/master-data-costing/prepared/WP05_W506_SEC_FIX_02_ROLLBACK.sql");
const live = rd("supabase/tests/w506_sec_fix_02/run_live_equivalent.sh");
const snap = rd("supabase/tests/w506_sec_fix_02/live_close_definition_snapshot_20261109.sql");
const scaffold = rd("supabase/tests/w506_sec_fix_02/live_scaffold.sql");
const code = (s) => s.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
const nc = (t) => t.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n");
const INTERNAL_DEF_FP = "1c9884c0ca0321eda6055feaa6bd64de";
const WRAPPER_DEF_FP = "a8254681b64a6e78b59f1d2b00d9a7df";
const PREFIX_MD5 = "255b487148e29e51fa841048e8d248c9";
const fnBlock = (s) => s.match(/create or replace function pg_temp\.w506_close_guard_patch[\s\S]*?\$f\$;/)?.[0];

test("migration version sorts after every other migration and is unique", () => {
  const names = readdirSync(join(root, "supabase/migrations")).filter((n) => n.endsWith(".sql")).sort();
  assert.equal(names[names.length - 1], MIG_NAME);
  assert.equal(names.filter((n) => n.startsWith(MIG_NAME.slice(0, 14))).length, 1);
});
test("runner-compatible framing: NO top-level transaction control; one persistent-change DO statement; helper visibility check", () => {
  for (const t of [mig, rb]) {
    assert.ok(!/^\s*(begin|commit|rollback|start\s+transaction|savepoint\b[^;]*)\s*;/im.test(code(t)), "no top-level transaction statements");
    assert.equal((code(t).match(/^do \$(migration|rollback)\$/gm) || []).length, 1, "exactly one DO statement");
    assert.ok(t.includes("temporary patch helper is not visible on this connection"));
    assert.ok(t.includes("to_regprocedure('pg_temp.w506_close_guard_patch(text,integer,text)') is null"));
    assert.ok(t.includes("Transaction management: this file deliberately contains NO top-level BEGIN/COMMIT"));
  }
  assert.equal((code(mig).match(/\bexecute v_new_def\b/g) || []).length, 1);
});
test("exact guard statement: CBM module, can_edit required, schema-qualified; same policy as PR #254", () => {
  assert.ok(mig.includes("perform public.require_permission(''module:cost-build-manager'', true);"));
  assert.ok(!/require_permission\([^)]*false/i.test(code(mig)));
  assert.ok(!/service_role|auth\.uid|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(code(mig)), "no identity hard-coded, no service-role bypass");
});
test("targets the Close writer only (no Save writer references)", () => {
  assert.ok(!/rpc_set_staff/.test(mig + rb));
  assert.ok(code(mig).includes("to_regprocedure('costing.rpc_close_staff_costing_classification(bigint,date,text)')"));
  assert.ok(code(mig).includes("to_regprocedure('public.rpc_close_staff_costing_classification(bigint,date,text)')"));
});
test("preconditions use FULL-DEFINITION md5 only; wrapper mismatch is an EXCEPTION", () => {
  assert.ok(mig.includes(`c_internal_def_fp constant text := '${INTERNAL_DEF_FP}'`));
  assert.ok(mig.includes(`c_wrapper_def_fp  constant text := '${WRAPPER_DEF_FP}'`));
  const c = code(mig);
  assert.ok(!/ or md5\(/i.test(c) && !/raise warning/i.test(c));
  assert.match(c, /md5\(v_wrap_pre\) <> c_wrapper_def_fp then\s+raise exception/);
  assert.match(c, /v_n <> 1 then/);
});
test("idempotent path verifies original+insertion; post-install proofs present", () => {
  const c = code(mig);
  const before = c.slice(0, c.indexOf("verified as already guarded"));
  assert.ok(before.includes("md5(v_orig_def) <> c_internal_def_fp"));
  assert.ok(before.includes("pg_temp.w506_close_guard_patch(v_orig_src, c_live_prefix_len, c_live_prefix_md5) <> v_src"));
  assert.ok(mig.includes("installed definition minus the guard does not hash to the verified original"));
  assert.ok(mig.includes("wrapper definition changed during migration"));
});
test("exact declaration-prefix proof with the Close prefix values (174 / md5), generic strict fallback", () => {
  for (const t of [mig, rb]) {
    assert.match(t, /c_live_prefix_len\s+constant int\s+:= 174;/);
    assert.ok(t.includes(`'${PREFIX_MD5}'`));
  }
  const f = fnBlock(mig);
  assert.ok(f && f.includes("v_pos = p_prefix_len + 1 and md5(substr(p_src, 1, p_prefix_len)) = p_prefix_md5"));
  for (const frag of ["no BEGIN followed by whitespace", "comment, quote or label", "unexpected text before the first BEGIN", "single pure insertion"])
    assert.ok(f.includes(frag), `missing: ${frag}`);
  const c = code(mig);
  assert.ok(c.indexOf("if md5(v_def) <> c_internal_def_fp then") < c.indexOf("v_patched := pg_temp.w506_close_guard_patch"));
});
test("live prefix reconstructs to 174 bytes and md5 255b4871... (CRLF; trailing LF belongs to the BEGIN separator)", () => {
  const lines = ["declare", "  v_effective_to date := coalesce(p_effective_to, current_date);",
    "  v_remarks text := nullif(trim(p_remarks), '');", "  v_staff_id bigint;", "  v_effective_from date;"];
  const full = "\r\n" + lines.join("\r\n") + "\r\n";
  const prefix = full.slice(0, -1);
  assert.equal(Buffer.byteLength(prefix), 174);
  assert.equal(createHash("md5").update(prefix).digest("hex"), PREFIX_MD5);
  for (const l of lines.slice(1)) assert.ok(snap.includes(l.replace(/\r/g, "")));
});
test("no privilege/ownership changes; only the temp helper function is created", () => {
  const c = code(mig).toLowerCase();
  for (const bad of [/\bgrant\b/, /\brevoke\b/, /\bdrop\b/, /\balter\b/, /update\s+costing\./, /insert\s+into\s+costing\./])
    assert.ok(!bad.test(c), `forbidden construct ${bad}`);
  assert.deepEqual(c.match(/create\s+(or\s+replace\s+)?function\s+[\w.]+/g) || [], ["create or replace function pg_temp.w506_close_guard_patch"]);
  assert.equal((c.match(/\bexecute v_new_def\b/g) || []).length, 1);
});
test("rollback: identical helper, separate owner emergency interlock, exact-original proof, wrapper check, regression warning", () => {
  assert.equal(fnBlock(rb), fnBlock(mig));
  for (const frag of ["SECURITY REGRESSION", "Containment-first", "w506.close_rollback_owner_emergency_approval", INTERNAL_DEF_FP, WRAPPER_DEF_FP,
    "md5(v_orig_def) <> c_internal_def_fp", "w506_close_guard_patch(v_orig_src, c_live_prefix_len, c_live_prefix_md5) <> v_src", "public wrapper definition differs"])
    assert.ok(rb.includes(frag), `rollback missing: ${frag}`);
  assert.ok(!/\bgrant\b|\brevoke\b|\bdrop\b/i.test(code(rb)));
});
test("live-equivalent runner: no sed / fingerprint substitution, unchanged files, disposable-cluster interlocks", () => {
  const c = nc(live);
  assert.ok(!/\bsed\b/.test(c));
  assert.ok(c.includes('q -f "$MIG"') && c.includes('cat "$RB"') && c.includes('-v W506_CLOSE_LOCAL_ONLY=1 -f "$SNAP"'));
  for (const fp of [INTERNAL_DEF_FP, WRAPPER_DEF_FP, PREFIX_MD5]) assert.ok(live.includes(fp));
  assert.ok(c.includes('case "${PGHOST:-}" in /*)') && c.includes("w506-disposable-") && c.includes("rolsuper"));
  assert.ok(c.includes("mktemp -d") && c.includes("trap cleanup EXIT") && c.includes("w506_close_live_$(date +%s)_$$"));
  assert.ok(!/drop database if exists/i.test(c));
});
test("snapshot: outside supabase/migrations, local-only interlock, unguarded originals with the recorded fingerprints", () => {
  assert.ok(!readdirSync(join(root, "supabase/migrations")).some((n) => /live_close_definition_snapshot/i.test(n)));
  assert.ok(snap.includes("W506_CLOSE_LOCAL_ONLY") && snap.includes("\\quit 3"));
  assert.ok(!/require_permission/.test(snap));
  assert.ok(snap.includes(INTERNAL_DEF_FP) && snap.includes(WRAPPER_DEF_FP) && snap.includes(PREFIX_MD5));
});
test("scaffold uses synthetic rows only", () => {
  assert.ok(scaffold.includes("SYNTHETIC") && scaffold.includes("SYN-001") && !/pg_dump|copy /i.test(scaffold));
});
