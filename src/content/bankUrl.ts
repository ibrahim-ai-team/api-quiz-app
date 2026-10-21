/**
 * URL of the emitted question bank (ADR-0001 amendment A4).
 *
 * `?url` makes Vite emit `src/content/generated/bank.json` (written by
 * `npm run content:build`) as a content-hashed same-origin asset,
 * `assets/bank-<hash>.json`, instead of compiling it into the JS bundle.
 * `no-inline` stops Vite from inlining a small file as a `data:` URL, which
 * the production CSP (`connect-src 'self'`) would block.
 */
import bankUrl from "./generated/bank.json?url&no-inline";

export { bankUrl };
