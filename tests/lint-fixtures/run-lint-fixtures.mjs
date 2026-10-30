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

/**
 * fixture path (relative to repo root) -> { ruleId: exact number of errors }.
 * Exact counts prove that every violation in a fixture is caught, not just one.
 */
const expectations = {
  "tests/lint-fixtures/src/ui/Danger.tsx": {
    "react/no-danger": 1,
    "no-restricted-syntax": 1, // srcDoc
  },
  "tests/lint-fixtures/src/ui/innerHtml.ts": {
    // innerHTML, outerHTML, insertAdjacentHTML, createContextualFragment,
    // document.write, document.writeln
    "no-restricted-syntax": 6,
  },
  // T-31 (SEC-R01 L-2): computed innerHTML/outerHTML/srcdoc, dotted .srcdoc,
  // setAttribute("srcdoc") and setAttribute("SrcDoc"), setHTMLUnsafe,
  // Document.parseHTMLUnsafe, parseFromString
  "tests/lint-fixtures/src/ui/rawHtmlSinksExtra.ts": {
    "no-restricted-syntax": 9,
  },
  // T-31 (SEC-R01 L-3): eval(s), new Function(s), setTimeout("x()").
  "tests/lint-fixtures/src/ui/evalSinks.ts": {
    "no-eval": 1,
    "no-new-func": 1,
    "@typescript-eslint/no-implied-eval": 2, // new Function(s), setTimeout("x()")
  },
  "tests/lint-fixtures/src/ui/DangerWithChildren.tsx": {
    "react/no-danger-with-children": 1,
    "react/no-danger": 1,
    "react/jsx-no-script-url": 1,
  },
  "tests/lint-fixtures/src/domain/importsReact.ts": {
    "no-restricted-imports": 1,
  },
  "tests/lint-fixtures/src/domain/importsUi.ts": { "no-restricted-imports": 1 },
  // zod, zod/v4, scripts/content/schema.ts (T-05-R01 M3)
  "tests/lint-fixtures/src/content/importsBuildTools.ts": {
    "no-restricted-imports": 3,
  },
  // zod, scripts/ path: the domain block must keep the src-wide bans
  "tests/lint-fixtures/src/domain/importsBuildTools.ts": {
    "no-restricted-imports": 2,
  },
  "tests/lint-fixtures/src/domain/usesDom.ts": {
    // window, document, localStorage, sessionStorage, navigator, fetch
    "no-restricted-globals": 6,
  },
  "tests/lint-fixtures/src/ui/mathRandom.ts": { "no-restricted-properties": 1 },
  // T-40: Web Storage is reserved for src/storage (ADR-0001).
  "tests/lint-fixtures/src/ui/usesStorage.ts": {
    "no-restricted-globals": 2, // localStorage, sessionStorage
    "no-restricted-properties": 2, // window.localStorage, globalThis.sessionStorage
  },
  "tests/lint-fixtures/src/ui/consoleLog.ts": { "no-console": 1 },
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
  const counts = new Map();
  for (const m of result.messages) {
    if (m.severity === 2) counts.set(m.ruleId, (counts.get(m.ruleId) ?? 0) + 1);
  }
  const mismatches = Object.entries(expectedRules)
    .filter(([rule, n]) => counts.get(rule) !== n)
    .map(([rule, n]) => `${rule} expected ${n}, got ${counts.get(rule) ?? 0}`);
  const summary = Object.entries(expectedRules)
    .map(([rule, n]) => `${rule} x${n}`)
    .join(", ");
  if (mismatches.length > 0) {
    console.error(`FAIL ${file}: ${mismatches.join("; ")}`);
    failures++;
  } else {
    console.log(`ok   ${file}: fails lint as expected (${summary})`);
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
