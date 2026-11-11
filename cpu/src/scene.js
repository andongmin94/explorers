import "./scene.css";
import { memoryDrawing, cpuDrawing, ssdDrawing } from "./devices.js";

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
  const mobile = width < 540;
  const tokenWidth = mobile
    ? Math.min(142, (width - 96) / 2)
    : Math.min(168, (width - 180) / 3);
  const readyX = mobile ? 34 : 26;
  const cpuX = mobile ? width - 24 - tokenWidth / 2 : width / 2;
  const ioX = mobile ? cpuX : width - 26 - tokenWidth / 2;
  const cardY = mobile ? 250 : 238;
  return {
    width,
    mobile,
    height: mobile ? 766 : 488,
    tokenWidth,
    tokenHeight: 50,
    queueGap: 58,
    arrival: {
      x: mobile ? 26 : width - 200,
      y: mobile ? 59 : 19,
      gap: 90,
      width: 82,
    },
    ready: { x: readyX, y: cardY, gap: 58 },
    running: { x: cpuX - tokenWidth / 2, y: cardY },
    blocked: { x: ioX - tokenWidth / 2, y: mobile ? 558 : cardY, gap: 58 },
    done: {
      x: mobile ? Math.max(26, width / 2 - 136) : width / 2 - 70,
      y: mobile ? 726 : 448,
      gap: mobile ? (width - 52) / 3 : 92,
      width: mobile ? Math.min(82, (width - 64) / 3) : 82,
    },
    cpu: {
      x: cpuX,
      y: mobile ? 171 : 151,
      width: mobile ? Math.min(156, width * 0.43) : Math.min(218, width * 0.32),
    },
    memory: {
      x: readyX - 2,
      y: mobile ? 120 : 96,
      width: tokenWidth + 10,
      height: mobile ? 126 : 132,
    },
    ssd: {
      x: ioX,
      y: mobile ? 493 : 153,
      width: mobile ? 148 : Math.min(176, width * 0.26),
    },
    meter: {
      x: cpuX - (mobile ? Math.min(146, tokenWidth + 16) / 2 : 86),
      y: mobile ? 314 : 326,
      width: mobile ? Math.min(146, tokenWidth + 16) : 172,
    },
    callout: { x: 18, y: 6, width: mobile ? width - 36 : width - 242 },
    returnY: mobile ? 688 : 418,
    preemptY: mobile ? 308 : 306,
    titleY: mobile ? 108 : 76,
    ioTitleY: mobile ? 428 : 76,
  };
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
  const width =
      state === "done"
        ? layout.done.width
        : state === "new"
          ? layout.arrival.width
          : layout.tokenWidth,
    height = state === "done" ? 28 : state === "new" ? 32 : layout.tokenHeight;
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
    const left = 17,
      right = layout.width - 18;
    const queueSide = layout.ready.x + layout.tokenWidth + 18;
    if (type === "preempt")
      return `M${a.x} ${a.y}V${layout.preemptY}H${queueSide}V${b.y}H${b.x}`;
    if (type === "unblock")
      return layout.mobile
        ? `M${a.x} ${a.y}V${layout.returnY}H${left}V${b.y}H${b.x}`
        : `M${a.x} ${a.y}H${right}V${layout.returnY}H${left}V${b.y}H${b.x}`;
    if (type === "arrive") return `M${a.x} ${a.y}H${left}V${b.y}H${b.x}`;
    if (type === "block") {
      const corridor = layout.mobile
        ? right
        : (layout.running.x + layout.tokenWidth + layout.blocked.x) / 2;
      return `M${a.x} ${a.y}H${corridor}V${b.y}H${b.x}`;
    }
    if (type === "complete") {
      const side = layout.mobile
        ? right
        : layout.running.x + layout.tokenWidth + 19;
      return `M${a.x} ${a.y}H${side}V${layout.done.y - 15}H${b.x}V${b.y}`;
    }
    return `M${a.x} ${a.y}L${b.x} ${b.y}`;
  }

  function slot(position, label, extra = "") {
    return `<g class="scene-slot" ${extra}><rect x="${position.x}" y="${position.y}" width="${layout.tokenWidth}" height="${layout.tokenHeight}" rx="3"/><text x="${position.x + layout.tokenWidth / 2}" y="${position.y + layout.tokenHeight / 2 + 4}" text-anchor="middle">${label}</text></g>`;
  }

  function routeBadge(type, x, y, lines, width) {
    const height = lines.length === 1 ? 26 : 38;
    return `<g class="scene-route-badge" data-route-label="${type}" transform="translate(${x} ${y})"><rect class="route-badge-shadow" x="${-width / 2 + 2}" y="${-height / 2 + 2}" width="${width}" height="${height}" rx="2"/><rect x="${-width / 2}" y="${-height / 2}" width="${width}" height="${height}" rx="2"/><text text-anchor="middle">${lines.map((line, index) => `<tspan x="0" y="${lines.length === 1 ? 4 : index * 14 - 3}">${line}</tspan>`).join("")}</text></g>`;
  }

  function drawMap() {
    layout = layoutFor(Math.max(280, Math.round(hostElement.clientWidth)));
    hostElement.style.height = `${layout.height}px`;
    hostElement.dataset.compact = String(layout.mobile);
    svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
    svg.setAttribute("preserveAspectRatio", "xMinYMin meet");
    const readyCenter = layout.ready.x + layout.tokenWidth / 2;
    const cpu = layout.cpu,
      ssd = layout.ssd;
    const labelX = (layout.ready.x + layout.tokenWidth + layout.running.x) / 2;
    const ioLabelX = layout.mobile
      ? layout.width - 29
      : (layout.running.x + layout.tokenWidth + layout.blocked.x) / 2;
    const deviceTitle = (x, y, title, sub) =>
      `<text class="scene-device-title" x="${x}" y="${y}" text-anchor="middle">${title}</text><text class="scene-device-sub" x="${x}" y="${y + 16}" text-anchor="middle">${sub}</text>`;
    svg.innerHTML = `<defs>
      <marker id="scene-arrow-${serial}" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6Z"/></marker>
    </defs>
    <g class="scene-lanes">${["dispatch", "block", "preempt", "unblock"].map((type) => `<path class="scene-lane" data-route="${type}" marker-end="url(#scene-arrow-${serial})"/>`).join("")}<path class="scene-flow"/></g>
    <g class="scene-station" data-station="ready">
      ${deviceTitle(readyCenter, layout.titleY, "준비 큐", "메모리 · 위에서부터 배정")}
      ${memoryDrawing(layout.memory)}
      <path class="scene-dock" d="M${readyCenter} ${layout.ready.y - 34}V${layout.ready.y}M${layout.ready.x + 5} ${layout.ready.y - 4}H${layout.ready.x + layout.tokenWidth - 5}"/>
      ${[0, 1, 2].map((index) => slot({ x: layout.ready.x, y: layout.ready.y + index * layout.queueGap }, index ? "" : "CPU를 기다리는 자리", `data-slot="${index}"`)).join("")}
      <g class="scene-queue-order">${[0, 1, 2].map((index) => `<text x="${layout.ready.x - 8}" y="${layout.ready.y + index * layout.queueGap + layout.tokenHeight / 2 + 4}" text-anchor="end" data-order="${index}">${index + 1}</text>`).join("")}</g>
    </g>
    <g class="scene-station" data-station="running">
      ${deviceTitle(cpu.x, layout.titleY, "CPU", "한 번에 한 작업 실행")}
      ${cpuDrawing(cpu)}
      <path class="scene-dock" d="M${cpu.x} ${layout.running.y - 20}V${layout.running.y}M${layout.running.x + 5} ${layout.running.y - 4}H${layout.running.x + layout.tokenWidth - 5}"/>
      ${slot(layout.running, "CPU 대기")}
    </g>
    <g class="scene-station" data-station="blocked">
      ${deviceTitle(ssd.x, layout.ioTitleY, "입출력", "CPU와 동시에 진행")}
      ${ssdDrawing(ssd)}
      <path class="scene-dock" d="M${ssd.x} ${layout.blocked.y - 23}V${layout.blocked.y}M${layout.blocked.x + 5} ${layout.blocked.y - 4}H${layout.blocked.x + layout.tokenWidth - 5}"/>
      ${[0, 1].map((index) => slot({ x: layout.blocked.x, y: layout.blocked.y + index * layout.queueGap }, index ? "" : "입출력 요청 없음", `data-io-slot="${index}"`)).join("")}
    </g>
    <g class="scene-route-labels">
      ${routeBadge("dispatch", labelX, layout.running.y - 21, ["CPU", "배정 →"], 58)}
      ${routeBadge("block", layout.mobile ? cpu.x : ioLabelX, layout.mobile ? 392 : layout.running.y - 21, layout.mobile ? ["입출력 요청 ↓"] : ["입출력", "요청 →"], layout.mobile ? 110 : 58)}
      ${routeBadge("preempt", labelX, layout.preemptY + (layout.mobile ? -18 : 14), layout.mobile ? ["시간", "만료"] : ["할당량", "만료"], layout.mobile ? 34 : 58)}
      ${routeBadge("unblock", layout.width / 2, layout.returnY, ["입출력 완료 · 큐 뒤로"], 172)}
    </g>
    <text class="scene-rail-label" x="${layout.arrival.x}" y="${layout.arrival.y - 6}">도착 예정</text>
    <text class="scene-arrived-note" x="${layout.arrival.x + 59}" y="${layout.arrival.y - 6}"></text>
    <rect class="scene-completion-track" x="${layout.mobile ? 18 : layout.width / 2 - 215}" y="${layout.done.y - 4}" width="${layout.mobile ? layout.width - 36 : 430}" height="36" rx="3"/>
    <text class="scene-completion-empty" x="${layout.mobile ? layout.width / 2 : layout.done.x + 8}" y="${layout.done.y + 19}" text-anchor="${layout.mobile ? "middle" : "start"}">아직 완료된 작업 없음</text>
    <text class="scene-rail-label" x="${layout.mobile ? layout.done.x : layout.done.x - 120}" y="${layout.mobile ? layout.done.y - 10 : layout.done.y + 19}">완료</text>
    <text class="scene-done-note" x="${layout.mobile ? layout.done.x + 36 : layout.done.x - 82}" y="${layout.mobile ? layout.done.y - 10 : layout.done.y + 19}"></text>
    <path class="scene-motion-measure"/>`;
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
    svg.querySelector(".scene-completion-empty").style.display = view.done
      .length
      ? "none"
      : "";
    const emptyPosition = (zone, index = 0) => ({
      ...zone,
      y: zone.y + (zone.gap || 0) * index,
      width: layout.tokenWidth,
      height: layout.tokenHeight,
    });
    const queueTail = emptyPosition(
      layout.ready,
      Math.min(2, view.ready.length),
    );
    const main = emptyPosition(layout.running),
      io = emptyPosition(layout.blocked);
    for (const type of ["dispatch", "block", "preempt", "unblock"]) {
      const from =
        type === "dispatch"
          ? emptyPosition(layout.ready)
          : type === "unblock"
            ? io
            : main;
      const to = type === "dispatch" ? main : type === "block" ? io : queueTail;
      const entersFromLeft =
        type === "dispatch" ||
        type === "unblock" ||
        (type === "block" && !layout.mobile);
      const arrowEnd = {
        ...to,
        x: to.x + (entersFromLeft ? -1 : 1) * (layout.tokenWidth / 2 + 4),
      };
      svg
        .querySelector(`[data-route="${type}"]`)
        .setAttribute("d", route(type, from, arrowEnd));
    }
    svg.querySelectorAll("[data-slot]").forEach((slot) => {
      const index = Number(slot.dataset.slot);
      slot.style.opacity = index <= view.ready.length ? 1 : 0;
      slot.querySelector("text").textContent =
        index === view.ready.length
          ? view.ready.length
            ? "큐 뒤 · 여기에 합류"
            : "CPU를 기다리는 자리"
          : "";
    });
    svg
      .querySelectorAll("[data-io-slot]")
      .forEach(
        (slot) =>
          (slot.style.opacity =
            Number(slot.dataset.ioSlot) < Math.max(1, view.blocked.length)
              ? 1
              : 0),
      );
    for (const [state, id] of [
      ["ready", view.ready[0]],
      ["running", view.running],
      ["blocked", view.blocked[0]],
    ]) {
      const station = svg.querySelector(`[data-station="${state}"]`);
      station.dataset.occupied = String(!!id);
      station.style.setProperty(
        "--station-color",
        id ? COLORS[id] : "var(--scene-muted)",
      );
    }
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
        ? `${process.arrival} ms`
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
      stableCPU =
        id && id === currentFrame.running && !tokens.get(id).dataset.moving;
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
    svg
      .querySelectorAll("[data-active], [data-receiving]")
      .forEach((element) => {
        delete element.dataset.active;
        delete element.dataset.receiving;
      });
    activeRun = null;
  }

  async function animateEvent(event, pace, run) {
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
    const milliseconds = (510 + length * 0.75) * pace;
    const lane = svg.querySelector(`[data-route="${event.type}"]`);
    if (lane) {
      const entersFromLeft =
        event.type === "dispatch" ||
        event.type === "unblock" ||
        (event.type === "block" && !layout.mobile);
      const arrowEnd = {
        ...end,
        x: end.x + (entersFromLeft ? -1 : 1) * (end.width / 2 + 4),
      };
      lane.setAttribute(
        "d",
        route(event.type, previousPositions.get(event.id), arrowEnd),
      );
    }
    const routeLabel = svg.querySelector(`[data-route-label="${event.type}"]`);
    for (const element of [lane, routeLabel].filter(Boolean)) {
      element.dataset.active = "true";
      element.style.setProperty("--flow-color", COLORS[event.id]);
    }
    const destination = svg.querySelector(`[data-station="${event.to}"]`);
    const slotIndex =
      event.to === "ready"
        ? view.ready.indexOf(event.id)
        : event.to === "blocked"
          ? view.blocked.indexOf(event.id)
          : 0;
    const receivingSlot =
      destination?.querySelectorAll(".scene-slot")[slotIndex];
    if (receivingSlot) {
      receivingSlot.dataset.receiving = "true";
      receivingSlot.style.setProperty("--slot-color", COLORS[event.id]);
    }
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
        const keyframes = [
          {
            transform: `translate(${from.x}px, ${from.y}px)`,
            width: `${from.width}px`,
            height: `${from.height}px`,
            offset: 0,
          },
          ...Array.from({ length: 25 }, (_, index) => {
            const p = index / 24,
              point = measure.getPointAtLength(length * p);
            return {
              transform: `translate(${point.x - 18}px, ${point.y - 17}px)`,
              width: "36px",
              height: "34px",
              offset: 0.14 + p * 0.64,
            };
          }),
          {
            transform: token.style.transform,
            width: `${to.width}px`,
            height: `${to.height}px`,
            offset: 0.88,
          },
          {
            transform: token.style.transform,
            width: `${to.width}px`,
            height: `${to.height}px`,
            offset: 1,
          },
        ];
        token.dataset.moving = "true";
        token.dataset.state = "moving";
        token.setAttribute(
          "aria-label",
          `${id} ${process.name}. ${STATE_NAMES[event.from]}에서 ${STATE_NAMES[event.to]}로 이동 중`,
        );
        const animation = token.animate(keyframes, {
          duration: milliseconds,
          easing: "linear",
        });
        track(animation);
        track(
          token.querySelector(".scene-token-copy").animate(
            [
              { opacity: 1, offset: 0 },
              { opacity: 0, offset: 0.12 },
              { opacity: 0, offset: 0.78 },
              { opacity: 1, offset: 0.9 },
              { opacity: 1, offset: 1 },
            ],
            { duration: milliseconds, easing: "linear" },
          ),
        );
        waits.push(
          animation.finished
            .catch(() => {})
            .then(() => {
              if (!run.cancelled) {
                delete token.dataset.moving;
                setTokenPresentation(id, to);
              }
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
    if (!run.cancelled) {
      for (const element of [lane, routeLabel].filter(Boolean))
        delete element.dataset.active;
      if (receivingSlot) delete receivingSlot.dataset.receiving;
      paintPresence();
    }
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
    return (async () => {
      for (const event of events) {
        if (run.cancelled || run.revision !== revision) return;
        await animateEvent(event, duration / 1100, run);
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
