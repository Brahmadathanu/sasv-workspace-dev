// public/utilities-hub/js/hub-auth.js
// =============================================================================
// SASV Utilities Hub — Auth, Access Control, and Curated Utilities Grid
// Requires: ../../shared/js/supabaseClient.js (exporting `supabase`)
// Uses the canonical registry view `v_app_module_registry` as the sole
// navigation source for the PWA hub.
// =============================================================================

import { supabase } from "../../shared/js/supabaseClient.js";
import {
  buildPermissionMap,
  getModuleAccessLevel,
  loadClientModuleRegistry,
  loadNavigationSections,
  normalizeModuleKey,
  getModuleKeyAliases,
} from "../../shared/js/module-registry.js";
import {
  isLauncherPresentationV1Enabled,
  planSection,
  getContractEntry,
  matchModules,
  readPins,
  togglePin,
  resolveQuickAccess,
  scopeFromUser,
} from "../../shared/js/launcher-presentation.js";

// WP09 G2: ONE default-off flag (localStorage LAUNCHER_PRESENTATION_V1 === "1"). OFF = today's hub, unchanged.
const presentationOn = isLauncherPresentationV1Enabled();
if (presentationOn) {
  document.documentElement.dataset.launcherPresentation = "v1";
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "../shared/css/launcher-presentation.css";
  document.head.appendChild(css);
}

let activeRenderPromise = null;
let queuedRenderReason = null;
let lastRenderedSessionKey = null;
let presentationRenderVersion = 0;

function getSessionRenderKey(session) {
  return session?.user?.id || "anon";
}

async function getUserPermissions(userId) {
  if (!userId) return null;
  try {
    const { data, error } = await supabase.rpc("get_user_permissions", {
      p_user_id: userId,
    });
    if (error) {
      console.debug("getUserPermissions RPC error", error);
      return null;
    }
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.debug("getUserPermissions failed", e);
    return null;
  }
}

const elRoot = document.getElementById("hub-root");
const elEmpty = document.getElementById("hub-empty");
const elGreeting = document.getElementById("hub-greeting");
const elUserName = document.getElementById("hub-user-name");

const elLoginForm = document.getElementById("hub-login-form");
const elEmail = document.getElementById("auth-email");
const elPassword = document.getElementById("auth-password");
const elSignInBtn = document.getElementById("auth-signin");
const elAuthMsg = document.getElementById("auth-msg");

const elLoggedIn = document.getElementById("hub-logged-in");
const btnLogout = document.getElementById("hub-logout");

function setBusy(on) {
  elRoot?.setAttribute("aria-busy", on ? "true" : "false");
}

function safeText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function guessNameFromEmail(email) {
  if (!email) return "";
  const namePart = email.split("@")[0] || "";
  return namePart
    .replace(/[._-]+/g, " ")
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ""))
    .join(" ")
    .trim();
}

function showMsg(text, isError = false) {
  if (!elAuthMsg) return;
  elAuthMsg.textContent = text || "";
  elAuthMsg.style.color = isError ? "#b91c1c" : "#6b7280";
}

function clearMsgSoon(ms = 3000) {
  if (!elAuthMsg) return;
  setTimeout(() => {
    elAuthMsg.textContent = "";
  }, ms);
}

function formatSectionLabel(sectionKey) {
  const normalized = normalizeModuleKey(sectionKey);
  if (!normalized) return "Other";
  return normalized
    .split("-")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ");
}

function sortByCuration(a, b) {
  const sectionDelta = (a.sectionSort ?? 999) - (b.sectionSort ?? 999);
  if (sectionDelta !== 0) return sectionDelta;

  const orderDelta = (a.order ?? 999) - (b.order ?? 999);
  if (orderDelta !== 0) return orderDelta;

  return (a.label || "").localeCompare(b.label || "");
}

function renderMessageCard(title, message) {
  return `
    <article class="hub-card" role="status" aria-live="polite">
      <h3>${safeText(title)}</h3>
      <p>${safeText(message)}</p>
    </article>`;
}

// WP09 G2: subgroup headings + collapsible families for one section. Input is the already permission-filtered
// list for this section (accessLevel "none" never reaches here), so empty families/subgroups cannot exist.
function renderSectionPresentation(section, list, renderCard) {
  const sectionKey = list[0]?.sectionKey || "";
  const plan = planSection(list, sectionKey);
  let out = `
      <div class="hub-section" data-section-key="${safeText(sectionKey)}">
        <h3 class="hub-section-title">${safeText(section.label)}</h3>
        ${section.description ? `<p>${safeText(section.description)}</p>` : ""}`;
  plan.subgroups.forEach((sub) => {
    out += `<div class="hub-subgroup" data-subgroup="${safeText(sub.label)}" data-subgroup-fallback="${sub.fallback ? "true" : "false"}"><h4 class="hub-subgroup__title">${safeText(sub.label)}</h4><div class="hub-grid">`;
    sub.nodes.forEach((node) => {
      if (node.kind === "module") {
        out += renderCard(node.item);
        return;
      }
      const bodyId = `family-${node.id}`;
      const open = node.items.length === 1;
      out += `<div class="hub-family" data-family-id="${safeText(node.id)}"><button type="button" class="hub-family__toggle" aria-expanded="${open ? "true" : "false"}" aria-controls="${safeText(bodyId)}"><span class="hub-family__title">${safeText(node.label)}</span><span class="hub-family__count">${node.items.length}</span><span class="hub-family__chevron" aria-hidden="true"></span></button><div class="hub-family__body" id="${safeText(bodyId)}" role="group" aria-label="${safeText(node.label)}"${open ? "" : " hidden"}>${node.items.map(renderCard).join("")}</div></div>`;
    });
    out += "</div></div>";
  });
  return out + "</div>";
}

function renderUtilitiesSectioned(utilities, accessMap) {
  const bySection = new Map();
  utilities
    .map((utility) => ({
      ...utility,
      sectionLabel:
        utility.sectionLabel || formatSectionLabel(utility.sectionKey),
      sectionSort: utility.sectionSort ?? 999,
      order: utility.order ?? 999,
      accessLevel: accessMap[utility.id] || "none",
    }))
    .filter((utility) => utility.accessLevel !== "none")
    .forEach((utility) => {
      if (!bySection.has(utility.sectionLabel)) {
        bySection.set(utility.sectionLabel, {
          label: utility.sectionLabel,
          description: utility.sectionDescription || "",
          sort: utility.sectionSort ?? 999,
          items: [],
        });
      }
      const bucket = bySection.get(utility.sectionLabel);
      if (!bucket.description && utility.sectionDescription) {
        bucket.description = utility.sectionDescription;
      }
      bucket.sort = Math.min(bucket.sort, utility.sectionSort ?? 999);
      bucket.items.push(utility);
    });

  const sections = Array.from(bySection.values()).sort(
    (left, right) => left.sort - right.sort,
  );

  let html = "";
  sections.forEach((section) => {
    const list = section.items.sort(sortByCuration);
    if (!list.length) return;

    const renderCard = (utility) => {
      const isLockedView = utility.accessLevel === "view";
      const isReadEntry = utility.accessLevel === "read";
      const href = isLockedView ? "#" : utility.href;
      const title = isLockedView
        ? "View-only access. Contact admin for full access."
        : isReadEntry
          ? "Read-only access"
          : "";
      const action = isLockedView
        ? '<span class="hub-card-note">View only</span>'
        : isReadEntry
          ? '<span class="hub-card-note">Read only</span>'
          : "";

      return `
        <article class="hub-card${isLockedView ? " muted" : ""}" tabindex="-1">
          <h3><a href="${safeText(href)}" data-href="${safeText(utility.href)}" data-module-key="${safeText(utility.moduleKey)}"${isLockedView ? ' aria-disabled="true"' : ""}${title ? ` title="${safeText(title)}"` : ""}>${safeText(utility.label)}</a></h3>
          <p>${safeText(utility.description || "")}</p>
          ${action}
        </article>`;
    };

    if (!presentationOn) {
      html += `
      <div class="hub-section">
        <h3 class="hub-section-title">${safeText(section.label)}</h3>
        ${section.description ? `<p>${safeText(section.description)}</p>` : ""}
        <div class="hub-grid">`;
      list.forEach((utility) => {
        html += renderCard(utility);
      });
      html += "</div></div>";
    } else {
      html += renderSectionPresentation(section, list, renderCard);
    }
  });

  return (
    html ||
    renderMessageCard(
      "No tools available",
      "You do not currently have access to any tools. Contact admin.",
    )
  );
}

async function loadUtilities() {
  const [registryRows, sectionRows] = await Promise.all([
    loadClientModuleRegistry("pwa"),
    loadNavigationSections(),
  ]);
  const sectionMetaByKey = new Map();
  const sectionMetaByLabel = new Map();

  sectionRows.forEach((row) => {
    sectionMetaByKey.set(row.key, row);
    if (row.label) {
      sectionMetaByLabel.set(row.label, row);
    }
  });

  return registryRows.map((row) => {
    const sectionLabel = row.sectionLabel || formatSectionLabel(row.sectionKey);
    const sectionMeta =
      sectionMetaByKey.get(row.sectionKey) ||
      sectionMetaByLabel.get(sectionLabel) ||
      null;

    return {
      id: row.moduleKey,
      key: row.moduleKey,
      moduleKey: row.moduleKey,
      label: row.label,
      description: row.description || "",
      href: row.routePath || "#",
      sectionKey: row.sectionKey,
      sectionLabel,
      sectionDescription: sectionMeta?.description || "",
      sectionSort: sectionMeta?.sortOrder ?? 999,
      order: row.sortOrder ?? 999,
      minNavMode: row.minNavMode || "view",
    };
  });
}

async function loadAccessMap(userId, utilities) {
  const map = {};
  utilities.forEach((utility) => {
    map[utility.id] = "none";
  });
  if (!userId) return map;

  try {
    const perms = await getUserPermissions(userId);
    if (!perms) return map;

    const permissionMap = buildPermissionMap(perms);
    utilities.forEach((utility) => {
      map[utility.id] = getModuleAccessLevel(
        { moduleKey: utility.moduleKey, minNavMode: utility.minNavMode },
        permissionMap,
      );
    });
  } catch (e) {
    console.debug("loadAccessMap RPC failed", e);
  }

  return map;
}

async function showGreeting(session) {
  if (!elGreeting || !elUserName) return;

  if (!session?.user) {
    elGreeting.style.display = "none";
    elUserName.textContent = "";
    return;
  }

  const displayName =
    session.user.user_metadata?.full_name ||
    guessNameFromEmail(session.user.email) ||
    "there";

  elUserName.textContent = displayName;
  elGreeting.style.display = "";
}

function updateAuthUI(session) {
  const signedIn = !!session?.user;
  if (elLoginForm) elLoginForm.style.display = signedIn ? "none" : "flex";
  if (elLoggedIn) elLoggedIn.style.display = signedIn ? "flex" : "none";
  if (!signedIn && elPassword) elPassword.value = "";
}

async function signInWithPassword(event) {
  event?.preventDefault?.();
  const email = elEmail?.value?.trim();
  const password = elPassword?.value ?? "";

  if (!email || !password) {
    showMsg("Enter email and password.", true);
    clearMsgSoon();
    return;
  }

  if (elSignInBtn) elSignInBtn.disabled = true;
  showMsg("Signing in…");
  try {
    const { data: signInResult, error } =
      await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const msg = /invalid/.test(error.message || "")
        ? "Invalid email or password."
        : error.message || "Sign-in failed.";
      showMsg(msg, true);
      clearMsgSoon(4000);
      return;
    }

    console.log("Signed in:", signInResult);
    showMsg("Signed in.");
    clearMsgSoon();
  } catch (e) {
    console.error(e);
    showMsg("Sign-in failed. Try again.", true);
    clearMsgSoon(4000);
  } finally {
    if (elSignInBtn) elSignInBtn.disabled = false;
  }
}

async function signUpWithPassword(event) {
  event?.preventDefault?.();
  const email = elEmail?.value?.trim();
  const password = elPassword?.value ?? "";

  if (!email || !password) {
    showMsg("Enter email and a new password.", true);
    clearMsgSoon();
    return;
  }

  if (elSignInBtn) elSignInBtn.disabled = true;
  showMsg("Creating account…");

  try {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: new URL(
          "/utilities-hub/auth/callback.html",
          location.origin,
        ).href,
      },
    });

    if (error) {
      if ((error.message || "").toLowerCase().includes("exists")) {
        showMsg(
          "Account already exists. Use Sign in or Forgot password.",
          true,
        );
      } else {
        showMsg(error.message || "Sign-up failed.", true);
      }
      clearMsgSoon(5000);
      return;
    }

    showMsg("Account created. Check your email if confirmation is required.");
    clearMsgSoon(6000);
  } catch (e) {
    console.error(e);
    showMsg("Sign-up failed. Try again.", true);
    clearMsgSoon(5000);
  } finally {
    if (elSignInBtn) elSignInBtn.disabled = false;
  }
}

async function sendPasswordReset(event) {
  event?.preventDefault?.();
  const email = elEmail?.value?.trim();
  if (!email) {
    showMsg("Enter your email first.", true);
    clearMsgSoon();
    return;
  }

  showMsg("Sending reset email…");
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: new URL("/utilities-hub/auth/callback.html", location.origin)
        .href,
    });
    if (error) throw error;
    showMsg("Check your email for the reset link.");
    clearMsgSoon(6000);
  } catch (e) {
    console.error(e);
    showMsg("Could not send reset email.", true);
    clearMsgSoon(5000);
  }
}

async function logoutFlow() {
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.warn("Sign-out failed:", e);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// WP09 G2 (flag ON only): shared search + per-user LOCAL Quick Access for the PWA.
// All data below is derived from the permission-filtered utilities of the CURRENT render; nothing is cached across users.
const hubTools = { root: null, scope: "guest", entries: [], bound: false };

function ensureHubToolsRoot() {
  if (hubTools.root) return hubTools.root;
  if (!elRoot?.parentNode) return null;
  const root = document.createElement("section");
  root.id = "hub-tools";
  root.className = "hub-tools";
  root.setAttribute("aria-label", "Search and Quick Access");
  elRoot.parentNode.insertBefore(root, elRoot);
  hubTools.root = root;
  return root;
}

function clearHubTools() {
  hubTools.scope = "guest";
  hubTools.entries = [];
  if (hubTools.root) hubTools.root.innerHTML = "";
}

function buildHubEntries(utilities, accessMap) {
  return utilities
    .filter((utility) => (accessMap[utility.id] || "none") !== "none")
    .map((utility) => {
      const level = accessMap[utility.id];
      const contract = getContractEntry(utility.moduleKey, utility.sectionKey);
      return {
        moduleKey: utility.moduleKey,
        label: utility.label,
        description: utility.description || "",
        subgroup: contract ? contract.subgroup : "",
        aliases: getModuleKeyAliases(utility.moduleKey),
        locked: level === "view",
        href: level === "view" ? "#" : utility.href || "#",
        accessLevel: level,
      };
    });
}

function renderHubQuickAccess() {
  const host = hubTools.root?.querySelector("#hub-quick");
  if (!host) return;
  const pinned = resolveQuickAccess(readPins(globalThis.localStorage, hubTools.scope), hubTools.entries);
  host.innerHTML = pinned.length
    ? `<h3 class="hub-quick__title">Quick Access</h3><ul class="hub-quick__list">${pinned
        .map(
          (entry) =>
            `<li class="hub-quick__item"><a href="${safeText(entry.href)}" data-module-key="${safeText(entry.moduleKey)}">${safeText(entry.label)}</a><button type="button" class="hub-pin" data-action="unpin" data-module-key="${safeText(entry.moduleKey)}" aria-pressed="true" aria-label="Unpin ${safeText(entry.label)} from Quick Access" title="Unpin from Quick Access">&#9733;</button></li>`,
        )
        .join("")}</ul><p class="hub-search__note">Quick Access is personal to this browser and only shows tools you can open.</p>`
    : `<h3 class="hub-quick__title">Quick Access</h3><p class="hub-quick__empty">No pins yet. Search for a tool and pin it.</p>`;
}

function renderHubSearchResults(query) {
  const list = hubTools.root?.querySelector("#hub-search-results");
  if (!list) return;
  const pins = new Set(readPins(globalThis.localStorage, hubTools.scope));
  const hits = String(query || "").trim() ? matchModules(query, hubTools.entries) : [];
  if (!String(query || "").trim()) {
    list.innerHTML = "";
    return;
  }
  list.innerHTML = hits.length
    ? hits
        .map((entry) => {
          const key = normalizeModuleKey(entry.moduleKey);
          const pinned = pins.has(key);
          const pinBtn = entry.locked
            ? '<span class="hub-card-note">View only</span>'
            : `<button type="button" class="hub-pin" data-action="pin" data-module-key="${safeText(entry.moduleKey)}" aria-pressed="${pinned ? "true" : "false"}" aria-label="${pinned ? "Unpin" : "Pin"} ${safeText(entry.label)} ${pinned ? "from" : "to"} Quick Access" title="${pinned ? "Unpin from" : "Pin to"} Quick Access">&#9733;</button>`;
          return `<li class="hub-search__result"${entry.locked ? ' aria-disabled="true"' : ""} data-module-key="${safeText(entry.moduleKey)}"><a href="${safeText(entry.href)}"${entry.locked ? ' aria-disabled="true"' : ""} data-module-key="${safeText(entry.moduleKey)}">${safeText(entry.label)}</a>${pinBtn}</li>`;
        })
        .join("")
    : '<li class="hub-search__note">No matching tools.</li>';
}

function bindHubToolsOnce(root) {
  if (hubTools.bound) return;
  hubTools.bound = true;
  root.addEventListener("input", (event) => {
    if (event.target?.id === "hub-search-input") renderHubSearchResults(event.target.value);
  });
  root.addEventListener("click", (event) => {
    const disabled = event.target.closest?.("a[aria-disabled='true']");
    if (disabled) {
      event.preventDefault();
      return;
    }
    const btn = event.target.closest?.("button.hub-pin");
    if (!btn) return;
    const key = normalizeModuleKey(btn.dataset.moduleKey || "");
    const entry = hubTools.entries.find((e) => normalizeModuleKey(e.moduleKey) === key);
    // Pins require an enabled, routable module that is visible to the CURRENT user.
    if (!entry || entry.locked || !entry.href || entry.href === "#") return;
    togglePin(globalThis.localStorage, hubTools.scope, key);
    renderHubQuickAccess();
    renderHubSearchResults(root.querySelector("#hub-search-input")?.value || "");
  });
  // Delegated family toggle (keyboard-accessible native buttons).
  elRoot?.addEventListener("click", (event) => {
    const toggle = event.target.closest?.(".hub-family__toggle");
    if (!toggle) return;
    const body = toggle.parentElement?.querySelector(".hub-family__body");
    if (!body) return;
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    body.hidden = !open;
  });
}

function renderHubTools(session, utilities, accessMap) {
  const root = ensureHubToolsRoot();
  if (!root) return;
  hubTools.scope = scopeFromUser(session?.user);
  hubTools.entries = buildHubEntries(utilities, accessMap);
  root.innerHTML = `<label class="hub-search__note" for="hub-search-input">Search tools by name, description, group or former name</label><input id="hub-search-input" class="hub-search__input" type="search" autocomplete="off" placeholder="Search tools" aria-controls="hub-search-results"><ul id="hub-search-results" class="hub-search__results" aria-live="polite"></ul><div id="hub-quick" class="hub-quick"></div>`;
  renderHubQuickAccess();
  bindHubToolsOnce(root);
}

async function performRender() {
  const renderVersion = presentationRenderVersion;
  setBusy(true);
  if (elEmpty) elEmpty.style.display = "none";

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (presentationOn && renderVersion !== presentationRenderVersion) return;
  lastRenderedSessionKey = getSessionRenderKey(session);

  updateAuthUI(session);
  await showGreeting(session);
  if (presentationOn && renderVersion !== presentationRenderVersion) return;

  if (!session?.user) {
    if (presentationOn) clearHubTools();
    if (elRoot) {
      elRoot.innerHTML = renderMessageCard(
        "Sign in required",
        "Sign in to view available utilities and request access.",
      );
    }
    if (elEmpty) elEmpty.style.display = "none";
    setBusy(false);
    return;
  }

  let utilities;
  let accessMap;
  try {
    utilities = await loadUtilities();
    accessMap = await loadAccessMap(session?.user?.id, utilities);
  } catch (error) {
    if (presentationOn && renderVersion !== presentationRenderVersion) return;
    console.error("Failed to load PWA module registry", error);
    if (presentationOn) clearHubTools();
    if (elRoot) {
      elRoot.innerHTML = renderMessageCard(
        "Module registry unavailable",
        "Tools could not be loaded right now. Contact admin if this keeps happening.",
      );
    }
    if (elEmpty) elEmpty.style.display = "none";
    setBusy(false);
    return;
  }

  // An identity/revalidation signal can arrive while the old permission request
  // is pending. Only the latest requested render may publish launcher state.
  if (presentationOn && renderVersion !== presentationRenderVersion) return;
  if (elRoot) {
    elRoot.innerHTML = renderUtilitiesSectioned(utilities, accessMap);
    elRoot.classList.remove("hub-grid");
    elRoot.classList.add("hub-root-sectioned");
  }
  if (presentationOn) renderHubTools(session, utilities, accessMap);
  const hasVisible = utilities.some(
    (utility) => (accessMap[utility.id] || "none") !== "none",
  );
  if (elEmpty) elEmpty.style.display = hasVisible ? "none" : "";

  setBusy(false);
}

async function render(reason = "manual") {
  if (presentationOn) {
    presentationRenderVersion++;
    clearHubTools();
    if (elRoot) elRoot.innerHTML = "";
  }
  if (activeRenderPromise) {
    queuedRenderReason = reason;
    return activeRenderPromise;
  }

  activeRenderPromise = (async () => {
    let nextReason = reason;

    while (nextReason) {
      queuedRenderReason = null;
      await performRender();
      nextReason = queuedRenderReason;
    }
  })();

  try {
    await activeRenderPromise;
  } finally {
    activeRenderPromise = null;
  }
}

function handleSignedInSignal(reason) {
  render(reason).catch(console.error);
}

function wireEvents() {
  elLoginForm?.addEventListener("submit", signInWithPassword);
  btnLogout?.addEventListener("click", logoutFlow);

  elRoot?.addEventListener("click", (event) => {
    const link =
      event.target.closest && event.target.closest("a[aria-disabled='true']");
    if (!link) return;
    event.preventDefault();
    event.stopPropagation();
    alert(
      "This module is view-only for your account. Contact admin for full access.",
    );
  });

  document
    .getElementById("auth-signup")
    ?.addEventListener("click", signUpWithPassword);
  document
    .getElementById("auth-forgot")
    ?.addEventListener("click", sendPasswordReset);

  try {
    const authChannel = new BroadcastChannel("sasv-auth");
    authChannel.addEventListener("message", (event) => {
      if (event?.data?.type === "signed-in") {
        handleSignedInSignal("broadcast:signed-in");
      }
    });
  } catch {
    // BroadcastChannel is not available on all mobile browsers.
  }

  navigator.serviceWorker?.addEventListener("message", (event) => {
    if (event?.data?.type === "signed-in") {
      handleSignedInSignal("sw:signed-in");
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      handleSignedInSignal("visibilitychange");
    }
  });

  window.addEventListener("pageshow", () => {
    handleSignedInSignal("pageshow");
  });

  supabase.auth.onAuthStateChange((event, session) => {
    const sessionKey = getSessionRenderKey(session);

    if (event === "INITIAL_SESSION") {
      return;
    }

    if (event === "SIGNED_IN" && activeRenderPromise &&
        (!presentationOn || sessionKey === lastRenderedSessionKey)) {
      return;
    }

    if (sessionKey === lastRenderedSessionKey) {
      return;
    }

    render(`auth:${event}`).catch(console.error);
  });
}

(async function boot() {
  try {
    wireEvents();
    await render("boot");
  } catch (e) {
    console.error(e);
    showMsg("Something went wrong. Reload the page.", true);
  }
})();
