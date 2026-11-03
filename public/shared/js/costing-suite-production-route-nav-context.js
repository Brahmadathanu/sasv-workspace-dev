/**
 * MDC-07 / N4 - Production Route Manager context persistence (controller-side, pure logic, no data access).
 *
 * Remembers the selected Product, Product route version, Route Family and Family route while the user moves between
 * the PRM lenses / navigation groups, and feeds the N1 context store (costingNavContext) for the context chips.
 * Active only when COSTING_PRM_NAV_CONTEXT_V1 is exactly "1" (default OFF); with the flag OFF no function in the
 * controller changes behaviour.
 *
 * What it never does:
 *   - issue an RPC, read storage (except the flag), compute a date / cost / lifecycle, or guess an id;
 *   - resolve or store a costing run (the Mapping / Foundation Review and Workload Preview keep their fixed
 *     historical run context exactly as the controller already labels it; this module never sets the "run" chip);
 *   - write the URL.
 *
 * Rules (see reconcilePrmNavContext / hydratePrmDeepLink):
 *   1. Ids that a lens actually LOADED successfully are committed (header ids are authoritative, not the URL).
 *   2. Changing the Product drops the Product route version and, unless the new Family is supplied, the Family and
 *      Family route (the old Family is not known to belong to the new Product).
 *   3. Changing the Family drops the Family route and, unless a Product is supplied, the Product and its route.
 *   4. An id present in the deep link / URL is an explicit selection and is never overwritten by stored context; if
 *      any explicit id differs from the stored one, NOTHING is injected from the stored context.
 *   5. Only identity lenses receive stored context (PRM_LENS_CONTEXT_KEYS). Register / evidence lenses (Readiness,
 *      Workload Preview, Mapping Review, Foundation Review, Cost Centres, Subgroup Mappings, Archived Routes) are
 *      never given hidden filters or a run; they stay independently accessible with their own state.
 */
import { costingNavContext } from "./costing-nav-context.js";
import { normalizePrmIntegerId } from "./costing-suite-production-route-helpers.js";

export const COSTING_PRM_NAV_CONTEXT_V1 = "COSTING_PRM_NAV_CONTEXT_V1";

/** Defined here, not in costing-feature-flags.js (shared N1 file). Only the exact value "1" enables it. */
export function isCostingPrmNavContextV1Enabled(storage = globalThis.localStorage) {
  try {
    return storage?.getItem?.(COSTING_PRM_NAV_CONTEXT_V1) === "1";
  } catch {
    return false;
  }
}

export const PRM_NAV_CONTEXT_KEYS = Object.freeze([
  "product_id",
  "product_route_id",
  "route_family_id",
  "family_route_id",
]);

/** Which stored ids each lens may receive. Every other lens receives nothing. */
export const PRM_LENS_CONTEXT_KEYS = Object.freeze({
  "product-route-assignments": Object.freeze(["product_id"]),
  "product-route-editor": Object.freeze(["product_id", "product_route_id"]),
  "effective-route-viewer": Object.freeze(["product_id"]),
  "route-family-route-editor": Object.freeze(["route_family_id", "family_route_id"]),
  "historical-candidate-review": Object.freeze(["product_id", "route_family_id"]),
});

const EMPTY = Object.freeze({
  product_id: null,
  product_route_id: null,
  route_family_id: null,
  family_route_id: null,
});

/** { product_id, product_route_id, route_family_id, family_route_id } as positive integers or null. */
export function normalizePrmNavIds(raw = {}) {
  const out = { ...EMPTY };
  for (const key of PRM_NAV_CONTEXT_KEYS) {
    const id = normalizePrmIntegerId(raw?.[key]);
    out[key] = id != null && id > 0 ? id : null;
  }
  return out;
}

/**
 * Merge the ids a lens loaded into the stored context (rules 2 and 3). Pure; returns a new object.
 * `loaded` holds only ids the lens established (null / missing = "not established").
 */
export function reconcilePrmNavContext(prev, loaded) {
  const p = normalizePrmNavIds(prev);
  const l = normalizePrmNavIds(loaded);
  const next = { ...p };
  const productChanged = l.product_id != null && l.product_id !== p.product_id;
  const familyChanged = l.route_family_id != null && l.route_family_id !== p.route_family_id;
  if (productChanged) {
    next.product_route_id = null;
    if (l.route_family_id == null) {
      next.route_family_id = null;
      next.family_route_id = null;
    }
  }
  if (familyChanged) {
    next.family_route_id = null;
    if (l.product_id == null) {
      next.product_id = null;
      next.product_route_id = null;
    }
  }
  for (const key of PRM_NAV_CONTEXT_KEYS) if (l[key] != null) next[key] = l[key];
  return next;
}

/**
 * Fill the missing ids of a deep link from the stored context (rules 4 and 5).
 * Returns { deepLink, injected } - deepLink is the SAME object when nothing is injected.
 */
export function hydratePrmDeepLink({ lensId, deepLink = {}, context = {} } = {}) {
  const keys = PRM_LENS_CONTEXT_KEYS[lensId];
  if (!keys) return { deepLink, injected: [] };
  const ctx = normalizePrmNavIds(context);
  const inc = normalizePrmNavIds(deepLink);
  // An explicit id that differs from the stored one means a different selection: store nothing alongside it.
  const conflict = PRM_NAV_CONTEXT_KEYS.some((k) => inc[k] != null && inc[k] !== ctx[k]);
  if (conflict) return { deepLink, injected: [] };
  const injected = [];
  for (const key of keys) {
    if (inc[key] != null || ctx[key] == null) continue;
    // A route id decides its own parent: never add the parent beside an explicit route id.
    if (key === "product_id" && inc.product_route_id != null) continue;
    if (key === "route_family_id" && inc.family_route_id != null) continue;
    // A route version is only valid together with its Product / Family in the stored context.
    if (key === "product_route_id" && ctx.product_id == null) continue;
    if (key === "family_route_id" && ctx.route_family_id == null) continue;
    injected.push(key);
  }
  if (!injected.length) return { deepLink, injected };
  const next = { ...deepLink };
  for (const key of injected) next[key] = ctx[key];
  return { deepLink: next, injected };
}

/**
 * Ids a successfully loaded lens established (rule 1). `view` is a plain snapshot supplied by the controller:
 *   { deepLink, productHeader, familyHeader, effectiveViewer }
 * Returns null for lenses that do not establish identity.
 */
export function collectPrmLoadedIds(lensId, view = {}) {
  const dl = normalizePrmNavIds(view.deepLink);
  switch (lensId) {
    case "product-route-editor": {
      const header = view.productHeader;
      const headerRouteId = header ? normalizePrmIntegerId(header.product_route_id ?? header.route_id ?? header.id) : null;
      const headerProductId = header ? normalizePrmIntegerId(header.product_id) : null;
      if (headerRouteId != null && headerProductId != null) {
        return { product_id: headerProductId, product_route_id: headerRouteId };
      }
      // Create / chooser flows: the Product is the selection, no route version is established.
      return dl.product_id != null && dl.product_route_id == null ? { product_id: dl.product_id } : null;
    }
    case "route-family-route-editor": {
      const header = view.familyHeader;
      const headerRouteId = header
        ? normalizePrmIntegerId(header.family_route_id ?? header.route_family_route_id ?? header.route_id ?? header.id)
        : null;
      const headerFamilyId = header ? normalizePrmIntegerId(header.route_family_id) : null;
      if (headerRouteId != null && headerFamilyId != null) {
        return { route_family_id: headerFamilyId, family_route_id: headerRouteId };
      }
      return dl.route_family_id != null && dl.family_route_id == null ? { route_family_id: dl.route_family_id } : null;
    }
    case "effective-route-viewer": {
      const ev = view.effectiveViewer;
      const productId = ev && ev.status === "ready" ? normalizePrmIntegerId(ev.productId) : null;
      if (productId == null) return null;
      return { product_id: productId, route_family_id: normalizePrmIntegerId(ev.payload?.route_family_id) };
    }
    case "product-route-assignments":
      return dl.product_id != null ? { product_id: dl.product_id } : null;
    case "historical-candidate-review":
      return dl.product_id != null || dl.route_family_id != null
        ? { product_id: dl.product_id, route_family_id: dl.route_family_id }
        : null;
    default:
      return null;
  }
}

/** Chip values for the N1 store ("" removes a chip). Names come from options already loaded; never invented. */
export function buildPrmNavChipValues(ids, names = {}) {
  const c = normalizePrmNavIds(ids);
  const label = (name, fallback, id) => {
    const n = String(name ?? "").trim();
    return n ? `${n} (#${id})` : `${fallback} #${id}`;
  };
  const route = [
    c.product_route_id != null ? `Product route #${c.product_route_id}` : "",
    c.family_route_id != null ? `Family route #${c.family_route_id}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    product: c.product_id != null ? label(names.product, "Product", c.product_id) : "",
    family: c.route_family_id != null ? label(names.family, "Family", c.route_family_id) : "",
    route,
  };
}

/**
 * Per-controller tracker. `isEnabled` is read on every call so the flag is honoured exactly; with it OFF every
 * method is an inert pass-through (hydrate returns the same deep link object).
 */
export function createPrmNavContextTracker({
  isEnabled = () => isCostingPrmNavContextV1Enabled(),
  store = costingNavContext,
  getNames = () => ({}),
} = {}) {
  let context = { ...EMPTY };
  const on = () => {
    try {
      return !!isEnabled();
    } catch {
      return false;
    }
  };
  const publish = () => {
    let names = {};
    try {
      names = getNames(context) || {};
    } catch {
      names = {};
    }
    store.set(buildPrmNavChipValues(context, names));
  };
  return {
    isEnabled: on,
    get: () => ({ ...context }),
    hydrate(lensId, deepLink) {
      if (!on()) return { deepLink, injected: [] };
      return hydratePrmDeepLink({ lensId, deepLink, context });
    },
    /** Commit what an ACCEPTED (non-stale, successful) lens load established. Returns true when context changed. */
    commit(lensId, view) {
      if (!on()) return false;
      const loaded = collectPrmLoadedIds(lensId, view);
      if (!loaded) return false;
      const next = reconcilePrmNavContext(context, loaded);
      const changed = PRM_NAV_CONTEXT_KEYS.some((k) => next[k] !== context[k]);
      context = next;
      publish(); // names may have arrived since the last commit
      return changed;
    },
    /** A user opened a Route Family (summary): explicit Family selection. */
    selectFamily(routeFamilyId) {
      if (!on()) return false;
      const id = normalizePrmIntegerId(routeFamilyId);
      if (id == null || id <= 0) return false;
      const next = reconcilePrmNavContext(context, { route_family_id: id });
      const changed = PRM_NAV_CONTEXT_KEYS.some((k) => next[k] !== context[k]);
      context = next;
      publish();
      return changed;
    },
    /** A hydrated id failed to load (e.g. the route no longer exists): forget exactly those ids. */
    invalidate(keys = []) {
      if (!on() || !keys.length) return false;
      const next = { ...context };
      for (const key of keys) {
        if (key in next) next[key] = null;
        // A dropped Product also drops its route version; a dropped Family its Family route.
        if (key === "product_id") next.product_route_id = null;
        if (key === "route_family_id") next.family_route_id = null;
      }
      const changed = PRM_NAV_CONTEXT_KEYS.some((k) => next[k] !== context[k]);
      context = next;
      publish();
      return changed;
    },
    /** Forget everything this tracker owns (controller destroy / explicit reset). Other store keys are untouched. */
    clear() {
      const had = PRM_NAV_CONTEXT_KEYS.some((k) => context[k] != null);
      context = { ...EMPTY };
      if (had || on()) store.set({ product: "", family: "", route: "" });
      return had;
    },
  };
}
