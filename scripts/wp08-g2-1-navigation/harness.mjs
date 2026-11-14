// WP08 G2-1 browser harness: reuses the G2-0 static servers/launch, but its Supabase stub is DATA-AWARE (fixtures + eq filters)
// and records every table read / RPC (with arguments) so tests can prove selection happened and that no writer ran.
import { launch, startServer, PLATFORMS, MODULES } from "../wp08-g2-0-shared-master-data/harness.mjs";
export { launch, startServer, PLATFORMS, MODULES };

export const FIXTURES = {
  categories: [{ id: 401, category_name: "Cat" }],
  sub_categories: [{ id: 301, category_id: 401, sub_category_name: "Sub" }],
  product_groups: [{ id: 201, sub_category_id: 301, group_name: "Grp" }],
  sub_groups: [{ id: 101, product_group_id: 201, sub_group_name: "SG" }],
  products: [
    { id: 11, item: "Alpha", malayalam_name: "A", status: "Active", sub_group_id: 101, is_pto: false, uom_base: null, conversion_to_base: null, is_seasonal: false, season_profile_id: null, is_llt: false, manufacture_lead_time_months: null },
    { id: 12, item: "Beta", malayalam_name: "B", status: "Active", sub_group_id: 101, is_pto: false, uom_base: null, conversion_to_base: null, is_seasonal: false, season_profile_id: null, is_llt: false, manufacture_lead_time_months: null },
  ],
  product_skus: [
    { id: 501, product_id: 11, pack_size: 100, uom: "ml", is_sample: false, is_active: true },
    { id: 502, product_id: 12, pack_size: 200, uom: "ml", is_sample: false, is_active: true },
  ],
  v_picker_products: [{ id: 11, label: "Alpha", uom_code: "ml" }, { id: 12, label: "Beta", uom_code: "ml" }],
  rm_bom_header: [{ id: 7, product_id: 11, reference_output_qty: 1, reference_output_uom_id: 1, process_loss_pct: 0 }],
  v_picker_sp_owners: [{ id: 901, label: "Owner A", default_uom_code: "kg" }, { id: 902, label: "Owner B", default_uom_code: "kg" }],
  sp_bom_header: [{ id: 3, owner_item_id: 901, reference_output_qty: 1, reference_output_uom_id: 1, process_loss_pct: 0, notes: null }],
  v_sku_catalog_enriched: [{ sku_id: 501, sku_label: "Alpha 100 ml" }, { sku_id: 502, sku_label: "Beta 200 ml" }],
};

const STUB = `
const user = { id: "00000000-0000-0000-0000-000000000000", email: "g2-1@example.invalid" };
const FIX = window.__FIXTURES || {};
const log = (c) => { (window.__CALLS = window.__CALLS || []).push(c); };
function chain(table) {
  const st = { table, eq: [], single: false, maybe: false, range: null };
  const fn = () => proxy;
  const resolve = () => {
    let rows = (FIX[table] || []).filter((r) => st.eq.every(([k, v]) => String(r[k]) === String(v)));
    if (st.range) rows = rows.slice(st.range[0], st.range[1] + 1);
    log({ kind: "from", table, eq: st.eq.slice() });
    if (st.single) return rows[0] ? { data: rows[0], error: null } : { data: null, error: { message: "no rows" } };
    if (st.maybe) return { data: rows[0] || null, error: null };
    return { data: rows, error: null, count: rows.length };
  };
  const proxy = new Proxy(fn, {
    get(_t, prop) {
      if (prop === "then") return (res, rej) => Promise.resolve(resolve()).then(res, rej);
      return (...a) => {
        if (prop === "eq") st.eq.push([a[0], a[1]]);
        else if (prop === "single") st.single = true;
        else if (prop === "maybeSingle") st.maybe = true;
        else if (prop === "range") st.range = [a[0], a[1]];
        else if (["insert", "update", "upsert", "delete"].includes(prop)) log({ kind: "WRITE", table, method: prop });
        return proxy;
      };
    },
    apply: () => proxy,
  });
  return proxy;
}
export function createClient() {
  const session = window.__SESSION === false ? null : { access_token: "stub", user };
  const client = {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user: session ? user : null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      refreshSession: async () => ({ data: { session }, error: null }),
      signOut: async () => ({ error: null }),
    },
    from: (t) => chain(t),
    rpc: (name, args) => {
      log({ kind: "rpc", name, args });
      if (name === "get_user_permissions") return Promise.resolve({ data: window.__GRANTS || [], error: null });
      if (name === "app_get_current_user_context") return Promise.resolve({ data: { user_id: user.id, email: user.email, is_authenticated: !!session }, error: null });
      if (name === "app_get_my_permissions") return Promise.resolve({ data: window.__GRANTS || [], error: null });
      return Promise.resolve({ data: [], error: null });
    },
    schema() { return client; },
  };
  return client;
}
`;

/** role: denied | view | edit. suffix: query string. Returns page + helpers. */
export async function openSelectionPage(env, { platform, moduleDef, role = "view", width = 1280, suffix = "", wait = 1200 }) {
  const server = env.servers[platform];
  const origin = `http://127.0.0.1:${server.address().port}`;
  const cfg = PLATFORMS[platform];
  const context = await env.browser.newContext({ viewport: { width, height: 900 }, ...(cfg.userAgent ? { userAgent: cfg.userAgent } : {}) });
  const grants = {
    denied: [],
    view: [{ target: moduleDef.target, can_view: true, can_edit: false }],
    edit: [{ target: moduleDef.target, can_view: true, can_edit: true }],
  }[role];
  await context.addInitScript(([g, f]) => { window.__GRANTS = g; window.__FIXTURES = f; }, [grants, FIXTURES]);
  const external = [];
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (route) => {
    const url = route.request().url();
    if (/esm\.sh\/@supabase\/supabase-js/.test(url)) return route.fulfill({ status: 200, contentType: "text/javascript", body: STUB });
    if (/jspdf/.test(url)) return route.fulfill({ status: 200, contentType: "text/javascript", body: `window.jspdf={jsPDF:function(){this.text=()=>{};this.save=()=>{};this.autoTable=()=>{};}};` });
    external.push(url);
    return route.fulfill({ status: 200, contentType: "text/plain", body: "" });
  });
  const page = await context.newPage();
  const errors = [];
  const failed = [];
  page.on("response", (r) => { if (r.url().startsWith(origin) && r.status() >= 400) failed.push(`${r.status()} ${new URL(r.url()).pathname}`); });
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const url = `${origin}${cfg.pagePrefix}${moduleDef.file}${suffix}`;
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(wait);
  const calls = () => page.evaluate(() => window.__CALLS || []);
  return { page, context, errors, failed, external, origin, url, calls };
}

// Anything that could write, preview, rebuild or activate. Selection from a URL must never trigger one of these.
export const FORBIDDEN_RPC = /(?:^|_)(?:create|update|set|save|delete|approve|submit|activate|deactivate|upsert|insert|clone|publish|supersede|rebuild|preview|map_set|map_clear|renumber|import)(?:_|$)/i;
export const statusText = (page) => page.evaluate(() => { const e = document.getElementById("mdSelectionStatus"); return e && !e.hidden ? e.textContent : ""; });
