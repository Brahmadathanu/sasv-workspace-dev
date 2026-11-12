> **POST-PROTOCOL OWNER OBSERVATION — 12 NOV 2026:** The owner now confirms Scheme History **appears** when continuing the R36 workflow. [R37](WP05_R37_OWNER_OBSERVED_SCHEME_HISTORY_2026-11-12.md) records this as **owner-reported positive screen evidence**, while the exact PPM-only account role and signed-in network trace were not independently re-verified. The prior below statement 'real session NOT TESTED' describes the state **when this protocol was authored**, before the owner's report. Costing-only negative remains NOT TESTED; W5-06 OPEN, formal 6/13.

# WP05 R36 — Scheme History browser acceptance protocol and source truth (12 Nov 2026)

**Status: CLIENT CONTRACT VERIFIED / REAL AUTHENTICATED BEHAVIOUR NOT TESTED.** R34 owner-approved production one-view SQL has been applied and catalogue-verified; R35 non-identifying live permission inventory found 1 PPM View-only permission group, 3 PPM+other Costing View, 0 Costing-only without PPM. These **do not** prove active browser sessions or successful permissions.

## Exact shared client reader contract on current main

Source file `public/shared/js/costing-suite-pricing-policy.js`, `fetchSchemeMasterAudit(schemeId)` (around lines 5193–5202):

```js
const { data, error } = await costingFrom("v_costing_scheme_master_audit")
  .select("*")
  .eq("scheme_id", schemeId)
  .order("event_at", { ascending: false })
  .order("audit_event_id", { ascending: false })
  .limit(200);
if (error) throw error;
return data || [];
```

The history content builder (`buildSchemeMasterHistoryHtml`, around line 5284) renders `No audit history available.` when `rows.length === 0` and otherwise displays a table including event, actor and audit remarks. `renderSchemeMasterHistoryContent` shows `Failed to load history.` for errors. Hence a PPM View-only user seeing the History modal, a successful HTTP 200 status, or `No audit history available` is **not** proof of positive authorization. The view's WHERE-based role-denial can produce a successful empty array and an actually empty scheme history also produces the same screen.

The client deliberately renders actual audit fields in a legitimate authorised session; do **not** screenshot, export, console-log or send them as acceptance evidence. No client change was made here.

## Minimal evidence-grade manual acceptance

**Only an existing legitimate PPM View-only user through their normal signed-in browser session.** The owner/tester should confirm the account's PPM View status by existing staff governance, without disclosing name or UUID in the issue. Do not use the Supabase administrative SQL tool as a surrogate signed-in session and never paste access tokens, network headers or audit payloads.

1. Sign in to the SASV PWA as the authorised PPM View-only user; use the normal Pricing Policy Manager screen, not a privileged support interface.
2. Open Scheme Master and select a scheme that the business team already knows has at least one prior change recorded. The scheme ID or name need not be shared in the test report.
3. Open **History**. Record a boolean whether an audit row appears, or whether `No audit history available` / `Failed to load history` appears. Do not copy row contents.
4. Interpret:
   - **History table visibly contains an event**: positive browser read **PASS (PPM-only)**, *assuming the account's effective PPM-only permission has independently been confirmed*.
   - **No audit history available**: **INCONCLUSIVE**, not PASS or denial. Confirm scheme has history using an authorised independent source if needed; no raw audit-row export.
   - **Failed to load history**: **FAIL / investigate**, with redacted error category only; do not include JWTs/payloads.
   - **History UI inaccessible due to navigation restriction**: **BLOCKED**, separately assess the module's top-level View gate, not a SQL view failure.
5. If a legitimate mixed PPM+Costing user is available, an optional parallel positive test may be recorded with the same no-payload protocol. Never add or remove permissions to manufacture a test.
6. **Costing-only negative:** R35 found **zero** existing canonical permission groups. Therefore production negative authenticated test stays **NOT TESTED**. Previous isolated PostgreSQL 17.11 10/10 permission matrix supports the design but is explicitly not a production user test.
7. For anonymous SQL access, R34 catalogue confirms `anon` has no SELECT privilege; a real anonymous HTTP attempt has not been performed. No app API keys or request credentials should be captured in reports.

## Read-only non-sensitive internal checklist (no user identity needed)

Record the following fields only:

| Field | Accepted value |
|---|---|
| Execution context | Signed-in normal PWA, not Supabase admin |
| Account category | PPM View-only confirmed / PPM mixed / unknown |
| Module reachable | Yes / No |
| History outcome | Table with ≥1 row / Empty message / Error / UI blocked |
| Sensitive response copied | No |
| JWT/credentials recorded | No |
| Tested date/time and PWA release state | Non-sensitive date + displayed version if known |

Do not mistake a successful read of a Scheme Master *register* for a successful read of `v_costing_scheme_master_audit`. The app should load the **History** tab specifically.

## Gate truth

- Owner Option A **APPROVED**; R34 one-view production DDL/catalogue **PASS**.
- R36 source/client contract **VERIFIED** and manual acceptance protocol **READY**.
- Real signed-in PPM View-only history access: **NOT TESTED** (no browser session available to the assistant).
- Real signed-in Costing-only history denial: **NOT TESTED** (no existing matching permission group identified).
- W5-06 remains **OPEN**, other five D-2 reader policies still open, programme **6/13**. No further live SQL changes, role edits, test identity creation, browser test claims, or source modification were made in this checkpoint.
