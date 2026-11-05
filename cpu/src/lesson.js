const formatTime = (value) => Number(value.toFixed(2)).toString();
const idsText = (events) => events.map((event) => event.id).join("·");

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

/** Milestones are discovered from events so changing the quantum keeps them true. */
export function buildMilestones(result) {
  const points = new Map([[result.frames[0].t, "첫 작업 실행"]]);
  const first = (type, title) => {
    const frame = result.frames.find((entry) =>
      entry.events.some((event) => event.type === type),
    );
    if (frame && !points.has(frame.t)) points.set(frame.t, title);
  };
  if (result.algorithm === "rr") first("preempt", "시간 할당량과 선점");
  first("block", "입출력과 CPU의 동시 진행");
  first("unblock", "입출력 완료와 준비 큐");
  first("complete", "첫 번째 작업 완료");
  first("idle", "CPU가 쉬는 이유");
  points.set(result.frames.at(-1).t, "완료 결과 비교");
  return [...points]
    .sort(([a], [b]) => a - b)
    .map(([time, title]) => ({ time, title }));
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
