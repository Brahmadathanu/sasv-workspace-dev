# PEC Phase A — Real-session acceptance worksheet (12 November 2026)

**Status:** READY FOR GENUINE OPERATOR EXECUTION; no case marked PASS until recorded by an actual signed-in operator. Owner approved phased release **scope only**. Candidate draft PR #347 is not deployed/merged by this document.

## Preflight (read-only verification)

- Candidate source: the exact integrated review branch `integration/pec-erp-staging-20261112`, PR #347; latest successful full 8/8 GitHub run on code-equivalent/preceding documentation head `26629c98`; freeze final candidate SHA and repeat before owner promotion.
- Live `public.user_permissions_canonical` aggregate for target `module:procurement-execution-console`: **3 editor grants, 2 view-only grants** at time of audit; no user IDs or identifying attributes included. This means editor and view-only category coverage is possible *without permission changes*, but does **not** prove the accounts are available to authenticate or that the candidate UI is already deployed.
- Ten expected read paging RPCs: 10/10 present with PEC module guard, authenticated EXECUTE and anon denied (read-only pg_proc inspection). **0/10** existing PEC migration versions registered in official history; owner-controlled reconciliation remains separate.
- This worksheet does not authorize modifying approved indents, financial/procurement records or resetting unrelated users' permissions.

## Operator acceptance matrix

Record **actual account role category, date/time, tested URL/build SHA, steps/screenshots or console evidence, result and issue reference**. Do not store passwords, JWTs, secret tokens or personal identifiers. Test only a disposable draft explicitly approved for modifications; no approved/issued/closed indent may be changed.

| ID | Session / surface | Minimum procedure and expected result | State |
|---|---|---|---|
| A01 | PEC Editor, hosted signed-in PWA | Five lenses visible and open; permitted controls enabled | NOT RUN |
| A02 | PEC View-only, hosted signed-in PWA | Five lenses visible; editor actions unavailable; direct unauthorized write attempts rejected by server | NOT RUN |
| A03 | Genuine signed-in account **without PEC View** | PEC navigation/access denied; no sensitive data or RPC rows exposed | NOT RUN |
| A04 | PEC Editor | PR filter/search/next page/total count and no stale response | NOT RUN |
| A05 | PEC Editor | Indents paging; canonical indent line number unchanged after filter/search; Jump to Indent resolves beyond page 1 | NOT RUN |
| A06 | PEC Editor | Vendor-wise operational options from all filtered rows; vendor:ID and unassigned bucket behavior; immediate vendor-selection workflow on approved safe draft fixture | NOT RUN |
| A07 | PEC Editor | Excess date/filter/page/total and Audit list behavior; sample rows compared with authoritative live read | NOT RUN |
| A08 | PEC Editor | Full Vendor-wise export with over-1000 items or stable equivalent fixture; no duplicates/missing identities, no total drift, PDF page continuity | NOT RUN |
| A09 | PEC Editor, installed PWA | Online canonical JS/CSS update received after deploy; offline previously cached content remains usable; reconnect gets fresh sources | NOT RUN |
| A10 | Packaged Electron | Same canonical PEC HTML/JS/CSS, five-lens navigation, narrow window layout, export and authorised reads | NOT RUN |
| A11 | Performance | Record server/network timings on representative Excess + Vendor-wise paged queries and full export; no claim without measured results | NOT RUN |
| A12 | Release gate | Exact green CI SHA, correct branch PR order, history-only repair separately authorized, postdeploy smoke, owner acceptance | NOT RUN |

## Evidence entry template (copy only when actually tested)

`ID | role category | date/time IST | preview/production URL or packaged Electron build | code SHA | exact step and fixture | expected | actual | PASS/FAIL/BLOCKED | evidence/issue`

## Fastest execution sequence

1. Technical maintainer: finalize source/branch-review and current 8/8 CI; do **not** replay already-applied PEC SQL.
2. Actual authenticated operators: Editor and View-only hosted PWA tests (A01–A08), then no-PEC access (A03). Do not simulate role claims with SQL `SET ROLE`; that is not a genuine JWT acceptance.
3. Install/refresh PWA and packaged Electron source parity (A09–A10), record real latency (A11).
4. Owner gives distinct SQL migration-history repair approval **after** preflight, and distinct source merge/production deployment approval **after** acceptance. Mark G0–G5 only when gate exits are proven.

**No change to formal G0–G5 count: 0/6 independently verified.** Phase B original manual draft-indent edit #356 and separate hybrid policy #305 remain outside Phase A.
