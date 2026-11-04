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
  const progress = (lessonProgress[lesson.id] ??= {
    seen: [],
    done: false,
  });
  let changed = false;
  if (
    playback.started &&
    !playback.done &&
    !progress.seen.includes(playback.activeStep)
  ) {
    progress.seen.push(playback.activeStep);
    changed = true;
  }
  if (playback.done && !progress.done) {
    progress.done = true;
    progress.seen = lesson.steps.map((step, index) => index);
    changed = true;
  }
  if (changed) {
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
  // Visiting the last step is not completion until playback reaches the summary.
  return (
    Math.min(progress.seen.length, lesson.steps.length - 1) /
    lesson.steps.length
  );
}
function getLessonStatus(lesson) {
  const progress = lessonProgress[lesson.id];
  if (progress?.done) {
    return "done";
  }
  return progress?.seen.length ? "progress" : "new";
}
export { getLessonCompletion, getLessonStatus, recordLessonProgress };
