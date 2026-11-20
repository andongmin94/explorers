import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PROCESSES, simulate } from "../engine.ts";
import type { Algorithm, ProcessDef, SimResult } from "../types.ts";

const trace = (result: SimResult) => result.segments.map(({ id, start, end }) => [id, start, end]);

test("RR q=2 reproduces the complete CPU / I/O scenario", () => {
  const result = simulate();
  assert.deepEqual(trace(result), [
    ["P1", 0, 2],
    ["P2", 2, 4],
    ["P3", 4, 6],
    ["P1", 6, 8],
    ["P3", 8, 10],
    ["P2", 10, 12],
    ["P1", 12, 13],
    [null, 13, 17],
    ["P1", 17, 19],
    ["P1", 19, 20],
  ]);
  assert.deepEqual(result.ioSegments, [
    { id: "P2", start: 4, end: 7 },
    { id: "P1", start: 13, end: 17 },
  ]);
  assert.deepEqual(result.stats, {
    makespan: 20,
    busy: 16,
    idle: 4,
    utilization: 80,
    contextSwitches: 6,
    averageWaiting: 16 / 3,
    averageResponse: 1,
    averageTurnaround: 13,
    perProcess: [
      {
        id: "P1",
        arrival: 0,
        cpu: 8,
        io: 4,
        firstRun: 0,
        completion: 20,
        response: 0,
        waiting: 8,
        turnaround: 20,
      },
      {
        id: "P2",
        arrival: 1,
        cpu: 4,
        io: 3,
        firstRun: 2,
        completion: 12,
        response: 1,
        waiting: 4,
        turnaround: 11,
      },
      {
        id: "P3",
        arrival: 2,
        cpu: 4,
        io: 0,
        firstRun: 4,
        completion: 10,
        response: 2,
        waiting: 4,
        turnaround: 8,
      },
    ],
  });
});

test("FCFS runs each CPU burst to completion and overlaps I/O", () => {
  const result = simulate({ algorithm: "fcfs" });
  assert.deepEqual(trace(result), [
    ["P1", 0, 5],
    ["P2", 5, 7],
    ["P3", 7, 11],
    ["P1", 11, 14],
    ["P2", 14, 16],
  ]);
  assert.deepEqual(result.ioSegments, [
    { id: "P1", start: 5, end: 9 },
    { id: "P2", start: 7, end: 10 },
  ]);
  assert.equal(result.stats.makespan, 16);
  assert.equal(result.stats.averageResponse, 3);
  assert.equal(result.stats.averageWaiting, 5);
  assert.equal(result.stats.averageTurnaround, 38 / 3);
  assert.equal(result.stats.contextSwitches, 4);
});

test("new arrivals precede the expired job at the shared t=2 boundary", () => {
  const result = simulate();
  const frame = result.frames[2];
  assert.equal(frame.running, "P2");
  assert.deepEqual(frame.ready, ["P3", "P1"]);
  assert.deepEqual(
    frame.events.map(({ type, id }) => [type, id]),
    [
      ["arrive", "P3"],
      ["preempt", "P1"],
      ["dispatch", "P2"],
    ],
  );
  assert.deepEqual(
    result.decisions.find(({ time }) => time === 2),
    {
      time: 2,
      candidates: ["P2", "P3", "P1"],
      chosen: "P2",
      cause: "quantum",
    },
  );
});

test("a burst ending at its quantum boundary blocks instead of rejoining ready", () => {
  const frame = simulate().frames[4];
  assert.equal(frame.states.P2.status, "blocked");
  assert.equal(frame.states.P2.ioRemaining, 3);
  assert.equal(frame.states.P2.burstRemaining, 2);
  assert.equal(
    frame.events.some(({ type, id }) => type === "preempt" && id === "P2"),
    false,
  );
});

test("I/O completion joins ready without preempting the running process", () => {
  const frame = simulate().frames[7];
  assert.equal(frame.running, "P1");
  assert.deepEqual(frame.ready, ["P3", "P2"]);
  assert.deepEqual(
    frame.events.map(({ type, id }) => [type, id]),
    [["unblock", "P2"]],
  );
});

test("idle intervals continue I/O and do not accumulate ready waiting", () => {
  const result = simulate();
  const start = result.frames[13];
  assert.equal(start.running, null);
  assert.deepEqual(start.ready, []);
  assert.deepEqual(start.blocked, [{ id: "P1", remaining: 4, until: 17 }]);
  for (let t = 13; t < 17; t += 1) {
    assert.equal(result.frames[t].states.P1.readyWait, 8);
    assert.equal(result.frames[t].states.P1.ioRemaining, 17 - t);
    assert.equal(result.frames[t].running, null);
  }
  assert.equal(result.frames[17].running, "P1");
  assert.deepEqual(result.frames[20].completed, ["P3", "P2", "P1"]);
});

test("waiting, response and turnaround derive from the recorded states", () => {
  for (const algorithm of ["rr", "fcfs"] as Algorithm[]) {
    for (const quantum of [1, 2, 3, 4, 5, 8]) {
      const result = simulate({ algorithm, quantum });
      assert.equal(result.frames.length, result.stats.makespan + 1);
      assert.equal(result.stats.busy + result.stats.idle, result.stats.makespan);
      assert.equal(result.stats.busy, 16);
      for (const process of result.stats.perProcess) {
        const intervals = result.frames.slice(0, -1);
        assert.equal(
          process.waiting,
          intervals.filter((frame) => frame.states[process.id].status === "ready").length,
        );
        assert.equal(process.cpu, intervals.filter((frame) => frame.running === process.id).length);
        assert.equal(
          process.io,
          intervals.filter((frame) => frame.states[process.id].status === "blocked").length,
        );
        assert.equal(process.turnaround, process.waiting + process.cpu + process.io);
        assert.equal(process.response, process.firstRun - process.arrival);
      }
    }
  }
});

test("a quantum longer than every burst produces the FCFS schedule", () => {
  const rr = simulate({ quantum: 20 });
  const fcfs = simulate({ algorithm: "fcfs" });
  assert.deepEqual(rr.segments, fcfs.segments);
  assert.deepEqual(rr.stats, fcfs.stats);
});

test("arrival and I/O-return ties use stable input order before quantum requeue", () => {
  const result = simulate({
    quantum: 2,
    processes: [
      { id: "A", arrival: 0, cpu: [1, 1], io: [2] },
      { id: "B", arrival: 0, cpu: [4], io: [] },
      { id: "C", arrival: 3, cpu: [1], io: [] },
    ] as ProcessDef[],
  });
  assert.deepEqual(result.decisions.find(({ time }) => time === 3)!.candidates, ["A", "C", "B"]);
});

test("future arrivals leave an explicit initial idle segment", () => {
  const result = simulate({
    processes: [{ id: "A", name: "A", arrival: 3, cpu: [1], io: [] }],
  });
  assert.deepEqual(trace(result), [
    [null, 0, 3],
    ["A", 3, 4],
  ]);
  assert.equal(result.stats.idle, 3);
  assert.equal(result.stats.perProcess[0].response, 0);
  assert.equal(result.stats.perProcess[0].waiting, 0);
});

test("simulation is deterministic and never mutates inputs or earlier snapshots", () => {
  const input = structuredClone(DEFAULT_PROCESSES);
  const copy = structuredClone(input);
  const first = simulate({ processes: input });
  const second = simulate({ processes: input });
  assert.deepEqual(input, copy);
  assert.deepEqual(first, second);
  assert.equal(first.frames[0].states.P1.cpuDone, 0);
  assert.equal(first.frames[1].states.P1.cpuDone, 1);
  assert.equal(first.frames[20].states.P1.cpuDone, 8);
  first.processes[0].cpu[0] = 100;
  assert.deepEqual(input, copy);
});
