# Deploying ApiQuiz to GitHub Pages

Task T-20 (issue #39). Workflow: `.github/workflows/deploy-pages.yml`, named "Deploy to GitHub Pages (manual)".

ApiQuiz is a static single-page app built with Vite 8, React 19 and TypeScript. The build has no backend and no database:

- The question bank is a hashed JSON asset (`assets/bank-<hash>.json`), generated at build time from `content/`.
- Routing uses the URL hash (`#/quiz`), so a refresh never asks the server for an app route.
- `public/404.html` is the static fallback for any other unknown path.
- Vite builds for the `/api-quiz-app/` subpath (`vite.config.ts` `base`).
- GitHub Pages cannot send HTTP headers, so the Content-Security-Policy is a `<meta>` tag added at build time.

## 1. One-time repository settings (owner, in the GitHub UI)

1. **Settings > Pages > Build and deployment > Source: "GitHub Actions".**
   - Do not pick the suggested "GitHub Pages Jekyll" or "Static HTML" starter workflows; this repository already has its own.
   - This stops the legacy "Deploy from a branch" mode. That mode currently publishes the raw `main` source through Jekyll on every merge, without building the app.
2. **Settings > Pages > Enforce HTTPS: ticked.** The verify job fails if `http://` does not redirect to `https://`.
3. **Settings > Environments > `github-pages`** (GitHub creates it):
   - **Deployment branches and tags:** "Selected branches and tags", then **Add deployment branch or tag rule** with **Ref type: Branch** and name pattern `main`. Add no tag rules: a Tag rule named `main` would allow `refs/tags/main` and block the real branch. This is the server-side guarantee that only `main` can be published. GitHub creates this environment automatically, so check what it contains instead of assuming its defaults.
   - **Optional: Required reviewers:** add yourself. Every deployment then waits for an explicit approval in the run.
4. **Optional:** **Settings > Actions > General > Workflow permissions:** "Read repository contents and packages permissions". The workflows set their own least-privilege permissions anyway.

## 2. Deploying

1. Check that CI is green on the `main` commit you want to publish: Actions > CI > the latest run on `main`. This covers E2E (Chromium and WebKit) and Lighthouse. **The deploy workflow does not repeat them and does not enforce this check**, so a commit whose CI failed could still be deployed. Do not skip this step.
2. Go to Actions > **Deploy to GitHub Pages (manual)** > **Run workflow**.
3. Leave **Use workflow from** set to `main`. Any other branch skips every job.
4. The workflow has no inputs. The build job runs `npm run content:validate:release` and stops at "Release content thresholds" if the bank misses the release criteria (US-8.1: at least 60 reviewed questions over 8 topics, at least 5 per topic, at least 20% medium or hard; RC-1 to RC-4 in `docs/project-state.md`) or fails validation for any other reason.
   - There is no override (sponsor decision SD-REL-03). To publish, fix the content on `main` through a pull request, then run a new deployment.
5. The run has three jobs:
   - **Build and validate:** `npm ci`, `npm audit`, `npm run check`, the release-threshold gate, `npm run build`, size budgets, the CSP check, the reviewed-content check, and the subpath and artifact checks. It then uploads `dist/`.
   - **Deploy:** publishes the artifact. This is the only job with `pages: write` and `id-token: write`.
   - **Verify the live site:** HTTP 200 with the CSP meta, the app script loads, an unknown path gets the 404 page, and `http://` redirects to `https://`.

## 3. Checking the result by hand

- Open https://ibrahim-ai-team.github.io/api-quiz-app/ on a desktop browser and on a phone.
- The landing page lists the topics. Complete one quiz to its results.
- Rotate the phone during a quiz; the quiz state is kept.
- Reload on `#/topic/http-fundamentals`; the topic stays preselected.
- Open `/api-quiz-app/nope`; the "Page not found" page links home.
- For a fuller pass, follow `docs/qa/manual-pass-checklist.md` (iOS Safari, screen readers).

## 4. Rollback

- **Previous version:**
  1. Open Actions > Deploy to GitHub Pages (manual).
  2. Open the last good run.
  3. Choose **Re-run all jobs**.

  A re-run builds and publishes the same commit as that run and applies every gate again, including the release-threshold gate. GitHub only allows re-runs for about 30 days. A re-run also checks `npm audit` against today's advisories, so an old commit may no longer pass. In either case, use the next option.
- **Bad commit on main:** revert it through a pull request, then run a new deployment.
- **Emergency:** Settings > Pages > **Unpublish site**. Publishing again later needs a new manual run.

## 5. Security notes

- The workflow has no `push`, `pull_request`, `release` or `schedule` trigger. It only runs on an explicit manual dispatch or a re-run by someone with write access to Actions, which can also be done through the API. No event publishes automatically.
- Every run's summary records the release-threshold result, the commit and who started the run. A threshold miss cannot be overridden at deploy time.
- The default token is `contents: read`. Only the deploy job gets Pages write access and an OIDC token. The verify job has no permissions at all.
- Every action is pinned by commit SHA, following the repository convention:
  - `actions/configure-pages` v6.0.0
  - `actions/upload-pages-artifact` v5.0.0, which excludes dotfiles, `.git` and `.github` by default
  - `actions/deploy-pages` v5.0.1
- No secrets are used. The artifact contains only `dist/`, which has no source maps; the build job checks this.
