> **Status (30 Oct 2026): HISTORICAL — 16 Oct 2026 directive.** Current view: [STATUS_AND_REMAINING_WORK.md](STATUS_AND_REMAINING_WORK.md). Kept as a dated record; do not act on its status lines.

# User clarification 2026-10-16 07:46 IST (summary)
Structured summary as relayed by the parent agent (verbatim text not attached). Supersedes the previous decision request. PR #71 already merged (main 80c14ab).
Rules: no live writes, cron changes, rate approvals, consumer switches, merges or sheet edits; draft PRs on costing/* only.
1. Cron pause: guarded reversible pause/restore SQL + runbook for jobs 60/61 only; pre-checks (no QUEUED/RUNNING, capture schedule/active); cron.alter_job(active:=false); restore to captured state; post-checks; other jobs untouched; do not execute.
2. Period lifecycle: investigate fn_default_cost_period_valuation_date, rpc_ensure_cost_period, creation/rollover/valuation-date paths and client display; design autonomous, idempotent, effective-dated lifecycle, no month-specific logic, never alter closed/approved periods; integrate with 60/61 and AU-2; draft migration + local tests; do NOT open October.
3. AU-4: head-wise table with exact amounts, evidence, exclusions, impact; mark APPROVED POLICY / PROVISIONAL ESTIMATE / OPEN. Only Fuel & Gas (FY25-26 avg ~₹1.62L) approved; reconcile its consumption from stock register. 968/1,055 provisional. Investigate and resolve ₹2.1L salary gap before finalising labour pool.
4. Carriage inward: inventoriable inward freight in material acquisition cost, duplicate-allocation controls, separate from outbound/non-inventoriable; drivers by equivalent packing units, batch complexity, material handling, QC effort with causal evidence.
5. Standard-batch fallback: verified history > approved product standard > evidence-derived provisional batch+yield > fail-closed; each with source refs, rationale, version, effective date, confidence, approval status, reproducible calc; frequency separate from cost; schema + tests; Mehasamani etc. as examples.
6. Continue AU-2c, AU-5, AU-6 design without consumer changes.
