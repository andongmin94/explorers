import assert from "node:assert/strict";
import test from "node:test";
import {
  simulateDeadlock,
  getDeadlockPresentationState,
} from "../src/deadlock-engine.js";
import {
  describeDeadlockStep,
  DEADLOCK_MILESTONES,
  deadlockPrediction,
  DEADLOCK_NOTES,
} from "../src/deadlock-lesson.js";

test("opposite row requests form a cycle only after both waits exist", () => {
  const { steps } = simulateDeadlock();
  assert.equal(steps.length, 11);
  assert.equal(steps[5].state.deadlocked, false);
  const cycle = steps[6].state;
  assert.equal(cycle.deadlocked, true);
  assert.equal(cycle.detected, false);
  assert.deepEqual(cycle.clients.T1.held, ["A"]);
  assert.deepEqual(cycle.clients.T2.held, ["B"]);
  assert.equal(cycle.clients.T1.waitingFor, "B");
  assert.equal(cycle.clients.T2.waitingFor, "A");
  assert.deepEqual(cycle.rows.A.waiting, ["T2"]);
  assert.deepEqual(cycle.rows.B.waiting, ["T1"]);
  assert.deepEqual(steps[7].state.rows, cycle.rows);
  assert.equal(steps[7].state.victim, "T2");
});

test("T2 abort atomically cancels its write, ownership and pending request, preserving T1", () => {
  const step = simulateDeadlock().steps[8];
  const original = structuredClone(step);
  assert.equal(getDeadlockPresentationState(step, "request"), step.before);
  const after = getDeadlockPresentationState(step, "database");
  assert.equal(after.rows.A.committed, 10);
  assert.equal(after.rows.B.committed, 20);
  assert.deepEqual(after.rows.A.pending, { client: "T1", value: 9 });
  assert.equal(after.rows.A.owner, "T1");
  assert.deepEqual(after.rows.A.waiting, []);
  assert.equal(after.rows.B.pending, null);
  assert.equal(after.rows.B.owner, null);
  assert.deepEqual(after.rows.B.waiting, ["T1"]);
  assert.equal(after.clients.T1.waitingFor, "B");
  assert.equal(after.clients.T1.status, "waiting");
  assert.equal(after.clients.T2.status, "aborted");
  assert.deepEqual(after.clients.T2.held, []);
  assert.equal(after.clients.T2.waitingFor, null);
  assert.equal(after.deadlocked, false);
  assert.equal(after.commits, 0);
  assert.equal(after.rollbacks, 1);
  assert.equal(step.sql, null);
  assert.equal(getDeadlockPresentationState(step, "complete"), step.state);
  assert.deepEqual(step, original);
});

test("surviving request resumes on committed B and commits both rows without retrying T2", () => {
  const { steps, stats } = simulateDeadlock();
  const resumed = steps[9].state;
  assert.deepEqual(resumed.clients.T1.held, ["A", "B"]);
  assert.deepEqual(resumed.rows.B.pending, { client: "T1", value: 19 });
  assert.equal(resumed.rows.B.committed, 20);
  assert.deepEqual(resumed.rows.B.waiting, []);
  assert.equal(resumed.clients.T1.waitingFor, null);
  assert.equal(resumed.clients.T2.status, "aborted");

  const commit = steps[10];
  const database = getDeadlockPresentationState(commit, "database");
  assert.equal(database.rows.A.committed, 9);
  assert.equal(database.rows.B.committed, 19);
  assert.equal(database.rows.A.pending, null);
  assert.equal(database.rows.B.pending, null);
  assert.equal(database.rows.A.owner, null);
  assert.equal(database.rows.B.owner, null);
  assert.deepEqual(database.clients.T1.held, []);
  assert.equal(database.clients.T1.status, "active");
  assert.equal(
    getDeadlockPresentationState(commit, "complete").clients.T1.status,
    "committed",
  );
  assert.equal(commit.state.clients.T2.status, "aborted");
  assert.deepEqual(stats, {
    commits: 1,
    rollbacks: 1,
    finalStocks: { A: 9, B: 19 },
  });
});

test("every lesson has an independent snapshot with consistent lock bookkeeping", () => {
  const { steps } = simulateDeadlock();
  for (const step of steps) {
    const lesson = describeDeadlockStep(step);
    assert.ok(lesson.title && lesson.summary && lesson.takeaway);
    assert.ok(lesson.details.length);
    for (const id of ["T1", "T2"]) {
      assert.deepEqual(
        step.state.clients[id].held,
        ["A", "B"].filter((row) => step.state.rows[row].owner === id),
      );
    }
    for (const row of Object.values(step.state.rows)) {
      if (row.pending) assert.equal(row.pending.client, row.owner);
      for (const id of row.waiting)
        assert.equal(step.state.clients[id].status, "waiting");
    }
  }
  for (const milestone of DEADLOCK_MILESTONES)
    assert.ok(steps[milestone.index]);
  steps[10].state.rows.A.committed = 999;
  assert.equal(steps[9].state.rows.A.committed, 10);
  assert.equal(steps[10].before.rows.A.committed, 10);
  assert.equal(simulateDeadlock().stats.finalStocks.A, 9);
});

test("prediction asks for B after the abort; the answer comes from the run", () => {
  const run = simulateDeadlock();
  const q = deadlockPrediction(run);
  assert.equal(q.answerId, String(run.steps[8].state.rows.B.committed));
  assert.equal(q.answerId, "20");
  assert.deepEqual(q.options.map((o) => o.id).sort(), ["19", "20", "21"]);
  assert.notEqual(q.options[0].id, q.answerId);
  for (const o of q.options) assert.ok(o.feedback.length > 20);
  assert.match(q.options.find((o) => o.id === q.answerId).feedback, /다시 보낼 필요 없이/);
});

test("deadlock lesson names the abort, the error, detection timing and prevention", () => {
  const { steps } = simulateDeadlock();
  const rollback = describeDeadlockStep(steps[8]);
  assert.match(rollback.title, /중단·롤백/);
  assert.match(rollback.summary, /40P01/);
  assert.match(describeDeadlockStep(steps[7]).details.join(" "), /deadlock_timeout/);
  assert.match(describeDeadlockStep(steps[9]).details.join(" "), /18/);
  assert.match(describeDeadlockStep(steps[10]).details.join(" "), /ORDER BY id FOR UPDATE/);
  assert.doesNotMatch(DEADLOCK_NOTES.join(" "), /희생자/);
});
