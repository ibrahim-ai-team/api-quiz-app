// Asserts that every negative lint fixture FAILS lint with the expected rule.
// Exits 0 only when each fixture reports its expected error(s).
import { ESLint } from "eslint";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

/** fixture path (relative to repo root) -> rule IDs that must report an error */
const expectations = {
  "tests/lint-fixtures/src/ui/Danger.tsx": ["react/no-danger"],
  "tests/lint-fixtures/src/domain/importsReact.ts": ["no-restricted-imports"],
  "tests/lint-fixtures/src/domain/importsUi.ts": ["no-restricted-imports"],
  "tests/lint-fixtures/src/ui/mathRandom.ts": ["no-restricted-properties"],
  "tests/lint-fixtures/src/ui/consoleLog.ts": ["no-console"],
};

// ignore: false lints the fixtures despite the global ignore in eslint.config.js.
const eslint = new ESLint({ cwd: root, ignore: false });
const results = await eslint.lintFiles(Object.keys(expectations));

let failures = 0;
for (const [file, expectedRules] of Object.entries(expectations)) {
  const result = results.find((r) => r.filePath === path.join(root, file));
  if (!result) {
    console.error(`FAIL ${file}: not linted`);
    failures++;
    continue;
  }
  const fatal = result.messages.filter((m) => m.fatal);
  if (fatal.length > 0) {
    console.error(`FAIL ${file}: parse error: ${fatal[0].message}`);
    failures++;
    continue;
  }
  const errorRules = new Set(
    result.messages.filter((m) => m.severity === 2).map((m) => m.ruleId),
  );
  const missing = expectedRules.filter((rule) => !errorRules.has(rule));
  if (missing.length > 0) {
    console.error(
      `FAIL ${file}: expected error(s) not reported: ${missing.join(", ")}`,
    );
    failures++;
  } else {
    console.log(
      `ok   ${file}: fails lint as expected (${expectedRules.join(", ")})`,
    );
  }
}

if (failures > 0) {
  console.error(
    `lint:fixtures: ${failures} fixture(s) did not fail as expected`,
  );
  process.exit(1);
}
console.log(
  `lint:fixtures: all ${Object.keys(expectations).length} negative fixtures fail as expected`,
);
