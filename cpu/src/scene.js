import "./scene.css";

const COLORS = {
  P1: "var(--p1, #3971d9)",
  P2: "var(--p2, #168264)",
  P3: "var(--p3, #8055c6)",
};
const STATE_NAMES = {
  new: "도착 예정",
  ready: "준비",
  running: "실행",
  blocked: "입출력 대기",
  done: "완료",
};
const SVG_NS = "http://www.w3.org/2000/svg";
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
let sceneSerial = 0;

function station({ x, y, width, height }, title, subtitle, type = "") {
  return `<g class="scene-station scene-station-${type}">
    <rect class="scene-station-body" x="${x}" y="${y}" width="${width}" height="${height}" rx="4" />
    <path class="scene-station-rule" d="M${x} ${y + 32}H${x + width}" />
    <text class="scene-station-title" x="${x + 12}" y="${y + 21}">${title}</text>
    ${subtitle ? `<text class="scene-station-sub" x="${x + width - 11}" y="${y + 21}" text-anchor="end">${subtitle}</text>` : ""}
  </g>`;
}

function getLayout(width) {
  const mobile = width < 540;
  const inset = mobile ? 14 : 18;
  const gap = mobile ? 14 : 18;
  const column =
    (width - inset * 2 - gap * (mobile ? 1 : 2)) / (mobile ? 2 : 3);
  const tokenWidth = Math.min(160, column - 22);
  if (mobile) {
    const right = inset + column + gap;
    return {
      width,
      height: 614,
      mobile,
      tokenWidth,
      new: { x: inset, y: 14, width: width - inset * 2, height: 102 },
      ready: { x: inset, y: 151, width: column, height: 212 },
      cpu: { x: right, y: 169, width: column, height: 190 },
      blocked: { x: inset, y: 400, width: column, height: 154 },
      done: { x: right, y: 400, width: column, height: 198 },
    };
  }
  const middle = inset + column + gap;
  const right = middle + column + gap;
  return {
    width,
    height: 456,
    mobile,
    tokenWidth,
    new: { x: inset, y: 18, width: column, height: 146 },
    ready: { x: inset, y: 200, width: column, height: 212 },
    cpu: { x: middle, y: 164, width: column, height: 200 },
    blocked: { x: right, y: 18, width: column, height: 154 },
    done: { x: right, y: 216, width: column, height: 198 },
  };
}

function cpuDrawing(cpu) {
  const { x, y, width, height } = cpu;
  const left = x + 5,
    right = x + width - 5,
    top = y + 13,
    bottom = y + height - 32;
  const pins = Array.from({ length: 5 }, (_, index) => {
    const pinY = top + 24 + index * 24;
    return `<path class="scene-chip-pin" d="M${left - 6} ${pinY}H${left + 8}M${right - 8} ${pinY}H${right + 6}" />`;
  }).join("");
  return `<g class="scene-cpu-hardware">
    <path class="scene-chip-shadow" d="M${left + 8} ${top + 10}H${right + 7}V${bottom + 12}H${left + 8}Z"/>
    ${pins}
    <path class="scene-chip-side" d="M${left} ${bottom}H${right}L${right + 7} ${bottom + 8}H${left + 7}Z" />
    <rect class="scene-chip-body" x="${left}" y="${top}" width="${right - left}" height="${bottom - top}" rx="5" />
    <rect class="scene-chip-core" x="${left + 9}" y="${top + 9}" width="${right - left - 18}" height="${bottom - top - 18}" rx="2" />
    <text class="scene-chip-name" x="${x + width / 2}" y="${top - 9}" text-anchor="middle">CPU · 코어 1개</text>
    <g class="scene-chip-lights">${[0, 1, 2, 3].map((index) => `<rect x="${left + 15 + index * 13}" y="${bottom - 23}" width="7" height="7" rx="1" />`).join("")}</g>
  </g>`;
}

function connectorPaths(layout) {
  const a = layout.ready,
    c = layout.cpu,
    b = layout.blocked,
    n = layout.new,
    d = layout.done;
  if (layout.mobile) {
    return {
      arrive: `M${a.x + a.width / 2} ${n.y + n.height}V${a.y - 5}`,
      dispatch: `M${a.x + a.width} ${c.y + 70}H${c.x + 1}`,
      preempt: `M${c.x} ${c.y + 133}H${a.x + a.width + 4}`,
      block: `M${c.x + c.width / 2} ${c.y + c.height - 20}V380H${b.x + b.width / 2}V${b.y - 5}`,
      unblock: `M${b.x + b.width / 2} ${b.y}V${a.y + a.height + 5}`,
      complete: `M${c.x + c.width - 21} ${c.y + c.height - 20}V${d.y - 5}`,
    };
  }
  return {
    arrive: `M${a.x + a.width / 2} ${n.y + n.height}V${a.y - 5}`,
    dispatch: `M${a.x + a.width} ${c.y + 70}H${c.x + 1}`,
    preempt: `M${c.x + c.width / 2} ${c.y + c.height - 22}V435H${a.x + a.width / 2}V${a.y + a.height + 5}`,
    block: `M${c.x + c.width} ${c.y + 70}H${b.x - 9}V${b.y + 102}H${b.x - 3}`,
    unblock: `M${b.x + b.width / 2} ${b.y}V7H${a.x + a.width + 8}V${a.y + 18}H${a.x + a.width - 2}`,
    complete: `M${c.x + c.width} ${c.y + 126}H${d.x - 4}`,
  };
}

function slotsMarkup(layout) {
  return ["ready", "blocked", "done"]
    .map((state) => {
      const zone = layout[state];
      const count = state === "blocked" ? 2 : 3;
      return Array.from({ length: count }, (_, index) => {
        const y = zone.y + 43 + index * 51;
        const x = zone.x + (zone.width - layout.tokenWidth) / 2;
        return `<rect class="scene-empty-slot" x="${x}" y="${y}" width="${layout.tokenWidth}" height="43" rx="3" />${state === "ready" ? `<text class="scene-slot-order" x="${zone.x + 5}" y="${y + 26}">${index + 1}</text>` : ""}`;
      }).join("");
    })
    .join("");
}

export function createSchedulerScene(hostElement, processes) {
  const serial = ++sceneSerial;
  const arrowId = `scheduler-arrow-${serial}`;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  hostElement.classList.add("scheduler-scene");
  hostElement.setAttribute("role", "img");
  hostElement.innerHTML = `<svg class="scene-map" xmlns="${SVG_NS}" aria-hidden="true"></svg>
    <div class="scene-tokens" aria-hidden="true"></div>
    <div class="scene-cpu-readout" aria-hidden="true"><strong></strong><div class="scene-slice-track"><i></i></div><span></span></div>
    <div class="scene-empty-note" aria-hidden="true"></div>`;
  const svg = hostElement.querySelector(".scene-map");
  const tokensLayer = hostElement.querySelector(".scene-tokens");
  const readout = hostElement.querySelector(".scene-cpu-readout");
  const idleNote = hostElement.querySelector(".scene-empty-note");
  const tokens = new Map(
    processes.map((process) => {
      const element = document.createElement("div");
      element.className = "scene-process";
      element.dataset.process = process.id;
      element.style.setProperty(
        "--process-color",
        COLORS[process.id] || "#3971d9",
      );
      element.innerHTML = `<b>${escape(process.id)}</b><span><strong>${escape(process.name)}</strong><small></small></span>`;
      tokensLayer.append(element);
      return [process.id, element];
    }),
  );
  let layout,
    currentFrame,
    intervalProgress = 0,
    quantumBudget = 0,
    destroyed = false;

  function drawMap() {
    const width = Math.max(280, Math.round(hostElement.clientWidth));
    layout = getLayout(width);
    hostElement.style.height = `${layout.height}px`;
    hostElement.dataset.compact = String(layout.mobile);
    svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
    const paths = connectorPaths(layout);
    svg.innerHTML = `<defs><marker id="${arrowId}" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6Z"/></marker><pattern id="scheduler-grid-${serial}" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" /></pattern></defs>
      <rect class="scene-grid" width="100%" height="100%" fill="url(#scheduler-grid-${serial})"/>
      <g class="scene-connectors">${Object.entries(paths)
        .map(
          ([type, path]) =>
            `<path class="scene-connector" data-route="${type}" d="${path}" marker-end="url(#${arrowId})" />`,
        )
        .join("")}</g>
      ${station(layout.new, "도착 예정", "", "new")}
      ${station(layout.ready, "준비 큐", "선입선출", "ready")}
      ${station(layout.blocked, "입출력 대기", "", "blocked")}
      ${station(layout.done, "완료", "", "done")}
      ${slotsMarkup(layout)}
      ${cpuDrawing(layout.cpu)}
      <text class="scene-route-label" x="${layout.ready.x + layout.ready.width / 2 + 8}" y="${layout.ready.y - 12}">도착</text>
      ${!layout.mobile ? `<text class="scene-route-label scene-rule-text" x="${layout.cpu.x + layout.cpu.width / 2}" y="428" text-anchor="middle"></text>` : ""}`;
    Object.assign(readout.style, {
      left: `${layout.cpu.x + 18}px`,
      top: `${layout.cpu.y + 78}px`,
      width: `${layout.cpu.width - 36}px`,
    });
    Object.assign(idleNote.style, {
      left: `${layout.cpu.x + 13}px`,
      top: `${layout.cpu.y + 34}px`,
      width: `${layout.cpu.width - 26}px`,
    });
    if (currentFrame) positionFrame(currentFrame, false, 0);
  }

  function getPosition(id, frame) {
    const state = frame.states[id].status;
    let index = 0,
      zone;
    if (state === "running") {
      zone = layout.cpu;
      return {
        x: zone.x + (zone.width - layout.tokenWidth) / 2,
        y: zone.y + 32,
      };
    }
    if (state === "new") {
      zone = layout.new;
      index = processes
        .filter((process) => frame.states[process.id].status === "new")
        .findIndex((process) => process.id === id);
      if (layout.mobile)
        return {
          x: zone.x + 10 + index * (layout.tokenWidth + 8),
          y: zone.y + 43,
        };
    } else if (state === "ready") {
      zone = layout.ready;
      index = frame.ready.indexOf(id);
    } else if (state === "blocked") {
      zone = layout.blocked;
      index = frame.blocked.findIndex((process) => process.id === id);
    } else {
      zone = layout.done;
      index = frame.completed.indexOf(id);
    }
    return {
      x: zone.x + (zone.width - layout.tokenWidth) / 2,
      y: zone.y + 43 + Math.max(0, index) * 51,
    };
  }

  function positionFrame(frame, animate, duration) {
    for (const process of processes) {
      const state = frame.states[process.id];
      const token = tokens.get(process.id);
      const { x, y } = getPosition(process.id, frame);
      const from = getComputedStyle(token).transform;
      token.getAnimations().forEach((animation) => animation.cancel());
      token.style.width = `${layout.tokenWidth}px`;
      token.style.transform = `translate(${x}px, ${y}px)`;
      token.dataset.state = state.status;
      token.querySelector("small").textContent =
        state.status === "new"
          ? `${process.arrival} ms에 도착`
          : state.status === "blocked"
            ? `I/O ${state.ioRemaining} ms 남음`
            : state.status === "done"
              ? `${state.finishedAt} ms에 완료`
              : `CPU ${state.cpuRemaining} ms 남음`;
      if (
        animate &&
        from !== "none" &&
        !reducedMotion.matches &&
        duration > 0
      ) {
        token.animate(
          [{ transform: from }, { transform: token.style.transform }],
          { duration, easing: "cubic-bezier(.2,.8,.2,1)" },
        );
      }
    }
    hostElement.dataset.running = frame.running || "";
    const ruleText = svg.querySelector(".scene-rule-text");
    if (ruleText) {
      ruleText.textContent = hostElement.dataset.algorithm === "fcfs"
        ? "CPU 버스트를 끝낼 때까지 실행"
        : "할당시간 만료 → 큐의 뒤로";
    }
    idleNote.hidden = !!frame.running;
    idleNote.innerHTML =
      frame.completed.length === processes.length
        ? "<b>작업 완료</b><span>모든 프로세스 종료</span>"
        : "<b>CPU 대기</b><span>실행할 준비 작업 없음</span>";
    for (const path of svg.querySelectorAll(".scene-connector")) {
      path.classList.remove("is-active");
      path.getAnimations().forEach((animation) => animation.cancel());
    }
    if (animate) {
      for (const event of frame.events || []) {
        const type = event.type === "dispatch" ? "dispatch" : event.type;
        const path = svg.querySelector(`[data-route="${type}"]`);
        if (!path) continue;
        path.classList.add("is-active");
        if (!reducedMotion.matches)
          path.animate([{ strokeDashoffset: 24 }, { strokeDashoffset: 0 }], {
            duration: Math.max(250, duration),
            iterations: 1,
          });
      }
    }
    renderProgress();
  }

  function renderProgress() {
    if (!currentFrame) return;
    const frame = currentFrame;
    readout.hidden = !frame.running;
    if (!frame.running) return;
    const remaining =
      frame.quantumLeft ?? frame.states[frame.running].burstRemaining;
    const left = Math.max(0, remaining - intervalProgress);
    const progress = 1 - left / Math.max(1, quantumBudget);
    readout.querySelector("strong").textContent = "실행 중";
    readout.querySelector("i").style.transform =
      `scaleX(${Math.min(1, Math.max(0, progress))})`;
    readout.querySelector("span").textContent =
      `${frame.quantumLeft == null ? "버스트" : "할당시간"} ${Number(left.toFixed(1))} ms 남음`;
  }

  function update(
    frame,
    previousFrame = null,
    { animate = true, duration = 600, quantum } = {},
  ) {
    if (destroyed) return;
    currentFrame = frame;
    hostElement.dataset.algorithm = quantum === null ? "fcfs" : "rr";
    intervalProgress = 0;
    if (frame.running) {
      if (frame.quantumLeft == null) {
        let consumed = frame.states[frame.running].cpuDone;
        for (const burst of processes.find(
          (process) => process.id === frame.running,
        ).cpu) {
          if (consumed < burst) {
            quantumBudget = burst;
            break;
          }
          consumed -= burst;
        }
      } else if (quantum != null) {
        quantumBudget = quantum;
      } else if (
        !previousFrame ||
        frame.t === 0 ||
        frame.events?.some((event) => event.type === "dispatch")
      ) {
        quantumBudget = frame.quantumLeft;
      }
    }
    const summary = processes
      .map(
        (process) =>
          `${process.id} ${STATE_NAMES[frame.states[process.id].status]}`,
      )
      .join(", ");
    hostElement.setAttribute(
      "aria-label",
      `${frame.t}밀리초의 CPU 스케줄링. ${summary}. 준비 큐 순서 ${frame.ready.join(", ") || "없음"}.`,
    );
    positionFrame(frame, animate && !!previousFrame, duration);
  }

  drawMap();
  const observer = new ResizeObserver((entries) => {
    if (Math.abs(entries[0].contentRect.width - layout.width) > 1) drawMap();
  });
  observer.observe(hostElement);
  return {
    update,
    setProgress(progress) {
      intervalProgress = Math.max(0, Math.min(1, progress));
      renderProgress();
    },
    destroy() {
      destroyed = true;
      observer.disconnect();
      for (const element of tokens.values())
        element.getAnimations().forEach((animation) => animation.cancel());
      hostElement.replaceChildren();
    },
  };
}
