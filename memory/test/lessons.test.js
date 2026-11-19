import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { replacementOrder, simulate } from "../src/engine.js";
import { BELADY_STRING, countFaults } from "../src/policies.js";
import { BELADY_PAGES, CLOCK_PAGES, LESSONS, extrasFor, runsFor } from "../src/lessons.js";
import { victimHintsVisible } from "../src/lesson.js";

const byId = Object.fromEntries(LESSONS.map((lesson) => [lesson.id, lesson]));
const sentences = (text) => text.split(/(?<=[.!?])\s+/).filter(Boolean).length;
const faults = (references, algorithm, frameCount = 3) => simulate({ algorithm, frameCount, references }).stats.faults;
const victims = (run) => run.steps.slice(1).map((step) => step.victim ?? ".").join("");

/* ---------- Engine: OPT, Clock, frame counts ---------- */

test("OPT evicts the page whose next access is furthest away (lesson 02 loop)", () => {
  const loop = byId.opt.references;
  assert.deepEqual(loop, "ABCDABCDABCD".split(""));
  const opt = simulate({ algorithm: "opt", references: loop });
  const lru = simulate({ algorithm: "lru", references: loop });
  assert.equal(opt.stats.faults, 6);
  assert.equal(lru.stats.faults, 12);
  assert.equal(victims(opt), "...C..B..A..");
  // 4th access D: A next at 5, B at 6, C at 7 → C goes.
  assert.deepEqual(opt.steps[4].before.map((f) => [f.page, f.nextUseAt]), [["A", 5], ["B", 6], ["C", 7]]);
  // 10th access B: A is never used again → it goes first.
  assert.equal(opt.steps[10].before.find((f) => f.page === "A").nextUseAt, null);
  assert.equal(opt.steps[10].victim, "A");
  assert.equal(lru.steps[4].victim, "A");
  assert.equal(opt.steps[5].hit, true);
  assert.equal(lru.steps[5].hit, false);
  // OPT is the lower bound for every lesson's input.
  for (const lesson of LESSONS)
    for (const n of [3, 4])
      for (const policy of ["fifo", "lru", "clock"]) assert.ok(faults(lesson.references, "opt", n) <= faults(lesson.references, policy, n), `${lesson.id} ${policy} ${n}`);
});

test("Belady's anomaly: FIFO 9 → 10 faults with 3 → 4 frames; LRU does not", () => {
  assert.deepEqual(BELADY_PAGES.map((p) => "ABCDE".indexOf(p) + 1), BELADY_STRING);
  assert.equal(faults(BELADY_PAGES, "fifo", 3), 9);
  assert.equal(faults(BELADY_PAGES, "fifo", 4), 10);
  assert.equal(faults(BELADY_PAGES, "lru", 3), 10);
  assert.equal(faults(BELADY_PAGES, "lru", 4), 8);
  const runs = runsFor(byId.belady);
  assert.equal(runs.f3.frameCount, 3);
  assert.equal(runs.f4.frameCount, 4);
  assert.equal(runs.f4.steps[7].victim, "A"); // loaded 1st, hit at 5th: FIFO ignores the hit
  assert.equal(runs.f3.steps[7].victim, "D");
  assert.deepEqual([8, 9].map((i) => runs.f3.steps[i].hit), [true, true]);
  assert.deepEqual([8, 9].map((i) => runs.f4.steps[i].hit), [false, false]);
  assert.equal(runs.f3.steps[6].faults, 6);
  assert.equal(runs.f4.steps[6].faults, 4);
  assert.equal(runs.f3.steps[9].faults, 7);
  assert.equal(runs.f4.steps[9].faults, 7);
  // Stack property: LRU's 3-frame RAM is always inside its 4-frame RAM; FIFO's is not.
  const inside = (small, big) => small.steps.every((s, i) => s.frames.every((f) => !f.page || big.steps[i].frames.some((g) => g.page === f.page)));
  assert.equal(inside(simulate({ algorithm: "lru", frameCount: 3, references: BELADY_PAGES }), simulate({ algorithm: "lru", frameCount: 4, references: BELADY_PAGES })), true);
  assert.equal(inside(runs.f3, runs.f4), false);
});

test("Clock: reference bits, the hand and second chances (lesson 04)", () => {
  assert.deepEqual(CLOCK_PAGES, "ABCDBABCD".split(""));
  const clock = simulate({ algorithm: "clock", references: CLOCK_PAGES });
  const lru = simulate({ algorithm: "lru", references: CLOCK_PAGES });
  const fifo = simulate({ algorithm: "fifo", references: CLOCK_PAGES });
  assert.deepEqual([clock.stats.faults, lru.stats.faults, fifo.stats.faults, faults(CLOCK_PAGES, "opt")], [7, 7, 8, 5]);
  assert.equal(victims(clock), "...A.C.DB");
  assert.equal(victims(lru), "...A.C.DA");
  assert.equal(victims(fifo), "...A.BCDA");
  const sweeps = (i) => clock.steps[i].events.filter((e) => e.type === "sweep").map((e) => e.page).join("");
  // All bits set: the hand goes round once, clears them and evicts where it started.
  assert.equal(sweeps(4), "ABC");
  assert.equal(clock.steps[4].handBefore, 0);
  assert.equal(clock.steps[4].hand, 1);
  // A hit sets the bit again.
  assert.equal(clock.steps[4].frames[1].ref, 0);
  assert.equal(clock.steps[5].frames[1].ref, 1);
  // Second chance: B (bit 1) survives, C (bit 0) goes — where FIFO would evict B.
  assert.equal(sweeps(6), "B");
  assert.equal(clock.steps[6].victim, "C");
  assert.equal(replacementOrder(clock.steps[6].before, "fifo")[0], "B");
  assert.equal(sweeps(8), "DBA");
  // 9th: A and B both have bit 0; the hand reaches B first, LRU knows A is older.
  assert.deepEqual(clock.steps[9].before.map((f) => [f.page, f.ref]), [["C", 1], ["B", 0], ["A", 0]]);
  assert.equal(clock.steps[9].handBefore, 1);
  // The order the engine predicts is the victim the sweep finds, at every replacement.
  for (const step of clock.steps) if (step.victim) assert.equal(step.beforeOrder[0], step.victim, `step ${step.index}`);
  // Loaded pages start with the bit set; non-clock runs carry no bit.
  assert.equal(clock.steps[1].frames[0].ref, 1);
  assert.equal("ref" in lru.steps[1].frames[0], false);
});

test("the engine agrees with the independent counter in policies.js", () => {
  for (const lesson of LESSONS)
    for (const n of [3, 4])
      for (const policy of ["fifo", "lru", "opt"]) {
        const { stats } = simulate({ algorithm: policy, frameCount: n, references: lesson.references });
        assert.deepEqual(countFaults(lesson.references, n, policy), { hits: stats.hits, faults: stats.faults, replacements: stats.replacements }, `${lesson.id} ${policy} ${n}`);
      }
  assert.throws(() => simulate({ algorithm: "random" }), RangeError);
});

/* ---------- Lesson data ---------- */

test("four lessons with rail data; the first stays FIFO vs LRU on the original input", () => {
  assert.deepEqual(LESSONS.map((l) => l.id), ["fifo-lru", "opt", "belady", "clock"]);
  for (const lesson of LESSONS) {
    assert.ok(lesson.name && lesson.sub, lesson.id);
    assert.equal(lesson.modes.length, 2, lesson.id);
  }
  assert.deepEqual(byId["fifo-lru"].references, ["A", "B", "C", "A", "D", "A", "B", "E", "A", "B"]);
  assert.deepEqual(byId["fifo-lru"].modes.map((m) => m.algorithm), ["fifo", "lru"]);
  assert.deepEqual(byId.opt.modes.map((m) => m.algorithm), ["opt", "lru"]);
  assert.deepEqual(byId.belady.modes.map((m) => [m.algorithm, m.frameCount]), [["fifo", 3], ["fifo", 4]]);
  assert.deepEqual(byId.clock.modes.map((m) => m.algorithm), ["clock", "lru"]);
});

for (const lesson of LESSONS) {
  test(`${lesson.id}: the full learning model`, () => {
    const runs = runsFor(lesson);
    const extras = extrasFor(lesson);
    const scenes = lesson.milestones(runs);
    const total = lesson.references.length;
    assert.ok(scenes.length >= 3 && scenes.length <= 6);
    assert.equal(scenes[0].index, 0);
    assert.equal(scenes.at(-1).index, total);
    for (const mode of lesson.modes) {
      const run = runs[mode.id];
      // 목표: a question and the goal, no result before it happens.
      const intro = lesson.describe(run.steps[0], run, mode);
      assert.match(intro.title, /\?$/);
      assert.match(intro.goal, /^학습 목표: /);
      assert.doesNotMatch(JSON.stringify(intro), /적중 \d+회|부재 \d+회/);
      // 설명: at most three sentences, a 핵심 on every step.
      for (const step of run.steps) {
        const d = lesson.describe(step, run, mode);
        assert.ok(sentences(d.body) <= 3, `${lesson.id}/${mode.id} ${step.index}: ${d.body}`);
        assert.ok(d.key.length > 10, `${lesson.id}/${mode.id} ${step.index}`);
        assert.ok(d.title.length > 0);
        assert.doesNotMatch(JSON.stringify(d), /undefined|NaN|null/);
      }
      // 예측: every guided prediction sits right after a 핵심 장면, one right answer, a why per option.
      const quizzes = run.steps.map((step) => lesson.predict(step, run, mode)).filter(Boolean);
      assert.ok(quizzes.length >= 1, `${lesson.id}/${mode.id} has predictions`);
      for (const quiz of quizzes) {
        // Lesson 01 (unchanged) also offers a victim prediction at every later replacement.
        if (lesson.id !== "fifo-lru") assert.ok(scenes.some((m) => m.index === quiz.atIndex - 1), `${quiz.id} follows a scene`);
        assert.equal(quiz.choices.filter((c) => c.correct).length, 1, quiz.id);
        for (const c of quiz.choices) assert.ok(c.why && c.why.length > 10, `${quiz.id} ${c.id}`);
        const step = run.steps[quiz.atIndex];
        if (quiz.kind === "victim") {
          assert.equal(quiz.correctId, step.victim, quiz.id);
          // The question and rule do not name the answer; the scene hides its marks.
          assert.doesNotMatch(`${quiz.question} ${quiz.rule}`, new RegExp(`페이지 ${quiz.correctId}\\b|${quiz.correctId}[를을가이]`));
          assert.equal(victimHintsVisible({ nextQuiz: quiz }), false);
        } else {
          const right = quiz.choices.find((c) => c.correct);
          assert.equal(right.label === "적중", step.hit, quiz.id);
          // Two choices share a result, so what is in RAM cannot answer it.
          assert.ok(quiz.choices.filter((c) => c.label === right.label).length >= 2 || quiz.choices.filter((c) => c.label !== right.label).length >= 2);
        }
      }
    }
    // 비교 and 정리.
    assert.ok(lesson.forkText(runs, extras).includes("갈림길"));
    assert.ok(lesson.compareNote(runs, extras).length > 10);
    assert.ok(Number.isInteger(lesson.fork) && lesson.fork >= 0 && lesson.fork < total);
    const recap = lesson.recap(runs, extras);
    assert.ok(recap.points.length >= 2 && recap.points.length <= 3);
    assert.ok(recap.recall.length >= 1 && recap.recall.length <= 2);
    for (const q of recap.recall) {
      assert.equal(q.choices.filter((c) => c.correct).length, 1, q.id);
      for (const c of q.choices) assert.ok(c.why.length > 10, `${q.id} ${c.label}`);
    }
  });
}

test("the numbers quoted in lesson text come from the engine", () => {
  const opt = runsFor(byId.opt);
  assert.match(byId.opt.recap(opt, extrasFor(byId.opt)).points[0], /부재 6회로, LRU 12회의 절반/);
  assert.match(byId.opt.compareNote(opt), /OPT의 부재는 6회, LRU는 12회/);
  assert.match(byId.opt.describe(opt.opt.steps[12], opt.opt, byId.opt.modes[0]).key, /부재 6회 중 4회는 .*강제 부재.*2회뿐/);
  const belady = runsFor(byId.belady);
  const bx = extrasFor(byId.belady);
  assert.deepEqual(bx.lruCounts, [10, 8]);
  assert.match(byId.belady.recap(belady, bx).points.join(" "), /9회에서 10회로 늘었습니다.*10회 → 8회/);
  assert.match(byId.belady.describe(belady.f4.steps[12], belady.f4, byId.belady.modes[1]).key, /부재는 10회로 더 많습니다/);
  assert.match(byId.belady.describe(belady.f3.steps[6], belady.f3, byId.belady.modes[0]).key, /프레임 3개는 부재 6회, 프레임 4개는 4회/);
  const clock = runsFor(byId.clock);
  const cx = extrasFor(byId.clock);
  assert.equal(cx.fifo, 8);
  assert.match(byId.clock.recap(clock, cx).points[2], /클럭 7회 · LRU 7회 · FIFO 8회/);
  assert.match(byId.clock.describe(clock.clock.steps[6], clock.clock, byId.clock.modes[0]).body, /바늘이 B의 참조 비트를 1에서 0으로 끄며/);
  // Clock's prediction at the 6th access: B was swept (second chance), and FIFO would pick it.
  const q6 = byId.clock.predict(clock.clock.steps[6], clock.clock, byId.clock.modes[0]);
  assert.equal(q6.correctId, "C");
  assert.match(q6.choices.find((c) => c.id === "B").why, /두 번째 기회.*FIFO의 기준/);
  const q9 = byId.clock.predict(clock.clock.steps[9], clock.clock, byId.clock.modes[0]);
  assert.equal(q9.correctId, "B");
  assert.match(q9.choices.find((c) => c.id === "A").why, /LRU의 기준/);
  // OPT's victim prediction names LRU's choice as the confusion.
  const q4 = byId.opt.predict(opt.opt.steps[4], opt.opt, byId.opt.modes[0]);
  assert.equal(q4.correctId, "C");
  assert.match(q4.choices.find((c) => c.id === "A").why, /LRU의 기준/);
});

test("terms stay consistent in the new lesson text", () => {
  const src = readFileSync(new URL("../src/lessons.js", import.meta.url), "utf8");
  for (const banned of [/최근 접근/, /최근 사용/, /사용 순/, /마지막 사용/, /오래 사용하지/, /참조되지 않은/, /적재 차례/, /적재 번호/, /적재 순(?!서)/, /벨레이디/, /프레임 F\d/])
    assert.doesNotMatch(src, banned, String(banned));
  assert.match(src, /OSTEP ch\. 22/);
  assert.match(src, /Silberschatz/);
});
