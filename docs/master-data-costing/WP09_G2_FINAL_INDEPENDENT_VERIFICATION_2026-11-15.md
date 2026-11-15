# WP09 G2 — Final independent verification and merge recommendation (15 November 2026)

**SOURCE / MOCKED VERIFICATION ACCEPTED. READY FOR OWNER MERGE AUTHORITY.** WP09 remains OPEN, programme 9/13. No merge, retarget, deployment, production flag activation or registry/permission change performed.

## Exact reviewed state
- G1 #434: `7584c0f04cae2b4a713a12fe46b2db1fac580835`, still draft/unmerged, targets main.
- Main: `e5693623e71ae60d0d613498f4e76c99be7214ef`.
- G2 #437: `b26c7c3454f03cb2199999080095404cb7cb6e70`, still draft/unmerged, correctly targets #434 branch.
- The two commits after ChatGPT correction `9a26db7b8fd643d638583c1c8159ec7bc065bed0` change tests/docs/evidence only. ChatGPT independently compared all seven runtime files byte-for-byte: all identical to the reviewed correction.

## Evidence reconciliation
ChatGPT read the corrected verification record and all five corrected-head result JSONs. Counts and individual results reconcile:
- Extended G2 Chromium: 87/87 PASS, including the five pending-permission/account-change checks.
- G1 flag-OFF Chromium: 33/33 PASS.
- G2 contract: 38/38 PASS; source/scope: 23/23 PASS.
- Actual-lifecycle/storage regressions: 5/5 PASS.

These are Claude-executed, committed offline/mocked results independently inspected by ChatGPT, not new local browser runs or authenticated production acceptance. G1 registry/source/mutation 21/21, 50/50, 22/22 and WP08 navigation/resolver/SW/SQL 13/13, 8/8, 15/15, 18/18 remain reported in the verification record. WP08 historical G2-0 source retains 11 PASS / 2 FAIL. Its fail-closed browser suite was not rerun; historical 81/81 remains historical.

The first extended run's 86/87 was a mutation-test issue: the hardened clear/reset made the old stale-scope mutant inert. The revised mutant disables both the reset and scope re-derivation, while M6 retains the unmodified-code control. The resulting positive detection tests a real bypass of the layered defence; it does not weaken production code or relabel a failed runtime result. Independent review accepts that change.

The earlier independent-review HOLD for missing corrected-head browser evidence is **resolved by these committed results**. Original failures, fixes, 82/82 author evidence and screenshots remain historical and are not overwritten.

## Implementation dispositions
Separate G2 branch: accepted. Recents non-display: accepted within implementation discretion. Default-off `LAUNCHER_PRESENTATION_V1`: unchanged, no activation. Current registry keys/sections/routes/permission targets and client asymmetry remain; 36/24 presentation counts and six-Costing family remain.
Keep the five historical CRLF-only migration differences untouched and unstaged; do not discard them for cosmetic cleanliness.

## Recommended integration sequence — pending owner authority
1. Merge docs/audit/authority PR #434 at its reviewed head, using a normal merge that preserves ancestry for the stacked PR.
2. Retarget #437 to main; inspect the new main pin and confirm the runtime diff, accepted authority and evidence remain intact. Refresh checks for any actual new drift.
3. Merge #437 only after that exact-head/base check and normal required checks. Keep the presentation flag OFF.
4. Record resulting main SHA and any normal hosting-pipeline outcome honestly. Repository merging may trigger the configured hosting pipeline; no manual deployment or activation is included in this recommendation.

The owner previously authorised implementation and explicitly excluded merges/deployment. This recommendation is concrete and reviewable; it is not additional merge authority. No further implementation handover is required.

## Remaining gates, not cleared
WP12 retains live editor/read/locked/denied page acceptance, negative roles, hosted resolver links, installed PWA, service-worker update/activation and old-controller/stale-dependency/warmed-offline cases, packaged Electron/Windows and final flag/release obligations including W12-WP08-01…08. The two lab permission-name differences remain NOT TESTED. Season-profile FK/RLS/role evidence, Products-link dependence and F-A/F-B/F-C remain separate follow-ups; no legacy writer or page is removed. WP11 PM BOM mobile overflow and SKU Deactivate contrast #429 remain unresolved in their owning work pack. WP08/PEC remain closed. No formal WP09 closure or programme-count advance is recommended by this source integration decision.
