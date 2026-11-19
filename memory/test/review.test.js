import test from "node:test";
import assert from "node:assert/strict";
import { simulate } from "../src/engine.js";
import { describeStep, predictionFor } from "../src/lesson.js";

test("the sixth access asks hit or fault under both policies", () => {
  for (const [algorithm, correct, victim] of [
    ["fifo", "fault", "A"],
    ["lru", "hit", "B"],
  ]) {
    const run = simulate({ algorithm });
    const outcome = predictionFor(run.steps[6], run);
    assert.equal(outcome.kind, "outcome");
    assert.equal(outcome.correctId, correct);
    assert.deepEqual(outcome.choices.map(({ id }) => id), ["hit", "fault"]);
    assert.match(outcome.explanation, new RegExp(`${victim}를 내보냈습니다`));
    assert.deepEqual(outcome.history, ["A", "B", "C", "A", "D"]);
    const victimQuiz = predictionFor(run.steps[5], run);
    assert.equal(victimQuiz.kind, "victim");
    assert.deepEqual(victimQuiz.history, ["A", "B", "C", "A"]);
    assert.deepEqual(victimQuiz.choices.map(({ slot }) => slot), [0, 1, 2]);
  }
});

test("frame particles follow the Sino-Korean reading", () => {
  const fifo = simulate({ algorithm: "fifo" });
  assert.match(predictionFor(fifo.steps[7], fifo).explanation, /프레임 2를 재사용/);
  assert.match(predictionFor(fifo.steps[5], fifo).explanation, /프레임 0을 재사용/);
});

test("hits are handled by the MMU, and LRU is named an idealisation", () => {
  const lru = simulate({ algorithm: "lru" });
  const hit = describeStep(lru.steps[4], lru);
  assert.match(hit.eventBody, /운영체제는 관여하지 않고, 주소 변환 장치\(MMU\)/);
  assert.doesNotMatch(hit.eventBody, /가장 최근에 사용한 페이지로 기록/);
  assert.match(hit.insight, /참조 비트.*근사/);
  assert.equal(hit.question, undefined);
  const intro = describeStep(lru.steps[0], lru);
  assert.match(intro.body, /가상 주소 공간을 같은 크기로 나눈 단위/);
  assert.match(intro.body, /RAM을 같은 크기로 나눈 칸/);
  assert.match(intro.body, /CPU가 가상 주소에 접근하면/);
});

test("faults explain their cost and blocking early; the end names OPT and Belady", () => {
  const run = simulate();
  const fill = describeStep(run.steps[1], run);
  assert.match(fill.body, /다른 준비된 프로세스/);
  assert.match(fill.insight, /강제\(초기\) 부재/);
  assert.match(describeStep(run.steps[7], run).insight, /시간 지역성.*8번 중 8번 부재/);
  const final = describeStep(run.steps.at(-1), run);
  assert.match(final.insight, /OPT\(MIN\).*부재 5회/);
  assert.match(final.insight, /벨레이디의 역설.*3개에서 9회, 4개에서 10회/);
});
