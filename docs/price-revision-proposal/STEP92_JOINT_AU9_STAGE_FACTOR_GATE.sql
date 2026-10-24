-- STEP92: guarded comparison for an exact joint stage; NOT DEPLOYED.
-- This is a reusable scalar guard for the incoming full refresh integration.
-- Evaluate the AU9 resource/charge factor separately from both co-product
-- effective stage evidence, then refuse conflicting physical stage loads.
CREATE OR REPLACE FUNCTION costing.fn_joint_stage_equal_factor(
  p_left numeric,p_right numeric,p_stage_id bigint
) RETURNS numeric
LANGUAGE plpgsql IMMUTABLE STRICT SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF p_left <= 0 OR p_right <= 0 THEN
   RAISE EXCEPTION 'JOINT_STAGE_INVALID_FACTOR step=%',p_stage_id
   USING ERRCODE='22023';
 END IF;
 IF p_left IS DISTINCT FROM p_right THEN
   RAISE EXCEPTION 'JOINT_STAGE_AU9_FACTOR_CONFLICT step=%; common physical load must be resolved before allocation',p_stage_id
   USING ERRCODE='22023';
 END IF;
 RETURN p_left;
END $$;
REVOKE ALL ON FUNCTION costing.fn_joint_stage_equal_factor(numeric,numeric,bigint)
 FROM PUBLIC,anon,authenticated;
-- This is a STOP-GATE, not a substitute for approved common equipment capacity.
-- If products have different AU9 loads, do not average or select one arbitrarily.
-- Stage 1391 MANUAL cloth filtration must be reclassified only through an
-- approved stage-specific oil-filtration driver; 1392 hydraulic remains separate.
-- Zero deployment, no refresh replacement, no change to run136.
