# Step 125 — October costing run140 formally superseded and approved (22 Oct 2026)

User expressly authorised resolving last two reviews and completing final governed cost refresh/approval, with Sheets only afterward.

Kasthoori terminal RM item424, source of internal product277 Balasarvangam Mukkoottu through intermediate item1080 Balasarvangam SG Cap and SKU54, rate4950, LAST_PURCHASE dated2026-04-24; material review acceptance ID1702 recorded with matching fingerprint e78736afd12622714aee83b86cd8c908. This accepted the stale historic rate as costing evidence, not a current market-price assertion.

Brihat Chagaladi Ghritham SKU1771 IK marketing is acceptance-eligible; regional evidence current run139 fingerprint a8844495127104923619a7dd05339f05 accepted ID728. Current IK monthly regional qty0.0989625 and marketing cost match approved run136; do not transfer older 16 Oct fingerprint (qty1.18755). Both acceptance records explicitly identify administrative backend execution under user's chat authorisation; no JWT impersonation.

Supersession authorisation ID9 consumed. Full costing run140, valuation date2026-10-22, all six stages SUCCESS, 627 READY/0 REVIEW_REQUIRED/0 BLOCKED. costing.fn_w2_run_checks(140,'SUPERSEDE') returned ok=true, 13/13 PASS, immutable fingerprint25 clean.

Atomic backend administrative supersession transaction performed under advisory period lock and full W2 checks including confirmed approved run136, authorization9, counts. costing.rpc_designate_costing_run old136 REVOKED designation8 and new140 APPROVED designation9; governance RUN_SUPERSEDED audit via costing.fn_w2_audit with explicit admin provenance and IDs1702/728. Independently verified designation rows. Does not represent an authenticated owner-login RPC. Historical run136 retained. Do not create another run casually.

WARNING: costing.v_price_revision_feed_approved is NOT limited to latest approved run: live query returned 1261 rows, minimum refresh_run_id122, maximum140. Any price revision view/tab MUST explicitly filter to run140 or governed latest current APPROVED run designation; never copy all rows. Existing baseline Google sheet run136 is obsolete and shall not be used for proposal pricing.

Next user sequence: Stage2 enumerate complete per-SKU cost components from run140. Stage3 audit and reconstruct current price revision feed/views. Stage4+ dedicated SASV - PRICE REVISION PROPOSAL Google Sheets in incrementally verified tabs. Keep independent audit/costing-suite documentation separate.