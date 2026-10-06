import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Must run before any Monaco editor mounts: configures workers and the local Monaco instance.
import "./lib/monaco-setup";
import "./index.css";
import App from "./App";

const container = document.getElementById("root");
if (container === null) {
  throw new Error("ForgeAI could not start: #root element is missing from index.html.");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
