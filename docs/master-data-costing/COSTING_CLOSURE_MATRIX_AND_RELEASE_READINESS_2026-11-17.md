# Costing Suite — WP10/WP11/WP12 closure matrix, residual register and release-readiness decision

**17 November 2026 | Documentation only | Builds on PR #465 (head `2765ff2`) | No production, SQL, permission, flag, cost-run or publication change | No workpack closed by this record**

## 1. Authenticated-session availability (established this session)

| Check | Result |
|---|---|
| Browser / Playwright storage state, SASV env vars, Supabase credentials present in the execution environment | **None** |
| Attached owner machine or browser tool with a signed-in SASV session | **None** |
| Anonymous reach of hosted site | HTTP 301 only (login redirect class); proves nothing about roles |

**Result: BLOCKED.** No legitimate authenticated session exists in this environment. No credentials were requested or used. Sections 4A–4E of the task (role matrix, period context in UI, CSR endpoint timing, 390px populated BOM, genuine flags, seven JWT-based denials) are therefore **NOT TESTED by this session**. They need the owner-supervised procedure in [COSTING_FINAL_EXISTING_ACCOUNT_OWNER_WITNESS_2026-11-17.md](COSTING_FINAL_EXISTING_ACCOUNT_OWNER_WITNESS_2026-11-17.md) (Phases A–C), or `acceptance-runner.mjs` run on the owner's machine with `capture-storage-state.mjs`. Strict runner identity checks (canonical permission proof, zero edit grants for pure ID-V) are **not relaxed**. Narrower evidence from the visual procedure must be labelled "existing-account visual witness", never "automated acceptance" or "pure View-only".

## 2. Closure matrix

Legend: PASS = receipt exists; NT = not tested; BLK = blocked; N/A.

| Item | WP | Status | Evidence / gap |
|---|---|---|---|
| 12 classification RPCs live; Phase 1 SQL 01/02/03/06 | 10 | PASS | Installed and verified 16 Nov |
| Four classification clients merged (flag default OFF) | 10 | PASS (source) | Merged; installed-Electron entitlement NT |
| 05/CL15/RM1 preventive guards | 10 | NOT APPLIED (draft #463) | Offline CI 44023016328 PASS; live preflight 12/12; deployment stops open (see §5) |
| SKU Deactivate contrast #448 | 11 | PASS (source+mock) | Genuine visual legibility NT |
| PM BOM 390px overflow #449 | 11 | PASS (mock) | Populated-data `scrollWidth<=clientWidth` NT |
| Hosted Costing assets 74/74, shared masters, SW v393 | 12 | PASS (16 Nov bytes) | Final-candidate freshness and installed controller NT |
| 11-flag mocked sweep 21/21 | 12 | PASS (mock) | Genuine OFF/ON/OFF NT |
| Windows unpacked: build, ASAR 30/30, localhost 26/26, login renderer | 12 | PASS (run 44055823446) | Not NSIS/ZIP installed |
| Six-module roles Editor/View/No-access | 12 | NT | Needs owner session |
| Period context Sep 122 locked / Oct 143 (not 148) / Nov 152 unapproved | 12 | PASS at DB view level (17 Nov read-only); UI NT | UI mislabelling is a release blocker if seen |
| CSR default-OFF normal read status/timing | 12 | NT | Release STOP on repeatable 500 (#273) |
| PPM Scheme Master list/history | 12 | NT | Owner session |
| Seven sensitive-view JWT GET denials | 12 | NT | Metadata parity 7/7 is not JWT denial |
| NSIS/ZIP, install, update, rollback, classification entitlement | 12 | NT | Gated on the above |

**Workpack counts unchanged: 10/13 CLOSED. WP10, WP11, WP12 OPEN.**

## 3. Release blockers versus accepted residuals

**Release blockers (any one stops release):** unapproved run (148/152) shown as approved pricing; confidential individual staff data exposed to restricted roles; writer controls active for View-only/No-access; reproducible normal-path 500 in CSR Cost Comparison; stale served bundle or SW not at candidate version; any of the seven sensitive views readable by a restricted JWT.

**Currently no confirmed critical defect exists.** No code change was warranted; nothing was invented to "fix".

## 4. Bounded residual-risk register

| ID | Residual | Owner decision needed | Containment |
|---|---|---|---|
| R1 | WP10 05/CL15/RM1 not installed: no DB-level activation lock/target-identity guard; broad authenticated group/subgroup CRUD; legacy reasonless 2-arg RPC | Defer (recommended) with named owner | Phase 1 + default-OFF clients; Route Manager UI only writer path in practice |
| R2 | Historic 7 product / 10 family overlapping superseded route pairs | Accept as pre-existing, no remap | Documented G2/CI-032 |
| R3 | CSR Cost Comparison default-OFF path historically intermittent 500 (#273) | Accept proven normal read or separate mode decision | Scoped flag stays OFF globally |
| R4 | `COSTING_LOCK_SCREEN_V1` Close Quarter view-only exposure | Keep OFF | No flag change in release |
| R5 | Classification masters are Electron-only routes; absent on hosted PWA by design | Accept | Do not report as PWA failure |
| R6 | Mock-based evidence (WP11 390px, flags) until genuine witness | Owner witness before close | — |

## 5. WP10 PR #463 disposition recommendation

**Recommend DEFER, do not apply, not part of this release.** Do not merge or run on `qhmoqtxpeasamtlxaoak` under generic "proceed". Before any future production-SQL decision the owner would need separate assessments of: (1) installed Electron fleet calling the reasonless 2-arg RPC; (2) other route writers and hierarchy-parent writers (direct group/subgroup DML); (3) lock budget/concurrency on live tables; (4) security-definer and role JWT behaviour; (5) the exact SQL checksum generated from the final files plus tested receipt-scoped rollback; (6) post-install smoke. Deferral with named residuals R1–R2 and a receiving owner may support closing WP10 **only if the owner so decides**; deferral alone does not close it.

## 6. Exact owner decisions and actions remaining

1. **Provide a witness** (owner, or me given an attached supervised session): run Phase A–C of the 17 Nov witness procedure; return the redacted row format. Alternatively run `capture-storage-state.mjs` + `acceptance-runner.mjs` locally with a qualifying pure ID-V/ID-N.
2. **WP10:** accept DEFER of #463 with R1–R2 and named owner — yes/no; then decide WP10 closure.
3. **WP11:** close after genuine 390px populated BOM + Deactivate visual witness.
4. **WP12:** close only with real-role matrix, seven JWT denials, flag ON/OFF protocol, Windows installed proof; or state which NT slices are accepted as named residuals.
5. **CSR mode** (R3) and **lock-screen flag** (R4) dispositions.
6. **Publication:** explicit release SHA + version approval (current package version 6.1.0; SW v393) after §7 passes.

## 7. Electron release-readiness decision

**NOT READY TO PUBLISH.** Engineering candidate is sound (static, mock, unpacked-Electron evidence all PASS), but required authenticated Costing acceptance is NT, and NSIS/ZIP install, update, rollback and entitlement checks are not executed. Sequence once item 1 passes with no blocker: freeze release SHA → CI Windows NSIS+ZIP build (extend `costing-windows-unpacked-rehearsal.yml`) → record package digests and embedded SW/client versions → owner-run installed read-only smoke incl. classification masters → update from prior release and revert test → owner approval of SHA/version. Windows installation testing needs the owner's Windows machine; this Linux container cannot supply it.

**Progress:** 10/13 CLOSED; WP10–12 OPEN; release publication not authorised.
