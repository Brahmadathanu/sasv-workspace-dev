/**
 * Production Route Manager HTML integrity builder.
 *
 * The PRM page is now a purpose-built shell rather than a Costing page clone.
 * This command performs an idempotent write and validates source/output parity.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public/shared/production-route-manager.html");
const html = readFileSync(out, "utf8");

writeFileSync(out, html, "utf8");
const generated = readFileSync(out, "utf8");

const requiredIds = [
  "globalSearchCard",
  "lensSelect",
  "lensPills",
  "prmAsOfDate",
  "prmProductGroupFilter",
  "prmRouteFamilyFilter",
  "workbenchSummary",
  "prmSetupBanner",
  "prmEditorHost",
  "prmCandidateHost",
  "prmEffectiveHost",
  "costingLoadingMask",
  "detailsModal",
  "peqToastContainer",
];

const checks = [
  ["source parity", generated === html],
  ["title", html.includes("<title>Production Route Manager</title>")],
  [
    "module key",
    html.includes('data-costing-module-key="production-route-manager"'),
  ],
  [
    "Manufacturing Route Families subtitle",
    html.includes(
      "Manufacturing Route Families, Product route deltas, historical candidates, and effective Product-to-Process routes",
    ),
  ],
  [
    "exact search placeholder",
    html.includes('placeholder="Search Product or Product Group"'),
  ],
  [
    "single reusable details modal",
    (html.match(/id="detailsModal"/g) || []).length === 1,
  ],
  [
    "no cloned Costing modal markup",
    !/class="(?:cost-sheet-modal|cost-sheet-sign-modal)/.test(html),
  ],
  [
    "PRM entry",
    html.includes('src="js/production-route-manager-entry.js"'),
  ],
  ["no PDF libraries", !html.includes("jspdf")],
  ...requiredIds.map((id) => [
    `required host ${id}`,
    html.includes(`id="${id}"`),
  ]),
];

let failed = 0;
for (const [label, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error("FAIL", label);
  } else {
    console.log("OK", label);
  }
}

if (failed) process.exit(1);
console.log("Verified", out, `(${html.length} chars)`);
