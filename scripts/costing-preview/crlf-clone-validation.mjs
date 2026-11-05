// Windows-style (CRLF) validation. Clones the committed HEAD with core.autocrlf=true so every text file is
// checked out with CRLF line endings (what the owner's Windows PC does), then runs the exact-SHA verifier and the
// preview test suites there. READ ONLY: local clone in the OS temp dir, no network, no Supabase, no flag writes.
// Usage: node scripts/costing-preview/crlf-clone-validation.mjs [--full]   (--full adds the 29 six-module mock tests)
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, symlinkSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const full = process.argv.includes("--full");
const repo = resolve(".");
const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
const sha = git(repo, "rev-parse", "HEAD");
assert.equal(git(repo, "status", "--porcelain"), "", "Commit all changes first: CRLF validation covers committed content only");
const parent = mkdtempSync(join(tmpdir(), "costing-crlf-"));
const clone = join(parent, "clone");
try {
  git(repo, "clone", "--quiet", "--no-hardlinks", "-c", "core.autocrlf=true", "file://" + repo, clone);
  // A pull_request head SHA may not be reachable from any branch; fetch it explicitly.
  git(clone, "fetch", "--quiet", "file://" + repo, sha);
  git(clone, "-c", "advice.detachedHead=false", "checkout", "--quiet", "--detach", sha);
  assert.equal(git(clone, "rev-parse", "HEAD"), sha);
  // Prove the working tree really is CRLF, otherwise this validation would be meaningless.
  const probe = readFileSync(join(clone, "scripts/costing-preview/synthetic-launcher.html"), "utf8");
  assert.ok(probe.includes("\r\n") && !/[^\r]\n/.test(probe), "clone is not CRLF; autocrlf did not apply");
  assert.equal(git(clone, "status", "--porcelain"), "", "CRLF clone must be clean under autocrlf");
  const run = (label, args) => {
    const r = spawnSync(process.execPath, args, { cwd: clone, encoding: "utf8", env: { ...process.env, CI: "true" } });
    const out = r.stdout + r.stderr;
    const counts = Object.fromEntries(["tests", "pass", "fail", "skipped"].map((k) => [k, Number(out.match(new RegExp("^# " + k + " (\\d+)", "m"))?.[1] ?? NaN)]));
    process.stdout.write(label + ": " + JSON.stringify(counts) + "\n");
    if (r.status !== 0) process.stdout.write(out.slice(-4000) + "\n");
    return { status: r.status, out, counts };
  };
  const verifier = spawnSync(process.execPath, ["scripts/costing-preview/verify-source-and-flags.mjs", sha], { cwd: clone, encoding: "utf8" });
  assert.equal(verifier.status, 0, "verifier failed on CRLF checkout:\n" + verifier.stderr);
  process.stdout.write("CRLF verifier: SOURCE_AND_TEST_CONTRACT_VERIFIED_ONLY at " + sha + "\n");
  // Linked only AFTER the clean-tree verifier, which refuses uncommitted files.
  if (existsSync(join(repo, "node_modules"))) symlinkSync(join(repo, "node_modules"), join(clone, "node_modules"), "dir");
  const suites = [
    ["CRLF transport", ["--test", "scripts/costing-preview/read-only-loopback-server.test.mjs", "scripts/costing-preview/transport-negative.test.mjs"]],
    ["CRLF interactive+hardening", ["--test", "scripts/costing-preview/interactive-synthetic-preview.test.mjs", "scripts/costing-preview/wave-a-synthetic-hardening.test.mjs"]],
  ];
  if (full) suites.push(["CRLF six-module mock", ["--test", "scripts/costing-wp12-flag-sweep/flag-sweep-browser.test.mjs", "scripts/costing-wp12-flag-sweep/console-rpc-allowlist.test.mjs"]]);
  let total = 0;
  for (const [label, args] of suites) {
    const r = run(label, args);
    assert.equal(r.status, 0, label + " failed under CRLF");
    assert.equal(r.counts.fail, 0, label);
    assert.equal(r.counts.skipped, 0, label + " must have zero skips");
    assert.ok(r.counts.pass > 0 && r.counts.pass === r.counts.tests, label + " must run and pass every test");
    total += r.counts.pass;
  }
  process.stdout.write("CRLF TOTAL PASS: " + total + " (0 fail, 0 skipped)\n");
} finally {
  rmSync(parent, { recursive: true, force: true });
}
