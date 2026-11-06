// Prints the RPC names referenced by the six Costing modules' client source, classified by NAME ONLY
// (READ-shaped / MUTATING / UNKNOWN). Use it to filter DevTools > Network during a signed-in read-only check:
// any request to a MUTATING or UNKNOWN name during the walkthrough is a defect to report (and means a button was pressed).
// Classification is evidence-by-name, not a security proof; no database is contacted.
// Usage: node scripts/costing-preview/rpc-inventory.mjs [--json]
import { readdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = resolve(dirname(fileURLToPath(import.meta.url)), "../../public/shared/js");
const names = new Set();
for (const file of readdirSync(dir).filter((f) => /^(costing-|cost-).*\.js$|production-route/.test(f))) {
  for (const m of readFileSync(resolve(dir, file), "utf8").matchAll(/\brpc_[a-z0-9_]+\b/g)) names.add(m[0]);
}
names.delete("rpc_error"); names.delete("rpc_name");
const READ = /^rpc_(get|list|preview|validate|explain|export)_/;
const MUTATING = /^rpc_(create|update|upsert|delete|submit|approve|supersede|clone|set|apply|inactivate|reactivate|deactivate|cancel|correct|request|refresh|costing_request|costing_lock|costing_finalize|costing_supersede|adjust|decide|generate|close|save|map|archive)/;
const out = { read: [], mutating: [], unknown: [] };
for (const n of [...names].sort()) (READ.test(n) ? out.read : MUTATING.test(n) ? out.mutating : out.unknown).push(n);
if (process.argv.includes("--json")) console.log(JSON.stringify(out, null, 2));
else {
  console.log("READ-shaped (" + out.read.length + "): allowed during the walkthrough (still verify they are GET-like)\n  " + out.read.join("\n  "));
  console.log("\nMUTATING (" + out.mutating.length + "): must NEVER appear in the Network tab\n  " + out.mutating.join("\n  "));
  console.log("\nUNKNOWN by name (" + out.unknown.length + "): treat as mutating until reviewed\n  " + out.unknown.join("\n  "));
}
