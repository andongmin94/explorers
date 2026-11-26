// The disk explorer's lessons: rail data ({ id, name, sub }) plus, via
// buildLesson(id), one uniform object the page plays. Pure (no DOM).
// (Port of disk/src/lessons.js.)
//   01 FCFS vs SSTF (lesson.ts)   02 SCAN vs LOOK   03 C-SCAN vs SCAN (lesson-sweep.ts)
//   04 직접 실험: the learner's input and two methods (lesson-custom.ts, custom-input.ts)
import { LABELS } from "@/lib/lesson-kit.ts";
import { DEFAULT_INPUT, readInput, type CustomInput } from "./custom-input.ts";
import { INITIAL_HEAD, look, MAX_CYLINDER, REQUESTS, scan, simulate } from "./engine.ts";
import * as one from "./lesson.ts";
import { customLesson } from "./lesson-custom.ts";
import { sweepLesson } from "./lesson-sweep.ts";
import { fcfsSstfMisconceptions, sweepMisconceptions } from "./misconceptions.ts";
import type { Algorithm, DiskInput, LessonApi, Milestone, Run } from "./types.ts";

export interface LessonMeta {
  id: "fcfs-sstf" | "scan-look" | "cscan" | "custom";
  name: string;
  sub: string;
}

export const LESSONS: LessonMeta[] = [
  { id: "fcfs-sstf", name: "FCFS와 SSTF", sub: "도착 순서 · 가까운 순서" },
  { id: "scan-look", name: "SCAN과 LOOK", sub: "엘리베이터 · 끝까지 갈까" },
  { id: "cscan", name: "C-SCAN과 SCAN", sub: "한 방향 순환 · 고른 대기" },
  { id: "custom", name: LABELS.custom, sub: "내 요청 큐로 두 방식 비교" },
];

export interface Lesson extends LessonMeta, LessonApi {
  number: string;
  /** The batch both methods serve. */
  input: DiskInput;
  /** 직접 실험 only: the learner's input (with the two methods) and why the URL's was not used. */
  custom: CustomInput | null;
  problem: string | null;
  runs: Record<string, Run>;
  scenes: Record<string, Milestone[]>;
  stops: Record<string, number[]>;
  totals: { scenes: number; recall: number };
}

const TEXTBOOK = (direction: DiskInput["direction"]): DiskInput => ({
  requests: [...REQUESTS],
  head: INITIAL_HEAD,
  max: MAX_CYLINDER,
  direction,
});

/** The lesson `id`; 직접 실험 reads its input from `search` (the URL query). */
export function buildLesson(
  id: string,
  search: string = globalThis.location?.search ?? "",
): Lesson {
  const meta = LESSONS.find((l) => l.id === id) ?? LESSONS[0];
  const number = String(LESSONS.indexOf(meta) + 1).padStart(2, "0");
  if (meta.id === "custom") {
    const { input, problem } = search ? readInput(search) : { input: DEFAULT_INPUT, problem: null };
    const runs: Record<string, Run> = Object.fromEntries(
      input.pair.map((alg) => [
        alg,
        simulate(alg, input.requests, input.head, { direction: input.direction, max: input.max }),
      ]),
    );
    return finish(
      meta,
      number,
      runs,
      input,
      {
        ...customLesson(input, input.pair, runs),
        waits: true,
      },
      { custom: input, problem },
    );
  }
  if (meta.id === "fcfs-sstf") {
    const input = TEXTBOOK("down");
    const runs: Record<string, Run> = { fcfs: simulate("fcfs"), sstf: simulate("sstf") };
    const sweep = look(REQUESTS, INITIAL_HEAD, "down");
    const scanTotal = scan(REQUESTS, INITIAL_HEAD, "down").total;
    const milestonesFor = (alg: Algorithm) => one.milestonesFor(alg, runs[alg]);
    return finish(meta, number, runs, input, {
      algorithms: ["fcfs", "sstf"],
      names: one.NAMES,
      ruleShort: one.RULE_SHORT,
      milestonesFor,
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
      distanceHint: (alg) =>
        alg === "fcfs"
          ? "FCFS는 거리가 아니라 도착 순서로 선택"
          : "SSTF는 이 거리 중 최솟값을 선택 · 직접 계산한 뒤 맞혀보세요",
      worstWait: null,
      waits: false,
      misconceptions: fcfsSstfMisconceptions(input, runs, milestonesFor),
    });
  }
  const kind = meta.id;
  const input = TEXTBOOK("down");
  const pair: Algorithm[] = kind === "scan-look" ? ["scan", "look"] : ["scan", "cscan"];
  const runs: Record<string, Run> = Object.fromEntries(
    pair.map((alg) => [alg, simulate(alg, input.requests, input.head, { direction: "down" })]),
  );
  const sweep = sweepLesson(kind, runs);
  return finish(meta, number, runs, input, {
    ...sweep,
    waits: true,
    misconceptions: sweepMisconceptions(kind, input, runs, sweep.milestonesFor),
  });
}

function finish(
  meta: LessonMeta,
  number: string,
  runs: Record<string, Run>,
  input: DiskInput,
  api: LessonApi,
  extra: { custom: CustomInput | null; problem: string | null } = { custom: null, problem: null },
): Lesson {
  const scenes = Object.fromEntries(api.algorithms.map((alg) => [alg, api.milestonesFor(alg)]));
  const stops = Object.fromEntries(
    api.algorithms.map((alg) => [alg, scenes[alg].map((m) => m.n).filter((n) => n > 0)]),
  );
  return {
    ...meta,
    number,
    input,
    ...extra,
    runs,
    scenes,
    stops,
    totals: {
      scenes: api.algorithms.reduce((n, alg) => n + scenes[alg].length, 0),
      recall: api.recallTotal,
    },
    ...api,
  };
}
