# WP04-G4 — Native Auth/API read-only preflight

2026-10-05. **READ-ONLY PREFLIGHT PASS — NATIVE RUNTIME PROOF STILL REQUIRES TEMPORARILY COMMITTED CANDIDATES + GENUINE AUTHENTICATED API CALLS.**

## Scope

No candidate reader was created or invoked. No authenticated Data API request was sent. No user/session/token/permission was created, changed, refreshed or exposed. No deployment or rollback occurred.

## Current Supabase API model

Current Supabase documentation confirms:

- Data API function reachability is controlled by Postgres EXECUTE grants;
- SECURITY DEFINER functions require explicit in-body authorization review;
- authenticated frontend/API requests carry a genuine user JWT;
- SQL-side claim simulation is not equivalent to a native authenticated Data API request.

## Current production boundary

Read-only catalog inspection:

- public schema USAGE: authenticated = true, anon = true;
- current canonical readiness RPC:
  - SECURITY DEFINER = true;
  - EXECUTE: authenticated = true;
  - EXECUTE: anon = false;
  - EXECUTE: PUBLIC = false;
  - ACL = postgres + authenticated + service_role only;
- candidate WP04 public readers are currently absent.

The project has an active native Data API endpoint and enabled publishable/legacy anon client-key surface.

## Frozen candidate source boundary

All three proposed public readers:

- `public.rpc_get_readiness_governed_periods`
- `public.rpc_get_readiness_product_gaps`
- `public.rpc_get_product_sku_readiness_portfolio`

have source-level:

- explicit `auth.uid() is null` refusal;
- explicit `module:costing-control-center`, `view` permission check;
- no Manage Products fallback permission;
- revoke from PUBLIC / anon / service_role before grant;
- EXECUTE grant to authenticated only.

This matches the reviewed G1/G3 access contract: Product-only users may retain their existing single-SKU canonical access, but the new portfolio/period/gap readers are Control-Center-only.

## Client repository boundary

Current main contains no invocation of any of the three candidate WP04 readers.

Therefore no hidden existing client/native call path can be treated as API proof.

## Existing real permission classes

Read-only aggregation of `public.user_permissions_canonical` found:

- Control Center + Manage Products view: 1 user;
- Manage Products-only view: 2 users;
- neither permission: 17 users;
- Control Center-only: 0 users.

Read-only `auth.sessions` inspection, without reading tokens, found current session-bearing users in the needed classes:

- Control Center + Manage Products: 1;
- Manage Products-only: 2;
- neither: 16.

No fixture user or permission mutation is required for native allow/deny coverage.

## Exact native runtime cases still required

Once candidate readers are genuinely reachable through the Data API, the minimum proof is:

1. authenticated Control Center viewer:
   - three readers reachable;
   - valid request returns expected nonmonetary payload;
2. authenticated Manage Products-only viewer:
   - three new readers denied;
   - existing canonical single-SKU readiness remains permitted;
3. authenticated user with neither permission:
   - three new readers denied;
4. anonymous/no-user request:
   - candidate reader denied/unreachable as designed;
5. direct private C helpers:
   - not callable by authenticated/anon;
6. no writer/specialist mutation invoked.

## Why transaction-only temporary functions cannot prove native API behavior

A native Data API request is served through PostgREST on a separate database connection. Uncommitted functions created inside a proof transaction are invisible to that request.

Therefore native proof cannot use the prior “create → test → ROLLBACK in one transaction” pattern.

To perform genuine native API proof in production, the candidate functions would need to be **temporarily committed**, tested through the Data API with genuine user sessions, then explicitly restored/dropped in a separate rollback operation.

That is a materially higher-risk operation than prior transaction-contained proofs.

## Disposition

**Native Auth/API structural preflight: PASS. Native Auth/API runtime behavior: NOT RUN.**

No evidence gap can now be closed further by read-only inspection alone.

The next native proof would require:

- temporarily committed candidate server definitions;
- genuine authenticated API requests;
- explicit restoration/rollback;
- fresh high-risk authorization.

Performance and committed deployment/rollback remain separate unresolved obligations.
