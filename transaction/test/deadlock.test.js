import assert from "node:assert/strict";
import test from "node:test";
import {
  simulateDeadlock,
  getDeadlockPresentationState,
} from "../src/deadlock-engine.js";
import {
  describeDeadlockStep,
  deadlockMilestones,
  deadlockPrediction,
  DEADLOCK_NOTES,
  DEADLOCK_RECAP,
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
  for (const order of ["opposite", "same"]) {
    const { steps } = simulateDeadlock({ order });
    for (const step of steps) {
      const lesson = describeDeadlockStep(step);
      assert.ok(lesson.title && lesson.summary && lesson.key, `${order} ${step.index}`);
      assert.ok(lesson.details.length >= 1 && lesson.details.length <= 2, `${order} ${step.index} details`);
      assert.doesNotMatch(lesson.title + lesson.summary + lesson.key + lesson.details.join(""), /undefined|NaN|T1가|T2이|T2은|T1는/);
      for (const id of ["T1", "T2"]) {
        assert.deepEqual(
          step.state.clients[id].held,
          ["A", "B"].filter((row) => step.state.rows[row].owner === id),
        );
      }
      for (const row of Object.values(step.state.rows)) {
        if (row.pending) assert.equal(row.pending.client, row.owner);
        for (const id of row.waiting) assert.equal(step.state.clients[id].status, "waiting");
      }
    }
    for (const milestone of deadlockMilestones(order)) assert.ok(steps[milestone.index]);
  }
  const { steps } = simulateDeadlock();
  for (const step of steps) {
    const lesson = describeDeadlockStep(step);
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
  steps[10].state.rows.A.committed = 999;
  assert.equal(steps[9].state.rows.A.committed, 10);
  assert.equal(steps[10].before.rows.A.committed, 10);
  assert.equal(simulateDeadlock().stats.finalStocks.A, 9);
});

test("prediction asks for B's uncommitted value when T1 resumes; nothing pending gives it away", () => {
  const run = simulateDeadlock();
  const q = deadlockPrediction(run);
  const rollback = run.steps[8];
  assert.equal(rollback.action, "rollback");
  assert.equal(q.answerId, String(run.steps[9].state.rows.B.pending.value));
  assert.equal(q.answerId, "19");
  assert.deepEqual(q.options.map((o) => o.id).sort(), ["18", "19", "20"]);
  assert.notEqual(q.options[0].id, q.answerId);
  for (const o of q.options) assert.ok(o.feedback.length > 20);
  assert.match(q.options.find((o) => o.id === "18").feedback, /남아 있다고/);
  assert.match(q.options.find((o) => o.id === "20").feedback, /사라진다고/);
  // While the question is open (after the rollback) B shows only its committed 20.
  assert.equal(rollback.state.rows.B.committed, 20);
  assert.equal(rollback.state.rows.B.pending, null);
  assert.ok(!q.facts.some(([, value]) => value.includes(q.answerId)));
  const shown = describeDeadlockStep(rollback);
  assert.doesNotMatch(shown.title + shown.summary + shown.key + shown.details.join(" "), /19/);
  assert.equal(deadlockPrediction(simulateDeadlock({ order: "same" })), null);
});

test("same lock order: T2 waits on A holding nothing, then both orders commit (A 8, B 18)", () => {
  const { steps, stats } = simulateDeadlock({ order: "same" });
  assert.equal(steps.length, 10);
  assert.ok(steps.every((s) => !s.state.deadlocked && !s.state.detected));
  const wait = steps[4].state;
  assert.equal(wait.clients.T2.waitingFor, "A");
  assert.deepEqual(wait.clients.T2.held, []);
  assert.equal(steps[6].state.rows.A.committed, 9);
  assert.deepEqual(steps[6].state.rows.A.waiting, ["T2"]);
  assert.deepEqual(steps[7].state.rows.A.pending, { client: "T2", value: 8 });
  assert.deepEqual(stats, { commits: 2, rollbacks: 0, finalStocks: { A: 8, B: 18 } });
  assert.match(describeDeadlockStep(steps[0]).title, /\?$/);
});

test("start screen asks a question and does not give the outcome away", () => {
  const start = describeDeadlockStep(simulateDeadlock().steps[0]);
  assert.equal(start.title, "서로 반대 순서로 잠그면 어떻게 될까?");
  assert.match(start.goal, /^학습 목표: /);
  assert.doesNotMatch(start.title + start.summary + start.goal, /교착|멈출|순환|중단/);
  for (const order of ["opposite", "same"])
    assert.doesNotMatch(deadlockMilestones(order).map((m) => m.label).join(" "), /교착|순환|중단|롤백/);
});

test("deadlock recap: 2–3 points and recall questions with one right answer and a why per choice", () => {
  assert.ok(DEADLOCK_RECAP.points.length >= 2 && DEADLOCK_RECAP.points.length <= 3);
  for (const q of DEADLOCK_RECAP.recall) {
    assert.equal(q.choices.filter((c) => c.correct).length, 1);
    for (const c of q.choices) assert.ok(c.why.length > 10);
  }
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
  // One victim disclaimer (detect step) and one prevention pattern (commit step).
  const detect = describeDeadlockStep(steps[7]).details.join(" ");
  assert.match(detect, /예측하기 어렵습니다/);
  assert.match(detect, /설명을 위해 T2를 골랐습니다/);
  assert.doesNotMatch(detect, /찾은 쪽/);
  assert.doesNotMatch(DEADLOCK_NOTES.join(" "), /T2를 중단 대상으로 고정|ORDER BY/);
  assert.match(describeDeadlockStep(steps[9]).details.join(" "), /원래 확정 버전 20에서 1을 빼 19/);
});
