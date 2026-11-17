// REVIEW ONLY. Renders an ATOMIC original 05 + CL15 parent-lock proposal; never runs SQL.
// Original reviewed 05 bytes are preserved; each nested transaction wrapper is stripped
// and the entire unit is wrapped in one BEGIN/COMMIT. No production migration is registered.
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,"../..");
const original=fs.readFileSync(path.join(root,"docs/master-data-costing/WP10_G2_UNAPPLIED_SQL_PROPOSALS/05_product_route_impact_guard.sql"),"utf8");
const candidate=fs.readFileSync(path.join(dir,"review-only-activation-parent-lock-PROPOSAL.sql"),"utf8");
function unwrap(t,label){
 const normalized=t.replace(/\r\n/g,"\n");
 if(!/^\s*(?:--[^\n]*\n)*begin;\s*\n/i.test(normalized))
   throw Error(label+": expected one top-level transaction start");
 if(!/\ncommit;\s*$/i.test(normalized))throw Error(label+": expected transaction commit");
 const withoutBegin=normalized.replace(/^(\s*(?:--[^\n]*\n)*)begin;\s*\n/i,"$1");
 return withoutBegin.replace(/\ncommit;\s*$/i,"\n");
}
const sql=[
"-- REVIEW ONLY. Generated atomic WP10 05 + CL15 guard candidate. DO NOT APPLY without exact owner approval.",
"-- Generator: scripts/wp10-g2-safeguards/gen-atomic-05-cl15-review.mjs",
"-- This is a candidate, NOT an approved migration or production execution instruction.",
"begin;",
"set local lock_timeout = '5s';",
"set local statement_timeout = '30s';",
unwrap(original,"original proposal 05"),
unwrap(candidate,"CL15 candidate"),
"commit;",""
].join("\n");
const fingerprint=createHash("sha256").update(sql).digest("hex");
if(process.argv.includes("--check")){
 const count=(sql.match(/^begin;$/gmi)||[]).length;
 const commits=(sql.match(/^commit;$/gmi)||[]).length;
 if(count!==1||commits!==1)throw Error("non-atomic output: BEGIN="+count+" COMMIT="+commits);
 for(const n of ["fn_wp10_product_route_impact_before","fn_wp10_product_route_impact_after","fn_wp10_activation_parent_lock","trg_aa_wp10_activation_parent_lock","trg_wp10_product_route_impact_after"])
   if(!sql.includes(n))throw Error("missing "+n);
 console.log(JSON.stringify({atomic_source_check:"PASS",sha256:fingerprint,source_guard:"05 UNAPPLIED",cl15:"REVIEW ONLY",begin:count,commit:commits}));
}else{process.stdout.write(sql);}
