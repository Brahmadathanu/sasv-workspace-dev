# G2 PostgreSQL runner availability — 20 October 2026

Local inspection found Node v22.16.0, but no executable psql, postgres or docker runner. `pg_config` is present, but does not itself execute SQL. The local command `node --test /mnt/data/costing-g2/*.test.mjs` returned 18 tests, 18 pass, 0 fail, 0 skipped. These are JavaScript behavioural tests, not PostgreSQL integration tests.

An existing local `g2_historical_route_pg_fixture.sql` was inspected, but not executed. The committed SQL policy fixture likewise remains unexecuted. Avoid running test migrations or creating temporary database objects on production Supabase in lieu of an isolated PostgreSQL runner. Next: obtain a permitted disposable PostgreSQL instance or runner; execute the exact committed fixture and record PostgreSQL output, then prepare controlled SQL integration of the actual function definitions and compare current/historical behaviour. Historical snapshots 122/128 and route144 remain unchanged. G2 OPEN.
