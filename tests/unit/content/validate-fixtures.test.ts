/**
 * Self-test for the E2E fixture drift guard (T-03-R01/R02):
 * `tests/e2e/fixtures/validate-fixtures.ts` must accept the committed bank
 * and reject invalid banks. Bad banks are generated in a temp directory from
 * the committed fixture, so no invalid fixture is committed.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

type Json = Record<string, unknown>;

const REPO = path.resolve(import.meta.dirname, "../../..");
const CLI = path.join(REPO, "tests/e2e/fixtures/validate-fixtures.ts");
const FIXTURE_TEXT = readFileSync(
  path.join(REPO, "tests/e2e/fixtures/bank.json"),
  "utf8",
);

const temp = mkdtempSync(path.join(tmpdir(), "apiquiz-e2e-fixtures-"));
afterAll(() => {
  rmSync(temp, { recursive: true, force: true });
});

function run(args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: REPO,
    encoding: "utf8",
  });
}

function writeBank(name: string, text: string): string {
  const file = path.join(temp, name);
  writeFileSync(file, text);
  return file;
}

function mutated(name: string, change: (bank: Json) => void): string {
  const bank = JSON.parse(FIXTURE_TEXT) as Json;
  change(bank);
  return writeBank(name, JSON.stringify(bank));
}

function firstQuestion(bank: Json): Json {
  const question = (bank.questions as Json[])[0];
  if (question === undefined) throw new Error("fixture has no questions");
  return question;
}

describe("e2e:fixtures validator", () => {
  it("accepts the committed fixture bank", () => {
    const result = run([]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toMatch(/bank\.json: valid/);
  });

  it.each<[string, () => string, RegExp]>([
    [
      "malformed JSON",
      () => writeBank("bank-malformed.json", "{"),
      /malformed JSON/,
    ],
    [
      "a missing contentVersion key",
      () =>
        mutated("bank-keys.json", (b) => {
          delete b.contentVersion;
        }),
      /top-level keys must be/,
    ],
    [
      "a draft question",
      () =>
        mutated("bank-draft.json", (b) => {
          const q = firstQuestion(b);
          q.reviewStatus = "draft";
          delete q.reviewedBy;
        }),
      /must not contain drafts/,
    ],
    [
      "a correct id that names no option",
      () =>
        mutated("bank-correct.json", (b) => {
          firstQuestion(b).correct = "z";
        }),
      /fixture-a-single-choice › correct/,
    ],
    [
      "a question in an unknown topic",
      () =>
        mutated("bank-topic.json", (b) => {
          firstQuestion(b).topic = "topic-unknown";
        }),
      /topic-unknown/,
    ],
  ])("rejects a bank with %s", (_label, make, message) => {
    const result = run([make()]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(message);
    expect(result.stdout).toMatch(/error\(s\)/);
  });
});
