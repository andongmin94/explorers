import assert from "node:assert/strict";
import test from "node:test";
import { simulate } from "../src/engine.js";
import {
  describeStep,
  buildMilestones,
  predictionFor,
  SOURCES,
} from "../src/lesson.js";

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

test("prediction resolves to the next executed read/write value, not a future app calculation", () => {
  for (const mode of ["naive", "locked"]) {
    const run = simulate({ mode });
    const available = run.steps.filter((step) => predictionFor(step, run));
    assert.equal(available.length, 1);
    const step = available[0];
    const question = predictionFor(step, run);
    const nextEvent = run.steps[step.index + 1].events.find(
      (event) => event.type === (mode === "locked" ? "read" : "write"),
    );
    assert.equal(question.answerId, String(nextEvent.value));
    assert.equal(
      question.options.filter((option) => option.id === question.answerId)
        .length,
      1,
    );
  }
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
