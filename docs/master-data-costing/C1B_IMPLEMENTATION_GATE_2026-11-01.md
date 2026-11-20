# C1B implementation gate — 1 November 2026

Status: design only; production migration not applied.

Read-only verification confirms that October run 148 is a successful newer draft and its SKU snapshot exists independently of the approved-run view. An authorised read contract must preserve existing costing-control-center view permission and source-run identity, with no change to approval or pricing selection.

The current production snapshot has indexes for refresh_run_id and SKU. The internal costing_refresh_run table is not directly SELECT-granted to authenticated, so any new security-invoker view must avoid relying on expanded internal-run grants. The period-status view already provides permission-filtered displayed/approved/newer-successful-draft run IDs.

Preflight: inspect RLS, grants, period-status definition, snapshot cardinality, plan efficiency, and permitted/denied authenticated identity behaviour. Preserve the direct-labour override and all existing control-status columns. Implement a separately named read-only view only after exact SQL and rollback receive written owner approval. Do not reuse or reapply historical migrations.

Postflight: for run 148 verify 628 SKU statuses (514 ready, 113 review, 1 blocker); run 143 parity; denied users and ineligible runs inaccessible; historical fingerprints, approvals and pricing unchanged. Rollback must remove only the new read surface after disabling dependent client features.

Client: C1 PR #115 remains a draft. Address its status-read-error wording and coordinated cache bump through Jarvis, then owner-approved merge. C1B follows successful server authorisation. The post-October cause-split analytics remains parked.
