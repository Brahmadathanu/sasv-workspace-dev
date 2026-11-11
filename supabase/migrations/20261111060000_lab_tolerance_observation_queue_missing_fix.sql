-- Lab queue completeness: evaluated multi-observation tolerance results are not missing.
-- Preserve the existing view's columns, ownership and grants through CREATE OR REPLACE.
create or replace view lab.v_analysis_pending_scrutiny as
select
  ar.id as analysis_id,
  ar.analysis_register_no,
  ar.analysis_subject_type,
  ar.stream_code,
  ar.status,
  ar.analysis_mode,
  ar.has_outsourced_tests,
  ar.sample_received_date,
  ar.batch_no_snapshot,
  ar.system_lot_no,
  count(r.id) as total_test_count,
  count(*) filter (
    where
      (
        r.result_kind_snapshot = 'NUMERIC'
        and r.result_numeric is null
        and not (
          r.spec_type_snapshot = 'TOLERANCE'
          and r.compliance_status in ('PASS','FAIL')
          and nullif(btrim(r.result_text), '') is not null
          and exists (
            select 1
            from lab.analysis_result_observation o
            where o.analysis_result_id = r.id
              and o.is_excluded is not true
          )
        )
      )
      or (
        r.result_kind_snapshot in ('TEXT','PASS_FAIL')
        and (r.result_text is null or btrim(r.result_text) = '')
      )
  ) as missing_result_count,
  count(*) filter (where r.compliance_status = 'FAIL') as fail_count,
  count(*) filter (where r.result_source_type = 'OUTSOURCED') as outsourced_test_count
from lab.analysis_record ar
join lab.analysis_result r on r.analysis_id = ar.id
group by ar.id, ar.analysis_register_no, ar.analysis_subject_type, ar.stream_code,
  ar.status, ar.analysis_mode, ar.has_outsourced_tests, ar.sample_received_date,
  ar.batch_no_snapshot, ar.system_lot_no
order by ar.id;

-- Regression assertions (read-only): example, evaluated peers, incomplete tolerance.
do $$
declare
  v_missing bigint;
  v_bad bigint;
begin
  select missing_result_count into v_missing
  from lab.v_analysis_pending_scrutiny where analysis_id = 442;
  if v_missing is distinct from 0 then
    raise exception 'Lab queue regression: analysis 442 expected 0 missing, got %', v_missing;
  end if;
  select count(*) into v_bad
  from lab.analysis_result r
  join lab.v_analysis_pending_scrutiny q on q.analysis_id = r.analysis_id
  where r.spec_type_snapshot = 'TOLERANCE'
    and r.compliance_status = 'PASS'
    and r.result_numeric is null
    and nullif(btrim(r.result_text),'') is not null
    and exists (
      select 1 from lab.analysis_result_observation o
      where o.analysis_result_id = r.id and o.is_excluded is not true
    )
    and q.missing_result_count > 0
    and not exists (
      select 1 from lab.analysis_result other
      where other.analysis_id = r.analysis_id and other.id <> r.id
        and (
          (other.result_kind_snapshot = 'NUMERIC' and other.result_numeric is null
            and not (other.spec_type_snapshot='TOLERANCE'
              and other.compliance_status in ('PASS','FAIL')
              and nullif(btrim(other.result_text),'') is not null
              and exists (select 1 from lab.analysis_result_observation ob
                where ob.analysis_result_id=other.id and ob.is_excluded is not true)))
          or (other.result_kind_snapshot in ('TEXT','PASS_FAIL')
              and nullif(btrim(other.result_text),'') is null)
        )
    );
  if v_bad <> 0 then
    raise exception 'Lab queue regression: % evaluated tolerance-only analyses still missing', v_bad;
  end if;
end $$;
