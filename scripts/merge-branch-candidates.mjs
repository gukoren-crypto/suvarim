// Default is a review report; --apply explicitly applies the reviewed batch.
import { readFile, writeFile, readdir, rename, mkdir } from "node:fs/promises";
import { mergeBranchCandidates } from "./lib/merge-branch-candidates.mjs";
const args = process.argv.slice(2),
  apply = args.includes("--apply");
const files = args.filter((a) => !a.startsWith("--"));
if (!files.length)
  for (const name of await readdir("candidates"))
    if (name.endsWith(".json")) files.push(`candidates/${name}`);
if (!files.length) throw Error("No candidate files. Run a collector first.");
const read = async (p) => JSON.parse(await readFile(p, "utf8"));
const result = mergeBranchCandidates(
  await read("src/data/branches.json"),
  await read("src/data/branch-sources.json"),
  await Promise.all(files.map(read)),
);
const report = { checkedAt: new Date().toISOString(), files, ...result.report };
await mkdir("reports", { recursive: true });
await writeFile(
  "reports/branch-import-latest.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    mode: apply ? "apply" : "review",
    added: report.added.length,
    updated: report.updated.length,
    duplicates: report.duplicates.length,
    retained: report.retained.length,
    reviewRequired: report.reviewRequired.length,
    chains: report.chains,
  }),
);
if (apply) {
  if (report.reviewRequired.length)
    throw Error(
      "Coordinate changes require review; live catalog left untouched.",
    );
  for (const [path, value] of [
    ["src/data/branches.json", result.branches],
    ["src/data/branch-sources.json", result.registry],
  ]) {
    await writeFile(path + ".tmp", JSON.stringify(value, null, 2) + "\n");
  }
  await rename("src/data/branches.json.tmp", "src/data/branches.json");
  await rename(
    "src/data/branch-sources.json.tmp",
    "src/data/branch-sources.json",
  );
}
