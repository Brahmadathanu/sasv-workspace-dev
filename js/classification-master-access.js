// Classification masters: fail-closed, presentation-only Edit gating.
// Server RPCs enforce the authoritative permission. View-only users can still read rows.
import { supabase } from '../public/shared/js/supabaseClient.js';

const styleId='wp10-classification-access-style';
const accessAttr='data-wp10-classification-access';
const selectors=[
 '.edit-btn','.delete-btn','.save-btn','#addBtn','#addSection','#addCategoryForm','#addSubForm','#addSubGroupForm'
];
if(typeof document!=='undefined'){
 const root=document.documentElement;
 root.setAttribute(accessAttr,'locked');
 if(!document.getElementById(styleId)){
  const node=document.createElement('style');
  node.id=styleId;
  node.textContent=`html[${accessAttr}]:not([${accessAttr}="edit"]) ${selectors.join(', html['+accessAttr+']:not(['+accessAttr+'="edit"]) ')}{display:none!important}`;
  document.head.appendChild(node);
 }
 const block=e=>{
  if(root.getAttribute(accessAttr)==='edit')return;
  const target=e.target;
  if(!(target instanceof Element))return;
  if(target.closest(selectors.join(','))){e.preventDefault();e.stopImmediatePropagation();}
 };
 for(const ev of ['click','submit','dblclick'])document.addEventListener(ev,block,true);
}
export async function initializeClassificationAccess(target){
 if(!/^module:manage-(categories|subcategories|product-groups|subgroups)$/.test(target))throw Error('Unsupported classification permission target');
 try{
  const [view,edit]=await Promise.all(['view','edit'].map(p_mode=>supabase.rpc('app_has_permission',{p_target:target,p_mode})));
  const allowed=view.error===null&&view.data===true;
  const writable=allowed&&edit.error===null&&edit.data===true;
  document.documentElement.setAttribute(accessAttr,writable?'edit':allowed?'view':'locked');
  return {canView:allowed,canEdit:writable};
 }catch(error){
  document.documentElement.setAttribute(accessAttr,'locked');
  console.warn('[classification-access] permission check failed',error);
  return {canView:false,canEdit:false};
 }
}
