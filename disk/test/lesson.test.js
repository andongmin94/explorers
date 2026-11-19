import test from "node:test";
import assert from "node:assert/strict";
import { simulate, look } from "../src/engine.js";
import { josa, lessonAt, milestonesFor, nearerThanChosen, starvationNote, servicePosition, STAGES, MODEL_NOTES, phaseText } from "../src/lesson.js";

const runs = { fcfs: simulate("fcfs"), sstf: simulate("sstf") };

test("josa follows how numbers are read (일 이 삼 사 오 육 칠 팔 구, 십 백)", () => {
  assert.equal(josa(1, "은"), "1은");
  assert.equal(josa(2, "은"), "2는");
  assert.equal(josa(3, "을"), "3을");
  assert.equal(josa(4, "을"), "4를");
  assert.equal(josa(5, "이"), "5가");
  assert.equal(josa(6, "는"), "6은");
  assert.equal(josa(9, "를"), "9를");
  assert.equal(josa(10, "는"), "10은");
  assert.equal(josa(183, "은"), "183은");
  assert.equal(josa(65, "을"), "65를");
  assert.equal(josa(67, "을"), "67을");
  assert.equal(josa("요청 2번", "을"), "요청 2번을");
  assert.equal(josa("사과", "을"), "사과를");
  assert.equal(josa(7, "으로"), "7로");
  assert.equal(josa(3, "로"), "3으로");
});

test("LOOK sweeping toward cylinder 0 first beats SSTF here (208 < 236)", () => {
  const sweep = look(undefined, undefined, "down");
  assert.deepEqual(sweep.order, [37, 14, 65, 67, 98, 122, 124, 183]);
  assert.equal(sweep.total, 208);
  assert.ok(sweep.total < runs.sstf.total);
  assert.equal(look([60, 40], 50, "up").total, 30);
});

test("SSTF milestones point at the 30-vs-31 choice and the 84-cylinder jump back", () => {
  const sstf = milestonesFor("sstf", runs.sstf);
  assert.deepEqual(sstf.map((m) => m.n), [0, 1, 3, 5, 8]);
  assert.match(sstf.find((m) => m.n === 3).label, /^30 vs 31 · 근소한 차이로 반대 방향$/);
  assert.match(sstf.find((m) => m.n === 5).label, /^14 → 98 · 84칸 되돌아가기$/);
  assert.deepEqual(milestonesFor("fcfs", runs.fcfs).map((m) => m.n), [0, 1, 3, 8]);
});

test("starvation is concrete: 183 is served 2nd in FCFS and last in SSTF", () => {
  assert.equal(servicePosition(runs.fcfs, 183), 2);
  assert.equal(servicePosition(runs.sstf, 183), 8);
  assert.match(starvationNote(runs), /FCFS에서 2번째, SSTF에서 8번째\(마지막\)/);
  assert.match(starvationNote(runs), /183은 계속 밀립니다/);
});

test("FCFS text mentions a nearer request only when one existed", () => {
  for (const step of runs.fcfs.steps.slice(1, 8)) {
    const body = lessonAt("fcfs", step.index, step).body;
    const nearer = nearerThanChosen(step);
    const nearest = Math.min(...step.candidates.map((c) => c.distance));
    assert.equal(Boolean(nearer), nearest < step.distance);
    if (nearer) assert.ok(body.includes(`더 가까운 ${nearer.cylinder}번(${nearer.distance}칸)이 있어도`), body);
    else assert.match(body, /가장 가깝기도/);
    assert.match(body, new RegExp(`요청 ${step.request.id}번은`));
  }
});

test("roles and terms: OS picks, controller executes, cylinders throughout", () => {
  assert.match(STAGES[0].label, /OS/);
  assert.match(STAGES[1].label, /실행/);
  const all = [...MODEL_NOTES, ...runs.sstf.steps.slice(1).flatMap((s) => ["select", "controller", "seek", "arrive"].map((k) => phaseText(k, s, "sstf").body))].join(" ");
  assert.doesNotMatch(all, /트랙/);
  assert.match(MODEL_NOTES.join(" "), /1칸 = 실린더 1개 차이/);
  assert.match(MODEL_NOTES.join(" "), /바깥쪽/);
  assert.match(MODEL_NOTES.join(" "), /OSTEP 37장/);
});
