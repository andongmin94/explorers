// Reconstructed from the distributed Protocol Explorer JavaScript.
const PROGRESS_STORAGE_KEY = "protocol-explorer:progress:v1";
function loadLessonProgress() {
  try {
    const e = JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY));
    return e && typeof e == "object" ? e : {};
  } catch {
    return {};
  }
}
const lessonProgress = loadLessonProgress();
function saveLessonProgress() {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(lessonProgress));
  } catch {}
}
function recordLessonProgress(e, t) {
  const s = (lessonProgress[e.id] ??= {
    seen: [],
    done: !1,
  });
  let a = !1;
  return (
    t.started &&
      !t.done &&
      !s.seen.includes(t.activeStep) &&
      (s.seen.push(t.activeStep), (a = !0)),
    t.done &&
      !s.done &&
      ((s.done = !0), (s.seen = e.steps.map((n, o) => o)), (a = !0)),
    a && saveLessonProgress(),
    a
  );
}
function getLessonCompletion(e) {
  const t = lessonProgress[e.id];
  return t
    ? t.done
      ? 1
      : Math.min(t.seen.length, e.steps.length - 1) / e.steps.length
    : 0;
}
function getLessonStatus(e) {
  const t = lessonProgress[e.id];
  return t?.done ? "done" : t?.seen.length ? "progress" : "new";
}
export { getLessonCompletion, getLessonStatus, recordLessonProgress };
