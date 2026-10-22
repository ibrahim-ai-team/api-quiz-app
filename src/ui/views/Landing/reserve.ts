/**
 * Loading reserve size (T-34, CLS; T-34-R01 M2). The Landing reserve holds
 * this many topic rows plus Mixed while the bank loads, so it must equal the
 * number of eligible topics in the production bank. The unit test
 * `tests/unit/content/reserve-topics.test.ts` builds the production bank from
 * `content/` and fails when a content change makes this value stale.
 */
export const RESERVE_TOPICS = 3;
