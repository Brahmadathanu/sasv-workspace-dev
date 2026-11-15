// Independent regressions: actual flag reader and actual hub render/auth lifecycle,
// with deferred data promises and a minimal DOM. Offline; no browser or Supabase.
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile, loadPresentation } from "./lib.mjs";
const P = await loadPresentation();
const results = [];
async function check(name, fn) {
  try { await fn(); results.push({ name, status: "PASS" }); console.log("PASS " + name); }
  catch (e) { results.push({ name, status: "FAIL", detail: e.message }); console.log("FAIL " + name + ": " + e.message); }
}
await check("flag remains OFF when accessing localStorage itself throws", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  try {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("storage denied"); } });
    assert.equal(P.isLauncherPresentationV1Enabled(), false);
  } finally { if (previous) Object.defineProperty(globalThis, "localStorage", previous); else delete globalThis.localStorage; }
});
function deferred() { let resolve, reject; const promise = new Promise((r, j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; }
function hub(flag = true, transform = (s) => s) {
  const root = { innerHTML: "A modules", setAttribute() {}, classList: { add() {}, remove() {} }, addEventListener() {} };
  const callbacks = {};
  const permissions = [];
  let current = "B";
  const context = vm.createContext({ console: { ...console, error() {} }, setTimeout,
    document: { documentElement: { dataset: {} }, head: { appendChild() {} }, createElement: () => ({}), getElementById: (id) => id === "hub-root" ? root : null, addEventListener() {} },
    window: { addEventListener() {} }, navigator: {}, BroadcastChannel: class { addEventListener() {} },
    isLauncherPresentationV1Enabled: () => flag,
    supabase: { auth: { getSession: async () => ({ data: { session: current ? { user: { id: current } } : null } }), onAuthStateChange(fn) { callbacks.auth = fn; } } },
  });
  let source = readFile("public/utilities-hub/js/hub-auth.js").replace(/^import[\s\S]*?from\s+["'][^"']+["'];\s*/gm, "");
  source = source.slice(0, source.indexOf("(async function boot()"));
  vm.runInContext(transform(source), context);
  context.permissionWait = () => { const d = deferred(); permissions.push(d); return d.promise; };
  vm.runInContext(`loadUtilities = async () => [];
    loadAccessMap = () => permissionWait();
    renderUtilitiesSectioned = () => 'current modules';
    renderHubTools = (s) => { hubTools.scope = s.user.id; hubTools.entries = [{ moduleKey: s.user.id }]; hubTools.root.innerHTML = s.user.id + ' pins'; };
    hubTools.root = { innerHTML: 'A pins and search' }; hubTools.scope = 'A'; hubTools.entries = [{ moduleKey: 'A' }];
    lastRenderedSessionKey = 'A'; wireEvents();`, context);
  return { context, root, callbacks, permissions, run: (s) => vm.runInContext(s, context), user: (s) => { current = s; }, tick: () => new Promise((r) => setImmediate(r)) };
}
await check("PWA tools clear synchronously while a new render waits for permissions", async () => {
  const h = hub(); const done = h.run("render('pageshow')"); await h.tick();
  assert.equal(h.permissions.length, 1);
  assert.equal(h.run("hubTools.entries.length"), 0);
  assert.equal(h.run("hubTools.root.innerHTML"), "");
  assert.equal(h.root.innerHTML, "");
  h.permissions[0].resolve({}); await done;
  assert.equal(h.run("hubTools.scope"), "B");
});
await check("identity change during pending permissions never commits the previous user's tools", async () => {
  const h = hub(); const done = h.run("render('pageshow')"); await h.tick();
  h.user("C"); h.callbacks.auth("SIGNED_IN", { user: { id: "C" } });
  h.permissions[0].resolve({}); await h.tick();
  assert.equal(h.run("hubTools.entries.length"), 0);
  assert.equal(h.run("hubTools.root.innerHTML"), "");
  assert.equal(h.permissions.length, 2, "new identity was not queued");
  h.permissions[1].resolve({}); await done;
  assert.equal(h.run("hubTools.scope"), "C");
});
await check("sign-out during pending permissions cannot restore the previous user's tools", async () => {
  const h = hub(); const done = h.run("render('pageshow')"); await h.tick();
  h.user(null); h.callbacks.auth("SIGNED_OUT", null);
  h.permissions[0].resolve({}); await done;
  assert.equal(h.run("hubTools.entries.length"), 0);
  assert.equal(h.run("hubTools.root.innerHTML"), "");
  assert.match(h.root.innerHTML, /Sign in required/);
});
await check("flag OFF preserves existing rendered DOM while refresh is pending", async () => {
  const h = hub(false); const done = h.run("render('pageshow')"); await h.tick();
  assert.equal(h.root.innerHTML, "A modules");
  h.permissions[0].resolve({}); await done;
});
console.log(`${results.filter((r) => r.status === "PASS").length}/${results.length} PASS`);
if (process.argv[2]) (await import("node:fs")).writeFileSync(process.argv[2], JSON.stringify({ results, classification: "offline VM of actual hub lifecycle; not browser or live acceptance" }, null, 2) + "\n");
process.exitCode = results.some((r) => r.status === "FAIL") ? 1 : 0;
