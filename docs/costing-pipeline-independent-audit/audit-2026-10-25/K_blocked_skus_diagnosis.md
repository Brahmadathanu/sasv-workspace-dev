# K. Blocked SKU activations: diagnosis (26 Oct 2026, read-only)

## Verdict: TRUE DATA GAP, not a guard bug. Both SKUs have no live MRP, selling/GST policy or approved PM-BOM on ANY date.

### SKU 41 Dhanyamlam 1000 mL (product 51, inactive). Guard check as of 22 Oct: missing PM-BOM, MRP, Selling/GST (batch size and route OK).
- MRP: policy #6 (IK 125 / OK 150) APPROVED legacy baseline but CLOSED effective_to 15 Jul 2026 (closed when inactive SKUs were retired). Nothing after.
- Selling/GST: no row ever. Siblings 2000 mL (#742) and 5000 mL (#698) have GST 5%, contingency 2%, 0 discounts from 1 Sep.
- PM-BOM: working header #41 exists ("via tpl 1000 mL_Regular") but NO approved revision. Siblings 42/43 got approved revisions on 10 Sep (ref PLM-PM-BOM-RUN94-2026-09-10); 1000 mL was skipped because it was inactive.
- Product MRP derivation policy #1 exists but is DRAFT (unconfirmed), so it cannot derive 1000 mL MRP.

### SKU 846 Gorochanadi Vatakam 300 g (product 667, inactive; sibling 250 g also inactive).
- Guard actually reports FIVE missing items: PM-BOM, batch size reference, production route, MRP, selling/GST (toast may have been read partly).
- MRP: policy #442 (IK/OK 285) closed 15 Jul 2026. Selling/GST: none. PM-BOM: header #1710 built from "400 g_Regular" template (check it is the right pack), no approved revision. No active batch size, no approved route for the product.

## False-block tests
- Checked at 26 Oct, 31 Dec 2026, 31 Dec 2027: still MISSING. Not a date problem, not draft-hidden, not keyed to another SKU id.
- All 1,166 inactive SKUs: 0 have any of the three items that appear only after 22 Oct. 48 are complete today. No hidden false blocks.
- Readiness snapshot only covers active SKUs, so it never showed these.

## One real design trap (fix prepared)
The guard checks as of the period date (22 Oct). If the user enters the new policies effective TODAY (26 Oct), the guard will still block until November opens on 2 Nov.
MRP & selling policy back-date guard is AUDIT_ONLY (frozen-through 22 Oct), so entries dated 22 Oct would be accepted but logged as back-dated.
Prepared fix CI-038a (UNAPPLIED): /workspace/migrations-prep/PREPARED_UNAPPLIED_ci038a_activation_asof_today.sql, as-of = greater of period date and today (IST). Rollback = re-create original function.

## Steps for the user (per SKU)
1. Pricing Policy Manager > MRP: new MRP policy (IK/OK, OK %), reason + approval reference; effective from today (needs CI-038a) or 22 Oct (no fix, logged as back-dated).
2. Pricing Policy Manager > Selling & scheme policies: GST 5%, contingency 2%, discounts (copy siblings).
3. PM BOM Manager: review the working BOM, then freeze/approve revision with an approval reference (same date rule).
4. Gorochanadi only: Batch Sizes (Supply / Batch Plan) and Production Route Manager (approved route for the product).
5. Activate in Manage Products.
Not verified: exact UI button names/approval steps on each screen; the PM-BOM revision approval trigger's date rule.
