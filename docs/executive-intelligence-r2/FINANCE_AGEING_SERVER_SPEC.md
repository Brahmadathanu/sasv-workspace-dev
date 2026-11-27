# Finance ageing — server specification (for review and implementation)

Status (27 Nov 2026): **installed live** as migration `20261127144051_ei_r8_finance_ageing` (registered; never replay). Client implemented on branch `fix/executive-intelligence-r8-shell` (R8.17+). This document is the original request; the live receipt is `FINANCE_AGEING_LIVE_RECEIPT_20261127.md`. Live verification against the installed contracts matched the expected figures (payables 42,408,063.89 / receivables 22,304,842.10 at 30/60/90, zero undated) and 80 of 80 sampled parties reproduced in the browser.

## 1. What the owner asked for
On the Finance lens (creditors and debtors outstanding): an ageing facility where the owner picks the day ranges (custom number of days), and the summary rows, each party's outstanding and the bill list adapt to it. It must be professional, finance-safe and future-proof.

## 2. Client behaviour (what the server must serve)
- **Ageing toggle** with: as-of date; band limits (1–5 whole numbers of days, strictly increasing, 1–3650; presets 30·60·90, 15·30·60·90, 30·60·90·180, 45·90·180·365; custom text); optional **age range** "only bills aged from X to Y days".
- **Summary** (above the table): per group (Payables / Receivables, following the existing group filter) a stacked bar and one tile per band (amount, share, bill count), plus oldest bill, amount-weighted average age, party and bill counts, and any amount that could not be aged.
- **Party table**: Party, Group, Bills, one column per band, Outstanding, Oldest (days), Avg age (days). Same infinite scroll, search and group filter as today.
- **Bill dialog**: aged **in the browser** from the existing `v_mis_finance_outstanding_detail` rows (`bill_date_text`, e.g. `10-Oct-26`), using the rule below. No new bill-level contract is required for the first release; section 6 lists the optional one.

## 3. Ageing rule (must be identical on server and client)
- `age_days = as_of_date − bill_date` in whole days (date arithmetic, no time zone).
- `bill_date` is parsed from `bill_date_text` (`D-Mon-YY` / `D-Mon-YYYY`, English month abbreviations, two-digit years are 2000+). A bill whose text cannot be parsed has **no age**: it is excluded from every band and reported as `undated_amount` / `undated_bill_count`, never silently placed in a band and never dropped from the party total.
- Bands from `bounds = [b1..bn]`: band 0 is `age <= b1` (includes bills dated on or after the as-of date, i.e. not yet aged), band i is `b(i) < age <= b(i+1)`, last band is `age > bn`. Labels are `0–b1`, `b1+1–b2`, …, `Over bn` (days).
- The age range filter keeps a bill when `p_age_min <= age_days <= p_age_max` (either bound may be NULL); undated bills are kept so the totals still reconcile, and are shown as undated.
- Amounts are the **signed** MIS values used today; credit lines (e.g. `0.1% TDS`, negative balances) are aged by their own date and keep their sign. Per party and group, `sum(bucket_amounts) + undated_amount` must equal the party's/group's outstanding MIS value for the same filter (when no age range is applied). State how an on-account/advance line without a bill reference is dated (expected: it is undated).
- Default `as_of` = the financial position date of the snapshot the page already shows (`financial_position_date` in `mv_mis_executive_summary`), **not** `CURRENT_DATE`, so figures agree with the position cards and are reproducible.

## 4. Objects requested (read-only, executive permission only)
Both are `STABLE`, read-only, `SECURITY INVOKER` unless the reviewer decides otherwise, `search_path` pinned, and gated by the **same independent executive authorization** as `get_mis_finance_party_page` (R6 permission; no sales-viewer access, no new grants beyond `authenticated` execute where the existing function has it; reviewer to confirm by simulating a JWT with and without the executive permission).

### 4.1 `get_mis_finance_ageing_summary`
`(p_as_of date DEFAULT NULL, p_basis text DEFAULT 'bill_date', p_bounds int[] DEFAULT '{30,60,90}', p_age_min int DEFAULT NULL, p_age_max int DEFAULT NULL) RETURNS jsonb`

```json
{ "as_of": "2026-11-27", "basis": "bill_date", "bounds": [30,60,90],
  "groups": [ { "group": "payables", "label": "Payables — Sundry Creditors",
    "bucket_amounts": [..n+1 numbers..], "bucket_bill_counts": [..n+1 ints..],
    "total_amount": 0, "bill_count": 0, "party_count": 0,
    "oldest_age_days": 0, "weighted_avg_age_days": 0,
    "undated_amount": 0, "undated_bill_count": 0 },
    { "group": "receivables", ... } ] }
```
`bucket_amounts` length must equal `array_length(p_bounds)+1`; the client rejects a mismatch visibly. `weighted_avg_age_days` is amount-weighted over positive-balance dated bills (state the formula). `total_amount` equals the group's outstanding MIS value when no age range is set.

### 4.2 `get_mis_finance_ageing_party_page`
`(p_group_filter text DEFAULT 'payables', p_search text DEFAULT '', p_as_of date DEFAULT NULL, p_basis text DEFAULT 'bill_date', p_bounds int[] DEFAULT '{30,60,90}', p_age_min int DEFAULT NULL, p_age_max int DEFAULT NULL, p_limit int DEFAULT 25, p_offset int DEFAULT 0) RETURNS TABLE(...)`

Rows (same keys and filter semantics as `get_mis_finance_party_page` plus the ageing keys): `party_name, mis_group_name, bill_count, outstanding_amount_mis_value, signed_outstanding_tally_value, bucket_amounts numeric[], bucket_bill_counts int[], oldest_age_days, weighted_avg_age_days, undated_amount, total_rows`. `p_group_filter` accepts `payables|receivables|all`; search matches party and group as today; **deterministic ORDER BY** (outstanding desc, party_name, group) with `total_rows` in every row so offset paging and the client's duplicate-row guard work unchanged. With an age range set, a party appears only if it has at least one bill in range and its figures cover those bills only.

## 5. Validation, safety and review points
- Reject (raise a clear error, SQLSTATE `22023`) when: bounds empty, more than 5 entries, not strictly increasing, any value outside 1..3650, `p_age_min > p_age_max`, negative ages limits, unknown `p_basis`, `p_limit` outside 1..200.
- No dynamic SQL built from client text; bounds array only. Escape/ignore `p_search` wildcards as the existing page function does.
- Performance: confirm the plan on the real outstanding-bill table; add an index only if the reviewer shows need. Expected row counts: a few thousand bills, hundreds of parties.
- Reconciliation tests on live-equivalent data: (a) per group `sum(bucket_amounts)+undated_amount = total_amount = position card value`; (b) per party the same; (c) unparsable and missing dates → undated, nothing lost; (d) negative lines keep sign; (e) boundary days (exactly b1, b1+1, bn, bn+1, bill dated after as-of); (f) age range edges inclusive; (g) executive vs non-executive JWT; (h) paging stable across two pages with `total_rows`.
- Client/server rule parity test: the bill dialog ages rows in the browser; supply a fixture of bills and expected bands so the client rule (this document, section 3) is checked against SQL.
- Do not change `get_mis_finance_party_page`, `v_mis_finance_tab_summary`, `v_mis_finance_outstanding_detail` or any existing grant; do not drop or rename anything; no cron/ETL change.

## 6. Optional follow-ups (not needed for the first release)
- **Due-date basis** (`p_basis = 'due_date'`): needs the Tally credit period / due date per bill. If available in the source, expose `due_date` and `overdue_days` per bill; the client already sends `p_basis` and the as-of rule would become `as_of − due_date` with a "Not yet due" band.
- `get_mis_finance_ageing_bill_page(p_party_name, p_group, …)` returning `age_days`, `band_index`, `due_date` per bill, replacing the browser-side aging in the dialog.
- Saved band schemes per user (client currently keeps the choice in memory only).

## 7. Client contract names (pinned by `executive-mis-c1.test.mjs`)
`get_mis_finance_ageing_party_page`, `get_mis_finance_ageing_summary`; parameters `p_as_of, p_basis, p_bounds, p_age_min, p_age_max` in addition to the existing `p_group_filter, p_search, p_limit, p_offset`.
