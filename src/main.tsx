import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { bankUrl } from "./content/bankUrl";
import { loadBank } from "./content/loader";
// Global tokens and base styles first, so component CSS Modules follow them.
import "./ui/styles/tokens.css";
import "./ui/styles/base.css";
// Hides the static index.html fallback during a normal load (T-47; see
// bootFallbackCssPlugin in vite.config.ts). createRoot().render replaces it.
import "virtual:boot-fallback.css";
import { App } from "./ui/app/App";

// Start the bank request before React renders (ADR-0001 amendment A4), so the
// shell paints while the data arrives. loadBank never rejects.
const bankPromise = loadBank(bankUrl);
// Retry (FR-25) starts a fresh request for the same asset.
const reloadBank = () => loadBank(bankUrl);

const container = document.getElementById("root");

if (container === null) {
  throw new Error("Root element #root not found");
}

// Standard 10 / SEC-R05 L-1: React's default handlers log errors to the
// console. Caught errors already show the app error view, and nothing about
// the user or the failure is logged in production.
const silent = (): void => undefined;

createRoot(container, {
  onCaughtError: silent,
  onUncaughtError: silent,
  onRecoverableError: silent,
}).render(
  <StrictMode>
    <App bankPromise={bankPromise} reloadBank={reloadBank} />
  </StrictMode>,
);
