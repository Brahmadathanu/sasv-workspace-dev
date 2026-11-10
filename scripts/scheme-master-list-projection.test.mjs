import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { test } from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(resolve(root, "public/shared/js/costing-suite-pricing-policy.js"), "utf8");
const expectedColumns = [
  "scheme_id", "scheme_name", "paid_qty", "free_qty", "total_qty",
  "free_per_paid_ratio", "effective_free_discount_percent", "is_active",
  "is_system_defined", "remarks", "approval_reference", "direct_policy_count",
  "active_direct_policy_count", "hierarchy_rule_count", "active_hierarchy_rule_count",
  "replacement_reference_count", "active_replacement_reference_count",
  "can_edit_metadata", "can_deactivate", "can_reactivate", "created_at",
  "created_by", "updated_at", "updated_by", "metadata_update_reason",
  "deactivated_at", "deactivated_by", "deactivation_reason", "reactivated_at",
  "reactivated_by", "reactivation_reason",
];

test("Scheme Master list uses the exact 31-column server projection", () => {
  const match = source.match(/const SCHEME_MASTER_LIST_SELECT\\s*=\\s*\\[([\\s\\S]*?)\\]\\.join\\(","\\);/);
  assert.ok(match, "Scheme Master projection constant missing");
  const selected = [...match[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(selected, expectedColumns);
  assert.equal(new Set(selected).size, expectedColumns.length);
});

test("Scheme Master list skips the three costly viability aggregates", () => {
  const match = source.match(/const SCHEME_MASTER_LIST_SELECT\\s*=\\s*\\[([\\s\\S]*?)\\]\\.join\\(","\\);/);
  assert.ok(match);
  const selected = [...match[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  for (const field of [
    "viability_snapshot_count",
    "viability_snapshot_period_count",
    "latest_viability_snapshot_period",
  ]) {
    assert.ok(!selected.includes(field), field);
  }
});

test("Scheme Master list fetch keeps ordered and paginated read path", () => {
  assert.match(source, /costingFrom\("v_costing_scheme_master_register"\)\s*(?:\/\/[^\n]*\n\s*)*\.select\(SCHEME_MASTER_LIST_SELECT\)\s*\.order\("scheme_name",\s*\{\s*ascending:\s*true\s*\}\)/);
  assert.match(source, /if \(getPolicyManagerTab\(\) === "scheme-master"\) \{\s*return fetchAllRows\(/);
});

test("Existing historical viability UI is not falsely claimed fixed", () => {
  // The existing renderer requests viability_periods/viability_period_count,
  // whereas the live view uses viability_snapshot_period_count. This test
  // documents the pre-existing mismatch rather than inventing a value.
  assert.match(source, /"viability_periods", "viability_period_count"/);
});
