# E-AUSHADHI WORK-PACK HANDOVER TEMPLATE

Paste the completed handover block into a NEW chat. The outgoing chat stops after producing it.

## Programme
E-AUSHADHI AUTOMATION

## Work Pack
WP-XX — <name>

## First instruction to the new chat
Before planning or implementation:
1. Read `docs/eaushadhi/MASTER_PROGRAMME.md`.
2. Read `docs/eaushadhi/IMPLEMENTATION_RULES.md`.
3. Read `docs/eaushadhi/CHANGELOG_DECISIONS.md`.
4. Read `docs/eaushadhi/WP-XX_....md`.
5. Independently verify the stated GitHub/Supabase live anchors.

Do not rely on conversational memory if repository/live evidence differs.

## Objective
<one precise outcome>

## Authoritative starting state
- Main SHA:
- Relevant feature branch/head:
- Live migrations:
- Relevant RPCs/tables:
- Relevant product/run IDs:
- Relevant portal contract state:

## Completed in prior work
- ...

## Exact current gate
<single immediate task>

## Required end state of this chat
- ...

## Dependencies
- ...

## In scope
- ...

## Out of scope
- ...

## Safety invariants
- ...

## Allowed mutations
- ...

## Prohibited mutations
- ...

## Server responsibility
ChatGPT.

## Client responsibility
Routine bounded work: ChatGPT freezes one complete work package → Cursor/Codex autonomously analyze/implement/test/self-review/fix/commit/push → ChatGPT independent GitHub audit → at most one consolidated correction pass → final verification → explicit merge/cleanup approval.

High-risk work: separate Plan → ChatGPT review → autonomous implementation within the approved plan → GitHub audit → correction if required → explicit merge approval.

## Current execution state
PLAN / AUTONOMOUS IMPLEMENTATION / VERIFICATION / CORRECTION / MERGE-CLEANUP

## Downstream outputs
- ...

## Chat closing requirements
Before this chat ends:
- verify live/repo evidence;
- update WP milestones;
- update MASTER_PROGRAMME if state/gate changed;
- update decisions/backlog if needed;
- generate the next work-pack handover prompt;
- stop.

## Mandatory short recap format
**Workflow:** WP-XX — <name>  
**WP progress:** NN%  
**Programme progress:** NN%  
**Current gate:** ...  
**Next:** ...  
**Parked:** ...
