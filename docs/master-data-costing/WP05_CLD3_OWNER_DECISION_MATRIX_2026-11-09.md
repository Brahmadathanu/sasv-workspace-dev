# WP05-CLD3 — Owner decision matrix (9 November 2026)

**Status: PROPOSAL / NOT APPROVED / NOT EXECUTED.** WP05 OPEN; programme **6/13**. AE1 ledger 13 P / 4 historical F / 2 NA / 21 NT unchanged. Original shared §8 (40 lenses, 11 flags, negative identities) **remains fully binding**; B1 is **not approved** and is not recommended-as-approved here. Every approval cell is `PENDING`. Evidence detail: [WP05_CLD3_STATIC_TRACE_2026-11-09.md](WP05_CLD3_STATIC_TRACE_2026-11-09.md) (“Trace”); prior queue: CLD1 residual document (Q-ids retained). No SQL, production, auth, flag, code, cache or permission action.

## 1. Decisions that can be taken now (evidence already in hand)

| ID | Decision for owner | What the evidence supports | Options | Approval |
|---|---|---|---|---|
| Q-F1-a | Accept that the traced repo text of F1 has **no write path detected by the bounded source scan** (Trace §2.1) as `STATIC_PASS (repo)` — *classification only, no allowlist change* | wrapper + one STABLE internal, no additional project-specific callees located, SELECT-only in reviewed bodies; response marker `records_created:0` is not a behavioural test | accept / reject / require live hash first | PENDING |
| Q-PRV-a | Accept the per-signature static results for the 3 candidate previews, the shadow preview and the 3 workload `rpc_get_*` (Trace §2.2–2.3) as `STATIC_PASS (repo)` only; all stay outside the allowlist | no such operations detected by a regex-based scan of identified repo bodies; the scan does not establish complete transitive safety; wrapper `VOLATILE` default noted | accept / keep UNKNOWN | PENDING |
| Q-NAME | Record the repo name `rpc_get_production_route_manager_workload_detail` (CLD1/CLD2 text said `_workload_preview_detail`) | Trace §2.3 | correct in the register | PENDING |
| Q-C5-a | Record that Mapping/Foundation as-of date defaults to **today**, not run-82 valuation, so an empty list can be a designed as-of drift outcome (Trace §3) | helpers `:7840`, `production-route.js:771`, RPC guard | accept wording “zero rows not classifiable; not a defect finding” | PENDING |
| Q-L1-a | Note that a **second, run-scoped selected-scheme snapshot** exists and supersedes the “no per-run selected scheme source” statement of CLD1/CLD2 as *a candidate* (Trace §1.2); correct register wording | join at `20261019134900…:1272-1273`; CI-037 invariant `:121-133` | accept correction | PENDING |
| Q-D3 / Q-C6 / Q-D7 / Q-A14 / Q-224 / Q-CDE2 / Q-IDV | unchanged from CLD1 §6; no new evidence | — | as CLD1 | PENDING |

## 2. Decisions blocked by specific evidence

| ID | Decision | Blocked by (exact) | Smallest unblocking evidence | Who | Approval |
|---|---|---|---|---|---|
| Q-L1-b | Historical scheme-coverage definition (S-A / S-B / S-C, Trace §1.3) and whether to fix the KPI view server-side or relabel (CLD1 options 1/2) | bodies of `costing.v_costing_policy_manager_sku_overview`, `costing.v_sku_selected_scheme_policy`, refresh function; live snapshot DDL/CHECK; status distribution per run; whether run 143 satisfies one-IK-one-OK | owner-run readbacks **R6–R9** | owner (SQL role) | PENDING |
| Q-F1-b | One-name allowlist for F1 | live body/ACL not hash-matched to repo; `require_permission` body not in repo | **R10** hashes for the two F1 functions, compare to repo text | owner | PENDING |
| Q-PRV-b | Any allowlist/NT-to-tested move for the other previews and workload RPCs | same live-match gap; whole-PRM grain under view-only permission is a policy question, not a code defect | **R10 + R11**, then separate policy ruling on grain | owner | PENDING |
| Q-C5-b | Classify Mapping/Foundation run-82 zero rows (PASS-as-designed vs investigate) | needs data at two as-of dates | **R12–R13** | owner | PENDING |
| Q-SEC | SEC-A1/A2 beyond `CATALOGUE_PASS`; negative identities ID-N/ID-X/ID-O (W5-06) | no behavioural proof; no negative identity exercised; ID-V revocation untested | separately reviewed no-side-effect plan (CLD1 Track B §5 tiers 2–3); **not proposed for execution here** | owner | PENDING |
| Q-B1 | Adopt, amend or reject WP05 amendment B1 | requires the owner's lens list `[N]` and T1/T2 wording (CLD1 §5 template); depends on the items above | owner written decision; none drafted as approved here | owner | PENDING |
| Q-STAFF | Staff Governance sub-tab matrix | AE1 keeps NT/PARTIAL; 7-vs-42 explained by period filter (CLD1 §1) | agree sub-tab matrix | owner | PENDING |

## 3. Cross-module dependency and risk

- **Run-82 fixed constants vs as-of=today:** Mapping/Foundation/Workload combine a frozen run with a moving as-of date; any claim must state both (C5/D5).
- **View-gate breadth:** `fn_costing_view_allowed()` allows a view grant in any of CCC/CBM/CSR/MCM (CLD2 live); TB2 gates 49 views (35+14). Previews are gated by PRM *view* only. A B1 transfer that defers negative-identity evidence defers this breadth question.
- **L1 and S9:** L1 affects only the Policy Coverage cells; S9 readiness/review/blocker parity (PR #240) is unaffected. Fixing L1 needs a governed migration; **none is authorised**.
- **Run 151:** current-successful Nov run is 151 (valuation 2026-11-09); PAR1's 149 is historical. Any new L1 reconciliation must name its run.
- **Static ≠ live:** every `STATIC_PASS (repo)` here can be invalidated by a live body that differs from migration text (several applied migrations are known to be outside `supabase/migrations/`).

## 4. What this package does not do
No B1 amendment, no sign-off, no ledger/gate/status change, no allowlist expansion, no readback executed, no code/SQL/migration change. **WP05 OPEN; programme 6/13.**
