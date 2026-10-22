/**
 * Content rules that need more than one field (FR-21, FR-22, US-7.2, US-7.3)
 * and the release content policies (US-7.5 / US-8.1). Pure functions: no file system.
 */
import {
  SINGLE_CHOICE_MAX_OPTIONS,
  SINGLE_CHOICE_MIN_OPTIONS,
  SINGLE_CHOICE_OPTION_IDS,
  TRUE_FALSE_OPTIONS,
  type Question,
  type Topic,
} from "./schema.ts";

/** A rule violation inside one question, before the file/ID is attached. */
export interface FieldProblem {
  field: string;
  message: string;
}

/** Option text comparison is trimmed, whitespace-collapsed, case-insensitive. */
export function normalizeOptionText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function optionCountProblems(question: Question): FieldProblem[] {
  const count = question.options.length;
  if (question.type === "true-false") {
    return count === TRUE_FALSE_OPTIONS.length
      ? []
      : [
          {
            field: "options",
            message: `true-false needs exactly ${String(TRUE_FALSE_OPTIONS.length)} options, found ${String(count)}`,
          },
        ];
  }
  return count >= SINGLE_CHOICE_MIN_OPTIONS &&
    count <= SINGLE_CHOICE_MAX_OPTIONS
    ? []
    : [
        {
          field: "options",
          message: `single-choice needs ${String(SINGLE_CHOICE_MIN_OPTIONS)}-${String(SINGLE_CHOICE_MAX_OPTIONS)} options, found ${String(count)}`,
        },
      ];
}

function optionIdProblems(question: Question): FieldProblem[] {
  const problems: FieldProblem[] = [];
  question.options.forEach((option, index) => {
    if (question.type === "true-false") {
      const expected = TRUE_FALSE_OPTIONS.find((o) => o.id === option.id);
      if (expected === undefined) {
        problems.push({
          field: `options[${String(index)}].id`,
          message: `true-false option id must be "true" or "false" (found "${option.id}")`,
        });
      } else if (option.text !== expected.text) {
        problems.push({
          field: `options[${String(index)}].text`,
          message: `true-false option "${expected.id}" must have text "${expected.text}"`,
        });
      }
    } else if (
      !(SINGLE_CHOICE_OPTION_IDS as readonly string[]).includes(option.id)
    ) {
      problems.push({
        field: `options[${String(index)}].id`,
        message: `single-choice option id must be one of ${SINGLE_CHOICE_OPTION_IDS.join(", ")} (found "${option.id}")`,
      });
    }
  });
  // M4: true-false options are always ordered [true, false].
  if (
    question.type === "true-false" &&
    question.options[0]?.id === "false" &&
    question.options[1]?.id === "true"
  ) {
    problems.push({
      field: "options",
      message: 'true-false options must be in order ["true", "false"]',
    });
  }
  return problems;
}

function duplicateOptionProblems(question: Question): FieldProblem[] {
  const problems: FieldProblem[] = [];
  const seenIds = new Map<string, number>();
  const seenTexts = new Map<string, number>();
  question.options.forEach((option, index) => {
    const firstId = seenIds.get(option.id);
    if (firstId === undefined) {
      seenIds.set(option.id, index);
    } else {
      problems.push({
        field: `options[${String(index)}].id`,
        message: `duplicate option id "${option.id}" (same as options[${String(firstId)}])`,
      });
    }
    const text = normalizeOptionText(option.text);
    const firstText = seenTexts.get(text);
    if (firstText === undefined) {
      seenTexts.set(text, index);
    } else {
      problems.push({
        field: `options[${String(index)}].text`,
        message: `duplicate option text (same as options[${String(firstText)}], trimmed, case-insensitive)`,
      });
    }
  });
  return problems;
}

/** F-2: `correct` must match exactly one option id of the same question. */
function correctProblems(question: Question): FieldProblem[] {
  const matches = question.options.filter(
    (o) => o.id === question.correct,
  ).length;
  if (matches === 1) return [];
  return [
    {
      field: "correct",
      message:
        matches === 0
          ? `"${question.correct}" does not reference an option id`
          : `ambiguous: "${question.correct}" matches ${String(matches)} options`,
    },
  ];
}

function reviewProblems(question: Question): FieldProblem[] {
  if (question.reviewStatus !== "reviewed") return [];
  if (question.reviewedBy !== undefined && question.reviewedBy.trim() !== "") {
    return [];
  }
  return [
    {
      field: "reviewedBy",
      message: 'required (non-empty) when reviewStatus is "reviewed"',
    },
  ];
}

/**
 * Rules for one schema-valid question. `knownTopics` is null when the topics
 * list itself is invalid (that error is reported once, not per question).
 */
export function questionProblems(
  question: Question,
  fileTopic: string,
  knownTopics: ReadonlySet<string> | null,
): FieldProblem[] {
  const problems: FieldProblem[] = [];
  if (knownTopics !== null && !knownTopics.has(question.topic)) {
    problems.push({
      field: "topic",
      message: `unknown topic "${question.topic}" (not in content/topics.json)`,
    });
  } else if (question.topic !== fileTopic) {
    problems.push({
      field: "topic",
      message: `topic "${question.topic}" does not match file name "${fileTopic}.json"`,
    });
  }
  problems.push(
    ...optionCountProblems(question),
    ...optionIdProblems(question),
    ...duplicateOptionProblems(question),
    ...correctProblems(question),
    ...reviewProblems(question),
  );
  return problems;
}

/**
 * Active MVP release policy, counted after drafts and invalid questions are
 * excluded. The quality floor (5 per covered topic and 20% medium/hard) remains.
 */
export const MVP_RELEASE_THRESHOLDS = {
  minReviewedQuestions: 24,
  minTopics: 3,
  minPerTopic: 5,
  /** At least 20% of reviewed questions are medium or hard. */
  minMediumOrHardPercent: 20,
} as const;

/**
 * Future content target from US-8.1. Kept separate from the current MVP gate so
 * the temporary release policy does not rewrite the product acceptance criteria.
 */
export const FUTURE_RELEASE_TARGET = {
  minReviewedQuestions: 60,
  minTopics: 8,
  minPerTopic: 5,
  minMediumOrHardPercent: 20,
} as const;

/**
 * Threshold shortfalls over the reviewed questions. A topic counts as covered
 * when it has at least one reviewed question; every covered topic needs
 * `minPerTopic`. Returned problems use bank-level pseudo fields.
 */
export function releaseThresholdProblems(
  questions: readonly Question[],
  topics: readonly Topic[],
): FieldProblem[] {
  const t = MVP_RELEASE_THRESHOLDS;
  const reviewed = questions.filter((q) => q.reviewStatus === "reviewed");
  const perTopic = new Map<string, number>();
  for (const q of reviewed) {
    perTopic.set(q.topic, (perTopic.get(q.topic) ?? 0) + 1);
  }
  const problems: FieldProblem[] = [];
  if (reviewed.length < t.minReviewedQuestions) {
    problems.push({
      field: "reviewed.total",
      message: `${String(reviewed.length)} reviewed questions; MVP release needs at least ${String(t.minReviewedQuestions)}`,
    });
  }
  if (perTopic.size < t.minTopics) {
    problems.push({
      field: "reviewed.topics",
      message: `${String(perTopic.size)} topics with reviewed questions; MVP release needs at least ${String(t.minTopics)}`,
    });
  }
  // Curated order first, then any topic not in the list (already an error).
  const order = [
    ...topics.map((topic) => topic.id),
    ...[...perTopic.keys()].filter((id) => !topics.some((x) => x.id === id)),
  ];
  for (const topicId of order) {
    const count = perTopic.get(topicId);
    if (count !== undefined && count < t.minPerTopic) {
      problems.push({
        field: `reviewed.perTopic.${topicId}`,
        message: `${String(count)} reviewed questions; release needs at least ${String(t.minPerTopic)} per topic`,
      });
    }
  }
  const mediumOrHard = reviewed.filter((q) => q.difficulty !== "easy").length;
  // Integer comparison avoids floating-point error at the 20% boundary.
  if (
    reviewed.length === 0 ||
    mediumOrHard * 100 < t.minMediumOrHardPercent * reviewed.length
  ) {
    problems.push({
      field: "reviewed.difficulty",
      message: `${String(mediumOrHard)} of ${String(reviewed.length)} reviewed questions are medium or hard; release needs at least ${String(t.minMediumOrHardPercent)}%`,
    });
  }
  return problems;
}
