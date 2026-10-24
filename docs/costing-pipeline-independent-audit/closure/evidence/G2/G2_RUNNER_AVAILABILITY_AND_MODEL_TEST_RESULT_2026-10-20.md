# G2 executable-test environment gate — 20 Oct 2026

Verified in current isolated workspace: `psql`, `postgres`, and `docker` executables absent. Local `node --test /mnt/data/costing-g2/*.test.mjs` ran **12/12 PASS**; these are policy/model tests, not PostgreSQL function regression. Existing review-only SQL and fixture cannot be called database-tested. No live Supabase DDL or mutations.

Before promotion: build disposable isolated PostgreSQL runner; capture exact live function DDL, owner/ACL, SECURITY DEFINER, search_path, volatility and caller results; apply proposed PL/pgSQL replacement in rollback-only transaction; test normal/missing/two-APPROVED routes (synthetic overlaps only in clone); assert six callers' output/error parity, run82 snapshot-by-stored-ID, and runs122/128 immutability; record log and rollback. Do not treat the mere presence of test SQL as passing these gates.

G2/CI-032 OPEN. Independent costing audit only; no live changes.
