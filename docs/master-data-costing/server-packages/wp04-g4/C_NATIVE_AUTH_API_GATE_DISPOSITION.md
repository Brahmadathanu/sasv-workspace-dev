# WP04-G4 — Native Auth/API gate disposition

2026-10-05. **REPOSITORY-GOVERNANCE DISPOSITION PASS — RUNTIME PROOF DEFERRED TO WP04-G7, NOT WAIVED.**

## Preserved state

Native Auth/API remains exactly:

- structural preflight: PASS;
- runtime proof: NOT RUN;
- blocked in G4 by lack of an approved execution surface using an already-signed-in application session;
- prior conditional authorization: NOT CONSUMED;
- no bearer JWT/token extraction, manual token use or credential exposure permitted.

This document does not relabel runtime proof as PASS.

## Governing gate structure

The authoritative WP04 gate ledger defines:

- G4 — High-risk server package;
- G5 — Client implementation;
- G6 — Independent implementation audit;
- **G7 — Authenticated/live verification: context, severities, permissions, specialist destinations, performance; no manufactured production test data**;
- G8 — Merge/post-merge closure and final handover.

Repository implementation rules assign:

- ChatGPT ownership of server/database planning, application and server verification;
- Cursor/Codex ownership of client implementation only after the server contract is frozen;
- high-risk authentication/permission client work to a separately reviewed plan/audit boundary;
- final milestone completion only after its verification gate passes.

## Disposition

The genuine JWT/PostgREST allow/deny proof requires an already-signed-in application surface. That surface belongs naturally to G7 authenticated/live verification, after the G5 client has been implemented and G6 independently audited.

Therefore native Auth/API runtime proof is **not a prerequisite to close G4** if all of the following remain true:

1. G4 freezes the server ACL/in-body permission contract;
2. structural preflight remains PASS;
3. no permission/RLS/Auth widening occurs during deployment;
4. the G5 client package does not invent or bypass server authorization;
5. G7 explicitly retains mandatory genuine-session cases before WP04 can close;
6. failure of any G7 allow/deny case blocks G8/final closure and triggers server/client correction rather than fallback.

Required G7 cases remain:

- Control Center-authorized signed-in user: new readers allowed;
- Manage Products-only signed-in user: new readers denied while canonical single-SKU readiness remains allowed;
- neither-permission signed-in user: new readers denied;
- anonymous/no-user: denied;
- private C helpers: inaccessible to frontend roles;
- no writer/specialist mutation invoked.

## Why this is deferral rather than waiver

The proof cannot currently be executed safely through connected tools without bearer-token handling. G7 is already the programme's designated authenticated/live gate and provides the normal signed-in application execution surface.

Moving the runtime proof there preserves both security and workflow ownership. It avoids temporary pre-client production exposure solely to manufacture an API test surface.

## G4 effect

Native Auth/API **runtime** behavior is reclassified from G4 blocker to **mandatory G7 verification dependency**.

G4 still owns/fixes the exact server ACL/function contract and may not close if source/catalog authorization evidence regresses.

No server/client mutation is authorized by this disposition.
