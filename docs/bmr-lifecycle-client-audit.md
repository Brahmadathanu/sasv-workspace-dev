# BMR lifecycle client audit

## Protected operational selectors

- Work-log creation (`js/log-add.js`) and status workflow (`js/update-log-status.js`) query only `ACTIVE` rows from `bmr_details`.
- Work-log editing (`js/log-edit.js`) offers only active alternatives while explicitly retaining the historical item/BN already stored on the record.
- Supply Batch Plan candidate lists and bulk single-candidate mapping (`js/supply-batch-plan.js`) revalidate candidate IDs against `bmr_details.lifecycle_status = 'ACTIVE'`.
- Administrative remap candidates (`public/shared/js/bmr-admin-correction.js`) use the same active-ID guard.
- Laboratory FG sample creation (`public/shared/js/lab-analysis-entry.js`) revalidates the picker view's BMR IDs against active BMRs.
- The BMR-not-initiated operational report (`public/shared/js/bmr-card-not-initiated.js`) excludes superseded and cancelled BMRs.

Historical displays are not remapped: Manage BMR History/All, existing work-log edit values, correction history, production records and laboratory records retain their stored BMR identity.

## Remaining gaps / server dependencies

- `map_batch_to_bmr_by_bn` is also reachable through the Supply Batch Plan free-text “Map by BN” action. It is not a selector and therefore cannot reliably disambiguate lifecycle client-side without duplicating the server's product/BN resolution. The RPC must reject non-ACTIVE targets; server enforcement must be independently verified before release.
- `bmr_card_not_initiated` and `lab.v_sample_receipt_fg_batch_picker` do not expose `lifecycle_status` in the checked-in generated types. The client performs a second authoritative lookup against `bmr_details`; the server-owned views should also exclude non-ACTIVE rows for defense in depth.
- Lifecycle transitions are intentionally absent from the client. They must remain governed by the administrative-correction/server workflow.
- Live-data confirmation that BMR 3036 and 3037 are `SUPERSEDED`, and that their replacement rows are `ACTIVE`, requires the in-progress server migration/data correction and is not asserted from repository fixtures.
- The read-only anonymous REST verification attempted on 2026-10-20 returned HTTP 401, so an authenticated independent verifier must perform the 3036/3037 live-data checks.
