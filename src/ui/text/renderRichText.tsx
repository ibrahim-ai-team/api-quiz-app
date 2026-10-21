import type { ReactNode } from "react";
import { strings } from "../strings";
import styles from "./RichText.module.css";

/**
 * Safe renderer for the content formatting subset (FR-7, G10, standard 5).
 *
 * Supported, and nothing else:
 * - paragraphs separated by one or more blank lines;
 * - inline code between single backticks;
 * - fenced code blocks opened by a line starting with ``` (an optional
 *   language tag is ignored) and closed by a line that is exactly ```.
 *
 * Everything else, including HTML tags, markdown links and `javascript:` URLs,
 * stays literal text. Output is React elements (`p`, `code`, `pre`) whose
 * children are plain strings, so React escapes them (V-1, T1). There is no
 * HTML parsing, no markdown library and no raw-HTML injection. Malformed
 * markup (an unterminated fence, an unmatched backtick) renders literally;
 * the function never throws for any string input.
 */

export interface RichTextOptions {
  /**
   * Accessible name for code block `index` (1-based) of `count` blocks in this
   * text. Defaults to `strings.codeLabel` (copy:question.codeLabel).
   */
  codeLabel?: (index: number, count: number) => string;
}

type Inline = { kind: "text"; text: string } | { kind: "code"; text: string };

type Block =
  { kind: "paragraph"; inlines: Inline[] } | { kind: "code"; text: string };

const FENCE = "```";

function isFenceOpen(line: string): boolean {
  const trimmed = line.trimStart();
  // A backtick in the info string means this is not a fence (CommonMark rule),
  // so a one-line "```x```" stays paragraph text.
  return (
    trimmed.startsWith(FENCE) && !trimmed.slice(FENCE.length).includes("`")
  );
}

function isFenceClose(line: string): boolean {
  return line.trim() === FENCE;
}

/** Index of the next backtick that is not part of a longer run, or -1. */
function findSingleBacktick(text: string, from: number): number {
  let i = text.indexOf("`", from);
  while (i !== -1) {
    let end = i;
    while (text[end] === "`") end += 1;
    if (end - i === 1) return i;
    i = text.indexOf("`", end);
  }
  return -1;
}

/** Splits paragraph text into literal text and single-backtick code spans. */
function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let literal = "";
  let i = 0;

  const flush = () => {
    if (literal !== "") {
      out.push({ kind: "text", text: literal });
      literal = "";
    }
  };

  while (i < text.length) {
    const open = text.indexOf("`", i);
    if (open === -1) {
      literal += text.slice(i);
      break;
    }
    literal += text.slice(i, open);

    let runEnd = open;
    while (text[runEnd] === "`") runEnd += 1;

    if (runEnd - open === 1) {
      const close = findSingleBacktick(text, runEnd);
      if (close !== -1) {
        flush();
        out.push({ kind: "code", text: text.slice(open + 1, close) });
        i = close + 1;
        continue;
      }
    }

    // A backtick run that is not a complete single-backtick span is literal.
    literal += text.slice(open, runEnd);
    i = runEnd;
  }

  flush();
  return out;
}

/** Splits text into paragraph and fenced code blocks. */
function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({
        kind: "paragraph",
        inlines: parseInline(paragraph.join("\n")),
      });
      paragraph = [];
    }
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";

    if (isFenceOpen(line)) {
      let close = -1;
      for (let j = i + 1; j < lines.length; j += 1) {
        if (isFenceClose(lines[j] ?? "")) {
          close = j;
          break;
        }
      }
      if (close !== -1) {
        flushParagraph();
        blocks.push({
          kind: "code",
          text: lines.slice(i + 1, close).join("\n"),
        });
        i = close + 1;
        continue;
      }
      // Unterminated fence: fall through and keep the line as literal text.
    }

    if (line.trim() === "") {
      flushParagraph();
    } else {
      paragraph.push(line);
    }
    i += 1;
  }

  flushParagraph();
  return blocks;
}

function renderInlines(inlines: Inline[]): ReactNode[] {
  return inlines.map((inline, index) =>
    inline.kind === "code" ? (
      <code key={index} className={styles.inlineCode}>
        {inline.text}
      </code>
    ) : (
      inline.text
    ),
  );
}

/**
 * Renders `text` with the FR-7 subset. Returns React elements only; never
 * HTML strings.
 */
export function renderRichText(
  text: string,
  opts: RichTextOptions = {},
): ReactNode {
  const codeLabel = opts.codeLabel ?? strings.codeLabel;
  const blocks = parseBlocks(text);
  const codeCount = blocks.filter((block) => block.kind === "code").length;
  let codeIndex = 0;

  return blocks.map((block, index) => {
    if (block.kind === "paragraph") {
      return (
        <p key={index} className={styles.paragraph}>
          {renderInlines(block.inlines)}
        </p>
      );
    }
    codeIndex += 1;
    return (
      // The box scrolls horizontally, so it must be keyboard focusable
      // (WCAG 2.1.1, axe scrollable-region-focusable) and named (US-2.6,
      // docs/design/views.md code box spec).
      <pre
        key={index}
        className={styles.codeBlock}
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable region must be focusable
        tabIndex={0}
        role="region"
        aria-label={codeLabel(codeIndex, codeCount)}
      >
        <code>{block.text}</code>
      </pre>
    );
  });
}
