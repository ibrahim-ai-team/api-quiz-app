/**
 * Session codec (T-41; US-6, US-6.8, FR-20) and encoded sizes for the real
 * content (66 questions, 8 topics).
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isBank,
  type Bank,
  type BankQuestion,
  type BankTopic,
} from "../../../src/content/types.ts";
import {
  createQuiz,
  createSeededRng,
  next,
  percentHalfUp,
  restoreQuiz,
  selectOption,
  startSession,
  submitAnswer,
  toSavedSession,
  type BestScore,
  type QuizSession,
  type SavedSession,
} from "../../../src/domain/index.ts";
import {
  decodeSession,
  encodeBest,
  encodeSession,
  MAX_SESSION_QUESTIONS,
  MAX_VALUE_LENGTH,
} from "../../../src/storage/index.ts";

const AT = 1_761_200_000_000;
const CONTENT = path.resolve(import.meta.dirname, "../../../content");

function realBank(): Bank {
  const topics = (
    JSON.parse(readFileSync(path.join(CONTENT, "topics.json"), "utf8")) as {
      topics: BankTopic[];
    }
  ).topics;
  const questions: BankQuestion[] = [];
  for (const file of readdirSync(path.join(CONTENT, "questions")).sort()) {
    const parsed = JSON.parse(
      readFileSync(path.join(CONTENT, "questions", file), "utf8"),
    ) as { questions: BankQuestion[] };
    questions.push(...parsed.questions);
  }
  return {
    schemaVersion: 1,
    contentVersion: "f70a189a8fe6f32c",
    topics,
    questions,
  };
}

function playAll(session: QuizSession, keepLastPending: boolean): QuizSession {
  const rng = createSeededRng(99);
  let s = session;
  const n = s.quiz.questions.length;
  for (let i = 0; i < n; i += 1) {
    const q = s.quiz.questions[s.index];
    const option = q?.options[Math.floor(rng.next() * q.options.length)];
    if (option === undefined) break;
    s = submitAnswer(selectOption(s, option.id));
    if (!(keepLastPending && i === n - 1)) s = next(s);
  }
  return s;
}

const minimal: SavedSession = {
  schemaVersion: 1,
  contentVersion: "cv",
  mode: "normal",
  scope: { kind: "topic", topicId: "t" },
  seed: 42,
  questionIds: ["q1", "q2"],
  optionOrder: [
    ["b", "a"],
    ["true", "false"],
  ],
  answers: [{ q: "q1", o: "a" }],
  index: 1,
  savedAt: AT,
};

describe("encodeSession / decodeSession", () => {
  it("round-trips with a fixed field order and no text or correct flags", () => {
    const raw = encodeSession(minimal);
    expect(raw).toBe(
      '{"schemaVersion":1,"contentVersion":"cv","mode":"normal","scope":{"kind":"topic","topicId":"t"},"seed":42,' +
        '"questionIds":["q1","q2"],"optionOrder":[["b","a"],["true","false"]],"answers":[{"q":"q1","o":"a"}],"index":1,"savedAt":1761200000000}',
    );
    expect(decodeSession(raw)).toEqual({ ok: true, value: minimal });
    const mixed: SavedSession = {
      ...minimal,
      mode: "retry-missed",
      scope: { kind: "mixed" },
    };
    expect(decodeSession(encodeSession(mixed))).toEqual({
      ok: true,
      value: mixed,
    });
  });

  it("tags absent, oversized, corrupt and unknown-version values", () => {
    expect(decodeSession(null)).toEqual({ ok: false, reason: "absent" });
    expect(
      decodeSession(encodeSession(minimal).padEnd(MAX_VALUE_LENGTH + 1)),
    ).toEqual({ ok: false, reason: "too-large" });
    expect(decodeSession("{nope")).toEqual({ ok: false, reason: "corrupt" });
    expect(
      decodeSession(
        encodeSession(minimal).replace(
          '"schemaVersion":1',
          '"schemaVersion":7',
        ),
      ),
    ).toEqual({ ok: false, reason: "unknown-version" });
  });

  const bad: [string, Partial<Record<keyof SavedSession, unknown>>][] = [
    ["empty contentVersion", { contentVersion: "" }],
    ["unknown mode", { mode: "retry" }],
    ["unknown scope kind", { scope: { kind: "all" } }],
    ["topic scope without topicId", { scope: { kind: "topic" } }],
    ["fractional seed", { seed: 1.5 }],
    ["seed above uint32", { seed: 2 ** 32 }],
    ["string seed", { seed: "42" }],
    ["non-array questionIds", { questionIds: "q1,q2" }],
    ["numeric question ID", { questionIds: [1, 2] }],
    ["optionOrder length mismatch", { optionOrder: [["a", "b"]] }],
    ["single-option order", { optionOrder: [["a"], ["true", "false"]] }],
    [
      "answer with correct flag only",
      { answers: [{ q: "q1", correct: true }] },
    ],
    ["answer for the wrong question", { answers: [{ q: "q2", o: "true" }] }],
    ["index out of range", { index: 2 }],
    ["index too far ahead of answers", { index: 1, answers: [] }],
    ["ISO savedAt", { savedAt: "2026-10-23T00:00:00Z" }],
    [
      "too many questions",
      {
        questionIds: Array.from(
          { length: MAX_SESSION_QUESTIONS + 1 },
          (_, i) => `q${String(i)}`,
        ),
      },
    ],
  ];
  it.each(bad)("rejects %s as corrupt", (_name, patch) => {
    const raw = JSON.stringify({ ...minimal, ...patch });
    expect(decodeSession(raw)).toEqual({ ok: false, reason: "corrupt" });
  });

  it("rejects a missing field as corrupt", () => {
    for (const key of Object.keys(minimal)) {
      const copy = Object.fromEntries(
        Object.entries(minimal).filter(([k]) => k !== key),
      );
      expect(decodeSession(JSON.stringify(copy))).toEqual({
        ok: false,
        reason: "corrupt",
      });
    }
  });

  it("decodes a literal pre-US-11 save (no difficulty) unchanged", () => {
    const raw =
      '{"schemaVersion":1,"contentVersion":"cv","mode":"normal","scope":{"kind":"topic","topicId":"t"},"seed":42,' +
      '"questionIds":["q1","q2"],"optionOrder":[["b","a"],["true","false"]],"answers":[{"q":"q1","o":"a"}],"index":1,"savedAt":1761200000000}';
    const decoded = decodeSession(raw);
    expect(decoded).toEqual({ ok: true, value: minimal });
    expect(decoded.ok && Object.hasOwn(decoded.value, "difficulty")).toBe(
      false,
    );
  });

  it("encodes an All session with no difficulty key", () => {
    expect(encodeSession(minimal)).not.toContain("difficulty");
    expect(
      Object.hasOwn(JSON.parse(encodeSession(minimal)) as object, "difficulty"),
    ).toBe(false);
  });

  it.each(["easy", "medium", "hard"] as const)(
    "round-trips difficulty %s as the last field",
    (difficulty) => {
      const filtered: SavedSession = { ...minimal, difficulty };
      const raw = encodeSession(filtered);
      expect(
        raw.endsWith(`"savedAt":1761200000000,"difficulty":"${difficulty}"}`),
      ).toBe(true);
      expect(decodeSession(raw)).toEqual({ ok: true, value: filtered });
    },
  );

  it.each<[string, unknown]>([
    ["all", "all"],
    ["extreme", "extreme"],
    ["1", 1],
    ["null", null],
    ["Hard", "Hard"],
    ["empty string", ""],
  ])("rejects difficulty %s as corrupt", (_name, difficulty) => {
    expect(decodeSession(JSON.stringify({ ...minimal, difficulty }))).toEqual({
      ok: false,
      reason: "corrupt",
    });
  });

  it("does not take difficulty from __proto__", () => {
    const raw = encodeSession(minimal).replace(
      '"savedAt":1761200000000',
      '"savedAt":1761200000000,"__proto__":{"difficulty":"hard"}',
    );
    const decoded = decodeSession(raw);
    expect(decoded).toEqual({ ok: true, value: minimal });
  });

  it("reads own properties only (__proto__ cannot supply fields)", () => {
    const raw = encodeSession(minimal).replace(
      '"scope":{"kind":"topic","topicId":"t"}',
      '"scope":{"__proto__":{"kind":"mixed"}}',
    );
    expect(decodeSession(raw)).toEqual({ ok: false, reason: "corrupt" });
  });
});

describe("real content: restore and encoded sizes (US-6.8)", () => {
  const bank = realBank();

  it("builds a valid 66-question bank from content/", () => {
    expect(isBank(bank)).toBe(true);
    expect(bank.questions).toHaveLength(66);
  });

  it("round-trips a 20-question mixed session through encode/decode/restore", () => {
    const created = createQuiz(bank, { kind: "mixed" }, 123_456_789, 20);
    if (!created.ok) throw new Error(created.error);
    const session = playAll(startSession(created.quiz), true);
    const raw = encodeSession(toSavedSession(session, AT));
    const decoded = decodeSession(raw);
    if (!decoded.ok) throw new Error(decoded.reason);
    expect(restoreQuiz(bank, decoded.value)).toEqual({
      ok: true,
      session,
      contentChanged: false,
    });
  });

  it("round-trips a filtered (hard) topic session through encode/decode/restore, and is stale without its difficulty", () => {
    const topicId = bank.topics[0]?.id ?? "";
    const created = createQuiz(
      bank,
      { kind: "topic", topicId },
      2_024,
      5,
      "hard",
    );
    if (!created.ok) throw new Error(created.error);
    expect(created.quiz.questions.every((q) => q.difficulty === "hard")).toBe(
      true,
    );
    const session = playAll(startSession(created.quiz), true);
    const saved = toSavedSession(session, AT);
    const decoded = decodeSession(encodeSession(saved));
    if (!decoded.ok) throw new Error(decoded.reason);
    expect(decoded.value).toEqual(saved);
    expect(restoreQuiz(bank, decoded.value)).toEqual({
      ok: true,
      session,
      contentChanged: false,
    });
    const { difficulty, ...unfiltered } = decoded.value;
    expect(difficulty).toBe("hard");
    expect(restoreQuiz(bank, unfiltered)).toEqual({
      ok: false,
      reason: "stale",
    });
  });

  it("measures encoded sizes", () => {
    const created = createQuiz(bank, { kind: "mixed" }, 4_294_967_295, 20);
    if (!created.ok) throw new Error(created.error);
    const session = playAll(startSession(created.quiz), true);
    const sessionRaw = encodeSession(toSavedSession(session, AT));

    const scores: Record<string, BestScore> = {};
    for (const key of [...bank.topics.map((t) => t.id), "mixed"]) {
      scores[key] = {
        percent: percentHalfUp(19, 20),
        correct: 19,
        total: 20,
        at: AT,
      };
    }
    const bestRaw = encodeBest({ schemaVersion: 1, scores });

    // Reported in the T-41 hand-off; bounds keep a margin for longer IDs.
    console.info(
      `T-41 sizes: best (${String(Object.keys(scores).length)} keys) = ${String(bestRaw.length)} chars; ` +
        `session (20 questions, 20 answers) = ${String(sessionRaw.length)} chars`,
    );
    expect(bestRaw.length).toBeLessThan(2048);
    expect(sessionRaw.length).toBeLessThan(4096);
    expect(sessionRaw.length).toBeLessThan(MAX_VALUE_LENGTH);
  });
});
