// scripts/gen-migration-status.js
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const projectRoot = path.resolve(__dirname, '..');

// Helpers
function read(file) {
  return fs.readFileSync(file, 'utf-8');
}

function writeMd(content) {
  fs.writeFileSync(path.join(projectRoot, 'MIGRATION_STATUS.md'), content, 'utf-8');
}

function relative(p) {
  return path.relative(projectRoot, p).replaceAll('\\', '/');
}

// Gather HTML modules (top-level .html files except obvious junk)
const htmlFiles = glob.sync('*.html', { cwd: projectRoot }).filter(f => !f.startsWith('_'));

// Gather JS modules (you can adjust include if some are shared libraries)
const jsFiles = glob.sync('js/**/*.js', { cwd: projectRoot });

// Scan each HTML for its stylesheet reference (to infer if it's pointing to shared)
function classifyHtml(file) {
  const full = path.join(projectRoot, file);
  const content = read(full);
  const usesSharedCss = /\bshared\/css\/style\.css\b/.test(content);
  const usesProxyCss = /href=["']css\/style\.css["']/.test(content);
  return { file, usesSharedCss, usesProxyCss };
}

// Scan JS for import patterns
function classifyJs(file) {
  const full = path.join(projectRoot, file);
  const content = read(full);
  const usesProxySupabase = /from ['"]\.\/supabaseClient\.js['"]/.test(content) || /require\(['"]\.\/supabaseClient\.js['"]\)/.test(content);
  const usesSharedSupabase = /from ['"].*shared\/js\/supabaseClient\.js['"]/.test(content) || /require\(['"].*shared\/js\/supabaseClient\.js['"]\)/.test(content);
  return { file, usesProxySupabase, usesSharedSupabase };
}

// Build status lines
const lines = [];
lines.push('# Shared asset migration status');
lines.push('');
lines.push('> Generated automatically. Proxy = old path; Shared = canonical. Run `node scripts/gen-migration-status.js` to refresh.');
lines.push('');
lines.push('## Legend');
lines.push('- ✅ = fully migrated (uses shared paths directly)');
lines.push('- 👷 = partly (still using proxy for supabaseClient or css)');
lines.push('- ❌ = not migrated (still using only old copies)');
lines.push('');
lines.push('## HTML modules (style.css usage)');
lines.push('');

htmlFiles.forEach(h => {
  const { usesSharedCss, usesProxyCss } = classifyHtml(h);
  let status, note;
  if (usesSharedCss) {
    status = '✅';
    note = 'uses shared/css/style.css';
  } else if (usesProxyCss) {
    status = '👷';
    note = 'uses local css proxy';
  } else {
    status = '❌';
    note = 'no obvious style import or custom';
  }
  lines.push(`- [${status}] ${h} — ${note}`);
});

lines.push('');
lines.push('## JS modules (supabaseClient.js usage)');
lines.push('');

jsFiles.forEach(j => {
  const { usesProxySupabase, usesSharedSupabase } = classifyJs(j);
  let status, note;
  if (usesSharedSupabase && !usesProxySupabase) {
    status = '✅';
    note = 'imports from shared/js/supabaseClient.js directly';
  } else if (usesSharedSupabase && usesProxySupabase) {
    status = '👷';
    note = 'imports both proxy and shared (should clean up proxy import)';
  } else if (usesProxySupabase) {
    status = '👷';
    note = 'still importing via proxy';
  } else {
    status = '❌';
    note = 'no import of supabaseClient detected';
  }
  lines.push(`- [${status}] ${j} — ${note}`);
});

lines.push('');
lines.push('## Notes');
lines.push('- After migrating a module fully, you can remove its dependency on the proxy and the script will show ✅.');
lines.push('- Once everything is ✅ you can delete the old proxy files if you want.');

writeMd(lines.join('\n') + '\n');
console.log('MIGRATION_STATUS.md regenerated.');