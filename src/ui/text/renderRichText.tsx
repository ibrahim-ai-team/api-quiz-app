import type { ReactNode } from "react";
import { strings } from "../strings";
import styles from "./RichText.module.css";

/**
 * Safe renderer for the content formatting subset (FR-7, G10, standard 5).
 *
 * Supported, and nothing else:
 * - paragraphs separated by one or more blank (empty or whitespace-only)
 *   lines; single newlines stay inside the paragraph;
 * - inline code: a single backtick paired with the next single backtick
 *   (runs of 2 or more backticks are literal, as is an unpaired backtick);
 * - fenced code blocks: the opener is a line whose first non-whitespace
 *   characters are ``` (leading whitespace allowed), optionally followed by a
 *   language tag that contains no backtick and is ignored; the closer is the
 *   next line that is exactly ``` apart from surrounding whitespace. Block
 *   content is verbatim (no inline parsing). A fence whose content is empty or
 *   whitespace-only renders nothing. An opener without a closer stays literal
 *   paragraph text.
 *
 * Everything else, including HTML tags, markdown links and `javascript:` URLs,
 * stays literal text. Output is React elements (`p`, `code`, `pre`) whose
 * children are plain strings, so React escapes them (V-1, T1). There is no
 * HTML parsing, no markdown library and no raw-HTML injection. Parsing is
 * linear in the input length, and the functions never throw for any string.
 *
 * `renderInlineText` is the inline-only variant for places where block
 * elements are invalid (for example radio labels): it emits only text and
 * `code`, and treats fences and blank lines as literal text.
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

function normaliseNewlines(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

/** Splits text into paragraph and fenced code blocks. */
function parseBlocks(text: string): Block[] {
  const lines = normaliseNewlines(text).split("\n");
  const blocks: Block[] = [];

  // nextClose[j] = index of the first closing-fence line at or after j, or -1.
  // One reverse pass keeps fence matching linear (T-10-R01 M2, SEC L-1).
  const nextClose = new Array<number>(lines.length + 1).fill(-1);
  for (let j = lines.length - 1; j >= 0; j -= 1) {
    nextClose[j] = isFenceClose(lines[j] ?? "") ? j : (nextClose[j + 1] ?? -1);
  }
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
      const close = nextClose[i + 1] ?? -1;
      if (close !== -1) {
        flushParagraph();
        const code = lines.slice(i + 1, close).join("\n");
        if (code.trim() !== "") {
          blocks.push({ kind: "code", text: code });
        }
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
 * Inline-only rendering: text and inline `code`, never `p` or `pre`. Safe
 * inside `label`, `legend` and other phrasing-content contexts.
 */
export function renderInlineText(text: string): ReactNode {
  return renderInlines(parseInline(normaliseNewlines(text)));
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
