import posthog from "posthog-js";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { isElectron } from "./utils/platform";

const isPrPreview = /\/pr-\d+\//.test(window.location.pathname);
const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const platform = isElectron() ? "electron" : "web";

posthog.init(import.meta.env.VITE_POSTHOG_KEY as string, {
  api_host: import.meta.env.VITE_POSTHOG_HOST as string,
  person_profiles: "never",
  capture_pageview: true,
  capture_pageleave: true,
  autocapture: false,
  loaded: (ph) => {
    if (isPrPreview || isLocalhost) { ph.opt_out_capturing(); return; }
    ph.register({ platform });
  },
});

const rootEl = document.getElementById("root");
if (!rootEl) { throw new Error("Root element #root not found in DOM"); }
createRoot(rootEl).render(
  <ErrorBoundary>
    <StrictMode>
      <App />
    </StrictMode>
  </ErrorBoundary>,
);
