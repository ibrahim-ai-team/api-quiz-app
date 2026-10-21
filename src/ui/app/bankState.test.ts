import { describe, expect, it } from "vitest";
import {
  bankReducer,
  initialBankState,
  isPlayableTopic,
  type BankState,
} from "./bankState";
import { FAILED, OK, TEST_BANK } from "./testBank";

describe("bankReducer", () => {
  it("starts loading attempt 0, not as a user retry", () => {
    expect(initialBankState).toEqual({
      status: "loading",
      attempt: 0,
      userRetry: false,
    });
  });

  it("moves loading -> ready with the bank", () => {
    const next = bankReducer(initialBankState, {
      type: "settled",
      attempt: 0,
      result: OK,
    });
    expect(next).toEqual({ status: "ready", attempt: 0, bank: TEST_BANK });
  });

  it("moves loading -> error with the loader error", () => {
    const next = bankReducer(initialBankState, {
      type: "settled",
      attempt: 0,
      result: FAILED,
    });
    expect(next).toMatchObject({ status: "error", attempt: 0 });
    expect(next.status === "error" && next.error.kind).toBe("http");
  });

  it("retries from error as a new user attempt, then reaches ready", () => {
    const failed = bankReducer(initialBankState, {
      type: "settled",
      attempt: 0,
      result: FAILED,
    });
    const retrying = bankReducer(failed, { type: "retry" });
    expect(retrying).toEqual({
      status: "loading",
      attempt: 1,
      userRetry: true,
    });
    const ready = bankReducer(retrying, {
      type: "settled",
      attempt: 1,
      result: OK,
    });
    expect(ready.status).toBe("ready");
  });

  it("retries while still loading and ignores the late first result", () => {
    const retrying = bankReducer(initialBankState, { type: "retry" });
    expect(retrying).toMatchObject({ status: "loading", attempt: 1 });
    const stale = bankReducer(retrying, {
      type: "settled",
      attempt: 0,
      result: FAILED,
    });
    expect(stale).toBe(retrying);
  });

  it("ignores retry and further results once ready", () => {
    const ready: BankState = { status: "ready", attempt: 0, bank: TEST_BANK };
    expect(bankReducer(ready, { type: "retry" })).toBe(ready);
    expect(
      bankReducer(ready, { type: "settled", attempt: 0, result: FAILED }),
    ).toBe(ready);
  });
});

describe("isPlayableTopic", () => {
  it("accepts a known topic with questions only", () => {
    expect(isPlayableTopic(TEST_BANK, "topic-a")).toBe(true);
    expect(isPlayableTopic(TEST_BANK, "topic-d")).toBe(false);
    expect(isPlayableTopic(TEST_BANK, "nope")).toBe(false);
  });
});
