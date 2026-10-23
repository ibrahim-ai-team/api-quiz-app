/**
 * V-6 (codec level, T-41): seeded fuzzing of decodeBest / decodeSession and
 * restoreQuiz with corrupt JSON, wrong types, oversized values, unknown
 * schemaVersion, stale IDs, reordered options, out-of-range index,
 * duplicated IDs and `__proto__` keys. Every known-invalid input gives a
 * tagged failure; nothing throws; an accepted value is always fully valid.
 */
import { describe, expect, it } from "vitest";
import type { Bank } from "../../../src/content/types.ts";
import {
  createQuiz,
  createRetryQuiz,
  createSeededRng,
  next,
  restoreQuiz,
  selectOption,
  startSession,
  submitAnswer,
  toSavedSession,
  type QuizSession,
  type Rng,
  type SavedSession,
} from "../../../src/domain/index.ts";
import {
  decodeBest,
  decodeSession,
  encodeBest,
  encodeSession,
  MAX_VALUE_LENGTH,
} from "../../../src/storage/index.ts";
import { makeBank, trueFalse } from "../domain/helpers.ts";

const ITERATIONS = 2000;

const bank: Bank = (() => {
  const base = makeBank({ a: 6, b: 5, c: 4 });
  return {
    ...base,
    contentVersion: "cv-1",
    questions: [
      ...base.questions,
      trueFalse("a-tf", "a"),
      trueFalse("b-tf", "b"),
    ],
  };
})();

const int = (rng: Rng, max: number): number => Math.floor(rng.next() * max);
function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[int(rng, items.length)] as T;
}

/** A random valid session: random scope/mode/length/progress. */
function randomSession(rng: Rng): QuizSession {
  const seed = int(rng, 2 ** 32);
  const scope = pick(rng, [
    { kind: "mixed" } as const,
    { kind: "topic", topicId: "a" } as const,
    { kind: "topic", topicId: "b" } as const,
  ]);
  const created = createQuiz(bank, scope, seed, 2 + int(rng, 8));
  if (!created.ok) throw new Error(created.error);
  let quiz = created.quiz;
  if (rng.next() < 0.3) {
    const ids = quiz.questions.map((q) => q.id).filter(() => rng.next() < 0.6);
    const retry = createRetryQuiz(bank, ids, seed + 1, scope);
    if (retry.ok) quiz = retry.quiz;
  }
  let session = startSession(quiz);
  const count = int(rng, quiz.questions.length);
  for (let i = 0; i < count; i += 1) {
    const q = session.quiz.questions[session.index];
    if (q === undefined) break;
    session = submitAnswer(selectOption(session, pick(rng, q.options).id));
    if (i < count - 1 || rng.next() < 0.5) session = next(session);
  }
  return session;
}

function randomJunk(rng: Rng, depth = 0): unknown {
  const r = rng.next();
  if (depth > 3 || r < 0.4) {
    return pick(rng, [
      null,
      true,
      0,
      -1,
      1.5,
      2 ** 32,
      "",
      "x",
      "__proto__",
      1,
      "1",
      "normal",
      "mixed",
    ]);
  }
  if (r < 0.7) {
    return Array.from({ length: int(rng, 4) }, () =>
      randomJunk(rng, depth + 1),
    );
  }
  const keys = [
    "schemaVersion",
    "scores",
    "q",
    "o",
    "kind",
    "topicId",
    "percent",
    "correct",
    "total",
    "at",
    "__proto__",
    "mixed",
  ];
  const out: Record<string, unknown> = {};
  for (let i = int(rng, 5); i > 0; i -= 1) {
    out[pick(rng, keys)] = randomJunk(rng, depth + 1);
  }
  return out;
}

type Mutation = (s: SavedSession, rng: Rng) => string;
const enc = (s: unknown) => JSON.stringify(s);
const withQuestion = (
  s: SavedSession,
  i: number,
  id: string,
): SavedSession => ({
  ...s,
  questionIds: s.questionIds.map((q, j) => (j === i ? id : q)),
  answers: s.answers.map((a, j) => (j === i ? { ...a, q: id } : a)),
});

/** Each mutation yields an input that must be rejected. */
const mutations: Record<string, Mutation> = {
  truncatedJson: (s, rng) => {
    const raw = encodeSession(s);
    return raw.slice(0, int(rng, raw.length));
  },
  garbledJson: (s, rng) => {
    const raw = encodeSession(s);
    const at = int(rng, raw.length);
    return `${raw.slice(0, at)}{,"${raw.slice(at)}`;
  },
  oversized: (s) => encodeSession(s).padEnd(MAX_VALUE_LENGTH + 1, " "),
  unknownVersion: (s, rng) => enc({ ...s, schemaVersion: 2 + int(rng, 100) }),
  badVersionType: (s, rng) =>
    enc({ ...s, schemaVersion: pick(rng, ["1", 1.5, null, -1, [1], {}]) }),
  wrongFieldType: (s, rng) => {
    const key = pick(
      rng,
      Object.keys(s).filter((k) => k !== "schemaVersion"),
    );
    const wrong: Record<string, unknown[]> = {
      contentVersion: [1, null, "", {}],
      mode: ["retry", 1, null],
      scope: ["mixed", null, { kind: "topic" }, { kind: 1 }, []],
      seed: ["1", -1, 0.5, 2 ** 32, null],
      questionIds: [null, "a", [1], {}],
      optionOrder: [null, [], ["a"], [[1, 2]]],
      answers: [null, "x", [{ q: 1 }], {}],
      index: ["0", -1, 0.5, null],
      savedAt: ["2026-10-23", -1, 1.5, null],
    };
    return enc({ ...s, [key]: pick(rng, wrong[key] ?? [null]) });
  },
  missingField: (s, rng) => {
    const drop = pick(rng, Object.keys(s));
    return enc(
      Object.fromEntries(Object.entries(s).filter(([k]) => k !== drop)),
    );
  },
  staleQuestionId: (s, rng) =>
    encodeSession(withQuestion(s, int(rng, s.questionIds.length), "gone-1")),
  staleOptionId: (s, rng) => {
    const i = int(rng, s.optionOrder.length);
    const j = int(rng, s.optionOrder[i]?.length ?? 0);
    return encodeSession({
      ...s,
      optionOrder: s.optionOrder.map((o, k) =>
        k === i ? o.map((id, m) => (m === j ? "gone-opt" : id)) : o,
      ),
    });
  },
  reorderedOptions: (s, rng) => {
    const i = int(rng, s.optionOrder.length);
    return encodeSession({
      ...s,
      optionOrder: s.optionOrder.map((o, k) => {
        if (k !== i) return o;
        const swapped = [...o];
        const a = int(rng, o.length);
        const b = (a + 1 + int(rng, o.length - 1)) % o.length;
        [swapped[a], swapped[b]] = [swapped[b] ?? "", swapped[a] ?? ""];
        return swapped;
      }),
    });
  },
  swappedOptionSets: (s) =>
    s.questionIds.length < 2
      ? encodeSession({ ...s, optionOrder: [] })
      : encodeSession({
          ...s,
          optionOrder: [...s.optionOrder.slice(1), s.optionOrder[0] ?? []],
          answers: [],
          index: 0,
        }),
  indexOutOfRange: (s, rng) =>
    encodeSession({ ...s, index: s.questionIds.length + int(rng, 5) }),
  answersInconsistent: (s, rng) =>
    encodeSession(
      rng.next() < 0.5
        ? { ...s, answers: [...s.answers, ...s.answers, { q: "x", o: "y" }] }
        : { ...s, index: s.answers.length + 1 + int(rng, 3) },
    ),
  answerUnknownOption: (s) =>
    encodeSession({
      ...s,
      answers: [{ q: s.questionIds[0] ?? "", o: "nope" }],
      index: 0,
    }),
  duplicatedQuestionId: (s) =>
    encodeSession({
      ...s,
      questionIds: [...s.questionIds, s.questionIds[0] ?? ""],
      optionOrder: [...s.optionOrder, s.optionOrder[0] ?? []],
    }),
  duplicatedOptionId: (s, rng) => {
    const i = int(rng, s.optionOrder.length);
    return encodeSession({
      ...s,
      optionOrder: s.optionOrder.map((o, k) =>
        k === i ? o.map(() => o[0] ?? "") : o,
      ),
    });
  },
  protoScope: (s) =>
    encodeSession(s).replace(
      /"scope":\{[^}]*\}/,
      '"scope":{"__proto__":{"kind":"mixed"}}',
    ),
  protoAnswer: (s) =>
    encodeSession({ ...s, answers: [], index: 0 }).replace(
      '"answers":[]',
      `"answers":[{"__proto__":{"q":"${s.questionIds[0] ?? ""}","o":"a"}}]`,
    ),
  topicGone: (s) =>
    encodeSession({ ...s, scope: { kind: "topic", topicId: "zz" } }),
  contentChangedAndOptionSetDiffers: (s, rng) => {
    const i = int(rng, s.optionOrder.length);
    return encodeSession({
      ...s,
      contentVersion: "cv-old",
      optionOrder: s.optionOrder.map((o, k) => (k === i ? o.slice(1) : o)),
      answers: s.answers.filter((_, k) => k < i),
      index: Math.min(i, s.index),
    });
  },
};

/** Full validity of a restored session against `bank`. */
function expectFullyValid(session: QuizSession): void {
  const byId = new Map(bank.questions.map((q) => [q.id, q]));
  const n = session.quiz.questions.length;
  expect(n).toBeGreaterThan(0);
  expect(new Set(session.quiz.questions.map((q) => q.id)).size).toBe(n);
  for (const q of session.quiz.questions) {
    const b = byId.get(q.id);
    expect(b).toBeDefined();
    expect(q.options.map((o) => o.id).sort()).toEqual(
      b?.options.map((o) => o.id).sort(),
    );
    expect(q.correctOptionId).toBe(b?.correct);
  }
  expect(session.index).toBeGreaterThanOrEqual(0);
  expect(session.index).toBeLessThan(n);
  session.answers.forEach((a, i) => {
    const q = session.quiz.questions[i];
    expect(a.questionId).toBe(q?.id);
    expect(a.correct).toBe(a.optionId === q?.correctOptionId);
  });
  if (session.phase === "answering") {
    expect(session.answers).toHaveLength(session.index);
    expect(session.selected).toBeNull();
  } else {
    expect(session.phase).toBe("feedback");
    expect(session.answers).toHaveLength(session.index + 1);
    expect(session.selected).toBe(session.answers[session.index]?.optionId);
  }
}

function decodeAndRestore(raw: string) {
  const decoded = decodeSession(raw);
  return decoded.ok ? restoreQuiz(bank, decoded.value) : decoded;
}

describe("V-6 codec fuzz", () => {
  it(`rejects ${String(ITERATIONS)} mutated sessions with a tagged failure`, () => {
    const rng = createSeededRng(0x7e41);
    const names = Object.keys(mutations);
    const seen = new Map<string, number>();
    for (let i = 0; i < ITERATIONS; i += 1) {
      const saved = toSavedSession(randomSession(rng), 1_761_200_000_000);
      const name = names[i % names.length] ?? "";
      const raw = mutations[name]?.(saved, rng) ?? "";
      let result: ReturnType<typeof decodeAndRestore> | undefined;
      expect(() => (result = decodeAndRestore(raw)), name).not.toThrow();
      expect(result?.ok, `${name}: ${raw.slice(0, 200)}`).toBe(false);
      if (result !== undefined && !result.ok) {
        const key = `${name}:${result.reason}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
    }
    // Each mutation family was exercised.
    for (const name of names) {
      expect([...seen.keys()].some((k) => k.startsWith(`${name}:`))).toBe(true);
    }
    expect(seen.get("oversized:too-large")).toBeGreaterThan(0);
    expect(seen.get("unknownVersion:unknown-version")).toBeGreaterThan(0);
    expect(seen.get("staleQuestionId:stale")).toBeGreaterThan(0);
  });

  it("restores every unmutated random session exactly", () => {
    const rng = createSeededRng(41);
    for (let i = 0; i < 500; i += 1) {
      const session = randomSession(rng);
      const result = decodeAndRestore(
        encodeSession(toSavedSession(session, i)),
      );
      expect(result).toEqual({ ok: true, session, contentChanged: false });
    }
  });

  it("never throws on random junk and never accepts a partially valid value", () => {
    const rng = createSeededRng(0xbad);
    for (let i = 0; i < ITERATIONS; i += 1) {
      const junk = randomJunk(rng);
      const variants = [
        JSON.stringify(junk),
        JSON.stringify({ schemaVersion: 1, scores: junk }),
        JSON.stringify({
          ...toSavedSession(randomSession(rng), 1),
          [pick(rng, [
            "answers",
            "optionOrder",
            "questionIds",
            "scope",
            "index",
          ])]: junk,
        }),
      ];
      for (const raw of variants) {
        expect(() => decodeBest(raw)).not.toThrow();
        const best = decodeBest(raw);
        if (best.ok) {
          for (const [key, s] of Object.entries(best.value.scores)) {
            expect(key).not.toBe("__proto__");
            expect(
              Number.isInteger(s.percent) && s.percent >= 0 && s.percent <= 100,
            ).toBe(true);
            expect(s.correct).toBeLessThanOrEqual(s.total);
          }
          expect(decodeBest(encodeBest(best.value))).toEqual(best);
        }
        let result: ReturnType<typeof decodeAndRestore> | undefined;
        expect(() => (result = decodeAndRestore(raw))).not.toThrow();
        if (result?.ok === true) expectFullyValid(result.session);
      }
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("never throws on random byte strings", () => {
    const rng = createSeededRng(7);
    const alphabet = '{}[]":,0123456789.-eE truefalsnul\\u_proto';
    for (let i = 0; i < ITERATIONS; i += 1) {
      const raw = Array.from({ length: int(rng, 80) }, () =>
        pick(rng, Array.from(alphabet)),
      ).join("");
      expect(() => decodeBest(raw)).not.toThrow();
      expect(() => decodeAndRestore(raw)).not.toThrow();
    }
  });
});
