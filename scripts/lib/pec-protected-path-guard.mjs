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
]);

export function rejectedProtectedPaths(changed, integrationCandidate = false) {
  return [...new Set(changed)].filter(path =>
    (path === "public/sw.js" || path.startsWith("supabase/")) &&
    !(integrationCandidate && INTEGRATION_PROTECTED_PATHS.has(path))
  );
}
