# WP04 G7 Recovery Architecture

2026-10-05. **FROZEN RECOVERY PACKAGE — NO IMPLEMENTATION AUTHORIZED.**

## Gate disposition

Fresh G7 evidence reopens only:

1. G4 / DEC-015 performance feasibility;
2. G5/G6 Readiness-lens UI/shell-integration acceptance.

Still closed:

- G4 correctness/parity/security/CSE/payload/no-success;
- committed C deployment identity and canonical server authority;
- G5 fail-closed client/server-contract boundaries;
- unrelated G6 audit findings.

G7 remains BLOCKED. G8 is not open.

---

# Plain architecture conclusion

The signed-in application does not have a 15-second execution envelope. Live role settings are:

- authenticated: statement_timeout = 8s;
- authenticator: statement_timeout = 8s;
- anon: statement_timeout = 3s.

The G7 failure returned at approximately 8.07 seconds with SQLSTATE 57014. Two later signed-in calls succeeded at approximately 5.59s and 7.14s. pg_stat_statements records successful native portfolio calls around 5.51–7.02s.

Therefore the current synchronous full-611 portfolio contract has insufficient margin under the real 8-second native API ceiling. Hard refresh did not repair a deterministic defect; it produced later calls that happened to complete inside the narrow available margin.

The timeout stack was inside the existing commercial-sales resolution path called once per SKU by fn_wp04_c_live_core. The portfolio RPC also computes route evidence, full population canonical assessments, JSON incidence projections, global statistics/filter counts, regional counts, filtering and only then a bounded page.

The evidence supports high runtime variance from a full synchronous canonical population build. It does not support raising the timeout as the solution.

---

# Track A — Server performance recovery

## A1. Evidence ledger

### Native API timing

Observed signed-in calls on 2026-10-05:

- failed call: HTTP 500 / SQLSTATE 57014; edge origin ~8074ms / upstream ~8036ms;
- successful call: HTTP 200; origin ~5587ms / upstream ~5518ms;
- successful call: HTTP 200; origin ~7136ms / upstream ~7067ms.

pg_stat_statements for successful native PostgREST portfolio wrapper:
- calls: 3;
- min ~5510ms;
- mean ~6098ms;
- max ~7018ms.

Historical controlled calls:
- 5084.304ms;
- 6938.008ms;
- prior observations ~8174ms and ~10822ms under controlled SQL envelopes.

### Known component evidence retained

- route readiness: one evaluation per portfolio response; prior diagnostic ~1819.717ms for 639 route rows;
- shared issues helper: prior diagnostic ~8.331ms;
- run evidence lookups: low single-digit milliseconds in prior samples;
- commercial point resolution: prior per-SKU samples ~2.3–4.6ms, but invoked inside the per-SKU live-core path for the full population;
- portfolio materializes canonical assessments for all 611 OPERATIONAL SKUs before global filters/statistics/page output;
- JSON incidence/statistics/regional aggregation occurs after canonical assessment materialization.

### Timeout location

The failed PostgreSQL stack was:

fn_resolve_sku_sales_assumption_as_of
→ fn_resolve_sku_commercial_sales_basis_point
→ fn_wp04_c_live_core
→ full assessed population inside rpc_get_product_sku_readiness_portfolio.

This proves the request expired while still inside full-population canonical evaluation. It does not prove commercial resolution is the only cost, but it is a material repeated path.

## A2. Interpretation

The variation is primarily an architectural property of synchronous full-population evaluation under an 8s native ceiling, not evidence that the committed C correctness contract is wrong.

The current RPC must:
1. resolve route evidence;
2. construct run cohort/evidence;
3. evaluate canonical live readiness for every population SKU;
4. resolve commercial basis inside each live-core evaluation;
5. expand dependency/shared JSON;
6. build global filter/statistics counts;
7. apply filters;
8. return one bounded page.

The 50-row page limit therefore does not bound the expensive part.

Cold/warm cache and concurrent database conditions can plausibly shift a 5–7s successful execution across the 8s limit. The successful hard-refresh run is consistent with this; it does not eliminate the risk.

## A3. Remedy comparison

### Option 1 — Relational/JSON aggregation cleanup only

Effect:
- optimize incidences, statistics, regional aggregation and JSON construction.

Authority:
- unchanged.

Freshness:
- unchanged, fully live.

Consistency:
- unchanged.

Permissions:
- unchanged.

Rollback:
- simple function-body restore.

Assessment:
- useful housekeeping but evidence does not show these stages dominate enough to create reliable headroom below 8s.
- Not recommended as the primary recovery architecture.

### Option 2 — Page/statistics separation only

Effect:
- separate page rows from global statistics/filter counts.

Authority:
- can remain canonical.

Freshness:
- live.

Consistency:
- requires context/fingerprint binding between calls.

Permissions:
- same Control Center permission.

Rollback:
- restore single RPC/client path.

Assessment:
- can improve first paint if the row page can avoid full population work.
- However severity/dependency/owner/route filters and matched counts require knowledge of canonical assessments across the population. A pure split therefore leaves the expensive full-population computation somewhere in the request path.
- Not sufficient alone.

### Option 3 — Ad-hoc in-memory/request caching

Effect:
- reuse recent full portfolio result.

Authority:
- vulnerable to stale state unless invalidation is complete.

Freshness:
- ambiguous.

Consistency:
- difficult across PostgREST workers/processes.

Permissions:
- no direct improvement.

Rollback:
- moderate.

Assessment:
- rejected. It creates freshness ambiguity and operational invisibility.

### Option 4 — Governed precomputed canonical readiness index / materialized portfolio basis

Effect:
- move the expensive full-611 canonical assessment build out of the interactive PostgREST request;
- store canonical assessment envelopes plus relational searchable/filterable incidence projections for one explicit governed context;
- public portfolio RPC becomes a bounded read over a proven current snapshot/index;
- statistics/filter counts and keyset rows become relational reads rather than 611 live-core executions on every click.

Authority:
- canonical authority remains the existing single-SKU/common live core;
- builder must call the existing canonical composition, not reproduce severity/business rules;
- CSE-P01 remains unchanged because the builder consumes the exact current canonical resolver result rather than inventing new row-selection logic.

Freshness:
- must be explicit and fail-closed.
- snapshot/index is valid only for its bound governed context and a source-state fingerprint/version.
- if current authority state cannot be proven equal to the snapshot basis, portfolio reader returns STALE/UNAVAILABLE rather than silently serving old readiness.

Consistency:
- one immutable completed build ID is selected atomically;
- page/statistics/filter reads use the same build ID;
- incomplete builds never become current.

Permissions:
- public portfolio reader remains authenticated + Costing Control Center view;
- builder/private snapshot objects remain postgres/service-owned only;
- no new Manage Products access.

Rollback:
- restore current portfolio RPC body;
- stop selecting the readiness index;
- retain/drop private build objects only after dependency verification;
- canonical single-SKU reader remains untouched throughout.

Assessment:
- **RECOMMENDED ARCHITECTURE.**
- It is the only reviewed option that removes the full 611 canonical build from every interactive request while preserving exact global filtering/statistics semantics and keeping CSE authority unchanged.

## A4. Recommended server architecture

Introduce a private governed readiness build/index layer.

Proposed private objects, names to be finalized in implementation review:

1. `costing.product_sku_readiness_portfolio_build`
   - build_id
   - period_start
   - valuation_date
   - evidence_refresh_run_id
   - population basis
   - source_fingerprint/version
   - started_at/completed_at
   - status
   - canonical definition identity/version metadata.

2. `costing.product_sku_readiness_portfolio_item`
   - build_id
   - sku_id/product_id
   - canonical assessment jsonb
   - overall_severity
   - searchable product/SKU fields
   - lifecycle/context fields needed for page filtering.

3. `costing.product_sku_readiness_portfolio_incidence`
   - build_id
   - sku_id
   - dependency_code
   - owner_module
   - route_code
   - issue/status fields required for same-incidence filtering/statistics.

4. private builder function/procedure
   - builds a new immutable candidate build using the existing canonical live core;
   - performs full validation/parity checks;
   - marks COMPLETED only after full success;
   - never mutates business/master data.

5. replace only the body of:
   `public.rpc_get_product_sku_readiness_portfolio(...)`
   so it:
   - resolves governed context;
   - verifies one current completed build;
   - fails closed when absent/stale;
   - performs filters/statistics/keyset against the private relational index;
   - returns the same client envelope wherever practical.

The governed-period and Product-gap readers do not need performance redesign.

## A5. Freshness contract required before implementation

Implementation must not proceed until the build freshness fingerprint is frozen.

At minimum it must cover every source that can change canonical readiness for the bound context, including:
- Product/SKU lifecycle/master state;
- BOM/batch/MRP/selling policy sources;
- route authority/effective route evidence;
- commercial sales assumption/default authority;
- evidence refresh run/snapshot identities;
- relevant shared issues/evidence source identities.

Preferred source-fingerprint design:
- deterministic version tuple/hash of authoritative source revisions or max mutation/audit identities already available;
- no timestamp guesswork;
- no "cache for N minutes" rule.

If a reliable source fingerprint cannot be constructed from existing authority/audit data, stop and review an explicit readiness-build refresh lifecycle rather than claiming live equivalence.

## A6. Why not increase timeout

Increasing authenticated statement_timeout is explicitly rejected as the primary remedy.

It would:
- mask the synchronous architecture;
- broaden runtime risk for all authenticated calls;
- not address repeated 611-SKU computation;
- weaken the existing fail-fast platform behavior;
- make future scale worse.

No timeout change is included in this package.

---

# Track B — Readiness UI correction

## B1. Fresh live defects

The successful screenshot confirms the data contract works when the request completes:
- Period 2026-09-01;
- valuation 2026-09-10;
- OPERATIONAL population 611;
- matched 611;
- returned 50;
- server severity counts 487 READY / 121 REVIEW_REQUIRED / 3 BLOCKER / 0 UNKNOWN.

It also proves material UX/shell issues:

1. old snapshot KPI strip remains visible above the live Readiness context and shows different counts (e.g. 489/636, 147), creating competing readiness stories;
2. raw HTML multi-select boxes dominate the filter surface;
3. Product-gap rows are dumped as long lists;
4. generic shell/search/context chrome visually competes with governed Readiness controls;
5. empty/unavailable register/detail states create large unbalanced whitespace;
6. successful state still lacks the compact register-first hierarchy used elsewhere in the application.

## B2. Recommended UI structure

### Active-lens shell behavior

When `portfolio-readiness` is active:
- hide the dashboard snapshot KPI strip;
- hide/suppress any generic valuation chip that can be mistaken for Readiness authority;
- retain the existing shell search as the single search authority;
- retain global Home/refresh shell controls only where semantically valid;
- show a small explicit badge/header: `Live governed readiness` with period + valuation.

When leaving Readiness:
- restore existing dashboard/snapshot shell elements unchanged.

### Compact top control row

Show:
- Governed period dropdown;
- Population scope segmented/select control;
- Filter button with active-filter count;
- Clear filters only when filters are active.

Do not show raw multi-select boxes permanently.

### Filter drawer/popover

Use the existing compact filter language:
- Severity chips/checks;
- Dependency grouped searchable choices;
- Owner choices;
- Route choices;
- Apply / Clear.

Server remains authority for options.

### Live summary strip

One compact strip under controls:
- Population;
- Matched;
- Returned;
- READY;
- REVIEW_REQUIRED;
- BLOCKER;
- UNKNOWN.

This replaces, rather than competes with, snapshot readiness KPIs while lens is active.

### Product-gap summary

Replace long inline lists with two compact cards:
- Active Products without SKU — count;
- Active Products without active SKU — count.

Each card:
- bounded preview (for example first 3–5 Product names);
- `View details` opens drawer/panel with the already returned bounded page;
- no readiness severity invented for Product facts.

### Main register/detail

Desktop:
- register consumes full main width;
- selected-row detail opens existing drawer pattern rather than permanent empty right pane.

Narrow:
- compact list/card rows;
- detail drawer/full-width panel;
- no permanent Action column.

### Loading/unavailable

Loading:
- stable skeleton/placeholder that preserves layout.

Unavailable:
- one compact failure panel in register area;
- keep governed context and gap summary only if those independent calls succeeded;
- no giant blank detail panel.

## B3. UI files expected to change

Frozen feature branch only:

- `public/shared/js/costing-suite-readiness.js`
- `public/shared/js/costing-suite-shell.js`
- `public/shared/costing-control-center.html`
- `public/shared/css/sasv-costing.css`
- `scripts/wp04-readiness-client-contract-smoke.mjs`
- `public/sw.js` only for the required monotonic asset-cache bump.

Expected unchanged:
- `costing-suite-registry.js`;
- `costing-route-config.js`;
- Manage Products;
- Product/SKU lifecycle;
- all specialist writers;
- unrelated shell modules.

No client business/readiness calculation may be added.

---

# Risks

## Server

1. **Freshness misrepresentation**
   - biggest risk of precomputation.
   - mitigation: source fingerprint + fail-closed stale status.

2. **Partial build exposure**
   - mitigation: immutable build IDs and atomic current-build selection after full validation.

3. **Authority drift**
   - mitigation: builder calls canonical core; no duplicated severity/business rules.

4. **CSE-P01 accidental reinterpretation**
   - mitigation: do not replace commercial point authority in this recovery; snapshot exact canonical results.

5. **Storage growth**
   - mitigation: bounded retention by governed context/build, with explicit retention plan; no deletion policy until separately reviewed.

## Client

1. hiding snapshot KPIs only while Readiness active must not alter other lenses;
2. filter drawer must preserve server option authority and single-search rule;
3. UI cleanup must not hide UNKNOWN/unavailable semantics;
4. service-worker asset update must remain bounded.

---

# Rollback

## Server
- keep exact pre-recovery C definitions frozen;
- restore current portfolio RPC if the materialized reader fails verification;
- canonical single-SKU reader and other C functions remain untouched;
- private build objects can be left inert until safe dependency-reviewed removal;
- no DROP CASCADE.

## Client
- revert only recovery UI commit(s) to accepted db7544f baseline;
- restore SW cache generation accordingly through forward monotonic release practice; do not downgrade deployed cache blindly;
- no Manage Products rollback.

---

# Required proofs before any production apply

## Track A package proof

Before production authorization:
1. exact source identities / rollback package;
2. source-fingerprint/freshness contract review;
3. builder parity against canonical live core for full 611 OPERATIONAL set;
4. all four severities and context fields parity;
5. dependency/owner/route same-incidence parity;
6. Product/SKU search and keyset parity;
7. global statistics/filter-count parity;
8. CSE-P01 unchanged proof;
9. ACL/private-object proof;
10. stale/absent/incomplete-build fail-closed proof;
11. performance test under an **8-second native-equivalent ceiling**, not 15s;
12. rollback rehearsal.

Performance target for recovery architecture:
- reliable native portfolio read with substantial headroom under 8s;
- provisional 3s page / 5s statistics goals remain engineering targets, not automatic acceptance SLAs;
- exact acceptance threshold must be frozen with measured prototype evidence before production apply.

## Track B proof

Before client acceptance:
1. existing shell search remains sole search authority;
2. snapshot KPI/valuation chrome hidden only during Readiness;
3. restored on lens exit;
4. server option/filter semantics unchanged;
5. compact gap summaries with bounded detail;
6. loading/unavailable/empty/UNKNOWN visually distinct;
7. desktop and narrow-window screenshots;
8. no writer/action controls;
9. no client-derived readiness/statistics;
10. targeted smoke + existing relevant suite.

## Integrated G7 re-entry proof

After both tracks are separately verified and any server apply is explicitly authorized/completed:
- rerun G7 from the top;
- allowed/denied permission matrix;
- governed period;
- OPERATIONAL/ALL_EXISTING;
- filters/search/keyset/gaps/detail;
- anonymous/private-helper denial;
- two normal signed-in request timings;
- visual/responsive acceptance.

---

# Exact authorization boundaries

This recovery architecture document authorizes **no implementation**.

Track A production work is high-risk and will require:
1. a separately reviewed concrete SQL/package;
2. explicit production authorization.

Track B client work may proceed only after the recovery package is accepted/frozen, under DEC-011 on the existing feature branch or a reviewed recovery branch.

No merge/release/publish/G8.
