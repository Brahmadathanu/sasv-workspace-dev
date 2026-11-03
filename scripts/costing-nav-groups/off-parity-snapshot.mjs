// MDC-07 / N1 flag-OFF parity evidence. Prints a JSON snapshot of the navigation chrome (lens label, pills, select,
// active lens, URL query) and the visible page text for every ?lens= deep link on the five lens-based pages plus the
// PPM landing and workspaces, with COSTING_NAV_GROUPS_V1 absent. Run once against a pristine-main checkout and once
// against the branch (COSTING_AUDIT_ROOT selects the checkout) and diff the two outputs:
//   COSTING_AUDIT_ROOT=<main-worktree> node scripts/costing-nav-groups/off-parity-snapshot.mjs > main.json
//   node scripts/costing-nav-groups/off-parity-snapshot.mjs > branch.json && diff main.json branch.json
// Inert fake backend; no network, no Supabase, no writes. Use COSTING_NAV_FLAG=1 to snapshot the flag-ON state.
import { COSTING_ROUTE_CONFIG } from "../../public/shared/js/costing-route-config.js";
import { launchAudit, openAuditPage } from "../costing-responsive/responsive-audit.mjs";

const env = await launchAudit();
if (!env) { console.log("SKIP: playwright not available"); process.exit(0); }
const storage = process.env.COSTING_NAV_FLAG === "1" ? { COSTING_NAV_GROUPS_V1: "1" } : {};
const out = {};
const ppmWorkspaces = ["sku-overview", "sku-mrp-policies", "product-derivation-policies", "mrp-proposals", "proposal-decisions", "approved-for-application", "applied-proposal-history", "scheme-master", "scheme-rule-register", "commercial-sales-assumptions"];
for (const c of Object.values(COSTING_ROUTE_CONFIG)) {
  const rel = c.routePath.replace(/^public\//, "");
  const targets = c.suiteId === "pricing-policy" ? ["", ...ppmWorkspaces.map((w) => `?workspace=${w}`), "?lens=mrp-governance", "?lens=policy-manager"] : ["", ...c.allowedLensIds.map((l) => `?lens=${l}`)];
  for (const q of targets) {
    for (const width of [390, 1280]) {
      const { page, context, errors } = await openAuditPage(env, `${rel}${q}`, { width, storage });
      const snap = await page.evaluate(() => {
        const g = (id) => document.getElementById(id);
        return {
          label: g("lensSuiteLabel")?.textContent ?? null,
          labelHidden: g("lensSuiteLabel")?.hidden ?? null,
          pills: g("lensPills")?.innerHTML.replace(/\s+/g, " ") ?? null,
          select: g("lensSelect")?.innerHTML ?? null,
          selectValue: g("lensSelect")?.value ?? null,
          active: [...document.querySelectorAll("#lensPills .active, #lensPills [aria-selected=true]")].map((e) => e.textContent.trim()),
          search: location.search,
          title: document.title,
        };
      });
      out[`${c.moduleKey}${q}@${width}`] = { ...snap, errors };
      await context.close();
    }
  }
}
await env.close();
process.stdout.write(JSON.stringify(out, null, 1));
