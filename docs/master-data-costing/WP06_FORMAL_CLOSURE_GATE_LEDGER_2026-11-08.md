# WP06 formal closure gate ledger — 8 November 2026 (issue #220)

**Docs-only, repo-evidence-only audit. Closes nothing. Formal closure stays 5/13 until the owner records WP06 Gate Status.** Base: `main` `4894a7c3f1fe779835a365a5d5855c598da68b93`. No browser session, SQL, flag, deploy or production action was performed. Screenshots and the local `run-20261108` output were **not** opened; they are cited through the committed reports only. Where a committed report does not state something, this ledger says "not established" rather than inferring it.

Sources (S#): S1 `WP-06-PRICING-POLICY-MANAGER.md`; S2 `WP05_WP06_WP12_AUTHENTICATED_ACCEPTANCE_EXECUTION_PACKAGE_2026-11-06.md`; S3 `OWNER_ACCEPTANCE_RECORD_2026-11-04.md`; S4 `PROGRAMME_PROGRESS_AND_CLOSURE_PATH_2026-11-04.md`; S5 `CURRENT_CHECKPOINT_AND_CLAUDE_HANDOVER_2026-11-08.md`; S6 `CSR_PLAN_RECHECK_AND_FIRST_CLOSURE_GATE_2026-11-08.md`; S7 `ACCEPTANCE_14_LENS_EVIDENCE_MATRIX_2026-11-08.md`; S8 `IDV_SELECTOR_SUBTAB_ACCEPTANCE_2026-11-08.md`; S9 `PARKED_BACKLOG.md`; S10 `WP06_G1_TASK_FLOW_AUDIT_2026-11-04.md`; S11 `PROGRAMME_COMPLETION_MATRIX_2026-11-06.md`.

## 1. Answer

**Can WP06 be formally closed now? No.** Delivery (code) gates are met; the acceptance-contract gates (S2 §8) and owner dispositions are not. Nothing in the repo records an owner decision on C9/D7/F-4/C6/D3, and S1's own Final-handover milestone is unchecked.

**Smallest must-do set to 6/13** (none requires new implementation):

1. **M1 Owner dispositions (no code):** record decide-or-park for **C9, D7, F-4** (S1/S3 §6 WP06 wording) and **C6, D3** (S2 §8 requires C6/C9/D3/D7 for WP05 *and* WP06). Recommendations in S3 §4 / S4 §3 need no code.
2. **M2 Mandatory flag-ON proof scoped to WP06:** `COSTING_NAV_GROUPS_V1` ON alone, PPM only, signed-in ID-V, with flags restored OFF with evidence. This is the only flag that alters WP06 behaviour (S1 Approved design). Not shown in any committed signed-in report (S8 ran flags OFF).
3. **M3 Ten-workspace record:** P/F/NA/NT for the ten PPM workspaces at the pinned build, taking credit for existing hosted ID-V evidence and filling only the gaps in §4.
4. **M4 Deferred-item dispositions:** each remaining deferral carries ID/behaviour/reason/risk/milestone/owner acceptance (S2 §8, S9). Rows exist for some; PPM-specific ones need S9 entries (see §3).
5. **M5 Owner Gate Status** edit in S1 (+ final handover) — an owner act.

Everything else in this ledger is deferrable or already PASS. Whether the S2 §8 *six-module* matrix (40 lenses, all 11 flags, CCC/MCM/CBM/PRM rows) is a WP06 gate or only a WP05/WP12 gate is an **OWNER DECISION (G-SCOPE)**: S2 §8 is written "per work pack" and its 40-lens requirement is not scoped to modules; S1 and S3 §6 WP06 closure wording only name PPM items. Recommended reading: scope WP06 to PPM (10 workspaces), cross-module lenses credited to their own packs.

## 2. Gate ledger

Status: PASS / OPEN / BLOCKED / OWNER DECISION. M = mandatory, D = legitimately deferrable.

| # | Gate / contract text | Source | Current evidence (+SHA) | Status | Narrowest next proof | Deferral (ID / owner milestone / risk) | No-change recommendation |
|---|---|---|---|---|---|---|---|
| G-01 M | W6 five-group nav merged, 10 workspaces distinct, OFF = legacy 3-group | S1 Approved design, Milestones; S4 §4 | PR #139 `d395d7e`; 13 unit + 10 Chromium; full LF/CRLF 605/605 pre-merge; blob/tree equivalence of tested head to main (S1) | **PASS** (code); fresh post-merge execution not claimed (S1) | none | – | Keep |
| G-02 M | G1/G1b/G1c/G1d, F-7/F-8/F-9 merged | S1; S4 §4 rows | G1 #152, G1b #154, G1c #155, G1d #153, F-7 #161, F-9 #162, F-8 #163 (S4 §2 table); "No WP06 code remains" (S4 §4.1) | **PASS** (code, mock/synthetic) | none | S10 F-1/F-2 low-severity findings pinned by tests; fixes F-1/F-2 merged per S4 §4 | Keep |
| G-03 M | Verified merged-build signed-in record (WP06 closure wording) | S3 §6; S2 §8 | S8: `main@51cd26f3`, 72/72 assets VERIFIED, cache v392, ID-V, 1280/390; PPM rows 9,10 PASS (S8). `main` has since advanced only by docs commits through `4894a7c` per `git log` for the folder; no source change shown by that log for `public/` was checked by me | **PARTIAL → OPEN** for WP06: only 3 PPM observations at pinned SHA; source unchanged since (§9) | Owner/ID-V session on one pinned build covering M3 | – | Credit S7/S8; do not rerun 40 lenses |
| G-04 M | Build identity verified and authorised by owner | S2 §8, §2 | S8 verification script result VERIFIED at `51cd26f3`; S5 §1.2 hosted `9feffcc5`/v392 | **PASS for evidence build**; owner *authorisation* of that build not recorded in repo → **OWNER DECISION** (confirm S8 build = accepted build) | Owner statement naming SHA | – | One-line owner confirmation |
| G-05 M | ID-V used and verified (6 view, 0 edit) | S2 §1, §8 | S5 §1.2: "verified six view/zero edit grants", S6 §B; S8 header | **PASS** | none | – | Keep |
| G-06 M | All PPM workspaces recorded P/F/NA/NT, no unexplained F | S2 §4, §8 | See §4: 10 workspaces; 0 query failures in S7 | **OPEN** (partial) | Fill §4 gaps | – | – |
| G-07 M | Real-data rows (S2 §5) | S2 §5 | PPM-relevant: S7/S8 counts (proposal register 1 APPLIED; scheme rules 0; CSA 628 rows Oct). Run labels/pointers, S2/S9 are CCC/CSR-scoped | **PASS for PPM-scoped rows**; run-label/S2/S9 rows are CCC/CSR → belong to WP05/CSR | none for WP06 if G-SCOPE = PPM | S2, S9 checks → WP05 | Treat as WP05 |
| G-08 M | Zero mutating requests on ID-V sessions | S2 §6, §8 | S5 §1.2 "0 errors/unauthorised writes"; S8: guard blocked one non-read RPC before leaving browser; S5 §5 no ID-V network preview PASS claimed | **PASS** (client-side guard evidence). "Server-delivered" mutating-request proof is scoped by S6 §B to server-delivered; none observed | Network-name list for the M2 session | – | Keep guard allowlist unchanged (S5 §5) |
| G-09 M | Flags restored OFF with evidence | S2 §0.5, §8 | S8: all `COSTING_*_V1` cleared in isolated contexts; no ON session for WP06 flag | **OPEN** for any M2 session | Flag-restoration screenshot/note after M2 | – | – |
| G-10 M | `COSTING_NAV_GROUPS_V1` ON behaviour (PPM five groups) acceptance | S3 §3 Matrix B; S2 §3(b); S1 Approved design | Only mock Chromium (S1: ON/OFF strips, deep links, 12 legacy URL shapes). No committed signed-in ON report found | **OPEN** | ID-V, local flag override `COSTING_NAV_GROUPS_V1="1"`, PPM: 5-group strip, 10 deep links, default `sku-overview`, no write control; restore OFF | – | Do not turn production flag ON |
| G-11 M/OD | Eleven-flag × six-module matrix (a)–(d) | S2 §3 | Not executed (S2 header; S11 §6). Lock Screen flag ON tested once (S5 §1.4) | **OWNER DECISION (G-SCOPE)**; if required: **OPEN/large** | If not WP06-scoped, record deferral to WP12 | If deferred: new ID, WP12 (11-flag acceptance, S6 §B last bullet), risk: other-flag interaction with PPM untested | Recommend defer to WP12; only G-10 is WP06 |
| G-12 M | C9 registry `periodScoped:false` vs period-scoped CSA | S1 Parked; S3 §4; S4 §4.2 | Behaviour characterised and pinned by CL1 tests (S4 §3(c)); S8 row 10: CSA period switch Nov→Oct PASS (628 rows); S7: PPM picker hidden except CSA by design | **OWNER DECISION** | Owner picks (a) leave/document (recommended in S3/S4) | Deferral to separate shared-registry package already stated in S1 | Park (a) |
| G-13 M | D7 maker-checker on assumptions/default policy/MRP | S3 §4; S2 §8; S4 §4.3 | No policy exists; not a client defect (S4) | **OWNER DECISION** | Owner "park unless policy exists" | Needs S9 row: not found in S9 | Park |
| G-14 M | F-4 integer units | S3 §4; S4 §4.4 | Server question; unresolved | **OWNER DECISION** | Owner "leave to server" | Needs S9 row | Park |
| G-15 M | C6 and D3 dispositions | S2 §8; S4 §3(c) line 109 | **C6** = `COST_APPROVAL_WORKBENCH`/`COST_REVIEW_WORKBENCH` recommended routes unmapped (WP05_A5 register C6; S4 recommends park, keep honest "no dedicated screen"; same as owner item O-8). **D3** = CCC-edit can accept reviews without MCM-edit (S3 §4). Both are CCC/MCM-origin, not PPM; no owner decision on record | **OWNER DECISION** | Owner decide-or-park both | Park both (WP05-origin, no PPM impact) | Park |
| G-16 M | Each deferred item has ID/behaviour/reason/risk/milestone/owner acceptance | S2 §8; S3 §5 | S9 has no PPM-specific rows except CSE-P01 and CCC-P02. Missing for C9/D7/F-4/PRM-style items | **OPEN** | Add S9 rows (docs only) after owner decisions | – | – |
| G-17 M | Read-only role behaviour for PPM (no write control for ID-V) | S4 §4 "verify read-only role behaviour"; S2 §6 | S7: PPM lenses show "view-only" banner (rows 6–8); S8 | **PASS** for observed workspaces; not all 10 | Cover remaining in M3 | – | – |
| G-18 M | S1 Final handover milestone + Gate Status | S1 Milestones/Gate Status/Exit criteria | `[ ] Final handover`; "Final handover: Not started" | **BLOCKED** on owner acts above | Update S1 after G-12..16 | – | – |
| G-19 D | Selector-dependent PRM lenses, mapping/foundation exact-run, historical previews | S7; S5 §2.A/B | PRM, not PPM | **Not WP06** | – | PRM milestone; risk low-medium; preview RPCs VOLATILE SECURITY DEFINER, not in allowlist (S7) | Do not expand allowlist |
| G-20 D | CSR 57014 timeouts | S5 §2.C; S6 §A | Printable/monthly-comparison are Cost Sheet Review views | **Not WP06** | – | CSR/WP05; no new DDL | Defer |
| G-21 D | SEC-A1/A2 server deny-path proof | S2 §1 (needs no-side-effect plan); S11 | NOT TESTED | **DEFER** (programme-level) | – | Needs ID; no writer calls | Defer |
| G-22 D | CDE-2, Windows A14, Electron release | S11 §§1,6; S2 §8 | WP12 only (S2 §8: "WP12 additionally") | **Not WP06** | – | WP12 | – |
| G-23 D | LOCK-P01 (Lock button shown to view-only with flag ON) | S9 | CCC flag; not PPM | Not WP06 | – | CCC fix package; flag stays OFF | Keep OFF |
| G-24 D | `rpc_costing_health_check` classification (RPC-P01), C5/D5, S2/S9 parity | S9; S3 §5 | CCC/CSR | Not WP06 | – | WP05 | – |

## 3. Owner decisions, unaccepted items and disposition table

| ID | Item | Owner decision on record? | Recommendation (from S3/S4) |
|---|---|---|---|
| C9 | period-scoping mismatch | **None found** (S3 §4 column blank) | (a) leave and document |
| D7 | maker-checker | None | park |
| F-4 | integer units | None | leave to server |
| C6 | unmapped `COST_*_WORKBENCH` route (WP05_A5 register; =O-8) | None | park (S4 §3(c))
| D3 | CCC-edit accepts reviews w/o MCM-edit | None | decide or park; record behaviour |
| F4 vs F-4 | Issue text "F4" read as F-4 (S3 §4) | – | confirm |
| G-SCOPE | Is WP06 closure PPM-scoped (S1/S3 wording) or six-module (S2 §8)? | None | PPM-scoped |
| Build | Owner authorisation of S8 build as acceptance build | None in repo | confirm |
| Other unaccepted (not WP06-critical) | O-1/CDE-2, D5, O-7, O-8, O-2 (S3 §4) | None | not required for WP06 |

Deferrable-with-conditions: all S9 rows above unless the owner says a gate. Deferral is legitimate only if the S2 §8 fields are filled (G-16).

## 4. Ten PPM workspaces — evidence at current docs

| Workspace | Evidence found | Status |
|---|---|---|
| `sku-overview` | Default landing pinned by W6 tests (S1). No signed-in observation located in S7/S8 | NT (hosted) |
| `sku-mrp-policies` | mock tests only found | NT |
| `product-derivation-policies` | mock tests only found | NT |
| `mrp-proposals` | G1c mock flow (S4); S8 row 9 shares proposal register | NT (list); filter PASS |
| `proposal-decisions` | S7 row 6, S8 row 9: empty "No proposals awaiting decision", 1 APPLIED proposal; matches source | **P** |
| `approved-for-application` | S7 row 7: empty, consistent with source | **P** (empty confirmed benign, S7 §6) |
| `applied-proposal-history` | not located | NT |
| `scheme-master` | #211/#214: 7 rows, ID-V 6/6 loads HTTP 200 (S5 §1.1) | **P** (cold-start latency not proven) |
| `scheme-rule-register` | S7 row 8: 0 rows, live count 0 | **P** (expected empty) |
| `commercial-sales-assumptions` | S8 row 10: period switch, 628 rows; modals opened read-only: G1b/G1d mock only; S3 §3 modal walk not recorded signed-in | P (data/period); modals NT |

The 119-observation `run-20261108` output and the 40-lens runner results live outside the repo; I did not read them, so lenses that run may cover (e.g. `sku-overview`) could be PASS there. M3 should first check that local report before any new session.

## 5. Flag states (eleven; all default OFF, none activated)

`COSTING_RECALC_WITH_DATE_V1`, `COSTING_APPROVAL_SCREEN_V1`, `COSTING_LOCK_SCREEN_V1`, `COSTING_RUN_STATUS_V1`, `COSTING_UX_CONSISTENCY_V1`, `COSTING_DIALOGS_V1`, `COSTING_TABLE_TOOLS_V1`, `COSTING_REVIEW_WORKLIST_V1`, `COSTING_NAV_GROUPS_V1`, `COSTING_PRM_CORRECTIONS_V1`, `COSTING_PRM_NAV_CONTEXT_V1` (S2 §3). Production state: OFF (S5 §1.4 for Lock; S1 "No flag is activated"). WP06-relevant: **NAV_GROUPS only**. Signed-in ON evidence: Lock Screen only (S5 §1.4); NAV_GROUPS ON not signed-in tested.

## 6. Safe ID-V evidence available

Six view / zero edit grants verified (S5 §1.2, S6 §B); served-asset digest VERIFIED 72/72 at `51cd26f3` (S8); hosted `9feffcc5`/cache v392 acceptance 1280/390, 0 errors, no writes (S5 §1.2); selector/sub-tab session (S8); guard blocked one non-read RPC (S8, S5 §5).

## 7. Outstanding permission/denial tests

- ID-N, ID-X, ID-O negative identities (S2 §1, §6): **NOT TESTED**; whether needed for WP06 is part of G-SCOPE. Recommend deferring to WP05/WP12 and relying on ID-V view-only observation.
- SEC-A1/A2 server deny-path: NOT TESTED; deferral (G-21).
- Server-side write denial for PPM RPCs (e.g. CSA save/close, MRP proposal writers): no no-side-effect plan exists; **do not call writers**. Evidence available is client-side absence of controls plus guard.

## 8. Minimal owner acceptance session (for M2/M3)

Single ID-V session, UI only, pinned build per S8: NAV_GROUPS local override OFF then ON → PPM strip, ten deep links, `?lens=` legacy redirect, default filter; CSA and default-policy modals opened and cancelled; export Network `rpc_` name list; restore OFF. No Preview/Save/Apply/Decide.

## 9. Caveats

`git diff --stat 51cd26f3 HEAD -- . ':!docs'` is empty: no non-docs change since the S8 evidence build, so S8/S5 evidence applies to current `main` source (checked 8 Nov, `4894a7c`). "F4" in the issue is read as F-4 (S3 §4). G-03 text about an unchecked source diff is superseded by this check.
