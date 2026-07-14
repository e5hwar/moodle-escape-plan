import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { initCustomScrollbars } from "./customScrollbars";
import { initDisableSearchAutofill } from "./disableSearchAutofill";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

initCustomScrollbars();
initDisableSearchAutofill();
