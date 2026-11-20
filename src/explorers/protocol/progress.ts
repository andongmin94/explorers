// Learning progress per lesson, kept in localStorage: the steps seen (the
// picker and the top bar), and for the 정리 panel the 핵심 장면 reached, the
// first verdict of each prediction and each 확인 문제. The same marks are
// mirrored into the shared explorer progress (shared/lesson-kit.js).
import type { Lesson, PlaybackState } from "./types.ts";
import { createProgress, type LessonStatus } from "@/lib/lesson-kit.ts";
const PROGRESS_STORAGE_KEY = "protocol-explorer:progress:v1";

interface LessonProgress {
  seen: number[];
  done: boolean;
  started?: boolean;
  scenes?: number[];
  predictions?: Record<string, boolean>;
  recall?: Record<string, boolean>;
}

function loadLessonProgress(): Record<string, LessonProgress> {
  try {
    const savedProgress = JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY) as string);
    return savedProgress && typeof savedProgress === "object" ? savedProgress : {};
  } catch {
    return {};
  }
}
const lessonProgress = loadLessonProgress();
// The React page re-renders the rail and the toolbar when progress changes.
const listeners = new Set<() => void>();
let version = 0;
/** Subscribe to progress changes (for useSyncExternalStore); returns the unsubscribe. */
function subscribeProgress(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
/** A number that changes whenever progress changes. */
const progressVersion = () => version;
function saveLessonProgress() {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(lessonProgress));
  } catch {}
  version++;
  listeners.forEach((listener) => listener());
}
function recordLessonProgress(lesson: Lesson, playback: PlaybackState) {
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
function getLessonCompletion(lesson: Lesson) {
  const progress = lessonProgress[lesson.id];
  if (!progress) {
    return 0;
  }
  if (progress.done) {
    return 1;
  }
  return Math.min(progress.seen.length, lesson.steps.length - 1) / lesson.steps.length;
}
function getLessonStatus(lesson: Lesson): LessonStatus {
  const progress = lessonProgress[lesson.id];
  if (progress?.done) {
    return "done";
  }
  return progress?.started || progress?.seen.length ? "progress" : "new";
}
const sharedProgress = createProgress("protocol");
const entry = (lesson: Lesson) => (lessonProgress[lesson.id] ??= { seen: [], done: false });

/** A 핵심 장면 (a step with a prediction) was reached. */
function markKeyScene(lesson: Lesson, step: number) {
  const progress = entry(lesson);
  progress.scenes ??= [];
  sharedProgress.markScene(`${lesson.id}:${step}`);
  if (progress.scenes.includes(step)) return;
  progress.scenes.push(step);
  saveLessonProgress();
}
/** The first answer to the prediction for this packet. */
function markPrediction(lesson: Lesson, packet: number, correct: boolean) {
  const progress = entry(lesson);
  progress.predictions ??= {};
  sharedProgress.markPrediction(`${lesson.id}:${packet}`, correct);
  if (packet in progress.predictions) return;
  progress.predictions[packet] = Boolean(correct);
  saveLessonProgress();
}
/** A 확인 문제 answer; once right it stays right. */
function markRecall(lesson: Lesson, id: string, correct: boolean) {
  const progress = entry(lesson);
  progress.recall ??= {};
  if (progress.recall[id]) return;
  progress.recall[id] = Boolean(correct);
  saveLessonProgress();
}
/** Counts for the progress line of one lesson's 정리. */
export interface LearningSummary {
  scenesSeen: number;
  scenesTotal: number;
  predictionsAnswered: number;
  predictionsRight: number;
  recallRight: number;
  recallTotal: number;
}
function getLearningSummary(
  lesson: Lesson,
  { scenes = 0, recall = [] }: { scenes?: number; recall?: { id: string }[] } = {},
): LearningSummary {
  const progress: Partial<LessonProgress> = lessonProgress[lesson.id] ?? {};
  const predictions = Object.values(progress.predictions ?? {});
  return {
    scenesSeen: Math.min((progress.scenes ?? []).length, scenes),
    scenesTotal: scenes,
    predictionsAnswered: predictions.length,
    predictionsRight: predictions.filter(Boolean).length,
    recallRight: recall.filter((q) => progress.recall?.[q.id]).length,
    recallTotal: recall.length,
  };
}

export {
  getLearningSummary,
  getLessonCompletion,
  getLessonStatus,
  markKeyScene,
  markPrediction,
  markRecall,
  progressVersion,
  recordLessonProgress,
  sharedProgress,
  subscribeProgress,
};
