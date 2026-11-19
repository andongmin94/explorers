// The CPU scheduler as one isometric scene built from shared/iso-kit.js.
//
// Five places on one floor: the arrival bay (not yet arrived), the ready queue
// (front slot nearest the CPU), the CPU chip (the running process sits on it and
// LEDs on the board count the quantum left), the I/O drive (blocked processes)
// and the done tray. P1–P3 are tokens that travel between those places along
// floor routes; the route in use lights up.
import {
  callout,
  chip,
  defs,
  fitViewBox,
  floor,
  floorPath,
  led,
  module,
  project,
  quad,
  socket,
  ssd,
  token,
  topText,
} from "../../shared/iso-kit.js";

const COLORS = { P1: "var(--p1)", P2: "var(--p2)", P3: "var(--p3)" };
const MOVES = new Set(["arrive", "unblock", "preempt", "dispatch", "block", "complete"]);
const MAX_QUANTUM = 5;

/* Two world layouts (iso-kit units): a wide one for the desktop stage and a
   compact one stacked down the screen for phones. Slot 0 of the ready queue is
   always the front, nearest the CPU. */
function makeLayout({ arrivals, ready, cpu, io, done, readyStep, routes, callouts, bounds, floorRect, viewBox }) {
  const center = [cpu.x + cpu.size / 2, cpu.y + cpu.size / 2];
  return {
    arrivals, ready, cpu, io, done, routes, callouts, floorRect, center,
    viewBox: viewBox ?? fitViewBox(bounds, 12),
    slots: {
      new: (i) => [arrivals.x + 1.2 + i * 2, arrivals.y + arrivals.d / 2, arrivals.h],
      ready: (i) => [ready.x + ready.w - 1.2 - i * readyStep, ready.y + 1.2, ready.h],
      running: () => [...center, 0.75],
      blocked: (i) => [io.x + 1.3 + i * 1.5, io.y + io.d / 2, 0.42],
      done: (i) => [done.x + 1.3 + i * 2, done.y + done.d / 2, done.h],
    },
    led: (i, n) => [center[0] + (i - (n - 1) / 2) * 0.8, cpu.y + cpu.size - 0.42, 0.3],
  };
}

const WIDE = makeLayout({
  arrivals: { x: 0, y: 0, w: 6.4, d: 2.2, h: 0.4 },
  ready: { x: 0, y: 5.4, w: 7.4, d: 2.4, h: 0.45 },
  cpu: { x: 9.6, y: 4.2, size: 5 },
  io: { x: 17.2, y: 1.8, w: 5.6, d: 3.6 },
  done: { x: 9, y: 11, w: 6.6, d: 2.2, h: 0.35 },
  readyStep: 2.2,
  routes: {
    arrive: [[0.7, 2.4], [0.7, 5.2]],
    unblock: [[17, 2.8], [1.5, 2.8], [1.5, 5.2]],
    preempt: [[11.5, 4], [11.5, 3.7], [2.3, 3.7], [2.3, 5.2]],
    dispatch: [[7.6, 6.6], [9.4, 6.6]],
    block: [[14.8, 5], [17, 5]],
    complete: [[12.1, 9.4], [12.1, 10.8]],
  },
  callouts: {
    arrivals: { x: 1.2, y: 0.8, z: 0.4, dx: -36, dy: -46 },
    ready: { x: 0.8, y: 7.4, z: 0.45, dx: -40, dy: -52 },
    cpu: { x: 13.3, y: 5.2, z: 0.75, dx: 34, dy: -86 },
    io: { x: 22.55, y: 2.05, z: 0.42, dx: 20, dy: -48 },
    done: { x: 15.2, y: 12.1, z: 0.35, dx: 70, dy: 6, anchor: "start" },
  },
  // Fitted to the devices, tokens, routes and callouts (measured with
  // getBBox), not to the floor: the floor runs past the stage and is clipped.
  viewBox: "-250 -60 742 372",
  floorRect: { x: -24, y: -24, w: 72, d: 62 },
});

const NARROW = makeLayout({
  arrivals: { x: 0, y: 0, w: 6.4, d: 2.2, h: 0.4 },
  ready: { x: 2, y: 4.2, w: 7.4, d: 2.4, h: 0.45 },
  cpu: { x: 6, y: 9, size: 5 },
  io: { x: 13, y: 9.6, w: 5.4, d: 3.4 },
  done: { x: 10, y: 16.2, w: 6.4, d: 2.2, h: 0.35 },
  readyStep: 2.2,
  routes: {
    arrive: [[1.4, 2.4], [1.4, 3.4], [2.6, 3.4], [2.6, 4]],
    unblock: [[14.5, 9.4], [14.5, 8.2], [2.6, 8.2], [2.6, 6.8]],
    preempt: [[6.8, 8.8], [6.8, 7.6], [3.6, 7.6], [3.6, 6.8]],
    dispatch: [[8.2, 6.8], [8.2, 8.8]],
    block: [[11.2, 11.3], [12.8, 11.3]],
    complete: [[10.4, 14.2], [10.4, 16]],
  },
  callouts: {
    arrivals: { x: 0, y: 1.1, z: 0.4, dx: -70, dy: -18 },
    ready: { x: 2.3, y: 5.4, z: 0.45, dx: -34, dy: -30 },
    cpu: { x: 10.4, y: 9.6, z: 0.75, dx: 104, dy: -15 },
    io: { x: 18.2, y: 12.8, z: 0.42, dx: 30, dy: 30 },
    done: { x: 16.2, y: 17.4, z: 0.35, dx: 30, dy: 2, anchor: "start" },
  },
  viewBox: "-178 -42 376 432",
  floorRect: { x: -8, y: -6, w: 34, d: 32 },
});
const DASHED = new Set(["unblock", "preempt"]);

function zoneOf(id, view) {
  if (view.running === id) return ["running", 0];
  for (const zone of ["new", "ready", "blocked", "done"]) {
    const index = view[zone].indexOf(id);
    if (index >= 0) return [zone, index];
  }
  return ["new", 0];
}
const translate = ([x, y, z]) => {
  const [sx, sy] = project(x, y, z);
  return `translate(${Math.round(sx * 100) / 100}px, ${Math.round(sy * 100) / 100}px)`;
};

const copyView = (frame, processes) => ({
  new: processes.filter((p) => frame.states[p.id].status === "new").map((p) => p.id),
  ready: [...frame.ready],
  running: frame.running,
  blocked: frame.blocked.map((p) => p.id),
  done: [...frame.completed],
});

function mutateView(view, event) {
  for (const key of ["new", "ready", "blocked", "done"]) view[key] = view[key].filter((id) => id !== event.id);
  if (view.running === event.id) view.running = null;
  if (event.to === "running") view.running = event.id;
  else view[event.to].push(event.id);
}

function staticSvg(L, processes) {
  const pad = (zone) =>
    [0, 1, 2]
      .map((i) => {
        const [x, y, z] = L.slots[zone](i);
        return socket({ x: x - 0.75, y: y - 0.75, z, w: 1.5, d: 1.5, cls: "cpu-slot" });
      })
      .join("");
  const readyNumbers = [0, 1, 2]
    .map((i) => {
      const [x, y, z] = L.slots.ready(i);
      return topText({ x, y: y + 0.98, z, text: String(i + 1), size: 9, weight: 600, fill: "var(--muted)" });
    })
    .join("");
  const routes = Object.entries(L.routes)
    .map(([type, points]) => `<g class="cpu-route" data-route="${type}">${floorPath(points, { dashed: DASHED.has(type) })}</g>`)
    .join("");
  const leds = Array.from({ length: MAX_QUANTUM }, () => `<g class="cpu-qled">${led({ x: 0, y: 0, z: 0 })}</g>`).join("");
  const io = L.io;
  const tokens = processes
    .map(
      (p) =>
        `<g class="cpu-token" data-process="${p.id}" role="button" tabindex="0" aria-label="${p.id} ${p.name} 작업 상세 보기">${token({ id: p.id, color: COLORS[p.id] })}</g>`,
    )
    .join("");
  const c = L.callouts;
  return `<svg class="cpu-scene-svg" viewBox="${L.viewBox}" xmlns="http://www.w3.org/2000/svg">
    ${defs()}
    ${floor(L.floorRect)}
    <g class="cpu-routes">${routes}</g>
    ${module({ ...L.arrivals, well: false }).svg}${pad("new")}
    ${module({ ...L.ready, well: false }).svg}${pad("ready")}${readyNumbers}
    ${chip({ x: L.cpu.x, y: L.cpu.y, size: L.cpu.size }).svg}
    <g class="cpu-qleds">${leds}</g>
    ${ssd({ ...io, label: "입출력" }).svg}
    <g class="cpu-io-led">${led({ x: io.x + io.w - 0.5, y: io.y + io.d - 0.35, z: 0.42 })}</g>
    ${module({ ...L.done, well: false }).svg}${pad("done")}
    ${callout({ ...c.arrivals, title: "도착 예정", sub: "NEW" })}
    ${callout({ ...c.ready, title: "준비 큐", sub: "FIFO · 1번이 다음 차례", cls: "cpu-callout-ready" })}
    ${callout({ ...c.cpu, title: "CPU", sub: "-", cls: "cpu-callout-cpu" })}
    ${callout({ ...c.io, title: "입출력 장치", sub: "CPU와 동시에 진행" })}
    ${callout({ ...c.done, title: "완료", sub: "DONE" })}
    <g class="cpu-tokens">${tokens}</g>
  </svg>`;
}

/**
 * update(frame, previous, { animate, speed, quantum }) → Promise that settles
 * once every move in the frame has travelled. onMove(frame, viewBefore, event)
 * fires before each move so the page can present the scene move by move.
 */
export function createSchedulerScene(host, processes, onMove) {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let L = null;
  let svg, tokenLayer, tokens, routes, leds, ioLed, cpuSub, queueSub;
  // Callout text for the current method (set by update()).
  let notes = { algorithm: "rr", cpu: null, queue: null };
  let view = null;
  let currentFrame = null;
  let quantum = 2;
  let activeRun = null;
  let progress = 0;
  let selected = null;

  const slotFor = (id, v) => {
    const [zone, index] = zoneOf(id, v);
    return L.slots[zone](index);
  };

  function build(layout) {
    L = layout;
    host.innerHTML = staticSvg(L, processes);
    host.dataset.layout = L === NARROW ? "narrow" : "wide";
    svg = host.querySelector("svg");
    tokenLayer = svg.querySelector(".cpu-tokens");
    tokens = new Map([...svg.querySelectorAll(".cpu-token")].map((g) => [g.dataset.process, g]));
    routes = [...svg.querySelectorAll(".cpu-route")];
    leds = [...svg.querySelectorAll(".cpu-qled")];
    ioLed = svg.querySelector(".cpu-io-led .iso-led");
    cpuSub = svg.querySelector(".cpu-callout-cpu .iso-callout-sub");
    queueSub = svg.querySelector(".cpu-callout-ready .iso-callout-sub");
    for (const [key, g] of tokens) g.classList.toggle("is-selected", key === selected);
  }
  const pick = (width) => (width < 640 ? NARROW : WIDE);
  build(pick(host.clientWidth || innerWidth));

  function sortTokens() {
    const depth = (id) => {
      const [x, y, z] = slotFor(id, view);
      return x + y + z;
    };
    [...tokens.keys()].sort((a, b) => depth(a) - depth(b)).forEach((id) => tokenLayer.append(tokens.get(id)));
  }

  function snap() {
    for (const [id, g] of tokens) {
      g.style.transform = translate(slotFor(id, view));
      g.classList.remove("is-moving");
    }
    sortTokens();
  }

  function lightRoutes(types) {
    for (const g of routes) g.firstElementChild.classList.toggle("is-active", types.has(g.dataset.route));
  }

  function paintDevices() {
    const frame = currentFrame;
    const n = quantum ?? 0;
    const stable = frame && view && view.running && view.running === frame.running && !activeRun;
    const left = stable && frame.quantumLeft != null ? frame.quantumLeft : 0;
    leds.forEach((g, i) => {
      g.style.display = i < n ? "" : "none";
      if (i >= n) return;
      g.style.transform = `${translate(L.led(i, n))} scale(1.5)`;
      const on = i < left;
      const iso = g.firstElementChild;
      iso.classList.toggle("is-on", on);
      // The LED being spent dims through the current millisecond.
      iso.style.opacity = on && i === left - 1 ? String(1 - progress * 0.75) : "";
    });
    ioLed.classList.toggle("is-on", !!view && view.blocked.length > 0);
    cpuSub.textContent = notes.cpu ?? (quantum == null ? "FCFS · 구간이 끝날 때까지" : `LED = 남은 할당량 (${quantum}ms)`);
    if (notes.queue) queueSub.textContent = notes.queue;
    // Without a quantum the LEDs are hidden (styles: [data-algorithm="fcfs"]).
    host.dataset.algorithm = quantum == null ? "fcfs" : "rr";
    host.dataset.policy = notes.algorithm;
  }

  function settle(frame) {
    view = copyView(frame, processes);
    snap();
    lightRoutes(new Set(frame.events.filter((e) => MOVES.has(e.type)).map((e) => e.type)));
    paintDevices();
  }

  function track(run, animation, waits) {
    run.animations.add(animation);
    animation.playbackRate = run.speed;
    if (run.paused) animation.pause();
    waits.push(animation.finished.catch(() => {}).then(() => run.animations.delete(animation)));
  }

  async function animateEvent(event, run, before) {
    lightRoutes(new Set([event.type]));
    paintDevices();
    const from = slotFor(event.id, before);
    const to = slotFor(event.id, view);
    const points = [from, ...L.routes[event.type].map(([x, y]) => [x, y, 0.05]), to];
    const screen = points.map(([x, y, z]) => project(x, y, z));
    const lengths = screen.slice(1).map((p, i) => Math.hypot(p[0] - screen[i][0], p[1] - screen[i][1]));
    const total = lengths.reduce((a, b) => a + b, 0) || 1;
    const duration = Math.min(1500, Math.max(650, 420 + total * 1.7));
    let walked = 0;
    const keyframes = points.map((p, i) => {
      if (i) walked += lengths[i - 1];
      return { transform: translate(p), offset: walked / total };
    });
    const waits = [];
    const mover = tokens.get(event.id);
    mover.classList.add("is-moving");
    tokenLayer.append(mover);
    mover.style.transform = translate(to);
    track(run, mover.animate(keyframes, { duration, easing: "cubic-bezier(.45,.05,.35,1)" }), waits);
    // Everyone else who changes slot (the queue moving up) slides into place.
    for (const [id, g] of tokens) {
      if (id === event.id) continue;
      const a = slotFor(id, before);
      const b = slotFor(id, view);
      if (a.every((v, i) => v === b[i])) continue;
      g.style.transform = translate(b);
      track(
        run,
        g.animate([{ transform: translate(a) }, { transform: translate(b) }], {
          duration: duration * 0.5,
          delay: duration * 0.35,
          easing: "cubic-bezier(.2,.8,.2,1)",
          fill: "backwards",
        }),
        waits,
      );
    }
    await Promise.all(waits);
    if (!run.cancelled) mover.classList.remove("is-moving");
  }

  function cancelRun() {
    if (!activeRun) return;
    activeRun.cancelled = true;
    for (const animation of activeRun.animations) animation.cancel();
    activeRun = null;
  }

  function update(frame, previousFrame = null, { animate = true, speed = 1, quantum: configured, algorithm, cpuNote, queueNote } = {}) {
    cancelRun();
    currentFrame = frame;
    progress = 0;
    if (configured !== undefined) quantum = configured;
    if (algorithm) notes = { algorithm, cpu: cpuNote ?? null, queue: queueNote ?? null };
    const events = frame.events.filter((event) => MOVES.has(event.type));
    const canAnimate = animate && !reducedMotion.matches && previousFrame && frame.t > previousFrame.t && events.length;
    if (!canAnimate) {
      settle(frame);
      return Promise.resolve();
    }
    const run = { speed, animations: new Set(), paused: false, cancelled: false };
    activeRun = run;
    view = copyView(previousFrame, processes);
    snap();
    return (async () => {
      for (const event of events) {
        if (run.cancelled) return;
        const before = { ...view };
        onMove(currentFrame, before, event);
        mutateView(view, event);
        await animateEvent(event, run, before);
      }
      if (run.cancelled) return;
      activeRun = null;
      settle(frame);
    })();
  }

  // Switch between the wide and the compact layout when the stage resizes.
  // Tokens jump to their slots in the new layout; a move in flight completes.
  new ResizeObserver(([entry]) => {
    const next = pick(entry.contentRect.width);
    if (next === L) return;
    const run = activeRun;
    build(next);
    if (run) for (const animation of run.animations) animation.finish();
    if (currentFrame && view) {
      snap();
      lightRoutes(new Set());
      paintDevices();
    }
  }).observe(host);

  return {
    update,
    setSpeed(speed) {
      if (!activeRun) return;
      activeRun.speed = speed;
      for (const animation of activeRun.animations) animation.updatePlaybackRate(speed);
    },
    setProgress(value) {
      progress = Math.max(0, Math.min(1, value));
      if (!activeRun && currentFrame) paintDevices();
    },
    pause() {
      if (!activeRun) return;
      activeRun.paused = true;
      for (const animation of activeRun.animations) animation.pause();
    },
    resume() {
      if (!activeRun) return;
      activeRun.paused = false;
      for (const animation of activeRun.animations) animation.play();
    },
    select(id) {
      selected = id;
      for (const [key, g] of tokens) g.classList.toggle("is-selected", key === id);
    },
  };
}
