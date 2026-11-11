// Reconstructed from the distributed Protocol Explorer JavaScript.
const PROGRESS_STORAGE_KEY = "protocol-explorer:progress:v1";
function loadLessonProgress() {
  try {
    const savedProgress = JSON.parse(
      localStorage.getItem(PROGRESS_STORAGE_KEY),
    );
    return savedProgress && typeof savedProgress === "object"
      ? savedProgress
      : {};
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
function recordLessonProgress(lesson, playback) {
  if (!playback.started || lessonProgress[lesson.id]?.done) return false;
  const progress = (lessonProgress[lesson.id] ??= {
    seen: [],
    done: false,
  });
  let changed = !progress.started;
  progress.started = true;
  playback.steps.forEach((status, index) => {
    if (status === "done" && !progress.seen.includes(index)) {
      progress.seen.push(index);
      changed = true;
    }
  });
  if (changed) {
    progress.done = progress.seen.length === lesson.steps.length;
    saveLessonProgress();
  }
  return changed;
}
function getLessonCompletion(lesson) {
  const progress = lessonProgress[lesson.id];
  if (!progress) {
    return 0;
  }
  if (progress.done) {
    return 1;
  }
  return (
    Math.min(progress.seen.length, lesson.steps.length - 1) / lesson.steps.length
  );
}
function getLessonStatus(lesson) {
  const progress = lessonProgress[lesson.id];
  if (progress?.done) {
    return "done";
  }
  return progress?.started || progress?.seen.length ? "progress" : "new";
}
export { getLessonCompletion, getLessonStatus, recordLessonProgress };
