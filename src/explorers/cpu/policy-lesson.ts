// Lesson content for the CPU-only lessons (no I/O): FCFS, SJF and SRTF
// (OSTEP ch. 7.3–7.5). Everything a lesson says is computed from the runs, so
// the numbers on screen always match the engine.
//
// policyLesson(spec) returns the same interface lesson 01 has in lessons.js:
//   intro(result), milestones(result), chapter(frame, result),
//   stepNotes(frame, result), prediction(result, time),
//   recapPoints(result, runs), recall(runs), compare(runs), rules
import { preFrame } from "./engine.ts";
import { josa } from "./josa.ts";
import { numberChoices } from "./lesson.ts";
import type {
  Algorithm,
  Chapter,
  Decision,
  FollowUp,
  Frame,
  Milestone,
  Prediction,
  PredictionChoice,
  SimResult,
  StepNotes,
} from "./types.ts";

/** What a policy lesson adds to the shared content: its closing 핵심 note. */
export interface PolicySpec {
  finishKey?: (result: SimResult) => string;
  /** The lesson's own 핵심 장면 (직접 실험 keeps at most six); default milestones(). */
  scenes?: (result: SimResult) => Milestone[];
}

export const fmt = (value: number) => Number(value.toFixed(2)).toString();

const NAMES: Record<Algorithm, string> = {
  rr: "라운드 로빈",
  fcfs: "FCFS",
  sjf: "SJF",
  srtf: "SRTF",
};
export const methodName = (algorithm: Algorithm) => NAMES[algorithm];

/** CPU time a job still needs at the boundary t (before [t, t+1) runs). */
const left = (result: SimResult, t: number, id: string) =>
  result.frames[t].states[id].burstRemaining;
const arrivalOf = (result: SimResult, id: string) =>
  result.processes.find((p) => p.id === id)!.arrival;
const before = (result: SimResult, t: number): Frame =>
  t > 0 ? result.frames[t - 1] : preFrame(result);
const withLeft = (result: SimResult, t: number, ids: string[]) =>
  ids.map((id) => `${id} ${left(result, t, id)} ms`).join(" · ");
/** "2 ms짜리 P2·3 ms짜리 P3": ends with an id, so josa() still applies. */
const sized = (result: SimResult, t: number, ids: string[]) =>
  ids.map((id) => `${left(result, t, id)} ms짜리 ${id}`).join("·");

/* ---------- 핵심 장면 ---------- */

/**
 * Scenes follow the run: the start, the first arrival that has to wait
 * (non-preemptive), every SRTF preemption or keep, every pick after a job
 * finishes, and the finish. Ids are by position, so switching method keeps
 * the progress count of the lesson.
 */
export function milestones(result: SimResult): Milestone[] {
  const points: Milestone[] = [{ time: 0, kind: "start", title: "같은 출발선에서 첫 선택" }];
  const add = (time: number, kind: string, title: string) => {
    if (!points.some((p) => p.time === time)) points.push({ time, kind, title });
  };
  const last = result.frames.at(-1)!;
  let waited = false;
  let sliced = false;
  // Runs with I/O (직접 실험) also stop at the first I/O and the first idle CPU.
  const io = result.processes.some((p) => p.io.length);
  let blocked = false;
  let idled = false;
  for (const frame of result.frames.slice(1, -1)) {
    const has = (type: string) => frame.events.some((e) => e.type === type);
    const decision = result.decisions.find((d) => d.time === frame.t);
    if (io && !blocked && has("block")) {
      blocked = true;
      add(frame.t, "block", "입출력 중에는 다른 작업 실행");
    }
    if (!idled && has("idle")) {
      idled = true;
      add(frame.t, "idle", "작업이 남아도 CPU가 쉼");
    }
    if (has("preempt")) {
      if (result.algorithm === "srtf") add(frame.t, "preempt", "더 짧은 작업이 오면 선점");
      else if (!sliced) add(frame.t, "slice", "할당량이 끝나면 차례 넘기기");
      sliced = true;
    } else if (decision?.cause === "keep") {
      add(frame.t, "keep", "새 작업이 더 길면 그대로");
    } else if (!waited && frame.running && !has("dispatch") && has("arrive")) {
      waited = true;
      const runner = frame.running;
      const shorter = frame.events.some(
        (e) =>
          e.type === "arrive" &&
          frame.states[e.id!].burstRemaining < frame.states[runner].burstRemaining,
      );
      add(
        frame.t,
        "wait",
        shorter && result.algorithm !== "rr"
          ? "짧은 작업이 도착해도 기다림"
          : "도착해도 바로 실행되지 않음",
      );
    }
    if (has("complete") && has("dispatch")) {
      const rr = result.algorithm === "rr";
      if (!rr || !points.some((p) => p.kind === "next")) {
        // Each "next" stop names who finished and who comes next, so two of
        // them in one run never share a title.
        const done = frame.events.find((e) => e.type === "complete")?.id as string;
        const next = decision?.chosen as string;
        add(
          frame.t,
          "next",
          result.algorithm === "fcfs" || rr
            ? `${josa(done, "가")} 끝나야 다음 차례`
            : (decision?.candidates?.length ?? 2) > 1
              ? `${josa(next, "가")} 남은 것 중 가장 짧음`
              : `${next}만 남음`,
        );
      }
    }
  }
  points.push({ time: last.t, kind: "finish", title: "평균 대기와 반환 시간" });
  return points.map((p, i) => ({ ...p, id: `s${i + 1}` }));
}

/**
 * At most `max` scenes for runs that would stop too often (직접 실험): the
 * first scene of each kind, then kinds dropped from the least telling until
 * it fits. The start and the finish always stay.
 */
export function compactMilestones(points: Milestone[], max = 6): Milestone[] {
  const seen = new Set<string>();
  let kept = points.filter((p) => {
    if (p.kind === "start" || p.kind === "finish") return true;
    if (seen.has(p.kind)) return false;
    seen.add(p.kind);
    return true;
  });
  for (const kind of ["idle", "keep", "next", "block", "wait", "slice", "preempt"]) {
    if (kept.length <= max) break;
    kept = kept.filter((p) => p.kind !== kind);
  }
  return kept.map((p, i) => ({ ...p, id: `s${i + 1}` }));
}

const RULE: Record<Algorithm, string> = {
  fcfs: "FCFS는 준비 큐에 먼저 줄을 선 작업을 고르고, 그 작업이 끝날 때까지 실행합니다(비선점).",
  sjf: "SJF는 준비 큐에서 CPU 시간이 가장 짧은 작업을 고르고, 끝날 때까지 실행합니다(비선점).",
  srtf: "SRTF는 남은 CPU 시간이 가장 짧은 작업을 실행하고, 더 짧은 작업이 도착하면 CPU를 넘깁니다(선점).",
  rr: "라운드 로빈은 준비 큐의 작업에 할당량만큼씩 돌아가며 CPU를 줍니다.",
};
const START_KEY: Record<Algorithm, string> = {
  fcfs: "FCFS는 작업 길이를 보지 않습니다. 줄을 선 순서만 봅니다.",
  sjf: "SJF는 각 작업의 CPU 시간을 미리 안다고 가정합니다. 실제 운영체제는 이를 알 수 없어 과거 실행 기록으로 추정합니다(OSTEP 7.4).",
  srtf: "SRTF(OSTEP의 STCF)는 SJF에 선점을 더한 방식입니다. 작업이 준비 큐에 들어올 때마다 다시 고릅니다.",
  rr: "할당량은 한 작업이 한 차례에 CPU를 연속으로 쓸 수 있는 최대 시간입니다.",
};
const NEXT_KEY: Record<Algorithm, string> = {
  fcfs: "긴 작업이 앞에 서면 뒤의 짧은 작업들이 그 시간만큼 줄줄이 기다립니다(호위 효과, convoy effect).",
  sjf: "짧은 작업을 먼저 끝내면 뒤에서 기다리는 작업들의 대기 시간 합이 줄어듭니다.",
  srtf: "남은 시간이 가장 짧은 작업부터 끝내 평균 반환 시간을 줄입니다.",
  rr: "모든 작업이 번갈아 실행되어, 각 작업의 완료는 뒤로 밀립니다.",
};

/** Why the chosen job won at decision d, in one or two sentences. */
function pickReason(result: SimResult, d: Decision): string {
  const t = d.time;
  const { chosen, candidates } = d;
  const others = candidates.filter((id) => id !== chosen);
  if (!others.length) return `${t} ms에 준비된 작업은 ${chosen}뿐이라 바로 CPU를 받습니다.`;
  switch (result.algorithm) {
    case "fcfs":
      return `준비 큐 순서는 ${candidates.join(" → ")}입니다. FCFS는 맨 앞의 ${josa(chosen, "을")} 고릅니다.`;
    case "rr":
      return `준비 큐 순서는 ${candidates.join(" → ")}입니다. 맨 앞의 ${josa(chosen, "가")} CPU를 받습니다.`;
    default: {
      const word = result.algorithm === "srtf" ? "남은 CPU 시간" : "CPU 시간";
      const ties = others.filter((id) => left(result, t, id) === left(result, t, chosen));
      return `${word}은 ${withLeft(result, t, candidates)}입니다. 가장 짧은 ${josa(chosen, "가")} CPU를 받습니다.${ties.length ? ` ${ties.join("·")}도 길이가 같지만 먼저 줄을 선 ${josa(chosen, "이")} 우선입니다.` : ""}`;
    }
  }
}

/** The explanation shown at a 핵심 장면, stable until the next one. */
export function chapter(frame: Frame, result: SimResult, spec: PolicySpec = {}): Chapter {
  const points = (spec.scenes ?? milestones)(result);
  const index = Math.max(
    0,
    points.findLastIndex((p) => p.time <= frame.t),
  );
  const point = points[index];
  const t = point.time;
  const at = result.frames[t];
  const eyebrow = `핵심 장면 ${index + 1}/${points.length} · ${t} ms`;
  const algorithm = result.algorithm;
  const decision = result.decisions.find((d) => d.time === t)!;
  const event = (type: string) => at.events.find((e) => e.type === type)!;
  let copy: Omit<Chapter, "eyebrow">;
  switch (point.kind) {
    case "start": {
      if (!decision) {
        const firstArrival = Math.min(...result.processes.map((p) => p.arrival));
        copy = {
          title: "누가 먼저 CPU를 받을까",
          body: `CPU는 한 번에 한 작업만 실행합니다. ${RULE[algorithm]} 0 ms에는 아직 도착한 작업이 없어 CPU가 쉬고, 첫 작업은 ${firstArrival} ms에 도착합니다.`,
          key: START_KEY[algorithm],
        };
        break;
      }
      const pick =
        decision.candidates.length > 1
          ? `0 ms에 ${decision.candidates.join("·")}가 준비 큐에 있습니다. ${pickReason(result, decision)}`
          : `0 ms에는 ${decision.chosen}만 도착해 있어 바로 CPU를 받습니다.`;
      copy = {
        title: "누가 먼저 CPU를 받을까",
        body: `CPU는 한 번에 한 작업만 실행합니다. ${RULE[algorithm]} ${pick}`,
        key: START_KEY[algorithm],
      };
      break;
    }
    case "wait": {
      const arrived = at.events.filter((e) => e.type === "arrive").map((e) => e.id!);
      if (algorithm === "rr") {
        copy = {
          title: "도착해도 바로 실행되지 않음",
          body: `${t} ms에 ${josa(sized(result, t, arrived), "가")} 도착했습니다. 실행 중인 ${at.running}에게는 할당량이 ${at.quantumLeft} ms 남아 계속 실행하고, 도착한 작업은 준비 큐 뒤에서 차례를 기다립니다.`,
          key: "라운드 로빈도 도착만으로 선점하지 않습니다. 할당량이 끝나거나 CPU 구간이 끝날 때 준비 큐 맨 앞 작업이 CPU를 받습니다.",
        };
        break;
      }
      copy = {
        title: "도착해도 바로 실행되지 않음",
        body: `${t} ms에 ${josa(sized(result, t, arrived), "가")} 도착했습니다. 실행 중인 ${at.running}에게는 아직 ${left(result, t, at.running!)} ms가 남았지만, ${methodName(algorithm)}는 비선점이라 ${josa(at.running!, "가")} 끝날 때까지 준비 큐에서 기다립니다.`,
        key:
          algorithm === "sjf"
            ? "SJF는 CPU가 빌 때만 고릅니다. 짧은 작업이 조금 늦게 오면 긴 작업 뒤에서 기다립니다(OSTEP 7.5)."
            : "비선점 방식은 실행 중인 작업이 끝나야 다음 작업을 고릅니다.",
      };
      break;
    }
    case "preempt": {
      const old = event("preempt").id!;
      const newcomer = decision.chosen;
      const done = at.states[old].cpuDone;
      copy = {
        title: "더 짧은 작업이 CPU를 가져감",
        body: `${t} ms에 ${josa(newcomer, "가")} 도착했습니다. ${newcomer}에게 필요한 CPU 시간은 ${left(result, t, newcomer)} ms이고, 실행 중이던 ${old}에게는 ${left(result, t, old)} ms가 남았습니다. 더 짧은 ${josa(newcomer, "이")} ${josa(old, "을")} 선점합니다.`,
        key: `선점은 작업을 버리는 것이 아니라 잠시 멈추는 것입니다. ${josa(old, "은")} 이미 실행한 ${done} ms를 보존하고, 남은 ${left(result, t, old)} ms는 나중에 이어서 실행합니다.`,
      };
      break;
    }
    case "keep": {
      const arrived = at.events
        .filter((e) => e.type === "arrive" || e.type === "unblock")
        .map((e) => e.id!);
      const runner = decision.chosen;
      const same = arrived.some((id) => left(result, t, id) === left(result, t, runner));
      copy = {
        title: "새 작업이 더 길면 그대로",
        body: `${t} ms에 ${josa(sized(result, t, arrived), "가")} 도착했습니다. 실행 중인 ${josa(runner, "은")} ${left(result, t, runner)} ms만 남아 ${same ? "같거나 " : ""}더 짧으므로 계속 실행합니다. 새 작업은 준비 큐에서 기다립니다.`,
        key: "SRTF는 작업이 들어올 때마다 비교하지만, 새 작업이 남은 시간보다 짧을 때만 선점합니다.",
      };
      break;
    }
    case "slice": {
      const old = event("preempt").id!;
      copy = {
        title: "끝난 것은 작업이 아니라 이번 차례",
        body: `${t} ms에 ${old}의 할당량 ${result.quantum} ms가 끝났습니다. 진행한 계산은 보존하고 준비 큐 뒤로 보냅니다. ${pickReason(result, decision)}`,
        key: "할당량마다 차례가 바뀌어 모든 작업이 빨리 한 번씩 실행됩니다. 대신 각 작업의 완료는 뒤로 밀립니다.",
      };
      break;
    }
    case "block": {
      const blockEvent = event("block");
      copy = {
        title: "입출력 중에는 다른 작업이 CPU를 씁니다",
        body: `${t} ms에 ${josa(blockEvent.id!, "가")} CPU 구간을 마치고 ${blockEvent.duration} ms 동안 입출력을 기다립니다. ${at.running ? `그동안 CPU는 ${josa(at.running, "가")} 이어받습니다.` : "준비된 작업이 없어 CPU가 쉽니다."}`,
        key: "입출력을 기다리는 작업은 준비 큐에 있지 않습니다. 입출력 대기는 대기 시간(준비 큐)에 넣지 않고 반환 시간에만 들어갑니다.",
      };
      break;
    }
    case "idle": {
      const waiting = at.blocked.map((b) => b.id);
      const later = result.processes
        .filter((p) => at.states[p.id].status === "new")
        .map((p) => p.id);
      const why = [
        waiting.length ? `${waiting.join("·")} 작업은 입출력 중이` : "",
        later.length ? `${later.join("·")} 작업은 아직 도착하지 않았습니다` : "",
      ].filter(Boolean);
      const reason =
        why.length === 2
          ? `${why[0]}고, ${why[1]}. `
          : why.length
            ? `${why[0].endsWith("중이") ? `${why[0]}라 준비 큐가 빕니다` : why[0]}. `
            : "";
      copy = {
        title: "작업이 남아도 CPU가 쉽니다",
        body: `${t} ms에 준비 큐가 비었습니다. ${reason}실행할 수 있는 작업이 생길 때까지 CPU가 쉽니다.`,
        key: "미완료 작업이 있어도 준비된 작업이 없으면 CPU는 쉽니다. CPU 활용률은 실제로 실행한 시간을 전체 경과 시간으로 나눈 값입니다.",
      };
      break;
    }
    case "next": {
      const done = event("complete").id!;
      const chosen = decision.chosen;
      const waited = at.states[chosen].readyWait;
      copy = {
        title:
          algorithm === "fcfs" || algorithm === "rr"
            ? `${josa(done, "가")} 끝나야 다음 차례`
            : decision.candidates.length > 1
              ? `${josa(chosen, "가")} 남은 것 중 가장 짧음`
              : `${chosen}만 남음`,
        body: `${t} ms에 ${josa(done, "가")} 끝났습니다. ${decision.candidates.length > 1 ? pickReason(result, decision) : `남은 작업은 ${chosen}뿐이라 바로 CPU를 받습니다.`} ${josa(chosen, "은")} 지금까지 준비 큐에서 ${waited} ms를 기다렸습니다.`,
        key: NEXT_KEY[algorithm],
      };
      break;
    }
    default: {
      const s = result.stats;
      copy = {
        title: "평균 대기와 반환 시간",
        body: `모든 작업이 끝났습니다. 평균 대기 ${fmt(s.averageWaiting)} ms, 평균 반환 ${fmt(s.averageTurnaround)} ms, 평균 최초 응답 ${fmt(s.averageResponse)} ms입니다.`,
        key: spec.finishKey?.(result) ?? "같은 작업을 다른 방식으로 실행해 비교해 보세요.",
      };
    }
  }
  return { ...copy, eyebrow };
}

/* ---------- 이번 사건 notes ---------- */

export function momentNotes(frame: Frame, result: SimResult): string[] {
  const notes: string[] = [];
  for (const event of frame.events) {
    if (event.type === "complete") {
      const arrival = arrivalOf(result, event.id!);
      const job = result.processes.find((p) => p.id === event.id)!;
      const cpu = job.cpu.reduce((a, b) => a + b, 0);
      const io = job.io.reduce((a, b) => a + b, 0);
      const turnaround = frame.t - arrival;
      notes.push(
        `${event.id} 반환 시간 = 완료 ${frame.t} − 도착 ${arrival} = ${turnaround} ms. 대기 시간 = 반환 ${turnaround} − CPU ${cpu}${io ? ` − 입출력 ${io}` : ""} = ${turnaround - cpu - io} ms.`,
      );
    } else if (event.type === "dispatch" && frame.states[event.id!]?.firstRun === frame.t) {
      const arrival = arrivalOf(result, event.id!);
      notes.push(
        `${event.id} 최초 응답 = 첫 실행 ${frame.t} − 도착 ${arrival} = ${frame.t - arrival} ms.`,
      );
    }
  }
  const dispatched = frame.events.some((e) => e.type === "dispatch");
  const joined = frame.events.filter((e) => e.type === "arrive" && e.id !== frame.running);
  if (frame.running && !dispatched && joined.length) {
    notes.push(
      result.algorithm === "srtf"
        ? `${josa(frame.running, "은")} 남은 시간이 ${left(result, frame.t, frame.running)} ms로 더 짧거나 같아 선점되지 않습니다.`
        : result.algorithm === "rr"
          ? `도착은 실행 중인 ${frame.running} 작업을 선점하지 않습니다. 할당량이 끝날 때 차례가 바뀝니다.`
          : `도착은 실행 중인 ${frame.running} 작업을 선점하지 않습니다(비선점).`,
    );
  }
  return notes;
}

export function stepNotes(frame: Frame, result: SimResult, spec?: PolicySpec): StepNotes {
  const notes = momentNotes(frame, result);
  const atScene = (spec?.scenes ?? milestones)(result).some((p) => p.time === frame.t);
  const { key } = chapter(frame, result, spec);
  if (atScene || !notes.length) return { key, notes };
  return { key: notes[0], notes: notes.slice(1) };
}

/* ---------- 예측 ---------- */

/**
 * The next CPU decision with more than one candidate after `time`. Every
 * unfinished job is offered (the running one too), each with its own why.
 */
export function prediction(result: SimResult, time: number): Prediction | null {
  const decision =
    result.decisions.find((d) => d.time > time && d.candidates.length > 1) ||
    result.decisions.find((d) => d.candidates.length > 1);
  if (!decision) return null;
  const t = decision.time;
  const prev = before(result, t);
  const at = result.frames[t];
  const algorithm = result.algorithm;
  const chosen = decision.chosen;
  const joined = at.events
    .filter((e) => e.type === "arrive" || e.type === "unblock")
    .map((e) => e.id!);
  const released = at.events.find((e) => ["preempt", "complete", "block"].includes(e.type));
  const len = (id: string) => left(result, t, id);
  const word = algorithm === "srtf" ? "남은 시간" : "CPU 시간";

  let explanation: string;
  if (decision.cause === "keep") {
    explanation = `실행 중인 ${josa(chosen, "은")} ${len(chosen)} ms 남았고, 새로 온 작업은 ${withLeft(result, t, joined)}입니다. 새 작업이 더 짧지 않으므로 ${josa(chosen, "가")} 계속 실행합니다.`;
  } else if (algorithm === "srtf" && released?.type === "preempt") {
    explanation = `새로 온 ${josa(chosen, "은")} ${len(chosen)} ms, 실행 중이던 ${josa(released.id!, "은")} ${len(released.id!)} ms 남았습니다. 더 짧은 ${josa(chosen, "가")} ${josa(released.id!, "을")} 선점합니다.`;
  } else if (algorithm === "rr" && released?.type === "preempt") {
    explanation = `${josa(released.id!, "은")} 할당량을 다 써서 준비 큐 맨 뒤로 갑니다. ${pickReason(result, decision)}`;
  } else {
    const lead =
      released?.type === "complete"
        ? `${josa(released.id!, "가")} 끝나 CPU가 빕니다. `
        : released?.type === "block"
          ? `${josa(released.id!, "가")} 입출력을 시작해 CPU가 빕니다. `
          : "";
    explanation = lead + pickReason(result, decision);
  }

  const whyNot = (id: string): string => {
    if (released?.type === "complete" && released.id! === id)
      return `${josa(id, "는")} ${t} ms에 CPU 시간을 다 써서 끝납니다. 끝난 작업은 다시 CPU를 받지 않습니다.`;
    if (released?.type === "block" && released.id! === id)
      return `${josa(id, "는")} ${t} ms에 CPU 구간을 마치고 입출력을 시작합니다. 입출력 중에는 CPU를 받을 수 없습니다.`;
    if (arrivalOf(result, id) > t)
      return `${josa(id, "는")} ${arrivalOf(result, id)} ms에야 도착합니다. 준비 큐에 없는 작업은 고를 수 없습니다.`;
    if (!decision.candidates.includes(id) && at.states[id].status === "blocked") {
      const until = at.blocked.find((b) => b.id === id)?.until;
      return `${josa(id, "는")} ${until !== undefined ? `${until} ms까지 ` : ""}입출력 중이라 준비 큐에 없습니다. 입출력이 끝나야 고를 수 있습니다.`;
    }
    const ahead = decision.candidates.slice(0, decision.candidates.indexOf(id)).join("·");
    switch (algorithm) {
      case "fcfs":
        return `${josa(id, "는")} 준비 큐에서 ${ahead} 뒤에 섰습니다. FCFS는 길이와 상관없이 먼저 줄을 선 작업부터 실행합니다.${len(id) < len(chosen) ? ` ${josa(id, "가")} 더 짧아도 마찬가지입니다.` : ""}`;
      case "rr":
        if (released?.type === "preempt" && released.id! === id)
          return `${josa(id, "는")} 할당량 ${result.quantum} ms를 다 써서 준비 큐 맨 뒤로 갑니다.`;
        return `${josa(id, "는")} 준비 큐에서 ${ahead} 뒤에 있습니다. 라운드 로빈은 맨 앞 작업부터 CPU를 줍니다.`;
      default: {
        if (decision.cause === "keep" && joined.includes(id))
          return `${josa(id, "는")} ${len(id)} ms로, 실행 중인 ${chosen}의 남은 ${len(chosen)} ms보다 ${len(id) === len(chosen) ? "짧지 않습니다(같음)" : "깁니다"}. SRTF는 새 작업이 더 짧을 때만 선점합니다.`;
        if (algorithm === "srtf" && released?.type === "preempt" && released.id! === id)
          return `${josa(id, "는")} 남은 시간이 ${len(id)} ms로 새로 온 ${chosen}(${len(chosen)} ms)보다 깁니다. 실행 중이어도 더 짧은 작업이 오면 CPU를 내줍니다.`;
        if (len(id) === len(chosen))
          return `${id}도 ${word}이 ${len(id)} ms로 같지만, 먼저 줄을 선 ${josa(chosen, "가")} 우선입니다.`;
        return `${josa(id, "는")} ${word}이 ${len(id)} ms로 ${chosen}(${len(chosen)} ms)보다 깁니다. ${methodName(algorithm)}는 가장 짧은 작업부터 실행합니다.${ahead && algorithm === "sjf" && !ahead.includes(chosen) ? " 먼저 줄을 섰어도 마찬가지입니다." : ""}`;
      }
    }
  };
  const choices = result.processes
    .map((p) => p.id)
    .filter((id) => prev.states[id].status !== "done")
    .map((id): PredictionChoice =>
      id === chosen
        ? { id, correct: true, why: explanation }
        : { id, correct: false, why: whyNot(id) },
    );

  const arrival = arrivalOf(result, chosen);
  const seed = t + result.processes.findIndex((p) => p.id === chosen);
  const segment = result.segments.find((s) => s.id === chosen && s.start <= t && t < s.end);
  let followUp: FollowUp | null = null;
  if (at.states[chosen].firstRun === t) {
    const answer = t - arrival;
    followUp = {
      question: `${josa(chosen, "는")} ${arrival} ms에 도착했습니다. 최초 응답 시간은 몇 ms일까요?`,
      context: null,
      answer,
      choices: numberChoices(answer, { min: 0, seed }),
      explanation: `최초 응답 = 첫 실행 ${t} − 도착 ${arrival} = ${answer} ms. ${answer ? "그동안 준비 큐에서 기다렸습니다." : "도착하자마자 CPU를 받았습니다."}`,
    };
  } else if (segment && !(algorithm === "rr" && result.quantum === 1)) {
    const answer = segment.end - t;
    const cut = segment.reason === "preempt";
    followUp = {
      question: `${josa(chosen, "는")} ${t} ms부터 CPU를 몇 ms 연속으로 쓸까요?`,
      context: `${chosen} 남은 CPU ${len(chosen)} ms${algorithm === "srtf" ? " · 더 짧은 작업이 오면 선점" : algorithm === "rr" ? ` · 할당량 ${result.quantum} ms` : " · 비선점"}`,
      answer,
      choices: numberChoices(answer, { min: 1, seed }),
      explanation: cut
        ? `${segment.end} ms에 더 짧은 작업이 도착해 선점됩니다. ${t}–${segment.end} ms, ${answer} ms입니다.`
        : segment.reason === "quantum"
          ? `할당량 ${result.quantum} ms를 다 쓰고 차례를 넘깁니다.`
          : segment.reason === "block"
            ? `이번 CPU 구간 ${len(chosen)} ms를 마치고 입출력을 시작합니다.`
            : `남은 ${len(chosen)} ms를 끝까지 실행하고 완료됩니다.`,
    };
  }

  const prevRunning = t > 0 ? result.frames[t - 1].running : null;
  return {
    id: `${algorithm === "rr" ? `rr${result.quantum}` : algorithm}@${t}`,
    decision,
    beforeTime: t - 1,
    running: prevRunning,
    runningNote: prevRunning
      ? `남은 CPU ${prev.states[prevRunning].burstRemaining} ms`
      : "실행 중인 작업 없음",
    readyLabel: "준비 큐 · 남은 CPU",
    ready: prev.ready.map((id) => `${id} ${prev.states[id].burstRemaining} ms`),
    joined: joined.map((id) => `${id} 도착 · ${len(id)} ms`),
    choices,
    explanation,
    followUp,
    hint: `실행 중인 작업과 준비 큐의 ${word}, 그리고 ${methodName(algorithm)}의 규칙을 근거로 골라 보세요.`,
  };
}

/* ---------- 비교 ---------- */

/** Head line: average waiting of the two runs (the question of 02 and 03). */
export function waitingLine(a: SimResult, b: SimResult): string {
  const [x, y] = [a.stats.averageWaiting, b.stats.averageWaiting];
  if (x === y) return `두 방식의 평균 대기 시간이 ${fmt(x)} ms로 같습니다.`;
  const [win, lose] = x < y ? [a, b] : [b, a];
  return `${methodName(win.algorithm)}의 평균 대기가 ${fmt(Math.abs(x - y))} ms 짧습니다(${methodName(lose.algorithm)} ${fmt(lose.stats.averageWaiting)} ms → ${methodName(win.algorithm)} ${fmt(win.stats.averageWaiting)} ms).`;
}

/** One line per job: how long it waited under each method. */
export function waitsLine(a: SimResult, b: SimResult): string {
  return a.stats.perProcess
    .map((p, i) => `${p.id} ${p.waiting}→${b.stats.perProcess[i].waiting} ms`)
    .join(" · ");
}
