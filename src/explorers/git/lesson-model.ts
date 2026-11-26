// Shared shape of a Git lesson (port of git/src/lesson-model.js). A lesson is
// plain data — question, 핵심 장면, predictions, per-step 해설, 정리 — plus its
// simulate() from engine.ts. makeLesson() adds the functions the page calls,
// so every lesson is driven the same way. Lesson 03 (lesson.ts) predates this
// helper and is adapted in lessons.ts.
import { LABELS, type RecallQuestion } from "@/lib/lesson-kit.ts";
import type { GitMisconception } from "./misconceptions.ts";
import type { CompareLine, GitState, Run, Step, Versions, ContentKind } from "./types.ts";

/** Stage-foot status lines shared by the lessons. */
export const BASE_STATES: Record<string, string> = {
  clean: "변경 없음 · 작업 트리, 인덱스, HEAD 커밋이 같습니다",
  modified: "작업 트리만 수정됨 · 아직 git add 전입니다",
  staged: "인덱스에 준비됨 · 아직 커밋 전입니다",
};

export type Focus = "history" | "working" | "index" | "merge";

export interface PredictionChoice {
  id: string;
  text: string;
  /** Names the right choice in "정답은 ‘…’입니다." */
  short?: string;
  correct?: boolean;
  why: string;
}

export interface PredictionSpec {
  /** Asked only in this variant. */
  variant?: string;
  target: string;
  question: string | ((choice: string | null) => string);
  context: string | ((choice: string | null) => string);
  verify: { step: number; label: string };
  choices: PredictionChoice[];
}

/** A prediction as asked at a step: wording resolved for the variant. */
export interface Prediction extends Omit<PredictionSpec, "question" | "context"> {
  index: number;
  question: string;
  context: string;
}

export interface Feedback {
  correct: boolean;
  verdict: string;
  why: string;
  text: string;
}

/** The 해설 of one step as written in a lesson. */
export interface StepText {
  title?: string;
  body?: string;
  goal?: string;
  takeaway?: string | null;
  terminal?: string[] | null;
  details?: string[];
  focus?: Focus;
  /** While the step's prediction is open: what replaces the fields above. */
  pending?: Omit<StepText, "pending">;
}

/** The 해설 of one step as shown. */
export interface Described {
  eyebrow: string;
  title: string;
  body: string;
  goal?: string;
  takeaway?: string | null;
  terminal?: string[] | null;
  details: string[];
  focus: Focus;
}

export interface Milestone {
  index: number;
  label: string;
}

export interface Scenario {
  title?: string;
  question: string;
  body: string;
  goal: string;
}

export interface Source {
  title: string;
  url: string;
}

export interface SceneLayout {
  nodes: Record<string, [number, number]>;
  versions: Versions;
  kindOf?: (content: string | null | undefined) => ContentKind;
}

export interface MethodsComparison {
  title: string;
  fork: string;
  rows: string[];
  columns: { variant: string; label: string; values: string[] }[];
}
export interface BasesComparison {
  title: string;
  fork: string;
  note: string;
  lines: CompareLine[];
}

export interface Recap {
  points: string[];
  recall: RecallQuestion[];
}

export interface StatusContext {
  index: number;
  last: number;
  pending?: boolean;
  variant?: string | null;
}

/** What the page drives: every lesson has this shape. */
export interface Lesson {
  id: string;
  name: string;
  sub: string;
  title: string;
  scenario: Scenario;
  simulate: (variant: string | null) => Run;
  variants: { id: string; label: string }[];
  defaultVariant: string | null;
  gate: { step: number; resume: number; recheck: number[] } | null;
  fork: number;
  compareLabel: string;
  sceneTotal: number;
  milestones: (variant?: string | null) => Milestone[];
  guidedStops: (variant?: string | null) => number[];
  predictionAt: (index: number, variant?: string | null) => Prediction | null;
  hasPrediction: (index: number, variant?: string | null) => boolean;
  predictionSteps: number[];
  feedback: (q: Prediction, id: string) => Feedback;
  eyebrowFor: (index: number, variant?: string | null) => string;
  describeStep: (step: Step, options?: { pending?: boolean; variant?: string | null }) => Described;
  editNote: (step: Step) => string;
  status: (state: GitState, context: StatusContext) => string;
  recap: Recap;
  scope: [string, string][];
  sources: Source[];
  layout: SceneLayout;
  commitColumn: { label: string; value: (content: string) => string };
  comparison?: MethodsComparison | BasesComparison;
  result?: Record<string, { headline: string; text: string }>;
  /** 오개념 바로잡기: shown at their 핵심 장면 and listed in 정리 (misconceptions.ts). */
  misconceptions: GitMisconception[];
}

/** A lesson before its misconceptions are attached (they are read from its runs). */
export type LessonBase = Omit<Lesson, "misconceptions">;

/** Verdict ("맞았습니다." or "정답은 ‘…’입니다.") and the picked option's why. */
export function feedbackFor(q: { choices: PredictionChoice[] }, id: string): Feedback {
  const picked = q.choices.find((c) => c.id === id)!;
  const right = q.choices.find((c) => c.correct)!;
  const verdict = picked.correct ? LABELS.correct : LABELS.wrong(`‘${right.short ?? right.text}’`);
  return {
    correct: Boolean(picked.correct),
    verdict,
    why: picked.why,
    text: `${verdict} ${picked.why}`,
  };
}

export interface LessonSpec {
  id: string;
  name: string;
  sub: string;
  title: string;
  scenario: Scenario;
  simulate: (variant: string) => Run;
  variants: { id: string; label: string }[];
  fork: number;
  milestones: Record<string, Milestone[]>;
  predictions: Record<number, PredictionSpec>;
  steps: { common: StepText[] } & Record<string, StepText[]>;
  done: Record<string, string>;
  recap: Recap;
  scope: [string, string][];
  sources: Source[];
  layout: SceneLayout;
  commitColumn: { label: string; value: (content: string) => string };
  comparison: MethodsComparison | BasesComparison;
  result: Record<string, { headline: string; text: string }>;
}

/**
 * spec: {
 *   id, name, sub, title, scenario: { question, body, goal },
 *   simulate(variant), variants: [{ id, label }], fork,
 *   milestones: { [variant]: [{ index, label }] },
 *   predictions: { [step]: { variant?, target, question, context, verify, choices } },
 *   steps: { common: [...], [variant]: [...] }   // 해설 per step; `pending` overrides
 *   done: { [variant]: status line at the end },
 *   recap, scope, sources, layout, commitColumn, comparison, result
 * }
 */
export function makeLesson(spec: LessonSpec): LessonBase {
  const defaultVariant = spec.variants[0].id;
  const v = (variant?: string | null) => variant ?? defaultVariant;
  for (const q of Object.values(spec.predictions)) {
    const right = q.choices.find((c) => c.correct)!;
    right.short ??= right.text;
  }
  const milestones = (variant?: string | null) =>
    spec.milestones[v(variant)] ?? spec.milestones[defaultVariant];
  const texts = (variant?: string | null) => [
    ...spec.steps.common,
    ...(spec.steps[v(variant)] ?? []),
  ];

  function eyebrowFor(index: number, variant?: string | null) {
    if (index === 0) return LABELS.scenario;
    const list = milestones(variant);
    const k = list.findIndex((m) => m.index === index);
    const event = `${index}번째 사건`;
    return k < 0 ? event : `${LABELS.scene} ${k + 1}/${list.length} · ${event}`;
  }

  function predictionAt(index: number, variant?: string | null): Prediction | null {
    const q = spec.predictions[index];
    if (!q || (q.variant && q.variant !== v(variant))) return null;
    return { ...q, index } as Prediction;
  }

  return {
    ...spec,
    simulate: spec.simulate as Lesson["simulate"],
    defaultVariant,
    gate: null,
    compareLabel: LABELS.compare,
    sceneTotal: milestones(defaultVariant).length,
    milestones,
    guidedStops: (variant) => milestones(variant).map((m) => m.index),
    predictionAt,
    hasPrediction: (index, variant) => Boolean(predictionAt(index, variant)),
    predictionSteps: Object.keys(spec.predictions).map(Number),
    feedback: feedbackFor,
    eyebrowFor,
    describeStep(step, { pending = false, variant } = {}) {
      const { pending: hidden, ...text } = texts(variant)[step.index];
      let out = { details: [], ...text, eyebrow: eyebrowFor(step.index, variant) } as Described;
      if (step.index === 0)
        out = {
          ...out,
          title: spec.scenario.question,
          body: spec.scenario.body,
          goal: spec.scenario.goal,
          takeaway: null,
        };
      if (pending && hidden) out = { ...out, ...hidden };
      return out;
    },
    editNote: (step) => step.note ?? "",
    status(state, { index, last, variant }) {
      if (index === last) return spec.done[v(variant)];
      return BASE_STATES[state.status];
    },
  };
}

/** Terminal lines for the merges, as Git prints them (hashes shown as names). */
export const OUTPUT = {
  fastForward: (from: string, to: string) => [
    "$ git merge feature/title",
    `Updating ${from}..${to}`,
    "Fast-forward",
    " welcome.txt | 2 +-",
    " 1 file changed, 1 insertion(+), 1 deletion(-)",
  ],
  mergeCommit: (command: string, auto: boolean) => [
    `$ ${command}`,
    ...(auto ? ["Auto-merging welcome.txt"] : []),
    "Merge made by the 'ort' strategy.",
    " welcome.txt | 2 +-",
    " 1 file changed, 1 insertion(+), 1 deletion(-)",
  ],
  rebase: ["$ git rebase main", "Successfully rebased and updated refs/heads/feature/title."],
};
