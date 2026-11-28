import { createHash } from "node:crypto";
// PEC protected path policy. Check only the delta introduced by the current PR.
// The integration candidate deliberately carries these reviewed server migrations
// and the PWA cache file. Its descendant client-only PRs may not add any more.
export const INTEGRATION_PROTECTED_PATHS = new Set([
  "public/sw.js",
  "supabase/migrations/20261112110000_pec_four_gram_material_bom_normalization.sql",
  "supabase/migrations/20261112114000_pec_uom_and_internal_pr_guard.sql",
  "supabase/migrations/20261112122500_pec_revision_and_manual_indent_internal_guard.sql",
  "supabase/migrations/20261112133000_pec_manual_pr_internal_item_guards.sql",
  "supabase/migrations/20261112143000_pec_safe_resync_preserve_manual_lines.sql",
  "supabase/migrations/20261112150000_pec_mrp_uom_factor_auth_rbac.sql",
  "supabase/migrations/20261112152000_pec_mrp_rollup_use_strict_factor.sql",
  "supabase/migrations/20261112170000_pec_g1_five_paged_read_contracts.sql",
  "supabase/migrations/20261112173000_pec_g1_filtered_paged_read_contracts.sql",
  "supabase/migrations/20261112174500_pec_g1_vendor_operational_paging.sql",
  // PR #374 Add Line guard: carried by the integration candidate once #374 lands (staging -> main).
  "supabase/migrations/20261112220000_pec_r2_add_line_new_row_status_guard.sql",
]);

// Reviewed SERVER-lane migrations that may be *committed* on one named server
// branch without becoming a general SQL exemption. Each entry is pinned to
// (a) the exact path, (b) the exact head branch(es) and (c) the SHA-256 of the
// LF-normalised file content, so any edit, rename, other branch or other
// migration is still rejected. Working-tree (uncommitted) changes are NEVER
// exempt: callers pass a context only for committed paths.
export const REVIEWED_SERVER_MIGRATIONS = Object.freeze({
  // PEC PR #554: owner-requested production fixes registered 28 Nov 2026.
  // Exact migration ledger content, dedicated branch only; never replay in production.
  "supabase/migrations/20261128081434_pec_enable_ind_manual_pr_line_material_kind.sql": Object.freeze({
    sha256: "003a12c90dd3304f10bcd2138a1938213970431dd655799e15b7127251575849",
    heads: Object.freeze(["fix/pec-pr-class-scope-20261128"]),
  }),
  "supabase/migrations/20261128082037_pec_enforce_pr_header_class_and_rm_only_scope.sql": Object.freeze({
    sha256: "1f082f63f8b056598dd4db48ed263d0dff8679b08b45e6b34f805340e68e06da",
    heads: Object.freeze(["fix/pec-pr-class-scope-20261128"]),
  }),
  // R8 intermediate release: exact owner-approved production registrations; never replay.
  "supabase/migrations/20261127144051_ei_r8_finance_ageing.sql": Object.freeze({
    sha256: "00586d9900870b91662e65c8122bf486a67a0822e7fc01b575cc41ecbf38868f",
    heads: Object.freeze(["fix/executive-intelligence-r8-shell"]),
  }),
  "supabase/migrations/20261127154330_ei_guarded_summary_refresh.sql": Object.freeze({
    sha256: "ecf90871aaa3c15e06548525092f290193fe398b3f03dfb10250b5f442dcf427",
    heads: Object.freeze(["fix/executive-intelligence-r8-shell"]),
  }),
  // PEC S5 unified planning: owner-authorized live migration version 20261122191542.
  // Exact GitHub source on the named S5 server branch only, LF-SHA256 pinned.
  "supabase/migrations/20261122191542_pec_s5_unified_planning_ind_source_and_pr_reason.sql": Object.freeze({
    sha256: "c1661a3bf194ddd6b2afef54eb88753ad81f9576adb3309627e7cf7356a88486",
    heads: Object.freeze(["feat/pec-s5-unified-server-20261123"]),
  }),
  // Issue #502 production JIT timeout fix, registered 20261122174517.
  // Only this exact reviewed SQL blob on its dedicated repair branch is permitted.
  "supabase/migrations/20261122174517_pec_jit_plan_indent_balance_once_timeout_fix.sql": Object.freeze({
    sha256: "b08d13d590f20b64539b2c23fa156e4d872753d7d3bb02b8c4f20ab95cf193ae",
    heads: Object.freeze(["fix/pec-jit-plan-timeout-20261122"]),
  }),
  // Issue #502: additive JIT MRP route (two new functions; no existing function replaced). Exact path + head
  // branch + LF SHA-256. Installation in production is a separate owner-approved step.
  "supabase/migrations/20261122163830_pec_jit_mrp_route_plan_and_generator.sql": Object.freeze({
    sha256: "1fe2ead139e093c98af2cd17b936066972d788a902908b09ffa2114b2dc5ffd1",
    heads: Object.freeze(["feat/pec-jit-route-server-20261122"]),
  }),
  "supabase/migrations/20261122084655_pec_s4_duplicate_pr_horizon_guard.sql": Object.freeze({
    sha256: "0c29d28eb377b770d112fa69c14da7ca30265bf2d7859d64fbcd5cabe4832685",
    heads: Object.freeze(["feat/pec-s4-end-to-end-20261122"]),
  }),
  "supabase/migrations/20261122084452_pec_s4_duplicate_uom_candidate_guard.sql": Object.freeze({
    sha256: "bed758b746cfdfe675d85d9205f8c70d89269caf33c9e232eb6561fb34331eca",
    heads: Object.freeze(["feat/pec-s4-end-to-end-20261122"]),
  }),
  "supabase/migrations/20261122083956_pec_s4_retire_old_ccf_writer.sql": Object.freeze({
    sha256: "a19f196fb1230f92563779b223cc509214f704f2b22a0c999e903b100c891f33",
    heads: Object.freeze(["feat/pec-s4-end-to-end-20261122"]),
  }),
  "supabase/migrations/20261122083237_pec_s4_legacy_electron_compatibility.sql": Object.freeze({
    sha256: "5aede676c2442410eedfa20ee4f9307f6aebd84f8bfd86223db544f36013ce2e",
    heads: Object.freeze(["feat/pec-s4-end-to-end-20261122"]),
  }),
  // S4 end-to-end: three exact new *registered production* migration blobs.
  // No blanket exemption: head branch and content SHA-256 must both match.
  "supabase/migrations/20261122082353_pec_s4_new_pr_hybrid_plan.sql": Object.freeze({
    sha256: "2ef75c2953eea7e6d79b096c549f834acb15b71cae277ff8b2385ab3bea3301b",
    heads: Object.freeze(["feat/pec-s4-end-to-end-20261122"]),
  }),
  "supabase/migrations/20261122082532_pec_s4_hybrid_generator_evidence.sql": Object.freeze({
    sha256: "7296a87c0e603c0c9919dcc95ef7a6e690380676c6c552e97b1964eee8f98d70",
    heads: Object.freeze(["feat/pec-s4-end-to-end-20261122"]),
  }),
  "supabase/migrations/20261122082653_pec_s4_reconcile_existing_draft.sql": Object.freeze({
    sha256: "dea0c1e12ff1aa909997a0eaf9bfcbdd6f84b3c70e66d8dd5a635f7c3fa59b51",
    heads: Object.freeze(["feat/pec-s4-end-to-end-20261122"]),
  }),
  // S4 emergency CCF: two additive server migrations already registered live on
  // 22 Nov 2026; exact file/branch/LF-SHA256 only. No blanket procurement SQL
  // exemption. One is View-only preview; the other is a draft-only guarded
  // single-line edit requiring explicit operator confirmation and an audit reason.
  "supabase/migrations/20261122075009_pec_s4_ccf_pr_preview_readonly.sql": Object.freeze({
    sha256: "2aeee1b1c4e1749d59aef3b4f8ec29e16c315f5e9babb7c8853cea58d8c58823",
    heads: Object.freeze(["feat/pec-s4-ccf-preview-20261122"]),
  }),
  "supabase/migrations/20261122075447_pec_s4_ccf_apply_draft_line_guarded.sql": Object.freeze({
    sha256: "818a672522542a12d651847b3af34ca58457dd299ce43d681214df9811134f5a",
    heads: Object.freeze(["feat/pec-s4-ccf-preview-20261122"]),
  }),
  "supabase/migrations/20261116022440_wp10_g2_01_clock_and_batch_size_contract.sql": Object.freeze({
    sha256: "0077b90fffbf9bd9c770ab55b85e81e8110d1c6c0a8a17135ba71bee4620dab3",
    heads: Object.freeze(["server/wp10-g2-read-only-phase1"]),
  }),
  "supabase/migrations/20261116022501_wp10_g2_02_essential_states_and_boundaries.sql": Object.freeze({
    sha256: "ef4cd91f693c220a614db3f7640afb301126b47626cde93e792b393b27c74b31",
    heads: Object.freeze(["server/wp10-g2-read-only-phase1"]),
  }),
  "supabase/migrations/20261116022517_wp10_g2_03_operational_expiry_horizon_rpc.sql": Object.freeze({
    sha256: "dea309c07d0ff6726b04d9ed4d56e190c6d2afda9628a06996df133e7dfb0ce5",
    heads: Object.freeze(["server/wp10-g2-read-only-phase1"]),
  }),
  "supabase/migrations/20261116022528_wp10_g2_06_subgroup_impact_preview.sql": Object.freeze({
    sha256: "abb291fe26bce9ac2618eca5325b4cb82392a262d895585e87b9746cc8f9217f",
    heads: Object.freeze(["server/wp10-g2-read-only-phase1"]),
  }),
  // PR #374 Add Line new-row status guard (owner-reviewed; wrapper already installed live).
  "supabase/migrations/20261112220000_pec_r2_add_line_new_row_status_guard.sql": Object.freeze({
    sha256: "f9441b67451f0d012e77c576beec347a99c491b57f0b11eeda755a5a50eeee03",
    heads: Object.freeze([
      "server/pec-r2-indent-addline-status-guard-20261112",
      "claude/pec-r13-addline-374-integration-20261114",
    ]),
  }),
  // Reviewed sync of main (0a3eeb71) into the staging branch (owner decision 14 Nov 2026, option 1): the ONE exception for
  // public/sw.js. Pinned to the exact merged file (union of the PEC console and WP08 G2-0 network-first rules,
  // CACHE_NAME hub-cache-v393) and to the sync branch only. Any other content, any other branch, any other protected
  // file stays rejected. (This map also pins SQL migrations; the key is simply the protected path.)
  "public/sw.js": Object.freeze({
    sha256: "86245dbd72611d9593cfc06a782364052a190638575aede1ba46dc4929437239",
    heads: Object.freeze(["claude/pec-staging-main-sync-20261114"]),
  }),
  // R10 forward-only migrations: source-integrated but NOT applied to production.
  // Pins cover the exact reviewed SQL blobs only; any mutation must fail.
  "supabase/migrations/20261113170715_pec_safe_resync_collision_guard_lock_order.sql": Object.freeze({
    sha256: "43b51cd98dc37635bc7c2ccfb9b76df1fcc89062e38e1886b754e3f8d19a624b",
    heads: Object.freeze(["integration/pec-erp-staging-20261112"]),
  }),
  "supabase/migrations/20261113172424_pec_safe_resync_collision_preview_ro.sql": Object.freeze({
    sha256: "7c379d30f32ebb7f1f8db6c82c8cbbe897e0cfcb05ed8273cf688ae4ad24925d",
    heads: Object.freeze(["integration/pec-erp-staging-20261112"]),
  }),
  "supabase/migrations/20261114013211_pec_indent_set_source_pr_lock_prelude.sql": Object.freeze({
    sha256: "420f64a00ee544f29cbc64a33b1c47c6c0c74184a8574cb06b3d4aa450243961",
    heads: Object.freeze(["integration/pec-erp-staging-20261112"]),
  }),
  // R-2 approval-race correction (#412): applied to production 14 Nov 2026 under explicit owner approval
  // (history version registered). Pinned to the exact file; its own branch and, for integration, the staging branch only.
  "supabase/migrations/20261114135500_pec_indent_set_status_header_lock.sql": Object.freeze({
    sha256: "1dd812008e520db3a1c1ee2a3f62fe56f76350b23de417423831e6ce67d14823",
    heads: Object.freeze(["claude/pec-r2-approval-race-fix-20261114", "integration/pec-erp-staging-20261112"]),
  }),
  // #400 authenticated-DML correction: PROPOSED, NOT applied to production, needs separate owner approval.
  "supabase/migrations/20261114160000_pec_revoke_authenticated_dml_policy_link_tables.sql": Object.freeze({
    sha256: "068710bf9eafe6745bf214c95ed2e0315dc1819757d23bfb53a4392037080f20",
    heads: Object.freeze(["claude/pec-400-dml-hardening-20261114", "integration/pec-erp-staging-20261112"]),
  }),
});

// Reviewed WP08 G2-1 service-worker change (Issue #425 / PR #427, owner-authorised): it adds only network-first patterns for the
// resolver, destination-access, selection and control-center modules. Same contract as the pins above (exact path + exact
// head branch + SHA-256 of the LF-normalised content): any other content, branch or protected file stays rejected, and
// working-tree changes are never exempt. Kept separate so the existing public/sw.js sync pin is unchanged.
export const REVIEWED_WP08_G2_1_PINS = Object.freeze({
  "public/sw.js": Object.freeze({
    sha256: "e3c55e7af7acfa27114f9f1112fc9036fc94df9a42ac2c11fef6ac66035c4d43",
    heads: Object.freeze(["claude/blissful-thompson-lv1ekb"]),
  }),
});

// WP09 #437: exact owner-reviewed additive network-first change; no PEC application change.
export const REVIEWED_WP09_G2_PINS = Object.freeze({
  "public/sw.js": Object.freeze({
    sha256: "a1b35dc2bf7bd9bd9f166f356b3d4cabed9340401e09a5d74da7480d269066b9",
    heads: Object.freeze(["claude/wp09-g2-launcher-families"]),
  }),
});

// WP11 PM BOM responsive fix (PR #467): the ONLY change to public/sw.js is the hub-cache-v393 -> hub-cache-v394 line (CSS delivery needs a
// cache-generation advance; owner-approved). Exact path + exact head branch + SHA-256 of the LF-normalised file. Any other content, branch,
// protected path or SQL migration stays rejected; the global protected-path policy is unchanged.
export const REVIEWED_WP11_V394_PINS = Object.freeze({
  "public/sw.js": Object.freeze({
    sha256: "aa4620ff6a068c172827362ba7c54c43d9c6fb08962fc441123428e1d439bf52",
    heads: Object.freeze(["review/wp11-pm-bom-v394-minimal-20261117"]),
  }),
});

// PEC v6.5.0 release (Purchase Allocations lens + modal stack): the ONLY change to public/sw.js is the hub-cache-v394 -> hub-cache-v395
// advance plus network-first rules for the two new PEC modules (pec-modal-stack.js, pec-purchase-allocations.js). Owner-authorised
// release step. Exact path + exact head branch + SHA-256 of the LF-normalised file; any other content, branch, protected path or SQL
// migration stays rejected; the global protected-path policy is unchanged.
export const REVIEWED_PEC_V650_PINS = Object.freeze({
  "public/sw.js": Object.freeze({
    sha256: "0978bc1bd64f099d0e53a5c3d42c36b414471572438a817e4e32416034579c5c",
    heads: Object.freeze(["claude/busy-brahmagupta-3vslus"]),
  }),
});

// PEC v6.5.1 release (UX03 Purchase Allocations mobile refinement): the ONLY change to public/sw.js is the hub-cache-v395 -> hub-cache-v396
// advance only (comment text unchanged; network-first rules from v6.5.0 unchanged). Exact path + exact head branch + SHA-256 of the LF-normalised file.
export const REVIEWED_PEC_V651_PINS = Object.freeze({
  "public/sw.js": Object.freeze({
    sha256: "b796578ad262843f0f40cad89683154fa133e3efe8777f98fec0380fe634e351",
    heads: Object.freeze(["claude/pec-mobile-usability-refinement-2he3l5"]),
  }),
});

// MIS G7 reporting-only release candidate (owner-directed, 24 Nov 2026): the installed S2-S7c migrations (registered versions in
// docs/executive-mis-g7-server/MIGRATION_IDENTITIES.json) and their isolated PostgreSQL test harness are carried UNCHANGED. Same contract as the pins above:
// exact path + exact head branch + LF-SHA256 of the file. No installed migration may be edited, renamed or replayed; any other supabase path stays rejected.
const MIS_HEAD = Object.freeze(["claude/executive-mis-g7-client-dmijyz"]);
export const REVIEWED_MIS_G7_FILES = Object.freeze({
  "supabase/migrations/20261123140000_mis_g7_s2_signed_batch_stage_events.sql": Object.freeze({ sha256: "a70ae4a41bf9063803e50496e76b5ccb922251dc3fd8b551a0f041f8a95c0131", heads: MIS_HEAD }),
  "supabase/migrations/20261123141000_mis_g7_s3_fg_ledger_shared_batch_lock.sql": Object.freeze({ sha256: "ac8813aaef7b0621bc9f1a28127e11f3cf62d04abeae297402a0eac1020c9b33", heads: MIS_HEAD }),
  "supabase/migrations/20261123142000_mis_g7_s4_atomic_pack_with_measured_excess.sql": Object.freeze({ sha256: "c1f4648a5921203f8a28aaa5708d0f25af41aa01b8903d82c7e8675ee25d38de", heads: MIS_HEAD }),
  "supabase/migrations/20261123143000_mis_g7_s3b_protected_stock_write_boundary.sql": Object.freeze({ sha256: "cbdf9c1c8d27cf0f14ebc985fb034d4198f0c31dd6ff683fa028ebdfaa1929cf", heads: MIS_HEAD }),
  "supabase/migrations/20261123144000_mis_g7_s4b_ticketed_pack_corrections_and_enforcement_control.sql": Object.freeze({ sha256: "dc0c97b0afd4aeae77cd1c40ec3dc7637d7628a39db4e56a2391202b9af87a3c", heads: MIS_HEAD }),
  "supabase/migrations/20261123145000_mis_g7_s5_legacy_dwl_editor_chain_protection.sql": Object.freeze({ sha256: "e38615b25f20a41a643b2670a1d3df46e1c2e99185f87241c07d8a0a762173a0", heads: MIS_HEAD }),
  "supabase/migrations/20261123150000_mis_g7_s5b_legacy_dwl_editor_core_integration.sql": Object.freeze({ sha256: "4dee96b7784e7196132db47f2bfaf0bff44e595645e9c5e676b79a48d727e56d", heads: MIS_HEAD }),
  "supabase/migrations/20261123151000_mis_g7_s6_fg_stage_fingerprint_excludes_inventory_status.sql": Object.freeze({ sha256: "c429b4d888e40b7232551db4e6a1f011e5b0cb1830ce4d1d17a5b2b2222d680e", heads: MIS_HEAD }),
  "supabase/migrations/20261124120000_mis_g7_s7a_shared_route_identity_and_stage_status.sql": Object.freeze({ sha256: "511d4f5914f2921e4c214c7205835447c02393f1dff02c64f3c0feff441aca1d", heads: MIS_HEAD }),
  "supabase/migrations/20261124121000_mis_g7_s7b_exact_fg_receipt_evidence.sql": Object.freeze({ sha256: "abc8def6efe0d9e1508458eda3d35815de7b37f920fbeb93f57313f036620f7e", heads: MIS_HEAD }),
  "supabase/migrations/20261124122000_mis_g7_s7c_governed_previews_and_exception_summary.sql": Object.freeze({ sha256: "1d7df765fb4aac595ab23b161452ec6dc8fa0aeb76d06605a4ca185c986309cb", heads: MIS_HEAD }),
  "supabase/tests/mis_g7/00_base_schema_shim.sql": Object.freeze({ sha256: "f8eeadd2154268f146d0dff69543ae845a1680b582d286398c2a0884b9540562", heads: MIS_HEAD }),
  "supabase/tests/mis_g7/01_seed.sql": Object.freeze({ sha256: "3bc93077eccd7bd148d3638326a932769253645ba5738360565216d5cbd5e7d6", heads: MIS_HEAD }),
  "supabase/tests/mis_g7/03_real_editor_support.sql": Object.freeze({ sha256: "be214bcd79558b461d9764d3ed601a7207c555b19ddb83535db3687adf7734f5", heads: MIS_HEAD }),
  "supabase/tests/mis_g7/DRAFT_ledger_grant_hardening_NOT_APPLIED.sql": Object.freeze({ sha256: "cd8a6758de467fadf13fb38421deda89a5ce4df05c2b9d8a7fa5e8e8db93ad9b", heads: MIS_HEAD }),
  "supabase/tests/mis_g7/g7_policy.mjs": Object.freeze({ sha256: "a3217f12558c7fda9c0af2558829304a3314439f9a28b6f4cb2867a07374d20e", heads: MIS_HEAD }),
  "supabase/tests/mis_g7/g7_policy.test.mjs": Object.freeze({ sha256: "b8ca18f1256860be12a84608b883c3c1531459a16e6d33e898c7c87ad5e2eec1", heads: MIS_HEAD }),
  "supabase/tests/mis_g7/gen_migration_identities.mjs": Object.freeze({ sha256: "56b308ac8324e0137e2967b1312beec9640bf940a823a76de37d13c6196ce7be", heads: MIS_HEAD }),
  "supabase/tests/mis_g7/mis_g7_acceptance_pg.test.mjs": Object.freeze({ sha256: "4c886d7d074c6eea480fd45a09a1c7aaf89073d286dc045133594ade7ea765b8", heads: MIS_HEAD }),
  "supabase/tests/mis_g7/mis_g7_live_editor_pg.test.mjs": Object.freeze({ sha256: "ed23855c1d9c436e725bfc2653255512c94d254ac60d3df3cdb3cbcaf67f4c38", heads: MIS_HEAD }),
  "supabase/tests/mis_g7/mis_g7_pg.test.mjs": Object.freeze({ sha256: "a7127c818e917a0246985a5bd78c3905da4ad420cba29fd8841af76f7dd2ed65", heads: MIS_HEAD }),
  "supabase/tests/mis_g7/pg_harness.mjs": Object.freeze({ sha256: "6be041a4a2553619a758219868c970edfbb56782723522eef8625a63d68ce87f", heads: MIS_HEAD }),
  "supabase/tests/mis_g7/prod_equivalent/PROD_CATALOG_REPLAY_REQUIREMENTS.md": Object.freeze({ sha256: "e00e38c78eaa222df3306a65712576dd4f1b4b20eabf12bc6a57c0ec6a9927cc", heads: MIS_HEAD }),
  "supabase/tests/mis_g7/prod_equivalent/README_PROD_EQUIVALENT.md": Object.freeze({ sha256: "ae65948ad9b80dbdd4042a23c6083dec7db44a0562511804e494c4890fb4f996", heads: MIS_HEAD }),
  "supabase/tests/mis_g7/prod_equivalent/capture_live_baseline_READONLY.sh": Object.freeze({ sha256: "637658f6c09c58962f51182e84cecc09957ccd6ad310998f51444090eef4e59c", heads: MIS_HEAD }),
  "supabase/tests/mis_g7/prod_equivalent/capture_queries.sql": Object.freeze({ sha256: "577eb62c7a5562c000d6637bb1113dca6dd46d5ebbe9a7cf92150b51b3dd66e8", heads: MIS_HEAD }),
  "supabase/tests/mis_g7/prod_equivalent/load_baseline.mjs": Object.freeze({ sha256: "630d87ba38e61c9f690cfb3693a693f713d5a9679f2d8a33ae5f0766c239f2c7", heads: MIS_HEAD }),
  "supabase/tests/mis_g7/prod_equivalent/load_structured_packet.mjs": Object.freeze({ sha256: "5f2800f4f5e9cca8a91e22c88edb15adbbb855f8c91f4122635fb9d61e15092f", heads: MIS_HEAD }),
  "supabase/tests/mis_g7/prod_equivalent/mis_g7_prod_equivalent_pg.test.mjs": Object.freeze({ sha256: "a4244833419699b55b4741a87e6b6bd652d1d72f64b2e822b02576e417ce20de", heads: MIS_HEAD }),
  "supabase/tests/mis_g7/prod_equivalent/mis_g7_real_catalog_pg.test.mjs": Object.freeze({ sha256: "bb78ef666319fa3a36933e3f50d51c469d88b2a5303309e071b3661e0d8b6ca0", heads: MIS_HEAD }),
  "supabase/tests/mis_g7/prod_equivalent/real_catalog_fixture.sql": Object.freeze({ sha256: "62692df1f41f80915ee17f270e43ae8be00482c12146a9ee5cffce0a6464cfbe", heads: MIS_HEAD }),
  "supabase/tests/mis_g7/s7/build_db.mjs": Object.freeze({ sha256: "579c92d3fa91bdc3a89c707b072bacb5b9f5e502d80b80ff1bbfec2c2c86aade", heads: MIS_HEAD }),
  "supabase/tests/mis_g7/s7/extract_route_engine.mjs": Object.freeze({ sha256: "42e789d43b000e70d7bfe000ff6c4001611903db3831560c8314d394d684ef6d", heads: MIS_HEAD }),
  "supabase/tests/mis_g7/s7/mis_g7_s7_pg.test.mjs": Object.freeze({ sha256: "d69299d78076aaa82d4835c89864633441d9bea8ad1f83cda8dd8b9ada6c8224", heads: MIS_HEAD }),
  "supabase/tests/mis_g7/s7/mis_g7_s7_real_catalog_pg.test.mjs": Object.freeze({ sha256: "b066c597f44d30aab2d3074f23d672803dcbd181fc8f8e9f5fc5e3a44b70d302", heads: MIS_HEAD }),
  "supabase/tests/mis_g7/s7/route_engine_fixture.sql": Object.freeze({ sha256: "877f75071b10d7a63b51930fc566383ea23b69e697ebc8649f0c54d5699e79ea", heads: MIS_HEAD }),
});

const lfSha256 = (text) => createHash("sha256").update(String(text).replace(/\r\n/g, "\n")).digest("hex");

function reviewedServerException(path, ctx) {
  if (!ctx || typeof ctx.readText !== "function") return false;
  return [REVIEWED_SERVER_MIGRATIONS[path], REVIEWED_WP08_G2_1_PINS[path], REVIEWED_WP09_G2_PINS[path], REVIEWED_WP11_V394_PINS[path], REVIEWED_PEC_V650_PINS[path], REVIEWED_PEC_V651_PINS[path], REVIEWED_MIS_G7_FILES[path]].some((entry) => {
    if (!entry || !entry.heads.includes(ctx.headBranch)) return false;
    try { return lfSha256(ctx.readText(path)) === entry.sha256; } catch { return false; }
  });
}

/**
 * ctx (optional, committed paths only): { headBranch, readText(path) }.
 * Without ctx there is no server-branch exemption (previous behaviour).
 */
export function rejectedProtectedPaths(changed, integrationCandidate = false, ctx = null) {
  return [...new Set(changed)].filter(path =>
    (path === "public/sw.js" || path.startsWith("supabase/")) &&
    !(integrationCandidate && INTEGRATION_PROTECTED_PATHS.has(path)) &&
    !reviewedServerException(path, ctx)
  );
}
