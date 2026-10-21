import { describe, expect, it } from "vitest";
import {
  parseRoute,
  routeHref,
  routeKey,
  type LinkableRoute,
  type Route,
} from "./router";

describe("parseRoute", () => {
  it.each<[string, Route]>([
    ["", { name: "landing" }],
    ["#", { name: "landing" }],
    ["#/", { name: "landing" }],
    ["#/quiz", { name: "quiz" }],
    ["#/quiz/", { name: "quiz" }],
    ["#/results", { name: "results" }],
    ["#/topic/http-methods", { name: "topic", topicId: "http-methods" }],
    ["#/topic/http-methods/", { name: "topic", topicId: "http-methods" }],
    ["#/topic/a%20b", { name: "topic", topicId: "a b" }],
  ])("maps %j to a known route", (hash, route) => {
    expect(parseRoute(hash)).toEqual(route);
  });

  it.each([
    "#main",
    "#quiz",
    "#/unknown",
    "#/Quiz",
    "#/quiz/extra",
    "#/topic",
    "#/topic/",
    "#/topic/a/b",
    "#/topic/%E0%A4%A",
    "#//",
    "#/results?x=1",
  ])("maps %j to the 404 route", (hash) => {
    expect(parseRoute(hash)).toEqual({ name: "notFound" });
  });
});

describe("routeHref and routeKey", () => {
  it("round-trips every route through parseRoute", () => {
    const routes: LinkableRoute[] = [
      { name: "landing" },
      { name: "quiz" },
      { name: "results" },
      { name: "topic", topicId: "a b/c" },
    ];
    for (const route of routes) {
      expect(parseRoute(routeHref(route))).toEqual(route);
    }
  });

  it("gives each topic its own key", () => {
    expect(routeKey({ name: "topic", topicId: "a" })).not.toBe(
      routeKey({ name: "topic", topicId: "b" }),
    );
    expect(routeKey({ name: "quiz" })).toBe("quiz");
  });
});
