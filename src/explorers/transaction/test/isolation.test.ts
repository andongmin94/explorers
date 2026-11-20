import assert from "node:assert/strict";
import test from "node:test";
import {
  ERRORS,
  committedValue,
  getIsolationPresentationState,
  simulateIsolation,
  visibleValue,
} from "../isolation-engine.ts";
import { ISOLATION_LESSONS, type IsoLesson } from "../isolation-lesson.ts";
import type { IsoRun, Level } from "../isolation-engine.ts";
import { LESSONS } from "../lessons.ts";
import { lessonHref, nextLesson, progressIdFor } from "@/lib/lesson-rail.ts";

const actions = (run: IsoRun) => run.steps.slice(1).map((s) => `${s.action}:${s.client}`);
const runs = () =>
  Object.values(ISOLATION_LESSONS).flatMap((L) =>
    Object.keys(L.modes).map(
      (mode) =>
        [L, simulateIsolation({ scenario: L.scenario, mode: mode as Level })] as [
          IsoLesson,
          IsoRun,
        ],
    ),
  );

test("READ COMMITTED: the waiting UPDATE re-evaluates stock - 1 on the committed 9 and writes 8", () => {
  const run = simulateIsolation({ scenario: "repeatable-read", mode: "rc" });
  assert.deepEqual(actions(run), [
    "begin:T1",
    "begin:T2",
    "select:T1",
    "select:T2",
    "write:T1",
    "wait:T2",
    "commit:T1",
    "resume-write:T2",
    "commit:T2",
  ]);
  assert.match(run.steps[1].sql!, /^BEGIN ISOLATION LEVEL READ COMMITTED;$/);
  assert.equal(run.steps[4].state.clients.T2.read, 10);
  const resumed = run.steps[8];
  assert.equal(resumed.sql, "UPDATE inventory SET stock = stock - 1 WHERE id = 1;");
  assert.equal(resumed.before.rows["1"].versions.at(-1)!.value, 9);
  assert.equal(resumed.state.rows["1"].pending!.value, 8);
  assert.equal(run.stats.finals["1"], 8);
  assert.equal(run.stats.errors, 0);
  assert.deepEqual(run.stats.attempts, { T1: 1, T2: 1 });
});

test("REPEATABLE READ: the waiting UPDATE fails with 40001 concurrent update; ROLLBACK and retry give 8", () => {
  const run = simulateIsolation({ scenario: "repeatable-read", mode: "rr" });
  assert.deepEqual(actions(run), [
    "begin:T1",
    "begin:T2",
    "select:T1",
    "select:T2",
    "write:T1",
    "wait:T2",
    "commit:T1",
    "error:T2",
    "rollback:T2",
    "begin:T2",
    "select:T2",
    "write:T2",
    "commit:T2",
  ]);
  // The snapshot is taken by the first statement, not by BEGIN.
  assert.equal(run.steps[2].state.clients.T2.snapshot, null);
  assert.equal(run.steps[4].state.clients.T2.snapshot, 0);
  const failed = run.steps[8];
  assert.deepEqual(failed.error, {
    code: "40001",
    message: "could not serialize access due to concurrent update",
  });
  assert.equal(failed.state.clients.T2.status, "aborted");
  assert.equal(failed.state.rows["1"].owner, null);
  assert.equal(failed.state.rows["1"].pending, null);
  // Even inside T2 the old snapshot still shows 10 after T1 committed 9.
  assert.equal(visibleValue(failed.before, "T2", "1"), 10);
  assert.equal(committedValue(failed.before, "1"), 9);
  assert.equal(run.steps[9].sql, "ROLLBACK;");
  assert.equal(run.steps[9].state.clients.T2.status, "rolledback");
  assert.equal(run.steps[11].state.clients.T2.read, 9, "the retry's new snapshot sees T1's commit");
  assert.equal(run.steps[12].state.rows["1"].pending!.value, 8);
  assert.equal(run.stats.finals["1"], 8);
  assert.equal(run.stats.errors, 1);
  assert.deepEqual(run.stats.attempts, { T1: 1, T2: 2 });
});

test("write skew: REPEATABLE READ commits both and leaves 0 on call; SERIALIZABLE aborts T2 with 40001", () => {
  const rr = simulateIsolation({ scenario: "write-skew", mode: "rr" });
  assert.deepEqual(actions(rr), [
    "begin:T1",
    "begin:T2",
    "select:T1",
    "select:T2",
    "decide:T1",
    "decide:T2",
    "write:T1",
    "write:T2",
    "commit:T1",
    "commit:T2",
  ]);
  assert.equal(rr.steps[3].sql, "SELECT count(*) FROM doctors WHERE on_call;");
  assert.equal(rr.steps[7].sql, "UPDATE doctors SET on_call = false WHERE name = 'A';");
  assert.ok(
    rr.steps.every((s) => s.action !== "wait"),
    "different rows never wait on each other",
  );
  assert.deepEqual(rr.stats.finals, { A: false, B: false });
  assert.equal(rr.stats.onCall, 0);
  assert.equal(rr.stats.errors, 0);

  const ser = simulateIsolation({ scenario: "write-skew", mode: "ser" });
  assert.deepEqual(actions(ser), [
    "begin:T1",
    "begin:T2",
    "select:T1",
    "select:T2",
    "decide:T1",
    "decide:T2",
    "write:T1",
    "write:T2",
    "commit:T1",
    "commit-error:T2",
    "begin:T2",
    "select:T2",
    "decide:T2",
    "commit:T2",
  ]);
  const failed = ser.steps[10];
  assert.deepEqual(failed.error, ERRORS.ssi);
  assert.equal(failed.error.code, "40001");
  assert.equal(
    failed.error.message,
    "could not serialize access due to read/write dependencies among transactions",
  );
  assert.equal(failed.state.rows.B.pending, null);
  assert.equal(failed.state.rows.B.owner, null);
  assert.equal(failed.state.clients.T2.status, "rolledback");
  assert.equal(ser.steps[12].state.clients.T2.read, 1);
  assert.equal(ser.steps[13].state.clients.T2.plan, "stay");
  assert.deepEqual(ser.stats.finals, { A: false, B: true });
  assert.equal(ser.stats.onCall, 1);
  assert.equal(ser.stats.errors, 1);
});

test("snapshots: uncommitted writes are private, committed versions keep their history", () => {
  const run = simulateIsolation({ scenario: "write-skew", mode: "rr" });
  const afterWrites = run.steps[8].state;
  assert.equal(visibleValue(afterWrites, "T1", "A"), false);
  assert.equal(visibleValue(afterWrites, "T2", "A"), true);
  assert.equal(committedValue(afterWrites, "A"), true);
  for (const step of run.steps.slice(1))
    assert.deepEqual(step.before, run.steps[step.index - 1].state);
  assert.throws(() => simulateIsolation({ scenario: "repeatable-read", mode: "ser" }), RangeError);
});

test("presentation: the database phase keeps the requester waiting for its response", () => {
  const run = simulateIsolation({ scenario: "repeatable-read", mode: "rr" });
  const commit = run.steps[7];
  const db = getIsolationPresentationState(commit, "database");
  assert.equal(db.rows["1"].versions.at(-1)!.value, 9);
  assert.equal(db.clients.T1.status, "active");
  assert.equal(getIsolationPresentationState(commit, "complete").clients.T1.status, "committed");
  assert.equal(
    getIsolationPresentationState(run.steps[6], "database").clients.T2.status,
    "waiting",
  );
});

test("each lesson: question start, goal, 3–6 scenes, content for every event", () => {
  for (const [L, run] of runs()) {
    const start = L.describe(run.steps[0], run);
    assert.match(start.title, /\?$/, L.id);
    assert.match(start.goal, /^학습 목표: /);
    assert.doesNotMatch(start.summary + start.goal, /40001로 실패|0명이 됐|최종 8/);
    const milestones = L.milestones(run);
    assert.ok(milestones.length >= 3 && milestones.length <= 6);
    assert.equal(
      milestones.at(-1)!.index,
      run.steps.length - 1,
      `${L.id} ${run.mode} ends on the result`,
    );
    for (const m of milestones) assert.ok(run.steps[m.index], `${L.id} milestone ${m.index}`);
    for (const step of run.steps) {
      const d = L.describe(step, run);
      for (const field of ["eyebrow", "title", "summary", "key"] as const) {
        assert.ok(d[field].length > 0, `${L.id} ${run.mode} ${step.index} ${field}`);
        assert.doesNotMatch(d[field], /undefined|NaN|null/);
      }
      assert.ok(
        d.details.length >= 1 && d.details.length <= 2,
        `${L.id} ${run.mode} ${step.index} details`,
      );
      assert.equal(d.sql, step.sql);
      assert.doesNotMatch(d.title, /T1가|T2이|A이|B이|9을|8을를/);
    }
  }
});

test("predictions: one before the fork in each mode, a why per option, answers match the engine", () => {
  const answers: Record<string, string> = {};
  for (const [L, run] of runs()) {
    const asked = run.steps.filter((s) => L.prediction(s, run));
    assert.ok(asked.length >= 1);
    for (const step of asked) {
      const q = L.prediction(step, run)!;
      assert.equal(q.options.filter((o) => o.id === q.answerId).length, 1);
      for (const o of q.options)
        assert.ok(o.feedback.length > 20, `${L.id} ${run.mode} ${q.id} ${o.id}`);
      assert.ok(q.target && q.label && q.question.endsWith("?"));
      // Nothing in the facts gives the answer away.
      assert.ok(
        !q.facts.some(
          ([, v]) => /40001|ERROR|0명|OFF \/ OFF/.test(v) && !/→ 40001|→ ROLLBACK/.test(v),
        ),
        `${L.id} ${q.id} facts`,
      );
      answers[`${L.id}:${run.mode}:${q.id}`] = q.answerId;
    }
    // The fork is the first prediction: asked at T1's commit, before T2's outcome.
    const fork = asked[0];
    assert.equal(fork.action, "commit");
    assert.equal(fork.client, "T1");
  }
  assert.deepEqual(answers, {
    "repeatable-read:rc:resume": "reeval",
    "repeatable-read:rr:resume": "error",
    "repeatable-read:rr:retry-read": "9",
    "write-skew:rr:commit": "zero",
    "write-skew:ser:commit": "fail",
    "write-skew:ser:retry-count": "1",
  });
  // Answers follow from the engine.
  const rr = simulateIsolation({ scenario: "repeatable-read", mode: "rr" });
  assert.equal(rr.steps[8].action, "error");
  assert.equal(String(rr.steps[11].state.clients.T2.read), "9");
  const ser = simulateIsolation({ scenario: "write-skew", mode: "ser" });
  assert.equal(String(ser.steps[12].state.clients.T2.read), "1");
});

test("recap: 2–3 points, 1–2 recall questions with one right answer and a why per choice", () => {
  for (const L of Object.values(ISOLATION_LESSONS)) {
    assert.ok(L.recap.points.length >= 2 && L.recap.points.length <= 3);
    assert.ok(L.recap.recall.length >= 1 && L.recap.recall.length <= 2);
    for (const q of L.recap.recall) {
      assert.equal(q.choices.filter((c) => c.correct).length, 1, q.id);
      for (const c of q.choices) assert.ok(c.why.length > 10, `${q.id} ${c.label}`);
    }
    for (const s of L.sources) assert.equal(new URL(s.url).hostname, "www.postgresql.org");
    assert.ok(Object.keys(L.modes).length === 2 && L.compare.title && L.compare.lead);
  }
  assert.match(ISOLATION_LESSONS["repeatable-read"].notes.join(" "), /첫 문장/);
  assert.match(ISOLATION_LESSONS["write-skew"].notes.join(" "), /SSI/);
});

test("lesson list: four lessons, deadlock on its own page, onward links and progress ids", () => {
  assert.deepEqual(
    LESSONS.map((l) => l.id),
    ["lost-update", "deadlock", "repeatable-read", "write-skew"],
  );
  for (const l of LESSONS) assert.ok(l.name && l.sub && l.title);
  assert.equal(lessonHref(LESSONS, LESSONS[0]), "./");
  assert.equal(lessonHref(LESSONS, LESSONS[1]), "deadlock.html");
  assert.equal(lessonHref(LESSONS, LESSONS[2]), "./?lesson=repeatable-read");
  assert.deepEqual(nextLesson(LESSONS, "deadlock"), {
    href: "./?lesson=repeatable-read",
    title: "직렬화 오류",
  });
  assert.equal(
    nextLesson(LESSONS, "write-skew"),
    null,
    "the last lesson links to the next experiment",
  );
  assert.equal(progressIdFor("transaction", LESSONS, "lost-update"), "transaction");
  assert.equal(progressIdFor("transaction", LESSONS, "deadlock"), "transaction:deadlock");
  for (const id of Object.keys(ISOLATION_LESSONS))
    assert.ok(LESSONS.some((l) => l.id === id && !l.href));
});
