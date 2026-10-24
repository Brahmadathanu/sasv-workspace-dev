-- backfilled from live schema_migrations on 2026-10-24, CI-016
DO $g0$
DECLARE v_id bigint;
BEGIN
 IF EXISTS (SELECT 1 FROM costing.joint_process_policy WHERE process_code='KSHEERABALA_AVARTHI_JOINT' AND effective_from=DATE '2026-10-22') THEN
   RAISE EXCEPTION '22 October joint policy version already exists';
 END IF;
 INSERT INTO costing.joint_process_policy(process_code,effective_from,effective_to,reference_output_qty,output_uom,allocation_method,approval_reference)
 SELECT process_code,DATE '2026-10-22',DATE '2026-10-23',reference_output_qty,output_uom,allocation_method,'USER_APPROVED_EFFECTIVE_20261022_ONE_DAY_VERSION_OF_POLICY_1'
 FROM costing.joint_process_policy WHERE id=1 AND effective_from=DATE '2026-10-23'
 RETURNING id INTO v_id;
 IF v_id IS NULL THEN RAISE EXCEPTION 'Approved source policy 1 not found'; END IF;
 INSERT INTO costing.joint_process_output(policy_id,product_id,output_qty)
 SELECT v_id,product_id,output_qty FROM costing.joint_process_output WHERE policy_id=1;
 INSERT INTO costing.joint_process_stage(policy_id,base_step_id,common_cycles,continuation_cycles,continuation_product_id)
 SELECT v_id,base_step_id,common_cycles,continuation_cycles,continuation_product_id
 FROM costing.joint_process_stage WHERE policy_id=1;
 IF (SELECT COUNT(*) FROM costing.joint_process_output WHERE policy_id=v_id)<>2
 OR (SELECT COUNT(*) FROM costing.joint_process_stage WHERE policy_id=v_id)<>4
 THEN RAISE EXCEPTION 'Incomplete joint process version'; END IF;
END $g0$;