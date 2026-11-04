# WP06-G1b — governed default-policy revision modal tests — 4 Nov 2026

Test-only (`scripts/costing-wp06-g1b/default-policy-modal-browser.test.mjs`, 16 Chromium tests). Baseline `main` `195b13c`. No source, flag, RPC, registry or metadata change. The REAL Pricing Policy Manager page (Commercial Sales Assumptions workspace) runs in Chromium against an inert in-memory backend; the only write RPC the flows may send is `rpc_set_sales_allocation_default_policies_scoped`.

## Pinned behaviour
View-only ("View Defaults", no Revise controls, no preview/save RPC); editor ("Manage Defaults"; a Revise control for every company scenario and every regional scenario × IK/OK; scenarios without a policy are stated); company modal (title, scopes `THIS_POLICY/ALL_COMPANY/ALL_LINKED`, first checked, Save disabled until a valid preview); regional OK/IK modal (title and region, scopes `THIS_POLICY/SAME_REGION_LINKED/ALL_REGIONAL/ALL_LINKED`, exact preview payload `p_anchor_kind:"REGIONAL"`, region code, scope, units number, date); invalid units (empty, 0, 0.0, negative) never produce a preview and keep Save disabled; scope change re-previews; a preview that is not `commit_allowed` keeps Save disabled and shows the server validation error; save payloads are exact for COMPANY (`p_region_code:null`) and REGIONAL/OK (empty approval → `null`, reason/approval trimmed); the preview is re-run at commit time and a no-longer-allowed preview blocks the write; missing reason is refused client-side; server error keeps the modal and allows a retry; double click sends one write; Escape closes the revise modal then the hub; Cancel resets the form; no approval/decision/acceptance RPC and no table mutation.

## Mutation evidence
Changed scope payload, removed commit-time re-preview, removed in-flight guard, removed reason requirement each fail the suite. Two mutants are equivalent from the UI and survive by design: `p_region_code: region || null` (company region is already empty) and removing the `units <= 0` guard inside save (the Save button is unreachable without a valid preview; the guard is defence in depth).

## Findings (characterised, source unchanged)
| ID | Finding | Evidence | Handling |
|---|---|---|---|
| F-7 | `closeDefaultPolicyModal` sets `defaultWriteInFlight = false`. Closing the revise modal while its save is pending and re-saving the same target sends a second write. | test "CHARACTERISATION F-7" (two writes today) | same fix pattern as G1d; separate small client package; the test must be flipped by it |
| F-8 | `#csaDefaultPolicyRegionWrap` carries the `hidden` attribute for company policies, but `.sign-grid label { display:flex }` (specificity above the UA `[hidden]` rule) keeps an empty read-only "Region" field visible. Cosmetic. | test "CHARACTERISATION F-8" (computed display ≠ none) | one-line CSS in `pricing-policy-manager.html` (`#csaDefaultPolicyRegionWrap[hidden]{display:none}`); needs a Costing-HTML-scope exception, owner OK |
