# Manual deployment to Vercel

This project keeps GitHub Actions CI separate from production deployment. Do not connect Vercel to automatic Git deployments if you want every release to be manual.

## One-time setup

1. Create/sign in to a Vercel account.
2. Install Node.js matching the repository's `.nvmrc`.
3. From the repository root, run `npx vercel login` and complete authentication.
4. Run `npx vercel link` and link this local checkout to a Vercel project. Use a project name such as `api-quiz-app`.

## Preview deployment

Run `npx vercel`. Review the deployment URL and test the app before production.

## Production deployment

After reviewing the preview, run `npx vercel --prod` to publish manually. This does not require a GitHub Actions deploy workflow.

## Why the Vercel build command overrides Vite's base

The existing CI and GitHub Pages checks exercise the `/api-quiz-app/` base path. The Vercel build overrides the base to `/` only for the Vercel build, so root-relative assets work on the Vercel domain while the existing CI configuration remains unchanged.

## Keep deployment manual

In Vercel Project Settings, do not enable automatic Git deployments if you want production releases only when you run the CLI command. Keep GitHub Actions CI enabled; tests and quality checks remain independent of deployment.

## Verification checklist

- Open the preview URL on desktop and mobile.
- Complete a quiz and verify the results and review screens.
- Check browser console and network requests for missing assets.
- Confirm the production URL after `npx vercel --prod` completes.

Do not put Vercel tokens or secrets in the repository. Authenticate through the Vercel CLI.
