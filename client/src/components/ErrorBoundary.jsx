import { Component } from 'react';

/**
 * ErrorBoundary — catches any unhandled React render errors and shows a
 * friendly fallback instead of a blank white screen.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <YourComponent />
 *   </ErrorBoundary>
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log to console — in production this would go to Sentry
    console.error('ErrorBoundary caught an error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-amber-50 dark:bg-gray-900 flex items-center justify-center p-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 p-8 max-w-md w-full text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-slate-500 dark:text-gray-400 mb-6">
              An unexpected error occurred. Please try refreshing the page or
              click the button below to recover.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <pre className="text-left text-xs bg-rose-50 dark:bg-red-950 text-rose-700 dark:text-red-300 p-3 rounded-lg mb-4 overflow-auto max-h-40">
                {this.state.error.toString()}
              </pre>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 text-slate-700 dark:text-gray-300 text-sm font-semibold px-4 py-2 rounded-lg transition"
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

export default ErrorBoundary;
