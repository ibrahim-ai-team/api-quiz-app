import { describe, expect, it } from "vitest";
import { strings } from "../../src/ui/strings";

describe("smoke", () => {
  it("exposes the application name", () => {
    expect(strings.appName).toBe("ApiQuiz");
  });
});
