import { useEffect } from "react";

/**
 * Entry-sequence guard (TL F1, F2). The 2nd press of a double click on
 * Start, Next, See results or Try again lands on the view that just
 * replaced the button, anywhere on the page. While the sequence lasts, its
 * `detail > 1` mousedown (focus move, text selection) and click (radio
 * check, button action) are cancelled before React sees them.
 *
 * Armed on mount and whenever `key` changes; ended by the first mousedown
 * or click with `detail <= 1` (keyboard clicks have 0) or any key press.
 * Listens on `document` in the capture phase, so blank page areas are
 * covered too.
 */
export function useEntryClickGuard(key?: string): void {
  useEffect(() => {
    let active = true;
    const onPointer = (event: MouseEvent) => {
      if (!active) return;
      if (event.detail <= 1) {
        active = false;
        return;
      }
      event.preventDefault();
      if (event.type === "click") event.stopPropagation();
    };
    const end = () => {
      active = false;
    };
    document.addEventListener("mousedown", onPointer, true);
    document.addEventListener("click", onPointer, true);
    document.addEventListener("keydown", end, true);
    return () => {
      document.removeEventListener("mousedown", onPointer, true);
      document.removeEventListener("click", onPointer, true);
      document.removeEventListener("keydown", end, true);
    };
  }, [key]);
}
