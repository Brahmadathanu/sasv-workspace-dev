// seasonal-banners.js — SASV chip on login + home for dated greetings
(function () {
  // Set to a season id (e.g. "christmas") to preview out of calendar; null = scheduled windows.
  const TRIAL_FORCE_SEASON = null;

  const WORKDAYS_BEFORE = 3;
  const WORKDAYS_AFTER = 3;

  const GLYPH = {
    independence:
      '<svg class="sasv-seasonal-flag" viewBox="0 0 18 12" width="16" height="11" aria-hidden="true" focusable="false"><g clip-path="url(#sasv-in-flag-clip)"><rect width="18" height="4" fill="#FF9933"/><rect y="4" width="18" height="4" fill="#fff"/><rect y="8" width="18" height="4" fill="#138808"/><circle cx="9" cy="6" r="1.55" fill="none" stroke="#000080" stroke-width="0.7"/></g><clipPath id="sasv-in-flag-clip"><rect width="18" height="12" rx="1.4"/></clipPath><rect width="18" height="12" rx="1.4" fill="none" stroke="rgba(15,40,42,0.22)" stroke-width="0.75"/></svg>',
    christmas:
      '<svg class="sasv-seasonal-mark" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M8 1.1v1.7" stroke="#7a5c14" stroke-width="1.15" stroke-linecap="round"/><rect x="6.15" y="2.5" width="3.7" height="1.7" rx="0.35" fill="#c4a35a"/><circle cx="8" cy="9.35" r="5.15" fill="#b91c1c"/><ellipse cx="6.15" cy="7.55" rx="1.25" ry="1.7" fill="#fff" opacity="0.28"/></svg>',
    newyear:
      '<svg class="sasv-seasonal-mark" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M8 .5l1.45 5.5L15.5 8 9.45 10 8 15.5 6.55 10 .5 8 6.55 6Z" fill="#b45309"/><circle cx="8" cy="8" r="1.45" fill="#f7f0df"/><path d="M13.15 1.35l.45 1.55 1.55.45-1.55.45-.45 1.55-.45-1.55-1.55-.45 1.55-.45Z" fill="#c4a35a"/></svg>',
    onam:
      '<svg class="sasv-seasonal-mark" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="7" fill="#FF9933"/><circle cx="8" cy="8" r="5.35" fill="#fff"/><circle cx="8" cy="8" r="5.35" fill="none" stroke="#138808" stroke-width="1.35"/><circle cx="8" cy="8" r="3.15" fill="#FF9933"/><circle cx="8" cy="8" r="1.35" fill="#7a5c14"/></svg>',
    vishu:
      '<svg class="sasv-seasonal-mark" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><circle cx="5.1" cy="6.4" r="3.15" fill="#eab308"/><circle cx="11.1" cy="5.4" r="2.75" fill="#ca8a04"/><circle cx="8.6" cy="10.5" r="2.55" fill="#eab308"/><circle cx="5.1" cy="6.4" r="0.9" fill="#7a5c14"/><circle cx="11.1" cy="5.4" r="0.8" fill="#7a5c14"/><circle cx="8.6" cy="10.5" r="0.75" fill="#7a5c14"/></svg>',
    ayurveda:
      '<svg class="sasv-seasonal-mark" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><g stroke="#b45309" stroke-width="1.4" stroke-linecap="round"><line x1="8" y1="0.55" x2="8" y2="2.55"/><line x1="8" y1="13.45" x2="8" y2="15.45"/><line x1="0.55" y1="8" x2="2.55" y2="8"/><line x1="13.45" y1="8" x2="15.45" y2="8"/><line x1="2.65" y1="2.65" x2="4.1" y2="4.1"/><line x1="11.9" y1="11.9" x2="13.35" y2="13.35"/><line x1="13.35" y1="2.65" x2="11.9" y2="4.1"/><line x1="4.1" y1="11.9" x2="2.65" y2="13.35"/></g><circle cx="8" cy="8" r="3.55" fill="#eab308"/><circle cx="8" cy="8" r="2.15" fill="#fde68a"/></svg>',
    kerala:
      '<svg class="sasv-seasonal-mark" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><g fill="none" stroke="#166534" stroke-linecap="round" stroke-linejoin="round"><path d="M1.8 14.2Q8 8.3 14.6 1.8" stroke-width="1.05"/><path stroke-width="0.82" d="M3.1 12.9Q3.6 9.8 4.5 6.8M4.5 11.4Q5.1 8.3 6.2 5.4M5.9 9.9Q6.6 6.9 7.8 4.1M7.3 8.4Q8.1 5.5 9.4 2.9M8.7 6.9Q9.5 4.2 10.9 1.8M10.1 5.4Q10.9 3.0 12.2 1.1M11.5 4.0Q12.2 1.9 13.3 0.6M3.2 12.8Q6.0 12.4 8.8 12.9M4.6 11.3Q7.4 10.8 10.1 11.1M6.0 9.8Q8.7 9.2 11.3 9.4M7.4 8.3Q9.9 7.6 12.3 7.7M8.8 6.8Q11.1 6.1 13.2 6.0M10.2 5.3Q12.2 4.6 13.9 4.4M11.6 3.9Q13.2 3.3 14.5 3.0"/></g></svg>',
    siddha:
      '<svg class="sasv-seasonal-mark" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><rect x="1.4" y="2.6" width="13.2" height="4.5" rx="2.2" fill="#c4a35a"/><rect x="1.4" y="8.9" width="13.2" height="4.5" rx="2.2" fill="#b45309"/><circle cx="3.55" cy="4.85" r="0.75" fill="#7a5c14"/><circle cx="3.55" cy="11.15" r="0.75" fill="#f7f0df"/></svg>',
  };

  const SEASONS = [
    {
      id: "independence",
      month: 8,
      day: 15,
      glyphHtml: GLYPH.independence,
      label: "15 Aug",
      greeting: "Happy Independence Day. Proud to serve with you.",
    },
    {
      id: "onam",
      // Thiruvonam moves each year (Malayalam Chingam). Add later years when known.
      datesByYear: {
        2025: [9, 5],
        2026: [8, 26],
        2027: [9, 12],
        2028: [9, 1],
        2029: [8, 22],
        2030: [9, 9],
      },
      glyphHtml: GLYPH.onam,
      label: "Onam",
      greeting: "Happy Onam. Wishing you a season of togetherness.",
    },
    {
      id: "christmas",
      month: 12,
      day: 25,
      glyphHtml: GLYPH.christmas,
      label: "Christmas",
      greeting: "Merry Christmas. Enjoy the festive season.",
    },
    {
      id: "newyear",
      month: 1,
      day: 1,
      glyphHtml: GLYPH.newyear,
      label: "New Year",
      greeting: "Happy New Year. Wishing you a productive year ahead.",
    },
    {
      id: "republic",
      month: 1,
      day: 26,
      glyphHtml: GLYPH.independence,
      label: "26 Jan",
      greeting: "Happy Republic Day. Proud to serve with you.",
    },
    {
      id: "vishu",
      datesByYear: {
        2025: [4, 14],
        2026: [4, 15],
        2027: [4, 15],
        2028: [4, 14],
        2029: [4, 14],
        2030: [4, 15],
      },
      glyphHtml: GLYPH.vishu,
      label: "Vishu",
      greeting: "Happy Vishu. Wishing you a prosperous new year.",
    },
    {
      id: "ayurveda",
      month: 9,
      day: 23,
      glyphHtml: GLYPH.ayurveda,
      label: "Ayurveda",
      greeting: "Happy Ayurveda Day. Honouring the science we practise every day.",
    },
    {
      id: "siddha",
      // Ayilyam star in Margazhi; date moves. Listed years first; Jan 6 is fallback.
      month: 1,
      day: 6,
      datesByYear: {
        2024: [12, 19],
        2026: [1, 6],
      },
      glyphHtml: GLYPH.siddha,
      label: "Siddha",
      greeting: "Happy Siddha Day. Honouring the science we practise every day.",
    },
    {
      id: "kerala",
      month: 11,
      day: 1,
      glyphHtml: GLYPH.kerala,
      label: "Kerala",
      greeting: "Happy Kerala Piravi. Proud of our home and heritage.",
    },
  ];

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function isWeekend(d) {
    const day = d.getDay();
    return day === 0 || day === 6;
  }

  function addWorkdays(date, n) {
    const d = startOfDay(date);
    const step = n >= 0 ? 1 : -1;
    let remaining = Math.abs(n);
    while (remaining > 0) {
      d.setDate(d.getDate() + step);
      if (!isWeekend(d)) remaining -= 1;
    }
    return d;
  }

  function inInclusiveRange(today, start, end) {
    const t = startOfDay(today).getTime();
    return t >= startOfDay(start).getTime() && t <= startOfDay(end).getTime();
  }

  function eventDateForYear(season, year) {
    if (season.datesByYear && season.datesByYear[year]) {
      const pair = season.datesByYear[year];
      return new Date(year, pair[0] - 1, pair[1]);
    }
    if (season.month && season.day) {
      return new Date(year, season.month - 1, season.day);
    }
    return null;
  }

  function windowForSeason(today, season) {
    const years = [
      today.getFullYear() - 1,
      today.getFullYear(),
      today.getFullYear() + 1,
    ];
    for (let i = 0; i < years.length; i += 1) {
      const event = eventDateForYear(season, years[i]);
      if (!event) continue;
      const start = addWorkdays(event, -WORKDAYS_BEFORE);
      const end = addWorkdays(event, WORKDAYS_AFTER);
      if (inInclusiveRange(today, start, end)) {
        return { event: startOfDay(event), start, end, year: years[i] };
      }
    }
    return null;
  }

  function parseDebugSeason() {
    try {
      const params = new URLSearchParams(location.search || "");
      const raw = (params.get("seasonalDebug") || "").trim().toLowerCase();
      if (!raw) return null;
      if (raw === "1" || raw === "true") return "auto";
      if (SEASONS.some((s) => s.id === raw)) return raw;
      return null;
    } catch {
      return null;
    }
  }

  function seasonById(id) {
    for (let i = 0; i < SEASONS.length; i += 1) {
      if (SEASONS[i].id === id) return SEASONS[i];
    }
    return null;
  }

  function resolveSeason(today) {
    const debug = parseDebugSeason();
    if (debug && debug !== "auto") {
      const forced = seasonById(debug);
      if (forced) {
        return { season: forced, year: today.getFullYear() };
      }
    }

    if (TRIAL_FORCE_SEASON) {
      const trial = seasonById(TRIAL_FORCE_SEASON);
      if (trial) {
        return { season: trial, year: today.getFullYear() };
      }
    }

    const matches = [];
    for (let i = 0; i < SEASONS.length; i += 1) {
      const season = SEASONS[i];
      const win = windowForSeason(today, season);
      if (win) {
        matches.push({
          season,
          year: win.year,
          distance: Math.abs(startOfDay(today).getTime() - win.event.getTime()),
        });
      }
    }
    if (!matches.length) {
      if (debug === "auto") {
        const fallback = seasonById("independence") || SEASONS[0];
        return { season: fallback, year: today.getFullYear() };
      }
      return null;
    }
    matches.sort((a, b) => a.distance - b.distance);
    return { season: matches[0].season, year: matches[0].year };
  }

  function pageKey() {
    const page =
      (location.pathname || location.href || "page").split("/").pop() || "page";
    return `${page}`.replace(/[^a-z0-9._-]/gi, "_");
  }

  function dismissKey(year, seasonId) {
    return `seasonal-dismissed-${year}-${seasonId}-${pageKey()}`;
  }

  function isDismissed(year, seasonId) {
    try {
      return sessionStorage.getItem(dismissKey(year, seasonId)) === "1";
    } catch {
      return false;
    }
  }

  function markDismissed(year, seasonId) {
    try {
      sessionStorage.setItem(dismissKey(year, seasonId), "1");
    } catch {
      void 0;
    }
  }

  function makeChip(season, year) {
    const chip = document.createElement("span");
    chip.className = "sasv-chip sasv-chip--primary sasv-seasonal-chip";
    chip.setAttribute("role", "status");

    const glyph = document.createElement("span");
    glyph.className = "sasv-seasonal-chip__glyph";
    glyph.setAttribute("aria-hidden", "true");
    if (season.glyphHtml) glyph.innerHTML = season.glyphHtml;
    else glyph.textContent = season.glyph;

    const label = document.createElement("span");
    label.className = "sasv-seasonal-chip__label";
    label.textContent = season.label;

    const tip = document.createElement("span");
    tip.className = "sasv-seasonal-chip__tip";
    tip.textContent = season.greeting;

    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "sasv-seasonal-chip__dismiss";
    dismiss.setAttribute("aria-label", "Dismiss greeting");
    dismiss.innerHTML =
      '<svg class="sasv-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    dismiss.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      markDismissed(year, season.id);
      const slot = chip.closest(".sasv-seasonal-chip-slot");
      if (slot) slot.remove();
      else chip.remove();
    });

    chip.appendChild(glyph);
    chip.appendChild(label);
    chip.appendChild(tip);
    chip.appendChild(dismiss);

    const finishIn = () => chip.classList.add("is-ready");
    chip.addEventListener("animationend", finishIn, { once: true });
    setTimeout(finishIn, 400);
    try {
      if (
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        finishIn();
      }
    } catch {
      void 0;
    }

    return chip;
  }

  function placeChip(chip) {
    const userZone = document.getElementById("user-zone");
    const presence = document.getElementById("presence-chip");
    if (userZone && presence && presence.parentNode === userZone) {
      userZone.insertBefore(chip, presence);
      return true;
    }
    if (userZone) {
      userZone.insertBefore(chip, userZone.firstChild);
      return true;
    }

    const sub = document.querySelector(".login-container .login-product-sub");
    if (sub && sub.parentNode) {
      const slot = document.createElement("div");
      slot.className = "sasv-seasonal-chip-slot sasv-seasonal-chip-slot--login";
      slot.appendChild(chip);
      sub.parentNode.insertBefore(slot, sub.nextSibling);
      return true;
    }

    return false;
  }

  function ensureCss() {
    const hrefs = [
      "/public/shared/css/seasonal-banners.css",
      "public/shared/css/seasonal-banners.css",
    ];
    const found = hrefs.some((href) =>
      document.querySelector(`link[href="${href}"]`)
    );
    if (found) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = hrefs[1];
    document.head.appendChild(link);
  }

  document.addEventListener("DOMContentLoaded", () => {
    ensureCss();
    const resolved = resolveSeason(new Date());
    if (!resolved) return;
    if (isDismissed(resolved.year, resolved.season.id)) return;
    const chip = makeChip(resolved.season, resolved.year);
    placeChip(chip);
  });
})();
