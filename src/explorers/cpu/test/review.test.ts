import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PROCESSES, simulate, type SimulateOptions } from "../engine.ts";
import type { Prediction, SimResult } from "../types.ts";
import {
  buildMilestones,
  buildPrediction,
  comparisonSummary,
  describeChapter,
  describeIntro,
  momentNotes,
  numberChoices,
  quantumSweep,
  recallQuestions,
  recapPoints,
  stepNotes,
  sweepSummary,
} from "../lesson.ts";

const chapter = (result: SimResult, title: string) => {
  const point = buildMilestones(result).find((entry) => entry.title === title)!;
  return describeChapter(result.frames[point.time], result);
};

test("the comparison names the delayed I/O, both completion metrics and the zero switch cost", () => {
  const fcfs = simulate({ algorithm: "fcfs" });
  const summary = comparisonSummary(simulate({ quantum: 2 }), fcfs);
  assert.match(summary.cause, /P1의 첫 입출력 요청이 5 ms에서 13 ms로 늦어집니다/);
  assert.match(summary.cause, /13–17 ms에 CPU가 쉽니다/);
  assert.match(summary.finish, /전체 완료 시각.*FCFS가 4 ms 빠릅니다/);
  assert.match(summary.finish, /평균 반환 시간은 라운드 로빈 13 ms, FCFS 12.67 ms/);
  assert.match(summary.caveat, /문맥 교환 비용을 0 ms로/);
  assert.match(summary.caveat, /호위 효과/);
  assert.doesNotMatch(summary.finish, /도 라운드 로빈/);
  assert.match(summary.caveat, /P2·P3는 P1의 5 ms CPU 구간 뒤에서 각각 4 ms, 5 ms를 기다립니다/);
  const same = comparisonSummary(simulate({ quantum: 5 }), fcfs);
  assert.match(same.finish, /같습니다/);
  // Identical runs: neither the cost note nor the convoy caveat applies.
  assert.equal(same.caveat, "");
});

test("the quantum trade-off is computed from the engine at every slider position", () => {
  const sweep = quantumSweep(simulate, DEFAULT_PROCESSES);
  assert.deepEqual(
    sweep.map((row) => row.makespan),
    [18, 20, 17, 18, 16],
  );
  assert.deepEqual(
    sweep.map((row) => row.switches),
    [13, 6, 6, 5, 4],
  );
  const line = sweepSummary(sweep, 5);
  assert.match(line, /문맥 교환 13·6·6·5·4회, 전체 완료 18·20·17·18·16 ms/);
  assert.match(line, /단조 관계가 아닙니다/);
  assert.doesNotMatch(line, /작을수록 전환이 늘고/);
  assert.match(
    recapPoints(simulate({ quantum: 2 }), simulate({ algorithm: "fcfs" }))[1],
    /평균 최초 응답 1 ms\(FCFS 3 ms\), 전체 완료 20 ms\(FCFS 16 ms\)/,
  );
  assert.match(
    recapPoints(simulate({ quantum: 5 }), simulate({ algorithm: "fcfs" }))[1],
    /FCFS와 똑같이/,
  );
});

test("the start screen asks the question and shows no result before it happens", () => {
  for (const options of [{ quantum: 2 }, { algorithm: "fcfs" }] as SimulateOptions[]) {
    const result = simulate(options);
    const intro = describeIntro(result);
    assert.equal(intro.title, "빠른 응답과 빠른 완료는 같은 뜻일까요?");
    assert.match(intro.goal, /^학습 목표: /);
    const text = [intro.body, intro.goal, ...intro.terms.flat()].join(" ");
    assert.doesNotMatch(text, /\d+회|평균|전체 완료/);
    // The first 핵심 장면 defines 문맥 교환 instead of counting it.
    const start = describeChapter(result.frames[0], result).key;
    assert.doesNotMatch(start, /\d+회|평균 최초 응답|전체 완료/);
  }
  assert.match(
    describeChapter(simulate().frames[0], simulate()).key,
    /문맥 교환\(작업 전환\)이라고/,
  );
});

test("the 핵심 note follows each step and recall questions explain every option", () => {
  const rr = simulate({ quantum: 2 });
  // At a 핵심 장면 the chapter takeaway; between scenes the moment's own note.
  assert.equal(stepNotes(rr.frames[2], rr).key, describeChapter(rr.frames[2], rr).key);
  assert.match(stepNotes(rr.frames[10], rr).key, /P3 반환 시간/);
  assert.match(stepNotes(rr.frames[1], rr).key, /선점하지 않습니다/);
  const questions = recallQuestions(rr, simulate({ algorithm: "fcfs" }));
  assert.ok(questions.length >= 1 && questions.length <= 2);
  for (const question of questions) {
    assert.equal(question.choices.filter((choice) => choice.correct).length, 1);
    for (const choice of question.choices) assert.ok(choice.why.length > 10);
  }
  assert.match(questions[1].choices[0].why, /FCFS보다 4 ms 늦습니다/);
});

test("moment notes explain completions, first responses, arrivals and self re-dispatch", () => {
  const rr = simulate({ quantum: 2 });
  assert.ok(
    momentNotes(rr.frames[10], rr).some((note) =>
      note.startsWith("P3 반환 시간 = 완료 10 − 도착 2 = 8 ms"),
    ),
  );
  assert.ok(momentNotes(rr.frames[12], rr).some((note) => note.startsWith("P2 반환 시간")));
  assert.ok(
    momentNotes(rr.frames[2], rr).some((note) =>
      /P2 최초 응답 = 첫 실행 2 − 도착 1 = 1 ms.*화면 출력/.test(note),
    ),
  );
  assert.ok(
    momentNotes(rr.frames[1], rr).some((note) =>
      /도착은 실행 중인 P1 작업을 선점하지 않습니다/.test(note),
    ),
  );
  assert.ok(momentNotes(rr.frames[19], rr).some((note) => /P1이 새 할당량으로/.test(note)));
  assert.deepEqual(momentNotes(rr.frames[15], rr), []);
});

test("chapter claims depend on what actually happens in that chapter", () => {
  const rr = simulate({ quantum: 2 });
  const fcfs = simulate({ algorithm: "fcfs" });
  assert.match(chapter(rr, "입출력이 끝나면 준비 큐로").body, /먼저 기다리던 P3 작업을 추월하지도/);
  const fcfsReturn = chapter(fcfs, "입출력이 끝나면 준비 큐로").body;
  assert.doesNotMatch(fcfsReturn, /추월/);
  assert.match(fcfsReturn, /선점하지 않습니다/);
  const resume = chapter(rr, "입출력 뒤 다음 CPU 구간");
  assert.match(resume.key, /19 ms.*같은 작업이 다시 CPU/);
  // The first burst finished; this is the next burst, not a resumed one.
  assert.match(resume.body, /새 CPU 구간 3 ms를 처음부터/);
  assert.doesNotMatch(resume.body, /이어서 실행/);
  const q3 = simulate({ quantum: 3 });
  assert.doesNotMatch(chapter(q3, "입출력 뒤 다음 CPU 구간").key, /같은 작업이 다시/);
  assert.match(chapter(rr, "할당량이 끝나면 차례 넘기기").body, /P2 → P3 → P1이었고/);
  assert.match(chapter(fcfs, "도착해도 바로 실행되지 않음").title, /줄을 서는 것/);
  assert.match(chapter(fcfs, "하나의 CPU, 세 작업").body, /선입선처리\(FCFS\)/);
});

test("predictions offer every unfinished job with its own why and a numeric question", () => {
  const ids = (prediction: Prediction) => prediction.choices.map((choice) => choice.id);
  const rr = simulate({ quantum: 2 });
  const first = buildPrediction(rr, -1)! as Prediction;
  assert.equal(first.decision.time, 2);
  assert.deepEqual(first.joined, ["P3 도착"]);
  assert.deepEqual(ids(first), ["P1", "P2", "P3"]);
  assert.equal(first.followUp!.answer, 1);
  assert.ok(first.followUp!.choices.includes(1));
  assert.match(first.explanation, /할당량을 다 써서/);
  assert.match(first.choices[2].why, /도착했다고 바로 실행되지 않습니다/);

  // At 4 ms P2 is about to block: it must still be offered, so the choices don't leak it.
  const blocking = buildPrediction(rr, 3)! as Prediction;
  assert.equal(blocking.decision.time, 4);
  assert.deepEqual(ids(blocking), ["P1", "P2", "P3"]);
  assert.match(blocking.choices[1].why, /입출력을 요청합니다/);

  const afterDone = buildPrediction(rr, 9)! as Prediction;
  assert.equal(afterDone.decision.time, 10);
  assert.deepEqual(ids(afterDone), ["P1", "P2", "P3"]);
  assert.match(afterDone.choices[2].why, /완료됩니다/);
  assert.match(afterDone.explanation, /완료됩니다/);
  assert.equal(afterDone.followUp!.answer, 2);
  assert.match(afterDone.followUp!.context!, /P2의 이번 CPU 구간 2 ms 남음 · 할당량 2 ms/);

  const fcfs = buildPrediction(simulate({ algorithm: "fcfs" }), -1)! as Prediction;
  assert.deepEqual(ids(fcfs), ["P1", "P2", "P3"]);
  assert.match(fcfs.explanation, /입출력을 요청해 CPU를 놓습니다/);
  assert.deepEqual(fcfs.joined, []);

  const positions = new Set<number>();
  for (const options of (
    [1, 2, 3, 4, 5].map((quantum) => ({ quantum })) as SimulateOptions[]
  ).concat({ algorithm: "fcfs" })) {
    const result = simulate(options);
    for (const decision of result.decisions.filter((entry) => entry.candidates.length > 1)) {
      const prediction = buildPrediction(result, decision.time - 1)! as Prediction;
      const before = result.frames[decision.time - 1];
      // Every unfinished job, the running one included; exactly one is right.
      assert.deepEqual(
        ids(prediction),
        result.processes.map((p) => p.id).filter((id) => before.states[id].status !== "done"),
      );
      if (before.running) assert.ok(ids(prediction).includes(before.running));
      assert.deepEqual(
        prediction.choices.filter((choice) => choice.correct).map((choice) => choice.id),
        [decision.chosen],
      );
      for (const choice of prediction.choices)
        assert.ok(choice.why && choice.why.length > 10, choice.id);
      const follow = prediction.followUp;
      const firstRun =
        result.frames[decision.time].states[decision.chosen].firstRun === decision.time;
      if (options.quantum === 1 && !firstRun) {
        assert.equal(follow, null, "a 1 ms quantum makes every turn 1 ms");
        continue;
      }
      assert.ok(follow!.choices.includes(follow!.answer));
      positions.add(follow!.choices.indexOf(follow!.answer));
      if (!firstRun && options.quantum) assert.ok(Math.max(...follow!.choices) <= options.quantum);
    }
  }
  assert.deepEqual([...positions].sort(), [0, 1, 2, 3]);
});

test("number choices place the answer by seed and stay inside their bounds", () => {
  assert.deepEqual(numberChoices(5, { min: 1, seed: 3 }), [2, 3, 4, 5]);
  assert.deepEqual(numberChoices(5, { min: 1, seed: 0 }), [5, 6, 7, 8]);
  assert.deepEqual(numberChoices(2, { min: 1, max: 3, seed: 0 }), [1, 2, 3]);
  assert.deepEqual(numberChoices(2, { min: 1, max: 2, seed: 5 }), [1, 2]);
  assert.deepEqual(numberChoices(0, { min: 0, seed: 2 }), [0, 1, 2, 3]);
});
