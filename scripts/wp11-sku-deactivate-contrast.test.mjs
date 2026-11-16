// WP11 #429 — static product SKU lifecycle contrast guard; no live writer called.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const page=fs.readFileSync('public/shared/manage-products.html','utf8');
const theme=fs.readFileSync('public/shared/css/style.css','utf8');
const client=fs.readFileSync('public/shared/js/products.js','utf8');
test('SKU Deactivate uses the canonical filled-danger text contrast token',()=>{
 const rule=page.match(/#skuToggleActiveBtn\.danger\s*\{([^}]+)\}/)?.[1];
 assert.ok(rule,'missing Deactivate specificity rule');
 assert.match(rule,/color:\s*var\(--sasv-text-on-primary\)/);
 assert.ok(!rule.split(String.fromCharCode(10)).some(line => line.trim()==='color: var(--sasv-danger);'));
 assert.match(theme,/\.btn\.danger\s*\{[^}]*background:\s*var\(--sasv-danger\)[^}]*color:\s*var\(--sasv-text-on-primary\)/s);
});
test('SKU lifecycle still gated and no new client writer introduced',()=>{
 assert.match(page,/id="skuToggleActiveBtn"\s+data-md-writer/);
 assert.match(client,/async function toggleSkuActive\(\)/);
});
