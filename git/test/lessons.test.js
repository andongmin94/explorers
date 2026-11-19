import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CONTENTS,
  LESSON_CONTENTS,
  VERSIONS,
  changedLabels,
  compareMergeBases,
  lineKinds,
  simulateAutoMerge,
  simulateFastForward,
  simulateRebase,
} from "../src/engine.js";
import { LESSONS } from "../src/lessons.js";
import { LABELS } from "../../shared/lesson-kit.js";
import { currentLesson, lessonHref, nextLesson, progressIdFor } from "../../shared/lesson-rail.js";

const main = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const byId = Object.fromEntries(LESSONS.map((l) => [l.id, l]));
const graph = (state) => state.commits.map((c) => `${c.id}<${c.parents.join("+")}${c.orphan ? "·orphan" : ""}`);
const visible = (t) => [t.title, t.body, t.takeaway ?? "", ...(t.terminal ?? []), ...(t.details ?? [])].join("\n");
const variantsOf = (l) => (l.gate ? [null] : l.variants.map((v) => v.id));

/* ------------------------------------------------------------ engine */

test("01 fast-forward: main moves to C1, no new commit; --no-ff makes C2 with parents C0 + C1", () => {
  const ff = simulateFastForward("ff").steps;
  assert.equal(ff.length, 7);
  assert.deepEqual(ff[4].state.refs, { main: "C0", "feature/title": "C1" });
  assert.deepEqual(ff[5].state.refs, ff[4].state.refs);
  assert.equal(ff[5].state.currentBranch, "main");
  assert.equal(ff[5].state.working, CONTENTS.base);
  const end = ff[6].state;
  assert.equal(ff[6].action, "merge-ff");
  assert.deepEqual(end.refs, { main: "C1", "feature/title": "C1" });
  assert.deepEqual(graph(end), ["C0<", "C1<C0"]);
  assert.equal(end.working, CONTENTS.feature);
  assert.equal(end.index.content, CONTENTS.feature);

  const noff = simulateFastForward("no-ff").steps;
  const merged = noff[6].state;
  assert.equal(noff[6].command, "git merge --no-ff feature/title");
  assert.deepEqual(merged.refs, { main: "C2", "feature/title": "C1" });
  assert.deepEqual(graph(merged), ["C0<", "C1<C0", "C2<C0+C1"]);
  // Same file either way: only the history differs.
  assert.equal(merged.working, end.working);
  assert.throws(() => simulateFastForward("squash"), RangeError);
});

test("02 auto-merge: different, non-adjacent lines merge into C3 with both changes", () => {
  const steps = simulateAutoMerge().steps;
  assert.equal(steps.length, 10);
  assert.deepEqual(graph(steps[8].state), ["C0<", "C1<C0", "C2<C0"]);
  assert.equal(steps[8].state.commits.at(-1).content, LESSON_CONTENTS.mainButton);
  const end = steps[9].state;
  assert.equal(steps[9].action, "merge-commit");
  assert.deepEqual(end.refs, { main: "C3", "feature/title": "C1" });
  assert.deepEqual(graph(end), ["C0<", "C1<C0", "C2<C0", "C3<C2+C1"]);
  assert.equal(end.working, LESSON_CONTENTS.merged);
  assert.deepEqual(changedLabels(end.working), ["제목", "버튼"]);
  // The two changed lines are separated by an unchanged one.
  const lines = LESSON_CONTENTS.merged.split("\n");
  assert.equal(lines[2], "출발: 공원 입구");
  assert.equal(end.status, "clean");
  assert.equal(end.merge, null);
});

test("02 thought experiment: two tips alone cannot decide either changed line; C0 decides both", () => {
  const rows = compareMergeBases();
  const changed = rows.filter((r) => r.ours !== r.theirs);
  assert.deepEqual(changed.map((r) => r.label), ["제목", "버튼"]);
  for (const r of changed) {
    assert.equal(r.twoWay, null);
    assert.ok(r.threeWay);
  }
  assert.equal(rows.map((r) => r.threeWay).join("\n") + "\n", LESSON_CONTENTS.merged);
  // A line both sides changed differently stays undecided even with C0 (lesson 03).
  const both = compareMergeBases(CONTENTS.base, CONTENTS.main, CONTENTS.feature).find((r) => r.label === "제목");
  assert.equal(both.threeWay, null);
});

test("04 rebase: C1 is replayed as C1' on C2, C1 drops out, main fast-forwards", () => {
  const steps = simulateRebase("rebase").steps;
  assert.equal(steps.length, 13);
  assert.equal(steps[9].state.currentBranch, "feature/title");
  assert.equal(steps[9].state.working, CONTENTS.feature);
  const rebased = steps[10].state;
  assert.equal(steps[10].command, "git rebase main");
  assert.deepEqual(rebased.refs, { main: "C2", "feature/title": "C1'" });
  assert.deepEqual(graph(rebased), ["C0<", "C1<C0·orphan", "C2<C0", "C1'<C2"]);
  const replay = rebased.commits.at(-1);
  assert.equal(replay.replayOf, "C1");
  assert.equal(replay.message, rebased.commits.find((c) => c.id === "C1").message);
  assert.equal(replay.content, LESSON_CONTENTS.merged);
  assert.equal(rebased.working, LESSON_CONTENTS.merged);
  const end = steps[12].state;
  assert.equal(steps[12].action, "merge-ff");
  assert.deepEqual(end.refs, { main: "C1'", "feature/title": "C1'" });
  assert.equal(end.commits.filter((c) => c.parents.length === 2).length, 0);

  const merge = simulateRebase("merge").steps;
  assert.equal(merge.length, 10);
  const merged = merge[9].state;
  assert.deepEqual(graph(merged), ["C0<", "C1<C0", "C2<C0", "C3<C2+C1"]);
  // Same final file by either method.
  assert.equal(merged.working, end.working);
});

test("every lesson run keeps independent before/after snapshots", () => {
  for (const lesson of LESSONS)
    for (const v of variantsOf(lesson)) {
      const { steps } = lesson.simulate(v);
      for (let i = 1; i < steps.length; i++) {
        assert.deepEqual(steps[i].before, steps[i - 1].state, `${lesson.id} ${v} ${i}`);
        assert.notEqual(steps[i].before, steps[i - 1].state);
      }
    }
});

test("line colours: who wrote each line", () => {
  const kinds = (content, versions) => lineKinds(content, versions).map((l) => l.kind);
  assert.deepEqual(kinds(LESSON_CONTENTS.merged, VERSIONS.diverged), ["plain", "feature", "plain", "main"]);
  assert.deepEqual(kinds(CONTENTS.base, VERSIONS.diverged), ["plain", "base", "plain", "base"]);
  assert.deepEqual(kinds(CONTENTS.feature, VERSIONS.fastForward), ["plain", "feature", "plain", "plain"]);
  const marked = lineKinds(
    "[산책 안내]\n<<<<<<< HEAD\n제목: 우리 동네를 함께 걸어요\n=======\n제목: 나만의 산책을 찾아보세요\n>>>>>>> feature/title\n출발: 공원 입구\n버튼: 동네 코스 보기\n",
    VERSIONS.conflict,
  );
  assert.deepEqual(marked.map((l) => l.kind), ["plain", "marker", "main", "marker", "feature", "marker", "plain", "main"]);
  assert.deepEqual(marked.map((l) => l.auto), [false, false, false, false, false, false, false, true]);
});

/* ------------------------------------------------------------ lessons */

test("four lessons in teaching order; the bare page opens 01", () => {
  assert.deepEqual(LESSONS.map((l) => l.id), ["fast-forward", "auto-merge", "conflict", "rebase"]);
  for (const l of LESSONS) assert.ok(l.name && l.sub && l.title, l.id);
  assert.equal(currentLesson(LESSONS, "").id, "fast-forward");
  assert.equal(currentLesson(LESSONS, "?lesson=rebase").id, "rebase");
  assert.equal(currentLesson(LESSONS, "?lesson=nope").id, "fast-forward");
  assert.equal(lessonHref(LESSONS, LESSONS[0]), "./");
  assert.equal(lessonHref(LESSONS, byId.conflict), "./?lesson=conflict");
  assert.deepEqual(nextLesson(LESSONS, "fast-forward"), { href: "./?lesson=auto-merge", title: byId["auto-merge"].name });
  assert.deepEqual(nextLesson(LESSONS, "conflict"), { href: "./?lesson=rebase", title: byId.rebase.name });
  assert.equal(nextLesson(LESSONS, "rebase"), null);
  assert.equal(progressIdFor("git", LESSONS, "fast-forward"), "git");
  assert.equal(progressIdFor("git", LESSONS, "rebase"), "git:rebase");
  // main.js wires the rail, per-lesson progress and the next-lesson link.
  assert.match(main, /mountRail\(\{ explorer: "git", title: "Git 브랜치와 병합", lessons: LESSONS, current: lesson\.id \}\)/);
  assert.match(main, /rail\.watch\(progress\)/);
  assert.match(main, /createProgress\(progressIdFor\("git", LESSONS, lesson\.id\)/);
  assert.match(main, /next: nextLesson\(LESSONS, lesson\.id\)/);
});

test("each lesson follows the learning model", () => {
  for (const lesson of LESSONS) {
    for (const v of variantsOf(lesson)) {
      const { steps } = lesson.simulate(v);
      const start = lesson.describeStep(steps[0], { variant: v });
      assert.match(start.title, /\?$/, lesson.id);
      assert.ok(start.goal.startsWith(`${LABELS.goal}: `), lesson.id);
      assert.equal(start.eyebrow, LABELS.scenario);
      const stops = lesson.milestones(v).map((m) => m.index);
      assert.ok(stops.every((i) => i > 0 && i < steps.length), `${lesson.id} ${v}`);
      for (const step of steps) {
        const text = lesson.describeStep(step, { variant: v });
        assert.ok(text.title && text.focus, `${lesson.id} ${v} ${step.index}`);
        assert.ok((text.details ?? []).length <= 2, `${lesson.id} ${v} ${step.index}`);
        assert.doesNotMatch(text.eyebrow, /단계/);
        if (step.action === "edit") assert.ok(lesson.editNote(step), `${lesson.id} edit note ${step.index}`);
      }
    }
    const main = lesson.milestones(lesson.defaultVariant);
    assert.ok(main.length >= 3 && main.length <= 6, lesson.id);
    assert.equal(lesson.sceneTotal, main.length);
    assert.ok(lesson.recap.points.length >= 2 && lesson.recap.points.length <= 3, lesson.id);
    assert.ok(lesson.recap.recall.length >= 1 && lesson.recap.recall.length <= 2, lesson.id);
    for (const r of lesson.recap.recall) {
      assert.equal(r.choices.filter((c) => c.correct).length, 1, r.id);
      assert.ok(r.choices.every((c) => c.why && c.why.length > 10), r.id);
    }
    assert.ok(lesson.sources.some((s) => /Git-Branching-(Basic-Branching-and-Merging|Rebasing)/.test(s.url)), lesson.id);
    assert.ok(lesson.scope.length >= 3, lesson.id);
  }
  assert.ok(byId.rebase.sources.some((s) => s.url.endsWith("Git-Branching-Rebasing")));
});

test("predictions: at a 핵심 장면, one right answer, a why per option, verified by the step that answers", () => {
  for (const lesson of LESSONS.filter((l) => !l.gate)) {
    assert.ok(lesson.predictionSteps.length >= 1, lesson.id);
    for (const at of lesson.predictionSteps) {
      const variant = lesson.variants.find((v) => lesson.predictionAt(at, v.id))?.id;
      const q = lesson.predictionAt(at, variant);
      assert.ok(lesson.guidedStops(variant).includes(at), `${lesson.id} ${at}`);
      assert.equal(q.choices.filter((c) => c.correct).length, 1, `${lesson.id} ${at}`);
      const whys = q.choices.map((c) => c.why);
      assert.equal(new Set(whys).size, whys.length);
      assert.ok(q.verify.label.startsWith(LABELS.reveal));
      assert.equal(q.verify.step, at + 1, `${lesson.id} ${at}`);
      for (const c of q.choices) {
        const f = lesson.feedback(q, c.id);
        assert.ok(f.text.endsWith(c.why));
        assert.equal(f.text.match(/맞았|정답은/g).length, 1);
      }
    }
  }
  // Model checks: what each right answer claims is what the next step shows.
  const ff = simulateFastForward("ff").steps;
  assert.equal(byId["fast-forward"].predictionAt(3, "ff").choices.find((c) => c.correct).id, "stay");
  assert.equal(ff[4].state.refs.main, "C0");
  assert.equal(byId["fast-forward"].predictionAt(5, "ff").choices.find((c) => c.correct).id, "move");
  assert.equal(ff[6].state.commits.length, ff[5].state.commits.length);
  assert.equal(byId["fast-forward"].predictionAt(5, "no-ff"), null);
  const auto = simulateAutoMerge().steps;
  const tips = (s) => s.commits.slice(1).map((c) => c.content.split("\n"));
  const [c1, c2] = tips(auto[8].state);
  assert.equal(c1.filter((line, i) => line !== c2[i]).length, 2);
  assert.equal(byId["auto-merge"].predictionAt(7).choices.find((c) => c.correct).id, "two");
  assert.equal(byId["auto-merge"].predictionAt(8).choices.find((c) => c.correct).id, "commit");
  assert.equal(auto[9].state.commits.at(-1).parents.length, 2);
  const rb = simulateRebase("rebase").steps;
  assert.equal(byId.rebase.predictionAt(9, "rebase").choices.find((c) => c.correct).id, "new");
  assert.equal(rb[10].state.refs["feature/title"], "C1'");
  assert.equal(byId.rebase.predictionAt(11, "rebase").choices.find((c) => c.correct).id, "ff");
  assert.equal(rb[12].state.commits.length, rb[11].state.commits.length);
  assert.equal(byId.rebase.predictionAt(9, "merge"), null);
});

test("while a prediction is open, its step gives nothing away", () => {
  const hide = {
    "fast-forward": { 3: /C1으로|main은 C0에 남|현재 브랜치의 끝만/, 5: /fast-forward|포인터만|병합 커밋|새 커밋/ },
    "auto-merge": { 7: /두 줄|2줄/, 8: /자동|C3|충돌|병합 커밋|fast-forward/ },
    rebase: { 9: /C1'|새 커밋|다시 적용/, 11: /fast-forward|병합 커밋|새 커밋 없/ },
  };
  for (const [id, steps] of Object.entries(hide)) {
    const lesson = byId[id];
    for (const [at, pattern] of Object.entries(steps)) {
      const variant = lesson.variants.find((v) => lesson.predictionAt(Number(at), v.id)).id;
      const step = lesson.simulate(variant).steps[Number(at)];
      const shown = lesson.describeStep(step, { pending: true, variant });
      assert.doesNotMatch(visible(shown), pattern, `${id} ${at}`);
      assert.equal(shown.terminal, undefined, `${id} ${at}`);
      const q = lesson.predictionAt(Number(at), variant);
      assert.doesNotMatch(q.context, pattern, `${id} ${at} context`);
      // The step that verifies it does show the answer.
      const answer = lesson.describeStep(lesson.simulate(variant).steps[q.verify.step], { variant });
      assert.match(visible(answer), pattern, `${id} ${at} answered`);
    }
  }
});

test("terminal output matches git 2.56", () => {
  const term = (id, v, i) => byId[id].describeStep(byId[id].simulate(v).steps[i], { variant: v }).terminal;
  assert.deepEqual(term("fast-forward", "ff", 6), [
    "$ git merge feature/title",
    "Updating C0..C1",
    "Fast-forward",
    " welcome.txt | 2 +-",
    " 1 file changed, 1 insertion(+), 1 deletion(-)",
  ]);
  assert.deepEqual(term("fast-forward", "no-ff", 6), [
    "$ git merge --no-ff feature/title",
    "Merge made by the 'ort' strategy.",
    " welcome.txt | 2 +-",
    " 1 file changed, 1 insertion(+), 1 deletion(-)",
  ]);
  const auto = [
    "$ git merge feature/title",
    "Auto-merging welcome.txt",
    "Merge made by the 'ort' strategy.",
    " welcome.txt | 2 +-",
    " 1 file changed, 1 insertion(+), 1 deletion(-)",
  ];
  assert.deepEqual(term("auto-merge", "three-way", 9), auto);
  assert.deepEqual(term("rebase", "merge", 9), auto);
  assert.deepEqual(term("rebase", "rebase", 10), ["$ git rebase main", "Successfully rebased and updated refs/heads/feature/title."]);
  assert.deepEqual(term("rebase", "rebase", 12).slice(1, 3), ["Updating C2..C1'", "Fast-forward"]);
});

test("comparisons put the lesson's two conditions side by side", () => {
  for (const id of ["fast-forward", "rebase"]) {
    const c = byId[id].comparison;
    assert.deepEqual(c.columns.map((col) => col.variant), byId[id].variants.map((v) => v.id));
    for (const col of c.columns) assert.equal(col.values.length, c.rows.length);
    assert.match(c.fork, /^갈림길: /);
  }
  const c = byId["auto-merge"].comparison;
  assert.match(c.fork, /^갈림길: /);
  assert.equal(c.lines.filter((l) => l.twoWay === null).length, 2);
  // Rebase vs merge: same final file, different history.
  const [rb, mg] = byId.rebase.comparison.columns;
  assert.equal(rb.values[3], mg.values[3]);
  assert.match(byId.rebase.recap.points.join(" "), /push/);
});
