import { Component, type ErrorInfo, type ReactNode } from "react";

// Without a boundary, any render error in a page/menu unmounts the whole React
// tree — the UI goes blank and unresponsive (reads as a "freeze"). This catches
// it, surfaces the actual error, and offers recovery.
type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep the real stack in the console for diagnosis.
    console.error("Caught by ErrorBoundary:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          padding: 48,
          textAlign: "center",
          fontFamily: "var(--font-sans)",
          color: "#e7e7e8",
          background: "#151517",
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Something went wrong</h1>
        <p style={{ fontSize: 14, color: "#a8a8a8", maxWidth: 520, margin: 0 }}>
          The page hit an unexpected error. It has been contained so the rest of the
          app stays usable.
        </p>
        <pre
          style={{
            maxWidth: 640,
            maxHeight: 180,
            overflow: "auto",
            padding: "10px 12px",
            background: "rgba(0,0,0,0.4)",
            border: "1px solid var(--border-strong)",
            borderRadius: 6,
            fontSize: 12,
            color: "#ff9b9b",
            textAlign: "left",
            whiteSpace: "pre-wrap",
          }}
        >
          {error.message}
        </pre>
        <button
          className="new-task"
          onClick={() => this.setState({ error: null })}
        >
          Try again
        </button>
      </div>
    );
  }
}
