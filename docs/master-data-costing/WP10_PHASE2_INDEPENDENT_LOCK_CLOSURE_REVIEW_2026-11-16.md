# WP10 Phase 2 — independent cross-flow lock closure review (16 November 2026)

**Status: HOLD / NOT TESTED in two-session synthetic PostgreSQL.** This is a read-only live catalog and source review, **not** a reproduced production defect or an owner approval. WP10 OPEN; programme 10/13; `WP10_SAFEGUARDS_V1` OFF. Deferred 04/05 and rollback 99 UNAPPLIED; Phase 1 01/02/03/06 already APPLIED and never to be replayed.

## Scope and primary evidence

Read the [authoritative handover](WP10_PHASE1_COMPLETE_PHASE2_NEW_CHAT_HANDOVER_2026-11-16.md), original proposals `WP10_G2_UNAPPLIED_SQL_PROPOSALS/04_active_sku_reparent_guard.sql` and `05_product_route_impact_guard.sql`, original manifest, Issue #440 and current PostgreSQL 17.4 catalog via **SELECT only** on project `qhmoqtxpeasamtlxaoak`. Live function definitions examined:
- `public.rpc_set_product_sku_active(bigint,boolean,text,text)`
- `public.rpc_update_product(integer,text,integer,text,text,text,numeric,boolean,boolean,integer,integer,boolean,text,text)`
- `costing.fn_sku_activation_missing_items(bigint,bigint)`
- `public.fn_guard_active_sku_requires_active_product()`
- `public.fn_guard_sku_activation_completeness()`
- `public.fn_guard_product_inactivation_requires_no_active_skus()`
- Live noninternal trigger definitions for `products` and `product_skus`, and relevant FK definitions.

## Observed write and trigger lock closure

1. Activation writer takes `SELECT ... FROM public.product_skus WHERE id = p_sku_id FOR UPDATE` and calls `costing.fn_sku_activation_missing_items(sku, product_id)` before updating `is_active` and writing `product_sku_master_audit`. It does **not** explicitly lock `public.products` by ID.
2. Activation completeness also runs in a BEFORE INSERT/UPDATE trigger, but its route-family/product lookup is read-only. The sibling active-product trigger selects `products.status` without a locking clause. Both evaluate the parent/route, but neither explicitly shares a serialization lock with a subgroup edit.
3. Product writer `rpc_update_product` takes `SELECT ... FROM public.products WHERE id = p_product_id FOR UPDATE`, then updates `sub_group_id` and inserts `product_master_audit`; its advisory lock is keyed to normalized **product name**, not the parent/child activation transition.
4. Proposed guard 05 BEFORE trigger uses `EXISTS (SELECT 1 FROM product_skus WHERE product_id = OLD.id AND is_active)`, then evaluates the old route. Proposed AFTER trigger recounts active SKUs using an ordinary SELECT and evaluates the new route. Neither locks active-SKU rows or otherwise creates a shared activation/product-edit exclusion lock.
5. Existing product inactivation trigger counts active SKUs via an ordinary SELECT; it does not resolve this subgroup/activation cross-flow. The existing `product_skus(product_id) REFERENCES products(id)` FK checks parent identity; an `is_active` update without `product_id` change is not evidence of a parent row lock. Conversely, a `products.sub_group_id` update changes neither the referenced `products.id` key nor the child FK.
6. The extra noninternal product/SKU change-log, price-list, epoch and lifecycle triggers were enumerated. Read-only catalog inspection establishes no explicit shared product row lock in the reviewed activation/lifecycle definitions. This review does **not** certify their entire nested side-effect closure or hidden implicit lock behaviour; a synthetic two-session trace remains mandatory.

## Specific unproven interleaving — do not label as reproduced

At READ COMMITTED, begin with product P having **no active SKU**, SKU S inactive, and an old valid route. Session A begins to activate S and validates P's old route while holding the S row lock. Session B changes P's subgroup to one without a valid route, holding the P row lock. If B's 05 checks run while S's activation remains uncommitted, they can observe zero active SKUs and permit B's change. If A's final activation commits based on a route check from before B's update, the desired postcondition (active SKU must have a valid route) would fail. Whether the actual trigger/FK operations and session scheduling permit this complete commit order is **NOT YET PROVEN**.

The opposite ordering must also be tested, plus blocking/deadlock/serialization outcomes. A test that merely simulates two product edits does not settle this case.

## Required synthetic validation before guard authority

Use a completely isolated disposable PostgreSQL database (not live, not a rollback-based production rehearsal). Create a minimal parent/child schema with the relevant FK, statuses, product row lock, SKU row lock, original guard 05 trigger bodies and stand-in route validator with explicit `PROVENANCE_ROUTE=synthetic`. Preserve the live lock order and trigger timing. Run two independent connections/sessions with barriers at:
- A has locked inactive SKU and validated old valid route, before `UPDATE is_active`.
- B locks product and enters 05 BEFORE/AFTER, with zero committed active SKUs.
- A/B commit/recheck in both orders; collect `pg_locks`, `pg_stat_activity`, final parent subgroup, S active state, route result, SQLSTATE and audit transaction outcomes.

Add controls for B-first, A-first, same-product/two active SKUs, no-active-SKU edit, route valid→valid, route valid→invalid, unknown validator, parent inactivation, FK constraint and timeout/deadlock cases. A proof must report **PASS/FAIL by actual final state**, not only expected exceptions or mocked SQL. Ensure test mutations cannot touch business data.

## Correction direction for review — NOT AUTHORISED / NOT IMPLEMENTED

A plausible approach is a consistent **parent-product locking protocol** on the activation path before the authoritative route check, paired with the existing product edit's row lock. A protected trigger-level mechanism must cover authorised and privileged direct SKU activation writers, not just the public RPC; it must avoid breaking lifecycle trigger order and show that a blocked activation rechecks the *new* committed route on wake-up. Prove no bypass under READ COMMITTED and document expected deadlock/lock-timeout handling.

Do not simply add a parent lock in guard 05: the earlier activation validation could already be stale. Do not introduce unreviewed `CREATE OR REPLACE` of an existing live writer, bypass, advisory lock collision, GRANT/RLS change or deployment. Exact corrected SQL source, tests, dependency fingerprint, rollback and release/owner authority must be prepared separately after synthetic validation.

## Independent preliminary disposition

- **04:** logic consistent with the explicit policy: reject active→active re-parent; old active→new inactive + re-parent in one privileged UPDATE remains allowed as documented but lacks a lifecycle audit event. Review this governance trade-off explicitly; no claim of complete privileged-writer closure.
- **05:** **HOLD** for cross-flow synthetic validation and potentially a corrected application proposal. Original immutable SHA-256 `89aacb0f0a10f537e1de7b1b5b9633d4bf6975e6e82146039251b14e9da3239c` must not be presented for application until this is settled. The earlier two-product-edit fixture is insufficient for this case.
- **Both:** the original SQL is still unapplied; no exact Phase 2 owner decision is ready. A changed SQL payload requires new hashes, manifest, isolated evidence and a new explicit owner decision.

## Receiving acceptance (all NOT TESTED unless separately captured)

Real editor/view-only/no-access identities and signed JWT/PostgREST positive and negative endpoint GETs; production-scale endpoint latency/p95 and timeout; safe bounded preview/read-only fingerprints; true writer rejection under authorised role; hosted resolver-link/browser behaviour; installed PWA stale/warm/offline/version changes; packaged Electron/Windows and real 390/1280 device checks. Retain WP11 PM BOM mobile overflow and SKU Deactivate contrast defects, and all WP12 release/security/11-flag obligations. WP08, PEC and WP09 closures are unaffected.

**No production SQL, rollback, business writer, build/scheduler, flag activation, permission or registry change or deploy was performed in this review.**
