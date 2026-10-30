/**
 * Duplicate JSON object key scanner (T-32 M1). `JSON.parse` silently keeps
 * the last value of a repeated key, so a question with two `correct` keys
 * would validate against whichever came last. This small recursive-descent
 * walker runs over text that `JSON.parse` has already accepted and reports
 * the first repeated key with its location. It does not build values.
 */

export interface DuplicateKey {
  key: string;
  /** Path of the object holding the repeated key, e.g. `["questions", 0]`. */
  path: (string | number)[];
}

/** Thrown only if the text is not valid JSON (callers parse first). */
class ScanError extends Error {}

/**
 * Returns the first duplicate key in document order, or null. Expects text
 * that `JSON.parse` accepts; throws on anything else.
 */
export function findDuplicateKey(text: string): DuplicateKey | null {
  let pos = 0;

  const skipWhitespace = (): void => {
    while (pos < text.length && " \t\n\r".includes(text.charAt(pos))) pos += 1;
  };

  const expect = (char: string): void => {
    if (text.charAt(pos) !== char) {
      throw new ScanError(`expected "${char}" at offset ${String(pos)}`);
    }
    pos += 1;
  };

  /** Reads a string token and decodes it with JSON.parse (handles escapes). */
  const readString = (): string => {
    const start = pos;
    expect('"');
    while (pos < text.length && text.charAt(pos) !== '"') {
      pos += text.charAt(pos) === "\\" ? 2 : 1;
    }
    expect('"');
    return JSON.parse(text.slice(start, pos)) as string;
  };

  const skipLiteral = (): void => {
    const start = pos;
    while (pos < text.length && !",]} \t\n\r".includes(text.charAt(pos))) {
      pos += 1;
    }
    if (pos === start) {
      throw new ScanError(`unexpected token at offset ${String(start)}`);
    }
  };

  const scanValue = (path: (string | number)[]): DuplicateKey | null => {
    skipWhitespace();
    const char = text.charAt(pos);
    if (char === "{") return scanObject(path);
    if (char === "[") return scanArray(path);
    if (char === '"') readString();
    else skipLiteral();
    return null;
  };

  const scanObject = (path: (string | number)[]): DuplicateKey | null => {
    expect("{");
    const seen = new Set<string>();
    skipWhitespace();
    if (text.charAt(pos) === "}") {
      pos += 1;
      return null;
    }
    for (;;) {
      skipWhitespace();
      const key = readString();
      if (seen.has(key)) return { key, path };
      seen.add(key);
      skipWhitespace();
      expect(":");
      const found = scanValue([...path, key]);
      if (found !== null) return found;
      skipWhitespace();
      if (text.charAt(pos) === "}") {
        pos += 1;
        return null;
      }
      expect(",");
    }
  };

  const scanArray = (path: (string | number)[]): DuplicateKey | null => {
    expect("[");
    skipWhitespace();
    if (text.charAt(pos) === "]") {
      pos += 1;
      return null;
    }
    for (let index = 0; ; index += 1) {
      const found = scanValue([...path, index]);
      if (found !== null) return found;
      skipWhitespace();
      if (text.charAt(pos) === "]") {
        pos += 1;
        return null;
      }
      expect(",");
    }
  };

  // A leading byte-order mark is not JSON whitespace; JSON.parse rejects it
  // too, so it never reaches this point.
  return scanValue([]);
}
