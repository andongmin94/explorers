import assert from "node:assert/strict";
import test from "node:test";
import { simulate } from "../src/engine.js";
import {
  describeEventLog,
  describeStep,
  buildMilestones,
  predictionFor,
  MODEL_NOTES,
  SCENE_LEGEND,
  SOURCES,
} from "../src/lesson.js";

test("event log counts new statements once and links resumes to the waiting request", () => {
  for (const [mode, wait, resume] of [["naive", 8, 10], ["locked", 4, 8]]) {
    const steps = simulate({ mode }).steps.slice(1);
    const before = describeEventLog(steps.slice(0, resume - 1));
    assert.equal(before.counts.resume, 0);
    const { entries, counts } = describeEventLog(steps);
    assert.deepEqual(counts, { sql: 8, calculate: 2, resume: 1 });
    const resumed = entries[resume - 1];
    assert.equal(resumed.origin, wait);
    assert.equal(resumed.kind, "resume");
    assert.equal(entries[wait - 1].kind, "sql");
    assert.equal(entries[wait - 1].step.sql, resumed.step.sql);
  }
});

test("every action has Korean teaching content and the corresponding SQL", () => {
  for (const mode of ["naive", "locked"]) {
    const run = simulate({ mode });
    for (const step of run.steps) {
      const lesson = describeStep(step, run);
      for (const field of ["eyebrow", "title", "summary", "takeaway"]) {
        assert.ok(lesson[field].length > 0, `${mode} ${step.index} ${field}`);
        assert.doesNotMatch(lesson[field], /undefined|NaN/);
      }
      assert.ok(lesson.details.length > 0);
      assert.equal(lesson.sql, step.sql);
    }
  }
});

test("milestones target the actual divergent read/write events and final results", () => {
  for (const mode of ["naive", "locked"]) {
    const run = simulate({ mode });
    const milestones = buildMilestones(run);
    assert.deepEqual(
      milestones.map((item) => run.steps[item.index].action),
      [
        "read",
        mode === "naive" ? "read" : "wait",
        "write",
        mode === "naive" ? "resume-write" : "resume-read",
        "commit",
      ],
    );
    assert.equal(milestones.at(-1).index, run.steps.length - 1);
  }
});

test("prediction asks for the final committed stock, which differs by mode", () => {
  const answers = {};
  for (const mode of ["naive", "locked"]) {
    const run = simulate({ mode });
    const available = run.steps.filter((step) => predictionFor(step, run));
    assert.equal(available.length, 1);
    const step = available[0];
    assert.equal(step.action, "commit");
    assert.equal(step.client, "T1");
    const question = predictionFor(step, run);
    assert.equal(question.answerId, String(run.steps.at(-1).state.committedStock));
    answers[mode] = question.answerId;
    assert.deepEqual(question.options.map((o) => o.id), ["8", "9", "10"]);
    for (const option of question.options) assert.ok(option.feedback.length > 20, `${mode} ${option.id}`);
    // The facts shown before answering never print T2's computed number.
    assert.ok(!question.facts.some(([label]) => /계산$/.test(label)));
    assert.ok(!question.facts.some(([, value]) => value === String(step.state.clients.T2.localWrite)));
  }
  assert.deepEqual(answers, { naive: "9", locked: "8" });
  // The wrong answer that assumes waiting recomputes the value is addressed.
  const naive = simulate({ mode: "naive" });
  const q = predictionFor(naive.steps[9], naive);
  assert.match(q.options.find((o) => o.id === "8").feedback, /기다리면/);
});

test("lock modes, atomic re-evaluation and the observation split are stated", () => {
  const notes = MODEL_NOTES.join(" ");
  assert.match(notes, /FOR NO KEY UPDATE/);
  assert.match(notes, /잠금이 풀리는 즉시 재개/);
  const naive = simulate({ mode: "naive" });
  assert.match(describeStep(naive.steps[10], naive).details.join(" "), /stock - 1.*8/);
  assert.match(describeStep(naive.steps[8], naive).details.join(" "), /FOR NO KEY UPDATE/);
  assert.doesNotMatch(describeStep(naive.steps[8], naive).summary, /9/);
  assert.ok(SCENE_LEGEND.join(" ").includes("WAITING"));
});

test("ordinary UPDATE locking and fresh locked reading are stated explicitly", () => {
  const naive = simulate({ mode: "naive" });
  const locked = simulate({ mode: "locked" });
  assert.match(
    describeStep(naive.steps[6], naive).details.join(" "),
    /일반 UPDATE도 행 쓰기 잠금을 얻습니다/,
  );
  assert.match(describeStep(naive.steps[10], naive).summary, /SET stock = 9/);
  assert.match(
    describeStep(locked.steps[8], locked).details.join(" "),
    /첫 읽기 결과는 9/,
  );
  assert.ok(
    SOURCES.every(
      (source) => new URL(source.url).hostname === "www.postgresql.org",
    ),
  );
});
