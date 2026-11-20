// Lesson rail: the glass sidebar listing an explorer's lessons, each with a
// status dot (ring: new, half: in progress, filled: done) and a percentage.
// Same look as the protocol explorer's picker. From 1280px wide it is a
// column left of the stage; below that it is a drawer opened from the top bar.
//
//   const lessons = [{ id: "rr", name: "라운드 로빈", sub: "할당량과 응답" }, …];
//   const lesson = currentLesson(lessons);            // from ?lesson=…
//   const rail = mountRail({ explorer: "cpu", title: "CPU 스케줄링", lessons, current: lesson.id });
//   rail.watch(progress);                             // refresh LEDs on progress
//
// Lessons switch by navigation (each lesson is its own URL), so a page only
// ever runs one lesson. A lesson may give its own `href` (e.g. another page).
import { icon } from "./hw.js";
import { lessonId, lessonStatus } from "./lesson-kit.js";

const STATUS_TEXT = { new: "시작 전", progress: "진행 중", done: "완료" };

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** The lesson named by ?lesson=…, or the first one. */
export function currentLesson(lessons, search = globalThis.location?.search ?? "") {
  const id = new URLSearchParams(search).get("lesson");
  return lessons.find((l) => l.id === id) ?? lessons[0];
}

/** URL of a lesson: its own href, the bare page for the first, else ?lesson=id. */
export function lessonHref(lessons, lesson) {
  if (lesson.href) return lesson.href;
  return lesson.id === lessons[0].id ? "./" : `./?lesson=${encodeURIComponent(lesson.id)}`;
}

/** Next lesson in this explorer, or null after the last one. For recapHtml({ next }). */
export function nextLesson(lessons, currentId) {
  const i = lessons.findIndex((l) => l.id === currentId);
  const next = i >= 0 ? lessons[i + 1] : null;
  return next ? { href: lessonHref(lessons, next), title: next.name } : null;
}

/** Progress id for a lesson of this explorer (see lessonId in lesson-kit.js). */
export function progressIdFor(explorer, lessons, id) {
  return lessonId(explorer, id, lessons[0].id);
}

export function railHtml({ explorer, title, lessons, current }) {
  const rows = lessons
    .map((lesson, i) => {
      const { status, ratio } = lessonStatus(progressIdFor(explorer, lessons, lesson.id));
      const here = lesson.id === current;
      return `<a class="hw-rail-item" href="${esc(lessonHref(lessons, lesson))}" data-lesson="${esc(lesson.id)}"${here ? ' aria-current="page"' : ""}>
        <span class="hw-led hw-rail-led is-${status}" data-status="${status}"></span>
        <span class="hw-rail-text"><span class="hw-rail-name"><span class="hw-index">${String(i + 1).padStart(2, "0")}</span> ${esc(lesson.name)}</span>${lesson.sub ? `<span class="hw-rail-sub">${esc(lesson.sub)}</span>` : ""}</span>
        <span class="hw-rail-pct hw-mono" aria-label="${STATUS_TEXT[status]}">${Math.round(ratio * 100)}%</span>
      </a>`;
    })
    .join("");
  return `<aside class="hw-plate hw-rail" id="lessons" aria-label="${esc(title)} 레슨">
    <div class="hw-plate-head">
      <span class="hw-label">${esc(title)}</span>
      <button class="hw-key hw-key--sm hw-key--icon hw-rail-close" type="button" aria-label="레슨 목록 닫기">${icon("close")}</button>
    </div>
    <nav class="hw-rail-body"><div class="hw-list hw-rail-list">${rows}</div></nav>
  </aside>`;
}

const MENU = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';

/**
 * Put the rail into the page: first child of .hw-console (which gets
 * .has-rail), a "레슨" key at the start of .hw-topbar for the drawer, and a
 * scrim. Returns { element, refresh(), watch(progress) }.
 */
export function mountRail({ explorer, title, lessons, current, root = document }) {
  const consoleEl = root.querySelector(".hw-console");
  const topbar = root.querySelector(".hw-topbar");
  consoleEl.classList.add("has-rail");
  consoleEl.insertAdjacentHTML("afterbegin", railHtml({ explorer, title, lessons, current }));
  const element = consoleEl.querySelector(":scope > .hw-rail");
  const page = consoleEl.closest(".hw-page") ?? root.body;
  page.insertAdjacentHTML("beforeend", '<div class="hw-rail-scrim" aria-hidden="true"></div>');
  const scrim = page.querySelector(":scope > .hw-rail-scrim");

  let button = null;
  if (topbar) {
    topbar.insertAdjacentHTML(
      "afterbegin",
      `<button class="hw-key hw-key--sm hw-rail-btn" type="button" aria-expanded="false" aria-controls="lessons">${MENU}<span>레슨</span></button>`,
    );
    button = topbar.querySelector(":scope > .hw-rail-btn");
  }

  const drawer = globalThis.matchMedia?.("(max-width: 1279px)");
  const isOpen = () => page.classList.contains("is-rail-open");
  function setOpen(open) {
    const on = Boolean(open && drawer?.matches);
    page.classList.toggle("is-rail-open", on);
    button?.setAttribute("aria-expanded", String(on));
    if (on) (element.querySelector('[aria-current="page"]') ?? element.querySelector(".hw-rail-close")).focus({ preventScroll: true });
  }
  button?.addEventListener("click", () => setOpen(!isOpen()));
  element.querySelector(".hw-rail-close").addEventListener("click", () => {
    setOpen(false);
    button?.focus({ preventScroll: true });
  });
  scrim.addEventListener("click", () => setOpen(false));
  drawer?.addEventListener?.("change", () => setOpen(false));
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen()) {
      event.stopPropagation();
      setOpen(false);
      button?.focus({ preventScroll: true });
    }
  }, true);

  function refresh() {
    for (const row of element.querySelectorAll(".hw-rail-item")) {
      const { status, ratio } = lessonStatus(progressIdFor(explorer, lessons, row.dataset.lesson));
      const led = row.querySelector(".hw-rail-led");
      if (led.dataset.status !== status) {
        led.dataset.status = status;
        led.className = `hw-led hw-rail-led is-${status}`;
      }
      const pct = row.querySelector(".hw-rail-pct");
      pct.textContent = `${Math.round(ratio * 100)}%`;
      pct.setAttribute("aria-label", STATUS_TEXT[status]);
    }
  }

  return {
    element,
    refresh,
    watch(progress) {
      progress?.onChange?.(refresh);
      refresh();
    },
  };
}
