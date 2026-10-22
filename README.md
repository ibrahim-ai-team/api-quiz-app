# api-quiz-app

Part of **ApiQuiz** (project `idea-01`). ApiQuiz web application: quiz UI, question bank content and its validation, CI and coordination docs.

## Project repositories

| Repository                                                        | Purpose                                                                                              |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [`api-quiz-app`](https://github.com/ibrahim-ai-team/api-quiz-app) | ApiQuiz web application: quiz UI, question bank content and its validation, CI and coordination docs |

Planning and status live in [`api-quiz-app`](https://github.com/ibrahim-ai-team/api-quiz-app) and the GitHub Project "ApiQuiz (idea-01)". Issues carry the label `project:idea-01`.

## Development

Stack: TypeScript (strict), React 19, Vite, CSS Modules with CSS custom-property design tokens, built-in hash router, Zod for build-time content validation only; static SPA deployed to GitHub Pages; Node.js active LTS for build and CI only.

Install the Node.js version in `.nvmrc`, run `npm ci`, then `npm run dev`; `npm run check` runs lint, typecheck, content validation and unit tests, and `npm run e2e` runs Playwright against `npm run build && npm run preview` at `http://localhost:4173/api-quiz-app/`.

Local E2E runs reuse a server already listening on port 4173 (`reuseExistingServer` outside CI), so stop any old `npm run preview` first or the run tests a stale build.

CI (`.github/workflows/ci.yml`) runs on every pull request and on pushes to `main`: `npm ci`, `npm audit --audit-level=high`, `npm run check`, `npm run build`, `npm run size:selftest` and `npm run size -- --require-data` (gzip budgets: JS at most 200 kB, data at most 60 kB; the `assets/bank-<hash>.json` data asset must exist), plus dependency review on PRs and an informational, non-required Node 24 job. A separate `e2e` job validates the E2E fixture bank and runs Playwright: the PR set (Chromium at 320, 375, 768, 1280, 1920 and 640x360, plus WebKit iPhone) on pull requests, and additionally Firefox and the full device set (`E2E_FULL=1`) on pushes to `main`.

Commands (Node 22, see `.nvmrc`):

| Command                                   | Purpose                                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| `npm ci`                                  | Install the exact dependency versions from `package-lock.json`                     |
| `npm run dev`                             | `content:build:dev` (keeps drafts), then the Vite dev server (no CSP), port 5173   |
| `npm run build`                           | `content:build`, `tsc -b`, `vite build` to `dist/`; the CSP `<meta>` is added here |
| `npm run preview`                         | Serve the build at `http://localhost:4173/api-quiz-app/`                           |
| `npm run check`                           | `lint`, `lint:fixtures`, `typecheck`, `content:validate` and `test`                |
| `npm run lint`                            | ESLint with `--max-warnings 0`                                                     |
| `npm run lint:fixtures`                   | Asserts that the negative fixtures in `tests/lint-fixtures/` fail lint             |
| `npm run typecheck`                       | `tsc -b` over the app, tooling and test projects                                   |
| `npm run test`                            | Vitest unit tests                                                                  |
| `npm run format` / `npm run format:check` | Prettier write / check                                                             |
| `npm run content:validate`                | Validates the question bank; `content:validate:release` enforces the documented MVP gate (24 reviewed / 3 topics)     |
| `npm run content:build`                   | Writes the bank to `src/content/generated/`, no drafts; `:dev` keeps drafts        |
| `npm run e2e`                             | Playwright PR set on the production build; `E2E_FULL=1` adds Firefox and devices   |
| `npm run e2e:chromium`                    | Only the Chromium projects (for machines without WebKit)                           |
| `npm run e2e:install`                     | Install the Playwright Chromium and WebKit browsers with system dependencies       |
| `npm run e2e:fixtures`                    | Validate E2E fixture banks with the content validator (drift guard)                |

## Testing

Vitest unit tests (domain engine, safe text renderer, storage guards) and Vitest + Testing Library component tests; content schema validation script in CI; Playwright E2E against the production build (Chromium + WebKit mobile on PRs, Firefox and full device set before release) with @axe-core/playwright, viewport, offline and same-origin request checks; Lighthouse CI (mobile) and gzip size budgets in CI
