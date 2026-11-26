import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CUSTOM,
  PRESETS,
  burstsFromText,
  customQuery,
  parseCustom,
  processesOf,
  validateCustom,
  type CustomConfig,
} from "../custom.ts";
import { simulate } from "../engine.ts";
import { LESSONS, customLesson, lessonRuns, type Lesson } from "../lessons.ts";
import type { Algorithm } from "../types.ts";

const byId = Object.fromEntries(LESSONS.map((lesson) => [lesson.id, lesson]));

/** Every method (and every quantum for RR): 2–4 misconceptions on real scenes. */
function check(lesson: Lesson, quantum = lesson.quantum ?? 2) {
  const runs = lessonRuns(lesson, quantum);
  const all = [];
  for (const m of lesson.methods) {
    const result = runs[m];
    const scenes = lesson.content.milestones(result).length;
    const items = lesson.content.misconceptions(result, runs);
    const id = `${lesson.id}/${m}/q${quantum}`;
    assert.ok(items.length >= 2 && items.length <= 4, `${id}: ${items.length}`);
    assert.equal(new Set(items.map((x) => x.id)).size, items.length, id);
    for (const item of items) {
      assert.ok(
        Number.isInteger(item.scene) && item.scene! >= 1 && item.scene! <= scenes,
        `${id} ${item.id} scene ${item.scene}/${scenes}`,
      );
      for (const text of [item.wrong, item.right, item.check]) {
        assert.doesNotMatch(text, /undefined|NaN|null|\[object/, `${id} ${item.id}: ${text}`);
        assert.ok(text.length > 15);
      }
      assert.match(item.right, /니다\.$/, `${id} ${item.id} right`);
      assert.match(item.check, /니다\.$/, `${id} ${item.id} check`);
      // Particles after method names and ids follow their reading.
      assert.doesNotMatch(
        item.check + item.right,
        /라운드 로빈가|라운드 로빈는|P1는|P1가|P1를|P2은|P2이|P3은|P3이|FCFS은|SJF은|SRTF은/,
        `${id} ${item.id}`,
      );
    }
    all.push(...items);
  }
  return all;
}

for (const lesson of LESSONS)
  test(`${lesson.id}: misconceptions with their 핵심 장면 for every method`, () => {
    for (const q of lesson.methods.includes("rr") ? [1, 2, 3, 4, 5] : [2]) check(lesson, q);
  });

test("misconception evidence quotes the engine", () => {
  const text = (id: string) =>
    check(byId[id])
      .map((m) => `${m.id}: ${m.check}`)
      .join("\n");
  const rr = text("rr");
  assert.match(rr, /P2는 1 ms에 도착했지만 2 ms에야 처음 CPU를 받았습니다\(최초 응답 1 ms\)/);
  assert.match(rr, /문맥 교환은 라운드 로빈 \d+회, FCFS \d+회/);
  assert.match(rr, /평균 반환 시간은 라운드 로빈 [\d.]+ ms, FCFS [\d.]+ ms/);
  const sjf = text("sjf");
  assert.match(sjf, /SJF가 P1 8 ms · P2 2 ms · P3 5 ms 중 P2를 고를/);
  assert.match(sjf, /P1\(8 ms\) 뒤의 P2는 8 ms, P3는 10 ms를 기다렸습니다/);
  assert.match(sjf, /전체 완료는 FCFS 15 ms, SJF 15 ms/);
  const srtf = text("srtf");
  assert.match(srtf, /P1은 1 ms에 선점될 때 이미 1 ms를 실행했고, 나중에 남은 7 ms만/);
  assert.match(srtf, /2 ms에 도착한 P3\(3 ms\)는 P2의 전체 2 ms보다 길고, 남은 1 ms보다도/);
  assert.match(srtf, /가장 긴 P1의 반환 시간은 SJF 8 ms에서 SRTF 13 ms로 늘었습니다/);
});

test("a misconception never answers a prediction before it is asked", () => {
  // SJF's first pick is explained only under SJF (at its first scene) or in 정리.
  const lesson = byId.sjf;
  const runs = lessonRuns(lesson);
  const scenes = lesson.content.milestones(runs.fcfs).length;
  const item = lesson.content.misconceptions(runs.fcfs, runs).find((m) => m.id === "sjf-real")!;
  assert.equal(item.scene, scenes);
});

/* ---------- 직접 실험 ---------- */

test("custom input: parse, validate and share through the URL", () => {
  assert.deepEqual(parseCustom("?lesson=custom"), { config: DEFAULT_CUSTOM, errors: [] });
  const config: CustomConfig = {
    jobs: [
      { arrival: 0, bursts: [3, 2, 1] },
      { arrival: 5, bursts: [9] },
    ],
    quantum: 4,
    methods: ["srtf", "rr"],
  };
  assert.deepEqual(parseCustom(`?${customQuery(config)}`), { config, errors: [] });
  assert.deepEqual(burstsFromText("5 4 3"), [5, 4, 3]);
  assert.deepEqual(burstsFromText("5→4→3"), [5, 4, 3]);
  assert.ok(Number.isNaN(burstsFromText("5 x")[1]));
  assert.deepEqual(processesOf(config)[0], {
    id: "P1",
    name: "작업 1",
    arrival: 0,
    cpu: [3, 1],
    io: [2],
  });
  const errors = (
    jobs: { arrival: number; bursts: number[] }[],
    quantum = 2,
    methods = ["rr", "fcfs"],
  ) => validateCustom({ jobs, quantum, methods }).all;
  assert.deepEqual(errors([{ arrival: 0, bursts: [1] }]), []);
  assert.match(errors([])[0], /1개부터 5개까지/);
  assert.match(
    errors(Array.from({ length: 6 }, () => ({ arrival: 0, bursts: [1] })))[0],
    /5개까지/,
  );
  assert.match(errors([{ arrival: 21, bursts: [1] }])[0], /P1의 도착 시각은 0부터 20까지/);
  assert.match(errors([{ arrival: 0, bursts: [] }])[0], /P1의 CPU 구간을 하나 이상/);
  assert.match(errors([{ arrival: 0, bursts: [0] }])[0], /1부터 9까지의 정수/);
  assert.match(errors([{ arrival: 0, bursts: [2, 3] }])[0], /P1은 CPU 구간으로 끝나야/);
  assert.match(
    errors([
      { arrival: 0, bursts: [1, 1] },
      { arrival: 0, bursts: [2, 3] },
    ])[0],
    /P1은/,
  );
  assert.match(
    errors([
      { arrival: 0, bursts: [1] },
      { arrival: 0, bursts: [2, 3] },
    ])[0],
    /P2는 CPU/,
  );
  assert.match(errors([{ arrival: 0, bursts: [1, 1, 1, 1, 1, 1, 1] }])[0], /5개까지입니다/);
  assert.match(errors([{ arrival: 0, bursts: [1] }], 0)[0], /할당량은 1부터 5 ms/);
  assert.match(errors([{ arrival: 0, bursts: [1] }], 2, ["rr", "rr"])[0], /두 방식이 같습니다/);
  const broken = parseCustom("?lesson=custom&jobs=0:2-3,x:1&q=9&methods=rr,rr");
  assert.deepEqual(broken.config, DEFAULT_CUSTOM);
  assert.ok(broken.errors.length >= 3);
  for (const preset of PRESETS) assert.deepEqual(validateCustom(preset.config).all, [], preset.id);
});

/** Inputs from the presets plus a sweep of small job sets. */
function* inputs(): Generator<CustomConfig> {
  const methods: Algorithm[] = ["rr", "fcfs", "sjf", "srtf"];
  const jobSets: CustomConfig["jobs"][] = [
    ...PRESETS.map((p) => p.config.jobs),
    DEFAULT_CUSTOM.jobs,
    [{ arrival: 0, bursts: [1] }],
    [{ arrival: 3, bursts: [2] }],
    [
      { arrival: 2, bursts: [1, 9, 1] },
      { arrival: 9, bursts: [3] },
    ],
    [
      { arrival: 0, bursts: [4] },
      { arrival: 0, bursts: [4] },
      { arrival: 0, bursts: [4] },
      { arrival: 0, bursts: [4] },
      { arrival: 0, bursts: [4] },
    ],
    [
      { arrival: 0, bursts: [9, 1, 9] },
      { arrival: 1, bursts: [1, 9, 1] },
      { arrival: 2, bursts: [2, 2, 2, 2, 2] },
      { arrival: 6, bursts: [3] },
      { arrival: 20, bursts: [1] },
    ],
  ];
  for (const jobs of jobSets)
    for (const a of methods)
      for (const b of methods)
        if (a !== b) for (const quantum of [1, 3, 5]) yield { jobs, quantum, methods: [a, b] };
}

test("custom lesson: the generic text holds for any input", () => {
  let count = 0;
  for (const config of inputs()) {
    const lesson = customLesson(config);
    const runs = lessonRuns(lesson, config.quantum);
    const c = lesson.content;
    const id = JSON.stringify(config);
    for (const m of lesson.methods) {
      const result = runs[m];
      assert.deepEqual(
        result,
        simulate({ algorithm: m, quantum: config.quantum, processes: lesson.processes }),
      );
      const scenes = c.milestones(result);
      assert.ok(scenes.length >= 2 && scenes.length <= 6, `${id} ${m}: ${scenes.length}`);
      assert.equal(scenes[0].time, 0);
      assert.equal(scenes.at(-1)!.time, result.stats.makespan);
      const intro = c.intro(result);
      assert.doesNotMatch(JSON.stringify(intro), /undefined|NaN|null/, id);
      for (const frame of result.frames) {
        const chapter = c.chapter(frame, result);
        const notes = c.stepNotes(frame, result);
        assert.doesNotMatch(
          JSON.stringify([chapter, notes]),
          /undefined|NaN|null/,
          `${id} ${m}@${frame.t}`,
        );
        assert.match(chapter.eyebrow, new RegExp(`핵심 장면 \\d/${scenes.length}`));
      }
      for (const decision of result.decisions.filter((d) => d.candidates.length > 1)) {
        const p = c.prediction(result, decision.time - 1)!;
        assert.equal(p.choices.filter((x) => x.correct).length, 1, id);
        for (const choice of p.choices)
          assert.doesNotMatch(
            choice.why,
            /undefined|NaN|null/,
            `${id} ${m}@${decision.time} ${choice.id}`,
          );
      }
      const points = c.recapPoints(result, runs);
      assert.ok(points.length >= 2 && points.length <= 3);
      check(lesson, config.quantum);
    }
    const all = JSON.stringify([
      c.recall(runs),
      c.compare(runs, { quantum: config.quantum, processes: lesson.processes }),
      c.rules,
    ]);
    assert.doesNotMatch(all, /undefined|NaN|null|\[object/, id);
    for (const q of c.recall(runs))
      assert.equal(q.choices.filter((x) => x.correct).length, 1, `${id} ${q.id}`);
    count++;
  }
  assert.ok(count > 100, String(count));
});
