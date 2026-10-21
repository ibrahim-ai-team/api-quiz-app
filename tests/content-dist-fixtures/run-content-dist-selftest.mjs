// Self-test for scripts/check-dist-content.mjs (T-06-R01 M1). Asset
// directories are written to a temp directory at test time; nothing is
// committed. Exits 0 only when every case behaves as expected.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const script = path.join(root, "scripts", "check-dist-content.mjs");
const work = mkdtempSync(path.join(tmpdir(), "apiquiz-content-dist-"));

function bank(questions) {
  return JSON.stringify({
    schemaVersion: 1,
    contentVersion: "selftest",
    topics: [{ id: "topic-a", name: "Topic A" }],
    questions,
  });
}

function question(id, reviewStatus) {
  return { id, topic: "topic-a", reviewStatus };
}

const cases = [];
/** files: name -> contents; null = the directory is not created. */
function check(label, files, expectedStatus, expectedText) {
  const dir = path.join(work, String(cases.length), "assets");
  if (files !== null) {
    mkdirSync(dir, { recursive: true });
    for (const [name, text] of Object.entries(files)) {
      writeFileSync(path.join(dir, name), text);
    }
  }
  const result = spawnSync(process.execPath, [script, "--dir", dir], {
    encoding: "utf8",
  });
  const output = `${result.stdout}${result.stderr}`;
  const ok = result.status === expectedStatus && output.includes(expectedText);
  cases.push({ label, ok, status: result.status, output });
}

try {
  check(
    "valid bank with 0 questions passes",
    { "bank-a1.json": bank([]), "index-x.js": "" },
    0,
    "PASS",
  );
  check(
    "valid bank with reviewed questions passes",
    {
      "bank-a1.json": bank([
        question("q-one", "reviewed"),
        question("q-two", "reviewed"),
      ]),
    },
    0,
    "2 question(s), all reviewed",
  );
  check(
    "draft questions fail and are named",
    {
      "bank-a1.json": bank([
        question("q-one", "reviewed"),
        question("q-draft", "draft"),
        { topic: "topic-a" },
      ]),
    },
    1,
    "q-draft, questions[2]",
  );
  check(
    "two bank files fail",
    { "bank-a1.json": bank([]), "bank-b2.json": bank([]) },
    1,
    "found 2",
  );
  check("no bank file fails", { "index-x.js": "" }, 1, "found 0");
  check("missing assets directory fails", null, 1, "not found");
  check("malformed JSON fails", { "bank-a1.json": "{" }, 1, "malformed JSON");
  check(
    "bank without a questions array fails",
    { "bank-a1.json": JSON.stringify({ schemaVersion: 1 }) },
    1,
    'no "questions" array',
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
  `${String(cases.length - failures)}/${String(cases.length)} content dist self-test cases passed`,
);
process.exitCode = failures === 0 ? 0 : 1;
