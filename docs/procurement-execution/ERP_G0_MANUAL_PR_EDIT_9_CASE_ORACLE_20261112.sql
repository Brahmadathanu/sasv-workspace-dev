-- PEC G0: SELECT-only PR manual edit guard oracle (Nov 12, 2026).
-- Covers add-line requested quantity and manual delta's effect on final quantity.
-- No production records created or altered.
WITH fixture(case_id, method, internal_item, prior_requested, prior_delta,
             proposed_requested, proposed_delta, should_block) AS (
 VALUES
 ('add/new_internal_positive','add',true,0::numeric,0::numeric,4::numeric,0::numeric,true),
 ('add/increase_internal','add',true,5,0,8,0,true),
 ('add/decrease_internal','add',true,8,0,5,0,false),
 ('add/zero_internal','add',true,8,0,0,0,false),
 ('add/ordinary_rm','add',false,0,0,10,0,false),
 ('delta/increase_internal','delta',true,5,2,5,5,true),
 ('delta/reduce_internal','delta',true,5,2,5,-5,false),
 ('delta/unchanged_internal','delta',true,5,2,5,2,false),
 ('delta/ordinary_rm','delta',false,5,0,5,3,false)
), results AS (
 SELECT case_id,should_block,
 CASE WHEN method='add'
 THEN internal_item AND proposed_requested>prior_requested AND proposed_requested>0
 ELSE internal_item AND prior_requested+proposed_delta>prior_requested+prior_delta
 AND prior_requested+proposed_delta>0 END actual_block
 FROM fixture
)
SELECT case_id,should_block,actual_block,should_block=actual_block pass
FROM results ORDER BY case_id;
