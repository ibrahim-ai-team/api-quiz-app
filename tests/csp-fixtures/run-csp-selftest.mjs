// Self-test for scripts/check-dist-csp.mjs (SEC-R01 L-1). Fixtures are written
// to a temp directory at test time; nothing is committed. Exits 0 only when
// every case behaves as expected.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const script = path.join(root, "scripts", "check-dist-csp.mjs");
const work = mkdtempSync(path.join(tmpdir(), "apiquiz-csp-"));

const META = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'" />`;
const EXTERNAL = `<script type="module" crossorigin src="/api-quiz-app/assets/index.js"></script>`;

function page(head) {
  return `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    ${head}\n  </head>\n  <body><div id="root"></div></body>\n</html>\n`;
}

const cases = [];
function check(label, html, expectedStatus, expectedText) {
  const file = path.join(work, `${String(cases.length)}.html`);
  if (html !== null) writeFileSync(file, html);
  const result = spawnSync(process.execPath, [script, "--file", file], {
    encoding: "utf8",
  });
  const output = `${result.stdout}${result.stderr}`;
  const ok = result.status === expectedStatus && output.includes(expectedText);
  cases.push({ label, ok, status: result.status, output });
}

try {
  check("valid page passes", page(`${META}\n    ${EXTERNAL}`), 0, "PASS");
  check("missing CSP meta fails", page(EXTERNAL), 1, "missing CSP meta");
  check(
    "weaker CSP (not default-src 'none') fails",
    page(
      `<meta http-equiv="Content-Security-Policy" content="default-src 'self'" />\n    ${EXTERNAL}`,
    ),
    1,
    "missing CSP meta",
  );
  check(
    "inline script fails",
    page(`${META}\n    <script>alert(1)</script>`),
    1,
    "inline <script>",
  );
  check(
    "inline module script fails",
    page(`${META}\n    <script type="module">import("x")</script>`),
    1,
    "inline <script>",
  );
  check(
    "style element fails",
    page(`${META}\n    ${EXTERNAL}\n    <style>body{}</style>`),
    1,
    "<style> element",
  );
  check("missing file fails", null, 1, "not found");
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
  `${String(cases.length - failures)}/${String(cases.length)} CSP self-test cases passed`,
);
process.exitCode = failures === 0 ? 0 : 1;
