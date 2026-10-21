/**
 * Tiny hash router (T-08; ADR-0001 routing, G13). No dependency: the app is
 * served from a static host, so every view lives behind `#/...` and a page
 * refresh always loads index.html.
 */

export type Route =
  | { readonly name: "landing" }
  | { readonly name: "topic"; readonly topicId: string }
  | { readonly name: "quiz" }
  | { readonly name: "results" }
  | { readonly name: "notFound" };

const NOT_FOUND: Route = { name: "notFound" };

/**
 * Pure mapping from `location.hash` to a route. `""`, `"#"` and `"#/"` are
 * the landing view; one trailing slash is tolerated; anything else that does
 * not match exactly is the 404 view. The topic id is percent-decoded and is
 * only ever compared against bank topic ids, never rendered.
 */
export function parseRoute(hash: string): Route {
  if (hash === "" || hash === "#" || hash === "#/") return { name: "landing" };
  if (!hash.startsWith("#/")) return NOT_FOUND;

  let path = hash.slice(2);
  if (path.endsWith("/")) path = path.slice(0, -1);
  const segments = path.split("/");

  if (segments.length === 1) {
    if (segments[0] === "quiz") return { name: "quiz" };
    if (segments[0] === "results") return { name: "results" };
    return NOT_FOUND;
  }
  if (segments.length === 2 && segments[0] === "topic") {
    const raw = segments[1] ?? "";
    let topicId: string;
    try {
      topicId = decodeURIComponent(raw);
    } catch {
      return NOT_FOUND;
    }
    return topicId === "" ? NOT_FOUND : { name: "topic", topicId };
  }
  return NOT_FOUND;
}

/** A route that can be linked to (the 404 view has no address of its own). */
export type LinkableRoute = Exclude<Route, { name: "notFound" }>;

/** Hash href for a route, for links (`href={routeHref(...)}`). */
export function routeHref(route: LinkableRoute): string {
  switch (route.name) {
    case "landing":
      return "#/";
    case "topic":
      return `#/topic/${encodeURIComponent(route.topicId)}`;
    case "quiz":
      return "#/quiz";
    case "results":
      return "#/results";
  }
}

/** Stable identity of a route, used to detect route changes. */
export function routeKey(route: Route): string {
  return route.name === "topic" ? `topic:${route.topicId}` : route.name;
}
