-- backfilled from live schema_migrations on 2026-10-24, CI-016
DO $fix$
DECLARE src text; anchor text; patch text;
BEGIN
 SELECT replace(pg_get_functiondef('lab.fn_review_spec_change_request_decision(uuid,bigint,text,text,text,text)'::regprocedure), E'\r\n', E'\n') INTO src;
 anchor:=E'    update lab.spec_profile\n    set\n      is_active = false,';
 patch:=$p$
    -- Keep active product-group coverage when a family FG spec version is approved.
    -- The group setter remaps the selected family; migrate every other active
    -- mapping attached to the source profile before retiring that profile.
    if v_req.subject_type = 'FG' then
      with remaining as (
        select m.product_group_id
        from lab.spec_profile_product_group_map m
        where m.spec_profile_id = v_old_spec_profile_id
          and m.is_active = true
          and not exists (
            select 1 from lab.spec_profile_product_group_map dest
            where dest.spec_profile_id = v_new_spec_profile_id
              and dest.product_group_id = m.product_group_id and dest.is_active)
      ), retired as (
        update lab.spec_profile_product_group_map m
        set is_active = false, updated_at = now()
        where m.spec_profile_id = v_old_spec_profile_id and m.is_active = true
          and m.product_group_id in (select product_group_id from remaining)
        returning m.product_group_id
      )
      insert into lab.spec_profile_product_group_map
        (spec_profile_id, product_group_id, is_active, remarks)
      select v_new_spec_profile_id, r.product_group_id, true,
        'Retained active coverage from source FG profile ' || v_old_spec_profile_id::text ||
        ' during approved specification versioning'
      from retired r;
    end if;

$p$;
 IF position(anchor in src)=0 THEN RAISE EXCEPTION 'Unexpected versioning function pattern'; END IF;
 IF position(anchor in substring(src from position(anchor in src)+1))>0 THEN RAISE EXCEPTION 'Ambiguous patch anchor'; END IF;
 src:=replace(src,anchor,patch||anchor);
 EXECUTE src;
END $fix$;