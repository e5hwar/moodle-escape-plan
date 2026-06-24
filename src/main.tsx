import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initCustomScrollbars } from "./customScrollbars";
import { initDisableSearchAutofill } from "./disableSearchAutofill";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

initCustomScrollbars();
initDisableSearchAutofill();
