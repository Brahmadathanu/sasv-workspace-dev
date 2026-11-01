import test from "node:test";
import assert from "node:assert/strict";
import {
  describeRunStatusForApprovalFlag,
  formatLatestDraftValuationDate,
  formatOfficialValuationDate,
  isDraftRunRow,
  pickPeriodDisplayLabel,
  pickPricingUseLabel,
} from "../../public/shared/js/costing-approval-labels.js";

test("prefers display_label_v2 and passes through pricing_use_label", () => {
  const row = {
    display_label: "DRAFT run 150 - not approved",
    display_label_v2: "Draft – not for pricing (run 150)",
    pricing_use_label: "Draft – not for pricing",
    display_state: "DRAFT",
    official_valuation_date: null,
    latest_draft_valuation_date: "2026-10-31",
  };
  assert.equal(pickPeriodDisplayLabel(row), "Draft – not for pricing (run 150)");
  assert.equal(pickPricingUseLabel(row), "Draft – not for pricing");
  assert.equal(formatOfficialValuationDate(row), "Not approved");
  assert.equal(formatLatestDraftValuationDate(row), "2026-10-31");
});

test("31 Oct draft shows not for pricing from the server label", () => {
  const oct31Draft = {
    period_start: "2026-10-01",
    display_state: "DRAFT",
    display_label: "DRAFT run 151 - not approved",
    display_label_v2: "Draft – not for pricing (run 151)",
    pricing_use_label: "Draft – not for pricing",
    official_valuation_date: null,
    latest_draft_valuation_date: "2026-10-31",
  };
  const info = describeRunStatusForApprovalFlag(oct31Draft);
  assert.match(info.text, /not for pricing/i);
  assert.match(info.title, /Official \(approved\) date: Not approved/);
  assert.match(info.title, /Latest draft date: 2026-10-31/);
  assert.doesNotMatch(info.text, /invented/i);
});

test("draft run rows are detected from server display_status only", () => {
  assert.equal(isDraftRunRow({ display_status: "Draft" }), true);
  assert.equal(isDraftRunRow({ display_status: "Approved" }), false);
  assert.equal(isDraftRunRow({ display_status: "Superseded" }), false);
});
