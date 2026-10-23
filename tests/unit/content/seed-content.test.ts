/**
 * The committed content (content/**) passes in dev mode and, since US-8
 * batches T-23..T-30 landed, in `--release` mode too: it meets the US-8.1
 * thresholds, so a future change that drops below them fails here. The
 * below-threshold path is covered by thresholds.test.ts and, for the CLI, by
 * a small temporary content dir. Also checks the CLI exit codes and output
 * format under Node's built-in type stripping.
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
  // Counts stay independent of the exact bank size as batches are added.
  it("validates in dev mode with no errors or warnings over the 8 curated topics", async () => {
    const result = validateContent(await loadContentSources(CONTENT, REPO), {
      release: false,
    });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.questions.length).toBeGreaterThanOrEqual(60);
    expect(result.topics).toHaveLength(8);
  });

  it("meets the US-8.1 release thresholds", async () => {
    const result = validateContent(await loadContentSources(CONTENT, REPO), {
      release: true,
    });
    expect(result.errors).toEqual([]);
  });
});

describe("CLI", () => {
  const tmp = mkdtempSync(path.join(tmpdir(), "apiquiz-content-"));
  afterAll(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("exits 0 in dev mode and with --release on the committed content", () => {
    const dev = runCli([]);
    expect(dev.status, dev.stderr).toBe(0);
    expect(dev.stderr).not.toContain("warning:");
    const release = runCli(["--release"]);
    expect(release.status, release.stderr).toBe(0);
  });

  it("warns in dev mode and exits 1 with --release below the thresholds", () => {
    const root = path.join(tmp, "small");
    mkdirSync(path.join(root, "questions"), { recursive: true });
    writeFileSync(path.join(root, "topics.json"), fixtureText("topics.json"));
    writeFileSync(
      path.join(root, "retired-ids.json"),
      fixtureText("retired-ids.json"),
    );
    writeFileSync(
      path.join(root, "questions/http-fundamentals.json"),
      fixtureText("vfx/valid-minimal.json"),
    );
    const rel = path.relative(REPO, root).split(path.sep).join("/");
    const dev = runCli(["--root", root]);
    expect(dev.status, dev.stderr).toBe(0);
    expect(dev.stderr).toContain(
      `warning: ${rel}/questions › (bank) › reviewed.total:`,
    );
    const release = runCli(["--root", root, "--release"]);
    expect(release.status).toBe(1);
    expect(release.stderr).toContain(
      `error: ${rel}/questions › (bank) › reviewed.total:`,
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
