# ApiQuiz design specifications (T-04, issue #24)

- **Delegation:** T-04-D01 (ui-ux-designer). Date 2026-10-21. Status: proposed design guidance for review by the tech-lead and UX reviewer. **No user research or usability testing was done**, and nothing here has been implemented or tested.
- **Inputs:** `docs/planning/01-product-brief.md` (US-1..US-4, US-9, US-10, US-12, US-13), `02-requirements-analysis.md` (J1-J3, G4), `04-tech-lead-review.md` §3 standards 6 and 9.

## Files

| File | Contents |
| --- | --- |
| `tokens.md` | Colour tokens (light and dark) with contrast ratios, type, spacing, radii, focus ring, motion, forced colours, breakpoints |
| `views.md` | Shared shell rules plus Landing, Question, Feedback, Results, Loading, errors, 404 / Topic not found |
| `copy.md` | Every user-facing string, keyed for `src/ui/strings.ts` |

## Design principles

1. **Two interactions to learning** (G1): select a topic, press Start. One question per screen, one column, no distractions.
2. **Meaning never depends on colour alone:** every state has text plus an icon or border style, and survives forced colours (US-3.1, US-10.4).
3. **Predictable focus:** a view change focuses the `h1`; Submit announces the verdict and focuses Next; Next focuses the new `h1` (G4, US-10.6).
4. **Native semantics first:** `fieldset`/`legend` with native radios, real buttons and links, and `aria-disabled` plus a visible hint rather than silent disabling (US-2.3).
5. **Reflow-safe by construction:** rem sizes, one 45rem column, no sticky or fixed elements, and no horizontal page scroll; only code boxes scroll inside themselves (US-9).
6. **Self-contained:** system font stack, inline SVG icons, tokens as CSS custom properties, no inline styles (TL standards 6 and 9).

## Screen inventory and traceability

| View (views.md §) | Route (proposal) | Stories / AC | Task |
| --- | --- | --- | --- |
| Shared shell, tokens, focus and title rules (§0) | all | US-9.1-9.5, US-10.2, 10.4-10.6, US-13 | **T-08** (`tokens.css`, app shell) |
| Loading / Still loading (§5) | `#/` | US-12.4, J1 | **T-08** |
| Data error, app error (§6) | `#/`, any | US-12.5, NFR-9 | **T-08** |
| 404 (§7a) | unknown | US-12.2, US-10.6 | **T-08** |
| Landing (§1), Topic not found (§7b) | `#/`, `#/topic/<slug>` | US-1.1-1.9, US-12.1, 12.2 | **T-09** |
| Question (§2) | `#/quiz` | US-2.1-2.9 | **T-12** (code box with **T-10**) |
| Feedback (§3) | `#/quiz` (in place) | US-3.1-3.5 | **T-13** |
| Results (§4) | `#/results` | US-4.1-4.5 | **T-15** (score data from T-14) |

Reserved slots (layout space only, not specified here): US-6 resume banner and best scores on Landing, and US-5 Review / Retry missed on Results. T-16/T-17 verify the responsive and contrast rules end to end.

## Assumptions (routine, reversible)

- A-D1 Neutral blue/grey palette, because no brand was provided (brief Q4).
- A-D2 Mixed is listed last, after the curated topics.
- A-D3 No skip link: the header has at most 2 controls, and landmarks provide bypass.
- A-D4 Code blocks keep their formatting and scroll inside their own box; they do not wrap (US-2.6 allows either).
- A-D5 Dark tokens are defined now. Shipping the `prefers-color-scheme: dark` block is US-13 (P3) scope, unless the tech-lead and PO pull it into T-08.

## Open design questions

- **DQ-1** Exit quiz and browser Back without US-6 discard in-memory progress, and there is no confirmation. That matches US-2.8 / FR-26, but it is lossy until US-6 resume ships. Should Sprint 1 add a confirmation? Default: no, because it is a scope change (PO).
- **DQ-2** Group name: the legend is "Choose one answer", and the prompt sits outside the fieldset because prompts may contain block code. This needs the US-10.3 screen-reader pass; the alternative is `aria-describedby` pointing at the prompt.
- **DQ-3** The live-region wording follows US-3.3 ("verdict and the correct option": "Correct: X." / "Incorrect. Correct answer: X."), not the BA's shorter "Correct." (PO/BA to confirm).
- **DQ-4** Do the hand-computed ratios hold when checked with a tool? To be verified in T-08/T-17 and by axe in T-16.
- **DQ-5** Should "Choose another topic" preselect the topic just played? Proposed: yes; this is not in the AC.
