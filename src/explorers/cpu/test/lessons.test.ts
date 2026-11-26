import test from "node:test";
import assert from "node:assert/strict";
import { ALGORITHMS, DEFAULT_PROCESSES, preFrame, simulate } from "../engine.ts";
import { LESSONS, METHODS, lessonRuns, type Lesson, type LessonContent } from "../lessons.ts";
import type { Algorithm, ProcessDef, SimResult } from "../types.ts";
import { currentLesson, nextLesson, progressIdFor } from "@/lib/lesson-rail.ts";

const trace = (result: SimResult) => result.segments.map(({ id, start, end }) => [id, start, end]);
const byId: Record<string, Lesson> = Object.fromEntries(
  LESSONS.map((lesson) => [lesson.id, lesson]),
);
const run = (id: string, algorithm: Algorithm) =>
  simulate({ algorithm, processes: byId[id].processes });
const waits = (result: SimResult) => result.stats.perProcess.map((p) => p.waiting);

/* ---------- engine: SJF and SRTF (OSTEP 7.4, 7.5) ---------- */

test("02: FCFS runs the long P1 first (convoy); SJF runs P2 → P3 → P1", () => {
  const fcfs = run("sjf", "fcfs");
  const sjf = run("sjf", "sjf");
  assert.deepEqual(trace(fcfs), [
    ["P1", 0, 8],
    ["P2", 8, 10],
    ["P3", 10, 15],
  ]);
  assert.deepEqual(trace(sjf), [
    ["P2", 0, 2],
    ["P3", 2, 7],
    ["P1", 7, 15],
  ]);
  assert.deepEqual(waits(fcfs), [0, 8, 10]);
  assert.deepEqual(waits(sjf), [7, 0, 2]);
  assert.equal(fcfs.stats.averageWaiting, 6);
  assert.equal(sjf.stats.averageWaiting, 3);
  assert.equal(fcfs.stats.averageTurnaround, 11);
  assert.equal(sjf.stats.averageTurnaround, 8);
  assert.equal(fcfs.stats.makespan, 15);
  assert.equal(sjf.stats.makespan, 15);
  // The ready queue keeps arrival order; SJF picks from anywhere in it.
  assert.deepEqual(sjf.decisions[0], {
    time: 0,
    candidates: ["P1", "P2", "P3"],
    chosen: "P2",
    cause: "start",
  });
  assert.deepEqual(sjf.frames[0].ready, ["P1", "P3"]);
});

test("03: SJF keeps P1 (non-preemptive); SRTF preempts at 1 ms and keeps P2 at 2 ms", () => {
  const sjf = run("srtf", "sjf");
  const srtf = run("srtf", "srtf");
  assert.deepEqual(trace(sjf), [
    ["P1", 0, 8],
    ["P2", 8, 10],
    ["P3", 10, 13],
  ]);
  assert.deepEqual(trace(srtf), [
    ["P1", 0, 1],
    ["P2", 1, 3],
    ["P3", 3, 6],
    ["P1", 6, 13],
  ]);
  assert.equal(srtf.segments[0].reason, "preempt");
  assert.deepEqual(
    srtf.frames[1].events.map(({ type, id }) => [type, id]),
    [
      ["arrive", "P2"],
      ["preempt", "P1"],
      ["dispatch", "P2"],
    ],
  );
  assert.deepEqual(
    srtf.decisions.find((d) => d.time === 2),
    { time: 2, candidates: ["P2", "P1", "P3"], chosen: "P2", cause: "keep" },
  );
  assert.deepEqual(
    srtf.frames[2].events.map(({ type }) => type),
    ["arrive"],
  );
  assert.deepEqual(waits(sjf), [0, 7, 8]);
  assert.deepEqual(waits(srtf), [5, 0, 1]);
  assert.equal(sjf.stats.averageWaiting, 5);
  assert.equal(srtf.stats.averageWaiting, 2);
  assert.equal(sjf.stats.averageTurnaround, 28 / 3);
  assert.equal(srtf.stats.averageTurnaround, 19 / 3);
  assert.equal(sjf.stats.averageResponse, 5);
  assert.equal(srtf.stats.averageResponse, 1 / 3);
  assert.equal(sjf.stats.contextSwitches, 2);
  assert.equal(srtf.stats.contextSwitches, 3);
  // The preempted job keeps its progress.
  assert.equal(srtf.frames[1].states.P1.cpuDone, 1);
  assert.equal(srtf.frames[1].states.P1.burstRemaining, 7);
});

test("SRTF only preempts for a strictly shorter newcomer; ties keep the running job", () => {
  const result = simulate({
    algorithm: "srtf",
    processes: [
      { id: "A", arrival: 0, cpu: [4], io: [] },
      { id: "B", arrival: 1, cpu: [3], io: [] },
    ] as unknown as ProcessDef[],
  });
  assert.deepEqual(trace(result), [
    ["A", 0, 4],
    ["B", 4, 7],
  ]);
  assert.equal(result.decisions.find((d) => d.time === 1)!.cause, "keep");
});

test("SJF and SRTF with I/O use the next CPU burst and keep the accounting identities", () => {
  for (const algorithm of ALGORITHMS) {
    const result = simulate({ algorithm, processes: DEFAULT_PROCESSES });
    assert.equal(result.stats.busy + result.stats.idle, result.stats.makespan);
    for (const p of result.stats.perProcess) {
      assert.equal(p.turnaround, p.waiting + p.cpu + p.io, `${algorithm} ${p.id}`);
      assert.equal(p.response, p.firstRun - p.arrival);
    }
  }
  // At 7 ms P2 returns from I/O with a 2 ms burst; P1 has 3 ms of its 5 ms burst left.
  const srtf = simulate({ algorithm: "srtf", processes: DEFAULT_PROCESSES });
  assert.ok(srtf.segments.some((s) => s.reason === "preempt"));
  assert.throws(() => simulate({ algorithm: "mlfq" as Algorithm }), RangeError);
});

test("the start screen frame has nobody arrived or picked", () => {
  const frame = preFrame(run("sjf", "sjf"));
  assert.equal(frame.t, -1);
  assert.equal(frame.running, null);
  assert.deepEqual(
    Object.values(frame.states).map((s) => s.status),
    ["new", "new", "new"],
  );
  assert.deepEqual(
    Object.values(frame.states).map((s) => s.cpuRemaining),
    [8, 2, 5],
  );
});

/* ---------- lesson data ---------- */

test("lessons: rail data, two methods each, the RR lesson first so /cpu/ still opens it", () => {
  assert.ok(LESSONS.length >= 3 && LESSONS.length <= 4);
  assert.equal(LESSONS[0].id, "rr");
  assert.equal(LESSONS[0].processes, DEFAULT_PROCESSES);
  assert.equal(new Set(LESSONS.map((l) => l.id)).size, LESSONS.length);
  for (const lesson of LESSONS) {
    for (const key of ["id", "name", "sub", "title", "question"] as const)
      assert.ok(lesson[key], `${lesson.id}.${key}`);
    assert.equal(lesson.methods.length, 2);
    for (const m of lesson.methods) assert.ok(ALGORITHMS.includes(m) && METHODS[m]);
    // 직접 실험 runs the learner's jobs (1–5); the lessons have three.
    if (lesson.id !== "custom") {
      assert.equal(lesson.processes.length, 3);
      assert.deepEqual(
        lesson.processes.map((p) => p.id),
        ["P1", "P2", "P3"],
      );
    }
    assert.equal(lesson.quantum != null, lesson.methods.includes("rr"));
    for (const fn of [
      "intro",
      "milestones",
      "chapter",
      "stepNotes",
      "prediction",
      "recapPoints",
      "recall",
      "compare",
    ] as (keyof LessonContent)[])
      assert.equal(typeof lesson.content[fn], "function", `${lesson.id}.${fn}`);
    assert.ok(lesson.content.rules.length >= 4);
  }
  assert.equal(currentLesson(LESSONS, "").id, "rr");
  assert.equal(currentLesson(LESSONS, "?lesson=srtf").id, "srtf");
  assert.equal(currentLesson(LESSONS, "?lesson=nope").id, "rr");
  assert.equal(progressIdFor("cpu", LESSONS, "rr"), "cpu");
  assert.equal(progressIdFor("cpu", LESSONS, "sjf"), "cpu:sjf");
  assert.deepEqual(nextLesson(LESSONS, "rr"), { href: "./?lesson=sjf", title: "SJF와 FCFS" });
  assert.deepEqual(nextLesson(LESSONS, "sjf"), { href: "./?lesson=srtf", title: "SRTF와 SJF" });
  assert.deepEqual(nextLesson(LESSONS, "srtf"), { href: "./?lesson=custom", title: "직접 실험" });
  assert.equal(nextLesson(LESSONS, LESSONS.at(-1)!.id), null);
});

for (const lesson of LESSONS) {
  const runs = lessonRuns(lesson);
  const c = lesson.content;

  test(`${lesson.id}: start question, goal, and no result before it happens`, () => {
    for (const m of lesson.methods) {
      const intro = c.intro(runs[m]);
      assert.equal(intro.title, lesson.question);
      assert.match(intro.goal, /^학습 목표: /);
      assert.equal(intro.terms.length, 3);
      assert.doesNotMatch(
        [intro.body, intro.goal, ...intro.terms.flat()].join(" "),
        /평균 [가-힣]+ \d|\d+회|완료 \d/,
      );
    }
  });

  test(`${lesson.id}: 핵심 장면 and their explanations stay put between scenes`, () => {
    for (const m of lesson.methods) {
      const result = runs[m];
      const scenes = c.milestones(result);
      if (lesson.id !== "rr")
        assert.ok(scenes.length >= 3 && scenes.length <= 6, `${m}: ${scenes.length}`);
      assert.equal(scenes[0].time, 0);
      assert.equal(scenes.at(-1)!.time, result.stats.makespan);
      for (let i = 0; i < scenes.length; i++) {
        const expected = c.chapter(result.frames[scenes[i].time], result);
        assert.ok(expected.title && expected.body && expected.key && expected.eyebrow);
        assert.doesNotMatch(expected.body + expected.key, /undefined|NaN|null/);
        const end = scenes[i + 1]?.time ?? result.stats.makespan + 1;
        for (let t = scenes[i].time; t < end; t++)
          assert.deepEqual(c.chapter(result.frames[t], result), expected);
      }
    }
  });

  test(`${lesson.id}: every prediction offers each unfinished job with its own why`, () => {
    for (const m of lesson.methods) {
      const result = runs[m];
      const decisions = result.decisions.filter((d) => d.candidates.length > 1);
      assert.ok(decisions.length >= 1, `${m} has something to predict`);
      for (const decision of decisions) {
        const p = c.prediction(result, decision.time - 1)!;
        assert.equal(p.decision, decision);
        assert.deepEqual(
          p.choices.filter((x) => x.correct).map((x) => x.id),
          [decision.chosen],
        );
        for (const choice of p.choices) {
          assert.ok(choice.why.length > 10, `${m}@${decision.time} ${choice.id}`);
          assert.doesNotMatch(choice.why, /undefined|NaN/);
        }
        assert.ok(p.hint && p.readyLabel);
        if (p.followUp) assert.ok(p.followUp.choices.includes(p.followUp.answer));
      }
    }
  });

  test(`${lesson.id}: 정리 has 2–3 points and 1–2 recall questions with a why on every option`, () => {
    for (const m of lesson.methods) {
      const points = c.recapPoints(runs[m], runs);
      assert.ok(points.length >= 2 && points.length <= 3);
      for (const point of points) assert.doesNotMatch(point, /undefined|NaN/);
    }
    const questions = c.recall(runs);
    assert.ok(questions.length >= 1 && questions.length <= 2);
    for (const q of questions) {
      assert.equal(q.choices.filter((choice) => choice.correct).length, 1, q.id);
      for (const choice of q.choices) assert.ok(choice.why.length > 10, `${q.id}: ${choice.label}`);
    }
    const compare = c.compare(runs, { quantum: lesson.quantum ?? 2, processes: lesson.processes });
    assert.ok(compare.head && compare.body);
  });
}

test("02 and 03 compare their two methods with the engine's numbers", () => {
  const two = byId.sjf.content.compare(lessonRuns(byId.sjf));
  assert.match(two.head, /SJF의 평균 대기가 3 ms 짧습니다\(FCFS 6 ms → SJF 3 ms\)/);
  assert.match(two.body, /FCFS 11 ms, SJF 8 ms/);
  const three = byId.srtf.content.compare(lessonRuns(byId.srtf));
  assert.match(three.head, /SRTF의 평균 대기가 3 ms 짧습니다\(SJF 5 ms → SRTF 2 ms\)/);
  assert.match(three.body, /SJF 9.33 ms, SRTF 6.33 ms/);
  assert.match(three.body, /1 ms에 P2가 도착한 순간/);
  assert.match(three.caveat!, /SJF 2회, SRTF 3회/);
});

test("03: the predictions ask about the preemption and the keep", () => {
  const srtf = lessonRuns(byId.srtf).srtf;
  const preempt = byId.srtf.content.prediction(srtf, 0)!;
  assert.equal(preempt.decision.time, 1);
  assert.match(preempt.explanation, /더 짧은 P2가 P1을 선점합니다/);
  assert.match(
    preempt.choices.find((c) => c.id === "P1")!.why,
    /7 ms로 새로 온 P2\(2 ms\)보다 깁니다/,
  );
  assert.match(preempt.choices.find((c) => c.id === "P3")!.why, /2 ms에야 도착합니다/);
  const keep = byId.srtf.content.prediction(srtf, 1)!;
  assert.equal(keep.decision.cause, "keep");
  assert.match(keep.choices.find((c) => c.id === "P3")!.why, /남은 1 ms보다 깁니다/);
  assert.equal(keep.followUp!.answer, 1);
  // The queue in the dialog is in arrival order with each job's CPU left.
  assert.deepEqual(keep.ready, ["P1 7 ms"]);
  assert.deepEqual(keep.joined, ["P3 도착 · 3 ms"]);
});
