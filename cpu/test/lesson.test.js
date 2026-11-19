import test from "node:test";
import assert from "node:assert/strict";
import { simulate } from "../src/engine.js";
import {
  buildMilestones,
  describeChapter,
  describeComparison,
  frameAtMove,
  processDetails,
} from "../src/lesson.js";

const scenarios = [
  ...[1, 2, 3, 4, 5].map((quantum) => ({ algorithm: "rr", quantum })),
  { algorithm: "fcfs" },
];
const metric = (details, label) =>
  details.metrics.find((entry) => entry.label === label).value;

test("the 2ms arrival and preemption do not prematurely announce P2's first dispatch", () => {
  const frame = simulate().frames[2];
  const beforeArrival = { new: ["P3"], running: "P1", ready: ["P2"], blocked: [], done: [] };
  const first = frameAtMove(frame, beforeArrival, frame.events[0]);
  assert.deepEqual(first.events, []);
  assert.equal(first.states.P1.status, "running");
  assert.equal(first.states.P2.firstRun, null);
  assert.equal(metric(processDetails(first, simulate(), "P3"), "반환 시간"), "도착 중");
  const beforeDispatch = { new: [], running: null, ready: ["P2", "P3", "P1"], blocked: [], done: [] };
  const last = frameAtMove(frame, beforeDispatch, frame.events[2]);
  assert.deepEqual(last.events.map((e) => e.type), ["arrive", "preempt"]);
  assert.equal(last.states.P2.status, "ready");
  assert.equal(frame.states.P2.firstRun, 2);
});

test("the comparison explains matching traces at 5ms and actual CPU idle times at 2ms", () => {
  const fcfs = simulate({ algorithm: "fcfs" });
  const unsliced = simulate({ quantum: 5 });
  assert.deepEqual(unsliced.segments, fcfs.segments);
  assert.match(describeComparison(unsliced, fcfs), /선점이 일어나지 않습니다.*순서가 같습니다/);
  assert.match(describeComparison(simulate({ quantum: 2 }), fcfs), /라운드 로빈 4ms, FCFS 0ms/);
});

test("process details account for every elapsed millisecond without treating I/O as ready waiting", () => {
  for (const options of scenarios) {
    const result = simulate(options);
    for (const frame of result.frames) {
      for (const process of result.processes) {
        const details = processDetails(frame, result, process.id);
        // Count the recorded states independently of the inspector's burst/I/O arithmetic.
        const history = result.frames.filter((entry) => entry.t < frame.t);
        const spent = (status) =>
          history.filter((entry) => entry.states[process.id].status === status)
            .length;
        const cpu = Number.parseFloat(metric(details, "CPU 실행"));
        const ready = Number.parseFloat(metric(details, "대기 시간(준비 큐)"));
        const io = Number.parseFloat(metric(details, "입출력 대기"));
        assert.equal(cpu, spent("running"));
        assert.equal(ready, spent("ready"));
        assert.equal(io, spent("blocked"));
        const completion = frame.states[process.id].finishedAt;
        assert.equal(
          cpu + ready + io,
          Math.max(0, (completion ?? frame.t) - process.arrival),
        );
        assert.equal(
          details.phases
            .filter((phase) => phase.kind === "cpu")
            .reduce((sum, phase) => sum + phase.used, 0),
          cpu,
        );
        assert.equal(
          details.phases
            .filter((phase) => phase.kind === "io")
            .reduce((sum, phase) => sum + phase.used, 0),
          io,
        );
      }
    }
  }
});

test("P1 retains its completed CPU work across the 13–17ms I/O boundary", () => {
  const result = simulate();
  const at = (time) => processDetails(result.frames[time], result, "P1");
  assert.deepEqual(at(13).phases, [
    { kind: "cpu", total: 5, used: 5, status: "past" },
    { kind: "io", total: 4, used: 0, status: "current" },
    { kind: "cpu", total: 3, used: 0, status: "future" },
  ]);
  assert.deepEqual(at(15).phases, [
    { kind: "cpu", total: 5, used: 5, status: "past" },
    { kind: "io", total: 4, used: 2, status: "current" },
    { kind: "cpu", total: 3, used: 0, status: "future" },
  ]);
  assert.deepEqual(at(17).phases, [
    { kind: "cpu", total: 5, used: 5, status: "past" },
    { kind: "io", total: 4, used: 4, status: "past" },
    { kind: "cpu", total: 3, used: 0, status: "current" },
  ]);
  for (const time of [13, 15, 17]) {
    assert.equal(metric(at(time), "CPU 실행"), "5 ms");
    assert.equal(metric(at(time), "대기 시간(준비 큐)"), "8 ms");
  }
  assert.equal(metric(at(20), "CPU 실행"), "8 ms");
  assert.equal(metric(at(20), "입출력 대기"), "4 ms");
  assert.equal(metric(at(20), "반환 시간"), "20 ms");
});

test("chapter explanations remain readable between meaningful boundaries for every supported policy", () => {
  for (const options of scenarios) {
    const result = simulate(options);
    const milestones = buildMilestones(result);
    assert.ok(milestones.length >= 5 && milestones.length <= 7);
    for (let index = 0; index < milestones.length; index++) {
      const start = milestones[index].time;
      const end = milestones[index + 1]?.time ?? result.stats.makespan + 1;
      const expected = describeChapter(result.frames[start], result);
      assert.ok(expected.title && expected.body && expected.insight);
      for (let time = start; time < end; time++) {
        assert.deepEqual(
          describeChapter(result.frames[time], result),
          expected,
        );
      }
    }
  }
  assert.deepEqual(
    buildMilestones(simulate()).map((point) => point.time),
    [0, 2, 4, 7, 13, 17, 20],
  );
  assert.deepEqual(
    buildMilestones(simulate({ algorithm: "fcfs" })).map((point) => point.time),
    [0, 1, 5, 9, 16],
  );
  // At q=3, I/O return and preemption coincide. The new chapter still teaches I/O return.
  const q3 = simulate({ quantum: 3 });
  assert.match(describeChapter(q3.frames[8], q3).title, /입출력/);
});

test("inspection reveals response and turnaround only after they happen and freezes finished work", () => {
  for (const options of scenarios) {
    const result = simulate(options);
    for (const frame of result.frames) {
      for (const process of result.processes) {
        const state = frame.states[process.id];
        const details = processDetails(frame, result, process.id);
        if (state.firstRun === null)
          assert.equal(metric(details, "최초 응답"), "아직 실행 전");
        if (state.status === "new")
          assert.equal(metric(details, "반환 시간"), "도착 전");
        else if (state.status !== "done")
          assert.equal(metric(details, "반환 시간"), "진행 중");
      }
    }
  }
  const result = simulate();
  const at = (time) => processDetails(result.frames[time], result, "P3");
  assert.equal(metric(at(9), "반환 시간"), "진행 중");
  assert.equal(metric(at(10), "반환 시간"), "8 ms");
  assert.deepEqual(at(20).metrics, at(10).metrics);
  assert.deepEqual(at(20).phases, at(10).phases);
});
