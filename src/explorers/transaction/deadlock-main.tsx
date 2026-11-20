// deadlock.html: lesson 02 · 교착 상태.
import "@/styles/app.css";
import "./transaction.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { mountGlass } from "@/lib/glass.ts";
import { mountIsoDefs } from "@/lib/iso/index.ts";
import { App } from "./app.tsx";
import { deadlockPage } from "./deadlock.tsx";

// The Liquid Glass lens filters and the iso gradients are document-level SVG defs.
mountGlass();
mountIsoDefs();

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <App page={deadlockPage} />
  </StrictMode>,
);
