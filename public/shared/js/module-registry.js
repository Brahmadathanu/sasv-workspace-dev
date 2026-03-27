import { supabase } from "./supabaseClient.js";

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

function trimLeadingDots(value) {
  return value.replace(/^(\.\.\/|\.\/)+/, "");
}

export function normalizeClientRoute(routePath, clientKey) {
  const raw = safeString(routePath);
  if (!raw) return "";

  if (/^(https?:|mailto:|tel:|#)/i.test(raw)) {
    return raw;
  }

  if (clientKey === "pwa") {
    if (raw === "./admin.html") return raw;
    if (/^\.\.\/shared\//i.test(raw)) return raw;
    if (/^\.\.\/utilities-hub\//i.test(raw)) return raw;
    if (/^\/?public\//i.test(raw)) {
      return `/${raw.replace(/^\/?public\//i, "")}`;
    }
    if (/^\/?shared\//i.test(raw) || /^\/?utilities-hub\//i.test(raw)) {
      return raw.startsWith("/") ? raw : `/${raw}`;
    }
    return raw;
  }

  if (clientKey === "electron") {
    if (/^\/?public\//i.test(raw)) {
      return raw.replace(/^\//, "");
    }
    if (/^\.\.\/shared\//i.test(raw)) {
      return `public/${trimLeadingDots(raw).replace(/^shared\//i, "shared/")}`;
    }
    if (/^\.\/admin\.html$/i.test(raw)) {
      return "public/utilities-hub/admin.html";
    }
    if (/^\/?shared\//i.test(raw) || /^\/?utilities-hub\//i.test(raw)) {
      return `public/${raw.replace(/^\//, "")}`;
    }
  }

  return raw;
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

export async function loadNavigationSections() {
  let data;
  let error;

  ({ data, error } = await supabase
    .from("app_nav_sections")
    .select("key,label,sort_order,description")
    .eq("is_active", true)
    .order("sort_order", { ascending: true }));

  if (error) {
    ({ data, error } = await supabase
      .from("app_nav_sections")
      .select("key,label,sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }));
  }

  if (error) {
    throw error;
  }

  return (Array.isArray(data) ? data : []).map((row) => ({
    key: normalizeModuleKey(row.key),
    label: safeString(row.label),
    sortOrder: Number.isFinite(Number(row.sort_order))
      ? Number(row.sort_order)
      : 999,
    description: safeString(row.description),
  }));
}

export async function loadClientModuleRegistry(clientKey) {
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
    routePath: normalizeClientRoute(row.route_path, safeString(row.client_key)),
    clientKey: safeString(row.client_key),
  }));

  return rows;
}
