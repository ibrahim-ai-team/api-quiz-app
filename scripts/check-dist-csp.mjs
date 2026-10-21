// Build-output CSP check (ADR-0001 V-4 / amendment A3, security review SEC-R01 L-1).
//
// Fails unless the built index.html:
// - contains the CSP meta, starting
//   http-equiv="Content-Security-Policy" content="default-src 'none'
// - has no inline <script> (every <script> tag must have a src= attribute)
// - has no <style> element
//
// No dependencies: Node only. Usage: node scripts/check-dist-csp.mjs [--file dist/index.html]
import { readFileSync } from "node:fs";

function main() {
  const args = process.argv.slice(2);
  let file = "dist/index.html";
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--file" && args[i + 1] !== undefined) {
      file = args[i + 1];
      i += 1;
    } else {
      console.error(
        `check-dist-csp: unknown or incomplete argument: ${args[i]}`,
      );
      return 1;
    }
  }

  let html;
  try {
    html = readFileSync(file, "utf8");
  } catch {
    console.error(
      `check-dist-csp: FAIL - "${file}" not found (run the build first)`,
    );
    return 1;
  }

  const problems = [];

  const cspMeta =
    /<meta\s+http-equiv="Content-Security-Policy"\s+content="default-src 'none'/i;
  if (!cspMeta.test(html)) {
    problems.push(
      `missing CSP meta starting http-equiv="Content-Security-Policy" content="default-src 'none'`,
    );
  }

  for (const match of html.matchAll(/<script\b[^>]*>/gi)) {
    if (!/\ssrc\s*=/i.test(match[0])) {
      problems.push(`inline <script> without src=: ${match[0]}`);
    }
  }

  for (const match of html.matchAll(/<style\b[^>]*>/gi)) {
    problems.push(`<style> element found: ${match[0]}`);
  }

  if (problems.length > 0) {
    for (const problem of problems) {
      console.error(`check-dist-csp: FAIL - ${problem}`);
    }
    return 1;
  }
  console.log(
    `check-dist-csp: PASS - ${file} has the CSP meta, no inline <script> and no <style>`,
  );
  return 0;
}

process.exitCode = main();
