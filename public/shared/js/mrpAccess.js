import { supabase } from "./supabaseClient.js";

let _ctx = null;

export async function loadAccessContext() {
  if (_ctx) return _ctx;
  _ctx = { loaded: false, roles: [], actor: null, hub_access: null };
  try {
    // get auth user snapshot if available
    /** ActorSnapshot shape (source of truth in types/supabase.ts) */
    let actor = { actor_id: null, actor_email: null, actor_display: null };
    try {
      if (supabase.auth && supabase.auth.getUser) {
        const { data: { user } = {} } = await supabase.auth.getUser();
        if (user) {
          actor.actor_id = user.id || null;
          actor.actor_email = user.email || null;
          actor.actor_display =
            user.user_metadata?.full_name || user.user_metadata?.name || null;
        }
      }
    } catch (e) {
      console.debug("mrpAccess: auth.getUser failed", e);
    }
    _ctx.actor = actor;

    // load canonical permissions via RPC if available; fall back to old tables
    if (actor.actor_id && typeof actor.actor_id === "string") {
      try {
        const { data: perms, error: permsErr } = await supabase.rpc(
          "get_user_permissions",
          { p_user_id: actor.actor_id }
        );

        if (!permsErr && perms) {
          // perms is expected to be an array of { target, can_view, can_edit, meta }
          const roles = new Set();
          const modules = {};
          for (const p of perms) {
            if (!p || !p.target) continue;
            const t = String(p.target || "");
            if (t.startsWith("role:")) {
              roles.add(t.slice(5));
            } else if (t.startsWith("module:")) {
              modules[t.slice(7)] = {
                can_view: !!p.can_view,
                can_edit: !!p.can_edit,
                meta: p.meta || null,
              };
            }
          }
          _ctx.roles = Array.from(roles);
          _ctx.module_permissions = modules;
          _ctx.hub_access = perms;
        } else {
          // RPC missing or errored; fall back to legacy queries
          await (async function legacyLoad() {
            try {
              const maybeUuid = String(actor.actor_id);
              const uuidLike = /^[0-9a-fA-F-]{20,}$/i.test(maybeUuid);
              if (!uuidLike) return;

              const { data: rows, error } = await supabase
                .from("hub_user_access")
                .select("level, hub_utilities(key)")
                .eq("user_id", actor.actor_id)
                .limit(200);
              if (!error && Array.isArray(rows)) {
                _ctx.hub_access = rows;
                const rset = new Set();
                for (const r of rows) {
                  const lvl = (r.level || "") + "";
                  const key = r.hub_utilities?.key || null;
                  if (!key) continue;
                  if (lvl && lvl.toLowerCase() !== "none") rset.add(key);
                }
                _ctx.roles = Array.from(rset);
              }

              // also merge user_permissions module flags as fallback
              try {
                const { data: ups, error: upErr } = await supabase
                  .from("user_permissions")
                  .select("user_id, module_id, can_view, can_edit")
                  .eq("user_id", actor.actor_id)
                  .limit(200);
                if (!upErr && Array.isArray(ups)) {
                  const modules = {};
                  for (const u of ups) {
                    modules[String(u.module_id)] = {
                      can_view: !!u.can_view,
                      can_edit: !!u.can_edit,
                    };
                  }
                  _ctx.module_permissions = modules;
                }
              } catch (e) {
                console.debug("mrpAccess: user_permissions query failed", e);
              }
            } catch (e) {
              console.debug("mrpAccess: legacyLoad failed", e);
            }
          })();
        }
      } catch (e) {
        console.debug("mrpAccess: get_user_permissions RPC failed", e);
      }
    }

    _ctx.loaded = true;
  } catch (err) {
    console.debug("mrpAccess: loadAccessContext error", err);
  }
  return _ctx;
}

export function canViewMRP() {
  if (!_ctx) return false;
  return true;
}

export function canEditPM() {
  if (!_ctx) return false;
  const r = _ctx.roles || [];
  if (r.includes("pm_planner") || r.includes("procurement_admin")) return true;
  // check canonical module permissions fallback
  try {
    const mods = _ctx.module_permissions || {};
    if (mods["pm-rebuild-dashboard"]?.can_edit) return true;
    if (mods["pm-rebuild"]?.can_edit) return true;
    // Accept a broader set of module edit permissions as implying PM edit rights.
    // Many users are granted module-level rights (e.g. "fill-planner", "manage-products")
    // which should allow editing PM master data like MOQ policies. Inspect module ids
    // and treat common management/edit modules as sufficient.
    for (const key of Object.keys(mods)) {
      try {
        if (!mods[key]?.can_edit) continue;
        const k = String(key || "").toLowerCase();
        if (
          k === "fill-planner" ||
          k.startsWith("manage-") ||
          k.includes("planner") ||
          k.includes("pm-") ||
          k.includes("product") ||
          k.includes("category")
        )
          return true;
      } catch {
        /* ignore malformed keys */
      }
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function canEditRM() {
  if (!_ctx) return false;
  const r = _ctx.roles || [];
  if (
    r.includes("rm_planner") ||
    r.includes("planner") ||
    r.includes("procurement_admin")
  )
    return true;
  try {
    const mods = _ctx.module_permissions || {};
    if (mods["rm-rebuild-dashboard"]?.can_edit) return true;
    if (mods["rm-rebuild"]?.can_edit) return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function canRunOverlay() {
  if (!_ctx) return false;
  const r = _ctx.roles || [];
  if (r.includes("rm_planner") || r.includes("procurement_admin")) return true;
  try {
    const mods = _ctx.module_permissions || {};
    // module id used in index.html is 'rm-seasonal-overlay'
    if (mods["rm-seasonal-overlay"]?.can_edit) return true;
    // also accept a generic rm overlay module id
    if (mods["rm-overlay"]?.can_edit) return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function isProcurementAdmin() {
  if (!_ctx) return false;
  const r = _ctx.roles || [];
  return r.includes("procurement_admin");
}

export function getActorSnapshot() {
  if (!_ctx) return { actor_id: null, actor_email: null, actor_display: null };
  return (
    _ctx.actor || { actor_id: null, actor_email: null, actor_display: null }
  );
}

export function actorLabel(rowOrActorFields) {
  if (!rowOrActorFields) return "-";
  const r = rowOrActorFields;
  if (r.display_name) return r.display_name;
  if (r.actor_display) return r.actor_display;
  if (r.actor_email) return r.actor_email;
  if (r.email) return r.email;
  if (r.actor_id) return String(r.actor_id).slice(0, 8);
  return "unknown";
}

/**
 * Backwards-compatible helper used by some modules to check edit rights by target string.
 * Common targets: 'mrp:masterdata:moq', 'mrp:masterdata:conversion', 'mrp:masterdata:season'
 */
export function canEditTarget(target) {
  try {
    if (!target) return false;
    // procurement admins can edit everything
    if (isProcurementAdmin()) return true;
    // masterdata MOQs and conversions typically handled by PM/procurement
    if (
      target.includes("moq") ||
      target.includes("conversion") ||
      target.includes("season")
    ) {
      return canEditPM() || canEditRM();
    }
    // default conservative: require PM or RM edit roles
    return canEditPM() || canEditRM();
  } catch (e) {
    console.debug("canEditTarget check failed", e);
    return false;
  }
}
