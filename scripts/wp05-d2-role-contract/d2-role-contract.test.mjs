// WP05 D-2 isolated source-derived MODEL ONLY: no login, DB connection or production role test.
// Live public.fn_costing_view_allowed prosrc MD5 on 2026-11-11: b7efb09b90fa3e9332915ba5d223568c.
// Verify implementation fingerprint independently before treating this fixture as current.
import test from "node:test";
import assert from "node:assert/strict";

const FOUR = Object.freeze([
  "module:costing-control-center",
  "module:cost-build-manager",
  "module:cost-sheet-review",
  "module:material-cost-manager",
]);
const PPM = "module:pricing-policy-manager";
const SIX_VIEWS = Object.freeze([
  "v_costing_material_manual_rate_register",
  "v_costing_material_manual_rate_history",
  "v_costing_material_review_acceptance_register",
  "v_costing_scheme_master_audit",
  "v_costing_pricing_sku_detailed_cost_sheet",
  "v_costing_pricing_cost_sheet_line_traceability",
]);
const grant = (target, can_view = true, can_edit = false) => ({
  [target]: { can_view, can_edit },
});

// Models ONLY the six views' outer fn_costing_view_allowed() condition.
function deployedSharedOuterGate({ dbRole = "authenticated", uid = true, grants = {} } = {}) {
  if (dbRole === "postgres" || dbRole === "service_role") return true;
  if (!uid) return false;
  return FOUR.some((target) => grants[target]?.can_view === true);
}

// Candidate BUSINESS RULE, not owner-approved and NOT installed in a DB.
function proposedPpmAuditOuterGate({ dbRole = "authenticated", uid = true, grants = {} } = {}) {
  if (dbRole === "postgres" || dbRole === "service_role") return true;
  return Boolean(uid && grants[PPM]?.can_view === true);
}

test("no UID or no View bit denies under current outer helper", () => {
  assert.equal(deployedSharedOuterGate({ uid: false, grants: grant(FOUR[0]) }), false);
  assert.equal(deployedSharedOuterGate({ grants: {} }), false);
  assert.equal(deployedSharedOuterGate({ grants: grant(FOUR[0], false, true) }), false);
});

test("each of four view grants separately passes current outer helper; PPM only does not", () => {
  for (const target of FOUR) {
    assert.equal(deployedSharedOuterGate({ grants: grant(target) }), true, target);
    assert.equal(deployedSharedOuterGate({ grants: grant(target, false, true) }), false, target);
  }
  assert.equal(deployedSharedOuterGate({ grants: grant(PPM) }), false);
});

test("Scheme Master audit inherits four-module outer gate in this model", () => {
  assert.ok(SIX_VIEWS.includes("v_costing_scheme_master_audit"));
  assert.equal(deployedSharedOuterGate({ grants: grant(PPM) }), false);
  for (const target of FOUR) assert.equal(deployedSharedOuterGate({ grants: grant(target) }), true);
});

test("proposed PPM-specific outer gate would reverse that synthetic role matrix", () => {
  assert.equal(proposedPpmAuditOuterGate({ grants: grant(PPM) }), true);
  for (const target of FOUR) assert.equal(proposedPpmAuditOuterGate({ grants: grant(target) }), false);
  assert.equal(proposedPpmAuditOuterGate({ grants: grant(PPM, false, true) }), false);
  assert.equal(proposedPpmAuditOuterGate({ uid: false, grants: grant(PPM) }), false);
});

test("privileged database-role exceptions stay explicit in the two models", () => {
  for (const dbRole of ["postgres", "service_role"]) {
    assert.equal(deployedSharedOuterGate({ dbRole, uid: false }), true);
    assert.equal(proposedPpmAuditOuterGate({ dbRole, uid: false }), true);
  }
  assert.equal(deployedSharedOuterGate({ dbRole: "authenticated", uid: false }), false);
});

test("fixture scope is exactly six views and four existing helper view targets", () => {
  assert.equal(SIX_VIEWS.length, 6);
  assert.equal(FOUR.length, 4);
  assert.ok(!FOUR.includes(PPM));
});
