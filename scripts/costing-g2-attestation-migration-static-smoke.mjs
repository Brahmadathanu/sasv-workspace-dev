/** G2 static migration checks. Does not execute SQL or replace PostgreSQL regression. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql = readFileSync(new URL("../docs/costing-pipeline-independent-audit/closure/prepared/HELD_G2_route_repetition_evidence_20261020.sql",import.meta.url),"utf8");
const expected = [
  /G2 HOLD: do not deploy/,
  /create table costing\.route_repetition_confirmation/,
  /constraint g2_route_target_check/,
  /before update or delete on costing\.route_repetition_confirmation/,
  /create or replace function costing\.fn_g2_repetition_evidence/,
  /from costing\.fn_effective_product_process_route_steps\(p_route_id\)/,
  /to_jsonb\(s\)/,
  /base_family_route_id/,
  /base_family_route_version/,
  /with ordinality as e\(s,ordinal\)/,
  /order by e\.ordinal/,
  /create or replace function public\.rpc_confirm_route_repetition/,
  /v_status is distinct from 'REVIEW_REQUIRED'/,
  /fn_g2_require_repetition_confirmation\('FAMILY',p_family_route_id\)/,
  /fn_g2_require_repetition_confirmation\('PRODUCT',p_product_route_id\)/,
  /where id=p_product_route_id and archived_at is null for update/,
  /revoke execute on function costing\.fn_g2_repetition_evidence/,
  /revoke execute on function costing\.fn_g2_require_repetition_confirmation/
];
expected.forEach((pattern)=>assert.match(sql,pattern));
assert.equal((sql.match(/with ordinality as e\(s,ordinal\)/g)||[]).length,2);
assert.equal((sql.match(/order by e\.ordinal/g)||[]).length,2);
assert.equal((sql.match(/for share of fr/g)||[]).length,2);
assert.match(sql,/CREATE OR REPLACE FUNCTION public\.rpc_submit_product_route_for_review/);
assert.match(sql,/CREATE OR REPLACE FUNCTION public\.rpc_submit_route_family_route_for_review/);
assert.match(sql,/from costing\.product_process_route where id=p_product_route_id and archived_at is null for update/);
assert.match(sql,/from costing\.production_route_family_route where id=p_family_route_id and archived_at is null for update/);
console.log("G2 static migration smoke PASS (17 checks); PostgreSQL execution NOT tested");
