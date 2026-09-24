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
- Client work follows: ChatGPT Plan prompt → Cursor/Codex plan → ChatGPT audit → Cursor/Codex implementation on isolated feature branch/worktree → ChatGPT independent audit → merge/cleanup authorization → final verification.
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
| WP-02 | Global Terminology Governance | PURPLE | 97% | Final operational sync/visual confirmation, then deliberate global verification |
| WP-03 | Product Dossier & Attachment Readiness | YELLOW | 20% | Formalize class-specific document requirements |
| WP-04 | Product Details Preparation & Portal Execution | PURPLE | 75% | Generalize and close bulk-safe Product Details stage |
| WP-05 | Composition Data Completion, Verification & UX | YELLOW | 35% | Stable data/gap/manual-entry contract and operator UI |
| WP-06 | Composition Portal Execution | YELLOW | 20% | Durable executor after WP-05 contract freeze |
| WP-07 | QC Register Preparation & Portal Execution | WHITE | 5% | Discover data/server/portal contract |
| WP-08 | Overall Readiness, Audit & Progress Control | YELLOW | 15% | Define truthful derived overall status model |
| WP-09 | Operational Handover & Colleague Enablement | BLOCKED | 0% | Opens only after production pipeline acceptance |
| WP-10 | Acceptance, Stabilisation & Programme Closure | BLOCKED | 0% | Final regression/usability/closure |
| WP-11 | Post-Closure Enhancements / Parked Backlog | PARKED | N/A | Scope sink; not part of closure percentage |

### Programme completion baseline
**39% — milestone-based tracking baseline, not an effort/time estimate.**

Work-pack percentages and the overall percentage are tracking indicators. They must be updated only when milestone evidence changes. WP-11 is excluded from overall completion.

## Current repository/live anchors
- Operational runtime synced to code/docs state: `9b6fe22db67e006dafe1480a7ceaa16de407ae52`. Later programme-tracking commits are documentation-only and do not require Electron resync.
- WP-02 client feature branch: `feat/eaushadhi-global-reference-dictionary-client`
- WP-02 client feature head awaiting bounded corrections: `c4dad91eb2f5e0fa7f31971b48e9b0ecafb804ef`
- Composition live arm remains OFF.

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
