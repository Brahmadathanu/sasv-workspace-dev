import test from 'node:test';
import assert from 'node:assert/strict';
const steps=[
 {seq:10,base:0,occ:1,cyc:1}, {seq:20,base:1,occ:1,cyc:1},{seq:30,base:1,occ:1,cyc:1},
 {seq:40,base:0.6,occ:8,cyc:8},{seq:50,base:1,occ:8,cyc:8},
 {seq:60,base:1,occ:8,cyc:8},{seq:70,base:0.1,occ:8,cyc:8},
 {seq:80,base:0,occ:8,cyc:8},{seq:90,base:0,occ:8,cyc:8}
];
const intensity=(s)=>s.reduce((sum,r)=>sum+r.base*r.occ*r.cyc,0);
const proposed=steps.map(s=>s.occ===8&&s.cyc===8?{...s,cyc:1}:s);
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('frozen DL historical factors reproduced',()=>close(intensity(steps),174.8));
test('successor represents eight actual repetitions once',()=>close(intensity(proposed),23.6));
test('six affected steps, three originals unchanged',()=>{
 assert.equal(proposed.filter((r,i)=>r.cyc!==steps[i].cyc).length,6);
 assert.deepEqual(proposed.filter(r=>r.seq<=30),steps.filter(r=>r.seq<=30));
});
test('POH separate scope weights produce original and proposed totals',()=>{
 const p=steps.map(s=>({...s,base:s.seq>=40&&s.seq<=60?1:s.seq===70?0.25:s.base}));
 close(intensity(p),210);close(intensity(p.map(s=>s.occ===8&&s.cyc===8?{...s,cyc:1}:s)),28);
});
test('other true single-dimension cycles preserved',()=>{
 for(const cycles of [3,40,41,101]){
  const s={seq:1,base:1,occ:1,cyc:cycles};
  const fixed=s.occ===8&&s.cyc===8?{...s,cyc:1}:s;
  assert.equal(fixed.cyc,cycles);
 }
});
test('historical fixture unchanged',()=>{assert.equal(steps[3].cyc,8);assert.equal(steps[6].cyc,8)});
