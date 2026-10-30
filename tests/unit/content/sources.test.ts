/**
 * T-32 N6: `loadContentSources` reports what it skipped instead of dropping
 * it silently, and an empty bank is an explicit warning.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  BANK_LEVEL,
  FILE_LEVEL,
  loadContentSources,
  validateContent,
} from "../../../scripts/content/validate.ts";
import { fixtureText, locations, validateFiles } from "./helpers.ts";

const tmp = mkdtempSync(path.join(tmpdir(), "apiquiz-sources-"));
afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function contentDir(name: string, questionFiles: Record<string, string>) {
  const root = path.join(tmp, name);
  mkdirSync(path.join(root, "questions"), { recursive: true });
  writeFileSync(path.join(root, "topics.json"), fixtureText("topics.json"));
  writeFileSync(
    path.join(root, "retired-ids.json"),
    fixtureText("retired-ids.json"),
  );
  for (const [file, text] of Object.entries(questionFiles)) {
    writeFileSync(path.join(root, "questions", file), text);
  }
  return root;
}

describe("non-.json files in content/questions", () => {
  it("are listed as ignored and each one is a file-level warning", async () => {
    const root = contentDir("ignored", {
      "http-fundamentals.json": fixtureText("vfx/valid-minimal.json"),
      "status-codes.JSON": "{}",
      "notes.txt": "draft ideas",
    });
    const sources = await loadContentSources(root, tmp);
    expect(sources.questionFiles.map((f) => f.path)).toEqual([
      "ignored/questions/http-fundamentals.json",
    ]);
    expect(sources.ignoredFiles).toEqual([
      "ignored/questions/notes.txt",
      "ignored/questions/status-codes.JSON",
    ]);
    const result = validateContent(sources, { release: false });
    expect(result.errors).toEqual([]);
    const ignored = result.warnings.filter((w) => w.questionId === FILE_LEVEL);
    expect(locations(ignored)).toEqual([
      "ignored/questions/notes.txt (file) (file name)",
      "ignored/questions/status-codes.JSON (file) (file name)",
    ]);
    expect(ignored[0]?.message).toBe(
      "ignored: question files must end in .json",
    );
  });
});

describe("empty bank", () => {
  it("a questions directory with no .json files warns that the bank is empty", async () => {
    const sources = await loadContentSources(contentDir("empty", {}), tmp);
    const result = validateContent(sources, { release: false });
    expect(result.errors).toEqual([]);
    const empty = result.warnings.find((w) => w.field === "(empty)");
    expect(empty).toEqual({
      file: "empty/questions",
      questionId: BANK_LEVEL,
      field: "(empty)",
      message: "the question bank is empty: no questions are declared",
    });
  });

  it("question files that declare no questions also warn", () => {
    const result = validateFiles([
      {
        path: "content/questions/http-fundamentals.json",
        text: JSON.stringify({ schemaVersion: 1, questions: [] }),
      },
    ]);
    expect(result.warnings.map((w) => w.field)).toContain("(empty)");
  });

  it("a bank with questions has no empty-bank warning", () => {
    const result = validateFiles([
      {
        path: "content/questions/http-fundamentals.json",
        text: fixtureText("vfx/valid-minimal.json"),
      },
    ]);
    expect(result.warnings.map((w) => w.field)).not.toContain("(empty)");
  });
});
