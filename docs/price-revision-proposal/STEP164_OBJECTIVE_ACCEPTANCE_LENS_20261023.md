# Step 164 — Objective acceptance in assumed-versus-recommended lens (23 October 2026)

User authorized direct addition of objective-based acceptance to the existing read-only `ASSUMED VS RECOMMENDED MRP` tab (gid 166349787) of `SASV - PRICING & PROMOTIONAL VIABILITY`.

Added column Q `OK Objective Acceptance`, formula-driven off current lens O (`OK Evaluation Viability`), which itself references `PROMOTIONAL VIABILITY - OK` AP. For a SKU with assumed OK MRP: PASS → ACCEPTABLE; BELOW TARGET → BELOW TARGET; other status → CHECK INPUT. Blank assumed OK MRP → NO OK ASSUMPTION. No redundant calculation of profit or new policy. Column format consistent with blue read-only formulas. Existing MRP comparison and recommendation columns untouched.

Live verification across 439 assumed, OK-price-listed SKUs: 378 ACCEPTABLE, 61 BELOW TARGET, zero formula errors or classification inconsistencies. The 13 SKUs with NO RECOMMENDATION are correctly classified BELOW TARGET rather than automatically accepted; all 13 are marketing 7+1 scheme revisions. The tab will recalculate as profitability objectives, promotions and assumptions change.

No policy, master data, discount, proposed scheme, or assumed MRP changed; Supabase untouched.