import { Component, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
          <p className="max-w-md text-sm text-muted-foreground">{this.state.error.message}</p>
          <button
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
