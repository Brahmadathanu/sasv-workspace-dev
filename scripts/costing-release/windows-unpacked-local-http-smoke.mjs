// Windows packaged Electron local HTTP smoke. Requires the CI to install an effective
// OUTBOUND BLOCK FIREWALL rule for the unpacked executable before invoking this script.
// Does not log in, inspect confidential data, modify app files, click UI or publish an updater.
// Runtime launch is restricted to a disposable Windows GitHub runner. Fail-closed if
// COSTING_OUTBOUND_FIREWALL_CONFIRMED is not exactly "1".
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {spawn,execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {chromium}=require("playwright-core");
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const exe=path.join(root,"dist","win-unpacked","SASV Workspace.exe");
const must=process.env.COSTING_OUTBOUND_FIREWALL_CONFIRMED==="1" && process.platform==="win32" && fs.existsSync(exe);
if(!must){console.error("BLOCKED: no Windows executable or confirmed outbound firewall; will NOT launch");process.exit(2);}
const assets=[
 "login.html",
 "manage-categories.html","manage-subcategories.html","manage-product-groups.html","manage-subgroups.html",
 "js/categories.js","js/subcategories.js","js/product-groups.js","js/subgroups.js",
 "js/classification-master-access.js","js/classification-html-escape.js",
 ...["cost-build-manager","cost-sheet-review","costing-control-center","material-cost-manager","pricing-policy-manager","production-route-manager"].map(x=>`public/shared/${x}.html`),
 ...["manage-products","manage-rm-bom","manage-pm-bom","manage-sp-bom"].map(x=>`public/shared/${x}.html`),
 "public/shared/js/costing-suite-shell.js","public/shared/js/costing-feature-flags.js",
 "public/shared/js/manage-pm-bom.js","public/shared/js/products.js",
 "public/sw.js"
];
const sha=x=>crypto.createHash("sha256").update(x).digest("hex");
const receipt={environment:"EPHEMERAL_WINDOWS_CI",date:new Date().toISOString(),source_sha:process.env.GITHUB_SHA||null,
 firewall_confirmed:true,launched:false,served:[],errors:[],no_login:true,no_updater_or_production_access:"OUTBOUND_BLOCK_RULE_FOR_EXE",installer_test:false,renderer:{status:"NOT_TESTED",errors:[]}};
const ctrl=new AbortController();
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let child,cdpBrowser;
try{
 child=spawn(exe,["--remote-debugging-address=127.0.0.1","--remote-debugging-port=9334"],{cwd:path.dirname(exe),windowsHide:true,stdio:"ignore",env:{...process.env,NODE_ENV:"production"}});
 receipt.launched=true;receipt.pid=child.pid||null;
 let ready=false;
 for(let n=0;n<35;n++){
  if(child.exitCode!==null){receipt.errors.push("app exited before local server was ready: "+child.exitCode);break;}
  try{
   const r=await fetch("http://127.0.0.1:3000/login.html",{signal:AbortSignal.timeout(1200)});
   if(r.status===200){ready=true;break;}
  }catch{}
  await delay(500);
 }
 if(!ready)receipt.errors.push("localhost packaged Express did not serve login.html");
 if(ready){
  // Actual packaged Chromium renderer, not a standalone browser or direct HTTP parser.
  // Only the unauthenticated login shell is observed; no clicking/typing.
  try{
   for(let n=0;n<24;n++){
    try{cdpBrowser=await chromium.connectOverCDP("http://127.0.0.1:9334",{timeout:1000});break;}catch{}
    await delay(400);
   }
   if(!cdpBrowser)throw Error("packaged Electron DevTools not reachable on loopback");
   const context=cdpBrowser.contexts()[0];
   if(!context)throw Error("packaged renderer context missing");
   let loginPage;
   for(let n=0;n<20;n++){
    loginPage=context.pages().find(p=>/^http:\/\/localhost:3000\/login\.html(?:[?#]|$)/.test(p.url()));
    if(loginPage)break;
    await delay(300);
   }
   if(!loginPage)throw Error("packaged main window did not navigate to login.html");
   await loginPage.locator("#email").waitFor({state:"visible",timeout:8000});
   await loginPage.locator("#password").waitFor({state:"visible",timeout:8000});
   const title=await loginPage.title();
   const heading=await loginPage.locator("h2").first().innerText();
   const pass=title==="SASV WORKSPACE | Login" && heading.trim()==="Sign In";
   receipt.renderer={status:pass?"PASS":"FAIL",title,heading,login_input_visible:true,password_input_visible:true,
     url_path:"/login.html",real_packaged_electron:true,no_login_or_interaction:true,errors:pass?[]:["title or heading unexpected"]};
   if(!pass)receipt.errors.push("Electron renderer login shell title/heading mismatch");
  }catch(e){
   receipt.renderer={status:"FAIL",errors:[e.message],no_login_or_interaction:true};
   receipt.errors.push("Electron renderer smoke: "+e.message);
  }
 }
 if(ready)for(const rel of assets){
  try{
   const r=await fetch("http://127.0.0.1:3000/"+rel,{signal:AbortSignal.timeout(4000)});
   if(!r.ok){receipt.errors.push(rel+": HTTP "+r.status);continue;}
   const got=Buffer.from(await r.arrayBuffer()),want=fs.readFileSync(path.join(root,rel));
   const match=sha(got)===sha(want);
   receipt.served.push({path:rel,status:r.status,sha256:sha(got),match});
   if(!match)receipt.errors.push(rel+": served/source bytes differ");
  }catch(e){receipt.errors.push(rel+": "+e.message);}
 }
}catch(e){receipt.errors.push(e.message);}
finally{
 ctrl.abort();
 try{if(cdpBrowser)await cdpBrowser.close();}catch{}
 if(child?.pid){
  try{execFileSync("taskkill",["/PID",String(child.pid),"/T","/F"],{stdio:"ignore",timeout:8000});}
  catch{try{child.kill();}catch{}}
  await delay(500);
 }
}
receipt.verdict=receipt.errors.length===0&&receipt.served.length===assets.length&&receipt.renderer.status==="PASS"?"PASS":"FAIL";
receipt.served_count=receipt.served.filter(x=>x.match).length;
receipt.expected_count=assets.length;
const idx=process.argv.indexOf("--out");
if(idx>=0&&process.argv[idx+1]){
 const target=path.resolve(process.argv[idx+1]);
 fs.mkdirSync(path.dirname(target),{recursive:true});
 fs.writeFileSync(target,JSON.stringify(receipt,null,2)+"\n");
}
console.log(`WINDOWS_LOCAL_HTTP_${receipt.verdict} ${receipt.served_count}/${assets.length} localhost source byte parity; renderer=${receipt.renderer.status}; outbound firewall confirmed; no login`);
for(const e of receipt.errors)console.error("FAIL "+e);
if(receipt.verdict!=="PASS")process.exitCode=1;
