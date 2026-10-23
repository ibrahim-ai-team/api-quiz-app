# Project state — ApiQuiz (idea-01)

- **Last reconciled:** 2026-10-23 UTC. Sources: GitHub reads of issues, PRs and Actions runs; `main` at `6698128`.
- **Coordinator:** top-level Claude Code session following ai-software-team `workflows/orchestration-contract.md` and `workflows/sprint-governance.md`.
- **Current phase:** `DELIVERY`. Sprint 3 closed 2026-10-23 (`docs/sprints/S3.md`). Sprint 4 active 2026-10-24 to 2026-11-06 (`docs/sprints/S4.md`). Sprint 2 was closed retroactively (`docs/sprints/S2.md`).
- **Current sprint (S4) goal:** a returning learner can review answers, retry missed questions, keep a best score per topic and resume an unfinished quiz. US-5 and US-6 E2E pass in CI on main, and the release check passes with no deploy override.
- The sections below the release criteria are kept as of 2026-10-21 for history. The sprint records under `docs/sprints/` are the current source for sprint scope and status.

## Product goal and approved MVP scope

- Product goal: a free, static API interview practice quiz (`docs/planning/01-product-brief.md`).
- MVP scope: the P0 and P1 stories US-1 to US-10 and US-12. US-11 and US-13 are post-MVP.
- Delivered on main (not yet accepted): US-3, US-4, US-8 (66 reviewed / 8 topics), US-9 and US-10 slices, US-5 feature (E2E pending), US-6 storage layer. US-1 and US-2 issues are closed.

## Release criteria

| ID | Criterion | Value | Decision | Mirrors |
|---|---|---|---|---|
| RC-1 | minReviewedQuestions | 60 | SD-REL-02 (sponsor 2026-10-23: keep the question bank and thresholds as they are) | scripts/content/rules.ts: minReviewedQuestions: {value}; docs/planning/01-product-brief.md: Question bank has at least {value} questions |
| RC-2 | minTopics | 8 | SD-REL-02 | scripts/content/rules.ts: minTopics: {value}; docs/planning/01-product-brief.md: questions across at least {value} topics |
| RC-3 | minPerTopic | 5 | SD-REL-02 | scripts/content/rules.ts: minPerTopic: {value} |
| RC-4 | minMediumOrHardPercent | 20 | SD-REL-02 | scripts/content/rules.ts: minMediumOrHardPercent: {value} |

Check with ai-software-team `python scripts/check_governance.py --state docs/project-state.md --repo . --release`. The bank on main (66 reviewed, 8 topics) meets these values. The release check still fails on the deploy override input until #39 removes it (Sprint 4).

## Requirement conflicts

| ID | Criterion | Sources | Status | Decision needed |
|---|---|---|---|---|
| RC-C1 | minReviewedQuestions | 24/3 MVP proposal (PR #91, closed unmerged 2026-10-22) vs US-8.1 60/8 | resolved | SD-REL-02 keeps 60/8; the bank already meets it |
| RC-C2 | minTopics | same as RC-C1 | resolved | same |

## Decisions

- D1 name ApiQuiz / repo `api-quiz-app`; D2 public repo, GitHub Pages; D3 no accounts or backend; D4 sponsor's PR review is the human content check (2026-10-21, `docs/planning/01-product-brief.md` §6).
- ADR-0001: `docs/adr/0001-architecture.md` (updated in PR #52).
- Node pinned `>=22.18 <23`; Node 24 runs in CI as an informational job.
- Team rule since PR #64/#65: the owner merges only after the coordinator's "ready to merge" comment.
- Pending decisions: see "Sponsor decisions needed".

## Workspace (GitHub)

- Repository `ibrahim-ai-team/api-quiz-app`, public. Issues #2–#48 from the plan; follow-ups #55 (T-31), #60 (T-32), #63 (T-33). No milestones or Project board.
- CI (`.github/workflows/ci.yml`): lint/typecheck/test/build/budgets/audit, dependency review, E2E Playwright (Chromium 6 viewports + `webkit-iphone` on PRs), Node 24 (informational). Dependency graph setting enabled during Sprint 1.
- Branch protection on `main`: **not verified / not observed.** GitHub Pages: **not enabled** (per coordinator). No deploy workflow exists.
- Deployed: **nothing.**

## Merged (verified by the coordinator on GitHub)

| PR | Task | Story | Reviews |
| --- | --- | --- | --- |
| #49 | T-19 QA strategy + AC matrix | EP-4 | TL + security |
| #50 | T-01 skeleton | EP-4 | TL + security |
| #51 | T-04 design specs | EP-4 | TL + security |
| #52 | T-21 ADR update | EP-4 | TL + security |
| #54 | T-02 CI | EP-4 | TL + security |
| #59 | T-05 content validator | US-7 | TL + security |
| #61 | T-03 E2E harness | EP-4 | TL + security |
| #62 | T-06 content build + loader | US-7 | TL + security |
| #64 + #65 | T-07 createQuiz + RNG (#65 = review fix after merge) | US-1 | TL + security |
| #66 | T-10 rich-text renderer | US-2 | TL + security |
| #67 | T-11 submit/next | US-2 | TL + security |
| #68 | T-08 app shell, router | US-1 | TL + security |
| #69 | T-09 landing | US-1 | TL + security |
| #70 | T-12 question view | US-2 | TL + security |
| #71 | T-13 feedback (Sprint 1 stretch) | US-3 | TL + security |
| #72 | T-14 + T-15 score and results (pulled forward) | US-4 | TL + security |

CI was green on each PR's final head; the human owner merged each one.

## Story status

| Story | Issue | Status | Next |
| --- | --- | --- | --- |
| US-7 | #6 | Closed (completed) on GitHub | Follow-ups T-32, T-33 |
| US-1 | #7 | Merged; evidence comment posted; awaiting sponsor/PO acceptance | SD-1 |
| US-2 | #8 | Merged; evidence comment posted; awaiting sponsor/PO acceptance | SD-1, SD-2 |
| US-3 | #9 | T-13 merged; T-22 in progress (PR #73 open) | T-22 reviews and merge; designer confirmation; SR pass |
| US-4 | #10 | T-14/T-15 merged | Manual pass; iOS double-tap check (on #36) |
| US-9, US-10 | #14, #15 | BACKLOG → Sprint 2 (T-16, T-17) | T-16 |
| US-8 | #13 | 0 reviewed questions, 6 drafts; batches #41–#48 open | T-23 to T-25 in Sprint 2 |
| US-13 | #18 | Dark mode shipped early inside UI tasks; not assessed against its AC | SD-11 |
| US-5, US-6, US-11, US-12 | #11, #12, #16, #17 | BACKLOG | Sprint 3+ |

## Sprint 2 tasks (13 points committed)

| Task | Issue | Owner | Points | Depends on | Status |
| --- | --- | --- | --- | --- | --- |
| T-22 issue form | #40 | devops-platform | 1 | T-01 | IN_PROGRESS (worktree `/home/user/api-quiz-T22`, branch `feat/T-22-issue-form`, PR #73 open) |
| T-16 flow + responsive E2E | #36 | qa-automation | 3 | T-03, T-15 | READY |
| T-17 responsive/contrast fixes | #37 | frontend-developer | 2 | T-16 | BACKLOG |
| T-23 content batch 1 | #41 | technical-research / product-owner | 1 | T-05, SD-5 | READY (SD-5 before merge) |
| T-24 content batch 2 | #42 | technical-research / product-owner | 1 | T-05 | BACKLOG (max 2 batch PRs open) |
| T-25 content batch 3 | #43 | technical-research / product-owner | 1 | T-05 | BACKLOG |
| T-18 Lighthouse CI | #38 | performance-engineer | 2 | T-03, T-09 | READY (single writer of `ci.yml`) |
| T-20 Pages deploy | #39 | devops-platform | 2 | T-02; SD-8 and SD-9 before any deploy run | BACKLOG |
| Stretch: T-32, T-31, T-33 | #60, #55, #63 | backend-developer, devops-platform, mixed | 2, 1, not sized | — | BACKLOG |

## Active delegations

| Delegation ID | Task ID | Owner | Branch/worktree | Scope/allowed paths | Expected output | Status | Evidence |
|---|---|---|---|---|---|---|---|
| T-22-D01 | T-22 | devops-platform | `feat/T-22-issue-form` / `/home/user/api-quiz-T22` | `.github/ISSUE_TEMPLATE/question-report.yml` | issue form | IN_PROGRESS | PR #73 open (observed 22:57 UTC); not reviewed |
| S2-PLAN-D01 | Sprint 1 review / Sprint 2 plan | project-manager | `docs/sprint-1-review-sprint-2-plan` / `/home/user/api-quiz-app` | `docs/planning/06-…`, `docs/planning/00-handover.md`, `docs/planning/README.md`, `docs/planning/sprint1-coordinator-state.md`, `docs/project-state.md` | plan + state refresh | IN_REVIEW (returned to the coordinator; not committed) | this file |

## Evidence states

- **Implemented and merged:** T-01 to T-15, T-19, T-21 (PRs above).
- **Tested:** CI green on each merged PR's final head (coordinator). Manual checks (keyboard spot-checks US-1.9/US-2.9, iOS Safari US-9.6, screen reader US-10.3, US-4 manual pass): **not recorded**.
- **Reviewed:** tech-lead and independent security review on every merged PR (coordinator).
- **Deployed:** nothing.
- **Not verified:** branch protection; whether #6 was closed by PO acceptance or by a PR keyword.

## Risks and blockers

- No blocker for Sprint 2 start.
- R-1: Sprint 2 ends with about 24 reviewed questions in 3 topics, below the US-8.1 release threshold (60 / 8 topics / 5 per topic); the release gate (`content:validate:release`) will fail.
- R-2: T-20 must not deploy on merge before the go/no-go.
- R-3: sponsor review load (content PRs, manual passes, acceptances).
- Full list: file 06 §3.6.

## Sponsor decisions needed (file 06 §3.7)

SD-1 accept US-1/US-2; SD-2 confirm T-12-D01 / DQ-1; SD-3 DQ-5; SD-4 designer confirmation (routine); SD-5 `reviewedBy` privacy (before T-23 merges); SD-6 Dependabot #56–#58; SD-7 branch protection on `main`; SD-8 enable Pages ("GitHub Actions" source); SD-9 first public deploy timing; SD-10 capacity/calendar; SD-11 US-13.

## Next actions

1. agile-orchestrator: reconcile T-22 / PR #73, dispatch the tech-lead and security reviews, post "ready to merge" when dispositioned.
2. agile-orchestrator: dispatch T-16 (qa-automation) in the main worktree; ask the sponsor SD-5, SD-7, SD-8 in one message.
3. agile-orchestrator: after SD-5, dispatch T-23 in a separate content worktree.

## Change log

| UTC timestamp | Previous phase | New phase | Reason | Evidence |
| --- | --- | --- | --- | --- |
| 2026-10-21 | BACKLOG_READY | DELIVERY | Repository provisioned; Sprint 1 started early at the sponsor's request | PR #1, issues #2–#48 |
| 2026-10-21 ~22:52 | DELIVERY (Sprint 1) | DELIVERY (Sprint 1 closed) | All committed tasks merged; sponsor stop point after PR #72 | `docs/planning/sprint1-coordinator-state.md` |
| 2026-10-21 22:57 | DELIVERY | DELIVERY (Sprint 2 planned) | Sprint 1 review, retro and Sprint 2 plan (S2-PLAN-D01) | `docs/planning/06-sprint1-review-retro-sprint2-plan.md` |
| 2026-10-23 | DELIVERY (Sprint 3) | DELIVERY (Sprint 4) | Sprint 2 and Sprint 3 closed with records; Sprint 4 planned at the sponsor's request; release criteria SD-REL-02 recorded | `docs/sprints/S2.md`, `S3.md`, `S4.md` |
