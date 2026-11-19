import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PROCESSES, simulate } from "../src/engine.js";
import {
  buildMilestones,
  buildPrediction,
  comparisonSummary,
  describeChapter,
  momentNotes,
  quantumSweep,
} from "../src/lesson.js";

const chapter = (result, title) => {
  const point = buildMilestones(result).find((entry) => entry.title === title);
  return describeChapter(result.frames[point.time], result);
};

test("the comparison names the delayed I/O, both completion metrics and the zero switch cost", () => {
  const fcfs = simulate({ algorithm: "fcfs" });
  const summary = comparisonSummary(simulate({ quantum: 2 }), fcfs);
  assert.match(summary.cause, /P1의 첫 입출력 요청이 5ms에서 13ms로 늦어집니다/);
  assert.match(summary.cause, /13–17ms에 CPU가 쉽니다/);
  assert.match(summary.finish, /전체 완료 시각.*FCFS가 4ms 빠릅니다/);
  assert.match(summary.finish, /평균 반환 시간은 라운드 로빈 13ms, FCFS 12.67ms/);
  assert.match(summary.caveat, /문맥 교환 비용을 0ms로/);
  assert.match(summary.caveat, /호위 효과/);
  assert.doesNotMatch(summary.finish, /도 라운드 로빈/);
  const same = comparisonSummary(simulate({ quantum: 5 }), fcfs);
  assert.match(same.finish, /같습니다/);
  assert.doesNotMatch(same.caveat, /전환 비용 때문/);
});

test("the quantum trade-off is computed from the engine at every slider position", () => {
  const sweep = quantumSweep(simulate, DEFAULT_PROCESSES);
  assert.deepEqual(sweep.map((row) => row.makespan), [18, 20, 17, 18, 16]);
  assert.deepEqual(sweep.map((row) => row.switches), [13, 6, 6, 5, 4]);
  const start = (quantum) => describeChapter(simulate({ quantum }).frames[0], simulate({ quantum })).insight;
  assert.match(start(2), /문맥 교환 6회/);
  assert.match(start(1), /문맥 교환 13회/);
  assert.match(start(5), /FCFS와 똑같이/);
});

test("moment notes explain completions, first responses, arrivals and self re-dispatch", () => {
  const rr = simulate({ quantum: 2 });
  assert.ok(momentNotes(rr.frames[10], rr).some((note) => note.startsWith("P3 반환 시간 = 완료 10 − 도착 2 = 8ms")));
  assert.ok(momentNotes(rr.frames[12], rr).some((note) => note.startsWith("P2 반환 시간")));
  assert.ok(momentNotes(rr.frames[2], rr).some((note) => /P2 최초 응답 = 첫 실행 2 − 도착 1 = 1ms.*화면 출력/.test(note)));
  assert.ok(momentNotes(rr.frames[1], rr).some((note) => /도착은 실행 중인 P1 작업을 선점하지 않습니다/.test(note)));
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
  assert.match(chapter(rr, "입출력을 마치고 이어서 실행").insight, /19 ms.*같은 작업이 다시 CPU/);
  const q3 = simulate({ quantum: 3 });
  assert.doesNotMatch(chapter(q3, "입출력을 마치고 이어서 실행").insight, /같은 작업이 다시/);
  assert.match(chapter(rr, "할당량이 끝나면 차례 넘기기").body, /P2 → P3 → P1이었습니다/);
  assert.match(chapter(fcfs, "도착해도 바로 실행되지 않음").title, /줄을 서는 것/);
  assert.match(chapter(fcfs, "하나의 CPU, 세 작업").body, /선입선처리\(FCFS\)/);
});

test("predictions offer only runnable jobs, hide queue order and add a numeric question", () => {
  const rr = simulate({ quantum: 2 });
  const first = buildPrediction(rr, -1);
  assert.equal(first.decision.time, 2);
  assert.deepEqual(first.joined, ["P3 도착"]);
  assert.deepEqual(first.choices, ["P1", "P2", "P3"]);
  assert.equal(first.followUp.answer, 1);
  assert.ok(first.followUp.choices.includes(1));
  assert.match(first.explanation, /할당량을 다 써서/);

  const afterDone = buildPrediction(rr, 9);
  assert.equal(afterDone.decision.time, 10);
  assert.deepEqual(afterDone.choices, ["P1", "P2"]);
  assert.match(afterDone.explanation, /완료됩니다/);
  assert.equal(afterDone.followUp.answer, 2);

  const fcfs = buildPrediction(simulate({ algorithm: "fcfs" }), -1);
  assert.deepEqual(fcfs.choices, ["P2", "P3"]);
  assert.match(fcfs.explanation, /입출력을 요청해 CPU를 놓습니다/);
  assert.deepEqual(fcfs.joined, []);

  for (const options of [1, 2, 3, 4, 5].map((quantum) => ({ quantum })).concat({ algorithm: "fcfs" })) {
    const result = simulate(options);
    for (const decision of result.decisions.filter((entry) => entry.candidates.length > 1)) {
      const prediction = buildPrediction(result, decision.time - 1);
      const frame = result.frames[decision.time];
      for (const id of prediction.choices) assert.ok(!["done", "blocked"].includes(frame.states[id].status));
      assert.ok(prediction.followUp.choices.includes(prediction.followUp.answer));
    }
  }
});
