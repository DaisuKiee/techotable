import React from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangle, RotateCcw, Home, RefreshCw, ChevronDown } from 'lucide-react';

const RELOAD_KEY = 'blo.chunkReloadAt';

// After a deploy, an open tab can ask for a code chunk that no longer exists.
// A full reload fixes that, so do it once instead of showing a crash screen.
const isChunkError = (error) => /Loading (CSS )?chunk [\w-]+ failed|ChunkLoadError|Failed to fetch dynamically imported module/i
  .test(`${error?.name} ${error?.message}`);

class Boundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, showDetails: false };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info?.componentStack);

    if (isChunkError(error)) {
      try {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
        if (Date.now() - last > 30000) {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
          window.location.reload();
        }
      } catch (_) { /* storage blocked: show the screen instead */ }
    }
  }

  componentDidUpdate(prevProps) {
    // Navigating away clears the crash
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null, showDetails: false });
    }
  }

  reset = () => this.setState({ error: null, showDetails: false });

  render() {
    const { error, showDetails } = this.state;
    if (!error) return this.props.children;

    const chunk = isChunkError(error);

    return (
      <div role="alert" className="flex min-h-[60vh] items-center justify-center bg-gray-50 px-4 py-16 dark:bg-dark-main">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-dark-border-default dark:bg-dark-card sm:p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-lg font-semibold text-gray-900 dark:text-dark-text-primary">
            {chunk ? 'A new version is available' : 'This page ran into a problem'}
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-dark-text-secondary">
            {chunk
              ? 'The app was updated while this tab was open. Reload to get the latest version.'
              : 'Your data is safe. Try again, or go back to the dashboard. If it keeps happening, reload the page.'}
          </p>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {chunk ? (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-500/30"
              >
                <RefreshCw className="h-4 w-4" /> Reload
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={this.reset}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-500/30"
                >
                  <RotateCcw className="h-4 w-4" /> Try again
                </button>
                <a
                  href="/dashboard"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-500/20 dark:border-dark-border-default dark:text-dark-text-primary dark:hover:bg-white/5"
                >
                  <Home className="h-4 w-4" /> Dashboard
                </a>
              </>
            )}
          </div>

          {!chunk && (
            <div className="mt-6 text-left">
              <button
                type="button"
                onClick={() => this.setState({ showDetails: !showDetails })}
                aria-expanded={showDetails}
                className="mx-auto flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-dark-text-secondary dark:hover:text-dark-text-primary"
              >
                Technical details
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
              </button>
              {showDetails && (
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-gray-100 p-3 text-xs text-gray-700 dark:bg-black/30 dark:text-gray-300">
                  {String(error?.message || error)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
}

/** Catches render crashes in the routes below it; resets when the URL changes. */
const ErrorBoundary = ({ children }) => {
  const location = useLocation();
  return <Boundary resetKey={location.pathname}>{children}</Boundary>;
};

export default ErrorBoundary;
