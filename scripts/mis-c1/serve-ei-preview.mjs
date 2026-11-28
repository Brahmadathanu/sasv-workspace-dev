import { PAGE_PATH, startServer } from "./mis-harness.mjs";
import { debtorFixture } from "./ei-debtor-fixture.mjs";

const mode = process.argv[2];
if (!["fixture", "live"].includes(mode)) {
  console.error("Usage: node scripts/mis-c1/serve-ei-preview.mjs fixture|live [port]");
  process.exitCode = 1;
} else {
  const port = Number(process.argv[3] || (mode === "fixture" ? 5181 : 5180));
  const { base } = await startServer({ port, fixture: mode === "fixture" ? debtorFixture : undefined });
  console.log(base + PAGE_PATH + "#finance/debtor-kyc");
}
