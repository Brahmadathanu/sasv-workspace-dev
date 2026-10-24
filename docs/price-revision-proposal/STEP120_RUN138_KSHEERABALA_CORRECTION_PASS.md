# Step 120 — G0 Ksheerabala corrected: RUN 138 live verification PASS

2026-10-22. User explicitly authorised backend date and supersession. October cost_period valuation_date changed 2026-10-20 -> 2026-10-22 with cost_period_governance_audit entry; joint policy id2 effective 2026-10-22 only, id1 from 2026-10-23; no overlap. Backend authorization ID7 (source CHAT_AUTHORISED_BACKEND_ADMIN, user approved), new full refresh run138 created and all six stages SUCCESS. Stage3 initial default statement timeout was rolled back; rerun with 240s statement_timeout succeeded. run136 remains approved and preserved; run138 has not been approved.

Four lineage records policy2 verified at run138:
DL p183 original52.793104, shared corrected33.312197454545, new total34.721631454545; p184 original2.686320, corrected0.626226545455, new total0.719046545455.
POH p183 original56.564040, corrected37.013552727273, new total38.436987727273; p184 original2.984800, corrected0.695807272727, new total0.791357272727.

10mL SKU comparison from sku_internal_loaded_cost_snapshot:
product183 SKU191 old run136 material35.708 labour13.036 overhead9.886 COP59.421 loaded66.888; new run138 material35.708 labour9.343 overhead6.592 COP52.436 loaded59.903.
product184 SKU193 old run136 material12.928 labour60.034 overhead56.560 COP131.140 loaded138.608; new run138 material12.928 labour17.586 overhead14.618 COP46.788 loaded54.256.

Company-wide cost pool reconciliation run138:
DIRECT_LABOUR total1369652.00, allocated equals1369652.00 (manufacturing product allocation + packing component).
PRODUCTION_OVERHEAD total670935.04, allocated equals670935.04 (one product allocation each; SKU rows repeat).
Numeric residuals solely arbitrary precision.
G0 Ksheerabala **runtime and pool allocation PASS**. Run138 NOT YET APPROVED. Next user workflow: (2) enumerate costing component taxonomy, (3) rebuild complete properly named current approved/latest-run price revision view, (4+) Google Sheets staged build. **Do not use previously transferred run136 tab as current proposal master.**
