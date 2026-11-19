import { josa } from "./josa.js";

const formatTime = (value) => Number(value.toFixed(2)).toString();
const idsText = (events) => events.map((event) => event.id).join("·");

/** At a simultaneous boundary the elapsed CPU and I/O are known, but a later
 * dispatch or completion must not appear before its card makes that move. */
export function frameAtMove(frame, view, move) {
  const states = Object.fromEntries(Object.entries(frame.states).map(([id, state]) => {
    const status = view.running === id ? "running" :
      ["new", "ready", "blocked", "done"].find((zone) => view[zone].includes(id));
    return [id, {
      ...state, status,
      arriving: move.type === "arrive" && move.id === id,
      firstRun: state.firstRun === frame.t && status !== "running" ? null : state.firstRun,
      finishedAt: status === "done" ? state.finishedAt : null,
    }];
  }));
  return {
    ...frame, states, running: view.running, ready: [...view.ready], completed: [...view.done],
    blocked: view.blocked.map((id) => ({ id, remaining: states[id].ioRemaining })),
    events: frame.events.slice(0, frame.events.indexOf(move)),
  };
}

const ordinal = (index) => (index === 0 ? "첫" : `${index + 1}번째`);
const byProcessOrder = (result) => {
  const order = result.processes.map((process) => process.id);
  return (a, b) => order.indexOf(a) - order.indexOf(b);
};

/** Explain why the CPU idles longer under RR, from the two runs themselves. */
export function describeComparison(rr, fcfs) {
  if (!rr.segments.some((segment) => segment.reason === "quantum")) {
    return `모든 CPU 구간이 ${rr.quantum}ms 안에 끝나 라운드 로빈에서도 선점이 일어나지 않습니다. 두 방식의 실행 순서와 완료 순서가 같습니다.`;
  }
  const idle = `준비 큐가 비어 CPU가 쉰 시간은 라운드 로빈 ${rr.stats.idle}ms, FCFS ${fcfs.stats.idle}ms입니다.`;
  const gap = rr.segments.find((segment) => segment.id === null);
  if (!gap || rr.stats.idle <= fcfs.stats.idle) return idle;
  // The I/O that the CPU is left waiting for when it falls idle.
  const io = rr.ioSegments.find((entry) => entry.start <= gap.start && gap.start < entry.end);
  if (!io) return idle;
  const nth = rr.ioSegments.filter((entry) => entry.id === io.id).indexOf(io);
  const same = fcfs.ioSegments.filter((entry) => entry.id === io.id)[nth];
  if (!same || same.start >= io.start) return idle;
  const othersDone = rr.frames[gap.start].completed.length === rr.processes.length - 1;
  return `${idle} 원인은 입출력이 시작되는 시각입니다. 라운드 로빈에서는 ${io.id}의 ${ordinal(nth)} 입출력 요청이 ${same.start}ms에서 ${io.start}ms로 늦어집니다. 늦게 시작한 입출력은 다른 작업의 CPU 실행과 겹치는 시간이 줄어, ${othersDone ? "다른 작업이 모두 끝난 뒤" : "준비된 작업이 없는"} ${gap.start}–${gap.end}ms에 CPU가 쉽니다.`;
}

/** Sentences for the comparison dialog; every number comes from the two runs. */
export function comparisonSummary(rr, fcfs) {
  const diff = rr.stats.averageResponse - fcfs.stats.averageResponse;
  const response =
    diff < 0
      ? `라운드 로빈의 평균 최초 응답이 ${formatTime(-diff)}ms 더 빠릅니다.`
      : diff > 0
        ? `FCFS의 평균 최초 응답이 ${formatTime(diff)}ms 더 빠릅니다.`
        : "두 방식의 평균 최초 응답 시간이 같습니다.";
  const endDiff = rr.stats.makespan - fcfs.stats.makespan;
  const finish = `전체 완료 시각(마지막 작업이 끝난 시각)은 ${
    endDiff > 0 ? `FCFS가 ${endDiff}ms 빠릅니다` : endDiff < 0 ? `라운드 로빈이 ${-endDiff}ms 빠릅니다` : "같습니다"
  }. 평균 반환 시간은 라운드 로빈 ${formatTime(rr.stats.averageTurnaround)}ms, FCFS ${formatTime(fcfs.stats.averageTurnaround)}ms입니다.`;
  const caveat = `${endDiff ? "이 모델은 문맥 교환 비용을 0ms로 두므로, 차이는 전환 비용 때문이 아닙니다. " : ""}FCFS가 늘 유리한 것도 아닙니다. 긴 CPU 구간을 가진 작업이 앞에 서면 짧은 작업들이 줄줄이 기다리는 호위 효과(convoy effect)가 생깁니다.`;
  return { response, finish, cause: describeComparison(rr, fcfs), caveat };
}

/** Run the same jobs at every slider position, for the quantum trade-off. */
export function quantumSweep(simulate, processes, quanta = [1, 2, 3, 4, 5]) {
  return quanta.map((quantum) => {
    const { stats } = simulate({ algorithm: "rr", quantum, processes });
    return {
      quantum,
      makespan: stats.makespan,
      switches: stats.contextSwitches,
      response: stats.averageResponse,
    };
  });
}

function describeQuantum(result) {
  const q = result.quantum;
  const longest = Math.max(...result.processes.flatMap((process) => process.cpu));
  const now = `할당량 ${q}ms에서는 문맥 교환 ${result.stats.contextSwitches}회, 평균 최초 응답 ${formatTime(result.stats.averageResponse)}ms, 전체 완료 ${result.stats.makespan}ms입니다.`;
  return q >= longest
    ? `${now} 가장 긴 CPU 구간(${longest}ms)도 한 차례에 끝나 선점이 없고, FCFS와 똑같이 실행됩니다.`
    : `${now} 할당량을 줄이면 문맥 교환이 잦아지고 첫 응답이 빨라집니다. ${longest}ms 이상으로 키우면 선점이 사라져 FCFS처럼 실행됩니다.`;
}

/** Short notes for what this exact boundary shows, next to the event list. */
export function momentNotes(frame, result) {
  const notes = [];
  const arrivalOf = (id) => result.processes.find((process) => process.id === id).arrival;
  for (const event of frame.events) {
    if (event.type === "complete") {
      const arrival = arrivalOf(event.id);
      notes.push(`${event.id} 반환 시간 = 완료 ${frame.t} − 도착 ${arrival} = ${frame.t - arrival}ms. CPU 실행·준비 큐 대기·입출력 대기를 모두 포함합니다.`);
    } else if (event.type === "dispatch" && frame.states[event.id]?.firstRun === frame.t) {
      const arrival = arrivalOf(event.id);
      notes.push(`${event.id} 최초 응답 = 첫 실행 ${frame.t} − 도착 ${arrival} = ${frame.t - arrival}ms. 응답은 화면 출력이나 작업 완료를 뜻하지 않습니다.`);
    } else if (event.type === "preempt" && event.id === frame.running) {
      notes.push(`준비 큐에 ${event.id}만 있어 ${josa(event.id, "이")} 새 할당량으로 바로 다시 배정됐습니다. 문맥 교환 횟수는 늘지 않습니다.`);
    }
  }
  const dispatched = frame.events.some((event) => event.type === "dispatch");
  const joined = frame.events.filter((event) => ["arrive", "unblock"].includes(event.type) && event.id !== frame.running);
  if (frame.running && !dispatched && joined.length) {
    notes.push(`${joined[0].type === "arrive" ? "도착은" : "입출력 복귀는"} 실행 중인 ${frame.running} 작업을 선점하지 않습니다.`);
  }
  return notes;
}

function describeFinish(frame, result) {
  return {
    eyebrow: `${frame.t} ms · 실행 완료`,
    title: "응답과 완료, 따로 비교하기",
    body: `모든 작업이 끝났습니다. 평균 최초 응답은 ${formatTime(result.stats.averageResponse)} ms, 평균 반환 시간은 ${formatTime(result.stats.averageTurnaround)} ms입니다. CPU는 전체 ${result.stats.makespan} ms 중 ${result.stats.busy} ms 동안 실행됐습니다.`,
    insight: "첫 실행이 빠르다고 작업이 빨리 끝나는 것은 아닙니다. 같은 작업을 다른 방식으로 실행해 비교해 보세요.",
  };
}

function chapterPoints(result) {
  const points = new Map();
  const add = (frame, kind, title) => {
    if (frame && !points.has(frame.t)) {
      points.set(frame.t, { time: frame.t, kind, title });
    }
  };
  const first = (type) =>
    result.frames.find((frame) =>
      frame.events.some((event) => event.type === type),
    );
  add(result.frames[0], "start", "하나의 CPU, 세 작업");
  const firstPreempt = first("preempt");
  if (firstPreempt) {
    add(firstPreempt, "preempt", "할당량이 끝나면 차례 넘기기");
  } else {
    add(
      result.frames.find(
        (frame) =>
          frame.t > 0 &&
          frame.running &&
          frame.events.some(
            (event) => event.type === "arrive" && event.id !== frame.running,
          ),
      ),
      "arrival",
      "도착해도 바로 실행되지 않음",
    );
  }
  add(first("block"), "block", "입출력 중에는 다른 작업 실행");
  add(first("unblock"), "unblock", "입출력이 끝나면 준비 큐로");
  const firstIdle = first("idle");
  add(firstIdle, "idle", "작업이 남아도 CPU가 쉬는 이유");
  if (firstIdle) {
    add(
      result.frames.find((frame) => frame.t > firstIdle.t && frame.running),
      "resume",
      "입출력을 마치고 이어서 실행",
    );
  }
  const last = result.frames.at(-1);
  points.set(last.t, {
    time: last.t,
    kind: "finish",
    title: "응답과 완료 시간 비교",
  });
  return [...points.values()].sort((a, b) => a.time - b.time);
}

/** Chapters follow actual events; changing the quantum changes their boundaries. */
export function buildMilestones(result) {
  return chapterPoints(result).map(({ time, title }) => ({ time, title }));
}

const BURST = "각 작업은 CPU 구간(CPU 버스트: 쉬지 않고 계산하는 구간)과 입출력을 번갈아 거칩니다.";

/** Keep the conceptual explanation stable while the live state continues to change. */
export function describeChapter(frame, result) {
  const points = chapterPoints(result);
  const index = points.findLastIndex((point) => point.time <= frame.t);
  const chapter = points[index];
  const end = points[index + 1]?.time ?? result.stats.makespan + 1;
  const anchor = result.frames.find((entry) => entry.t === chapter.time);
  const eventOf = (type) => anchor.events.find((event) => event.type === type);
  const rr = result.algorithm === "rr";
  const eyebrow = `핵심 장면 ${index + 1}/${points.length} · ${chapter.time} ms`;
  let copy;

  switch (chapter.kind) {
    case "start":
      copy = rr
        ? {
            title: "한 번에 하나, 차례로 실행",
            body: `CPU는 한 번에 한 작업만 실행합니다. ${BURST} 라운드 로빈은 한 차례에 최대 ${result.quantum} ms를 줍니다. 할당량을 다 쓰면 실행 중인 작업에게서 CPU를 거둬(선점) 준비 큐 뒤로 보냅니다. 입출력이 필요하면 할당량이 남아도 CPU를 놓습니다.`,
            insight: `${describeQuantum(result)} 작업을 바꿔 실행하는 것을 문맥 교환(작업 전환)이라고 합니다.`,
          }
        : {
            title: "한 번에 하나, 차례로 실행",
            body: `CPU는 한 번에 한 작업만 실행합니다. ${BURST} 선입선처리(FCFS)는 준비 큐에 먼저 줄을 선 작업부터 고르고, 그 작업이 입출력을 요청하거나 종료할 때까지 실행합니다. 새 작업이 도착해도 실행 중인 작업의 CPU를 빼앗지(선점하지) 않습니다.`,
            insight:
              "작업의 전체 CPU 시간과 이번 CPU 구간은 서로 다릅니다. 작업 탭에서 구간별 진행을 살펴보세요.",
          };
      break;
    case "arrival": {
      const arrival = eventOf("arrive");
      copy = {
        title: "도착은 준비 큐에 줄을 서는 것입니다",
        body: `${anchor.t} ms에 ${arrival.id} 작업이 도착했지만 CPU에서는 ${anchor.running} 작업이 실행 중이었습니다. 새 작업은 준비 큐 뒤에 줄을 섭니다. 그래서 도착 시각과 첫 실행 시각이 다릅니다.`,
        insight: rr
          ? "도착은 실행 중인 작업을 선점하지 않습니다. 할당량은 실행 중인 작업이 CPU를 쓴 시간을 세며, 다른 작업이 도착해도 취소되지 않습니다."
          : "FCFS는 먼저 줄을 선 순서로 CPU를 줍니다. 입출력을 요청하거나 작업을 마칠 때까지 CPU를 놓지 않는 비선점 방식입니다.",
      };
      break;
    }
    case "preempt": {
      const expired = eventOf("preempt");
      const decision = result.decisions.find(
        (entry) => entry.time === anchor.t,
      );
      const joined = anchor.events.filter((event) => ["arrive", "unblock"].includes(event.type));
      copy = {
        title: "끝난 것은 작업이 아니라 이번 차례",
        body: `${anchor.t} ms에 ${expired.id}의 ${result.quantum} ms 할당량이 끝났습니다. 진행한 계산은 보존하고, 남은 작업을 준비 큐 뒤로 돌립니다. 배정 직전 순서는 ${josa(decision.candidates.join(" → "), "였")}습니다. 맨 앞의 ${decision.chosen} 작업이 CPU를 받았습니다.`,
        insight: joined.length
          ? `같은 시각에 ${idsText(joined)} 작업이 들어왔습니다. 이 모델은 같은 시각의 도착·입출력 복귀를 먼저 큐에 넣고, 할당량이 끝난 작업을 마지막에 넣습니다.`
          : "선점된 작업의 진행 상태는 보존됩니다. 다음 차례에는 남은 CPU 구간부터 이어갑니다.",
      };
      break;
    }
    case "block": {
      const blocked = eventOf("block");
      copy = {
        title: "입출력과 CPU는 동시에 진행",
        body: `${anchor.t} ms에 ${blocked.id} 작업이 CPU 구간을 마치고 입출력을 요청했습니다. 입출력을 기다리는 동안에는 CPU를 놓습니다. ${anchor.running ? `그 CPU는 ${anchor.running} 작업이 이어받았습니다.` : "다른 준비 작업이 없어 CPU는 쉬게 됐습니다."} 한 작업이 입출력을 기다리는 동안에도 다른 작업은 계산할 수 있습니다.`,
        insight:
          "입출력 대기는 데이터를 기다리는 상태이고, 준비 큐 대기는 CPU를 기다리는 상태입니다. 둘은 따로 기록합니다.",
      };
      break;
    }
    case "unblock": {
      const returned = anchor.events.filter(
        (event) => event.type === "unblock",
      );
      const returnedIds = returned.map((event) => event.id);
      const immediatelyRan = returnedIds.includes(anchor.running);
      const decision = result.decisions.find((entry) => entry.time === anchor.t);
      const expired = eventOf("preempt");
      const waitedBefore = result.frames[anchor.t - 1]?.ready ?? [];
      let cpu;
      if (immediatelyRan) {
        cpu = `CPU가 비어 있어 ${anchor.running} 작업이 바로 CPU를 받았습니다.`;
      } else if (decision) {
        // Someone else was dispatched at this very boundary.
        cpu = `그 시각 CPU는 ${waitedBefore.includes(decision.chosen) ? "먼저 기다리던" : "큐 맨 앞의"} ${decision.chosen} 작업이 받았습니다. 복귀한 작업은 준비 큐에서 차례를 기다립니다.${expired ? ` 같은 시각에 할당량이 끝난 ${expired.id}보다는 앞에 줄을 섭니다.` : ""}`;
      } else {
        const ahead = anchor.ready
          .slice(0, anchor.ready.indexOf(returnedIds[0]))
          .filter((id) => !returnedIds.includes(id));
        cpu = `그 시각 CPU에는 ${anchor.running} 작업이 실행 중이어서, 복귀한 작업은 차례를 기다립니다. 복귀만으로 실행 중인 작업을 선점하지 않습니다.${ahead.length ? ` 먼저 기다리던 ${ahead.join("·")} 작업을 추월하지도 않습니다.` : ""}`;
      }
      copy = {
        title: "입출력 완료는 실행 가능하다는 뜻",
        body: `${anchor.t} ms에 ${idsText(returned)}의 입출력이 끝나 준비 큐에 합류했습니다. ${cpu}`,
        insight:
          "준비 상태가 되어도 CPU 배정은 별개의 결정입니다. 현재 작업이 CPU를 놓을 때 큐 맨 앞에서 다음 작업을 고릅니다.",
      };
      break;
    }
    case "idle": {
      const waiting = anchor.blocked.map((process) => process.id);
      copy = {
        title: "실행할 수 있는 작업이 없습니다",
        body: waiting.length
          ? `${anchor.t} ms에는 준비 큐가 비었습니다. ${waiting.join("·")} 작업은 아직 입출력을 기다립니다. CPU를 받아도 다음 계산을 시작할 수 없습니다. 시간표에서 CPU의 빈 구간과 입출력 대기 구간이 나란히 보입니다.`
          : `${anchor.t} ms에는 준비 큐가 비었습니다. 아직 도착하지 않은 작업만 남아 CPU가 쉽니다.`,
        insight:
          "미완료 작업이 있다고 CPU가 항상 바쁜 것은 아닙니다. CPU 활용률은 실제 실행한 시간을 전체 경과 시간으로 나눠 계산합니다.",
      };
      break;
    }
    case "resume": {
      const again = result.frames
        .filter((entry) => entry.t >= anchor.t && entry.t < end)
        .filter((entry) => entry.events.some((event) => event.type === "preempt" && event.id === entry.running));
      copy = {
        title: "기다림이 끝나면 남은 구간부터",
        body: `${anchor.t} ms에 ${anchor.running} 작업이 다시 CPU를 받았습니다. 입출력 전에 처리한 ${anchor.states[anchor.running].cpuDone} ms는 사라지지 않습니다. 입출력 다음의 CPU 구간을 이어서 실행합니다.`,
        insight: again.length
          ? `${again.map((entry) => entry.t).join("·")} ms에는 할당량이 끝나도 다른 준비 작업이 없어 같은 작업이 다시 CPU를 받습니다. 할당량 만료가 곧 문맥 교환은 아닙니다.`
          : "입출력 대기는 대기 시간(준비 큐)에 들어가지 않습니다. CPU가 쉬는 동안 이 작업의 대기 시간은 늘지 않았습니다.",
      };
      break;
    }
    case "finish":
      copy = describeFinish(anchor, result);
      break;
  }
  return { ...copy, eyebrow };
}

/* ---------- Prediction ---------- */

/** Four consecutive candidates; where the answer sits depends on its value. */
function numberChoices(answer, min) {
  const low = Math.max(min, answer - (answer % 3));
  return [0, 1, 2, 3].map((offset) => low + offset);
}

/**
 * The next CPU decision with more than one candidate after `time` (or the
 * first one). Only arrivals and I/O returns are listed: what the running job
 * does next has to be worked out from its quantum and burst.
 */
export function buildPrediction(result, time) {
  const decision =
    result.decisions.find((entry) => entry.time > time && entry.candidates.length > 1) ||
    result.decisions.find((entry) => entry.candidates.length > 1);
  if (!decision) return null;
  const order = byProcessOrder(result);
  const before = result.frames[decision.time - 1];
  const at = result.frames[decision.time];
  const rr = result.algorithm === "rr";
  const running = before.running;
  const joined = at.events.filter((event) => ["arrive", "unblock"].includes(event.type));
  const released = at.events.find((event) => ["preempt", "block", "complete"].includes(event.type));
  const chosen = decision.chosen;

  let why;
  switch (decision.cause) {
    case "quantum":
      why = `${josa(released.id, "은")} 할당량을 다 써서 준비 큐 맨 뒤로 갑니다.${joined.length ? ` 같은 시각에 들어온 ${idsText(joined)} 작업이 그보다 먼저 줄을 섭니다.` : ""}`;
      break;
    case "block": {
      const tie = rr && before.quantumLeft === 1 && before.states[released.id].burstRemaining === 1;
      why = `${josa(released.id, "은")} CPU 구간을 마치고 입출력을 요청해 CPU를 놓습니다.${tie ? " 할당량도 같은 시각에 끝나지만 구간 종료가 우선입니다." : ""}`;
      break;
    }
    case "complete":
      why = `${josa(released.id, "은")} 마지막 CPU 구간을 마쳐 완료됩니다. 완료된 작업은 준비 큐로 돌아가지 않습니다.`;
      break;
    default:
      why = `CPU가 쉬던 중 ${idsText(joined)} 작업이 준비 큐에 들어옵니다.`;
  }
  const overtakes = joined.length && before.ready.length;
  const explanation = `${why} 배정 직전 준비 큐는 ${decision.candidates.join(" → ")}입니다. 맨 앞의 ${josa(chosen, "가")} CPU를 받습니다.${overtakes ? " 새로 들어온 작업은 먼저 기다리던 작업을 추월하지 않습니다." : ""}`;

  const arrival = result.processes.find((process) => process.id === chosen).arrival;
  let followUp;
  if (at.states[chosen].firstRun === decision.time) {
    const answer = decision.time - arrival;
    followUp = {
      question: `${josa(chosen, "는")} ${arrival}ms에 도착했습니다. 최초 응답 시간은 몇 ms일까요?`,
      answer,
      choices: numberChoices(answer, 0),
      explanation: `최초 응답 = 첫 실행 ${decision.time} − 도착 ${arrival} = ${answer}ms. ${answer ? "그동안 준비 큐에서 기다렸습니다." : "도착하자마자 CPU를 받았습니다."}`,
    };
  } else {
    const segment = result.segments.find((entry) => entry.start === decision.time && entry.id === chosen);
    const burst = at.states[chosen].burstRemaining;
    const answer = segment.end - segment.start;
    const limit = !rr ? "" : burst < result.quantum ? ` 할당량 ${result.quantum}ms보다 먼저 끝납니다.` : " 할당량도 같은 시각에 끝나지만 구간 종료가 우선입니다.";
    const detail =
      segment.reason === "quantum"
        ? `이번 CPU 구간이 ${burst}ms 남아 있어, 할당량 ${result.quantum}ms를 다 쓰고 선점됩니다.`
        : segment.reason === "complete"
          ? `마지막 CPU 구간 ${burst}ms를 마치고 완료됩니다.${limit}`
          : `이번 CPU 구간 ${burst}ms를 마치고 입출력을 요청합니다.${limit}`;
    followUp = {
      question: `이번 차례에 ${josa(chosen, "는")} CPU를 몇 ms 연속으로 쓸까요?`,
      answer,
      choices: numberChoices(answer, 1),
      explanation: `${answer}ms입니다. ${detail}`,
    };
  }

  return {
    decision,
    beforeTime: decision.time - 1,
    running,
    runningNote: running
      ? rr
        ? `할당량 ${before.quantumLeft}ms · 현재 CPU 구간 ${before.states[running].burstRemaining}ms 남음`
        : `현재 CPU 구간 ${before.states[running].burstRemaining}ms 남음`
      : "실행 중인 작업 없음",
    ready: before.ready,
    joined: joined.map((event) => event.id).toSorted(order).map((id) => {
      const event = joined.find((entry) => entry.id === id);
      return event.type === "arrive" ? `${id} 도착` : `${id} 입출력 완료`;
    }),
    // Only jobs that can actually receive the CPU, in a fixed order.
    choices: decision.candidates.toSorted(order),
    explanation,
    followUp,
  };
}

/** Explain one process using only progress that has occurred by the current frame. */
export function processDetails(frame, result, id) {
  const process = result.processes.find((entry) => entry.id === id);
  const state = frame.states[id];
  const ioSegments = result.ioSegments.filter((entry) => entry.id === id);
  const totalCpu = process.cpu.reduce((total, duration) => total + duration, 0);
  const elapsed = Math.max(0, (state.finishedAt ?? frame.t) - process.arrival);
  const finishedIo = ioSegments.filter((entry) => entry.end <= frame.t).length;
  const currentIo = ioSegments.findIndex(
    (entry) => entry.start <= frame.t && frame.t < entry.end,
  );
  const currentPhase =
    state.status === "blocked" ? currentIo * 2 + 1 : finishedIo * 2;
  let cpuLeftToAllocate = state.cpuDone;
  const phases = process.cpu
    .flatMap((duration, index) => {
      const cpuUsed = Math.min(duration, cpuLeftToAllocate);
      cpuLeftToAllocate -= cpuUsed;
      const parts = [{ kind: "cpu", total: duration, used: cpuUsed }];
      if (index < process.io.length) {
        const interval = ioSegments[index];
        const used = interval
          ? Math.min(
              interval.end - interval.start,
              Math.max(0, frame.t - interval.start),
            )
          : 0;
        parts.push({ kind: "io", total: process.io[index], used });
      }
      return parts;
    })
    .map((phase, index) => ({
      ...phase,
      status:
        state.status === "new"
          ? "future"
          : state.status === "done" || index < currentPhase
            ? "past"
            : index === currentPhase
              ? "current"
              : "future",
    }));
  const spentIo = phases
    .filter((phase) => phase.kind === "io")
    .reduce((total, phase) => total + phase.used, 0);
  let body;
  if (state.status === "new") {
    body = `${process.arrival} ms에 준비 큐에 들어올 예정입니다. 아래의 CPU·입출력 구간을 순서대로 거치며, 아직 실행하거나 기다린 시간은 없습니다.`;
  } else if (state.status === "blocked") {
    body = `현재 입출력 구간이 ${state.ioRemaining} ms 남았습니다. 이 동안 CPU를 사용할 준비가 되지 않았으므로 준비 큐에 들어가지 않습니다. 입출력이 끝나면 다음 CPU 구간으로 이어집니다.`;
  } else if (state.status === "done") {
    body = `${state.finishedAt} ms에 모든 작업을 마쳤습니다. CPU는 총 ${state.cpuDone} ms 사용했고, 도착 후 완료까지 ${elapsed} ms가 걸렸습니다.`;
  } else {
    const queueText =
      state.status === "ready"
        ? `준비 큐 ${frame.ready.indexOf(id) + 1}번째에서 차례를 기다립니다.`
        : "지금 CPU를 사용하고 있습니다.";
    body = `${queueText} 이번 CPU 구간은 ${state.burstRemaining} ms, 뒤의 구간까지 합친 전체 CPU 작업은 ${state.cpuRemaining} ms 남았습니다. 구간 막대는 실제로 처리한 양을 표시합니다.`;
  }
  return {
    title: `${id} · ${process.name}`,
    body,
    phases,
    metrics: [
      {
        label: "최초 응답",
        value:
          state.firstRun === null
            ? "아직 실행 전"
            : `${state.firstRun - process.arrival} ms`,
        help: "도착부터 처음 CPU를 받기까지의 시간",
      },
      {
        label: "CPU 실행",
        value: `${state.cpuDone} ms`,
        help: `전체 CPU 작업 ${totalCpu} ms 중 실제로 실행한 시간`,
      },
      {
        label: "대기 시간(준비 큐)",
        value: `${state.readyWait} ms`,
        help: "준비 큐에서 기다린 누적 시간. 입출력 대기는 제외",
      },
      {
        label: "입출력 대기",
        value: `${spentIo} ms`,
        help: "지금까지 입출력을 기다린 누적 시간",
      },
      {
        label: "반환 시간",
        value:
          state.status === "done"
            ? `${elapsed} ms`
            : state.arriving
              ? "도착 중"
              : state.status === "new"
              ? "도착 전"
              : "진행 중",
        help:
          state.status === "done"
            ? "완료 시각 − 도착 시각"
            : `현재까지 경과 ${elapsed} ms. 반환 시간은 완료 후 확정`,
      },
    ],
    insight:
      state.status === "new"
        ? "도착하기 전의 시간은 이 작업의 대기 시간이나 반환 시간에 넣지 않습니다."
        : `${state.status === "done" ? "반환 시간" : "도착 후 경과"} ${elapsed} ms = CPU 실행 ${state.cpuDone} ms + 대기 시간(준비 큐) ${state.readyWait} ms + 입출력 대기 ${spentIo} ms.`,
  };
}

export function eventLabel(event) {
  switch (event.type) {
    case "arrive":
      return `${event.id} 도착 → 준비 큐`;
    case "dispatch":
      return `${event.id} CPU 배정`;
    case "preempt":
      return `${event.id} 할당량 만료 → 준비 큐`;
    case "block":
      return `${event.id} 입출력 대기 시작`;
    case "unblock":
      return `${event.id} 입출력 완료 → 준비 큐`;
    case "complete":
      return `${event.id} 작업 완료`;
    case "idle":
      return "CPU 유휴 시작";
    default:
      return "상태 변경";
  }
}
