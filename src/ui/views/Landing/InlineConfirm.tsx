/**
 * Inline confirmation (views.md §9.1 U7, §9.6), shared by the replace
 * confirmation under Start (T-43) and Reset progress (T-44): a focusable
 * message, a primary confirm button and a secondary Cancel. Not a modal:
 * nothing is trapped; Escape inside the group (or Cancel) calls `onCancel`,
 * which returns focus to the trigger. The caller focuses the message.
 */
import type { KeyboardEvent, Ref } from "react";
import common from "../../components/common.module.css";
import { strings } from "../../strings";
import styles from "./Landing.module.css";

export interface InlineConfirmProps {
  /** Group id (the trigger's `aria-controls`); the message is `${id}-msg`. */
  readonly id: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  /** Marks the confirm button `aria-disabled` (single-activation guard). */
  readonly busy?: boolean;
  readonly messageRef: Ref<HTMLParagraphElement>;
}

export function InlineConfirm({
  id,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  busy = false,
  messageRef,
}: InlineConfirmProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    onCancel();
  };
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape handler for the controls inside the group (§9.6)
    <div
      id={id}
      role="group"
      aria-labelledby={`${id}-msg`}
      className={styles.confirm}
      onKeyDown={onKeyDown}
    >
      <p
        id={`${id}-msg`}
        ref={messageRef}
        tabIndex={-1}
        className={styles.confirmMessage}
      >
        {message}
      </p>
      <div className={common.actions}>
        <button
          type="button"
          className={common.buttonPrimary}
          aria-disabled={busy ? true : undefined}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          className={common.buttonSecondary}
          onClick={onCancel}
        >
          {strings.common.cancel}
        </button>
      </div>
    </div>
  );
}
