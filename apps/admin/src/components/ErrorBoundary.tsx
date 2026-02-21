import { Component } from 'react';
import type { ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { captureException } from '@/lib/sentry';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

/**
 * Global Error Boundary - Catches React component errors and prevents crashes
 *
 * Production: Shows user-friendly error message
 * Development: Shows full error details for debugging
 *
 * @see https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Log error details for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Send to Sentry error tracking service
    captureException(error, {
      react: {
        componentStack: errorInfo.componentStack,
      },
    });

    // Store error info in state
    this.setState({
      errorInfo: errorInfo.componentStack
    });
  }

  handleReset = () => {
    // Reset error state and reload the page
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });

    // Reload the current page
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isDevelopment = import.meta.env.DEV;

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
          <div className="w-full max-w-2xl">
            <Alert variant="destructive" className="border-2">
              <AlertCircle className="h-5 w-5" />
              <AlertTitle className="text-lg font-semibold mb-2">
                Something went wrong
              </AlertTitle>
              <AlertDescription className="space-y-4">
                <p className="text-sm">
                  {isDevelopment
                    ? 'A React component error occurred. See details below.'
                    : 'An unexpected error occurred. Please try refreshing the page.'}
                </p>

                {/* Show error details in development */}
                {isDevelopment && this.state.error && (
                  <div className="space-y-2">
                    <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                      <p className="text-xs font-mono font-semibold mb-1">Error Message:</p>
                      <p className="text-xs font-mono text-destructive">
                        {this.state.error.message}
                      </p>
                    </div>

                    {this.state.error.stack && (
                      <details className="cursor-pointer">
                        <summary className="text-xs font-semibold mb-2 hover:underline">
                          Stack Trace (click to expand)
                        </summary>
                        <pre className="text-xs font-mono bg-slate-900 text-slate-100 p-3 rounded overflow-auto max-h-64">
                          {this.state.error.stack}
                        </pre>
                      </details>
                    )}

                    {this.state.errorInfo && (
                      <details className="cursor-pointer">
                        <summary className="text-xs font-semibold mb-2 hover:underline">
                          Component Stack (click to expand)
                        </summary>
                        <pre className="text-xs font-mono bg-slate-900 text-slate-100 p-3 rounded overflow-auto max-h-64">
                          {this.state.errorInfo}
                        </pre>
                      </details>
                    )}
                  </div>
                )}

                {/* Production error message */}
                {!isDevelopment && (
                  <div className="bg-destructive/5 border border-destructive/10 rounded-md p-3">
                    <p className="text-sm">
                      If this problem persists, please contact support with the following information:
                    </p>
                    <ul className="text-xs mt-2 space-y-1 list-disc list-inside">
                      <li>Time: {new Date().toISOString()}</li>
                      <li>Page: {window.location.pathname}</li>
                      <li>Error: {this.state.error?.name || 'Unknown'}</li>
                    </ul>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={this.handleReset}
                    variant="default"
                    size="sm"
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Reload Page
                  </Button>

                  <Button
                    onClick={() => window.location.href = '/'}
                    variant="outline"
                    size="sm"
                  >
                    Go to Dashboard
                  </Button>
                </div>
              </AlertDescription>
            </Alert>

            {/* Help text */}
            <p className="text-center text-xs text-muted-foreground mt-4">
              {isDevelopment
                ? 'This error boundary prevents the entire app from crashing. Fix the error and save to reload.'
                : 'Our team has been notified of this issue.'}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
