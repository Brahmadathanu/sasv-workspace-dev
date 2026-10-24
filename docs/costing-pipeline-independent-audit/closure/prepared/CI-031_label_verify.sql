-- CI-031 read-only verification. Baseline values captured 24 Oct 2026 18:20 IST; all must be identical after apply.
select
 (select md5(string_agg(t::text,'|' order by t::text)) from costing.batch_true_absorption_variance t) as variance_md5,       -- e63de98377588d0e0a98237a16b5073e
 (select md5(string_agg(t::text,'|' order by t::text)) from costing.batch_true_standard_switch t) as switch_md5,              -- 1a03617a9d7bdb4d7f2b0ce5fbf8979b
 (select md5(string_agg(t::text,'|' order by t::text)) from costing.v_price_revision_current_approved_master t) as master_md5, -- 4bdb0ea3a58b8d8e9a8b7662d212e1b3
 (select md5(string_agg(md5(prosrc),',' order by proname)) from pg_proc where prosrc ilike '%normal_volume%') as fn_md5;      -- 85fbb00ba0c1d3ca97524b48739da0fd
-- Stored fingerprints (expected: 128 8cfee1f3d0b833e761ab4552ace3f6d7 / 136 f1d230236de5269d877b92ec84c62a6b / 140 0aa5595496501148d82a5f60a43b8080 / 143 3038578699c4b93a2d0c8096918dce2b)
select refresh_run_id, md5(string_agg(md5(fingerprint::text), ',' order by id)) from costing.costing_run_fingerprint
 where refresh_run_id in (128,136,140,143) group by 1 order by 1;
-- Comments present after apply (expected: 4 non-null)
select col_description('costing.batch_true_standard_switch'::regclass,(select attnum from pg_attribute where attrelid='costing.batch_true_standard_switch'::regclass and attname='rate_basis')) is not null,
       col_description('costing.batch_true_absorption_variance'::regclass,(select attnum from pg_attribute where attrelid='costing.batch_true_absorption_variance'::regclass and attname='rate_basis')) is not null,
       obj_description('costing.batch_true_absorption_variance'::regclass) is not null,
       (select obj_description(oid,'pg_constraint') from pg_constraint where conname='batch_true_standard_switch_rate_basis_check') is not null;
