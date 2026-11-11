# WP05 W5-06 — scoped negative-identity acceptance packet (11 Nov 2026)

**Status: READY FOR EXISTING-SESSION OWNER-OPERATED READ-ONLY TEST; NOT EXECUTED.** This is an execution instruction limited to the **installed** read-only comparison function `public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(date,integer)`, *not* blanket W5-06 or all remaining security gates. No account, credential, permission, RLS, JWT, writer RPC or data changes are authorized.

## Known deployed evidence
- DB scoped RPC installed by explicit owner instruction in Supabase project `qhmoqtxpeasamtlxaoak`, migration version `20261111133505`, source synchronized by #278, client flag-gated by #276, both merged.
- Authenticated view-only ID-V browser reportedly loaded the actual RPC for Nov, Oct, Sep 2026 with no errors. Supabase edge logs independently show three **HTTP 200** responses, API origin times 5386/3642/3970 ms; this is functional evidence, **not** <=4s p95 acceptance. Evidence #273 comments `6798327725` and `6798338026`.
- Catalogue: function postgres-owned SECURITY DEFINER, fixed search path, `auth.uid()` and `require_permission('module:costing-control-center',false)` before data SELECT. `require_permission` checks canonical `can_view=true`, not `can_edit` alone. **Effective DB-role ACL:** `anon` EXECUTE false, `authenticated` true, `service_role` true through role privileges (despite no explicit service_role grant). No PUBLIC grant. Direct signed-out SQL execution rejected `P0001 Not authenticated`.
- DB catalogue is **not** proof of denial for real signed-in users with a JWT. The existing view is a postgres-owned definer view; `costing` inner view is not directly SELECTable by `authenticated`.

## Exact ID and endpoint matrix, read-only

| Identity class | Existing permission fact to verify in owner-side safe account UI | Expected result for scoped RPC | Classification if observed |
|---|---|---|---|
| **ID-V** | Costing Control Center `can_view=true`, `can_edit=false` | RPC data read succeeds, no writer called | Positive read PASS (already owner observed Nov/Oct/Sep) |
| **ID-N** | No Costing Control Center permission | `require_permission` denies, no rows | Server DENIAL PASS only with actual RPC response |
| **ID-X** | CCC `can_edit=true`, **`can_view=false`** | Denied despite edit bit | Server DENIAL PASS only with actual RPC response |
| **ID-O** | CSR `can_view=true`, no CCC permission | Denied by THIS RPC's exact CCC gate; **shared view access may differ** | Scoped denial only; no blanket CCC-view isolation assertion |
| **Signed-out / anon** | No active session | Auth or EXECUTE denied | Earlier SQL signed-out guard PASS; anon role ACL denied |

**Allowlist:** only the deployed `rpc_get_cost_sheet_sku_monthly_comparison_scoped` RPC, with `p_period_start=2026-11-01`, `p_limit=1` for negative identities if the operator has an approved, verified read-only caller path. The RPC's POST HTTP transport **does not make this function a writer**: reviewed SQL contains only SELECT after permission guards. No other PostgREST RPC, view, preview, export, staff register, approval, Close, Save, refresh or lock route is authorized in this packet.

## Browser procedure and limits

1. Use only previously established, genuine, **operator-owned** sessions for each role; never pass usernames, passwords, JWTs or localStorage session material to ChatGPT/Claude or GitHub. If an identity is not available, classify `NOT TESTED`; do not create or modify one. Never assume a navigation-hidden lens proves server denial.
2. Confirm the current application asset and session role class locally, without exporting token/security-sensitive details. Keep the scoped-comparison client flag OFF for negative accounts unless a separately reviewed safe path intentionally targets only the allowlisted read RPC. Avoid broad module-navigation probes which might implicitly trigger unreviewed requests.
3. If an existing UI route *actually* issues the one allowlisted read RPC, observe its HTTP status and safe error code; do not bypass navigation via pasted authenticated headers or token replay. A hidden route or failure to send the request = **client visibility observation only**, not server denial evidence.
4. Save only role class, endpoint name, `p_period_start` (month, no SKU/customer data), HTTP status, safe code, and whether rows were returned (yes/no). Do not capture row contents, JWTs, request URLs with auth query strings, cookies, or HAR files.
5. Stop at any unexpected writer/unknown request, unanticipated data exposure, role mismatch, or response revealing sensitive detail. Restore any browser-local flag; do not change production-wide configuration.

## Acceptance and dispositions
- Real ID-N, ID-X, ID-O denials, when individually observed, count ONLY for this CCC-scoped read RPC; they do not establish writer denial SEC-A1/A2, the 49 shared-view policy, F1 preview safety, or the whole W5-06 contract.
- Negative roles cannot be declared PASS by simulating JWT claims in the admin SQL editor. The postgres SQL connector cannot reproduce PostgREST's authenticated JWT context by a bare `SET ROLE`.
- W5-06 remains **OPEN** until broader scope is either satisfied or separately owner-dispositioned with explicit risk/milestone. Historical AE1 counts remain unchanged; WP05 OPEN, formal programme **6/13**.

## Narrow owner-side result template

`W5-06 scoped RPC ID-N: existing session available=[yes/no]; CCC view permission=[yes/no/unknown]; request actually issued=[yes/no]; HTTP=[status or none]; code=[redacted code or none]; rows returned=[yes/no/not known]; unexpected requests=[none or describe names]`

Repeat for ID-X and ID-O only if authorized sessions exist. No result = NOT TESTED, not FAIL.
