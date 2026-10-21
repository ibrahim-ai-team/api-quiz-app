/**
 * All user-visible UI copy lives here (implementation standard 8, A12).
 */
export const strings = {
  appName: "ApiQuiz",
  appDescription:
    "Practise API interview questions and check your understanding.",
  documentTitle: "ApiQuiz",
  /** copy:question.codeLabel; numbered only when count > 1 (docs/design/copy.md). */
  codeLabel: (index: number, count: number): string =>
    count > 1
      ? `Code example ${String(index)} of ${String(count)}`
      : "Code example",
} as const;
