/**
 * https guard for data links (T-13; standard 5; ADR-0001 V-2). Pure and
 * dependency-free, so Node-side code (reportLink.ts, Playwright specs that
 * import it) can use it without a CSS or React loader.
 *
 * Only `https:` URLs without credentials pass. The WHATWG parser strips
 * leading and trailing spaces and control characters and re-serialises the
 * URL, so callers must use the returned `href`, never the raw input.
 */

/** Parsed `https:` URL with no username or password, or null. Never throws. */
export function safeHttpsUrl(s: string): URL | null {
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "")
    return null;
  return url;
}

/** Safe href for `s` (see `safeHttpsUrl`), or null. Never throws. */
export function safeHttpsHref(s: string): string | null {
  return safeHttpsUrl(s)?.href ?? null;
}
