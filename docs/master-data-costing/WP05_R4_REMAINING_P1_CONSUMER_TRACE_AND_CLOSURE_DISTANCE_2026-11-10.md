# WP05 R4 — remaining P1 consumer tracing and closure-distance assessment

**Prepared:** 10 November 2026. **Status: SOURCE + LIVE CATALOGUE READ-ONLY EVIDENCE. NO PERMISSION CHANGE, NO OWNER APPROVAL OF 49-VIEW IMPLEMENTATION.** WP05 OPEN, overall formal 6/13. References: [R3 complete 49-view design](WP05_R3_49_VIEW_READER_AND_MINIMUM_COLUMN_POLICY_PROPOSAL_2026-11-10.md), [post-B1 retained gates](WP05_B1_RETAINED_GATE_EXECUTION_LEDGER_2026-11-10.md), [shared B1 agreement](WP05_WP06_WP12_AUTHENTICATED_ACCEPTANCE_EXECUTION_PACKAGE_2026-11-06.md).

## R4 finding — three formerly unresolved P1 consumers

| View | Current exact source/consumer evidence | Live metadata / risk | Disposition |
|---|---|---|---|
| `public.v_costing_pricing_sku_detailed_cost_sheet` | **Verified direct live client call site:** `public/shared/js/costing-suite-shell.js` `fetchSkuDetail(row)`, invoked by `renderSkuTab(tabId)` for SKU Cost Details and related SKU detail panels. `.select('*').eq('period_start',ACTIVE_PERIOD_START).eq('sku_id',skuId).limit(1)`. Renderer consumes per-SKU cost components, pricing bridge, selling price, scheme/detail sections. | Live `authenticated` SQL SELECT yes; `security_invoker=true`; 44 columns, granular loaded costs | **Confirmed active P1 consumer.** Scope initial minimum projection to the detail tabs and their dependent components; do not remove columns based only on the overview section. Verify per-user underlying RLS/source privileges before proposing server gate. |
| `public.v_cost_sheet_snapshot_sku_monthly_comparison` | **No exact direct `public/` JS consumer found.** The Cost Comparison lens maps instead to `public.v_cost_sheet_snapshot_sku_monthly_comparison_governed` via `VIEW_BY_LENS` in `costing-suite-shell.js`. Existing server/migration/contract documents reference the ungoverned view; possible other SQL/server/off-app consumers require separate inventory. | Live raw view: `authenticated` SQL SELECT yes, `security_invoker=false`; 56 columns; distinct live view definition from governed alternative. The governed view likewise has authenticated SELECT and security_invoker=false. | **Direct client use of raw view unverified; governed view is confirmed current frontend source.** Do not remove or revoke raw view purely because frontend switched; resolve SQL dependencies/external consumers and governed-vs-raw security/run semantics first. |
| `public.v_costing_pricing_cost_sheet_rm_line_traceability` | **No exact direct `public/` JS call found in repository search.** Current printable Cost Sheet uses a different line trace view, `v_costing_pricing_cost_sheet_line_traceability`, via explicit `TRACEABILITY_VIEW` projection; the RM-specific raw view occurs in database/audit/migration records. | Live SQL `authenticated` SELECT **false**, `security_invoker=false`, 52 columns containing stock item, purchasing form and RM cost trace fields. | **Preserve existing restricted grant.** Do not add client call, broaden SELECT or infer there are no privileged server consumers. Review downstream SECURITY DEFINER functions separately before any policy change. |

**Read-only catalog observation:** For the three exact view names, production `pg_get_viewdef` fingerprints and `pg_class.reloptions` were inspected without selecting row bodies. The governed Cost Comparison view was also checked as an adjacent, *distinct* source, not part of the original 49-view subset. A limited reverse-dependency lookup returned no dependent *views* for these three raw names; this does **not** prove there are no functions, scripts or dynamic clients reading them.

## Remaining P1 render/export-specific proof

The R3 source review also verified existing exact `select('*')` calls on manual-rate register/history, material acceptance, Scheme Master audit, printable lines and product summary, and explicit 33-column Cost Sheet lineage trace. The *reader intent* is known, but a **complete minimum SQL column whitelist is not proven** for each because renderers, CSV exports, drawers and filters may use values beyond the first direct loader. For any client hardening PR, require static call-graph review and positive-role screenshots/tests at both widths; preserve user-visible rate evidence and audit history.

Prioritise P1 implementation preparation only where a concrete cross-role exposure or unnecessary payload is shown. Do **not** turn P1 classification into an automatic requirement to redesign all ten views before WP05 specialist-audit closure. The owner has approved a *proposed B1 ownership split*, but has **not approved** this R3 least-privilege design for implementation.

## Distance-to-closure assessment (not a calendar forecast)

**Formal programme:** **6/13 workpacks closed**; WP05 and WP07–WP12 open. This is a *governance count*, not percent of code remaining. A substantial portion of navigation/Costing Suite code is already merged, so remaining work is not necessarily seven equally sized builds. There is no credible exact days/weeks forecast from the existing evidence because outstanding failed/untested specialist checks may uncover implementation defects.

**WP05 remaining gates after R1–R4 evidence re-use:**

1. **One business/security-policy decision package:** decide exact shared view scope (sensitive detail vs justified aggregates), CSR-only/ID-N/ID-X test or bounded exceptions, CCC/MCM D3 actor/role authority, and negative-writer evidence boundary. Staff Governance W5-06 is already accepted narrowly.
2. **One PRM/functional disposition package:** classify historical run 80/82 vs moving `as_of`, F1 privileged preview read safety (still unallowlisted), owner-reported recovery of four historical F, product-specific route editor and route-family preview data paths; only a targeted safe browser pass where essential.
3. **One final WP05 evidence/backlog/sign-off package:** reconcile W5-03 build provenance, 40-lens historical P/F/NA/NT matrix and later bounded evidence, all retained W5-08/09 deferred items with owner/risk/milestone, and explicitly sign `WP-05-COSTING-SUITE-RATIONALISATION.md` Gate Status if supported. Then, and only then, programme 6→7/13.

**After WP05:** WP07–WP11 status reconciliation (some code already merged but no formal gate sign-off), and WP12 final B1 integrated acceptance (all eleven flags + cross-module navigation + Windows/Electron A14 if release authorised). These steps can be planned in parallel only where they do not make unverified release/security assumptions. No obligation to rerun all forty UI lenses just to restate historical results.

## Recommended fast-path next wave

- Prepare **one combined owner decision ledger** for cross-module sensitive views, run-82 semantics and source-based server permissions, with decision-ready options and bounded risk; do not request repeated micro-approvals for repo-only readbacks.
- Reconcile all four historical failures against current source/owner recovery without claiming timeliness beyond captured evidence; target live tests only for material gaps.
- Then finalise WP05; prepare WP07–WP11 code-to-gate audit **in parallel** (documentation/read-only), retaining WP12 final release proof as a true end gate.
- Release controls: do not run a production preview, mutate data, re-grant access, or deploy as part of this R4 evidence. No client source or Supabase object was modified.

**Outcome: all three previously open P1 direct-client tracing cases now carry explicit verified/current-use or no-direct-client evidence, but their indirect/off-app consumer and full minimum column matters remain owner-governed. No approval or closure status upgraded.**
