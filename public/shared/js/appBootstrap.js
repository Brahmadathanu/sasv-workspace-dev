import { supabase } from "./supabaseClient.js";
import { getCurrentUserContext, getMyPermissions } from "./appAuth.js";

// Centralized app bootstrap for session, user context, and permissions
export async function bootstrapApp(options = {}) {
  const {
    loginPage = "login.html",
    requireSession = true,
    setGlobals = true,
    debug = true,
  } = options || {};

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session ?? null;

    if (requireSession && !session) {
      if (debug)
        console.log("[appBootstrap] redirecting to login", { loginPage });
      location.href = loginPage;
      return { ok: false, reason: "no-session" };
    }

    if (debug)
      console.log("[appBootstrap] session ok", { hasSession: !!session });

    const userContext = await getCurrentUserContext();
    const rawPermissions = await getMyPermissions();

    const permissions = normalizePermissions(rawPermissions);

    if (setGlobals) {
      window.appSession = session;
      window.appUserContext = userContext;
      window.appPermissions = permissions;
    }

    if (debug)
      console.log("[appBootstrap] permissions loaded", {
        count: permissions.raw ? permissions.raw.length : 0,
      });

    return {
      ok: true,
      session,
      userContext,
      permissions,
    };
  } catch (e) {
    console.error("[appBootstrap] bootstrap failed", e);
    return { ok: false, reason: "error", error: e };
  }
}

function normalizePermissions(raw) {
  const entries = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const targets = new Set();
  const map = Object.create(null);

  const KNOWN_MODES = new Set([
    "view",
    "edit",
    "create",
    "delete",
    "manage",
    "own",
  ]);

  for (const p of entries) {
    let target = null;
    let mode = "view";

    if (typeof p === "string") {
      // try to detect forms like "target:mode" or "target:sub:mode"
      const parts = p.split(":");
      if (parts.length >= 3) {
        mode = parts.pop();
        target = parts.join(":");
      } else if (parts.length === 2) {
        if (KNOWN_MODES.has(parts[1])) {
          target = parts[0];
          mode = parts[1];
        } else {
          // Treat whole string as target (e.g. "module:foo")
          target = p;
          mode = "view";
        }
      } else {
        target = p;
      }
    } else if (p && typeof p === "object") {
      // support different key names
      target = p.target ?? p.p_target ?? p.permission ?? p.name ?? null;
      mode = p.mode ?? p.p_mode ?? p.action ?? "view";
    }

    if (!target) continue;
    targets.add(target);
    if (!map[target]) map[target] = new Set();
    map[target].add(mode || "view");
  }

  return { raw: entries, targets, map };
}

export function hasCachedPermission(target, mode = "view") {
  const perms = window?.appPermissions;
  if (!perms || !perms.map) return false;
  const entry = perms.map[target];
  if (!entry) return false;

  // entry is a Set of modes
  if (entry instanceof Set) {
    if (entry.has(mode)) return true;
    if (entry.has("*")) return true;
    // allow 'view' if any other broader permission exists? No, check explicitly only
    return false;
  }

  // If stored as array for some reason
  if (Array.isArray(entry)) return entry.includes(mode) || entry.includes("*");

  return false;
}

export default {
  bootstrapApp,
  hasCachedPermission,
};
