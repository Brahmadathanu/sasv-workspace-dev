# WP05 W5-06 — targeted SEC-A1/A2 catalogue verification (9 November 2026)

**Status: SELECT-ONLY METADATA EVIDENCE; NO AUTHENTICATED NEGATIVE-IDENTITY BEHAVIOURAL TEST.** This follows the owner's approval of drafting a narrowly scoped no-side-effect security plan and the subsequent direction to proceed *targeted*. Only existing live `pg_proc` metadata and `pg_get_functiondef` text were read from project `qhmoqtxpeasamtlxaoak`. No application RPC/function was executed, no data/user/permission/flag changed, and no credentials, tokens or identifiers were collected. WP05 OPEN, programme 6/13, W5-06 OPEN.
> Staff Governance confidentiality (salary views and client controls; draft, not applied): [`WP05_W506_CONF_01_STAFF_GOVERNANCE_CONFIDENTIALITY_DESIGN_2026-11-09.md`](WP05_W506_CONF_01_STAFF_GOVERNANCE_CONFIDENTIALITY_DESIGN_2026-11-09.md).

> Combined Staff Governance writer-guard release readiness (PR #254 + #255; risk register, PostgreSQL 17.4 paths, rollout checklist): [`WP05_W506_COMBINED_SECURITY_RELEASE_READINESS_2026-11-09.md`](WP05_W506_COMBINED_SECURITY_RELEASE_READINESS_2026-11-09.md).


## 1. Verified function/ACL facts

Each listed named function was inspected as a distinct exact signature. `provolatile='v'` means VOLATILE; `prosecdef=true` means SECURITY DEFINER. All writer functions below are VOLATILE and SECURITY DEFINER.

| Function/signature | `anon` EXECUTE | `authenticated` EXECUTE | Live body / gate evidence |
|---|---|---|---|
| `public.rpc_accept_material_review_action` — 10-argument signature | no | yes | SQL wrapper delegates to same-argument `costing.rpc_accept_material_review_action`; public wrapper has no inline permission test, so guard must be validated in delegate |
| `public.rpc_accept_material_review_action` — 7-argument signature | no | yes | delegates to corresponding `costing.` overload; no inline permission test |
| `public.rpc_close_material_review_acceptance(bigint,text)` | no | yes | delegates to `costing.rpc_close_material_review_acceptance`; no inline permission test |
| `costing.rpc_accept_material_review_action` — both signatures | no | no | internal functions contain `require_permission('module:costing-control-center',true)` in initial validation path |
| `costing.rpc_close_material_review_acceptance(bigint,text)` | no | no | initial CCC-edit guard |
| `costing.rpc_accept_internal_source_material_review_action` — 7 arguments | no | **yes** | initial authenticated-user and CCC-edit checks in inspected body; broader direct authenticated EXECUTE **is a governance-review item**, not demonstrated exploitability; check schema API exposure and role policy separately |
| `public.rpc_costing_preview_approval_impact(bigint)` | no | yes | explicit CCC-edit guard followed by **INSERT into `costing.costing_approval_preview_ack`**; this is a writer despite the word preview |
| `public.require_permission(text,boolean)` | no | yes | body checks nonnull `auth.uid()`, matching `public.user_permissions_canonical` view grant, and edit flag when required |
| `public.fn_costing_view_allowed()` | no | yes | allows service/postgres or **any one** of CCC/CBM/CSR/MCM module view grants; view scope is broader than a single module |

**Nuance:** An `authenticated` EXECUTE privilege on an exposed `public` wrapper is **not equivalent to authorisation to perform the write**. The effective guard is in the delegated `costing.` function and checks `can_view=true AND can_edit=true` for CCC via `require_permission`. That is a **catalogue-observed contract**, not behavioural proof of rejected calls or full absence of bypasses. Conversely, SQL-wrapper `SECURITY DEFINER` and an internal direct authenticated EXECUTE grant warrant least-privilege review; this document does not claim an exploit.

## 2. Narrow next proof steps — not executed

1. **Read-only catalogue:** obtain `EXECUTE` ACL and public API exposed-schema configuration for the direct `costing.rpc_accept_internal_source_material_review_action` entry; distinguish PostgREST schema exposure from direct SQL role EXECUTE. Review exact per-overload wrapper→delegate mapping and any function redefinitions after the captured hashes.
2. **Identity expectation table:** ID-N (no Costing view), ID-X (CCC edit without view), ID-O (CSR view only), ID-V (six views, no edit) should not obtain CCC **edit** authority under the present `require_permission` definition. But ID-O may read some shared `fn_costing_view_allowed` gated costing views under the present any-of-four contract, so an expectation that *all* CCC view data are denied is **not justified** without a separate policy revision.
3. **No-side-effect behavioural tests:** require a separate owner-approved list of proven read-only endpoints and operator-controlled identity/session process. Do **not** invoke writers to elicit denials in production. If actual SEC-A1/A2 writer-denial behaviour must be demonstrated, use a separately approved isolated non-production environment with synthetic data.
4. **Privacy/safety:** never publish user identifiers, permission rows linked to individuals, session state, personnel salary or restricted trace data. Stop on unexpected access or mutating request.

## 3. What remains unproven

- ID-N/ID-X/ID-O server-denial behaviour under authenticated sessions; no new identities signed in.
- Transitive writer-bypass absence beyond inspected wrappers and delegates; database ACL and exposure are not the whole behavioural contract.
- Whether broad shared costing views' access policy is **intended** by the owner, or needs governance revision.
- Whether internal `costing.` functions' direct `EXECUTE` grants need restriction as defense in depth; no GRANT/REVOKE authorised.
- F1 and other previews' safety; neither they nor any writer were executed.

**Gate classification: W5-06 stays OPEN.** This targeted readback contributes `CATALOGUE_OBSERVED` for the named functions only. Original shared §8 and pending B1 approval unchanged. AE1 remains 13 P / 4 historical F / 2 NA / 21 NT; WP05 OPEN, programme 6/13.


## Addendum — Staff Governance classification writers (9 November 2026)

| Writer | State | PR | Server guard |
|---|---|---|---|
| `costing.rpc_set_staff_costing_classification` (Save) | unguarded SECURITY DEFINER; wrapper executable by `authenticated`, `service_role` | #254 (draft, unapplied) | proposed: CBM view+edit |
| `costing.rpc_close_staff_costing_classification` (Close) | unguarded SECURITY DEFINER (owner 17.4 readback; md5 `1c9884c0…`, wrapper `a8254681…`); no client call site in repo | companion WP05-W506-SEC-FIX-02 (draft, unapplied) | proposed: same CBM view+edit |

The two fixes are code-independent but must be released together; see `WP05_W506_SEC_FIX_02_CLOSE_WRITER_GUARD_NOTE_2026-11-09.md` §5. PostgreSQL 17.4 execution: NOT TESTED. W5-06 OPEN; WP05 OPEN; programme 6/13.
