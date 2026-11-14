// Ephemeral, isolated PostgreSQL for the registry-SQL tests. NEVER connects to Supabase or any network database:
// it initialises a throw-away cluster in a temp dir, listens on a unix socket only, and is destroyed afterwards.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const BIN_DIRS = ["/usr/lib/postgresql/16/bin", "/usr/lib/postgresql/15/bin", "/usr/lib/postgresql/14/bin", "/usr/bin"];
const binDir = BIN_DIRS.find((d) => fs.existsSync(path.join(d, "initdb")) && fs.existsSync(path.join(d, "postgres")));

export function pgAvailable() { return Boolean(binDir) && Boolean(spawnSync("psql", ["--version"]).stdout?.length); }

export function startCluster() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "g2-0-pg-"));
  const isRoot = process.getuid?.() === 0;
  const run = (cmd, args, opts = {}) => (isRoot
    ? execFileSync("runuser", ["-u", "postgres", "--", cmd, ...args], { encoding: "utf8", ...opts })
    : execFileSync(cmd, args, { encoding: "utf8", ...opts }));
  if (isRoot) execFileSync("chown", ["-R", "postgres:postgres", root]);
  fs.chmodSync(root, 0o700);
  const data = path.join(root, "data");
  const sock = path.join(root, "sock");
  fs.mkdirSync(sock);
  if (isRoot) execFileSync("chown", ["postgres:postgres", sock]);
  const port = String(20000 + Math.floor(Math.random() * 20000));
  run(path.join(binDir, "initdb"), ["-D", data, "-A", "trust", "-U", "postgres", "--no-sync"], { stdio: "pipe" });
  run(path.join(binDir, "pg_ctl"), ["-D", data, "-w", "-o", `-c listen_addresses='' -c unix_socket_directories='${sock}' -c port=${port} -c fsync=off`, "-l", path.join(root, "log"), "start"], { stdio: "pipe" });
  const psqlArgs = (db) => ["-X", "-q", "-h", sock, "-p", port, "-U", "postgres", "-d", db];
  const psql = (db, args, input) => {
    const r = spawnSync("psql", [...psqlArgs(db), ...args], { input, encoding: "utf8" });
    return { code: r.status, out: (r.stdout || ""), err: (r.stderr || "") };
  };
  let n = 0;
  return {
    /** fresh empty database per scenario */
    newDb() { const name = `t${++n}`; const r = psql("postgres", ["-c", `create database ${name}`]); if (r.code) throw new Error(r.err); return name; },
    sql(db, text) { const r = psql(db, ["-v", "ON_ERROR_STOP=1", "-t", "-A", "-F", "|"], text); if (r.code) throw new Error(r.err); return r.out.trim(); },
    /** run a script like an operator would (psql -f via stdin). */
    script(db, text, { stopOnError = true } = {}) { return psql(db, [...(stopOnError ? ["-v", "ON_ERROR_STOP=1"] : []), "-t", "-A", "-F", "|"], text); },
    stop() {
      try { run(path.join(binDir, "pg_ctl"), ["-D", data, "-m", "immediate", "stop"], { stdio: "pipe" }); } catch { /* ignore */ }
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}
