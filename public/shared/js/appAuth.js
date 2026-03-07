import { supabase } from "./supabaseClient.js";

// Simple shared auth / permission helpers for pages
// All functions use async/await and return plain values

export async function getCurrentUserContext() {
  try {
    const { data, error } = await supabase.rpc("app_get_current_user_context");
    if (error) {
      console.warn("[appAuth] getCurrentUserContext RPC error", error);
      // fallback to session
      const { data: sData } = await supabase.auth.getSession();
      const session = sData?.session ?? null;
      return {
        user_id: session?.user?.id ?? null,
        email: session?.user?.email ?? null,
        is_authenticated: !!session,
      };
    }

    // RPC is expected to return an object like { user_id, email, is_authenticated }
    const ctx = data ?? {};
    return {
      user_id: ctx.user_id ?? ctx.userId ?? null,
      email: ctx.email ?? null,
      is_authenticated: !!(
        ctx.is_authenticated ??
        ctx.isAuthenticated ??
        ctx.authenticated
      ),
    };
  } catch (e) {
    console.error("[appAuth] getCurrentUserContext failed", e);
    return { user_id: null, email: null, is_authenticated: false };
  }
}

export async function getMyPermissions() {
  try {
    const { data, error } = await supabase.rpc("app_get_my_permissions");
    if (error) {
      // If not authenticated, return empty array without noisy error
      if (/not authenticated|authentication/i.test(error.message || "")) {
        console.log("[appAuth] getMyPermissions: not authenticated");
        return [];
      }
      console.warn("[appAuth] getMyPermissions RPC error", error);
      return [];
    }

    // Expecting an array of permission strings or objects
    return Array.isArray(data) ? data : data ? [data] : [];
  } catch (e) {
    console.error("[appAuth] getMyPermissions failed", e);
    return [];
  }
}

export async function hasPermission(target, mode = "view") {
  try {
    console.log("[appAuth] checking permission", { target, mode });
    const { data, error } = await supabase.rpc("app_has_permission", {
      p_target: target,
      p_mode: mode,
    });
    console.log("[appAuth] permission RPC result", { data, error });
    if (error) {
      console.warn("[appAuth] hasPermission RPC error", error);
      return false;
    }

    // RPC may return boolean true/false or an object { allowed: true }
    if (typeof data === "boolean") return data;
    if (data && typeof data === "object") {
      if (typeof data.allowed === "boolean") return data.allowed;
      if (typeof data.allow === "boolean") return data.allow;
      return !!(data.allowed ?? data.allow ?? false);
    }
    // fallback: truthy data means allowed
    return !!data;
  } catch (e) {
    console.error("[appAuth] hasPermission failed", e);
    return false;
  }
}

export async function requireAuthAndPermission(
  target,
  mode = "view",
  loginPage = "login.html",
  deniedPage = "index.html",
) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session ?? null;
    if (!session) {
      console.log("[appAuth] session missing");
      // redirect to login
      location.href = loginPage;
      return { ok: false, reason: "no-session" };
    }

    const allowed = await hasPermission(target, mode);
    if (!allowed) {
      console.warn("[appAuth] permission denied", { target, mode });
      alert("Access denied: you do not have permission to view this page.");
      location.href = deniedPage;
      return { ok: false, reason: "denied" };
    }

    return { ok: true };
  } catch (e) {
    console.error("[appAuth] requireAuthAndPermission failed", e);
    return { ok: false, reason: "error" };
  }
}

export async function getSessionUserEmail() {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session ?? null;
    return session?.user?.email ?? null;
  } catch (e) {
    console.warn("[appAuth] getSessionUserEmail failed", e);
    return null;
  }
}

export default {
  getCurrentUserContext,
  getMyPermissions,
  hasPermission,
  requireAuthAndPermission,
  getSessionUserEmail,
};
