import "./scene.css";

const COLORS = {
  P1: "var(--p1, #3971d9)",
  P2: "var(--p2, #168264)",
  P3: "var(--p3, #8055c6)",
};
const STATE_NAMES = {
  new: "도착 예정",
  ready: "준비 큐",
  running: "CPU 실행",
  blocked: "입출력 진행",
  done: "완료",
};
const MOVES = new Set([
  "arrive",
  "unblock",
  "preempt",
  "dispatch",
  "block",
  "complete",
]);
const WEIGHTS = {
  arrive: 1,
  unblock: 1.2,
  preempt: 1.15,
  dispatch: 1.25,
  block: 1.1,
  complete: 1,
};
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
let sceneSerial = 0;

function layoutFor(width) {
  if (width < 540) {
    const tokenWidth = Math.min(132, (width - 54) / 2),
      cpuX = width * 0.725;
    return {
      width,
      height: 582,
      mobile: true,
      tokenWidth,
      tokenHeight: 44,
      arrival: { x: 16, y: 34, gap: tokenWidth + 12 },
      ready: { x: 18, y: 174, gap: 52 },
      running: { x: cpuX - tokenWidth / 2, y: 177 },
      blocked: { x: width - tokenWidth - 18, y: 407, gap: 50 },
      done: {
        x: 18,
        y: 544,
        gap: (width - 36) / 3,
        width: Math.min(88, (width - 48) / 3),
      },
      cpu: { x: cpuX, y: 274, width: Math.min(152, width * 0.43) },
      memory: { x: 10, y: 162, width: tokenWidth + 16, height: 169 },
      ssd: { x: 86, y: 437, width: 136 },
      meter: { x: cpuX - 73, y: 324, width: 146 },
      callout: { x: 16, y: 92, width: width - 32 },
      returnY: 351,
    };
  }
  const tokenWidth = Math.min(158, Math.max(128, width * 0.18)),
    cpuX = width * 0.53;
  return {
    width,
    height: 420,
    mobile: false,
    tokenWidth,
    tokenHeight: 44,
    arrival: { x: 20, y: 62, gap: tokenWidth + 10 },
    ready: { x: 28, y: 146, gap: 52 },
    running: { x: cpuX - tokenWidth / 2, y: 127 },
    blocked: { x: width - tokenWidth - 24, y: 157, gap: 51 },
    done: { x: width - 114, y: 302, gap: 36, width: 86, vertical: true },
    cpu: { x: cpuX, y: 245, width: Math.min(246, width * 0.33) },
    memory: { x: 20, y: 134, width: tokenWidth + 16, height: 169 },
    ssd: {
      x: width - tokenWidth / 2 - 24,
      y: 101,
      width: Math.min(176, width * 0.25),
    },
    meter: { x: cpuX - 98, y: 337, width: 196 },
    callout: { x: 20, y: 0, width: Math.min(330, width - 40) },
    returnY: 350,
  };
}

function memoryDrawing({ x, y, width, height }) {
  const right = x + width,
    bottom = y + height;
  return `<g class="scene-memory">
    <path class="device-shadow" d="M${x + 6} ${y + 12}L${right + 13} ${y + 1}V${bottom + 12}L${x + 6} ${bottom + 23}Z"/>
    <path class="device-side" d="M${right} ${y - 6}L${right + 8} ${y + 1}V${bottom + 12}L${right} ${bottom + 5}Z"/>
    <path class="device-top" d="M${x} ${y + 5}L${right} ${y - 6}L${right + 8} ${y + 1}L${x + 8} ${y + 12}Z"/>
    <path class="device-front" d="M${x} ${y + 5}L${right} ${y - 6}V${bottom + 5}L${x} ${bottom + 16}Z"/>
    ${[0, 1, 2].map((i) => `<path class="memory-trace" d="M${x + 9} ${y + 23 + i * 52}H${right - 9}M${x + 9} ${y + 45 + i * 52}H${right - 9}"/>`).join("")}
    ${[0, 1, 2, 3, 4, 5].map((i) => `<path class="memory-contact" d="M${x + 16 + (i * (width - 35)) / 6} ${bottom + 14}v8"/>`).join("")}
  </g>`;
}

function cpuDrawing({ x, y, width }) {
  const w = width / 2,
    h = width * 0.285,
    thickness = 15;
  const pin = (side, index) => {
    const t = (index + 1) / 8;
    const point =
      side === 0
        ? { x: x - w + t * w, y: y - t * h }
        : { x: x + t * w, y: y + h - t * h };
    const direction = side === 0 ? -1 : 1;
    return `<path class="cpu-pin" d="M${point.x} ${point.y}l${-12 * direction} ${-7 * direction}m${x * 2 - point.x * 2} ${y * 2 - point.y * 2}l${12 * direction} ${7 * direction}"/>`;
  };
  return `<g class="scene-chip">
    <path class="device-shadow" d="M${x - w + 6} ${y + 14}L${x + 7} ${y - h + 13}L${x + w + 14} ${y + 18}L${x + 13} ${y + h + 31}Z"/>
    ${[0, 1].flatMap((side) => Array.from({ length: 7 }, (_, i) => pin(side, i))).join("")}
    <path class="device-front" d="M${x - w} ${y}L${x} ${y + h}V${y + h + thickness}L${x - w} ${y + thickness}Z"/>
    <path class="device-side" d="M${x} ${y + h}L${x + w} ${y}V${y + thickness}L${x} ${y + h + thickness}Z"/>
    <path class="device-top" d="M${x - w} ${y}L${x} ${y - h}L${x + w} ${y}L${x} ${y + h}Z"/>
    <path class="cpu-die" d="M${x - w * 0.57} ${y}L${x} ${y - h * 0.57}L${x + w * 0.57} ${y}L${x} ${y + h * 0.57}Z"/>
    <text class="cpu-die-label" x="${x}" y="${y + 6}" text-anchor="middle">CPU</text>
    <path class="cpu-dock" d="M${x} ${y - h - 3}V${y - h - 15}" />
  </g>`;
}

function ssdDrawing({ x, y, width }) {
  const w = width / 2,
    h = width * 0.24;
  return `<g class="scene-ssd">
    <path class="device-shadow" d="M${x - w + 9} ${y + 14}L${x - 4} ${y - h + 11}L${x + w + 9} ${y + 6}L${x + 14} ${y + h + 28}Z"/>
    <path class="device-front" d="M${x - w} ${y}L${x + 7} ${y + h}V${y + h + 13}L${x - w} ${y + 13}Z"/>
    <path class="device-side" d="M${x + 7} ${y + h}L${x + w} ${y - 9}V${y + 4}L${x + 7} ${y + h + 13}Z"/>
    <path class="device-top" d="M${x - w} ${y}L${x - 7} ${y - h}L${x + w} ${y - 9}L${x + 7} ${y + h}Z"/>
    <path class="ssd-label" d="M${x - w * 0.58} ${y - 1}L${x - 6} ${y - h * 0.57}L${x + w * 0.57} ${y - 4}L${x + 3} ${y + h * 0.57}Z"/>
    <text class="ssd-die-label" x="${x}" y="${y + 4}" text-anchor="middle">SSD</text>
    ${[0, 1, 2, 3].map((i) => `<path class="ssd-port" d="M${x + 21 + i * 7} ${y + h - 5 - i * 3}v6"/>`).join("")}
  </g>`;
}

const center = (position) => ({
  x: position.x + position.width / 2,
  y: position.y + position.height / 2,
});
const copyView = (frame, processes) => ({
  new: processes
    .filter((p) => frame.states[p.id].status === "new")
    .map((p) => p.id),
  ready: [...frame.ready],
  running: frame.running,
  blocked: frame.blocked.map((p) => p.id),
  done: [...frame.completed],
});

function positionFor(id, view, layout) {
  const state =
    view.running === id
      ? "running"
      : ["new", "ready", "blocked", "done"].find((key) =>
          view[key].includes(id),
        );
  const index = state === "running" ? 0 : view[state].indexOf(id);
  const width = state === "done" ? layout.done.width : layout.tokenWidth,
    height = state === "done" ? 28 : layout.tokenHeight;
  if (state === "running") return { ...layout.running, width, height, state };
  const zone = state === "new" ? layout.arrival : layout[state];
  const horizontal = state === "new" || (state === "done" && !zone.vertical);
  return {
    x: zone.x + (horizontal ? zone.gap * index : 0),
    y: zone.y + (horizontal ? 0 : zone.gap * index),
    width,
    height,
    state,
  };
}

function mutateView(view, event) {
  for (const key of ["new", "ready", "blocked", "done"])
    view[key] = view[key].filter((id) => id !== event.id);
  if (view.running === event.id) view.running = null;
  if (event.to === "running") view.running = event.id;
  else view[event.to].push(event.id);
}

function burstLength(process, cpuDone) {
  let consumed = cpuDone;
  for (const burst of process.cpu) {
    if (consumed < burst) return burst;
    consumed -= burst;
  }
  return process.cpu.at(-1);
}

function ioLength(process, cpuDone) {
  let consumed = 0;
  for (let index = 0; index < process.io.length; index++) {
    consumed += process.cpu[index];
    if (consumed >= cpuDone) return process.io[index];
  }
  return process.io.at(-1) || 1;
}

export function createSchedulerScene(hostElement, processes) {
  const serial = ++sceneSerial,
    reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const processById = new Map(
    processes.map((process) => [process.id, process]),
  );
  hostElement.classList.add("scheduler-scene");
  hostElement.setAttribute("role", "group");
  hostElement.innerHTML = `<svg class="scene-map" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"></svg>
    <div class="scene-tokens"></div>
    <div class="scene-cpu-readout" aria-hidden="true">
      <div class="scene-meter-row"><span>이번 CPU 구간</span><b data-value="burst"></b><div class="scene-meter"><i data-fill="burst"></i></div></div>
      <div class="scene-meter-row" data-quantum-row><span>이번 차례 · 할당량</span><b data-value="quantum"></b><div class="scene-meter"><i data-fill="quantum"></i></div></div>
      <p class="scene-cpu-idle"></p>
    </div>
    <div class="scene-callout" aria-hidden="true"><i></i><span></span></div>`;
  const svg = hostElement.querySelector(".scene-map"),
    tokensLayer = hostElement.querySelector(".scene-tokens");
  const readout = hostElement.querySelector(".scene-cpu-readout"),
    callout = hostElement.querySelector(".scene-callout");
  const tokens = new Map(
    processes.map((process) => {
      const token = document.createElement("button");
      token.type = "button";
      token.className = "scene-process";
      token.dataset.process = process.id;
      token.style.setProperty("--process-color", COLORS[process.id]);
      token.innerHTML = `<b class="scene-pid">${escape(process.id)}</b><span class="scene-token-copy"><strong>${escape(process.name)}</strong><small></small></span><span class="scene-token-check">✓</span><span class="scene-io-meter"><i></i></span>`;
      tokensLayer.append(token);
      return [process.id, token];
    }),
  );
  let layout,
    currentFrame = null,
    view = null,
    quantum = 2,
    intervalProgress = 0;
  let activeRun = null,
    revision = 0,
    destroyed = false;

  function route(type, from, to) {
    const a = center(from),
      b = center(to);
    const right = layout.width - layout.tokenWidth / 2 - 5;
    const left = layout.tokenWidth / 2 + 5;
    if (type === "preempt") {
      const side = layout.mobile
        ? layout.ready.x + layout.tokenWidth + 9
        : layout.cpu.x - layout.cpu.width / 2 - 18;
      return `M${a.x} ${a.y}C${side} ${a.y + 30} ${side} ${layout.returnY} ${b.x} ${layout.returnY}L${b.x} ${b.y}`;
    }
    if (type === "unblock")
      return layout.mobile
        ? `M${a.x} ${a.y}L${right} ${a.y}V148H${left}V${b.y}H${b.x}`
        : `M${a.x} ${a.y}L${right} ${a.y}V98H${left}V${b.y}H${b.x}`;
    if (type === "arrive")
      return `M${a.x} ${a.y}C${a.x} ${a.y + 45} ${b.x} ${b.y - 45} ${b.x} ${b.y}`;
    if (type === "block") {
      const middle = (a.x + b.x) / 2;
      return layout.mobile
        ? `M${a.x} ${a.y}L${right} ${a.y}V${b.y}H${b.x}`
        : `M${a.x} ${a.y}C${middle} ${a.y - 22} ${middle} ${b.y} ${b.x} ${b.y}`;
    }
    if (type === "complete")
      return `M${a.x} ${a.y}C${a.x + 48} ${a.y + 68} ${b.x + 34} ${b.y - 60} ${b.x} ${b.y}`;
    return `M${a.x} ${a.y}C${a.x + (b.x - a.x) * 0.45} ${a.y} ${a.x + (b.x - a.x) * 0.55} ${b.y} ${b.x} ${b.y}`;
  }

  function drawMap() {
    layout = layoutFor(Math.max(280, Math.round(hostElement.clientWidth)));
    hostElement.style.height = `${layout.height}px`;
    hostElement.dataset.compact = String(layout.mobile);
    svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
    svg.setAttribute("preserveAspectRatio", "xMinYMin meet");
    const cpu = layout.cpu,
      ssd = layout.ssd;
    const example = {
      new: [],
      ready: ["source"],
      running: "target",
      blocked: [],
      done: [],
    };
    const ready = positionFor("source", example, layout),
      running = positionFor("target", example, layout);
    const blocked = {
      x: layout.blocked.x,
      y: layout.blocked.y,
      width: layout.tokenWidth,
      height: 44,
    };
    const done = {
      x: layout.done.x,
      y: layout.done.y,
      width: layout.done.width,
      height: 28,
    };
    svg.innerHTML = `<defs>
      <pattern id="scene-grid-${serial}" width="44" height="26" patternUnits="userSpaceOnUse"><path d="M-22 0L44 39M0 -13L66 26M-22 26L44 -13M0 39L66 0"/></pattern>
      <marker id="scene-arrow-${serial}" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6Z"/></marker>
    </defs>
    <rect class="scene-grid" width="100%" height="100%" fill="url(#scene-grid-${serial})"/>
    <g class="scene-buses">
      <path class="scene-bus" d="${route("dispatch", ready, running)}"/>
      <path class="scene-bus" d="${route("block", running, blocked)}"/>
      <path class="scene-bus scene-preempt-bus" d="${route("preempt", running, { ...ready, y: layout.ready.y + 104 })}"/>
      <path class="scene-bus" d="${route("complete", running, done)}"/>
    </g>
    ${memoryDrawing(layout.memory)}${cpuDrawing(cpu)}${ssdDrawing(ssd)}
    <text class="scene-device-title" x="${layout.ready.x}" y="${layout.ready.y - 19}">준비 큐</text>
    <text class="scene-device-sub" x="${layout.ready.x + 67}" y="${layout.ready.y - 19}">메모리 · 앞에서부터 배정</text>
    <text class="scene-device-title" x="${layout.mobile ? 18 : ssd.x}" y="${layout.mobile ? 379 : 40}" text-anchor="${layout.mobile ? "start" : "middle"}">입출력 장치</text>
    <text class="scene-device-sub" x="${layout.mobile ? 18 : ssd.x}" y="${layout.mobile ? 394 : 56}" text-anchor="${layout.mobile ? "start" : "middle"}">CPU와 독립적으로 진행</text>
    <text class="scene-rail-label" x="${layout.arrival.x}" y="${layout.arrival.y - 11}">도착 예정</text>
    <text class="scene-arrived-note" x="${layout.arrival.x + 59}" y="${layout.arrival.y - 11}"></text>
    <text class="scene-rail-label" x="${layout.done.x}" y="${layout.done.y - 12}">완료한 작업</text>
    <text class="scene-done-note" x="${layout.done.x + 71}" y="${layout.done.y - 12}"></text>
    <text class="scene-queue-empty" x="${layout.ready.x + layout.tokenWidth / 2}" y="${layout.ready.y + 66}" text-anchor="middle">준비된 작업 없음</text>
    <g class="scene-queue-order">${[0, 1, 2].map((index) => `<text x="${layout.ready.x - 12}" y="${layout.ready.y + index * 52 + 27}" data-order="${index}">${index + 1}</text>`).join("")}</g>
    <path class="scene-flow" marker-end="url(#scene-arrow-${serial})"/><path class="scene-motion-measure"/>`;
    Object.assign(readout.style, {
      left: `${layout.meter.x}px`,
      top: `${layout.meter.y}px`,
      width: `${layout.meter.width}px`,
    });
    if (currentFrame && view) {
      snapTokens(view);
      renderProgress();
      showCallout(finalEvent(currentFrame));
      paintPresence();
    }
  }

  function paintPresence() {
    if (!view) return;
    hostElement.dataset.running = view.running || "";
    hostElement.dataset.io = view.blocked.length ? "active" : "idle";
    svg.querySelector(".scene-arrived-note").textContent = view.new.length
      ? `${view.new.length}개`
      : "모두 도착";
    svg.querySelector(".scene-done-note").textContent =
      `${view.done.length} / ${processes.length}`;
    svg.querySelector(".scene-queue-empty").style.opacity = view.ready.length
      ? 0
      : 1;
    svg
      .querySelectorAll("[data-order]")
      .forEach(
        (label) =>
          (label.style.opacity =
            Number(label.dataset.order) < view.ready.length ? 1 : 0),
      );
  }

  function setTokenPresentation(id, position) {
    const token = tokens.get(id),
      state = currentFrame.states[id],
      process = processById.get(id);
    token.dataset.state = position.state;
    token.style.width = `${position.width}px`;
    token.style.height = `${position.height}px`;
    token.querySelector("small").textContent =
      position.state === "new"
        ? `${process.arrival} ms에 도착`
        : position.state === "blocked"
          ? `입출력 ${state.ioRemaining} ms 남음`
          : position.state === "done"
            ? `${state.finishedAt ?? currentFrame.t} ms`
            : `CPU ${state.cpuRemaining} ms 남음`;
    token.setAttribute(
      "aria-label",
      `${id} ${process.name}. ${STATE_NAMES[position.state]}. ${token.querySelector("small").textContent}. 작업 상세 보기`,
    );
  }

  function snapTokens(nextView) {
    for (const process of processes) {
      const position = positionFor(process.id, nextView, layout);
      setTokenPresentation(process.id, position);
      tokens.get(process.id).style.transform =
        `translate(${position.x}px, ${position.y}px)`;
    }
  }

  function finalEvent(frame) {
    if (frame.completed.length === processes.length)
      return { type: "all-done" };
    if (!frame.running) return { type: "idle" };
    return (
      [...frame.events].reverse().find((event) => MOVES.has(event.type)) || {
        type: frame.blocked.length ? "concurrent" : "running",
        id: frame.running,
      }
    );
  }

  function showCallout(event) {
    const labels = {
      arrive: `${event.id} 도착 · 준비 큐 뒤에 합류`,
      unblock: `${event.id} 입출력 완료 · 큐 뒤로`,
      preempt: `${event.id} 시간 만료 · 실행권 반납`,
      dispatch: `준비 큐 맨 앞의 ${event.id} 실행`,
      block: `${event.id} 입출력 요청 · CPU 반납`,
      complete: `${event.id}의 모든 작업 완료`,
      idle: "준비된 작업이 없어 CPU가 대기합니다",
      "all-done": "세 작업을 모두 처리했습니다",
      concurrent: "CPU 실행과 입출력이 동시에 진행됩니다",
      running: `${event.id}의 CPU 구간을 처리하고 있습니다`,
    };
    const point = layout.callout;
    callout.style.setProperty(
      "--callout-color",
      event.id ? COLORS[event.id] : "var(--scene-ink)",
    );
    Object.assign(callout.style, {
      left: `${point.x}px`,
      top: `${point.y}px`,
      width: `${point.width}px`,
    });
    callout.querySelector("span").textContent = labels[event.type];
  }

  function renderProgress() {
    if (!currentFrame || !view) return;
    const id = view.running,
      stableCPU = id && id === currentFrame.running;
    readout
      .querySelectorAll(".scene-meter-row")
      .forEach((row) => (row.hidden = !stableCPU));
    const idle = readout.querySelector(".scene-cpu-idle");
    idle.hidden = !!stableCPU;
    idle.textContent =
      view.done.length === processes.length
        ? "CPU 처리 완료"
        : view.running || activeRun
          ? "실행권을 옮기는 중"
          : "CPU 유휴 · 입출력 완료를 기다립니다";
    if (stableCPU) {
      const state = currentFrame.states[id],
        total = burstLength(processById.get(id), state.cpuDone),
        done = total - state.burstRemaining + intervalProgress;
      readout.style.setProperty("--running-color", COLORS[id]);
      readout.querySelector('[data-value="burst"]').textContent =
        `${Number(done.toFixed(1))} / ${total} ms`;
      readout.querySelector('[data-fill="burst"]').style.transform =
        `scaleX(${Math.min(1, done / total)})`;
      const quantumRow = readout.querySelector("[data-quantum-row]");
      quantumRow.hidden = currentFrame.quantumLeft == null;
      if (!quantumRow.hidden) {
        const spent = quantum - currentFrame.quantumLeft + intervalProgress;
        readout.querySelector('[data-value="quantum"]').textContent =
          `${Number(spent.toFixed(1))} / ${quantum} ms`;
        readout.querySelector('[data-fill="quantum"]').style.transform =
          `scaleX(${Math.min(1, spent / quantum)})`;
      }
    }
    for (const id of view.blocked) {
      const state = currentFrame.states[id],
        token = tokens.get(id);
      if (state.status !== "blocked") continue;
      const total = ioLength(processById.get(id), state.cpuDone),
        left = Math.max(0, state.ioRemaining - intervalProgress);
      token.querySelector("small").textContent =
        `입출력 ${Number(left.toFixed(1))} ms 남음`;
      token.querySelector(".scene-io-meter i").style.transform =
        `scaleX(${Math.min(1, 1 - left / total)})`;
    }
  }

  function cancelTransition() {
    if (!activeRun) return;
    activeRun.cancelled = true;
    for (const animation of activeRun.animations) animation.cancel();
    for (const token of tokens.values()) delete token.dataset.moving;
    activeRun = null;
  }

  async function animateEvent(event, milliseconds, run) {
    const previousPositions = new Map(
      processes.map((process) => [
        process.id,
        positionFor(process.id, view, layout),
      ]),
    );
    mutateView(view, event);
    showCallout(event);
    paintPresence();
    const flow = svg.querySelector(".scene-flow"),
      end = positionFor(event.id, view, layout);
    const pathData = route(event.type, previousPositions.get(event.id), end);
    flow.setAttribute("d", pathData);
    flow.style.setProperty("--flow-color", COLORS[event.id]);
    flow.style.opacity = 1;
    const measure = svg.querySelector(".scene-motion-measure");
    measure.setAttribute("d", pathData);
    const length = measure.getTotalLength(),
      waits = [];
    function track(animation) {
      run.animations.add(animation);
      if (run.paused) animation.pause();
      waits.push(
        animation.finished
          .catch(() => {})
          .then(() => run.animations.delete(animation)),
      );
    }
    for (const process of processes) {
      const id = process.id,
        from = previousPositions.get(id),
        to = positionFor(id, view, layout),
        token = tokens.get(id);
      setTokenPresentation(id, to);
      token.style.transform = `translate(${to.x}px, ${to.y}px)`;
      if (from.x === to.x && from.y === to.y && from.width === to.width)
        continue;
      if (id === event.id) {
        const keyframes = Array.from({ length: 25 }, (_, index) => {
          const p = index / 24,
            point = measure.getPointAtLength(length * p);
          const width = from.width + (to.width - from.width) * p,
            height = from.height + (to.height - from.height) * p;
          return {
            transform: `translate(${point.x - width / 2}px, ${point.y - height / 2}px)`,
            width: `${width}px`,
            height: `${height}px`,
            offset: p,
          };
        });
        token.dataset.moving = "true";
        const animation = token.animate(keyframes, {
          duration: milliseconds,
          easing: "cubic-bezier(.25,.1,.25,1)",
        });
        track(animation);
        waits.push(
          animation.finished
            .catch(() => {})
            .then(() => {
              if (!run.cancelled) delete token.dataset.moving;
            }),
        );
      } else {
        track(
          token.animate(
            [
              { transform: `translate(${from.x}px, ${from.y}px)` },
              { transform: token.style.transform },
            ],
            {
              delay: milliseconds * 0.36,
              duration: milliseconds * 0.64,
              easing: "cubic-bezier(.2,.8,.2,1)",
              fill: "backwards",
            },
          ),
        );
      }
    }
    track(
      flow.animate([{ strokeDashoffset: 18 }, { strokeDashoffset: 0 }], {
        duration: milliseconds,
        easing: "linear",
      }),
    );
    renderProgress();
    await Promise.all(waits);
  }

  function update(
    frame,
    previousFrame = null,
    { animate = true, duration = 1000, quantum: configuredQuantum } = {},
  ) {
    if (destroyed) return Promise.resolve();
    revision += 1;
    cancelTransition();
    for (const token of tokens.values()) delete token.dataset.moving;
    currentFrame = frame;
    intervalProgress = 0;
    if (configuredQuantum !== undefined) quantum = configuredQuantum;
    else if (frame.t === 0) quantum = frame.quantumLeft;
    hostElement.dataset.algorithm = quantum == null ? "fcfs" : "rr";
    hostElement.setAttribute(
      "aria-label",
      `${frame.t}밀리초. CPU ${frame.running || "대기"}, 준비 큐 ${frame.ready.join(", ") || "없음"}. 작업을 선택하면 상세 정보를 볼 수 있습니다.`,
    );
    const events = frame.events.filter((event) => MOVES.has(event.type));
    const canAnimate =
      animate &&
      !reducedMotion.matches &&
      previousFrame &&
      frame.t > previousFrame.t &&
      events.length;
    if (!canAnimate) {
      view = copyView(frame, processes);
      snapTokens(view);
      paintPresence();
      renderProgress();
      svg.querySelector(".scene-flow").style.opacity = 0;
      showCallout(finalEvent(frame));
      return Promise.resolve();
    }
    const run = {
      revision,
      animations: new Set(),
      paused: false,
      cancelled: false,
    };
    activeRun = run;
    view = copyView(previousFrame, processes);
    snapTokens(view);
    const totalWeight = events.reduce(
      (total, event) => total + WEIGHTS[event.type],
      0,
    );
    return (async () => {
      for (const event of events) {
        if (run.cancelled || run.revision !== revision) return;
        await animateEvent(
          event,
          (Math.max(160, duration) * WEIGHTS[event.type]) / totalWeight,
          run,
        );
      }
      if (run.cancelled || run.revision !== revision) return;
      activeRun = null;
      view = copyView(frame, processes);
      snapTokens(view);
      paintPresence();
      renderProgress();
      svg.querySelector(".scene-flow").style.opacity = 0;
      showCallout(finalEvent(frame));
    })();
  }

  drawMap();
  const observer = new ResizeObserver((entries) => {
    if (Math.abs(entries[0].contentRect.width - layout.width) <= 1) return;
    revision += 1;
    cancelTransition();
    if (currentFrame) view = copyView(currentFrame, processes);
    drawMap();
  });
  observer.observe(hostElement);
  return {
    update,
    setProgress(progress) {
      intervalProgress = Math.max(0, Math.min(1, progress));
      renderProgress();
    },
    pause() {
      if (activeRun) {
        activeRun.paused = true;
        for (const animation of activeRun.animations) animation.pause();
      }
    },
    resume() {
      if (activeRun) {
        activeRun.paused = false;
        for (const animation of activeRun.animations) animation.play();
      }
    },
    destroy() {
      destroyed = true;
      revision += 1;
      cancelTransition();
      observer.disconnect();
      hostElement.replaceChildren();
    },
  };
}
