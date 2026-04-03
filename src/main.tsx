import posthog from "posthog-js";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";

const isPrPreview = /\/pr-\d+\//.test(window.location.pathname);

posthog.init("phc_xEKzVGincEBYoURACTWeCF9AVxJ6f9dtVDMT5w3Zgev8", {
  api_host: "https://eu.i.posthog.com",
  person_profiles: "never",
  capture_pageview: true,
  capture_pageleave: true,
  autocapture: false,
  loaded: (ph) => { if (isPrPreview) { ph.opt_out_capturing(); } },
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
