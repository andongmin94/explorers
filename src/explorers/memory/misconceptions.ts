// 오개념 바로잡기 for the memory lessons (docs/DESIGN.md → Learning model):
// a belief learners commonly hold, what is actually true, and the evidence in
// this very run. Every number in `check` is read from the runs, so the text
// follows the engine. `scene` is the 1-based 핵심 장면 at which the 해설 shows
// it (the same scene list for both conditions of a lesson).
//
// Sources: OSTEP ch. 21 (page faults are handled, not errors), ch. 22 (22.2
// the three Cs, 22.4 OPT, 22.6 workloads, 22.8 clock and the use bit),
// Silberschatz 10.4 (FIFO, Belady's anomaly, stack algorithms, second chance).
import type { Misconception } from "@/lib/lesson-kit.ts";
import { eul, eun, ga, josa } from "@/lib/josa.ts";
import { simulate } from "./engine.ts";
import { countFaults } from "./policies.ts";
import type { Extras, Run, Runs, Step } from "./types.ts";

const cold = (run: Run, upTo = run.references.length) =>
  run.steps.slice(1, upTo + 1).filter((step) => step.compulsory).length;
const resident = (step: Step) =>
  step.frames.map((frame) => frame.page).filter((page): page is string => page !== null);
const list = (pages: string[]) => pages.join("·") || "없음";

/** The page fault is not an error (every lesson can show it at its first fault). */
export function faultIsNoError(run: Run, scene: number, name: string): Misconception {
  const first = run.steps[1];
  return {
    id: "fault-error",
    wrong: "페이지 부재는 프로그램이 잘못돼 생기는 오류다.",
    right:
      "페이지 부재는 요청한 페이지가 지금 RAM에 없다는 신호입니다. 운영체제가 저장장치에서 페이지를 읽어 오고, CPU가 같은 접근을 다시 시도해 프로그램은 그대로 이어집니다.",
    check: `1번째 ${eun(first.page)} 부재였지만 프레임 ${first.frameIndex}에 적재된 뒤 접근이 완료됐습니다. ${name}의 부재 ${run.stats.faults}회는 모두 이렇게 처리됐고, 그중 ${cold(run)}회는 처음 참조한 강제 부재입니다.`,
    scene,
  };
}

/** Lesson 01 · FIFO와 LRU (scenes: 0, 1, 4, 5, 6, 10). */
export function fifoLru(runs: Runs): Misconception[] {
  const { fifo, lru } = runs;
  const atFull = fifo.steps.find((step) => resident(step).length === fifo.frameCount)!;
  const fork = fifo.steps.find((step) => step.victim !== null)!;
  const after = fifo.steps[fork.index + 1];
  const lruAfter = lru.steps[fork.index + 1];
  const loop = ["A", "B", "C", "D", "A", "B", "C", "D"];
  const loopFaults = (policy: "fifo" | "lru") => countFaults(loop, fifo.frameCount, policy).faults;
  return [
    faultIsNoError(fifo, 2, "FIFO"),
    {
      id: "fault-replace",
      wrong: "페이지 부재가 나면 언제나 한 페이지를 내보낸다(부재 = 교체).",
      right:
        "빈 프레임이 남아 있으면 교체 없이 적재합니다. 그래서 부재 횟수는 교체 횟수보다 많거나 같습니다.",
      check: `${atFull.index}번째 접근까지 부재 ${atFull.faults}회, 교체 ${atFull.replacements}회입니다. 끝까지 보면 FIFO는 부재 ${fifo.stats.faults}회 중 교체가 ${fifo.stats.replacements}회입니다.`,
      scene: 3,
    },
    {
      id: "fifo-recent",
      wrong: "방금 다시 읽은 페이지는 어떤 정책에서든 RAM에 오래 남는다.",
      right:
        "그것은 LRU의 성질입니다. FIFO는 적중을 기록하지 않고 적재 순서만 보므로, 방금 적중한 페이지도 가장 먼저 내보낼 수 있습니다.",
      check: `${fork.index - 1}번째에 ${ga(fork.victim!)} 적중했는데도 FIFO는 ${fork.index}번째에 ${eul(fork.victim!)} 내보내 ${after.index}번째 ${after.page} 접근이 ${after.hit ? "적중" : "부재"}였습니다. LRU에서 같은 접근은 ${lruAfter.hit ? "적중" : "부재"}입니다.`,
      scene: 5,
    },
    {
      id: "lru-always",
      wrong: "LRU는 언제나 FIFO보다 부재가 적다.",
      right:
        "LRU가 유리한 것은 최근에 쓴 페이지를 곧 다시 쓰는(시간 지역성) 접근에서입니다. 반복하는 페이지가 프레임보다 많은 루프에서는 LRU도 FIFO처럼 모든 접근이 부재가 됩니다.",
      check: `이 순서에서는 LRU ${lru.stats.faults}회, FIFO ${fifo.stats.faults}회입니다. 그러나 프레임 ${fifo.frameCount}개로 ${eul(loop.join(" "))} 읽으면 LRU ${loopFaults("lru")}회, FIFO ${loopFaults("fifo")}회로 ${loop.length}번 모두 부재입니다.`,
      scene: 6,
    },
  ];
}

/** Lesson 02 · OPT와 LRU (scenes: 0, 3, 4, 5, 7, 12). */
export function optLru(runs: Runs): Misconception[] {
  const { opt, lru } = runs;
  const first = opt.steps.find((step) => step.victim !== null)!;
  const nexts = first.before
    .map((frame) => `${frame.page} ${frame.nextUseAt ?? "없음"}${frame.nextUseAt ? "번째" : ""}`)
    .join(" · ");
  const at = 7;
  const optCold = cold(opt);
  return [
    {
      id: "opt-real",
      wrong: "OPT는 실제 운영체제가 쓰는 가장 좋은 교체 정책이다.",
      right:
        "OPT는 앞으로의 접근 순서를 알아야 해서 실행 중인 운영체제는 구현할 수 없습니다. 다른 정책이 얼마나 좋은지 재는 기준선(하한)으로만 씁니다.",
      check: `${first.index}번째 ${first.page}에서 OPT는 RAM 페이지의 다음 접근(${nexts})을 비교해 ${eul(first.victim!)} 내보냈습니다. 이 미래 정보는 실제 운영체제가 미리 알 수 없습니다.`,
      scene: 3,
    },
    {
      id: "lru-near-opt",
      wrong: "최근에 쓴 페이지를 남기는 LRU는 어떤 접근에서도 OPT에 가깝다.",
      right:
        "LRU는 과거의 접근이 미래와 닮았을 때만 OPT에 가깝습니다. 반복하는 페이지가 프레임보다 많은 루프에서는 매번 곧 쓸 페이지를 내보내 가장 나쁜 결과를 냅니다.",
      check: `${at}번째 접근까지 LRU는 ${lru.steps[at].faults}번 모두 부재, OPT는 부재 ${opt.steps[at].faults}회입니다. 끝까지 LRU ${lru.stats.faults}회, OPT ${opt.stats.faults}회입니다.`,
      scene: 5,
    },
    {
      id: "opt-zero",
      wrong: "미래를 아는 OPT라면 페이지 부재를 모두 없앨 수 있다.",
      right:
        "처음 참조하는 강제 부재는 OPT도 피할 수 없고, 프레임이 모자라면 다시 읽는 부재도 남습니다. OPT는 부재를 가장 적게 만들 뿐 0으로 만들지 않습니다.",
      check: `OPT의 부재 ${opt.stats.faults}회 중 ${optCold}회는 처음 참조한 강제 부재, ${opt.stats.faults - optCold}회는 프레임 ${opt.frameCount}개에 다 담지 못해 생긴 부재입니다.`,
      scene: 6,
    },
  ];
}

/** Lesson 03 · Belady의 모순 (scenes: 0, 4, 6, 7, 9, 12). */
export function belady(runs: Runs, { lruCounts }: Extras): Misconception[] {
  const { f3, f4 } = runs;
  const at = 7;
  const small = resident(f3.steps[at]);
  const large = resident(f4.steps[at]);
  const missing = small.filter((page) => !large.includes(page));
  return [
    {
      id: "more-frames",
      wrong: "프레임을 늘리면 페이지 부재는 반드시 줄어든다.",
      right:
        "FIFO에서는 프레임을 늘려도 부재가 늘 수 있습니다(Belady의 모순). 프레임을 늘리면 부재가 같거나 준다는 보장은 LRU·OPT 같은 스택 알고리즘에만 있습니다.",
      check: `같은 12번의 접근에서 FIFO는 프레임 ${f3.frameCount}개일 때 부재 ${f3.stats.faults}회, ${f4.frameCount}개일 때 ${f4.stats.faults}회입니다.`,
      scene: 6,
    },
    {
      id: "superset",
      wrong: "프레임이 많은 쪽의 RAM에는 적은 쪽 RAM의 페이지가 늘 들어 있다.",
      right:
        "FIFO에서는 그렇지 않습니다. 두 조건이 서로 다른 페이지를 내보내면 적은 쪽에 있는 페이지가 많은 쪽에는 없을 수 있고, 그때 Belady의 모순이 생깁니다.",
      check: `${at}번째 접근 뒤 프레임 ${f3.frameCount}개의 RAM은 ${list(small)}, ${f4.frameCount}개의 RAM은 ${list(large)}입니다. ${missing.length ? `${eun(list(missing))} ${f3.frameCount}개 쪽에만 있습니다.` : "이 순간에는 포함 관계가 유지됩니다."}`,
      scene: 4,
    },
    {
      id: "belady-lru",
      wrong: "Belady의 모순은 LRU에서도 똑같이 생긴다.",
      right:
        "LRU와 OPT는 스택 알고리즘이라 프레임 n개일 때의 RAM 페이지가 n+1개일 때도 늘 들어 있습니다. 그래서 프레임을 늘리면 부재가 같거나 줄어듭니다.",
      check: `같은 순서를 LRU로 돌리면 프레임 3개 ${lruCounts[0]}회 → 4개 ${lruCounts[1]}회입니다.`,
      scene: 6,
    },
  ];
}

/** Lesson 04 · 클럭과 LRU (scenes: 0, 4, 5, 6, 8, 9). */
export function clockLru(runs: Runs): Misconception[] {
  const { clock, lru } = runs;
  const fullSweep = clock.steps.find(
    (step) => step.events.filter((e) => e.type === "sweep").length === clock.frameCount,
  )!;
  const swept = fullSweep.events.filter((e) => e.type === "sweep").map((e) => e.page);
  const hit = clock.steps.find((step) => step.hit && !step.before[step.frameIndex].ref)!;
  const replaced = clock.steps.filter((step) => step.victim !== null);
  const same = replaced.filter((step) => lru.steps[step.index].victim === step.victim);
  const differ = replaced.filter((step) => lru.steps[step.index].victim !== step.victim);
  return [
    {
      id: "ref-bit-safe",
      wrong: "참조 비트가 1인 페이지는 내보내지 않는다.",
      right:
        "참조 비트 1은 한 번의 두 번째 기회일 뿐입니다. 바늘이 지나가며 0으로 끄고, 바늘이 한 바퀴 돌아올 때까지 다시 쓰이지 않으면 내보냅니다.",
      check: `${fullSweep.index}번째 ${fullSweep.page}에서는 비트가 모두 1이라 바늘이 ${list(swept)}의 비트를 차례로 끄고 한 바퀴 돌아 ${eul(fullSweep.victim!)} 내보냈습니다.`,
      scene: 2,
    },
    {
      id: "ref-bit-os",
      wrong: "참조 비트는 운영체제가 접근할 때마다 소프트웨어로 켠다.",
      right:
        "참조 비트는 페이지에 접근할 때 하드웨어(MMU)가 켭니다. 운영체제는 교체할 때 비트를 읽고 끄기만 해서, 접근마다 순서를 기록하는 정확한 LRU보다 비용이 훨씬 적습니다.",
      check: `${hit.index}번째 ${hit.page} 적중에서 ${hit.page}의 참조 비트가 0에서 1로 켜졌습니다. 적중이므로 운영체제는 이 접근에 끼어들지 않았습니다.`,
      scene: 3,
    },
    {
      id: "clock-is-lru",
      wrong: "클럭은 LRU와 똑같이 동작한다.",
      right:
        "클럭은 참조 비트 하나로 ‘최근에 썼는지’만 알 뿐 접근 순서는 모릅니다. 그래서 LRU와 같은 페이지를 고를 때가 많지만, 비트가 같은 페이지끼리는 바늘 위치로 고르므로 다를 때도 있습니다.",
      check: `교체 ${replaced.length}번 중 ${same.map((s) => `${s.index}번째`).join("·") || "없음"}에는 두 방식이 같은 페이지를 내보냈고, ${differ.map((s) => `${s.index}번째에는 클럭이 ${s.victim}, LRU가 ${eul(lru.steps[s.index].victim!)}`).join(", ") || "다른 선택은 없었습니다"}${differ.length ? " 내보냈습니다." : "."}`,
      scene: 6,
    },
  ];
}

/* ---------- 직접 실험: generic, true for any input ---------- */

const NAMES = { fifo: "FIFO", lru: "LRU", opt: "OPT", clock: "클럭" } as const;

/**
 * The custom lesson's misconceptions. Scenes: 1 start, 2 first access, then
 * the custom milestones; `last` is the final scene's number.
 */
export function customMisconceptions(runs: Runs, ids: [string, string], last: number) {
  const [a, b] = ids.map((id) => runs[id]);
  const name = (run: Run) => NAMES[run.algorithm];
  const items: Misconception[] = [faultIsNoError(a, 2, name(a))];

  // Ranking depends on the input, not only on the policy.
  const [fa, fb] = [a.stats.faults, b.stats.faults];
  const verdict =
    fa === fb
      ? `이 입력에서는 ${josa(name(a), "와/과")} ${name(b)}의 부재가 ${fa}회로 같습니다.`
      : `이 입력에서는 ${name(a)} ${fa}회, ${name(b)} ${fb}회로 ${josa(name(fa < fb ? a : b), "이/가")} 적습니다.`;
  items.push({
    id: "policy-always",
    wrong: "어느 교체 정책이 더 좋은지는 정책만 보면 정해진다.",
    right:
      "부재 횟수는 정책·접근 순서·프레임 수가 함께 정합니다. 같은 두 정책도 접근 순서가 바뀌면 순위가 바뀔 수 있습니다. 다만 어떤 정책도 같은 입력에서 OPT보다 부재가 적을 수는 없습니다.",
    check: `${verdict} 같은 입력에서 OPT는 ${simulate({ algorithm: "opt", frameCount: a.frameCount, references: a.references }).stats.faults}회입니다.`,
    scene: last,
  });

  // More frames: compare n and n+1 under FIFO for this very input.
  const n = a.frameCount;
  const fifoN = countFaults(a.references, n, "fifo").faults;
  const fifoMore = countFaults(a.references, n + 1, "fifo").faults;
  const lruN = countFaults(a.references, n, "lru").faults;
  const lruMore = countFaults(a.references, n + 1, "lru").faults;
  items.push({
    id: "more-frames",
    wrong: "프레임을 늘리면 페이지 부재는 반드시 줄어든다.",
    right:
      "LRU·OPT 같은 스택 알고리즘은 프레임을 늘리면 부재가 같거나 줄지만, FIFO는 늘 수도 있습니다. FIFO에서 부재가 느는 경우를 Belady의 모순이라고 합니다.",
    check: `이 입력에서 프레임을 ${n}개에서 ${n + 1}개로 늘리면 FIFO ${fifoN}회 → ${fifoMore}회, LRU ${lruN}회 → ${lruMore}회입니다.${fifoMore > fifoN ? " FIFO에서 Belady의 모순이 생겼습니다." : fifoMore === fifoN && lruMore === lruN ? " 줄지 않는 경우도 있습니다." : ""}`,
    scene: last,
  });
  return items;
}
