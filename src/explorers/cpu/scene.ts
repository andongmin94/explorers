// The CPU scheduler as one isometric scene built from src/lib/iso (port of
// cpu/src/scene.js; imperative on purpose — React mounts it into a host
// element, see scheduler-scene.tsx).
//
// Five devices on one floor, wired with cables: the arrival tray (not yet
// arrived), the ready queue rail (numbered pockets, head at the CPU end, an
// occupancy LED per pocket), the CPU chip (the running process sits on its heat
// spreader and LEDs on the board count the quantum left), the I/O drive
// (blocked processes sit on it) and the done bin. P1–P3 are tokens that travel
// along the cables; the cable in use lights up.
import {
  LABEL,
  MAT,
  bin,
  cable,
  callout,
  chip,
  defs,
  fitScene,
  floor,
  frontText,
  labelScale,
  led,
  project,
  queueRail,
  ssd,
  token,
  tray,
  type Point,
} from "@/lib/iso/kit.ts";
import type {
  Algorithm,
  Frame,
  MoveEvent,
  MoveType,
  ProcessDef,
  SceneView,
  SimEvent,
} from "./types.ts";

const COLORS: Record<string, string> = { P1: "var(--p1)", P2: "var(--p2)", P3: "var(--p3)" };
const MOVES = new Set<string>(["arrive", "unblock", "preempt", "dispatch", "block", "complete"]);
const MAX_QUANTUM = 5;
const SLOTS = 3;
// A token rides just above the cable while it travels.
const RIDE = 0.2;
// On phones callout labels grow at most this much (see frame()).
const NARROW_LABEL_K = 1.8;

interface CalloutSpec {
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  anchor?: "start" | "middle" | "end";
  title: string;
  sub?: string;
}
type Zone = "arrivals" | "ready" | "cpu" | "io" | "done";

interface Layout {
  kind: "wide" | "narrow";
  ready: { x: number; y: number; slots: number; pitch: number };
  arrivals: { x: number; y: number; slots: number; pitch: number; d: number };
  cpu: { x: number; y: number; size: number };
  io: { x: number; y: number; w: number; d: number };
  done: { x: number; y: number; w: number; d: number };
  floorRect: { x: number; y: number; w: number; d: number };
  routes: Record<MoveType, Point[]>;
  callouts: Record<Zone, CalloutSpec>;
}

/* Callout label boxes in user units, for framing: Hangul is about 1em wide,
   everything else about 0.6em (sans title) / 0.62em (mono sub). */
function textWidth(text: string, size: number, latin: number) {
  let w = 0;
  for (const ch of String(text)) w += (/[ㄱ-힣]/.test(ch) ? 1 : ch === " " ? 0.3 : latin) * size;
  return w;
}
function labelBox(c: CalloutSpec, sub = c.sub ?? ""): number[] {
  const [sx, sy] = project(c.x, c.y, c.z);
  const lx = sx + c.dx;
  const ly = sy + c.dy;
  const w = Math.max(textWidth(c.title, LABEL.title, 0.6), textWidth(sub, LABEL.sub, 0.62)) + 8;
  const left = c.anchor === "end" ? lx - w : c.anchor === "start" ? lx : lx - w / 2;
  return [left, ly - LABEL.title, w, LABEL.title + (sub ? LABEL.sub + 10 : 6)];
}

/* Two world layouts (iso-kit units): a wide one whose chain runs across the
   screen for the desktop stage, and a compact one stacked down the screen for
   phones. Slot 0 of the ready queue (the head) is always the pocket nearest
   the CPU. */
function wideLayout(): Layout {
  const ready = { x: 0, y: 6, slots: SLOTS, pitch: 1.6 };
  const arrivals = { x: 1.4, y: 10.4, slots: SLOTS, pitch: 1.5, d: 2 };
  const cpu = { x: 9.3, y: 3.8, size: 4.8 };
  const io = { x: 10.5, y: -3.5, w: 4.6, d: 3 };
  const done = { x: 16.6, y: 5.2, w: 4.2, d: 3 };
  return {
    kind: "wide",
    ready,
    arrivals,
    cpu,
    io,
    done,
    floorRect: { x: -20, y: -20, w: 62, d: 52 },
    // Cables, world points on the floor. Each runs from device edge to device
    // edge along world axes; return paths end in an arrow head.
    routes: {
      arrive: [
        [1.9, 10.4],
        [1.9, 8.1],
      ],
      dispatch: [
        [7.7, 7.05],
        [9.3, 7.05],
      ],
      preempt: [
        [9.3, 4.3],
        [1.4, 4.3],
        [1.4, 5.55],
      ],
      block: [
        [12.8, 3.8],
        [12.8, -0.5],
      ],
      unblock: [
        [10.5, -2],
        [0.6, -2],
        [0.6, 5.55],
      ],
      complete: [
        [14.1, 6.7],
        [16.6, 6.7],
      ],
    },
    callouts: {
      arrivals: { x: 2.2, y: 12.4, z: 0.3, dx: -14, dy: 44, title: "도착 예정", sub: "NEW" },
      ready: { x: 0.8, y: 6.6, z: 0.62, dx: -40, dy: -40, anchor: "end", title: "준비 큐" },
      cpu: { x: 9.9, y: 8.0, z: 0.24, dx: 40, dy: 52, anchor: "end", title: "CPU" },
      io: {
        x: 11.0,
        y: -3.0,
        z: 0.42,
        dx: 36,
        dy: -60,
        title: "입출력 장치",
        sub: "CPU와 동시에 진행",
      },
      done: { x: 20.4, y: 5.8, z: 1, dx: 24, dy: -36, anchor: "start", title: "완료", sub: "DONE" },
    },
  };
}

function narrowLayout(): Layout {
  const ready = { x: 0, y: 6, slots: SLOTS, pitch: 1.6 };
  const arrivals = { x: 1.5, y: 2.2, slots: SLOTS, pitch: 1.5, d: 2 };
  const cpu = { x: 9.1, y: 8.1, size: 4.8 };
  const io = { x: 8, y: 14.5, w: 4.6, d: 3 };
  const done = { x: 13.4, y: 14.2, w: 4.2, d: 3 };
  return {
    kind: "narrow",
    ready,
    arrivals,
    cpu,
    io,
    done,
    floorRect: { x: -16, y: -16, w: 50, d: 50 },
    routes: {
      arrive: [
        [2.0, 4.2],
        [2.0, 6.0],
      ],
      dispatch: [
        [7.7, 7.05],
        [10.5, 7.05],
        [10.5, 8.1],
      ],
      preempt: [
        [9.1, 9.6],
        [1.6, 9.6],
        [1.6, 8.5],
      ],
      block: [
        [10.3, 12.9],
        [10.3, 14.5],
      ],
      unblock: [
        [8.6, 14.5],
        [8.6, 11],
        [0.6, 11],
        [0.6, 8.5],
      ],
      complete: [
        [13.6, 12.9],
        [13.6, 14.2],
      ],
    },
    callouts: {
      arrivals: {
        x: 6.2,
        y: 3.2,
        z: 0.62,
        dx: 26,
        dy: -26,
        anchor: "start",
        title: "도착 예정",
        sub: "NEW",
      },
      ready: { x: 0.6, y: 6.6, z: 0.62, dx: -20, dy: -36, title: "준비 큐" },
      cpu: { x: 13.5, y: 10, z: 0.25, dx: 40, dy: -10, anchor: "start", title: "CPU" },
      io: {
        x: 8.4,
        y: 16,
        z: 0.42,
        dx: -10,
        dy: 44,
        anchor: "end",
        title: "입출력 장치",
        sub: "CPU와 동시에 진행",
      },
      done: { x: 17.2, y: 15.6, z: 1, dx: 38, dy: 14, anchor: "start", title: "완료", sub: "DONE" },
    },
  };
}

type ViewZone = "new" | "ready" | "running" | "blocked" | "done";

interface Devices {
  svg: Record<Zone, string>;
  bounds: Point[];
  slots: Record<ViewZone, (i: number) => Point>;
  led: (i: number, count: number) => Point;
}

const corners = (x: number, y: number, w: number, d: number, top: number): Point[] => [
  [x, y, 0],
  [x + w, y, 0],
  [x + w, y + d, 0],
  [x, y + d, 0],
  [x, y, top],
  [x + w, y, top],
  [x + w, y + d, top],
  [x, y + d, top],
];

/** Build the devices of a layout; returns their SVG and the slot functions. */
function devices(L: Layout, chipSub: string): Devices {
  const ready = queueRail({ ...L.ready, exit: "end", label: "READY", numbers: false });
  const arrivals = tray({ ...L.arrivals, mat: MAT.plastic, numbers: false });
  const cpu = chip({
    x: L.cpu.x,
    y: L.cpu.y,
    size: L.cpu.size,
    label: "CPU",
    sub: chipSub,
    cls: "cpu-chip-device",
  });
  const io = ssd({ ...L.io, label: "I/O" });
  const done = bin({ ...L.done, capacity: 4, label: "DONE" });
  const n = L.ready.slots;
  // The rail's head is its last pocket; number the pockets from the head
  // (1 = next to run) on the face below each pocket, beside its LED.
  const rd = ready.d;
  const numbers = ready.slots
    .map(([x]) => x)
    .map((x, i) =>
      frontText({
        x: x - 0.12,
        y: L.ready.y + rd + 0.002,
        z: 0.31,
        text: String(n - i),
        size: 12,
        weight: 700,
        fill: MAT.metal.ink,
        engrave: MAT.metal.engrave,
        anchor: "end",
        cls: "cpu-queue-num",
      }),
    )
    .join("");
  const [cx, cy] = cpu.slots[0];
  const top = cpu.top;
  const size = L.cpu.size;
  return {
    svg: {
      ready: ready.svg + numbers,
      arrivals: arrivals.svg,
      cpu: cpu.svg,
      io: io.svg,
      done: done.svg,
    },
    bounds: [
      ...corners(L.ready.x, L.ready.y, ready.w, ready.d, ready.top),
      ...corners(L.arrivals.x, L.arrivals.y, arrivals.w, arrivals.d, arrivals.top),
      ...corners(L.cpu.x, L.cpu.y, size, size, top + 0.6),
      ...corners(L.io.x, L.io.y, L.io.w, L.io.d, io.top + 0.6),
      ...corners(L.done.x, L.done.y, L.done.w, L.done.d, done.top),
      ...Object.values(L.routes)
        .flat()
        .map(([x, y]) => [x, y, 0]),
    ],
    slots: {
      new: (i) => arrivals.slots[i] ?? arrivals.slots.at(-1)!,
      ready: (i) => ready.slots[n - 1 - i] ?? ready.slots[0],
      // The running process sits on the heat spreader, a little behind the
      // engraved label so "CPU" stays readable in front of it.
      running: () => [cx - 0.15, cy - 0.65, top],
      blocked: (i) => [L.io.x + 1.25 + i * 1.3, L.io.y + L.io.d / 2, io.top],
      done: (i) => done.slots[i] ?? done.slots.at(-1)!,
    },
    // Quantum LEDs in a row on the board's front margin.
    led: (i, count) => [
      L.cpu.x + size / 2 + (i - (count - 1) / 2) * 0.62,
      L.cpu.y + size - 0.36,
      0.25,
    ],
  };
}

function zoneOf(id: string, view: SceneView): [ViewZone, number] {
  if (view.running === id) return ["running", 0];
  for (const zone of ["new", "ready", "blocked", "done"] as const) {
    const index = view[zone].indexOf(id);
    if (index >= 0) return [zone, index];
  }
  return ["new", 0];
}
const translate = ([x, y, z]: Point) => {
  const [sx, sy] = project(x, y, z);
  return `translate(${Math.round(sx * 100) / 100}px, ${Math.round(sy * 100) / 100}px)`;
};

const copyView = (frame: Frame, processes: ProcessDef[]): SceneView => ({
  new: processes.filter((p) => frame.states[p.id].status === "new").map((p) => p.id),
  ready: [...frame.ready],
  running: frame.running,
  blocked: frame.blocked.map((p) => p.id),
  done: [...frame.completed],
});

function mutateView(view: SceneView, event: MoveEvent) {
  for (const key of ["new", "ready", "blocked", "done"] as const)
    view[key] = view[key].filter((id) => id !== event.id);
  if (view.running === event.id) view.running = null;
  if (event.to === "running") view.running = event.id;
  else
    view[
      event.to === "blocked"
        ? "blocked"
        : event.to === "done"
          ? "done"
          : event.to === "new"
            ? "new"
            : "ready"
    ].push(event.id);
}

const RETURNS = new Set<string>(["preempt", "unblock"]);

function staticSvg(
  L: Layout,
  D: Devices,
  processes: ProcessDef[],
  notes: { queue: string; cpuSub: string },
) {
  // Cables first, so the devices' edges cover their plugs.
  const cables = Object.entries(L.routes)
    .map(
      ([type, points]) =>
        `<g class="cpu-route" data-route="${type}">${cable(points, { width: type === "dispatch" ? 7 : RETURNS.has(type) ? 5 : 6, arrow: RETURNS.has(type), pulse: true })}</g>`,
    )
    .join("");
  const leds = Array.from(
    { length: MAX_QUANTUM },
    () => `<g class="cpu-qled">${led({ x: 0, y: 0, z: 0 })}</g>`,
  ).join("");
  const io = L.io;
  const tokens = processes
    .map(
      (p) =>
        `<g class="cpu-token" data-process="${p.id}" role="button" tabindex="0" aria-label="${p.id} ${p.name} 작업 상세 보기">${token({ id: p.id, color: COLORS[p.id] })}</g>`,
    )
    .join("");
  const c = L.callouts;
  return `<svg class="cpu-scene-svg" xmlns="http://www.w3.org/2000/svg">
    ${defs()}
    ${floor(L.floorRect)}
    <g class="cpu-routes">${cables}</g>
    <g class="cpu-dev cpu-dev-arrivals">${D.svg.arrivals}</g>
    <g class="cpu-dev cpu-dev-ready">${D.svg.ready}</g>
    <g class="cpu-dev cpu-dev-io">${D.svg.io}</g>
    <g class="cpu-io-led">${led({ x: io.x + io.w - 0.45, y: io.y + io.d - 0.32, z: 0.42, size: 1.2 })}</g>
    <g class="cpu-dev cpu-dev-cpu">${D.svg.cpu}</g>
    <g class="cpu-qleds">${leds}</g>
    <g class="cpu-dev cpu-dev-done">${D.svg.done}</g>
    <g class="cpu-callouts">
      ${callout(c.arrivals)}
      ${callout({ ...c.ready, sub: notes.queue, cls: "cpu-callout-ready" })}
      ${callout({ ...c.cpu, sub: notes.cpuSub, cls: "cpu-callout-cpu" })}
      ${callout(c.io)}
      ${callout(c.done)}
    </g>
    <g class="cpu-tokens">${tokens}</g>
  </svg>`;
}

const CHIP_SUB: Record<Algorithm, string> = { rr: "RR", fcfs: "FCFS", sjf: "SJF", srtf: "SRTF" };

export interface SceneUpdate {
  animate?: boolean;
  speed?: number;
  /** The RR quantum, or null without one (the quantum LEDs hide). */
  quantum?: number | null;
  algorithm?: Algorithm;
  cpuNote?: string;
  queueNote?: string;
}

/** What the page drives: one update per frame, WAAPI playback controls, selection. */
export interface SchedulerScene {
  update(frame: Frame, previous?: Frame | null, options?: SceneUpdate): Promise<void>;
  setSpeed(speed: number): void;
  setProgress(value: number): void;
  pause(): void;
  resume(): void;
  select(id: string | null): void;
  destroy(): void;
}

interface Run {
  speed: number;
  animations: Set<Animation>;
  paused: boolean;
  cancelled: boolean;
}

/**
 * update(frame, previous, { animate, speed, quantum }) → Promise that settles
 * once every move in the frame has travelled. onMove(frame, viewBefore, event)
 * fires before each move so the page can present the scene move by move.
 */
export function createSchedulerScene(
  host: HTMLElement,
  processes: ProcessDef[],
  onMove: (frame: Frame, view: SceneView, move: SimEvent) => void,
): SchedulerScene {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let L!: Layout;
  let D!: Devices;
  let svg!: SVGSVGElement;
  let tokenLayer!: SVGGElement;
  let tokens = new Map<string, SVGGElement>();
  let routes: SVGGElement[] = [];
  let leds: SVGGElement[] = [];
  let ioLed: Element | null = null;
  let readyLeds: SVGGElement[] = [];
  let newLeds: SVGGElement[] = [];
  let stopLabels: (() => void) | undefined;
  // Callout text for the current method (set by update()).
  let notes: { algorithm: Algorithm; cpu: string | null; queue: string | null } = {
    algorithm: "rr",
    cpu: null,
    queue: null,
  };
  let built = "";
  let view: SceneView | null = null;
  let currentFrame: Frame | null = null;
  let quantum: number | null = 2;
  let activeRun: Run | null = null;
  let progress = 0;
  let selected: string | null = null;

  const slotFor = (id: string, v: SceneView) => {
    const [zone, index] = zoneOf(id, v);
    return D.slots[zone](index);
  };
  const cpuSub = () =>
    notes.cpu ??
    (quantum == null ? "FCFS · 구간이 끝날 때까지" : `LED = 남은 할당량 (${quantum} ms)`);
  const queueSub = () => notes.queue ?? "FIFO · 1번이 다음 차례";

  // Frame the devices, cables and callout labels to the stage's aspect.
  function frame() {
    if (!svg) return;
    const narrow = L.kind === "narrow";
    const box = host.getBoundingClientRect();
    const aspect = narrow ? 0.92 : Math.max(0.6, (box.width || 16) / (box.height || 10));
    const c = L.callouts;
    const estimates = [
      labelBox(c.arrivals),
      labelBox(c.ready, queueSub()),
      labelBox(c.cpu, cpuSub()),
      labelBox(c.io),
      labelBox(c.done),
    ];
    // Measured label boxes when the svg is rendered, grown by the label scale
    // round the point where the leader meets them; estimates otherwise.
    // (On phones the scene only scales to the width: framing labels grown by
    // the live scale would shrink the scene and grow them again; cap it.)
    const k = narrow ? NARROW_LABEL_K : Number(svg.style.getPropertyValue("--iso-label-k")) || 1;
    const labels = [...svg.querySelectorAll<SVGGElement>(".cpu-callouts .iso-callout-label")].map(
      (g, i) => {
        const b = g.getBBox?.();
        if (!b || !b.width) return estimates[i];
        const [ox, oy] = g.style.transformOrigin.split(" ").map(parseFloat);
        return [ox + (b.x - ox) * k, oy + (b.y - oy) * k, b.width * k, b.height * k];
      },
    );
    // On phones the scene's height follows its viewBox: frame it to the
    // content's own aspect (never taller than 0.92) so no empty floor band
    // sits above and below the devices.
    let stageAspect = aspect;
    if (narrow) {
      const s = D.bounds.map(([x, y, z = 0]) => project(x, y, z) as number[]);
      for (const [lx, ly, lw, lh] of labels) s.push([lx, ly], [lx + lw, ly + lh]);
      const xs = s.map((p) => p[0]);
      const ys = s.map((p) => p[1]);
      const w = Math.max(...xs) - Math.min(...xs) + 8;
      const h = Math.max(...ys) - Math.min(...ys) + 8;
      stageAspect = Math.min(1.6, Math.max(aspect, w / (h || 1)));
    }
    const next = fitScene(D.bounds, { stageAspect, fill: narrow ? 0.96 : 0.9, pad: 4, labels });
    if (svg.getAttribute("viewBox") !== next) svg.setAttribute("viewBox", next);
  }

  function build(layout: Layout) {
    L = layout;
    D = devices(L, CHIP_SUB[notes.algorithm] ?? "");
    built = `${L.kind}:${notes.algorithm}`;
    stopLabels?.();
    host.innerHTML = staticSvg(L, D, processes, { queue: queueSub(), cpuSub: cpuSub() });
    host.dataset.layout = L.kind;
    svg = host.querySelector("svg")!;
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    tokenLayer = svg.querySelector<SVGGElement>(".cpu-tokens")!;
    tokens = new Map(
      [...svg.querySelectorAll<SVGGElement>(".cpu-token")].map((g) => [g.dataset.process!, g]),
    );
    routes = [...svg.querySelectorAll<SVGGElement>(".cpu-route")];
    leds = [...svg.querySelectorAll<SVGGElement>(".cpu-qled")];
    ioLed = svg.querySelector(".cpu-io-led .iso-led");
    readyLeds = [...svg.querySelectorAll<SVGGElement>(".cpu-dev-ready .iso-tray-led")];
    newLeds = [...svg.querySelectorAll<SVGGElement>(".cpu-dev-arrivals .iso-tray-led")];
    for (const [key, g] of tokens) g.classList.toggle("is-selected", key === selected);
    frame();
    stopLabels = labelScale(svg, L.kind === "narrow" ? { max: NARROW_LABEL_K } : {});
  }
  // Phones (the stacked console) get the compact layout; every desktop stage the wide one.
  const phone = matchMedia("(max-width: 759px)");
  const kindFor = () => (phone.matches ? "narrow" : "wide");
  const pick = () => (kindFor() === "narrow" ? narrowLayout() : wideLayout());
  build(pick());

  function sortTokens() {
    const depth = (id: string) => {
      const [x, y, z] = slotFor(id, view!);
      return x + y + z;
    };
    [...tokens.keys()]
      .sort((a, b) => depth(a) - depth(b))
      .forEach((id) => tokenLayer.append(tokens.get(id)!));
  }

  function snap() {
    for (const [id, g] of tokens) {
      g.style.transform = translate(slotFor(id, view!));
      g.classList.remove("is-moving");
    }
    sortTokens();
  }

  function lightRoutes(types: Set<string>) {
    for (const g of routes)
      g.firstElementChild!.classList.toggle("is-active", types.has(g.dataset.route!));
  }

  function paintDevices() {
    const frame_ = currentFrame;
    const n = quantum ?? 0;
    const stable = frame_ && view && view.running && view.running === frame_.running && !activeRun;
    const left = stable && frame_.quantumLeft != null ? frame_.quantumLeft : 0;
    leds.forEach((g, i) => {
      g.style.display = i < n ? "" : "none";
      if (i >= n) return;
      g.style.transform = `${translate(D.led(i, n))} scale(1.25)`;
      const on = i < left;
      const iso = g.firstElementChild as SVGGElement;
      iso.classList.toggle("is-on", on);
      // The LED being spent dims through the current millisecond.
      iso.style.opacity = on && i === left - 1 ? String(1 - progress * 0.75) : "";
    });
    // Occupancy LEDs: the rail's pockets count from the head (last pocket).
    const queued = view ? view.ready.length : 0;
    readyLeds.forEach((g) => g.classList.toggle("is-on", Number(g.dataset.slot) >= SLOTS - queued));
    const waiting = view ? view.new.length : 0;
    newLeds.forEach((g) => g.classList.toggle("is-on", Number(g.dataset.slot) < waiting));
    ioLed?.classList.toggle("is-on", !!view && view.blocked.length > 0);
    // The callout subs follow the method; reframe when their width changes.
    let relabel = false;
    for (const [sel, text] of [
      [".cpu-callout-cpu .iso-callout-sub", cpuSub()],
      [".cpu-callout-ready .iso-callout-sub", queueSub()],
    ] as const) {
      const el = svg.querySelector(sel)!;
      if (el.textContent !== text) {
        el.textContent = text;
        relabel = true;
      }
    }
    if (relabel) frame();
    // Without a quantum the LEDs are hidden (cpu.css: [data-algorithm="fcfs"]).
    host.dataset.algorithm = quantum == null ? "fcfs" : "rr";
    host.dataset.policy = notes.algorithm;
  }

  function settle(frame_: Frame) {
    view = copyView(frame_, processes);
    snap();
    lightRoutes(new Set(frame_.events.filter((e) => MOVES.has(e.type)).map((e) => e.type)));
    paintDevices();
  }

  function track(run: Run, animation: Animation, waits: Promise<unknown>[]) {
    run.animations.add(animation);
    animation.playbackRate = run.speed;
    if (run.paused) animation.pause();
    waits.push(animation.finished.catch(() => {}).then(() => run.animations.delete(animation)));
  }

  async function animateEvent(event: MoveEvent, run: Run, before: SceneView) {
    lightRoutes(new Set([event.type]));
    paintDevices();
    const from = slotFor(event.id, before);
    const to = slotFor(event.id, view!);
    const points: Point[] = [from, ...L.routes[event.type].map(([x, y]) => [x, y, RIDE]), to];
    const screen = points.map(([x, y, z]) => project(x, y, z));
    const lengths = screen
      .slice(1)
      .map((p, i) => Math.hypot(p[0] - screen[i][0], p[1] - screen[i][1]));
    const total = lengths.reduce((a, b) => a + b, 0) || 1;
    const duration = Math.min(1500, Math.max(650, 420 + total * 1.7));
    let walked = 0;
    const keyframes = points.map((p, i) => {
      if (i) walked += lengths[i - 1];
      return { transform: translate(p), offset: walked / total };
    });
    const waits: Promise<unknown>[] = [];
    const mover = tokens.get(event.id)!;
    mover.classList.add("is-moving");
    tokenLayer.append(mover);
    mover.style.transform = translate(to);
    track(
      run,
      mover.animate(keyframes, { duration, easing: "cubic-bezier(.45,.05,.35,1)" }),
      waits,
    );
    // Everyone else who changes slot (the queue moving up) slides into place.
    for (const [id, g] of tokens) {
      if (id === event.id) continue;
      const a = slotFor(id, before);
      const b = slotFor(id, view!);
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

  function update(
    frame_: Frame,
    previousFrame: Frame | null = null,
    {
      animate = true,
      speed = 1,
      quantum: configured,
      algorithm,
      cpuNote,
      queueNote,
    }: SceneUpdate = {},
  ): Promise<void> {
    cancelRun();
    currentFrame = frame_;
    progress = 0;
    if (configured !== undefined) quantum = configured;
    if (algorithm) notes = { algorithm, cpu: cpuNote ?? null, queue: queueNote ?? null };
    // The chip's engraved method name changes with the method.
    if (`${L.kind}:${notes.algorithm}` !== built)
      build(L.kind === "narrow" ? narrowLayout() : wideLayout());
    const events = frame_.events.filter((event): event is MoveEvent => MOVES.has(event.type));
    const canAnimate =
      animate &&
      !reducedMotion.matches &&
      previousFrame &&
      frame_.t > previousFrame.t &&
      events.length;
    if (!canAnimate) {
      settle(frame_);
      return Promise.resolve();
    }
    const run: Run = { speed, animations: new Set(), paused: false, cancelled: false };
    activeRun = run;
    view = copyView(previousFrame, processes);
    snap();
    return (async () => {
      for (const event of events) {
        if (run.cancelled) return;
        const before = { ...view! };
        onMove(currentFrame!, before, event);
        mutateView(view!, event);
        await animateEvent(event, run, before);
      }
      if (run.cancelled) return;
      activeRun = null;
      settle(frame_);
    })();
  }

  // Reframe when the stage resizes; switch between the wide and the compact
  // layout when the width crosses the phone breakpoint. Tokens jump to their
  // slots in the new layout; a move in flight completes.
  const observer = new ResizeObserver(() => {
    const kind = kindFor();
    if (kind === L.kind) {
      frame();
      return;
    }
    const run = activeRun;
    build(pick());
    if (run) for (const animation of run.animations) animation.finish();
    if (currentFrame && view) {
      snap();
      lightRoutes(new Set());
      paintDevices();
    }
  });
  observer.observe(host);

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
    destroy() {
      cancelRun();
      observer.disconnect();
      stopLabels?.();
      host.replaceChildren();
    },
  };
}
