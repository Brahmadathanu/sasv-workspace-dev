import fs from "fs";
import path from "path";

const j = JSON.parse(
  fs.readFileSync("./.temp/sa4-view-access-scan.json", "utf8")
);

const consumers = new Map();
for (const v of j.activeViews) {
  for (const e of j.byView[v] || []) {
    if (!consumers.has(e.file))
      consumers.set(e.file, { views: new Set(), dynamic: false, entries: [] });
    const c = consumers.get(e.file);
    c.views.add(v);
    if (e.dynamic) c.dynamic = true;
    c.entries.push({ view: v, ...e });
  }
}

function read(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

// Map JS basename -> likely HTML hosts via script src grep across html
const htmlFiles = [];
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".git" || ent.name === ".temp")
      continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name.endsWith(".html")) htmlFiles.push(p.replace(/\\/g, "/"));
  }
}
walk(".");

const jsToHtml = new Map();
for (const html of htmlFiles) {
  const src = read(html);
  const scripts = [...src.matchAll(/src=["']([^"']+\.js)["']/g)].map((m) =>
    m[1].replace(/^\.\//, "").replace(/\\/g, "/")
  );
  for (const s of scripts) {
    // normalize relative to workspace
    const absCandidates = [
      s,
      path.posix.normalize(path.posix.join(path.posix.dirname(html), s)),
    ];
    for (const cand of absCandidates) {
      const norm = cand.replace(/^\.\//, "");
      if (!jsToHtml.has(norm)) jsToHtml.set(norm, new Set());
      jsToHtml.get(norm).add(html);
      // also key by basename-ish paths used in scan
      const bare = norm.replace(/^public\//, "");
      if (!jsToHtml.has(bare)) jsToHtml.set(bare, new Set());
      jsToHtml.get(bare).add(html);
    }
  }
}

function extractModuleTargets(src) {
  const targets = new Set();
  let m;
  const reRequire =
    /requireAuthAndPermission\s*\(\s*["']([^"']+)["']/g;
  while ((m = reRequire.exec(src))) targets.add(m[1]);

  const reModTarget = /MODULE_TARGET\s*=\s*[`'"]([^`'"]+)[`'"]/g;
  while ((m = reModTarget.exec(src))) targets.add(m[1]);

  const mid = src.match(/const\s+MODULE_ID\s*=\s*["']([^"']+)["']/);
  if (
    mid &&
    (/MODULE_TARGET\s*=\s*`module:\$\{MODULE_ID\}`/.test(src) ||
      /`module:\$\{MODULE_ID\}`/.test(src) ||
      /module:\$\{MODULE_ID\}/.test(src))
  ) {
    targets.add(`module:${mid[1]}`);
  }
  if (mid && /target\s*===\s*`module:\$\{MODULE_ID\}`/.test(src)) {
    targets.add(`module:${mid[1]}`);
  }
  // canAccessAny(["module:...", ...])
  const reArr = /["']module:([a-z0-9_-]+)["']/gi;
  while ((m = reArr.exec(src))) {
    // only if near permission helpers
    targets.add(`module:${m[1]}`);
  }
  return [...targets];
}

function classify(src, targets, htmlSrcs) {
  const hasRequire = /requireAuthAndPermission\s*\(/.test(src);
  const hasEnsureAuth =
    /async function ensureAuth/.test(src) ||
    /function ensureAuth/.test(src) ||
    /await ensureAuth\s*\(/.test(src);
  const hasBootstrap = /bootstrapApp\s*\(/.test(src);
  const hasGetSession = /auth\.getSession\s*\(/.test(src);
  const hasPermCheck =
    /get_user_permissions|user_permissions|\.eq\(\s*["']target["']/.test(src) ||
    /canAccessAny|hasModulePermission|checkModuleAccess|assertModule/.test(src);
  const redirectsLogin =
    /login\.html/.test(src) &&
    /(location|href|replace|assign)/.test(src);

  const htmlJoined = htmlSrcs.join("\n");
  const htmlHasSessionGate =
    /getSession|requireAuth|bootstrapApp|ensureAuth|login\.html/.test(
      htmlJoined
    );

  // Fill-planner known ungated pattern: no auth helpers at all
  if (
    !hasRequire &&
    !hasEnsureAuth &&
    !hasBootstrap &&
    !hasGetSession &&
    !hasPermCheck &&
    !redirectsLogin
  ) {
    return {
      authClass: "PRE-AUTH POSSIBLE",
      reason: "no session/permission gate in consumer JS",
      targets,
    };
  }

  // Session present but soft / optional
  if (
    hasGetSession &&
    !hasRequire &&
    !hasEnsureAuth &&
    !hasBootstrap &&
    !hasPermCheck &&
    /ok to ignore|failed \(ok/.test(src)
  ) {
    return {
      authClass: "PRE-AUTH POSSIBLE",
      reason: "getSession optional/non-blocking",
      targets,
    };
  }

  if ((hasRequire || hasPermCheck) && targets.length) {
    return {
      authClass: "AUTH+MODULE",
      reason: hasRequire
        ? "requireAuthAndPermission"
        : "module permission check",
      targets,
    };
  }

  if (hasPermCheck && midTargets(src).length) {
    return {
      authClass: "AUTH+MODULE",
      reason: "MODULE_ID permission check",
      targets: midTargets(src),
    };
  }

  if (hasEnsureAuth || hasBootstrap || (hasGetSession && redirectsLogin)) {
    return {
      authClass: "AUTH ONLY",
      reason: hasBootstrap
        ? "bootstrapApp"
        : hasEnsureAuth
          ? "ensureAuth"
          : "getSession+login redirect",
      targets,
    };
  }

  if (hasGetSession) {
    return {
      authClass: "AUTH ONLY",
      reason: "getSession present (verify gate strength)",
      targets,
    };
  }

  return {
    authClass: "PRE-AUTH POSSIBLE",
    reason: "insufficient auth evidence",
    targets,
  };
}

function midTargets(src) {
  const mid = src.match(/const\s+MODULE_ID\s*=\s*["']([^"']+)["']/);
  return mid ? [`module:${mid[1]}`] : [];
}

const fileResults = [];
for (const [file, info] of [...consumers.entries()].sort()) {
  const src = read(file);
  let targets = extractModuleTargets(src);
  // filter noisy module: hits that aren't permission targets — keep ones that look intentional
  // Prefer MODULE_ID / MODULE_TARGET / requireAuth
  const preferred = [];
  const mid = src.match(/const\s+MODULE_ID\s*=\s*["']([^"']+)["']/);
  if (mid) preferred.push(`module:${mid[1]}`);
  const mt = [...src.matchAll(/MODULE_TARGET\s*=\s*[`'"]([^`'"]+)[`'"]/g)].map(
    (m) => m[1]
  );
  preferred.push(...mt);
  const req = [
    ...src.matchAll(/requireAuthAndPermission\s*\(\s*["']([^"']+)["']/g),
  ].map((m) => m[1]);
  preferred.push(...req);
  const arr = [
    ...src.matchAll(/MODULE_TARGETS\s*=\s*\[([^\]]+)\]/g),
  ].flatMap((m) =>
    [...m[1].matchAll(/["'](module:[^"']+)["']/g)].map((x) => x[1])
  );
  preferred.push(...arr);
  if (preferred.length) targets = [...new Set(preferred)];

  const htmls = [
    ...(jsToHtml.get(file) || []),
    ...(jsToHtml.get(file.replace(/^public\//, "")) || []),
  ];
  const htmlSrcs = htmls.map(read);
  const cls = classify(src, targets, htmlSrcs);

  // dynamic flag from scan
  if (info.dynamic && cls.authClass !== "PRE-AUTH POSSIBLE") {
    // keep auth class but note dynamic
  }

  fileResults.push({
    file,
    views: [...info.views].sort(),
    dynamicScan: info.dynamic,
    htmls: [...new Set(htmls)],
    ...cls,
  });
}

// Also classify index.html specially
const indexSrc = read("index.html");
const indexTargets = extractModuleTargets(indexSrc);

fs.writeFileSync(
  "./.temp/sa4-auth-classify-out.json",
  JSON.stringify(
    {
      fileResults,
      index: {
        hasGetSession: /auth\.getSession/.test(indexSrc),
        redirectsLogin: /login\.html/.test(indexSrc),
        moduleBadges: /v_module_badges/.test(indexSrc),
        appRegistry: /v_app_module_registry/.test(indexSrc),
      },
    },
    null,
    2
  )
);
console.log("Wrote .temp/sa4-auth-classify-out.json");
console.log("files", fileResults.length);
for (const r of fileResults) {
  console.log(
    `${r.authClass.padEnd(18)} ${r.file} :: ${(r.targets || []).join(",") || "-"} :: ${r.reason}`
  );
}
