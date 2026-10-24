-- backfilled from live schema_migrations on 2026-10-24, CI-016
DO $fix$
DECLARE n integer;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM lab.spec_profile WHERE id=755 AND is_active AND effective_from=DATE '2026-10-22' AND spec_kind='BASE') THEN RAISE EXCEPTION 'Expected approved profile 755 absent'; END IF;
 IF (SELECT count(*) FROM lab.spec_profile_product_group_map WHERE spec_profile_id=454 AND product_group_id IN (37,41,45,100) AND is_active)<>4 THEN RAISE EXCEPTION 'Legacy active coverage mismatch'; END IF;
 UPDATE lab.spec_profile_product_group_map SET is_active=false,remarks=concat_ws(' | ',remarks,'Superseded by active approved profile 755; user-authorised restoration 2026-10-22'),updated_at=now()
 WHERE spec_profile_id=454 AND product_group_id IN (37,41,45,100) AND is_active;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>4 THEN RAISE EXCEPTION 'Expected four retired mappings, got %',n; END IF;
 INSERT INTO lab.spec_profile_product_group_map(spec_profile_id,product_group_id,is_active,remarks)
 SELECT 755,m.product_group_id,true,'Restored pre-existing family coverage omitted by approved spec change #1454; user authorised 2026-10-22; approved Taste reference retained'
 FROM lab.spec_profile_product_group_map m WHERE m.spec_profile_id=454 AND m.product_group_id IN (37,41,45,100)
 AND NOT EXISTS (SELECT 1 FROM lab.spec_profile_product_group_map x WHERE x.spec_profile_id=755 AND x.product_group_id=m.product_group_id);
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>4 THEN RAISE EXCEPTION 'Expected four new mappings, got %',n; END IF;
END $fix$;