/**
 * Content build (T-06, US-7.4; ADR-0001 "Content", amendment A4).
 *
 *   node scripts/build-content.ts [--mode production|development]
 *                                 [--root <content-dir>] [--out <file>]
 *
 * Validates `content/` with the T-05 rules (dev thresholds: shortfalls are
 * warnings), refuses to emit when there is any error, and writes the bank to
 * `src/content/generated/bank.json` (gitignored). In the same run it writes
 * `landing-reserve.json` next to the bank (T-35): the eligible topic count
 * and names that the Landing loading reserve imports. `npm run build` uses
 * production mode (drafts excluded); `npm run dev` uses development mode
 * (drafts included). The default mode is production, so a forgotten flag can
 * never ship drafts. Runs with Node's built-in type stripping.
 */
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  isBank,
  type BankOption,
  type BankQuestion,
  type BankTopic,
} from "../src/content/types.ts";
import {
  buildBank,
  buildLandingReserve,
  LANDING_RESERVE_FILE,
  serializeBank,
  serializeLandingReserve,
  type BuildMode,
} from "./content/emit.ts";
import type { Question, Topic } from "./content/schema.ts";
import {
  formatIssue,
  loadContentSources,
  validateContent,
} from "./content/validate.ts";

// Compile-time contract (T-05-R01 M3): the Zod-inferred schema types must stay
// assignable to the plain-TS emitted types in src/content/types.ts, and the
// key sets must match, so neither side can drift silently.
type Assignable<From, To> = [From] extends [To] ? true : false;
type SameKeys<A, B> = [keyof A] extends [keyof B]
  ? [keyof B] extends [keyof A]
    ? true
    : false
  : false;
type StripUndefined<T> = { [K in keyof T]: Exclude<T[K], undefined> };
type Expect<T extends true> = T;
/** Exported only so `noUnusedLocals` keeps the type-level checks. */
export type ContentContractChecks = [
  Expect<Assignable<StripUndefined<Question>, BankQuestion>>,
  Expect<Assignable<Topic, BankTopic>>,
  Expect<SameKeys<Question, BankQuestion>>,
  Expect<SameKeys<Topic, BankTopic>>,
  Expect<Assignable<Question["options"][number], BankOption>>,
  Expect<SameKeys<Question["options"][number], BankOption>>,
];

const USAGE =
  "usage: node scripts/build-content.ts [--mode production|development] [--root <content-dir>] [--out <file>]";

const DEFAULT_OUT = "src/content/generated/bank.json";

interface Args {
  mode: BuildMode;
  root: string;
  out: string;
}

function parseArgs(argv: readonly string[]): Args | null {
  const args: Args = { mode: "production", root: "content", out: DEFAULT_OUT };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) return null;
    if (
      arg === "--mode" &&
      (value === "production" || value === "development")
    ) {
      args.mode = value;
    } else if (arg === "--root") {
      args.root = value;
    } else if (arg === "--out") {
      args.out = value;
    } else {
      return null;
    }
    i += 1;
  }
  return args;
}

/** Writes through a temp file and a rename, so readers never see half a file. */
async function writeAtomically(file: string, contents: string): Promise<void> {
  const temp = `${file}.${String(process.pid)}.tmp`;
  await writeFile(temp, contents, "utf8");
  await rename(temp, file);
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (args === null) {
    console.error(USAGE);
    return 2;
  }
  const sources = await loadContentSources(args.root);
  const result = validateContent(sources, { release: false });
  for (const warning of result.warnings) {
    console.warn(`warning: ${formatIssue(warning)}`);
  }
  for (const error of result.errors) {
    console.error(`error: ${formatIssue(error)}`);
  }
  if (result.errors.length > 0) {
    console.error(
      `content:build: refusing to emit: ${String(result.errors.length)} validation error(s)`,
    );
    return 1;
  }

  const bank = buildBank(result.topics, result.questions, args.mode);
  // Self-check: the emitted file must pass the same guard the app runs.
  if (!isBank(bank)) {
    console.error("content:build: emitted bank fails the runtime isBank guard");
    return 1;
  }

  const reserve = buildLandingReserve(bank);
  const reserveOut = path.join(path.dirname(args.out), LANDING_RESERVE_FILE);

  await mkdir(path.dirname(args.out), { recursive: true });
  // Each file is replaced atomically; the pair is not. A crash between the
  // two renames leaves a new bank next to an old reserve until the next
  // build, and tests/unit/content/landing-reserve.test.ts catches that.
  await writeAtomically(args.out, serializeBank(bank));
  await writeAtomically(reserveOut, serializeLandingReserve(reserve));

  const excluded = result.questions.length - bank.questions.length;
  console.log(
    `content:build (${args.mode}): wrote ${args.out}: ` +
      `${String(bank.topics.length)} topics, ${String(bank.questions.length)} questions ` +
      `(${String(excluded)} drafts excluded), contentVersion ${bank.contentVersion}; ` +
      `wrote ${reserveOut}: ${String(reserve.eligibleTopicCount)} eligible topics`,
  );
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(
      `error: content build failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  },
);
