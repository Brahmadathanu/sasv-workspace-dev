// scripts/gen-shared-status.js
const fs   = require('fs');
const path = require('path');
const glob = require('glob');

const root = path.resolve(__dirname, '..');

// ---------- helper ------------
const list = pattern => glob.sync(pattern, { cwd: root, nodir: true });

function scanFile(file, isHtml) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');

// OLD reference  = any "/shared/" NOT preceded by "public/"
const usesOld  = /["'`](?:\.{0,2}\/)*shared\//.test(text)    // has /shared/
                 && !/["'`](?:\.{0,2}\/)*public\/shared\//.test(text); // but not via public/

// NEW reference  = path that *does* include public/shared
const usesNew  = /["'`](?:\.{0,2}\/)*public\/shared\//.test(text);

  return { file, usesOld, usesNew };
}

function status(usesOld, usesNew) {
  if (usesOld) return '❌';
  if (usesNew) return '✅';
  return '✅'; // file doesn't reference shared at all
}

// ---------- scan only desired files ----------
const htmlFiles = list('*.html');     // root-level HTML only
const jsFiles   = list('js/**/*.js'); // anything under js/ folder

// ---------- build markdown ----------
let lines = [];
lines.push('# Shared folder consolidation\n');
lines.push('Scans root HTML files and js/ folder only.\n');
lines.push('## Legend\n- ✅ = already uses public/shared\n- ❌ = still uses root/shared\n');

lines.push('\n### HTML files\n');
htmlFiles.forEach(f => {
  const { usesOld, usesNew } = scanFile(f, true);
  lines.push(`- [${status(usesOld, usesNew)}] ${f}`);
});

lines.push('\n### JS files (js/ folder)\n');
jsFiles.forEach(f => {
  const { usesOld, usesNew } = scanFile(f, false);
  lines.push(`- [${status(usesOld, usesNew)}] ${f}`);
});

fs.writeFileSync(path.join(root, 'SHARED_MIGRATION.md'), lines.join('\n'));
console.log('SHARED_MIGRATION.md regenerated (root HTML + js folder only).');