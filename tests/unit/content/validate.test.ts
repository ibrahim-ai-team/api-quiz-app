/**
 * T-US7-1, T-US7-2, T-US7-3: one failing fixture per FR-21/FR-22 rule. Each
 * case asserts the exact file, question ID and field of every error.
 */
import { describe, expect, it } from "vitest";
import {
  formatIssue,
  validateContent,
} from "../../../scripts/content/validate.ts";
import {
  QUESTION_FILE,
  compareLocations,
  fixtureText,
  locations,
  questionFile,
  validQuestion,
  validateFiles,
  vfx,
} from "./helpers.ts";

const at = (questionId: string, field: string, file = QUESTION_FILE): string =>
  `${file} ${questionId} ${field}`;

describe("valid fixtures", () => {
  it.each([
    "valid-minimal.json",
    "valid-true-false.json",
    "valid-reviewed-4-options.json",
  ])("%s passes with no errors", (name) => {
    const result = validateFiles([vfx(name)]);
    expect(result.errors).toEqual([]);
    expect(result.questions).toHaveLength(1);
  });

  it("a draft may omit reviewedBy and an empty reviewedBy is ignored", () => {
    const result = validateFiles([
      questionFile([{ ...validQuestion(), reviewedBy: "" }]),
    ]);
    expect(result.errors).toEqual([]);
  });
});

describe("T-US7-1: every required field is enforced", () => {
  it.each([
    "id",
    "topic",
    "difficulty",
    "type",
    "prompt",
    "options",
    "correct",
    "explanation",
    "sourceUrl",
    "reviewStatus",
  ])("missing %s fails naming that field", (field) => {
    // Remove one key from the parsed valid fixture.
    const question = Object.fromEntries(
      Object.entries(validQuestion()).filter(([key]) => key !== field),
    );
    const result = validateFiles([questionFile([question])]);
    const id = field === "id" ? "questions[0]" : "valid-question";
    expect(locations(result.errors)).toEqual([at(id, field)]);
  });
});

/** Single-file fixtures: [fixture, expected `questionId field` pairs]. */
const RULE_FIXTURES: [string, [string, string][]][] = [
  ["bad-id-slug.json", [["Bad_ID", "id"]]],
  ["bad-difficulty.json", [["valid-question", "difficulty"]]],
  ["bad-type.json", [["valid-question", "type"]]],
  ["empty-prompt.json", [["valid-question", "prompt"]]],
  // T-US7-2 boundaries
  ["single-choice-2-options.json", [["valid-question", "options"]]],
  [
    "single-choice-5-options.json",
    [
      ["valid-question", "options"],
      ["valid-question", "options[4].id"],
    ],
  ],
  ["single-choice-bad-option-id.json", [["valid-question", "options[2].id"]]],
  ["true-false-1-option.json", [["valid-question", "options"]]],
  [
    "true-false-3-options.json",
    [
      ["valid-question", "options"],
      ["valid-question", "options[2].id"],
    ],
  ],
  ["true-false-bad-id.json", [["valid-question", "options[0].id"]]],
  ["true-false-bad-text.json", [["valid-question", "options[0].text"]]],
  ["true-false-order.json", [["valid-question", "options"]]],
  // T-US7-3 duplicates and correct answer (F-2)
  ["duplicate-option-id.json", [["valid-question", "options[1].id"]]],
  ["duplicate-option-text.json", [["valid-question", "options[1].text"]]],
  ["correct-no-match.json", [["valid-question", "correct"]]],
  [
    "correct-ambiguous.json",
    [
      ["valid-question", "correct"],
      ["valid-question", "options[1].id"],
    ],
  ],
  ["correct-not-single.json", [["valid-question", "correct"]]],
  ["short-explanation.json", [["valid-question", "explanation"]]],
  ["source-url-http.json", [["valid-question", "sourceUrl"]]],
  ["source-url-malformed.json", [["valid-question", "sourceUrl"]]],
  ["reviewed-without-reviewer.json", [["valid-question", "reviewedBy"]]],
  ["unknown-key.json", [["valid-question", "hint"]]],
  ["unknown-option-key.json", [["valid-question", "options[0].isCorrect"]]],
  ["unknown-topic.json", [["valid-question", "topic"]]],
  ["topic-file-mismatch.json", [["valid-question", "topic"]]],
  ["retired-id.json", [["retired-question", "id"]]],
  ["wrong-schema-version.json", [["(file)", "schemaVersion"]]],
  ["unknown-file-key.json", [["(file)", "topic"]]],
  ["questions-not-array.json", [["(file)", "questions"]]],
  // T-32 M1: JSON.parse would silently keep the last of two `correct` keys.
  ["duplicate-key.json", [["(file)", "(json)"]]],
];

describe("T-US7-2 / T-US7-3: one failing fixture per rule", () => {
  it.each(RULE_FIXTURES)("vfx/%s", (name, expected) => {
    const result = validateFiles([vfx(name)]);
    expect(locations(result.errors)).toEqual(
      expected.map(([id, field]) => at(id, field)).sort(compareLocations),
    );
    expect(result.questions).toEqual([]);
  });
});

describe("specific messages", () => {
  it("non-https sourceUrl schemes are rejected (http, javascript, data, ftp, empty, credentials)", () => {
    for (const sourceUrl of [
      "http://example.com/",
      "javascript:alert(1)",
      "data:text/html,hi",
      "ftp://example.com/rfc.txt",
      "",
      "https://user:secret@example.com/",
    ]) {
      const result = validateFiles([
        questionFile([{ ...validQuestion(), sourceUrl }]),
      ]);
      expect(locations(result.errors), sourceUrl).toEqual([
        at("valid-question", "sourceUrl"),
      ]);
    }
  });

  it("names http as the wrong protocol and malformed URLs as invalid", () => {
    const [http] = validateFiles([vfx("source-url-http.json")]).errors;
    const [bad] = validateFiles([vfx("source-url-malformed.json")]).errors;
    expect(http?.message).toMatch(/must use https.*"http:"/);
    expect(bad?.message).toBe("must be a valid absolute URL");
  });

  it("reviewed with a blank reviewedBy fails", () => {
    const result = validateFiles([
      questionFile([
        { ...validQuestion(), reviewStatus: "reviewed", reviewedBy: "  " },
      ]),
    ]);
    expect(locations(result.errors)).toEqual([
      at("valid-question", "reviewedBy"),
    ]);
  });

  it("distinguishes a missing correct reference from an ambiguous one", () => {
    const [missing] = validateFiles([vfx("correct-no-match.json")]).errors;
    const ambiguous = validateFiles([vfx("correct-ambiguous.json")]).errors;
    expect(missing?.message).toBe('"d" does not reference an option id');
    expect(ambiguous.find((e) => e.field === "correct")?.message).toBe(
      'ambiguous: "a" matches 2 options',
    );
  });

  it("names credentials in an https sourceUrl", () => {
    const [error] = validateFiles([
      questionFile([
        { ...validQuestion(), sourceUrl: "https://user:secret@example.com/" },
      ]),
    ]).errors;
    expect(error?.message).toBe("must not contain credentials");
  });

  it("names the repeated key and its object for duplicate JSON keys", () => {
    const [error] = validateFiles([vfx("duplicate-key.json")]).errors;
    expect(error?.message).toBe(
      'duplicate key "correct" in questions[0] (JSON.parse would keep only the last value)',
    );
  });

  it("finds duplicate keys at the root and in nested objects", () => {
    const root = validateFiles([
      {
        path: QUESTION_FILE,
        text: '{"schemaVersion":1,"schemaVersion":1,"questions":[]}',
      },
    ]).errors;
    expect(locations(root)).toEqual([at("(file)", "(json)")]);
    expect(root[0]?.message).toContain('"schemaVersion" in (root)');
    const nested = validQuestion();
    const text = JSON.stringify({
      schemaVersion: 1,
      questions: [nested],
    }).replace(
      '{"id":"a","text":"Host"}',
      '{"id":"a","text":"Host","t\\u0065xt":"Accept"}',
    );
    const [option] = validateFiles([{ path: QUESTION_FILE, text }]).errors;
    expect(option?.message).toContain('"text" in questions[0].options[0]');
  });

  it("a missing schemaVersion fails at file level", () => {
    const result = validateFiles([
      { path: QUESTION_FILE, text: JSON.stringify({ questions: [] }) },
    ]);
    expect(locations(result.errors)).toEqual([at("(file)", "schemaVersion")]);
  });

  it("option text comparison collapses inner whitespace and ignores case", () => {
    const q = validQuestion();
    const result = validateFiles([
      questionFile([
        {
          ...q,
          options: [
            { id: "a", text: "Request header" },
            { id: "b", text: "request \t\n  HEADER" },
            { id: "c", text: "Referer" },
          ],
        },
      ]),
    ]);
    expect(locations(result.errors)).toEqual([
      at("valid-question", "options[1].text"),
    ]);
  });

  it("option text with leading or trailing whitespace is rejected", () => {
    for (const text of [" Host", "Host ", "Host\n", "\tHost"]) {
      const q = validQuestion();
      const result = validateFiles([
        questionFile([
          {
            ...q,
            options: [
              { id: "a", text },
              { id: "b", text: "Accept" },
              { id: "c", text: "Referer" },
            ],
          },
        ]),
      ]);
      expect(locations(result.errors), JSON.stringify(text)).toEqual([
        at("valid-question", "options[0].text"),
      ]);
      expect(result.errors[0]?.message).toBe(
        "must not have leading or trailing whitespace",
      );
    }
  });

  it("formats an issue as file › questionId › field: message", () => {
    const [error] = validateFiles([vfx("short-explanation.json")]).errors;
    expect(error && formatIssue(error)).toBe(
      `${QUESTION_FILE} › valid-question › explanation: must be at least 20 characters`,
    );
  });
});

describe("cross-file rules", () => {
  it("duplicate question id across files fails on the second file", () => {
    const other = "content/questions/status-codes.json";
    const result = validateFiles([
      vfx("valid-minimal.json"),
      vfx("duplicate-id-other-file.json", other),
    ]);
    expect(locations(result.errors)).toEqual([
      at("valid-question", "id", other),
    ]);
    expect(result.errors[0]?.message).toContain(QUESTION_FILE);
  });

  it("duplicate question id within one file fails", () => {
    const q = validQuestion();
    const result = validateFiles([questionFile([q, q])]);
    expect(locations(result.errors)).toEqual([at("valid-question", "id")]);
  });

  it("a valid duplicate after a schema-invalid first occurrence is caught", () => {
    const q = validQuestion();
    const result = validateFiles([
      questionFile([{ ...q, difficulty: "expert" }, q]),
    ]);
    expect(locations(result.errors)).toEqual([
      at("valid-question", "difficulty"),
      at("valid-question", "id"),
    ]);
    expect(result.errors.find((e) => e.field === "id")?.message).toContain(
      "duplicate question id",
    );
    expect(result.questions).toEqual([]);
  });

  it("a file whose name is not a topic id fails at file level", () => {
    const file = "content/questions/not-a-topic.json";
    const result = validateFiles([vfx("valid-minimal.json", file)]);
    expect(locations(result.errors)).toEqual([
      at("(file)", "(file name)", file),
      at("valid-question", "topic", file),
    ]);
  });

  it("one bad question does not hide errors in the next one", () => {
    const result = validateFiles([
      questionFile([
        { ...validQuestion(), difficulty: "expert" },
        { ...validQuestion(), id: "second-question", correct: "z" },
      ]),
    ]);
    expect(locations(result.errors)).toEqual([
      at("second-question", "correct"),
      at("valid-question", "difficulty"),
    ]);
  });
});

describe("malformed and missing files never throw", () => {
  it("malformed JSON in a question file is reported naming the file", () => {
    const source = {
      path: QUESTION_FILE,
      text: fixtureText("vfx/malformed-json.txt"),
    };
    let result: ReturnType<typeof validateFiles> | undefined;
    expect(() => {
      result = validateFiles([source]);
    }).not.toThrow();
    expect(locations(result?.errors ?? [])).toEqual([at("(file)", "(json)")]);
    expect(result?.errors[0]?.message).toMatch(/^malformed JSON: /);
  });

  it("malformed topics.json and a missing retired-ids.json are file errors", () => {
    const result = validateFiles([vfx("valid-minimal.json")], {
      topics: { path: "content/topics.json", text: "{ nope" },
      retiredIds: { path: "content/retired-ids.json", text: null },
    });
    expect(locations(result.errors)).toEqual([
      "content/retired-ids.json (file) (json)",
      "content/topics.json (file) (json)",
    ]);
  });

  it("topics.json rejects duplicate and non-slug topic ids", () => {
    const topics = {
      path: "content/topics.json",
      text: JSON.stringify({
        schemaVersion: 1,
        topics: [
          { id: "http-fundamentals", name: "A" },
          { id: "http-fundamentals", name: "B" },
        ],
      }),
    };
    const badSlug = {
      path: "content/topics.json",
      text: JSON.stringify({
        schemaVersion: 1,
        topics: [{ id: "Bad Topic", name: "X" }],
      }),
    };
    expect(locations(validateFiles([], { topics }).errors)).toEqual([
      "content/topics.json (file) topics[1].id",
    ]);
    expect(locations(validateFiles([], { topics: badSlug }).errors)).toEqual([
      "content/topics.json (file) topics[0].id",
    ]);
  });

  it("non-object JSON values are reported at (file) (root), not thrown", () => {
    for (const text of ["null", "42", '"text"', "[]"]) {
      const result = validateContent(
        {
          topics: { path: "t.json", text },
          retiredIds: { path: "r.json", text },
          questionFiles: [{ path: QUESTION_FILE, text }],
        },
        { release: false },
      );
      expect(locations(result.errors), text).toEqual([
        at("(file)", "(root)"),
        "r.json (file) (root)",
        "t.json (file) (root)",
      ]);
    }
  });
});
