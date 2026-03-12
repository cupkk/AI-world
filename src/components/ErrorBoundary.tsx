import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
          <div className="rounded-2xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40 p-8 max-w-lg w-full">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-red-800 dark:text-red-300 mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-red-600 dark:text-red-400 mb-4">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
