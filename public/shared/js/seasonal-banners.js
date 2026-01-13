// seasonal-banners.js — injects a small banner for Christmas / New Year
// NOTE: temporary debug logs to help diagnose visibility issue on login page
(function () {
  try {
    console.log("seasonal-banners: script loaded");
  } catch {
    void 0;
  }
  const now = new Date();
  const y = now.getFullYear();
  const mm = now.getMonth() + 1; // 1-12
  const dd = now.getDate();

  // Christmas window: Dec 1 .. Dec 26 (inclusive)
  const isChristmas = mm === 12 && dd >= 1 && dd <= 26;

  // New Year window: 5 days before Jan 1 through Jan 2 (inclusive)
  // That means: Dec 27..Dec31 and Jan 1..Jan 2
  const isNewYear =
    (mm === 12 && dd >= 27 && dd <= 31) || (mm === 1 && dd <= 2);

  if (!isChristmas && !isNewYear) return; // nothing to show

  const cls = isChristmas ? "christmas" : "newyear";
  const emoji = isChristmas ? "🎄" : "🎉";
  const text = isChristmas
    ? `Merry Christmas! Thanks for using the app — enjoy the festive season!`
    : `Happy New Year! Wishing you a productive year ahead.`;

  // Build banner element (compact badge variant)
  function makeBanner() {
    // wrapper contains a small circular badge and a hidden expanded panel
    const wrapper = document.createElement("div");
    wrapper.className = "seasonal-wrapper";

    const badge = document.createElement("div");
    badge.className = `seasonal-badge circle ${cls}`;
    const em = document.createElement("span");
    em.className = "sb-emoji";
    em.textContent = emoji;
    badge.appendChild(em);

    const panel = document.createElement("div");
    panel.className = `seasonal-panel ${cls}`;
    const row = document.createElement("div");
    row.className = "panel-row";
    const ptxt = document.createElement("div");
    ptxt.className = "panel-text";
    ptxt.textContent = text;
    const btnClose = document.createElement("button");
    btnClose.className = "panel-close";
    btnClose.type = "button";
    btnClose.setAttribute("aria-label", "Dismiss");
    btnClose.innerHTML = "×";
    row.appendChild(ptxt);
    row.appendChild(btnClose);
    panel.appendChild(row);

    // append panel to body to avoid clipping by parent stacking contexts
    try {
      panel.style.position = "fixed";
      panel.style.zIndex = "2147483647"; // highest positive 32-bit int
      panel.style.pointerEvents = "auto";
      panel.style.left = "50%";
      panel.style.top = "-9999px"; // hidden until positioned
      panel.style.transform = "translateX(-50%) translateY(-8px) scale(0.98)";
      panel.classList.remove("expanded");
      // append to documentElement to avoid any body stacking/context issues
      (document.documentElement || document.body).appendChild(panel);
    } catch {
      wrapper.appendChild(panel);
    }

    // interactions: hover/focus to expand; close persists dismissal
    function doDismiss() {
      try {
        const page =
          (location.pathname || location.href || "page").split("/").pop() ||
          "page";
        const pageKey = `${page}`.replace(/[^a-z0-9._-]/gi, "_");
        const key = `seasonal-dismissed-${y}-${cls}-${pageKey}`;
        // Use sessionStorage so dismissal lasts only for this session/renderer
        // and the badge will reappear on next app start within the season.
        sessionStorage.setItem(key, "1");
      } catch {
        void 0;
      }
      try {
        wrapper.remove();
      } catch {
        void 0;
      }
      try {
        panel.remove();
      } catch {
        void 0;
      }
    }
    btnClose.addEventListener("click", doDismiss);

    // helper to position panel under/near badge
    function positionPanel() {
      try {
        const brect = badge.getBoundingClientRect();
        const top = Math.round(brect.bottom + 8);
        const left = Math.round(brect.left + brect.width / 2);
        panel.style.left = left + "px";
        panel.style.top = top + "px";
        panel.style.transform = "translateX(-50%) translateY(0) scale(1)";
      } catch {
        void 0;
      }
    }

    function openPanel() {
      if (isExpanded) return;
      positionPanel();
      panel.classList.add("expanded");
      wrapper.classList.add("expanded");
      isExpanded = true;
      window.addEventListener("resize", positionPanel);
      window.addEventListener("scroll", positionPanel, { passive: true });
    }
    function closePanel() {
      if (!isExpanded) return;
      panel.classList.remove("expanded");
      wrapper.classList.remove("expanded");
      isExpanded = false;
      window.removeEventListener("resize", positionPanel);
      window.removeEventListener("scroll", positionPanel, { passive: true });
    }

    // keep track of hover/focus state on badge and panel so panel hides
    // only when neither is hovered/focused (prevents persistence)
    let isOverBadge = false;
    let isOverPanel = false;
    let closeTimer = null;
    let isExpanded = false;

    function scheduleClose() {
      if (closeTimer) clearTimeout(closeTimer);
      closeTimer = setTimeout(() => {
        if (!isOverBadge && !isOverPanel && isExpanded) {
          closePanel();
          isExpanded = false;
        }
        closeTimer = null;
      }, 200);
    }

    badge.addEventListener("mouseenter", () => {
      isOverBadge = true;
      if (closeTimer) clearTimeout(closeTimer);
      openPanel();
    });
    badge.addEventListener("mouseleave", () => {
      isOverBadge = false;
      scheduleClose();
    });
    badge.addEventListener("focusin", () => {
      isOverBadge = true;
      if (closeTimer) clearTimeout(closeTimer);
      openPanel();
    });
    badge.addEventListener("focusout", () => {
      isOverBadge = false;
      scheduleClose();
    });

    panel.addEventListener("mouseenter", () => {
      isOverPanel = true;
      if (closeTimer) clearTimeout(closeTimer);
    });
    panel.addEventListener("mouseleave", () => {
      isOverPanel = false;
      scheduleClose();
    });
    panel.addEventListener("focusin", () => {
      isOverPanel = true;
      if (closeTimer) clearTimeout(closeTimer);
    });
    panel.addEventListener("focusout", () => {
      isOverPanel = false;
      scheduleClose();
    });

    // close on Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closePanel();
    });

    wrapper.appendChild(badge);
    return { wrapper, badge, panel, positionPanel, openPanel, closePanel };
  }

  // helper: check if dismissed
  function isDismissed() {
    try {
      const page =
        (location.pathname || location.href || "page").split("/").pop() ||
        "page";
      const pageKey = `${page}`.replace(/[^a-z0-9._-]/gi, "_");
      const key = `seasonal-dismissed-${y}-${cls}-${pageKey}`;
      // Check sessionStorage to determine if user dismissed during this session
      return sessionStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    // attach CSS if not already present (check both absolute and relative hrefs)
    const cssCandidates = [
      "/public/shared/css/seasonal-banners.css",
      "public/shared/css/seasonal-banners.css",
    ];
    const found = cssCandidates.some((href) =>
      document.querySelector(`link[href="${href}"]`)
    );
    if (!found) {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = cssCandidates[1];
      document.head.appendChild(l);
    }

    // allow a debug URL param to force-display the seasonal banner during testing
    // e.g. open login.html?seasonalDebug=1
    const debugForce =
      location &&
      location.search &&
      location.search.indexOf("seasonalDebug=1") !== -1;
    if (isDismissed()) {
      try {
        if (debugForce)
          console.log(
            "seasonal-banners: dismissed but debug forced, continuing"
          );
        else
          console.log(
            "seasonal-banners: dismissed for this page/season, not showing"
          );
      } catch {
        void 0;
      }
      if (!debugForce) return; // don't show if user dismissed this season
    }

    // Preferred targets: header h1 (home) and login h2 (sign in)
    // placement: 'right-center' (to the right, vertically centered)
    //            'above-center' (above and centered)
    const targets = [
      { sel: "header h1", placement: "right-center" },
      { sel: ".login-container h2", placement: "above-center" },
    ];

    let placed = false;
    for (const t of targets) {
      const el = document.querySelector(t.sel);
      if (!el) continue;
      // For login above-center: insert wrapper before the parent card so it sits outside
      const made = makeBanner();
      const wrapper = made.wrapper;
      if (t.placement === "above-center") {
        // place the wrapper absolutely inside the login card so it does NOT
        // affect document flow. This centers the badge above the card.
        const card = el.closest(".login-container") || el.parentElement;
        wrapper.classList.add("placement-above");
        if (card) {
          const cs = window.getComputedStyle(card);
          if (cs.position === "static") card.style.position = "relative";
          // append wrapper into the card and absolutely position it above
          card.appendChild(wrapper);
          try {
            console.log("seasonal-banners: appended wrapper into login card");
          } catch {
            void 0;
          }
          wrapper.style.position = "absolute";
          wrapper.style.top = "-40px";
          wrapper.style.left = "50%";
          wrapper.style.transform = "translateX(-50%)";
          wrapper.style.margin = "0";
          wrapper.style.width = "auto";
          // panel will be positioned on first hover/focus
        }
      } else if (t.placement === "right-center") {
        wrapper.classList.add("placement-right");
        // Prefer inserting immediately after the page title (h1)
        // `el` is expected to be the title element (header h1)
        try {
          if (el && el.parentNode) {
            el.parentNode.insertBefore(wrapper, el.nextSibling);
            // small spacing so it doesn't stick to the title
            wrapper.style.marginLeft = "8px";
            wrapper.style.display = "inline-flex";
            wrapper.style.verticalAlign = "middle";
          } else {
            // fallback: append to header
            const header = document.querySelector("header");
            if (header) header.appendChild(wrapper);
            else document.body.appendChild(wrapper);
            try {
              console.log(
                "seasonal-banners: appended wrapper for right-center placement"
              );
            } catch {
              void 0;
            }
          }
          // Panel will be positioned on first hover/focus - no initial positioning
        } catch {
          const header = document.querySelector("header");
          if (header) header.appendChild(wrapper);
        }
      }
      placed = true;
    }

    // fallback: if no targets found, insert at top but compact
    if (!placed) {
      const banner = makeBanner();
      // `makeBanner()` returns an object containing the DOM `wrapper`.
      // Prepend the wrapper element itself so the badge appears.
      try {
        document.body.prepend(banner.wrapper);
      } catch {
        try {
          document.body.appendChild(banner.wrapper);
        } catch {
          void 0;
        }
      }
    }
  });
})();
