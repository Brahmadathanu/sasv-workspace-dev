#!/usr/bin/env node
// Static guard only. Does not replace isolated PostgreSQL or genuine-JWT tests.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const sql=fs.readFileSync("supabase/migrations/20261112220000_pec_r2_add_line_new_row_status_guard.sql","utf8");
test("uses existing public RPC signature and EDIT gate",()=>{
  assert.match(sql,/CREATE OR REPLACE FUNCTION public\.proc_indent_add_line\(/);
  assert.match(sql,/SECURITY DEFINER/);
  assert.match(sql,/require_permission\('module:procurement-execution-console', 't'\)/);
});
test("locks indent lifecycle row and checks canonical existing-line identity",()=>{
  assert.match(sql,/FROM public\.proc_indent_header h[\s\S]*?FOR UPDATE/);
  assert.match(sql,/FROM public\.proc_indent_line l/);
  for(const c of ["indent_id","material_class_id","stock_item_id","uom_id"])
    assert.match(sql,new RegExp("l\\."+c+"\\s*=\\s*p_"+c));
});
test("denies new rows unless draft manual non-PR, preserving corrections",()=>{
  assert.match(sql,/NOT v_line_exists AND \(v_status <> 'draft' OR v_source_pr_id IS NOT NULL\)/);
  assert.match(sql,/RETURN public\.proc_indent_add_line_pec_internal\(/);
  assert.doesNotMatch(sql,/DELETE\s+FROM|TRUNCATE|DROP\s+FUNCTION|GRANT\s+EXECUTE/i);
});
test("does not rewrite historical production migration files",()=>{
  assert.equal(sql.includes("ALTER TABLE"),false);
  assert.match(sql,/Rollback/);
});
