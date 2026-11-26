// The common learning model every explorer follows:
//   목표 → 관찰 → 예측 → 확인 → 설명 → 비교 → 정리
// This module holds the shared wording (LABELS), the experiment order
// (nextExperiment) and learning progress kept in localStorage
// (createProgress, lessonStatus). The 정리 panel and the progress line are
// React components in src/components/learning. See docs/DESIGN.md →
// "Learning model". Same data and storage key as shared/lesson-kit.js, so
// progress carries over between the vanilla and the React pages.

/** Exact Korean labels for the shared UI ideas. Use these, not synonyms. */
export const LABELS = {
  scenario: "대표 시나리오", // header context: "01 대표 시나리오"
  goal: "학습 목표",
  start: "학습 시작",
  resume: "이어서 재생",
  pause: "일시정지",
  replay: "다시 재생",
  guided: "핵심 장면에서 멈추기",
  scene: "핵심 장면", // a guided stop; "장면" alone means only this
  scenesTab: "장면",
  explainTab: "해설",
  scopeTab: "범위", // rules, terms, model notes
  jumpToScene: "핵심 장면으로 이동",
  now: "이번", // "이번 사건", "이번 접근", "이번 요청"
  key: "핵심", // the per-step takeaway note
  predict: (target: string) => `${target}, 먼저 맞혀보기 →`,
  predictTitle: "예측",
  reveal: "실제로 확인 →",
  correct: "맞았습니다.",
  wrong: (answer: string) => `정답은 ${answer}입니다.`,
  compare: "두 방식 비교",
  compareEnd: "결과 비교 →",
  compareSub: "같은 입력 · 다른 방식",
  replayMode: "이 방식으로 다시 보기",
  backToFork: "갈림길로 돌아가기",
  recap: "정리",
  recapPoints: "핵심 정리",
  recall: "확인 문제",
  next: "다음 실험 →",
  progress: "학습 진도",
  misconception: "오개념 바로잡기",
  misconceptionWrong: "흔한 오해",
  misconceptionRight: "실제로는",
  misconceptionCheck: "이 실험에서 확인",
  custom: "직접 실험",
} as const;

export interface Experiment {
  id: string;
  href: string;
  title: string;
}

/** Learning order across the explorers; the 정리 panel links to the next. */
export const EXPERIMENTS: Experiment[] = [
  { id: "protocol", href: "/protocol/", title: "인터넷 프로토콜" },
  { id: "cpu", href: "/cpu/", title: "CPU 스케줄링" },
  { id: "memory", href: "/memory/", title: "페이지 교체" },
  { id: "transaction", href: "/transaction/", title: "트랜잭션과 잠금" },
  { id: "disk", href: "/disk/", title: "디스크 스케줄링" },
  { id: "git", href: "/git/", title: "Git 병합 충돌" },
];

export function nextExperiment(id: string): Experiment | null {
  const i = EXPERIMENTS.findIndex((e) => e.id === id);
  return i < 0 ? null : EXPERIMENTS[(i + 1) % EXPERIMENTS.length];
}

const STORE_KEY = "explorers:progress:v1";

export interface ProgressStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function memoryStore(): ProgressStore {
  const map = new Map<string, string>();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, String(v)) };
}

function defaultStore(): ProgressStore {
  try {
    return globalThis.localStorage ?? memoryStore();
  } catch {
    return memoryStore();
  }
}

interface Totals {
  scenes: number;
  recall: number;
  compare: boolean;
}

interface ProgressState {
  scenes: string[];
  predictions: Record<string, boolean>;
  recall: Record<string, boolean>;
  compared: boolean;
  totals?: Totals;
}

export interface ProgressSummary {
  scenesSeen: number;
  scenesTotal: number;
  predictionsAnswered: number;
  predictionsRight: number;
  compare: boolean;
  compared: boolean;
  recallRight: number;
  recallTotal: number;
  ratio: number;
  done: boolean;
}

export interface Progress {
  markScene(sceneId: string | number): void;
  markPrediction(predId: string | number, correct: boolean): void;
  markCompared(): void;
  markRecall(recallId: string | number, correct: boolean): void;
  summary(): ProgressSummary;
  onChange(fn: (summary: ProgressSummary) => void): () => void;
  reset(): void;
}

export interface ProgressOptions {
  scenes?: number;
  recall?: number;
  compare?: boolean;
  store?: ProgressStore;
}

/**
 * Progress for one lesson. Scenes are the guided stops (any stable id),
 * predictions and recall questions are keyed by id with the learner's first
 * verdict. The lesson counts as done once every scene was seen, the
 * comparison was opened (unless `compare: false`) and every recall question
 * was answered correctly. Totals are stored too, so the lesson rail can show
 * status for lessons that are not open.
 *
 * Ids: one per lesson, "<explorer>" for the first lesson or
 * "<explorer>:<lesson>" (see lessonId), e.g. createProgress("cpu:sjf", { scenes: 5, recall: 2 }).
 */
export function createProgress(
  id: string,
  { scenes = 0, recall = 0, compare = true, store = defaultStore() }: ProgressOptions = {},
): Progress {
  const empty = (): ProgressState => ({ scenes: [], predictions: {}, recall: {}, compared: false });
  let all = readAll(store);
  const state: ProgressState = Object.assign(empty(), all[id]);
  state.totals = { scenes, recall, compare };
  const listeners = new Set<(summary: ProgressSummary) => void>();

  function save() {
    all = readAll(store);
    all[id] = state;
    try {
      store.setItem(STORE_KEY, JSON.stringify(all));
    } catch {
      /* private mode: keep in memory */
    }
    const s = summary();
    listeners.forEach((fn) => fn(s));
  }

  const summary = () => summarize(state);

  // Record the totals right away so the rail knows them before any answer.
  if (!all[id] || JSON.stringify(all[id].totals) !== JSON.stringify(state.totals)) save();

  return {
    markScene(sceneId) {
      const key = String(sceneId);
      if (!state.scenes.includes(key)) {
        state.scenes.push(key);
        save();
      }
    },
    markPrediction(predId, correct) {
      const key = String(predId);
      if (!(key in state.predictions)) {
        state.predictions[key] = Boolean(correct);
        save();
      }
    },
    markCompared() {
      if (!state.compared) {
        state.compared = true;
        save();
      }
    },
    markRecall(recallId, correct) {
      const key = String(recallId);
      if (!state.recall[key]) {
        state.recall[key] = Boolean(correct);
        save();
      }
    },
    summary,
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    reset() {
      Object.assign(state, empty(), { totals: state.totals });
      save();
    },
  };
}

function readAll(store: ProgressStore): Record<string, ProgressState> {
  try {
    return JSON.parse(store.getItem(STORE_KEY) ?? "null") || {};
  } catch {
    return {};
  }
}

function summarize(state: ProgressState): ProgressSummary {
  const totals = state.totals ?? { scenes: 0, recall: 0, compare: true };
  const recallRight = Object.values(state.recall ?? {}).filter(Boolean).length;
  const predictions = Object.values(state.predictions ?? {});
  const scenesSeen = Math.min(
    state.scenes?.length ?? 0,
    totals.scenes || (state.scenes?.length ?? 0),
  );
  const compared = Boolean(state.compared);
  const total = totals.scenes + (totals.compare ? 1 : 0) + totals.recall;
  const got =
    scenesSeen + (totals.compare && compared ? 1 : 0) + Math.min(recallRight, totals.recall);
  return {
    scenesSeen,
    scenesTotal: totals.scenes,
    predictionsAnswered: predictions.length,
    predictionsRight: predictions.filter(Boolean).length,
    compare: totals.compare,
    compared,
    recallRight,
    recallTotal: totals.recall,
    ratio: total ? got / total : 0,
    done: total > 0 && got >= total,
  };
}

/** Progress id for a lesson: the first lesson keeps the bare explorer id. */
export function lessonId(
  explorer: string,
  lesson: string | null | undefined,
  first: string,
): string {
  return !lesson || lesson === first ? explorer : `${explorer}:${lesson}`;
}

export type LessonStatus = "new" | "progress" | "done";

/** Status of any lesson without opening it: { status: "new" | "progress" | "done", ratio }. */
export function lessonStatus(
  id: string,
  { store = defaultStore() }: { store?: ProgressStore } = {},
): { status: LessonStatus; ratio: number } {
  const state = readAll(store)[id];
  if (!state) return { status: "new", ratio: 0 };
  const s = summarize(state);
  const touched = s.scenesSeen || s.predictionsAnswered || s.compared || s.recallRight;
  return { status: s.done ? "done" : touched ? "progress" : "new", ratio: s.ratio };
}

/** The progress line's parts: ["학습 진도", "핵심 장면 4/6", "예측 3/4", "비교 완료", "확인 문제 1/2"] and dots. */
export function progressParts(s: ProgressSummary): { parts: string[]; total: number; got: number } {
  const parts: string[] = [LABELS.progress, `${LABELS.scene} ${s.scenesSeen}/${s.scenesTotal}`];
  if (s.predictionsAnswered) parts.push(`예측 ${s.predictionsRight}/${s.predictionsAnswered}`);
  if (s.compare !== false) parts.push(`비교 ${s.compared ? "완료" : "전"}`);
  if (s.recallTotal) parts.push(`${LABELS.recall} ${s.recallRight}/${s.recallTotal}`);
  const total = s.scenesTotal + (s.compare !== false ? 1 : 0) + s.recallTotal;
  const got =
    s.scenesSeen +
    (s.compare !== false && s.compared ? 1 : 0) +
    Math.min(s.recallRight, s.recallTotal);
  return { parts, total, got };
}

/** A 확인 문제: asked without the scene; every choice says why. */
export interface RecallChoice {
  label: string;
  correct?: boolean;
  why: string;
}
export interface RecallQuestion {
  id: string;
  question: string;
  /** Short form for "정답은 X입니다." when the right label is long. */
  answer?: string;
  choices: RecallChoice[];
}

/** The verdict line for a recall answer: "맞았습니다. …" / "정답은 X입니다. …". */
export function recallVerdict(q: RecallQuestion, choice: RecallChoice): string {
  const right = q.choices.find((c) => c.correct);
  return `${choice.correct ? LABELS.correct : LABELS.wrong(q.answer ?? right?.label ?? "")} ${choice.why}`;
}

/**
 * A misconception the lesson sets right: what learners commonly believe, what
 * is actually true, and where this experiment shows it. `scene` is the
 * 1-based 핵심 장면 at which the 해설 shows it; every one is listed again in 정리.
 */
export interface Misconception {
  id: string;
  wrong: string;
  right: string;
  check: string;
  scene?: number;
}
