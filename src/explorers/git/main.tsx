import "@/styles/app.css";
import "./git.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { mountGlass } from "@/lib/glass.ts";
import { mountIsoDefs } from "@/lib/iso/index.ts";
import { App } from "./app.tsx";

// The Liquid Glass lens filters and the iso gradients are document-level SVG defs.
mountGlass();
mountIsoDefs();

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
