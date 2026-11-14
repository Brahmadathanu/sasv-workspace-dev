#!/usr/bin/env node
/**
 * PEC ERP-S1 source-level contract smoke. READ-ONLY.
 * This checks the review-only SQL candidate, NOT PostgreSQL execution or runtime
 * security/concurrency. A green result must not be called G2 acceptance.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(
  resolve(root, 'docs/procurement-execution/ERP_S1_DRAFT_EDIT_SQL_CANDIDATE_20261111.sql'),
  'utf8',
);
const count = (regex) => [...source.matchAll(regex)].length;
const checks = [
  ['two separate candidate writers',
    () => /FUNCTION public\.proc_indent_update_manual_draft_qty/.test(source)
      && /FUNCTION public\.proc_indent_update_manual_draft_date/.test(source)],
  ['both check edit permission at server',
    () => count(/require_permission\('module:procurement-execution-console', true\)/g) === 2],
  ['both reject non-draft',
    () => count(/v_h\.status <> 'draft'/g) === 2],
  ['both reject direct PR source',
    () => count(/v_h\.source_pr_id IS NOT NULL/g) === 2],
  ['both reject active PR mapping',
    () => count(/FROM public\.proc_pr_to_indent_map m/g) === 2],
  ['both use optimistic revision',
    () => count(/v_h\.updated_at IS DISTINCT FROM p_expected_indent_updated_at/g) === 2],
  ['quantity edit compares original value',
    () => /v_l\.requested_qty IS DISTINCT FROM p_expected_qty/.test(source)],
  ['quantity edit checks sourcing decisions',
    () => /proc_indent_line_sourcing_decision d/.test(source)],
  ['both require reason',
    () => count(/IF v_reason IS NULL THEN/g) === 2],
  ['date edit writes explicit reason event',
    () => /INDENT_DRAFT_DATE_REASON/.test(source) && /proc_lifecycle_audit_write_internal/.test(source)],
  ['no blanket executable PUBLIC grants',
    () => count(/REVOKE ALL ON FUNCTION public\.proc_indent_update_manual_draft/g) === 2],
  ['existing broad add-line RPC untouched',
    () => !/CREATE OR REPLACE FUNCTION public\.proc_indent_add_line\(/.test(source)],
  ['no draft refresh storm',
    () => !/PERFORM public\.proc_request_snapshot_refresh\(/.test(source)],
  ['month-encoded indent ID guard',
    () => /indent_number ~ '\^IND\//.test(source)
      && /to_char\(p_new_indent_date, 'YYYY-MM'\)/.test(source)],
];
let passed = 0;
for (const [name, test] of checks) {
  assert.ok(test(), name);
  passed++;
  process.stdout.write('PASS ' + name + '\n');
}
process.stdout.write('PEC-ERP-S1 static candidate checks: ' + passed + '/' + checks.length + ' PASS. PostgreSQL execution NOT tested.\n');
