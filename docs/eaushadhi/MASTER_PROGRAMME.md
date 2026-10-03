# E-AUSHADHI AUTOMATION — MASTER PROGRAMME

## Programme objective
Build a complete SASV-to-e-Aushadhi pipeline in which every licensed Ayurveda/Siddha product is fully represented on the server, gaps can be completed and verified, required attachments are present, canonical terminology is mapped to portal terminology, and only verified products proceed through Product Details, Composition, and QC Register portal stages with a durable audit trail.

## Operating principle
The server is the authoritative preparation and governance layer. The portal is an execution target, not the place where product data is discovered or decided.

## Architecture and execution ownership
- ChatGPT is the programme architect across all work packs.
- ChatGPT owns server/database planning and implementation.
- Cursor/Codex are client implementation workers only.
- Cursor/Codex must never independently redefine server contracts, lifecycle rules, work-pack scope, cross-work-pack dependencies, or architecture.
- Routine bounded client work follows an autonomous gate-based model: ChatGPT freezes one complete work package → Cursor/Codex analyzes/implements/tests/self-reviews/fixes/commits/pushes on an isolated task branch/worktree → ChatGPT independently audits the pushed GitHub implementation → one consolidated correction pass only if required → final verification → explicit merge/cleanup authorization.
- High-risk client work retains a separate Plan → ChatGPT review → Implementation gate for architecture, database/schema/RPC contracts, authentication/permissions, production-data mutation risk, destructive operations, major cross-module refactoring, unclear business rules, or security-sensitive behavior.
- Direct client edits on main are prohibited.
- Operational checkout must not be destructively reset/cleaned.
- Protected WIP branches must not be disturbed.

## Architect-Controlled Parallelism
Parallel work is allowed only when contracts are frozen and dependencies are independent.
- WHITE: not architected.
- YELLOW: architecture in progress; no implementation.
- GREEN: contract frozen; implementation may proceed.
- BLUE: implementation complete; awaiting ChatGPT audit.
- PURPLE: audited; awaiting merge/live gate.
- DONE: closed and downstream-safe.
- BLOCKED: waiting on dependency.

Cursor/Codex may work only on GREEN work packs. ChatGPT may investigate another independent work pack while a frozen client implementation is running, but must not change the contract under active implementation.

## Colleague rollout rule
No production colleague participation in data entry, verification, attachment upload, or portal coordination until the pipeline reaches operational acceptance and WP-09 opens.

## Portal stages
1. Product Details
2. Composition
3. QC Register

Each stage must maintain its own readiness/execution lifecycle. Overall product completion is derived from all required data, documents, governance, and portal stages; one stage being PORTAL_VERIFIED does not mean the whole product is complete.

## Programme work packs

| WP | Name | Architecture state | Progress baseline | Current gate |
|---|---|---:|---:|---|
| WP-00 | Programme Control & Architecture | DONE | 100% | Documentation control plane established |
| WP-01 | Licensed Product Registry & Source Consolidation | YELLOW | 25% | Definitive source/gap inventory |
| WP-02 | Global Terminology Governance | DONE | 100% | Closed: global Reference authority verified; Sujanapriya + shared portal mapping proven; Vaidyapriya remains independently DRAFT |
| WP-03 | Product Dossier & Attachment Readiness | YELLOW | 20% | Formalize class-specific document requirements |
| WP-04 | Product Details Preparation & Portal Execution | PURPLE | 75% | Generalize and close bulk-safe Product Details stage |
| WP-05 | Composition Data Completion, Verification & UX | YELLOW | 45% | Frozen Composition READY v1 contract now governs WP-06 input; continue source-path/manual-entry and representative acceptance work |
| WP-06 | Composition Portal Execution | PURPLE | 65% | First line-930 run safely recovered to SAVE_REJECTED; trusted post-arm identity wiring correction awaits independent audit |
| WP-07 | QC Register Preparation & Portal Execution | WHITE | 5% | Discover data/server/portal contract |
| WP-08 | Overall Readiness, Audit & Progress Control | YELLOW | 15% | Define truthful derived overall status model |
| WP-09 | Operational Handover & Colleague Enablement | BLOCKED | 0% | Opens only after production pipeline acceptance |
| WP-10 | Acceptance, Stabilisation & Programme Closure | BLOCKED | 0% | Final regression/usability/closure |
| WP-11 | Post-Closure Enhancements / Parked Backlog | PARKED | N/A | Scope sink; not part of closure percentage |

### Programme completion baseline
**46% — milestone-based tracking baseline, not an effort/time estimate.**

Work-pack percentages and the overall percentage are tracking indicators. They must be updated only when milestone evidence changes. WP-11 is excluded from overall completion.

## Current repository/live anchors
- WP-02 Global Terminology Governance is CLOSED and downstream-safe.
- Final WP-02 live Reference state: alias 1 Sujanapriya VERIFIED; alias 2 Vaidyapriya DRAFT; portal mapping 28 `Sahasrayōgam → Sahasrayoga / 28` VERIFIED.
- Inherited-readiness proof: Sujanapriya 1,477/1,477 lines across 85/85 products ready; Vaidyapriya 0/32 lines across 0/10 products ready.
- Product 262 / Karpooradi Thailam lines 929–931 are Reference-ready through global governance with no per-line Reference authority.
- Composition READY v1 input contract is frozen in WP-05 and is the only accepted server input boundary for WP-06.
- Product 262 governed Ingredient Forms are reconciled and audited: line 929 Ajamōdā = LIQUID KWATH / 60, line 930 Karpūra = SOLID / 66, line 931 Kēram = OIL / 61; all remain VERIFIED at line row_version 8 and product workflow row_version 11.
- Product 262 live portal Composition currently contains only the controlled Ajamōdā bootstrap row; Karpūra and Kēram have not been entered.
- Native Composition list/reread/save semantics, row identity, Reference value, unit value and first-line bootstrap evidence are proven.
- Server-side content-hash coverage has been re-audited for effective Reference value and governed Ingredient Form changes. JavaScript hashing remains prohibited.
- The existing `regulatory.eaushadhi_worker_run` / product-level `entry_status` lifecycle is Product-Details execution authority and MUST NOT be reused for Composition.
- WP-06 now has a frozen Composition-specific stage/run lifecycle: independent stage state, one target line per run, durable SAVE_ARMED authority, one Save at most once, explicit save outcome, fresh list/reread semantic proof, and separate final stage PORTAL_VERIFIED evidence.
- Composition stage/run server authority is live and repository-versioned. Product 262 Composition is `PARTIAL` at stage row_version 7; three historical line 930 runs are durably `SAVE_REJECTED`, and no active run exists.
- Trusted Composition executor/adapters/client orchestration are merged at `3611cb29e8166bfcf924c7c01aa59229b2128720`; native mutation is correctly bound to page `SaveData()` while observing `POST /admin/SaveCompositionData`.
- Composition live arm remains OFF: `COMPOSITION_LIVE_ARM_DEFAULT=false`.
- Controlled read-only runtime acceptance passed on baseline `80c2f9e20c1226faf10036405e24048434c28b23`: matched `[929]`, missing `[930,931]`, with no mutation.
- Closed-gate pre-live acceptance passed on baseline `2ad4b80b8b8ed711edc97daa3855d9e7f0727a89` with no portal mutation.
- The first-live Product 262 / line-930 release constant is intentionally open: `COMPOSITION_FIRST_LIVE_930_RELEASE=true`. `COMPOSITION_LIVE_ARM_DEFAULT=false` remains unchanged, and production mutation still requires the separate exact runtime environment arm plus explicit operator confirmation.
- The post-arm identity wiring correction passed exact-main preflight. A subsequent controlled line 930 attempt reached native fill, but final verification proved Type 1 had cleared Ingredient Name and Botanical Name; `SaveData` was not invoked and the run closed `SAVE_REJECTED` with no-mutation proof. Native investigation established `FILL_ORDER_RESET`. The portal remains matched `[929]`, missing `[930,931]`. The next gate is independent audit and merge of the bounded fill-order correction, then a short exact-main no-mutation preflight; Kēram, stage verification, QC Register and final Submit remain excluded.

## Mandatory chat discipline
Every substantive chat response ends with a short cumulative recap:
- Current work pack and gate
- Work-pack completion %
- Overall programme completion %
- Next gate
- Any newly parked item

Avoid large historical recaps unless requested; repository documentation is the continuity authority.

## Work-pack closure procedure
A work-pack chat ends only after:
1. Required end state is met or the agreed stopping boundary is reached.
2. Relevant repository/live evidence is verified.
3. Work-pack document milestones/status are updated.
4. MASTER_PROGRAMME.md is updated if programme state/gate changed.
5. CHANGELOG_DECISIONS.md is updated for new durable decisions.
6. PARKED_BACKLOG.md/WP-11 is updated for non-blocking discoveries.
7. A self-contained handover prompt for the next work-pack chat is generated.
8. The chat stops there.

The handover prompt must tell the next chat what documents to read, what GitHub/Supabase state to verify, what is already complete, the exact current gate, dependencies, invariants, prohibited actions, and the completion criteria for that chat.

## New-chat orientation
At the beginning of every work-pack chat:
1. Read `docs/eaushadhi/MASTER_PROGRAMME.md`.
2. Read `docs/eaushadhi/IMPLEMENTATION_RULES.md`.
3. Read `docs/eaushadhi/CHANGELOG_DECISIONS.md`.
4. Read the relevant `WP-XX_*.md`.
5. Read `PARKED_BACKLOG.md` only as needed; parked items must not silently enter active scope.
6. Independently verify relevant GitHub/Supabase live state before implementation.

## Closure criterion for the entire programme
For every licensed product in scope, the server must unambiguously determine:
- canonical identity/data complete;
- all required source data complete;
- all required attachments complete;
- terminology governance complete;
- human verification complete;
- Product Details = PORTAL_VERIFIED;
- Composition = PORTAL_VERIFIED;
- QC Register = PORTAL_VERIFIED;
- overall product = COMPLETE / PORTAL_VERIFIED;
- every portal mutation has server-side progress/audit evidence.

Therapeutic-guide development may reuse the canonical data later, but it must not expand the e-Aushadhi closure scope.
