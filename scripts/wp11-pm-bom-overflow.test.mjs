// WP11 UX-P05: actual Chromium 390px page-width gate with stubbed backend, no production writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {launch,startServer,openPage,overflow,MODULES} from './wp08-g2-0-shared-master-data/harness.mjs';
test('PM BOM narrow page never spills to document horizontal scroll (Electron + PWA)', async t=>{
 const e=await launch();
 if(!e) {assert.fail('Chromium unavailable: cannot accept UX-P05 as PASS');}
 e.servers={electron:await startServer('electron'),pwa:await startServer('pwa')};
 try{
  const m=MODULES.find(x=>x.key==='pm-templates');
  for(const platform of ['electron','pwa']){
   const r=await openPage(e,{platform,moduleDef:m,role:'edit',width:390});
   try {
    assert.deepEqual(r.failed,[],platform+' asset failures');
    assert.deepEqual(r.errors,[],platform+' client errors');
    const o=await overflow(r.page);
    const offenders=await r.page.evaluate(()=>Array.from(document.querySelectorAll('body *'))
      .filter(el=>{const b=el.getBoundingClientRect();const cs=getComputedStyle(el);return b.width>0&&b.right>innerWidth+2&&cs.position!=='fixed'})
      .slice(0,8).map(el=>({tag:el.tagName,id:el.id,cls:el.className?.toString().slice(0,70),right:Math.round(el.getBoundingClientRect().right)})));
    assert.ok(o.scrollWidth<=o.vw+1,platform+' PM BOM overflow '+JSON.stringify({viewport:o.vw,scrollWidth:o.scrollWidth,offenders}));
   }finally{await r.context.close();}
  }
 }finally{await e.close();e.servers.electron.close();e.servers.pwa.close();}
});
