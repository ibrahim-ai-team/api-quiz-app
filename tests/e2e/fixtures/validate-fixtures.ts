/**
 * Drift guard for E2E fixture banks (T-EC-US7-c, test strategy section 4).
 *
 *   node tests/e2e/fixtures/validate-fixtures.ts [bank.json ...]
 *
 * An E2E fixture is served in place of the emitted data asset, a single file
 * `{ schemaVersion, contentVersion, topics, questions }`, not the `content/`
 * folder layout. Instead of keeping a second copy in folder layout (which
 * could itself drift), this script splits each fixture into the in-memory
 * sources the T-05 validator expects (topics file, empty retired-ID list, one
 * question file per topic) and runs the same `validateContent` rules. Drafts
 * are rejected because a production asset never contains them.
 *
 * If T-06 defines a different emitted shape, update the fixtures and the
 * top-level key check below in the same PR. Deliberately invalid variants
 * (for example `bank-invalid.json`) must not be listed here.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  formatIssue,
  validateContent,
  type SourceFile,
} from "../../../scripts/content/validate.ts";

const FIXTURES = import.meta.dirname;
const DEFAULT_FIXTURES = ["bank.json"];
const TOP_LEVEL_KEYS = [
  "contentVersion",
  "questions",
  "schemaVersion",
  "topics",
];

function fail(file: string, message: string): string[] {
  return [`${file} › (file) › ${message}`];
}

function validateFixture(name: string): string[] {
  // resolve, not join: absolute paths (temp-dir self-test banks) stay absolute.
  const file = path.resolve(FIXTURES, name);
  let bank: unknown;
  try {
    bank = JSON.parse(readFileSync(file, "utf8")) as unknown;
  } catch (error) {
    return fail(name, `unreadable or malformed JSON: ${String(error)}`);
  }
  if (typeof bank !== "object" || bank === null || Array.isArray(bank)) {
    return fail(name, "must be a JSON object");
  }
  const record = bank as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.join(",") !== TOP_LEVEL_KEYS.join(",")) {
    return fail(name, `top-level keys must be ${TOP_LEVEL_KEYS.join(", ")}`);
  }
  if (
    typeof record.contentVersion !== "string" ||
    record.contentVersion === ""
  ) {
    return fail(name, "contentVersion must be a non-empty string");
  }
  if (!Array.isArray(record.topics) || !Array.isArray(record.questions)) {
    return fail(name, "topics and questions must be arrays");
  }

  const questions: unknown[] = record.questions;
  const byTopic = new Map<string, unknown[]>();
  const problems: string[] = [];
  questions.forEach((question, index) => {
    const q = question as Record<string, unknown> | null;
    const topic = typeof q?.topic === "string" ? q.topic : "";
    if (topic === "") {
      problems.push(`${name} › questions[${String(index)}] › topic: missing`);
      return;
    }
    if (q?.reviewStatus !== "reviewed") {
      problems.push(
        `${name} › ${String(q?.id)} › reviewStatus: fixture banks mirror a production asset and must not contain drafts`,
      );
    }
    byTopic.set(topic, [...(byTopic.get(topic) ?? []), question]);
  });

  const json = (value: unknown) => JSON.stringify(value);
  const questionFiles: SourceFile[] = [...byTopic].map(([topic, list]) => ({
    path: `${name}#content/questions/${topic}.json`,
    text: json({ schemaVersion: record.schemaVersion, questions: list }),
  }));
  const result = validateContent(
    {
      topics: {
        path: `${name}#content/topics.json`,
        text: json({
          schemaVersion: record.schemaVersion,
          topics: record.topics,
        }),
      },
      retiredIds: {
        path: `${name}#content/retired-ids.json`,
        text: json({ schemaVersion: record.schemaVersion, retiredIds: [] }),
      },
      questionFiles,
      bankPath: name,
    },
    { release: false },
  );
  problems.push(...result.errors.map(formatIssue));
  if (result.questions.length !== questions.length) {
    problems.push(
      `${name} › (bank) › questions: ${String(questions.length - result.questions.length)} question(s) failed validation`,
    );
  }
  return problems;
}

const names =
  process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_FIXTURES;
let failed = false;
for (const name of names) {
  const problems = validateFixture(name);
  for (const problem of problems) console.error(`error: ${problem}`);
  console.log(
    `e2e:fixtures: ${name}: ${problems.length === 0 ? "valid" : `${String(problems.length)} error(s)`}`,
  );
  if (problems.length > 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
