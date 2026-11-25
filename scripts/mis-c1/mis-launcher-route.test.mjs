// MIS launcher/route contract (offline). Establishes (a) the published URL of the dashboard from the Netlify
// publish root and (b) that View-only launcher navigation is a registry-data matter (min_nav_mode), not a
// weakening of getModuleAccessLevel. No network, no Supabase, no registry writes.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

// module-registry.js imports the Supabase client; load it with that import stubbed out.
const src = read("public/shared/js/module-registry.js").replace(/^import .*supabaseClient\.js";\n/m, "const supabase = null;\n");
const reg = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));

test("publish root is public/, so the dashboard URL is /shared/... and /public/shared/... is not a route", () => {
  assert.match(read("public/netlify.toml"), /publish\s*=\s*"public"/);
  assert.ok(fs.existsSync(path.join(root, "public/shared/executive-mis-dashboard.html")));
  assert.ok(fs.existsSync(path.join(root, "public/shared/js/executive-mis-dashboard.js")));
  assert.ok(!fs.existsSync(path.join(root, "public/public/shared/executive-mis-dashboard.html")));
  for (const route of ["public/shared/executive-mis-dashboard.html", "/shared/executive-mis-dashboard.html"]) {
    assert.equal(reg.normalizeClientRoute(route, "pwa"), "/shared/executive-mis-dashboard.html");
  }
  assert.equal(reg.normalizeClientRoute("public/shared/executive-mis-dashboard.html", "electron"), "public/shared/executive-mis-dashboard.html");
  // page-relative asset references resolve under the same root
  const html = read("public/shared/executive-mis-dashboard.html");
  assert.match(html, /src="js\/executive-mis-dashboard\.js"/);
  assert.ok(fs.existsSync(path.join(root, "public/shared/css/style.css")));
});

const mk = (view, edit) => reg.buildPermissionMap([{ target: "module:executive-mis-dashboard", can_view: view, can_edit: edit }]);
const mis = (minNavMode) => ({ moduleKey: "executive-mis-dashboard", minNavMode });

test("launcher access levels: View-only is clickable only when the registry says min_nav_mode=read", () => {
  // current live registry value: visible but locked
  assert.equal(reg.getModuleAccessLevel(mis("view"), mk(true, false)), "view");
  // proposed registry value: clickable read-only entry
  assert.equal(reg.getModuleAccessLevel(mis("read"), mk(true, false)), "read");
  // no permission stays hidden under both settings
  assert.equal(reg.getModuleAccessLevel(mis("view"), mk(false, false)), "none");
  assert.equal(reg.getModuleAccessLevel(mis("read"), mk(false, false)), "none");
  assert.equal(reg.getModuleAccessLevel(mis("read"), reg.buildPermissionMap([])), "none");
  // edit unchanged
  assert.equal(reg.getModuleAccessLevel(mis("view"), mk(true, true)), "use");
  assert.equal(reg.getModuleAccessLevel(mis("read"), mk(false, true)), "use");
  // an edit-only module is never exposed by view permission
  assert.equal(reg.getModuleAccessLevel(mis("edit"), mk(true, false)), "none");
});

test("changing MIS to read does not change any other module's access level", () => {
  const map = reg.buildPermissionMap([{ target: "module:other-module", can_view: true, can_edit: false }]);
  assert.equal(reg.getModuleAccessLevel({ moduleKey: "other-module", minNavMode: "view" }, map), "view");
  assert.equal(reg.getModuleAccessLevel({ moduleKey: "executive-mis-dashboard", minNavMode: "read" }, map), "none", "view of another module grants nothing for MIS");
});

test("hub renders locked entries with href '#' and read entries with their route (no generic change needed)", () => {
  const hub = read("public/utilities-hub/js/hub-auth.js");
  assert.match(hub, /locked: level === "view"/);
  assert.match(hub, /href: level === "view" \? "#" : utility\.href \|\| "#"/);
  assert.match(hub, /const isLockedView = /);
});

test("this PR contains no registry/SQL mutation and getModuleAccessLevel is unchanged from main", () => {
  assert.doesNotMatch(read("public/shared/js/executive-mis-dashboard.js"), /app_module_registry|min_nav_mode/);
});
