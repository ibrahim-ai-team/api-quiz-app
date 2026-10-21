// Build-output content check (T-06-R01 M1, US-7.4): the production build must
// ship exactly one question bank and it must contain no draft questions.
//
// Fails unless the assets directory holds exactly one `bank-*.json` file that
// parses as JSON with a `questions` array in which every question has
// `reviewStatus: "reviewed"`. Offending question ids are named.
//
// No dependencies: Node only. Usage: node scripts/check-dist-content.mjs [--dir dist/assets]
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const BANK_FILE = /^bank-.*\.json$/;

function main() {
  const args = process.argv.slice(2);
  let dir = "dist/assets";
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--dir" && args[i + 1] !== undefined) {
      dir = args[i + 1];
      i += 1;
    } else {
      console.error(
        `check-dist-content: unknown or incomplete argument: ${args[i]}`,
      );
      return 1;
    }
  }

  let names;
  try {
    names = readdirSync(dir)
      .filter((name) => BANK_FILE.test(name))
      .sort();
  } catch {
    console.error(
      `check-dist-content: FAIL - directory "${dir}" not found (run the build first)`,
    );
    return 1;
  }
  if (names.length !== 1) {
    console.error(
      `check-dist-content: FAIL - expected exactly 1 bank-*.json in "${dir}", found ${String(names.length)}${names.length > 0 ? `: ${names.join(", ")}` : ""}`,
    );
    return 1;
  }

  const file = path.join(dir, names[0]);
  let bank;
  try {
    bank = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    console.error(
      `check-dist-content: FAIL - ${file} is unreadable or malformed JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 1;
  }
  if (
    typeof bank !== "object" ||
    bank === null ||
    !Array.isArray(bank.questions)
  ) {
    console.error(
      `check-dist-content: FAIL - ${file} has no "questions" array`,
    );
    return 1;
  }

  const offending = bank.questions
    .map((question, index) => ({ question, index }))
    .filter(({ question }) => question?.reviewStatus !== "reviewed")
    .map(({ question, index }) =>
      typeof question?.id === "string"
        ? question.id
        : `questions[${String(index)}]`,
    );
  if (offending.length > 0) {
    console.error(
      `check-dist-content: FAIL - ${file} contains ${String(offending.length)} non-reviewed (draft) question(s): ${offending.join(", ")}`,
    );
    return 1;
  }

  console.log(
    `check-dist-content: PASS - ${file}: ${String(bank.questions.length)} question(s), all reviewed`,
  );
  return 0;
}

process.exitCode = main();
