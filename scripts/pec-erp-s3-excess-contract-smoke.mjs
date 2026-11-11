// PEC-ERP-S3-E candidate static guard. Does NOT execute SQL.
// Run: node scripts/pec-erp-s3-excess-contract-smoke.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sql = readFileSync('docs/procurement-execution/ERP_S3_EXCESS_PAGED_SQL_CANDIDATE_20261111.sql','utf8');
const body = sql.split('CREATE OR REPLACE FUNCTION')[1]?.split('$pec_s3_e$;')[0] || '';
const checks = [
 ['one new RPC, preserving legacy',()=>sql.includes('FUNCTION public.proc_pec_purchase_excess_paged(') && !sql.includes('CREATE OR REPLACE FUNCTION public.proc_pec_purchase_excess()')],
 ['explicit module view permission',()=>body.includes("require_permission('module:procurement-execution-console', false)")],
 ['read-only stable function',()=>/LANGUAGE plpgsql STABLE SECURITY DEFINER/.test(sql)],
 ['limit capped 1..200',()=>body.includes('p_limit > 200')&&body.includes('p_limit < 1')],
 ['offset nonnegative',()=>body.includes('p_offset < 0')],
 ['date range checked',()=>body.includes('p_date_from > p_date_to')],
 ['literal substring, not wildcard ILIKE',()=>body.includes('strpos(lower(coalesce(x.stock_item_name')&&!body.includes(' ILIKE ')],
 ['canonical PLM/PM',()=>body.includes("IF v_class = 'PLM'")&&body.includes("THEN 'PM'")],
 ['inclusive date and minqty',()=>body.includes('x.voucher_date >= p_date_from')&&body.includes('x.voucher_date <= p_date_to')&&body.includes('x.net_unallocated_qty, 0) >= p_min_qty')],
 ['item name OR code',()=>body.includes('x.stock_item_code')&&body.includes('v_item')],
 ['unmapped NULL/blank',()=>body.includes('x.vendor_display_name IS NULL OR x.vendor_display_name =')],
 ['stable 3-field order',()=>body.includes('purchase_fact_id DESC')],
 ['full filtered count independently of page',()=>body.includes('(SELECT count(*) FROM filtered)')],
 ['zero row response envelope',()=>body.includes("'[]'::jsonb")&&body.includes("'total_count'")],
 ['revokes public/anon',()=>/FROM PUBLIC, anon;/.test(sql)],
 ['authenticated grant',()=>/TO authenticated, service_role;/.test(sql)],
 ['no writes to procurement tables',()=>!/(?:^|\n)\s*(insert\s+into|update\s+public\.|delete\s+from|truncate\s+table)/i.test(body)]
];
let pass=0;
for(const [name,fn] of checks){ assert.ok(fn(),name); console.log('PASS '+name);pass++;}
console.log('S3-E static candidate '+pass+'/'+checks.length+' PASS; PostgreSQL installation and permission runtime NOT TESTED.');
