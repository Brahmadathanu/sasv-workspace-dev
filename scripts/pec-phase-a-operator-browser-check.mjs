#!/usr/bin/env node
/**
 * PEC Phase A genuine-session, NON-MUTATING acceptance assistant.
 *
 * Operator signs in themselves in a fresh, ephemeral browser context.
 * No tokens/credentials/session storage, screenshot or business row export.
 * One *invalid-key* writer permission probe only for the View-only identity;
 * no valid indent key, business-data mutation, downloads or approved changes.
 *
 * Install deps outside the repo if desired:
 *   npm install --prefix /tmp/pec-browser-acceptance playwright@1.62.1
 *   /tmp/pec-browser-acceptance/node_modules/.bin/playwright install chromium
 *   PEC_PLAYWRIGHT_MODULE=/tmp/pec-browser-acceptance/node_modules/playwright node scripts/pec-phase-a-operator-browser-check.mjs --role=view-only --url=https://deploy-preview-347--sasv-utilities-hub.netlify.app
 *
 * Node ESM does not honor NODE_PATH. Use the explicit PEC_PLAYWRIGHT_MODULE path.
 */
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const i = a.indexOf('=');
  return [i > 0 ? a.slice(2, i) : a.slice(2), i > 0 ? a.slice(i + 1) : 'true'];
}));
const role = args.role;
if (!['editor','view-only','no-access'].includes(role)) {
  console.error('Usage: node scripts/pec-phase-a-operator-browser-check.mjs --role=editor|view-only|no-access --url=https://<trusted-PEC-preview-host>');
  process.exit(2);
}
const origin = new URL(args.url || 'https://deploy-preview-347--sasv-utilities-hub.netlify.app');
if (origin.protocol !== 'https:' || !/^(deploy-preview-347--sasv-utilities-hub\.netlify\.app|sasv-utilities-hub\.netlify\.app)$/.test(origin.hostname)) {
  throw Error('Only the known PEC preview/production HTTPS hosts are permitted');
}
if (!stdin.isTTY) throw Error('This genuine-session harness requires an interactive operator terminal');

let chromium;
try {
  const require = createRequire(import.meta.url);
  const pkg = process.env.PEC_PLAYWRIGHT_MODULE || 'playwright';
  ({ chromium } = require(pkg));
} catch {
  throw Error('Playwright not installed: npm install --no-save playwright@1.62.1, then npx playwright install chromium');
}

const browser = await chromium.launch({ headless:false });
const context = await browser.newContext({ viewport: { width:1280, height:850 }, acceptDownloads:false });
const page = await context.newPage();
const results = [];
const rpcSummary = new Map();
function result(id, status, detail) {
  results.push({ id, status, detail });
  console.log(status.padEnd(8), id, '-', detail);
}
page.on('response', r => {
  try {
    const url = new URL(r.url());
    if (!url.pathname.startsWith('/rest/v1/rpc/')) return;
    const name = url.pathname.split('/').pop();
    if (!/^proc_(pec_|vendorwise_)/.test(name)) return;
    const key = name + ':' + r.status();
    rpcSummary.set(key, (rpcSummary.get(key) || 0) + 1);
  } catch { /* Never inspect headers/body: can contain credentials and records. */ }
});

const rl = createInterface({ input:stdin, output:stdout });
try {
  await page.goto(origin.toString(), { waitUntil:'domcontentloaded', timeout:60000 });
  console.log('\nSign in using your real authorized account IN THE OPENED BROWSER.');
  console.log('Do not paste passwords, user IDs, JWTs, or business data into this terminal.');
  await rl.question('After login is complete, press Enter here to run read-only PEC checks... ');
  await page.goto(new URL('/shared/procurement-execution-console.html', origin).toString(), {
    waitUntil:'domcontentloaded',timeout:60000
  });
  await page.waitForTimeout(2500); // Allow asynchronous module access lookup. Not a proof of loaded data.
  const panel = page.locator('#mainPanel');
  const statusArea = page.locator('#statusArea');
  const status = (await statusArea.textContent().catch(() => ''))?.trim().slice(0,180) || '';
  const panelVisible = await panel.isVisible().catch(() => false);
  if (role === 'no-access') {
    result('A03_no_pec_access', !panelVisible && /You do not have permission to open Procurement Execution Console\./i.test(status)?'PASS':'FAIL',
      !panelVisible ? 'PEC main panel hidden; explicit PEC permission-denied status: '+/You do not have permission to open Procurement Execution Console\./i.test(status) : 'Unexpected PEC main panel visible');
  } else {
    result('A01_A02_module_access', panelVisible?'PASS':'FAIL', panelVisible?'PEC panel visible':'PEC panel hidden; check actual login/permission');
    if (panelVisible) {
      const tabs=['pr','indents','vendor-buylist','action','excess'];
      for (const tab of tabs) {
        const button=page.locator('[data-tab="'+tab+'"].tab-btn');
        const present = await button.count()===1 && await button.isVisible();
        if (present) await button.click().catch(()=>{});
        result('lens_'+tab,present?'PASS':'FAIL',present?'Navigation tab visible and activated':'Navigation tab missing/hidden');
      }
      const banner = await page.locator('#viewOnlyBanner').isVisible().catch(()=>false);
      result('view_only_banner', (role==='view-only'?banner:!banner)?'PASS':'FAIL',
        banner?'Read-only banner visible':'Read-only banner absent');
      const controls=await page.locator("[data-edit-action='true']").evaluateAll(els =>
        els.filter(el=>['BUTTON','INPUT','SELECT','TEXTAREA'].includes(el.tagName))
          .map(el=>({ disabled:el.disabled, ariaDisabled:el.getAttribute('aria-disabled') }))
      );
      if (role==='view-only') {
        result('A02_edit_controls',controls.length>0 && controls.every(x=>x.disabled && x.ariaDisabled==='true')?'PASS':'FAIL',
          controls.length+' marked edit controls; disabled='+controls.filter(x=>x.disabled).length);
      } else {
        result('A01_editor_controls',controls.length>0?'PASS':'BLOCKED',
          controls.length+' marked edit controls located (no write action attempted)');
      }
      if (role==='editor') {
        result('A04_A08_full_functional', 'NOT_TESTED',
          'Filters, export completeness, vendor selection and server writes require supervised fixtures; this harness never mutates');
      }
    }
  }
  // Server-side permission probes are deliberately bounded and must run only after
  // the operator signs in with the actual expected role. The browser-held Supabase
  // client performs the request: no JWT, request headers or response bodies cross
  // into the Node harness or get written to the evidence output.
  if (role === 'no-access' || role === 'view-only') {
    console.log('\nRunning bounded genuine-session RPC permission probes (no business record write).');
    const negative = await page.evaluate(async ({ roleCategory }) => {
      const { supabase } = await import('./js/supabaseClient.js');
      const identity = await supabase.auth.getUser();
      if (identity.error || !identity.data?.user) {
        return { authenticated: false, expectedRole: roleCategory, ran: false };
      }
      // Do not return names, tokens, identities, response records or messages.
      const denied = (error) => {
        if (!error) return false;
        const code = String(error.code || '');
        const message = String(error.message || '');
        return code === '42501' ||
          ((code === 'P0001' || code === 'PGRST301') &&
           /permission|access denied|not authorized|unauthori[sz]ed/i.test(message));
      };
      if (roleCategory === 'no-access') {
        // Read-only RPC; deliberately discard any returned data before crossing
        // the browser/Node boundary. Any successful read is a gate failure.
        const res = await supabase.rpc('proc_pec_pr_headers_paged', {
          p_limit: 1, p_offset: 0,
        });
        return { authenticated: true, expectedRole: roleCategory, ran: true,
          rpc: 'proc_pec_pr_headers_paged',
          denied: (Number(res.status) || 0) >= 400 && denied(res.error), status: Number(res.status) || 0,
          code: String(res.error?.code || '').slice(0, 24) };
      }
      // p_indent_id=0 is an intentionally nonexistent primary key. The writer
      // checks the Edit permission before any indent lookup, and even an
      // incorrectly authorized request cannot modify a legitimate indent.
      // A missing-indent error is *not* an acceptable permission denial.
      const res = await supabase.rpc('proc_indent_add_line', {
        p_indent_id: 0, p_material_class_id: 0, p_stock_item_id: 0,
        p_uom_id: 0, p_requested_qty: 0, p_reason: null,
      });
      return { authenticated: true, expectedRole: roleCategory, ran: true,
        rpc: 'proc_indent_add_line',
        denied: (Number(res.status) || 0) >= 400 && denied(res.error), status: Number(res.status) || 0,
        code: String(res.error?.code || '').slice(0, 24) };
    }, { roleCategory: role });
    if (!negative.authenticated || !negative.ran) {
      result('direct_rpc_auth_session', 'BLOCKED', 'No verified active Supabase user session; no RPC probe executed');
    } else {
      result('direct_rpc_auth_session', 'PASS', 'An active authenticated session was confirmed; no identity data captured');
      result('direct_rpc_permission_' + role, negative.denied ? 'PASS' : 'FAIL',
        negative.rpc + ' denied=' + String(negative.denied) +
        ' HTTP=' + negative.status + ' SQLSTATE=' + (negative.code || 'none'));
    }
  }
  // R10 collision-preview probe (read-only RPC, all three roles). p_indent_id=0 is a nonexistent
  // primary key: a role holding PEC View passes the permission gate and then fails with
  // "Indent not found" (HTTP>=400, P0001) — proof the gate was passed, with no data exposed.
  // A role without PEC View is stopped by the permission gate ("Permission denied ...").
  // Only booleans, HTTP status and SQLSTATE leave the browser; never the message or any row.
  console.log('\nRunning bounded R10 collision-preview probe (nonexistent indent id; no data read).');
  const preview = await page.evaluate(async () => {
    const { supabase } = await import('./js/supabaseClient.js');
    const identity = await supabase.auth.getUser();
    if (identity.error || !identity.data?.user) return { authenticated: false, ran: false };
    const res = await supabase.rpc('proc_indent_resync_collision_preview', { p_indent_id: 0 });
    const message = String(res.error?.message || '');
    const status = Number(res.status) || 0;
    return { authenticated: true, ran: true, status, code: String(res.error?.code || '').slice(0, 24),
      passedGate: !!res.error && /^Indent not found/i.test(message),
      denied: status >= 400 && (String(res.error?.code || '') === '42501' ||
        ((String(res.error?.code || '') === 'P0001' || String(res.error?.code || '') === 'PGRST301') &&
         /permission|access denied|not authorized|unauthori[sz]ed/i.test(message))),
      dataReturned: !res.error && res.data != null };
  });
  if (!preview.authenticated || !preview.ran) {
    result('r10_preview_probe', 'BLOCKED', 'No verified active Supabase user session; preview probe not executed');
  } else {
    const expectDenied = role === 'no-access';
    const ok = expectDenied ? (preview.denied && !preview.passedGate && !preview.dataReturned)
                            : (preview.passedGate && !preview.denied && !preview.dataReturned);
    result('r10_preview_' + role, ok ? 'PASS' : 'FAIL',
      'proc_indent_resync_collision_preview expected=' + (expectDenied ? 'denied' : 'permitted(passed gate)') +
      ' denied=' + String(preview.denied) + ' passedGate=' + String(preview.passedGate) +
      ' HTTP=' + preview.status + ' SQLSTATE=' + (preview.code || 'none'));
  }
  // Never store JWTs, emails, page text, network request bodies or rendered data.
  console.log('\nRPC response status counts (names/status only):');
  console.log(JSON.stringify(Object.fromEntries([...rpcSummary].sort()),null,2));
  console.log('\nSafe summary (no identities or credentials):');
  console.log(JSON.stringify({ roleCategory:role, host:origin.hostname, checks:results,
    status:'PARTIAL_OPERATOR_EVIDENCE_ONLY', productionDataMutations:0 }, null, 2));
  if (results.some(x=>x.status==='FAIL')) process.exitCode=1;
  else if (results.some(x=>x.status==='BLOCKED')) process.exitCode=2;
} finally {
  rl.close();
  await context.close();
  await browser.close();
}
