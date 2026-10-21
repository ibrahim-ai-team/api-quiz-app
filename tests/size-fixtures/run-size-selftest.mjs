// Self-test for scripts/check-size.mjs (T-02 acceptance: a 250 kB fixture
// must fail the 200 kB gzip JS budget). Fixtures are generated at test time
// from crypto random bytes, so nothing large is committed and the content is
// effectively incompressible. Exits 0 only when every case behaves as expected.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const script = path.join(root, "scripts", "check-size.mjs");
const work = mkdtempSync(path.join(tmpdir(), "apiquiz-size-"));

/** Writes a JS module whose gzip size is at least `minGzip` bytes. */
function writeJs(dir, name, minGzip) {
  // Base64 of N random bytes gzips to about N bytes; grow until the target is met.
  let bytes = minGzip;
  for (;;) {
    const source = `export const blob = "${randomBytes(bytes).toString("base64")}";\n`;
    const gzip = gzipSync(source).length;
    if (gzip >= minGzip) {
      writeFileSync(path.join(dir, name), source);
      return gzip;
    }
    bytes = Math.ceil(bytes * 1.05);
  }
}

function writeJson(dir, name, minGzip) {
  let bytes = minGzip;
  for (;;) {
    const source = JSON.stringify({
      blob: randomBytes(bytes).toString("base64"),
    });
    const gzip = gzipSync(source).length;
    if (gzip >= minGzip) {
      writeFileSync(path.join(dir, name), source);
      return gzip;
    }
    bytes = Math.ceil(bytes * 1.05);
  }
}

function makeDir(name) {
  const dir = path.join(work, name);
  mkdirSync(dir);
  return dir;
}

function run(args) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    env: { ...process.env, GITHUB_STEP_SUMMARY: "" },
  });
}

const cases = [];
function check(label, args, expectedStatus, expectedText) {
  const result = run(args);
  const output = `${result.stdout}${result.stderr}`;
  const ok = result.status === expectedStatus && output.includes(expectedText);
  cases.push({ label, ok, status: result.status, output });
}

try {
  // 1. ~250 kB incompressible JS must FAIL the 200 kB budget.
  const big = makeDir("big");
  const bigGzip = writeJs(big, "index-fixture.js", 250_000);
  console.log(`fixture: index-fixture.js ${bigGzip} B gzip`);
  check("250 kB JS fixture fails", ["--dir", big], 1, "JS: FAIL");

  // 2. The budget is a total over all JS files: 2 x 110 kB must FAIL.
  const split = makeDir("split");
  writeJs(split, "a.js", 110_000);
  writeJs(split, "b.js", 110_000);
  check("JS total over files fails", ["--dir", split], 1, "JS: FAIL");

  // 3. A small JS file with no data asset PASSES, data reported as skipped.
  const small = makeDir("small");
  writeJs(small, "index-small.js", 10_000);
  check("small JS passes", ["--dir", small], 0, "Data: SKIPPED");

  // 4. --require-data without a data asset FAILS.
  check(
    "missing required data fails",
    ["--dir", small, "--require-data"],
    1,
    "Data: FAIL",
  );

  // 5. ~70 kB data asset FAILS the 60 kB data budget.
  const data = makeDir("data");
  writeJs(data, "index-small.js", 10_000);
  writeJson(data, "bank-fixture.json", 70_000);
  check("70 kB data fixture fails", ["--dir", data], 1, "Data: FAIL");

  // 6. No JS files at all FAILS (a missing build must not look green).
  const empty = makeDir("empty");
  check("no JS files fails", ["--dir", empty], 1, "no .js files");

  // 7. Missing directory FAILS.
  check(
    "missing dir fails",
    ["--dir", path.join(work, "nope")],
    1,
    "not found",
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}

let failures = 0;
for (const c of cases) {
  console.log(
    `${c.ok ? "ok  " : "FAIL"} ${c.label} (exit ${String(c.status)})`,
  );
  if (!c.ok) {
    failures += 1;
    console.log(c.output);
  }
}
console.log(
  `${cases.length - failures}/${cases.length} size self-test cases passed`,
);
process.exitCode = failures === 0 ? 0 : 1;
