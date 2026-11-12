# PEC — Fast-track phased release decision and executable gates (12 November 2026)

**Status: FOR OWNER REVIEW — no authorization presumed.** Programme #284, consolidated CI candidate #347, source PRs #317/#323, #291/#301/#320/#335, cache #342, independent draft-edit proposal #356; hybrid policy #305. Supabase project `qhmoqtxpeasamtlxaoak`. Preserve approved financial/procurement records and PWA/Electron shared source.

## Decision to reduce critical path

**Phase A: release already-built five-lens/paged PEC functionality** (G0/G1 server previously applied; C1/C2 responsive shared client, immediate vendor workflow, page/filter/export, PWA network-first asset update). Do **not** wait on original #284's previously deferred manual-draft quantity/date editing **if owner explicitly accepts deferred scoped release**. Do **not** include hybrid #305 or draft-edit proposal #356 in Phase A.

**Phase B: complete original manual-draft edit requirements:** #356 isolated PostgreSQL 17.11 source/runtime fixture and hardened negative oracle PASS; still needs real schema/permissions, authoritative allocation/snapshot rules, explicit owner policy decision, guarded server deployment, and shared Electron/PWA editing client acceptance. Treat as mandatory original issue scope until explicitly closed or deferred by owner—not silently declared finished.

## Phase A exact read-only/preflight gate

1. Freeze candidate and base SHAs, source chain; recheck source PRs and #347 change-path intersections. Do not use one combined PR as an unreviewed shortcut. Source order: #317 then #323; client #291→#301→#320→#335 (reconcile #319 once); cache #342 by client deployment. Approve each reviewed change path in this sequence; prevent deployment hooks from applying already-live migrations.
2. Revalidate exact ten version names: `20261112110000`, `20261112114000`, `20261112122500`, `20261112133000`, `20261112143000`, `20261112150000`, `20261112152000`, `20261112170000`, `20261112173000`, `20261112174500`. These are **already-live SQL** but **absent from the official migration history** at last audit. Confirm 20/20 function final-definition parity and governed gram master/BOM state again at frozen head. Confirm no current-schema divergence, conflicting SQL timestamps, new owner edits, or unintended role changes.
3. Only if the owner separately approves history reconciliation, use official CLI `supabase migration repair --status applied <version> --remote` on the already-applied versions after repository sequencing and before any future migration push. This operation should change **history metadata only**; it is not to invoke `db push`, to replay migrations, or to write directly to history with an ad hoc SQL insert. The connected Supabase MCP tools do **not** expose the CLI history repair operation.
4. Verify at least one genuine PEC Editor and a PEC VIEW-only user, plus a no-access account, in hosted PWA with their own valid sessions. Include PR, indents, Vendor-wise, Excess, audit, filters and full export, explicit denied edit actions, the 1,500-row export nontruncation baseline, and no unauthorized data. Never impersonate users by changing `SET ROLE` or inventing JWT claims.
5. Verify installed PWA network-first PEC JS/CSS online, cached offline fallback, one canonical shared Electron/PWA source, packaged Electron accessibility and no client stale version; confirm representative live Excess paging latency rather than relying on synthetic 13,311-row count alone.
6. Obtain owner's explicit ordered merge/deploy authorization and record exact SHAs, Netlify production deploy evidence and post-deploy tests. G0–G5 gate count may advance only against observed evidence and final owner acceptance, not CI count alone.

## Evidence already available — not substitute for release gates

- #347 earlier code head `50b32fb6`: 8/8 CI success; Netlify deploy preview success; subsequent documentation-only head changed and CI must be checked at exact final SHA.
- Live G1 metadata: 10/10 expected paging RPCs present, SECURITY DEFINER, authenticated EXECUTE, anon denial and PEC permission check text. Live migration history: 0/10 official PEC version records.
- #356 SQL draft writers: disposable PostgreSQL 17.11 runtime and hardened expected-error negative tests both pass (runs `43221603914` and `43221777870`). **Not production authorizations**.
- Separate functional requirements remain open: manual-draft date/quantity edit and policy-gated hybrid demand inference. Phase A cannot be called entire #284 closed unless owner explicitly changes scope.

## Release stop conditions

Stop and return to owner on failed source/live parity, new SQL drift, SQL replay risk, real role-denial failure, unexpected availability/permission changes, unverified PWA/Electron, performance regression, or source conflict. No automatic MRP rebuild, no approved-indent changes, no direct migration-history insert, no Tally purchase-order generation.

## Owner decisions requiring express approval

**A. Phasing:** accept Phase A five-lens release before Phase B manual-draft editing, keeping both Phase B and hybrid separately open.

**B. Controlled promotion:** approve the exact frozen source PR dependency order and production deployment only once remaining role/PWA/Electron gates are verified.

**C. Migration history:** separately authorize official CLI history-only repair of the ten known already-live PEC migration versions after a fresh definition/row parity preflight; no replay of production SQL.

Until those approvals and tests occur, the combined PR stays draft; **G0–G5 formally 0/6 VERIFIED**.
