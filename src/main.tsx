import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { bankUrl } from "./content/bankUrl";
import { loadBank } from "./content/loader";
// Global tokens and base styles first, so component CSS Modules follow them.
import "./ui/styles/tokens.css";
import "./ui/styles/base.css";
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

createRoot(container).render(
  <StrictMode>
    <App bankPromise={bankPromise} reloadBank={reloadBank} />
  </StrictMode>,
);
