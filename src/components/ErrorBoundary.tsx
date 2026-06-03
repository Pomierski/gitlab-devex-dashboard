'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  /**
   * Bumped every time the user clicks "Try again". Used as the `key` of the
   * subtree so React unmounts and remounts children — clearing any state
   * that was corrupt at the moment of the throw. Without this, retrying with
   * the same data simply re-throws on the next render.
   */
  resetKey: number;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, resetKey: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private retry = () => {
    this.setState((s) => ({ hasError: false, resetKey: s.resetKey + 1 }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred. Try again, or refresh the page if it persists.
          </p>
          <button
            onClick={this.retry}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
        </div>
      );
    }
    // `key` forces a fresh subtree on every retry so children re-mount
    // instead of resuming from whatever state caused the throw.
    return <div key={this.state.resetKey}>{this.props.children}</div>;
  }
}
