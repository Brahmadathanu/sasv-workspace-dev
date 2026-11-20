#!/usr/bin/env node
// Non-production source-contract smoke only, NOT PostgreSQL execution, JWT acceptance,
// or a substitute for the owner-controlled migration and real-session gates.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const sql = fs.readFileSync('scripts/pec-draft-manual-indent-edits-PROPOSAL.sql', 'utf8');
const checks = [
  ['explicit rollback safety', /\bBEGIN;[\s\S]*\bROLLBACK;\s*$/i],
  ['date RPC', /CREATE OR REPLACE FUNCTION public\.proc_indent_update_draft_date\(/i],
  ['quantity RPC', /CREATE OR REPLACE FUNCTION public\.proc_indent_update_draft_manual_line_qty\(/i],
  ['date expected-value CAS', /v_header\.indent_date IS DISTINCT FROM p_expected_date/i],
  ['quantity expected-value CAS', /v_line\.requested_qty IS DISTINCT FROM p_expected_qty/i],
  ['draft state guard', /v_header\.status <> 'draft'/i],
  ['header PR source exclusion', /v_header\.source_pr_id IS NOT NULL/i],
  ['header PR mapping exclusion', /public\.proc_pr_to_indent_map/i],
  ['line PR mapping exclusion', /public\.proc_pr_indent_line_map/i],
  ['purchase allocation exclusion', /public\.v_proc_indent_fifo_allocation/i],
  ['quantity balance exclusion', /public\.v_proc_indent_line_balance/i],
  ['sourcing selection exclusion', /public\.proc_indent_line_sourcing_decision/i],
  ['internal material no-increase', /p_requested_qty > v_line\.requested_qty AND EXISTS/i],
  ['G0 classification coverage', /'finished_bulk_material','semifinished_goods'/i],
  ['genuine auth user check', /auth\.uid\(\) IS NULL/i],
  ['PEC edit check', /public\.require_permission\('module:procurement-execution-console','t'\)/i],
  ['audit writer', /public\.proc_lifecycle_audit_write_internal\(/i],
  ['deny anon date', /REVOKE ALL ON FUNCTION public\.proc_indent_update_draft_date\(bigint,date,date,text\) FROM PUBLIC, anon/i],
  ['deny anon quantity', /REVOKE ALL ON FUNCTION public\.proc_indent_update_draft_manual_line_qty\(bigint,numeric,numeric,text\) FROM PUBLIC, anon/i],
  ['finite quantity', /p_requested_qty::text IN \('NaN','Infinity','-Infinity'\)/i],
  ['changed quantity only', /SET requested_qty = p_requested_qty,[\s\S]*?updated_at = clock_timestamp\(\)/i],
  ['changed date only', /SET indent_date = p_indent_date,[\s\S]*?updated_at = clock_timestamp\(\)/i],
];
for (const [label, pattern] of checks) {
  assert.match(sql, pattern, 'PEC draft edit proposal missing: ' + label);
  console.log('PASS: ' + label);
}
const defs = [...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(/g)].map(m => m[1]);
assert.equal(defs.length, 2, 'proposal must add exactly two public functions');
assert.equal((sql.match(/SECURITY DEFINER/g) || []).length, 2);
assert.equal((sql.match(/SET search_path = pg_catalog, public, auth/g) || []).length, 2);
console.log('PASS: 2 isolated functions and hardened search paths');
console.log('PEC draft proposal static contract: 23/23 PASS (SOURCE ONLY; DB/JWT untested)');
