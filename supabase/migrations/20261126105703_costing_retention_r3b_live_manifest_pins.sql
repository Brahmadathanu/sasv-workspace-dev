-- Candidate only: after R3B; installer blocked until invoker/deferred corrections reviewed.
BEGIN;
UPDATE costing_retention.read_guard_manifest m SET expected_md5=v.pin FROM (VALUES
 ('costing','fn_resolve_material_trace_selected_run','2ca2eca38312b9431e4e653579925532'),
 ('costing','fn_resolve_materials_stores_explain_selected_run','425f74643e302a88fd8dcfd3e30efff4'),
 ('costing','fn_resolve_qc_explain_selected_run','03656d6c3b7923a589b8281fb04f6458'),
 ('public','rpc_get_exact_run_cost_pool_reconciliation','a57dff64265d03df458c3b5a433147ed'),
 ('public','rpc_get_production_route_manager_exact_run_readiness','ba75f9b2dd096b07a7f6c509669dc04e'),
 ('public','rpc_get_production_route_manager_workload_detail','81afd2f7272ced078a4f7707158218a1'),
 ('public','rpc_get_production_route_manager_workload_preview','9fbf6b648a9ec1e29ae5f29a2643f836'),
 ('public','rpc_get_production_route_pipeline_status','99566d8db9fea676ad51d793b0b84732'),
 ('public','rpc_get_route_family_foundation_review','cbe121b2b95db95439601097d7d2b5e7'),
 ('public','rpc_get_route_family_mapping_review_candidates','fe599b1f7fed7585101d48b6f0310788'),
 ('public','rpc_get_route_workload_management_explain','89a85045ce51396d34e8531c46f530a8'),
 ('public','rpc_get_regional_marketing_evidence_review_queue','c10fa5f579e073962f314c9513003a09'),
 ('public','rpc_preview_direct_labour_shadow_monetary_reconciliation','1b3972e62af8c5248d4dec2d838ee472'),
 ('public','rpc_preview_direct_labour_shadow_workload','546d491f18a9ace07255378079bd06b0'),
 ('public','rpc_preview_production_overhead_workload','6b3c0864481fb4d696df30e4b7420260'),
 ('public','rpc_preview_shared_standard_batch_route_foundation','dee57ae9d5a423382342a622c3514ff6'),
 ('public','rpc_get_route_family_onboarding_status','2ad622b833ea5cc5b8bd835fd3de0a88'),
 ('public','rpc_get_product_sku_readiness','bd470e0ab649515a5afc74b2032c6ffe')
) v(schema_name,function_name,pin) WHERE m.schema_name=v.schema_name AND m.function_name=v.function_name;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM costing_retention.read_guard_manifest WHERE status='INSTALL' AND expected_md5 IS NULL) THEN RAISE EXCEPTION 'missing live pin'; END IF; END $$;
COMMIT;
