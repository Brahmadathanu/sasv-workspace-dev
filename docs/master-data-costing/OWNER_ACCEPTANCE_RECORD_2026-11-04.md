# Owner acceptance record — signed-in checklist and decision sheet — 4 Nov 2026

**Blank form for the owner. Filling it in closes nothing by itself; formal closure remains an owner act recorded in the Gate Status of each work pack.** Written so one signed-in session can unblock WP05, MDC-07, WP06 and the signed-in rows of WP12. All eleven flags stay OFF by default; the ON passes below use each browser's own `localStorage` only (key = flag name, exact value `"1"`), never a shared or server setting. No Supabase write is required at any step; do not press Approve, Lock, Recalculate, Accept or Save on live data unless a row says so.

Baseline: `main` `18cee23`. Mock-level proof already exists (#160 sweep, package suites); this record is the signed-in, populated-data proof they explicitly do not give.

## 1. Session header
Date · Role (view-only / editor) · Browser/app (PWA or Electron, version) · Tester.

## 2. Matrix A — six modules × flag OFF, then ON
Per cell mark **P**ass / **F**ail / **N/A**, with a note on failure. Check: opens without console error; lens/workspace switch; period switch; deep link (`?lens=` or `?workspace=`); view-only role shows no write control.

| Module (permission target) | All flags OFF | `COSTING_NAV_GROUPS_V1` ON | All eleven ON |
|---|---|---|---|
| Costing Control Center (`module:costing-control-center`) | | | |
| Material Cost Manager (`module:material-cost-manager`) | | | |
| Cost Build Manager (`module:cost-build-manager`) | | | |
| Pricing Policy Manager (`module:pricing-policy-manager`) — all 10 workspaces | | | |
| Cost Sheet Review (`module:cost-sheet-review`) | | | |
| Production Route Manager (`module:production-route-manager`) | | | |

## 3. Matrix B — one targeted check per flag (flag ON alone, then OFF again)
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

## 5. Closure wording (apply only after signing)
- WP05: "Closed on <date>: delivery merged; signed-in record <link>; C6/C9/D3 decided or parked as above; D2/D4 Tier-2 non-blocking."
- WP06: "Closed on <date>: F-1…F-9 merged; signed-in record <link>; C9, D7, F-4 decided or parked."
- Release remains blocked until WP08–WP12 are accepted and the Windows packaged-installer/updater/rollback checks (A14) pass.
