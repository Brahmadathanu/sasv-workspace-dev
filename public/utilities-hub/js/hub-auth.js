// public/utilities-hub/js/hub-auth.js
// =============================================================================
// SASV Utilities Hub — Auth + Access Control + Grid Rendering
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

/** Guard to prevent duplicate inserts */
let requesting = false;

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
        // Full access
        return `
          <article class="hub-card" tabindex="-1">
            <h3><a href="${u.href}">${safeText(u.label)}</a></h3>
            <p>${safeText(u.description)}</p>
          </article>`;
      }

      // Locked + request button (for 'view' and 'none')
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

      if (requesting) return;
      requesting = true;
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
      } finally {
        requesting = false;
      }
    });
  });
}

// Map utility keys to their local pages
const UTIL_URLS = {
  fill_planner: "../shared/fill-planner.html",
  stock_checker: "../shared/stock-checker.html",
};

async function loadUtilities() {
  // Preferred: hub_utilities (id, key, label, description)
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

  // If unauthorized, don't mask timing issues with a fallback
  if (error && (error.code === "401" || error.code === "403")) {
    throw error;
  }

  // Benign fallback (used only if table missing/empty)
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
      const level = String(row.level || "").toLowerCase(); // enum
      if (level === "use" || level === "view") map[id] = level;
    }
    return map;
  }

  // If unauthorized, let caller retry after session settles
  if (error && (error.code === "401" || error.code === "403")) {
    throw error;
  }

  // Benign fallback
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

/** Inline OTP UI helpers */
function showOtpUI(show) {
  const box = document.getElementById("hub-otp");
  if (box) box.style.display = show ? "flex" : "none";
}

async function sendOtpEmail() {
  const email = document.getElementById("otp-email")?.value?.trim();
  if (!email) return alert("Enter your work email.");
  try {
    await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: new URL(
          "/utilities-hub/auth/callback.html",
          location.origin
        ).href,
        shouldCreateUser: true,
      },
    });
    alert("We sent you a 6-digit code (and a link). Check your email.");
    localStorage.setItem("sasv_login_email", email);
  } catch (e) {
    console.error(e);
    alert("Could not send code. Try again.");
  }
}

async function verifyOtpCode() {
  const email =
    document.getElementById("otp-email")?.value?.trim() ||
    localStorage.getItem("sasv_login_email") ||
    "";
  const token = document.getElementById("otp-code")?.value?.trim();
  if (!email || !token) return alert("Enter email and the 6-digit code.");

  try {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email", // email login code
    });
    if (error) throw error;
    // Signed in — re-render hub
    await render();
    showOtpUI(false);
  } catch (e) {
    console.error(e);
    alert("Invalid or expired code. Try sending a new one.");
  }
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

/** Improved boot sequence */
async function boot() {
  setBusy(true);
  await waitForInitialSession(); // wait for auth to settle
  await render();
  // Safety revalidate after a short delay (covers edge token timing)
  setTimeout(() => {
    render().catch(console.error);
  }, 600);
}

// Hooks
btnLogout?.addEventListener("click", async () => {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("Sign-out failed:", err);
  }
  await render();
});

// Use inline OTP flow (no prompt-based login)
btnLogin?.addEventListener("click", () => {
  showOtpUI(true);
  document.getElementById("otp-email")?.focus();
});

document.getElementById("otp-send")?.addEventListener("click", sendOtpEmail);
document.getElementById("otp-verify")?.addEventListener("click", verifyOtpCode);

// Re-render on any auth change
supabase.auth.onAuthStateChange(() => {
  render().catch(console.error);
});

// Go!
boot().catch(console.error);
