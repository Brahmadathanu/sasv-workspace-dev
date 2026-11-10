# WP05 / WP06 / WP12 — authenticated acceptance execution package — 6 Nov 2026

**PREPARED, NOT EXECUTED. Nobody signed in to production to produce this. No account, grant, flag, deployment, cache or build was created or changed.** It is the executable form of `OWNER_ACCEPTANCE_RECORD_2026-11-04.md` plus the read-only route in the WP12 preview handback (R.7) and the CDE-2 acceptance rules. Formal closure remains 5/13; filling this in closes nothing by itself. **Until it is executed by the account holder, every signed-in row is NOT TESTED.**

## 0. Hard rules
1. **Never use the existing Costing test login for acceptance.** It is Costing-view-only but also holds 52 unrelated edit grants, so it cannot show "cannot write". Use only the identities in §1.
2. A signed-in session against any build is a **production read** (every build talks to the production Supabase project). Read-only discipline is therefore the control, not isolation.
3. **Forbidden actions** (stop and report if any is triggered): Preview, Approve, Finalise, Lock, Refresh, Recalculate, Request draft, Save, Create, Apply, Decide, Accept, Close, Supersede, Revoke; any request to an RPC name on the MUTATING (88) or UNKNOWN (6) lists from `node scripts/costing-preview/rpc-inventory.mjs`.
4. A screen that merely opens, an empty table, an offline message or a restriction notice is **not a pass**.
5. All flag overrides are temporary browser values (`localStorage`, key = flag name, value `"1"`); restore and verify OFF at the end.

## 1. Restricted test identities (the owner creates them; granting permissions is a governance act I did not perform)
| ID | Grants | Purpose | Must satisfy |
|---|---|---|---|
| **ID-V** | the six Costing module targets `can_view=true`, `can_edit=false`; **no other grant of any kind, zero edit grants anywhere** | the acceptance identity for every read check | verify with the canonical permission view before use and attach the output |
| ID-E (optional) | CCC view + edit, all else as ID-V | only to see that edit controls appear for an editor (visual, never pressed) | never used to prove denial |
| ID-N | no Costing grants | module hidden / denied; CDE-2 denial envelope | |
| ID-X | CCC `can_edit=true`, `can_view=false` | negative: edit-without-view is denied | |
| ID-O | `module:cost-sheet-review` only | negative: other-module-only | |
Targets: `module:costing-control-center`, `material-cost-manager`, `cost-build-manager`, `pricing-policy-manager`, `cost-sheet-review`, `production-route-manager`. Server-side denial proofs for SEC-A1/SEC-A2 stay NOT TESTED until a separately approved no-side-effect plan exists; do not call writers to prove denial.

## 2. Integrated build identification (record before any functional row)
Required: tested **git SHA**, deployment identifier, client (PWA/Electron), **service-worker cache name** (`public/sw.js` line 2; at `main` `968e835`: `hub-cache-v390`), and the digest result below. Production Electron v6.1.0 / PWA v390 does not contain the merged 3-6 Nov work unless built from it: if identity cannot be shown, write **NOT TESTED: BUILD NOT VERIFIED**.
- **Candidate builds:** Netlify automatically builds a deploy preview per PR (`main` + that PR). After the owner merges the PRs that should be tested, a deploy preview or release of `main` at the exact SHA is the integrated build. A preview URL is a candidate only until §2 passes and the owner authorises its use.
- **Digest check (new, unauthenticated GETs only):**
  `node scripts/costing-acceptance/verify-served-assets.mjs <base-url> <git-sha> --json provenance.json` hashes ≥ 60 served Costing pages, modules and `sw.js` against the commit (line endings ignored) and exits non-zero on any mismatch; attach `provenance.json`. Self-tested against a local server (faithful build, one changed byte, missing file, CRLF-only difference). **It has not been run against a real deployment: this session's network policy returns 403 for `*.netlify.app`, which I did not work around.**

## 3. Flag matrix (eleven default-OFF flags)
`COSTING_RECALC_WITH_DATE_V1`, `COSTING_APPROVAL_SCREEN_V1`, `COSTING_LOCK_SCREEN_V1`, `COSTING_RUN_STATUS_V1`, `COSTING_UX_CONSISTENCY_V1`, `COSTING_DIALOGS_V1`, `COSTING_TABLE_TOOLS_V1`, `COSTING_REVIEW_WORKLIST_V1`, `COSTING_NAV_GROUPS_V1`, `COSTING_PRM_CORRECTIONS_V1`, `COSTING_PRM_NAV_CONTEXT_V1`.
Run each module under: **(a) all OFF**, **(b) `COSTING_NAV_GROUPS_V1` alone**, **(c) `COSTING_REVIEW_WORKLIST_V1` alone** (CCC SKU Control Status; the CDE-2 surface), **(d) all eleven ON**, then, if time allows, each remaining flag alone (owner record Matrix B). Record P / F / NA / NT per cell with evidence. For `COSTING_RECALC_WITH_DATE_V1`, `COSTING_APPROVAL_SCREEN_V1` and `COSTING_LOCK_SCREEN_V1` observe presence/absence of controls only; **never press them**.

## 4. Six-module checklist (40 lenses/workspaces; same list as the synthetic coverage manifest)
For each: opens without console error; lens/workspace switch; **period switch (Nov 2026 ↔ Oct 2026)**; deep link (`?lens=` / `?workspace=`); ID-V shows no write control; record period, run label, valuation date, row count, red messages, network request count; screenshots at **1280 px and 390 px**.
| Module | Lenses / workspaces |
|---|---|
| Costing Control Center (4) | Dashboard · Control Workbench · SKU Control Status · Readiness |
| Material Cost Manager (3) | Manual Rate Manager · RM Cost Trace · PM Cost Trace (**RESTRICTED expected** for ID-V: restriction is the correct result, not a pass of the trace) |
| Cost Build Manager (4) | Cost Governance · Staff Governance · Manual Provisions · Driver Governance |
| Pricing Policy Manager (10) | SKU MRP Policies · Product Derivation Policies · MRP Proposals · Proposal Decisions · Approved for Application · Applied Proposal History · SKU Policy Overview · Scheme Master · Scheme Rule Register · Commercial Sales Assumptions (CSA and default-policy modals opened read-only) |
| Cost Sheet Review (6) | SKU Cost Details · Cost Sheet (printable; open the line-level A4 sheet; at 390 px confirm the component column is reachable) · Cost Comparison · Scheme Comparison · QC Action Queue · Materials/Stores Action Queue |
| Production Route Manager (13) | Route Readiness · Product Assignments · Subgroup Mappings · Workload Preview · Manufacturing Route Families · Mapping Review · Foundation Review · Cost Centres (view-only list and detail must work) · Route Family Route Editor · Product Route Editor · Historical Evidence Review · Effective Route Viewer · Archived Routes |

## 5. Real-data verification (what synthetic tests cannot show)
| Check | Expectation to record (do not assume) |
|---|---|
| Run labels and pointers | October shows **Approved 143 with newer DRAFT 148**; November shows **DRAFT 149** (unapproved, not for pricing); failed run 150 is never selected; valuation dates visible (Oct 31, Nov 2). Compare with `v_costing_pricing_period_run_status` via the screen, not SQL |
| Counts | CCC Dashboard KPIs against the SKU Control Status rows for the same run (record READY / REVIEW / BLOCKED; do not compare against remembered figures) |
| Readiness (November) | `READINESS_BUILD_ABSENT` is the known state; record it, do not "fix" it; no readiness build is to be triggered |
| CSR reads | printable summary and monthly comparison for Nov and Oct load without a 57014 timeout (owner PASS on 5 Nov was functional, not timed); record load time observed |
| **S2** | printable Cost Sheet ↔ SKU detail parity for at least three real SKUs (one READY, one REVIEW, SKU 105 BLOCKED): same loaded cost, status and run |
| **S9** | dashboard KPI re-query after period switch matches the period shown |
| Historical runs | C5/D5: fixed runs 80/82 remain labelled and have no selector; record, do not attempt |
| CDE-2 (only after migration + wiring) | see `CDE2_FINAL_REVIEW_PACKAGE_2026-11-06.md` §9 |

## 6. Permission and denial checks (UI/network only; no writer calls)
ID-V: no Approve / Preview / Refresh / Lock / Save controls anywhere; CCC shows the view-only explanation; direct deep links to every lens work read-only. ID-N: the six modules are hidden or denied; no data tables render. ID-X and ID-O: no CCC data. For every session, filter DevTools Network by `rpc_` and export the request-name list: **zero** names on the MUTATING/UNKNOWN lists.

## 7. Evidence to collect (folder `acceptance-<date>/`, never committed with credentials or tokens)
`provenance.json`; permission-view output for each identity; the Network name list per session; per lens: screenshots `<module>-<lens>-<flags>-1280.png` and `-390.png`; the filled owner record Matrices A and B; console-error log; a flag-restoration screenshot (all eleven OFF); defect list with severity. Redact personal data; no passwords or tokens in any file.

## 8. Owner sign-off criteria
A work pack may be proposed for closure only if **all** hold: build identity verified (§2) and the owner authorised that build; ID-V used and verified; all 40 lenses recorded with P/F/NA/NT and no unexplained F; §5 real-data rows recorded; zero mutating requests; flags restored OFF with evidence; each deferred issue carries ID, behaviour, reason, residual risk, named later milestone and owner acceptance (`PARKED_BACKLOG.md`). WP05 and WP06 also need the C6/C9/D3/D7 dispositions (decide or park); WP12 additionally needs the Windows A14 installer proof and a final run on the final head. **Formal closure is an owner act in each work pack's Gate Status.**

## 9. Current blockers to executing this package
1. ID-V and the other identities do not exist (owner action). 2. No build has been authorised and digest-verified. 3. CDE-2 is not applied or wired (§9 of the CDE-2 package). 4. The network policy of the automation environment blocks Netlify, so the digest script must be run by the owner or from an environment that may reach the deployment.


## 10. Owner-approved amendment A1 — WP06-specific acceptance scope (8 Nov 2026)

**Supersedes §8 only insofar as it applied the global 40-lens/11-flag criteria to *WP06* closure.** The owner explicitly approved G-SCOPE and G-BUILD on 8 Nov 2026. The full six-module, 40-lens, 11-flag, negative-identity and server-denial obligations **remain intact for WP05/WP12 and the programme**; they are transferred, not waived or declared passed. SEC-A1/A2 writer-denial proofs must occur only in a separately approved, no-side-effect security test; no production mutating RPC is authorised.

**WP06 acceptance matrix:** the ten Pricing Policy Manager workspaces in §4, evidenced under restricted ID-V (six can_view grants / zero can_edit) at **1280 and 390 px**, with all feature flags OFF and `COSTING_NAV_GROUPS_V1` alone ON. Required: all ten workspace routing and renders, deep links/legacy compatibility, no visible authorising write UI or delivered mutating RPC, intended five-group ON/three-group OFF navigation, exact flag restoration OFF, real-data observations (empty lists classified explicitly), and a read-only open/cancel check of COMPANY and REGIONAL IK/OK default-policy revise modal. Known failures must be retained with subsequent recovery evidence and residual risk, not retroactively overwritten.

**Accepted evidence baseline (G-BUILD):** authenticated served build `main@883a9f1c1ed4bb1f67f490d7923ffa670a8a1fb8`, `hub-cache-v392`, hosted asset parity **72/72** (documented two HTML normalisations), with documented non-docs source parity to the other captured ID-V source. This authorises *evidence use only*, not a PWA/Electron rollout, production flag activation or user permission changes. Later materially different client source must be reverified.

**Deferrals and accountability:** the WP06 owner (SASV Costing Suite owner/final approval authority) accepts the documented residual risk of cross-module flag interactions and negative-identity/denial coverage remaining unproved **for WP06 only**. WP05 owns the cross-module privilege/SEC-A1/A2 server-denial and registry/security review; WP12 owns the full integrated flag/lens matrix, release/installer and compatibility checks. No dates or completion are invented; milestones are **WP05 formal security gate** and **WP12 integrated acceptance before rollout**, with unresolved issues tracked in `PARKED_BACKLOG.md`. Any write privilege, global flag or rollout change requires a fresh explicit owner authorisation.

**Formal gate unchanged:** approval of amendment A1 or passing a bounded functional check does not itself sign WP06 Gate Status. Historical Scheme Master 57014 remains a recorded failing run, followed by owner's successful post-index initial load and three subsequent refreshes (no timed network capture); hold issue #224 as monitoring. WP06 Gate Status remains a separate owner-recorded act after reconciliation.


## 11. Owner-approved amendment B1 — WP05/WP12 integrated-test allocation (10 Nov 2026)

**Effective from owner approval on 10 Nov 2026; WP05-only allocation amendment.** The owner expressly approved [the exact B1 approval and WP12 receiver package](WP05_B1_WP12_RECEIVER_AND_OWNER_APPROVAL_PACKAGE_2026-11-10.md): **B1-T2 and B1-T3 transferred to WP12 for final integrated acceptance before rollout, B1-T1 ZERO individual lenses transferred.** This supplements §8 and supersedes only the duplicate integration-wide responsibilities otherwise placed on WP05. Amendment A1 for WP06 remains unaffected.

**WP12 now owns (NOT YET TESTED by this transfer):**
- **B1-T2-1:** eleven-flag OFF, NAV_GROUPS-only, REVIEW_WORKLIST-only, risk-specific singles and ALL_ON integrated matrix, across 1280/390 widths, with explicit flag restoration and earlier ALL_ON failures retained.
- **B1-T2-2:** interactions across CCC, MCM, CBM, PPM, CSR and PRM on the final verified owner-authorised release build, under authorised identity/permission contexts. No mutating RPCs.
- **B1-T3-1:** cross-module direct/legacy links, navigation, route switching, back navigation and workspace switching at desktop/mobile widths.
- **B1-T3-2:** final release responsive and Electron/Windows A14 integration regression, **not a release authorisation**. See [WP12 workpack](WP-12-REGRESSION-AND-DOCUMENTATION.md) for its exact receiving contract.

**WP05 retains:** all forty originally enumerated lens observations (frozen AE1 13 P / 4 historical F / 2 restricted NA / 21 NT; classify new evidence separately); all module-specific correctness and unresolved historical failures; SEC-A1/A2/ID-N/ID-X/ID-O denial obligations and least-privilege/view-gate breadth; CCC/MCM authority D3; F1 and preview safe authority; C5/D5 PRM historical run 80/82 versus moving as-of; S2/S9 bounded parity; L1 frozen/current historical-policy KPI finding; Staff Governance subtab/export/privilege-sensitive LOCK-P01 issues; named backlog residuals; owner Gate Status sign-off. The 10 Nov W5-06 **Staff Governance confidentiality subgate** is accepted with documented residuals, but is not equivalent to completion of every wider WP05 security obligation.

**Receivers, evidence and release gate:** WP12 receives B1-T2 and B1-T3 in [its canonical workpack](WP-12-REGRESSION-AND-DOCUMENTATION.md). Results must report exact source build/cache/commit, roles, flags, two widths, route and period/run context, non-mutating network logs, actual evidence and OFF restoration. Unexecuted or failed checks remain NT/F with separate recovery evidence; ownership transfer is **not** a PASS. WP12 integrated acceptance must be completed **before rollout**; no automatic flag activation, deployment, auth change, production write or Electron shipment is approved. WP05's narrower retained gates and final owner sign-off are independent; programme completion stays **6/13** until those gates are separately fulfilled.
