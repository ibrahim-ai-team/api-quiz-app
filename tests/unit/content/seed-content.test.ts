/**
 * The committed seed content (content/**) passes in dev mode and fails
 * `--release` (too few reviewed questions). Also checks the CLI exit codes
 * and output format under Node's built-in type stripping.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  loadContentSources,
  validateContent,
} from "../../../scripts/content/validate.ts";
import { fixtureText } from "./helpers.ts";

const REPO = path.resolve(import.meta.dirname, "../../..");
const CONTENT = path.join(REPO, "content");
const CLI = path.join(REPO, "scripts/validate-content.ts");

function runCli(args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: REPO,
    encoding: "utf8",
  });
}

describe("seed content", () => {
  it("validates in dev mode: about 6 draft questions over 3 topics", async () => {
    const result = validateContent(await loadContentSources(CONTENT, REPO), {
      release: false,
    });
    expect(result.errors).toEqual([]);
    expect(result.questions.length).toBeGreaterThanOrEqual(6);
    expect(new Set(result.questions.map((q) => q.topic)).size).toBe(3);
    expect(result.questions.every((q) => q.reviewStatus === "draft")).toBe(
      true,
    );
    expect(result.topics).toHaveLength(8);
    expect(result.warnings.map((w) => w.field)).toContain("reviewed.total");
  });

  it("fails in release mode with threshold errors", async () => {
    const result = validateContent(await loadContentSources(CONTENT, REPO), {
      release: true,
    });
    expect(result.errors.map((e) => e.field)).toEqual([
      "reviewed.total",
      "reviewed.topics",
      "reviewed.difficulty",
    ]);
  });
});

describe("CLI", () => {
  const tmp = mkdtempSync(path.join(tmpdir(), "apiquiz-content-"));
  afterAll(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("exits 0 in dev mode and 1 with --release on the seed content", () => {
    const dev = runCli([]);
    expect(dev.status).toBe(0);
    expect(dev.stderr).toContain(
      "warning: content/questions › (bank) › reviewed.total:",
    );
    const release = runCli(["--release"]);
    expect(release.status).toBe(1);
    expect(release.stderr).toContain(
      "error: content/questions › (bank) › reviewed.total:",
    );
  });

  it("exits 1 and names file, question ID and field for a bad content dir", () => {
    const root = path.join(tmp, "bad");
    mkdirSync(path.join(root, "questions"), { recursive: true });
    writeFileSync(path.join(root, "topics.json"), fixtureText("topics.json"));
    writeFileSync(
      path.join(root, "retired-ids.json"),
      fixtureText("retired-ids.json"),
    );
    writeFileSync(
      path.join(root, "questions/http-fundamentals.json"),
      fixtureText("vfx/source-url-http.json"),
    );
    writeFileSync(
      path.join(root, "questions/status-codes.json"),
      fixtureText("vfx/malformed-json.txt"),
    );
    const result = runCli(["--root", root]);
    const rel = path.relative(REPO, root).split(path.sep).join("/");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      `error: ${rel}/questions/http-fundamentals.json › valid-question › sourceUrl: must use https`,
    );
    expect(result.stderr).toContain(
      `error: ${rel}/questions/status-codes.json › (file) › (json): malformed JSON`,
    );
  });

  it("exits 1 (not a crash) when the content dir does not exist", () => {
    const result = runCli(["--root", path.join(tmp, "missing")]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("file is missing or unreadable");
    expect(result.stderr).not.toMatch(/at .*\.ts:\d+/);
  });

  it("exits 2 with usage on an unknown argument", () => {
    const result = runCli(["--nope"]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("usage:");
  });
});
