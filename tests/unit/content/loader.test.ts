/**
 * Runtime loader (T-06, US-7.6): every failure path resolves to an error
 * result; nothing throws or rejects.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadBank, type FetchLike } from "../../../src/content/loader.ts";

const URL = "/api-quiz-app/assets/bank-test.json";
const FIXTURE = readFileSync(
  path.resolve(import.meta.dirname, "../../e2e/fixtures/bank.json"),
  "utf8",
);

function respond(body: string, status = 200): FetchLike {
  return (input) => {
    expect(input).toBe(URL);
    return Promise.resolve(new Response(body, { status }));
  };
}

describe("loadBank", () => {
  it("returns ok with the bank for a valid response", async () => {
    const result = await loadBank(URL, respond(FIXTURE));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bank.contentVersion).toBe("e2e-fixture-1");
      expect(result.bank.questions.length).toBeGreaterThan(0);
    }
  });

  it("returns an http error for 404", async () => {
    await expect(loadBank(URL, respond("not found", 404))).resolves.toEqual({
      ok: false,
      error: {
        kind: "http",
        message: "unexpected HTTP status 404",
        status: 404,
      },
    });
  });

  it("returns an http error for 500 even with a valid body", async () => {
    const result = await loadBank(URL, respond(FIXTURE, 500));
    expect(result).toMatchObject({ ok: false, error: { kind: "http" } });
  });

  it("returns a network error when fetch rejects", async () => {
    const result = await loadBank(URL, () =>
      Promise.reject(new TypeError("Failed to fetch")),
    );
    expect(result).toEqual({
      ok: false,
      error: { kind: "network", message: "request failed: Failed to fetch" },
    });
  });

  it("returns a network error when fetch throws synchronously", async () => {
    const result = await loadBank(URL, () => {
      throw new Error("boom");
    });
    expect(result).toMatchObject({ ok: false, error: { kind: "network" } });
  });

  it("returns a network error when reading the body fails", async () => {
    const broken = {
      ok: true,
      status: 200,
      text: () => Promise.reject(new Error("stream aborted")),
    } as unknown as Response;
    const result = await loadBank(URL, () => Promise.resolve(broken));
    expect(result).toMatchObject({ ok: false, error: { kind: "network" } });
  });

  it("returns a parse error for invalid JSON", async () => {
    const result = await loadBank(URL, respond("{not json"));
    expect(result).toMatchObject({ ok: false, error: { kind: "parse" } });
  });

  it.each([
    ["null", "null"],
    ["an array", "[]"],
    [
      "a wrong schemaVersion",
      FIXTURE.replace('"schemaVersion": 1', '"schemaVersion": 2'),
    ],
    ["a data: URL style string", JSON.stringify("data:application/json,{}")],
  ])("returns an invalid error for %s", async (_label, body) => {
    const result = await loadBank(URL, respond(body));
    expect(result).toMatchObject({ ok: false, error: { kind: "invalid" } });
  });

  it("uses the global fetch by default and still never throws", async () => {
    // No server at this relative URL in Node: fetch rejects (invalid URL).
    const result = await loadBank("relative/bank.json");
    expect(result).toMatchObject({ ok: false, error: { kind: "network" } });
  });
});
