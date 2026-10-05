# WP04 G7 Track B — Readiness UI Recovery Package V1

Status: **FROZEN CLIENT PACKAGE / NOT IMPLEMENTED**

## Authority and preserved server state

Track A is CLOSED and must not be reopened without fresh contradictory evidence.

Preserved production facts:

- promoted readiness Build ID: **4**
- ALL_EXISTING coverage: **1793 / 1793**
- OPERATIONAL coverage: **611 / 611**
- full OPERATIONAL canonical parity mismatch: **0**
- indexed public portfolio RPC is active
- CSE-P01 unchanged
- READINESS_BUILD_STALE / ABSENT / INCOMPLETE fail-closed behavior proven
- indexed portfolio performance proven safely inside the real 8-second native-equivalent ceiling

Track B is client-only.

## Accepted implementation base

Repository:
`Brahmadathanu/sasv-workspace-dev`

Accepted G5 branch:
`feat/wp04-g5-portfolio-readiness`

Exact accepted base/head:
`db7544f2ebdf30f515f249ade9e12a660a364476`

Fresh comparison at package preparation:
- branch is **identical** to `db7544f2ebdf30f515f249ade9e12a660a364476`
- branch is 2 commits ahead / 0 behind current main `e421fe8df9b98b4956acdcd4cadeb36a3f9b923c`

Implementation should use a dedicated recovery branch:

`fix/wp04-g7-track-b-readiness-ux`

created from exactly `db7544f2ebdf30f515f249ade9e12a660a364476`.

Do not implement directly on main.

## Exact accepted base file identities

Allowed-to-change base files:

- `public/shared/js/costing-suite-readiness.js`
  - blob `157dd03443565813d00663d8d102f56384aa8ff1`
- `public/shared/js/costing-suite-shell.js`
  - blob `43ce3f6e0ac216be4bc187651f4a9f18db74bdef`
- `public/shared/costing-control-center.html`
  - blob `70704d54ef3ce30435d677276d3d67850cbd5ad9`
- `public/shared/css/sasv-costing.css`
  - blob `ed275edee5c95650c812ab3f98a917ea834d1ff5`
- `scripts/wp04-readiness-client-contract-smoke.mjs`
  - blob `d87a8d7ab6a703e72b1c6ac0357a1f28233e84fa`
- `public/sw.js`
  - blob `f28ab585a523904172abed3ef15b8efc9993b04c`
  - current cache marker `hub-cache-v333`

Explicitly NOT allowed to change:

- `public/shared/js/costing-suite-registry.js`
- `public/shared/js/costing-route-config.js`
- any server SQL/RPC/schema/migration
- Manage Products
- Product/SKU lifecycle
- permissions/RLS/Auth
- any specialist writer
- any unrelated costing lens or shell redesign
- shared primitives files unless a separate package is reviewed

## Client authority constraints

Must preserve all accepted G5 boundaries:

- only the three deployed Readiness read RPCs are consumed:
  - `rpc_get_readiness_governed_periods`
  - `rpc_get_readiness_product_gaps`
  - `rpc_get_product_sku_readiness_portfolio`
- no writer RPCs
- no client-derived readiness severity precedence
- no client-derived canonical readiness totals
- no client-side reinterpretation of UNKNOWN
- no polling
- no all-page portfolio traversal
- no per-SKU fan-out
- server `filter_options` remains the only authority for selectable readiness filter values
- shell `#search` remains the only search input/authority

## Frozen UX correction

### 1. Readiness-active shell chrome

Add one bounded shell synchronizer, e.g. `syncReadinessShellChrome()`, called whenever lens chrome is painted/switched.

When `portfolio-readiness` is active:

- hide `#kpiStripWrap`;
- hide the snapshot freshness/valuation chrome represented by `#lastRefreshed`;
- preserve the existing G5 behavior that hides/disables `#costingPeriodSelect`;
- hide the generic table shell card/chrome so it cannot leave a blank competing region;
- keep `#globalSearchCard` / `#search` visible and enabled;
- keep lens navigation/header chrome;
- add/toggle a single body or host state class such as `cp-readiness-active` only if useful for scoped CSS.

When leaving Readiness:

- restore KPI visibility through existing shell authority (`applyKpiStripVisibility()`), not a hard-coded assumption;
- restore freshness/valuation chrome to its prior shell behavior;
- restore generic table chrome for the destination lens;
- restore period behavior through existing `syncPeriodControlState()`;
- remove any Readiness-only body/host class.

No other lens may change visually.

### 2. Compact governed controls

Replace the present two-row oversized toolbar with one compact top control bar.

Required visible controls:

- Governed period select — existing authoritative `#readinessPeriodSelect`;
- Population scope select — existing authoritative `#readinessPopulationScope`;
- Filter button — new, compact, with active-value badge/count;
- Clear action — visible/enabled only when readiness filters are active.

Period/population changes retain existing load/keyset reset semantics.

### 3. Filter drawer + applied chips

The raw permanently visible:
- Dependency multi-select;
- Owner module multi-select;
- Recommended route multi-select;

must no longer be presented as native `multiple size=3` blocks.

Use a compact Readiness-owned drawer/popover, visually based on existing Costing/Stock Checker/PEQ primitives (`.peq-filter-btn`, `.peq-filter-drawer`, checklist/chip language) without changing global primitives.

Drawer sections:

- Overall severity
- Dependency
- Owner module
- Recommended route

Rules:

- every option comes only from current server `filter_options`;
- selection is presentation state only;
- applying filters uses the existing portfolio request fields unchanged;
- Filter button badge counts active selected values only;
- outside click / Escape closes the drawer;
- keyboard focus remains usable;
- Clear removes readiness filters and resets keyset using existing rules.

Below or adjacent to controls, render a compact applied-filter chip row:

- one chip per selected value;
- chip removal updates the existing filter state and reloads;
- chips are labels only, not readiness authority.

No new search box inside the drawer.

### 4. One live readiness summary strip

Replace competing/stacked readiness context/stat cards with one compact live strip.

The strip must display server-derived values only:

- population count
- matched count
- returned count
- READY
- REVIEW_REQUIRED
- BLOCKER
- UNKNOWN

Also show a compact governed-context caption/badge derived from the server envelope:
- governed period
- valuation date
- `LIVE_AS_OF` / governed context indication

Do not display the old dashboard snapshot KPI values while Readiness is active.

UNKNOWN remains a real server severity and must never be used as a substitute for unavailable/error state.

### 5. Product gaps: compact cards, bounded preview

Replace long inline `cp-readiness-gap-list` dumps with exactly two compact summary cards:

- Active products without SKU
- Active products without active SKU

Each card must show:

- server count;
- at most **3** product-name preview rows in the collapsed card;
- explicit `View details` control when rows exist.

Drill-in behavior:

- may expand an in-lens detail panel/disclosure or use a compact modal/drawer pattern;
- show only the already returned bounded server page (current G5 gap limit <=25);
- if server says `has_more`, state clearly that the detail is a bounded preview (for example “Showing first 25 of N matched”);
- do not automatically traverse all Product-gap pages;
- do not add a gap-specific search box;
- do not invent readiness severity for Product membership gaps.

Gap RPC contract remains unchanged.

### 6. Register is primary/full-width content

Readiness host/register must use the full available content width.

Required:

- no permanent second detail pane;
- no blank generic table card alongside/below the Readiness register;
- desktop uses the existing 7-column Readiness table;
- row selection continues to call the existing shell `openDetails(...)`;
- selected SKU detail renders through existing `#detailsModal` / drawer-tab pattern;
- no Action column;
- selected-row highlighting may remain.

The existing Readiness drawer contract:
- title/subtitle from `portfolioReadinessCtrl.getDrawerConfig`;
- Readiness tab from `renderDrawerTab`;

must be reused rather than creating a new authority/detail implementation.

### 7. Loading / unavailable / empty states

Loading:

- controls remain spatially stable;
- summary/register use a compact loading placeholder/skeleton/status;
- no giant empty region;
- pagination disabled while loading.

Portfolio unavailable:

- show one clear compact `Readiness unavailable` panel in the register region;
- include server/client error text already available;
- do not render UNKNOWN as fallback;
- disable portfolio pagination;
- independent Product-gap cards may remain if their request succeeded.

Product gaps unavailable:

- show a compact gap-area unavailable state only;
- do not collapse the entire portfolio lens.

Empty matched result:

- show `No readiness rows match the current filters`;
- retain governed context, summary counts and active-filter chips.

### 8. Narrow-window behavior

At <=900px retain the accepted table→card switch.

Additional requirements:

- governed controls wrap compactly without horizontal page overflow;
- Filter drawer fits viewport and becomes width-constrained/full-width as needed;
- applied chips wrap;
- Product-gap cards stack cleanly;
- Readiness cards remain the primary list;
- detail modal/drawer is usable on portrait/mobile width;
- no permanently visible horizontal multi-select boxes.

## Expected HTML structure changes

The implementer may introduce Readiness-scoped IDs/classes such as:

- `readinessFilterBtn`
- `readinessFilterBadge`
- `readinessFilterDrawer`
- `readinessAppliedFilters`
- `readinessSummary`
- `readinessGapDetails`

Existing authoritative IDs for period/population/table/cards/page controls should be retained unless a compelling implementation reason is documented.

The generic shell table card may receive a stable ID such as `genericTableCard` solely so shell visibility can be controlled reliably.

No duplicate `id="search"` and no `id="readinessSearch"`.

## CSS / visual language

Use existing SASV variables/primitives:

- `--sasv-surface`
- `--sasv-surface-soft`
- `--sasv-border`
- `--sasv-divider`
- `--sasv-radius-sm/md`
- existing `sc-btn`, `icon-btn`, `peq-filter-*`, chip/status patterns where compatible

Target density:
- compact Stock Checker / Costing Control Center register language;
- restrained borders/backgrounds;
- no oversized cards;
- no rainbow KPI treatment;
- no bespoke visual system.

All new CSS must be scoped to:
`body.sasv-costing-control-center .cp-readiness-...`
or a Readiness-active shell state.

## Service worker

If any cached client asset changes, bump cache monotonically:

`hub-cache-v333` → `hub-cache-v334`

Do not alter unrelated SW behavior.

## Exact smoke/test requirements

Update only `scripts/wp04-readiness-client-contract-smoke.mjs` to preserve existing G5 contract tests and add Track B structural assertions.

Required smoke assertions:

1. the three Readiness RPC names remain the only Readiness RPC contract;
2. no writer RPC path is introduced;
3. no `readinessSearch` exists; shell `#search` remains authoritative;
4. severity/dependency/owner/route options remain sourced from server `filter_options`;
5. raw visible `multiple size="3"` Readiness filter blocks are absent;
6. filter button/drawer/applied-chip hosts exist;
7. Readiness-active shell logic hides snapshot KPI/freshness chrome;
8. shell exit logic restores destination-lens chrome;
9. Product-gap collapsed preview is bounded to <=3 rows;
10. drill-in does not auto-traverse gap pages;
11. register remains read-only and has no Action column;
12. selected assessment still uses existing shell details path;
13. loading/unavailable/empty states are distinct from UNKNOWN;
14. no new client readiness severity/totals authority appears;
15. existing stale-response/keyset/search tests continue passing;
16. SW cache marker is exactly `hub-cache-v334`;
17. registry and route-config files remain unchanged.

Required commands/evidence:

- `node scripts/wp04-readiness-client-contract-smoke.mjs`
- `node --check public/shared/js/costing-suite-readiness.js`
- `node --check public/shared/js/costing-suite-shell.js`
- `git diff --check`
- implementer records exact command results.

Any pre-existing unrelated legacy smoke failure must be reported separately and must not be “fixed” in this Track B package.

## Visual proof matrix

Implementation is not acceptable on smoke alone.

Provide screenshots from the exact recovery branch/worktree for:

1. **Desktop success / filter closed**
   - Readiness active
   - no snapshot KPI strip
   - no snapshot valuation/freshness badge
   - governed controls compact
   - live summary strip
   - two compact gap cards
   - full-width register

2. **Desktop filter drawer open**
   - all four filter sections
   - server-derived options
   - badge/chips visible
   - no raw multi-select blocks

3. **Desktop selected detail**
   - existing details modal/drawer open from a register row
   - register remains full width behind it

4. **Desktop unavailable**
   - compact unavailable panel
   - UNKNOWN not substituted
   - no giant blank register/detail region

5. **Narrow/portrait success** approximately 390–430 CSS px wide
   - controls wrap
   - card list visible
   - gap cards stack
   - no horizontal page overflow

6. **Narrow filter/detail**
   - filter drawer usable
   - selected detail usable

7. **Lens exit restoration**
   - switch Readiness → Dashboard (or other Control Center lens)
   - snapshot KPI/freshness chrome restored
   - ordinary shell/table chrome restored
   - Readiness-only class/host hidden

Unavailable-state visual proof may use a temporary local/mock/network-failure harness that is **not committed**. It must not mutate production or alter the accepted server contract.

## Implementation workflow

Per DEC-011 / DEC-014:

1. Create `fix/wp04-g7-track-b-readiness-ux` from exact base `db7544f2ebdf30f515f249ade9e12a660a364476`.
2. Cursor/Codex implements autonomously within this frozen package.
3. Cursor/Codex runs tests, self-reviews, commits and pushes.
4. It reports:
   - starting base SHA;
   - final feature SHA;
   - exact changed-file list;
   - command results;
   - visual proof screenshots;
   - any deviations.
5. ChatGPT independently audits the actual Git diff and evidence.
6. No merge without fresh explicit user authorization.

## Allowed changed files — exact maximum set

Only these six files may change:

1. `public/shared/js/costing-suite-readiness.js`
2. `public/shared/js/costing-suite-shell.js`
3. `public/shared/costing-control-center.html`
4. `public/shared/css/sasv-costing.css`
5. `scripts/wp04-readiness-client-contract-smoke.mjs`
6. `public/sw.js`

A smaller changed-file set is acceptable.

Any seventh file = STOP and re-review unless it is generated evidence that is explicitly excluded from product source and separately approved.

## Rollback scope

Before merge/release, rollback is client-only:

- revert Track B implementation commit(s) on the recovery branch to exact base `db7544f2ebdf30f515f249ade9e12a660a364476`;
- no server rollback;
- no Track A change;
- no DB mutation;
- no permission mutation.

Do not use destructive reset/clean on shared work.

No production/release rollback is part of this package because merge/release is not authorized here.

## G7 restart criteria

G7 may restart only after ALL are true:

1. Track B implementation is complete on the reviewed recovery branch.
2. Changed files are within the six-file allowlist.
3. Updated Track B smoke passes.
4. Independent ChatGPT diff audit passes.
5. Desktop/narrow visual matrix passes.
6. Snapshot KPI/freshness chrome is proven hidden only while Readiness is active and restored on exit.
7. Shell search remains the single search authority.
8. No new client readiness/business authority exists.
9. Track A remains current/fresh on a read-only check:
   - indexed public reader active;
   - Build ID 4 still current/fresh, **or** fresh evidence is raised and G7 remains blocked pending a separately governed server refresh decision.
10. User explicitly authorizes G7 restart after Track B acceptance.

When G7 restarts, restart from the beginning; do not resume mid-matrix.

## Stop boundary

This package authorizes **no client implementation**.

Do not:
- edit the six files yet;
- create/merge/release/publish;
- rerun G7;
- begin G8;
- alter Track A/server state.
