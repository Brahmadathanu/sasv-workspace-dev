# ID-V selector and sub-tab acceptance (issue #211 follow-up, 8 November 2026)

**Evidence class:** hosted, authenticated, **read-only**, supervised ID-V session. **No Draft, Save, Preview, Refresh, Apply, Approve or other write control was used.** Formal programme status stays **5/13**. Raw JSON and screenshots stay under `D:\claude-sessions\acceptance-out\run-selector-20261108` (outside the repository; they may show real data).

## 1. Build and identity
| Item | Value |
|---|---|
| Host | `https://sasv-utilities-hub.netlify.app` |
| Served build | `main@51cd26f3a3f908a5f35760962fdb1a88bb63cfe4` (`verify-served-assets.mjs`: **VERIFIED**, 72/72 assets match) |
| Cache version | `hub-cache-v392` |
| Identity | ID-V; the session's `get_user_permissions` read equals the owner's canonical extract: six Costing modules, `can_view=true`, `can_edit=false`, no other target, zero edit grants |
| Widths | 1280 and 390 px; fresh isolated contexts, service worker blocked, all `COSTING_*_V1` flags cleared (OFF) |
| Network policy | repo allow-list (`lib/allowlist.mjs`) on every request; non-read requests aborted in the browser |

## 2. Results
| # | Check | Observed (1280 px; 390 px identical in rows, counts and overflow 0) | Network reads | Result |
|---|---|---|---|---|
| 1 | CBM Staff Governance: default "Staff review queue" | 0 rows, "No rows found for Staff Governance." | `v_costing_unclassified_staff_for_costing` | PASS (matches live count 0) |
| 2 | Staff Governance: "Classification register" | **164 rows** (page 1 shows 25) | `v_costing_staff_classification_register` | PASS (matches live 164) |
| 3 | Staff Governance: "Staff pool summary" | **7 rows** in the current period view | `v_costing_staff_cost_pool_summary` | PASS: data renders (the 7 shown vs live 42 total is presumed to be the period-scoped view; not independently verified) |
| 4 | Manual Provisions: Provision register, Nov 2026 | 0 rows | `v_costing_manual_cost_pool_provision_register` | PASS (matches live: none in Nov) |
| 5 | Manual Provisions: "Monthly pool impact", Nov 2026 | **7 rows** | `v_costing_cost_pool_monthly_summary` | PASS |
| 6 | Manual Provisions: period **Jul 2026** | **1 row** | same register view | PASS (matches live: one ACTIVE in July) |
| 7 | Manual Provisions: period **Jun 2026** | Not offered: the period picker lists Nov, Oct, Sep, Aug, Jul only | none | NOT TESTABLE through the picker (live June row not reachable by ID-V UI) |
| 8 | Manual Provisions: period Oct 2026 | 0 rows | register view | PASS (matches live: none in Oct) |
| 9 | PPM Proposal Decisions default filter | Drawer defaults: **only "Pending decisions" checked**; every other status and "has ... lines" box unchecked; empty message "No proposals are awaiting decision." | `v_product_mrp_proposal_register` | PASS: the filter is a sensible default, not hiding rows; consistent with the single APPLIED proposal |
| 10 | PPM `commercial-sales-assumptions` period picker | `#costingPeriodSelect` lives in the **Filters drawer** (hidden until it is opened). Switch Nov to Oct 2026 worked; 628 rows shown; no error | `v_costing_pricing_commercial_sales_basis` (+ default-policy RPCs) | PASS |
| 11 | PRM Route Family selection | Selector lists 88 families; selecting the first loaded its history (`rpc_get_route_family_route_history`); **"Open current approved route"** loaded the route detail, 10 step rows (`rpc_get_route_family_route_detail`) | read RPCs only | PASS (see finding F1) |
| 12 | PRM Product Route handoff from Route Readiness | Row click opens a detail panel (592 products; assignments, effective route, family history, Product route history all read). Its actions: View effective route, Preview route candidate evidence, Review Product differences, View Product route history, Create Product route, Open mapped Route Family, Open Route Family route. "View Product route history" showed the history panel. The sampled product has no Product-specific version, so **opening a version in the Product Route Editor was not reachable**. "Preview...", "Review...", "Create..." were not clicked | `rpc_get_production_route_manager_product_assignments`, `rpc_get_effective_product_process_route`, `rpc_get_product_route_history`, `rpc_get_route_family_route_history` | PARTIAL: handoff and history load PASS; editor load for an existing Product version NOT TESTED |
| 13 | PRM Effective Route Viewer product selection | 593-option selector; selecting a product rendered an 8-row route table and the product and family histories | `rpc_get_effective_product_process_route`, `rpc_get_product_route_history`, `rpc_get_route_family_route_history` | PASS |

Page errors: 0 application errors. The only console error on most first loads is **`POST /auth/v1/token` HTTP 400** (see F2).

## 3. Findings
- **F1, blocked by the guard, never sent.** Clicking **"Open current approved route"** in the Route Family Route Editor makes the client call `rpc_preview_route_family_route_steps` (not on the read-only allow-list). The acceptance network guard **aborted it in the browser**, so it did not reach the backend; the route detail still rendered from `rpc_get_route_family_route_detail`. It occurred at both widths, and a targeted re-run attributed it to that click alone (selecting a family did not trigger it). The server definition, volatility and side effects of this function have **not been reviewed**; per the standing rule it must not be allow-listed or invoked until the owner and ChatGPT audit the body. The runner correctly counts this as a violation, so these steps are recorded as "completed with 1 blocked non-read attempt", not as a clean run.
- **F2, harness artefact, not an app defect.** Each fresh browser context replays the same saved refresh token, so the second and later token refreshes return HTTP 400. Pages continued to work on the valid access token. It would not occur in a normal single session.
- **F3, navigation notes.** On the PPM Commercial Sales Assumptions workspace the period select is in the Filters drawer, which explains why the earlier runner "could not select" it. The Route Readiness row is a keyboard-focusable row (`tabindex=0`), not a button.

## 4. Matrix updates (supersedes the "selector required / pending" classification for these rows)
Rows 4, 5, 11 and 14 of the 14-lens matrix: **now observed with data (PASS)**, including period switching on manual provisions and commercial sales assumptions. Rows 6 and 7 (PPM proposals): default filter **examined**; empty state confirmed benign. Row 12: **PARTIAL** (see above). Rows 9, 10 (mapping/foundation), 13 (historical previews) and 2, 3 (restricted traces) are unchanged.

## 5. Still open
Opening an existing Product-specific route version in the Product Route Editor (needs a product that has one); June 2026 provision data through the UI (period absent from the picker; ask whether that is intended); audit of `rpc_preview_route_family_route_steps` and the three historical preview RPCs; mapping/foundation exact-run confirmation. No flag, permission, migration or data change was made and none is implied.

## 6. Clean-up
The saved session file was securely overwritten and deleted at the end of the run; the canonical permission extract (view-only target names) was also removed. The owner should still rotate the ID-V test password because a session token was written to disk for about an hour. Disk: C: reported 0 GB free throughout; nothing was deleted from C:; all browser output went to D:.
