# Independent Manufacturing Costing & Price Revision — Implementation Rules

## Hard boundaries
1. Work only in `docs/manufacturing-costing-price-revision/` for this programme's docs. **Never** modify `docs/master-data-costing/` programme ledger, WP statuses, change logs, governance files, or handovers as part of this programme.
2. Shared repository does not imply shared programme. This stream has its own MASTER_PROGRAMME, locked decisions and work-pack tracking. Cross-programme dependencies are separately logged, not executed by scope creep.
3. Server reality is established by live Supabase inspection; repository reality by live Git ref; programme governance by **this directory**. Prior-chat narrative supports but does not override live evidence.
4. ChatGPT directly owns server analysis, high-risk review, narrow application and live verification with connected Supabase tools. Server work does not need GitHub client PR to be applied, but needs explicit authorization for material high-risk changes. SQL/migrations, operation IDs, counts, fail-closed checks and rollback approach recorded here.
5. The historical costing refresh #119 and effective-dated source evidence remain immutable. Do not refresh live standard rates, alter Board 509-SKU sheet, backfill accounting data, edit production batch references or auto-approve classification in the name of sprint acceleration.
6. Preserve established architecture. Manufacturing cost allocated by **production output**, not sales. Preferred batch plus expected net output, route attendance, governed SKU conversion, and distinct packing package-unit driver. Never duplicate manufacturing product cost across multiple SKUs.
7. Actual FG transfers are movements; group distinct (product_id,batch_code) once, never one transfer=one batch; never divide over-max movement into fabricated batches. Only live WIP / positive FG Bulk / positive Bottled Stock views may screen **present stock**; old ledger history is not live presence. Provisional exclusion is not proof incomplete manufacture.
8. The user has nominal coding experience and minimal time. Run independent read-only checks in parallel where safe, avoid unnecessary reconfirmation, explain decisions plainly; never hide uncertain rates or inferred assumptions.
9. Client development, when necessary, uses bounded branch/worktree, autonomous tests/self-review, ChatGPT independent audit, explicit merge approval; no merge, version, release or publish without approval. No e-Aushadhi or other programme changes.
10. BMR prospective min/preferred/max governance is PARKED until costing/price revision is complete. Emergency batch outside min/max requires approved effective ref change before authorization; later changes cannot rewrite historical BMR authorizations.

## Gate and status discipline
- [ ] NOT STARTED, [~] ACTIVE, [x] VERIFIED, [!] BLOCKED, [P] PARKED.
- Every material gate ends with source evidence, counts/financial conservation, controls, status, exact next gate and a scoped git documentation update.
- Do not mark a provisional calculation approved. Keep `BLOCKED_CLASSIFICATION_APPROVAL` until actual approvals.
- Every substantive response includes: Workflow, WP progress, Programme progress, Current gate, Next, Parked, Locked.

## Documentation mutation
Update only this directory on an isolated documentation branch; preserve append-only verified decision history; record Git commit / live migration ID / exact verification / snapshot date. Don't silently edit canonical programme docs of others. Only merge after user approval.
