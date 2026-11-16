# WP10 — CL18/CL19 CI acceptance correction (2026-11-16)

## Completed CI
- [CL18 original run #34](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43808836909): completed SUCCESS, CL18 PASS.
- [Candidate correction run #35](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43808960321): completed SUCCESS, CL18 PASS.
- [CL19 run #36](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43809375107), job `133107353720`: completed SUCCESS, CL18 and CL19 PASS.

## Critical interpretation correction
Both CL18 and CL19 rejected the active SKU reparent with **`WP10_ACTIVE_SKU_REPARENT_REJECTED`**, issued by the existing proposal-04 guard, instructing deactivation before reassignment. Therefore these tests establish the **active-reparent prohibition** in the isolated fixture, **not** that the experimental parent-lock recheck was exercised or that active reparent is a permitted production workflow. Previous assertions that they prove destination-parent lock correctness must not be used for sign-off.

The candidate was broadened to check active reparent as defence-in-depth, but it is not the governing control for the demonstrated path. Prioritize the permitted SKU activation and product subgroup/route mapping writer races, including privilege paths and lock ordering. Keep proposal 04/05 unapplied and no WP10 closure until independent correction-only migration/rollback review and owner authorization.
