import test from "node:test";
import assert from "node:assert/strict";
import { simulate } from "../src/engine.js";
import { buildMilestones, compulsoryCount, describeStep, predictionFor, recapFor, victimHintsVisible } from "../src/lesson.js";

const runs = { fifo: simulate({ algorithm: "fifo" }), lru: simulate({ algorithm: "lru" }) };
const sentences = (text) => text.split(/(?<=[.!?])\s+/).filter(Boolean).length;

test("목표: the start screen asks a question and states the learning goal", () => {
  for (const run of Object.values(runs)) {
    const intro = describeStep(run.steps[0], run);
    assert.match(intro.title, /\?$/);
    assert.match(intro.goal, /^학습 목표: /);
    assert.equal(intro.eventTitle, "");
    assert.match(intro.key, /페이지 부재\(page fault\)는 오류가 아니라/);
    assert.match(intro.eyebrow, /^핵심 장면 1\/6/);
    assert.doesNotMatch(JSON.stringify(intro), /적중 \d회|부재 \d회/); // no result before it happens
  }
});

test("설명: every body is at most three sentences and every step has its own 핵심", () => {
  for (const run of Object.values(runs)) {
    const keys = run.steps.map((step) => describeStep(step, run));
    for (const d of keys) {
      assert.ok(sentences(d.body) <= 3, d.body);
      assert.ok(d.key.length > 0);
    }
    // Steps 1–3 no longer repeat one paragraph three times.
    assert.equal(new Set(keys.slice(1, 4).map((d) => d.body)).size, 3);
    assert.equal(new Set(keys.slice(1, 4).map((d) => d.key)).size, 3);
    assert.deepEqual(
      buildMilestones(run).map(({ index }) => index),
      [0, 1, 4, 5, 6, 10],
    );
    assert.match(keys[7].eyebrow, /^7번째 접근 · /);
    assert.match(keys[5].eyebrow, /^핵심 장면 4\/6 · /);
  }
});

test("compulsory misses are first references, with or without a replacement", () => {
  const firsts = { fifo: [1, 2, 3, 5, 8], lru: [1, 2, 3, 5, 8] };
  for (const [name, run] of Object.entries(runs)) {
    const cold = run.steps.filter((step) => step.compulsory).map((step) => step.index);
    assert.deepEqual(cold, firsts[name]);
    assert.equal(compulsoryCount(run), 5);
    // 5 (D) and 8 (E) are compulsory and still replace a page: RAM is full.
    for (const index of [5, 8]) assert.notEqual(run.steps[index].victim, null);
    assert.match(describeStep(run.steps[8], run).key, /처음 참조해 강제 부재이지만, RAM이 가득 차 있어 교체도/);
    assert.match(describeStep(run.steps[1], run).key, /처음 참조할 때의 부재.*RAM이 가득 차 있으면 강제 부재에도 교체가 일어날 수/);
  }
  assert.equal(runs.fifo.stats.faults - compulsoryCount(runs.fifo), 2);
  assert.equal(runs.lru.stats.faults - compulsoryCount(runs.lru), 1);
  assert.match(describeStep(runs.fifo.steps[6], runs.fifo).key, /강제 부재가 아닙니다.*용량 부재/);
  assert.match(describeStep(runs.fifo.steps[10], runs.fifo).body, /부재 7회 중 5회는 A~E를 처음 참조한 강제 부재/);
});

test("hits: FIFO keeps its order and frames; LRU updates the last access", () => {
  const fifoHit = describeStep(runs.fifo.steps[4], runs.fifo);
  assert.equal(fifoHit.key, "적중해도 FIFO 순서는 바뀌지 않고, 페이지도 다른 프레임으로 옮기지 않습니다.");
  const lruHit = describeStep(runs.lru.steps[4], runs.lru);
  assert.match(lruHit.body, /LRU는 4번째를 A의 마지막 접근으로 기록합니다/);
  assert.match(lruHit.key, /참조 비트.*근사/);
  // The MMU sentence appears once, at the first hit only.
  for (const run of Object.values(runs)) {
    const withMmu = run.steps.filter((step) => /운영체제는 관여하지 않고/.test(describeStep(step, run).body));
    assert.deepEqual(withMmu.map((step) => step.index), [4]);
  }
});

test("the loop and locality note is LRU-only and the end names OPT and Belady", () => {
  assert.match(describeStep(runs.lru.steps[7], runs.lru).key, /반복해 쓰는 페이지 수가 프레임 수보다 크면.*8번 중 8번 부재/);
  for (const step of runs.fifo.steps) assert.doesNotMatch(describeStep(step, runs.fifo).key, /시간 지역성/);
  for (const run of Object.values(runs)) {
    const final = describeStep(run.steps.at(-1), run);
    assert.match(final.key, /Belady의 모순\(Belady's anomaly\).*3개에서 9회, 4개에서 10회.*LRU와 OPT는 스택 알고리즘/);
  }
  const { points } = recapFor(runs);
  assert.ok(points.length >= 2 && points.length <= 3);
  assert.match(points.join(" "), /OPT\(MIN\).*부재 5회/);
});

test("completion reports counts without invented timing", () => {
  for (const [algorithm, hits, faults, replacements] of [
    ["fifo", 3, 7, 4],
    ["lru", 4, 6, 3],
  ]) {
    const run = runs[algorithm];
    for (const step of run.steps) assert.doesNotMatch(JSON.stringify(describeStep(step, run)), /\d+\s*(ms|밀리초|ns|µs)/);
    const final = describeStep(run.steps.at(-1), run);
    assert.match(final.body, new RegExp(`적중 ${hits}회, 페이지 부재 ${faults}회, 페이지 교체 ${replacements}회`));
  }
});

test("예측: the first victim choice uses only the resident pages and gives a why per option", () => {
  for (const [algorithm, victim, frame] of [
    ["fifo", "A", 0],
    ["lru", "B", 1],
  ]) {
    const run = runs[algorithm];
    const prediction = predictionFor(run.steps[5], run);
    assert.equal(prediction.kind, "victim");
    assert.equal(prediction.id, `${algorithm}-5`);
    assert.equal(prediction.correctId, victim);
    assert.deepEqual(prediction.choices.map(({ id }) => id), ["A", "B", "C"]);
    assert.equal(prediction.choices[0].detail, "F0 · 적재 1번째 · 마지막 접근 4번째");
    const right = prediction.choices.find((choice) => choice.correct);
    assert.equal(right.id, victim);
    assert.match(right.why, new RegExp(`프레임 ${frame}`));
    assert.equal(prediction.answer, `페이지 ${victim}`);
    assert.equal(predictionFor(run.steps[0], run), null);
    assert.equal(predictionFor(run.steps[1], run), null);
    assert.equal(predictionFor(run.steps[4], run), null);
  }
  // Picking LRU's victim under FIFO names the confusion.
  const fifoB = predictionFor(runs.fifo.steps[5], runs.fifo).choices[1];
  assert.match(fifoB.why, /LRU의 기준/);
  const lruA = predictionFor(runs.lru.steps[5], runs.lru).choices[0];
  assert.match(lruA.why, /FIFO의 기준/);
});

test("every prediction and recall option carries a why", () => {
  for (const run of Object.values(runs)) {
    for (const step of run.steps) {
      const quiz = predictionFor(step, run);
      if (!quiz) continue;
      assert.equal(quiz.choices.filter((choice) => choice.correct).length, 1, quiz.question);
      for (const choice of quiz.choices) assert.ok(choice.why && choice.why.length > 10, `${quiz.id} ${choice.id}`);
    }
  }
  for (const question of recapFor(runs).recall) {
    assert.equal(question.choices.filter((choice) => choice.correct).length, 1);
    for (const choice of question.choices) assert.ok(choice.why.length > 10);
  }
  assert.ok(recapFor(runs).recall.length >= 1 && recapFor(runs).recall.length <= 2);
});

test("no victim hint while a victim prediction is pending or open", () => {
  const run = runs.fifo;
  const pending = predictionFor(run.steps[5], run);
  assert.equal(victimHintsVisible({ nextQuiz: pending }), false);
  assert.equal(victimHintsVisible({ nextQuiz: pending, answered: true }), true);
  assert.equal(victimHintsVisible({ open: pending }), false);
  assert.equal(victimHintsVisible({ busy: true }), false);
  assert.equal(victimHintsVisible({ nextQuiz: null }), true);
  // The outcome question does not hide the replacement order.
  assert.equal(victimHintsVisible({ nextQuiz: predictionFor(run.steps[6], run) }), true);
  // The question text itself does not name the answer.
  for (const r of Object.values(runs))
    for (const step of r.steps) {
      const quiz = predictionFor(step, r);
      if (quiz?.kind === "victim") assert.doesNotMatch(`${quiz.question} ${quiz.rule}`, new RegExp(`페이지 ${quiz.correctId}\\b|${quiz.correctId}[를을가]`));
    }
});
