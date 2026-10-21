/**
 * "Report a problem" links (T-13, issue #33; US-3.5, US-12.1; views.md §1,
 * §3). The app sends nothing itself: it only links to GitHub's prefilled
 * new-issue page, which the user reviews and submits (or not).
 *
 * Privacy (US-3.5): a question report carries ONLY the question ID and the
 * bank `contentVersion`. Never add answers, scores, timings, device data or
 * anything about the user. The general report (Landing) carries neither.
 *
 * Issue form contract with T-22 (#40, `.github/ISSUE_TEMPLATE/question-report.yml`):
 * - template file name: `question-report.yml` (REPORT_TEMPLATE);
 * - input field `id: question-id` (REPORT_FIELD_QUESTION_ID);
 * - input field `id: content-version` (REPORT_FIELD_CONTENT_VERSION).
 * GitHub prefills an issue form field from a query parameter named after the
 * field `id`, so T-22 must use exactly these ids. Change both sides together.
 */

/** Configurable base: the public repository's new-issue page. */
export const REPORT_BASE_URL =
  "https://github.com/ibrahim-ai-team/api-quiz-app/issues/new";

export const REPORT_TEMPLATE = "question-report.yml";
export const REPORT_FIELD_QUESTION_ID = "question-id";
export const REPORT_FIELD_CONTENT_VERSION = "content-version";

/** Issue title for a question report (copy.md: reportLink.ts configuration). */
export function reportTitle(questionId: string): string {
  return `[Question] ${questionId}`;
}

function build(params: URLSearchParams, base: string): string {
  const url = new URL(base);
  url.search = params.toString();
  return url.href;
}

/** Report link for one question: template, title, question ID, contentVersion. */
export function questionReportHref(
  questionId: string,
  contentVersion: string,
  base: string = REPORT_BASE_URL,
): string {
  return build(
    new URLSearchParams([
      ["template", REPORT_TEMPLATE],
      ["title", reportTitle(questionId)],
      [REPORT_FIELD_QUESTION_ID, questionId],
      [REPORT_FIELD_CONTENT_VERSION, contentVersion],
    ]),
    base,
  );
}

/** General report link (Landing, US-12.1): the template only, no question. */
export function generalReportHref(base: string = REPORT_BASE_URL): string {
  return build(new URLSearchParams([["template", REPORT_TEMPLATE]]), base);
}
