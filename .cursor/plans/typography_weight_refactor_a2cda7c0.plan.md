---
name: Typography Weight Refactor
overview: Normalize Costing & Pricing screen typography by introducing module-level font-weight tokens and replacing the current 700–800 / `<strong>`-heavy pattern with a restrained ERP hierarchy (400 body, 500 labels, 600 headings/metrics). Print/PDF cost sheet styles are explicitly excluded.
todos:
  - id: tokens-css
    content: Add :root typography tokens and cp-modal-title / cp-cell-primary classes in costing-pricing.html
    status: pending
  - id: css-weights
    content: Replace 700/800 font-weight rules in screen UI selectors with token values (exclude .cost-sheet-a4)
    status: pending
  - id: html-titles
    content: Replace modal <strong> titles with <span class="cp-modal-title"> in costing-pricing.html
    status: pending
  - id: js-strong
    content: Replace <strong> in costing-pricing.js render helpers with cpCellPrimary / cp-field-label pattern
    status: pending
  - id: qa
    content: Run syntax/lint/grep checks and visual smoke test across KPIs, tables, modals, dark theme
    status: pending
isProject: false
---

# Costing & Pricing — Typography Weight Refactor Plan

**Planning pass only — no files will be modified until approved.**

---

## Problem diagnosis

The module currently feels “all bold” because weight is stacked in three layers:

1. **CSS uses extra-heavy weights** — many rules at `700` and `800` in [`public/shared/costing-pricing.html`](public/shared/costing-pricing.html)
2. **HTML uses `<strong>` for modal titles** — browser default `font-weight: 700` on top of any inherited weight
3. **JS renders table primary cells with `<strong>`** — ~28 occurrences in [`public/shared/js/costing-pricing.js`](public/shared/js/costing-pricing.js)

Worst offenders (screen UI):

| Area | Selector / pattern | Current weight |
|------|-------------------|----------------|
| KPI values | `.kpi > div:last-child` | **800** |
| KPI labels | `.kpi > div:first-child` | 600 |
| Card values | `.cp-card-value` | **800** |
| Card labels | `.cp-card-label` | **700** |
| Section titles | `.cp-section-title` | **800** |
| Workbench sub-tabs | `.cp-workbench-summary-card .cp-card-value` | **700** |
| Status chips | `.status-chip`, `.cp-status-text` | **700** |
| Lens pills | `.lens-pills .pill` | **700** |
| Modal drawer tabs | `.modal-window .tab` | **700** |
| Form labels | `.sign-grid label` | 600 |
| Dashboard main line | `.cp-dashboard-main` | **700** |
| Modal titles | `<strong>` in headers | **700** (semantic) |
| Table primary text | `<strong>` in `renderRowForLens()` | **700** (semantic) |

Note: `.modal-content` already has lighter overrides (`cp-card-value: 500`, table cells `400`) but **in-page sign modals** (Manual Provision, Staff Classification, etc.) use `.cost-sheet-sign-modal` and inherit the heavy global `.cp-card-value` / `<strong>` rules.

**Excluded per your choice:** all `.cost-sheet-a4` / print/PDF typography (letterhead, print tables, section rows) — unchanged.

---

## Design target (professional ERP hierarchy)

Use **weight + size + color + uppercase** for hierarchy — not blanket bold.

Proposed module tokens (add near top of `<style>` in `costing-pricing.html`):

```css
:root {
  --cp-fw-body: 400;
  --cp-fw-muted: 500;
  --cp-fw-label: 500;      /* field labels, chip text, pill text */
  --cp-fw-emphasis: 500;   /* primary table cell text */
  --cp-fw-heading: 600;    /* modal titles, page context */
  --cp-fw-metric: 600;     /* KPI values, card values */
  --cp-fw-section: 600;    /* uppercase section headers */
}
```

Target mapping:

| Role | New weight |
|------|------------|
| Body / table cells | 400 |
| Muted secondary lines (`.cp-muted-text`) | 500 (already) |
| Labels, chips, pills, sign-grid labels | 500 |
| Modal titles, active pill/tab | 600 |
| KPI values, card values, dashboard main | 600 |
| Section titles (uppercase) | 600 |

**No screen UI should use 700 or 800** after refactor (except print block).

---

## Affected files

| File | Change type |
|------|-------------|
| [`public/shared/costing-pricing.html`](public/shared/costing-pricing.html) | Primary — tokens + CSS weight normalization + modal title markup |
| [`public/shared/js/costing-pricing.js`](public/shared/js/costing-pricing.js) | Secondary — replace `<strong>` in render helpers with semantic class |

**Not touched:** `style.css`, other modules, Staff Directory Manager, server SQL, print/PDF block inside cost sheet.

---

## Reference pattern

Keep hierarchy through existing non-weight cues already in the module:

- Uppercase micro-labels (`.cp-card-label`, KPI label row)
- Muted secondary lines (`.cp-muted-text`, `.cp-dashboard-sub`)
- Color on status chips and active tabs
- Tabular nums on metrics

This matches [`.cursor/rules/002-ui-design-language.mdc`](.cursor/rules/002-ui-design-language.mdc): reuse existing classes, no new visual language.

---

## Implementation phases

### Phase 1 — Typography tokens + global screen rules (HTML CSS only)

Add `:root` tokens and base resets scoped to screen UI:

```css
.cost-sheet-sign-header strong,
.modal-header strong,
.cp-modal-title {
  font-weight: var(--cp-fw-heading);
  font-size: 14px;
}
```

Update these selectors to use tokens (replace literal `700`/`800`):

- `.kpi > div:first-child` → `--cp-fw-label`
- `.kpi > div:last-child` → `--cp-fw-metric`
- `.cp-card-label`, `.cp-kv dt` → `--cp-fw-label`
- `.cp-card-value` → `--cp-fw-metric`
- `.scheme-policy-sku-card .cp-card-value` → `--cp-fw-emphasis`
- `.cp-section-title` → `--cp-fw-section`
- `.cp-workbench-summary-card .cp-card-value` → `--cp-fw-emphasis`
- `.cp-workbench-summary-card .icon-btn` → `--cp-fw-label`
- `.status-chip`, `.cp-status-text` → `--cp-fw-label`
- `.lens-pills .pill` → `--cp-fw-label` (active state can stay 600 via `.pill.active`)
- `.modal-window .tab` → `--cp-fw-label`
- `.sign-grid label` → `--cp-fw-label`
- `.cp-dashboard-main` → `--cp-fw-emphasis`
- `.cp-change-positive`, `.cp-change-negative` → `--cp-fw-emphasis` (not 700)
- `.cp-loading-panel` → `--cp-fw-label`
- `.peq-filter-section-title`, `.peq-filter-badge` → keep readable but drop to 600/500
- `.modal-content .cp-printable-section-row td` → only if not print; verify selector is screen modal only

Add explicit guard so print block is untouched:

```css
/* Do not modify weights inside printable cost sheet output */
.cost-sheet-a4,
.cost-sheet-a4 * {
  /* no font-weight overrides here */
}
```

### Phase 2 — Modal title markup (HTML)

Replace `<strong>` modal titles with `<span class="cp-modal-title">` in [`costing-pricing.html`](public/shared/costing-pricing.html) (~14 headers):

- `manualProvisionEditTitle`, deactivate modal title
- `drawerTitle`, `costSheetModalTitle`
- All `cost-sheet-sign-modal` titles (signatory, snapshot, selling policy, scheme, expense mapping, staff, manual rate, etc.)

Keep IDs on titles where JS sets text (`manualProvisionEditTitle`).

### Phase 3 — Table / render helpers (JS)

Introduce one helper or class:

```js
function cpCellPrimary(value) {
  return `<span class="cp-cell-primary">${text(value)}</span>`;
}
```

```css
.cp-cell-primary {
  font-weight: var(--cp-fw-emphasis);
  color: var(--text, #0f172a);
}
```

Replace `<strong>` in render functions (~28 hits), including:

- `productSkuLabel()`, `staffGovernanceStaffLabel()`
- `renderRowForLens()` primary columns (manual provisions, cost/staff governance, policy manager, manual rate, etc.)
- Cost sheet status/meta lines where screen preview uses strong labels — use `<span class="cp-field-label">` + normal weight value pattern instead of `<strong>Label:</strong>`

**Do not** change data, RPCs, or column structure — typography only.

### Phase 4 — Button text normalization

Text buttons inside modals (`Cancel`, `Save`, `Deactivate` text if any remain) inherit bold from nowhere today, but verify:

```css
.cost-sheet-sign-actions .icon-btn:not(.icon-btn-primary) {
  font-weight: var(--cp-fw-label);
}
```

SVG-only buttons unaffected.

### Phase 5 — Lint + visual QA

Static:

- `node --input-type=module --check` on `costing-pricing.js`
- ESLint on changed JS
- `git diff --check`
- Grep: no new `font-weight: 800` outside `.cost-sheet-a4` block

---

## What must NOT change

- Business logic, lenses, modals behavior, RPCs, table columns
- Print/PDF cost sheet typography (`.cost-sheet-a4` and children)
- Shared global `style.css` or other modules
- Color system, borders, chip colors, layout spacing
- Dark theme compatibility (weights only; colors stay)

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| UI feels too flat | Keep 600 on metrics/headings; use uppercase labels + color for status |
| Inconsistent before/after across lenses | Phase 1 token swap hits all lenses at once |
| Missing a `<strong>` bypasses CSS | Phase 3 JS sweep + grep for `<strong>` and `font-weight: 7/8` |
| Modal content drawer vs sign modal differ | Apply `.cp-modal-title` + tokenized `.cp-card-value` to both families |
| Regression in printable preview inside modal | Exclude `.cost-sheet-a4`; preview iframe/content keeps print weights |

---

## Smoke tests after implementation

### Visual (screen UI)

1. **KPI strip** — labels readable but not heavy; values clear at 600, not “shouting”
2. **Lens pills** — inactive 500, active 600 + color (not bold block)
3. **Workbench sub-tabs** (Cost Governance, Staff Governance, Manual Provisions) — hint text normal weight
4. **Main table** — primary column slightly emphasized; secondary lines muted; status chips 500
5. **Details drawer modal** — title 600; tab labels 500; body 400
6. **Sign modals** (Manual Provision edit/deactivate, Staff Classification, etc.) — title 600; field labels 500; card values 500–600
7. **Manual Provisions** — row primary text not bold-block; deactivate flow unchanged
8. **Dark theme** — spot-check KPI + modal (no contrast loss)

### Static

- JS syntax check
- ESLint
- `git diff --check`
- `rg 'font-weight:\s*(700|800)' costing-pricing.html` — only inside `.cost-sheet-a4` / print section
- `rg '<strong>' costing-pricing.js costing-pricing.html` — zero or only print-related

### Explicit non-regression

- Open Cost Sheet PDF preview — print document still uses original heavier print typography
- All existing modal open/close/focus behavior unchanged

---

## Recommended rollout

Execute as **one approved PR** with phases 1→3 in sequence (CSS first for immediate global improvement, then HTML titles, then JS cell cleanup). Phase 4 optional if buttons look fine after phase 1.

Estimated touch surface: ~60 CSS declarations in HTML, ~14 HTML title tags, ~28 JS string replacements — contained to Costing & Pricing only.
