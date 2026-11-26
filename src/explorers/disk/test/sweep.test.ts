import test from "node:test";
import assert from "node:assert/strict";
import { simulate, pick, pathLength, routePoints, worstWait, REQUESTS } from "../engine.ts";
import { LESSONS, buildLesson } from "../lessons.ts";
import type { SimulateOptions } from "../types.ts";

const run = (alg: string, opts?: SimulateOptions) =>
  simulate(alg, REQUESTS, 53, { direction: "down", ...opts });

test("SCAN (toward 0) runs to the edge: 236, turning step 14 → 0 → 65 = 79", () => {
  const r = run("scan");
  assert.deepEqual(r.order, [37, 14, 65, 67, 98, 122, 124, 183]);
  assert.equal(r.total, 236);
  assert.deepEqual(r.steps[3].path, [14, 0, 65]);
  assert.equal(r.steps[3].distance, 79);
  assert.deepEqual(
    r.steps.slice(1).map((s) => s.distance),
    [16, 23, 79, 2, 31, 24, 2, 59],
  );
  assert.equal(r.steps[3].state.direction, "up");
});

test("LOOK turns at the last request: 208, 14 → 65 = 51; SCAN − LOOK = 28 = 14 → 0 → 14", () => {
  const r = run("look");
  assert.equal(r.total, 208);
  assert.deepEqual(r.steps[3].path, [14, 65]);
  assert.equal(r.steps[3].distance, 51);
  assert.equal(run("scan").total - r.total, 2 * 14);
});

test("C-SCAN (toward 0) returns 0 → 199 and sweeps down again: 386 with the return, 187 without", () => {
  const r = run("cscan");
  assert.deepEqual(r.order, [37, 14, 183, 124, 122, 98, 67, 65]);
  assert.deepEqual(r.steps[3].path, [14, 0, 199, 183]);
  assert.equal(r.steps[3].jump, 1);
  assert.equal(r.steps[3].distance, 14 + 199 + 16);
  assert.equal(r.total, 386);
  assert.equal(run("cscan", { countReturn: false }).total, 187);
  for (const s of r.steps) assert.equal(s.state.direction, "down");
  // Waits = head travel until served.
  assert.deepEqual(
    r.waits.map((w) => w.wait),
    [16, 39, 268, 327, 329, 353, 384, 386],
  );
  assert.deepEqual(
    run("scan").waits.map((w) => w.wait),
    [16, 39, 118, 120, 151, 175, 177, 236],
  );
});

test("sweep edge cases: start at the edge, nothing on the start side, ties by arrival", () => {
  assert.deepEqual(simulate("scan", [40, 60], 0, { direction: "down" }).steps[1].path, [0, 40]);
  assert.equal(simulate("scan", [60, 40], 50, { direction: "up" }).total, 10 + 139 + 159);
  assert.deepEqual(simulate("cscan", [10], 0, { direction: "down" }).steps[1].path, [0, 199, 10]);
  assert.equal(
    pick(
      "look",
      [
        { id: 1, cylinder: 40 },
        { id: 2, cylinder: 60 },
      ],
      50,
      "up",
    )!.request.id,
    2,
  );
  assert.equal(
    pick(
      "sstf",
      [
        { id: 2, cylinder: 60 },
        { id: 1, cylinder: 40 },
      ],
      50,
    )!.request.id,
    1,
  );
  assert.equal(pathLength([14, 0, 199, 183], { jump: 1, countReturn: false }), 30);
  assert.throws(() => simulate("nope"), RangeError);
});

test("FCFS/SSTF keep their numbers and gain a straight path", () => {
  assert.equal(simulate("fcfs").total, 640);
  assert.equal(simulate("sstf").total, 236);
  for (const s of simulate("sstf").steps.slice(1)) assert.deepEqual(s.via, []);
});

test("route points place edges inside a step, spaced by distance", () => {
  const pts = routePoints(run("scan").steps);
  assert.deepEqual(pts.slice(0, 3), [
    [53, 0],
    [37, 1],
    [14, 2],
  ]);
  assert.equal(pts[3][0], 0);
  assert.ok(Math.abs(pts[3][1] - (2 + 14 / 79)) < 1e-9);
  assert.deepEqual(pts[4], [65, 3]);
  assert.equal(routePoints(simulate("fcfs").steps).length, 9);
});

test("worst wait under a steady stream: SCAN depends on the position, C-SCAN does not", () => {
  const scanW = REQUESTS.map((c) => worstWait("scan", c));
  assert.deepEqual(scanW, [202, 366, 324, 244, 370, 248, 268, 264]);
  assert.equal(Math.min(...scanW), 202);
  assert.equal(Math.max(...scanW), 370);
  for (const c of [0, 14, 100, 199]) assert.equal(worstWait("cscan", c), 398);
  assert.equal(worstWait("cscan", 50, { countReturn: false }), 199);
});

test("lessons: three scenarios then 직접 실험; the first is FCFS vs SSTF with its old progress totals", () => {
  assert.deepEqual(
    LESSONS.map((l) => l.id),
    ["fcfs-sstf", "scan-look", "cscan", "custom"],
  );
  const one = buildLesson("fcfs-sstf");
  assert.deepEqual(one.totals, { scenes: 9, recall: 3 });
  assert.equal(buildLesson("nope").id, "fcfs-sstf");
  assert.deepEqual(buildLesson("scan-look").algorithms, ["scan", "look"]);
  assert.deepEqual(buildLesson("cscan").algorithms, ["scan", "cscan"]);
});

const RESULT = /236|208|386|187|398|370|202|합계|최악|79칸|51칸|229/;

for (const id of ["scan-look", "cscan"]) {
  const L = buildLesson(id);
  const N = 8;
  test(`${id}: 3–6 핵심 장면, previews give nothing away, stops = scenes`, () => {
    for (const alg of L.algorithms) {
      const sc = L.scenes[alg];
      assert.ok(sc.length >= 3 && sc.length <= 6);
      assert.deepEqual(
        L.stops[alg],
        sc.map((m) => m.n).filter((n) => n > 0),
      );
      for (const m of sc.filter((m) => m.n > 0))
        assert.doesNotMatch(m.preview, /→|칸|\d{2,}/, m.preview);
    }
  });
  test(`${id}: start screen is a question with a goal and no result`, () => {
    for (const alg of L.algorithms) {
      const s = L.lessonAt(alg, 0);
      assert.match(s.title, /\?$/);
      assert.match(s.goal!, /^학습 목표: /);
      assert.doesNotMatch([s.body, L.takeawayAt(alg, 0)].join(" "), RESULT);
    }
  });
  test(`${id}: the 핵심 note changes per step and names no total before the end`, () => {
    for (const alg of L.algorithms) {
      const notes = Array.from({ length: N + 1 }, (_, i) => L.takeawayAt(alg, i));
      for (let i = 1; i <= N; i++) assert.notEqual(notes[i], notes[i - 1], `${alg} ${i}`);
      for (let i = 0; i < N; i++) assert.doesNotMatch(notes[i], /합계/);
      assert.match(notes[N], new RegExp(`합계 ${L.runs[alg].total}칸`));
      // The note before the turn gives the rule, not the move.
      assert.doesNotMatch(notes[2], /79|51|229|199로/);
    }
  });
  test(`${id}: predictions — one correct answer, a distinct why per option`, () => {
    for (const alg of L.algorithms) {
      for (let i = 1; i <= N; i++) {
        const p = L.predictionFor(alg, i);
        assert.equal(p.choices.filter((c) => c.correct).length, 1, `${alg} ${i}`);
        assert.equal(
          new Set(p.choices.map((c) => c.why)).size,
          p.choices.length,
          `${alg} ${i} whys`,
        );
        for (const c of p.choices) assert.ok(c.why.length > 10);
        // The prompt does not carry the answer.
        const right = p.choices.find((c) => c.correct)!;
        if (right.label.endsWith("칸")) assert.ok(!p.prompt.includes(right.label));
        const step = L.runs[alg].steps[i];
        if (!right.label.endsWith("칸")) assert.equal(right.label, String(step.request!.cylinder));
      }
    }
  });
  test(`${id}: comparison and 정리 (2–3 points, 1–2 recall, every choice has why)`, () => {
    assert.ok(L.compareNote().includes("갈림길은 14번 다음"));
    for (const alg of L.algorithms) {
      const r = L.recapFor(alg);
      assert.ok(r.points.length >= 2 && r.points.length <= 3);
      assert.ok(r.recall.length >= 1 && r.recall.length <= 2);
      for (const q of r.recall) {
        assert.equal(q.choices.filter((c) => c.correct).length, 1);
        for (const c of q.choices) assert.ok(c.why);
      }
    }
    assert.ok(
      L.notes.some((n) => /OSTEP 37\.5/.test(n) && /Silberschatz/.test(n) && /11\.2/.test(n)),
    );
  });
}

test("scan-look: the turn asks for the move length — 79 for SCAN, 51 for LOOK", () => {
  const L = buildLesson("scan-look");
  assert.equal(L.predictionFor("scan", 3).choices.find((c) => c.correct)!.label, "79칸");
  assert.equal(L.predictionFor("look", 3).choices.find((c) => c.correct)!.label, "51칸");
  assert.match(L.predictionFor("scan", 3).choices.find((c) => c.label === "51칸")!.why, /LOOK/);
  assert.match(L.predictionFor("scan", 1).choices.find((c) => c.label === "65")!.why, /SSTF/);
  assert.match(L.compareNote(), /79칸.*51칸.*28칸/);
  const q = L.recapFor("scan").recall.find((x) => x.id === "scan-total")!;
  assert.equal(q.choices.find((c) => c.correct)!.label, "130칸");
  assert.equal(simulate("scan", [30, 80], 50, { direction: "down" }).total, 130);
  assert.equal(simulate("look", [30, 80], 50, { direction: "down" }).total, 70);
});

test("cscan: the return is counted and said so; the turn's SCAN choice is named", () => {
  const L = buildLesson("cscan");
  assert.ok(L.notes.some((n) => /복귀.*199칸.*넣어 셉니다/.test(n) && /187칸/.test(n)));
  const p = L.predictionFor("cscan", 3);
  assert.equal(p.choices.find((c) => c.correct)!.label, "183");
  assert.match(p.choices.find((c) => c.label === "65")!.why, /SCAN입니다/);
  assert.match(L.compareExtra("cscan"), /16–386칸.*398칸/);
  assert.match(L.compareExtra("scan"), /16–236칸.*202–370칸/);
  assert.match(L.compareNote(), /150칸 더/);
});
