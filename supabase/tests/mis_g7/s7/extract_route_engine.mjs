// Extracts the REAL Costing route-engine function bodies, verbatim, from the repository migrations (latest definition wins),
// so the isolated S7 acceptance runs the production route algorithm rather than a re-implementation.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const migDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../migrations');
export const ENGINE_FUNCTIONS = ['fn_resolve_route_family_for_product', 'fn_resolve_effective_route_family_route', 'fn_resolve_effective_product_process_route',
  'fn_effective_product_process_route_steps', 'fn_effective_product_process_steps', 'fn_validate_product_process_route', 'fn_validate_route_family_route', 'fn_validate_effective_product_process_route'];
export function extractRouteEngine() {
  const files = fs.readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
  const out = []; const prov = [];
  for (const fn of ENGINE_FUNCTIONS) {
    let best = null;
    for (const f of files) {
      const s = fs.readFileSync(path.join(migDir, f), 'utf8');
      const re = new RegExp(`create or replace function costing\\.${fn}\\(`, 'ig'); let m;
      while ((m = re.exec(s))) { const tail = s.slice(m.index); const e = /\n\$function\$;|\n\$\$;/.exec(tail); if (e) best = { f, body: tail.slice(0, e.index + e[0].length) }; }
    }
    if (!best) throw new Error(`route engine function not found: ${fn}`);
    out.push(best.body); prov.push({ fn, file: best.f, sha256: crypto.createHash('sha256').update(best.body).digest('hex') });
  }
  return { sql: out.join('\n\n'), provenance: prov };
}
