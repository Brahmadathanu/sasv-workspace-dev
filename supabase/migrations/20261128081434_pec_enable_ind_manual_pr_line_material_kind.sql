ALTER TABLE public.proc_pr_line
  DROP CONSTRAINT proc_pr_line_material_kind_check,
  ADD CONSTRAINT proc_pr_line_material_kind_check
    CHECK (material_kind IN ('raw_material', 'packaging_material', 'indirect_material'));

CREATE OR REPLACE FUNCTION public.proc_material_kind_for_class(p_material_class_id bigint)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'pg_catalog', 'public', 'public', 'pg_temp'
AS $function$
BEGIN
  IF p_material_class_id = 1 THEN RETURN 'raw_material';
  ELSIF p_material_class_id = 2 THEN RETURN 'packaging_material';
  ELSIF p_material_class_id = 5 THEN RETURN 'indirect_material';
  ELSE RAISE EXCEPTION 'Unknown material_class_id: %', p_material_class_id;
  END IF;
END;
$function$;
