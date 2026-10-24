# Step 76 — Joint manufacturing approval gate
Status: DESIGN, not deployed. Live joint_process_policy table remains absent.

Implement one reviewed migration, not sequential execution of Step74 and Step75 drafts. Governed lifecycle: draft full joint definition atomically; validate both output products and four stages; approve with authorized actor, reference and prospective effective date; allow only audited effective_to closure plus new approved version; preserve original output/stage rows. Enforce no overlapping process intervals; deny direct edits/deletes/truncates and unauthorized function execution.

Approved example: product183 output105kg, product184 output5kg, shared stages1389-1392 with 41 common cycles and60 continuing solely product183; 21/22 and1/22 of common conversion costs respectively. Shared labour and overhead denominator must conserve total monetary pool. Never count shared processing twice; do not apply kg-solid manual loads to oil cloth filtration without approved physical workload rule.

Required fail-closed validation: yield sum110kg, stage matches both effective approved routes, positive quantities, approval identity, date > frozen-through, history invariant, no overlap, no missing stage, no mass allocation imbalance, no unauthorized write, monthly demand kept as costing proxy rather than physical stock transaction. Restore correct AUDIT/versioning mechanism before deployment: Step75's blanket immutability trigger prevents allowed close action and is NOT final code.

Next: implement actual guarded migration and shared labour/overhead helper and test against prospective run; keep run136 immutable and AU9 switch inactive until the coordinated gate.
