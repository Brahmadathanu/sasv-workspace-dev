// WP08 G2-1 — selection-only URL contract for the four shared Master Data pages
// (Manage Products, Manage RM BOM, Manage PM BOM, Manage SP BOM) plus the outbound href builder.
//
// SAFETY: this module only parses/validates/builds URLs and paints a status line. It never reads or writes data, never
// calls an RPC and grants nothing. Pages call it only AFTER session + permission verification, and only to SELECT an
// object that the page's own already-loaded, permission-filtered data proves exists. Invalid, stale or mismatched ids
// are no-ops with a status message — they never select a different object and never fall back to another owner.
//
// Identity semantics (verified against the page sources, see WP08 G2-1 report):
//   manage-products  product_id (+ optional sku_id that MUST belong to that product) + tab=products|skus|readiness
//   manage-rm-bom    product_id  (picker v_picker_products.id == rm_bom_header.product_id)
//   manage-sp-bom    owner_item_id (picker v_picker_sp_owners.id == sp_bom_header.owner_item_id, a STOCK ITEM, not a product)
//   pm-templates     sku_id (Overrides tab SKU picker; a PM template id is not a SKU id)

export const MASTER_DATA_PAGES = Object.freeze({
  "manage-products": Object.freeze({
    file: "manage-products.html",
    permissionTarget: "module:manage-products",
    keys: Object.freeze(["product_id", "sku_id", "tab"]),
  }),
  "manage-rm-bom": Object.freeze({
    file: "manage-rm-bom.html",
    permissionTarget: "module:manage-rm-bom",
    keys: Object.freeze(["product_id"]),
  }),
  "manage-sp-bom": Object.freeze({
    file: "manage-sp-bom.html",
    permissionTarget: "module:manage-sp-bom",
    keys: Object.freeze(["owner_item_id"]),
  }),
  "pm-templates": Object.freeze({
    file: "manage-pm-bom.html",
    permissionTarget: "module:pm-templates",
    keys: Object.freeze(["sku_id"]),
  }),
});

export const PRODUCT_PAGE_TABS = Object.freeze(["products", "skus", "readiness"]);

const ID_RE = /^[1-9][0-9]{0,15}$/;

/** Strict positive-integer id. Rejects "", "0", "-1", "1.5", "1e3", " 1", "01", "abc", > 16 digits. */
export function parseStrictId(raw) {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const s = String(raw);
  if (!ID_RE.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * Parse the selection contract for one page. Duplicate keys are ambiguous and invalid.
 * @returns {{present:boolean, productId:number|null, skuId:number|null, ownerItemId:number|null,
 *            tab:string|null, issues:string[]}}
 */
export function parseMasterDataSelection(search, moduleKey) {
  const page = MASTER_DATA_PAGES[moduleKey];
  const out = { present: false, productId: null, skuId: null, ownerItemId: null, tab: null, issues: [] };
  if (!page) return out;
  let qp;
  try {
    qp = new URLSearchParams(typeof search === "string" ? search : "");
  } catch {
    return out;
  }
  const one = (key) => {
    const all = qp.getAll(key);
    if (!all.length) return undefined;
    if (all.length > 1) {
      out.present = true;
      out.issues.push(`${key} was given more than once and was ignored.`);
      return null;
    }
    out.present = true;
    return all[0];
  };
  const idOf = (key) => {
    const raw = one(key);
    if (raw === undefined || raw === null) return null;
    const id = parseStrictId(raw);
    if (id === null) out.issues.push(`${key} is not a valid identifier and was ignored.`);
    return id;
  };
  if (page.keys.includes("product_id")) out.productId = idOf("product_id");
  if (page.keys.includes("sku_id")) out.skuId = idOf("sku_id");
  if (page.keys.includes("owner_item_id")) out.ownerItemId = idOf("owner_item_id");
  if (page.keys.includes("tab")) {
    const raw = one("tab");
    if (raw !== undefined && raw !== null) {
      if (PRODUCT_PAGE_TABS.includes(raw)) out.tab = raw;
      else out.issues.push("tab is not recognised and was ignored.");
    }
  }
  if (moduleKey === "manage-sp-bom" && new URLSearchParams(search || "").has("product_id")) {
    out.present = true;
    out.issues.push("SP BOM selects by owner item (owner_item_id); product_id is not an SP BOM identity and was ignored.");
  }
  return out;
}

/**
 * Same-folder href (the four pages and every Costing page live in public/shared/, served at /public/shared/ by Electron
 * and /shared/ by the PWA), so a sibling-relative URL is platform-neutral. Returns null when an identifier is invalid or
 * the combination is not part of the contract (e.g. sku_id without product_id on Manage Products).
 */
export function buildMasterDataHref(moduleKey, params = {}) {
  const page = MASTER_DATA_PAGES[moduleKey];
  if (!page) return null;
  const qs = new URLSearchParams();
  const put = (key, value, required = false) => {
    if (value === undefined || value === null || value === "") return required ? false : true;
    const id = parseStrictId(value);
    if (id === null) return false;
    qs.set(key, String(id));
    return true;
  };
  if (moduleKey === "manage-products") {
    if (!put("product_id", params.productId ?? params.product_id)) return null;
    if (!qs.has("product_id")) return null;
    if (!put("sku_id", params.skuId ?? params.sku_id)) return null;
    const tab = params.tab;
    if (tab !== undefined && tab !== null && tab !== "") {
      if (!PRODUCT_PAGE_TABS.includes(tab)) return null;
      qs.set("tab", tab);
    }
  } else if (moduleKey === "manage-rm-bom") {
    if (!put("product_id", params.productId ?? params.product_id) || !qs.has("product_id")) return null;
  } else if (moduleKey === "manage-sp-bom") {
    if (!put("owner_item_id", params.ownerItemId ?? params.owner_item_id) || !qs.has("owner_item_id")) return null;
  } else if (moduleKey === "pm-templates") {
    if (!put("sku_id", params.skuId ?? params.sku_id) || !qs.has("sku_id")) return null;
  }
  return `${page.file}?${qs.toString()}`;
}

/** Only a verified view grant (boolean true on the destination's own permission row) makes a link navigable. */
export function canOfferMasterDataLink(moduleKey, permissionRows) {
  const page = MASTER_DATA_PAGES[moduleKey];
  if (!page || !Array.isArray(permissionRows)) return false;
  const row = permissionRows.find((r) => r && r.target === page.permissionTarget);
  return row?.can_view === true;
}

/** Paint a persistent, polite status line (does not use alerts/toasts; no layout dependency on page CSS). */
export function showSelectionStatus(message, kind = "info", doc = typeof document !== "undefined" ? document : null) {
  if (!doc) return null;
  let host = doc.getElementById("mdSelectionStatus");
  if (!message) {
    if (host) host.hidden = true;
    return host;
  }
  if (!host) {
    host = doc.createElement("div");
    host.id = "mdSelectionStatus";
    host.setAttribute("role", "status");
    host.setAttribute("aria-live", "polite");
    host.style.cssText = "margin:8px 12px;padding:8px 12px;border-radius:6px;font-size:0.9rem;border:1px solid #c9a227;background:#fff8e1;color:#4d3b00;";
    const anchor = doc.querySelector("main") || doc.body;
    anchor.insertBefore(host, anchor.firstChild);
  }
  host.dataset.kind = kind;
  host.textContent = message;
  host.hidden = false;
  return host;
}

/** replaceState only (never pushState): keeps the URL truthful without creating history entries or loops. */
export function replaceSelectionUrl(entries, win = typeof window !== "undefined" ? window : null) {
  if (!win?.history?.replaceState) return false;
  const url = new URL(win.location.href);
  for (const [key, value] of Object.entries(entries)) {
    if (value === null || value === undefined || value === "") url.searchParams.delete(key);
    else url.searchParams.set(key, String(value));
  }
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (next === `${win.location.pathname}${win.location.search}${win.location.hash}`) return false;
  win.history.replaceState(win.history.state, "", next);
  return true;
}

/**
 * URL-authoritative Back/Forward. `apply()` re-reads the URL and selects; `blocked()` returns true while the page holds
 * unsaved/edit state, in which case nothing is changed and `restore()` puts the URL back to what is displayed. A re-entrancy
 * guard prevents loops; this handler never pushes history.
 */
export function installPopstateReapply({ apply, blocked, restore }, win = typeof window !== "undefined" ? window : null) {
  if (!win) return () => {};
  let running = false;
  const handler = async () => {
    if (running) return;
    running = true;
    try {
      if (blocked?.()) {
        restore?.();
        return;
      }
      await apply();
    } finally {
      running = false;
    }
  };
  win.addEventListener("popstate", handler);
  return () => win.removeEventListener("popstate", handler);
}
