import { describe, expect, it } from "vitest";
import {
  generalReportHref,
  questionReportHref,
  REPORT_BASE_URL,
} from "./reportLink";

function parse(href: string): { base: string; params: [string, string][] } {
  const url = new URL(href);
  return {
    base: `${url.origin}${url.pathname}`,
    params: [...url.searchParams.entries()],
  };
}

describe("T-US3-5 question report link", () => {
  it("carries only the template, title, question ID and contentVersion", () => {
    const { base, params } = parse(
      questionReportHref("http-get-safe", "abc123"),
    );
    expect(base).toBe(REPORT_BASE_URL);
    expect(params).toEqual([
      ["template", "question-report.yml"],
      ["title", "[Question] http-get-safe"],
      ["question-id", "http-get-safe"],
      ["content-version", "abc123"],
    ]);
  });

  it("encodes reserved characters so values cannot add or break parameters", () => {
    const href = questionReportHref("a&b=c #d+e/%f", "v?1&x=2");
    expect(href).not.toContain(" ");
    expect(href).not.toContain("#");
    expect(href).toContain("title=%5BQuestion%5D+a%26b%3Dc+%23d%2Be%2F%25f");
    const { params } = parse(href);
    expect(params).toEqual([
      ["template", "question-report.yml"],
      ["title", "[Question] a&b=c #d+e/%f"],
      ["question-id", "a&b=c #d+e/%f"],
      ["content-version", "v?1&x=2"],
    ]);
  });

  it("uses a configurable base URL and keeps it https", () => {
    const href = questionReportHref(
      "q",
      "v",
      "https://example.test/issues/new",
    );
    expect(href).toBe(
      "https://example.test/issues/new?template=question-report.yml&title=%5BQuestion%5D+q&question-id=q&content-version=v",
    );
    expect(new URL(questionReportHref("q", "v")).protocol).toBe("https:");
  });
});

describe("T-US12-1 general report link", () => {
  it("carries the template only: no question ID, no title, no version", () => {
    const { base, params } = parse(generalReportHref());
    expect(base).toBe(REPORT_BASE_URL);
    expect(params).toEqual([["template", "question-report.yml"]]);
  });
});
