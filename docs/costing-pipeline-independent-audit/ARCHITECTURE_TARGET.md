# Costing Suite target architecture — hypothesis, not yet approved
## Desired capability layers
1. **Evidence acquisition** — Tally/ETL, inventory/production transaction lineage, source timestamps, reconciled/held snapshot versions and variance.
2. **Governed master data** — product, SKU pack/UOM, BOM RM/PM, yields, standard batch and route, effective-dated mapping with completeness/remediation.
3. **Cost policy registry** — cost heads, fixed/variable/semi-variable evidence, owner approvals, normal capacity driver, valid dates, supersession; immutable versions.
4. **Manufacturing cost engine** — per-batch product costs by labour/fixed POH/variable POH, yield losses, packing separately; dual standard-cost vs actual expenditure/variance. Multi-SKU packaging conversion without repeated product batch charge or sales allocation.
5. **Commercial cost engine** — QC/stores/admin, selling region/channel marketing, GST, scheme and contingency; price proposal SCENARIO vs APPROVED separation.
6. **Operational governance** — source-to-unit trace, run ledger, audit and adjustment workflow, exception triage, period close, locking, role-segregated approval and export.
7. **Professional ERP UI** — workbench progression (Sources → Foundations → Drivers → Cost Build → Variance → Pricing → Approvals), summary-first design, drillthrough to evidence, contextual exception repair and responsive parity.
8. **Reliability** — staging preview and parity gate, replayable immutable runs, atomic refresh contract, idempotent retries, seeded golden fixtures, performance monitoring and rollback.

## Design candidates to test
A. **Two-lane costing:** operational standard batch pricing independent of monthly sales; separate period actual production absorption/variance ledger. Avoid forcing every standard SKU price to balance a particular period's spend.
B. **Rate components as first-class entities:** variable utilities/job work based on measurable drivers or specifically assigned jobs, fixed capacity with transparent under-/over-absorption; no automatic dual application of aggregate OH and child heads.
C. **Cost model provenance:** every cost row carries run/model/rate-policy/batch-policy/yield snapshot IDs and input digest; support old-vs-new comparison and automated impact report for all active SKUs.
D. **Governed pricing review workflow:** separate cost validity, commercial feasibility, proposal approval and active MRP; optional price change screen never masquerades as a pricing policy.
E. **Data-contract driven client:** Supabase authoritative business logic; client only presents status, drilldowns, guarded action calls.

## Architectural decision criteria
Traceable financial integrity; accounting semantic soundness; regulatory/audit defensibility; costing accuracy vs routine operational effort; backward compatibility; minimal migration risk; maintainability, performance; UX clarity; explainable exceptional costs (Ksheerabala 41, Thampira). Each proposal must state alternatives, rejected options, migration dependencies, measurable acceptance and Finance/user approval requirements.

## Phased upgrade proposals (unapproved)
Phase I diagnostic and source repairs; Phase II normalised policies and batch workbench; Phase III isolated engine and variance parity; Phase IV client control centre and pricing approvals; Phase V monitored, explicitly authorised cutover. Do not set dates or force-live milestones absent tests and stakeholders.
