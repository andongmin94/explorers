// The disk explorer's lessons: rail data ({ id, name, sub }) plus, via
// buildLesson(id), one uniform object main.js plays. Pure (no DOM).
//   01 FCFS vs SSTF (lesson.js)   02 SCAN vs LOOK   03 C-SCAN vs SCAN (lesson-sweep.js)
import { simulate, look, scan, REQUESTS, INITIAL_HEAD } from "./engine.js";
import * as one from "./lesson.js";
import { sweepLesson } from "./lesson-sweep.js";

export const LESSONS = [
  { id: "fcfs-sstf", name: "FCFS와 SSTF", sub: "도착 순서 · 가까운 순서" },
  { id: "scan-look", name: "SCAN과 LOOK", sub: "엘리베이터 · 끝까지 갈까" },
  { id: "cscan", name: "C-SCAN과 SCAN", sub: "한 방향 순환 · 고른 대기" },
];

export function buildLesson(id) {
  const meta = LESSONS.find((l) => l.id === id) ?? LESSONS[0];
  const number = String(LESSONS.indexOf(meta) + 1).padStart(2, "0");
  if (meta.id === "fcfs-sstf") {
    const runs = { fcfs: simulate("fcfs"), sstf: simulate("sstf") };
    const sweep = look(REQUESTS, INITIAL_HEAD, "down");
    const scanTotal = scan(REQUESTS, INITIAL_HEAD, "down").total;
    return finish(meta, number, runs, {
      algorithms: ["fcfs", "sstf"],
      names: one.NAMES,
      ruleShort: one.RULE_SHORT,
      milestonesFor: (alg) => one.milestonesFor(alg, runs[alg]),
      lessonAt: (alg, i) => one.lessonAt(alg, i, runs[alg].steps[i]),
      takeawayAt: (alg, i) => one.takeawayAt(alg, i, runs),
      phaseText: one.phaseText,
      predictionFor: (alg, i) => one.predictionFor(alg, runs[alg], i),
      compareStory: one.COMPARE_STORY,
      compareExtra: (alg) => `183번은 ${one.servicePosition(runs[alg], 183)}번째로 처리됩니다.`,
      compareNote: () => one.compareNote(runs, sweep, scanTotal),
      recapFor: (alg) => one.recapFor(alg, runs, sweep, scanTotal),
      recallTotal: one.RECALL_TOTAL,
      notes: one.MODEL_NOTES,
      distanceHint: (alg) => (alg === "fcfs" ? "FCFS는 거리가 아니라 도착 순서로 선택" : "SSTF는 이 거리 중 최솟값을 선택 · 직접 계산한 뒤 맞혀보세요"),
      worstWait: null,
      waits: false,
    });
  }
  const pair = meta.id === "scan-look" ? ["scan", "look"] : ["scan", "cscan"];
  const runs = Object.fromEntries(pair.map((alg) => [alg, simulate(alg, REQUESTS, INITIAL_HEAD, { direction: "down" })]));
  return finish(meta, number, runs, { ...sweepLesson(meta.id, runs), waits: true });
}

function finish(meta, number, runs, api) {
  const scenes = Object.fromEntries(api.algorithms.map((alg) => [alg, api.milestonesFor(alg)]));
  const stops = Object.fromEntries(api.algorithms.map((alg) => [alg, scenes[alg].map((m) => m.n).filter((n) => n > 0)]));
  return {
    ...meta,
    number,
    runs,
    scenes,
    stops,
    totals: { scenes: api.algorithms.reduce((n, alg) => n + scenes[alg].length, 0), recall: api.recallTotal },
    ...api,
  };
}
