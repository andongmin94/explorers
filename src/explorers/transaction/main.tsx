// index.html: lessons 01, 03 and 04 (?lesson=…). Lesson 02 lives on
// deadlock.html (deadlock-main.tsx); ?lesson=deadlock forwards there.
import "@/styles/app.css";
import "./transaction.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { mountGlass } from "@/lib/glass.ts";
import { mountIsoDefs } from "@/lib/iso/index.ts";
import { currentLesson, lessonHref } from "@/lib/lesson-rail.ts";
import { App } from "./app.tsx";
import { isolationPage } from "./isolation.tsx";
import { LESSONS } from "./lessons.ts";
import { lostUpdatePage } from "./lost-update.tsx";

const lesson = currentLesson(LESSONS);
if (lesson.href) location.replace(lessonHref(LESSONS, lesson));
else {
  const page =
    lesson.id === "lost-update"
      ? lostUpdatePage
      : isolationPage(lesson.id as "repeatable-read" | "write-skew");
  if (lesson.id !== "lost-update") document.title = `${lesson.name} · 트랜잭션 탐색기`;

  // The Liquid Glass lens filters and the iso gradients are document-level SVG defs.
  mountGlass();
  mountIsoDefs();

  createRoot(document.getElementById("app")!).render(
    <StrictMode>
      <App page={page} />
    </StrictMode>,
  );
}
