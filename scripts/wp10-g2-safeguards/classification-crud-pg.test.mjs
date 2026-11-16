// Disposable local PostgreSQL fixture; no network database connections or production writes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pgAvailable, startCluster } from '../wp08-g2-0-shared-master-data/pg-harness.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url));
const file=(name)=>fs.readFileSync(path.join(dir,name),'utf8');
const editor='11111111-1111-4111-8111-111111111111', viewer='22222222-2222-4222-8222-222222222222', categoryOnly='33333333-3333-4333-8333-333333333333';
const seed=`
create schema auth; create schema costing; create schema lab;
create role authenticated nologin; create role anon nologin;
create function auth.uid() returns uuid language sql stable as $f$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $f$;
create table public.user_permissions_canonical(user_id uuid,target text,can_view boolean,can_edit boolean,primary key(user_id,target));
create function public.require_permission(p_target text,p_need_edit boolean default false) returns void
 language plpgsql security definer set search_path=public as $f$
 begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 if not exists(select 1 from public.user_permissions_canonical where user_id=auth.uid()
 and target=p_target and can_view=true and (not p_need_edit or can_edit=true))
 then raise exception 'Permission denied for % (edit=%)',p_target,p_need_edit; end if;
 end $f$;
create function public.app_has_permission(p_target text,p_mode text) returns boolean
 language sql stable as $f$ select exists(
 select 1 from public.user_permissions_canonical p where p.user_id=auth.uid()
 and p.target=p_target and p.can_view=true and (p_mode<>'edit' or p.can_edit=true)) $f$;
insert into public.user_permissions_canonical
select u.uid,'module:manage-'||m.target,true,u.edit from
(values ('11111111-1111-4111-8111-111111111111'::uuid,true),
('22222222-2222-4222-8222-222222222222'::uuid,false)) u(uid,edit),
(values ('categories'),('subcategories'),('product-groups'),('subgroups')) m(target);
insert into public.user_permissions_canonical values
('33333333-3333-4333-8333-333333333333'::uuid,'module:manage-categories',true,true),
('33333333-3333-4333-8333-333333333333'::uuid,'module:manage-subcategories',true,false),
('33333333-3333-4333-8333-333333333333'::uuid,'module:manage-product-groups',true,false),
('33333333-3333-4333-8333-333333333333'::uuid,'module:manage-subgroups',true,false);
create table public.categories(id serial primary key,category_name text not null);
create table public.sub_categories(id serial primary key,category_id integer not null references public.categories(id) on delete cascade,subcategory_name text not null);
create table public.product_group_kinds(id integer primary key,group_name text);
insert into public.product_group_kinds values(1,'Fixture kind');
grant select on public.product_group_kinds to authenticated;
create table public.product_groups(id serial primary key,sub_category_id integer not null references public.sub_categories(id) on delete cascade,group_name text not null,kind_id integer not null references public.product_group_kinds(id));
create table public.sub_groups(id serial primary key,product_group_id integer not null references public.product_groups(id) on delete cascade,sub_group_name text not null);
create table public.products(id serial primary key,sub_group_id integer references public.sub_groups(id) on delete restrict);
create table costing.production_route_family_product_subgroup_map(id serial primary key,product_subgroup_id integer references public.sub_groups(id) on delete restrict);
create table costing.scheme_policy_rules(id serial primary key,
 category_id integer references public.categories(id),
 sub_category_id integer references public.sub_categories(id),
 product_group_id integer references public.product_groups(id),
 sub_group_id integer references public.sub_groups(id));
create table costing.production_route_family_product_group_map(id serial primary key, product_group_id integer references public.product_groups(id) on delete restrict);
create table lab.control_register(id serial primary key,product_group_id integer references public.product_groups(id) on delete restrict);
create table lab.control_register_product_group(id serial primary key,product_group_id integer references public.product_groups(id) on delete restrict);
create table lab.protocol_category_product_group_map(id serial primary key,product_group_id integer references public.product_groups(id) on delete restrict);
create table lab.spec_profile_product_group_map(id serial primary key,product_group_id integer references public.product_groups(id) on delete restrict);
create table public.industries_installed_capacity_product_group_map(id serial primary key,product_group_id integer references public.product_groups(id) on delete restrict);
grant select,insert,update,delete on public.categories,public.sub_categories,public.product_groups,public.sub_groups to authenticated;
`;
let n=0;
function assert(ok,label,detail=''){if(!ok)throw Error('FAIL '+label+' '+detail);console.log('PASS P'+(++n)+' '+label);}
if(!pgAvailable()){console.error('NOT TESTED: isolated PG unavailable');process.exit(2);}
const cluster=startCluster();
try{
 const db=cluster.newDb();
 const run=(sql)=>cluster.script(db,sql);
 const query=(sql)=>cluster.sql(db,sql);
 assert(run(seed).code===0,'fixture boot');
 const preflight=run(file('read-only-four-level-server-install-preflight.sql'));
 assert(preflight.code===0 && /PASS\\|10\\|0/.test(preflight.out),'Single-row ten-gate preflight is PASS before installation',preflight.out+' '+preflight.err);

 for(const [label,name] of [['parents','review-only-parent-classification-governed-rpcs.sql'],['subgroups','review-only-subgroup-governed-rpcs.sql']]){
  const x=run(file(name));assert(x.code===0,'install '+label,x.err);
 }
 const identity=(uid,role='authenticated')=>"set request.jwt.claim.sub='"+uid+"';set role "+role+";";
 const exec=(uid,sql,shouldPass,label,role='authenticated')=>{
  const r=run(identity(uid,role)+sql);
  assert((r.code===0)===shouldPass,label,r.err);
 };
 exec(editor,"select public.rpc_wp10_create_category('C'); select public.rpc_wp10_create_subcategory(1,'SC'); select public.rpc_wp10_create_product_group(1,'PG',1); select public.rpc_wp10_create_subgroup(1,'SG');",true,'Editor creates four-level hierarchy');
 assert(query('select count(*) from public.sub_groups')==='1','subgroup persisted');
 exec(editor,"select public.rpc_wp10_rename_category(1,'C2');select public.rpc_wp10_rename_subcategory(1,'SC2');select public.rpc_wp10_rename_product_group(1,'PG2');select public.rpc_wp10_rename_subgroup(1,'SG2');",true,'Editor renames all levels');
 for(const [stem,create,rename,remove] of [
  ['category',"select public.rpc_wp10_create_category('X');","select public.rpc_wp10_rename_category(1,'X');","select public.rpc_wp10_delete_category(1);"],
  ['subcategory',"select public.rpc_wp10_create_subcategory(1,'X');","select public.rpc_wp10_rename_subcategory(1,'X');","select public.rpc_wp10_delete_subcategory(1);"],
  ['product_group',"select public.rpc_wp10_create_product_group(1,'X',1);","select public.rpc_wp10_rename_product_group(1,'X');","select public.rpc_wp10_delete_product_group(1);"],
  ['subgroup',"select public.rpc_wp10_create_subgroup(1,'X');","select public.rpc_wp10_rename_subgroup(1,'X');","select public.rpc_wp10_delete_subgroup(1);"]
 ]) for(const [action,sql] of [['create',create],['rename',rename],['delete',remove]])
  exec(viewer,sql,false,'View-only denied '+stem+' '+action);

 // Verify cross-level isolation, not just all-Editor versus all-View-only.
 exec(categoryOnly,"select public.rpc_wp10_create_category('Category-only success');",true,'Scoped category Editor may create categories');
 for(const [label,sql] of [
 ['subcategories',"select public.rpc_wp10_create_subcategory(1,'No');"],
 ['product groups',"select public.rpc_wp10_create_product_group(1,'No',1);"],
 ['subgroups',"select public.rpc_wp10_create_subgroup(1,'No');"]
 ]) exec(categoryOnly,sql,false,'Category-only Editor cannot mutate '+label);
 for(const sig of [
 'rpc_wp10_create_category(text)','rpc_wp10_rename_category(integer,text)','rpc_wp10_delete_category(integer)',
 'rpc_wp10_create_subcategory(integer,text)','rpc_wp10_rename_subcategory(integer,text)','rpc_wp10_delete_subcategory(integer)',
 'rpc_wp10_create_product_group(integer,text,integer)','rpc_wp10_rename_product_group(integer,text)','rpc_wp10_delete_product_group(integer)',
 'rpc_wp10_create_subgroup(integer,text)','rpc_wp10_rename_subgroup(integer,text)','rpc_wp10_delete_subgroup(integer)'
 ]) {
  const spec="'public."+sig+"'";
  const catalog=query("select prosecdef::text||'|'||(array_to_string(proconfig,','))||'|'||has_function_privilege('authenticated',"+spec+",'EXECUTE')::text||'|'||has_function_privilege('anon',"+spec+",'EXECUTE')::text from pg_proc where oid="+spec+"::regprocedure");
  assert(catalog==="true|search_path=pg_catalog, public, pg_temp|true|false",'Catalog SECURITY DEFINER, fixed search_path, auth-only execution: '+sig,catalog);
 }
 const anonDenied=run(identity('','anon')+"select public.rpc_wp10_create_category('X');");
 assert(anonDenied.code!==0 && /permission denied for function/i.test(anonDenied.err),'Anon denied at EXECUTE ACL, not just permission guard',anonDenied.err);
 for(const name of ['category','subcategory','product_group'])exec(editor,'select public.rpc_wp10_delete_'+name+'(1);',false,'Cascade blocked '+name);
 exec(editor,'select public.rpc_wp10_delete_subgroup(1);',true,'Empty subgroup deletion');
 exec(editor,"select public.rpc_wp10_create_subgroup(1,'SG2');",true,'Subgroup recreate');
 query('insert into public.products(sub_group_id) values(2)');
 exec(editor,'select public.rpc_wp10_delete_subgroup(2);',false,'Product FK protected');
 query('delete from public.products');
 query('insert into costing.production_route_family_product_subgroup_map(product_subgroup_id) values(2)');
 exec(editor,'select public.rpc_wp10_delete_subgroup(2);',false,'Route map protected');
 query('delete from costing.production_route_family_product_subgroup_map');
 query('insert into costing.scheme_policy_rules(sub_group_id) values(2)');
 exec(editor,'select public.rpc_wp10_delete_subgroup(2);',false,'Scheme policy protected');
 // Model non-hierarchy live FKs and assert their DELETE restrict/no-action behavior.
 query("insert into public.product_groups(sub_category_id,group_name,kind_id) values(1,'Lab-only',1)");
 query("insert into lab.control_register(product_group_id) values(2)");
 exec(editor,'select public.rpc_wp10_delete_product_group(2);',false,'Lab control FK protects otherwise empty group');
 query('delete from lab.control_register');
 query("insert into costing.production_route_family_product_group_map(product_group_id) values(2)");
 exec(editor,'select public.rpc_wp10_delete_product_group(2);',false,'Route group map FK protects otherwise empty group');
 query('delete from costing.production_route_family_product_group_map');
 exec(editor,'select public.rpc_wp10_delete_product_group(2);',true,'Unreferenced group still deletable');
 exec(editor,"select public.rpc_wp10_create_product_group(1,'bad',999);",false,'Invalid kind blocked');
 assert(query('select product_group_id from public.sub_groups where id=2')==='1','Parent unchanged');
 const revoked=run(file('review-only-four-level-auth-dml-revoke.sql'));
 assert(revoked.code===0,'Four-level direct DML revoke',revoked.err);
 for(const table of ['categories','sub_categories','product_groups','sub_groups']){
  assert(query("select has_table_privilege('authenticated','public."+table+"','SELECT')") === 't',table+' SELECT retained');
  assert(query("select has_table_privilege('authenticated','public."+table+"','INSERT')") === 'f',table+' INSERT revoked');
  assert(query("select has_table_privilege('authenticated','public."+table+"','UPDATE')") === 'f',table+' UPDATE revoked');
  assert(query("select has_table_privilege('authenticated','public."+table+"','DELETE')") === 'f',table+' DELETE revoked');
 }
 exec(viewer,"select public.rpc_wp10_create_category('forbidden');",false,'View-only still denied after revoke');
 exec(editor,"select public.rpc_wp10_create_category('post revoke');",true,'Editor RPC survives direct-DML revoke');
 exec(editor,"insert into public.categories(category_name) values('bypass');",false,'Authenticated direct DML denied');
 const restored=run(file('review-only-four-level-auth-dml-revoke-rollback.sql'));
 assert(restored.code===0,'Four-level privilege rollback',restored.err);
 for(const table of ['categories','sub_categories','product_groups','sub_groups'])
  assert(query("select has_table_privilege('authenticated','public."+table+"','INSERT')") === 't',table+' DML restored');
 for(const [label,name] of [['subgroup','review-only-subgroup-governed-rpcs-rollback.sql'],['parent','review-only-parent-classification-governed-rpcs-rollback.sql']]){
  const r=run(file(name));assert(r.code===0,label+' rollback',r.err);
 }
 assert(query("select count(*) from pg_proc where proname like 'rpc_wp10_%' and pronamespace='public'::regnamespace")==='0','All twelve RPCs removed');
 console.log('PASS WP10 CLASSIFICATION PG '+n+'/'+n);
}finally{cluster.stop();}
