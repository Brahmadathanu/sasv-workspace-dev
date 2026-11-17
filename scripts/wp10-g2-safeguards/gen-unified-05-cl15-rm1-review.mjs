// WP10 G2/CL15/RM1 unified REVIEW-ONLY install manifest.
// Emits one transactional candidate from exact source files, with no live connection.
// Installation, permissions and migration registration are NOT authorised by this generator.
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,"../..");
const sources=[
 ["05_product_route_impact_guard.sql","docs/master-data-costing/WP10_G2_UNAPPLIED_SQL_PROPOSALS/05_product_route_impact_guard.sql"],
 ["CL15_activation_parent_lock","scripts/wp10-g2-safeguards/review-only-activation-parent-lock-PROPOSAL.sql"],
 ["RM1_mapping_final_state","scripts/wp10-g2-safeguards/review-only-rm1-mapping-impact-PROTOTYPE.sql"],
 ["RM1_reason_receipt","scripts/wp10-g2-safeguards/review-only-rm1-subgroup-inactivation-reason-contract.sql"]
];
const sha=t=>createHash("sha256").update(t).digest("hex");
function unbox(text,label){
 const t=text.replace(/\r\n/g,"\n");
 if(!/^(?:\s*--[^\n]*\n)*\s*begin;\s*\n/i.test(t))throw Error(label+": required BEGIN wrapper absent");
 if(!/\ncommit;\s*$/i.test(t))throw Error(label+": required COMMIT wrapper absent");
 const body=t.replace(/^((?:\s*--[^\n]*\n)*)\s*begin;\s*\n/i,"$1");
 if((body.match(/^\s*begin;\s*$/gmi)||[]).length!==0)throw Error(label+": nested BEGIN forbidden");
 return body.replace(/\ncommit;\s*$/i,"\n");
}
const input=sources.map(([label,relative])=>{const raw=fs.readFileSync(path.join(root,relative),"utf8").replace(/\r\n/g,"\n");return {label,relative,source_sha256:sha(raw),body:unbox(raw,label)};});
const sql=[
"-- REVIEW ONLY. THIS SQL HAS NEVER BEEN AUTHORISED FOR PRODUCTION INSTALLATION.",
"-- WP10 05+CL15+RM1 in one transaction. The legacy two-arg inactivation RPC remains callable.",
"-- Do not register in supabase/migrations or run on the live project without exact owner approval.",
...input.map(x=>"-- Source "+x.label+" "+x.relative+" SHA256 "+x.source_sha256),
"begin;",
"set local lock_timeout='5s';",
"set local statement_timeout='30s';",
...input.flatMap(x=>["-- START "+x.label,x.body,"-- END "+x.label]),
"NOTIFY pgrst, 'reload schema';",
"commit;",""
].join("\n");
const manifest={classification:"UNAPPLIED_REVIEW_ONLY",source_count:input.length,begin_count:(sql.match(/^begin;$/gm)||[]).length,commit_count:(sql.match(/^commit;$/gm)||[]).length,sha256:sha(sql),sources:input.map(({label,relative,source_sha256})=>({label,relative,source_sha256})),has_legacy_two_arg_rpc:true,production_ddl:false};
if(manifest.begin_count!==1||manifest.commit_count!==1)throw Error("NOT ATOMIC");
for(const required of ["fn_wp10_product_route_impact_before","fn_wp10_activation_parent_lock","fn_wp10_rm1_deferred_mapping_impact","rpc_inactivate_product_subgroup_route_family_mapping","production_route_family_product_subgroup_inactivation_audit"])
 if(!sql.includes(required))throw Error("missing reviewed component "+required);
if(process.argv.includes("--manifest"))process.stdout.write(JSON.stringify(manifest,null,2)+"\n");
else if(process.argv.includes("--check"))console.log(JSON.stringify({...manifest,atomic_check:"PASS"}));
else process.stdout.write(sql);
