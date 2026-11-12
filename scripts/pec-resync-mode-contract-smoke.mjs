// PEC shared-client PR→indent resync mode contract smoke.
// Run: node scripts/pec-resync-mode-contract-smoke.mjs
// Source-only: no app session, no DB mutations.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const source = readFileSync(new URL("../public/shared/js/procurement-execution-console.js", import.meta.url), "utf8");
const open = source.indexOf("async function confirmIndentResync()");
const end = source.indexOf("\nasync function ", open + 1);
assert.ok(open > 0, "confirmIndentResync function must exist");
const method = source.slice(open, end < 0 ? open + 4000 : end);
assert.match(method, /const mode = bd\.dataset\.mode === "full" \? "reset" : "safe";/, "UI full selection must send server reset mode");
assert.match(method, /supabase\.rpc\("proc_indent_resync_from_pr",\s*\{[\s\S]*?p_mode:\s*mode/, "Resync RPC must receive normalized server mode");
assert.doesNotMatch(method, /const mode = bd\.dataset\.mode === "full" \? "full" : "safe";/, "Unsupported full mode must not reach server");
console.log("PEC resync mode contract: 3/3 PASS (full→reset, safe→safe, RPC binding)");
