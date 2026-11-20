// The common learning model every explorer follows:
//   목표 → 관찰 → 예측 → 확인 → 설명 → 비교 → 정리
// This module holds the shared wording (LABELS), the experiment order
// (nextExperiment), learning progress kept in localStorage (createProgress),
// and the 정리 panel with recall questions (recapHtml / bindRecap).
// See shared/DESIGN.md → "Learning model".

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
  predict: (target) => `${target}, 먼저 맞혀보기 →`,
  predictTitle: "예측",
  reveal: "실제로 확인 →",
  correct: "맞았습니다.",
  wrong: (answer) => `정답은 ${answer}입니다.`,
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
};

/** Learning order across the explorers; the 정리 panel links to the next. */
// The site is served at the root (Cloudflare Workers static assets).
const BASE = "/";
export const EXPERIMENTS = [
  { id: "protocol", href: `${BASE}protocol/`, title: "인터넷 프로토콜" },
  { id: "cpu", href: `${BASE}cpu/`, title: "CPU 스케줄링" },
  { id: "memory", href: `${BASE}memory/`, title: "페이지 교체" },
  { id: "transaction", href: `${BASE}transaction/`, title: "트랜잭션과 잠금" },
  { id: "disk", href: `${BASE}disk/`, title: "디스크 스케줄링" },
  { id: "git", href: `${BASE}git/`, title: "Git 병합 충돌" },
];

export function nextExperiment(id) {
  const i = EXPERIMENTS.findIndex((e) => e.id === id);
  return i < 0 ? null : EXPERIMENTS[(i + 1) % EXPERIMENTS.length];
}

const STORE_KEY = "explorers:progress:v1";

function memoryStore() {
  const map = new Map();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)) };
}

function defaultStore() {
  try {
    return globalThis.localStorage ?? memoryStore();
  } catch {
    return memoryStore();
  }
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
export function createProgress(id, { scenes = 0, recall = 0, compare = true, store = defaultStore() } = {}) {
  const empty = () => ({ scenes: [], predictions: {}, recall: {}, compared: false });
  let all = readAll(store);
  const state = Object.assign(empty(), all[id]);
  state.totals = { scenes, recall, compare };
  const listeners = new Set();

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

function readAll(store) {
  try {
    return JSON.parse(store.getItem(STORE_KEY)) || {};
  } catch {
    return {};
  }
}

function summarize(state) {
  const totals = state.totals ?? { scenes: 0, recall: 0, compare: true };
  const recallRight = Object.values(state.recall ?? {}).filter(Boolean).length;
  const predictions = Object.values(state.predictions ?? {});
  const scenesSeen = Math.min(state.scenes?.length ?? 0, totals.scenes || (state.scenes?.length ?? 0));
  const compared = Boolean(state.compared);
  const total = totals.scenes + (totals.compare ? 1 : 0) + totals.recall;
  const got = scenesSeen + (totals.compare && compared ? 1 : 0) + Math.min(recallRight, totals.recall);
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
export function lessonId(explorer, lesson, first) {
  return !lesson || lesson === first ? explorer : `${explorer}:${lesson}`;
}

/**
 * Status of any lesson without opening it: { status: "new" | "progress" | "done", ratio }.
 */
export function lessonStatus(id, { store = defaultStore() } = {}) {
  const state = readAll(store)[id];
  if (!state) return { status: "new", ratio: 0 };
  const s = summarize(state);
  const touched = s.scenesSeen || s.predictionsAnswered || s.compared || s.recallRight;
  return { status: s.done ? "done" : touched ? "progress" : "new", ratio: s.ratio };
}

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Dot meter + one line: "핵심 장면 4/6 · 예측 3/4 · 비교 완료 · 확인 문제 1/2". */
export function progressHtml(s) {
  const parts = [`${LABELS.scene} ${s.scenesSeen}/${s.scenesTotal}`];
  if (s.predictionsAnswered) parts.push(`예측 ${s.predictionsRight}/${s.predictionsAnswered}`);
  if (s.compare !== false) parts.push(`비교 ${s.compared ? "완료" : "전"}`);
  if (s.recallTotal) parts.push(`${LABELS.recall} ${s.recallRight}/${s.recallTotal}`);
  const total = s.scenesTotal + (s.compare !== false ? 1 : 0) + s.recallTotal;
  const got = s.scenesSeen + (s.compare !== false && s.compared ? 1 : 0) + Math.min(s.recallRight, s.recallTotal);
  const dots = Array.from({ length: total }, (_, i) => `<i class="${i < got ? "is-on" : ""}"></i>`).join("");
  return `<div class="hw-progress"><span class="hw-meter" aria-hidden="true">${dots}</span><span class="hw-label">${[LABELS.progress, ...parts].map((p) => `<span class="hw-nowrap">${esc(p)}</span>`).join(" · ")}</span></div>`;
}

/**
 * The 정리 panel: 핵심 정리 (2–3 points), 확인 문제 (asked without the scene:
 * the learner recalls), a link onward and the progress line.
 *
 * next (optional): { href, title } of the next lesson in this explorer, shown
 * as "다음 레슨: … →". Without it, the last lesson links to the next experiment.
 *
 * recall: [{ id, question, answer?, choices: [{ label, correct?, why }] }]
 * `answer` (optional) is the short form used in "정답은 X입니다." for long labels.
 * Every choice carries `why`: the misconception it reflects, or why it is right.
 */
export function recapHtml({ id, points = [], recall = [], progress, next: nextLesson }) {
  const next = nextLesson ? { ...nextLesson, kind: "다음 레슨" } : { ...nextExperiment(id), kind: "다음 실험" };
  const questions = recall
    .map(
      (q) => `<div class="hw-section hw-recall" data-recall="${esc(q.id)}">
      <span class="hw-label">${esc(LABELS.recall)}</span>
      <p class="hw-text hw-recall-q">${esc(q.question)}</p>
      <div class="hw-list hw-recall-choices">${q.choices
        .map((c, i) => `<button type="button" data-choice="${i}">${esc(c.label)}</button>`)
        .join("")}</div>
      <p class="hw-note hw-recall-why" hidden></p>
    </div>`,
    )
    .join("");
  return `<div class="hw-recap">
    <div class="hw-section">
      <span class="hw-label">${esc(LABELS.recapPoints)}</span>
      <ul class="hw-list hw-recap-points">${points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
    </div>
    ${questions}
    <div class="hw-section hw-recap-foot">
      ${progress ? progressHtml(progress.summary()) : ""}
      ${next.href ? `<a class="hw-key hw-key--sm" href="${esc(next.href)}">${next.kind}: ${esc(next.title)} →</a>` : ""}
    </div>
  </div>`;
}

/** Wire the recall questions rendered by recapHtml inside root. */
export function bindRecap(root, { recall = [], progress, onAnswer } = {}) {
  for (const box of root.querySelectorAll("[data-recall]")) {
    const q = recall.find((r) => String(r.id) === box.dataset.recall);
    if (!q) continue;
    const why = box.querySelector(".hw-recall-why");
    box.querySelectorAll("[data-choice]").forEach((button) => {
      button.addEventListener("click", () => {
        const choice = q.choices[Number(button.dataset.choice)];
        const right = q.choices.find((c) => c.correct);
        box.querySelectorAll("[data-choice]").forEach((b) => b.removeAttribute("aria-pressed"));
        button.setAttribute("aria-pressed", "true");
        why.hidden = false;
        why.classList.toggle("hw-note--accent", Boolean(choice.correct));
        why.textContent = `${choice.correct ? LABELS.correct : LABELS.wrong(q.answer ?? right.label)} ${choice.why}`;
        progress?.markRecall(q.id, choice.correct);
        onAnswer?.(q, choice);
      });
    });
  }
}
