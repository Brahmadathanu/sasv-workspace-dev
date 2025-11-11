-- Supabase RPC: fn_bulk_upsert_item_class_map
-- Fixes ambiguous column references by qualifying all identifiers.
-- This script also drops any overloaded variant to avoid ambiguity.
-- Apply in your DB (run the whole script in SQL editor).

-- Optional: drop any overloaded variants so only a single canonical signature remains
DO $$
DECLARE
  sig text;
BEGIN
  FOR sig IN
    SELECT p.oid::regprocedure::text
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'fn_bulk_upsert_item_class_map'
      AND pg_get_function_identity_arguments(p.oid) <> 'jsonb, boolean'
  LOOP
    EXECUTE format('DROP FUNCTION %s', sig);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.fn_bulk_upsert_item_class_map(
  p_rows jsonb,
  p_dry_run boolean DEFAULT false
)
RETURNS TABLE (
  out_stock_item_id integer,
  action text,
  ok boolean,
  changed boolean,
  before jsonb,
  after jsonb,
  message text
)
LANGUAGE plpgsql
AS $$
DECLARE
  r RECORD;
  v_before inv_stock_item_class_map%ROWTYPE;
  v_after  inv_stock_item_class_map%ROWTYPE;
  err_state text;
  err_msg   text;
  err_detail text;
  err_hint  text;
BEGIN
  FOR r IN
    SELECT *
    FROM jsonb_to_recordset(p_rows) AS x(
      stock_item_id integer,
      category_id integer,
      subcategory_id integer,
      group_id integer,
      subgroup_id integer,
      clear boolean
    )
  LOOP
    BEGIN
      -- Snapshot before
      SELECT * INTO v_before
      FROM inv_stock_item_class_map m
      WHERE m.stock_item_id = r.stock_item_id;

      IF COALESCE(r.clear, false) IS TRUE THEN
        -- Clear mapping
        IF p_dry_run THEN
          RETURN QUERY SELECT r.stock_item_id, 'would_clear', true,
            (v_before IS NOT NULL), to_jsonb(v_before), NULL::jsonb, NULL::text;
        ELSE
          DELETE FROM inv_stock_item_class_map m
          WHERE m.stock_item_id = r.stock_item_id;
          RETURN QUERY SELECT r.stock_item_id, 'cleared', true,
            true, to_jsonb(v_before), NULL::jsonb, NULL::text;
        END IF;
      ELSE
        -- Upsert mapping
        IF p_dry_run THEN
          v_after := v_before;
          IF v_after.stock_item_id IS NULL THEN
            v_after.stock_item_id := r.stock_item_id;
          END IF;
          v_after.category_id := r.category_id;
          v_after.subcategory_id := r.subcategory_id;
          v_after.group_id := r.group_id;
          v_after.subgroup_id := r.subgroup_id;

          RETURN QUERY SELECT r.stock_item_id,
            CASE WHEN v_before.stock_item_id IS NULL THEN 'would_insert' ELSE 'would_update' END,
            true,
            (to_jsonb(v_before) IS DISTINCT FROM to_jsonb(v_after)),
            to_jsonb(v_before),
            to_jsonb(v_after),
            NULL::text;
        ELSE
          INSERT INTO inv_stock_item_class_map AS m
            (stock_item_id, category_id, subcategory_id, group_id, subgroup_id)
          VALUES
            (r.stock_item_id, r.category_id, r.subcategory_id, r.group_id, r.subgroup_id)
          ON CONFLICT (stock_item_id)
          DO UPDATE SET
            category_id   = EXCLUDED.category_id,
            subcategory_id= EXCLUDED.subcategory_id,
            group_id      = EXCLUDED.group_id,
            subgroup_id   = EXCLUDED.subgroup_id;

          SELECT * INTO v_after
          FROM inv_stock_item_class_map m2
          WHERE m2.stock_item_id = r.stock_item_id;

          RETURN QUERY SELECT r.stock_item_id,
            CASE WHEN v_before.stock_item_id IS NULL THEN 'inserted' ELSE 'updated' END,
            true,
            (to_jsonb(v_before) IS DISTINCT FROM to_jsonb(v_after)),
            to_jsonb(v_before),
            to_jsonb(v_after),
            NULL::text;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS err_state = RETURNED_SQLSTATE,
                               err_msg   = MESSAGE_TEXT,
                               err_detail= PG_EXCEPTION_DETAIL,
                               err_hint  = PG_EXCEPTION_HINT;
      RETURN QUERY SELECT r.stock_item_id, 'error', false, false,
        to_jsonb(v_before), NULL::jsonb,
        coalesce(err_msg,'') || coalesce(' | detail: '||err_detail,'') || coalesce(' | hint: '||err_hint,'');
    END;
  END LOOP;
END;
$$;
