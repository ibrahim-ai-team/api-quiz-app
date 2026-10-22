# Release content policy

## Current MVP release gate

The current ApiQuiz MVP release gate requires:

- At least **24 valid, reviewed questions** after drafts and invalid questions are excluded.
- At least **3 topics** containing reviewed questions.
- At least **5 reviewed questions per topic** that contains reviewed content.
- At least **20%** of reviewed questions rated medium or hard.
- All existing schema, answer-key correctness, duplicate detection, retired-ID, source URL, and reviewed-content requirements remain mandatory. Reviewed questions must include a non-empty `reviewedBy`.

These thresholds are centralized in `scripts/content/rules.ts` as `MVP_RELEASE_THRESHOLDS` and enforced by `npm run content:validate:release`. The production build and deployment workflow use the same validator; no threshold bypass is needed.

## Future target: US-8.1

US-8.1 remains the future content target: **60 reviewed questions across at least 8 topics**, with at least 5 per topic and at least 20% medium or hard. This MVP policy does not amend US-8.1's acceptance criteria. Track completion of the 60-question / 8-topic target in the content backlog and restore it as the active release gate in a later sprint, after the sponsor agrees the question bank is ready.

## Rationale and review

The sponsor has chosen to ship the current bank of 24 reviewed questions in 3 topics and expand content incrementally in future sprints. This is an explicit, documented MVP release policy rather than a validator override. Quality checks remain mandatory. A release still requires regular CI and production-build gates and the sponsor's separate go/no-go decision.
