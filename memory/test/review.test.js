import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { simulate } from "../src/engine.js";
import { describeStep, predictionFor } from "../src/lesson.js";

const source = (name) => readFileSync(new URL(`../src/${name}`, import.meta.url), "utf8");

test("the sixth access asks for the result and its reason, not what the scene shows", () => {
  for (const [algorithm, correct, victim] of [
    ["fifo", "fault-first", "A"],
    ["lru", "hit-recent", "B"],
  ]) {
    const run = simulate({ algorithm });
    const outcome = predictionFor(run.steps[6], run);
    assert.equal(outcome.kind, "outcome");
    assert.equal(outcome.correctId, correct);
    assert.deepEqual(outcome.choices.map(({ id }) => id), ["hit-recent", "fault-first", "fault-cold"]);
    assert.deepEqual(outcome.history, ["A", "B", "C", "A", "D"]);
    assert.match(outcome.question, /결과와 그 이유/);
    // The rule points at the criterion, not at the evicted page.
    assert.doesNotMatch(outcome.rule, new RegExp(`${victim}[를을]`));
    // Two of the three choices share each result: what is in RAM cannot answer it.
    assert.equal(outcome.choices.filter((choice) => choice.label === "부재").length, 2);
    const victimQuiz = predictionFor(run.steps[5], run);
    assert.equal(victimQuiz.kind, "victim");
    assert.deepEqual(victimQuiz.history, ["A", "B", "C", "A"]);
    assert.deepEqual(victimQuiz.choices.map(({ slot }) => slot), [0, 1, 2]);
  }
  const fifo = simulate({ algorithm: "fifo" });
  assert.match(predictionFor(fifo.steps[6], fifo).choices[0].why, /최근에 읽었으니 남는다/);
});

test("frame particles follow the Korean reading of the digit", () => {
  const fifo = simulate({ algorithm: "fifo" });
  assert.match(predictionFor(fifo.steps[7], fifo).choices[2].why, /프레임 2를 재사용/);
  assert.match(predictionFor(fifo.steps[5], fifo).choices[0].why, /프레임 0을 재사용/);
  const lru = simulate({ algorithm: "lru" });
  assert.match(predictionFor(lru.steps[5], lru).choices[1].why, /프레임 1을 재사용/);
});

test("terms: one name per idea across the lesson, scene and page", () => {
  const lessonText = ["fifo", "lru"]
    .map((algorithm) => {
      const run = simulate({ algorithm });
      return run.steps.map((step) => JSON.stringify([describeStep(step, run), predictionFor(step, run)])).join("");
    })
    .join("");
  const all = lessonText + source("lesson.js") + source("main.js") + source("scene.js");
  // LRU compares the 마지막 접근; FIFO keeps the 적재 순서.
  for (const banned of [/최근 접근/, /최근 사용/, /사용 순/, /마지막 사용/, /오래 사용하지/, /참조되지 않은/, /적재 차례/, /적재 번호/, /적재 순(?!서)/, /벨레이디/, /실제 지연 시간/])
    assert.doesNotMatch(all, banned, String(banned));
  // Prose names frames "프레임 0"; "F0" only as a compact label, never "프레임 F0".
  assert.doesNotMatch(all, /프레임 F\d|프레임 F\$/);
  assert.doesNotMatch(lessonText.replace(/"detail":"F\d[^"]*"/g, ""), /F\d/);
  // The particle bug "실제 교체을" is gone with the shared label.
  assert.doesNotMatch(source("main.js"), /실제 \$\{|교체을/);
  assert.match(source("main.js"), /LABELS\.reveal/);
});

test("the compulsory miss is defined as the first reference everywhere", () => {
  const main = source("main.js");
  assert.doesNotMatch(main + source("lesson.js"), /빈 RAM을 처음 채우/);
  assert.match(main, /그 페이지를 처음 참조할 때의 부재\. RAM이 가득 차 있으면 교체도 일어날 수 있습니다/);
  assert.match(main, /시뮬레이션은 지연 시간을 재지 않습니다/);
});
