import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  /**
   * Optional custom fallback. When omitted, a branded recovery screen renders.
   */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * App-wide error boundary. Catches render-time errors anywhere in the React
 * tree and shows a recovery screen instead of a white screen of death.
 *
 * Async errors (promises, event handlers, edge function calls) are NOT caught
 * here — those should be handled with try/catch + toast at the call site.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Surface to the console for production debugging via browser devtools.
    // (console.error is preserved by the prod build — only log/info/debug are stripped.)
    console.error("[ErrorBoundary] Render error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    window.location.href = "/";
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    const message = this.state.error?.message || "An unexpected error occurred.";

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button onClick={this.handleReload} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Reload page
            </Button>
            <Button variant="outline" onClick={this.handleHome} className="gap-2">
              <Home className="h-4 w-4" />
              Go home
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            If this keeps happening, please contact support.
          </p>
        </div>
      </div>
    );
  }
}
