import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_INPUT,
  PRESETS,
  draftOf,
  queryOf,
  readInput,
  validate,
  type Draft,
} from "../custom-input.ts";
import { ALGORITHMS, shortestTotal, simulate, ticksFor } from "../engine.ts";
import { buildLesson } from "../lessons.ts";
import type { Algorithm } from "../types.ts";

const draft = (patch: Partial<Draft>): Draft => ({ ...draftOf(DEFAULT_INPUT), ...patch });

test("validate: Korean messages per field", () => {
  assert.ok(validate(draftOf(DEFAULT_INPUT)).ok);
  const bad = (patch: Partial<Draft>) => {
    const r = validate(draft(patch));
    assert.equal(r.ok, false);
    return r.ok ? {} : r.errors;
  };
  assert.match(bad({ max: "5" }).max!, /19부터 999까지/);
  assert.match(bad({ head: "300" }).head!, /0부터 199까지/);
  assert.match(bad({ requests: "" }).requests!, /하나 이상/);
  assert.match(bad({ requests: "10, abc" }).requests!, /‘abc’는 0부터 199까지의 정수가 아닙니다/);
  assert.match(bad({ requests: "1,2,3,4,5,6,7,8,9,10,11,12,13" }).requests!, /12개까지/);
  assert.match(bad({ requests: "10, 20, 10" }).requests!, /10번 실린더가 두 번/);
  assert.match(bad({ a: "sstf", b: "sstf" }).pair!, /서로 다른 두 방식/);
});

test("the URL query round-trips; a broken query falls back with a reason", () => {
  for (const p of PRESETS) assert.deepEqual(readInput(queryOf(p.input)).input, p.input);
  const broken = readInput("?lesson=custom&head=900&q=1,2");
  assert.deepEqual(broken.input, DEFAULT_INPUT);
  assert.match(broken.problem!, /기본 입력으로 엽니다/);
  assert.equal(readInput("?lesson=custom").problem, null);
});

test("custom lessons run any pair and keep the generic text true", () => {
  const inputs = [
    ...PRESETS.map((p) => p.input),
    {
      requests: [5],
      head: 0,
      max: 19,
      direction: "up" as const,
      pair: ["fcfs", "cscan"] as [Algorithm, Algorithm],
    },
    {
      requests: [400, 10, 999, 500],
      head: 500,
      max: 999,
      direction: "up" as const,
      pair: ["look", "cscan"] as [Algorithm, Algorithm],
    },
  ];
  for (const input of inputs)
    for (const a of ALGORITHMS)
      for (const b of ALGORITHMS) {
        if (a === b) continue;
        const lesson = buildLesson("custom", queryOf({ ...input, pair: [a, b] }));
        assert.deepEqual(lesson.algorithms, [a, b]);
        for (const alg of [a, b]) {
          const run = lesson.runs[alg];
          assert.equal(run.total, simulate(alg, input.requests, input.head, input).total);
          assert.ok(run.total >= shortestTotal(input.requests, input.head) || alg === "cscan");
          const n = run.steps.length - 1;
          for (let i = 0; i <= n; i++) {
            const texts = [lesson.takeawayAt(alg, i), lesson.lessonAt(alg, i).body];
            if (i > 0)
              texts.push(
                ...(["select", "seek", "arrive"] as const).map(
                  (k) => lesson.phaseText(k, run.steps[i], alg).body,
                ),
              );
            for (const t of texts)
              assert.doesNotMatch(t, /undefined|NaN|\[object/, `${a}/${b} ${alg} ${i}`);
            if (i < n) {
              const q = lesson.predictionFor(alg, i + 1);
              assert.equal(q.choices.filter((c) => c.correct).length, 1);
              assert.ok(q.choices.length <= 6);
            }
          }
          const recap = lesson.recapFor(alg);
          for (const r of recap.recall)
            assert.equal(r.choices.filter((c) => c.correct).length, 1, r.id);
          assert.equal(lesson.scenes[alg][0].n, 0);
          assert.equal(lesson.scenes[alg].at(-1)!.n, n);
        }
        assert.ok(lesson.misconceptions.length >= 1 && lesson.misconceptions.length <= 4);
        assert.doesNotMatch(lesson.compareNote(), /undefined|NaN/);
      }
});

test("the shortest total is the LOOK-like sweep, and ticks end at the last cylinder", () => {
  assert.equal(shortestTotal([98, 183, 37, 122, 14, 124, 65, 67], 53), 208);
  assert.equal(shortestTotal([10, 20], 30), 20);
  assert.deepEqual(ticksFor(199), [0, 50, 100, 150, 199]);
  for (const max of [19, 59, 99, 299, 999]) assert.equal(ticksFor(max).at(-1), max);
});
