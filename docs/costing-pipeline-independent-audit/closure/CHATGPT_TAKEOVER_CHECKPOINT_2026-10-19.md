# ChatGPT takeover — server-side costing closure checkpoint
Date: 2026-10-19 (IST); successor to handover/CHATGPT_HANDOVER_2026-10-19_PART3.md (commit 0074e69)
Owner: ChatGPT for read-only audit, server-side implementation preparation and verification while Aryabhatta usage is unavailable.
Authority: Existing Closure Mandate and user approvals P1–P38. **No new live deployment, policies, switches, cron, run, designation, merge or Sheets edit without user approval.**

## Verified independently upon takeover
1. Handover Part3 accessible on branch, content read and interpreted. Existing PROGRAMME, ISSUE_REGISTER, G1 evidence, CI034 prepared SQL, 15-capacity checklist, DVS-1 86-SKU worksheet accessible.
2. Live `costing.fn_verify_run_fingerprint`: approved run 122 = 50 table signatures, zero mismatches; run 128 = 51 signatures, zero mismatches.
3. `public.v_costing_pricing_price_revision_feed_approved` returns 1,261 rows. Do not consume for pricing until G6 signoff.
4. `cron.job`: job 60 OFF; job 61 OFF. `costing.plant_aware_load_switch`: no entries (G4 OFF).
5. `costing.plant_capacity_profile`: 298 historical revisions across 171 plants; latest readiness 74 BLOCKED_NEEDS_CAPACITY, 74 READY_PROVISIONAL, 20 NOT_REQUIRED, 3 NOT_OPERATIONAL.
6. G1 forensic documentation establishes prime = materials + manufacturing/packing labour + internal material conversion (IMC); 9 nonzero IMC bridges (7 >= ₹0.01), no balancing plug. October/September full arithmetic reconciled in earlier evidence; reproduce during G6.

## Server execution queue and approval boundaries
A. **G2 first:** reproduce plant-specific priority-15 blocker map from canonical register; audit equipment-route assignment and `named machine > step rule > class fallback > fail closed` behaviour, quantities, units and current R2 values; investigate CI-032 labour concentration with representative product steps and documentary normal capacity. Do not invent missing machine capacities. Draft deterministic zero-write probes and isolated G4 simulations. Set evidence tags to distinguish user-declared actual capacity from fallback/scenario provisional; no approval-state mutation without explicit authority.
B. **G3:** independently classify the 86 flagged demand SKUs, recognizing multi-causal tags and mutually exclusive reason groups. Avoid blanket acceptance of event/stockout defaults absent product evidence; investigate rate-source staleness 12.8%, modern rate-selection choices and 60% flag as approved transition P37. Test OFF vs ON DVS-1 with rollback-only isolated replay.
C. **G4:** inspect and locally test prepared CI-012 and CI-034. CI-012 forward-only may conflict with legitimate retrospective purchasing/source corrections and with user's need for timely October reruns; carefully state limitations before seeking approval. CI-034 label-only must not modify forecasting. Verify W2 nine RPCs and closure/supersession safety; jobs remain paused until authorised.
D. **G5** begins after acceptance of G2–G4. Build full atomic approved cost waterfall feed without promotions and with performance tests, including IMC, manufacturing/packing labour, loaded and marketing components, landed-cost labelling, traceable source effective dates.
E. **G6** full independent tests; register G1–G5 signoffs, TB4 dashboard, migration parity, 9 margin/37 reviews and access-control evidence; no price Sheets before final user go-ahead.

## Priority evidence already in repository
- `closure/evidence/CAP/CAPACITY_P1_15_MACHINES.md`: machine 126 oil press affects 137 products; 130 juice press 95; 119 firewood dryer 63. Differing tray dryers 141/149 and firewood dryers 119/146 must stay individually identified.
- `closure/evidence/DVS1/DVS1_REVIEW_WORKSHEET_86.csv` includes proposed event, stockout, seasonal and launch dispositions but these are **not user-approved**.
- `closure/prepared/PREPARED_CI034_valuation_anchored_basis_status.sql`: prepared only. Same for CI012.
- `closure/ISSUE_REGISTER.md`, `closure/ISSUE_REGISTER.json`: canonical status.
- Read-only fingerprint verification must run before and after each authorised deployment.

## Next user decision packet (do not assume consent)
- TB4: user checks Supabase API exposed schema list for `costing`; no dashboard access presumed by connector.
- CI-012 and CI-034 production approval only after ChatGPT review of exact SQL, guards and regression tests.
- 15 machine values: source actual operating charges supplied by plant, not arbitrary inferred values.
- 86-SKU demand dispositions: approve reviewed individual evidence, not entire CSV by default.
- Revival of stage worker job 61 and periodic job 60 only after dry-run contracts and controlled operating window.

## Reporting convention
Maintain chronological evidence in this directory, updating canonical register and PROGRAMME when a gate changes. G0 DONE; G1 arithmetic/lineage VERIFIED; G2/G3/G4 open; G5 NOT STARTED; G6 NOT READY. No claims of completed server closure until all gates pass.
