import { supabase } from "./supabaseClient.js";

const MODULE_REGISTRY_DEBUG_ENABLED = globalThis.__APP_MODULE_DEBUG__ !== false;

function moduleRegistryDebug(event, details) {
  if (!MODULE_REGISTRY_DEBUG_ENABLED) return;
  console.log(`[ModuleRegistryDebug] ${event}`, details || {});
}

function setModuleRegistryDebugState(key, value) {
  if (!MODULE_REGISTRY_DEBUG_ENABLED) return;
  globalThis.__APP_MODULE_DEBUG_STATE__ ||= {};
  globalThis.__APP_MODULE_DEBUG_STATE__[key] = value;
}

const MODULE_KEY_ALIASES = Object.freeze({
  "hub-admin": "admin-console",
  hub_admin: "admin-console",
  "etl-monitor": "operations-monitor",
  etl_monitor: "operations-monitor",
  "etl-control": "operations-control",
  etl_control: "operations-control",
  "sales-viewer": "sales-data-viewer",
  sales_viewer: "sales-data-viewer",
  "view-log": "view-logs",
  view_log: "view-logs",
});

function safeString(value) {
  return String(value ?? "").trim();
}

export function normalizeModuleKey(value) {
  const raw = safeString(value).toLowerCase();
  if (!raw) return "";
  const normalized = raw.replace(/_/g, "-");
  return MODULE_KEY_ALIASES[normalized] || normalized;
}

export function targetToModuleKey(targetKey) {
  const raw = safeString(targetKey);
  if (!raw) return "";
  if (raw.startsWith("module:")) return normalizeModuleKey(raw.slice(7));
  if (raw.startsWith("role:")) return normalizeModuleKey(raw.slice(5));
  return normalizeModuleKey(raw);
}

export function buildPermissionMap(perms) {
  const map = Object.create(null);
  for (const perm of Array.isArray(perms) ? perms : []) {
    if (!perm || !perm.target) continue;
    const moduleKey = targetToModuleKey(perm.target);
    if (!moduleKey) continue;
    if (!map[moduleKey]) {
      map[moduleKey] = { can_view: false, can_edit: false };
    }
    map[moduleKey].can_view = map[moduleKey].can_view || !!perm.can_view;
    map[moduleKey].can_edit = map[moduleKey].can_edit || !!perm.can_edit;
  }
  moduleRegistryDebug("buildPermissionMap", {
    inputCount: Array.isArray(perms) ? perms.length : 0,
    moduleCount: Object.keys(map).length,
    modules: Object.entries(map).map(([moduleKey, access]) => ({
      moduleKey,
      canView: !!access.can_view,
      canEdit: !!access.can_edit,
    })),
  });
  return map;
}

export function getModuleAccessLevel(moduleLike, permissionMap) {
  const moduleKey = normalizeModuleKey(
    typeof moduleLike === "string"
      ? moduleLike
      : moduleLike?.moduleKey || moduleLike?.targetKey || moduleLike?.key,
  );
  if (!moduleKey) return "none";

  const minNavMode =
    safeString(
      typeof moduleLike === "object" ? moduleLike?.minNavMode : "view",
    ).toLowerCase() || "view";
  const permission = permissionMap?.[moduleKey];
  if (!permission) return "none";
  if (permission.can_edit) return "use";
  if (permission.can_view && minNavMode !== "edit") return "view";
  return "none";
}

export async function loadClientModuleRegistry(clientKey) {
  moduleRegistryDebug("loadClientModuleRegistry:start", { clientKey });
  const { data, error } = await supabase
    .from("v_app_module_registry")
    .select(
      "module_key,target_key,label,description,section_key,section_label,sort_order,min_nav_mode,route_path,nav_enabled,client_key",
    )
    .eq("client_key", clientKey)
    .eq("nav_enabled", true)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (error) {
    moduleRegistryDebug("loadClientModuleRegistry:error", {
      clientKey,
      message: error.message,
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
    throw error;
  }

  const rows = (Array.isArray(data) ? data : []).map((row) => ({
    moduleKey: normalizeModuleKey(row.module_key || row.target_key),
    targetKey: safeString(row.target_key),
    label: safeString(row.label),
    description: safeString(row.description),
    sectionKey: safeString(row.section_key),
    sectionLabel: safeString(row.section_label),
    sortOrder: Number.isFinite(Number(row.sort_order))
      ? Number(row.sort_order)
      : 999,
    minNavMode: safeString(row.min_nav_mode).toLowerCase() || "view",
    routePath: safeString(row.route_path),
    clientKey: safeString(row.client_key),
  }));

  setModuleRegistryDebugState(`registry:${clientKey}`, rows);
  moduleRegistryDebug("loadClientModuleRegistry:success", {
    clientKey,
    rowCount: rows.length,
    rows: rows.map((row) => ({
      moduleKey: row.moduleKey,
      label: row.label,
      sectionLabel: row.sectionLabel,
      minNavMode: row.minNavMode,
      routePath: row.routePath,
    })),
  });

  return rows;
}
