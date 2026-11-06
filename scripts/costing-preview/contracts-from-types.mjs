// Reads public/shared/js/types/supabase.ts (the repository's generated schema contract) and returns the
// column list/types of a view/table Row and the Args/Returns of an RPC. Fixtures may only use these fields.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const TYPES = resolve(dirname(fileURLToPath(import.meta.url)), "../../public/shared/js/types/supabase.ts");
let cache;
const load = () => (cache ??= readFileSync(TYPES, "utf8").replace(/\r\n/g, "\n"));
function block(src, header, from = 0) {
  const start = src.indexOf(header, from);
  if (start < 0) return null;
  let depth = 0, i = src.indexOf("{", start);
  const open = i;
  for (; i < src.length; i++) { if (src[i] === "{") depth++; else if (src[i] === "}" && --depth === 0) return src.slice(open + 1, i); }
  return null;
}
const publicBlock = () => block(load(), "  public: {");
export function viewColumns(name) {
  const section = block(publicBlock(), "    Views: {");
  const view = block(section, "      " + name + ": {");
  const row = view && block(view, "        Row: {");
  if (!row) return null;
  return Object.fromEntries([...row.matchAll(/^\s+([a-z0-9_]+)\??: (.+)$/gm)].map(([, col, type]) => [col, type.trim()]));
}
export function rpcSignature(name) {
  const section = block(publicBlock(), "    Functions: {");
  const fn = block(section, "      " + name + ": {");
  if (!fn) return null;
  const args = block(fn, "        Args: {");
  return { args: args ? [...args.matchAll(/^\s+([a-z0-9_]+)\??: (.+)$/gm)].map((m) => m[1]) : [], returns: returnsText(fn) };
}

// Views that exist only in repository migrations (generated types lag). Column list = the explicit
// `create or replace view public.<name> as select <cols> from ...` of the newest migration that defines it.
import { readdirSync } from "node:fs";
export function migrationViewColumns(name) {
  const dir = resolve(dirname(fileURLToPath(import.meta.url)), "../../supabase/migrations");
  const re = new RegExp("create or replace view public\\." + name + "\\s+as\\s+select\\s+([\\s\\S]*?)\\s+from\\s", "i");
  let found = null;
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const m = readFileSync(resolve(dir, file), "utf8").replace(/\r\n/g, "\n").match(re);
    if (m && !/^\s*\*/.test(m[1])) found = m[1].split(",").map((c) => c.trim().split(/\s+/).pop().replace(/"/g, ""));
  }
  return found;
}

// Views whose generated types are missing: the client's own explicit `.select("a,b,c")` literal is the contract.
export function clientSelectColumns(file, startsWith) {
  const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../public/shared/js", file), "utf8");
  const hit = [...src.matchAll(/"([a-z_0-9,]+)"/g)].map((m) => m[1]).find((s) => s.startsWith(startsWith));
  return hit ? hit.split(",") : null;
}

function returnsText(fn) {
  const at = fn.indexOf("Returns:");
  if (at < 0) return null;
  const rest = fn.slice(at + 8).trimStart();
  if (!rest.startsWith("{")) return rest.split("\n")[0];
  let depth = 0;
  for (let i = 0; i < rest.length; i++) { if (rest[i] === "{") depth++; else if (rest[i] === "}" && --depth === 0) return rest.slice(0, i + 1); }
  return rest;
}
