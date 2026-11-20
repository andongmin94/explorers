import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RESOLUTIONS, simulateGit } from "../engine.ts";
import {
  describeStep,
  eyebrowFor,
  feedback,
  predictionAt,
  GATE,
  GUIDED_STOPS,
  MILESTONES,
  PREDICTIONS,
  RECAP,
  SCENARIO,
  SCOPE,
  STATE_NAMES,
} from "../lesson.ts";
import type { Described } from "../lesson-model.ts";
import { LABELS } from "@/lib/lesson-kit.ts";

// The page's flow (the vanilla main.js): the React app, its playback store and panels.
const main = ["../app.tsx", "../playback.ts", "../side.tsx"]
  .map((file) => readFileSync(new URL(file, import.meta.url), "utf8"))
  .join("\n");
const lessons = readFileSync(new URL("../lessons.ts", import.meta.url), "utf8");
const visible = (lesson: Described) =>
  [
    lesson.title,
    lesson.body,
    lesson.takeaway ?? "",
    ...(lesson.terminal ?? []),
    ...lesson.details,
  ].join("\n");

test("guided stops are exactly the 핵심 장면 list, including the forced stop", () => {
  assert.deepEqual(
    GUIDED_STOPS,
    MILESTONES.map((m) => m.index),
  );
  assert.ok(GUIDED_STOPS.includes(GATE));
  assert.equal(GATE, 9);
  assert.ok(MILESTONES.length >= 3 && MILESTONES.length <= 6);
  // Every prediction is asked at a 핵심 장면.
  for (const at of Object.keys(PREDICTIONS).map(Number))
    assert.ok(GUIDED_STOPS.includes(at), `prediction ${at}`);
  // main.js stops on the lesson's list, not on its own numbers.
  assert.match(main, /guidedStops\(\)\.includes\(index\)/);
  assert.match(lessons, /guidedStops: \(\) => conflict\.GUIDED_STOPS/);
  assert.doesNotMatch(main, /\[4, 8, 10, 11\]/);
});

test("start screen asks a question and states the goal without the result", () => {
  const start = describeStep(simulateGit().steps[0]);
  assert.equal(start.eyebrow, LABELS.scenario);
  assert.match(start.title, /\?$/);
  assert.equal(start.title, SCENARIO.question);
  assert.ok(start.goal!.startsWith(`${LABELS.goal}: `));
  assert.equal(start.takeaway, null);
  assert.doesNotMatch(`${start.body} ${start.goal}`, /git add|두 부모|C3|stage/);
  // Header context: "NN 레슨" + the lesson title (the shared <Toolbar> prints "NN 레슨" over the title).
  assert.match(main, /lessonNumber=\{lessonNumber\}\s+lessonTitle=\{lesson\.title\}/);
});

test("eyebrows count events, and name the 핵심 장면 at a stop", () => {
  assert.equal(eyebrowFor(5), "5번째 사건");
  assert.equal(eyebrowFor(9), `${LABELS.scene} 3/${MILESTONES.length} · 9번째 사건`);
  for (let i = 1; i <= 12; i++) assert.doesNotMatch(eyebrowFor(i), /단계/);
});

test("no step has more than two details", () => {
  for (const option of RESOLUTIONS)
    for (const step of simulateGit(option.id).steps) {
      assert.ok(describeStep(step).details.length <= 2, `step ${step.index}`);
      assert.ok(
        describeStep(step, { pending: true }).details.length <= 2,
        `step ${step.index} pending`,
      );
    }
  const nine = describeStep(simulateGit().steps[9]);
  assert.doesNotMatch(nine.details.join(" "), /MERGE_HEAD|--abort/);
  assert.ok(SCOPE.some(([term]) => term === "MERGE_HEAD"));
  assert.ok(SCOPE.some(([term]) => term === "git merge --abort"));
});

test("step 9 prints the merge command's own output", () => {
  assert.deepEqual(describeStep(simulateGit().steps[9]).terminal, [
    "$ git merge feature/title",
    "Auto-merging welcome.txt",
    "CONFLICT (content): Merge conflict in welcome.txt",
    "Automatic merge failed; fix conflicts and then commit the result.",
  ]);
});

test("prediction 10 pending: nothing says the file is still unresolved or needs git add", () => {
  for (const option of RESOLUTIONS) {
    const step = simulateGit(option.id).steps[10];
    const hidden = describeStep(step, { pending: true });
    assert.equal(hidden.terminal, null);
    assert.equal(hidden.takeaway, null);
    assert.doesNotMatch(
      visible(hidden),
      /git add|unmerged|both modified|세 버전|미해결|해결된|해결 기록|별개/,
    );
    assert.doesNotMatch(STATE_NAMES.resolvedPending, /세 버전|미해결|git add/);
    const shown = describeStep(step);
    assert.ok(shown.terminal!.includes("        both modified:   welcome.txt"));
    assert.match(shown.takeaway!, /별개/);
  }
  // The lesson swaps the status line and main.js silences the conflict LED while pending.
  assert.match(lessons, /names\.resolvedPending/);
  assert.match(main, /pendingAt\(index\) && state\.status === "resolved"/);
});

test("prediction 11 pending: nothing names the next commit's parents", () => {
  for (const option of RESOLUTIONS) {
    const step = simulateGit(option.id).steps[11];
    const hidden = describeStep(step, { pending: true });
    assert.doesNotMatch(visible(hidden), /부모|MERGE_HEAD/, option.id);
    const q = predictionAt(11, option.id)!;
    assert.doesNotMatch(`${q.context}`, /MERGE_HEAD|부모/, option.id);
    assert.match(visible(describeStep(step)), /부모/);
  }
});

test("prediction 8 is worded neutrally, not presupposing the conflict", () => {
  const q = predictionAt(8)!;
  assert.doesNotMatch(q.question, /충돌/);
  assert.ok(q.choices.some((c) => /C3/.test(c.text)));
});

test("prediction 11 follows the chosen resolution", () => {
  assert.match(predictionAt(11, "ours")!.question, /main 문장을 골라도/);
  for (const id of ["both", "theirs"]) {
    const q = predictionAt(11, id)!;
    assert.doesNotMatch(q.question, /main 문장/);
    assert.ok(q.question.includes(RESOLUTIONS.find((r) => r.id === id)!.label));
    assert.doesNotMatch(q.context, /C2와 똑같/);
  }
  assert.match(predictionAt(11, "theirs")!.question, /선택’으로/);
  assert.match(predictionAt(11, "both")!.question, /합치기’로/);
});

test("every prediction option and recall choice carries its own why", () => {
  for (const [at, q] of Object.entries(PREDICTIONS)) {
    const whys = q.choices.map((c) => c.why);
    assert.ok(
      whys.every((w) => typeof w === "string" && w.length > 10),
      `prediction ${at}`,
    );
    assert.equal(new Set(whys).size, whys.length, `prediction ${at}`);
    assert.ok(q.verify.label.startsWith(LABELS.reveal));
  }
  assert.ok(RECAP.points.length >= 2 && RECAP.points.length <= 3);
  assert.ok(RECAP.recall.length >= 1 && RECAP.recall.length <= 2);
  for (const r of RECAP.recall) {
    assert.equal(r.choices.filter((c) => c.correct).length, 1, r.id);
    assert.ok(
      r.choices.every((c) => c.why),
      r.id,
    );
  }
});

test("feedback says the verdict once, then the picked option's why", () => {
  for (const at of Object.keys(PREDICTIONS).map(Number)) {
    const q = predictionAt(at, "both")!;
    const right = q.choices.find((c) => c.correct)!;
    for (const c of q.choices) {
      const f = feedback(q, c.id);
      assert.equal(f.verdict, c.correct ? LABELS.correct : LABELS.wrong(`‘${right.short}’`));
      assert.ok(f.text.endsWith(c.why));
      assert.doesNotMatch(c.why, /^맞아요|^맞았습니다/);
      assert.equal(f.text.match(/맞았|맞아요|정답은/g)!.length, 1, `${at} ${c.id}`);
    }
  }
});
