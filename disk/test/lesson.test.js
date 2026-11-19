import test from "node:test";
import assert from "node:assert/strict";
import { simulate, look, scan } from "../src/engine.js";
import { guidedStops, compareNote, predictionFor, recapFor, takeawayAt, RECALL_TOTAL, josa, lessonAt, milestonesFor, nearerThanChosen, starvationNote, servicePosition, STAGES, MODEL_NOTES, phaseText } from "../src/lesson.js";

const runs = { fcfs: simulate("fcfs"), sstf: simulate("sstf") };

test("shared josa follows how numbers are read (일 이 삼 사 오 육 칠 팔 구, 십 백)", () => {
  assert.equal(josa(1, "은/는"), "1은");
  assert.equal(josa(2, "은/는"), "2는");
  assert.equal(josa(3, "을/를"), "3을");
  assert.equal(josa(4, "을/를"), "4를");
  assert.equal(josa(5, "이/가"), "5가");
  assert.equal(josa(6, "은/는"), "6은");
  assert.equal(josa(9, "을/를"), "9를");
  assert.equal(josa(10, "은/는"), "10은");
  assert.equal(josa(183, "은/는"), "183은");
  assert.equal(josa(65, "을/를"), "65를");
  assert.equal(josa(67, "을/를"), "67을");
  assert.equal(josa("요청 2번", "을/를"), "요청 2번을");
  assert.equal(josa("사과", "을/를"), "사과를");
  assert.equal(josa(7, "으로"), "7로");
  assert.equal(josa(3, "으로"), "3으로");
  assert.equal(josa("CYL", "으로"), "CYL로");
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

const sweep = look(undefined, undefined, "down");
const scanTotal = scan(undefined, undefined, "down").total;
const N = runs.fcfs.steps.length - 1;
const RESULT = /640|236|208|8번째|마지막|합계|최소/;

test("SCAN to cylinder 0 travels 236 (= SSTF); LOOK turns at 14 for 208; LOOK up-first is 299", () => {
  assert.equal(scanTotal, 236);
  assert.equal(scan([60, 40], 50, "up").total, 10 + 139 + 159);
  assert.equal(look(undefined, undefined, "up").total, 299);
  const note = compareNote(runs, sweep, scanTotal);
  assert.ok(note.includes("LOOK은 208칸(0까지 가는 SCAN은 236칸)"), note);
  assert.match(note, /기아를 막는/);
  assert.ok(!note.includes("다음 방식인 SCAN/LOOK"), note);
  assert.match(recapFor("sstf", runs, sweep, scanTotal).points.join(" "), /SCAN은 236칸/);
});

test("no spoiler before playback: the start screen and its 핵심 note state no result", () => {
  for (const algorithm of ["fcfs", "sstf"]) {
    const l = lessonAt(algorithm, 0, runs[algorithm].steps[0]);
    assert.equal(l.title, "어떤 순서가 덜 움직일까?");
    assert.match(l.goal, /^학습 목표: /);
    assert.doesNotMatch([l.body, l.goal, takeawayAt(algorithm, 0, runs)].join(" "), RESULT);
    assert.doesNotMatch(takeawayAt(algorithm, 0, runs), /183/);
  }
  // Totals and the starvation result wait for the last request.
  for (let i = 1; i < N; i++) assert.doesNotMatch(takeawayAt("sstf", i, runs), /합계|8번째|236/);
  assert.match(takeawayAt("sstf", N, runs), /SSTF 합계 236칸.*8번째[(]마지막[)]/);
  assert.match(takeawayAt("fcfs", N, runs), /FCFS 합계 640칸/);
});

test("the 핵심 note changes from step to step", () => {
  for (const algorithm of ["fcfs", "sstf"]) {
    const notes = runs[algorithm].steps.map((s) => takeawayAt(algorithm, s.index, runs));
    for (let i = 1; i < notes.length; i++) assert.notEqual(notes[i], notes[i - 1], `${algorithm} ${i}`);
  }
  assert.match(takeawayAt("sstf", 3, runs), /30칸 대 31칸/);
  assert.match(takeawayAt("sstf", 5, runs), /84칸/);
  assert.match(takeawayAt("sstf", 7, runs), /남은 요청은 가장 먼 183번뿐/);
  assert.match(takeawayAt("fcfs", 2, runs), /183번도 도착 순서대로 2번째/);
});

test("every prediction choice carries its own why; FCFS asks the move length, SSTF the cylinder", () => {
  for (const algorithm of ["fcfs", "sstf"]) {
    const run = runs[algorithm];
    for (let i = 1; i <= N; i++) {
      const { choices, prompt } = predictionFor(algorithm, run, i);
      const step = run.steps[i];
      assert.equal(choices.filter((c) => c.correct).length, 1);
      const right = choices.find((c) => c.correct);
      if (algorithm === "fcfs") {
        assert.equal(right.label, `${step.distance}칸`);
        assert.doesNotMatch(choices.map((c) => c.label).join(" "), /요청/);
        assert.match(prompt, /대기 큐[(]도착 순서[)]/);
      } else {
        assert.equal(right.label, String(step.request.cylinder));
        assert.equal(choices.length, step.before.pending.length);
      }
      const nums = choices.map((c) => parseInt(c.label, 10));
      assert.deepEqual(nums, nums.slice().sort((a, b) => a - b));
      for (const c of choices) assert.ok(c.why && c.why.length > 10, `${algorithm} step ${i} ${c.label}`);
      assert.equal(new Set(choices.map((c) => c.why)).size, choices.length, `${algorithm} step ${i}: whys differ`);
    }
  }
  const f1 = predictionFor("fcfs", runs.fcfs, 1).choices;
  assert.match(f1.find((c) => c.label === "12칸").why, /가장 가까운 65번.*SSTF의 기준/);
  assert.match(f1.find((c) => c.label === "45칸").why, /큐 맨 앞의 98번으로 갑니다: [|]98 − 53[|] = 45칸/);
  const s1 = predictionFor("sstf", runs.sstf, 1).choices;
  assert.match(s1.find((c) => c.label === "98").why, /먼저 도착한 요청을 고르는 것은 FCFS/);
  const s3 = predictionFor("sstf", runs.sstf, 3).choices;
  assert.ok(s3.find((c) => c.label === "98").why.includes("진행 방향을 유지하는 것은 SCAN/LOOK"));
  assert.match(s3.find((c) => c.label === "37").why, /30칸.*98번[(]31칸[)]과는 1칸 차이/);
});

test("guided stops are the 핵심 장면; previews of unreached scenes give no result", () => {
  const sstf = milestonesFor("sstf", runs.sstf);
  for (const m of sstf) assert.ok(m.preview);
  assert.deepEqual(guidedStops("sstf", runs.sstf), [1, 3, 5, 8]);
  assert.deepEqual(guidedStops("fcfs", runs.fcfs), [1, 3, 8]);
  for (const algorithm of ["fcfs", "sstf"])
    assert.deepEqual(guidedStops(algorithm, runs[algorithm]), milestonesFor(algorithm, runs[algorithm]).map((m) => m.n).filter((n) => n > 0));
  assert.doesNotMatch(sstf.map((m) => m.preview).join(" "), /30 vs 31|84칸|→/);
});

test("recap: 2–3 points, 1–2 recall questions, every choice has why and one is correct", () => {
  let total = 0;
  for (const algorithm of ["fcfs", "sstf"]) {
    const r = recapFor(algorithm, runs, sweep, scanTotal);
    assert.ok(r.points.length >= 2 && r.points.length <= 3);
    assert.ok(r.recall.length >= 1 && r.recall.length <= 2);
    total += r.recall.length;
    for (const q of r.recall) {
      assert.equal(q.choices.filter((c) => c.correct).length, 1, q.id);
      for (const c of q.choices) assert.ok(c.why, `${q.id} ${c.label}`);
    }
  }
  assert.equal(total, RECALL_TOTAL);
  assert.doesNotMatch(recapFor("fcfs", runs, sweep, scanTotal).points.join(" "), /236/);
});
