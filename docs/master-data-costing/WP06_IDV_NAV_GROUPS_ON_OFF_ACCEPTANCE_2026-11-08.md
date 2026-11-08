# WP06 focused ID-V flag ON/OFF acceptance — evidence record (issue #222)

**Evidence only. Not a WP06 closure, not owner sign-off, formal count stays 5/13.** Read-only, URL navigation only (no clicks, no write controls). Screenshots, tokens and the session file are kept outside Git (they show real product names).

## 1. Identity, build, method
| Item | Result |
|---|---|
| Identity | ID-V proven: session permissions == owner-supplied canonical extract (6 rows, 6 view / 0 edit grants) |
| Served build | `verify-served-assets.mjs` against `main` `883a9f1c1ed4bb1f67f490d7923ffa670a8a1fb8`: **VERIFIED [HOSTED] 72/72**, cache `hub-cache-v392` (2 HTML files via documented `NETLIFY_INJECTED_BANNER_V1` normalisation) |
| Source drift | `git diff --stat 51cd26f3 origin/main -- . ':!docs'` is empty: earlier ID-V evidence at `51cd26f3` (S8) applies to current source |
| Widths | 1280 px and 390 px |
| Flag method | `COSTING_NAV_GROUPS_V1="1"` set only in a disposable Playwright context's localStorage; no global/production setting touched. The harness first clears every `COSTING_*_V1` key |
| Network guard | Repo allow-list on every request: **0 violations, 0 blocked**. Request kinds seen: `rpc-read` and `rest-read` only (GETs of views, POSTs to `get_user_permissions`, `rpc_get_cost_period_valuation_context`, `rpc_get_sales_allocation_default_policies`, `rpc_get_regional_sales_allocation_default_policies`) plus Supabase `auth/v1/token` (see §4) |
| Temp output | `D:` only; nothing deleted |

## 2. Flag ON (new evidence, this run)
All 10 `?workspace=` deep links at both widths (20 observations):
- Five groups present and exactly as the contract: **SKU policies** (`sku-overview`) / **MRP** (`sku-mrp-policies`, `product-derivation-policies`) / **MRP change workflow** (`mrp-proposals`, `proposal-decisions`, `approved-for-application`, `applied-proposal-history`) / **Schemes** (`scheme-master`, `scheme-rule-register`) / **Costing inputs** (`commercial-sales-assumptions`). 4 separators, 10 tabs in contract order, select optgroups match. **20/20 PASS.**
- Each deep link activated the requested workspace: **20/20**.
- Legacy/default routes (both widths): no query → `sku-overview`; `?lens=policy-manager` → `sku-overview`; `?lens=mrp-governance` → `sku-mrp-policies`. **6/6 PASS.**
- View-only text visible on every observation; horizontal overflow 0 px everywhere.
- No visible enabled mutating control. (The scripted pattern matched the navigation tab "Approved for Application" on every page; it is a workspace tab, not a write control — reviewed as a false positive.)

## 3. Flag OFF and restoration
- OFF contexts (2 workspaces × 2 widths): legacy 3 groups (MRP Policy Setup / MRP Change Workflow / Selling & Schemes), 10 tabs, 2 separators, no flag key stored.
- Restoration: a brand-new no-flag context shows the legacy 3-group layout, no `COSTING_NAV_GROUPS_V1` key; the saved session file is byte-identical to before the run and contains no `COSTING_*_V1` key. **Restored OFF: verified.**

## 4. Errors, verbatim (not a clean run)
| Where | Verbatim |
|---|---|
| 1280, flag ON, `scheme-master` (1×) | `500 …/rest/v1/v_costing_scheme_master_register`; console `[costing-suite] Initialization error {code: 57014, details: null, hint: null, message: canceling statement due to statement timeout}`; `Failed to load resource: the server responded with a status of 500 ()`. Table showed **0 rows** at this load. Same behaviour class as the known cold-start timeout of #211/#214; at 390 px the same view returned 7 rows. **scheme-master @1280 ON = FAIL (render/data), not hidden.** |
| 390 ON (13×), 1280 OFF (3×), 390 OFF (2×) | `400 https://qhmoqtxpeasamtlxaoak.supabase.co/auth/v1/token` with console `Failed to load resource: the server responded with a status of 400 ()`. Supabase token-refresh rejections; many fresh contexts replay one saved session, which is the likely cause (unconfirmed). No page failed to render, no write attempted. |
No page errors other than the above; 39 error records total.

## 5. Ten-workspace tally (credit + new)
Previously proved ID-V OFF observations are credited from `run-20261108` (build 9661c169/v391, 1280+390) and the selector run (v392): all ten workspaces rendered with PASS host/flag/module/render/security; `proposal-decisions` and `approved-for-application` empty (benign, consistent with source); `scheme-master` had the same 1280 render fail (2 console errors, 0 rows) in that run and 390 px PASS.

| Workspace | OFF (credited) | ON, both widths (this run) |
|---|---|---|
| sku-overview, sku-mrp-policies, product-derivation-policies, mrp-proposals, proposal-decisions, approved-for-application, applied-proposal-history, scheme-rule-register, commercial-sales-assumptions | P | **P** |
| scheme-master | P @390, **F @1280** (timeout, recurring) | P @390 (7 rows), **F @1280** (500/57014) |

**9 of 10 workspaces proved clean at both widths with the flag ON; `scheme-master` at 1280 px fails intermittently/cold (57014), recurring across 3 runs.** Row counts are visible table rows and may include an empty-state row.

## 6. Ledger gaps after this run
- G-10 (NAV_GROUPS ON signed-in): **evidence obtained** for five groups, 10 deep links, default, legacy redirects, read-only; owner to judge acceptance given scheme-master @1280.
- G-09 (flags restored OFF with evidence): **evidenced** (§3).
- G-06: 9/10 P; scheme-master needs disposition (known timeout, #211) — owner decision.
- **Not done:** CSA / default-policy modal views (needs clicks; out of this URL-only scope, remains NT); per-lens `?lens=` redirect beyond the three shapes above; ID-N/ID-X, SEC-A1/A2; owner dispositions C6/C9/D3/D7/F-4, G-SCOPE, build authorisation, Gate Status.
- Housekeeping: delete the ID-V session file and rotate the test password after acceptance (operator package §2).
