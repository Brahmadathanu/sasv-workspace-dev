# E-AUSHADHI AUTOMATION — DECISION REGISTER

## DEC-001 — Server-first authority
**Status:** ACTIVE  
The server is the authoritative preparation/governance layer. Portal execution consumes verified server data.

## DEC-002 — ChatGPT architect / Cursor-Codex worker boundary
**Status:** ACTIVE  
ChatGPT owns architecture and all server/database planning/implementation. Cursor/Codex perform client implementation only after ChatGPT freezes the contract and audits the plan.

## DEC-003 — Architect-Controlled Parallelism
**Status:** ACTIVE  
Parallel execution is allowed only for independent, frozen contracts. Cursor/Codex may not implement YELLOW/unresolved architecture.

## DEC-004 — Colleague rollout deferred
**Status:** ACTIVE  
Production colleagues will not perform data entry, verification, attachment upload, or portal coordination until WP-09 opens after pipeline operational acceptance.

## DEC-005 — Canonical terminology is independent of portal nomenclature
**Status:** ACTIVE  
Canonical terms remain the reusable SASV knowledge layer. e-Aushadhi labels/values are governed projections. Future Therapeutic Guide work will consume canonical data, not portal terms.

## DEC-006 — Reference governance is global
**Status:** ACTIVE  
Raw source reference → global controlled-term alias → canonical REFERENCE_WORK → global term_portal_mapping → e-Aushadhi REFERENCE option. No product/ingredient-specific Reference approval.

## DEC-007 — Portal stages are independently tracked
**Status:** ACTIVE  
Product Details, Composition, and QC Register each have their own readiness/execution/verification state. Overall completion is derived from all required stages and documents.

## DEC-008 — Proprietary document readiness
**Status:** ACTIVE / TO BE FORMALIZED IN WP-03  
A proprietary product must not be treated as overall-ready merely because Product Details is portal-verified. Required license approval and additional shelf-life supporting document(s) must be represented by the dossier/readiness contract.

## DEC-009 — Repository documentation is continuity authority
**Status:** ACTIVE  
MASTER_PROGRAMME, IMPLEMENTATION_RULES, work-pack documents, decision register, and parked backlog are authoritative continuity records across conversation limits.

## DEC-010 — Work-pack closure handover
**Status:** ACTIVE  
Every work-pack chat concludes with repository tracking updates plus a self-contained handover prompt for the next work-pack chat, then stops.

## DEC-011 — Non-blocking enhancements are parked
**Status:** ACTIVE  
Non-blocking improvements are moved to WP-11/PARKED_BACKLOG rather than expanding the active work pack.

## DEC-012 — Colleague-facing UX threshold
**Status:** ACTIVE  
The workflow must be operationally usable before WP-09. Cosmetic/value-add refinements that do not block safe/efficient operation may remain for WP-10/WP-11.

## DEC-013 — Composition READY is a server contract
**Status:** ACTIVE  
WP-05 Composition READY v1 is the sole server-to-WP-06 input boundary. A portal row or portal stage status cannot make an unready server line authoritative. READY requires VERIFIED governed line data, valid selected portal projections, global Reference readiness, blocker-free state, current version authority and a fresh server-generated execution snapshot/hash.

## DEC-014 — Verified Composition corrections are lifecycle-specific
**Status:** ACTIVE  
A VERIFIED Composition line stays locked against ordinary editing. Before portal entry starts, correction uses the governed Reopen path. After entry starts, ordinary Reopen is unavailable and only an explicitly authorized post-entry reconciliation path may correct the bounded governed projection. Reconciliation preserves VERIFIED status, records before/after audit evidence and increments version authority.

## DEC-015 — Composition portal mutations require an explicit WP-06 gate
**Status:** ACTIVE  
Portal evidence gathering and a controlled bootstrap do not create standing permission to continue portal mutation. Every further Composition Save must be explicitly opened by WP-06 under fresh server governance, durable run/progress evidence, exact page/list classification, at-most-once mutation and native reread/semantic proof.

## DEC-016 — No client-side execution hash authority
**Status:** ACTIVE  
The authoritative Composition execution hash is server-generated. Effective Reference portal value and governed Ingredient Form changes participate in `content_hash`. Client JavaScript must not calculate or substitute an execution hash.

## DEC-017 — Composition execution lifecycle is stage-specific
**Status:** ACTIVE  
The existing `eaushadhi_worker_run` and product-level `entry_status` lifecycle is Product Details execution authority and must not be reused for Composition. WP-06 owns an independent Composition-stage state and Composition-run model so Product Details, Composition and QC remain independently auditable.

## DEC-018 — One Composition run authorizes one Save target
**Status:** ACTIVE  
A Composition run binds exactly one missing governed source line and one fresh content hash. Only durable `SAVE_ARMED` server state authorizes the trusted executor to issue at most one native Save. Save uncertainty is recorded as AMBIGUOUS and never auto-retried.

## DEC-019 — Composition row verification precedes final stage verification
**Status:** ACTIVE  
A successful/ambiguous Save does not itself complete the line or stage. Fresh complete list evidence, bounded row identity, native reread and exact semantic comparison must prove the target row before the run becomes ROW_VERIFIED. Composition stage becomes PORTAL_VERIFIED only through a separate final exact-set proof with no active run.

## 2026-09-25 — WP-02 Global Terminology Governance closed
- Accepted the consolidated source-centric Reference Dictionary and two-stage review modal.
- Verified global alias 1: `Sahasrayōgam - Sujanapriya → Sahasrayōgam`.
- Verified shared portal mapping 28: `Sahasrayōgam → Sahasrayoga / 28`.
- Independently proved inherited readiness for all 1,477 Sujanapriya lines across 85 products.
- Kept alias 2 `Sahasrayōgam - Vaidyapriya` DRAFT; its 32 lines across 10 products remain not ready, proving source aliases remain independently governed.
- Proved Product 262 / Karpooradi Thailam lines 929–931 are Reference-ready without per-line Reference edits.
- Composition live execution remained disarmed.

## 2026-09-27 — Product 262 Composition governance reconciliation
- Re-audited effective Reference content-hash participation and preserved server-only hash authority.
- Proved native Composition list/reread/save, hidden row identity, unit/value and Reference-value semantics through the controlled Karpooradi bootstrap.
- Added and repository-versioned the bounded Product-262 post-entry Ingredient Form reconciliation RPC.
- Added lifecycle-aware client reconciliation UI and hardened VERIFIED Composition ordinary-field locking.
- Reconciled and audited line 929 Ajamōdā from AS PER TEXT / 2 to LIQUID KWATH / 60.
- Reconciled and audited line 930 Karpūra from AS PER TEXT / 2 to SOLID / 66.
- Reconciled and audited line 931 Kēram from AS PER TEXT / 2 to OIL / 61.
- Final line row_versions are 8/8/8; product workflow row_version is 11 and remains PORTAL_VERIFIED.
- Live portal Composition remains intentionally partial with only the Ajamōdā bootstrap row.
- No further Composition portal mutation is authorized until WP-06 explicitly opens the next durable execution gate.

## 2026-09-27 — WP-06 Composition execution lifecycle frozen
- Audited the existing worker lifecycle and confirmed it is coupled to Product Details product-level `entry_status`; Product 262 already has a historical PORTAL_VERIFIED Product Details run.
- Rejected reuse of that lifecycle for Composition to preserve independent portal-stage state.
- Frozen a Composition-specific stage state plus one-target-per-run lifecycle.
- Frozen durable states SAVE_ARMED, SAVE_CONFIRMED, SAVE_AMBIGUOUS, SAVE_REJECTED and ROW_VERIFIED.
- Frozen the one-save-at-most-once rule, no automatic retry after uncertainty, and separate final exact-set PORTAL_VERIFIED proof.
- Kept Composition live arm OFF pending server foundation implementation and audit.


## 2026-09-27 — WP-06 Composition server lifecycle foundation implemented
- Deployed independent `regulatory.eaushadhi_composition_stage` and `regulatory.eaushadhi_composition_run` tables.
- Deployed read-only Composition execution preflight plus bounded arm, Save-outcome, row-verification and final-stage verification RPCs.
- V1 remains restricted to Product 262 and derives target projection from fresh server authority.
- Hardened arm evidence to require exact portal identity and bind planner counts to the exact list evidence.
- Hardened row verification to require explicit native reread success, exact row identity, current governed target semantics and planner/list count agreement.
- Hardened final exact-set verification and preserved the previous stage status in audit evidence.
- Active-run uniqueness permits at most one SAVE_ARMED/SAVE_CONFIRMED/SAVE_AMBIGUOUS run per product.
- Product Details workflow remains independent and unchanged; Product 262 stays PORTAL_VERIFIED at workflow row_version 11.
- No Product 262 Composition stage/run row was instantiated during deployment; no SAVE_ARMED authority or portal mutation occurred.
- Repository migrations exactly version the live foundation and hardening migrations.
- Composition live arm remains OFF; next gate is trusted executor/adapters and client orchestration.
