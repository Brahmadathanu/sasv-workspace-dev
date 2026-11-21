# WP10 Stage B — four classification master authenticated DML cutover: production receipt
**Date:** 21 November 2026 IST. **Project:** `qhmoqtxpeasamtlxaoak` (production, PostgreSQL 17.4). **Status:** SERVER CUTOVER APPLIED AND CATALOG-VERIFIED; genuine-role/installed-UI acceptance still NOT TESTED.

## Owner authorization and prerequisites
The owner expressly approved the WP10 Stage B implementation in the current continuation on 21 November, after confirming **all** managed staff SASV Workspace computers checked and on **v6.2.0**. This is owner-reported fleet-version evidence; no per-binary SHA-256 inventory or signed installed-app test was collected. Published v6.2.0 source (`ebb59a4954b245bc7912e9872682d440f318f6ed`) has all 12 RPC-only calls in `public/shared/js/{categories,subcategories,product-groups,subgroups}.js`. Released version is not proof of live genuine-role behavior.

Stage A had already been applied on 18 November and migration history reconciled as `20261118161406_wp10_four_master_stage_a_state_reconciliation`. New read-only production preflight verified four tables: RLS ON; four policies each (SELECT requires `app_is_provisioned_user()`; writes require module View AND Edit); authenticated SELECT/INSERT/UPDATE/DELETE present; anon/PUBLIC direct DML absent. All 12 governed `public.rpc_wp10_*` CRUD procedures passed definer/EXECUTE/require_permission/target-key source inspection in a separate read-only preflight. The project was ACTIVE_HEALTHY. The security advisor baseline was read (pre-existing findings elsewhere; no attribution claimed).

## Exact scope and operation
Used authenticated Supabase project tool `apply_migration` with name `wp10_four_master_stage_b_revoke_authenticated_direct_dml`. **Recorded version: `20261121094820`**, after production migration `20261120170326_executive_mis_canonical_production_value_summary` (independent MIS work was not modified).

The migration ran as a unit with 2s lock timeout, 20s statement timeout, fail-closed preflight `DO` checks across all four tables and the 12 RPCs, then this one DDL operation:

```sql
REVOKE INSERT, UPDATE, DELETE ON TABLE
  public.categories, public.sub_categories,
  public.product_groups, public.sub_groups
FROM authenticated;
```

An in-migration postcondition `DO` required all four to retain authenticated SELECT while denying INSERT/UPDATE/DELETE. The migration tool returned `{"success":true}`. No user data INSERT/UPDATE/DELETE, no policy change, no change to application code, RPC bodies, GRANTs to other roles, flags, installer or release.

## Independent production post-verification
Executed a **separate SELECT-only catalog query after deployment**. For each of `categories`, `sub_categories`, `product_groups`, `sub_groups`:
- RLS ON, FORCE OFF, four Stage A policies retained.
- authenticated SELECT **true**, authenticated INSERT/UPDATE/DELETE **false** (12/12 direct DML privileges absent).
- anon INSERT/UPDATE/DELETE **false**.
- relacl for authenticated now exactly `authenticated=r/postgres`; `postgres` and `service_role` ACL entries unchanged.
- All 12 `rpc_wp10_*` CRUD functions separately rechecked: SECURITY DEFINER=true, authenticated EXECUTE=true, anon EXECUTE=false.
- Supabase `list_migrations` included `20261121094820_wp10_four_master_stage_b_revoke_authenticated_direct_dml` once, as latest at verification.

## Rollback / residual receiving
**Do not automatically restore authenticated direct DML.** An exceptional re-GRANT would reopen legacy bypass and requires a **separate explicit owner security-incident decision**, duration and controls. Prefer forward correction of RPC-only clients. Snapshot/costing data were not changed by this permission-only migration.

**Still NOT TESTED:** actual real-JWT Editor positive governed RPC behavior and normal hierarchy reads, View-only/No-access negative direct table DML and governed RPC denial, authenticated installed Windows UI in the office, binary hash correlation, and sustained functional monitoring. Live catalog verification is NOT a real-user behavior test. Do not forge roles, create accounts, or issue production master writes to simulate acceptance.

**Governance:** WP10 still OPEN until receiving and owner closure; programme formally 11/13. WP12 queued. Do not interpret this receipt as a PR merge, WP10 closure, global feature activation or new Electron release. This change was separately authorised as Stage B only. Original draft PR #476 Stage A/Stage B plan contains outdated historical statements; use this newer receipt for operational state.
