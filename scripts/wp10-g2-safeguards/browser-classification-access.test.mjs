// WP10 isolated mocked Chromium permission-control acceptance, no live identities or network.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
let chromium=null;
try { chromium=createRequire(import.meta.url)('playwright').chromium; }catch{}
const skip=process.env.WP10_G2_BROWSER_SKIP==='1'||!chromium?'Chromium unavailable':false;
const file=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../js/classification-master-access.js');
const original=fs.readFileSync(file,'utf8');
assert.ok(original.includes("import { supabase }"),'expected import line');
const source=original.replace(/import \{ supabase \} from ['"][^'"]+['"];?/,
 'const supabase=window.__mockSupabase;')+'\nwindow.__initializeClassificationAccess=initializeClassificationAccess;';
let browser;
test.before(async()=>{if(!skip)browser=await chromium.launch();});
test.after(async()=>{await browser?.close();});
async function scenario(mode,width){
 const page=await browser.newPage({viewport:{width,height:720}});
 await page.setContent('<!doctype html><html><head></head><body><main class="sasv-module-shell"><form id="addCategoryForm"><button id="createBtn" type="submit">Add</button></form><form id="editForm"><button id="saveEdit" type="submit">Save</button></form><section id="addNewSubCategory"><form id="addSubForm">New</form></section><button class="edit-btn">Edit</button><button class="delete-btn">Delete</button><button class="save-btn">Save</button><button id="addBtn">Add Group</button><div id="addSection">New Group</div><form id="addSubGroupForm">Add subgroup</form></main><div id="readOnly">Read listing</div></body></html>');
 await page.evaluate(m=>{
   window.__permissions=m;
   window.__attempts=0;
   window.__mockSupabase={rpc:async(_name,params)=>{
     if(window.__permissions==='error')return {data:null,error:{message:'network failed'}};
     return {data:window.__permissions==='edit'||(window.__permissions==='view'&&params.p_mode==='view'),error:null};
   }};
   document.querySelector('.edit-btn').addEventListener('click',()=>window.__attempts++);
 },mode);
 await page.addScriptTag({type:'module',content:source});
 await page.waitForFunction(()=>document.documentElement.hasAttribute('data-wp10-classification-access'));
 await page.evaluate(()=>window.__initializeClassificationAccess('module:manage-categories'));
 await page.waitForFunction(m=>document.documentElement.getAttribute('data-wp10-classification-access')===(m==='edit'?'edit':m==='view'?'view':'locked'),mode);
 const result=await page.evaluate(()=>{
   document.querySelector('.edit-btn').click();
   return {state:document.documentElement.getAttribute('data-wp10-classification-access'),
     editVisible:getComputedStyle(document.querySelector('.edit-btn')).display!=='none',
     listingVisible:getComputedStyle(document.getElementById('readOnly')).display!=='none',
     attempts:window.__attempts,
     addVisible:getComputedStyle(document.getElementById('addSection')).display!=='none',
     saveVisible:getComputedStyle(document.getElementById('saveEdit')).display!=='none',
     subcategoryAddVisible:getComputedStyle(document.getElementById('addNewSubCategory')).display!=='none'};
 });
 await page.close();
 return result;
}
for(const width of [390,1280])for(const mode of ['edit','view','none','error']){
 test('classification '+mode+' @'+width,{skip},async()=>{
  const r=await scenario(mode,width);
  if(mode==='edit'){assert.equal(r.state,'edit');assert.equal(r.editVisible,true);assert.equal(r.addVisible,true);assert.equal(r.saveVisible,true);assert.equal(r.subcategoryAddVisible,true);assert.equal(r.attempts,1);}
  else{assert.notEqual(r.state,'edit');assert.equal(r.editVisible,false);assert.equal(r.addVisible,false);assert.equal(r.saveVisible,false);assert.equal(r.subcategoryAddVisible,false);assert.equal(r.attempts,0);}
  assert.equal(r.listingVisible,true);
 });
}
