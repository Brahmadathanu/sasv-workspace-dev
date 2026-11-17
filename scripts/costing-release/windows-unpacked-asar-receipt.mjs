// Costing Suite Windows app.asar rehearsal. NO installer, NO app launch/login,
// NO Supabase requests, NO publishing. Source-to-ASAR exact byte parity only.
// Usage: node scripts/costing-release/windows-unpacked-asar-receipt.mjs [--out file]
// Preconditions: electron-builder --win --dir --publish never has succeeded.
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,"../..");
const req=createRequire(import.meta.url);
const asar=req("@electron/asar");
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const expected=[
 "manage-categories.html","manage-subcategories.html","manage-product-groups.html","manage-subgroups.html",
 "js/categories.js","js/subcategories.js","js/product-groups.js","js/subgroups.js",
 "js/classification-master-access.js","js/classification-html-escape.js"
].map(p=>p);
const costing=["cost-build-manager","cost-sheet-review","costing-control-center","material-cost-manager","pricing-policy-manager","production-route-manager"].map(p=>`public/shared/${p}.html`);
const shared=["manage-products","manage-rm-bom","manage-pm-bom","manage-sp-bom"].map(p=>`public/shared/${p}.html`);
const files=[
 ...expected,...costing,...shared,
 "public/sw.js",
 "public/shared/js/products.js","public/shared/js/manage-rm-bom.js",
 "public/shared/js/manage-pm-bom.js","public/shared/js/manage-sp-bom.js",
 "public/shared/js/costing-feature-flags.js",
 "public/shared/js/costing-suite-shell.js",
 "public/shared/js/master-data-platform.js","public/shared/js/master-data-write-guard.js",
 "main.js","package.json"
];
const dist=path.resolve(process.env.COSTING_WIN_UNPACKED||path.join(root,"dist","win-unpacked"));
const pack=path.join(dist,"resources","app.asar");
const receipt={mode:"NONPUBLISH_WINDOWS_DIR_ONLY",generated_at:new Date().toISOString(),
 source_sha:process.env.GITHUB_SHA||null,app_version:JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8")).version,
 asar_exists:fs.existsSync(pack),binary_exists:fs.existsSync(path.join(dist,"SASV Workspace.exe")),
 checked_files:[],errors:[],no_installer_created_by_script:true,installed_windows_ui_test:false,authenticated_test:false};
if(!receipt.asar_exists||!receipt.binary_exists)receipt.errors.push("Windows unpacked app.asar or SASV Workspace.exe absent");
let listing=[];
if(receipt.asar_exists)try{listing=asar.listPackage(pack).map(x=>x.replaceAll("\\","/"));}catch(e){receipt.errors.push("cannot open ASAR: "+e.message);}
for(const rel of files){
 const local=path.join(root,rel);
 if(!fs.existsSync(local)){receipt.errors.push("source missing: "+rel);continue;}
 if(!listing.includes("/"+rel)){receipt.errors.push("ASAR file missing: "+rel);continue;}
 const source=fs.readFileSync(local);
 let embedded;
 try{embedded=asar.extractFile(pack,rel);}catch(e){receipt.errors.push("extract failed "+rel+": "+e.message);continue;}
 const expectedSha=sha(source),actualSha=sha(embedded),ok=expectedSha===actualSha;
 receipt.checked_files.push({path:rel,sha256:expectedSha,match:ok});
 if(!ok)receipt.errors.push("byte drift: "+rel);
}
if(listing.includes("/manage-product-groups.html")){
 const html=asar.extractFile(pack,"manage-product-groups.html").toString("utf8");
 if(!html.includes("newGroupKind"))receipt.errors.push("mandatory group-kind chooser absent in ASAR");
}
for(const rel of ["docs/master-data-costing/MASTER_PROGRAMME.md","scripts/costing-release/windows-unpacked-asar-receipt.mjs"]){
 if(listing.includes("/"+rel))receipt.errors.push("nonruntime docs/scripts unexpectedly packed: "+rel);
}
receipt.verdict=receipt.errors.length===0?"PASS":"FAIL";
receipt.matched=receipt.checked_files.filter(x=>x.match).length;
receipt.expected=files.length;
if(receipt.matched!==receipt.expected){receipt.errors.push("incomplete expected ASAR parity");receipt.verdict="FAIL";}
const outAt=process.argv.indexOf("--out");
if(outAt>=0&&process.argv[outAt+1]){
 const out=path.resolve(process.argv[outAt+1]);
 fs.mkdirSync(path.dirname(out),{recursive:true});
 fs.writeFileSync(out,JSON.stringify(receipt,null,2)+"\n");
}
console.log(`WINDOWS_UNPACKED_ASAR_${receipt.verdict} ${receipt.matched}/${receipt.expected} exact source bytes; version=${receipt.app_version}; source=${receipt.source_sha||"UNKNOWN"}`);
if(receipt.errors.length)receipt.errors.forEach(x=>console.error("FAIL "+x));
if(receipt.verdict!=="PASS")process.exitCode=1;
