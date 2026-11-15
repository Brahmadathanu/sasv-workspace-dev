# WP09 G1 — Reconciled launcher / section IA audit (15 November 2026)

**G1 technical audit READY for owner completion decision. WP09 OPEN; programme 9/13. G2 implementation NOT AUTHORISED.** This is the corrected audit in existing draft PR #434 for issue #432. Recommendations below are unapproved. No launcher source, registry, SQL, permissions, flags, deployment or Electron routes changed.

## Evidence provenance and main reconciliation

- Original Claude audit: base `5735321c4524a9f93947435bd1eccb0f7d7cf9ae`, original head `4c5e114d00f0359a45787f705fd78e53f725021d`. Its container lacked database access. Its 92-page inventory and 77 candidate rows were source evidence, not the live registry. Historical author-reported tests: source 50/50, synthetic Chromium 33/33, WP08 fail-closed 81/81.
- ChatGPT subsequently captured metadata using read-only SELECT on Supabase project `qhmoqtxpeasamtlxaoak`; snapshot/addendum were on refreshed PR head `f678730290a3f67319894ffad4893fd8051f8b2e`. This review uses that exact committed capture; it does not repeat the completed live investigation or claim another SQL capture.
- Refreshed main `e5693623e71ae60d0d613498f4e76c99be7214ef` adds only `MASTER_PROGRAMME.md` and the authoritative new-chat handover through #435. Main was merged into this branch without changing the handover bytes. Full history is available for baseline guards.
- Evidence: `WP09_G1_EVIDENCE/live-registry-snapshot-2026-11-15.json`, regenerated `module-group-mapping.csv`, `non-launcher-pages.csv`, `option-coverage.json`, `registry-verify-result.csv`, and `g1-reconciliation-tests.json`. Snapshot is metadata only; no user grants, private data or credentials.

## Live registered inventory and exact mapping

85 module definitions (6 inactive); 120 navigable client rows = **79 Electron / 41 PWA**; 38 Electron-only; all PWA keys also on Electron; 11 active sections. No orphan assignment or duplicate destination. These are registrations before per-user grants, not a claim that every user sees every tile.

All **79 exact Electron keys and 41 PWA keys are mapped**, without alias substitution. Each CSV row records canonical source owner, registered per-client route, resolved static path, live label/section/order/target/minimum nav mode, and Option A/B/C design data. All 92 source pages partition into 79 mapped owners and 13 shell/auth/redirect/source-only pages. Registered child pages remain registered routes.

| Original candidate problem | Corrected disposition |
|---|---|
| Missing `coa-print`, `edit-log-entry`, `sop-editor`, `sop-viewer` | Four independent live-key rows added. Child-page purpose does not authorise removing a launcher or its permission target. |
| `manage-tally-inv-mapping` | Bound to live `tally-inv-mapping`; source filename retained. |
| `lab-test-method-master` | Bound to live `test-method-master-manager`; page-internal permission string recorded separately. |
| `lab-workflow-access-control` | Bound to live `lab-workflow-access-control-manager`; page-internal permission string recorded separately. |
| `production-overrides`, `manage-season-profiles` | Removed from live-key map; retained in source-only appendix. Neither is a live registered launcher. |
| Sixteen source-inferred section differences | Option A section values now exactly match live sections; L12 requires zero moves. |
| Six Costing modules | `costing-control-center`, `material-cost-manager`, `cost-build-manager`, `pricing-policy-manager`, `cost-sheet-review`, **`production-route-manager`**. All six map to the Costing family; distinct routes and grants retained. |

## Launcher behaviour and ranked findings

| Finding | Evidence and implication |
|---|---|
| Dense sections | Electron Inventory 15, Product/Reference 15, MRP 12. Live grouping differs from a source-domain grouping: three BOM launchers are in Inventory; Product Shelf Life is in Product/Reference; FG transfer and Activities are in Work Log. A/C preserve these placements. |
| Search / personal access | Source proves two Electron label-only search surfaces with different locked-item handling; PWA has no search or Quick Access. Electron pins are per-user browser-local, maximum 10; recents maximum 8 are stored but not rendered. No live usage evidence. |
| Season-profile writer overlap | Source shows `manage-season-profiles.html` and MRP Master Data Console both writing season data. The former is unregistered: a governance question about source writers, not two live launcher cards. Recommend MRP console as canonical, pending owner decision and functional/dependency comparison. No writer is disabled here. |
| Unregistered broken shell | `production-overrides.html` references missing `css/style.css` and `js/production-overrides.js`. Recommend dependency review and later archive/removal of source only. There is no production launcher registration to retire. |
| Legitimate specialised entries | RM/PM issue/rebuild pairs, different stock views, ETL read/control, Costing six and WP08 redirect stubs retain independent purposes. Stock-item vs bulk class mapping are related; lab workspace vs entry/queue overlap remains undetermined. No consolidation authorised. |
| Fallback ordering | Source/synthetic evidence proves off-catalog fallback ordering can precede catalog sections. **Both Product Shelf Life and Staff Directory are present live**, so their missing-row injection path is dormant for this capture. A defensive G2 fix remains useful; no current missing registration asserted. |
| Permission-name differences | `test-method-master-manager` registry target vs `lab-test-method-master` page checks; `lab-workflow-access-control-manager` vs `lab-workflow-access-control` page checks. Shared normalizer does not alias these pairs. Actual effect is NOT TESTED. Preserve both identities; G2 must not silently add aliases, repoint targets or alter checks. WP12 needs positive/negative/view-only page acceptance before release, and any demonstrated disclosure is a blocker. |
| Section coupling / names | Electron groups by label; icons/colours use fixed section keys. Plant Sections/Subsections and two category taxonomies need clearer display names. B would require coordinated registry and client work. |
| Root-only source | 27 mapped canonical pages are root-only by source layout. This differs from the 38 Electron-only registrations; source presence does not grant PWA registration. No porting approved. |
| Sort ties | MRP order 110 (`plant-occupancy`, `vendor-master`) and Product order 95 (`pricing-policy-manager`, `production-route-manager`) sort deterministically by label. Not a confirmed defect; no SQL cleanup needed for G2. |
| Legacy precache / links | Two stale ETL precache paths remain a hygiene candidate. Static cross-link scan is limited and does not establish absence of JS navigation. Pricing unknown destinations stay text-only. |

## Options recomputed from live keys

| Measure | A — subheadings in live sections | B — domain re-sectioning | C — families layered on A |
|---|---|---|---|
| Coverage Electron / PWA | 79/79; 41/41 | 79/79; 41/41 | 79/79; 41/41 |
| Electron top-level tiles | 79 | 79 | **36** |
| PWA top-level tiles | 41 | 41 | **24** |
| Populated sections Electron / PWA | 11 / 7 | 9 / 9 | 11 / 7 |
| A subgroup headings Electron / PWA | 34 / 23 | See mapped B subgroup | Same as A |
| Registry changes | None | Required; separate approval | None |
| Rollback | Revert presentation contract | Restore captured sections + client maps | Return to A / flat tiles |

Option C counts are **section-scoped**: identical family names in different live sections do not collapse across those sections. Singleton families count as one tile. Electron has 25 section-family cards + 11 flat tiles = 36; PWA has 16 + 8 = 24. Counts describe maximum registered inventory before grants; actual family visibility must be computed from already permission-filtered children. The historical **30** estimate from 77 candidates is superseded. Grouping the six Costing entries as one family is a proposal included in these counts, not approval.

| Electron live section | Registered modules | C top-level tiles |
|---|---|---|
| admin | 5 | 3 |
| bmr-production-records | 1 | 1 |
| inventory-sales | 15 | 7 |
| mrp-procurement | 12 | 6 |
| planning-workspace | 4 | 3 |
| plant-assets | 5 | 1 |
| product-reference-master | 15 | 5 |
| qa-qc | 9 | 3 |
| sops | 3 | 1 |
| system | 4 | 3 |
| work-log | 6 | 3 |

`option-coverage.json` also records every PWA section. PWA Option B populates nine domains, not the original rough estimate of six to eight.

**Recommendation: approve A, then C**, with shared search and local personal Quick Access. Keep all current registry keys, targets, routes and live sections; family cards are presentation containers, never replacement permission targets. Search results and pins stay at module level and can reach children without manually opening a family. Empty families disappear; locked children follow existing visibility rules; do not invent new permissions. B offers domain consistency but adds registry mutation and retraining; defer it.

## Verification and classifications

| Gate / suite | Corrected-review result |
|---|---|
| Offline registry L1–L12 (18 explicit rows, including per-client route ownership) + S1–S3 full-capture integrity | **PASS 21/21** against committed capture; full CSV retained |
| Source contracts | **PASS 50/50**; added disjoint mapped/source-only classification assertion |
| Metadata / mapping mutation suite | **PASS 22/22**: correct PWA base resolution; missing registrations/keys/definitions; stale source-token key; alias masking; duplicate key/destination; wrong existing page owner; missing file; orphan/inactive section; section move; unknown client all detected |
| WP08 G2-1 source / resolver; SW freshness | Fresh **PASS 13/13, 8/8, 15/15** |
| WP08 historical G2-0 source guards | Fresh **11/13 PASS, 2 FAIL**: unchanged historical diff-scope guards (`sw.js diff is 18 lines`; `costing-suite-recommended-ui-route.js`). No guard weakened. |
| WP08 registry SQL suite | Fresh **1 PASS / 17 SKIPPED**, PostgreSQL server binaries unavailable. Historical author-reported **18/18 PASS** retained, not relabelled as fresh. |
| Launcher Chromium | Historical Claude **33/33 PASS**, synthetic registry/grants, 390/1280. Fresh rerun **BLOCKED**: bundled browser absent; system Chromium cannot create required socket (`Operation not permitted`). No launcher source changed. |
| WP08 fail-closed | Historical Claude **81/81 PASS** (synthetic and mutation-sensitive); browser rerun unavailable here; not a new live acceptance claim. |
| Live role visibility/page access, installed PWA, packaged Electron, Windows release, real usage | **NOT TESTED**; WP12 obligations remain OPEN |

The verifier now resolves PWA relative URLs from `/utilities-hub/index.html`, checks every mapping key regardless of original basis, rejects alias substitution, requires one row per exact live key, validates canonical ownership or an existing redirect, and fails on Option A section moves. It only reads local files; it does not contact Supabase.

Reproduce from repository root:

```sh
node scripts/wp09-g1-launcher-audit/build-evidence.mjs docs/master-data-costing/WP09_G1_EVIDENCE
node scripts/wp09-g1-launcher-audit/registry-verify.mjs docs/master-data-costing/WP09_G1_EVIDENCE/live-registry-snapshot-2026-11-15.json docs/master-data-costing/WP09_G1_EVIDENCE
node scripts/wp09-g1-launcher-audit/source-contract.test.mjs
node scripts/wp09-g1-launcher-audit/registry-mutation.test.mjs
```

## ChatGPT independent review of Claude PR

The original missing-key blocker is resolved: exact keys, canonical source ownership, live-section preservation, both-client routes, 92-page partition and derived option coverage have been reviewed against the snapshot and source. Mutation checks demonstrate that the corrected verifier rejects the original missing-key and stale-key classes. Main #435 documentation is preserved. Runtime files and protected migration bytes are unchanged in the PR.

**Verdict: G1 technical deliverables are ready for the owner to accept as a completed audit.** Browser limitations do not become PASS and do not establish G2/release acceptance. No G2 implementation, merge or WP09 formal closure is implied. The owner's IA/business decisions below are still needed to make G2 concrete. This is ChatGPT's review and correction of Claude's package, not a new external reviewer approval.

## Owner decisions to record before G2

| ID | Decision | Recommendation / consequence | Status |
|---|---|---|---|
| D1 | Accept G1 reconciled audit with test classifications | Accept bounded source/metadata audit; retain historical synthetic/browser limitations and WP12 acceptance | Pending owner |
| D2 | IA direction | A then C; keep current sections and registry unchanged. Defer B. | Pending owner |
| D3 | Canonical season-profile writer | Prefer registered MRP Master Data Console, after parity/dependency review. Source-only page disposition requires its own approved change; no writer removal in launcher work. | Pending owner |
| D4 | Legacy source cleanup | Review references to unregistered production-overrides, then propose archive/removal separately. Never call this launcher retirement. | Pending owner |
| D5 | Six Costing entries | One visual family containing all six including Production Route Manager; preserve individual targets/routes, pins and search results | Pending owner |
| D6 | PWA search / Quick Access | Add both; shared permission-filtered search across Electron surfaces and PWA; per-user local pins, no backend sync | Pending owner |
| D7 | Root-only source / child routes | No PWA expansion or removal of registered child pages in this package | Proposed boundary |
| D8 | Naming / hygiene | Clarify plant/taxonomy display labels; defensive fallback and stale precache cleanup only with approved G2 scope | Pending owner |

No recommendation is an automatic approval or a default authorisation. `WP09_G2_SINGLE_CLIENT_PACKAGE_2026-11-15.md` provides one substantial Claude Code Cloud package to activate only after these decisions are recorded. ChatGPT retains orchestration, read-only metadata verification and independent review; no additional handover is required.

## Protected programme boundaries

WP08 and PEC stay closed. WP11 PM BOM mobile overflow (UX-P05) and SKU Deactivate contrast (#429) remain unresolved in their owning work pack. WP12 inherits all security/negative-role, 11-flag, hosted resolver, installed-PWA, packaged-Electron and Windows obligations, including WP08 receiving cases W12-WP08-01…08 and the two lab permission-name checks described above. No historical failure, NOT TESTED result or residual is cleared here. Five CRLF-only `supabase/migrations/20261112*` worktree differences remain untouched and excluded. Programme stays **9/13** until separate formal closures.
