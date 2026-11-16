// WP12 live anonymous direct-route denial witness. No credentials, no session, no data-bearing evidence.
// No write method may leave the browser; no clicks, flags, role impersonation or Supabase inserts.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const origin = "https://sasv-utilities-hub.netlify.app";
const pages = [
  "costing-control-center", "cost-build-manager", "cost-sheet-review",
  "material-cost-manager", "pricing-policy-manager", "production-route-manager",
];
test("live no-session direct route denies all six Costing modules without business reads", { timeout: 125000 }, async () => {
 const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
 try {
  for(const module of pages) {
   const context=await browser.newContext({ viewport:{width:390,height:844}, storageState:{cookies:[],origins:[]}, serviceWorkers:"block" });
   const page=await context.newPage();
   const businessReads=[],writeRequests=[],errors=[];
   await page.route("**/*", async route=>{
    const request=route.request();
    const url=new URL(request.url());
    if(!["GET","HEAD"].includes(request.method())) {
      writeRequests.push({method:request.method(),path:url.pathname});
      return route.abort("blockedbyclient");
    }
    // Record protected PostgREST reads but never expose query parameters or response bodies.
    if(url.hostname.endsWith(".supabase.co") && (/^\/rest\/v1\//.test(url.pathname)||/^\/functions\/v1\//.test(url.pathname)))businessReads.push(url.pathname);
    return route.continue();
   });
   page.on("pageerror", e=>errors.push(String(e.message).slice(0,180)));
   const initial=await page.goto(origin+"/shared/"+module+".html",{waitUntil:"domcontentloaded",timeout:25000});
   assert.equal(initial.status(),200,module+" page served");
   await page.waitForURL(u=>u.pathname==="/login.html",{timeout:17000});
   assert.equal(new URL(page.url()).pathname,"/login.html",module+" redirected to login");
   assert.deepEqual(writeRequests,[],module+" must send no write methods");
   assert.deepEqual(businessReads,[],module+" must not request protected data while logged out");
   const flagKeys=await page.evaluate(()=>Object.keys(localStorage).filter(k=>/^COSTING_.*_V1$/.test(k)));
   assert.deepEqual(flagKeys,[],module+" anonymous context has no enabled flags");
   console.log("PASS anonymous redirect",module,"no protected REST reads/writes; no flags");
   await context.close();
  }
 }finally{await browser.close();}
});
