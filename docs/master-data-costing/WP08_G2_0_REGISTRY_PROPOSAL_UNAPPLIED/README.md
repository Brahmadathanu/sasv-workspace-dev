# WP08 G2-0 — registry update proposal (**UNAPPLIED**), revision 2

Status: **UNAPPLIED proposal.** Nothing here has been run against Supabase or any shared database; it is deliberately **not**
under `supabase/migrations/`. Running any step needs the G2-0 PR merged, the PWA deployed with the reviewed bytes (gate below),
and the owner's separate production-mutation approval. WP08 remains OPEN (8/13).

**Revision 2 (review fix):** revision 1 used `ON CONFLICT DO UPDATE`, which could overwrite a pre-existing PWA registration, and
its rollback could delete one. Both are gone: every write script now **fails closed** and **never claims or overwrites an
existing row**, and rollbacks accept only the exact timestamp stamp the apply script wrote.

| Order | File | Effect | Fails closed when |
|---|---|---|---|
| 0 | `01_preflight_and_before_select.sql` | read-only contract assertion, per-module state report (PWA `ABSENT/IDENTICAL/CONFLICT`, Electron `LEGACY/CANONICAL/OTHER`), BEFORE select | contract violated |
| – | `scripts/wp08-g2-0-shared-master-data/deploy-gate.mjs verify <origin>` | HTTP GET of the **deployed** pages/scripts/styles/`sw.js`; prints a GATE TOKEN only if bytes equal the reviewed files and `sw.js` has the network-first branch | any mismatch/404 |
| A | `02_apply_pwa_client_rows.sql` | creates exactly 4 `pwa` rows from the 4 Electron rows (no upsert) and prints an **APPLY RECEIPT** | gate token wrong/missing; module/target mismatch; **any** of the four PWA rows already exists (identical, conflicting or partial — nothing is written); fewer than 4 rows would be created |
| B (optional, last) | `03_optional_repoint_electron_routes.sql` | repoints the 4 Electron rows `manage-*.html` → `public/shared/manage-*.html`, stamps them, prints a **REPOINT RECEIPT**; no-op if all four are already canonical | mixed/partial/unexpected Electron routes |
| rollback B | `98_rollback_step_b_electron.sql` | reverts only rows holding the canonical route **and** the REPOINT RECEIPT stamp | placeholder timestamp not replaced |
| rollback A | `99_rollback_step_a_pwa.sql` | deletes only PWA rows with exact key + route **and** the APPLY RECEIPT stamp | placeholder timestamp not replaced |

Safeguards in every write script: single transaction; `lock_timeout` 5 s and `statement_timeout` 30 s (`set local`);
`pg_advisory_xact_lock` and `lock table public.app_module_clients in share row exclusive mode` so concurrent runs serialise;
row-count assertions; only `public.app_module_clients` is written (never `app_modules`, permissions, grants, RLS, labels,
sections, sort order or `min_nav_mode`). After any error `COMMIT` acts as a rollback even without `ON_ERROR_STOP`.
PM BOM keeps registry key **`pm-templates`** / permission **`module:pm-templates`**; no `manage-pm-bom` key is introduced.

Operating notes
- Before step A, run `node scripts/wp08-g2-0-shared-master-data/deploy-gate.mjs verify https://<pwa-host>` and paste the printed
  `GATE TOKEN` into the placeholder in step A. Honest limit: the token's expected value is embedded in the SQL (and checked by
  `registry-sql.test.mjs` against the reviewed bytes), so this is a **procedural gate enforced by a script and a refusing SQL
  precondition**, not a database-side proof that the host serves those bytes.
- Keep both receipts. Rollback A needs the APPLY RECEIPT, rollback B the REPOINT RECEIPT. Without them a rollback cannot run (by design).
- If step A reports an existing PWA row, stop: that registration was not created by this proposal. Investigate and decide by hand.
- Order: deploy PWA → gate → preflight → A → verify launcher; Electron release → (later, optional) B.

Tested in `scripts/wp08-g2-0-shared-master-data/registry-sql.test.mjs` on an isolated throw-away PostgreSQL (unix socket, temp dir):
initially absent, identical, conflicting, partial (1–3 of 4), repeat execution, missing prerequisites, wrong permission target,
no-`ON_ERROR_STOP` atomicity, gate-token rejection, rollback provenance (never deletes a pre-existing row, placeholder fails
closed, edited row survives, repeat is a no-op), step B partial/mixed/repeat, and read-only preflight. The test schema mirrors the
columns used by the repository's own seed (`20260802150233_register_production_route_manager_app_module.sql`); live constraints
beyond a primary key on `(module_key, client_key)` are an assumption and must be re-confirmed by the read-only preflight.
