import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyRouteState, historicalVerification, classifyPackLines, planReplay, expectedDepletionBase } from './g7_policy.mjs';

// Source-grounded cohort: S1 register final result (commit 6acc61c1): 80 Nov1-21 FG bulk DWL rows.
const mkRec = (n, o) => Array.from({ length: n }, () => ({ bmr_matches: 1, any_approved_routes: 1, effective_approved_routes: 1, mandatory_fg_activity_steps: 1, ...o }));
const cohort = [
  ...mkRec(52, { any_approved_routes: 0, effective_approved_routes: 0, mandatory_fg_activity_steps: 0 }),
  ...mkRec(17, { mandatory_fg_activity_steps: 0 }),
  ...mkRec(1, { effective_approved_routes: 2 }),
  ...mkRec(10, {}),
];
test('S1 register classification reproduces 52/17/1/10 of 80 and keeps history NOT_VERIFIED', () => {
  const c = {}; for (const r of cohort) c[classifyRouteState(r)] = (c[classifyRouteState(r)] ?? 0) + 1;
  assert.deepEqual(c, { PRODUCT_ROUTE_COVERAGE: 52, MANDATORY_FG_STAGE_GAP: 17, APPROVED_ROUTE_OVERLAP: 1, ACTIVITY_ROUTE_CORRELATED_NOT_SIGNED: 10 });
  assert.equal(cohort.length, 80);
  assert.ok(cohort.every((r) => historicalVerification(r, false) === 'NOT_VERIFIED'));   // no artificial signoff
  assert.equal(historicalVerification(cohort[79], true), 'SIGNED');                      // only with real signed event
  assert.equal(historicalVerification(cohort[0], true), 'NOT_VERIFIED');                 // no route -> never verified
});
// SYNTHETIC stand-in for the 29 live packaging lines (live rows not accessible from this branch).
const lines = Array.from({ length: 29 }, (_, i) => ({ id: 9000 + i, product_id: 1 + (i % 3), batch_number: `B${i}`, count: 10 + i, pack_size: i % 2 ? 500 : 0.5, sku_uom: i % 2 ? 'g' : 'kg', base_uom: 'kg', conversion_to_base: 0.001 }));
const healthy = [{ id: 1, product_id: 1, batch_number: 'OK', count: 5, pack_size: 1, sku_uom: 'kg', base_uom: 'kg' }];
const ledger = [{ source_table: 'event_skus', source_id: 1, qty_base: -5 }];
test('29 missing-depletion lines are classified; healthy line is not', () => {
  const cls = classifyPackLines([...lines, ...healthy], ledger);
  assert.equal(cls.filter((c) => c.class === 'C3_MISSING_DEPLETION').length, 29);
  assert.equal(cls.filter((c) => c.class === 'DEPLETION_PRESENT').length, 1);
});
test('future replay plan is idempotent, depletion-only, never fabricates receipts', () => {
  const plan1 = planReplay(lines, ledger);
  assert.equal(plan1.length, 29);
  assert.ok(plan1.every((p) => p.qty_base < 0 && p.requires_signed_source_evidence));
  assert.equal(plan1[0].qty_base, expectedDepletionBase(lines[0]));
  assert.equal(expectedDepletionBase(lines[1]), -((10 + 1) * 500 * 0.001));            // pack-size/base conversion
  const applied = new Set(plan1.map((p) => p.idempotency_key));
  assert.equal(planReplay(lines, ledger, applied).length, 0);                           // second run = no-op
  const after = [...ledger, ...plan1.map((p) => ({ source_table: p.source_table, source_id: p.source_id }))];
  assert.equal(planReplay(lines, after).length, 0);                                     // already depleted = no-op
  assert.equal(plan1.filter((p) => p.qty_base > 0).length, 0);
});
