# WP05 — no-side-effect negative-identity and SEC-A1/A2 verification plan (9 November 2026)

**PLAN ONLY; owner approved drafting, NOT executing.** Read alongside the shared authenticated acceptance contract, CLD1 security/RPC static audit, CLD2 live catalogue and CLD3 static-trace caveats. No production SQL/RPC/browser/auth interaction was undertaken for this plan. WP05 W5-06 remains **OPEN**.

## Objective and security invariants

Test whether a user who should not see costing information is denied, and whether the server—independent of client buttons—requires appropriate rights. Avoid changing any data, grants, sessions or accounts. Existing permission roles:
- **ID-V:** six costing module can_view=true, can_edit=false (previously authenticated and captured; no new sign-in in this plan).
- **ID-N:** no costing grants (negative).
- **ID-X:** CCC can_edit=true but can_view=false (negative; cannot infer edit authority from edit=true alone).
- **ID-O:** CSR only can_view=true (negative for CCC, but **cross-module view helper breadth may allow shared 49 costing views**—must not prejudge expected denial).
Identity availability, exact grants and session provenance must be verified independently before behavioural testing. **Do not create or re-permission users** based on this document.

## Phase A: repository and catalogue-only (requires separate execution authorisation)

1. Using independent reviewer and SELECT-only metadata, map `public.require_permission(target,need_edit)`, `public.fn_costing_view_allowed()`, `app_has_permission`, canonical permission source, and every public/costing wrapper used by CCC/CSR/PRM. Record owner, signature, volatility, `SECURITY DEFINER`, `search_path`, grants/ACL and direct/transitive callees. Confirm first-statement permission guard of SEC-A1 (material-review accept/close) and SEC-A2 (approval preview acknowledgement); scrutinise public wrappers separately from internal guarded bodies. No calls to those functions.
2. Build an **identity × endpoint** expectation matrix using actual code, not broad module assumptions. Distinguish `require_permission` exact-module gates from `fn_costing_view_allowed()` any-one-of-four grant. For ID-O, CCC-specific `require_permission` should be denied, but shared view access may be allowed by current policy. Treat such access as **governance risk requiring owner determination**, not automatically a failed or passed negative-identity test.
3. Establish an exact **READ_SAFE endpoint allowlist** from reviewed definitions and ACLs; deny by default all preview/approve/refresh/accept/close, functions with unresolved dependencies, and any name with mutating/unknown behaviour. Identify tests with no end-user records in evidence output. Redact personnel and salary information.
4. Preserve catalogue fingerprints, source SHA, schema deployment drift and expected denial/allow response for each target. **CATALOGUE_PASS** does not imply that a different identity was actually denied.

## Phase B: existing-identity behaviour, READ-ONLY ONLY (NOT AUTHORISED YET)

Precondition: separate owner approval of exact identities, safe route list, expected results, environment, evidence handling, and stop conditions. Use only established operator-controlled sessions (no credential sharing with ChatGPT/Claude, no storing tokens or browser storage states in Git). For each ID-N, ID-X, ID-O:
- Verify grant identity from a safe owner-side permission display, no passwords or UUIDs committed.
- Visit only approved read-only module paths and, **where proven truly read-only**, already allowlisted view/query methods; record UI availability, response codes and request **names** without collecting sensitive bodies or credentials.
- Confirm negative deny where the **server** contract requires it; differentiate hidden client navigation from an actual server denial. Note that a shared view allowed by ID-O due to the present global helper is a security policy issue, not evidence of correct CCC isolation.
- If any mutating/UNKNOWN call appears, **abort before delivery**, log only name and redacted classification, stop affected test. No exploratory clicking of Preview, Save, Lock, Approve, Submit, Refresh, Accept or Close.
- Record tested app build SHA, served digest, service-worker version, width, flag state (default OFF), user-role class, period/run and valuation context, exact expected/observed result, and restoration of browser overrides.

**Never** use a previously captured/deleted refresh token or replay session material. Do not call `rpc_costing_preview_approval_impact` or any writer merely to see an auth error.

## Phase C: SEC writer-denial proof — isolated non-production only, requires new owner approval

The current approved scope is **static + catalogue reasoning** for production writers: check executable ACLs, module edit guards and any relevant ownership/grant paths, recording `STATIC_PASS`/`CATALOGUE_PASS` only. If the owner wants a true behavioural `DENIED` result, arrange a disposable isolated test instance (not the live project), fully version-matched schema/permissions and synthetic records, and submit a separate test procedure and cost/permission review. Then the owner may decide whether to authorise a denial invocation there. **No direct writer-denial probes against production**, even ones expected to fail, under this plan.

## Expected evidence and disposition

| Test subject | Present evidence | Outcome still needed | Allowed now |
|---|---|---|---|
| ID-V user-facing view-only | Hosted v392 / 72/72, no writer delivered | Owner acceptance of source scope separately | Existing evidence only |
| ID-N / ID-X / ID-O | None authenticated | Specific server and UI denials, with shared-view exception ruled | Draft plan only |
| SEC-A1 / SEC-A2 | Live function guards inspected; no negative-role execution | Confirm wrapper/internal consistency and catalogue ACLs; behavioural proof separate | Draft plan only |
| F1 and other preview RPCs | Static regex scan + F1 live metadata | Independently review live full dependency graph and privilege grain | No invocation or allowlist change |
| Shared view authorization | Live helper allows one-of-four module view | Owner decision on whether intended; negative ID-O checks must reflect actual contract | Policy decision needed |

### Stop/rollback rule

No data is to change, so there is no rollback action. Stop on authentication mismatch, unknown function, permission mutation, leaked token, surprising unrestricted data exposure, unexpected HTTP write attempt, or any new served-code drift. Quarantine/redact evidence and report immediately. Do not continue tests to fill a matrix after a security finding.

**Gate semantics:** No change to W5-06 or AE1 counts from this plan. No security PASS, no account/permission changes, no new feature flags. All behavioural testing requires separately reviewed owner approval.
