/**
 * Top-level error boundary around the routed views (standard 10, NFR-9).
 * It resets when the route changes, so "Go to the home page" recovers.
 * Nothing is logged (standard 10: no console output, no user data).
 */
import { Component, type ReactNode } from "react";

export interface ErrorBoundaryProps {
  /** A change of this value clears a caught error (the route key). */
  readonly resetKey: string;
  readonly fallback: (reset: () => void) => ReactNode;
  /** Called after a manual reset has re-rendered the children (focus). */
  readonly onReset?: () => void;
  readonly children: ReactNode;
}

interface ErrorBoundaryState {
  readonly hasError: boolean;
  /** The resetKey the current state belongs to. */
  readonly key: string;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, key: props.resetKey };
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState,
  ): Partial<ErrorBoundaryState> | null {
    return props.resetKey === state.key
      ? null
      : { hasError: false, key: props.resetKey };
  }

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  private readonly reset = (): void => {
    // The callback runs after the commit, when the restored view is mounted.
    this.setState({ hasError: false }, this.props.onReset);
  };

  override render(): ReactNode {
    return this.state.hasError
      ? this.props.fallback(this.reset)
      : this.props.children;
  }
}
