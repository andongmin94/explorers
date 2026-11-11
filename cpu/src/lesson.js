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

export function describeComparison(rr, fcfs) {
  if (rr.segments.some((segment) => segment.reason === "quantum")) {
    return `준비 큐가 비어 CPU가 쉰 시간은 라운드 로빈 ${rr.stats.idle}ms, FCFS ${fcfs.stats.idle}ms입니다.`;
  }
  return `모든 CPU 구간이 ${rr.quantum}ms 안에 끝나 라운드 로빈에서도 선점이 일어나지 않습니다. 두 방식의 실행 순서와 완료 순서가 같습니다.`;
}

/** Explain the same boundary snapshot used by the scene and execution trace. */
export function describeFrame(frame, result) {
  const { events, running, states } = frame;
  const eventOf = (type) => events.find((event) => event.type === type);
  const preempt = eventOf("preempt");
  const block = eventOf("block");
  const complete = eventOf("complete");
  const returned = events.filter((event) => event.type === "unblock");
  const arrived = events.filter((event) => event.type === "arrive");
  const rr = result.algorithm === "rr";
  const eyebrow = `${frame.t} ms · ${rr ? "라운드 로빈" : "선입선처리"}`;

  if (frame.completed.length === result.processes.length) {
    return {
      eyebrow: `${frame.t} ms · 실행 완료`,
      title: "응답과 완료, 따로 비교하기",
      body: `모든 작업이 끝났습니다. 평균 최초 응답은 ${formatTime(result.stats.averageResponse)} ms, 평균 반환 시간은 ${formatTime(result.stats.averageTurnaround)} ms입니다. CPU는 전체 ${result.stats.makespan} ms 중 ${result.stats.busy} ms 동안 실행됐습니다.`,
      insight:
        "첫 실행이 빠르다고 전체 완료도 빨라지는 것은 아닙니다. 같은 작업을 다른 방식으로 실행해 비교해 보세요.",
    };
  }

  if (!running) {
    const pending = result.processes.filter(
      (process) => states[process.id].status === "new",
    );
    const nextTime = Math.min(
      ...frame.blocked.map((process) => process.until),
      ...pending.map((process) => process.arrival),
    );
    return {
      eyebrow: `${frame.t} ms · CPU 유휴`,
      title: "작업이 남아도 CPU는 쉽니다",
      body: frame.blocked.length
        ? `${frame.blocked.map((process) => process.id).join("·")} 작업은 입출력을 기다리고 있고 준비 큐는 비어 있습니다. 다음 작업이 실행 가능해지는 ${nextTime} ms까지 CPU가 쉽니다.`
        : `아직 도착하지 않은 작업만 남아 있습니다. ${nextTime} ms에 다음 작업이 도착할 때까지 CPU가 쉽니다.`,
      insight:
        "입출력 대기 중인 작업은 CPU를 받아도 진행할 수 없습니다. 이 시간은 준비 큐 대기 시간에 포함하지 않습니다.",
    };
  }

  if (preempt) {
    if (preempt.id === running) {
      return {
        eyebrow,
        title: `${running}, 다시 CPU 배정`,
        body: `${result.quantum} ms의 시간 할당량이 끝나 ${running} 작업이 준비 큐 뒤로 돌아갔습니다. 다른 준비 작업이 없어 새 할당량으로 바로 이어서 실행합니다.`,
        insight:
          "시간 할당량 만료가 항상 다른 프로세스로의 전환을 뜻하지는 않습니다.",
      };
    }
    const simultaneous = arrived.length || returned.length;
    return {
      eyebrow,
      title: `${preempt.id}에서 ${running}으로 차례 넘기기`,
      body: `${preempt.id}의 ${result.quantum} ms가 끝났습니다. 남은 작업을 버리지 않고 준비 큐 뒤에 넣은 뒤, 큐 맨 앞의 ${running} 작업을 실행합니다.`,
      insight: simultaneous
        ? "이 모델에서는 같은 시각의 도착·입출력 복귀를 먼저 큐에 넣고, 할당량이 끝난 작업을 마지막에 넣습니다."
        : "선점된 작업의 진행 상태는 보존됩니다. 다음 차례에는 남아 있는 CPU 작업부터 이어갑니다.",
    };
  }

  if (returned.length && returned.every((event) => event.id !== running)) {
    return {
      eyebrow,
      title: "준비됐다고 바로 실행되지는 않습니다",
      body: `${idsText(returned)}의 입출력이 끝나 준비 큐 뒤에 합류했습니다. CPU에서는 ${running} 작업이 계속 실행 중입니다. 먼저 줄을 서 있던 작업의 차례를 건너뛰지 않습니다.`,
      insight: rr
        ? "이 라운드 로빈에서는 복귀만으로 현재 작업을 선점하지 않습니다. CPU 구간이 끝나거나 할당량이 만료되면 다음 작업을 고릅니다."
        : "선입선처리는 현재 CPU 구간이 끝날 때까지 실행합니다. 입출력에서 돌아온 작업도 준비 큐에서 차례를 기다립니다.",
    };
  }

  if (block) {
    const remaining = states[block.id].ioRemaining;
    return {
      eyebrow,
      title: `${block.id} 입출력 · ${running} CPU 실행`,
      body: `${block.id} 작업이 이번 CPU 구간을 마치고 ${remaining} ms의 입출력 대기로 이동했습니다. CPU를 계속 붙잡지 않으므로 준비 큐 맨 앞의 ${running} 작업이 실행할 수 있습니다.`,
      insight:
        "한 작업이 입출력을 기다리는 동안 다른 작업이 CPU를 사용합니다. 입출력 대기와 준비 큐 대기는 서로 다른 상태입니다.",
    };
  }

  if (complete) {
    return {
      eyebrow,
      title: `${complete.id} 완료, 다음 작업으로`,
      body: `${complete.id}의 모든 CPU 작업이 끝났습니다. 완료된 작업은 준비 큐로 돌아가지 않고, 기다리던 ${running} 작업이 CPU를 받습니다.`,
      insight:
        "반환 시간은 완료 시각에서 도착 시각을 뺀 값입니다. CPU 실행·입출력·준비 큐 대기가 모두 포함됩니다.",
    };
  }

  if (arrived.length) {
    const started = arrived.some((event) => event.id === running);
    return {
      eyebrow,
      title: started
        ? `${running}의 첫 실행`
        : `${idsText(arrived)} 도착, 준비 큐에 합류`,
      body: started
        ? `${idsText(arrived)} 도착으로 준비 큐가 갱신됐습니다. 큐 맨 앞의 ${running} 작업이 CPU를 받았고, 나머지 작업은 도착 시각에 맞춰 준비 큐에 들어옵니다.`
        : `${idsText(arrived)} 도착으로 준비 큐가 갱신됐지만 CPU는 ${running} 작업이 사용하고 있습니다. 새 작업은 준비 큐 뒤에 들어가 차례를 기다립니다.`,
      insight: started
        ? "최초 응답 시간은 도착부터 처음 CPU를 받기까지입니다. 여기서 응답은 화면 출력이나 작업 완료를 뜻하지 않습니다."
        : rr
          ? "이 라운드 로빈에서는 새 작업의 도착만으로 선점하지 않습니다. 할당량은 현재 실행 중인 작업의 CPU 사용 시간을 셉니다."
          : "선입선처리는 먼저 준비된 작업부터 고릅니다. 실행 중인 작업은 입출력을 요청하거나 CPU 구간을 마칠 때까지 계속합니다.",
    };
  }

  if (returned.length) {
    return {
      eyebrow,
      title: `${running}, 입출력을 마치고 복귀`,
      body: `${idsText(returned)}의 입출력이 끝났습니다. 준비 상태로 돌아왔고, 비어 있던 CPU가 큐 맨 앞의 ${running} 작업을 바로 실행합니다.`,
      insight:
        "입출력 완료는 실행 가능해졌다는 뜻입니다. CPU가 비어 있고 큐 맨 앞일 때 바로 실행될 수 있습니다.",
    };
  }

  const state = states[running];
  return {
    eyebrow,
    title: `${running} 실행 중`,
    body: `${running}의 이번 CPU 구간은 ${state.burstRemaining} ms 남았습니다.${rr ? ` 현재 시간 할당량은 ${frame.quantumLeft} ms 남아 있습니다.` : " 선입선처리는 이 CPU 구간을 중간에 선점하지 않습니다."}`,
    insight: frame.ready.length
      ? `${frame.ready.join(" → ")} 순서로 CPU를 기다립니다. 준비 큐에 있는 동안만 CPU 대기 시간이 늘어납니다.`
      : "지금 준비 큐에는 기다리는 작업이 없습니다. 입출력 중인 작업의 남은 시간은 CPU 실행과 동시에 줄어듭니다.",
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

/** Keep the conceptual explanation stable while the live state continues to change. */
export function describeChapter(frame, result) {
  const points = chapterPoints(result);
  const index = points.findLastIndex((point) => point.time <= frame.t);
  const chapter = points[index];
  const anchor = result.frames.find((entry) => entry.t === chapter.time);
  const eventOf = (type) => anchor.events.find((event) => event.type === type);
  const rr = result.algorithm === "rr";
  const eyebrow = `핵심 장면 ${index + 1}/${points.length} · ${chapter.time} ms`;
  let copy;

  switch (chapter.kind) {
    case "start":
      copy = {
        title: "한 번에 하나, 차례로 실행",
        body: rr
          ? `CPU는 한 번에 한 작업만 실행합니다. 라운드 로빈은 한 차례에 최대 ${result.quantum} ms를 주고, 작업이 남으면 준비 큐 뒤에서 다음 차례를 기다리게 합니다. 입출력이 필요하면 할당량이 남아도 CPU를 놓습니다.`
          : "CPU는 한 번에 한 작업만 실행합니다. 선입선처리는 먼저 준비된 작업부터 고르고, 입출력을 요청하거나 현재 CPU 구간을 마칠 때까지 실행합니다. 새 작업이 도착해도 실행 중인 작업을 중단하지 않습니다.",
        insight:
          "작업의 전체 CPU 시간, 이번 CPU 구간, 한 차례의 시간 할당량은 서로 다릅니다. 작업을 눌러 구간별 진행을 살펴보세요.",
      };
      break;
    case "arrival": {
      const arrival = eventOf("arrive");
      copy = {
        title: "도착은 실행 예약입니다",
        body: `${anchor.t} ms에 ${arrival.id} 작업이 도착했지만 CPU에서는 ${anchor.running} 작업이 실행 중이었습니다. 새 작업은 준비 큐 뒤에 합류합니다. 도착 시각과 첫 실행 시각이 다른 이유입니다.`,
        insight: rr
          ? "할당량은 실행 중인 작업이 CPU를 쓴 시간을 셉니다. 다른 작업이 도착했다고 남은 할당량을 취소하지 않습니다."
          : "선입선처리는 먼저 준비된 순서로 CPU를 줍니다. 입출력 요청·완료 전까지 현재 작업을 계속 실행하는 비선점 방식입니다.",
      };
      break;
    }
    case "preempt": {
      const expired = eventOf("preempt");
      const decision = result.decisions.find(
        (entry) => entry.time === anchor.t,
      );
      copy = {
        title: "끝난 것은 작업이 아니라 이번 차례",
        body: `${anchor.t} ms에 ${expired.id}의 ${result.quantum} ms 할당량이 끝났습니다. 진행한 작업은 보존하고, 남은 작업을 준비 큐 뒤로 돌립니다. 배정 직전 순서는 ${decision.candidates.join(" → ")}였고, 맨 앞의 ${decision.chosen} 작업이 CPU를 받았습니다.`,
        insight:
          "이 모델은 같은 시각의 도착·입출력 복귀를 먼저 큐에 넣고, 시간이 만료된 작업을 마지막에 넣습니다.",
      };
      break;
    }
    case "block": {
      const blocked = eventOf("block");
      copy = {
        title: "입출력과 CPU는 동시에 진행",
        body: `${anchor.t} ms에 ${blocked.id} 작업이 CPU 구간을 마치고 입출력을 요청했습니다. 기다리는 동안 CPU를 놓았고, ${anchor.running ? `${anchor.running} 작업이 그 CPU를 이어받았습니다.` : "다른 준비 작업이 없어 CPU는 쉬게 됐습니다."} 한 작업의 입출력 대기 중에도 다른 작업은 계산할 수 있습니다.`,
        insight:
          "입출력 대기는 데이터를 기다리는 상태이고, 준비 큐 대기는 CPU를 기다리는 상태입니다. 둘은 따로 기록합니다.",
      };
      break;
    }
    case "unblock": {
      const returned = anchor.events.filter(
        (event) => event.type === "unblock",
      );
      const immediatelyRan = returned.some(
        (event) => event.id === anchor.running,
      );
      copy = {
        title: "입출력 완료는 실행 가능하다는 뜻",
        body: `${anchor.t} ms에 ${idsText(returned)}의 입출력이 끝나 준비 큐에 합류했습니다. ${immediatelyRan ? `비어 있던 CPU를 ${anchor.running} 작업이 바로 받았습니다.` : `그 시각 CPU는 ${anchor.running} 작업에 배정돼 있었고, 복귀한 작업은 차례를 기다렸습니다.`} 복귀한 작업이 이미 기다리던 작업을 추월하지는 않습니다.`,
        insight:
          "준비 상태가 되어도 CPU 배정은 별개의 결정입니다. 현재 작업이 CPU를 놓을 때 큐 맨 앞에서 다음 작업을 고릅니다.",
      };
      break;
    }
    case "idle":
      copy = {
        title: "실행할 수 있는 작업이 없습니다",
        body: `${anchor.t} ms에는 준비 큐가 비었습니다. ${anchor.blocked.map((process) => process.id).join("·")} 작업은 아직 입출력을 기다리고 있어 CPU를 받아도 다음 계산을 시작할 수 없습니다. CPU의 빈 구간과 입출력 대기 구간이 시간표에서 나란히 나타납니다.`,
        insight:
          "미완료 작업이 있다고 CPU가 항상 바쁜 것은 아닙니다. CPU 활용률은 실제 실행한 시간을 전체 경과 시간으로 나눠 계산합니다.",
      };
      break;
    case "resume":
      copy = {
        title: "기다림이 끝나면 남은 구간부터",
        body: `${anchor.t} ms에 ${anchor.running} 작업이 다시 CPU를 받았습니다. 앞서 처리한 ${anchor.states[anchor.running].cpuDone} ms는 사라지지 않습니다. 입출력 이후의 CPU 구간을 이어서 실행하며, 이미 끝난 구간을 다시 계산하지 않습니다.`,
        insight:
          "시간 할당량이 끝나도 다른 준비 작업이 없다면 같은 작업이 다시 CPU를 받습니다. 할당량 만료와 작업 전환은 같은 뜻이 아닙니다.",
      };
      break;
    case "finish":
      copy = describeFrame(anchor, result);
      break;
  }
  return { ...copy, eyebrow };
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
        label: "CPU 대기",
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
        : `${state.status === "done" ? "반환 시간" : "도착 후 경과"} ${elapsed} ms = CPU 실행 ${state.cpuDone} ms + 준비 큐 대기 ${state.readyWait} ms + 입출력 대기 ${spentIo} ms.`,
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
