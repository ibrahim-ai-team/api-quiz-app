/** Test bank builders for the quiz domain (T-07). */
import type {
  Bank,
  BankQuestion,
  BankTopic,
} from "../../../src/content/types.ts";

export function singleChoice(id: string, topic: string): BankQuestion {
  return {
    id,
    topic,
    difficulty: "easy",
    type: "single-choice",
    prompt: `Prompt ${id}`,
    options: [
      { id: "a", text: `${id} A` },
      { id: "b", text: `${id} B` },
      { id: "c", text: `${id} C` },
      { id: "d", text: `${id} D` },
    ],
    correct: "c",
    explanation: `Explanation for ${id}.`,
    sourceUrl: `https://example.org/${id}`,
    reviewStatus: "reviewed",
  };
}

export function trueFalse(
  id: string,
  topic: string,
  order: "true-first" | "false-first" = "true-first",
): BankQuestion {
  const options = [
    { id: "true", text: "True" },
    { id: "false", text: "False" },
  ];
  return {
    id,
    topic,
    difficulty: "medium",
    type: "true-false",
    prompt: `Statement ${id}`,
    options: order === "true-first" ? options : options.reverse(),
    correct: "false",
    explanation: `Explanation for ${id}.`,
    sourceUrl: `https://example.org/${id}`,
    reviewStatus: "reviewed",
  };
}

/**
 * Builds a bank from `{ topicId: questionCount }` in curated (insertion)
 * order. Question IDs are `<topic>-<n>` (1-based), all single-choice.
 */
export function makeBank(counts: Readonly<Record<string, number>>): Bank {
  const topics: BankTopic[] = [];
  const questions: BankQuestion[] = [];
  for (const [topic, count] of Object.entries(counts)) {
    topics.push({ id: topic, name: `Topic ${topic}` });
    for (let n = 1; n <= count; n += 1) {
      questions.push(singleChoice(`${topic}-${String(n)}`, topic));
    }
  }
  return { schemaVersion: 1, contentVersion: "test", topics, questions };
}

export const SEEDS: readonly number[] = Array.from(
  { length: 200 },
  (_, i) => i * 7919 + 1,
);
