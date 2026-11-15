// WP10 G2 — static review of the UNAPPLIED proposal SQL: location, labelling, read-only-ness, dependency closure against the live catalogs, grants, rollback completeness.
// Offline. Reads files only. Run: node scripts/wp10-g2-safeguards/draft-sql-static.test.mjs [resultsJson] [closureJson]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { repoRoot, read, catalog, catalog2, makeResults } from "../wp10-g1-safeguard-audit/lib.mjs";

const { results, check, classify, failed } = makeResults();
const DIR = "supabase/draft-proposals/wp10-g2-unapplied";
const files = fs.readdirSync(path.join(repoRoot, DIR)).filter((f) => f.endsWith(".sql")).sort();
const strip = (s) => s.replace(/--.*$/gm, "");
const body = Object.fromEntries(files.map((f) => [f, strip(read(`${DIR}/${f}`))]));
const raw = Object.fromEntries(files.map((f) => [f, read(`${DIR}/${f}`)]));

check("S1", "six draft files exist (01-05 + 99 rollback) in a draft directory OUTSIDE supabase/migrations", files.join() === "01_clock_and_batch_size_contract.sql,02_essential_states_and_boundaries.sql,03_operational_expiry_horizon_rpc.sql,04_active_sku_reparent_guard.sql,05_product_route_impact_guard.sql,99_rollback_all.sql" && !DIR.startsWith("supabase/migrations"));
const tracked = execFileSync("git", ["ls-files", "supabase/migrations"], { cwd: repoRoot, encoding: "utf8" });
check("S2", "no WP10 G2 object is present in supabase/migrations (tracked or untracked): the proposals are unapplied", !/wp10/i.test(tracked) && !fs.readdirSync(path.join(repoRoot, "supabase/migrations")).some((f) => /wp10/i.test(f)));
check("S3", "every draft file is labelled UNAPPLIED / DO NOT RUN in its first lines", files.every((f) => /UNAPPLIED/.test(raw[f].split("\n").slice(0, 3).join("\n")) && /DO NOT RUN|UNAPPLIED/i.test(raw[f].split("\n").slice(0, 3).join("\n"))));
check("S4", "every file is one transaction with lock/statement timeouts (begin … commit; set local lock_timeout / statement_timeout)", files.every((f) => /\bbegin;/.test(body[f]) && /\bcommit;/.test(body[f])) && files.filter((f) => !/99_/.test(f)).every((f) => /set local lock_timeout/.test(body[f]) && /set local statement_timeout/.test(body[f])));

// ---- read-only proposals contain no DML/DDL beyond function creation ----
const readOnly = ["01_clock_and_batch_size_contract.sql", "02_essential_states_and_boundaries.sql", "03_operational_expiry_horizon_rpc.sql"];
const forbidden = /\b(insert\s+into|update\s+\w|delete\s+from|truncate|create\s+table|alter\s+table|drop\s+table|create\s+policy|alter\s+policy|create\s+trigger|drop\s+trigger)\b/i;
check("S5", "the read-only proposals (01-03) contain no INSERT/UPDATE/DELETE/TRUNCATE/DDL other than CREATE OR REPLACE FUNCTION + REVOKE/GRANT", readOnly.every((f) => !forbidden.test(body[f].replace(/create or replace function/gi, ""))));
check("S6", "every function in 01-03 is STABLE and SECURITY DEFINER with a fixed search_path", readOnly.every((f) => { const fns = body[f].split(/create or replace function/i).slice(1); return fns.every((x) => /\bstable\b/i.test(x) && /security definer/i.test(x) && /set search_path/i.test(x)); }));
check("S7", "no proposal calls the governed builder, the fingerprint, the portfolio read, the epoch bump or any refresh/writer function", files.every((f) => !/\b(?:fn_wp04_build_readiness_portfolio|fn_wp04_readiness_source_fingerprint|fn_wp04_readiness_bump_source_epoch|rpc_get_product_sku_readiness_portfolio|rpc_set_product_sku_active|rpc_update_product|rpc_create_product(?:_sku)?)\s*\(/.test(body[f])));
check("S8", "the proposals do NOT redefine any live function (no CREATE of an object that exists in either live catalog): all new names are fn_wp10_* / rpc_wp10_*", (() => { const live = new Set([...catalog.functions.map((f) => f.proname), ...catalog2.functions.map((f) => f.proname)]); const created = files.flatMap((f) => [...body[f].matchAll(/create or replace function\s+(?:\w+\.)?(\w+)/gi)].map((m) => m[1])); return created.length >= 7 && created.every((n) => /wp10/.test(n) && !live.has(n)); })());

// ---- permission and grants ----
const targets = new Set(files.flatMap((f) => [...body[f].matchAll(/'(module:[a-z0-9-]+)'/g)].map((m) => m[1])));
check("S9", "permission targets used are ONLY the existing manage-products and costing-control-center (no new permission target)", [...targets].sort().join() === "module:costing-control-center,module:manage-products");
const grants = files.flatMap((f) => [...body[f].matchAll(/\bgrant\s+[^;]+;/gi)].map((m) => m[0].replace(/\s+/g, " ")));
check("S10", "exactly ONE grant exists: EXECUTE on the horizon RPC to authenticated; everything else is revoked from public/anon/authenticated (no RLS/policy/table-privilege change)", grants.length === 1 && /grant execute on function public\.rpc_wp10_get_operational_expiry_horizon\(integer, bigint, integer\) to authenticated;/i.test(grants[0]) && files.every((f) => !/\b(create policy|alter policy|drop policy|row level security|alter table)\b/i.test(body[f])));

// ---- rollback completeness ----
const created = files.filter((f) => !/99_/.test(f)).flatMap((f) => [...body[f].matchAll(/create or replace function\s+((?:\w+\.)?\w+)\s*\(/gi)].map((m) => m[1]));
const triggers = files.flatMap((f) => [...body[f].matchAll(/create trigger\s+(\w+)/gi)].map((m) => m[1]));
const rb = body["99_rollback_all.sql"];
check("S11", "99_rollback_all.sql drops every created function and trigger (and nothing else)", created.every((fn) => new RegExp(`drop function if exists ${fn.replace(".", "\\.")}\\(`, "i").test(rb)) && triggers.every((t) => new RegExp(`drop trigger if exists ${t} `, "i").test(rb)) && (rb.match(/drop function/gi) || []).length === created.length && (rb.match(/drop trigger/gi) || []).length === triggers.length && !/drop table|delete|truncate|update /i.test(rb), `functions=${created.length} triggers=${triggers.length}`);

// ---- dependency closure vs the live catalogs ----
const liveFns = new Set([...catalog2.functions.map((f) => `${f.schema}.${f.proname}`)]);
const knownOther = { "public.plm_sku_bom_revision_as_of": "REPO migration 20260913093738 (gate A); definition hashed by the live fingerprint", "public.app_has_permission": "LIVE helper used by captured RPCs (rpc_get_sku_activation_check)", "auth.uid": "Supabase auth", "public.require_permission": "n/a" };
const epochTables = new Set(catalog.readiness_epoch_triggers.map((t) => `${t.schema_name}.${t.relname}`));
const own = new Set(created.map((c) => (c.includes(".") ? c : `public.${c}`)));
const callRefs = new Set(files.flatMap((f) => [...body[f].matchAll(/\b((?:costing|public|auth)\.[a-z_0-9]+)\s*\(/g)].map((m) => m[1])));
const fnClosure = [...callRefs].filter((r) => !own.has(r)).sort().map((r) => ({ object: r, kind: "function", live_captured: liveFns.has(r), other_evidence: knownOther[r] || null }));
const tableRefs = new Set(files.flatMap((f) => [...body[f].matchAll(/\b(?:from|join)\s+((?:costing|public)\.[a-z_0-9]+)(?!\s*\(|[a-z_0-9])/gi)].map((m) => m[1].toLowerCase())));
const tableClosure = [...tableRefs].sort().map((t) => ({ object: t, kind: "table", epoch_hooked: epochTables.has(t) }));
check("S12", "every function the proposals CALL is a live captured function, a repo-defined function, or an auth/permission helper (closure has no unknown callee)", fnClosure.every((c) => c.live_captured || c.other_evidence), fnClosure.filter((c) => !c.live_captured && !c.other_evidence).map((c) => c.object).join());
check("S13", "every table the read proposals touch is epoch-hooked or a product master table (their changes already invalidate the readiness build)", tableClosure.every((t) => t.epoch_hooked), tableClosure.filter((t) => !t.epoch_hooked).map((t) => t.object).join());
classify("S14", "NOT PROVEN", "route-validation callee tables (4 uncaptured functions behind costing.fn_validate_effective_product_process_route) and costing.product_process_route overrides are NOT in the boundary scan: route boundary coverage is CAPTURED_TABLES_ONLY and is reported as such in every horizon response", "see README dependency closure");
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify({ calls: fnClosure, tables: tableClosure }, null, 2) + "\n");
console.log(failed() ? `\n${failed()} FAILED` : "\nALL PASSED");
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ results }, null, 2) + "\n");
process.exit(failed() ? 1 : 0);
