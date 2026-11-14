# WP05 R48 — Owner-authorised progressive test-account permissions (12 November 2026)

**STAGE 1 ACTIVE: CSR VIEW ONLY. TEST ACCOUNT PERMISSION RECORDS CHANGED IN LIVE SUPABASE.** Owner requested sequential normal-user simulation on the existing designated WP05 acceptance test account rather than relying only on the previously mixed six-module role. This stage is for **real signed-in browser observation**, not a claim that role separation is already verified through UI.

## Unique target and preserved baseline

- Exactly **one** existing auth account matched the owner-provided designated test address; identified within guarded SQL and no account identifier/email/JWT exported into this repository record.
- Before stage 1: six and only six canonical permission rows, with **can_view=true and can_edit=false** for modules CBM, CSR, CCC, MCM, PPM and PRM.
- Each original `meta` field records previous owner-authorised view-only WP05/WP06/WP12 acceptance; **all original meta fields retained**, rows retained, all Edit bits preserved as false. `updated_at` changed for the six rows as an audit of stage transition.
- This account is a test account only; no other personnel account, group, role helper, RLS policy, view definition, privilege grant, application source or sensitive Costing data was changed.

## Exact stage-1 effective state (read back live)

| Module | can_view | can_edit |
|---|---|---|
| Cost Build Manager | false | false |
| Cost Sheet Review | **true** | false |
| Costing Control Center | false | false |
| Material Cost Manager | false | false |
| Pricing Policy Manager | false | false |
| Production Route Manager | false | false |

Guarded `BEGIN / COMMIT` SQL verified one exact account, six exact expected original rows with all six View bits true and all Edit bits false, then set **only CSR View true** and other five View bits false. Postcondition required six rows, exactly one CSR View true, five View false, six Edit false. A separate query against `public.v_user_permissions_effective` confirmed all six expected states.

## Browser test protocol: Stage 1 CSR-only (pending owner observation)

1. Fully sign out and sign back in to SASV PWA with the already authorised test account to obtain fresh session/permission visibility.
2. Verify **Cost Sheet Review (CSR)** navigation is available, and CCC, CBM, MCM, PPM and PRM navigation/module access is not independently available. Record only expected navigation outcome, without identifying details.
3. On a **known populated period/SKU**, open CSR's Detailed SKU Cost Sheet. Ensure actual detailed cost sections appear; a summary/list row is insufficient because `fetchSkuDetail` has an empty-result fallback.
4. Open a known populated Cost Sheet line's **Explanation / Traceability** and confirm real explanation/evidence is shown; dialog alone is insufficient.
5. Return only: `CSR nav yes/no`, `other modules restricted yes/no`, `Detailed Cost Sheet populated/empty/error`, `Trace explanation populated/empty/error`, and test date/build if readily available. Do not share cost values, SKU IDs, evidence JSON, JWTs, supplier names or staff details. Empty can be denial or no data; require known populated source.
6. **Do not** test any Save, Close, Edit, approved preview, costing refresh or writer RPC. If modules remain visible, investigate permission freshness without attempting a client workaround.
7. Owner observation is needed to advance to **Stage 2 CCC-only**; **do not auto-advance or immediately restore** because that would invalidate the owner's pending CSR-only browser check.

## Planned next stages (NOT YET APPLIED)

- Stage 2: **CCC View-only**, verifies detailed SKU Cost Sheet positive while full line Traceability is withheld; also CCC Acceptance Register positive. This is the critical production distinction of CSR Option C. Need known populated line and do not treat 200 with empty array as conclusive without cross-validated data.
- Stage 3: **MCM View-only**, verifies Manual Rate Register, History and Material Acceptance positive; CSR detailed/full trace negative as intended.
- Stage 4: **PPM View-only**, verifies Scheme Master History positive and other sensitive costing sources restricted.
- Stage 5: **CBM/PRM and no-view negative categories** as appropriate; neither should accidentally unlock the six privileged sources. Avoid unnecessary broad cycles; decide based on missing evidence.
- Final stage: **restore the original six View-only true / all Edit false** baseline and verify exact effective rows; preserve all pre-existing meta and do not create or delete permission rows. Restoration only after owner finishes stages or explicitly instructs rollback.

## Control and programme state

- No new actual browser test has occurred within this SQL operation; **Stage 1 awaiting owner PWA check**.
- Existing R46 six-view catalogue acceptance and isolated PostgreSQL design tests remain valid, but do not substitute for effective signed-in test results.
- Formal WP05 **6/13**, technical **4/7**, W5-06 **OPEN**; other W5-03/04/07/08/09/10 and D-4 holds remain as recorded.

This record allows progressive and reversible permission testing without creating fake accounts or changing real personnel privileges. Any future stage must independently guard and verify the expected previous stage before updating the designated test identity.
