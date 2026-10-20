import test from 'node:test';
import assert from 'node:assert/strict';
// Isolated behavioural model; NOT a PostgreSQL integration test.
const validAt=(r,d)=>!r.archived&&r.from<=d&&(r.to===null||r.to>=d);
function resolve(rows,subject,day){
 const hits=rows.filter(r=>r.subject===subject&&validAt(r,day)&&['APPROVED','SUPERSEDED'].includes(r.status));
 if(hits.length>1)throw Error('AMBIGUOUS_HISTORICAL_ROUTE');
 return hits[0]?.id??null;
}
const route=(id,status,from,to,archived=false)=>({id,subject:51,status,from,to,archived});
const strictApprove=r=>r.status==='APPROVED'&&!r.archived;
test('family historical boundary',()=>{
 const rs=[route(144,'SUPERSEDED','2026-08-30','2026-10-31'),route(201,'APPROVED','2026-11-01',null)];
 assert.equal(resolve(rs,51,'2026-10-31'),144);assert.equal(resolve(rs,51,'2026-11-01'),201);
});
test('product historical boundary',()=>{
 const rs=[route(73,'SUPERSEDED','2026-08-30','2026-10-31'),route(99,'APPROVED','2026-11-01',null)];
 assert.equal(resolve(rs,51,'2026-10-31'),73);assert.equal(resolve(rs,51,'2026-11-01'),99);
});
test('overlap fails closed',()=>assert.throws(()=>resolve([
 route(144,'SUPERSEDED','2026-08-30','2026-11-02'),route(201,'APPROVED','2026-11-01',null)
],51,'2026-11-01'),/AMBIGUOUS/));
test('archived and invalid statuses excluded',()=>{
 const rs=[route(1,'DRAFT','2026-01-01',null),route(2,'REJECTED','2026-01-01',null),route(3,'INACTIVE','2026-01-01',null),route(4,'SUPERSEDED','2026-01-01',null,true)];
 assert.equal(resolve(rs,51,'2026-10-20'),null);
});
test('new approval stays strict',()=>{
 assert.equal(strictApprove(route(144,'SUPERSEDED','2026-01-01','2026-10-31')),false);
 assert.equal(strictApprove(route(201,'APPROVED','2026-11-01',null)),true);
 assert.equal(strictApprove(route(201,'APPROVED','2026-11-01',null,true)),false);
});
test('subject isolation',()=>assert.equal(resolve([route(144,'SUPERSEDED','2026-01-01',null)],957,'2026-10-20'),null));
