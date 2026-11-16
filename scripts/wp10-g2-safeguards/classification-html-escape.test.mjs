import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
// This Electron repository is CommonJS; the browser helper is a native ESM script.
const helperSource=fs.readFileSync(path.join(root,'js/classification-html-escape.js'),'utf8');
const {escapeClassificationHtml}=await import('data:text/javascript;base64,'+Buffer.from(helperSource).toString('base64'));
test('classification label encoding prevents markup, inline event handlers and attribute breakouts',()=>{
 const original=`<img src=x onerror="alert('x')"> & "quoted" 'single'`;
 const html=escapeClassificationHtml(original);
 assert.equal(html,'&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt; &amp; &quot;quoted&quot; &#39;single&#39;');
 assert.equal(escapeClassificationHtml(null),'');
 assert.equal(escapeClassificationHtml('&amp;'),'&amp;amp;');
});
for(const [file,label] of [
 ['js/categories.js','category_name'],
 ['js/subcategories.js','subcategory_name'],
 ['js/product-groups.js','group_name'],
 ['js/subgroups.js','sub_group_name']
]){
 test(file+' encodes untrusted row labels before HTML interpolation',()=>{
  const s=fs.readFileSync(path.join(root,file),'utf8');
  assert.ok(s.includes("import { escapeClassificationHtml } from './classification-html-escape.js'"));
  assert.ok(s.includes('${escapeClassificationHtml(r.'+label+')}'));
  assert.ok(!s.includes('${r.'+label+'}'));
  if(file!=='js/categories.js'){
   assert.ok(s.includes('value="${escapeClassificationHtml(oldName)}"'));
   assert.ok(!s.includes('value="${oldName}"'));
  }
 });
}
