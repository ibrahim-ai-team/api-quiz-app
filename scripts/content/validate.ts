/**
 * Question bank validation (T-05, US-7). `validateContent` is pure and works
 * on in-memory sources so it can be unit-tested; `loadContentSources` reads a
 * content directory. Neither throws on bad content: every problem becomes a
 * `ContentIssue` that names the file, question ID and field.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { z } from "zod";
import { findDuplicateKey } from "./json.ts";
import {
  questionFileSchema,
  questionSchema,
  retiredIdsFileSchema,
  topicsFileSchema,
  type Question,
  type Topic,
} from "./schema.ts";
import {
  questionProblems,
  releaseThresholdProblems,
  type FieldProblem,
} from "./rules.ts";

export interface ContentIssue {
  file: string;
  /** Question ID, `questions[<index>]` when the ID is unusable, or a marker. */
  questionId: string;
  field: string;
  message: string;
}

/** A content file; `text` is null when it could not be read. */
export interface SourceFile {
  path: string;
  text: string | null;
}

export interface ContentSources {
  topics: SourceFile;
  retiredIds: SourceFile;
  questionFiles: readonly SourceFile[];
  /**
   * Entries of the questions directory that are not `.json` files and were
   * not read; each one becomes a file-level warning (T-32 N6).
   */
  ignoredFiles?: readonly string[];
  /** Display path for bank-level (threshold) issues. */
  bankPath?: string;
}

export interface ValidateOptions {
  /** Release mode: threshold shortfalls are errors instead of warnings. */
  release: boolean;
}

export interface ValidationResult {
  errors: ContentIssue[];
  warnings: ContentIssue[];
  /** Error-free questions (including drafts), in file order. */
  questions: Question[];
  topics: Topic[];
}

/** Marker used as `questionId` for file-level issues. */
export const FILE_LEVEL = "(file)";
/** Marker used as `questionId` for bank-level threshold issues. */
export const BANK_LEVEL = "(bank)";

export function formatIssue(issue: ContentIssue): string {
  return `${issue.file} › ${issue.questionId} › ${issue.field}: ${issue.message}`;
}

/** `["options", 1, "text"]` -> `options[1].text`; empty path -> fallback. */
export function formatPath(
  segments: readonly PropertyKey[],
  fallback: string,
): string {
  let out = "";
  for (const segment of segments) {
    if (typeof segment === "number") out += `[${String(segment)}]`;
    else out += out === "" ? String(segment) : `.${String(segment)}`;
  }
  return out === "" ? fallback : out;
}

/** Flattens Zod issues; unknown keys are reported once per key. */
function zodProblems(error: z.ZodError, rootField: string): FieldProblem[] {
  const problems: FieldProblem[] = [];
  for (const issue of error.issues) {
    if (issue.code === "unrecognized_keys") {
      for (const key of issue.keys) {
        problems.push({
          field: formatPath([...issue.path, key], rootField),
          message: "unknown key (not allowed by the schema)",
        });
      }
    } else {
      problems.push({
        field: formatPath(issue.path, rootField),
        message: issue.message,
      });
    }
  }
  return problems;
}

type ParsedJson =
  { ok: true; value: unknown } | { ok: false; issue: ContentIssue };

function parseJson(source: SourceFile): ParsedJson {
  const fail = (message: string): ParsedJson => ({
    ok: false,
    issue: {
      file: source.path,
      questionId: FILE_LEVEL,
      field: "(json)",
      message,
    },
  });
  if (source.text === null) return fail("file is missing or unreadable");
  let value: unknown;
  try {
    value = JSON.parse(source.text) as unknown;
  } catch (error) {
    return fail(
      `malformed JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  // JSON.parse keeps only the last value of a repeated key (T-32 M1).
  let duplicate: ReturnType<typeof findDuplicateKey>;
  try {
    duplicate = findDuplicateKey(source.text);
  } catch (error) {
    return fail(
      `could not check for duplicate keys: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (duplicate !== null) {
    return fail(
      `duplicate key "${duplicate.key}" in ${formatPath(duplicate.path, "(root)")} ` +
        "(JSON.parse would keep only the last value)",
    );
  }
  return { ok: true, value };
}

/** Parses a whole-file schema; issues are file-level. */
function parseFile<T>(
  source: SourceFile,
  schema: z.ZodType<T>,
  errors: ContentIssue[],
): T | null {
  const json = parseJson(source);
  if (!json.ok) {
    errors.push(json.issue);
    return null;
  }
  const result = schema.safeParse(json.value);
  if (result.success) return result.data;
  for (const p of zodProblems(result.error, "(root)")) {
    errors.push({ file: source.path, questionId: FILE_LEVEL, ...p });
  }
  return null;
}

/** The raw `id` of a question entry when it is a non-blank string. */
function usableQuestionId(raw: unknown): string | null {
  if (
    typeof raw === "object" &&
    raw !== null &&
    "id" in raw &&
    typeof raw.id === "string" &&
    raw.id.trim() !== ""
  ) {
    return raw.id;
  }
  return null;
}

export function validateContent(
  sources: ContentSources,
  options: ValidateOptions,
): ValidationResult {
  const errors: ContentIssue[] = [];
  const warnings: ContentIssue[] = [];
  const questions: Question[] = [];

  const topicsFile = parseFile(sources.topics, topicsFileSchema, errors);
  const topics = topicsFile?.topics ?? [];
  let knownTopics: Set<string> | null = null;
  if (topicsFile !== null) {
    knownTopics = new Set();
    topics.forEach((topic, index) => {
      if (knownTopics?.has(topic.id) === true) {
        errors.push({
          file: sources.topics.path,
          questionId: FILE_LEVEL,
          field: `topics[${String(index)}].id`,
          message: `duplicate topic id "${topic.id}"`,
        });
      }
      knownTopics?.add(topic.id);
    });
  }

  const retired = new Set(
    parseFile(sources.retiredIds, retiredIdsFileSchema, errors)?.retiredIds,
  );

  /** First file that declared each question ID. */
  const firstSeen = new Map<string, string>();
  /** Question entries declared across all parsed files, valid or not. */
  let declared = 0;

  for (const source of sources.questionFiles) {
    const fileTopic = path.basename(source.path, ".json");
    if (
      source.text !== null &&
      knownTopics !== null &&
      !knownTopics.has(fileTopic)
    ) {
      errors.push({
        file: source.path,
        questionId: FILE_LEVEL,
        field: "(file name)",
        message: `file name "${fileTopic}.json" does not match a topic id in content/topics.json`,
      });
    }
    const file = parseFile(source, questionFileSchema, errors);
    if (file === null) continue;
    declared += file.questions.length;

    file.questions.forEach((raw, index) => {
      const rawId = usableQuestionId(raw);
      const questionId = rawId ?? `questions[${String(index)}]`;
      const report = (p: FieldProblem): void => {
        errors.push({ file: source.path, questionId, ...p });
      };
      // The ID is claimed before the schema check (T-32 N5), so a valid
      // duplicate after a schema-invalid first occurrence is still caught.
      const problems: FieldProblem[] = [];
      if (rawId !== null) {
        const previous = firstSeen.get(rawId);
        if (previous === undefined) {
          firstSeen.set(rawId, source.path);
        } else {
          problems.push({
            field: "id",
            message: `duplicate question id (first declared in ${previous})`,
          });
        }
      }
      const result = questionSchema.safeParse(raw);
      if (!result.success) {
        zodProblems(result.error, "(question)").forEach(report);
        problems.forEach(report);
        return;
      }
      const question = result.data;
      if (retired.has(question.id)) {
        problems.push({
          field: "id",
          message: "reuses a retired id (listed in content/retired-ids.json)",
        });
      }
      problems.push(...questionProblems(question, fileTopic, knownTopics));
      problems.forEach(report);
      // Only error-free questions count toward the release thresholds.
      if (problems.length === 0) questions.push(question);
    });
  }

  for (const ignored of sources.ignoredFiles ?? []) {
    warnings.push({
      file: ignored,
      questionId: FILE_LEVEL,
      field: "(file name)",
      message: "ignored: question files must end in .json",
    });
  }

  const bankFile = sources.bankPath ?? "content/questions";
  if (declared === 0) {
    warnings.push({
      file: bankFile,
      questionId: BANK_LEVEL,
      field: "(empty)",
      message: "the question bank is empty: no questions are declared",
    });
  }
  for (const p of releaseThresholdProblems(questions, topics)) {
    (options.release ? errors : warnings).push({
      file: bankFile,
      questionId: BANK_LEVEL,
      ...p,
    });
  }

  return { errors, warnings, questions, topics };
}

async function readSource(file: string, display: string): Promise<SourceFile> {
  try {
    return { path: display, text: await readFile(file, "utf8") };
  } catch {
    return { path: display, text: null };
  }
}

/**
 * Reads `<root>/topics.json`, `<root>/retired-ids.json` and every
 * `<root>/questions/*.json` (sorted). Other entries of the questions
 * directory are listed in `ignoredFiles`. Display paths are relative to `cwd`.
 * Never throws: a missing questions directory yields an empty list plus a
 * marker source with `text: null`.
 */
export async function loadContentSources(
  root: string,
  cwd: string = process.cwd(),
): Promise<ContentSources> {
  const display = (file: string): string =>
    path.relative(cwd, file).split(path.sep).join("/");
  const questionsDir = path.join(root, "questions");
  let questionFiles: SourceFile[];
  const ignoredFiles: string[] = [];
  try {
    const entries = (await readdir(questionsDir)).sort();
    const names: string[] = [];
    for (const name of entries) {
      if (name.endsWith(".json")) names.push(name);
      else ignoredFiles.push(display(path.join(questionsDir, name)));
    }
    questionFiles = await Promise.all(
      names.map((name) => {
        const file = path.join(questionsDir, name);
        return readSource(file, display(file));
      }),
    );
  } catch {
    questionFiles = [{ path: display(questionsDir), text: null }];
  }
  const topicsPath = path.join(root, "topics.json");
  const retiredPath = path.join(root, "retired-ids.json");
  return {
    topics: await readSource(topicsPath, display(topicsPath)),
    retiredIds: await readSource(retiredPath, display(retiredPath)),
    questionFiles,
    ignoredFiles,
    bankPath: display(questionsDir),
  };
}
