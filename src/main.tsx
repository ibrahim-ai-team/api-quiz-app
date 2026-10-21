import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/app/App";

const container = document.getElementById("root");

if (container === null) {
  throw new Error("Root element #root not found");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
