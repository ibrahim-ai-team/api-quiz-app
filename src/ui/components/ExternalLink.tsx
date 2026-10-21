/**
 * External link with an https guard and a new-tab cue (T-13, issue #33;
 * US-3.2, US-3.5, US-12.1; standard 5; ADR-0001 V-2; views.md §0, §3).
 *
 * Only `https:` URLs without credentials become links. Anything else
 * (`javascript:`, `data:`, `http:`, relative or malformed input, user:pass@)
 * renders as plain text, never as an `<a>`. The href written to the DOM is
 * the WHATWG parser's re-serialised `url.href`, so stripped leading spaces or
 * control characters in the input never reach the attribute.
 */
import type { ReactNode } from "react";
import { strings } from "../strings";
import styles from "./common.module.css";
import { safeHttpsHref } from "./safeUrl";

export { safeHttpsHref, safeHttpsUrl } from "./safeUrl";

export interface ExternalLinkProps {
  /** Untrusted URL; guarded by `safeHttpsHref`. */
  readonly href: string;
  /** Link text; the cue is appended and is part of the accessible name. */
  readonly children: ReactNode;
  /** Plain text shown instead of a link when `href` is unsafe. */
  readonly fallback?: ReactNode;
}

export function ExternalLink({ href, children, fallback }: ExternalLinkProps) {
  const safe = safeHttpsHref(href);
  if (safe === null) return <>{fallback ?? children}</>;
  return (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.externalLink}
    >
      {/* One inline span keeps the space before the cue in the name. */}
      <span>
        {children} {strings.common.newTabCue}
      </span>
      <NewTabIcon />
    </a>
  );
}

function NewTabIcon() {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
