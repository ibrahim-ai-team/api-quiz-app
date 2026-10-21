/** Shared test data for the app shell component tests (not shipped). */
import type { LoadBankResult } from "../../content/loader";
import type { Bank } from "../../content/types";

export const TEST_BANK: Bank = {
  schemaVersion: 1,
  contentVersion: "test-v1",
  topics: [
    { id: "topic-a", name: "Topic A" },
    { id: "topic-d", name: "Topic D (no questions)" },
  ],
  questions: [
    {
      id: "q-1",
      topic: "topic-a",
      difficulty: "easy",
      type: "true-false",
      prompt: "Is GET safe?",
      options: [
        { id: "true", text: "True" },
        { id: "false", text: "False" },
      ],
      correct: "true",
      explanation: "GET is safe.",
      sourceUrl: "https://www.rfc-editor.org/rfc/rfc9110",
      reviewStatus: "reviewed",
    },
  ],
};

export const OK: LoadBankResult = { ok: true, bank: TEST_BANK };
export const FAILED: LoadBankResult = {
  ok: false,
  error: { kind: "http", message: "unexpected HTTP status 500", status: 500 },
};

export interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

export function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
