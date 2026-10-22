-- STEP 74 — candidate migration SQL; NOT APPLIED to Supabase
-- DO NOT DEPLOY until effective-dating, audit, RLS/privileges, population and
-- workload integration are reviewed together. This creates empty structures only.
CREATE TABLE costing.joint_process_policy (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 process_code text NOT NULL,
 effective_from date NOT NULL,
 effective_to date,
 reference_output_qty numeric(18,6) NOT NULL CHECK (reference_output_qty>0),
 output_uom text NOT NULL,
 allocation_method text NOT NULL CHECK (allocation_method='OUTPUT_MASS'),
 approval_reference text NOT NULL CHECK (length(btrim(approval_reference))>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (effective_to IS NULL OR effective_to>effective_from)
);
CREATE TABLE costing.joint_process_output (
 policy_id bigint NOT NULL REFERENCES costing.joint_process_policy(id) ON DELETE RESTRICT,
 product_id integer NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
 output_qty numeric(18,6) NOT NULL CHECK (output_qty>0),
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
-- Mandatory before any active policy INSERT: no overlapping dated process_code,
-- forward-only journal/immutable approved rows, an atomic approval procedure
-- validating the output sum and route-stage correspondence, and restricted grants.
-- Do NOT use this SQL as a standalone production migration.
