// WP10 four-master client write scanner (offline, dependency-free). Detects direct table writes against categories / sub_categories / product_groups / sub_groups.
// Not a full JS parser: a string/comment-aware chain walker. Conservative by design (STRICT mode flags anything it cannot prove is a read).
export const FOUR = ["categories", "sub_categories", "product_groups", "sub_groups"];
export const WRITE_METHODS = ["insert", "update", "upsert", "delete"];

/** blank out comments, keep string contents and offsets/newlines intact */
export function stripComments(src) {
  let out = "", i = 0; const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === "'" || c === '"' || c === "`") { const q = c; out += c; i++; while (i < n && src[i] !== q) { if (src[i] === "\\") { out += src[i++]; } out += src[i++]; } out += src[i] ?? ""; i++; continue; }
    if (c === "/" && d === "/") { while (i < n && src[i] !== "\n") { out += " "; i++; } continue; }
    if (c === "/" && d === "*") { out += "  "; i += 2; while (i < n && !(src[i] === "*" && src[i + 1] === "/")) { out += src[i] === "\n" ? "\n" : " "; i++; } out += "  "; i += 2; continue; }
    out += c; i++;
  }
  return out;
}
function skipWs(s, i) { while (i < s.length && /\s/.test(s[i])) i++; return i; }
/** index just after the paren group starting at s[i] === '(' (string-aware); -1 if unbalanced */
function skipParens(s, i) {
  let depth = 0;
  for (; i < s.length; i++) {
    const c = s[i];
    if (c === "'" || c === '"' || c === "`") { const q = c; i++; while (i < s.length && s[i] !== q) { if (s[i] === "\\") i++; i++; } continue; }
    if (c === "(") depth++; else if (c === ")") { depth--; if (depth === 0) return i + 1; }
  }
  return -1;
}
/** walk the method chain that follows position `i` (just after a call's closing paren) */
function chainAfter(s, i) {
  const methods = [];
  for (;;) {
    let j = skipWs(s, i);
    if (s[j] === "?" && s[j + 1] === ".") j += 1;
    if (s[j] !== ".") break;
    j = skipWs(s, j + 1);
    const m = /^[A-Za-z_$][\w$]*/.exec(s.slice(j)); if (!m) break;
    j += m[0].length; j = skipWs(s, j);
    if (s[j] !== "(") break;
    const end = skipParens(s, j); if (end < 0) { methods.push(m[0] + "!unbalanced"); break; }
    methods.push(m[0]); i = end;
  }
  return methods;
}
const lineOf = (s, idx) => s.slice(0, idx).split("\n").length;

/**
 * @param {string} source raw file text (JS or HTML with inline scripts)
 * @param {{strict?: boolean, allowedRpc?: string[]|null}} opts strict = the file is one of the four client modules: every .from() must be a literal read-table
 *        call that starts with .select(), no direct write method of any kind, no fetch/XHR/REST, rpc names restricted to allowedRpc.
 * @returns {{line:number, kind:string, detail:string}[]}
 */
export function scan(source, { strict = false, allowedRpc = null, readTables = FOUR.concat(["product_group_kinds"]) } = {}) {
  const s = stripComments(source); const v = [];
  const fromRe = /\.from\s*\(/g; let m;
  while ((m = fromRe.exec(s))) {
    const open = m.index + m[0].length - 1; const end = skipParens(s, open); if (end < 0) continue;
    const arg = s.slice(open + 1, end - 1).trim(); const lit = /^(['"`])([^'"`$]*)\1$/.exec(arg);
    const table = lit ? lit[2].replace(/^public\./, "") : null;
    const chain = chainAfter(s, end); const writes = chain.filter((c) => WRITE_METHODS.includes(c));
    // storage.from(...) / Array.from(...) / Buffer.from(...) etc. are not table calls
    const before = s.slice(Math.max(0, m.index - 12), m.index);
    if (/(storage|Array|Buffer|Object|Uint8Array|Map|Set|String)\s*$/.test(before) || /\.storage\s*\.\s*from$/.test(before + ".from")) continue;
    if (table && FOUR.includes(table)) {
      if (writes.length) v.push({ line: lineOf(s, m.index), kind: "DIRECT_WRITE", detail: `${table}.${writes.join(".")}` });
      else if (chain[0] !== "select") v.push({ line: lineOf(s, m.index), kind: "NON_SELECT_START", detail: `${table} chain starts with ${chain[0] ?? "(nothing: aliased/stored builder)"}` });
    } else if (!table && writes.length) {
      v.push({ line: lineOf(s, m.index), kind: "DYNAMIC_FROM_WRITE", detail: `from(${arg}).${writes.join(".")}` });
    }
    if (strict) {
      if (!table) v.push({ line: lineOf(s, m.index), kind: "STRICT_DYNAMIC_FROM", detail: `from(${arg})` });
      else if (!readTables.includes(table)) v.push({ line: lineOf(s, m.index), kind: "STRICT_UNLISTED_TABLE", detail: table });
      else if (chain[0] !== "select") v.push({ line: lineOf(s, m.index), kind: "STRICT_NOT_SELECT", detail: `${table}: ${chain[0] ?? "(none)"}` });
    }
  }
  // REST side door (any string mentioning the PostgREST path of a four-master table)
  const restRe = new RegExp(`rest/v1/(?:${FOUR.join("|")})\\b`, "g");
  while ((m = restRe.exec(s))) v.push({ line: lineOf(s, m.index), kind: "REST_PATH", detail: m[0] });
  if (strict) {
    for (const re of [/\bfetch\s*\(/g, /\bXMLHttpRequest\b/g, /\.schema\s*\(/g, /\bsupabase\s*\.\s*rest\b/g]) while ((m = re.exec(s))) v.push({ line: lineOf(s, m.index), kind: "STRICT_NETWORK_SIDE_DOOR", detail: m[0] });
    // any write method call at all (the four modules contain none; Map/Array .delete etc. must not appear either so the guard stays simple)
    const wr = new RegExp(`\\.\\s*(${WRITE_METHODS.join("|")})\\s*\\(`, "g");
    while ((m = wr.exec(s))) v.push({ line: lineOf(s, m.index), kind: "STRICT_WRITE_METHOD", detail: m[0] });
    if (allowedRpc) {
      const rpcRe = /\.rpc\s*\(\s*(['"`])([^'"`]*)\1/g;
      while ((m = rpcRe.exec(s))) if (!allowedRpc.includes(m[2])) v.push({ line: lineOf(s, m.index), kind: "STRICT_UNLISTED_RPC", detail: m[2] });
      for (const r of s.matchAll(/\.rpc\s*\(\s*[^'"`\s)]/g)) v.push({ line: lineOf(s, r.index), kind: "STRICT_DYNAMIC_RPC", detail: r[0] });
    }
  }
  return v;
}
