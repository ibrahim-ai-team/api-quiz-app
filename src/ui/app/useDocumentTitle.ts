import { useEffect } from "react";

/**
 * Sets `document.title` while the calling view is shown (FR-27, US-10.6).
 * Each view sets its own title, so the error boundary fallback always wins
 * over the view it replaced.
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
