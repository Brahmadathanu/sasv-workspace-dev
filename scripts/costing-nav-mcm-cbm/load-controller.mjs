// Loads a Costing controller module in plain Node: its only network import (supabaseClient.js, an https ESM CDN
// client) is replaced by an inert stub; every other import resolves to the real file. Test helper only.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const jsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public/shared/js");

export async function loadController(file) {
  let src = fs.readFileSync(path.join(jsDir, file), "utf8").replace(/\r\n/g, "\n");
  src = src.replace('import { supabase } from "./supabaseClient.js";', 'const supabase = {};');
  src = src.replace(/from "\.\/([a-z0-9-]+\.js)"/g, (_m, f) => `from "${pathToFileURL(path.join(jsDir, f)).href}"`);
  return import(`data:text/javascript;base64,${Buffer.from(src).toString("base64")}`);
}
