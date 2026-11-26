import test from "node:test";
import assert from "node:assert/strict";
import { PRESETS, queryOf } from "../custom-input.ts";
import { shortestTotal } from "../engine.ts";
import { LESSONS, buildLesson, type Lesson } from "../lessons.ts";

const lessons: Lesson[] = [
  ...LESSONS.filter((l) => l.id !== "custom").map((l) => buildLesson(l.id)),
  ...PRESETS.map((p) => buildLesson("custom", queryOf(p.input))),
];

test("every lesson sets 2–4 misconceptions right, each at a 핵심 장면 of its method", () => {
  for (const lesson of lessons) {
    const items = lesson.misconceptions;
    assert.ok(items.length >= 2 && items.length <= 4, `${lesson.id}: ${items.length}`);
    assert.equal(new Set(items.map((m) => m.id)).size, items.length, `${lesson.id}: unique ids`);
    for (const m of items) {
      const where = `${lesson.id}/${m.id}`;
      for (const text of [m.wrong, m.right, m.check]) assert.ok(text.trim().length > 8, where);
      assert.match(m.right, /[다)]\.$/, `${where}: 합니다체`);
      const algs = m.algorithm ? [m.algorithm] : lesson.algorithms;
      for (const alg of algs) {
        assert.ok(lesson.algorithms.includes(alg), `${where}: ${alg} is in the lesson`);
        const scenes = lesson.scenes[alg];
        assert.ok(
          Number.isInteger(m.scene) && m.scene! >= 1 && m.scene! <= scenes.length,
          `${where}: scene ${m.scene} of ${scenes.length}`,
        );
      }
    }
  }
});

test("lesson 01: the checks quote the runs (passing, the close call, starvation, the optimum)", () => {
  const one = buildLesson("fcfs-sstf");
  const by = Object.fromEntries(one.misconceptions.map((m) => [m.id, m]));
  // FCFS passes 65 and 67 on its first move 53 → 98 without serving them.
  assert.match(by["fcfs-passing"].check, /53 → 98\(45칸\)에서 65·67번/);
  assert.equal(one.scenes.fcfs[by["fcfs-passing"].scene! - 1].n, 1);
  // SSTF turns back by one cylinder: 67 → 37 (30) against 98 (31).
  assert.match(by["sstf-direction"].check, /37번 30칸, 98번 31칸 — 1칸 차이/);
  // 183 waits through the long way back; SSTF 236 against the optimum 208 (= LOOK).
  assert.match(by["sstf-fair"].check, /요청 5개를 처리하는 동안 .* 183번은/);
  const best = shortestTotal(one.input.requests, one.input.head);
  assert.equal(best, 208);
  assert.ok(one.runs.sstf.total > best);
  assert.ok(by["sstf-optimal"].check.includes(`SSTF ${one.runs.sstf.total}칸`));
  assert.ok(by["sstf-optimal"].check.includes(`최소는 ${best}칸`));
  assert.equal(by["sstf-optimal"].scene, one.scenes.sstf.length);
});

test("lessons 02–03: SCAN's edge, LOOK, the C-SCAN return and the totals come from the runs", () => {
  const two = buildLesson("scan-look");
  const by2 = Object.fromEntries(two.misconceptions.map((m) => [m.id, m]));
  assert.match(by2["scan-nearest"].check, /65번\(12칸\).*37번\(16칸\)/);
  assert.match(
    by2["scan-edge"].check,
    /14 → 0 → 65 = 14 \+ 65 = 79칸\. LOOK은 14에서 바로 돌아 51칸/,
  );
  assert.match(
    by2["sweep-longer"].check,
    /SCAN 236칸은 SSTF 236칸과 같고, LOOK 208칸은 SSTF 236칸보다 짧습니다/,
  );
  assert.match(by2["look-starve"].check, /183번은 8번째, 대기 208칸/);

  const three = buildLesson("cscan");
  const by3 = Object.fromEntries(three.misconceptions.map((m) => [m.id, m]));
  assert.match(
    by3["cscan-return"].check,
    /14 → 0 → 199 → 183 = 14 \+ 199 \+ 16 = 229칸\. 복귀 199칸을 빼면 30칸/,
  );
  assert.ok(
    by3["cscan-shorter"].check.includes(
      `${three.runs.cscan.total - three.runs.scan.total}칸 더 움직였습니다`,
    ),
  );
  assert.match(by3["scan-uniform"].check, /202–370칸.*398칸/);
});

test("no misconception check states a result before its 핵심 장면 (01–03)", () => {
  // A check that quotes a total sits on the method's last 핵심 장면.
  for (const id of ["fcfs-sstf", "scan-look", "cscan"]) {
    const lesson = buildLesson(id);
    for (const m of lesson.misconceptions) {
      const alg = m.algorithm!;
      const total = lesson.runs[alg].total;
      if (m.check.includes(`${alg.toUpperCase()} ${total}칸`))
        assert.equal(m.scene, lesson.scenes[alg].length, `${id}/${m.id}`);
    }
  }
});
