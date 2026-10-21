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
      const charset = '<meta charset="UTF-8" />';
      if (!html.includes(charset)) {
        throw new Error(`CSP plugin: ${charset} not found in index.html`);
      }
      return html.replace(
        charset,
        `${charset}\n    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`,
      );
    },
  };
}

export default defineConfig({
  base: "/api-quiz-app/",
  plugins: [react(), cspMetaPlugin()],
  build: {
    target: "es2022",
    sourcemap: false,
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "src/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
