// WP10 review-only G2/CI-032 historical stop gate. Pure source/policy tests, NO Supabase.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const root = new URL("../../",import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),"utf8");
const cat=JSON.parse(read("docs/master-data-costing/WP10_G2_EVIDENCE/independent-route-callee-catalog-2026-11-15.json"));
const resolver=name=>cat.functions.find(f=>f.proname===name)?.definition||"";
const audit=read("docs/costing-pipeline-independent-audit/closure/evidence/G2/G2_LIVE_HISTORICAL_ROUTE_OVERLAP_EXCEPTION_INVENTORY_2026-10-20.md");
const policy=read("docs/master-data-costing/WP10_RM1_G2_CI032_HISTORICAL_ROUTE_RECONCILIATION_2026-11-17.md");
function hasIntersection(a,b){
 const start=String(a.from)>String(b.from)?a.from:b.from;
 const endA=a.to||"9999-12-31",endB=b.to||"9999-12-31";
 const end=endA<endB?endA:endB;
 return start<=end;
}
test("H1 historical product resolver remains strictly approved/nonarchived in source catalog",()=>{
 const p=resolver("fn_resolve_effective_product_process_route");
 assert.match(p,/r\.status='APPROVED'/);
 assert.match(p,/r\.archived_at is null/);
 assert.match(p,/AMBIGUOUS_APPROVED_PRODUCT_ROUTE/);
 assert.doesNotMatch(p,/r\.status in \('APPROVED','SUPERSEDED'\)/);
});
test("H2 family-route resolver's historical eligibility is distinct",()=>{
 const f=resolver("fn_resolve_effective_route_family_route");
 assert.match(f,/r\.status in \('APPROVED','SUPERSEDED'\)/);
 assert.match(f,/r\.effective_from<=/);
 assert.match(f,/r\.effective_to is null/);
});
test("H3 existing independent audit's overlap stop gate is explicitly retained",()=>{
 assert.match(audit,/10 overlapping family-route pairs and 7 overlapping product-route pairs/);
 assert.match(audit,/not safe/i);
 assert.match(policy,/G2\/CI-032/);
 assert.match(policy,/frozen snapshots/i);
});
test("H4 inclusive same-day successor collides with superseded predecessor",()=>{
 assert.equal(hasIntersection({from:"2026-08-24",to:"2026-08-25"},{from:"2026-08-25",to:null}),true);
 assert.equal(hasIntersection({from:"2026-08-24",to:"2026-08-24"},{from:"2026-08-25",to:null}),false);
});
test("H5 open-ended predecessor overlaps approved successor; broadening status is ambiguous",()=>{
 assert.equal(hasIntersection({from:"2026-08-28",to:null},{from:"2026-09-01",to:null}),true);
 assert.equal(hasIntersection({from:"2026-08-28",to:"2026-08-31"},{from:"2026-09-01",to:null}),false);
});
test("H6 review proposal may not silently mutate historical route selector",()=>{
 const proposal=read("scripts/wp10-g2-safeguards/review-only-rm1-mapping-impact-PROTOTYPE.sql");
 assert.doesNotMatch(proposal,/create or replace function costing\.fn_resolve_effective_product_process_route/i);
 assert.doesNotMatch(proposal,/update costing\.product_process_route/i);
 assert.doesNotMatch(proposal,/update costing\.product_direct_labour_workload_snapshot/i);
 assert.doesNotMatch(proposal,/update costing\.product_production_overhead_workload_snapshot/i);
});
