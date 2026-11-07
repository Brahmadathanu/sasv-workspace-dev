# Release note — Costing v391 (#208 mobile Evidence-table scroll) — 7 Nov 2026

Candidate: PR #209. Owner authorisation: "Proceed" (controlled-release preparation only). **Not merged, not deployed. Hosted and authenticated acceptance NOT TESTED.** Formal closure stays 5/13.

## What ships
| File | Change |
|---|---|
| `public/shared/css/sasv-costing.css` | +11 lines: `body.sasv-costing .cp-evidence-table-scroll` becomes the horizontal scroll container (fixes clipped 9-column Exact Material Evidence table in the 390px SKU drawer). |
| `public/sw.js` | line 2 only: `hub-cache-v390` -> `hub-cache-v391` so clients holding cache-first v390 CSS purge it on activation. Strategy, precache list, fetch handlers untouched. |
| tests/docs | pins moved to v391 (v390/v389 history preserved in the line's comment and in the UX-F1 diff contract), new coupling test, Chromium touch-scroll regression, this note. |
No JS, schema, RPC, grant, flag, costing-run, Electron or e-Aushadhi source change. All eleven `COSTING_*_V1` flags remain default OFF (covered by the WP05 closure test).

## Deployment plan (owner side, after independent review)
1. Squash-merge #209 to `main`. Netlify is wired to `main` and will auto-publish; record the **new merged SHA**.
2. In Netlify Deploys, confirm the published deploy commit equals that SHA.
3. From a network that reaches Netlify run `node scripts/costing-acceptance/verify-served-assets.mjs https://sasv-utilities-hub.netlify.app <new-sha>`; require VERIFIED, 0 mismatches and served cache name `hub-cache-v391`.
4. Phone, real ID-V (`balublablee@gmail.com`): reload twice (first load installs v391, second is served by it); open SKU 105 -> Evidence tab; swipe the 9-column table to the Trace column (the synthetic Chromium test is not proof of live rendering). Then run the operator-assisted full acceptance with a self-captured storage state.
5. Record results on #206/#208; keep #208 marked FAIL until step 4 passes.

## Rollback plan
- Preferred: Netlify -> Deploys -> publish the previous deploy (the one at `818a6da`, cache v390). Instant, no repo change. Clients on v391 then hold a newer-named cache than the served worker: the v390 worker's activate step deletes every cache not named `hub-cache-v390`, so they self-heal on next load (the clipped table returns, which is the known pre-fix state).
- Alternative: `git revert` the squash commit on `main` (reverts CSS, cache name and pins together; a revert then publishes v390 again). Do not revert only the cache line or only the CSS.
- No database, grant, flag or data rollback is involved.

## Known limits
- 81 scripts already fail on the base commit for reasons unrelated to this change (stale historical cache pins v242-v332, missing Electron build output/dependencies, etc.); the set of failing files is identical before and after this PR. See the PR description for exact counts.
- Dashboard "Close quarter (lock months)" enabled-control observation from the local sweep still needs a genuine ID-V check (never clicked).
