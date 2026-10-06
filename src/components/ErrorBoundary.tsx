import { Component, type ErrorInfo, type ReactNode } from "react";
import { PlaceholderPage } from "./PlaceholderPage";

// Without a boundary, any render error in a page/menu unmounts the whole React
// tree — the UI goes blank and unresponsive (reads as a "freeze"). This catches
// it and shows the error placeholder; the actual error goes to the console.
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
    // Placeholder until the error screen is specced (Figma list item 87);
    // the real error is in the console (componentDidCatch above).
    return <PlaceholderPage name="Error Page" />;
  }
}
