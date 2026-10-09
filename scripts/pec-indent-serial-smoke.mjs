import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pec = readFileSync(
  join(root, "public/shared/js/procurement-execution-console.js"),
  "utf8",
);
const migration = readFileSync(
  join(root, "supabase/migrations/20261009153000_pec_pwa_indent_serials.sql"),
  "utf8",
);
const sw = readFileSync(join(root, "public/sw.js"), "utf8");

const failures = [];
const assert = (ok, message) => {
  if (!ok) failures.push(message);
};

assert(
  /function\s+getIndentLineSerial\s*\([\s\S]*?indent_line_sort_no/.test(pec),
  "stable indent serial helper must read indent_line_sort_no",
);
assert(
  /const lineNo = getIndentLineSerial\(row, idx \+ 1\)/.test(pec),
  "full/filtered indent render must preserve governed serial",
);
assert(
  /const lineNo = getIndentLineSerial\(row, startAt \+ idx \+ 1\)/.test(pec),
  "infinite-scroll append must preserve governed serial",
);
assert(
  /indent_line_sort_no:\s*[\s\S]*?entry\?\.indent_line_sort_no/.test(pec),
  "vendor breakdown normalizer must retain indent_line_sort_no",
);
assert(
  /function\s+formatVwlIndentReference\s*\([\s\S]*?\$\{indent\} \(\$\{serial\}\)/.test(pec),
  "vendor modal reference must support Indent (Serial)",
);
assert(
  /<td>\$\{esc\(formatVwlIndentReference\(item\)\)\}<\/td>/.test(pec),
  "vendor breakdown modal must render the serial-aware indent reference",
);
assert(
  /'procurement-execution-console',\s*'pwa',\s*'\/shared\/procurement-execution-console\.html'/.test(migration),
  "migration must register PEC for the PWA client",
);
assert(
  /'indent_line_sort_no'/.test(migration) &&
    /v_proc_indent_lines_console_ordered/.test(migration),
  "migration must source vendor breakdown serials from the governed ordered indent view",
);
assert(
  /hub-cache-v344/.test(sw),
  "PWA cache version must be bumped for the PEC client update",
);

if (failures.length) {
  console.error("PEC indent serial smoke failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("PEC indent serial smoke passed.");
