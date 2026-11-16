// WP10 B4: actual competing transactions on disposable local PostgreSQL.
// Tests a parent-delete RPC against concurrent governed child insertion in BOTH orders.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { pgAvailable,startCluster } from '../wp08-g2-0-shared-master-data/pg-harness.mjs';
if(!pgAvailable()){console.error('NOT TESTED: PostgreSQL unavailable');process.exit(2);}
const sqlDir=path.dirname(fileURLToPath(import.meta.url));
const rpc=fs.readFileSync(path.join(sqlDir,'review-only-parent-classification-governed-rpcs.sql'),'utf8');
const uid='11111111-1111-4111-8111-111111111111';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let n=0;
function check(ok,label,details=''){if(!ok)throw Error('FAIL '+label+' '+details);console.log('PASS R'+(++n)+' '+label);}
const cluster=startCluster();
try{
 const first=cluster.newDb();
 const role=cluster.script(first,'create role authenticated nologin; create role anon nologin;');
 check(role.code===0,'isolated SQL roles created',role.err);
 const seed=`
 create schema auth;
 create function auth.uid() returns uuid language sql stable as $fn$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $fn$;
 create table public.user_permissions_canonical(user_id uuid,target text,can_view boolean,can_edit boolean,primary key(user_id,target));
 create function public.require_permission(p_target text,p_need_edit boolean default false)
 returns void language plpgsql security definer set search_path=public as $fn$
 begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from public.user_permissions_canonical where user_id=auth.uid()
   and target=p_target and can_view=true and (not p_need_edit or can_edit=true))
  then raise exception 'Permission denied for % (edit=%)',p_target,p_need_edit; end if;
 end $fn$;
 insert into public.user_permissions_canonical values
 ('${uid}'::uuid,'module:manage-categories',true,true),
 ('${uid}'::uuid,'module:manage-subcategories',true,true);
 create table public.categories(id serial primary key,category_name text not null);
 create table public.sub_categories(id serial primary key,category_id int not null references public.categories(id) on delete cascade,subcategory_name text not null);
 create table public.product_group_kinds(id int primary key,group_name text);
 create table public.product_groups(id serial primary key,sub_category_id int not null references public.sub_categories(id) on delete cascade,group_name text not null,kind_id int references public.product_group_kinds(id));
 create table public.sub_groups(id serial primary key,product_group_id int not null references public.product_groups(id) on delete cascade,sub_group_name text not null);
 insert into public.categories(category_name) values('Concurrent parent');
 `;
 function psql(db,sqlText){
  const sock=cluster.sql(db,'show unix_socket_directories');
  const port=cluster.sql(db,'show port');
  return new Promise(resolve=>{
   const child=spawn('psql',['-X','-q','-h',sock,'-p',port,'-U','postgres','-d',db,'-t','-A','-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});
   let out='',err='';
   child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);
   child.on('close',code=>resolve({code,out,err}));
   child.stdin.end(sqlText);
  });
 }
 const identity=`set request.jwt.claim.sub='${uid}';set role authenticated;`;
 async function barrier(db,appName){
  for(let i=0;i<50;i++){
   if(Number(cluster.sql(db,"select count(*) from pg_stat_activity where application_name='"+appName+"' and wait_event='PgSleep'"))>0)return true;
   await sleep(75);
  }
  return false;
 }
 // Delete transaction wins lock and commits; late child must fail.
 {
  const db=first;let x=cluster.script(db,seed+rpc);check(x.code===0,'delete-first fixture installed',x.err);
  const deletion=psql(db,`set application_name='wp10_delete_first';${identity}
  begin;select public.rpc_wp10_delete_category(1);select pg_sleep(2);commit;`);
  const reached=await barrier(db,'wp10_delete_first');
  const creation=reached?psql(db,`set statement_timeout='8000ms';${identity}
  select public.rpc_wp10_create_subcategory(1,'late child');`):Promise.resolve({code:99,err:'barrier not observed'});
  const [a,b]=await Promise.all([deletion,creation]);
  check(reached&&a.code===0&&b.code!==0&&cluster.sql(db,'select count(*) from public.categories')==='0'
   &&cluster.sql(db,'select count(*) from public.sub_categories')==='0',
   'delete-first child cannot be created after parent is committed deleted',JSON.stringify({reached,a,b}));
 }
 // Child insertion transaction commits before parent can lock; deletion rejects, no cascade.
 {
  const db=cluster.newDb();const x=cluster.script(db,seed+rpc);check(x.code===0,'child-first fixture installed',x.err);
  const creation=psql(db,`set application_name='wp10_child_first';${identity}
  begin;select public.rpc_wp10_create_subcategory(1,'protected child');select pg_sleep(2);commit;`);
  const reached=await barrier(db,'wp10_child_first');
  const deletion=reached?psql(db,`set statement_timeout='8000ms';${identity}
  select public.rpc_wp10_delete_category(1);`):Promise.resolve({code:99,err:'barrier not observed'});
  const [a,b]=await Promise.all([creation,deletion]);
  check(reached&&a.code===0&&b.code!==0
   &&/subordinate classification records exist/.test(b.err)
   &&cluster.sql(db,'select count(*) from public.categories')==='1'
   &&cluster.sql(db,'select count(*) from public.sub_categories')==='1',
   'child-first delete waits, rejects and preserves child',JSON.stringify({reached,a,b}));
 }
 console.log('PASS WP10 PARENT DELETE/CREATE CONCURRENCY '+n+'/'+n);
}finally{cluster.stop();}
