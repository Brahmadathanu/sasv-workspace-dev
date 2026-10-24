# Capacity governance: the 74 blocked machines (CI-011), 19 Oct 2026

The source is live `costing.v_plant_capacity_readiness`, read-only. It shows 74 machines as BLOCKED_NEEDS_CAPACITY. The other readiness states are READY_PROVISIONAL 74, NOT_REQUIRED 20 and NOT_OPERATIONAL 3.

The exception register is `evidence/CAP/CAPACITY_EXCEPTION_REGISTER_74.csv`. It has one row per machine, with its usage, flags, the value needed, and blank columns for the user's answer.

| Priority | Machines | Meaning |
|---|---|---|
| P1: named on route steps or route overrides | 15 | These block G4 plant-aware loads fail-closed. Get these values first. |
| P2: work log only (since Oct 2025) | 54 (22 already have a rated value from the plant name; only the effective working volume or fill % is needed) | Not on governed routes; they do not block G4 today. |
| P3: unused | 5 | Mark NOT_REQUIRED with a reason, or leave blocked. |

Other details:
- Capacity modes: 68 CHARGE and 6 THROUGHPUT.
- Units: 53 L, 15 kg, 3 Nos/h, 3 kg/h.
- 23 machines have work-log values flagged as implausible. Those logs are not used as evidence.

**Governance rule (proposed).**
- A machine moves out of BLOCKED only through an append-only `plant_capacity_profile` row that carries `value_origin` (TB7) and an approval reference.
- A class fallback is allowed only by an explicit per-machine approval and is labelled CLASS_DEFAULT.
- Nothing is applied until the user returns values. The data load will then be prepared as a single guarded file, without Google Sheets.
