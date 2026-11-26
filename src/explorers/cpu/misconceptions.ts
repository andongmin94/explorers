// 오개념 바로잡기 for the CPU lessons (docs/DESIGN.md → Learning model): a
// belief learners commonly hold, what is actually true, and the evidence in
// this run. Every number is read from the runs. The 핵심 장면 list depends on
// the method and the quantum, so each item finds its scene in the run on
// screen (`result`): the first scene at which the evidence has happened, or
// the last scene (정리) when this method never shows it.
//
// Sources: OSTEP ch. 7 (7.3 FIFO and the convoy effect, 7.4 SJF needs the
// burst lengths, 7.5 STCF, 7.6 RR: response vs turnaround, the cost of a
// context switch), Silberschatz 5.3 (predicting the next CPU burst).
import type { Misconception } from "@/lib/lesson-kit.ts";
import { josa } from "./josa.ts";
import { fmt, methodName } from "./policy-lesson.ts";
import type { Algorithm, Milestone, Runs, SimResult } from "./types.ts";

/** The 1-based scene at or after time t (the last scene if none). */
export function sceneAt(milestones: Milestone[], t: number): number {
  const i = milestones.findIndex((m) => m.time >= t);
  return i < 0 ? milestones.length : i + 1;
}
/** The 1-based scene of the first milestone of a kind, or the last scene. */
function sceneOf(milestones: Milestone[], ...kinds: string[]): number {
  const i = milestones.findIndex((m) => kinds.includes(m.kind));
  return i < 0 ? milestones.length : i + 1;
}

/** Arrival is not dispatch: the first job that waited before its first run. */
export function arrivalWaits(result: SimResult, milestones: Milestone[]): Misconception {
  const waited = result.stats.perProcess
    .filter((p) => p.response > 0)
    .toSorted((a, b) => a.arrival - b.arrival)[0];
  const base = {
    id: "arrive-run",
    wrong: "작업이 도착하면 곧바로 CPU에서 실행된다.",
    right:
      "도착한 작업은 준비 큐에 줄을 설 뿐입니다. CPU를 받는 것은 스케줄러가 그 작업을 고를 때이고, 그 전까지 준비 큐에서 기다린 시간이 최초 응답 시간입니다.",
  };
  if (!waited)
    return {
      ...base,
      check: `이 실행에서는 모든 작업이 도착하자마자 CPU를 받았습니다(평균 최초 응답 ${fmt(result.stats.averageResponse)} ms). CPU가 비어 있었기 때문이며, 다른 작업이 실행 중이었다면 준비 큐에서 기다렸습니다.`,
      scene: milestones.length,
    };
  const holder = result.frames[waited.arrival]?.running;
  return {
    ...base,
    check: `${josa(waited.id, "는")} ${waited.arrival} ms에 도착했지만 ${waited.firstRun} ms에야 처음 CPU를 받았습니다(최초 응답 ${waited.response} ms).${holder && holder !== waited.id ? ` 도착했을 때 CPU에서는 ${josa(holder, "가")} 실행 중이었습니다.` : ""}`,
    scene: sceneAt(milestones, waited.firstRun),
  };
}

/** Preemption is not free: count the switches of both runs. */
export function switchCost(
  _result: SimResult,
  milestones: Milestone[],
  [a, b]: SimResult[],
): Misconception {
  const per = 0.5;
  const most = a.stats.contextSwitches >= b.stats.contextSwitches ? a : b;
  return {
    id: "free-preempt",
    wrong: "선점은 공짜다. 작업을 자주 바꿀수록 응답만 좋아질 뿐 손해는 없다.",
    right:
      "작업을 바꿀 때마다 문맥 교환이 일어나 레지스터를 저장·복원하고 캐시와 TLB의 내용도 잃습니다. 이 모델은 그 비용을 0 ms로 두었지만, 실제로는 자주 바꿀수록 이 비용이 쌓입니다.",
    check: `문맥 교환은 ${methodName(a.algorithm)} ${a.stats.contextSwitches}회, ${methodName(b.algorithm)} ${b.stats.contextSwitches}회입니다. 한 번에 ${per} ms만 들어도 ${josa(methodName(most.algorithm), "는")} ${fmt(most.stats.contextSwitches * per)} ms를 계산 없이 씁니다.`,
    scene: sceneOf(milestones, "preempt", "slice"),
  };
}

/** A better average is not better for every job. */
export function averageForAll(
  _result: SimResult,
  milestones: Milestone[],
  [a, b]: SimResult[],
): Misconception {
  const base = {
    id: "average-all",
    wrong: "평균 대기 시간이 짧은 방식은 모든 작업을 더 빨리 끝낸다.",
    right:
      "평균은 여러 작업을 합친 값입니다. 평균이 좋아져도 어떤 작업은 더 오래 기다리거나 더 늦게 끝날 수 있습니다. 긴 작업이 계속 밀리는 것을 기아(starvation)라고 합니다.",
    scene: milestones.length,
  };
  const [wa, wb] = [a.stats.averageWaiting, b.stats.averageWaiting];
  if (wa === wb) {
    return {
      ...base,
      check: `이 입력에서는 두 방식의 평균 대기가 ${fmt(wa)} ms로 같습니다. 작업별 반환 시간(${methodName(a.algorithm)}·${methodName(b.algorithm)})은 ${a.stats.perProcess.map((p, i) => `${p.id} ${p.turnaround}·${b.stats.perProcess[i].turnaround} ms`).join(", ")}입니다.`,
    };
  }
  const [win, lose] = wa < wb ? [a, b] : [b, a];
  const worse = win.stats.perProcess
    .map((p, i) => ({ p, q: lose.stats.perProcess[i] }))
    .filter(({ p, q }) => p.turnaround > q.turnaround)
    .toSorted((x, y) => y.p.turnaround - y.q.turnaround - (x.p.turnaround - x.q.turnaround))[0];
  return {
    ...base,
    check: worse
      ? `평균 대기는 ${josa(methodName(win.algorithm), "가")} ${fmt(win.stats.averageWaiting)} ms로 더 짧지만(${methodName(lose.algorithm)} ${fmt(lose.stats.averageWaiting)} ms), ${worse.p.id}의 반환 시간은 ${methodName(win.algorithm)}에서 ${worse.p.turnaround} ms로 ${methodName(lose.algorithm)}(${worse.q.turnaround} ms)보다 깁니다.`
      : `이 입력에서는 평균 대기가 짧은 ${josa(methodName(win.algorithm), "가")} 모든 작업의 반환 시간도 같거나 짧았습니다(평균 대기 ${fmt(win.stats.averageWaiting)} ms, ${methodName(lose.algorithm)} ${fmt(lose.stats.averageWaiting)} ms). 입력이 바뀌면 이 관계는 깨질 수 있습니다.`,
  };
}

/** SJF needs the burst lengths in advance. */
function sjfReal(result: SimResult, milestones: Milestone[], sjf: SimResult): Misconception {
  const first = sjf.decisions.find((d) => d.candidates.length > 1) ?? sjf.decisions[0];
  const left = (id: string) => sjf.frames[first.time].states[id].burstRemaining;
  return {
    id: "sjf-real",
    wrong: "SJF는 실제 운영체제에서도 그대로 쓸 수 있다.",
    right:
      "SJF와 SRTF는 각 작업의 다음 CPU 구간 길이를 미리 알아야 합니다. 실제 운영체제는 이를 알 수 없어 과거 CPU 구간의 지수 평균 등으로 다음 길이를 추정할 뿐입니다.",
    check: `${first.time} ms에 SJF가 ${first.candidates.map((id) => `${id} ${left(id)} ms`).join(" · ")} 중 ${josa(first.chosen, "을")} 고를 수 있었던 것은 이 실험이 CPU 시간을 미리 알려 주었기 때문입니다.`,
    // Shown under SJF at its first pick; under the other method only in 정리,
    // so it never answers SJF's first prediction in advance.
    scene: result.algorithm === "sjf" ? sceneAt(milestones, first.time) : milestones.length,
  };
}

/* ---------- Lesson 01 · RR과 FCFS ---------- */

export function rrFcfs(result: SimResult, milestones: Milestone[], runs: Runs): Misconception[] {
  const { rr, fcfs } = runs;
  // The I/O return that waited longest for the CPU (or the first one).
  const returns = result.frames.flatMap((frame) =>
    frame.events
      .filter((e) => e.type === "unblock")
      .map((e) => {
        const back = result.frames.find((f) => f.t >= frame.t && f.running === e.id)!;
        return { id: e.id!, t: frame.t, back: back.t };
      }),
  );
  const io = returns.toSorted((x, y) => y.back - y.t - (x.back - x.t) || x.t - y.t)[0];
  const items: Misconception[] = [
    arrivalWaits(result, milestones),
    {
      id: "rr-turnaround",
      wrong: "라운드 로빈은 차례를 공평하게 나누니 평균 반환 시간도 언제나 짧다.",
      right:
        "라운드 로빈은 최초 응답을 줄이지만, 작업을 잘게 나눠 번갈아 실행하므로 각 작업의 완료가 뒤로 밀립니다. 반환 시간으로 재면 FCFS보다 나쁜 경우가 많습니다.",
      check: `할당량 ${rr.quantum} ms에서 평균 최초 응답은 라운드 로빈 ${fmt(rr.stats.averageResponse)} ms, FCFS ${fmt(fcfs.stats.averageResponse)} ms이고, 평균 반환 시간은 라운드 로빈 ${fmt(rr.stats.averageTurnaround)} ms, FCFS ${fmt(fcfs.stats.averageTurnaround)} ms입니다.`,
      scene: milestones.length,
    },
    switchCost(result, milestones, [rr, fcfs]),
  ];
  if (io)
    items.push({
      id: "io-return",
      wrong: "입출력을 마친 작업은 곧바로 CPU를 되찾는다.",
      right:
        "입출력을 마치면 준비 상태가 되어 준비 큐 뒤에 섭니다. 이 모델의 라운드 로빈과 FCFS는 입출력 복귀로 실행 중인 작업을 선점하지 않으므로, CPU를 받기까지 기다릴 수 있습니다.",
      check:
        io.back > io.t
          ? `${josa(io.id, "는")} ${io.t} ms에 입출력을 마쳤지만 ${io.back} ms에야 CPU를 다시 받았습니다. 그동안 준비 큐에서 ${io.back - io.t} ms를 기다렸습니다.`
          : `${josa(io.id, "가")} ${io.t} ms에 입출력을 마쳤을 때는 CPU가 비어 있어 바로 받았습니다. 다른 작업이 실행 중이었다면 준비 큐에서 기다렸습니다.`,
      scene: sceneAt(milestones, io.back),
    });
  return items;
}

/* ---------- Lesson 02 · SJF와 FCFS ---------- */

export function sjfFcfs(result: SimResult, milestones: Milestone[], runs: Runs): Misconception[] {
  const { fcfs, sjf } = runs;
  const lead = fcfs.segments.find((s) => s.id)!;
  const behind = fcfs.stats.perProcess.filter((p) => p.id !== lead.id);
  const leadCpu = fcfs.processes.find((p) => p.id === lead.id)!.cpu[0];
  const shortest = behind.toSorted((a, b) => a.cpu - b.cpu)[0];
  return [
    sjfReal(result, milestones, sjf),
    {
      id: "fcfs-fair",
      wrong: "FCFS는 온 순서대로 처리하니 누구도 손해 보지 않는 공정한 방식이다.",
      right:
        "FCFS는 도착 순서로는 공정해 보이지만, 긴 작업이 앞에 서면 뒤의 짧은 작업들이 모두 그 시간만큼 기다립니다. 이것을 호위 효과(convoy effect)라고 합니다.",
      check: `FCFS에서 ${lead.id}(${leadCpu} ms) 뒤의 ${behind.map((p) => `${josa(p.id, "는")} ${p.waiting} ms`).join(", ")}를 기다렸습니다. ${shortest.id}의 CPU 시간은 ${shortest.cpu} ms뿐입니다.`,
      scene: result.algorithm === "fcfs" ? sceneOf(milestones, "next") : milestones.length,
    },
    {
      id: "short-first-faster",
      wrong: "짧은 작업을 먼저 하면 모든 작업이 더 빨리 끝난다.",
      right:
        "실행 순서를 바꿔도 CPU가 할 일의 총량은 같아 마지막 작업이 끝나는 시각은 같습니다. 줄어드는 것은 평균 대기와 평균 반환 시간이고, 긴 작업은 오히려 늦게 끝날 수 있습니다.",
      check: `전체 완료는 FCFS ${fcfs.stats.makespan} ms, SJF ${sjf.stats.makespan} ms이고, 평균 대기는 ${fmt(fcfs.stats.averageWaiting)} ms에서 ${fmt(sjf.stats.averageWaiting)} ms로 줄었습니다. 가장 긴 ${lead.id}의 반환 시간은 ${fcfs.stats.perProcess.find((p) => p.id === lead.id)!.turnaround} ms에서 ${sjf.stats.perProcess.find((p) => p.id === lead.id)!.turnaround} ms가 됐습니다.`,
      scene: milestones.length,
    },
  ];
}

/* ---------- Lesson 03 · SRTF와 SJF ---------- */

export function srtfSjf(result: SimResult, milestones: Milestone[], runs: Runs): Misconception[] {
  const { sjf, srtf } = runs;
  const cut = srtf.segments.find((s) => s.reason === "preempt")!;
  const done = srtf.frames[cut.end].states[cut.id!];
  const keep = srtf.decisions.find((d) => d.cause === "keep")!;
  const newcomer = srtf.frames[keep.time].events.find(
    (e) => e.type === "arrive" && e.id !== keep.chosen,
  )!.id!;
  const full = (id: string) => srtf.processes.find((p) => p.id === id)!.cpu[0];
  const leftAt = (t: number, id: string) => srtf.frames[t].states[id].burstRemaining;
  const longest = srtf.processes.toSorted((a, b) => b.cpu[0] - a.cpu[0])[0].id;
  const ta = (run: SimResult) => run.stats.perProcess.find((p) => p.id === longest)!.turnaround;
  const at = (algorithm: Algorithm, ...kinds: string[]) =>
    result.algorithm === algorithm ? sceneOf(milestones, ...kinds) : milestones.length;
  return [
    {
      ...switchCost(result, milestones, [sjf, srtf]),
      scene: at("srtf", "preempt"),
    },
    {
      id: "preempt-restart",
      wrong: "선점된 작업은 다음에 처음부터 다시 실행한다.",
      right:
        "선점은 잠시 멈추는 것입니다. 진행한 계산은 보존되고, 다시 CPU를 받으면 남은 시간만 이어서 실행합니다.",
      check: `${josa(cut.id!, "는")} ${cut.end} ms에 선점될 때 이미 ${done.cpuDone} ms를 실행했고, 나중에 남은 ${done.burstRemaining} ms만 이어서 실행했습니다.`,
      scene: at("srtf", "preempt"),
    },
    {
      id: "preempt-total",
      wrong: "SRTF에서는 새 작업이 실행 중인 작업의 전체 길이보다 짧으면 선점한다.",
      right:
        "SRTF가 비교하는 것은 새 작업의 CPU 시간과 실행 중인 작업의 ‘남은’ 시간입니다. 새 작업이 더 짧을 때만 선점하고, 같거나 길면 실행 중인 작업이 계속합니다.",
      check: `${keep.time} ms에 도착한 ${newcomer}(${full(newcomer)} ms)${josa(newcomer, "는").slice(newcomer.length)} ${keep.chosen}의 전체 ${full(keep.chosen)} ms보다 길고, 남은 ${leftAt(keep.time, keep.chosen)} ms보다도 길어 선점하지 못했습니다.`,
      scene: at("srtf", "keep"),
    },
    {
      id: "srtf-all",
      wrong: "SRTF는 모든 작업에게 유리하다.",
      right:
        "SRTF는 평균 반환 시간을 줄이지만, 긴 작업은 짧은 작업에 계속 밀려 더 늦게 끝납니다. 짧은 작업이 끊임없이 오면 긴 작업이 오래 굶는 기아가 생길 수 있습니다.",
      check: `평균 반환 시간은 SJF ${fmt(sjf.stats.averageTurnaround)} ms, SRTF ${fmt(srtf.stats.averageTurnaround)} ms로 줄었지만, 가장 긴 ${longest}의 반환 시간은 SJF ${ta(sjf)} ms에서 SRTF ${ta(srtf)} ms로 늘었습니다.`,
      scene: milestones.length,
    },
  ];
}

/* ---------- 직접 실험 ---------- */

export function customMisconceptions(
  result: SimResult,
  milestones: Milestone[],
  runs: Runs,
  methods: [Algorithm, Algorithm],
): Misconception[] {
  const pair = methods.map((m) => runs[m]);
  const items = [arrivalWaits(result, milestones)];
  if (methods.some((m) => m === "rr" || m === "srtf"))
    items.push(switchCost(result, milestones, pair));
  else items.push(sjfReal(result, milestones, runs.sjf));
  items.push(averageForAll(result, milestones, pair));
  return items;
}
