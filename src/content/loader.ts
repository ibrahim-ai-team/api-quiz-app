/**
 * Runtime bank loader (T-06, US-7.6, FR-25; ADR-0001 amendment A4).
 *
 * `loadBank` resolves to a result value and never throws or rejects: network
 * failures, non-2xx responses, malformed JSON and data that fails the `isBank`
 * guard all become `{ ok: false, error }`, so the UI can offer Retry (T-08).
 * The asset URL lives in `bankUrl.ts`; it is a parameter here so this module
 * can be unit-tested without a generated bank.
 */
import { isBank, type Bank } from "./types";

export type LoadBankErrorKind = "network" | "http" | "parse" | "invalid";

export interface LoadBankError {
  readonly kind: LoadBankErrorKind;
  /** Short developer-facing description; not shown verbatim to users. */
  readonly message: string;
  /** HTTP status, only for `kind: "http"`. */
  readonly status?: number;
}

export type LoadBankResult =
  | { readonly ok: true; readonly bank: Bank }
  | { readonly ok: false; readonly error: LoadBankError };

/** The subset of `fetch` the loader needs; injectable for tests. */
export type FetchLike = (input: string) => Promise<Response>;

const defaultFetch: FetchLike = (input) => fetch(input);

function failure(
  kind: LoadBankErrorKind,
  message: string,
  status?: number,
): LoadBankResult {
  return {
    ok: false,
    error: status === undefined ? { kind, message } : { kind, message, status },
  };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function loadBank(
  url: string,
  fetchImpl: FetchLike = defaultFetch,
): Promise<LoadBankResult> {
  let response: Response;
  try {
    response = await fetchImpl(url);
  } catch (error) {
    return failure("network", `request failed: ${describe(error)}`);
  }

  let text: string;
  try {
    if (!response.ok) {
      return failure(
        "http",
        `unexpected HTTP status ${String(response.status)}`,
        response.status,
      );
    }
    text = await response.text();
  } catch (error) {
    return failure(
      "network",
      `reading the response failed: ${describe(error)}`,
    );
  }

  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch (error) {
    return failure("parse", `malformed JSON: ${describe(error)}`);
  }

  try {
    if (!isBank(data)) {
      return failure("invalid", "data does not match the question bank shape");
    }
  } catch (error) {
    return failure("invalid", `bank check failed: ${describe(error)}`);
  }
  return { ok: true, bank: data };
}
