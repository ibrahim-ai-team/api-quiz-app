// Gzip size budget check for the production build (ADR-0001 V-3, T-02).
//
// - JS budget: the gzip total of every `*.js` file in the assets directory
//   must be at most 200 kB (decimal, 200 000 bytes, the unit Vite reports).
// - Data budget: the gzip total of every `*.json` file in the assets directory
//   (the content-hashed question bank emitted by T-06) must be at most 60 kB.
//   Until the data asset exists the data check is reported as skipped, unless
//   `--require-data` is passed.
//
// Exits 0 when all budgets pass, 1 when a budget is exceeded or no JS file is
// found (a missing build must never look green). No dependencies: Node only.
//
// Usage: node scripts/check-size.mjs [--dir dist/assets] [--js-budget 200000]
//        [--data-budget 60000] [--require-data]
import { appendFileSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const DEFAULTS = { dir: "dist/assets", jsBudget: 200_000, dataBudget: 60_000 };

function parseArgs(argv) {
  const opts = { ...DEFAULTS, requireData: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined) throw new Error(`Missing value for ${arg}`);
      i += 1;
      return value;
    };
    const positiveInt = (value) => {
      const n = Number(value);
      if (!Number.isInteger(n) || n <= 0) {
        throw new Error(`${arg} must be a positive integer, got "${value}"`);
      }
      return n;
    };
    if (arg === "--dir") opts.dir = next();
    else if (arg === "--js-budget") opts.jsBudget = positiveInt(next());
    else if (arg === "--data-budget") opts.dataBudget = positiveInt(next());
    else if (arg === "--require-data") opts.requireData = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return opts;
}

function gzipSizes(dir, extension) {
  return readdirSync(dir)
    .filter((name) => name.endsWith(extension))
    .filter((name) => statSync(path.join(dir, name)).isFile())
    .sort()
    .map((name) => {
      const raw = readFileSync(path.join(dir, name));
      return { name, raw: raw.length, gzip: gzipSync(raw).length };
    });
}

function kb(bytes) {
  return `${(bytes / 1000).toFixed(2)} kB`;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`check-size: ${error.message}`);
    return 1;
  }

  let isDir = false;
  try {
    isDir = statSync(opts.dir).isDirectory();
  } catch {
    isDir = false;
  }
  if (!isDir) {
    console.error(
      `check-size: FAIL - directory "${opts.dir}" not found (run the build first)`,
    );
    return 1;
  }

  const lines = [];
  let failed = false;

  const js = gzipSizes(opts.dir, ".js");
  const jsTotal = js.reduce((sum, file) => sum + file.gzip, 0);
  for (const file of js) {
    lines.push(`  ${file.name}: ${file.raw} B raw, ${file.gzip} B gzip`);
  }
  if (js.length === 0) {
    failed = true;
    lines.push(`JS: FAIL - no .js files found in "${opts.dir}"`);
  } else if (jsTotal > opts.jsBudget) {
    failed = true;
    lines.push(
      `JS: FAIL - ${jsTotal} B gzip (${kb(jsTotal)}) exceeds budget ${opts.jsBudget} B (${kb(opts.jsBudget)})`,
    );
  } else {
    lines.push(
      `JS: PASS - ${jsTotal} B gzip (${kb(jsTotal)}) within budget ${opts.jsBudget} B (${kb(opts.jsBudget)})`,
    );
  }

  const data = gzipSizes(opts.dir, ".json");
  const dataTotal = data.reduce((sum, file) => sum + file.gzip, 0);
  for (const file of data) {
    lines.push(`  ${file.name}: ${file.raw} B raw, ${file.gzip} B gzip`);
  }
  if (data.length === 0) {
    if (opts.requireData) {
      failed = true;
      lines.push(`Data: FAIL - no .json data asset found in "${opts.dir}"`);
    } else {
      lines.push(
        "Data: SKIPPED - no .json data asset yet (expected until T-06)",
      );
    }
  } else if (dataTotal > opts.dataBudget) {
    failed = true;
    lines.push(
      `Data: FAIL - ${dataTotal} B gzip (${kb(dataTotal)}) exceeds budget ${opts.dataBudget} B (${kb(opts.dataBudget)})`,
    );
  } else {
    lines.push(
      `Data: PASS - ${dataTotal} B gzip (${kb(dataTotal)}) within budget ${opts.dataBudget} B (${kb(opts.dataBudget)})`,
    );
  }

  const report = lines.join("\n");
  console.log(report);

  // Bundle size in the job summary (tech-lead standard 14), when run in CI.
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    appendFileSync(summary, `### Size budget\n\n\`\`\`\n${report}\n\`\`\`\n`);
  }

  return failed ? 1 : 0;
}

process.exitCode = main();
