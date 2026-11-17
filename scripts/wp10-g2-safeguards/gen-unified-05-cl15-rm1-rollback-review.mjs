// WP10 rollback bundle for the review-only unified install, in reverse dependency order.
// Preserves historical audit table and records; drops ONLY exact receipt-matched functions/triggers.
// WARNING: the existing client 3-arg inactivation RPC will stop working after rollback.
// NOT production authorised. No schema migrations are registered by this generator.
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const sources=[
"scripts/wp10-g2-safeguards/review-only-rm1-reason-wrapper-retaining-audit-rollback.sql",
"scripts/wp10-g2-safeguards/review-only-rm1-mapping-impact-scoped-rollback.sql",
"scripts/wp10-g2-safeguards/review-only-atomic-05-cl15-scoped-rollback.sql"
];
const sha=x=>createHash("sha256").update(x).digest("hex");
const fragments=sources.map(file=>{
 const raw=fs.readFileSync(path.join(root,file),"utf8").replace(/\r\n/g,"\n");
 if(!/^(?:\s*--[^\n]*\n)*\s*begin;\s*\n/i.test(raw)||!/\ncommit;\s*$/i.test(raw))throw Error("invalid transaction wrapper: "+file);
 const stripped=raw.replace(/^((?:\s*--[^\n]*\n)*)\s*begin;\s*\n/i,"$1").replace(/\ncommit;\s*$/i,"\n");
 if((stripped.match(/^begin;$/gmi)||[]).length)throw Error("nested transaction in "+file);
 return {file,source_sha256:sha(raw),body:stripped};
});
const sql=[
"-- WP10 REVIEW ONLY: receipt-verified, all-or-nothing rollback. AUDIT ROWS ARE RETAINED.",
"-- Do NOT run against production absent separate owner approval and client cutover plan.",
...fragments.map(x=>"-- Source "+x.file+" SHA256 "+x.source_sha256),
"begin;",
"set local lock_timeout='5s';",
"set local statement_timeout='30s';",
...fragments.flatMap(x=>["-- START "+x.file,x.body,"-- END "+x.file]),
"NOTIFY pgrst, 'reload schema';",
"commit;",""
].join("\n");
const manifest={classification:"UNAPPLIED_REVIEW_ONLY",scope:"unified-05-cl15-rm1",retains_reason_audit_table:true,retains_original_governed_inactivation_rpc:true,revokes_3arg_contract_on_rollback:true,source_count:fragments.length,begin_count:(sql.match(/^begin;$/gm)||[]).length,commit_count:(sql.match(/^commit;$/gm)||[]).length,sha256:sha(sql),sources:fragments.map(({file,source_sha256})=>({file,source_sha256}))};
if(manifest.begin_count!==1||manifest.commit_count!==1)throw Error("non-atomic rollback");
if(/drop table[^\n]*inactivation_audit|delete from[^\n]*inactivation_audit/i.test(sql))throw Error("audit destruction forbidden");
if(process.argv.includes("--manifest"))console.log(JSON.stringify(manifest,null,2));
else if(process.argv.includes("--check"))console.log(JSON.stringify({...manifest,check:"PASS"}));
else process.stdout.write(sql);
