import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { draftGuardPlugin } from "../../../vite.config";

// Issue #63 M1(b), T-33a: a production `vite build` refuses a bank with drafts.

function question(id: string, reviewStatus: string) {
  return {
    id,
    topic: "http",
    difficulty: "easy",
    type: "true-false",
    prompt: "Prompt",
    options: [
      { id: "true", text: "True" },
      { id: "false", text: "False" },
    ],
    correct: "true",
    explanation: "Explanation",
    sourceUrl: "https://example.com/",
    reviewStatus,
  };
}

async function runBuildStart(bankPath: string): Promise<void> {
  const plugin = draftGuardPlugin(bankPath);
  const hook = plugin.buildStart;
  if (typeof hook !== "function") {
    throw new Error("draftGuardPlugin must define buildStart as a function");
  }
  await hook.call({} as never, {} as never);
}

describe("draftGuardPlugin", () => {
  let dir: string;
  let bankPath: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "draft-guard-"));
    bankPath = path.join(dir, "bank.json");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function writeBank(questions: unknown[]): Promise<void> {
    const bank = {
      schemaVersion: 1,
      contentVersion: "abc",
      topics: [],
      questions,
    };
    await writeFile(bankPath, JSON.stringify(bank), "utf8");
  }

  it("applies to builds only, so the dev server is unaffected", () => {
    expect(draftGuardPlugin(bankPath).apply).toBe("build");
  });

  it("throws and names the draft question when the bank contains a draft", async () => {
    await writeBank([
      question("http-001", "reviewed"),
      question("http-002", "draft"),
    ]);
    await expect(runBuildStart(bankPath)).rejects.toThrow(/http-002/);
    await expect(runBuildStart(bankPath)).rejects.not.toThrow(/http-001/);
  });

  it("does not throw when every question is reviewed", async () => {
    await writeBank([
      question("http-001", "reviewed"),
      question("http-003", "reviewed"),
    ]);
    await expect(runBuildStart(bankPath)).resolves.toBeUndefined();
  });

  it("throws when the bank file is missing", async () => {
    await expect(runBuildStart(bankPath)).rejects.toThrow(
      /cannot read the generated bank/,
    );
  });

  it("throws when the bank file is not valid JSON", async () => {
    await writeFile(bankPath, "{ not json", "utf8");
    await expect(runBuildStart(bankPath)).rejects.toThrow(/not valid JSON/);
  });
});
