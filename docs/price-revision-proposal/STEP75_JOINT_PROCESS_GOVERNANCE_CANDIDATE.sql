-- G0 STEP 75: GOVERNANCE CANDIDATE — REVIEW ONLY / NOT DEPLOYED
-- Assumes STEP74 empty schema and extension btree_gist already present (verified).
-- Never apply without source migration parity and preflight of frozen cutoff.
-- Policy rows may be inserted only using an independently verified atomic approval path.
ALTER TABLE costing.joint_process_policy
 ADD CONSTRAINT joint_process_policy_no_overlap
 EXCLUDE USING gist (
   process_code WITH =,
   daterange(effective_from,coalesce(effective_to,'infinity'::date),'[)') WITH &&
 );
-- Generic policy freeze: existing rows are not silently rewritten/deleted.
-- An approved closure path will need audit and forward-only guards;
-- this trigger alone intentionally prevents every mutation.
CREATE OR REPLACE FUNCTION costing.fn_joint_process_block_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'costing','pg_temp' AS $$
BEGIN
 RAISE EXCEPTION 'Joint process governance records are append-only: %',TG_TABLE_NAME;
END $$;
CREATE TRIGGER joint_policy_immutable BEFORE UPDATE OR DELETE ON costing.joint_process_policy
 FOR EACH ROW EXECUTE FUNCTION costing.fn_joint_process_block_mutation();
CREATE TRIGGER joint_output_immutable BEFORE UPDATE OR DELETE ON costing.joint_process_output
 FOR EACH ROW EXECUTE FUNCTION costing.fn_joint_process_block_mutation();
CREATE TRIGGER joint_stage_immutable BEFORE UPDATE OR DELETE ON costing.joint_process_stage
 FOR EACH ROW EXECUTE FUNCTION costing.fn_joint_process_block_mutation();
-- Prospective date and approval validation must occur before any policy INSERT.
-- A policy activation procedure must transactionally validate all outputs/stages,
-- the sum of output quantities, route lineage, and an authorised approver.
-- Freeze trigger needs a carefully audited closing/versioning exception BEFORE
-- policy revisions can be accepted; presently this is a deliberately conservative
-- design candidate, not an executable end-to-end business process.
-- No grants to anon/authenticated; inspect costing schema exposure/RLS.
