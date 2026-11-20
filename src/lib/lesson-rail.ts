// Lessons of an explorer: which one this page shows (?lesson=…), their URLs
// and progress ids. The rail itself is src/components/shell/lesson-rail.tsx.
//
//   const lesson = currentLesson(LESSONS);                     // from ?lesson=…
//   const progress = useProgress(progressIdFor("cpu", LESSONS, lesson.id), { scenes, recall });
//
// Lessons switch by navigation (each lesson is its own URL), so a page only
// ever runs one lesson. A lesson may give its own `href` (e.g. another page).
import { lessonId } from "./lesson-kit.ts";

/** The part of a lesson the rail needs. */
export interface RailLesson {
  id: string;
  name: string;
  sub?: string;
  href?: string;
}

/** The lesson named by ?lesson=…, or the first one. */
export function currentLesson<L extends RailLesson>(
  lessons: L[],
  search: string = globalThis.location?.search ?? "",
): L {
  const id = new URLSearchParams(search).get("lesson");
  return lessons.find((l) => l.id === id) ?? lessons[0];
}

/** URL of a lesson: its own href, the bare page for the first, else ?lesson=id. */
export function lessonHref(lessons: RailLesson[], lesson: RailLesson): string {
  if (lesson.href) return lesson.href;
  return lesson.id === lessons[0].id ? "./" : `./?lesson=${encodeURIComponent(lesson.id)}`;
}

/** Next lesson in this explorer, or null after the last one (for the 정리 link). */
export function nextLesson(
  lessons: RailLesson[],
  currentId: string,
): { href: string; title: string } | null {
  const i = lessons.findIndex((l) => l.id === currentId);
  const next = i >= 0 ? lessons[i + 1] : null;
  return next ? { href: lessonHref(lessons, next), title: next.name } : null;
}

/** Progress id for a lesson of this explorer (see lessonId in lesson-kit.ts). */
export function progressIdFor(explorer: string, lessons: RailLesson[], id: string): string {
  return lessonId(explorer, id, lessons[0].id);
}
