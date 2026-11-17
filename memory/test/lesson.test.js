import test from "node:test";
import assert from "node:assert/strict";
import { simulate } from "../src/engine.js";
import { buildMilestones, describeStep, predictionFor } from "../src/lesson.js";

test("concept paragraphs stay readable through filling and subsequent accesses", () => {
  for (const algorithm of ["fifo", "lru"]) {
    const run = simulate({ algorithm });
    for (const indices of [
      [1, 2, 3],
      [6, 7, 8, 9],
    ]) {
      const first = describeStep(run.steps[indices[0]], run);
      for (const index of indices) {
        const description = describeStep(run.steps[index], run);
        assert.equal(description.title, first.title);
        assert.equal(description.body, first.body);
        assert.equal(description.insight, first.insight);
        assert.match(description.eventTitle, new RegExp(`${index}번째 접근`));
      }
    }
    assert.deepEqual(
      buildMilestones(run).map(({ index }) => index),
      [0, 1, 4, 5, 6, 10],
    );
  }
});

test("first replacement prediction uses only the resident pages and their prior history", () => {
  for (const [algorithm, victim, frame] of [
    ["fifo", "A", 0],
    ["lru", "B", 1],
  ]) {
    const run = simulate({ algorithm });
    const prediction = predictionFor(run.steps[5]);
    assert.equal(prediction.beforeIndex, 4);
    assert.equal(prediction.atIndex, 5);
    assert.equal(prediction.page, "D");
    assert.equal(prediction.correctId, victim);
    assert.deepEqual(
      prediction.choices.map(({ id }) => id),
      ["A", "B", "C"],
    );
    assert.equal(
      prediction.choices[0].detail,
      "프레임 0 · 적재 1번째 · 최근 접근 4번째",
    );
    assert.equal(
      prediction.choices[1].detail,
      "프레임 1 · 적재 2번째 · 최근 접근 2번째",
    );
    assert.match(prediction.explanation, new RegExp(`프레임 ${frame}`));
    assert.equal(predictionFor(run.steps[0]), null);
    assert.equal(predictionFor(run.steps[1]), null);
    assert.equal(predictionFor(run.steps[4]), null);
  }
});

test("the first fill and clean eviction explain different operations", () => {
  const run = simulate();
  const fill = describeStep(run.steps[1], run);
  assert.match(fill.eventBody, /비어 있던 프레임 0/);
  assert.match(fill.eventBody, /교체는 발생하지 않았습니다/);
  const replaced = describeStep(run.steps[5], run);
  assert.match(replaced.eventBody, /A의 RAM 사본/);
  assert.match(replaced.insight, /저장장치의 원본은 남아/);
  assert.match(replaced.insight, /다시 쓸 필요가 없습니다/);
});

test("the sixth access exposes the consequence of the fifth choice", () => {
  const fifo = simulate({ algorithm: "fifo" });
  const lru = simulate({ algorithm: "lru" });
  assert.match(
    describeStep(fifo.steps[6], fifo).eventTitle,
    /B를 내보내고 A 적재/,
  );
  assert.match(describeStep(lru.steps[6], lru).eventTitle, /A 적중/);
  assert.match(describeStep(lru.steps[6], lru).eventBody, /프레임 0/);
});

test("completion reports counts without invented timing or premature final statistics", () => {
  for (const [algorithm, hits, faults, replacements] of [
    ["fifo", 3, 7, 4],
    ["lru", 4, 6, 3],
  ]) {
    const run = simulate({ algorithm });
    const alteredStats = {
      ...run,
      stats: { hits: 777, faults: 888, replacements: 999 },
    };
    for (const step of run.steps) {
      const description = describeStep(step, run);
      assert.deepEqual(describeStep(step, alteredStats), description);
      assert.doesNotMatch(JSON.stringify(description), /\d+\s*(ms|밀리초)/);
    }
    const final = describeStep(run.steps.at(-1), run);
    assert.match(
      final.body,
      new RegExp(
        `적중 ${hits}회, 페이지 부재 ${faults}회, 페이지 교체 ${replacements}회`,
      ),
    );
  }
});
