/**
 * Content validator CLI (T-05, US-7.3, US-7.5).
 *
 *   node scripts/validate-content.ts [--release] [--root <content-dir>]
 *
 * Prints each problem as `file › questionId › field: message` and exits 1 on
 * any error. Release-threshold shortfalls (US-8.1) are warnings by default and
 * errors with `--release`. Runs with Node's built-in type stripping.
 */
import {
  formatIssue,
  loadContentSources,
  validateContent,
} from "./content/validate.ts";

const USAGE =
  "usage: node scripts/validate-content.ts [--release] [--root <content-dir>]";

interface Args {
  release: boolean;
  root: string;
}

function parseArgs(argv: readonly string[]): Args | null {
  const args: Args = { release: false, root: "content" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--release") {
      args.release = true;
    } else if (arg === "--root") {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) return null;
      args.root = value;
      i += 1;
    } else {
      return null;
    }
  }
  return args;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (args === null) {
    console.error(USAGE);
    return 2;
  }
  const sources = await loadContentSources(args.root);
  const result = validateContent(sources, { release: args.release });
  for (const warning of result.warnings) {
    console.warn(`warning: ${formatIssue(warning)}`);
  }
  for (const error of result.errors) {
    console.error(`error: ${formatIssue(error)}`);
  }
  const reviewed = result.questions.filter(
    (q) => q.reviewStatus === "reviewed",
  ).length;
  const mode = args.release ? "release" : "dev";
  console.log(
    `content:validate (${mode}): ${String(sources.questionFiles.length)} files, ` +
      `${String(result.questions.length)} valid questions ` +
      `(${String(reviewed)} reviewed, ${String(result.questions.length - reviewed)} draft); ` +
      `${String(result.errors.length)} errors, ${String(result.warnings.length)} warnings`,
  );
  return result.errors.length > 0 ? 1 : 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(
      `error: content validator failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  },
);
