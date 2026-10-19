# Implementation rules for the closure programme

1. Live database: read-only SELECTs only, unless the user approves a specific batch (migration, switch, effective date, cron, run, designation, period, merge, deploy). Approved SQL goes through `apply_migration` unchanged from a prepared, locally tested file with guards that stop on any live-definition difference.
2. Prepared SQL lives in this directory (never in `supabase/migrations`); applied SQL is copied byte-identical into `evidence/<gate>/` with md5.
3. Approved runs (122, 128) and their snapshots are never modified; corrections take effect only in new runs via supersession.
4. No balancing plugs, no silent fallbacks, no time-based cost spreading; every component must be traceable to source and executable SQL.
5. Google Sheets, price revision and client pricing modules are suspended; Jarvis's WP07 files are never touched; the parent notifies Jarvis before any live change.
6. Every gate updates `PROGRAMME.md`, `ISSUE_REGISTER.json/.md`, `../DECISIONS_AND_OPEN_QUESTIONS.md`, `../CHANGELOG.md` and `../INDEX.md`, with reproducible SQL and results under `evidence/<gate>/`.
7. Tests run in isolated local PostgreSQL fixtures built from live definitions (md5-checked); results are committed with the harness.
8. Commits go to unmerged branches (`costing/au4-normal-budget`, PR #72) only.
