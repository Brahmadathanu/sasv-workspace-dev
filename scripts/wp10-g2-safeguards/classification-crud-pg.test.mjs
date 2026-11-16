// Disposable local PostgreSQL fixture; no network database connections or production writes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pgAvailable, startCluster } from '../wp08-g2-0-shared-master-data/pg-harness.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url));
const file=(name)=>fs.readFileSync(path.join(dir,name),'utf8');
const editor='11111111-1111-4111-8111-111111111111', viewer='22222222-2222-4222-8222-222222222222';
const seed=`
create schema auth; create schema costing;
create role authenticated nologin; create role anon nologin;
create function auth.uid() returns uuid language sql stable as $f$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $f$;
create table public.user_permissions_canonical(user_id uuid,target text,can_view boolean,can_edit boolean,primary key(user_id,target));
create function public.require_permission(p_target text,p_need_edit boolean default false) returns void
 language plpgsql security definer set search_path=public as $f$
 begin if auth.uid() is null or not exists(select 1 from public.user_permissions_canonical
 where user_id=auth.uid() and target=p_target and can_view=true
 and (not p_need_edit or can_edit=true)) then raise exception 'Permission denied'; end if; end $f$;
insert into public.user_permissions_canonical
select u.uid,'module:manage-'||m.target,true,u.edit from
(values ('11111111-1111-4111-8111-111111111111'::uuid,true),
('22222222-2222-4222-8222-222222222222'::uuid,false)) u(uid,edit),
(values ('categories'),('subcategories'),('product-groups'),('subgroups')) m(target);
create table public.categories(id serial primary key,category_name text not null);
create table public.sub_categories(id serial primary key,category_id integer not null references public.categories(id) on delete cascade,subcategory_name text not null);
create table public.product_group_kinds(id integer primary key,group_name text);
insert into public.product_group_kinds values(1,'Fixture kind');
create table public.product_groups(id serial primary key,sub_category_id integer not null references public.sub_categories(id) on delete cascade,group_name text not null,kind_id integer not null references public.product_group_kinds(id));
create table public.sub_groups(id serial primary key,product_group_id integer not null references public.product_groups(id) on delete cascade,sub_group_name text not null);
create table public.products(id serial primary key,sub_group_id integer references public.sub_groups(id) on delete restrict);
create table costing.production_route_family_product_subgroup_map(id serial primary key,product_subgroup_id integer references public.sub_groups(id) on delete restrict);
create table costing.scheme_policy_rules(id serial primary key,sub_group_id integer references public.sub_groups(id));
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
 for(const [name,sql] of [['category',"select public.rpc_wp10_create_category('X');"],['subcategory',"select public.rpc_wp10_rename_subcategory(1,'X');"],['group','select public.rpc_wp10_delete_product_group(1);'],['subgroup','select public.rpc_wp10_delete_subgroup(1);']])
  exec(viewer,sql,false,'View-only denied '+name);
 exec('',"select public.rpc_wp10_create_category('X');",false,'Anon denied','anon');
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
 exec(editor,"select public.rpc_wp10_create_product_group(1,'bad',999);",false,'Invalid kind blocked');
 assert(query('select product_group_id from public.sub_groups where id=2')==='1','Parent unchanged');
 for(const [label,name] of [['subgroup','review-only-subgroup-governed-rpcs-rollback.sql'],['parent','review-only-parent-classification-governed-rpcs-rollback.sql']]){
  const r=run(file(name));assert(r.code===0,label+' rollback',r.err);
 }
 assert(query("select count(*) from pg_proc where proname like 'rpc_wp10_%' and pronamespace='public'::regnamespace")==='0','All twelve RPCs removed');
 console.log('PASS WP10 CLASSIFICATION PG '+n+'/'+n);
}finally{cluster.stop();}
