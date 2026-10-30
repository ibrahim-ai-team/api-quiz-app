# Project state — ApiQuiz (idea-01)

- **Last reconciled:** 2026-10-30 (S4-CLOSE-S5-PLAN-D01). Sources: `gh` reads of issues, PRs, Actions runs and the Pages site; `main` at `baee626`. Previous reconciliation: 2026-10-30 00:20 UTC at `32aa0fe`.
- **Coordinator:** top-level Claude Code session following ai-software-team `workflows/orchestration-contract.md` and `workflows/sprint-governance.md`.
- **Current phase:** `DELIVERY`. Sprint 3 closed 2026-10-23 (`docs/sprints/S3.md`). Sprint 4 closed early on 2026-10-30 at the sponsor's request (planned end 2026-11-06; `docs/sprints/S4.md`): 12 of 12 committed points merged, goal met. Sprint 5 active 2026-10-31 to 2026-11-07 (client deadline, SD-SPRINT-07) (`docs/sprints/S5.md`): the full open backlog is committed (SD-SPRINT-06), 16 points (10 provisional), plus story acceptances #9 to #17, epic closure #2 to #5 and the manual passes. Sprint 2 was closed retroactively (`docs/sprints/S2.md`).
- **Current sprint (S5) goal:** finish the app. All remaining backlog work is delivered and merged with CI green on main, `check_governance.py --release` passes with no deploy override, and every open story (#9 to #18) is ready for sponsor acceptance.
- The sections below the release criteria are kept as of 2026-10-21 for history, except Decisions, Workspace and Next actions, which were updated on 2026-10-30. The sprint records under `docs/sprints/` are the current source for sprint scope and status.

## Product goal and approved MVP scope

- Product goal: a free, static API interview practice quiz (`docs/planning/01-product-brief.md`).
- MVP scope: the P0 and P1 stories US-1 to US-10 and US-12. US-11 and US-13 are post-MVP.
- Delivered on main (not yet accepted): US-3, US-4, US-8 (66 reviewed / 8 topics), US-9 and US-10 slices, US-5 feature with E2E (#123, #124), US-6 best score, resume and reset (#126 to #128) with E2E (#130, #131). The app is live on GitHub Pages (see Workspace). US-1 and US-2 issues are closed.

## Release criteria

| ID | Criterion | Value | Decision | Mirrors |
|---|---|---|---|---|
| RC-1 | minReviewedQuestions | 60 | SD-REL-02 (sponsor 2026-10-23: keep the question bank and thresholds as they are) | scripts/content/rules.ts: minReviewedQuestions: {value}; docs/planning/01-product-brief.md: Question bank has at least {value} questions |
| RC-2 | minTopics | 8 | SD-REL-02 | scripts/content/rules.ts: minTopics: {value}; docs/planning/01-product-brief.md: questions across at least {value} topics |
| RC-3 | minPerTopic | 5 | SD-REL-02 | scripts/content/rules.ts: minPerTopic: {value} |
| RC-4 | minMediumOrHardPercent | 20 | SD-REL-02 | scripts/content/rules.ts: minMediumOrHardPercent: {value} |

Check with ai-software-team `python scripts/check_governance.py --state docs/project-state.md --repo . --release`. The bank on main (66 reviewed, 8 topics) meets these values. PR #122 (#39) removed the deploy override input. On 2026-10-30 at `main` baee626, `check_governance.py --state docs/project-state.md --repo . --release` printed "Governance check passed." (exit 0). Deploy runs 40839486152 (`edb6d76`) and 41038449377 (`a99b130`) met the thresholds with no override. SD-REL-03 (2026-10-28) keeps these values and allows no deploy-time override.

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
- SD-REL-02 (sponsor 2026-10-23): keep the question bank and release thresholds 60/8/5/20%.
- SD-REL-03 (sponsor 2026-10-28): thresholds stay at 60/8/5/20% (SD-REL-02); no deploy-time override. Issue #117 (24/3 proposal) closed as not planned.
- SD-SPRINT-05 (sponsor 2026-10-30): #109 and #110 go back to the backlog instead of a scope change over S4 capacity; close Sprint 4 and prepare and start Sprint 5.
- SD-SPRINT-06 (sponsor 2026-10-30: "in this sprint i wana work on all backlog i wana finish this app in this sprint"): Sprint 5 takes the full open backlog; its capacity is raised to the committed total (16 points), since 13 was an assumption and the limit is sponsor review time, not agent capacity. Provisional estimates are updated after refinement inside the sprint.
- SD-SPRINT-07 (sponsor 2026-10-30: "the deadline is november 07"): the app must be finished for the client by 2026-11-07; Sprint 5 ends on that date (moved from 2026-11-13).
- SD-DEPLOY-01 (sponsor 2026-10-22): publish the partial bank with one manual deploy per sprint, with the override until US-8.1 was met. Superseded for the override part: #122 removed the input and SD-REL-03 forbids an override.
- SD-DEPLOY (sponsor 2026-10-29, SEC-R14 mitigation): the three override deploy runs 39847942745, 39916746207 and 39922278097 were deleted (each returns 404 on read-back 2026-10-30); the `github-pages` environment is limited to branch `main`.
- DQ-US6-1 to 7 (sponsor 2026-10-29, comment on #12): proposed US-6 UX defaults accepted.
- Process (sponsor 2026-10-30): review follow-up fixes run only the impacted tests locally; PR CI runs the full suite.
- Pending decisions: see "Sponsor decisions needed" (history) and Next actions.

## Workspace (GitHub)

- Repository `ibrahim-ai-team/api-quiz-app`, public. Issues #2–#48 from the plan; follow-ups #55 (T-31), #60 (T-32), #63 (T-33). No milestones or Project board.
- CI (`.github/workflows/ci.yml`): lint/typecheck/test/build/budgets/audit, dependency review, E2E Playwright (Chromium 6 viewports + `webkit-iphone` on PRs), Node 24 (informational). Dependency graph setting enabled during Sprint 1.
- Branch protection on `main`: **not verified / not observed.**
- GitHub Pages: source "GitHub Actions"; workflow `.github/workflows/deploy-pages.yml` ("Deploy to GitHub Pages (manual)", `workflow_dispatch`, no inputs since #122). Environment `github-pages`: custom deployment branch policy, branch `main` only (read 2026-10-30).
- Deployed: **yes.** https://ibrahim-ai-team.github.io/api-quiz-app/ from run 41038449377 (`main` @ `a99b130`, 2026-10-30, 3 jobs success, no override; includes US-6); HTTP 200 on 2026-10-30. Previous deploy: run 40839486152 on `edb6d76`. #132 (`baee626`, test-only) is not deployed.

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

As of 2026-10-30 (Sprint 5, starts 2026-10-31; full backlog per SD-SPRINT-06):

1. agile-orchestrator: confirm main CI run 41041141091 on `7f5a677` (#133, T-46); finish the reviews of PR #134 (T-47) and dispatch the T-47-TL01 docs follow-up.
2. Refinement first: ui-ux-designer US-11 (#16) spec; tech-lead breakdown of #63 and the remainder of #60; qa-automation assessment of US-13 (#18) against its acceptance criteria. Then update the provisional points in `docs/sprints/S5.md` and create the US-11 task issues through the issue creation gate.
3. devops-platform: T-31 (#55), then tech-lead assessment of Dependabot #119 (eslint 10) after #55 merges; tech-lead assessment of #118 and #120 (TypeScript 7 risk).
4. Implementation of #60, #63, #16 and #18 by their owners after refinement, each with tech-lead and code-review-security reviews.
5. Sponsor: #39 hand check (runbook §3); manual passes: screen reader US-10.3, iOS US-9.6, private mode (`docs/qa/manual-pass-checklist.md` §F).
6. Sponsor or product-owner: accept US-3 to US-6, US-8 to US-10 and US-12 (#9 to #15, #17), and US-11 and US-13 when delivered; then close the epics #2 to #5.
7. project-manager: `/sprint-review` for S5 on or before 2026-11-07 (client deadline).

Earlier next actions (2026-10-21, history):

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
| 2026-10-30 | DELIVERY (Sprint 4) | DELIVERY (Sprint 4, mid-sprint) | Mid-sprint reconciliation: T-39, US-6 spec, T-42 to T-44 and the T-20 override removal merged; SD-REL-03; first deploy with no override | `docs/sprints/S4.md`, PRs #121 to #128, run 40839486152 |
| 2026-10-30 | DELIVERY (Sprint 4) | DELIVERY (Sprint 5) | Sprint 4 closed early at the sponsor's request with all 12 points merged and the goal met; #109 and #110 returned to the backlog and committed in Sprint 5 (SD-SPRINT-05) | `docs/sprints/S4.md`, `docs/sprints/S5.md`, PRs #130 to #132, run 41038449377 |
| 2026-10-30 | DELIVERY (Sprint 5) | DELIVERY (Sprint 5, full backlog) | SD-SPRINT-06: the sponsor put the whole open backlog in Sprint 5; capacity raised to 16 points (10 provisional) | `docs/sprints/S5.md` |
