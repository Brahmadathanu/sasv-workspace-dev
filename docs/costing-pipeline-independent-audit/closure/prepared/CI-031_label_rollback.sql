-- CI-031 rollback: restores the pre-change state (no comments existed).
begin;
comment on column costing.batch_true_standard_switch.rate_basis is null;
comment on column costing.batch_true_absorption_variance.rate_basis is null;
comment on table costing.batch_true_absorption_variance is null;
comment on constraint batch_true_standard_switch_rate_basis_check on costing.batch_true_standard_switch is null;
commit;
