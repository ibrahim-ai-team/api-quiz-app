/**
 * App-level bank loading state (T-08, standard 8, FR-25, US-12.4/12.5).
 * One reducer: loading -> ready | error, and Retry starts a new attempt.
 * Every load is tagged with its attempt number, so a late result from an
 * earlier attempt can never overwrite a newer one.
 */
import type { LoadBankError, LoadBankResult } from "../../content/loader";
import type { Bank } from "../../content/types";

export type BankState =
  | {
      readonly status: "loading";
      readonly attempt: number;
      /** True when the user started this attempt with Retry. */
      readonly userRetry: boolean;
    }
  | { readonly status: "ready"; readonly attempt: number; readonly bank: Bank }
  | {
      readonly status: "error";
      readonly attempt: number;
      readonly error: LoadBankError;
    };

export type BankAction =
  | {
      readonly type: "settled";
      readonly attempt: number;
      readonly result: LoadBankResult;
    }
  | { readonly type: "retry" };

export const initialBankState: BankState = {
  status: "loading",
  attempt: 0,
  userRetry: false,
};

export function bankReducer(state: BankState, action: BankAction): BankState {
  switch (action.type) {
    case "settled":
      if (state.status !== "loading" || action.attempt !== state.attempt) {
        return state;
      }
      return action.result.ok
        ? { status: "ready", attempt: state.attempt, bank: action.result.bank }
        : {
            status: "error",
            attempt: state.attempt,
            error: action.result.error,
          };
    case "retry":
      // Retry is offered while loading (after 10 s) and after an error.
      if (state.status === "ready") return state;
      return { status: "loading", attempt: state.attempt + 1, userRetry: true };
  }
}

/**
 * A topic deep link is valid when the topic exists and has at least one
 * question, because Landing hides empty topics (US-1.2, US-12.2).
 */
export function isPlayableTopic(bank: Bank, topicId: string): boolean {
  return (
    bank.topics.some((topic) => topic.id === topicId) &&
    bank.questions.some((question) => question.topic === topicId)
  );
}
