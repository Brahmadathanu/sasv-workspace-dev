-- STEP 77 — CONSOLIDATED REVIEW CANDIDATE, NOT APPLIED
-- Replaces, does not accompany, incomplete Step74/75 drafts.
-- Requires privileged execution, migration parity, permission audit, staged tests.
-- This establishes validated definitions; it does NOT yet alter labour/POH functions.
CREATE TABLE costing.joint_process_policy (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 process_code text NOT NULL,
 effective_from date NOT NULL,
 effective_to date,
 reference_output_qty numeric(18,6) NOT NULL CHECK(reference_output_qty>0),
 output_uom text NOT NULL CHECK(output_uom='Kg'),
 allocation_method text NOT NULL CHECK(allocation_method='OUTPUT_MASS'),
 approval_reference text NOT NULL CHECK(btrim(approval_reference)<>''),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(effective_to IS NULL OR effective_to>effective_from),
 EXCLUDE USING gist (
  process_code WITH =,
  daterange(effective_from,coalesce(effective_to,'infinity'::date),'[)') WITH &&
 )
);
CREATE TABLE costing.joint_process_output (
 policy_id bigint NOT NULL REFERENCES costing.joint_process_policy(id) ON DELETE RESTRICT,
 product_id integer NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
 output_qty numeric(18,6) NOT NULL CHECK(output_qty>0),
 PRIMARY KEY(policy_id,product_id)
);
CREATE TABLE costing.joint_process_stage (
 policy_id bigint NOT NULL REFERENCES costing.joint_process_policy(id) ON DELETE RESTRICT,
 base_step_id bigint NOT NULL REFERENCES costing.production_route_family_route_step(id) ON DELETE RESTRICT,
 common_cycles numeric(18,6) NOT NULL CHECK(common_cycles>=0),
 continuation_cycles numeric(18,6) NOT NULL CHECK(continuation_cycles>=0),
 continuation_product_id integer NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
 PRIMARY KEY(policy_id,base_step_id)
);
CREATE TABLE costing.joint_process_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 policy_id bigint NOT NULL REFERENCES costing.joint_process_policy(id),
 operation text NOT NULL CHECK(operation IN ('CREATE','CLOSE')),
 old_effective_to date,
 new_effective_to date,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 actor uuid DEFAULT auth.uid()
);
CREATE FUNCTION costing.fn_joint_policy_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'costing','pg_temp' AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Joint policy deletion forbidden'; END IF;
 IF OLD.effective_to IS NOT NULL OR NEW.effective_to IS NULL OR
    (to_jsonb(NEW)-'effective_to') IS DISTINCT FROM
    (to_jsonb(OLD)-'effective_to') THEN
   RAISE EXCEPTION 'Only first effective_to closure permitted';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER joint_policy_guard BEFORE UPDATE OR DELETE
 ON costing.joint_process_policy FOR EACH ROW
 EXECUTE FUNCTION costing.fn_joint_policy_guard();
CREATE TRIGGER joint_policy_forward BEFORE INSERT OR UPDATE
 ON costing.joint_process_policy FOR EACH ROW
 EXECUTE FUNCTION costing.fn_guard_effective_date_forward();
-- MUST register costing.joint_process_policy as FORWARD_ONLY in
-- costing.effective_date_guard_config before use; exact config schema and
-- mandatory actor/approval authorization still to be verified.
CREATE FUNCTION costing.fn_joint_policy_audit() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'costing','pg_temp' AS $$
BEGIN
 INSERT INTO costing.joint_process_audit(policy_id,operation,old_effective_to,new_effective_to)
 VALUES (NEW.id,CASE WHEN TG_OP='INSERT' THEN 'CREATE' ELSE 'CLOSE' END,
         CASE WHEN TG_OP='UPDATE' THEN OLD.effective_to ELSE NULL END,
         NEW.effective_to);
 RETURN NEW;
END $$;
CREATE TRIGGER joint_policy_audit AFTER INSERT OR UPDATE
 ON costing.joint_process_policy FOR EACH ROW
 EXECUTE FUNCTION costing.fn_joint_policy_audit();
-- Child rows also require immutable UPDATE/DELETE/TRUNCATE guards.
-- Resolve only after transactional validation of output sums, route membership,
-- stage cycles and actor authorization. Deny direct writes to ordinary roles.
-- Do not deploy this partial bundle until those gates and the upstream workload
-- integration are complete; no joint policy has been inserted.
