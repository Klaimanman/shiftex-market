import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface State { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error(error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const chunkFailed = /dynamically imported module|Loading chunk|Importing a module script failed/i.test(this.state.error.message);
    return (
      <div role="alert" className="mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center">
        <AlertTriangle className="mb-3 size-7 text-danger" aria-hidden="true" />
        <h1 className="text-lg font-semibold">{chunkFailed ? 'יש גרסה חדשה של האפליקציה' : 'משהו השתבש בתצוגה'}</h1>
        <p className="mt-2 text-sm text-muted">
          {chunkFailed ? 'צריך לרענן את הדף כדי לטעון אותה.' : 'הנתונים שלך שמורים. רענון הדף בדרך כלל פותר את הבעיה.'}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 inline-flex h-11 items-center rounded-md bg-accent px-5 font-medium text-accent-ink hover:bg-accent-hover"
        >
          רענון
        </button>
      </div>
    );
  }
}
