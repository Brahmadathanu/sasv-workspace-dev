// Negative tests of captured-metadata verification. Mutations are memory-only.
import assert from "node:assert/strict";
import { read } from "./lib.mjs";
import { MAPPING } from "./module-mapping.mjs";
import { verifyRegistry, staticPath } from "./registry-verify.mjs";
const original = JSON.parse(read("docs/master-data-costing/WP09_G1_EVIDENCE/live-registry-snapshot-2026-11-15.json"));
let count = 0;
const pass = (name) => { count++; console.log(`PASS ${name}`); };
assert((await verifyRegistry(original)).every((r) => r.status === "PASS")); pass("committed capture passes all gates");
for (const [route, expected] of [["./admin.html", "public/utilities-hub/admin.html"], ["../shared/view-logs.html", "public/shared/view-logs.html"], ["/shared/view-logs.html?x=1#row", "public/shared/view-logs.html"]]) {
  assert.equal(staticPath(route, "pwa"), expected); pass(`PWA base resolution: ${route}`);
}
async function negative(name, mutate, gate) {
  const data = structuredClone(original), mapping = structuredClone(MAPPING);
  mutate(data, mapping);
  const res = await verifyRegistry(data, mapping);
  assert(res.some((r) => r.id.startsWith(gate) && r.status === "FAIL"), `${name} escaped ${gate}`);
  pass(`${name} detected by ${gate}`);
}
await negative("missing Electron registration", (d) => d.registry.splice(d.registry.findIndex((r) => r.client_key === "electron"), 1), "L1");
await negative("missing PWA registration", (d) => d.registry.splice(d.registry.findIndex((r) => r.client_key === "pwa"), 1), "L2");
await negative("PWA key outside Electron", (d) => { d.registry.find((r) => r.client_key === "pwa").module_key = "invented"; }, "L3");
await negative("section distribution drift", (d) => { d.registry[0].section_key = "work-log"; }, "L5 electron");
await negative("duplicate destination", (d) => { const es = d.registry.filter((r) => r.client_key === "electron"); es[1].route_path = es[0].route_path; }, "L6 no duplicate active route within electron");
await negative("missing PWA file", (d) => { d.registry.find((r) => r.client_key === "pwa").route_path = "../shared/missing-wp09.html"; }, "L8 pwa route target");
await negative("existing but wrong page owner", (d) => { d.registry[0].route_path = "login.html"; }, "L8 electron route ownership");
await negative("orphan section", (d) => { d.registry[0].section_key = "orphan"; }, "L9");
await negative("missing registered child mapping", (_d, m) => m.splice(m.findIndex((r) => r.key === "coa-print"), 1), "L10");
await negative("duplicate mapping key", (_d, m) => m.push(m[0]), "L10");
await negative("stale source-token key cannot escape L11", (_d, m) => m.push({ ...m[0], key: "production-overrides", keyBasis: "source-token" }), "L11");
await negative("alias cannot substitute for exact live key", (_d, m) => { m[0].aliases = [m[0].key]; m[0].key = "invented-alias"; }, "L10");
await negative("Option A section move", (_d, m) => { m[0].optA.section = "admin"; }, "L12");
await negative("definition count drift", (d) => d.modules.pop(), "S1");
await negative("inactive section", (d) => { d.sections[0].is_active = false; }, "S2");
await negative("duplicate client key with unique route", (d) => { d.registry[0].module_key = d.registry[1].module_key; }, "S3");
await negative("missing definition capture", (d) => { delete d.modules; }, "S1");
await negative("unknown client registration", (d) => d.registry.push({ ...d.registry[0], client_key: "invented" }), "S3");
console.log(`${count}/${count} PASS; negative cases prove detection, not live-role acceptance`);
