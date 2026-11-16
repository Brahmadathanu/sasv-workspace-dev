// WP10 RM1 real-lifecycle shape proof: ordinary approved map INACTIVATION is permitted by
// the live PRM RPC, even though direct DELETE of an approved map is prohibited by live immutability guards.
// Disposable PostgreSQL G2 fixture ONLY; no Supabase DML or real client session.
// The two RPC bodies below are transcription of live catalog 2026-11-17, hash pins recorded in result.
import {pgAvailable,startPg,g2FixtureSql,makeRunner,session,T,ACTIVATE} from "./fixture.mjs";
if(!pgAvailable()){console.error("BLOCKED isolated PG unavailable");process.exit(2);}
const cluster=startPg();
const liveRpc=String.raw`
create or replace function public.rpc_inactivate_product_subgroup_route_family_mapping(p_mapping_id bigint,p_effective_to date)
returns jsonb language plpgsql security definer set search_path='public','costing','pg_temp' as $body$
begin
 perform public.require_permission('module:production-route-manager',true);
 update costing.production_route_family_product_subgroup_map
 set status='INACTIVE',effective_to=p_effective_to,updated_at=now()
 where id=p_mapping_id and archived_at is null and status='APPROVED' and p_effective_to>=effective_from;
 if not found then raise exception 'Approved Product Subgroup Route Family mapping is not inactivatable'; end if;
 return jsonb_build_object('mapping_id',p_mapping_id,'status','INACTIVE','effective_to',p_effective_to);
end $body$;
create or replace function public.rpc_inactivate_product_route_family_assignment(p_assignment_id bigint,p_effective_to date)
returns jsonb language plpgsql security definer set search_path='public','costing','pg_temp' as $body$
begin
 perform public.require_permission('module:production-route-manager',true);
 update costing.production_route_family_product_map set status='INACTIVE',effective_to=p_effective_to,updated_at=now()
 where id=p_assignment_id and archived_at is null and status='APPROVED' and p_effective_to>=effective_from;
 if not found then raise exception 'Approved Product Route Family assignment is missing, archived, or not inactivatable'; end if;
 return jsonb_build_object('assignment_id',p_assignment_id,'status','INACTIVE','effective_to',p_effective_to);
end $body$;`;
const s=makeRunner(cluster,{sql:g2FixtureSql({load:["clock","states","reparent","route"]})+"\n"+liveRpc});
const editor=session({perms:"module:manage-products:edit,module:manage-products:view,module:production-route-manager:edit"});
let pass=0,fail=0;
const check=(label,ok,extra)=>{console.log((ok?"PASS ":"FAIL ")+label+(extra?" — "+extra:""));ok?pass++:fail++;};
try {
 const route=[
  "insert into costing.production_route_family(id,status,effective_from) values (777,'APPROVED',date '2026-01-01');",
  "insert into costing.production_route_family_product_subgroup_map(product_subgroup_id,route_family_id,status,effective_from) values(1,777,'APPROVED',date '2026-01-01');",
  "insert into costing.production_route_family_route(route_family_id,status,effective_from) values (777,'APPROVED',date '2026-01-01');",
  "insert into public.product_skus(product_id,pack_size,uom) values(1,50,'mL');",
  "select public.fx_complete(1,1,'ROUTE');"
 ].join("\n")+"\n";
 const a=s(editor+route+ACTIVATE(1)+
   T("subgroup_inactivation","select public.rpc_inactivate_product_subgroup_route_family_mapping(1,date '2026-11-15')"));
 const result=a.one("select ps.is_active::text||'|'||(costing.fn_validate_effective_product_process_route(ps.product_id::integer,date '2026-11-15')->>'valid') from public.product_skus ps where id=1");
 check("RM1 subgroup inactivation via live-RPC control flow succeeds",a.log.subgroup_inactivation?.ok===true);
 check("RM2 active SKU route becomes invalid without a product subgroup edit",result==="true|false",result);
 const b=s(editor+
 "insert into public.product_skus(product_id,pack_size,uom) values(1,50,'mL');"+
 "select public.fx_complete(1,1);\n"+ACTIVATE(1)+
 T("product_inactivation","select public.rpc_inactivate_product_route_family_assignment(1,date '2026-11-15')"));
 const result2=b.one("select ps.is_active::text||'|'||(costing.fn_validate_effective_product_process_route(ps.product_id::integer,date '2026-11-15')->>'valid') from public.product_skus ps where id=1");
 check("RM3 product assignment inactivation via live-RPC control flow succeeds",b.log.product_inactivation?.ok===true);
 check("RM4 product assignment inactivation can invalidate active SKU",result2==="true|false",result2);
 console.log(JSON.stringify({pass,fail,provenance:"LIVE-RPC-CONTROL-FLOW-TRANSCRIPTION / ISOLATED-ROUTE-TABLE-STANDINS",production_incident:false,fix_status:"OPEN"}));
} catch(e){console.error("FAIL/BLOCKED "+e.stack);fail++;}
finally{cluster.stop();}
if(fail)process.exitCode=1;
