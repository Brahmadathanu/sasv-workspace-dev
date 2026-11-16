import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const matrix=[
 ['categories','module:manage-categories','category'],
 ['subcategories','module:manage-subcategories','subcategory'],
 ['product-groups','module:manage-product-groups','product_group'],
 ['subgroups','module:manage-subgroups','subgroup']
];
for(const [file,permission,stem] of matrix){
 test(file+' uses governed CRUD RPCs and fail-closed permission gate',()=>{
  const text=read('js/'+file+'.js');
  assert.ok(text.includes("initializeClassificationAccess('"+permission+"')"));
  assert.ok(text.includes("import { escapeClassificationHtml }"));
  for(const op of ['create','rename','delete'])
   assert.ok(text.includes("rpc_wp10_"+op+"_"+stem),op+' missing');
  // Class-master direct table writes may be present elsewhere, but never in these four clients.
  assert.doesNotMatch(text,/\.from\(['"](?:categories|sub_categories|product_groups|sub_groups)['"]\)[\s\S]{0,160}?\.(?:insert|update|upsert|delete)\s*\(/);
 });
}
test('product group kind chooser is mandatory in client and HTML',()=>{
 assert.ok(read('manage-product-groups.html').includes('id="newGroupKind"'));
 assert.ok(read('js/product-groups.js').includes('p_kind_id'));
});
test('SW refreshes all six scripts together and retains network-first fallback',()=>{
 const s=read('public/sw.js');
 assert.match(s,/CACHE_NAME = "hub-cache-v393"/);
 assert.match(s,/classification-master-access/);
 assert.match(s,/classification-html-escape/);
 assert.match(s,/categories\|subcategories\|product-groups\|subgroups/);
 assert.ok(s.includes('cache: "no-store"'));
});
