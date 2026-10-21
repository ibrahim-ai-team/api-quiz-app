/**
 * Content build CLI (T-06, US-7.4) under Node's built-in type stripping:
 * production excludes the seed drafts, dev includes them, output is
 * byte-identical across runs, and validation errors block emission.
 */
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { isBank, type Bank } from "../../../src/content/types.ts";

const REPO = path.resolve(import.meta.dirname, "../../..");
const CLI = path.join(REPO, "scripts/build-content.ts");
const CONTENT = path.join(REPO, "content");

const temp = mkdtempSync(path.join(tmpdir(), "apiquiz-build-content-"));
afterAll(() => {
  rmSync(temp, { recursive: true, force: true });
});

let counter = 0;
function outFile(): string {
  counter += 1;
  return path.join(temp, `out-${String(counter)}`, "bank.json");
}

function run(args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: REPO,
    encoding: "utf8",
  });
}

function build(root: string, mode?: string) {
  const out = outFile();
  const result = run([
    ...(mode === undefined ? [] : ["--mode", mode]),
    "--root",
    root,
    "--out",
    out,
  ]);
  return { result, out };
}

function readBank(file: string): Bank {
  const data = JSON.parse(readFileSync(file, "utf8")) as unknown;
  if (!isBank(data)) throw new Error(`${file} fails isBank`);
  return data;
}

function seedQuestionIds(): string[] {
  return (
    JSON.parse(
      readFileSync(path.join(CONTENT, "questions/status-codes.json"), "utf8"),
    ) as { questions: { id: string }[] }
  ).questions.map((q) => q.id);
}

describe("scripts/build-content.ts", () => {
  it("production: emits no draft question (all seeds are drafts -> 0 questions)", () => {
    const { result, out } = build(CONTENT, "production");
    expect(result.status, result.stderr).toBe(0);
    const bank = readBank(out);
    expect(bank.questions).toEqual([]);
    expect(bank.topics.length).toBeGreaterThan(0);
    const raw = readFileSync(out, "utf8");
    for (const id of seedQuestionIds()) expect(raw).not.toContain(id);
    expect(result.stdout).toMatch(
      /content:build \(production\).*6 drafts excluded/,
    );
  });

  it("defaults to production mode when --mode is omitted", () => {
    const { result, out } = build(CONTENT);
    expect(result.status, result.stderr).toBe(0);
    expect(readBank(out).questions).toEqual([]);
  });

  it("development: includes drafts", () => {
    const { result, out } = build(CONTENT, "development");
    expect(result.status, result.stderr).toBe(0);
    const bank = readBank(out);
    expect(bank.questions).toHaveLength(6);
    expect(bank.questions.every((q) => q.reviewStatus === "draft")).toBe(true);
  });

  it("is byte-identical across runs for unchanged content", () => {
    const a = build(CONTENT, "development");
    const b = build(CONTENT, "development");
    expect(a.result.status).toBe(0);
    expect(b.result.status).toBe(0);
    expect(readFileSync(a.out, "utf8")).toBe(readFileSync(b.out, "utf8"));
  });

  it("changes contentVersion when a question changes", () => {
    const root = path.join(temp, "edited");
    cpSync(CONTENT, root, { recursive: true });
    const file = path.join(root, "questions/status-codes.json");
    writeFileSync(
      file,
      readFileSync(file, "utf8").replace("Which status code", "Which code"),
    );
    const original = readBank(build(CONTENT, "development").out);
    const edited = build(root, "development");
    expect(edited.result.status, edited.result.stderr).toBe(0);
    expect(readBank(edited.out).contentVersion).not.toBe(
      original.contentVersion,
    );
  });

  it("refuses to emit when validation has errors", () => {
    const root = path.join(temp, "broken");
    cpSync(CONTENT, root, { recursive: true });
    const file = path.join(root, "questions/status-codes.json");
    writeFileSync(
      file,
      readFileSync(file, "utf8").replace('"correct": "b"', '"correct": "z"'),
    );
    const { result, out } = build(root, "production");
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/status-201-created › correct/);
    expect(result.stderr).toMatch(/refusing to emit: 1 validation error/);
    expect(existsSync(out)).toBe(false);
  });

  it("rejects unknown arguments and modes with exit 2", () => {
    expect(run(["--mode", "staging"]).status).toBe(2);
    expect(run(["--release"]).status).toBe(2);
  });
});
