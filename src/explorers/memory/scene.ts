// The memory explorer's isometric scene (port of memory/src/scene.js;
// imperative on purpose — React mounts it into a host element, see
// memory-scene.tsx): a CPU chip, a page-table module, a
// RAM stick with its frame tray, and an SSD, joined by cables in a loop:
// lookup (CPU → table), fault (table → SSD), load (SSD → RAM), read (RAM → CPU).
// Pages are tokens: the SSD keeps the originals A–E, the frame tray holds the
// copies, and one access moves them along the cables. The RAM has 3 or 4
// frames (lesson 03 compares both); under Clock every frame shows its
// reference-bit LED and a hand on the floor points at one frame.
import { josa } from "@/lib/josa.ts";
import {
  MAT,
  cable,
  callout,
  chip,
  defs,
  fitScene,
  floor,
  frontQuad,
  frontText,
  labelScale,
  place,
  project,
  ramStick,
  ssd,
  tableModule,
  token,
  topText,
  tray,
  travel as kitTravel,
  type Point,
  wellDef,
} from "@/lib/iso/kit.ts";
import type { Algorithm, Frame, SelectReason, Step } from "./types.ts";

// The pages on the SSD and in the page table: A–E in the lessons, the
// custom input's own pages (A–H) in 직접 실험 (setPages()).
let PAGES = ["A", "B", "C", "D", "E"];
export const pageColor = (page: string) => `var(--page-${page.toLowerCase()})`;

/* ---------- World layout (iso units) ----------
   Two rows on screen: page table and SSD at the back, CPU and RAM in front,
   so the cluster is about as wide as the stage. The cables close the loop. */
const CPU = { x: 3.55, y: 11.05, size: 4.4 };
let TABLE = { x: -3.95, y: 2.35, w: 5.4, d: 5.8 };
const RAM_X = 8.4;
const RAM_Y = 4.3;
const TRAY_Y = RAM_Y + 1.75;
const TRAY_D = 2.6;
const TRAY_H = 0.9;
let DISK = { x: 1.45, y: -3.4, w: 8.6, d: 3.3 };
/** Size the page table (one row per page) and the SSD (one original per page). */
function setPages(pages: readonly string[]) {
  PAGES = [...pages];
  const n = PAGES.length;
  TABLE = { ...TABLE, d: Math.max(3.8, 0.9 + n * 0.98) };
  DISK = { ...DISK, w: Math.max(8.6, 2.2 + (n - 1) * 1.6) };
}
const TOKEN = 1.3;

// The RAM grows to the right with the frame count; the stick's chips line up
// with the frame pockets, one chip per frame.
let N = 3;
let PITCH = 2.4;
let LEN = 1 + N * PITCH;
function setFrameCount(n: number) {
  N = n;
  PITCH = n > 3 ? 2.2 : 2.4;
  LEN = 1 + n * PITCH;
}
const SLOTS = () => Array.from({ length: N }, (_, slot) => slot);
const slotX = (slot: number) => RAM_X + 0.5 + slot * PITCH + PITCH / 2;
const SLOT_Y = TRAY_Y + 0.3 + (TRAY_D - 0.66) / 2;
const SLOT_Z = TRAY_H - 0.33;
const FACE_Y = TRAY_Y + TRAY_D;
const HAND_Y = FACE_Y + 0.35;

let table: ReturnType<typeof tableModule> | null = null; // tableModule() result (cells, rowLeds)
const diskX = (page: string) => DISK.x + 1.15 + PAGES.indexOf(page) * 1.6;
const diskY = () => DISK.y + DISK.d / 2 + 0.05;
const DISK_TOP = 0.42;
const CPU_TOP = 0.75;

const slotPoint = (slot: number, lift = 0): Point => [slotX(slot), SLOT_Y, SLOT_Z + lift];
const diskPoint = (page: string, lift = 0): Point => [diskX(page), diskY(), DISK_TOP + lift];
const cpuPoint = (lift = 0): Point => [CPU.x + CPU.size / 2, CPU.y + CPU.size / 2, CPU_TOP + lift];
const entryPoint = (page: string, lift = 0): Point => {
  const [x, y, z] = table!.cells[PAGES.indexOf(page)][0];
  return [x, y, z + lift];
};

// Cable routes along world axes, from device edge to device edge.
const LOOKUP_X = -3.95 + 3.95;
const LOOKUP_Y = CPU.y + 1.0;
const FAULT_X = 1.45 + 2.1;
const FAULT_Y = 2.35 + 0.9;
const READ_X = CPU.x + 2.9;
const READ_Y = TRAY_Y + 1.3;
const LOAD_X = () => DISK.x + DISK.w - 1.0;
const ROUTES: Record<"lookup" | "fault" | "load" | "read", () => Point[]> = {
  lookup: () => [
    [CPU.x + 0.1, LOOKUP_Y],
    [LOOKUP_X, LOOKUP_Y],
    [LOOKUP_X, TABLE.y + TABLE.d - 0.1],
  ],
  fault: () => [
    [TABLE.x + TABLE.w - 0.1, FAULT_Y],
    [FAULT_X, FAULT_Y],
    [FAULT_X, DISK.y + DISK.d - 0.1],
  ],
  load: () => [
    [LOAD_X(), DISK.y + DISK.d - 0.1],
    [LOAD_X(), RAM_Y + 0.2],
  ],
  read: () => [
    [RAM_X + 0.35, READ_Y],
    [READ_X, READ_Y],
    [READ_X, CPU.y + 0.1],
  ],
};

// Callouts: a world anchor plus a label offset; their label boxes join the framing.
interface Note {
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  title: string;
  sub: string;
  widest?: string;
  anchor: "start" | "middle" | "end";
  cls?: string;
}
const NOTES = (): Note[] => [
  {
    x: CPU.x + 0.3,
    y: CPU.y + CPU.size - 0.4,
    z: 0.25,
    dx: -56,
    dy: 26,
    title: "CPU",
    sub: "요청하는 쪽",
    anchor: "end",
  },
  {
    x: TABLE.x + 0.2,
    y: TABLE.y + TABLE.d,
    z: 0.3,
    dx: -30,
    dy: -40,
    title: "페이지 테이블",
    sub: "상주 여부 · 프레임",
    anchor: "end",
  },
  {
    x: RAM_X + LEN - 0.3,
    y: FACE_Y - 0.3,
    z: TRAY_H,
    dx: 50,
    dy: 16,
    title: "RAM",
    sub: "·",
    widest: "#1 다음 교체 · 마지막 접근",
    anchor: "start",
    cls: "mem-ram-callout",
  },
  {
    x: DISK.x + DISK.w - 0.3,
    y: DISK.y + 0.4,
    z: DISK_TOP,
    dx: 40,
    dy: -30,
    title: "SSD",
    sub: `원본 ${PAGES[0]}–${PAGES.at(-1)}`,
    anchor: "start",
  },
];
/** A callout label box [x, y, w, h], grown by k about the point labelScale() scales it from. */
const labelBox = (n: Note, k = 1) => {
  const [sx, sy] = project(n.x, n.y, n.z);
  const w = Math.max(n.title.length * 16, (n.widest ?? n.sub).length * 7.6);
  const lx = sx + n.dx;
  const ly = sy + n.dy;
  const x = n.anchor === "end" ? lx - w : n.anchor === "start" ? lx : lx - w / 2;
  const y = ly - 16;
  const oy = n.dy > 12 ? ly - 11 : ly + (n.sub ? 25 : 9);
  return [lx + (x - lx) * k, oy + (y - oy) * k, w * k, 38 * k];
};

/** World points the framing keeps in view: device corners and tops, token lifts. */
function framePoints(): Point[] {
  const box = (x: number, y: number, w: number, d: number, h: number): Point[] => [
    [x, y, 0],
    [x + w, y, 0],
    [x + w, y + d, 0],
    [x, y + d, 0],
    [x, y, h],
    [x + w, y, h],
  ];
  return [
    ...box(CPU.x, CPU.y, CPU.size, CPU.size, 1.4),
    ...box(TABLE.x, TABLE.y, TABLE.w, TABLE.d, 0.8),
    ...box(RAM_X, RAM_Y, LEN, FACE_Y - RAM_Y, 2.6),
    ...box(DISK.x, DISK.y, DISK.w, DISK.d, 1.2),
    [slotX(0) - 0.5, HAND_Y + 1.6, 0],
    [CPU.x, READ_Y, 0],
  ];
}

/** A round LED set into a front face (y = const). */
function faceLed({
  x,
  y,
  z,
  on = false,
  color = "var(--accent)",
}: {
  x: number;
  y: number;
  z: number;
  on?: boolean;
  color?: string;
}) {
  const [lx, ly] = project(x, y, z);
  return `<g class="iso-led mem-face-led ${on ? "is-on" : ""}" style="--led: ${color}">
    <circle cx="${lx}" cy="${ly}" r="5.6" class="iso-led-halo"/>
    <circle cx="${lx}" cy="${ly + 0.5}" r="3.5" class="iso-led-bezel"/>
    <circle cx="${lx}" cy="${ly}" r="2.9" class="iso-led-core"/>
    <circle cx="${lx - 0.8}" cy="${ly - 0.9}" r=".8" class="iso-led-spec"/>
  </g>`;
}

const polygon = (corners: number[][], z: number, cls: string, extra = "") =>
  `<polygon class="${cls}" ${extra} points="${corners
    .map(([a, b]) =>
      project(a, b, z)
        .map((n) => Math.round(n * 100) / 100)
        .join(","),
    )
    .join(" ")}"/>`;

function staticScene() {
  const cpu = chip({ ...CPU, label: "" });
  table = tableModule({
    ...TABLE,
    rows: PAGES.length,
    cols: 2,
    headers: ["", ""],
    cls: "mem-table",
  });
  const stick = ramStick({
    x: RAM_X,
    y: RAM_Y,
    length: LEN,
    chips: N,
    label: "",
    cls: "mem-stick",
  });
  const frames = tray({
    x: RAM_X + 0.25,
    y: TRAY_Y,
    slots: N,
    pitch: PITCH,
    d: TRAY_D,
    h: TRAY_H,
    numbers: false,
    leds: false,
    mat: MAT.metal,
    cls: "mem-tray",
  });
  const disk = ssd({ ...DISK, label: "" });
  const tbl = table;
  const top = tbl.cells[0][0][2];

  // Table: engraved column heads, then a page letter and a frame number per row.
  const gx = TABLE.x + 0.7;
  const cw = (TABLE.w - 1) / 2;
  const heads = ["PAGE", "FRAME"]
    .map((text, c) =>
      topText({
        x: gx + c * cw + cw / 2,
        y: TABLE.y + 0.2,
        z: top,
        text,
        size: 10,
        weight: 700,
        fill: MAT.plastic.ink,
        engrave: MAT.plastic.engrave,
      }),
    )
    .join("");
  const entries = PAGES.map((page, r) => {
    const [px, py] = tbl.cells[r][0];
    const [fx, fy] = tbl.cells[r][1];
    return `<g class="mem-entry" data-entry="${page}">
      ${topText({ x: px, y: py, z: top, text: page, size: 16, weight: 800, fill: pageColor(page), cls: "mem-entry-page" })}
      <g class="mem-entry-frame">${topText({ x: fx, y: fy, z: top, text: "—", size: 14, weight: 800, fill: "var(--iso-glass-ink)" })}</g>
    </g>`;
  }).join("");

  // A glow over each memory chip, lit while its frame is selected or hit.
  const chipW = PITCH - 0.2;
  const glows = stick.chipsAt
    .map(
      ([x, y, z], slot) =>
        `<g class="mem-chip-glow" data-chip="${slot}">${frontQuad({ x: x - chipW / 2, y: y + 0.002, z: z - 0.41, w: chipW, h: 0.82, fill: "var(--accent)" })}</g>`,
    )
    .join("");

  // Pocket rims, lit on select / hit.
  const rings = SLOTS()
    .map((slot) => {
      const [x, y] = frames.slots[slot];
      const w = (PITCH - 0.2) / 2;
      const d = (TRAY_D - 0.66) / 2;
      return polygon(
        [
          [x - w, y - d],
          [x + w, y - d],
          [x + w, y + d],
          [x - w, y + d],
        ],
        TRAY_H + 0.004,
        "mem-slot-ring",
        `data-ring="${slot}"`,
      );
    })
    .join("");

  // Frame faces: "F0" engraved, then a status LED with the policy mark (rank or R bit).
  const faces = SLOTS()
    .map(
      (slot) => `<g class="mem-slot" data-slot="${slot}">
        ${frontText({ x: slotX(slot) - 0.6, y: FACE_Y + 0.002, z: TRAY_H / 2, text: `F${slot}`, size: 13, weight: 800, fill: "var(--mem-face-ink)", engrave: "var(--mem-face-engrave)" })}
        <g class="mem-rank"></g>
      </g>`,
    )
    .join("");

  const originals = PAGES.map(
    (page) =>
      `<g class="mem-original" data-original="${page}">${token({ id: page, color: pageColor(page), size: TOKEN })}</g>`,
  ).join("");

  const cables = Object.entries(ROUTES)
    .map(([name, route]) =>
      cable(route(), {
        id: `mem-cable-${name}`,
        cls: "mem-cable",
        width: name === "fault" ? 5 : 6.5,
        pulse: true,
        arrow: true,
      }),
    )
    .join("");

  // The clock hand: an accent pointer on the floor, drawn at the origin and placed under a frame.
  const hand = `<g class="mem-hand-pointer">
      ${polygon(
        [
          [0, 0.1],
          [0.5, 0.8],
          [0.16, 0.8],
          [0.16, 1.6],
          [-0.16, 1.6],
          [-0.16, 0.8],
          [-0.5, 0.8],
        ],
        0.01,
        "mem-hand-arrow",
      )}
      <text class="mem-hand-label" x="${project(0, 1.75)[0] - 6}" y="${project(0, 1.75)[1] + 6}" text-anchor="end">바늘</text>
    </g>`;

  return `<svg class="mem-svg" viewBox="0 0 800 400" role="img" aria-label="CPU, 페이지 테이블, RAM 프레임, SSD 장면">
    ${defs()}
    ${floor({ x: -14, y: -16, w: 50, d: 44 })}
    ${cables}
    ${disk.svg}
    ${table.svg}
    ${heads}
    ${entries}
    ${stick.svg}
    ${glows}
    ${frames.svg}
    ${rings}
    ${faces}
    <g class="mem-hand" style="display: none">${hand}</g>
    ${cpu.svg}
    ${NOTES()
      .map((n) => callout(n))
      .join("")}
    <g class="mem-originals">${originals}</g>
    <defs>${wellDef("mem-well", frames.pocket)}</defs>
    <g class="mem-tokens">${SLOTS()
      .map(
        (slot) => `<g class="mem-token" data-token-slot="${slot}" clip-path="url(#mem-well)"></g>`,
      )
      .join("")}</g>
    <g class="mem-request"></g>
    <g class="mem-movers"></g>
  </svg>`;
}

/** place() with a world point [x, y, z]. */
const placeAt = (el: SVGGElement, [x, y, z = 0]: Point) => place(el, x, y, z);

const cloneFrames = (frames: Frame[]) => frames.map((frame) => ({ ...frame }));
const emptyFrames = (): Frame[] =>
  SLOTS().map((slot) => ({ slot, page: null, loadedAt: null, lastUsedAt: null, ref: 0 }));

/** Order in which the policy would replace the resident pages; rank 1 goes first. Clock shows its bits instead. */
function ranks(frames: Frame[], algorithm: Algorithm) {
  if (algorithm === "clock") return new Map<number, number>();
  const key =
    algorithm === "fifo"
      ? (frame: Frame) => frame.loadedAt!
      : algorithm === "opt"
        ? (frame: Frame) => -(frame.nextUseAt ?? Infinity)
        : (frame: Frame) => (frame.lastUsedAt ?? frame.loadedAt)!;
  const order = frames
    .filter((frame) => frame.page)
    .toSorted((a, b) => key(a) - key(b) || a.loadedAt! - b.loadedAt!);
  return new Map(order.map((frame, i) => [frame.slot, i + 1]));
}
const CALLOUT_SUB: Partial<Record<Algorithm, string>> = {
  fifo: "#1 다음 교체 · 적재 순서",
  lru: "#1 다음 교체 · 마지막 접근",
  opt: "#1 다음 교체 · 다음 접근",
};
const POLICY_NAME: Record<Algorithm, string> = {
  fifo: "FIFO",
  lru: "LRU",
  opt: "OPT",
  clock: "클럭",
};

// Prose names a frame "프레임 0"; "F0" stays a compact label on the device.
const F = (slot: number, pair?: string) => (pair ? josa(`프레임 ${slot}`, pair) : `프레임 ${slot}`);

export const replacementReason = (policy: SelectReason, frame: Frame) =>
  policy === "fifo"
    ? `적재 순서가 가장 앞선 ${frame.page} 교체 (적재 ${frame.loadedAt}번째)`
    : policy === "opt"
      ? `다음 접근이 가장 늦은 ${frame.page} 교체 (${frame.nextUseAt ? `다음 접근 ${frame.nextUseAt}번째` : "다시 쓰이지 않음"})`
      : policy === "clock"
        ? `참조 비트 0인 ${frame.page} 교체 (${F(frame.slot)})`
        : `마지막 접근이 가장 이른 ${frame.page} 교체 (마지막 접근 ${frame.lastUsedAt}번째)`;

/** What the scene is doing: drives the stage head, foot and the 해설 while an access plays. */
export interface Phase {
  kind:
    | "ready"
    | "lookup"
    | "hit"
    | "miss"
    | "select"
    | "evict"
    | "load"
    | "retry"
    | "read"
    | "access";
  title: string;
  body: string;
}

export interface UpdateOptions {
  animate?: boolean;
  speed?: number;
  paused?: boolean;
  algorithm?: Algorithm;
}

export interface MemoryScene {
  update(next: Step, previous?: Step | null, options?: UpdateOptions): Promise<void>;
  setHints(on: boolean): void;
  setSpeed(speed: number): void;
  pause(): void;
  resume(): void;
  destroy(): void;
}

interface ActiveRun {
  revision: number;
  speed: number;
  animations: Set<Animation>;
  paused: boolean;
  cancelled: boolean;
}

export function createMemoryScene(
  host: HTMLElement,
  {
    onPhase = () => {},
    frameCount = 3,
    pages = ["A", "B", "C", "D", "E"],
  }: { onPhase?: (phase: Phase) => void; frameCount?: number; pages?: readonly string[] } = {},
): MemoryScene {
  setFrameCount(frameCount);
  setPages(pages);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const narrow = matchMedia("(max-width: 759px)");
  let svg!: SVGSVGElement;
  let slotEls: SVGGElement[] = [];
  let tokenEls: SVGGElement[] = [];
  let request!: SVGGElement;
  let movers!: SVGGElement;
  let handEl!: SVGGElement;
  let stopLabels: (() => void) | undefined;
  const $ = <E extends Element = SVGGElement>(selector: string) => svg.querySelector<E>(selector)!;
  const $$ = <E extends Element = SVGElement>(selector: string) =>
    svg.querySelectorAll<E>(selector);
  // On a phone the callouts grow less, so the devices keep a readable size.
  const labelMax = () => (narrow.matches ? 3 : 2.2);

  /** Fit the viewBox to the devices and callouts at the stage's aspect. */
  function frame() {
    if (!svg) return;
    // On a phone the SVG sets its own height, so it gets a fixed aspect.
    const phone = narrow.matches || !host.clientHeight;
    const stageAspect: number | Element = phone ? 1.9 : host;
    // labelScale() enlarges the callouts when the scene renders below 1 px per
    // unit, so frame once, estimate that factor, and frame again with it.
    let k = 1;
    let vb = "";
    for (let pass = 0; pass < 3; pass++) {
      vb = fitScene(framePoints(), {
        stageAspect,
        fill: 0.96,
        pad: 2,
        labels: NOTES().map((n) => labelBox(n, k)),
      });
      const [, , W, H] = vb.split(" ").map(Number);
      const scale = phone
        ? host.clientWidth / W
        : Math.min(host.clientWidth / W, host.clientHeight / H);
      const next = Math.min(labelMax(), Math.max(1, 1 / (scale || 1)));
      if (Math.abs(next - k) < 0.02) break;
      k = next;
    }
    svg.setAttribute("viewBox", vb);
  }

  function build() {
    stopLabels?.();
    host.innerHTML = staticScene();
    svg = host.querySelector("svg")!;
    slotEls = SLOTS().map((slot) => $(`.mem-slot[data-slot="${slot}"]`));
    tokenEls = SLOTS().map((slot) => $(`[data-token-slot="${slot}"]`));
    handEl = $(".mem-hand");
    request = $(".mem-request");
    movers = $(".mem-movers");
    for (const el of $$<SVGGElement>("[data-original]"))
      placeAt(el, diskPoint(el.dataset.original!));
    tokenEls.forEach((el, slot) => placeAt(el, slotPoint(slot)));
    placeAt(request, cpuPoint());
    PAGES.forEach((page, row) =>
      svg
        .querySelector<SVGGElement>(`.iso-row-led[data-row="${row}"]`)
        ?.style.setProperty("--led", pageColor(page)),
    );
    frame();
    stopLabels = labelScale(svg, { max: labelMax() });
  }
  build();
  const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => frame()) : null;
  observer?.observe(host);
  const onNarrow = () => {
    stopLabels?.();
    frame();
    stopLabels = labelScale(svg, { max: labelMax() });
  };
  narrow.addEventListener("change", onNarrow);

  let step: Step | null = null;
  let algorithm: Algorithm = "fifo";
  let frames = emptyFrames();
  // Clock's hand: the frame it points at (null outside Clock).
  let hand: number | null = null;
  let run: ActiveRun | null = null;
  let revision = 0;
  // Next-victim marks (#1, its LED, the callout) hide while a victim prediction is pending.
  let hints = true;

  /* ---------- Painting the state ---------- */

  function paintFrames() {
    const rank = hints ? ranks(frames, algorithm) : new Map<number, number>();
    const full = frames.every((frame) => frame.page);
    const clock = algorithm === "clock";
    frames.forEach((frame) => {
      const el = tokenEls[frame.slot];
      if (el.dataset.page !== (frame.page ?? "")) {
        el.dataset.page = frame.page ?? "";
        el.innerHTML = frame.page
          ? token({ id: frame.page, color: pageColor(frame.page), size: TOKEN })
          : "";
      }
      el.style.opacity = "";
      const r = rank.get(frame.slot);
      const x = slotX(frame.slot);
      const z = TRAY_H / 2;
      const mark = (on: boolean, text: string) =>
        `${faceLed({ x: x + 0.12, y: FACE_Y + 0.002, z, on })}${frontText({ x: x + 0.42, y: FACE_Y + 0.002, z, text, size: 13, weight: 800, anchor: "start", fill: on ? "var(--accent)" : "var(--mem-face-ink)", cls: "mem-rank-text" })}`;
      // Clock: the reference bit is evidence, not the answer, so it always shows.
      slotEls[frame.slot].querySelector(".mem-rank")!.innerHTML = clock
        ? frame.page
          ? mark(Boolean(frame.ref), `R${frame.ref ? 1 : 0}`)
          : ""
        : r
          ? mark(r === 1 && full, `#${r}`)
          : "";
    });
    paintHand();
    PAGES.forEach((page, row) => {
      const frame = frames.find((f) => f.page === page);
      const entry = $(`[data-entry="${page}"]`);
      svg
        .querySelector(`.iso-row-led[data-row="${row}"]`)
        ?.classList.toggle("is-on", Boolean(frame));
      entry.querySelector(".mem-entry-frame text")!.textContent = frame ? `F${frame.slot}` : "—";
      entry.classList.toggle("is-resident", Boolean(frame));
    });
    $(".mem-ram-callout .iso-callout-sub").textContent = clock
      ? "R 참조 비트 · ▲ 바늘"
      : !hints || !full
        ? `프레임 ${N}개`
        : CALLOUT_SUB[algorithm]!;
    host.setAttribute(
      "aria-label",
      `${step?.index || 0}번째 접근 후. ${frames.map((f) => `${F(f.slot)} ${f.page ? `페이지 ${f.page}${clock ? ` 참조 비트 ${f.ref ? 1 : 0}` : ""}` : "비어 있음"}`).join(", ")}.${clock && hand !== null ? ` 바늘은 ${F(hand)}.` : ""}`,
    );
  }

  function paintHand() {
    const at = algorithm === "clock" ? hand : null;
    handEl.style.display = at === null ? "none" : "";
    if (at !== null) place(handEl.firstElementChild as SVGGElement, slotX(at), HAND_Y, 0);
  }

  function paintRequest(state = "done") {
    const page = step?.index ? step.page : null;
    if (request.dataset.page !== (page ?? "")) {
      request.dataset.page = page ?? "";
      request.innerHTML = page ? token({ id: page, color: pageColor(page), size: TOKEN }) : "";
    }
    request.dataset.state = state;
  }

  /** Light the cable in use, the frame (pocket rim + its chip) and the table row. */
  function emphasis({
    path = null,
    slot = null,
    ring = null,
    entry = null,
    miss = false,
  }: {
    path?: string | null;
    slot?: number | null;
    ring?: "hit" | "select" | null;
    entry?: string | null;
    miss?: boolean;
  } = {}) {
    for (const name of Object.keys(ROUTES))
      $(`#mem-cable-${name}`).classList.toggle("is-active", name === path);
    for (const el of $$<SVGElement>("[data-ring]")) {
      const on = ring && Number(el.dataset.ring) === slot;
      el.classList.toggle("is-hit", Boolean(on && ring === "hit"));
      el.classList.toggle("is-selected", Boolean(on && ring === "select"));
    }
    for (const el of $$<SVGElement>("[data-chip]"))
      el.classList.toggle("is-lit", ring !== null && Number(el.dataset.chip) === slot);
    const row = entry ? PAGES.indexOf(entry) : -1;
    for (const el of $$<SVGElement>(".mem-table .iso-cell")) {
      const mine = Number(el.dataset.row) === row;
      el.classList.toggle("is-on", mine && !miss);
      el.classList.toggle("is-hot", mine && !miss && ring === "hit" && el.dataset.col === "1");
      el.classList.toggle("mem-cell-miss", mine && miss);
    }
    for (const el of $$<SVGElement>("[data-entry]"))
      el.classList.toggle("is-probed", el.dataset.entry === entry);
  }

  function phase(kind: Phase["kind"], title: string, body: string) {
    host.dataset.phase = kind;
    onPhase({ kind, title, body });
  }

  function finalPhase() {
    if (!step?.index) {
      phase(
        "ready",
        `RAM 프레임 ${N}개가 비어 있습니다 · 첫 요청은 A`,
        "페이지 테이블은 각 페이지의 상주 여부와 RAM 프레임 번호를 기록합니다.",
      );
      return;
    }
    let outcome = step.hit ? "적중" : "빈 프레임에 적재";
    if (step.victim) {
      const select = step.events.find((event) => event.type === "select")!;
      const reason = select.type === "select" ? select.reason : "empty";
      outcome = replacementReason(reason, step.before[step.frameIndex]);
    }
    phase(
      "access",
      `${step.index}번째 ${step.page} 접근 완료 · ${outcome}`,
      step.hit
        ? "RAM에 있던 페이지를 그대로 사용했습니다."
        : "저장장치에서 페이지를 읽어 RAM에 적재한 뒤 접근을 완료했습니다.",
    );
  }

  /* ---------- Motion ---------- */

  const alive = (active: ActiveRun) => !active.cancelled && active.revision === revision;
  function track(animation: Animation, active: ActiveRun) {
    animation.playbackRate = active.speed;
    active.animations.add(animation);
    if (active.paused) animation.pause();
    return animation.finished.catch(() => {}).then(() => active.animations.delete(animation));
  }
  const hold = (ms: number, active: ActiveRun) =>
    track(host.animate([{ opacity: 1 }, { opacity: 1 }], { duration: ms }), active);

  function mover(page: string, { size = TOKEN, text = page } = {}) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "mem-mover");
    g.innerHTML = token({ id: page, text, color: pageColor(page), size });
    movers.append(g);
    return g;
  }

  function move(el: SVGGElement, route: Point[], duration: number, active: ActiveRun) {
    const animation = kitTravel(el, route, { duration, easing: "cubic-bezier(.45,.05,.3,1)" });
    return track(animation, active);
  }

  function fade(el: SVGGElement, duration: number, active: ActiveRun) {
    return track(
      el.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration,
        easing: "ease-in",
        fill: "forwards",
      }),
      active,
    );
  }

  // Token routes follow the cables, lifted above them.
  const lookupRoute = (page: string): Point[] => [
    cpuPoint(0.55),
    [CPU.x - 0.2, LOOKUP_Y, 1.4],
    [LOOKUP_X, LOOKUP_Y, 1.4],
    [LOOKUP_X, TABLE.y + TABLE.d - 0.4, 1.4],
    entryPoint(page, 0.6),
    entryPoint(page),
  ];

  async function animateStep(active: ActiveRun, step: Step) {
    const page = step.page;
    const slot = step.frameIndex;

    paintRequest("pending");
    phase(
      "lookup",
      `페이지 테이블에서 ${page} 항목을 조회합니다`,
      "CPU가 가상 주소에 접근하면 주소 변환 장치(MMU)가 그 주소가 속한 페이지의 항목을 읽습니다. 상주 중이면 이 항목에서 RAM 프레임 번호를 얻습니다.",
    );
    emphasis({ path: "lookup", entry: page });
    const probe = mover(page, { size: 0.8 });
    placeAt(probe, cpuPoint(0.55));
    await move(probe, lookupRoute(page), 900, active);
    probe.remove();
    if (!alive(active)) return;

    for (const event of step.events) {
      if (!alive(active)) return;
      if (event.type === "sweep") {
        emphasis({ ring: "select", slot: event.frameIndex });
        phase(
          "select",
          `클럭 · ${event.page}의 참조 비트 1 → 0, 바늘이 넘어갑니다`,
          `${josa(event.page, "은/는")} 참조 비트가 1이라 두 번째 기회를 얻습니다. 바늘이 다음 프레임으로 갑니다.`,
        );
        hand = event.frameIndex;
        paintFrames();
        await hold(450, active);
        if (!alive(active)) return;
        frames[event.frameIndex] = { ...frames[event.frameIndex], ref: 0 };
        hand = (event.frameIndex + 1) % N;
        paintFrames();
        await hold(450, active);
      } else if (event.type === "hit") {
        if (algorithm === "clock") {
          frames[slot] = { ...frames[slot], ref: 1 };
          paintFrames();
        }
        emphasis({ ring: "hit", slot, entry: page });
        phase(
          "hit",
          `적중 · ${josa(page, "이/가")} ${F(slot)}에 있습니다`,
          `페이지 테이블의 ${page} 항목이 ${F(slot, "을/를")} 가리킵니다. 이 프레임의 주소로 바로 변환합니다.`,
        );
        await hold(600, active);
      } else if (event.type === "miss") {
        emphasis({ path: "fault", entry: page, miss: true });
        phase(
          "miss",
          `페이지 부재 · ${josa(page, "이/가")} RAM에 없습니다`,
          `${page} 항목이 미상주(—)입니다. 운영체제가 페이지 부재를 처리하기 위해 프레임을 확보합니다.`,
        );
        await hold(700, active);
      } else if (event.type === "select") {
        emphasis({ ring: "select", slot });
        const reason =
          event.reason === "empty"
            ? "빈 프레임을 사용합니다."
            : event.reason === "fifo"
              ? `${josa(event.victim!, "이/가")} 적재 순서가 가장 앞섭니다.`
              : event.reason === "opt"
                ? `${event.victim}의 다음 접근이 가장 늦습니다.`
                : event.reason === "clock"
                  ? `바늘이 가리킨 ${event.victim}의 참조 비트가 0입니다.`
                  : `${event.victim}의 마지막 접근이 가장 이릅니다.`;
        if (event.reason === "clock") {
          hand = slot;
          paintFrames();
        }
        phase(
          "select",
          event.reason === "empty"
            ? `빈 ${F(slot)} 선택`
            : `${POLICY_NAME[event.reason]} · ${replacementReason(event.reason, frames[slot])}`,
          reason,
        );
        await hold(event.victim ? 1500 : 900, active);
      } else if (event.type === "evict") {
        phase(
          "evict",
          `${F(slot)}의 ${event.page} 사본만 제거합니다`,
          `${event.page}의 페이지 테이블 항목도 미상주로 바꿉니다. 읽기 전용이므로 저장장치에 다시 쓸 필요는 없습니다.`,
        );
        const gone = mover(event.page);
        placeAt(gone, slotPoint(slot));
        tokenEls[slot].innerHTML = "";
        tokenEls[slot].dataset.page = "";
        frames[slot] = { slot, page: null, loadedAt: null, lastUsedAt: null, ref: 0 };
        paintFrames();
        emphasis({ ring: "select", slot });
        await Promise.all([
          move(
            gone,
            [
              slotPoint(slot),
              slotPoint(slot, 2.4),
              [LOAD_X(), RAM_Y + 0.4, 2.6],
              diskPoint(event.page, 1.6),
            ],
            900,
            active,
          ),
          fade(gone, 900, active),
        ]);
        gone.remove();
        if (!alive(active)) return;
        await hold(120, active);
      } else if (event.type === "load") {
        phase(
          "load",
          `저장장치에서 ${josa(page, "을/를")} 읽어 ${F(slot)}에 적재합니다`,
          `저장장치의 원본을 ${F(slot, "으로")} 복사합니다. 적재를 마치면 페이지 테이블에 ${page} → ${josa(`F${slot}`, "을/를")} 기록합니다.`,
        );
        emphasis({ path: "load", ring: "select", slot });
        const copy = mover(page);
        placeAt(copy, diskPoint(page));
        await move(
          copy,
          [
            diskPoint(page),
            diskPoint(page, 1.4),
            [LOAD_X(), DISK.y + DISK.d + 0.3, 1.4],
            [LOAD_X(), RAM_Y + 0.4, 2.6],
            slotPoint(slot, 2.4),
            slotPoint(slot),
          ],
          1300,
          active,
        );
        copy.remove();
        if (!alive(active)) return;
        frames[slot] = { ...step.frames[slot], lastUsedAt: null };
        if (step.hand !== null) hand = step.hand;
        paintFrames();
        emphasis({ ring: "hit", slot });
      } else if (event.type === "access") {
        if (step.fault) {
          phase(
            "retry",
            `CPU가 ${page} 접근을 다시 시도합니다`,
            `같은 가상 주소로 재시도하면 갱신된 페이지 테이블이 ${F(slot, "을/를")} 가리킵니다.`,
          );
          emphasis({ path: "lookup", entry: page, ring: "hit", slot });
          const retry = mover(page, { size: 0.8 });
          placeAt(retry, cpuPoint(0.55));
          await move(retry, lookupRoute(page), 800, active);
          retry.remove();
          if (!alive(active)) return;
        }
        phase(
          "read",
          `${F(slot)}에서 CPU로 값을 전달합니다`,
          `${josa(`페이지 ${page}`, "은/는")} ${F(slot)}에 남습니다. 읽은 값이 CPU에 도착하면 이번 접근을 기록합니다.`,
        );
        emphasis({ path: "read", ring: "hit", slot, entry: page });
        const value = mover(page, { size: 0.8 });
        placeAt(value, slotPoint(slot, 0.6));
        await move(
          value,
          [
            slotPoint(slot, 0.6),
            slotPoint(slot, 1.6),
            [RAM_X - 0.2, READ_Y, 1.2],
            [READ_X, READ_Y, 1.2],
            [READ_X, CPU.y - 0.3, 1.2],
            cpuPoint(0.6),
          ],
          1100,
          active,
        );
        value.remove();
        if (!alive(active)) return;
        frames = cloneFrames(step.frames);
        paintFrames();
        paintRequest("done");
      }
    }
    if (!alive(active)) return;
    run = null;
    emphasis();
    finalPhase();
  }

  function cancel() {
    if (run) {
      run.cancelled = true;
      run.animations.forEach((animation) => animation.cancel());
      run = null;
    }
    movers.replaceChildren();
    emphasis();
  }

  function update(
    next: Step,
    previous: Step | null = null,
    {
      animate = true,
      speed = 1,
      paused = false,
      algorithm: policy = algorithm,
    }: UpdateOptions = {},
  ) {
    revision++;
    cancel();
    step = next;
    algorithm = policy;
    if (next.frames.length !== N) {
      // Lesson 03 switches between 3 and 4 frames: redraw the RAM.
      setFrameCount(next.frames.length);
      build();
    }
    const moving =
      animate &&
      !reduced.matches &&
      previous &&
      next.index === previous.index + 1 &&
      next.events.length;
    frames = cloneFrames(moving ? next.before : next.frames);
    hand = moving ? next.handBefore : next.hand;
    paintFrames();
    paintRequest(moving ? "pending" : "done");
    if (!moving) {
      finalPhase();
      return Promise.resolve();
    }
    const active: ActiveRun = { revision, speed, animations: new Set(), paused, cancelled: false };
    run = active;
    return animateStep(active, next);
  }

  return {
    update,
    setHints(on) {
      if (hints === on) return;
      hints = on;
      paintFrames();
    },
    setSpeed(speed) {
      if (!run) return;
      run.speed = speed;
      run.animations.forEach((animation) => animation.updatePlaybackRate(speed));
    },
    pause() {
      if (!run) return;
      run.paused = true;
      run.animations.forEach((animation) => animation.pause());
    },
    resume() {
      if (!run) return;
      run.paused = false;
      run.animations.forEach((animation) => animation.play());
    },
    destroy() {
      revision++;
      cancel();
      observer?.disconnect();
      narrow.removeEventListener("change", onNarrow);
      stopLabels?.();
      host.replaceChildren();
    },
  };
}
