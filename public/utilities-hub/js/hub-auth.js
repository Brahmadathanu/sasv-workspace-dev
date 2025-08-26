// public/utilities-hub/js/hub-auth.js
// =============================================================================
// SASV Utilities Hub — Auth + Access Control + Grid Rendering (Magic-link only)
// Requires: ../../shared/js/supabaseClient.js (exporting `supabase`)
// DOM: #hub-root, #hub-empty, #hub-greeting, #hub-user-name, #hub-login, #hub-logout
// DB tables:
//   hub_utilities(id, key, label, description)
//   hub_user_access(user_id, utility_id, level enum: 'none'|'view'|'use')
//   hub_access_requests(id, user_id, utility_id, note, status)
// =============================================================================

import { supabase } from "../../shared/js/supabaseClient.js";

/** DOM refs */
const elRoot = document.getElementById("hub-root");
const elEmpty = document.getElementById("hub-empty");
const elGreeting = document.getElementById("hub-greeting");
const elUserName = document.getElementById("hub-user-name");
const btnLogin = document.getElementById("hub-login");
const btnLogout = document.getElementById("hub-logout");

/** Wait for Supabase to fire the INITIAL_SESSION event once */
function waitForInitialSession() {
  return new Promise((resolve) => {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") resolve(session || null);
    });
  });
}

/** Helpers */
function setBusy(on) {
  elRoot?.setAttribute("aria-busy", on ? "true" : "false");
}
function safeText(s) {
  return String(s ?? "");
}
function guessNameFromEmail(email) {
  if (!email) return "";
  const namePart = email.split("@")[0] || "";
  return namePart
    .replace(/[._-]+/g, " ")
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ")
    .trim();
}
function renderMessageCard(title, message) {
  return `
    <article class="hub-card" role="status" aria-live="polite">
      <h3>${safeText(title)}</h3>
      <p>${safeText(message)}</p>
    </article>`;
}

/** Map utility keys to their local pages */
const UTIL_URLS = {
  fill_planner: "../shared/fill-planner.html",
  stock_checker: "../shared/stock-checker.html",
  hub_admin: "./admin.html",
};

/** Render utilities grid */
function renderUtilities(utilities, accessMap) {
  if (!utilities?.length) {
    return renderMessageCard(
      "No tools yet",
      "Please contact admin to add utilities."
    );
  }

  return utilities
    .map((u) => {
      const access = accessMap[u.id] || "none";
      if (access === "use") {
        return `
          <article class="hub-card" tabindex="-1">
            <h3><a href="${u.href}">${safeText(u.label)}</a></h3>
            <p>${safeText(u.description)}</p>
          </article>`;
      }
      // Show locked + Request access button for 'view' and 'none'
      return `
        <article class="hub-card" tabindex="-1">
          <h3><span aria-label="Locked">${safeText(u.label)} 🔒</span></h3>
          <p>${safeText(u.description)}</p>
          <button class="button" data-request="${u.id}" data-key="${
        u.key
      }">Request access</button>
        </article>`;
    })
    .join("");
}

/** Wire "Request access" buttons */
function wireRequestButtons(session) {
  if (!elRoot) return;
  elRoot.querySelectorAll("[data-request]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const utilityId = btn.getAttribute("data-request");
      const key = btn.getAttribute("data-key") || "";
      if (!utilityId || !session?.user) return;

      btn.disabled = true;
      try {
        const note = key
          ? `Requested via Utilities Hub for: ${key.replace("_", "-")}`
          : "Requested via Utilities Hub";
        const { error } = await supabase.from("hub_access_requests").insert({
          user_id: session.user.id,
          utility_id: utilityId,
          note,
          status: "pending",
        });
        if (error) throw error;
        btn.textContent = "Requested ✓";
      } catch {
        alert("Could not send request. Please try again.");
        btn.disabled = false;
      }
    });
  });
}

/** Data: utilities & access */
async function loadUtilities() {
  const { data, error } = await supabase
    .from("hub_utilities")
    .select("id, key, label, description")
    .order("label", { ascending: true });

  if (!error && Array.isArray(data) && data.length) {
    return data.map((r) => ({
      id: String(r.id),
      key: r.key,
      label: r.label,
      description: r.description || "",
      href: UTIL_URLS[r.key] || "#",
    }));
  }

  if (error && (error.code === "401" || error.code === "403")) {
    throw error; // auth timing, let caller retry
  }

  // Benign fallback (only if table missing/empty)
  return [
    {
      id: "fill-planner",
      key: "fill_planner",
      label: "Fill Planner",
      description:
        "Plan fills from bulk with emergency SKU deductions + MOS context.",
      href: UTIL_URLS.fill_planner,
    },
    {
      id: "stock-checker",
      key: "stock_checker",
      label: "Stock Checker",
      description:
        "Quick search with filters and CSV export for stock/forecast/MOS.",
      href: UTIL_URLS.stock_checker,
    },
  ];
}

async function loadAccessMap(userId, utilities) {
  const map = {};
  utilities.forEach((u) => (map[u.id] = "none"));
  if (!userId) return map;

  const { data, error } = await supabase
    .from("hub_user_access")
    .select("utility_id, level")
    .eq("user_id", userId);

  if (!error && Array.isArray(data)) {
    for (const row of data) {
      const id = String(row.utility_id);
      if (!(id in map)) continue;
      const level = String(row.level || "").toLowerCase();
      if (level === "use" || level === "view") map[id] = level;
    }
    return map;
  }

  if (error && (error.code === "401" || error.code === "403")) {
    throw error;
  }

  utilities.forEach((u) => (map[u.id] = "view"));
  return map;
}

/** Greeting */
async function showGreeting(session) {
  if (!elGreeting || !elUserName) return;

  if (!session?.user) {
    elGreeting.style.display = "none";
    elUserName.textContent = "";
    return;
  }

  let displayName = "";
  try {
    const { data, error } = await supabase
      .from("sasv_users")
      .select("display_name")
      .eq("user_id", session.user.id)
      .limit(1)
      .maybeSingle();

    if (!error && data?.display_name) displayName = data.display_name;
  } catch {
    /* ignore */
  }

  if (!displayName) {
    displayName =
      session.user.user_metadata?.full_name ||
      guessNameFromEmail(session.user.email) ||
      "there";
  }

  elUserName.textContent = displayName;
  elGreeting.style.display = "";
}

/** Auth buttons */
function updateAuthButtons(session) {
  if (btnLogin) btnLogin.style.display = session?.user ? "none" : "";
  if (btnLogout) btnLogout.style.display = session?.user ? "" : "none";
}

/** Login (magic link only) */
async function loginFlow() {
  const email = prompt("Enter your work email to sign in:");
  if (!email) return;

  try {
    const redirectTo = new URL(
      "/utilities-hub/auth/callback.html",
      window.location.origin
    ).href;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    });
    if (error) throw error;
    alert("Check your email for a sign-in link.");
  } catch (err) {
    console.error(err);
    alert("Sign-in failed. Please try again.");
  }
}

/** Logout */
async function logoutFlow() {
  try {
    await supabase.auth.signOut();
  } catch {
    /* ignore */
  }
  await render();
}

/** Main render cycle */
async function render() {
  setBusy(true);
  if (elEmpty) elEmpty.style.display = "none";

  const {
    data: { session },
  } = await supabase.auth.getSession();

  updateAuthButtons(session);
  await showGreeting(session);

  let utilities, accessMap;
  try {
    utilities = await loadUtilities();
    accessMap = await loadAccessMap(session?.user?.id, utilities);
  } catch {
    // auth not ready yet → soft loading, boot() will re-render shortly
    elRoot.innerHTML = renderMessageCard("Loading…", "Preparing your tools.");
    setBusy(false);
    return;
  }

  if (elRoot) elRoot.innerHTML = renderUtilities(utilities, accessMap);

  const hasVisible = Object.values(accessMap).some(
    (v) => v === "use" || v === "view"
  );
  if (elEmpty) elEmpty.style.display = hasVisible ? "none" : "";

  wireRequestButtons(session);
  setBusy(false);
}

/** Boot */
async function boot() {
  setBusy(true);
  await waitForInitialSession(); // wait for auth to settle
  await render();
  // Revalidate once more soon (covers token timing)
  setTimeout(() => {
    render().catch(console.error);
  }, 600);
}

/** Hooks */
btnLogin?.addEventListener("click", loginFlow);
btnLogout?.addEventListener("click", logoutFlow);

/** Re-render on any auth change */
supabase.auth.onAuthStateChange(() => {
  render().catch(console.error);
});

/** Receive "signed-in" messages from callback.html (when link opened in browser) */
try {
  const bc = new BroadcastChannel("sasv-auth");
  bc.onmessage = (e) => {
    if (e?.data?.type === "signed-in") {
      render().catch(console.error);
    }
  };
} catch {
  // BroadcastChannel not supported — harmless.
}
// Service Worker message fallback
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (ev) => {
    if (ev.data?.type === "signed-in") {
      render().catch(console.error);
    }
  });
}

// Go!
boot().catch(console.error);
