// node --test scripts/costing-run-status/run-status-badge.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { describeRunStatus, applyRunStatusBadge, createRunStatusBadge, RUN_SCOPED_LENSES } from "../../public/shared/js/costing-run-status-badge.js";
import { describeRunStatusForApprovalFlag } from "../../public/shared/js/costing-approval-labels.js";

// Rows exactly as costing.v_costing_period_run_status returned them in the local W1 test (run_tests.py).
const ROWS = {
  "2026-08-01": { period_start: "2026-08-01", display_state: "DRAFT", display_label: "DRAFT run 82 - not approved", displayed_run_id: 82 },
  "2026-09-01": { period_start: "2026-09-01", display_state: "APPROVED", display_label: "Approved run 122", displayed_run_id: 122, approved_run_id: 122, approved_at: "2026-10-16T14:36:52Z", approved_by: "Dr. Brahmadathan U" },
  "2026-10-01": { period_start: "2026-10-01", display_state: "APPROVED_NEWER_DRAFT", display_label: "Approved run 128 (newer DRAFT run 129 - not approved)", displayed_run_id: 128, approved_run_id: 128, approved_at: "2026-10-18T08:48:51Z", approved_by: "Dr. Brahmadathan U", newer_draft_run_id: 129 },
  "2026-11-01": { period_start: "2026-11-01", display_state: "DRAFT", display_label: "DRAFT run 130 - not approved", displayed_run_id: 130, active_run_id: 131, active_run_status: "RUNNING" },
};

test("approved month shows Approved run N with approval time in IST", () => {
  const i = describeRunStatus(ROWS["2026-09-01"]);
  assert.equal(i.text, "Approved run 122");
  assert.equal(i.tone, "approved");
  assert.match(i.title, /Approved 16 Oct 2026, 20:06 IST by Dr\. Brahmadathan U/);
});
test("draft month is labelled DRAFT run N - not approved", () => {
  const i = describeRunStatus(ROWS["2026-08-01"]);
  assert.equal(i.text, "DRAFT run 82 - not approved");
  assert.equal(i.tone, "draft");
  assert.match(i.title, /not approved for pricing/);
});
test("approved month with newer draft keeps approved label and warns", () => {
  const i = describeRunStatus(ROWS["2026-10-01"]);
  assert.equal(i.text, "Approved run 128 (newer DRAFT run 129 - not approved)");
  assert.equal(i.tone, "approved-pending");
});
test("active run is mentioned", () => {
  assert.match(describeRunStatus(ROWS["2026-11-01"]).title, /Run 131 is running/);
});
test("missing row is safe", () => {
  assert.equal(describeRunStatus(null).tone, "empty");
});

function fakeDoc() {
  return { createElement: () => ({ dataset: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, hidden: false, textContent: "" }) };
}
function fakeSupabase(log) {
  return {
    from(view) {
      const q = { view, filters: {} };
      return {
        select() { return this; },
        eq(k, v) { q.filters[k] = v; return this; },
        async maybeSingle() { log.push(q); return { data: ROWS[q.filters.period_start] || null, error: null }; },
      };
    },
  };
}
test("badge reads the run-status view for the active month on pricing lenses only", async () => {
  const log = [];
  let inserted = null;
  const anchor = { insertAdjacentElement: (pos, el) => { inserted = { pos, el }; } };
  const b = createRunStatusBadge({ supabase: fakeSupabase(log), anchor, doc: fakeDoc() });
  await b.refresh({ periodStart: "2026-08-01", lensId: "cost-comparison" });
  assert.equal(inserted.pos, "beforebegin");
  assert.equal(inserted.el.textContent, "DRAFT run 82 - not approved");
  assert.equal(inserted.el.dataset.tone, "draft");
  assert.equal(inserted.el.hidden, false);
  assert.deepEqual(log[0], { view: "v_costing_pricing_period_run_status", filters: { period_start: "2026-08-01" } });
  await b.refresh({ periodStart: "2026-09-01", lensId: "sku-cost-sheet" });
  assert.equal(inserted.el.textContent, "Approved run 122");
  await b.refresh({ periodStart: "2026-09-01", lensId: "manual-rate-manager" });
  assert.equal(inserted.el.hidden, true);
  await b.refresh({ periodStart: "2026-09-01", lensId: "dashboard" });
  assert.equal(log.length, 2, "settled approved month is cached (Aug + Sep fetched once)");
});
test("pricing lenses covered", () => {
  for (const l of ["dashboard", "sku-cost-sheet", "printable-cost-sheet", "cost-comparison", "scheme-comparison", "sku-control-status"]) assert.ok(RUN_SCOPED_LENSES.has(l));
});
test("hidden state ignores info", () => {
  const el = { dataset: {}, setAttribute() {}, hidden: false };
  applyRunStatusBadge(el, null, false);
  assert.equal(el.hidden, true);
});

test("flag-on 31 Oct draft uses server not-for-pricing label", () => {
  const row = {
    period_start: "2026-10-01",
    display_state: "DRAFT",
    display_label: "DRAFT run 151 - not approved",
    display_label_v2: "Draft – not for pricing (run 151)",
    pricing_use_label: "Draft – not for pricing",
    official_valuation_date: null,
    latest_draft_valuation_date: "2026-10-31",
  };
  const info = describeRunStatusForApprovalFlag(row);
  assert.match(info.text, /not for pricing/i);
  assert.equal(info.tone, "draft");
});
