# G6 owner approval and governed supersession attempt — 2026-10-21

Owner explicitly approved run136 G6 in ChatGPT on 2026-10-21. Scope: October valuation 2026-10-20, 626 READY, one legitimate SKU1771 IK REVIEW, 0 BLOCKED, seven financial pools conserved and 17 integrity checks PASS.

**Read-only preflight PASS**: `costing.fn_w2_run_checks(136,'SUPERSEDE')` yielded `ok=true` and all 13 checks PASS; existing October approved run128; authorisation 6 CONSUMED; run136 frozen fingerprint 19 clean (0 drift), 627 SKUs, period open/valuation date match.

**Action attempted but rejected with NO designation:** `costing.rpc_designate_costing_run(136,'APPROVED',...)` failed `W2_SECOND_APPROVED_RUN`, because run128 is still approved. `public.rpc_costing_supersede_approved_run(136,...,'USER-G6-APPROVAL-20261021-RUN136')` failed `W2_OWNER_ONLY`. Connected administrative SQL context has `auth.uid() IS NULL` and is not the signed-in costing owner. **Do not impersonate auth, bypass security definer owner guard, disable trigger, or manually INSERT designation/revocation.** Failed SQL statements are transactionally rolled back; no successful designation claimed.

**Status**: G6 owner APPROVED in conversation, financial/release preflight PASS, **governed owner-authenticated supersession NOT EXECUTED**. Require action via an actual logged-in owner-context client/RPC session or existing authorised owner interaction. Preserve prior approved run128 until that executes. Sheets blocked and no further costing refresh required. No other server-side defect was demonstrated.
