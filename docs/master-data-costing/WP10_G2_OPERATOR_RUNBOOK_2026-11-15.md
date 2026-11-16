# WP10 G2 — Operator runbook (manual, read-only)

Audience: the programme owner (accountable until a named Costing Control Center operator is nominated) and any nominated operator.
Nothing in this runbook runs a builder, rebuilds readiness, retries a writer or bypasses a status. No access is granted or implied by this document.

## 0. Flag (client features are OFF by default)
- ON (per browser, for review): `localStorage.setItem("WP10_SAFEGUARDS_V1", "1")` then reload. OFF/rollback: `localStorage.removeItem("WP10_SAFEGUARDS_V1")` then reload.
- Flag OFF = today's behaviour exactly. The flag is never set by shipped code, the launcher or the service worker.
- The operational expiry horizon panel stays inert (“not available on this server yet”) until the unapplied server proposal 03 is separately authorised and applied.

## 1. Daily readiness check (working days)
1. Open Costing Control Center → Portfolio Readiness. Note the governed period shown.
2. If readiness loads: read statuses as given. READY / REVIEW_REQUIRED / BLOCKED / UNKNOWN are never to be bypassed or reinterpreted.
3. If readiness is **unavailable**, the screen names the state. Record governed period, state token and time in the daily review:

| State shown | Meaning | Do |
|---|---|---|
| Snapshot out of date (`READINESS_BUILD_STALE`) | Source data changed after the snapshot was built; nothing is wrong with a specific SKU by itself | Tell the accountable owner; dependency owners fix source data in their screens; **do not rebuild from this screen** |
| No snapshot (`READINESS_BUILD_ABSENT`) | Nothing has been built for this governed period | Tell the accountable owner |
| Snapshot incomplete (`READINESS_BUILD_INCOMPLETE`) | A snapshot exists but is not completed/promoted | Tell the accountable owner |
| Permission / not signed in | Access problem | Use the normal access process; never share a session |
| Timeout / unreachable | Says nothing about freshness | Reload (read-only); if persistent record time and tell the owner |

4. A stale/absent/incomplete state unresolved by the **next working day** is escalated to the programme owner.
5. Rebuilding the snapshot is a production writer operation that needs its own exact operational authority. Do not run SQL; do not ask anyone to run it from this screen.

## 2. Activating a SKU (Manage Products)
- With the flag ON, the Activate dialog shows the missing-requirement pre-check (existing read-only `rpc_get_sku_activation_check`) with the owner screen for each item and a link only where a destination is verified (PM BOM, Production Route).
- The pre-check is advisory. The server checks again at Confirm and its rejection is shown in full. A clean pre-check is not a promise and does not make costing READY. If the pre-check is unavailable, the dialog says so; the server still decides.
- “More than one PM BOM revision” = ambiguous; resolve in PM BOM Manager (end or supersede the overlapping approved revision).
- Only one activation dialog/check runs at a time; if you change the selected SKU or the SKU's state changes while it is open, nothing is submitted (a message says so) — reopen on the SKU you mean.
- Missing batch size / MRP / selling policy: resolve in the named owner screen; there is no verified deep link, open it from the launcher.
- There is no override and no approval reference bypass.

## 3. Operational expiry horizon (only after server proposal 03 is applied by separate authority)
- Separate from the governed period: evaluated at today's IST date and every effective-date boundary in the next 30 days.
- The date shown is the **first day a requirement is not covered** (effective-to dates are inclusive).
- “Gap that recovers” rows are still reported: a hole that closes before day 30 still affects the days inside it.
- “Unknown” is never “fine”. Amounts (zero/negative) are not evaluated — canonical resolution semantics are preserved (stated on screen). Route boundaries cover product routes, route-family routes, family assignments and effective dependencies through the real validator; a result marked PARTIAL (client budget, malformed or changed window) is never a completeness claim and rows shown are only those received.
- If the window changes between pages (the date rolled over) the list restarts once from the first page; a second change stops it with an error.
- Nothing is notified, deactivated or rebuilt by this panel.

## 3b. Product edits that change the sub-group (only after server proposal 05 is separately authorised)
- A sub-group change on a product with active SKUs is refused when it would remove the product's valid route (`WP10_PRODUCT_ROUTE_IMPACT`) **or** when the impact cannot be determined (`WP10_PRODUCT_ROUTE_IMPACT_UNRESOLVED`, review required). There is no override. Fix the route data with the Production Route Manager owner (or deactivate the SKUs through the audited SKU action), then repeat the edit.

### 3c. Pre-submit sub-group impact preview (flag ON **and** server proposal 06 separately authorised)
- Editing an EXISTING product and changing its sub-group shows, inside the Save confirmation, the product's route today and under the proposed sub-group (route identity: family / family route / product route, coded reasons, active-SKU count, IST date). It runs only for a changed sub-group on an existing product.
- It is **advisory**: not an approval, not a bypass, not a costing READY statement, and never a promise that the save will succeed. Proposal 05 (if applied) and the writer decide when you confirm. A favourable preview can still be followed by a server rejection.
- Route loss, UNKNOWN (impact not proven) or an existing route problem: resolve with the Production Route Manager owner (map the proposed sub-group or its group to an approved family, fix the route data, or deactivate the active SKUs through the audited action) before retrying. There is no override and the screen does not block you by itself.
- "Not available on this server yet" means the endpoint is absent: no assessment was made. A "discarded" or "stale" note means the product, sub-group or your access changed; nothing is submitted until the context is current when you confirm.

## 4. Products with no SKU / no active SKU
Use the existing Readiness → Membership Exceptions (Products with no SKU; Active products without an active SKU). Historical counts in older records (54 / 179) are not current counts.

## 5. Do-not list
No builder run, no readiness bypass, no direct table edit, no new permission grant, no scheduled job or external notification, no production SQL from this repository's draft folder.
