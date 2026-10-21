# Sprint 1 review, retrospective and Sprint 2 plan: ApiQuiz

- **Delegation:** S2-PLAN-D01 (project-manager / Scrum Master). Date: 2026-10-21, written 22:57 UTC.
- **Inputs:** `05-backlog-sprint-plan.md` (backlog, Sprint 1 commitment, Sprint 2 candidates), `04-tech-lead-review.md`, `01-product-brief.md`, `docs/qa/ac-test-matrix.md`, `sprint1-coordinator-state.md` (delegation ledger), `git log main` (head `8dd6fef`, merge of PR #72), and read-only GitHub REST reads (issues, open PRs) made in this delegation.
- **Standards:** `.claude/skills/agile-planning/SKILL.md`, `.claude/skills/documentation-session-handover/SKILL.md`, `workflows/orchestration-contract.md`, `standards/sprint-sizing.md` (v2).
- **Labels:** *Fact (coordinator)* = verified by the coordinator from GitHub and passed to this delegation. *Fact (observed)* = read by this delegation from the repository or the GitHub REST API. *Assumption* = PM default, reversible. *Decision needed* = sponsor or PO.
- **Status:** Proposed plan. The Sprint 2 scope follows the ranked candidates in file 05 section 2.10 and the sponsor's stated goal. It is not sponsor-approved line by line.

---

## 1. Sprint 1 review

### 1.1 Sprint summary

- **Planned:** Sprint 1, 2026-10-26 to 2026-11-08, 5 sessions (assumption), goal in file 05 section 2.1.
- **Actual:** all Sprint 1 work ran on 2026-10-21, at the sponsor's request, before the nominal start date (issue close times on GitHub are all 2026-10-21). The sponsor stopped the sprint at about 22:52 UTC after PR #72 merged.
- **Sprint goal** (*a validated question bank feeds a working, accessible quiz start ... built on a CI pipeline that enforces lint, types, content validation, CSP and size budgets*): **met in code on `main`**. Story acceptance of US-1 and US-2 is still with the sponsor/PO (section 1.3). Nothing is deployed.

### 1.2 Commitment against delivery (points)

| Bucket | Items | Points planned | Points merged |
| --- | --- | --- | --- |
| Committed foundation | T-19, T-21, T-01, T-04, T-02, T-03 | 14 | 14 |
| Committed stories | US-7 (T-05, T-06), US-1 (T-07, T-08, T-09), US-2 (T-10, T-11, T-12) | 18 | 18 |
| **Committed total** | | **32** | **32 (100%)** |
| Stretch | US-3 / T-13 | 3 | 3 |
| Pulled forward from Sprint 2 | US-4 / T-14 + T-15 | 0 (Sprint 2 candidate) | 3 |
| **Merged in Sprint 1** | | | **38** |
| New follow-up work found in reviews | T-31 #55 (1), T-32 #60 (2), T-33 #63 (not sized) | — | 0 (backlog) |

Merged PRs (fact, coordinator): #49 T-19, #50 T-01, #51 T-04, #52 T-21, #54 T-02, #59 T-05, #61 T-03, #62 T-06, #64 + #65 T-07, #66 T-10, #67 T-11, #68 T-08, #69 T-09, #70 T-12, #71 T-13, #72 T-14 + T-15. Each had a tech-lead review and an independent security review, CI was green on its final head, and the human owner merged it.

**Usage (observed in the ledger, incomplete):** 16 implementation delegations (one per ledger row), security review IDs SEC-R01 to SEC-R09, tech-lead review IDs for 12 of the 16 rows (re-reviews R02 on T-03 and T-14/T-15). The plan estimated about 23 delegations for 32 points. The ledger does not record sessions used, the total delegation count, turn caps hit or usage-limit warnings, so capacity cannot be recalibrated from data (retro item I-4). The only safe conclusion: the delivered work needed clearly more than 23 delegations.

### 1.3 Story status

Evidence states are kept separate. "Merged" means the PR state on GitHub, verified by the coordinator. **Deployed: nothing.** GitHub Pages is not enabled and no deploy workflow exists (`.github/workflows/` holds only `ci.yml`, observed).

| Story (issue) | Tasks and PRs | Implemented | Tested | Reviewed | Merged | Acceptance status | Open items |
| --- | --- | --- | --- | --- | --- | --- | --- |
| US-7 (#6) | T-05 #59, T-06 #62 | Yes | CI green on final heads; unit tests T-US7-1..6 | TL + security | Yes | Issue #6 **closed (completed)** on GitHub, 2026-10-21 09:17 UTC (observed). Whether it was closed by PO acceptance or by a PR closing keyword is not verified | Follow-ups T-32 #60, T-33 #63 |
| US-1 (#7) | T-07 #64 + #65, T-08 #68, T-09 #69 | Yes | CI green; E2E/component T-US1-1..9 per matrix | TL + security | Yes | **Awaiting sponsor/PO acceptance**; evidence comment posted (fact, coordinator) | Manual keyboard spot-check for US-1.9: not recorded (not verified) |
| US-2 (#8) | T-10 #66, T-11 #67, T-12 #70 | Yes | CI green; E2E/component T-US2-1..9 per matrix | TL + security | Yes | **Awaiting sponsor/PO acceptance**; evidence comment posted | Decision T-12-D01 / DQ-1 (Exit and Back clear the session) needs PO confirmation; US-2.2 resume part deferred to US-6 (F-7); manual keyboard spot-check for US-2.9 not recorded |
| US-3 (#9) | T-13 #71 (Sprint 1 stretch); T-22 PR #73 **open** (observed, not reviewed) | T-13 yes; T-22 in progress | T-13 CI green | T-13 TL + security | T-13 yes | Not ready for acceptance | T-22 merge; designer confirmation of `feedback.explanationCodeLabel` and the T-13 deviations; screen-reader pass (US-10.3) |
| US-4 (#10) | T-14 + T-15 #72 | Yes | CI green on run 39688685139 (ledger) | TL R01 then R02 + SEC-R09 | Yes | Not ready for acceptance | Manual pass; iOS double-tap check (tracked on #36) |
| US-13 (#18) | none planned | Dark mode shipped early inside the Sprint 1 UI tasks (fact, coordinator); dark-mode axe tests exist for Feedback and Results (matrix) | Partly | With the UI PRs | Yes, as part of those PRs | Not assessed against US-13.1/13.2 | PO to decide whether to verify and accept now or leave in the backlog |

**Production bank:** 0 reviewed questions; 6 drafts (2 in each of `http-fundamentals.json`, `http-methods-idempotency.json`, `status-codes.json`, all `reviewStatus: "draft"`, observed). A production build emits an empty bank, so a deployed app would show no topics until US-8 batches land.

### 1.4 Carry-overs

- No committed task carries over: all 32 committed points are merged.
- Story-level carry-overs: acceptance of US-1 and US-2 (sponsor/PO); US-3 completion (T-22, PR #73); US-4 manual checks.
- New backlog from reviews: T-31 #55 (1 point), T-32 #60 (2 points), T-33 #63 (not sized; mixed owners).
- Open Dependabot major PRs #56 (eslint 10), #57 (@types/node 26), #58 (@eslint/js 10): not reviewed, waiting on a decision.

---

## 2. Blameless retrospective

Only the events recorded for Sprint 1 are used. The focus is on the process, not on any person or agent.

### 2.1 What went well

- **W-1** All 32 committed points plus the stretch (T-13) and two Sprint 2 tasks (T-14, T-15) merged, each PR with CI green on its final head.
- **W-2** Two independent reviews on every PR found real behaviour issues before merge: T-12 D01 (Exit/Back clear the session), T-13 M1 (hover tint), T-14-15 F1 (double click on See results). Each fix landed before the merge, except the T-07 case in I-1.
- **W-3** The CI matrix includes WebKit (`webkit-iphone` on PRs). It found a WebKit-only difference (radio arrow keys do not wrap), and the test was corrected rather than the check being weakened.
- **W-4** The supply-chain gate (dependency review) was kept and made to work by fixing the repository setting, not by removing the job.
- **W-5** One task per branch and PR, with a single writer in the shared working tree, kept file ownership clean across 16 PRs.

### 2.2 What to improve

- **I-1** PR #64 (T-07) merged before its review fix landed; the fix needed a second PR (#65). Merge readiness was not signalled clearly enough. The team now waits for an explicit "ready to merge" comment.
- **I-2** Dependency review failed until the Dependency graph setting was enabled. A repository setting was a hidden prerequisite of a CI task. The same pattern lies ahead: Pages ("GitHub Actions" source) before T-20, and branch protection with required checks.
- **I-3** The WebKit failure appeared only in CI. Local agent runs did not have WebKit installed (the matrix notes "WebKit not run" for T-12 to T-15), so local results covered Chromium only.
- **I-4** The ledger does not record sessions used or delegation counts per story. Risk R9 (recalibrate capacity at the review) cannot be closed with data.
- **I-5** Dark mode (US-13, P3, "later") shipped early inside other UI tasks. It is useful, but it was not planned, and US-13 has no acceptance record.
- **I-6** Some records went stale while work moved fast: `docs/project-state.md` still showed the morning state, the AC matrix still says "local run, CI not yet observed" for T-13 to T-15 although CI was green on merge, and decision IDs reuse delegation IDs (T-12-D01 is both).

### 2.3 Actions

| ID | Action | Owner | When | Done when |
| --- | --- | --- | --- | --- |
| RA-1 | Keep the merge rule: the owner merges only after the coordinator posts "ready to merge" (both reviews dispositioned, fixes pushed, CI green on that head). Put the rule in each PR's last status comment | agile-orchestrator | Every Sprint 2 PR | Every Sprint 2 PR has the comment before its merge |
| RA-2 | Check repository settings a task depends on before dispatching it: Pages source before T-20; branch protection and required checks; Dependency graph (done). Record them as entry criteria | agile-orchestrator (sponsor applies the settings) | Before T-20 and at the start of Sprint 2 | Settings observed through the API and recorded in `docs/project-state.md` |
| RA-3 | In each implementation report, state which browsers ran locally ("Chromium only; WebKit in CI") and treat CI WebKit as the gate | qa-automation, frontend-developer | From T-16 | Reports name the browsers |
| RA-4 | Add sessions used, delegations per task and usage-limit warnings to the ledger; recount at the Sprint 2 review | agile-orchestrator, project-manager | From the first Sprint 2 session | Sprint 2 review has planned against actual numbers |
| RA-5 | Record unplanned scope as a scope note for the PO before the PR merges; ask the PO what to do with US-13 now | project-manager, product-owner | Sprint 2 planning | US-13 status decided |
| RA-6 | Use `DEC-<n>` IDs for decisions, separate from delegation IDs; refresh the matrix status lines with CI run IDs as part of T-16 | project-manager; qa-automation | Sprint 2 | New decisions use `DEC-`; matrix shows CI evidence for T-13 to T-15 |

---

## 3. Sprint 2 plan

### 3.1 Header

- **Sprint:** 2.
- **Dates:** nominal 2026-11-09 to 2026-11-22 (the two-week cadence of file 05). Work has already started: T-22 is in progress (PR #73). Re-baselining the calendar to the sponsor's actual pace is a sponsor choice; it changes nothing in scope.
- **Goal:** *A complete, accessible single quiz loop with real reviewed content, ready for a first GitHub Pages release candidate.*
- **What "release candidate" means in this sprint:** `main` at a commit where US-1 to US-4 and US-9/US-10 are accepted, T-22 and T-20 are merged, Lighthouse CI passes, at least 3 reviewed content batches are merged, and the release-manager's go/no-go report is written. **The first public deploy is not part of the commitment.** It follows the go/no-go and a sponsor decision (SD-9), because the bank will still be below the US-8.1 release threshold (section 3.6, R-1).
- **Capacity (assumption, same as Sprint 1):** 5 sessions = 4 working + 1 reserve, about 6 delegations per session, about 24 delegations. Kept unchanged because Sprint 1 did not record sessions or delegations (I-4); the sponsor can confirm or change it (SD-10).
- **Why commit fewer points than Sprint 1 delivered (38):** Sprint 2's limit is human attention, not agent throughput: 3 content PRs need the sponsor's own review (D4), manual device and screen-reader passes need a person, and T-20 needs settings and a go/no-go. The work also needs more delegations per point (content authoring plus non-author review; deploy plus release check).

### 3.2 Selection

| Rank | Task (issue) | Story | Owner | Points | Est. delegations | Depends on | Acceptance check (issue AC) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | T-22 (#40), PR #73 open | US-3 | devops-platform | 1 | 3 (impl, in progress; TL; security) | T-01 | Issue form schema, public-data warning, ID and `contentVersion` fields, title pattern |
| 2 | T-16 (#36) | US-9/US-10 | qa-automation | 3 | 2 (impl; TL) | T-03, T-15 | J1 end to end incl. keyboard; no horizontal scroll at 6 sizes; rotation; 400% reflow; axe on every state; offline; deep-link refresh. Also iOS double-tap check list for US-4 |
| 3 | T-17 (#37) | US-9 | frontend-developer | 2 | 3 (impl; TL; security light) | T-16 | T-16 failures fixed and T-16 passes; 44 px targets; reduced motion; forced colours |
| 4 | T-23 (#41) | US-8 | technical-research (author), product-owner (non-author review) | 1 | 2 | T-05, SD-5 | About 8 original questions, at least 2 medium/hard, reviewed with `reviewedBy`, `content:validate` clean, sponsor PR review recorded |
| 5 | T-24 (#42) | US-8 | as T-23 | 1 | 2 | T-23 merged or open (at most 2 batch PRs open) | As T-23 |
| 6 | T-25 (#43) | US-8 | as T-23 | 1 | 2 | as T-24 | As T-23 |
| 7 | T-18 (#38) | SC-5 | performance-engineer | 2 | 3 (impl; TL; security, since it changes `ci.yml`) | T-03, T-09 | LHCI mobile, 3 runs, median Performance >= 90 and Accessibility >= 95; baseline attached |
| 8 | T-20 (#39) | EP-3 | devops-platform | 2 | 4 (impl; TL; security; release-manager go/no-go) | T-02; SD-8 before any deploy run | Deploy from `main` only, SHA-pinned, `pages: write`/`id-token: write` only on the deploy job in a `github-pages` environment; live checks (HTTPS, CSP, deep link, 404) recorded after the first deploy |
| — | QA story validation for US-3, US-4, US-9/US-10 | — | qa-automation | — | 1 | the tasks above | Matrix rows updated with CI run IDs (RA-6) |
| — | Designer confirmation of `feedback.explanationCodeLabel` and the T-13 deviations | US-3 | ui-ux-designer | — | 1 (read-only) | none | Confirm or list changes in `docs/design/` |
| — | Manual checks: iOS Safari real device (US-9.6, iOS double-tap), NVDA or VoiceOver pass (US-10.3), US-4 manual pass | US-4, US-9, US-10 | sponsor or a person with the device (checklist from qa-automation) | — | 0 | T-17 merged | Recorded result on #36 / the story issue |
| **Committed** | | | | **13** | **≈ 23** | | |

Points arithmetic: T-22 1 + T-16 3 + T-17 2 + T-23 1 + T-24 1 + T-25 1 + T-18 2 + T-20 2 = 13.

**Stretch (not committed), in order:** T-32 #60 (2 points, backend-developer: validator hardening; useful before more content lands), T-31 #55 (1 point, devops-platform: lint gaps), T-33 #63 (not sized; mixed owners; tech-lead to size and split before it is Ready). Pulled in only when committed work is in review and the reserve session is not needed.

**Excluded:** T-26 to T-30 (US-8 batches 4 to 8, Sprint 3), US-5, US-6, US-11, US-12 remainder, US-13 acceptance (unless the PO asks, RA-5), Dependabot majors (until SD-6), any paid service or custom domain, any production deploy without SD-8 and SD-9.

### 3.3 Sequence and dependencies

```text
Now      T-22 (worktree api-quiz-T22, PR #73) ──► reviews ──► human merge ──► US-3 ready for acceptance
                                                                             (with designer confirmation and SR pass)
Lane A   T-16 ──► T-17 ──► T-18 ──► T-20 ──► release-manager go/no-go ──► SD-9 (first deploy?)
(code)   (tests)  (CSS)   (ci.yml) (deploy.yml)
Lane B   SD-5 ──► T-23 ──► T-24 ──► T-25        (one batch authored at a time; at most 2 batch PRs open)
(content)
Human    T-17 merged ──► iOS Safari pass, screen-reader pass, US-4 manual pass ──► accept US-3, US-4, US-9, US-10
```

- **T-16 and T-17:** T-16 records the responsive and contrast failures; T-17 fixes them. Recommended: stack T-17 on the T-16 branch and merge in order, so `main` never carries failing or skipped tests. The tech-lead decides the exact mechanism; checks are not weakened.
- **`ci.yml` single writer:** T-18 is the only Sprint 2 task that edits `ci.yml`. T-20 adds a new file, `deploy.yml`.
- **`package.json` and lockfile:** T-18 may add the Lighthouse CI package; Dependabot PRs #56 to #58 touch the same files. Do not run them together.
- **Content files:** T-23, T-24, T-25 each own one file under `content/questions/` (the topic file that already holds 2 drafts). No code path is shared with lane A. T-32 (stretch) changes the validator in `scripts/`; if it runs, merge it before the next batch PR so the batch is checked by the stricter rules.
- **T-33 (stretch):** L3 edits `tests/e2e/helpers/network.ts`, so it waits until T-16 merges; M1(b) edits `vite.config.ts`.

### 3.4 Session plan and single-writer/parallel plan

| Session | Lane A: main worktree `/home/user/api-quiz-app` (one coding delegation at a time) | Lane B: separate worktree (content or docs only) | Reviews and other |
| --- | --- | --- | --- |
| S1 | T-16 | T-22 finishing in `/home/user/api-quiz-T22`; then T-23 (after SD-5) | T-22 TL + security; designer confirmation |
| S2 | T-17 (stacked on T-16) | T-23 non-author review; T-24 | T-16/T-17 TL; T-17 security light |
| S3 | T-18 | T-25 | T-18 TL + security; QA story validation |
| S4 | T-20 | stretch T-32 (scripts only, no overlap with T-20) | T-20 TL + security; release-manager go/no-go |
| S5 (reserve) | fixes, carried-over item or stretch | — | Sprint 2 review and retro |

Rules:

- One active coding delegation per worktree. Parallel work only between lane A and lane B, in separate worktrees on separate branches with non-overlapping allowed paths. The orchestration contract also asks for the sponsor's approval of parallel coding in a session; content and docs lanes are the only second lane planned.
- A worktree claim is recorded in the Active delegations table of `docs/project-state.md` before dispatch. It is a coordination record, not a lock.
- At most 2 content batch PRs open at once (R10), to keep the sponsor's review load bounded.

### 3.5 Owners and acceptance responsibilities

- **Content (US-8.2, US-8.3):** technical-research writes, product-owner reviews as the non-author (assumption carried from file 05; reassignable), the sponsor's PR review is the human accuracy check. **Agents never approve a content PR for the sponsor.**
- **Story acceptance:** the PO (or the sponsor acting as PO) accepts each story on its issue; agents post evidence comments only.
- **Merges:** the human owner only, after the "ready to merge" comment (RA-1).
- **Deploy:** no agent runs or triggers a production deploy without SD-8 and SD-9.

### 3.6 Risks

| ID | Risk | Impact | Mitigation | Owner |
| --- | --- | --- | --- | --- |
| R-1 | After T-23 to T-25 the bank has about 24 reviewed questions in 3 topics; US-8.1 needs 60 in 8 topics with 5 per topic. `content:validate:release` fails, and the release gate runs it (T-33 Info) | The release candidate cannot meet the MVP content threshold in Sprint 2 | Treat the first deploy as a sponsor decision (SD-9): wait for Sprint 3 (recommended) or publish a labelled preview below the threshold | project-manager, release-manager, sponsor |
| R-2 | T-20 deploys on every push to `main`, so merging T-20 deploys at once (if Pages is enabled) | Unplanned public release | Tech-lead and devops design the trigger so the first deploy happens only after the go/no-go (for example a manual trigger), or the owner holds the T-20 merge until SD-9 | devops-platform, tech-lead |
| R-3 | Sponsor review load: 3 content PRs, manual passes, and acceptance of US-1 to US-4 | Merge latency | At most 2 batch PRs open; evidence comments short and linked; content batches early in the sprint | project-manager |
| R-4 | T-16 finds more failures than T-17's 2 points cover | T-17 grows | Tech-lead re-splits T-17 into a follow-up; do not skip tests | tech-lead |
| R-5 | Lighthouse Performance >= 90 on mobile fails | SC-5 at risk, T-18 red | Baseline first, then a fix task; never lower the threshold without a PO/sponsor decision | performance-engineer |
| R-6 | Repository settings not in place (Pages, branch protection) | T-20 blocked; merges unprotected | SD-7, SD-8; observe the settings before dispatch (RA-2) | sponsor, agile-orchestrator |
| R-7 | `reviewedBy` value not decided before the first reviewed question merges | Public repository history contains reviewer names | SD-5 before T-23 merges; default assumption until then: role pseudonym, for example `product-owner-agent` | sponsor |
| R-8 | Usage limit mid-session (Pro, shared with chat) | Lost session | Checkpoint and handover per the sprint-sizing stop rules; never buy extra usage | agile-orchestrator |

### 3.7 Decisions needed from the sponsor

| ID | Decision | Recommended option | Needed before | Work that continues meanwhile |
| --- | --- | --- | --- | --- |
| SD-1 | Accept US-1 (#7) and US-2 (#8) from the evidence comments | Accept; note that US-2.2's resume part is deferred to US-6 | Sprint 2 review | Everything |
| SD-2 | Confirm T-12-D01 / DQ-1: Exit and Back clear the in-memory session, without confirmation, until US-6 adds resume | Confirm (matches US-2.8 and FR-26) | US-2 acceptance | Everything |
| SD-3 | DQ-5: should "Choose another topic" preselect the topic just played? | Yes, as a small follow-up task; it is not in the AC | Optional | Everything |
| SD-4 | Designer confirmation of `feedback.explanationCodeLabel` and the T-13 deviations (routine; for the sponsor's information) | Coordinator dispatches the ui-ux-designer check | US-3 acceptance | Everything |
| SD-5 | `reviewedBy` privacy: a pseudonym, or drop it from the production emit | Role pseudonym in the source files and drop the field from the production emit | T-23 merge (and T-20 deploy) | T-16 to T-18 |
| SD-6 | Dependabot majors #56 (eslint 10), #57 (@types/node 26), #58 (@eslint/js 10) | Close #57 (Node is pinned to 22); keep #56 and #58 open until the tech-lead checks plugin compatibility as a separate task | Any change to `package.json` | Everything else |
| SD-7 | Turn on branch protection on `main` with the required checks (sponsor applies; agents do not change permissions) | Require PRs and the CI checks lint/typecheck/test/build/budgets/audit, dependency review and E2E; keep Node 24 informational | As soon as possible | Everything |
| SD-8 | Enable GitHub Pages with the "GitHub Actions" source | Enable, at no cost for a public repository | First T-20 deploy run | T-20 can be written and reviewed |
| SD-9 | First public deploy: wait for 60 reviewed questions (Sprint 3), or publish a preview with about 24 questions in 3 topics | Wait for Sprint 3; prepare the release candidate in Sprint 2 | After the release-manager go/no-go | Everything |
| SD-10 | Sprint 2 capacity and calendar | Keep 5 sessions; dates may follow your actual pace | Non-blocking | Everything |
| SD-11 | US-13 dark mode: verify and accept now, or keep it in the backlog (RA-5) | Keep it in the backlog; verify in Sprint 3 | Non-blocking | Everything |

### 3.8 Definition of Done reminders

A task is DONE only when all of these are true:

- Each acceptance criterion has a named test `T-US<n>-<k>` at the lowest level that proves it, with at least 1 Playwright test for each user-visible criterion; the matrix row shows the CI run ID.
- CI is green on the final PR head: lint, typecheck, test, build, budgets, audit, dependency review, and E2E (Chromium 6 viewports + `webkit-iphone`). No check is skipped, weakened or made informational to get a green result.
- Accessibility DoD (TL standard 9): native radios in `fieldset`/`legend`, visible focus, focus moves per G4, targets >= 44 px, reduced motion, forced colours, a title per view, 0 serious/critical axe issues, light and dark.
- Security: text-only rendering, no inline scripts, https-only data links, no third-party origins, CSP intact, no secrets.
- A tech-lead review and an independent security review are dispositioned, with fixes pushed **before** the "ready to merge" comment (RA-1).
- Content PRs: non-author review against the cited primary source, `reviewedBy` per SD-5, `content:validate` clean, and the sponsor's own PR review recorded.
- The human owner merged the PR. The coordinator closes the task only after the merge is verified on GitHub.
- A story is DONE when every task is merged, its manual checks are recorded, and the PO has accepted it on the issue. **Merged does not mean deployed:** deployment is a separate state with its own evidence.

### 3.9 Tracking

Each session resumes from `docs/project-state.md` and `docs/planning/00-handover.md`, reconciles Issues, PRs and CI, records sessions and delegations used (RA-4), and ends with the PM report. No continuous monitoring: status is current only as of the last recorded session.

---

## 4. Inconsistencies found in the planning records

| ID | Where | Finding | Proposed fix | Owner |
| --- | --- | --- | --- | --- |
| X-1 | File 05 §1.4 and §2.4 | T-21's path is `docs/adr/0001-static-spa-github-pages.md`; the ADR in the repository is `docs/adr/0001-architecture.md` | Leave file 05 as a historical record; this file and `project-state.md` use the real path | project-manager |
| X-2 | File 05 R9; `standards/sprint-sizing.md` | "#45" refers to the team kit's pilot-review issue, but in this repository #45 is T-27 (content batch 5) | Read "#45" in those places as the kit issue, not this repository's | project-manager |
| X-3 | File 05 §2.1 and project-state | Sprint 1 dates (2026-10-26 to 11-08) do not match the actual work (all on 2026-10-21) | Recorded in section 1.1; calendar is SD-10 | project-manager |
| X-4 | File 05 §1.3, §3 | The US-8 split (T-23 to T-30, 1 point each) and the batch owners are marked "TL confirmation pending"; no confirmation is recorded, but the issues already exist | Tech-lead confirms the split when T-23 is dispatched | tech-lead |
| X-5 | `docs/qa/ac-test-matrix.md` | The header says every row is "NOT RUN"; the T-13 to T-15 notes say "local run, CI not yet observed", although PRs #71 and #72 merged with CI green | Refresh under T-16 (RA-6); outside this delegation's paths | qa-automation |
| X-6 | Ledger, `docs/design/` | "T-12-D01" is both a delegation ID and a decision ID (Exit/Back); "T-14-D01" is a decision while "T-14-15-D01" is the delegation | New decisions use `DEC-<n>` (RA-6); existing IDs kept, with SD-2 naming the meaning | project-manager |
| X-7 | Ledger | Review IDs are not recorded for every PR: T-19, T-04 and T-21 have none; T-02 shows only SEC-R01; T-05, T-07 and T-11 show no security ID. The coordinator verified on GitHub that every PR had both reviews | Add review IDs to the ledger from Sprint 2 (RA-4) | agile-orchestrator |
| X-8 | #63 T-33 L6 | Assigned to T-08 (#28), which is closed; whether L6 was done in T-08 is not verified | Tech-lead checks when sizing T-33 | tech-lead |
| X-9 | #39 T-20 vs release gate | T-20 deploys from `main`; the release gate runs `content:validate:release`, which cannot pass in Sprint 2 (R-1, R-2) | SD-9; trigger design in T-20 | devops-platform, sponsor |
| X-10 | Old `docs/planning/00-handover.md` and `docs/project-state.md` | Both showed early states (Gate 4; Sprint 1 morning) | Refreshed by this delegation | project-manager |
