# Backlog and Sprint Plan: ApiQuiz (`api-quiz`)

- **Delegation:** QUIZ-PLAN-D05 (project-manager / Scrum Master), phase BACKLOG_READY (`workflows/project-bootstrap.md` Gate 3); updated by QUIZ-PLAN-D07 (2026-10-21) for the PO-amended brief (QUIZ-DISC-D06)
- **Inputs:** `01-product-brief.md` (QUIZ-DISC-D01), `02-requirements-analysis.md` (QUIZ-DISC-D02), `03-architecture-adr.md` (QUIZ-ARCH-D03), `04-tech-lead-review.md` (QUIZ-ARCH-D04). IDs US-n, FR-n, NFR-n, SC-n, A-n, G-n, D-n, T-n, V-n refer to those files.
- **Standards applied:** `.claude/skills/agile-planning/SKILL.md`, `workflows/backlog-quality-gates.md`, `standards/sprint-sizing.md` (v2), `templates/sprint-plan-template.md`, `templates/project-state-template.md`, `templates/project-plan.example.json`.
- **Status:** Proposed plan. Sponsor decisions D1-D4 are DECIDED (2026-10-21, recorded in file 01 section 6); the plan itself is not sponsor-approved line by line. Capacity (5 sessions) is still an assumption. Date: 2026-10-21.
- **Evidence state:** Nothing has been implemented, built, tested, reviewed, merged or deployed. No repository `api-quiz-app` exists yet (Gate 5 provisioning has not run; D1/D2 now allow it). Every item below is BACKLOG or READY only.
- **Labels:** *Fact* = in the inputs. *Assumption* = PM default, reversible. *Decision needed* = sponsor or PO.

---

## 1. Final prioritized backlog

### 1.1 Amendments and resolutions: disposition

The PO owns the AC. **Update 2026-10-21 (QUIZ-DISC-D06):** the PO accepted every item below, flagged and non-flagged, and wrote them into file 01 as numbered criteria `US-n.k`; section 4 now carries those criteria verbatim. The former PO-flag column now records the PO decision. No PO acceptance is outstanding.

**BA amendments (file 02, section 6)**

| Item | Disposition | Why | PO decision (D06) |
| --- | --- | --- | --- |
| US-1 (a) counts use reviewed questions only | Accepted | Required by US-7 draft exclusion; otherwise counts would be wrong in production | Accepted (US-1.1) |
| US-1 (b) Mixed shows total, hidden when only 1 topic, relaxes ≥ 3-topic rule when fewer topics exist, N = min(10, total) | Accepted | Removes a failure state in the brief AC (Mixed impossible with < 3 topics) | Accepted (US-1.1, 1.2, 1.4) |
| US-1 (c) seeded shuffle replaces "order differs" | Accepted (also TL resolution 4) | "Order differs" is not deterministically testable | Accepted (US-1.5) |
| US-1 (d) double Start creates 1 quiz | Accepted | Edge case, no scope cost | Accepted (US-1.6) |
| US-2 (a) true/false not shuffled | Accepted | Convention; avoids "False, True" confusion | Accepted (US-2.2) |
| US-2 (b) option order fixed for the quiz incl. resume; (c) `aria-disabled` Submit with hint; (d) double Submit records 1 answer | Accepted | Needed for FR-4/FR-16 and accessibility; no scope cost | Accepted (US-2.2, 2.3, 2.5) |
| US-3 (a) live region verdict then focus to Next (G4); (b) source link new tab with cue | Accepted | Resolves a real a11y contradiction (G4) | Accepted (US-3.2, 3.3) |
| US-3 (c) per-question "Report a problem" link | Accepted; D2 decided: prefilled GitHub new-issue link with the `question-report` form (new task T-22) | FR-23; link builder uses a configurable base URL | Accepted: GitHub issue form link (US-3.5, 3.6; A13) |
| US-4 (a) half-up rounding, (b) breakdown only for multi-topic, (c) band messages | Accepted | Makes AC testable | Accepted (US-4.1-4.3) |
| US-5 (a) retry-missed excluded from best score, reshuffles options; (b) repeatable; (c) works for N = 1 | Accepted | G7 resolution | Accepted (US-5.2-5.5) |
| US-6 (a)–(f) exact resume, safe discard, replace confirmation, write-error tolerance, reset only app keys, Mixed own best score | Accepted, **except** the multi-tab "changed in another tab" prompt (see TL 3) | Robustness and privacy; prevents crashes from untrusted storage | Accepted (US-6.1-6.8) |
| US-7 (a)–(g) option IDs, option counts, https source, `reviewedBy` when reviewed, versions, controlled topics, release thresholds | Accepted | Needed for stable resume and content integrity (G2, G3, T2) | Accepted (US-7.1-7.6) |
| US-8 at least 1 human approval per content PR (G11) | Accepted; D4 decided: the sponsor's PR review is the human check | AI-only review is weak assurance for G4 | Accepted as sponsor PR review, D4 (US-8.3) |
| US-9 reflow at 320 CSS px (400% at 1280) plus 200% text; short landscape 640x360 | Accepted | WCAG 1.4.10 correctness (G5) | Accepted (US-9.1, 9.4, 9.5) |
| US-10 (a)–(d) forced colours, per-view title, focus after Exit/404/results, keyboard-reachable code box | Accepted | WCAG 2.2 AA conformance | Accepted (US-10.2, 10.4, 10.6) |
| US-12 (a)–(e) report channel, unknown-topic deep link, deep-link refresh, slow-load message, chunk-failure Retry | Accepted | Removes dead ends (NFR-9) | Accepted (US-12.1-12.5) |

**Tech-lead resolutions (file 04, section 5)**

| # | Resolution | Disposition | Why / effect |
| --- | --- | --- | --- |
| 1 | Sprint 1 = Bootstrap T-01..T-04 + US-7 + US-1 + US-2; US-3 stretch; US-4, T-16/T-17, T-18 to Sprint 2 | Accepted, with a mid-sprint de-scope checkpoint (section 2.6) | 3 stories meets the pilot cap; delegation count is at the edge of capacity, so a checkpoint protects the goal |
| 2 | US-9/US-10 not double-counted: a11y/responsive DoD on every UI task; stories close with T-16/T-17 plus manual NVDA/VoiceOver and iOS Safari pass after US-4 | Accepted | Points sit on T-16/T-17 only; manual pass recorded as part of US-9/US-10 AC |
| 3 | Defer multi-tab "changed in another tab" prompt (BA-default) to R2; last-write-wins plus FR-20 validation | Accepted | Over-built for P1; FR-20 already prevents crashes. PO accepted (US-6.7, A14) |
| 4 | US-1 order asserted by seeded shuffle in unit tests only | Accepted | Same as BA US-1 (c) |
| 5–7 | ADR updates: test table (adjustments 4, 6), data loading via `?url` + early fetch (adjustment 3), CSP build-only and E2E against preview (adjustment 1) | Accepted, new task **T-21** (software-architect) | Keeps ADR-0001 consistent with what T-01..T-06 implement |
| 8 | No deploy workflow or remote repo until D2; deploy task 2 points after D2 | Accepted, new task **T-20** (devops-platform). D2 decided 2026-10-21 (public repo, GitHub Pages): T-20 is unblocked but stays out of Sprint 1 | Each production deployment still follows release go/no-go and the human merge |

**Added by PM:** **T-19** QA initial test strategy (qa-automation), required by Gate 3 and by the Definition of Ready ("QA mapped each acceptance criterion"). It is the first Sprint 1 task.

**Added by PM (QUIZ-PLAN-D07):** **T-22** `question-report` issue form (devops-platform, 1 point, Sprint 2 with US-3; US-3.6). **T-23..T-30** US-8 per-topic content batches (1 point each). **US-6** re-estimated from 2 to 5 points (split proposal in section 1.3). The US-8 and US-6 estimates are PM proposals; `tech-lead` confirms before they are Ready.

**Estimates:** story points come from the tech-lead breakdown where one exists (US-1, US-2, US-3, US-4, US-7, US-9/US-10 slice). Stories not yet broken down carry the PO estimate, marked "PO est., TL breakdown pending"; they cannot be Ready until `tech-lead` confirms. Estimates that the amendments probably invalidate are flagged.

### 1.2 Epics

| Key | Epic | Stories / tasks |
| --- | --- | --- |
| EP-1 | Quiz practice flow | US-1, US-2, US-3, US-4, US-5, US-6, US-11 |
| EP-2 | Question bank content and quality | US-7, US-8 (T-23..T-30) |
| EP-3 | Responsive, accessible, deployable experience | US-9, US-10, US-12, US-13, T-18 (SC-5), T-20 (deploy), T-22 (report form) |
| EP-4 | Engineering foundation and delivery workflow | T-01, T-02, T-03, T-04, T-19, T-21 |

### 1.3 Stories (priority order = delivery order)

| Rank | Key | Title | Epic | Pri | Points | Estimate source | Depends on | Planned sprint |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | US-7 | Question bank schema and validation | EP-2 | P0 | 5 (T-05 3 + T-06 2) | TL | none (tasks need T-01) | 1 |
| 2 | US-1 | Choose a topic and start a quiz | EP-1 | P0 | 7 (T-07 2 + T-08 3 + T-09 2) | TL | US-7 | 1 |
| 3 | US-2 | Answer a question | EP-1 | P0 | 6 (T-10 2 + T-11 1 + T-12 3) | TL | US-1 | 1 |
| 4 | US-3 | Immediate feedback with explanation | EP-1 | P0 | 4 (T-13 3 + T-22 1) | TL (T-13), PM (T-22) | US-2 | T-13 1 stretch, else 2; T-22 2 |
| 5 | US-4 | Results summary and score | EP-1 | P0 | 3 (T-14 1 + T-15 2) | TL | US-3 | 2 |
| 6 | US-9 | Responsive layout for mobile and desktop | EP-3 | P0 | 5 shared with US-10 (T-16 3 + T-17 2) | TL | US-1..US-4 | 2 |
| 7 | US-10 | Accessibility to WCAG 2.2 AA | EP-3 | P0 | shared with US-9 (see above) + manual SR pass | TL | US-1..US-4 | 2 |
| 8 | US-8 | Initial reviewed question bank (≥ 60) | EP-2 | P0 | 8 (T-23..T-30, 8 per-topic batches × 1, about 8 questions each) | PM split, TL confirmation pending | US-7 (batches need T-05) | 2 (batches 1-3), 3 |
| 9 | US-5 | Review answers and retry missed | EP-1 | P1 | 2 PO est. | PO est., TL breakdown pending | US-4 | 2/3 |
| 10 | US-6 | Local best score and resume quiz | EP-1 | P1 | 5 (re-estimated from 2; proposed split: storage adapter and validation 2, best score 1, resume/replace/reset UI 2) | PM re-estimate, TL breakdown pending | US-4 | 3 |
| 11 | US-12 | Landing/about, error and empty states | EP-3 | P1 | 1 PO est. (404, loading and data-failure parts already in T-08/T-09) | PO est., TL breakdown pending | US-1 | 3 |
| 12 | US-11 | Difficulty filter and quiz length | EP-1 | P2 | 2 PO est. | PO est. | US-1, US-8 | later |
| 13 | US-13 | Dark mode / system colour scheme | EP-3 | P3 | 1 PO est. | PO est. | US-9, US-10 | later |

### 1.4 Tasks

| Key | Parent | Owner | Points | Depends on | Notes |
| --- | --- | --- | --- | --- | --- |
| T-19 | EP-4 | qa-automation | 2 | none | QA initial test strategy and AC-to-test matrix (PM-added) |
| T-01 | EP-4 | devops-platform | 3 | none | Bootstrap app skeleton, lint, CSP-at-build |
| T-02 | EP-4 | devops-platform | 2 | T-01 | CI workflow, budgets, dependency review |
| T-03 | EP-4 | qa-automation | 3 | T-02 | Playwright harness and helpers (serial on `ci.yml`) |
| T-04 | EP-4 | ui-ux-designer | 3 | none | Design specs (Landing, Question, Feedback, Results, error/loading) |
| T-21 | EP-4 | software-architect | 1 | none | ADR-0001 update per TL adjustments 1, 3, 4, 6 |
| T-05 | US-7 | backend-developer | 3 | T-01 | Content schema and validator |
| T-06 | US-7 | backend-developer | 2 | T-05 | Content build/emit and loader |
| T-07 | US-1 | frontend-developer | 2 | T-06 (types; may start on stub) | Domain: RNG and createQuiz |
| T-08 | US-1 | frontend-developer | 3 | T-01, T-04, T-06 | App shell, hash router, loading/error |
| T-09 | US-1 | frontend-developer | 2 | T-07, T-08 | Landing view |
| T-10 | US-2 | frontend-developer | 2 | T-01 | Safe rich-text renderer (V-1) |
| T-11 | US-2 | frontend-developer | 1 | T-07 | Domain: submit and next |
| T-12 | US-2 | frontend-developer | 3 | T-08, T-10, T-11 | Question view |
| T-13 | US-3 | frontend-developer | 3 | T-12 | Feedback, external link, report link |
| T-14 | US-4 | frontend-developer | 1 | T-11 | Domain: score |
| T-15 | US-4 | frontend-developer | 2 | T-13, T-14 | Results view |
| T-16 | US-9/US-10 | qa-automation | 3 | T-03, T-15 | Flow and responsive E2E |
| T-17 | US-9 | frontend-developer | 2 | T-16 | Responsive/contrast fixes |
| T-18 | EP-3 (SC-5) | performance-engineer | 2 | T-03, T-09 | Lighthouse CI |
| T-20 | EP-3 | devops-platform | 2 | T-02 (D2 decided) | GitHub Pages deploy workflow plus V-7 live checks; Sprint 2 candidate, not Sprint 1 |
| T-22 | US-3 | devops-platform | 1 | T-01 | `question-report` issue form (US-3.6); Sprint 2 with US-3 |
| T-23..T-30 | US-8 | technical-research (author); product-owner non-author review (assumption) | 1 each | T-05 | Per-topic batches in A5 order: HTTP fundamentals, methods/idempotency, status codes, REST design, auth, versioning, pagination/filtering/rate limiting, GraphQL; one PR each for the sponsor's review; batch 8 also proves `--release` thresholds |

Allowed paths for T-01..T-18 are as listed in `04-tech-lead-review.md` section 4. New tasks: T-19 `docs/qa/test-strategy.md`, `docs/qa/ac-test-matrix.md`; T-20 `.github/workflows/deploy.yml`; T-21 `docs/adr/0001-static-spa-github-pages.md`; T-22 `.github/ISSUE_TEMPLATE/question-report.yml`; T-23..T-30 one topic file each under `content/questions/` (exact file names set by T-05).

---

## 2. Sprint 1 plan

### 2.1 Header (sprint-plan template)

- **Sprint:** 1 (pilot sprint)
- **Dates:** Monday 2026-10-26 to Sunday 2026-11-08 (14 days). Sprint review and retro in the last session of the sprint.
- **Why this start date:** D1–D4 were decided on 2026-10-21 (Gate 4 decisions answered); the five days leave time for Gate 5 provisioning of the public `api-quiz-app` repository. If provisioning is not complete by 2026-10-26, Sprint 1 still starts in a **local** git repository with feature branches and pushes once the remote exists; see risk R1.
- **Sprint goal:** *A validated question bank feeds a working, accessible quiz start: a candidate opens the app, picks a topic or Mixed, and answers questions one per screen, built on a CI pipeline that enforces lint, types, content validation, CSP and size budgets.*
- **Capacity and availability (assumption):** the sponsor's expected sessions for this sprint are not recorded. PM assumes **5 sessions** (middle of 4–6). Capacity = 5 − 1 reserve = **4 working sessions × up to 6 delegations ≈ 24 delegations**, and 3–4 stories; pilot rule caps the commitment at **3 stories**.
- **Sessions planned:** 5 (4 working + 1 reserve). If the sponsor confirms only 4 sessions, US-2 moves to Sprint 2 (de-scope order in 2.6).
- **Commitment:** 3 stories (US-7, US-1, US-2) + foundation tasks (T-01..T-04, T-19, T-21) = **32 points**, estimated **≈ 23 delegations**. Stretch: US-3 (3 points).

### 2.2 Committed backlog items

| ID | Outcome | Owner | Points | Est. delegations | Dependencies | Acceptance check | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T-19 | QA test strategy and AC-to-test matrix (US-7, US-1, US-2 first, rest outline) | qa-automation | 2 | 1 | none | Every AC of US-7/US-1/US-2 mapped to test ID `T-US<n>-<k>`, level, automation flag, data, evidence; rest of US-3..US-13 at outline level | Low |
| T-21 | ADR-0001 reflects TL adjustments | software-architect | 1 | 1 | none | ADR test table, data loading and CSP sections match file 04 adjustments 1, 3, 4, 6 | Low |
| T-01 | Buildable skeleton with lint, boundaries, CSP at build | devops-platform | 3 | 1 | none | `npm ci`, `npm run check`, `npm run build` pass; `dangerouslySetInnerHTML` fixture fails lint; boundary rule works; `base` `/api-quiz-app/`; CSP meta and no inline script in built `index.html` | Medium (CSP vs Vite output) |
| T-04 | Design specs for Sprint 1–2 views | ui-ux-designer | 3 | 1 | none | Tokens with contrast ratios, ≥ 44 px targets, layouts 320/768/1280, focus order (G4), non-colour markers | Low |
| T-02 | CI on PRs with budgets and supply-chain controls | devops-platform | 2 | 1 | T-01 | PR runs lint, typecheck, unit, `content:validate`, build, 200 KB JS budget (250 KB fixture fails), SHA-pinned actions, `contents: read`, dependency review, `npm audit --audit-level=high` | Medium (Actions minutes if private) |
| T-03 | E2E harness against preview | qa-automation | 3 | 1 | T-02 | Helpers: no horizontal scroll, axe serious/critical, offline-after-load 0 requests, same-origin; smoke test passes in CI | Medium |
| — | Foundation reviews | tech-lead, code-review-security | — | 2 | T-01..T-03 | Review findings recorded and dispositioned | — |
| US-7 | Schema validation and content build (T-05, T-06) | backend-developer | 5 | 4 (2 impl + 2 reviews; QA in task tests) | T-01 | Story AC in section 4 JSON | Low |
| US-1 | Start a quiz (T-07, T-08, T-09) | frontend-developer | 7 | 6 (3 impl + QA + 2 reviews) | US-7, T-04 | Story AC in section 4 JSON; E2E `T-US1-*` | Medium (LCP, router) |
| US-2 | Answer a question (T-10, T-11, T-12) | frontend-developer | 6 | 6 (3 impl + QA + 2 reviews) | US-1 | Story AC in section 4 JSON; E2E `T-US2-*`; V-1 renderer tests | Medium (renderer security) |
| **Total** | | | **32** | **≈ 23** | | | |

Stretch (not committed): **US-3 / T-13** (3 points, ≈ 3 delegations). Pulled in only if all committed items are In Review by the end of session 4 and the reserve session is not needed.

Points arithmetic: T-19 2 + T-21 1 + T-01 3 + T-04 3 + T-02 2 + T-03 3 = 14; US-7 5 + US-1 7 + US-2 6 = 18; total 32. (TL's 29 = bootstrap 11 + 18; PM adds T-19 2 + T-21 1.)

Review batching (assumption, to save delegations): one `tech-lead` review delegation per story's PR set and one `code-review-security` delegation for security-relevant sets (foundation T-01/T-02, US-7 validator, US-2 renderer). US-1 gets a tech-lead review plus a light security check folded into the US-2 security review (router and loader have no data-to-markup path). Every PR still gets reviewed before the human merge.

### 2.3 Task order and session plan

| Session | Delegations (in order) | Count |
| --- | --- | --- |
| S1 | T-19 (QA strategy), T-01, T-04, T-21, tech-lead review of T-01 | 5 |
| S2 | T-02, T-05, T-03, code-review-security of T-01/T-02, tech-lead review of T-02/T-03 | 5 |
| S3 | T-06, tech-lead + security review of US-7, T-07, T-10, T-11 | 6 |
| S4 | T-08, T-09, T-12, QA validation US-1 and US-2 (one delegation), tech-lead review US-1/US-2, security review US-2 | 6 |
| S5 (reserve) | fixes from reviews/CI, carried-over item, or stretch T-13; sprint review and retro | ≤ 6 |

Total working delegations S1–S4: 22, plus ≈ 1 fix = ≈ 23. S4 is full; any rework spills into S5.

### 2.4 Dependencies and serial chains

- **Gate chain (blocks start of coding on GitHub):** D1 and D2 decided 2026-10-21 → Gate 5 provisioning (public repo `api-quiz-app`, not yet done) → remote. Until provisioned: local repository only.
- **`ci.yml` chain:** T-02 → T-03 (→ T-18 in Sprint 2). Single writer of `.github/workflows/ci.yml`.
- **`src/domain/types.ts` chain:** T-07 → T-11 (→ T-14 in Sprint 2).
- **`package.json` chain:** T-01 → T-06 (scripts) → any later dependency change.
- **Question view chain:** T-12 → T-13 (stretch).
- **Content chain:** T-05 → T-06 → T-07 (real types; stub allowed) and T-08.
- **Design gate:** T-04 → T-08 (app shell uses tokens).
- **Parallel-safe (only with separate worktrees/branches and non-overlapping paths):** T-04, T-19, T-21 (docs only) alongside T-01; T-05/T-06 with T-07, T-10, T-11 after T-01. Default WIP is **1 implementation delegation per shared working tree** (agile-planning skill); docs-only tasks may use a second worktree.
- **Merge dependency:** chained PRs need the predecessor merged by the human owner, or stacked branches. See R3.

### 2.5 Definition of Ready check (committed items)

Legend: Y = met, P = partially met / pending named action, N/A = not applicable.

| DoR item | T-19 | T-21 | T-01 | T-04 | T-02 | T-03 | US-7 | US-1 | US-2 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Clear outcome, bounded scope | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Testable AC incl. negative/boundary | Y | Y | Y | Y | Y (250 KB fixture) | Y | Y (failing fixtures) | Y | Y |
| Priority set | Y | Y | Y | Y | Y | Y | Y P0 | Y P0 | Y P0 |
| Estimate set | Y 2 | Y 1 | Y 3 | Y 3 | Y 2 | Y 3 | Y 5 | Y 7 | Y 6 |
| Dependencies listed | Y none | Y none | Y none | Y none | Y T-01 | Y T-02 | Y | Y | Y |
| QA mapped each AC | N/A (is the mapping) | N/A | P (T-19) | N/A (design review by tech-lead/UX) | P (T-19) | P (T-19) | **P: T-19 first** | **P: T-19 first** | **P: T-19 first** |
| QA issue decision recorded | N/A | N/A | Y: tests in task | N/A | Y: tests in task | Y: is QA task | Y: tests in T-05/T-06, no separate QA issue | Y: separate QA validation delegation, E2E in story | Y: as US-1 |
| Test data/environment known | Y | N/A | Y | N/A | Y | Y (fixture bank) | Y (seed drafts, failing fixtures) | Y (fixture bank via `page.route`) | Y |
| Security/privacy/a11y/perf considered | Y | Y | Y (CSP, lint) | Y (contrast, targets) | Y (T3) | Y (axe, offline) | Y (T1, T2) | Y (a11y DoD, LCP) | Y (V-1, a11y DoD) |
| DoD and exit criteria explicit | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Owner and allowed scope clear | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| PO acceptance of amended AC | N/A | N/A | N/A | N/A | N/A | N/A | Y (D06) | Y (D06, US-1.1-1.9) | Y (D06, US-2.1-2.9) |
| **Result** | **READY** | **READY** | **READY** | **READY** | BACKLOG until T-01 done | BACKLOG until T-02 done | **BACKLOG → READY after T-19** | **BACKLOG → READY after T-19** | **BACKLOG → READY after T-19** |

READY here means "DoR met"; nothing can actually start until Gate 4/5 (or the local-repo fallback) is in place.

### 2.6 Risks and mitigations

| ID | Risk | Impact | Mitigation | Owner |
| --- | --- | --- | --- | --- |
| R1 | Gate 5 provisioning (public `api-quiz-app`, verified rulesets) not complete by 2026-10-26 (D1/D2 now decided) | Sprint starts without GitHub PRs/CI | Start in a local repo with feature branches; push and open PRs once provisioned; CI evidence deferred and reported as NOT RUN | agile-orchestrator |
| R2 | Delegation capacity at the edge (≈ 23 of ≈ 24) | US-2 not finished | Checkpoint at end of S2: if T-01, T-02, T-05 are not In Review, US-2 moves to Sprint 2 (de-scope order: stretch US-3 first, then US-2, then T-21) | project-manager |
| R3 | Human merge latency on chained PRs (T-01 → T-02 → T-03, T-05 → T-06 → T-07) | Idle sessions | Ask owner to merge foundation PRs within ~1 day; stacked branches as fallback; schedule parallel-safe tasks while waiting | agile-orchestrator / sponsor |
| R4 | CSP meta vs Vite output (module preload polyfill, inline styles) | T-01 rework | TL adjustment 1; disable polyfill rather than adding `unsafe-inline` | devops-platform |
| R5 | Lighthouse mobile ≥ 90 (LCP) fails once UI exists | SC-5 at risk | Early fetch in entry, shell before data (TL); T-18 in Sprint 2 sets the baseline | frontend-developer / performance-engineer |
| R6 | Public repo (D2 decided): Pages and Actions are $0, but content and issues are public | Low cost risk; public exposure of history | No secrets in repo (already policy); issue form warns about public usernames/PII (T-22); any paid plan or custom domain still needs sponsor approval | agile-orchestrator |
| R7 | (Closed 2026-10-21) PO-flagged AC not accepted | — | PO accepted all amendments (QUIZ-DISC-D06) | product-owner |
| R10 | Sponsor review load on US-8 content PRs (8 batches of about 8 questions) | US-8 merge latency in Sprints 2-3 | One topic per PR; at most 2-3 batch PRs open at once; schedule batches 1-3 early in Sprint 2 | project-manager / sponsor |
| R8 | Usage limit warning mid-session (Pro, shared with chat) | Lost session | Checkpoint and handover per sprint-sizing stop rules; never buy extra usage | agile-orchestrator |
| R9 | First real usage unknown (pilot) | Plan inaccurate | Record sessions and delegations per story; recalibrate at sprint review (#45) | project-manager |

### 2.7 Out of scope for Sprint 1

US-3 (stretch only), US-4, US-5, US-6, US-8 (only ~6 draft seed questions from T-05), US-9/US-10 closing tasks T-16/T-17, US-11, US-12 remainder, US-13, T-18 Lighthouse CI, T-20 deploy (unblocked by D2, planned later), T-22 issue form, T-23..T-30 content batches, any production deployment, any paid service.

### 2.8 Daily tracking approach

No continuous monitoring: status is current only as of the last recorded session. Each session: resume from `docs/project-state.md` and the handover; reconcile Issues/PRs/CI; one implementation delegation at a time per working tree; end-of-session report (`templates/daily-project-report-template.md`) with sessions used, delegations this session and any usage-limit warning; checks reported as PASS/FAIL/BLOCKED/NOT RUN with command and commit.

### 2.9 Completion criteria

Sprint goal met when US-7, US-1 and US-2 acceptance criteria pass in CI on PRs with recorded evidence, foundation tasks are reviewed, each PR is APPROVED_AWAITING_HUMAN_MERGE or DONE (merged by the owner), and the sprint review compares planned vs actual sessions and delegations.

### 2.10 Sprint 2 candidates (not committed)

In rank order: US-3 / T-13 (if not done as stretch), US-4 (T-14, T-15), T-16 and T-17 (closing US-9/US-10 plus manual NVDA/VoiceOver and iOS Safari pass), T-18 Lighthouse CI, T-22 `question-report` issue form (with US-3), US-8 batches T-23..T-25 (after TL confirms the split; sponsor reviews each PR), T-20 deploy (D2 decided; first production deploy follows release go/no-go), US-12 refinement. Capacity set at Sprint 1 review from observed usage.

---

## 3. Project state snapshot (project-state template)

### Snapshot

- **Project ID/name:** `api-quiz` / ApiQuiz, repository `api-quiz-app` (D1 decided 2026-10-21)
- **Last reconciled at (UTC):** 2026-10-21, from files 01–04 (file 01 as updated by QUIZ-DISC-D06) only. No repository, Issues, PRs or CI exist to reconcile.
- **Current phase:** BACKLOG_READY (Gate 3); Gate 4 sponsor decisions D1–D4 answered 2026-10-21; next is Gate 5 provisioning.
- **Goal and in-scope outcomes:** Anonymous, English, responsive, WCAG 2.2 AA quiz on API interview topics; static SPA; local-only progress; ≥ 60 reviewed questions (SC-1..SC-6).
- **Last known commit / branch:** none for the app (repository not created).
- **Current sprint and goal:** Sprint 1 proposed 2026-10-26 to 2026-11-08; goal in section 2.1. Not started.

### Approved decisions

| ID | Decision | Owner/date | Evidence or ADR |
| --- | --- | --- | --- |
| D1 | App name ApiQuiz, slug `api-quiz`, repository `api-quiz-app` | sponsor, 2026-10-21 | File 01 sections 5, 6 (F6); sponsor reply quoted in file 01 |
| D2 | Public repository, hosting on GitHub Pages ($0); report channel = prefilled GitHub issue link (A13) | sponsor, 2026-10-21 | File 01 section 6 (F7) |
| D3 | MVP has no accounts, no backend, browser-only storage (A1–A3 confirmed) | sponsor, 2026-10-21 | File 01 section 6 (F8) |
| D4 | Sponsor's PR review is the human accuracy check on content PRs, on top of non-author source review | sponsor, 2026-10-21 | File 01 section 6 (F9), US-8.3 |
| — | Proposed, not separately approved: ADR-0001 static SPA, single repo, GitHub Pages (consistent with D2/D3) | software-architect, 2026-10-21 (proposed) | `03-architecture-adr.md` section 7 |

### Assumptions and open questions

| Item | Type | Impact | Owner | Next action |
| --- | --- | --- | --- | --- |
| 5 sessions in Sprint 1 | Assumption (PM), open, non-blocking | Capacity, US-2 commitment | sponsor | Confirm expected sessions; if 4, apply de-scope order (2.6 R2) |
| Review batching per story | Assumption (PM) | Delegation count | agile-orchestrator | Validate at Sprint 1 review |
| US-6 = 5 points and US-8 split T-23..T-30 (1 point each) | Proposal (PM) | Sprint 2–3 capacity | tech-lead | Confirm or re-split before the items are Ready |
| US-8 batch owners (technical-research author, product-owner reviewer) | Assumption (PM) | Content delegations | agile-orchestrator | Confirm at Sprint 2 planning |
| OQ-3 resume has no expiry | Assumption (BA default) | US-6 | product-owner | None unless objected |

### Backlog and task ownership

Canonical statuses (orchestration contract). Nothing is implemented.

| Task ID | Status | Priority | Owner | Dependencies | Acceptance/evidence |
| --- | --- | --- | --- | --- | --- |
| T-19 | READY | P0 | qa-automation | none | Matrix file; no evidence yet |
| T-21 | READY | P1 | software-architect | none | ADR diff; no evidence yet |
| T-01 | READY | P0 | devops-platform | none (needs repo, Gate 5) | Commands in 2.2; NOT RUN |
| T-04 | READY | P0 | ui-ux-designer | none | Design specs; not started |
| T-02 | BACKLOG | P0 | devops-platform | T-01 | NOT RUN |
| T-03 | BACKLOG | P0 | qa-automation | T-02 | NOT RUN |
| US-7 (T-05, T-06) | BACKLOG | P0 | backend-developer | T-01, T-19 | NOT RUN |
| US-1 (T-07, T-08, T-09) | BACKLOG | P0 | frontend-developer | US-7, T-04, T-19 | NOT RUN |
| US-2 (T-10, T-11, T-12) | BACKLOG | P0 | frontend-developer | US-1, T-19 | NOT RUN |
| US-3 (T-13) | BACKLOG (S1 stretch) | P0 | frontend-developer | US-2 | NOT RUN |
| T-22 (US-3.6) | BACKLOG (Sprint 2) | P0 | devops-platform | T-01 | NOT RUN |
| US-4 (T-14, T-15) | BACKLOG | P0 | frontend-developer | US-3 | NOT RUN |
| US-9, US-10 (T-16, T-17) | BACKLOG | P0 | qa-automation / frontend-developer | US-1..US-4, T-03 | NOT RUN |
| US-8 (T-23..T-30) | BACKLOG (split proposed, TL confirmation pending) | P0 | technical-research (author), product-owner (review), sponsor PR review | US-7, T-05 | NOT RUN |
| US-5 | BACKLOG | P1 | frontend-developer | US-4 | TL breakdown pending |
| US-6 | BACKLOG | P1 | frontend-developer | US-4 | Re-estimated 5; TL breakdown pending |
| US-12 | BACKLOG | P1 | frontend-developer | US-1 | TL breakdown pending |
| T-18 | BACKLOG | P1 | performance-engineer | T-03, T-09 | NOT RUN |
| T-20 | BACKLOG (unblocked, not Sprint 1) | P1 | devops-platform | T-02 | NOT RUN |
| US-11 | BACKLOG | P2 | frontend-developer | US-1, US-8 | — |
| US-13 | BACKLOG | P3 | frontend-developer | US-9, US-10 | — |

### Active delegations

| Delegation ID | Task ID | Owner | Branch/worktree | Scope/allowed paths | Expected output | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| QUIZ-PLAN-D05 | Gate 3 plan | project-manager | none (provisioning folder) | `.provisioning/api-quiz/05-backlog-sprint-plan.md` | This file | Returned to orchestrator | This file |
| QUIZ-PLAN-D07 | Plan update for amended brief | project-manager | none (provisioning folder) | `.provisioning/api-quiz/05-backlog-sprint-plan.md` | This file | Returned to orchestrator | This file, change log |

No implementation delegations are active.

### Pull requests and verification

None. No repository exists.

### Risks and blockers

See section 2.6 (R1–R10). Current blocker for coding on GitHub: Gate 5 provisioning (D1/D2 decided).

### Sponsor decisions needed

- D1–D4: **DECIDED 2026-10-21** (see Approved decisions). Nothing else blocks Sprint 1.
- Open, non-blocking: confirm the number of sessions expected in Sprint 1 (assumed 5; if 4, US-2 moves to Sprint 2).
- Not a decision now: the first production deployment (T-20) follows the release go/no-go; any paid plan or custom domain needs separate approval.

### Next actions

1. agile-orchestrator: run Gate 5 provisioning of the public `api-quiz-app` repository from the section 4 backlog (or set up the local-repo fallback); ask the sponsor for the Sprint 1 session count.
2. tech-lead: confirm the US-6 re-estimate (5) and the US-8 batch split (T-23..T-30) before Sprint 2 planning.
3. Sprint 1 S1 (from 2026-10-26): dispatch T-19, then T-01, T-04, T-21 per section 2.3.
4. project-manager: S2-end de-scope checkpoint (R2); Sprint 1 review and retro in S5.

### Change log

| UTC timestamp | Previous phase | New phase | Reason | Evidence |
| --- | --- | --- | --- | --- |
| 2026-10-21 | ARCHITECTURE | BACKLOG_READY | Backlog and Sprint 1 plan prepared (QUIZ-PLAN-D05) | This file |
| 2026-10-21 | BACKLOG_READY | BACKLOG_READY | QUIZ-PLAN-D07: aligned with file 01 (QUIZ-DISC-D06). PO flags cleared; D1–D4 recorded as decided; story AC replaced with US-n.k text; T-20 unblocked (not Sprint 1); added T-22 issue form (Sprint 2) and US-8 batches T-23..T-30; US-6 re-estimated 2 → 5; R1/R6 updated, R7 closed, R10 added. Sprint 1 scope and 32 points unchanged | This file; file 01 change log |

---

## 4. Backlog (project-plan format)

`repo` is `app` for every item (single-repo architecture). `sprint: 1` only on committed Sprint 1 items. Tasks list their parent story/epic first in `depends_on`, as the example plan does for stories.

```json
[
  {
    "key": "EP-1",
    "type": "epic",
    "repo": "app",
    "priority": "P0",
    "title": "Quiz practice flow",
    "description": "A candidate picks a topic or Mixed, answers questions one per screen, gets feedback, sees results, reviews and retries, with local best score and resume."
  },
  {
    "key": "EP-2",
    "type": "epic",
    "repo": "app",
    "priority": "P0",
    "title": "Question bank content and quality",
    "description": "Validated question data files and an initial bank of at least 60 reviewed questions across at least 8 topics."
  },
  {
    "key": "EP-3",
    "type": "epic",
    "repo": "app",
    "priority": "P0",
    "title": "Responsive, accessible, deployable experience",
    "description": "WCAG 2.2 AA, responsive 320-1920 px, performance budgets, landing/error states and static deployment to GitHub Pages (D2 decided 2026-10-21; each production deploy follows release go/no-go)."
  },
  {
    "key": "EP-4",
    "type": "epic",
    "repo": "app",
    "priority": "P0",
    "title": "Engineering foundation and delivery workflow",
    "description": "Project skeleton, CI, E2E harness, design specifications, QA test strategy and ADR maintenance."
  },
  {
    "key": "US-1",
    "type": "story",
    "repo": "app",
    "priority": "P0",
    "sprint": 1,
    "title": "Choose a topic and start a quiz",
    "description": "As a job-seeking developer, I want to pick an API topic or a mixed quiz and start immediately, so that I can practise what I need without signing up. 7 points (T-07, T-08, T-09). AC US-1.1-US-1.9 accepted by the PO (QUIZ-DISC-D06).",
    "acceptance_criteria": [
      "US-1.1: Given the landing page has loaded, When I view it, Then I see, in the curated topic order, every topic that has at least 1 production-eligible (`reviewed`) question, each showing its eligible question count, plus a \"Mixed\" option showing the total eligible count.",
      "US-1.2 (edge): Given a topic has 0 eligible questions (for example only drafts), When the landing page loads, Then that topic is not shown. Given only 1 topic is shown, Then \"Mixed\" is hidden.",
      "US-1.3: Given I select a topic, When I press \"Start\", Then question 1 of N appears, where N = min(10, topic eligible count), and only questions from that topic are included.",
      "US-1.4: Given I select \"Mixed\", When I start, Then N = min(10, total eligible count) distinct questions are drawn from at least min(3, number of shown topics) different topics.",
      "US-1.5: Given a quiz starts, When questions and options are drawn, Then the question order and single-choice option order are produced by the injected seeded shuffle and fixed at quiz start. Unit tests assert the exact order for a known seed (this replaces \"the order differs between two quizzes\").",
      "US-1.6 (edge): Given I activate \"Start\" twice rapidly, When the quiz starts, Then exactly 1 quiz is created.",
      "US-1.7: Given the landing page, When I start a quiz, Then the first question is reached in at most 2 interactions (G1).",
      "US-1.8: Given a deep link to a valid topic, When it opens, Then that topic is preselected and the quiz does not auto-start.",
      "US-1.9 (DoD): The landing view has 0 serious or critical axe violations, is fully keyboard operable, and sets a per-view document title."
    ],
    "depends_on": [
      "EP-1",
      "US-7"
    ]
  },
  {
    "key": "US-2",
    "type": "story",
    "repo": "app",
    "priority": "P0",
    "sprint": 1,
    "title": "Answer a question",
    "description": "As a candidate, I want to read a question and choose one answer, so that I can test my knowledge. 6 points (T-10, T-11, T-12). AC US-2.1-US-2.9 accepted by the PO (QUIZ-DISC-D06).",
    "acceptance_criteria": [
      "US-2.1: Given a question is shown, When I view it, Then I see the question text, its topic, progress (\"3 of 10\"), and the options as a labelled single-select radio group.",
      "US-2.2: Given a single-choice question, When the quiz starts, Then its options are shuffled once and keep that order for the life of the quiz, including after resume. Given a true/false question, Then the options always appear as \"True, False\" (not shuffled).",
      "US-2.3: Given no option is selected, When I reach \"Submit\", Then it is unavailable (`aria-disabled`, still discoverable by assistive technology) and a hint tells me to choose an answer.",
      "US-2.4: Given I select an option, When I press \"Submit\", Then my answer is locked and cannot be changed.",
      "US-2.5 (edge): Given I press \"Submit\" twice, or \"Submit\" then \"Next\" rapidly, Then exactly 1 answer is recorded and the quiz advances exactly 1 question.",
      "US-2.6: Given a question contains a code or HTTP snippet, When it renders, Then the snippet is shown in a monospace block that wraps or scrolls inside its own focusable, labelled box without making the page scroll horizontally.",
      "US-2.7 (security): Given content containing `<script>`, `<img onerror>` or a `javascript:` URL, When it renders, Then it appears as literal text and never executes.",
      "US-2.8: Given I am mid-quiz, When I press browser Back or \"Exit quiz\", Then I return to the landing page and no submitted answer is un-submitted.",
      "US-2.9 (DoD): The question view has 0 serious or critical axe violations; selection and submit work keyboard-only."
    ],
    "depends_on": [
      "EP-1",
      "US-1"
    ]
  },
  {
    "key": "US-3",
    "type": "story",
    "repo": "app",
    "priority": "P0",
    "title": "Immediate feedback with explanation",
    "description": "As a candidate, I want to know right away whether I was correct and why, so that I learn from every question. 4 points (T-13 3 + T-22 1). Sprint 1 stretch for T-13 only, otherwise Sprint 2. Report channel is the public api-quiz-app repository's question-report issue form (D2, A13); T-22 must be merged before US-3 is released (US-3.6).",
    "acceptance_criteria": [
      "US-3.1: Given I submitted an answer, When feedback appears, Then it says \"Correct\" or \"Incorrect\" in text, marks the correct option and, when I was wrong, also marks my choice, using shape or icon plus text, not colour alone.",
      "US-3.2: Given feedback is shown, Then the explanation and the source link are shown. The source link opens in a new tab (`rel=\"noopener noreferrer\"`) with a visible and announced \"opens in new tab\" cue, and quiz state is preserved. A non-https source URL is not rendered as a link.",
      "US-3.3: Given I submitted an answer, When feedback appears, Then a polite live region announces the verdict and the correct option, and focus then moves to \"Next\".",
      "US-3.4: Given feedback is shown, When I press \"Next\", Then the next question appears. On the last question the button reads \"See results\".",
      "US-3.5: Given feedback is shown, Then a \"Report a problem with this question\" link opens, in a new tab with a cue, the prefilled GitHub new-issue page of the public `api-quiz-app` repository using the `question-report` issue form, titled \"[Question] <question id>\", carrying only the question ID and `contentVersion` (built with `URLSearchParams` from a configurable base URL). No answers, scores, device or personal data are included, and the app sends nothing automatically.",
      "US-3.6: Given the repository, Then a `question-report` issue form exists that asks what is wrong, states that issues and GitHub usernames are public, and asks reporters not to include personal data. (Required before US-3 is released; it is a repository file, not app code.)"
    ],
    "depends_on": [
      "EP-1",
      "US-2"
    ]
  },
  {
    "key": "US-4",
    "type": "story",
    "repo": "app",
    "priority": "P0",
    "title": "Results summary and score",
    "description": "As a candidate, I want a score at the end, so that I know how ready I am. 3 points (T-14, T-15).",
    "acceptance_criteria": [
      "US-4.1: Given I finished the last question, When results appear, Then I see my score as \"X / N\" and a whole-number percentage with half-up rounding (2/3 = 67%).",
      "US-4.2: Given results are shown, Then a band message matching the score is shown for 0%, 1-49%, 50-79%, 80-99% and 100%.",
      "US-4.3: Given the quiz covered more than 1 topic, Then a per-topic breakdown is shown; for a single-topic quiz it is not.",
      "US-4.4: Given results are shown, When I press \"Try again\", Then a fresh draw with the same scope starts; When I press \"Choose another topic\", Then I return to topic selection.",
      "US-4.5 (edge): Given N = 1, a 0% or a 100% score, When results appear, Then the score and message display correctly, and focus moves to the results heading."
    ],
    "depends_on": [
      "EP-1",
      "US-3"
    ]
  },
  {
    "key": "US-5",
    "type": "story",
    "repo": "app",
    "priority": "P1",
    "title": "Review answers and retry missed questions",
    "description": "As a candidate, I want to review what I got wrong and retry only those questions, so that I focus on my weak spots. 2 points (PO estimate, TL breakdown pending). Retry-missed best-score rule accepted by the PO (QUIZ-DISC-D06).",
    "acceptance_criteria": [
      "US-5.1: Given results are shown, When I open \"Review\", Then each question lists my answer, the correct answer, the explanation and the source.",
      "US-5.2: Given I missed at least 1 question, When I press \"Retry missed\", Then a quiz starts containing exactly the missed questions, with single-choice options reshuffled.",
      "US-5.3: Given I missed 0 questions, When results are shown, Then \"Retry missed\" is not offered.",
      "US-5.4: Given a retry-missed quiz, Then it works for N = 1 and \"Retry missed\" can be repeated on its own results.",
      "US-5.5: Given I complete a retry-missed quiz, Then my stored best score is not updated.",
      "US-5.6 (edge): Given a missed question was removed by a new deploy, When I retry, Then it is dropped; if none remain, a notice is shown instead of an empty quiz."
    ],
    "depends_on": [
      "EP-1",
      "US-4"
    ]
  },
  {
    "key": "US-6",
    "type": "story",
    "repo": "app",
    "priority": "P1",
    "title": "Local best score and resume quiz",
    "description": "As a returning learner on the same device, I want my best score per topic remembered and an unfinished quiz resumable, so that short mobile sessions are not lost. Re-estimated 5 points (was 2 PO est.) after the accepted amendments; proposed split: storage adapter and saved-data validation 2, best score incl. Mixed 1, resume/discard/replace/reset UI 2. Tech-lead breakdown and confirmation pending. Multi-tab prompt deferred to R2 (A14, US-6.7).",
    "acceptance_criteria": [
      "US-6.1: Given I completed a normal (not retry-missed) topic quiz or Mixed quiz, When I return to the landing page, Then that topic, or Mixed, shows my best percentage. Mixed has its own best score.",
      "US-6.2: Given I leave mid-quiz and reload within the same browser, When the landing page loads, Then I am offered \"Resume\" or \"Discard\". Resume restores the exact question index, question order, option order and locked answers.",
      "US-6.3 (edge): Given saved data is corrupt, has an unknown schema version, or references a question or option ID that no longer exists, When the app loads, Then it is discarded with a non-blocking notice and the app never crashes. Valid best scores are kept.",
      "US-6.4: Given a resumable quiz exists, When I start a new quiz, Then an inline confirmation (\"This will discard your unfinished quiz\") is shown, and confirming replaces the saved quiz.",
      "US-6.5: Given `localStorage` is unavailable, full or throws, When I use the app, Then quizzes still work in memory and the progress features (best score, resume, reset) are hidden. A storage write error mid-quiz never interrupts the quiz.",
      "US-6.6: Given I press \"Reset progress\" and confirm, When the action completes, Then only the app's own (`apiquiz:`) storage keys are cleared.",
      "US-6.7 (edge): Given the app is open in 2 tabs, Then the last write wins and the other tab's saved data is still validated per US-6.3. No \"changed in another tab\" prompt is shown in MVP (deferred to R2).",
      "US-6.8 (privacy): Stored data contains only question and option IDs, scores, versions and timestamps, at most 50 KB, and no personal information."
    ],
    "depends_on": [
      "EP-1",
      "US-4"
    ]
  },
  {
    "key": "US-7",
    "type": "story",
    "repo": "app",
    "priority": "P0",
    "sprint": 1,
    "title": "Question bank schema and validation",
    "description": "As a content maintainer, I want questions stored in a validated data file, so that I can add or fix questions without code changes and bad data cannot ship. 5 points (T-05, T-06). Includes BA amendments US-7 (a)-(g).",
    "acceptance_criteria": [
      "US-7.1: Given the question schema, When a question is defined, Then it has: unique stable slug `id`, `topic` from the controlled topics list, `difficulty`, `type` (single-choice or true/false), `prompt`, `options` each with a stable option `id`, `correct` referencing exactly 1 option `id`, `explanation` (at least 20 chars), https `sourceUrl`, `reviewStatus` (`draft`/`reviewed`) and `reviewedBy` (required when `reviewed`). Content files carry `schemaVersion`.",
      "US-7.2: Given a true/false question, Then it has exactly 2 options; given a single-choice question, Then it has 3-4 options.",
      "US-7.3: Given the CI validation runs, When any question breaks the schema, has a duplicate question or option ID, duplicate option text, a missing or ambiguous correct answer, a non-https `sourceUrl`, or reuses a retired ID, Then the build fails and names the question ID and field.",
      "US-7.4: Given a question has `reviewStatus: draft`, When a production build runs, Then that question is excluded, and the emitted data asset carries a build-generated `contentVersion` and is at most 60 KB gzipped.",
      "US-7.5: Given a release validation run, When post-exclusion counts are below the US-8 thresholds, Then it fails; dev builds only warn.",
      "US-7.6: Given the runtime loader, When the data is missing or invalid, Then it returns an error result and never throws."
    ],
    "depends_on": [
      "EP-2"
    ]
  },
  {
    "key": "US-8",
    "type": "story",
    "repo": "app",
    "priority": "P0",
    "title": "Initial reviewed question bank (at least 60 questions)",
    "description": "As a candidate, I want a solid set of accurate questions, so that practice reflects real interviews. Split into 8 per-topic content batches T-23..T-30 (1 point each, 8 points total, PM proposal, tech-lead confirmation pending), each about 8 questions so one sponsor PR review stays small. Human check: the sponsor's PR review (D4, US-8.3). Sprint 2 (first batches) and Sprint 3.",
    "acceptance_criteria": [
      "US-8.1: Given the MVP release, When the bank is counted, Then it has at least 60 `reviewed` questions over at least 8 topics (A5), with at least 5 per topic and at least 20% of them `medium` or `hard`.",
      "US-8.2 (quality rule): Given any question, When it is reviewed, Then a reviewer who is not the author (agent or person) has checked the answer key and explanation against the cited primary source, and it is marked `reviewed` with `reviewedBy` recorded.",
      "US-8.3 (human check, D4): Given a content PR, When it is ready to merge, Then the sponsor's PR review is recorded as the human accuracy check before the owner merges. Agents never approve on the sponsor's behalf.",
      "US-8.4: Questions that are ambiguous, opinion-based or have more than one defensible answer are rewritten or removed. Given a reported wrong answer key, When it is confirmed, Then it is treated as a defect and fixed before the next release.",
      "US-8.5: Content is original. It is not copied from third-party question banks."
    ],
    "depends_on": [
      "EP-2",
      "US-7"
    ]
  },
  {
    "key": "US-9",
    "type": "story",
    "repo": "app",
    "priority": "P0",
    "title": "Responsive layout for mobile and desktop",
    "description": "As a mobile learner, I want the quiz to work well on any screen size, so that I can practise on my phone or laptop. Cross-cutting: responsive DoD applies to every UI task; story closes with T-16 and T-17 (5 points shared with US-10). Reflow AC accepted by the PO (QUIZ-DISC-D06).",
    "acceptance_criteria": [
      "US-9.1: Given viewport widths 320, 375, 768, 1280 and 1920px and a 640x360 landscape viewport, When any screen renders, Then there is no horizontal page scroll and no content is clipped or overlapped.",
      "US-9.2: Given a touch device, When I tap answer options and buttons, Then the targets are at least 44x44 CSS px (above the WCAG 2.2 2.5.8 minimum of 24px).",
      "US-9.3: Given portrait or landscape orientation, When I rotate the device mid-quiz, Then the layout adapts and quiz state is kept.",
      "US-9.4: Given content reflow at 320 CSS px equivalent (400% zoom at 1280px) and 200% text resize with text spacing overrides, When I use the app, Then all content and functions remain available.",
      "US-9.5: Given a short landscape viewport (about 640x360), Then \"Next\" stays reachable and no sticky element obscures the focused element.",
      "US-9.6: A manual iOS Safari real-device pass is recorded after US-4."
    ],
    "depends_on": [
      "EP-3",
      "US-1",
      "US-2",
      "US-3",
      "US-4"
    ]
  },
  {
    "key": "US-10",
    "type": "story",
    "repo": "app",
    "priority": "P0",
    "title": "Accessibility to WCAG 2.2 AA",
    "description": "As a user with a disability, I want the quiz to be fully accessible, so that I can practise like anyone else. Cross-cutting: a11y DoD applies to every UI task; story closes with T-16, T-17 and a manual screen-reader pass.",
    "acceptance_criteria": [
      "US-10.1: Given any screen and state, When automated axe-core checks run in CI, Then there are 0 critical or serious violations.",
      "US-10.2: Given keyboard-only use, When I complete a whole quiz, Then every control, including scrollable code blocks, can be reached in a logical order, the focus indicator is visible and not obscured (2.4.11), and there are no keyboard traps.",
      "US-10.3: Given a screen reader (tested with NVDA or VoiceOver), When I answer, Then options are announced as a labelled radio group, the verdict is announced through a live region (US-3.3), and focus moves to the new question heading on \"Next\" (manual pass recorded).",
      "US-10.4: Given text and UI components, When contrast is measured, Then text is at least 4.5:1 (3:1 for large text and UI parts), and meaning is never shown by colour alone, including in forced-colours mode.",
      "US-10.5: Given the OS setting \"reduce motion\", When transitions would play, Then they are disabled.",
      "US-10.6: Given any view change, Then the document title updates, and focus after Exit, 404 and results goes to the main heading."
    ],
    "depends_on": [
      "EP-3",
      "US-1",
      "US-2",
      "US-3",
      "US-4"
    ]
  },
  {
    "key": "US-11",
    "type": "story",
    "repo": "app",
    "priority": "P2",
    "title": "Difficulty filter and quiz length option",
    "description": "As an experienced engineer, I want to filter by difficulty and choose 5, 10 or 20 questions, so that sessions match my level and time. 2 points PO estimate.",
    "acceptance_criteria": [
      "US-11.1: Given I select difficulty \"hard\" and length 5, When I start, Then up to 5 questions, all hard, are shown. If fewer exist, I am told how many are available.",
      "US-11.2 (edge): Given 0 questions match, Then \"Start\" is disabled with an explanation."
    ],
    "depends_on": [
      "EP-1",
      "US-1",
      "US-8"
    ]
  },
  {
    "key": "US-12",
    "type": "story",
    "repo": "app",
    "priority": "P1",
    "title": "Landing/about page, error and empty states",
    "description": "As a first-time visitor, I want to understand what the app is and never hit a dead end, so that I trust it. 1 point PO estimate; 404, loading indicator and data-failure Retry are delivered in T-08. Report link target is the question-report issue form (T-22).",
    "acceptance_criteria": [
      "US-12.1: Given the landing page, When it loads, Then a one-sentence description, a \"content accuracy and sources\" note and a general \"Report a problem\" link (the public repository's `question-report` new-issue page, see US-3.5/US-3.6) are visible.",
      "US-12.2: Given an unknown URL, When I visit it, Then a 404 view offers a link back home. Given a deep link to an unknown topic, Then \"Topic not found\" is shown with the topic list.",
      "US-12.3: Given a deep link, When I refresh the page on GitHub Pages, Then the same view loads.",
      "US-12.4: Given a slow load, Then a loading indicator is shown, and after 10 s a \"Still loading\" message with \"Retry\".",
      "US-12.5: Given the question data or an app chunk fails to load, When the app starts, Then a readable error with a \"Retry\" button is shown."
    ],
    "depends_on": [
      "EP-3",
      "US-1"
    ]
  },
  {
    "key": "US-13",
    "type": "story",
    "repo": "app",
    "priority": "P3",
    "title": "Dark mode / system colour scheme",
    "description": "As a user, I want the app to follow my system light or dark setting, so that it is comfortable to read. 1 point PO estimate.",
    "acceptance_criteria": [
      "US-13.1: Given my OS prefers dark mode, When the app loads, Then the dark theme applies and still meets the US-10 contrast criteria.",
      "US-13.2: Given a theme change mid-quiz, Then quiz state is kept."
    ],
    "depends_on": [
      "EP-3",
      "US-9",
      "US-10"
    ]
  },
  {
    "key": "T-19",
    "type": "task",
    "repo": "app",
    "priority": "P0",
    "sprint": 1,
    "title": "QA initial test strategy and acceptance-criteria test matrix",
    "description": "Owner qa-automation, 2 points. Paths: docs/qa/test-strategy.md, docs/qa/ac-test-matrix.md. First Sprint 1 task; completes the Definition of Ready for US-7, US-1 and US-2.",
    "acceptance_criteria": [
      "Every acceptance criterion of US-7, US-1 and US-2 maps to a test ID T-US<n>-<k> with risk, test level, automation flag, test data and expected evidence",
      "US-3 to US-13 and SC-1 to SC-6 are covered at outline level with the planned test level",
      "The strategy records which verification stays in implementation tasks and which needs a separate QA task, with rationale",
      "Manual checks (NVDA/VoiceOver, iOS Safari real device) are listed with owner and timing"
    ],
    "depends_on": [
      "EP-4"
    ]
  },
  {
    "key": "T-21",
    "type": "task",
    "repo": "app",
    "priority": "P1",
    "sprint": 1,
    "title": "Update ADR-0001 with tech-lead adjustments",
    "description": "Owner software-architect, 1 point. Path: docs/adr/0001-static-spa-github-pages.md. TL resolutions 5-7.",
    "acceptance_criteria": [
      "The test table reflects Playwright placement (Chromium all widths plus WebKit iPhone on PRs, Firefox and full device set on main and release) and the removal of vitest-axe",
      "Data loading describes the ?url import plus early fetch instead of preload",
      "V-4 states that the CSP is present in the build output only and E2E runs against preview"
    ],
    "depends_on": [
      "EP-4"
    ]
  },
  {
    "key": "T-01",
    "type": "task",
    "repo": "app",
    "priority": "P0",
    "sprint": 1,
    "title": "Bootstrap project skeleton",
    "description": "Owner devops-platform, 3 points. Paths per 04-tech-lead-review.md T-01.",
    "acceptance_criteria": [
      "npm ci, npm run check and npm run build pass",
      "A dangerouslySetInnerHTML fixture fails lint and the boundary rule rejects react imports in src/domain",
      "Vite base is /api-quiz-app/ and the built index.html has the CSP meta and no inline script",
      "The dev server starts"
    ],
    "depends_on": [
      "EP-4"
    ]
  },
  {
    "key": "T-02",
    "type": "task",
    "repo": "app",
    "priority": "P0",
    "sprint": 1,
    "title": "Bootstrap CI workflow",
    "description": "Owner devops-platform, 2 points. Paths: .github/workflows/ci.yml, .github/dependabot.yml, size-budget config. First writer of ci.yml.",
    "acceptance_criteria": [
      "PRs run lint, typecheck, unit tests, content:validate and build",
      "The JS gzip budget of 200 KB is enforced and a 250 KB fixture fails",
      "Actions are pinned by SHA, the default token permission is contents: read, dependency review and npm audit --audit-level=high run"
    ],
    "depends_on": [
      "EP-4",
      "T-01"
    ]
  },
  {
    "key": "T-03",
    "type": "task",
    "repo": "app",
    "priority": "P0",
    "sprint": 1,
    "title": "Bootstrap Playwright E2E harness",
    "description": "Owner qa-automation, 3 points. Paths: playwright.config.ts, tests/e2e/**, ci.yml (serial after T-02).",
    "acceptance_criteria": [
      "E2E runs against npm run preview with the base path",
      "Helpers exist for no horizontal scroll, axe serious/critical, offline after load with 0 requests and same-origin requests",
      "A shell smoke test passes in CI using a fixture bank served via page.route"
    ],
    "depends_on": [
      "EP-4",
      "T-02"
    ]
  },
  {
    "key": "T-04",
    "type": "task",
    "repo": "app",
    "priority": "P0",
    "sprint": 1,
    "title": "Design specifications for core views",
    "description": "Owner ui-ux-designer, 3 points. Path: docs/design/**.",
    "acceptance_criteria": [
      "Specs cover Landing, Question, Feedback, Results and error/loading states",
      "Design tokens list contrast ratios meeting WCAG 2.2 AA; targets are at least 44 px",
      "Layouts are given at 320, 768 and 1280 px with focus order per G4 and non-colour state markers"
    ],
    "depends_on": [
      "EP-4"
    ]
  },
  {
    "key": "T-05",
    "type": "task",
    "repo": "app",
    "priority": "P0",
    "sprint": 1,
    "title": "Content schema and validator",
    "description": "Owner backend-developer, 3 points. Paths: content/**, scripts/content/**, scripts/validate-content.ts, tests/unit/content/**.",
    "acceptance_criteria": [
      "A failing fixture exists for each FR-21/FR-22 rule, retired-ID reuse and https-only",
      "Errors name the question ID and field",
      "--release enforces US-8 thresholds",
      "About 6 draft seed questions across 3 topics validate"
    ],
    "depends_on": [
      "US-7",
      "T-01"
    ]
  },
  {
    "key": "T-06",
    "type": "task",
    "repo": "app",
    "priority": "P0",
    "sprint": 1,
    "title": "Content build, emission and loader",
    "description": "Owner backend-developer, 2 points. Paths: scripts/build-content.ts, src/content/**, package.json scripts (serial after T-01).",
    "acceptance_criteria": [
      "The production build contains no draft questions",
      "contentVersion is stable for unchanged content",
      "The data asset is at most 60 KB gzipped",
      "The loader returns ok or error and never throws"
    ],
    "depends_on": [
      "US-7",
      "T-05"
    ]
  },
  {
    "key": "T-07",
    "type": "task",
    "repo": "app",
    "priority": "P0",
    "sprint": 1,
    "title": "Domain: seeded RNG and createQuiz",
    "description": "Owner frontend-developer, 2 points. Paths: src/domain/rng.ts, types.ts, createQuiz.ts, tests/unit/domain/createQuiz.test.ts. May start against a stub content-type interface.",
    "acceptance_criteria": [
      "N = min(10, count) for topic quizzes; Mixed spans at least 3 topics where possible",
      "No duplicate questions; order is reproducible for a given seed",
      "True/false options are not shuffled"
    ],
    "depends_on": [
      "US-1",
      "T-06"
    ]
  },
  {
    "key": "T-08",
    "type": "task",
    "repo": "app",
    "priority": "P0",
    "sprint": 1,
    "title": "App shell, hash router, loading and error states",
    "description": "Owner frontend-developer, 3 points. Paths: src/ui/app/**, src/ui/styles/tokens.css.",
    "acceptance_criteria": [
      "Hash routes work including the 404 view",
      "A loading indicator appears after 300 ms and a data failure shows Retry (FR-25)",
      "The document title updates per view; router and reducer have component tests"
    ],
    "depends_on": [
      "US-1",
      "T-01",
      "T-04",
      "T-06"
    ]
  },
  {
    "key": "T-09",
    "type": "task",
    "repo": "app",
    "priority": "P0",
    "sprint": 1,
    "title": "Landing view",
    "description": "Owner frontend-developer, 2 points. Path: src/ui/views/Landing/**.",
    "acceptance_criteria": [
      "Topics appear in curated order with counts plus Mixed; empty topics are hidden",
      "Double activation creates 1 quiz; at most 2 interactions to the first question (E2E T-US1-*)",
      "A topic deep link preselects the topic"
    ],
    "depends_on": [
      "US-1",
      "T-07",
      "T-08"
    ]
  },
  {
    "key": "T-10",
    "type": "task",
    "repo": "app",
    "priority": "P0",
    "sprint": 1,
    "title": "Safe rich-text renderer",
    "description": "Owner frontend-developer, 2 points. Paths: src/ui/text/renderRichText.tsx, src/ui/text/*.test.tsx.",
    "acceptance_criteria": [
      "Paragraphs, inline code and fenced blocks render as React text nodes",
      "<script>, <img onerror> and javascript: render literally (V-1)",
      "Code blocks scroll in a focusable, labelled box"
    ],
    "depends_on": [
      "US-2",
      "T-01"
    ]
  },
  {
    "key": "T-11",
    "type": "task",
    "repo": "app",
    "priority": "P0",
    "sprint": 1,
    "title": "Domain: submit and next",
    "description": "Owner frontend-developer, 1 point. Paths: src/domain/answer.ts, its test, types.ts (serial after T-07).",
    "acceptance_criteria": [
      "Submit locks the answer",
      "A double submit records 1 answer",
      "next advances exactly 1 question"
    ],
    "depends_on": [
      "US-2",
      "T-07"
    ]
  },
  {
    "key": "T-12",
    "type": "task",
    "repo": "app",
    "priority": "P0",
    "sprint": 1,
    "title": "Question view",
    "description": "Owner frontend-developer, 3 points. Path: src/ui/views/Question/**.",
    "acceptance_criteria": [
      "Radio group uses fieldset/legend; k of N and topic are shown",
      "Submit is aria-disabled with a hint until a selection and the answer is locked after submit",
      "No page horizontal scroll; Back and Exit return to Landing (FR-26)"
    ],
    "depends_on": [
      "US-2",
      "T-08",
      "T-10",
      "T-11"
    ]
  },
  {
    "key": "T-13",
    "type": "task",
    "repo": "app",
    "priority": "P0",
    "title": "Feedback, external link and report link",
    "description": "Owner frontend-developer, 3 points. Paths: Question/Feedback*.tsx, components/ExternalLink.tsx, report/reportLink.ts (serial after T-12). Sprint 1 stretch only. Report link targets the public api-quiz-app new-issue page with the question-report form (form file is T-22).",
    "acceptance_criteria": [
      "Text verdict and non-colour marking of correct and chosen options",
      "Polite live region then focus to Next (G4); See results on the last question",
      "https guard on links; new-tab cue on source and report links",
      "Report link built with URLSearchParams from a configurable base URL, titled [Question] <question id>, selecting the question-report form and carrying only the question ID and contentVersion"
    ],
    "depends_on": [
      "US-3",
      "T-12"
    ]
  },
  {
    "key": "T-14",
    "type": "task",
    "repo": "app",
    "priority": "P0",
    "title": "Domain: score",
    "description": "Owner frontend-developer, 1 point. Paths: src/domain/score.ts, its test.",
    "acceptance_criteria": [
      "X/N with half-up rounding and band messages",
      "Per-topic breakdown only when more than 1 topic",
      "0%, 100% and N = 1 are covered by tests"
    ],
    "depends_on": [
      "US-4",
      "T-11"
    ]
  },
  {
    "key": "T-15",
    "type": "task",
    "repo": "app",
    "priority": "P0",
    "title": "Results view",
    "description": "Owner frontend-developer, 2 points. Path: src/ui/views/Results/**.",
    "acceptance_criteria": [
      "Score, percentage, message and breakdown are shown",
      "Try again makes a fresh draw; Choose another topic returns to Landing",
      "Focus moves to the results heading"
    ],
    "depends_on": [
      "US-4",
      "T-13",
      "T-14"
    ]
  },
  {
    "key": "T-16",
    "type": "task",
    "repo": "app",
    "priority": "P0",
    "title": "Flow and responsive E2E suite",
    "description": "Owner qa-automation, 3 points. Paths: tests/e2e/flow.spec.ts, tests/e2e/responsive.spec.ts. Closes US-9/US-10 with T-17.",
    "acceptance_criteria": [
      "Journey J1 passes end to end including keyboard-only",
      "No horizontal scroll at 320/375/768/1280/1920 and 640x360; rotation keeps state; 400% reflow",
      "axe runs on every state; offline after load makes 0 requests; deep-link refresh works"
    ],
    "depends_on": [
      "US-9",
      "US-10",
      "T-03",
      "T-15"
    ]
  },
  {
    "key": "T-17",
    "type": "task",
    "repo": "app",
    "priority": "P0",
    "title": "Responsive and contrast fixes",
    "description": "Owner frontend-developer, 2 points. Paths: src/ui/**/*.module.css, src/ui/styles/**.",
    "acceptance_criteria": [
      "All T-16 responsive and contrast failures are fixed and T-16 passes",
      "Targets are at least 44 px; reduced motion and forced colours are supported"
    ],
    "depends_on": [
      "US-9",
      "T-16"
    ]
  },
  {
    "key": "T-18",
    "type": "task",
    "repo": "app",
    "priority": "P1",
    "title": "Lighthouse CI (SC-5)",
    "description": "Owner performance-engineer, 2 points. Paths: lighthouserc.json, ci.yml (serial on ci.yml).",
    "acceptance_criteria": [
      "LHCI mobile preset runs 3 times against preview and asserts the median",
      "Performance at least 90 and Accessibility at least 95 from US-1 on",
      "A baseline report is attached"
    ],
    "depends_on": [
      "EP-3",
      "T-03",
      "T-09"
    ]
  },
  {
    "key": "T-20",
    "type": "task",
    "repo": "app",
    "priority": "P1",
    "title": "GitHub Pages deploy workflow",
    "description": "Owner devops-platform, 2 points. Path: .github/workflows/deploy.yml. Unblocked: D2 decided 2026-10-21 (public repo, GitHub Pages). Not in Sprint 1; Sprint 2 candidate. Each production deployment still follows the release go/no-go and the human-merge policy; agents never merge, and deploy runs from main only after the human owner merges. A custom domain or paid plan needs separate sponsor approval.",
    "acceptance_criteria": [
      "The deploy workflow runs only from main, uses SHA-pinned actions, and only the deploy job has pages: write and id-token: write in a github-pages environment limited to main",
      "After the first deploy, HTTPS enforcement and the CSP meta are verified on the live site (V-7) with recorded evidence",
      "Deep-link refresh and the static 404.html work on the deployed site"
    ],
    "depends_on": [
      "EP-3",
      "T-02"
    ]
  },
  {
    "key": "T-22",
    "type": "task",
    "repo": "app",
    "priority": "P0",
    "title": "question-report GitHub issue form",
    "description": "Owner devops-platform, 1 point. Path: .github/ISSUE_TEMPLATE/question-report.yml. Sprint 2 with US-3 (US-3.6, A13). Repository file, not app code; must be merged before US-3 is released.",
    "acceptance_criteria": [
      "An issue form named question-report exists and the file passes GitHub issue-form schema (YAML parses; required keys name, description, body)",
      "The form asks what is wrong with the question and has fields for the question ID and contentVersion that the report link can prefill",
      "The form states that issues and GitHub usernames are public and asks reporters not to include personal data",
      "The default title pattern is [Question] <question id> and no labels, assignees or automations need extra permissions"
    ],
    "depends_on": [
      "US-3",
      "T-01"
    ]
  },
  {
    "key": "T-23",
    "type": "task",
    "repo": "app",
    "priority": "P0",
    "title": "US-8 content batch 1: HTTP fundamentals",
    "description": "Author technical-research, non-author review product-owner (assumption, reassignable), 1 point. Paths: content/questions/<topic file> for this topic only. One PR per batch for the sponsor's review. Sprint 2 (batches 1-3, after T-05) and Sprint 3 (rest).",
    "acceptance_criteria": [
      "About 8 (at least 7) original questions for the topic 'HTTP fundamentals' are added, at least 2 of them medium or hard",
      "Each question was checked against its cited primary source (RFC 9110/9111) by a non-author reviewer and is marked reviewed with reviewedBy (US-8.2)",
      "content:validate passes in CI on the batch PR with no new warnings",
      "The sponsor's PR review is recorded on the batch PR as the human accuracy check before the owner merges; agents never approve on the sponsor's behalf (US-8.3)"
    ],
    "depends_on": [
      "US-8",
      "T-05"
    ]
  },
  {
    "key": "T-24",
    "type": "task",
    "repo": "app",
    "priority": "P0",
    "title": "US-8 content batch 2: HTTP methods and idempotency",
    "description": "Author technical-research, non-author review product-owner (assumption, reassignable), 1 point. Paths: content/questions/<topic file> for this topic only. One PR per batch for the sponsor's review. Sprint 2 (batches 1-3, after T-05) and Sprint 3 (rest).",
    "acceptance_criteria": [
      "About 8 (at least 7) original questions for the topic 'HTTP methods and idempotency' are added, at least 2 of them medium or hard",
      "Each question was checked against its cited primary source (RFC 9110) by a non-author reviewer and is marked reviewed with reviewedBy (US-8.2)",
      "content:validate passes in CI on the batch PR with no new warnings",
      "The sponsor's PR review is recorded on the batch PR as the human accuracy check before the owner merges; agents never approve on the sponsor's behalf (US-8.3)"
    ],
    "depends_on": [
      "US-8",
      "T-05"
    ]
  },
  {
    "key": "T-25",
    "type": "task",
    "repo": "app",
    "priority": "P0",
    "title": "US-8 content batch 3: Status codes",
    "description": "Author technical-research, non-author review product-owner (assumption, reassignable), 1 point. Paths: content/questions/<topic file> for this topic only. One PR per batch for the sponsor's review. Sprint 2 (batches 1-3, after T-05) and Sprint 3 (rest).",
    "acceptance_criteria": [
      "About 8 (at least 7) original questions for the topic 'Status codes' are added, at least 2 of them medium or hard",
      "Each question was checked against its cited primary source (RFC 9110) by a non-author reviewer and is marked reviewed with reviewedBy (US-8.2)",
      "content:validate passes in CI on the batch PR with no new warnings",
      "The sponsor's PR review is recorded on the batch PR as the human accuracy check before the owner merges; agents never approve on the sponsor's behalf (US-8.3)"
    ],
    "depends_on": [
      "US-8",
      "T-05"
    ]
  },
  {
    "key": "T-26",
    "type": "task",
    "repo": "app",
    "priority": "P0",
    "title": "US-8 content batch 4: REST design",
    "description": "Author technical-research, non-author review product-owner (assumption, reassignable), 1 point. Paths: content/questions/<topic file> for this topic only. One PR per batch for the sponsor's review. Sprint 2 (batches 1-3, after T-05) and Sprint 3 (rest).",
    "acceptance_criteria": [
      "About 8 (at least 7) original questions for the topic 'REST design' are added, at least 2 of them medium or hard",
      "Each question was checked against its cited primary source (RFC 9110 and other cited primary sources) by a non-author reviewer and is marked reviewed with reviewedBy (US-8.2)",
      "content:validate passes in CI on the batch PR with no new warnings",
      "The sponsor's PR review is recorded on the batch PR as the human accuracy check before the owner merges; agents never approve on the sponsor's behalf (US-8.3)"
    ],
    "depends_on": [
      "US-8",
      "T-05"
    ]
  },
  {
    "key": "T-27",
    "type": "task",
    "repo": "app",
    "priority": "P0",
    "title": "US-8 content batch 5: Authentication and authorization (API keys, OAuth 2.0, JWT)",
    "description": "Author technical-research, non-author review product-owner (assumption, reassignable), 1 point. Paths: content/questions/<topic file> for this topic only. One PR per batch for the sponsor's review. Sprint 2 (batches 1-3, after T-05) and Sprint 3 (rest).",
    "acceptance_criteria": [
      "About 8 (at least 7) original questions for the topic 'Authentication and authorization (API keys, OAuth 2.0, JWT)' are added, at least 2 of them medium or hard",
      "Each question was checked against its cited primary source (RFC 6749/6750/7519) by a non-author reviewer and is marked reviewed with reviewedBy (US-8.2)",
      "content:validate passes in CI on the batch PR with no new warnings",
      "The sponsor's PR review is recorded on the batch PR as the human accuracy check before the owner merges; agents never approve on the sponsor's behalf (US-8.3)"
    ],
    "depends_on": [
      "US-8",
      "T-05"
    ]
  },
  {
    "key": "T-28",
    "type": "task",
    "repo": "app",
    "priority": "P0",
    "title": "US-8 content batch 6: API versioning",
    "description": "Author technical-research, non-author review product-owner (assumption, reassignable), 1 point. Paths: content/questions/<topic file> for this topic only. One PR per batch for the sponsor's review. Sprint 2 (batches 1-3, after T-05) and Sprint 3 (rest).",
    "acceptance_criteria": [
      "About 8 (at least 7) original questions for the topic 'API versioning' are added, at least 2 of them medium or hard",
      "Each question was checked against its cited primary source (cited primary sources) by a non-author reviewer and is marked reviewed with reviewedBy (US-8.2)",
      "content:validate passes in CI on the batch PR with no new warnings",
      "The sponsor's PR review is recorded on the batch PR as the human accuracy check before the owner merges; agents never approve on the sponsor's behalf (US-8.3)"
    ],
    "depends_on": [
      "US-8",
      "T-05"
    ]
  },
  {
    "key": "T-29",
    "type": "task",
    "repo": "app",
    "priority": "P0",
    "title": "US-8 content batch 7: Pagination, filtering and rate limiting",
    "description": "Author technical-research, non-author review product-owner (assumption, reassignable), 1 point. Paths: content/questions/<topic file> for this topic only. One PR per batch for the sponsor's review. Sprint 2 (batches 1-3, after T-05) and Sprint 3 (rest).",
    "acceptance_criteria": [
      "About 8 (at least 7) original questions for the topic 'Pagination, filtering and rate limiting' are added, at least 2 of them medium or hard",
      "Each question was checked against its cited primary source (cited primary sources (e.g. RFC 9110, RFC 6585)) by a non-author reviewer and is marked reviewed with reviewedBy (US-8.2)",
      "content:validate passes in CI on the batch PR with no new warnings",
      "The sponsor's PR review is recorded on the batch PR as the human accuracy check before the owner merges; agents never approve on the sponsor's behalf (US-8.3)"
    ],
    "depends_on": [
      "US-8",
      "T-05"
    ]
  },
  {
    "key": "T-30",
    "type": "task",
    "repo": "app",
    "priority": "P0",
    "title": "US-8 content batch 8: GraphQL basics",
    "description": "Author technical-research, non-author review product-owner (assumption, reassignable), 1 point. Paths: content/questions/<topic file> for this topic only. One PR per batch for the sponsor's review. Sprint 2 (batches 1-3, after T-05) and Sprint 3 (rest).",
    "acceptance_criteria": [
      "About 8 (at least 7) original questions for the topic 'GraphQL basics' are added, at least 2 of them medium or hard",
      "Each question was checked against its cited primary source (graphql.org specification) by a non-author reviewer and is marked reviewed with reviewedBy (US-8.2)",
      "content:validate passes in CI on the batch PR with no new warnings",
      "The sponsor's PR review is recorded on the batch PR as the human accuracy check before the owner merges; agents never approve on the sponsor's behalf (US-8.3)",
      "After this batch merges, content:validate --release passes the US-8.1 thresholds (at least 60 reviewed questions, 8 topics, at least 5 per topic, at least 20% medium or hard)"
    ],
    "depends_on": [
      "US-8",
      "T-05"
    ]
  }
]
```
