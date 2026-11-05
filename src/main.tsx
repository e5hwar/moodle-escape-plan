import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./skillcat-ds.css";
import "./lab-ds.css";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { DemoControlsRoot } from "./components/DemoControls";
import { initCustomScrollbars } from "./customScrollbars";
import { initDisableSearchAutofill } from "./disableSearchAutofill";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <DemoControlsRoot>
        <App />
      </DemoControlsRoot>
    </ErrorBoundary>
  </StrictMode>,
);

initCustomScrollbars();
initDisableSearchAutofill();
