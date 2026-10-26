# L. Entry plan: SKU 41 Dhanyamlam 1000 mL and SKU 846 Gorochanadi Vatakam 300 g
Prepared 26 Oct 2026 (IST). READ-ONLY research. Nothing has been written. Every entry below needs the user's go-ahead.
Live guard result (as of 26 Oct, CI-038a live):
- SKU 41 is missing 3 items: the approved PM BOM, the MRP policy and the selling/GST policy.
- SKU 846 is missing 5 items: the approved PM BOM, the batch size reference, the production route, the MRP policy and the selling/GST policy.

## Toast explanation
- The activation toast comes straight from the server. `rpc_set_product_sku_active` raises "This SKU cannot be made active yet. Missing: <labels>." using all labels from `costing.fn_sku_activation_missing_items`.
- The client (`js/products.js`, `surfaceRpcError`) shows `error.message` unchanged, and it does not truncate.
- The 3-item text the user quoted (PM BOM, MRP, Selling/GST) matches SKU 41 exactly. For SKU 846 the server would list 5 items.
- So the quoted toast was almost certainly the Dhanyamlam one. This is not a client bug, and no fix is needed.

## SKU 41 Dhanyamlam 1000 mL (product 51)
| Item | Current | Proposed entry (screen / RPC) | Rollback |
|---|---|---|---|
| MRP | Policy #6 IK 125 / OK 150, ok_pct 0.2, AUTO, LEGACY_BASELINE, effective 1 Apr 2025 to 15 Jul 2026 (closed) | Pricing Policy Manager > MRP (`rpc_set_sku_mrp_policy`): sku 41, IK 125, OK 150, ok_pct 0.20, calc_mode AUTO, effective_from 26 Oct 2026, reason "Re-activation of 1000 mL pack; MRP restated per Dr. Brahmadathan U 26-Oct-2026", approval ref e.g. PPM-SKU41-REACT-20261026. This yields source MANUAL_ENTRY/GOVERNED. | Before use: `rpc_cancel_scheduled_sku_mrp_policy` (cancel with reason), or deactivate the SKU and leave the policy, which is harmless. After use in a run: leave it and supersede with a new policy. Never delete. |
| Selling/GST | None ever | Selling & scheme policies (`rpc_set_sku_selling_price_policy`): GST 5, IK disc % 0, OK disc % 0, IK/OK disc amount NULL, contingency 2, effective_from 26 Oct 2026, remarks "Copied from sibling policies #742 (2000 mL) / #698 (5000 mL)". | Set is_active=false / effective_to through the same screen before any run uses it. Unique key is (sku_id, effective_from). |
| PM BOM | Working header #41 (tpl 44 "1000 mL_Regular"): L1 1 L PET Bottle (1443) ×1, L2 1 L PET Bottle Cap (1458) ×1, L3 Label - Dhanyamlam 1 L (1643) ×1 (SKU override). No revision. | PM BOM Manager: create draft (`rpc_plm_bom_revision_create_draft` sku 41, 26 Oct), then approve (`rpc_plm_bom_revision_approve`, effective_from 26 Oct, change_reason "Re-activation baseline; same pattern as approved 2 L/5 L revisions 61/62", approval ref e.g. PLM-PM-BOM-SKU41-20261026). | Draft: `rpc_plm_bom_revision_cancel`. Approved: supersede with a new revision. Never delete. |
| Batch size | OK: ref #36 (1155, active) | none | - |
| Route | OK: family 101 (Shuktham), map #424 | none | - |

BOM comparison: the siblings are 2 L (rev 61: 2 L HDPE jerry can 1345 + Label 2 L 1644) and 5 L (rev 62: 5 L jerry can 1428 + Label 5 L 1645). The 1 L pack follows the same structure: container, closure and pack-specific label, all ×1, with no wastage and no carton. The only real difference is that the PET bottle has a separate cap line, while the jerry cans include the cap. That is not a scaling difference. The user's remark "BOM doesn't change with pack size" holds for the RM BOM, which is product-level. The PM BOM is pack-specific by nature, so we approve the existing working BOM as is. Mirroring the 2 L lines would put the wrong container in.

## SKU 846 Gorochanadi Vatakam 300 g (product 667; sibling 845 250 g inactive; no active sibling)
| Item | Current | Proposed entry | Rollback |
|---|---|---|---|
| MRP | Policy #442 IK 285 / OK 285, ok_pct 0, closed 15 Jul 2026 | IK 285, OK 285, ok_pct 0.00, AUTO, effective 26 Oct 2026, same reason pattern, ref PPM-SKU846-REACT-20261026 | as SKU 41 |
| Selling/GST | None | GST 5, IK/OK disc % 0, disc amounts NULL, contingency 2, effective 26 Oct. Pattern taken from Kurinji Kuzhambu 400 g #1118 and every Sep-2026 governed row (all 0 discount). | as SKU 41 |
| PM BOM | Working header #1710 (tpl 111 "400 g_Regular"): 400 G PP Jar with Cap Milky White (1320) ×1, 400 G PP Wad (1379) ×1, 250 G x 12 Nos Carton (1456) ×0.166667 optional, General Label - Special Products (1676) ×1 override | Approve as is ONLY if the user confirms 300 g is filled in the 400 g jar and wad, and confirms the carton factor 1/6 (6 jars per carton). Otherwise fix the lines in PM BOM Manager first. Then draft and approve as for SKU 41. | as SKU 41 |
| Batch size | None for product 667 | Batch Sizes (`rpc_create_supply_batch_size_reference`): product 667, preferred 62 kg, min 62, max 62 (or user values), effective 26 Oct, reason "Activation of 300 g pack; from RM BOM reference output 62 kg / BMR SP797". | `rpc_inactivate_supply_batch_size_reference` |
| Route | No family map at product, subgroup 59 or group 33 level; no product route | see below | Draft routes/maps: cancel. Approved: supersede/inactivate via Production Route Manager (`rpc_inactivate_product_route_family_assignment`, `rpc_supersede_product_route`). |

RM BOM, verified now: header #2277 was updated 26 Oct 2026 at 14:29 IST, so the user's reorder is in. Reference output is 62 kg, process loss 2%, 30 lines:
- Lines 1-26: herbs at 0.8 kg each.
- L17: Kolarakku (475) 0.8 kg.
- L27: Jeerakam (333) 20.8 kg.
- L28: Kozhi Mutta (496) 640 Nos (uom 5).
- L29: Gorochanam (293) 0.005 kg.
- L30: Karuppatti (419) 20 kg.

The only BMR on record is SP797, at 62 kg.

## Route: compare and recommend
Kurinji Kuzhambu (product 660) runs on family 33 LEHYAM_KASHAYAM_SWARASAM, family route 39, with product route #63 (v2) on top. The effective steps are:
RM_ISSUE > RM_WASHING > RM_DRYING > +PERUMKAYAM_CONTROLLED_DRYING (seq 35) > DISINTEGRATION > PULVERIZATION > SIEVING > PRESSURIZED_EXTRACTION > STAGED_PROCESS_MATERIAL_DISPENSATION > JUICE_EXTRACTION > LEHYAM_PROCESSING > PASSIVE_COOLING > [bypass STAGED_POST_COOLING_PMD] > [bypass POST_COOLING_BLENDING] > QC_ASSESSMENT > FG_TRANSFER

User route for Gorochanadi: RM_ISSUE > RM_WASHING > RM_DRYING > PULVERIZATION > SIEVING > STAGED_PMD (Kolarakku, Karuppatti, Gorochanam, Kozhi Mutta) > VESSEL_PROCESSING > PASSIVE_COOLING > QC_ASSESSMENT > FG_TRANSFER

| Kurinji step | Gorochanadi | Action if mapped to family 33 | Action if mapped to family 35 (route 41) |
|---|---|---|---|
| RM_ISSUE / WASHING / DRYING | same | none | none |
| PERUMKAYAM_CONTROLLED_DRYING | absent | (Kurinji product-only, not inherited) | n/a |
| DISINTEGRATION | absent | BYPASS 422 | BYPASS 451 |
| PULVERIZATION, SIEVING | same | none | none |
| PRESSURIZED_EXTRACTION (Kashayam) | absent | BYPASS 425 | not in family |
| STAGED_PROCESS_MATERIAL_DISPENSATION | same | none | none (step 454) |
| JUICE_EXTRACTION (Swarasam) | absent | BYPASS 427 | not in family |
| LEHYAM_PROCESSING (act 66, vessel) | VESSEL_PROCESSING | keep, or REPLACE 428 with act 238 | keep 455, or REPLACE with act 238 |
| PASSIVE_COOLING | same | none | none |
| Post-cooling dispensation + blending | absent | BYPASS 430, 431 | BYPASS 457, 458 |
| QC, FG_TRANSFER | same | none | none |

Recommendation: do NOT map to Kurinji's family 33. Gorochanadi has no Kashayam and no Swarasam phase, so it would need 5 bypasses, and that contradicts the family's definition ("Kashayam + Swarasam").
- Map product 667 to the existing family 35 LEHYAM_PRAKSHEPA_ONLY (route 41, "Lehyam — Prakshepa Choornam only"). Nine Lehyams already use it, including Karunai Lehyam, whose product route #61 bypasses the same two post-cooling steps.
- Then create one product route on route 41 with 3 overrides:
  - BYPASS_STEP 451 (DISINTEGRATION).
  - BYPASS_STEP 457 and BYPASS_STEP 458 (no post-cooling material).
- A fresh family is not needed.
- On VESSEL_PROCESSING versus LEHYAM_PROCESSING: Gorochanadi is an Andaja Lehyam, so keeping LEHYAM_PROCESSING (activity 66, PROCESSING_VESSEL, the same resource class) is the natural fit. Use REPLACE_STEP to activity 238 only if the user wants the generic vessel activity for costing.

Route entry order (Production Route Manager):
1. Batch size ref first, because the product route must reference a batch_size_ref of the same product (validator BATCH_REFERENCE_PRODUCT_MISMATCH).
2. Family assignment draft (`rpc_create_product_route_family_assignment_draft` product 667, family 35, effective 26 Oct, basis MANUAL, note), then submit and approve (`rpc_approve_product_route_family_assignment`, ref e.g. PRM-MAP-667-F35-APP-20261026).
3. Product route draft (`rpc_create_product_route_draft` product 667, base 41, batch_size_ref = new id, effective 26 Oct, source MANUAL, evidence MANUAL_COMPLETE, note), then overrides via `rpc_upsert_product_route_override` (BYPASS 451/457/458 with reasons), then `rpc_validate_product_route`, submit and approve (ref PRM-PR-667-V1-APP-20261026).

## Order for both SKUs
Enter all items with effective date 26 Oct, then activate in Manage Products (reason + ref). For SKU 846, enter the batch size first, then the family map, then the product route. All of these screens exist in the UI, so no DB write by us is required. If the user prefers that we enter them, each RPC call is a live write and needs explicit approval plus a Jarvis FYI.

## Open questions for user
1. SKU 846 PM BOM: confirm the 300 g pack uses the 400 G PP jar with cap, the 400 G wad, the 1/6 carton (6 per carton) and the General Label. Alternatively, is there a 300 g jar or label?
2. Batch size for Gorochanadi: is 62 kg (RM BOM reference, BMR SP797) right? Give preferred/min/max.
3. Route: confirm mapping to Lehyam — Prakshepa only (F35) with bypass of Disintegration and the two post-cooling steps. Keep "Lehyam processing" as the vessel step, or use the generic Vessel processing?
4. Approval references to quote, or accept the suggested ones.
5. Check: RM line 27 Jeerakam 20.8 kg looks out of pattern versus the herbs at 0.8 kg. Is this intended? Note that Kolarakku is at 0.8 kg.
