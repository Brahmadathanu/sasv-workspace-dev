# In-month effective dates and revaluation: design (CI-012, decided 19 Oct 2026)

**Decision (P38):** in-month effective dates apply going forward only, with no backdating and no proration.

## Rule
1. **Single as-of resolution.** A costing run resolves every effective-dated master (capacity profiles, fallback policy, ledger heads, DVS policy, overrides, events) once, on its frozen `valuation_date`, using the half-open window `[effective_from, effective_to)`.
   - There is no day-weighting inside a month. The G4 resolver already does this (`effective_from <= d < effective_to`, d = valuation date).
2. **No backdating.** A new row's `effective_from` must be at least the approval date (IST), and later than the `valuation_date` of every designated run (REFERENCE/APPROVED) in that period. So an approved run can never be re-resolved differently, and its frozen rows are also immutable (AU2 guards).
3. **Supersession.** Close the old row with `effective_to = new.effective_from`, then insert the new row. Overlap exclusion constraints already exist on the capacity tables.
   - The zero-length R1/R2 windows (from = to = 1 Nov) stay as immutable history. They are never effective, and the readiness views should report them as WITHDRAWN_BEFORE_EFFECT.
4. **In-month revaluation.**
   - A change effective on day D of an open period takes effect only in runs with valuation date D or later.
   - Earlier runs of that month keep their values. The register shows "superseded in month by <row>" for audit.
   - A locked period (Sep and Oct 2026 are LOCKED) cannot get a new run, so the earliest practical in-month change is in November 2026. The G4 tables also have CHECK effective_from >= 2026-11-01.
5. **Guard to build later (prepared, not yet written as SQL).** A BEFORE INSERT trigger on the effective-dated costing masters refuses an `effective_from` before today (IST), or at or before the max designated-run valuation date of that period. Test: isolated insert attempts, plus runs 122/128 unchanged.

**Approval needed:** none to design; the user approves each later live trigger install.
