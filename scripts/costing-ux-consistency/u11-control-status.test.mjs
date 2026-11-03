// U11: sentence-case worklist group labels, flag COSTING_UX_CONSISTENCY_V1 only.
// Presentation only: raw codes, group keys, severity order and routes are untouched.
import test from "node:test";
import assert from "node:assert/strict";
import {
  COSTING_CONTROL_STATUS_DISPLAY_LABELS,
  costingControlStatusDisplayLabel,
} from "../../public/shared/js/costing-status-labels.js";
import {
  groupReviewWorklistRows,
  renderReviewWorklistHtml,
  reviewWorklistGroupLabel,
} from "../../public/shared/js/costing-review-worklist.js";

const CODES = {
  MATERIAL_COST_BLOCKED: ["BLOCKER", "Material Cost Blocked", "Material cost blocked"],
  MATERIAL_REVIEW_REQUIRED: ["REVIEW_REQUIRED", "Material Review Required", "Material review required"],
  PRIME_COST_REVIEW_REQUIRED: ["REVIEW_REQUIRED", "Prime Cost Review Required", "Prime cost review required"],
  PRICING_BRIDGE_REVIEW_REQUIRED: ["REVIEW_REQUIRED", "Pricing Bridge Review Required", "Pricing bridge review required"],
};
const rows = Object.entries(CODES).map(([code, [sev]], i) => ({
  sku_id: 100 + i, control_severity: sev, first_control_status: code, recommended_ui_route: "", control_note: "n",
}));

function withFlag(value, fn) {
  const prev = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => value } });
  try { return fn(); } finally {
    if (prev) Object.defineProperty(globalThis, "localStorage", prev); else delete globalThis.localStorage;
  }
}

test("helper covers exactly the four worklist codes; unknown codes return empty string", () => {
  assert.deepEqual(Object.keys(COSTING_CONTROL_STATUS_DISPLAY_LABELS).sort(), Object.keys(CODES).sort());
  for (const [code, [, , sentence]] of Object.entries(CODES)) {
    assert.equal(costingControlStatusDisplayLabel(code), sentence);
    assert.equal(costingControlStatusDisplayLabel(` ${code.toLowerCase()} `), sentence);
  }
  for (const v of ["", null, undefined, "SERVER_ADDED_STATUS", "toString", "__proto__"]) {
    assert.equal(costingControlStatusDisplayLabel(v), "");
  }
});

test("flag OFF (absent, 0, true, throwing storage): legacy Title Case labels exactly", () => {
  const groups = groupReviewWorklistRows(rows);
  for (const v of [null, "0", "true", ""]) {
    withFlag(v, () => {
      for (const g of groups) assert.equal(reviewWorklistGroupLabel(g), CODES[g.firstControlStatus][1]);
    });
  }
  assert.equal(reviewWorklistGroupLabel(groups[0]), CODES[groups[0].firstControlStatus][1]);
});

test("flag ON ('1'): sentence-case labels; group keys, codes and counts are unchanged", () => {
  const off = withFlag(null, () => groupReviewWorklistRows(rows));
  withFlag("1", () => {
    const on = groupReviewWorklistRows(rows);
    assert.deepEqual(on, off);
    for (const g of on) assert.equal(reviewWorklistGroupLabel(g), CODES[g.firstControlStatus][2]);
    const html = renderReviewWorklistHtml(on, {});
    for (const [, [, legacy, sentence]] of Object.entries(CODES)) {
      assert.ok(html.includes(sentence), `ON html has ${sentence}`);
      assert.ok(!html.includes(legacy), `ON html drops ${legacy}`);
    }
  });
  const htmlOff = withFlag(null, () => renderReviewWorklistHtml(groupReviewWorklistRows(rows), {}));
  for (const [, [, legacy]] of Object.entries(CODES)) assert.ok(htmlOff.includes(legacy));
});

test("flag ON leaves unmapped server codes on the legacy humanised label", () => {
  const g = groupReviewWorklistRows([{ sku_id: 1, control_severity: "REVIEW_REQUIRED", first_control_status: "SOME_NEW_STATUS", recommended_ui_route: "", control_note: "" }]);
  const off = withFlag(null, () => reviewWorklistGroupLabel(g[0]));
  const on = withFlag("1", () => reviewWorklistGroupLabel(g[0]));
  assert.equal(off, "Some New Status");
  assert.equal(on, off);
});
