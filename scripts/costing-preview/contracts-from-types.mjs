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
  return { args: args ? [...args.matchAll(/^\s+([a-z0-9_]+)\??: (.+)$/gm)].map((m) => m[1]) : [], returns: (fn.match(/Returns: ([^\n]+(\n\s+\|[^\n]+)*)/) || [])[1] ?? null };
}
