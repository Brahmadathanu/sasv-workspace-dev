-- G2 REVIEW ONLY. NOT A MIGRATION. DO NOT EXECUTE IN PRODUCTION.
-- Proposed one-function safety correction, retaining APPROVED-only prospective behaviour.
-- Verify existing owner, grants, SECURITY DEFINER / search_path and all pg_get_functiondef
-- properties before promoting to migration: CREATE OR REPLACE can otherwise lose metadata.
-- No historical SUPERSEDED/ARCHIVED expansion is authorised by this patch.
CREATE OR REPLACE FUNCTION costing.fn_resolve_effective_route_family_route(
 p_product_id integer, p_as_of_date date DEFAULT CURRENT_DATE
) RETURNS bigint LANGUAGE plpgsql STABLE
AS $function$
DECLARE
 v_date date := coalesce(p_as_of_date,current_date);
 v_family bigint;
 v_count integer;
 v_id bigint;
BEGIN
 v_family := costing.fn_resolve_route_family_for_product(p_product_id,v_date);
 IF v_family IS NULL THEN RETURN NULL; END IF;
 SELECT count(*),min(r.id) INTO v_count,v_id
 FROM costing.production_route_family_route r
 WHERE r.route_family_id=v_family
 AND r.archived_at IS NULL AND r.status='APPROVED'
 AND r.effective_from<=v_date
 AND (r.effective_to IS NULL OR r.effective_to>=v_date);
 IF v_count>1 THEN
   RAISE EXCEPTION 'AMBIGUOUS_APPROVED_FAMILY_ROUTE for product % as of %',p_product_id,v_date;
 END IF;
 RETURN v_id;
END;
$function$;

-- Separate SELECT-only audit probes (safe to adapt and run against live).
-- Expected family32 on Aug24: two cross-status candidates; prospective APPROVED-only: one.
SELECT id,status,effective_from,effective_to
FROM costing.production_route_family_route
WHERE route_family_id=32 AND archived_at IS NULL
  AND status IN ('APPROVED','SUPERSEDED')
  AND effective_from<='2026-08-24'
  AND (effective_to IS NULL OR effective_to>='2026-08-24')
ORDER BY id;

-- This SQL does NOT solve historical back-valuation or archive eligibility.
-- Retrospective calculation requires separately governed policy and source-level
-- regression over historical dependents. Frozen snapshots must be read by stored IDs.
