# CI-040 v2.1: one-step approval with a recorded preview (prepared, not applied)

**Unchanged from v2:**
- Approval and supersession happen in one step.
- The approval needs a preview acknowledgement recorded by the server: same user, same run, unexpired (15 minutes by default), unused, and the approved-run state unchanged, all checked again under the governance lock.
- Estimated profit is shown only from CI-037.
- Old calls are refused with W2_USE_NEW_APPROVAL_ROUTE.

**v2.1 corrections:**
1. **Wording:** the policy comment, the table comment and the header now say the acknowledgement proves the preview was **generated/opened**. They state explicitly that it is not proof it was reviewed or understood.
2. **Settings table:**
   - `costing_automation_setting_range_chk` gives each of the 12 keys an allowed range (e.g. preview expiry 5–60 min, retries 0–3, catch-up 0–1). Unknown keys are refused.
   - Both new tables are owner-only (postgres), the same as `costing_governance_owner` and `effective_date_guard_config`. v2 had granted SELECT to service_role; v2.1 removes that grant.
3. **Re-apply safety:** the audit event-type constraint is widened only if it is not already wider. This matters after a mode-B rollback of CI-041 v2.1, whose retry audit rows need the wider constraint.
4. **Rollback:** the v2 body is unchanged plus one block. If CI-042 was rolled back in mode B, it also returns month-end finalise to its pre-CI-042 form, because the old approve works again at that point.

**What the state hash covers** (`state_md5`, compared at approval):
- schema version 2
- the candidate run id and its valuation date
- the current APPROVED run id and its date
- the latest designation id for the month (any approval or supersession in between changes it)
- check counts and the overall ok flag
- the md5 of the per-SKU differences against the approved run
- the staleness row count and the latest stale timestamp
- the frozen-through date

**Known gap:** staleness is measured only by `fn_costing_run_input_staleness`. That covers 44 of the 47 guarded tables; route_load_scaling_switch, batch_true_standard_switch and costing_sales_feed_switch cannot be scanned (no effective-date column). An input change in those 3 tables after the preview, or any change to data the staleness scan does not cover, does NOT invalidate the acknowledgement. The 15-minute expiry limits the exposure.

**Prerequisites checklist (apply day):**
1. **auth.uid() path:** approval runs through `fn_w2_owner_name()`, which needs `auth.uid()` in `costing.costing_governance_owner`. Calling with a service-role key without a user JWT fails with the owner error. Use the signed-in owner session.
2. **Grants:** the new public RPCs get authenticated + service_role EXECUTE and no anon/PUBLIC, mirroring `rpc_costing_approve_run` (live ACL read). Internal functions get no client grants. Test SET9/SET10.
3. **Preview cost:** run `EXPLAIN` (not ANALYZE) on `select costing.fn_costing_approval_preview_core(143)` read-only before applying. It is expected to be dominated by the 56-table fingerprint verification plus the staleness scan. Local timing was about 12 ms on stand-in data. Production timing is unverified.

**Tests:** T04–T09, SET1–SET10, W1–W2 pass. T06d now tests expiry by moving the expiry time into the past, because a 0-minute expiry is no longer allowed.
