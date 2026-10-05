# WP04-G5 — Frozen client implementation package

2026-10-05. **PACKAGE FROZEN / IMPLEMENTATION NOT STARTED.**

## Entry authority

WP04-G4 is formally closable at server level because:

- C-R01 PASS;
- C-R02 PASS;
- independent readback PASS;
- CSE compatibility PASS, with CSE-P01 still parked and unchanged;
- payload / nonmonetary / monetary-note audit PASS;
- live no-success compatibility PASS;
- ALL_EXISTING / filter behavior PASS;
- full-611 C-induced semantic parity PASS compositionally;
- performance feasibility ACCEPTED WITH MEASURED LIMITATION:
  - 6938.008 ms;
  - 5084.304 ms;
  - both full-611 OPERATIONAL/full-statistics;
  - provisional 3s/5s goals remain UNMET/NON-BLOCKING;
- committed C deployment PASS;
- immediate post-deployment verification PASS;
- conditional rollback not triggered / NOT CONSUMED;
- native Auth/API structural preflight PASS;
- native Auth/API runtime verification deliberately deferred to mandatory G7 signed-in/live verification.

The active production server contract is authoritative. G5 must not invent, replace, weaken or recompute it.

## G5 objective

Implement one **read-only Portfolio Readiness lens** inside the existing Costing Control Center so authorized users can consume the deployed WP04 server contract for:

- governed-period selection;
- explicit OPERATIONAL vs ALL_EXISTING SKU scope;
- full server-produced readiness statistics;
- bounded server-side filtering/search;
- keyset pagination;
- Product-without-SKU / active-without-active-SKU gap visibility;
- canonical selected-SKU readiness detail;
- descriptive dependency/owner/route/evidence metadata.

This is central visibility and guided navigation only. It is not a new costing authority, editor, activation workflow, acceptance workflow, writer, or top-level module.

## Frozen server contracts

Client may call only the reviewed public read contracts needed by this lens:

1. `public.rpc_get_readiness_governed_periods(date, integer)`
2. `public.rpc_get_readiness_product_gaps(text, text, text, bigint, integer)`
3. `public.rpc_get_product_sku_readiness_portfolio(date, text, text[], text[], text[], text[], text, bigint, integer)`

Existing canonical `public.rpc_get_product_sku_readiness(bigint,date,text,bigint)` remains server authority and may only be used where current reviewed client architecture genuinely requires a separate selected-SKU refresh. Do not duplicate readiness composition in JavaScript.

The new readers require Costing Control Center view. Do not add Product-only access to the new portfolio lens.

## Exact client files in scope

### New

- `public/shared/js/costing-suite-readiness.js`
  - API adapter/controller;
  - strict response-envelope validation;
  - request state;
  - governed-period loading;
  - population/filter/search state;
  - keyset pagination;
  - stale-response/race protection;
  - loading / unavailable / empty distinctions;
  - read-only row/detail rendering helpers;
  - escaping/safe text handling;
  - no business-rule calculation.

- `scripts/wp04-readiness-client-contract-smoke.mjs`
  - mocked contract tests for request generation, response validation, stale request suppression, keyset paging, reset rules, unavailable vs UNKNOWN distinction, read-only boundaries and forbidden writer calls.

### Existing files allowed to change

- `public/shared/js/costing-suite-registry.js`
  - add exactly one `portfolio-readiness` lens under `control-center`;
  - label `Readiness`;
  - period-scoped;
  - preserve all existing lens definitions/order except the bounded addition.

- `public/shared/js/costing-route-config.js`
  - add `portfolio-readiness` to the existing Control Center lens allowlist only;
  - no new module/route/permission target;
  - Dashboard remains default.

- `public/shared/js/costing-suite-shell.js`
  - import/lifecycle integration for the readiness controller;
  - explicit readiness load/render/detail dispatch before generic snapshot handling;
  - readiness-specific governed-period state;
  - invalidate in-flight response on lens/period/scope/filter/search/page-changing state;
  - do not feed readiness rows to generic monetary/detail/diagnosis fetchers;
  - do not use local full-catalog filtering for server readiness filters;
  - existing three Control Center controller paths remain unchanged except bounded dispatch integration.

- `public/shared/costing-control-center.html`
  - minimal readiness-only containers/hooks if required;
  - hidden outside the readiness lens;
  - no duplicate application shell/module;
  - no specialist mutation controls.

- `public/shared/css/sasv-costing.css`
  - scoped readiness layout/accessibility/responsive styles only;
  - no broad visual redesign (WP11).

- `public/sw.js`
  - include new/changed readiness asset(s) as necessary;
  - exactly one monotonic cache-name increment;
  - no unrelated service-worker policy change.

## Explicitly out of scope files/surfaces

Do not change unless a concrete contradiction is found and implementation stops for review:

- `js/products.js` / Manage Products implementation;
- Manage Products HTML;
- launcher/module registry outside existing Costing Suite registry;
- `main.js`;
- package/version/lock files;
- permission targets or role assignments;
- server SQL/RPC/schema/RLS/Auth;
- Material acceptance writer;
- Marketing acceptance writer;
- Pricing/Route/QC/MS specialist editors;
- refresh/run writers;
- CSE-P01 authority;
- existing WP02/WP03 lifecycle behavior.

## UI / contract semantics

### Period

- Load periods from `rpc_get_readiness_governed_periods`.
- Use the newest returned governed period as the initial selection only after a successful catalog response.
- Do not use browser month, calendar fallback, snapshot period state, `AVAILABLE_COSTING_PERIODS`, or `activePeriodIso` as readiness authority.
- Display governed valuation/context from server responses.
- A period-load failure is Unavailable, not empty/UNKNOWN.

### Population

Expose exactly:

- `OPERATIONAL` — Active Product + active non-sample SKU;
- `ALL_EXISTING` — all existing SKUs.

Do not infer readiness from lifecycle.

Product-gap display uses the deployed gap reader and its server-supported Product/gap scope vocabulary. Gap rows are entity facts, not SKU readiness and receive no fabricated readiness severity.

### Severity

Display exact server overall values:

- READY
- REVIEW_REQUIRED
- BLOCKER
- UNKNOWN

Do not turn UNKNOWN into READY.
Do not turn REVIEW_REQUIRED into READY.
Do not invent client severity precedence.
Dependency BLOCKED and overall BLOCKER remain distinct raw server vocabulary.

### Statistics / filters

- Render server-produced statistics only; never derive portfolio totals from the current page.
- Filters/search are sent to the server.
- Preserve server semantics: OR within a filter category, AND across categories, same-incidence dependency/owner/route behavior.
- Use server-returned filter options/counts; do not scan all pages to build options.
- Show population count, matched count, returned count as distinct concepts.

### Pagination

- Keyset pagination only through `after_sku_id` / `next_after_sku_id`.
- Page limit must remain bounded by server contract; client must not request an unlimited result.
- Any period/scope/filter/search change resets keyset traversal.
- Stale responses must never overwrite newer state.

### Detail

Selected SKU detail is read-only and server-derived.

Show relevant:

- identity/lifecycle;
- context;
- five canonical summary dimensions;
- overall severity;
- dependencies;
- raw/effective statuses;
- applicability;
- owner module;
- recommended route code as descriptive text;
- reason/note/evidence references where returned;
- downstream control;
- shared issues.

Do not calculate a “first blocker”, urgency score, issue age or Product readiness roll-up in the client.

### Navigation

For G5, owner and recommended-route values are **text only**.

Do not invent links for unsupported route codes.
Do not add Marketing acceptance controls.
Do not assume Product Master deep links.
Existing specialist links elsewhere remain untouched.

A supported navigation subset may only be added later if separately frozen against exact existing destination/permission/context evidence.

### Error behavior

Keep separate:

- server UNKNOWN = valid readiness state;
- empty result = valid zero rows;
- unavailable/load/permission/timeout = request failure.

Never convert request failure into UNKNOWN, READY, zero statistics or empty catalog.

## Responsive / UX boundary

Use the existing Costing Suite visual language.

- desktop/tablet: compact portfolio table/register;
- narrow layout: compact readable list/card treatment if needed;
- avoid tall WP02-style card repetition;
- no broad visual polish outside the lens;
- keyboard/accessibility labels for controls and detail;
- no permanent Action column.

## Required implementation checks

Cursor/Codex implementation must run, at minimum:

- syntax checks for every changed/new JS/MJS asset;
- `node scripts/wp04-readiness-client-contract-smoke.mjs`;
- relevant existing Costing Suite shell/registry/route smoke checks discovered in repo;
- service-worker/cache references checked;
- no conflict markers;
- diff/self-review for unrelated changes;
- search proving no client-side readiness precedence/totals and no writer invocation added.

No live authenticated production verification is claimed at G5. That belongs to G7 after G6 audit.

## Required report from implementer

Report:

- isolated feature branch/worktree;
- base main SHA;
- final commit SHA(s);
- changed files;
- checks and exact results;
- self-review findings/fixes;
- unresolved items;
- human/live verification required later.

No merge/version/tag/release/publish.

## Stop conditions

Stop before implementation broadens if any of these occur:

- deployed RPC payload differs materially from this frozen contract;
- current shell architecture requires changing unrelated modules;
- a server change/RPC/permission change appears necessary;
- a specialist writer/edit workflow would be needed;
- a route link cannot be proven;
- business/UX behavior becomes genuinely ambiguous;
- client work would need to alter WP02/WP03 lifecycle behavior;
- tests expose a server/client contract contradiction.

## Gate flow

- G4: CLOSED / verified server contract active.
- G5: package frozen; implementation not yet started.
- G6: ChatGPT audits actual pushed implementation and may issue one consolidated correction pass.
- G7: mandatory signed-in/live verification, including native Auth/API permission matrix and live performance.
- G8: explicit merge/post-merge/documentation closure.

Implementation may begin only after this package review is accepted as frozen under DEC-011.
