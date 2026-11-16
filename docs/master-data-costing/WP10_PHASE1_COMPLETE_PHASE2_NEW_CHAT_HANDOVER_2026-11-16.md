# WP10 Phase 1 complete — authoritative new-chat handover

**16 November 2026. Repository: Brahmadathanu/sasv-workspace-dev. Supabase: qhmoqtxpeasamtlxaoak. Owner is final authority.**

## Current authority and status

Source/history registration #443 is merged at `ab3c525aaeaedc5f788c8c934d231794ed24d2a5`. This handover is a subsequent documentation-only update; fetch current main before working. Programme is **10/13 formally closed (WP00–WP09)**. WP10, WP11 and WP12 remain OPEN. Do not count application or source merge as formal closure.

Owner-approved source merges: #439 G1 (`ee3def823295c105fcef7f821418e887e0612699`), #441 default-off safeguards (`a3816a3f20994ff2a391dcd0627f5d350fc2aeae`), #442 corrected preview (`d20a8991200df5fbf9e99e1a16478d62c3e2245e`), #443 Phase 1 registration (`ab3c525aaeaedc5f788c8c934d231794ed24d2a5`). Do not reopen or repeat these reviews without new evidence.

The owner explicitly approved the exact Phase 1 application review with “Yes go ahead”. ChatGPT then applied immutable proposals **01 → 02 → 03 → 06**, once each, using the connected Supabase migration tool. All succeeded. Their source copies and exact path/hash/branch registry entries are merged. **Do not reapply them.**

| Proposal | Actual migration version | SHA-256 |
|---|---|---|
| 01 clock/batch size | 20261116022440 | 0077b90fffbf9bd9c770ab55b85e81e8110d1c6c0a8a17135ba71bee4620dab3 |
| 02 essentials/boundaries | 20261116022501 | ef4cd91f693c220a614db3f7640afb301126b47626cde93e792b393b27c74b31 |
| 03 horizon RPC | 20261116022517 | dea309c07d0ff6726b04d9ed4d56e190c6d2afda9628a06996df133e7dfb0ce5 |
| 06 impact preview | 20261116022528 | abb291fe26bce9ac2618eca5325b4cb82392a262d895585e87b9746cc8f9217f |

## Completed evidence — do not repeat the investigation

- Live PostgreSQL 17.4: history **699→703**, exactly four additions; all 699 earlier version/name pairs unchanged. **11 functions, zero WP10 triggers**; definition receipts, owners, STABLE/SECURITY DEFINER and fixed search paths verified.
- Two new public RPCs have authenticated EXECUTE; anon/service_role denied. Nine private helpers deny ordinary caller EXECUTE. Sixteen existing table ACL/RLS states and four additional auth/permission/PM-BOM function definitions/owners/ACLs unchanged. Nine pinned dependencies matched. Security advisors seven before/after, zero new notices.
- Approved bounded installer check: read-only transaction, eight-second local timeout, ten operational SKUs/products, today's IST date. Well-formed essentials/route/boundary results; NULL-context negative returned INVALID. Single batch **493.347 ms**. This is neither public-RPC/JWT acceptance nor p95/scale/all-SKU readiness acceptance.
- #443 reviewed head `7ce80e26ef9c65b70a5a7ac899acb48b955235cc`: final offline CI **300 PASS / 0 FAIL / 0 SKIPPED**, run `43794722118`, job `133060808267`, artifact `14194247399`. Registry guard audit **80/80**; PEC run `43794722284` SUCCESS. Source-registration golden assertion corrections preserved the existing hash/branch enforcement algorithm. No client runtime or applied SQL changed.
- Earlier 286 preview-source results, G1 five NOT PROVEN bounds and known baseline failures remain historical evidence; do not relabel them live acceptance. Claude's original sessions lacked database access; later independent captures/application do not rewrite that provenance.

## Read first

Paths below are relative to `docs/master-data-costing/`:

1. This handover, `MASTER_PROGRAMME.md` and `WP-10-FUTURE-CREATION-SAFEGUARDS.md` (top current banners override older milestone text).
2. `WP10_SQL_PHASE1_APPLIED_AND_VERIFIED_2026-11-16.md` and `WP10_SQL_PHASE1_EVIDENCE/application-receipt-2026-11-16.json`.
3. `WP10_SQL_PHASE1_EVIDENCE/preflight-and-legacy-invariants-2026-11-16.json` and the approved `WP10_SQL_PHASE1_EXACT_APPLICATION_REVIEW_2026-11-16.md`.
4. `WP10_G2_UNAPPLIED_SQL_APPLICATION_MANIFEST_2026-11-15.md`, `WP10_G2_UNAPPLIED_SQL_PROPOSALS/README.md`, proposal 04 and proposal 05. The old UNAPPLIED payload headers are immutable drafting history; the receipt-aware manifest gives current status.
5. `WP10_G2_OPERATOR_RUNBOOK_2026-11-15.md`, `WP10_WP12_IMPACT_PREVIEW_RECEIVING_CASES_2026-11-15.md`, issue #440 and merged #443 checks.
6. For guard locking review: `WP10_G1_EVIDENCE/independent-live-catalog-2026-11-15.json`, `live-guard-catalog-2026-11-15.json`, existing guard fixtures under `scripts/wp10-g2-safeguards/` and actual writer/trigger dependencies. Read full definitions, not filtered snippets.

## Immediate remaining work

Start with an independent **Phase 2 guard review**, prepare concrete corrections/evidence if needed, then prepare the exact separate owner decision. Do not apply SQL on the strength of earlier “go ahead” messages: those authorised the recorded Phase 1, not deferred blocking guards.

**New review question, NOT a proven defect:** verify cross-flow concurrency between the first SKU activation and a product subgroup edit that changes route resolution. Existing P7 concurrency fixtures cover two concurrent product edits, not this activation-versus-edit case. Filtered captured source shows SKU-row locking in `rpc_set_product_sku_active`; the full parent trigger/FK/lock chain has not been independently reviewed for this case. Read the complete closure and, if warranted, reproduce with two sessions in an isolated synthetic PostgreSQL fixture. Never exercise a production writer or a rollback-based production rehearsal. Products.id/sub_group_id are integer; product_skus.id/product_id bigint; these types were checked read-only and are not themselves a demonstrated defect.

Blocking guard 04 SHA-256: `5aca56751901ee5c7c2ff17baec01cec728a1abdfd68fa70b3cc489eeae1c0e7`.
Blocking guard 05 SHA-256: `89aacb0f0a10f537e1de7b1b5b9633d4bf6975e6e82146039251b14e9da3239c`.
They would add three functions and three triggers and enforce immediately even with the client flag OFF. Both remain **UNAPPLIED**. Any revision invalidates these proposed hashes and needs a refreshed exact manifest/independent review/owner approval. Rollback 99 also remains UNAPPLIED and unauthorised.

Real JWT/module-role and public HTTP/PostgREST endpoint acceptance, actual endpoint timeout/production-scale performance, hosted resolver links, installed PWA/update/activation/warmed/offline cache behaviour, packaged Electron/Windows and real-device acceptance are **NOT TESTED**. Plan only bounded authorised acceptance; carry WP12 receiving cases and distinguish each evidence class. The named operational rebuild-owner nomination remains a follow-up; programme owner stays accountable until nominated.

## Boundaries to preserve

- `WP10_SAFEGUARDS_V1` remains default-off; no activation, rollout, deployment command, production business writer, build/scheduler, automatic deactivation, permission/RLS/table-grant/registry change or guard application without separate authority. Phase 1's exact new-function grants/history registrations are completed exceptions, not blanket permission.
- Do not reopen WP08 or Procurement Execution Console. Preserve WP09 closure/flag and WP11 PM BOM mobile overflow and SKU Deactivate contrast defects (#429), plus all inherited WP12 security/PWA/Electron release obligations.
- Leave the five CRLF-only historical `supabase/migrations/20261112*` changes untouched, unstaged and undiscarded. Use isolated worktrees and explicit file allowlists; never `git add -A` or checkout/reset those files.
- ChatGPT handles repository orchestration, connected Supabase read-only checks and independent review. If substantial client work is required later, use one context-aware Claude Code Cloud package. No package has been dispatched by this handover.
- WP10 remains OPEN and completion stays 10/13 until a separate formal owner closure decision. Keep docs/issue current after every material gate. Do not request another handover or repeat completed registry/catalog/application work.
