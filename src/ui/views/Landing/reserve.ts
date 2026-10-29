/**
 * Stand-in rows for the Landing loading reserve (T-34; T-35, issue #84).
 * While the bank loads, an invisible copy of the topic group reserves its
 * height. The rows come from `landing-reserve.json`, which the content build
 * writes in the same run as the bank: one row per eligible topic with its
 * real name, so names wrap exactly like the loaded list, and Mixed only when
 * more than one topic is eligible (US-1.2), like the loaded group. The
 * reserve is aria-hidden and disabled; names are never read from the route.
 */
import type { LandingReserve } from "../../../content/landingReserve";
import type { QuizScope } from "../../../domain";
import { strings } from "../../strings";

export interface Choice {
  readonly key: string;
  readonly scope: QuizScope;
  readonly name: string;
  readonly count: number;
  readonly description?: string;
}

/**
 * Stand-in question count per row. The count is on its own line under the
 * name, so its value does not change the row height.
 */
const RESERVE_COUNT = 8;

/**
 * Whether the loaded group will have a selection, so the reserve shows the
 * Start hint exactly when the loaded group will (below 40em the hint is its
 * own line). A deep link preselects only a topic the bank lists; an unknown
 * one leaves nothing selected (views.md §7b).
 */
export function reserveHasSelection(
  reserve: LandingReserve,
  selected: QuizScope | null,
): boolean {
  if (selected === null) return false;
  return selected.kind === "mixed"
    ? reserve.eligibleTopicCount > 1
    : reserve.topicIds.includes(selected.topicId);
}

/**
 * Rows carry the real topic ID (T-42), so a row with a decoded best score
 * reserves its best-score line too and nothing shifts when the bank arrives
 * (views.md §9). The scope is never started: the reserve is disabled.
 */
export function reserveChoices(reserve: LandingReserve): Choice[] {
  const rows: Choice[] = reserve.topicNames.map((name, index) => ({
    key: `reserve-${String(index)}`,
    scope: {
      kind: "topic",
      topicId: reserve.topicIds[index] ?? `reserve-${String(index)}`,
    },
    name,
    count: RESERVE_COUNT,
  }));
  if (reserve.eligibleTopicCount > 1) {
    rows.push({
      key: "reserve-mixed",
      scope: { kind: "mixed" },
      name: strings.landing.mixedLabel,
      count: reserve.eligibleTopicCount * RESERVE_COUNT,
      description: strings.landing.mixedDescription,
    });
  }
  return rows;
}
