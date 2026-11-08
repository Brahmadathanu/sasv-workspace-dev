// Scheme Master performance candidate (#211 B): static contract and regression tests. No database, no network, nothing applied.
// A skipped/missing PostgreSQL is NOT evidence: the behavioural parity is the owner-run read-only package (readback/scheme_master_parity_readonly.sql).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  root, OUT_DIR, TB2_MIGRATION, VIEW, VIEW_HEAD, COLUMNS, CHANGED_COLUMNS, SUBSTITUTIONS, FILES, FINGERPRINT_FILE, FINGERPRINT_UNRECORDED,
  readTb2ViewSql, buildCandidateViewSql, viewBody, candidateSql, rehearsalSql, readFingerprint,
} from "./build.mjs";

const lf = (t) => t.replace(/\r\n/g, "\n");
const dir = path.join(root, OUT_DIR);
const read = (rel) => lf(fs.readFileSync(path.join(dir, rel), "utf8"));
const code = (s) => s.split("\n").filter((l) => !/^\s*--/.test(l)).map((l) => l.replace(/\s--[^'"\n]*$/, "")).join("\n"); // executable text only
const TB2 = readTb2ViewSql(), CAND_VIEW = buildCandidateViewSql();
const GATE = "where (select public.fn_costing_view_allowed());";
const DML_DDL = /\b(insert\s+into|update\s+\S+\s+set|delete\s+from|truncate|drop\s+(view|table|index|function)|alter\s+(table|view|function)|create\s+(table|index|policy|trigger|function|extension)|grant\s|revoke\s|comment\s+on|vacuum|analyze\s+\S+;)/i;
const mask = (t, side) => { let m = t; SUBSTITUTIONS.forEach(([re, to], i) => { m = side === "old" ? m.replace(re, () => `<<S${i}>>\n`.replace(/\n$/, i === 3 ? "\n" : "")) : m.replace(to, () => `<<S${i}>>` + (i === 3 ? "\n" : "")); }); return m; };

test("committed candidate, rollback, parity and rehearsal files are exactly what the generator produces (no hand edits, no drift from TB2)", () => {
  for (const [rel, make] of Object.entries(FILES)) assert.equal(read(rel), lf(make()), rel);
});

test("candidate differs from the TB2 definition ONLY by the four documented substitutions (text outside them is byte-identical)", () => {
  assert.equal(SUBSTITUTIONS.length, 4);
  assert.notEqual(CAND_VIEW, TB2);
  assert.equal(mask(CAND_VIEW + "\n", "new").trimEnd(), mask(TB2 + "\n", "old").trimEnd());
});

test("all 34 output columns keep name and position; exactly the three viability columns change expression; none is added, removed or renamed", () => {
  assert.equal(COLUMNS.length, 34); assert.equal(new Set(COLUMNS).size, 34);
  const topLevelNames = (viewSql) => {
    const s = viewSql.indexOf("SELECT id AS scheme_id") + 7, e = viewSql.indexOf("\n   FROM costing.scheme_master sm");
    let depth = 0, cur = "", parts = []; for (const ch of viewSql.slice(s, e)) { if (ch === "(") depth++; if (ch === ")") depth--; if (ch === "," && depth === 0) { parts.push(cur); cur = ""; } else cur += ch; }
    parts.push(cur); return parts.map((c) => { c = c.trim().replace(/\s+/g, " "); return (/ AS ([a-z_0-9]+)$/i.exec(c) || [0, c])[1]; });
  };
  assert.deepEqual(topLevelNames(TB2), COLUMNS); assert.deepEqual(topLevelNames(CAND_VIEW), COLUMNS);
  assert.deepEqual([...CHANGED_COLUMNS], ["viability_snapshot_count", "viability_snapshot_period_count", "latest_viability_snapshot_period"]);
  for (const c of CHANGED_COLUMNS) assert.equal((CAND_VIEW.match(new RegExp(` AS ${c}\\b`, "g")) ?? []).length, 1, c);
});

test("shape: one per-scheme LEFT JOIN LATERAL aggregate replaces the three viability subqueries (3 table references become 1); count(*), count(DISTINCT), max keep their exact NULL/empty semantics", () => {
  const c = code(CAND_VIEW);
  assert.equal((TB2.match(/sku_scheme_viability_snapshot/g) ?? []).length, 3);
  assert.equal((c.match(/sku_scheme_viability_snapshot/g) ?? []).length, 1);
  assert.equal((c.match(/LEFT JOIN LATERAL/g) ?? []).length, 1);
  assert.doesNotMatch(c, /\bGROUP BY\b/i, "the slower global GROUP BY alternative is deliberately not used");
  assert.match(c, /count\(\*\) AS vs_snapshot_count/); assert.match(c, /count\(DISTINCT s\.period_start\) AS vs_period_count/); assert.match(c, /max\(s\.period_start\) AS vs_latest_period/);
  assert.match(c, /WHERE s\.scheme_id = sm\.id\s+\) viab ON true/, "LEFT JOIN ... ON true keeps schemes without snapshots (0, 0, NULL), exactly like the scalar subqueries");
  assert.doesNotMatch(c, /\bINNER JOIN\b|\bJOIN LATERAL\b(?<!LEFT JOIN LATERAL)/i);
  for (const n of ["vs_snapshot_count", "vs_period_count", "vs_latest_period"]) assert.equal((c.match(new RegExp(`\\b${n}\\b`, "g")) ?? []).length, 2, "defined once, used once");
});

test("security and ordering contracts are untouched: security_invoker, the one permission gate, no ORDER BY, no LIMIT, no new filter", () => {
  for (const v of [TB2, CAND_VIEW]) {
    assert.ok(v.startsWith(VIEW_HEAD)); assert.ok(v.endsWith(GATE)); assert.equal(v.split("fn_costing_view_allowed").length - 1, 1);
    assert.doesNotMatch(code(v), /\bORDER BY\b|\bLIMIT\b|\bOFFSET\b|\bDISTINCT ON\b/i);
  }
  assert.equal((code(CAND_VIEW).match(/\bWHERE\b/g) ?? []).length, (code(TB2).match(/\bWHERE\b/g) ?? []).length - 3 + 1, "three correlated WHEREs removed, one added: the lateral's scheme_id correlation");
  assert.match(code(CAND_VIEW), /select q\.\* from \(/);
});

test("candidate file is ONE atomic DO statement: exact-definition precondition, the CREATE OR REPLACE VIEW and post-conditions share it; nothing outside it; no grants, DML, lock or transaction control", () => {
  const sql = read("scheme_master_register_viability_lateral.candidate.sql"), c = code(sql);
  assert.equal((c.match(/\bdo \$apply\$/g) ?? []).length, 1); assert.equal((c.match(/\$apply\$;/g) ?? []).length, 1);
  const open = c.indexOf("do $apply$"), close = c.indexOf("$apply$;") + "$apply$;".length;
  assert.equal(c.slice(0, open).trim(), "", "no executable statement before the DO block");
  assert.equal(c.slice(close).trim(), "", "no executable statement after the DO block");
  const inner = c.slice(open, close);
  assert.equal((inner.match(/create or replace view/gi) ?? []).length, 1, "the replace is inside the same statement as the checks");
  assert.ok(inner.indexOf("raise exception 'scheme-master candidate precondition") < inner.indexOf("execute $view$"), "preconditions run before the replace");
  assert.ok(inner.indexOf("execute $view$") < inner.indexOf("scheme-master candidate postcondition"), "post-conditions run after it");
  assert.doesNotMatch(c, DML_DDL); assert.doesNotMatch(c, /\bcommit\b|\bbegin\b(?!\s*\n\s*if)|\brollback\b|\block\s+table\b|\bset\s+(local|session)\b|\bsavepoint\b|\bpg_sleep\b/i);
  const m = /execute \$view\$\n([\s\S]*?)\n\$view\$;/.exec(inner); assert.ok(m, "view text is passed to EXECUTE");
  assert.equal(m[1], CAND_VIEW, "the executed view is exactly the reviewed candidate view text");
  assert.match(sql, /NOT APPLIED/); assert.match(sql, /scheme_master_register_rollback_tb2\.sql/);
});

test("exact pre-change definition check: 34 column names in order, reloptions EXACTLY {security_invoker=true}, md5 of pg_get_viewdef(view, true) equals the recorded fingerprint, gate text, 3 references", () => {
  const FP = "0123456789abcdef0123456789abcdef";
  const c = code(candidateSql(FP));
  assert.ok(c.includes("c_expected_md5 constant text := '" + FP + "';")); assert.ok(!c.includes(FINGERPRINT_UNRECORDED));
  assert.match(c, /v_def := pg_get_viewdef\(c_view, true\);/); assert.match(c, /md5\(v_def\) <> c_expected_md5 then raise exception/);
  assert.match(c, /v_cols is distinct from c_expected_cols then raise/);
  assert.ok(c.includes("c_expected_cols constant text[] := array[" + COLUMNS.map((x) => "'" + x + "'").join(", ") + "];"), "all 34 names in order");
  assert.match(c, /v_opts is distinct from array\['security_invoker=true'\]::text\[\] then raise/);
  assert.match(c, /v_def !~ 'fn_costing_view_allowed' then raise/); assert.match(c, /<> 3 then raise/);
  assert.match(c, /v_cols2 is distinct from v_cols or v_types2 is distinct from v_types then raise/); assert.match(c, /v_opts2 is distinct from v_opts then raise/); assert.match(c, /v_acl2 is distinct from v_acl then raise/);
  assert.match(c, /<> 1 or v_def2 !~\* 'LATERAL' then raise/);
  assert.equal((c.match(/raise exception/g) ?? []).length, 11, "1 fingerprint-unrecorded + 5 pre + 5 post conditions");
});

test("fail closed until the live fingerprint is recorded: the committed candidate carries the UNRECORDED sentinel exactly when no fingerprint file exists, and the sentinel can never satisfy the 32-hex guard", () => {
  const file = path.join(dir, FINGERPRINT_FILE), fp = readFingerprint();
  const committed = read("scheme_master_register_viability_lateral.candidate.sql");
  if (!fs.existsSync(file)) { assert.equal(fp, null); assert.match(committed, /c_expected_md5 constant text := 'UNRECORDED';/); }
  else { assert.match(fp, /^[0-9a-f]{32}$/); assert.ok(committed.includes("c_expected_md5 constant text := '" + fp + "';")); assert.ok(!committed.includes("'UNRECORDED'")); }
  assert.ok(!/^[0-9a-f]{32}$/.test(FINGERPRINT_UNRECORDED));
  assert.match(code(candidateSql(null)), /c_expected_md5 !~ '\^\[0-9a-f\]\{32\}\$' then\s+raise exception 'scheme-master candidate: pre-change definition fingerprint is not recorded/);
  for (const bad of ["ABCDEF0123456789abcdef0123456789", "0123456789abcdef0123456789abcde", "x"]) assert.ok(!/^[0-9a-f]{32}$/.test(bad));
});

test("rollback file restores the TB2 definition byte for byte", () => {
  const r = read("scheme_master_register_rollback_tb2.sql"); assert.ok(r.endsWith(TB2 + "\n")); assert.equal((code(r).match(/create or replace view/gi) ?? []).length, 1);
  assert.doesNotMatch(code(r).replace(TB2, ""), DML_DDL); assert.equal(code(r).replace(TB2, "").trim(), "");
});

test("parity package is read-only: every statement block is BEGIN READ ONLY ... ROLLBACK; no commit, DML or DDL; role switches are SET LOCAL only", () => {
  const sql = read("readback/scheme_master_parity_readonly.sql"), c = code(sql);
  const begins = c.match(/begin read only;/g) ?? [], rollbacks = c.match(/\brollback;/g) ?? [];
  assert.equal(begins.length, rollbacks.length); assert.equal(begins.length, 9, "catalog, parity, types/order, 3 permission roles, 2 plans, gate facts");
  assert.equal((c.match(/\bbegin\b/gi) ?? []).length, begins.length, "no other transaction form");
  assert.doesNotMatch(c, /\bcommit\b/i); assert.doesNotMatch(c, DML_DDL);
  assert.doesNotMatch(c, /\bset\s+(?!local\b)(role|session)/i, "no session-wide role or setting changes");
  assert.equal((c.match(/set local role/g) ?? []).length, 3);
  for (const ph of ["<ID_V_UUID>", "<NO_COSTING_UUID>"]) assert.ok(c.includes(ph), ph);
  assert.match(c, /explain \(analyze, buffers, timing off\)/);
});

test("parity package covers every output column, both EXCEPT ALL directions, types, ordered fetch, cardinality, grants, permission roles and plans", () => {
  const sql = read("readback/scheme_master_parity_readonly.sql");
  for (const col of COLUMNS) assert.ok(sql.includes(`"${col}"`), col);
  const list = COLUMNS.map((c) => `"${c}"`).join(", ");
  assert.ok((sql.split(`select ${list} from ${VIEW} except all select ${list} from cand`).length - 1) >= 2, "baseline minus candidate (blocks 1 and 3)");
  assert.ok((sql.split(`select ${list} from cand except all select ${list} from ${VIEW}`).length - 1) >= 2, "candidate minus baseline");
  assert.match(sql, /pg_typeof/); assert.match(sql, /array_agg\(scheme_id order by scheme_name, scheme_id\)/);
  assert.match(sql, /has_table_privilege/); assert.match(sql, /relacl/); assert.match(sql, /reloptions/); assert.match(sql, /pg_depend/);
  assert.match(sql, /scheme_without_snapshots/); assert.match(sql, /ID-V \(view-only\)/); assert.match(sql, /no Costing permission/);
  assert.equal((sql.match(/explain \(analyze/g) ?? []).length, 2, "baseline and candidate plans");
  assert.match(sql, /231\.433 ms/); assert.match(sql, /124\.916 ms/);
  assert.equal((sql.match(new RegExp(viewBody(CAND_VIEW).split("\n")[0].trim().replace(/[()*]/g, "\\$&"), "g")) ?? []).length >= 6, true, "candidate body is inlined in every comparison");
});

test("inlined candidate in the parity package is byte-identical to the candidate view body (no second, hand-written copy)", () => {
  const sql = read("readback/scheme_master_parity_readonly.sql");
  const inl = viewBody(CAND_VIEW).split("\n").map((l) => "  " + l).join("\n");
  const n = sql.split(`with cand as (\n${inl}\n)`).length - 1; assert.ok(n >= 6, `inlined ${n} times`);
});

test("rehearsal file is explicitly NOT read-only, never commits, needs no psql meta-command, and inlines the exact candidate block", () => {
  const sql = read("readback/scheme_master_rehearsal_rollback_txn.sql"), c = code(sql);
  assert.equal((c.match(/^begin;/gm) ?? []).length, 1); assert.equal((c.match(/^rollback;/gm) ?? []).length, 1); assert.doesNotMatch(c, /\bcommit\s*;/i);
  assert.ok(c.trimEnd().endsWith("rollback;")); assert.match(sql, /NOT read-only/); assert.doesNotMatch(sql, /^\\i\s/m, "no psql meta-command: runs through the SQL API too");
  assert.match(c, /acl_unchanged/); assert.match(c, /options_unchanged/); assert.match(c, /create temp table _baseline on commit drop/);
  const full = candidateSql(), block = full.slice(full.indexOf("do $apply$"));
  assert.ok(sql.includes(block), "the inlined block is byte-identical to the candidate DO statement");
  assert.equal(rehearsalSql(), lf(rehearsalSql()));
});

test("fail closed generator: a missing, duplicated or altered substituted region aborts generation instead of producing partial SQL", () => {
  assert.throws(() => buildCandidateViewSql(TB2.replace("FROM costing.sku_scheme_viability_snapshot s\n          WHERE (s.scheme_id = sm.id)) AS viability_snapshot_count", "FROM costing.sku_scheme_viability_snapshot s\n          WHERE (s.scheme_id = sm.id) AND true) AS viability_snapshot_count")), /matched 0 times/);
  assert.throws(() => buildCandidateViewSql(TB2 + "\n" + TB2), /matched 2 times/);
  assert.throws(() => buildCandidateViewSql(TB2.replace("   FROM costing.scheme_master sm\n) q", "   FROM costing.scheme_master sm WHERE true\n) q")), /matched 0 times/);
});

test("this is a candidate, not a migration: nothing under supabase/ mentions it, no migration file exists, and no executable file outside docs/ and scripts/ was added", () => {
  const migs = fs.readdirSync(path.join(root, "supabase/migrations"));
  assert.ok(!migs.some((f) => /scheme_master_register|viability_lateral|scheme_master_perf/i.test(f)));
  assert.ok(fs.existsSync(path.join(root, TB2_MIGRATION)), "the TB2 source of truth is still present and unmodified");
  assert.ok(fs.existsSync(dir)); assert.match(read("scheme_master_register_viability_lateral.candidate.sql"), /CANDIDATE ONLY - NOT APPLIED/);
});

test("client contract is unchanged: the Scheme Master tab still reads select(*) from the view ordered by scheme_name", () => {
  const src = lf(fs.readFileSync(path.join(root, "public/shared/js/costing-suite-pricing-policy.js"), "utf8"));
  assert.match(src, /costingFrom\("v_costing_scheme_master_register"\)\s*\.select\("\*"\)\s*\.order\("scheme_name", \{ ascending: true \}\)/);
});

test("parity package block 0a captures the fingerprint: md5 and text of pg_get_viewdef(view, true), exact column list and exact options, with the recording instructions", () => {
  const sql = read("readback/scheme_master_parity_readonly.sql");
  assert.match(sql, /md5\(pg_get_viewdef\(c\.oid, true\)\) as viewdef_md5, pg_get_viewdef\(c\.oid, true\) as viewdef_text/);
  assert.match(sql, /columns_match/); assert.match(sql, /options_exact/); assert.ok(sql.includes(FINGERPRINT_FILE));
  assert.ok(sql.includes("array[" + COLUMNS.map((x) => "'" + x + "'").join(", ") + "]"));
});

test("preserved contracts: rollback unchanged (TB2 text), candidate keeps security_invoker/gate/columns, and the README documents the fingerprint gate and atomic apply", () => {
  const readme = read("README.md");
  for (const k of ["fingerprint", "ONE atomic", FINGERPRINT_FILE, "pg_get_viewdef", "no LOCK", "UNRECORDED"]) assert.ok(new RegExp(k, "i").test(readme), k);
  assert.ok(read("scheme_master_register_rollback_tb2.sql").endsWith(TB2 + "\n"));
  assert.ok(CAND_VIEW.startsWith(VIEW_HEAD) && CAND_VIEW.endsWith("where (select public.fn_costing_view_allowed());"));
});
