/**
 * Landing resume slot (T-43; US-6.2, US-6.3; views.md §9.2, §9.4, §9.5):
 * the load notice (`role="status"`) and the resume card, or the discarded
 * text, between the description and the topic group. Rendered only when
 * storage is persistent (U2) and the bank did not fail (§9.2, data error).
 *
 * CLS (§9.2, TL N1/N2): an invisible, `aria-hidden` copy of the final
 * markup, sized from the startup decode, shares one grid cell with the
 * visible content, so the topic group does not move when the bank arrives.
 */
import { useEffect, useId, useRef, useState } from "react";
import { landingReserve } from "../../../content/landingReserve";
import type { BankTopic } from "../../../content/types";
import type { QuizMode, QuizScope, QuizSession } from "../../../domain";
import common from "../../components/common.module.css";
import { strings } from "../../strings";
import styles from "./Landing.module.css";
import type { LandingProgress } from "./progress";

export interface ResumeSlotProps {
  readonly progress: LandingProgress;
  /** Bank topics when the bank is ready; null while it loads. */
  readonly topics: readonly BankTopic[] | null;
  /** The ready bank has no playable topic: nothing is restored (§9.2). */
  readonly noTopics: boolean;
}

/** One `<p>`, quiz sentence first (§9.5); null when nothing was removed. */
export function noticeText(session: boolean, best: boolean): string | null {
  const parts: string[] = [];
  if (session) parts.push(strings.progress.sessionRemoved);
  if (best) parts.push(strings.progress.bestRemoved);
  return parts.length === 0 ? null : parts.join(" ");
}

function summaryText(
  mode: QuizMode,
  scopeName: string,
  answered: number,
  n: number,
): string {
  return mode === "retry-missed"
    ? strings.resume.summaryRetry(scopeName, answered, n)
    : strings.resume.summary(scopeName, answered, n);
}

/** Reserve name of a saved scope, or null when the reserve has no such topic. */
function reserveScopeName(scope: QuizScope): string | null {
  if (scope.kind === "mixed") return strings.landing.mixedLabel;
  const index = landingReserve.topicIds.indexOf(scope.topicId);
  return index === -1 ? null : (landingReserve.topicNames[index] ?? null);
}

function sessionSummary(
  session: QuizSession,
  topics: readonly BankTopic[],
): string {
  const { scope } = session.quiz;
  const name =
    scope.kind === "mixed"
      ? strings.landing.mixedLabel
      : (topics.find((topic) => topic.id === scope.topicId)?.name ?? "");
  return summaryText(
    session.quiz.mode,
    name,
    session.answers.length,
    session.quiz.questions.length,
  );
}

function InfoIcon() {
  return (
    <svg
      className={styles.noticeIcon}
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="12" cy="7.5" r="1.5" fill="currentColor" />
      <path
        d="M12 11v6.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Notice({ text }: { readonly text: string }) {
  return (
    <p className={styles.notice}>
      <InfoIcon />
      <span>{text}</span>
    </p>
  );
}

interface ResumeCardProps {
  readonly headingId: string;
  readonly summary: string;
  /** Absent for the invisible reserve copy: buttons disabled, no handlers. */
  readonly onResume?: () => void;
  readonly onDiscard?: () => void;
}

function ResumeCard({
  headingId,
  summary,
  onResume,
  onDiscard,
}: ResumeCardProps) {
  const placeholder = onResume === undefined;
  return (
    <section className={styles.card} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.cardHeading}>
        {strings.resume.heading}
      </h2>
      <p className={styles.cardText}>{summary}</p>
      <div className={common.actions}>
        <button
          type="button"
          className={common.buttonPrimary}
          disabled={placeholder || undefined}
          onClick={onResume}
        >
          {strings.resume.resume}
        </button>
        <button
          type="button"
          className={common.buttonSecondary}
          disabled={placeholder || undefined}
          onClick={onDiscard}
        >
          {strings.resume.discard}
        </button>
      </div>
    </section>
  );
}

export function ResumeSlot({ progress, topics, noTopics }: ResumeSlotProps) {
  const id = useId();
  const { resumable, notice, reserve } = progress;
  const ready = topics !== null;
  // Discard replaces the card with focused text until Landing is left.
  const [discarded, setDiscarded] = useState(false);
  const discardedRef = useRef<HTMLParagraphElement>(null);
  const resumingRef = useRef(false);
  // The status region mounts empty; its text is set after mount, so it is
  // announced (§9.5). The reserve holds the space meanwhile (no shift).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMounted(true);
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);
  useEffect(() => {
    if (discarded) discardedRef.current?.focus();
  }, [discarded]);

  // Reserve (startup decode; dropped once Landing has been left). A saved
  // topic that the reserve does not list cannot restore (same content
  // build), so the notice is reserved instead of a card (TL N2).
  const reserveName =
    reserve?.saved == null ? null : reserveScopeName(reserve.saved.scope);
  const reserveCard =
    reserve?.saved == null || reserveName === null
      ? null
      : summaryText(
          reserve.saved.mode,
          reserveName,
          reserve.saved.answers.length,
          reserve.saved.questionIds.length,
        );
  const reserveNotice =
    reserve === null
      ? null
      : noticeText(
          reserve.sessionFailed ||
            (reserve.saved !== null && reserveName === null),
          reserve.bestFailed,
        );
  // The card copy stays behind a stale notice for this Landing render (§9.2).
  const cardCopy = !ready || noTopics || notice.session ? reserveCard : null;

  const visibleNotice = mounted
    ? noticeText(notice.session, notice.best)
    : null;
  const card =
    ready && !noTopics && !discarded && resumable !== null ? resumable : null;

  const resume = () => {
    if (resumingRef.current) return;
    resumingRef.current = true;
    if (!progress.onResume()) resumingRef.current = false;
  };
  const discard = () => {
    setDiscarded(true);
    progress.onDiscard();
  };

  return (
    <div className={styles.slot}>
      {(reserveNotice !== null || cardCopy !== null) && (
        <div className={styles.slotReserve} aria-hidden="true">
          {reserveNotice !== null && <Notice text={reserveNotice} />}
          {cardCopy !== null && (
            <ResumeCard headingId={`${id}-reserve`} summary={cardCopy} />
          )}
        </div>
      )}
      <div>
        <div role="status">
          {visibleNotice !== null && <Notice text={visibleNotice} />}
        </div>
        {card !== null && topics !== null && (
          <ResumeCard
            headingId={`${id}-heading`}
            summary={sessionSummary(card, topics)}
            onResume={resume}
            onDiscard={discard}
          />
        )}
        {discarded && (
          <p ref={discardedRef} tabIndex={-1} className={common.text}>
            {strings.resume.discarded}
          </p>
        )}
      </div>
    </div>
  );
}
