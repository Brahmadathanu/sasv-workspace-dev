# WP10 Stage B — final genuine-role receiving checklist (21 Nov 2026)
**Status: PREPARED; no actual real-JWT sessions observed in this ChatGPT session.** WP10 OPEN and programme 11/13.
This receipt supplements `WP10_STAGE_B_PRODUCTION_CUTOVER_RECEIPT_2026-11-21.md`. It does not authorise a role change, account creation, simulated user JWT, production business write, RE-GRANT or merge.

## Live read-only fact check
- Stage B migration `20261121094820` verified registered. All four masters authenticated SELECT=true; INSERT/UPDATE/DELETE=false; Stage A RLS read gate preserved; all 12 `rpc_wp10_*` remain authenticated EXECUTE, anon EXECUTE denied.
- New read-only aggregate on `public.user_permissions_canonical` over the four target modules: **one user** has at least one View+Edit classification entitlement; **three users** have classification View but no classification Edit; **zero** have Edit without View; **four** total have at least one explicit entitlement on these four modules. These are counts without IDs or credentials. A 'classification view-only' user is NOT necessarily 'globally zero-edit' across all modules.
- No genuine authorised Editor/View-only/No-access browser session is exposed by current tools. All real-user behavior below is **NOT TESTED**, not FAIL/PASS.

## Minimal authorised installed-Windows witness, in order
1. On a legitimately installed and signed-in **v6.2.0** staff workstation, note only app version and category of permission; keep private identifiers, JWT, usernames, screenshots of sensitive content and network response bodies OUT of public GitHub.
2. **Editor (canonical View+Edit for the chosen classification module):** open the module and observe hierarchy/list loads (PASS/FAIL); verify create/rename/delete controls are appropriately visible/enabled; **do not submit** a production create, rename or delete. Actual positive RPC write is only provable using a separately authorised disposable database and real role, or a specifically authorised controlled production test.
3. **Pure View-only** (canonical View=true, Edit=false for target module): module list should load; create/rename/delete controls must be hidden or disabled. Do not attempt a write. Expect ordinary Data API direct-table DML to be denied at privilege layer for ALL authenticated users; effective privilege has already been catalog-confirmed.
4. **Genuine No-access** (independently shown to lack the module's View+Edit): module route should reject access or show access denied and no protected hierarchy. Do not assert 'No-access PASS' if no suitable existing account is available; classification-wide or globally non-provisioned cases must be distinguished.
5. Report aggregate results only: Editor list/control, View-only list/control, No-access route (PASS/FAIL/NOT TESTED); observed screen errors; v6.2.0. No production writer mutation. A server-side 12-RPC permission guard is evidenced by code/catalog; actual **real JWT** denial/positive writes remain NOT TESTED if no safe controlled fixture was used.

## Closure disposition
- If read-only visible-role checks PASS and no actual defect, present WP10 for explicit owner conditional closure with residual 'no genuine real-JWT mutating RPC positive/negative test, no per-binary digest' and named future receiving gate, or demand full separate sandbox acceptance before closure per owner's risk preference.
- If any legitimate reader/editor UI breaks following Stage B, STOP, retain security grants, investigate governed RPC/packaging; **do not automatically RE-GRANT** authenticated direct table DML.
- Do not merge stacked historical PR #477 blindly: its Stage A claims were superseded by production; do not overwrite registered migrations. Preserve v6.2.0.
- WP12 is next only after WP10 receiving and formal owner closure; storage and cleanup remain parked.
