# MDC-07 / WP07 — Owner-authorised conditional closure (14 November 2026)

**Decision:** **WP07 CLOSED — OWNER ACCEPTED WITH DOCUMENTED BOUNDED RESIDUALS.** The owner replied **"Okay go ahead"** to ChatGPT's explicit recommendation of conditional WP07 closure and to the four enumerated residual dispositions, after the final authenticated P8 evidence was independently reviewed and merged. This record captures that approval; **it is not a fresh PASS for any omitted test**.

**Formal programme count:** **8/13 substantive workpacks CLOSED** — **WP00–WP07**. The prerequisite **WP-1** is also closed but is **outside the 13-workpack denominator**. The remaining substantive workpacks **WP08–WP12 stay OPEN**. Historical programme banners and evidence retain their dated status; this decision supersedes older WP07 OPEN / 7/13 statements only from this approval onward.

## 1. Basis, provenance and decision sequence

| Evidence / gate | Result and bounded authority |
|---|---|
| N1–N4 / W6 / U11 suite implementation | Merged with historical LF/CRLF, mocked Chromium, OFF-default, deep-link, role-aware trace, context and security-source guards documented in `WP-07-COSTING-NAVIGATION.md`, bulk verification and owner checklist; mock evidence is not authenticated denial proof |
| Authenticated initial acceptance | `MDC07_WP07_AUTHENTICATED_BROWSER_ACCEPTANCE_EVIDENCE_2026-11-13.md` records the original C7 FAIL; **preserved**, not rewritten |
| Workload data-filter correction | Issue #380 / PR #386, merged `54e82ae`; the 14 Nov signed-in P2/P3/P4 and ON-mode follow-up demonstrated 495 unfiltered Workload rows without inherited `product_id`, vs 1 row for explicit Product #678 deep link |
| Signed-in post-fix run | `MDC07_WP07_AUTHENTICATED_POST_FIX_ACCEPTANCE_EVIDENCE_2026-11-14.md` (PR #394, `d825079`) retained P5 literal FAIL and P8 PARTIAL/FAIL as observed |
| P5 contract clarification | PR #396, `7572edc`: original B4/C10 requires Back/Forward over separate URL loads; pill clicks use `replaceState` and create no history entry. **No client history alteration**. Original P5 FAIL remains historical, PRM-specific conforming URL-history test NOT TESTED |
| P8 presentation correction | Issue #395 / PR #397, merged `a171504`: N4 context-chip presentation lens-aware (Option B). Identity stored/hydration preserved; non-identity lenses do not show Product/Family/Route chips after accepted load; N1 shell unchanged |
| Post-merge authenticated P8 retest | `MDC07_WP07_P8_LENS_AWARE_CHIP_ACCEPTANCE_EVIDENCE_2026-11-14.md` (PR #398, `92a9cf5`): 73/73 hosted assets vs `a171504`, browser network/cache target hashes match; flags OFF baseline PASS; ON seven non-identity lenses no **residual** chips; Workload 495 unfiltered, deep link 1 filtered, identity chips restored, 390px wrapping PASS, flag removal/restoration PASS |
| Focused correction tests | PR #397 author reports 126/126 LF and 126/126 CRLF N1/N4/#380/WP07 tests, 0 failures/skips. Independently inspected source/test patches; not independently re-executed at merge |
| Source for owner approval | In direct continuation of the final PR #398 review, ChatGPT presented a **conditional closure recommendation** specifying the four residual dispositions below; owner replied **"Okay go ahead."** Accepted as authorisation to record formal conditional closure; not permission to execute privileged operations or activate flags |

## 2. Owner-accepted bounded residual dispositions

| Item | Classification at closure | Owner disposition / follow-up |
|---|---|---|
| Transient context-chip window | **ACCEPTED LIMITATION**, not steady-state FAIL | The prior Product/Family chips may remain visible during destination loading for **238 ms–2.1 s** in the authenticated run, but none persisted after load. Retain presentation/freshness improvement as possible future UX work; do not claim instant-at-click chip clearing |
| P5 history | **DOCUMENTED TEST EXPECTATION MISMATCH**, original P5 FAIL preserved | Pill click `replaceState` conforms to B4/C10 contract. No `pushState` change. A PRM-specific **three-explicit-URL Back/Back/Forward** retest is still NOT TESTED; can be done as follow-up |
| R4 route-version retention | **NOT TESTED in authenticated production** | Mock test and separate route-chip fixture support only their own scope; no verified live `product_route_id` version retention across all navigation journeys. Follow up under N4/WP12 if relevant |
| R5 additional identities | **NOT TESTED** | E2–E4 roles were unavailable in signed-in browser; do not infer privileged/negative-role safety from view-only read session. Security and final build acceptance transfer to existing WP12/control owners |
| R6 real new-tab launch | **PARTIAL / NOT OBSERVED** | Popup-blocker prevented real new-tab observation; link source and scoped tests do not equal a successful browser popup |
| R7 evidence-lens data availability | **PARTIAL / NOT TESTED** | Mapping/Historical and Foundation limitations arose from available data; no synthetic value or false populated-register PASS |
| R8 U11 / non-scoped flags | **EXCLUDED / NOT TESTED in authenticated WP07 retest** | U11 feature and final 11-flag interactions remain WP11/WP12 responsibility; no additional flags authorised |
| R9 stale PWA source | **PASS for verified target assets** | Server provenance 73/73 and signed-in browser hashes for both P8 target assets; cache remained `hub-cache-v393`; does not imply global offline update behaviour for every future build |
| R10 CRLF, R11 clipboard, R12–R14 remaining bounded items | **Retain original classifications** | LF/CRLF focused author tests are green but no new authenticated Windows/clipboard/privileged previews/overall integration is inferred; preserve historical ledger, WP12/related follow-up ownership |
| Product B picker limitation | **PASS (limited) for A→B using deep link; picker path NOT TESTED** | View-only picker offered only Product #678, so Product #1 was reached by deep link/history; no proof of Product A→B via native picker. No change to role/selection data |

Acceptance of a residual means **accepted risk within WP07**, not conversion of its evidence status to PASS, not a security waiver, and not a claim that work was executed. Any new finding demonstrating data disclosure, writer access or hidden filtering remains a blocker for its affected release/control even after this bounded workpack closure.

## 3. Closure boundary and transfer

- WP07 navigation and IA workpack is **formally closed** with the above bounded residuals. Issue #367 may be completed as a coordination work item after this decision is merged; #380 and #395 are implementation-corrected and authenticated, with their historical FAIL evidence retained.
- **Default browser flags remain OFF**. Only browser-local activation of `COSTING_NAV_GROUPS_V1` and `COSTING_PRM_NAV_CONTEXT_V1` was authorised for the completed signed-in read-only acceptance, and both were removed at the end. No global flag enablement is authorised.
- **WP12 retains** B1-T2 cross-module 11-flag interaction, B1-T3 final-build PWA/Electron/Windows/responsive and security/role obligations. WP05's R62 bounded residuals continue unchanged; no product, costing, pricing, personnel, permission or database writer changed.
- **No production Supabase SQL, RPC preview/writer, auth/permission change, Netlify deployment, Electron installer/release or global rollout** is authorised or claimed by this closure.
- WP08–WP11 are still open. Later programme planning should use the **8/13** formal count and avoid redoing accepted WP07 navigation work without a demonstrated regression.
- Any subsequent WP07 defect or WP12 regression must be tracked as a new corrective item; closure does not conceal earlier evidence.

## 4. Governance check

**Decision recorded by ChatGPT as the owner's explicit conversational approval; no handwritten or separately authenticated signature is claimed.** No untested row is relabelled PASS. Historic documents remain immutable, with this new dated decision superseding their status banners. Programme documentation and issue tracking may now be reconciled to WP07 conditional CLOSED / **8/13**.
