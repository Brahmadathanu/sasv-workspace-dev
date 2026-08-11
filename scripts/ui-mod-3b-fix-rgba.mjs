/**
 * DEPRECATED / DO NOT RUN — UI-MOD-3B fix-rgba (REJECTED)
 * Part of rejected suite rollout batch. Kept for audit history only.
 * Recovery: UI-MOD-3R. Do not execute.
 */
import fs from "fs";
import path from "path";

throw new Error("DEPRECATED: ui-mod-3b-fix-rgba.mjs — DO NOT RUN (UI-MOD-3B rejected)");

const files = [
  "costing-control-center.html",
  "material-cost-manager.html",
  "cost-build-manager.html",
  "pricing-policy-manager.html",
  "production-route-manager.html",
];

for (const f of files) {
  const p = path.join("public/shared", f);
  let h = fs.readFileSync(p, "utf8");
  h = h.replace(
    /rgba\(\s*37,\s*99,\s*235,\s*0\.035\s*\)/g,
    "var(--sasv-action-primary-soft)"
  );
  h = h.replace(/\n\.input-clear-btn \{/g, "\n      .input-clear-btn {");
  fs.writeFileSync(p, h);
  console.log(f, "left-rgba37", (h.match(/rgba\(\s*37,\s*99,\s*235/g) || []).length);
}
