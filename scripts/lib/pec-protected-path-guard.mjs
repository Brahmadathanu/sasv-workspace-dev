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

const lfSha256 = (text) => createHash("sha256").update(String(text).replace(/\r\n/g, "\n")).digest("hex");

function reviewedServerException(path, ctx) {
  if (!ctx || typeof ctx.readText !== "function") return false;
  return [REVIEWED_SERVER_MIGRATIONS[path], REVIEWED_WP08_G2_1_PINS[path], REVIEWED_WP09_G2_PINS[path], REVIEWED_WP11_V394_PINS[path]].some((entry) => {
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
