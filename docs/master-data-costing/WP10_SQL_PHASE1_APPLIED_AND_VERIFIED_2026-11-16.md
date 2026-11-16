# WP10 SQL Phase 1 — Applied and verified

**16 November 2026 IST. Phase 1 APPLIED on `qhmoqtxpeasamtlxaoak`. Flag OFF; guards 04/05 UNAPPLIED. WP10 OPEN, programme 10/13.**

## Authority and immutable payloads

The owner replied **“Yes go ahead”** to the [exact Phase 1 review](WP10_SQL_PHASE1_EXACT_APPLICATION_REVIEW_2026-11-16.md): files 01 → 02 → 03 → 06, their published hashes, 11 new functions, the two scoped new-RPC EXECUTE grants, four migration/history source registrations, and bounded read-only postchecks. ChatGPT executed through the connected Supabase migration tool. This records the owner's instruction, not a signature.

All four application calls returned success; no retry, rollback, guard installation or client activation occurred. Source base: `daa63cea280c7ddd0c4e878ed0ddaf300920b823`. The exact applied SQL is mirrored under these generated history versions; the original reviewed payload bytes and hashes are unchanged.

| Version | Reviewed file | SHA-256 |
|---|---|---|
| `20261116022440` | 01 clock/batch-size | `0077b90fffbf9bd9c770ab55b85e81e8110d1c6c0a8a17135ba71bee4620dab3` |
| `20261116022501` | 02 essential states/boundaries | `ef4cd91f693c220a614db3f7640afb301126b47626cde93e792b393b27c74b31` |
| `20261116022517` | 03 horizon RPC | `dea309c07d0ff6726b04d9ed4d56e190c6d2afda9628a06996df133e7dfb0ce5` |
| `20261116022528` | 06 impact preview | `abb291fe26bce9ac2618eca5325b4cb82392a262d895585e87b9746cc8f9217f` |

[Machine-readable application receipt](WP10_SQL_PHASE1_EVIDENCE/application-receipt-2026-11-16.json) records actual definitions, receipts, owners, ACLs, versions and postchecks. [Preflight and legacy invariants](WP10_SQL_PHASE1_EVIDENCE/preflight-and-legacy-invariants-2026-11-16.json) retain the read-only query and before/after catalog comparisons. Source headers saying UNAPPLIED describe the immutable reviewed payload at drafting time; this application register and the generated manifest give current status. Do not rerun an applied file or rewrite its reviewed bytes.

## Actual server verification

| Check | Result / classification |
|---|---|
| Migration history | PASS: **699 → 703**, exactly the four named additions; all 699 prior version/name pairs retained |
| Installed objects | PASS: **11 functions**, owner postgres, STABLE, fixed search paths, SECURITY DEFINER; every definition receipt matches; **zero WP10 triggers** |
| New RPC grants | PASS (catalog): only horizon/preview executable by authenticated; anon/service_role denied; all nine private helpers deny ordinary caller EXECUTE |
| Legacy objects | PASS (catalog): 16 existing table ACL/RLS states and four auth/permission/PM-BOM function definitions/owners/ACLs unchanged |
| Pre-application dependencies | PASS: 9/9 pinned definitions match; four additional auth/permission/PM-BOM definitions match; expected absent names; PostgreSQL **17.4** |
| Private-helper execution | PASS (bounded installer read): ten operational SKUs/products, today's IST date, well-formed five-essential/route/boundary results, and a NULL-context negative control returned INVALID rather than VALID |
| Read-only enforcement | PASS: transaction read-only ON, local timeout 8 seconds; no business writer/activation/deactivation/preview-as-write/build/scheduler or auth-claim spoofing |
| Measured sample | **493.347 ms** for this single private-helper batch. Not a PostgREST endpoint duration, p95, cold-cache benchmark, scale test or JWT role acceptance |
| Security advisors | Seven notices before and after; **no new notices**. Existing inherited findings are not resolved or reopened by this stage |

The sampled essential sets were RESOLVED and stored-subgroup route states VALID; this is an observation of ten current-date reads, **not** a governed-period readiness approval or evidence about all SKUs. No actual public-RPC HTTP/JWT identity test was performed.

## Repository registration and test classification

The approved `server/wp10-g2-read-only-phase1` lane carries only these four hash-identical new migration copies and four exact path/hash/branch entries in the existing server registry. The five historical CRLF-only migration differences are untouched and unstaged. No generic SQL/SW exemption, existing migration edit or client runtime change is introduced.

The old draft-only assertions that no WP10 migration could exist are updated to enforce the **actual owner-applied receipt plus exact payload hashes**. New/changed/unregistered paths remain rejected, and a new migration delta is accepted only on the named server lane by the unchanged hash-and-branch enforcement logic. The source RPC surface is pinned to the exact merged call-site multiset (including one preview call and the same writers), replacing the obsolete claim that the preview must always be new relative to current main. The manifest is receipt-aware; payload hashes stay unchanged.

Preparation/inventory negative controls: 14 local PASS, including wrong project/stage, altered hashes, unrelated SQL/SW, wrong lane, missing context, extra/missing source copies, duplicate versions and foreign paths. Static/generator checks: 25 local PASS. Full current-branch CI status is recorded on the source-registration PR; neither local nor CI fixtures are labelled live-role acceptance.

The first source-registration PEC CI run stopped at its legacy exact-registry-key assertion (seven historical keys). That assertion now lists the four approved WP10 payloads explicitly as well, retaining exact-list enforcement and every prior pin. Twenty added controls assert exact hash/lane acceptance and wrong-hash/wrong-branch/missing-context/unrelated-SQL/SW rejection. This was source inventory reconciliation; no production SQL was retried or altered.

## Final source-registration receipt — 16 November 2026

PR [#443](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/443) merged normally at **`ab3c525aaeaedc5f788c8c934d231794ed24d2a5`**, reviewed head `7ce80e26ef9c65b70a5a7ac899acb48b955235cc`. No runtime or applied payload changed in the registration corrections.

- Final [WP10 offline CI](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43794722118), job `133060808267`: **300 PASS, 0 FAIL, 0 SKIPPED**. Artifact `14194247399` contains the run evidence.
- Protected-path registry audit: **80/80 PASS** (60 prior controls plus 20 exact-registration rejection controls). PEC run `43794722284`: SUCCESS.
- Current-head checks were success/neutral before merge; Netlify deploy-preview status was success. This is CI/preview status, not hosted/installed production acceptance or a production deployment command.
- The 300 results are offline/isolated PostgreSQL/mocked Chromium evidence. The ten bounded live private-helper reads above remain a separate classification.
- [Authoritative continuation handover](WP10_PHASE1_COMPLETE_PHASE2_NEW_CHAT_HANDOVER_2026-11-16.md) records the remaining guard-review and release gates.

## Remaining gates

- **Guards 04/05 remain UNAPPLIED.** Their future authority must acknowledge immediate blocking behaviour independent of the browser flag. Existing live writers were not exercised as a rehearsal here.
- `WP10_SAFEGUARDS_V1` remains OFF; no controlled browser-local trial or production rollout was authorised by Phase 1.
- Public endpoint/JWT roles, module-view/no-access behaviour, actual PostgREST timeout/scale performance, installed PWA/cache lifecycle, hosted routes, packaged Electron/Windows and real devices remain NOT TESTED. Keep the WP12 receiving cases and classify any subsequent bounded evidence accurately.
- No rollback is authorised or executed. Before any rollback compare the actual owner/ACL capture as well as definition receipts; the reviewed rollback supports subsets but must not drop modified/foreign objects.
- Formal WP10 closure remains a separate owner decision. Preserve WP08/PEC closure, WP09 closure/flag, both WP11 defects, all inherited WP12 obligations and G1/known baseline bounds. Programme **10/13**.
