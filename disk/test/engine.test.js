import test from "node:test";
import assert from "node:assert/strict";
import { simulate, REQUESTS } from "../src/engine.js";

test("FCFS follows arrival order and travels 640 cylinders", () => {
  const run = simulate("fcfs");
  assert.deepEqual(run.order, REQUESTS);
  assert.equal(run.total, 640);
  assert.deepEqual(
    run.steps.slice(1).map((s) => s.distance),
    [45, 85, 146, 85, 108, 110, 59, 2],
  );
});
test("SSTF re-evaluates from each current position and travels 236 cylinders", () => {
  const run = simulate("sstf");
  assert.deepEqual(run.order, [65, 67, 37, 14, 98, 122, 124, 183]);
  assert.equal(run.total, 236);
  for (const step of run.steps.slice(1)) {
    assert.equal(
      step.distance,
      Math.min(
        ...step.before.pending.map((r) =>
          Math.abs(r.cylinder - step.before.head),
        ),
      ),
    );
    assert.equal(step.state.total, step.before.total + step.distance);
    assert.equal(
      step.state.pending.length + step.state.completed.length,
      REQUESTS.length,
    );
    assert.equal(
      step.before.completed.some((r) => r.id === step.request.id),
      false,
    );
  }
});
test("equal distances keep arrival order; duplicate cylinders remain separate requests", () => {
  const run = simulate("sstf", [60, 40, 60], 50);
  assert.deepEqual(run.order, [60, 60, 40]);
  assert.equal(run.total, 30);
  assert.deepEqual(
    run.steps.slice(1).map((s) => s.request.id),
    [1, 3, 2],
  );
  assert.equal(run.steps[0].state.completed.length, 0);
});
