// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { strings } from "../strings";
import { ExternalLink, safeHttpsHref } from "./ExternalLink";

afterEach(cleanup);

describe("T-US3-2 V-2 safeHttpsHref", () => {
  it.each([
    ["javascript:", "javascript:alert(1)"],
    ["upper-case JAVASCRIPT:", "JAVASCRIPT:alert(1)"],
    ["leading space before javascript:", "  javascript:alert(1)"],
    ["leading control characters", "\u0000\u001fjavascript:alert(1)"],
    ["tab and newline inside the scheme", "java\tscr\nipt:alert(1)"],
    ["data:", "data:text/html,<script>alert(1)</script>"],
    ["http:", "http://www.rfc-editor.org/rfc/rfc9110.html"],
    ["https with username and password", "https://user:pass@example.com/"],
    ["https with username only", "https://user@example.com/"],
    ["protocol-relative", "//example.com/"],
    ["relative path", "/rfc9110.html"],
    ["malformed", "https://"],
    ["empty", ""],
  ])("rejects %s", (_name, input) => {
    expect(safeHttpsHref(input)).toBe(null);
  });

  it("accepts https and returns the re-serialised href", () => {
    expect(
      safeHttpsHref("https://www.rfc-editor.org/rfc/rfc9110.html#section-9"),
    ).toBe("https://www.rfc-editor.org/rfc/rfc9110.html#section-9");
    expect(safeHttpsHref("HTTPS://Example.COM")).toBe("https://example.com/");
  });

  it.each([
    ["trailing space and NUL", "https://example.com/ \u0000"],
    ["backslashes after the scheme", "https:\\\\example.com"],
  ])("re-serialises %s to a clean https href (SEC L-2)", (_name, input) => {
    expect(safeHttpsHref(input)).toBe("https://example.com/");
  });

  it("strips leading whitespace and control characters from an https href", () => {
    expect(safeHttpsHref(" \u0001https://example.com/a b")).toBe(
      "https://example.com/a%20b",
    );
  });
});

describe("T-US3-2 ExternalLink", () => {
  it("renders an https link in a new tab with rel and the visible cue in its name", () => {
    render(
      <ExternalLink href="https://example.com/x">example.com</ExternalLink>,
    );
    const link = screen.getByRole("link", {
      name: `example.com ${strings.common.newTabCue}`,
    });
    expect(link.getAttribute("href")).toBe("https://example.com/x");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.textContent).toContain(strings.common.newTabCue);
    const icon = link.querySelector("svg");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });

  it.each([
    "javascript:alert(1)",
    "http://example.com/",
    "https://u:p@x.test/",
  ])("renders %s as plain text with no link", (href) => {
    const { container } = render(
      <ExternalLink href={href} fallback={`Source: ${href}`}>
        host
      </ExternalLink>,
    );
    expect(container.querySelector("a")).toBe(null);
    expect(container.textContent).toBe(`Source: ${href}`);
  });

  it("falls back to the children as text when no fallback is given", () => {
    const { container } = render(
      <ExternalLink href="data:text/plain,x">Report</ExternalLink>,
    );
    expect(container.querySelector("a")).toBe(null);
    expect(container.textContent).toBe("Report");
  });
});
