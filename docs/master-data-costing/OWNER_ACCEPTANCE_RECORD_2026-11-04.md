> **SECURITY HOLD (4 Nov, live read-only audit):** before completing any production-backed signed-in matrix, follow [PRODUCTION_READ_ONLY_ACCEPTANCE_SECURITY_AUDIT_2026-11-04.md](PRODUCTION_READ_ONLY_ACCEPTANCE_SECURITY_AUDIT_2026-11-04.md). There is currently no verified six-module view-only account; exposed material-review acceptance/closure RPCs need a server edit-authorization decision and correction (SEC-A1), and the approval preview creates an acknowledgement under view permission (SEC-A2). Existing test code and the local preview are **not** database isolation. Record signed-in acceptance **NOT TESTED** until cleared; do not use any user with edit rights as view-only proof. `main` at `1e776603` includes #169/#170 test-only merges, not a release or flag activation.

# Owner acceptance record — signed-in checklist and decision sheet — 4 Nov 2026

**Blank form for the owner. Filling it in closes nothing by itself; formal closure remains an owner act recorded in the Gate Status of each work pack.** Written so one signed-in session can unblock WP05, MDC-07, WP06 and the signed-in rows of WP12. All eleven flags stay OFF by default. The ON checks below are **only a proposed test procedure on an owner-authorised isolated non-production client with the merged code**; temporary browser `localStorage` values (key = flag name, exact value `"1"`) never authorise production activation. Use a genuine view-only test role, avoid live writes and sensitive approval actions, and restore and verify all eleven flags OFF at the end. If a suitable test client or role is unavailable, record **NOT TESTED**, not PASS. No Supabase write is authorised; never press Approve, Lock, Recalculate, Accept or Save against live data.

Baseline: `main` `18cee23`. Mock-level proof already exists (#160 sweep, package suites); this record is the signed-in, populated-data proof they explicitly do not give.

## 1. Session header and build-provenance gate

Date · Tester · Permission role and evidence of view-only access · Client (PWA/Electron) · Browser/OS · Environment URL or isolated package identifier · **exact source Git SHA** · served JS/CSS bundle digest or packaged build identifier · deployed asset version · service-worker cache identifier (if PWA) · evidence link/screenshot · owner authorisation for test environment.

**Precondition:** Confirm that the loaded assets contain the merged #153/#161/#162/#163/#160 changes. Production Electron v6.1.0 / PWA cache v390 cannot be assumed to contain them. A green Netlify build is not itself a signed-in acceptance test. If build identity cannot be established, write **NOT TESTED — BUILD NOT VERIFIED**, and do not mark functional rows PASS. No production deployment, cache/version change or flag activation is authorised by this record.

**After every session:** clear temporary flag overrides, verify all eleven flags are OFF in that browser context, close the test session and record restoration evidence. If any test would require an operational write, stop and mark NOT TESTED pending separately approved safe test data/role.

## 2. Matrix A — six modules × flag OFF, then ON
Per cell mark **P**ass / **F**ail / **N/A** / **NT** (NOT TESTED), with reason and evidence. A PASS requires the verified integrated build and the correct role; a screen merely opening does not prove each individually gated feature. Check: opens without console error; lens/workspace switch; period switch; deep link (`?lens=` or `?workspace=`); view-only role shows no write control.

| Module (permission target) | All flags OFF | `COSTING_NAV_GROUPS_V1` ON | All eleven ON |
|---|---|---|---|
| Costing Control Center (`module:costing-control-center`) | | | |
| Material Cost Manager (`module:material-cost-manager`) | | | |
| Cost Build Manager (`module:cost-build-manager`) | | | |
| Pricing Policy Manager (`module:pricing-policy-manager`) — all 10 workspaces | | | |
| Cost Sheet Review (`module:cost-sheet-review`) | | | |
| Production Route Manager (`module:production-route-manager`) | | | |

## 3. Matrix B — one targeted check per flag (flag ON alone, then OFF again)

Use only the owner-authorised isolated test client, a genuine view-only role and read-only UI actions. Record each flag's independent ON/OFF evidence as well as the grouped/all-ON smoke results. Do not infer that the latter proves independent flag behaviour.
*Flag descriptions are summarised from the package documents, not re-derived from code; amend any row whose real behaviour differs.*

| Flag | What to look at | Result |
|---|---|---|
| `COSTING_NAV_GROUPS_V1` | grouped navigation + context chip on five lens modules; five-group Pricing Policy; trace entries hidden for a user without trace rights | |
| `COSTING_PRM_CORRECTIONS_V1` | Route Editor Supersede, candidate scope controls, governed family creation (view only; no live write) | |
| `COSTING_PRM_NAV_CONTEXT_V1` | Production Route context survives navigation between groups | |
| `COSTING_REVIEW_WORKLIST_V1` | Review Worklist opens; drawer shows "Draft-run component evidence unavailable — provider not connected" with every component UNKNOWN | |
| `COSTING_UX_CONSISTENCY_V1` | sentence-case worklist status labels | |
| `COSTING_RUN_STATUS_V1` | run-status screen; run picker 143 ↔ 148 shows the right context | |
| `COSTING_APPROVAL_SCREEN_V1` | approval screen renders; **do not approve** | |
| `COSTING_LOCK_SCREEN_V1` | lock screen renders; **do not lock** | |
| `COSTING_RECALC_WITH_DATE_V1` | recalculation dialog with date renders; **do not run** | |
| `COSTING_DIALOGS_V1` | dialogs replace browser prompts; Esc/focus behave | |
| `COSTING_TABLE_TOOLS_V1` | table search/sort/column tools work on a populated table | |

Pricing Policy Manager read-only walk (WP06): open Commercial Sales Assumptions, the default-policy revise modal (COMPANY, then REGIONAL IK/OK — confirm the **Region field is hidden for COMPANY**), and the MRP proposal list; close each without saving.

## 4. Decision sheet (policy is not decided by client code)
| ID | Question | Options | My recommendation | **Owner decision** |
|---|---|---|---|---|
| O-1 / CDE-2 | Principle of one per-run, per-SKU, non-monetary, CCC-view read RPC | approve design only / reject / amend | approve design only; implementation separately authorised (see CDE2 package §4) | |
| C9 | Registry `policy-manager.periodScoped:false` vs period-scoped CSA | (a) leave and document (b) per-workspace metadata | (a) | |
| D3 | CCC-edit can accept reviews without MCM-edit | keep / require MCM-edit / park | decide or park; record current behaviour | |
| D5 | Historical fixed runs 80/82 selection | server selection contract first / leave labelled | leave labelled; server first | |
| D7 | Maker-checker on assumptions, default policy, MRP | require second approver / keep / park | park unless policy exists | |
| F-4 | Integer units required for assumptions? | server rule / leave | leave to server | |
| O-7 | Hub search and section collapse | behind new default-OFF flag / direct default / not wanted | flag, default OFF | |
| O-8 | Destination for `COST_REVIEW_WORKBENCH` / `COST_APPROVAL_WORKBENCH` | existing lens / none | none (keep honest "no dedicated screen") | |
| O-2 | Registry export per client key (36 PWA, 79 Electron entries) for WP08 | authorise read-only export / not now | authorise | |

## 5. Residual-issue disposition before signing

For every unresolved WP05/WP06 item, record **verified / deferred by owner / blocked** (not an automatic pass): issue ID, current observed behaviour, risk, evidence, reason for deferral, future owner/work-pack gate and owner decision. Explicitly cover **C5/D5** historical fixed runs 80/82 (server selector contract not implemented), **S2** printable cost-sheet versus SKU detail parity, **S9** KPI requery measurements, and **C6/C9/D3/D7/F-4** policy/UX questions. Retaining a labelled fixed-run picker does not mean a historical selection contract has been implemented.

## 6. Closure wording (apply only after signing)
- WP05: "Closed on <date>: delivery merged; verified merged-build signed-in record <link>; C6/C9/D3 decisions; C5/D5, S2, S9 and all other residual ledger entries verified or explicitly deferred with a future gate; D2/D4 disposition recorded."
- WP06: "Closed on <date>: identified F-1/F-2/F-7/F-8/F-9 corrections merged; verified merged-build signed-in record <link>; C9, D7, F-4 and any acceptance findings decided or explicitly deferred."
- Release remains blocked until WP08–WP12 are accepted and the Windows packaged-installer/updater/rollback checks (A14) pass.
