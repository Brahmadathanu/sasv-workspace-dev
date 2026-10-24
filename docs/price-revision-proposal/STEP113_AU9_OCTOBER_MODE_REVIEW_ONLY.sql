-- REVIEW ONLY, NOT DEPLOYED. Switch table is EMPTY.
CREATE OR REPLACE FUNCTION costing.fn_au9_g4_load_mode(p_valuation_date date)
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'costing', 'pg_temp'
AS $function$
  select s.id from costing.plant_aware_load_switch s
   where s.is_enabled and p_valuation_date >= date '2026-10-23'
     and s.effective_from <= p_valuation_date and (s.effective_to is null or s.effective_to > p_valuation_date)
$function$
;
