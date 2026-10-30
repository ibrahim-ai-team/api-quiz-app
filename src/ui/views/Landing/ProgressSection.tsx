/**
 * "Your progress" (T-44; US-6.6, US-6.8; views.md §9.1 U1, §9.6): the last
 * section of Landing, rendered only when storage is persistent (U2). Reset
 * progress opens the shared inline confirmation; confirming calls `onReset`
 * (`clearAppKeys`, only `apiquiz:` keys) and replaces the group with focused
 * result text, which stays until Landing is left or Reset is pressed again.
 */
import { useEffect, useId, useRef, useState } from "react";
import common from "../../components/common.module.css";
import { strings } from "../../strings";
import { InlineConfirm } from "./InlineConfirm";
import styles from "./Landing.module.css";

export interface ProgressSectionProps {
  /** Clears the app's saved progress; false when it failed (`ok: false`). */
  readonly onReset: () => boolean;
}

type ResetState = "closed" | "confirm" | "done" | "failed";

export function ProgressSection({ onReset }: ProgressSectionProps) {
  const id = useId();
  const [state, setState] = useState<ResetState>("closed");
  // Bumped by each event that moves focus to the message or the result
  // (also when Reset is pressed again while open).
  const [focusRequest, setFocusRequest] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);
  const resultRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (focusRequest === 0) return;
    // After Cancel (state "closed") neither element exists: no-op.
    (state === "confirm" ? messageRef : resultRef).current?.focus();
  }, [focusRequest, state]);

  const open = () => {
    setState("confirm");
    setFocusRequest((n) => n + 1);
  };
  const cancel = () => {
    setState("closed");
    triggerRef.current?.focus();
  };
  const confirm = () => {
    if (state !== "confirm") return;
    setState(onReset() ? "done" : "failed");
    setFocusRequest((n) => n + 1);
  };

  const groupId = `${id}-reset`;
  const confirming = state === "confirm";
  return (
    <section aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className={styles.aboutHeading}>
        {strings.progress.heading}
      </h2>
      <p className={common.text}>{strings.progress.description}</p>
      <div className={styles.progressActions}>
        <button
          ref={triggerRef}
          type="button"
          className={common.buttonSecondary}
          aria-expanded={confirming}
          aria-controls={groupId}
          onClick={open}
        >
          {strings.progress.reset}
        </button>
        {confirming && (
          <InlineConfirm
            id={groupId}
            message={strings.progress.resetMessage}
            confirmLabel={strings.progress.resetConfirm}
            onConfirm={confirm}
            onCancel={cancel}
            messageRef={messageRef}
          />
        )}
        {(state === "done" || state === "failed") && (
          <p ref={resultRef} tabIndex={-1} className={styles.progressResult}>
            {state === "done"
              ? strings.progress.resetDone
              : strings.progress.resetFailed}
          </p>
        )}
      </div>
    </section>
  );
}
