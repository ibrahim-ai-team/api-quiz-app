/**
 * Playwright E2E configuration (T-03, issue #23; ADR-0001 test tooling, V-4).
 *
 * E2E always runs against the production build served by `vite preview`, so
 * the `/api-quiz-app/` base path and the build-only CSP meta are exercised
 * (tech-lead adjustment 2). Never point this at the dev server.
 *
 * Projects (tech-lead adjustment 4, test strategy section 3):
 * - PR set (default): Chromium at 320, 375, 768, 1280, 1920 and 640x360
 *   landscape, plus one WebKit iPhone project.
 * - Full set (`E2E_FULL=1`, used on `main` and as a release gate): the PR set
 *   plus Firefox at desktop widths and further device projects. This changes
 *   where checks run; it does not weaken them.
 *
 * Flaky policy (test strategy section 10): CI retries once with a trace on the
 * first retry. A test that passes only on retry is reported as "flaky" by
 * Playwright and must be logged as a defect; it is not treated as a pass.
 */
import { defineConfig, devices, type Project } from "@playwright/test";

const isCI = Boolean(process.env.CI);
const fullSet = process.env.E2E_FULL === "1";

const PORT = 4173;
export const BASE_URL = `http://localhost:${String(PORT)}/api-quiz-app/`;

function chromiumAt(name: string, width: number, height: number): Project {
  return {
    name: `chromium-${name}`,
    use: { ...devices["Desktop Chrome"], viewport: { width, height } },
  };
}

const prProjects: Project[] = [
  chromiumAt("320", 320, 800),
  chromiumAt("375", 375, 812),
  chromiumAt("768", 768, 1024),
  chromiumAt("1280", 1280, 800),
  chromiumAt("1920", 1920, 1080),
  chromiumAt("640x360-landscape", 640, 360),
  { name: "webkit-iphone", use: { ...devices["iPhone 15"] } },
];

const fullOnlyProjects: Project[] = [
  {
    name: "firefox-1280",
    use: {
      ...devices["Desktop Firefox"],
      viewport: { width: 1280, height: 800 },
    },
  },
  {
    name: "firefox-1920",
    use: {
      ...devices["Desktop Firefox"],
      viewport: { width: 1920, height: 1080 },
    },
  },
  { name: "android-pixel-7", use: { ...devices["Pixel 7"] } },
  {
    name: "android-pixel-7-landscape",
    use: { ...devices["Pixel 7 landscape"] },
  },
  {
    name: "webkit-iphone-landscape",
    use: { ...devices["iPhone 15 landscape"] },
  },
  { name: "webkit-ipad", use: { ...devices["iPad Pro 11"] } },
];

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI
    ? [["list"], ["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: fullSet ? [...prProjects, ...fullOnlyProjects] : prProjects,
  webServer: {
    command: `npm run build && npm run preview -- --port ${String(PORT)} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !isCI,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
