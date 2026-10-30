import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

/**
 * Content-Security-Policy for the production build (ADR-0001 section 6).
 * GitHub Pages cannot send response headers, so the policy is delivered as a
 * <meta http-equiv> tag. It is injected at build time only, because the Vite
 * dev server relies on inline scripts for HMR (tech-lead adjustment 1).
 * Never add 'unsafe-inline' or third-party origins here.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

function cspMetaPlugin(): Plugin {
  return {
    name: "apiquiz-csp-meta",
    apply: "build",
    transformIndexHtml(html) {
      // Place the policy directly after <meta charset> and before any script.
      const charset = /<meta\s+charset\s*=\s*["']?utf-8["']?\s*\/?>/i;
      if (!charset.test(html)) {
        throw new Error("CSP plugin: <meta charset> not found in index.html");
      }
      return html.replace(
        charset,
        (match) =>
          `${match}\n    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`,
      );
    },
  };
}

/**
 * Static fallback for a failed entry script (T-47, US-12.5). index.html puts
 * `.boot-fallback` inside #root; React replaces it on mount. Without script
 * the only way to keep it out of a normal load is CSS: it is hidden and
 * absolutely positioned (no layout space, not in the accessibility tree) and
 * a zero-length animation with a delay reveals it only if the app has not
 * mounted by then. The CSP forbids inline styles and <style> (style-src
 * 'self', scripts/check-dist-csp.mjs), so the rules ship in the entry
 * stylesheet: main.tsx imports this virtual module and Vite extracts it into
 * the render-blocking <link rel="stylesheet"> in <head>, which loads even
 * when the entry script does not. If that stylesheet fails too, the fallback
 * is simply visible at once. reduced-motion (base.css) shortens durations,
 * not delays, so the reveal delay still applies.
 */
export const BOOT_FALLBACK_CSS_ID = "virtual:boot-fallback.css";
export const BOOT_FALLBACK_DELAY = "4s";
const BOOT_FALLBACK_CSS = `
.boot-fallback {
  position: absolute;
  inset-block-start: 0;
  inset-inline: 0;
  max-width: var(--content-max);
  margin-inline: auto;
  padding: var(--space-6) var(--page-padding-inline);
  visibility: hidden;
  animation: boot-fallback-reveal 0s linear ${BOOT_FALLBACK_DELAY} forwards;
}

@keyframes boot-fallback-reveal {
  to {
    visibility: visible;
  }
}
`;

function bootFallbackCssPlugin(): Plugin {
  const resolved = `\0${BOOT_FALLBACK_CSS_ID}`;
  return {
    name: "apiquiz-boot-fallback-css",
    resolveId(id) {
      return id === BOOT_FALLBACK_CSS_ID ? resolved : undefined;
    },
    load(id) {
      return id === resolved ? BOOT_FALLBACK_CSS : undefined;
    },
  };
}

export default defineConfig({
  base: "/api-quiz-app/",
  plugins: [react(), cspMetaPlugin(), bootFallbackCssPlugin()],
  build: {
    target: "es2022",
    sourcemap: false,
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "src/**/*.test.{ts,tsx}"],
    environment: "node",
    setupFiles: ["tests/unit/setup/dom-stubs.ts"],
  },
});
