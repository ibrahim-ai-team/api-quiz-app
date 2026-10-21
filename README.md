# api-quiz-app

Part of **ApiQuiz** (project `idea-01`). ApiQuiz web application: quiz UI, question bank content and its validation, CI and coordination docs.

## Project repositories

| Repository                                                        | Purpose                                                                                              |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [`api-quiz-app`](https://github.com/ibrahim-ai-team/api-quiz-app) | ApiQuiz web application: quiz UI, question bank content and its validation, CI and coordination docs |

Planning and status live in [`api-quiz-app`](https://github.com/ibrahim-ai-team/api-quiz-app) and the GitHub Project "ApiQuiz (idea-01)". Issues carry the label `project:idea-01`.

## Development

Stack: TypeScript (strict), React 19, Vite, CSS Modules with CSS custom-property design tokens, built-in hash router, Zod for build-time content validation only; static SPA deployed to GitHub Pages; Node.js active LTS for build and CI only.

Install the Node.js version in `.nvmrc`, run `npm ci`, then `npm run dev`; `npm run check` runs lint, typecheck, content validation and unit tests, and `npm run e2e` (added in T-03) runs Playwright against `npm run build && npm run preview`.

CI (`.github/workflows/ci.yml`) runs on every pull request and on pushes to `main`: `npm ci`, `npm audit --audit-level=high`, `npm run check`, `npm run build`, `npm run size:selftest` and `npm run size` (gzip budgets: JS at most 200 kB, data at most 60 kB), plus dependency review on PRs and an informational, non-required Node 24 job.

Commands (Node 22, see `.nvmrc`):

| Command                                   | Purpose                                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| `npm ci`                                  | Install the exact dependency versions from `package-lock.json`                     |
| `npm run dev`                             | Vite dev server at `http://localhost:5173/api-quiz-app/` (no CSP in dev)           |
| `npm run build`                           | Type-check (`tsc -b`) and build to `dist/`; the CSP `<meta>` is injected only here |
| `npm run preview`                         | Serve the build at `http://localhost:4173/api-quiz-app/`                           |
| `npm run check`                           | `lint`, `lint:fixtures`, `typecheck`, `content:validate` and `test`                |
| `npm run lint`                            | ESLint with `--max-warnings 0`                                                     |
| `npm run lint:fixtures`                   | Asserts that the negative fixtures in `tests/lint-fixtures/` fail lint             |
| `npm run typecheck`                       | `tsc -b` over the app, tooling and test projects                                   |
| `npm run test`                            | Vitest unit tests                                                                  |
| `npm run format` / `npm run format:check` | Prettier write / check                                                             |
| `npm run content:validate`                | Placeholder until T-05                                                             |

## Testing

Vitest unit tests (domain engine, safe text renderer, storage guards) and Vitest + Testing Library component tests; content schema validation script in CI; Playwright E2E against the production build (Chromium + WebKit mobile on PRs, Firefox and full device set before release) with @axe-core/playwright, viewport, offline and same-origin request checks; Lighthouse CI (mobile) and gzip size budgets in CI
