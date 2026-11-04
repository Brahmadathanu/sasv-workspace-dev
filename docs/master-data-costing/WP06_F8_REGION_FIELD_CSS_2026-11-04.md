# WP06-F8 — "Region" field of the company default-policy modal — 4 Nov 2026

Stacked on WP06-F7 (and therefore on PR #154); retargets to `main` when those merge. One CSS block in `public/shared/pricing-policy-manager.html`; no script, markup, RPC or behaviour change.

## Demonstrated in real Chromium before the fix
`<label id="csaDefaultPolicyRegionWrap" hidden>` is hidden by the script for COMPANY policies (`hidden = true`, confirmed), but the page rule `.sign-grid label { display:flex }` has higher specificity than the user-agent `[hidden] { display:none }`, so an empty read-only "Region" field stayed on screen in the company revise modal (computed `display` ≠ `none`, non-zero box). The test "F-8 (fixed)" fails on the unfixed CSS (1 failure) and passes with the rule.

## Fix
`#csaDefaultPolicyRegionWrap[hidden] { display: none; }` placed next to the other `#csaDefaultPolicyModal .sign-grid` rules. Regional policies (IK/OK) still show the field with its value ("Outside Kerala (OK)"); company → regional → company toggling is asserted.

## Guard change
The historical "no Costing HTML changed" package tests would reject any edit of a Costing page. `scripts/lib/costing-scope-guard.mjs` gains `APPROVED_HTML_INSERTIONS` (same idea as the existing CW-07 label tolerance): the page is tolerated only if it equals the base text with exactly this block inserted once after its anchor. Four tamper tests (extra edit, altered/duplicated/misplaced block, deletion, ambiguous anchor, CRLF) and a report-level test prove nothing else on that page is excused.
