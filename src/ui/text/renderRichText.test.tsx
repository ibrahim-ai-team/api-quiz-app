// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import styles from "./RichText.module.css";
import { renderInlineText, renderRichText } from "./renderRichText";

const BLOCK_TAGS = new Set(["P", "CODE", "PRE"]);
const INLINE_TAGS = new Set(["CODE"]);
// Vitest exposes unprocessed CSS Modules as a proxy, so list the keys.
const MODULE_CLASSES = new Set([
  styles.paragraph,
  styles.inlineCode,
  styles.codeBlock,
]);

function renderText(text: string) {
  return render(<div data-testid="host">{renderRichText(text)}</div>);
}

function renderInline(text: string) {
  return render(<div data-testid="host">{renderInlineText(text)}</div>);
}

function host(): HTMLElement {
  return screen.getByTestId("host");
}

/** Every element rendered inside the host, excluding the host itself. */
function renderedElements(): Element[] {
  return Array.from(host().querySelectorAll("*"));
}

function expectOnlySafeMarkup(allowedTags: Set<string> = BLOCK_TAGS) {
  for (const element of renderedElements()) {
    expect(allowedTags.has(element.tagName)).toBe(true);
    for (const attribute of Array.from(element.attributes)) {
      expect(attribute.name.toLowerCase().startsWith("on")).toBe(false);
      expect(attribute.name.toLowerCase()).not.toMatch(/^(href|src|srcdoc)$/);
    }
    // SEC I-4: classes come only from the CSS Module, never from content.
    for (const className of Array.from(element.classList)) {
      expect(MODULE_CLASSES.has(className)).toBe(true);
    }
  }
  expect(host().querySelector("script, img, a, iframe, svg, style")).toBeNull();
}

afterEach(() => {
  cleanup();
});

describe("renderRichText paragraphs and inline code (FR-7)", () => {
  it("splits paragraphs on blank lines and keeps single newlines inside one", () => {
    renderText("First line\nstill first.\n\n\nSecond paragraph.");
    const paragraphs = host().querySelectorAll("p");
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]?.textContent).toBe("First line\nstill first.");
    expect(paragraphs[1]?.textContent).toBe("Second paragraph.");
    expectOnlySafeMarkup();
  });

  it("renders single-backtick spans as inline code", () => {
    renderText("Use `GET /users` then `204`.");
    const paragraph = host().querySelector("p");
    const codes = host().querySelectorAll("p > code");
    expect(codes).toHaveLength(2);
    expect(codes[0]?.textContent).toBe("GET /users");
    expect(codes[1]?.textContent).toBe("204");
    expect(paragraph?.textContent).toBe("Use GET /users then 204.");
    expect(codes[0]?.className).toMatch(/inlineCode/);
    expect(host().querySelector("pre")).toBeNull();
  });

  it("renders empty and whitespace-only input as nothing", () => {
    renderText("");
    expect(renderedElements()).toHaveLength(0);
    cleanup();
    renderText(" \n\n \t\n");
    expect(renderedElements()).toHaveLength(0);
  });

  it("normalises CRLF line endings", () => {
    renderText("One\r\n\r\nTwo\r\n```\r\nx: 1\r\n```");
    expect(host().querySelectorAll("p")).toHaveLength(2);
    expect(host().querySelector("pre code")?.textContent).toBe("x: 1");
  });

  it("preserves whitespace inside inline code", () => {
    renderText("Header `  Content-Type:  json  ` end");
    expect(host().querySelector("code")?.textContent).toBe(
      "  Content-Type:  json  ",
    );
  });
});

describe("T-US2-6 code block box", () => {
  const snippet =
    'HTTP/1.1 200 OK\nContent-Type: application/json\n\n{\n  "id": 1,   "name": "a very long value that is wider than a 320 px viewport"\n}';

  it("renders a fenced block in a focusable, labelled region with exact content", () => {
    renderText(
      `Look at this:\n\n\`\`\`http\n${snippet}\n\`\`\`\n\nWhat is the status?`,
    );
    const region = screen.getByRole("region", { name: "Code example" });
    expect(region.tagName).toBe("PRE");
    expect(region.tabIndex).toBe(0);
    expect(region.getAttribute("tabindex")).toBe("0");
    expect(region.className).toMatch(/codeBlock/);
    const code = region.querySelector("code");
    expect(code?.textContent).toBe(snippet);
    // The language tag is ignored, not rendered.
    expect(host().textContent).toBe(
      `Look at this:${snippet}What is the status?`,
    );
    const paragraphs = host().querySelectorAll("p");
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]?.textContent).toBe("Look at this:");
    expect(paragraphs[1]?.textContent).toBe("What is the status?");
    expectOnlySafeMarkup();
  });

  it("does not parse inline code or markup inside a fenced block", () => {
    renderText("```\nconst a = `x`;\n<b>bold</b>\n\n  indented\n```");
    const code = host().querySelector("pre > code");
    expect(code?.textContent).toBe("const a = `x`;\n<b>bold</b>\n\n  indented");
    expect(code?.children).toHaveLength(0);
  });

  it("numbers labels when there is more than one block", () => {
    renderText("```\none\n```\n\nBetween\n\n```\ntwo\n```");
    const regions = screen.getAllByRole("region");
    expect(regions.map((r) => r.getAttribute("aria-label"))).toEqual([
      "Code example 1 of 2",
      "Code example 2 of 2",
    ]);
  });

  it("uses a caller-provided label", () => {
    render(
      <div data-testid="host">
        {renderRichText("```\nx\n```", {
          codeLabel: (i, n) => `Snippet ${String(i)}/${String(n)}`,
        })}
      </div>,
    );
    expect(screen.getByRole("region", { name: "Snippet 1/1" })).toBeTruthy();
  });

  it("is reachable with Tab", async () => {
    const user = userEvent.setup();
    renderText("Intro\n\n```\nGET / HTTP/1.1\n```");
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole("region", { name: "Code example" }),
    );
  });

  it("renders nothing for an empty or whitespace-only fenced block", () => {
    renderText("Before\n\n```\n```\n\n```js\n   \n\n```\n\nAfter");
    expect(host().querySelector("pre")).toBeNull();
    expect(Array.from(host().children).map((el) => el.tagName)).toEqual([
      "P",
      "P",
    ]);
    expect(host().textContent).toBe("BeforeAfter");
    cleanup();
    // Skipped blocks do not count towards the numbered label.
    renderText("```\n```\n\n```\nx\n```");
    expect(
      screen.getAllByRole("region").map((r) => r.getAttribute("aria-label")),
    ).toEqual(["Code example"]);
  });

  it("allows leading whitespace on the opener and surrounding whitespace on the closer", () => {
    renderText("  ```yaml\na: 1\n \t```  ");
    expect(host().querySelector("pre > code")?.textContent).toBe("a: 1");
  });

  it("closes a paragraph when a fence starts without a blank line", () => {
    renderText("Before\n```\ncode\n```\nAfter");
    const children = Array.from(host().children).map((el) => el.tagName);
    expect(children).toEqual(["P", "PRE", "P"]);
  });
});

describe("T-US2-6 malformed markup renders literally and never throws", () => {
  it("keeps an unterminated fence as literal text", () => {
    const input = "Start\n\n```js\nconst x = 1;\nno closing fence";
    renderText(input);
    expect(host().querySelector("pre")).toBeNull();
    expect(host().textContent).toBe(
      "Start```js\nconst x = 1;\nno closing fence",
    );
  });

  it("keeps an unmatched backtick as literal text", () => {
    renderText("Use `x` but this ` has no partner");
    const codes = host().querySelectorAll("code");
    expect(codes).toHaveLength(1);
    expect(codes[0]?.textContent).toBe("x");
    expect(host().textContent).toBe("Use x but this ` has no partner");
    cleanup();
    renderText("Costs `5 dollars");
    expect(host().querySelector("code")).toBeNull();
    expect(host().textContent).toBe("Costs `5 dollars");
  });

  it("keeps a lone backtick and double backticks literal", () => {
    renderText("a ` b `` c ``` d");
    expect(host().querySelector("code")).toBeNull();
    expect(host().textContent).toBe("a ` b `` c ``` d");
  });

  it("keeps a one-line ```x``` literal", () => {
    renderText("```x```");
    expect(host().querySelector("pre, code")).toBeNull();
    expect(host().textContent).toBe("```x```");
  });
});

describe("T-US2-7 / V-1 payloads render as literal text", () => {
  const payloads = [
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    "[x](javascript:alert(1))",
    "javascript:alert(1)",
    '<a href="javascript:alert(1)">click</a>',
    "<svg onload=alert(1)>",
    '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
    "<style>body{display:none}</style>",
  ];

  for (const payload of payloads) {
    it(`paragraph: ${payload}`, () => {
      renderText(payload);
      expect(host().textContent).toBe(payload);
      expect(host().querySelectorAll("p")).toHaveLength(1);
      expectOnlySafeMarkup();
    });

    it(`inline code: ${payload}`, () => {
      renderText(`See \`${payload}\` here`);
      expect(host().querySelector("p > code")?.textContent).toBe(payload);
      expectOnlySafeMarkup();
    });

    it(`code block: ${payload}`, () => {
      renderText(`\`\`\`html\n${payload}\n\`\`\``);
      expect(host().querySelector("pre > code")?.textContent).toBe(payload);
      expectOnlySafeMarkup();
    });
  }

  it("renders all payloads together without creating elements", () => {
    const text = payloads.join("\n\n");
    renderText(text);
    expect(host().querySelectorAll("p")).toHaveLength(payloads.length);
    for (const payload of payloads) {
      expect(host().textContent).toContain(payload);
    }
    expect(host().querySelector("a[href^='javascript']")).toBeNull();
    expectOnlySafeMarkup();
  });
});

describe("V-1 fuzz-style inputs: no throw, only allowed tags", () => {
  const tricky = [
    "",
    "`",
    "``",
    "```",
    "````",
    "```\n",
    "\n```",
    "```\n```",
    "```\n\n```",
    "``` \n```",
    "   ```\ncode\n   ```   ",
    "```js\n```js\n```",
    "``a``",
    "`a\n\nb`",
    "\\`not code\\`",
    "\u0000\u0001\u001f",
    String.fromCharCode(0x202e, 0x200b, 0xfeff),
    "😀`😀`😀",
    "\r",
    "\r\r\n\n\r",
    "<",
    "</p><p>",
    "<![CDATA[x]]>",
    "<!-- comment -->",
    "&lt;script&gt;&amp;",
    "{{constructor.constructor('alert(1)')()}}",
    "${alert(1)}",
    "data:text/html,<script>alert(1)</script>",
    "<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>",
    "`<img src=x onerror=alert(1)>`\n```\n<script>alert(1)</script>",
    "**bold** _em_ # heading\n- list\n> quote\n[link](https://example.com)",
    "a".repeat(20000),
    "`".repeat(5001),
    "```\n".repeat(301),
    "`x` ".repeat(2000),
    "```x\n".repeat(20000),
    "```a\n".repeat(5000),
    "` ``".repeat(10000),
  ];

  tricky.forEach((input, index) => {
    it(`input #${String(index)} renders safely`, () => {
      expect(() => renderText(input)).not.toThrow();
      expectOnlySafeMarkup();
    });

    it(`input #${String(index)} renders safely inline (CODE only)`, () => {
      expect(() => renderInline(input)).not.toThrow();
      expectOnlySafeMarkup(INLINE_TAGS);
    });
  });

  // T-10-R01 M2 / SEC L-1: many unterminated openers must not rescan the input.
  it.each([
    ["```x\n".repeat(20000)],
    ["```a\n".repeat(5000)],
    ["` ``".repeat(10000)],
  ])("parses pathological input in linear time (%#)", (input) => {
    const start = performance.now();
    const blocks = renderRichText(input);
    const inline = renderInlineText(input);
    expect(performance.now() - start).toBeLessThan(1000);
    expect(Array.isArray(blocks) && Array.isArray(inline)).toBe(true);
  });

  it("does not lose non-whitespace characters outside code fences", () => {
    for (const input of tricky) {
      if (input.includes("`")) continue;
      renderText(input);
      const strip = (s: string) => s.replace(/\s/g, "");
      expect(strip(host().textContent)).toBe(strip(input));
      cleanup();
    }
  });
});

describe("renderInlineText (inline-only, for labels)", () => {
  it("renders text and inline code without block elements", () => {
    renderInline("Returns `201 Created` with a\n\nLocation header");
    expect(host().querySelector("p, pre")).toBeNull();
    expect(host().querySelector("code")?.textContent).toBe("201 Created");
    expect(host().textContent).toBe(
      "Returns 201 Created with a\n\nLocation header",
    );
    expectOnlySafeMarkup(INLINE_TAGS);
  });

  it("keeps fences literal", () => {
    renderInline("```js\nx\n```");
    expect(host().querySelector("pre, code")).toBeNull();
    expect(host().textContent).toBe("```js\nx\n```");
  });

  it("normalises CRLF and preserves whitespace inside inline code", () => {
    renderInline("a\r\nb ` x  y `");
    expect(host().textContent).toBe("a\nb  x  y ");
    expect(host().querySelector("code")?.textContent).toBe(" x  y ");
  });
});

describe("T-US2-7 / V-1 payloads render literally via renderInlineText", () => {
  const payloads = [
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    "[x](javascript:alert(1))",
    "javascript:alert(1)",
    '<a href="javascript:alert(1)">click</a>',
    "<svg onload=alert(1)>",
    '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
    "<style>body{display:none}</style>",
  ];

  for (const payload of payloads) {
    it(`text: ${payload}`, () => {
      renderInline(payload);
      expect(host().textContent).toBe(payload);
      expect(renderedElements()).toHaveLength(0);
    });

    it(`inline code: ${payload}`, () => {
      renderInline(`See \`${payload}\` here`);
      expect(host().querySelector("code")?.textContent).toBe(payload);
      expectOnlySafeMarkup(INLINE_TAGS);
    });
  }
});
