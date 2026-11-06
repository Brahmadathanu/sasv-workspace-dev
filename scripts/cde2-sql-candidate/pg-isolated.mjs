// Ephemeral, isolated PostgreSQL for the CDE-2 candidate tests. Unix socket only (listen_addresses=''), throw-away data dir, never any network or Supabase.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

export function findPgBin() {
  for (const base of ["/usr/lib/postgresql", "/usr/local/pgsql"]) {
    if (!fs.existsSync(base)) continue;
    const vers = fs.readdirSync(base).sort((a, b) => Number(b) - Number(a));
    for (const v of vers) { const bin = base === "/usr/lib/postgresql" ? path.join(base, v, "bin") : path.join(base, "bin"); if (fs.existsSync(path.join(bin, "initdb")) && fs.existsSync(path.join(bin, "postgres"))) return bin; }
  }
  return null;
}
const asPg = (cmd, args, opts = {}) => (process.getuid?.() === 0 ? spawnSync("runuser", ["-u", "postgres", "--", cmd, ...args], opts) : spawnSync(cmd, args, opts));

export function startCluster(bin) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cde2pg-"));
  if (process.getuid?.() === 0) { const uid = Number(spawnSync("id", ["-u", "postgres"]).stdout.toString()), gid = Number(spawnSync("id", ["-g", "postgres"]).stdout.toString()); fs.chownSync(dir, uid, gid); }
  fs.chmodSync(dir, 0o755);
  const port = String(54400 + (process.pid % 500));
  let r = asPg(path.join(bin, "initdb"), ["-D", path.join(dir, "data"), "-A", "trust", "-U", "postgres"], { encoding: "utf8" });
  if (r.status !== 0) throw new Error("initdb failed: " + r.stderr);
  r = asPg(path.join(bin, "pg_ctl"), ["-D", path.join(dir, "data"), "-o", `-p ${port} -c listen_addresses='' -k ${dir}`, "-l", path.join(dir, "log"), "-w", "start"], { encoding: "utf8" });
  if (r.status !== 0) throw new Error("pg_ctl start failed: " + r.stderr + r.stdout);
  const psqlBin = path.join(bin, "psql");
  const run = (db, sql, { allowError = false } = {}) => {
    const p = spawnSync(psqlBin, ["-h", dir, "-p", port, "-U", "postgres", "-d", db, "-X", "-q", "-tA", "-v", "ON_ERROR_STOP=1"], { input: sql, encoding: "utf8" });
    if (p.status !== 0 && !allowError) throw new Error("psql failed: " + p.stderr + "\nSQL: " + sql.slice(0, 400));
    return { status: p.status, out: p.stdout.trim(), err: p.stderr.trim() };
  };
  return {
    dir, run,
    createDb: (name) => run("postgres", `create database ${name}`),
    stop: () => { asPg(path.join(bin, "pg_ctl"), ["-D", path.join(dir, "data"), "-m", "immediate", "stop"], { encoding: "utf8" }); fs.rmSync(dir, { recursive: true, force: true }); },
  };
}
