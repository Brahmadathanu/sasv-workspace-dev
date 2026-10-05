# WP04 G7 Recovery Architecture Review

2026-10-05. **INDEPENDENT REVIEW PASS — NO IMPLEMENTATION AUTHORIZED.**

## Evidence reviewed

- G4 controlled performance history;
- G7 native timeout log and PostgREST context;
- native role statement_timeout configuration;
- two subsequent successful signed-in requests;
- pg_stat_statements native timing range;
- current portfolio/live-core/commercial/route source;
- accepted G5/G6 client source;
- live successful and failed Readiness screenshots.

## Findings

1. **Performance disposition must remain reopened.**
   The real authenticated API ceiling is 8s, while the synchronous portfolio path commonly consumes ~5.5–7.1s and has now exceeded the ceiling. Historical 15s controlled tests did not establish native reliability.

2. **The failure is architectural variance, not a deterministic broken function.**
   Successful reloads prove the same contract can complete. The failure stack inside commercial resolution proves a repeated per-SKU material path, while full-population assessment/statistics make every page request expensive.

3. **Timeout increase is not an acceptable recovery.**

4. **Pure relational cleanup or page/statistics splitting alone is not sufficiently evidenced.**
   Global readiness filters/statistics still require full canonical population knowledge.

5. **Governed precomputed canonical readiness index is the preferred architecture**, subject to a strict source-fingerprint/freshness contract.
   It preserves canonical composition, avoids changing CSE-P01 authority and moves 611-SKU evaluation outside interactive PostgREST latency.

6. **No production apply may occur until freshness semantics and exact rollback are independently frozen and full parity is proven.**

7. **UI acceptance is legitimately reopened.**
   Successful live screenshot proves the server payload but also demonstrates snapshot/live-context competition and poor permanent filter/gap/register hierarchy.

8. **Track B proposal is bounded to the Readiness lens and shell visibility behavior.**
   It does not authorize Manage Products or general shell redesign.

## Review disposition

**PASS — recovery architecture package is internally coherent and sufficiently bounded for the next planning/implementation gates.**

Current gate:
- G7 BLOCKED.
- Track A: architecture accepted for concrete package/prototype planning only; no production authorization.
- Track B: UX recovery scope accepted for a bounded client implementation package only after user acceptance of this recovery gate.
- G8 closed.
