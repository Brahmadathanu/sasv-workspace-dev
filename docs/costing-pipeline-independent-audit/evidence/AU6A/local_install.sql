\set ON_ERROR_STOP 1
\i /workspace/au4wt/docs/costing-pipeline-independent-audit/proposals/au6q_qc_batch_true/PREPARED_au6q_qc_batch_true.sql
\i /workspace/au6a/au6a_config.sql
\i /workspace/au6a/new_dl.sql
;
\i /workspace/au6a/new_poh.sql
;
insert into costing.route_batch_scaling_switch(id,is_enabled,scaling_mode,effective_from,approval_reference,changed_by,note)
values (true,false,'SYMMETRIC',date '2026-10-01','LOCAL-TEST','local','local test') on conflict (id) do nothing;
