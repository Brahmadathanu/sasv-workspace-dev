-- PEC G0: fix strict MRP conversion helper under authenticated RLS.
-- The helper reads ONLY governed unit/dimension metadata. The base table
-- public.inv_uom_conversion remains inaccessible to authenticated and anon.
-- Do not broaden grants to inv_uom_conversion or inv_uom.
-- This migration follows 20261112114000, which defines the helper.
BEGIN;
ALTER FUNCTION public.mrp_uom_factor_strict(bigint,bigint) SECURITY DEFINER;
ALTER FUNCTION public.mrp_uom_factor_strict(bigint,bigint)
  SET search_path TO pg_catalog, public;
REVOKE ALL ON FUNCTION public.mrp_uom_factor_strict(bigint,bigint)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mrp_uom_factor_strict(bigint,bigint)
  TO authenticated, service_role;
COMMIT;
