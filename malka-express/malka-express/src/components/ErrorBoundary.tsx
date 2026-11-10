import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  failed: boolean;
}

/** Last line of defence: shows a friendly screen instead of a blank page if rendering crashes. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="center">
        <section className="card">
          <div className="mark">M</div>
          <h1>Malka Express</h1>
          <p className="muted">Something went wrong. Please reload the page.</p>
          <button className="primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </section>
      </main>
    );
  }
}
