#!/usr/bin/env node
// Static contract gate. No Supabase connection or production writes.
// Run: node scripts/wp10-g2-safeguards/verify-classification-crud-contract.mjs
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const master = [
  ['categories','category','js/categories.js','manage-categories'],
  ['sub_categories','subcategory','js/subcategories.js','manage-subcategories'],
  ['product_groups','product_group','js/product-groups.js','manage-product-groups'],
  ['sub_groups','subgroup','js/subgroups.js','manage-subgroups']
];
const parentSql = read('scripts/wp10-g2-safeguards/review-only-parent-classification-governed-rpcs.sql');
const subgroupSql = read('scripts/wp10-g2-safeguards/review-only-subgroup-governed-rpcs.sql');
let count=0;
function assert(ok,what){count++;if(!ok)throw Error('WP10 CLASSIFICATION FAIL: '+what);}
for (const [table,stem,client,target] of master){
 const code=read(client);const sql=table==='sub_groups'?subgroupSql:parentSql;
 // Excludes read-only table queries, catches all direct write methods within 110 chars.
 assert(!new RegExp("\\.from\\(['\\\"]"+table+"['\\\"]\\)[\\s\\S]{0,110}\\.(?:insert|update|delete)\\(").test(code),client+' has direct DML');
 for(const verb of ['create','rename','delete']){
   assert(code.includes("'rpc_wp10_"+verb+"_"+stem+"'"),client+' missing RPC '+verb);
   assert(sql.includes('create function public.rpc_wp10_'+verb+'_'+stem),'SQL missing '+stem+' '+verb);
 }
 assert(sql.includes("require_permission('module:"+target+"',true)"),stem+' missing Edit guard');
}
const group = read('js/product-groups.js');
assert(read('manage-product-groups.html').includes('id="newGroupKind"'),'kind selector absent');
assert(group.includes('p_kind_id: act.kindId'),'group client kind ID absent');
assert(parentSql.includes('p_kind_id integer'),'group RPC kind parameter absent');
for (const stem of ['category','subcategory','product_group']){
 assert(parentSql.includes('create function public.rpc_wp10_delete_'+stem),'missing parent deletion');
}
for(const p of [
 'scripts/wp10-g2-safeguards/review-only-parent-classification-governed-rpcs-rollback.sql',
 'scripts/wp10-g2-safeguards/review-only-subgroup-governed-rpcs-rollback.sql'
])assert(read(p).includes('rollback')||read(p).includes('drop function'),'rollback missing: '+p);
console.log('WP10 classification static contract PASS '+count+'/'+count);
