// Shared shape of a Git lesson (see lessons.js). A lesson is plain data —
// question, 핵심 장면, predictions, per-step 해설, 정리 — plus its simulate()
// from engine.js. makeLesson() adds the functions main.js calls, so every
// lesson is driven the same way. Lesson 03 (lesson.js) predates this helper
// and is adapted in lessons.js.
import { LABELS } from "../../shared/lesson-kit.js";

/** Stage-foot status lines shared by the lessons. */
export const BASE_STATES = {
  clean: "변경 없음 · 작업 트리, 인덱스, HEAD 커밋이 같습니다",
  modified: "작업 트리만 수정됨 · 아직 git add 전입니다",
  staged: "인덱스에 준비됨 · 아직 커밋 전입니다",
};

/** Verdict ("맞았습니다." or "정답은 ‘…’입니다.") and the picked option's why. */
export function feedbackFor(q, id) {
  const picked = q.choices.find((c) => c.id === id);
  const right = q.choices.find((c) => c.correct);
  const verdict = picked.correct ? LABELS.correct : LABELS.wrong(`‘${right.short ?? right.text}’`);
  return { correct: Boolean(picked.correct), verdict, why: picked.why, text: `${verdict} ${picked.why}` };
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
export function makeLesson(spec) {
  const defaultVariant = spec.variants[0].id;
  const v = (variant) => variant ?? defaultVariant;
  for (const q of Object.values(spec.predictions)) {
    const right = q.choices.find((c) => c.correct);
    right.short ??= right.text;
  }
  const milestones = (variant) => spec.milestones[v(variant)] ?? spec.milestones[defaultVariant];
  const texts = (variant) => [...spec.steps.common, ...(spec.steps[v(variant)] ?? [])];

  function eyebrowFor(index, variant) {
    if (index === 0) return LABELS.scenario;
    const list = milestones(variant);
    const k = list.findIndex((m) => m.index === index);
    const event = `${index}번째 사건`;
    return k < 0 ? event : `${LABELS.scene} ${k + 1}/${list.length} · ${event}`;
  }

  function predictionAt(index, variant) {
    const q = spec.predictions[index];
    if (!q || (q.variant && q.variant !== v(variant))) return null;
    return { ...q, index };
  }

  return {
    ...spec,
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
      let out = { details: [], ...text, eyebrow: eyebrowFor(step.index, variant) };
      if (step.index === 0) out = { ...out, title: spec.scenario.question, body: spec.scenario.body, goal: spec.scenario.goal, takeaway: null };
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
  fastForward: (from, to) => [
    "$ git merge feature/title",
    `Updating ${from}..${to}`,
    "Fast-forward",
    " welcome.txt | 2 +-",
    " 1 file changed, 1 insertion(+), 1 deletion(-)",
  ],
  mergeCommit: (command, auto) => [
    `$ ${command}`,
    ...(auto ? ["Auto-merging welcome.txt"] : []),
    "Merge made by the 'ort' strategy.",
    " welcome.txt | 2 +-",
    " 1 file changed, 1 insertion(+), 1 deletion(-)",
  ],
  rebase: ["$ git rebase main", "Successfully rebased and updated refs/heads/feature/title."],
};
