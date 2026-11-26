// Scene parts shared by every transaction lesson: one floor, a database server
// at the back with a row table (committed value, uncommitted write, lock
// owner) and a WAIT tray (blocked SQL) on its top, two client laptops (T1
// lower left, T2 lower right) and the cables that carry SQL between them.
// Everything is drawn with the iso kit; this file fixes the layout, frames it
// to the stage (fitScene + labelScale) and adds the moving SQL tokens and a
// pausable motion runner that honours the explorer's speed and pause controls.
import {
  MAT,
  box,
  cable,
  callout,
  defs,
  fitScene,
  floor,
  frontText,
  labelScale,
  laptop,
  place,
  project,
  server,
  shadow,
  tableModule,
  topText,
  travel,
  tray,
  type Point,
} from "@/lib/iso/kit.ts";
import type { ClientId } from "./types.ts";

export const COLORS: Record<ClientId, string> = { T1: "var(--t1)", T2: "var(--t2)" };
export const DB = { x: 0, y: 0, w: 8.4, d: 7, units: 3 };
export const DB_TOP = DB.units * 0.75 - 0.05;
// The row table and the WAIT tray stand on the server top.
const TABLE = { x: DB.x + 0.3, y: DB.y + 0.3, w: 7.8, d: 4.5, h: 0.3 };
export const TABLE_TOP = DB_TOP + TABLE.h;
const LIFT = TABLE_TOP + 0.15;
const WAIT = tray({
  x: DB.x + 0.22,
  y: DB.y + 4.98,
  z: DB_TOP,
  slots: 2,
  pitch: 2.95,
  d: 1.76,
  h: 0.5,
  label: "WAIT",
  numbers: false,
  mat: MAT.metal,
  cls: "tx-wait-tray",
});
// The laptops stand well forward of the database (FORWARD moves both along
// x + y, i.e. down the screen), so the three devices fill a wide stage in
// height too and the cables are long enough to watch a request travel.
const FORWARD = 5.5;
export const LAPTOPS: Record<ClientId, { x: number; y: number; w: number; d: number }> = {
  T1: { x: -1.2 + FORWARD, y: 11 + FORWARD, w: 4.6, d: 3 },
  T2: { x: 11 + FORWARD, y: -1.2 + FORWARD, w: 4.6, d: 3 },
};
// Request routes run laptop → database face (the cables): each laptop
// stands square in front of one database face, so its cable leaves the
// laptop's back (0.4 short of that hidden face, the plug tucked under) and
// runs straight along one world axis to the face. The two cables never
// cross and stay clear of the callouts. Responses run them backwards.
const T1_X = LAPTOPS.T1.x + LAPTOPS.T1.w / 2;
const T2_Y = LAPTOPS.T2.y + LAPTOPS.T2.d / 2;
export const ROUTES: Record<ClientId, Point[]> = {
  T1: [
    [T1_X, LAPTOPS.T1.y - 0.4],
    [T1_X, DB.y + DB.d],
  ],
  T2: [
    [LAPTOPS.T2.x - 0.4, T2_Y],
    [DB.x + DB.w, T2_Y],
  ],
};
// A blocked request waits in its own pocket of the WAIT tray (T1 left, T2 right).
export const PARK: Record<ClientId, Point> = { T1: WAIT.slots[0], T2: WAIT.slots[1] };
const SLOT_OF: Record<ClientId, number> = { T1: 0, T2: 1 };
const SCREEN_LINES = [2.0, 0.98];

/** A rectangular SQL token with its label printed on top. Drawn at the origin. */
export function sqlToken({
  text,
  color,
  w = 2.3,
  d = 1.1,
  h = 0.5,
  size = 13,
}: {
  text: string | number;
  color: string;
  w?: number;
  d?: number;
  h?: number;
  size?: number;
}) {
  const fill = {
    top: `color-mix(in oklch, ${color} 82%, white)`,
    front: `color-mix(in oklch, ${color} 94%, black)`,
    side: `color-mix(in oklch, ${color} 70%, black)`,
    rim: `color-mix(in oklch, ${color} 70%, white)`,
    edge: "rgb(255 255 255 / .7)",
    overlay: "url(#hw-iso-gloss)",
  };
  return `<g class="tx-token">
    ${shadow({ x: -w / 2, y: -d / 2, w, d, spread: 0.18, strength: 0.9 })}
    ${box({ x: -w / 2, y: -d / 2, z: 0, w, d, h, fill, radius: 0.16, stroke: `color-mix(in oklch, ${color} 55%, black)`, strokeWidth: 0.7 })}
    ${topText({ x: 0, y: 0, z: h, text, size, fill: "#fff", weight: 800, halo: `color-mix(in oklch, ${color} 55%, black)` })}
  </g>`;
}

/** Laptop with two screen lines, each a label and a value. */
function client(id: ClientId, labels: string[]) {
  const l = LAPTOPS[id];
  const y = l.y - 0.06;
  const rows = labels
    .map(
      (label, i) =>
        frontText({
          x: l.x + 0.42,
          y,
          z: SCREEN_LINES[i],
          text: label,
          size: 15,
          anchor: "start",
          weight: 600,
          fill: "var(--tx-screen-dim)",
          cls: "tx-screen-label",
        }) +
        `<g data-screen="${id}-${i}">${frontText({ x: l.x + l.w - 0.42, y, z: SCREEN_LINES[i], text: "—", size: 20, anchor: "end", fill: "var(--tx-screen-ink)", weight: 700, cls: "tx-screen-value" })}</g>`,
    )
    .join("");
  return `<g class="tx-client" data-client="${id}" style="--tx:${COLORS[id]}">${laptop({ ...l }).svg}<g class="tx-screen">${rows}</g></g>`;
}

/** Where a row prints in the row table: its LCD value, its pending token and its lock owner. */
export interface RowSpot {
  lcd: Point;
  pending: Point;
  lock: Point;
  col: number;
}

/**
 * The row table on the server top: one column per database row (headed
 * "ID 1" or "ROW A"), three field rows printed on the glass: the committed
 * value (LCD digits), NEW (the uncommitted write, a token in the writer's
 * colour) and LOCK (the owner, the cell lit in the owner's colour). The LOCK
 * row LED lights while any row is locked. Returns the svg and, per row id,
 * where its value, pending token and lock print.
 */
export function rowTable(
  rows: { id: string; name: string }[],
  { valueHeader = "STOCK", valueSize }: { valueHeader?: string; valueSize?: number } = {},
) {
  const single = rows.length === 1;
  const t = tableModule({
    ...TABLE,
    z: DB_TOP,
    rows: 3,
    cols: rows.length,
    headers: rows.map(() => ""),
    mat: MAT.plastic,
    cls: "tx-rows",
  });
  const cw = (TABLE.w - 1) / rows.length;
  const z = TABLE_TOP;
  const at: Record<string, Omit<RowSpot, "col">> = {};
  let body = "";
  rows.forEach((r, c) => {
    const [vx, vy] = t.cells[0][c];
    const [, ny] = t.cells[1][c];
    const [, ly] = t.cells[2][c];
    const left = vx - cw / 2 + 0.22;
    const right = vx + cw / 2 - 0.22;
    at[r.id] = {
      lcd: [right - 0.6, vy, z],
      pending: [single ? vx + 0.4 : vx + 0.45, ny, z],
      lock: [right, ly, z],
    };
    body += topText({
      x: vx,
      y: TABLE.y + 0.36,
      z,
      text: single ? `ID ${r.name}` : `ROW ${r.name}`,
      size: 12,
      weight: 800,
      fill: MAT.plastic.ink,
      engrave: MAT.plastic.engrave,
    });
    // Field names print once, in the first column; the other columns line up with them.
    if (c === 0)
      body += (
        [
          [valueHeader, vy],
          ["NEW", ny],
          ["LOCK", ly],
        ] as [string, number][]
      )
        .map(([text, y]) =>
          topText({
            x: left,
            y,
            z,
            text,
            size: 12,
            anchor: "start",
            weight: 600,
            fill: "var(--tx-screen-dim)",
            cls: "tx-field",
          }),
        )
        .join("");
    body += `<g data-lcd="${r.id}">${topText({ x: right, y: vy, z, text: "", size: valueSize ?? (single ? 26 : 22), anchor: "end", weight: 700, fill: "var(--tx-screen-ink)", cls: "tx-lcd-text" })}</g>`;
    body += `<g data-lock-owner="${r.id}">${topText({ x: right, y: ly, z, text: "FREE", size: 13, anchor: "end", weight: 800, fill: "var(--tx-screen-dim)" })}</g>`;
  });
  const cols = Object.fromEntries(rows.map((r, c) => [r.id, c]));
  return {
    svg: `${t.svg}${body}`,
    at: Object.fromEntries(
      Object.entries(at).map(([id, v]) => [id, { ...v, col: cols[id] }]),
    ) as Record<string, RowSpot>,
  };
}

/** Light a row's lock: its LOCK cell in the owner's colour with the owner printed; the LOCK row LED while any row is locked. */
export function setLock(
  svg: SVGSVGElement,
  at: Record<string, RowSpot>,
  rowId: string,
  owner: ClientId | null,
) {
  const cell = svg.querySelector<SVGElement>(
    `.tx-rows .iso-cell[data-row="2"][data-col="${at[rowId].col}"]`,
  )!;
  if (owner) cell.dataset.owner = owner;
  else delete cell.dataset.owner;
  const text = svg.querySelector(`[data-lock-owner="${rowId}"] text`)!;
  text.textContent = owner ?? "FREE";
  text.setAttribute("fill", owner ? "#fff" : "var(--tx-screen-dim)");
  text.setAttribute("font-size", String(owner ? 16 : 13));
  const owners = [
    ...new Set(
      [...svg.querySelectorAll<SVGElement>('.tx-rows .iso-cell[data-row="2"][data-owner]')].map(
        (c) => c.dataset.owner as ClientId,
      ),
    ),
  ];
  const led = svg.querySelector<SVGElement>('.tx-rows .iso-row-led[data-row="2"]')!;
  setLamp(led, owners.length === 1 ? owners[0] : null);
  if (owners.length > 1) led.classList.add("is-on");
}

/** Light the WAIT tray pockets of the clients that are waiting. */
export function setWaiting(svg: SVGSVGElement, ids: ClientId[]) {
  for (const [id, slot] of Object.entries(SLOT_OF) as [ClientId, number][])
    setLamp(
      svg.querySelector<SVGElement>(`.tx-wait-tray .iso-tray-led[data-slot="${slot}"]`)!,
      ids.includes(id) ? id : null,
    );
}

// What the frame must hold: device footprints with their tops, and the label
// boxes of the callouts (user units).
const foot = (
  { x, y, w, d }: { x: number; y: number; w: number; d: number },
  z0: number,
  z1: number,
  back = 0,
): Point[] => [
  [x, y - back, z0],
  [x + w, y - back, z0],
  [x + w, y + d, z0],
  [x, y + d, z0],
  [x, y - back, z1],
  [x + w, y - back, z1],
  [x + w, y + d, z1],
  [x, y + d, z1],
];
const FRAME = [
  ...foot(DB, 0, TABLE_TOP + 0.1),
  ...foot(LAPTOPS.T1, 0, 2.95, 0.22),
  ...foot(LAPTOPS.T2, 0, 2.95, 0.22),
];

interface CalloutSpot {
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
}
// Callouts: where they point and where their labels go.
const CALLOUTS: Record<"db" | ClientId, CalloutSpot> = {
  db: { x: DB.x + DB.w * 0.62, y: DB.y, z: TABLE_TOP, dx: 0, dy: -58 },
  T1: { x: LAPTOPS.T1.x + 1.1, y: LAPTOPS.T1.y - 0.2, z: 2.75, dx: -24, dy: -40 },
  T2: { x: LAPTOPS.T2.x + LAPTOPS.T2.w - 1.1, y: LAPTOPS.T2.y - 0.2, z: 2.75, dx: 24, dy: -40 },
};
/** Approximate label box of a callout, in user units. */
function labelBox({ x, y, z, dx, dy }: CalloutSpot, title: string, sub: string) {
  const [sx, sy] = project(x, y, z);
  const width = (s: string, latin: number, wide: number) =>
    [...s].reduce((n, ch) => n + (/[ㄱ-힝]/.test(ch) ? wide : latin), 0);
  const w = Math.max(width(title, 9.5, 15.5), width(sub, 8.2, 13));
  return [sx + dx - w / 2, sy + dy - 15, w, sub ? 36 : 20];
}

export interface SceneSource {
  svg: string;
  at: Record<string, RowSpot>;
  frame: { points: Point[]; labels: number[][] };
}

/**
 * The static scene: floor, cables, devices, callouts and empty groups the
 * lesson scene fills (pending, parked, movers). rows: [{ id, name }] for the
 * row table; floorMarks / framePoints: extra floor drawing (deadlock's
 * wait-for edges) and the world points it needs framed.
 */
export function sceneSvg({
  label,
  rows,
  valueHeader,
  valueSize,
  floorMarks = "",
  framePoints = [],
  screens,
  dbSub,
  dbTitle = "재고 DB",
  names = { T1: "T1 · 주문 1", T2: "T2 · 주문 2" },
}: {
  label: string;
  rows: { id: string; name: string }[];
  valueHeader?: string;
  valueSize?: number;
  floorMarks?: string;
  framePoints?: Point[];
  screens: string[];
  dbSub?: string;
  dbTitle?: string;
  names?: Record<ClientId, string>;
}): SceneSource {
  const table = rowTable(rows, { valueHeader, valueSize });
  const lanes = (Object.entries(ROUTES) as [ClientId, Point[]][])
    .map(
      ([id, route]) =>
        `<g class="tx-lane" data-lane="${id}">${cable(route, { width: 7, pulse: true })}</g>`,
    )
    .join("");
  const c = CALLOUTS;
  const svg = `<svg role="img" aria-label="${label}" preserveAspectRatio="xMidYMid meet">
    ${defs()}
    ${floor({ x: -16, y: -16, w: 48, d: 48 })}
    ${floorMarks}
    <g class="tx-lanes">${lanes}</g>
    <g class="tx-db">${server({ ...DB, label: "" }).svg}${table.svg}${WAIT.svg}<g class="tx-pending"></g></g>
    <g class="tx-parked"></g>
    ${client("T2", screens)}
    ${client("T1", screens)}
    ${callout({ ...c.db, title: dbTitle, sub: dbSub })}
    ${callout({ ...c.T1, title: names.T1, sub: "IDLE", cls: "tx-callout-t1" })}
    ${callout({ ...c.T2, title: names.T2, sub: "IDLE", cls: "tx-callout-t2" })}
    <g class="tx-movers"><g class="tx-mover" data-mover="T1"></g><g class="tx-mover" data-mover="T2"></g></g>
    <g class="tx-hold" aria-hidden="true"></g>
  </svg>`;
  const labels = [
    labelBox(c.db, dbTitle, dbSub ?? ""),
    labelBox(c.T1, names.T1, "COMMITTED"),
    labelBox(c.T2, names.T2, "COMMITTED"),
  ];
  return { svg, at: table.at, frame: { points: [...FRAME, ...framePoints], labels } };
}

/**
 * Put the scene into its host and keep it framed: the viewBox follows the
 * stage's aspect (fitScene) and callout labels stay legible (labelScale).
 * On mobile the stage takes its height from the scene, so a fixed aspect.
 * destroy() stops watching and empties the host.
 */
export function mountScene(host: HTMLElement, { svg, frame }: SceneSource) {
  host.innerHTML = svg;
  const el = host.querySelector("svg")!;
  // Only the desktop console gives the stage a height of its own; stacked
  // (and on phones) the scene's height follows its viewBox, so framing to the
  // host's aspect would feed back into itself and shrink the scene.
  const mobile = matchMedia("(max-width: 759px)");
  const desk = matchMedia("(min-width: 1100px) and (min-height: 700px)");
  const fit = () => {
    const stageAspect = mobile.matches ? 1.35 : !desk.matches || !host.clientHeight ? 1.6 : host;
    el.setAttribute(
      "viewBox",
      fitScene(frame.points, { stageAspect, fill: 0.9, labels: frame.labels }),
    );
  };
  fit();
  const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
  observer?.observe(host);
  mobile.addEventListener?.("change", fit);
  desk.addEventListener?.("change", fit);
  const stopLabels = labelScale(el);
  return {
    svg: el,
    destroy() {
      observer?.disconnect();
      mobile.removeEventListener?.("change", fit);
      desk.removeEventListener?.("change", fit);
      stopLabels();
      host.innerHTML = "";
    },
  };
}

/** Set a laptop's screen values. */
export function setScreen(root: Element, id: ClientId, values: (string | number)[]) {
  values.forEach((value, i) => {
    const el = root.querySelector(`[data-screen="${id}-${i}"] text`);
    if (el && el.textContent !== String(value)) el.textContent = String(value);
  });
}

const dist = (a: Point, b: Point) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], (a[2] ?? 0) - (b[2] ?? 0));
/** Resample a polyline into evenly spaced points so travel() keeps one speed. */
function resample(route: Point[], step = 0.5) {
  const out = [route[0]];
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1];
    const b = route[i];
    const n = Math.max(1, Math.round(dist(a, b) / step));
    for (let k = 1; k <= n; k++)
      out.push([0, 1, 2].map((j) => (a[j] ?? 0) + ((b[j] ?? 0) - (a[j] ?? 0)) * (k / n)));
  }
  return out;
}
const length = (route: Point[]) => route.slice(1).reduce((sum, p, i) => sum + dist(route[i], p), 0);

interface Run {
  animations: Set<Animation>;
  cancelled: boolean;
  paused: boolean;
  speed: number;
}

export type Runner = ReturnType<typeof createRunner>;

/**
 * Pausable motion. Every animation of the current event goes through one run,
 * so pause, speed and cancellation reach all of them.
 */
export function createRunner(svg: SVGSVGElement) {
  const holder = svg.querySelector<SVGGElement>(".tx-hold")!;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let run: Run | null = null;
  const track = async (animation: Animation) => {
    const current = run;
    if (!current || current.cancelled) {
      animation.cancel();
      return false;
    }
    animation.playbackRate = current.speed;
    if (current.paused) animation.pause();
    current.animations.add(animation);
    await animation.finished.catch(() => {});
    current.animations.delete(animation);
    return !current.cancelled;
  };
  const api = {
    get reduced() {
      return reduced.matches;
    },
    start(speed: number) {
      api.cancel();
      run = { animations: new Set(), cancelled: false, paused: false, speed };
      return run;
    },
    cancel() {
      if (!run) return;
      run.cancelled = true;
      for (const a of run.animations) a.cancel();
      run = null;
    },
    end() {
      run = null;
    },
    get alive() {
      return Boolean(run && !run.cancelled);
    },
    pause() {
      if (!run) return;
      run.paused = true;
      run.animations.forEach((a) => a.pause());
    },
    resume() {
      if (!run) return;
      run.paused = false;
      run.animations.forEach((a) => a.play());
    },
    setSpeed(speed: number) {
      if (!run) return;
      run.speed = speed;
      run.animations.forEach((a) => a.updatePlaybackRate(speed));
    },
    /** Move a token along world points; duration grows with distance. */
    glide(
      el: SVGGElement,
      route: Point[],
      { per = 150, base = 260 }: { per?: number; base?: number } = {},
    ) {
      const points = resample(route.map(([x, y, z = 0]) => [x, y, z]));
      return track(
        travel(el, points, {
          duration: base + length(points) * per,
          easing: "cubic-bezier(.35,.05,.35,1)",
        }),
      );
    },
    hold(ms: number) {
      return track(holder.animate([{ opacity: 0 }, { opacity: 0 }], { duration: ms }));
    },
    animate(el: Element, frames: Keyframe[], options: KeyframeAnimationOptions) {
      return track(el.animate(frames, options));
    },
  };
  return api;
}

/** Show a token in a mover group at a world point. */
export function showToken(
  el: SVGGElement,
  { text, color, at, w }: { text: string | number; color: string; at: Point; w?: number },
) {
  el.innerHTML = sqlToken({
    text,
    color,
    w: w ?? Math.max(1.3, 0.55 + String(text).length * 0.36),
  });
  el.style.opacity = "1";
  place(el, at[0], at[1], at[2]);
}
export function hideToken(el: SVGGElement) {
  el.style.opacity = "0";
  el.innerHTML = "";
}

/** Place a group at a world point. */
export const placeAt = (el: Element & ElementCSSInlineStyle, at: Point) =>
  place(el, at[0], at[1], at[2]);

/** Light an iso LED in a client's colour (off when owner is null). */
export function setLamp(el: SVGElement, owner: ClientId | null) {
  el.classList.toggle("is-on", Boolean(owner));
  el.style.setProperty("--led", owner ? COLORS[owner] : "var(--accent)");
}

/** The callout under each laptop doubles as its status line. */
export function setStatus(svg: SVGSVGElement, id: ClientId, text: string) {
  const sub = svg.querySelector(`.tx-callout-${id.toLowerCase()} .iso-callout-sub`)!;
  if (sub.textContent !== text) sub.textContent = text;
}

export type Moves = ReturnType<typeof createMoves>;

/** Token moves both scenes share: request out, response back, DB activity. */
export function createMoves(svg: SVGSVGElement, runner: Runner) {
  const movers = Object.fromEntries(
    (Object.keys(ROUTES) as ClientId[]).map((id) => [
      id,
      svg.querySelector<SVGGElement>(`[data-mover="${id}"]`)!,
    ]),
  ) as Record<ClientId, SVGGElement>;
  // The client's cable lights (accent + pulse) while its request or response is on it.
  const lane = (id: ClientId, on: boolean) =>
    svg.querySelector(`[data-lane="${id}"] .iso-cable`)!.classList.toggle("is-active", on);
  const moves = {
    movers,
    edge: (id: ClientId) => ROUTES[id].at(-1)!,
    reset() {
      for (const id of Object.keys(movers) as ClientId[]) {
        hideToken(movers[id]);
        lane(id, false);
      }
    },
    async send(id: ClientId, label: string, route: Point[], { wire = true } = {}) {
      showToken(movers[id], { text: label, color: COLORS[id], at: route[0] });
      if (wire) lane(id, true);
      const ok = await runner.glide(movers[id], route);
      lane(id, false);
      return ok;
    },
    /** A token back to the laptop, from the database face or from its WAIT pocket. */
    async respond(id: ClientId, label: string, from: Point | null = null) {
      const back = [...ROUTES[id]].reverse();
      const [ex, ey] = back[0];
      const route: Point[] = from
        ? [from, [from[0], from[1], LIFT], [ex, ey, LIFT], [ex, ey, 0], ...back.slice(1)]
        : back;
      showToken(movers[id], { text: label, color: COLORS[id], at: route[0] });
      if (from) {
        // Out of the pocket and down the database face, then onto the cable.
        if (!(await runner.glide(movers[id], route.slice(0, 4), { per: 120 }))) return false;
        route.splice(0, 3);
      }
      const ok = await moves.send(id, label, route);
      hideToken(movers[id]);
      return ok;
    },
    /** Lift a token from the database face onto a spot on the top (a cell or a WAIT pocket). */
    async rise(id: ClientId, slotAt: Point) {
      const [ex, ey] = moves.edge(id);
      const ok = await runner.glide(
        movers[id],
        [[ex, ey, 0], [ex, ey, LIFT], [slotAt[0], slotAt[1], LIFT], slotAt],
        { per: 120 },
      );
      hideToken(movers[id]);
      return ok;
    },
    /** A waiting request leaves its WAIT pocket and runs on (to a cell on the top, or the database face). */
    async unpark(id: ClientId, label: string, to: Point | null = null) {
      const p = PARK[id];
      const [ex, ey] = moves.edge(id);
      const route: Point[] = to
        ? [p, [p[0], p[1], LIFT], [to[0], to[1], LIFT], to]
        : [p, [p[0], p[1], LIFT], [ex, ey, LIFT], [ex, ey, 0]];
      const ok = await moves.send(id, label, route, { wire: false });
      hideToken(movers[id]);
      return ok;
    },
    async flashDatabase(times = 1) {
      const leds = svg.querySelectorAll(".iso-unit-led");
      for (let i = 0; i < times; i++) {
        leds.forEach((l) => l.classList.add("is-on"));
        if (!(await runner.hold(300))) return false;
        leds.forEach((l) => l.classList.remove("is-on"));
        if (times > 1 && !(await runner.hold(160))) return false;
      }
      return runner.alive;
    },
    /** Slide a pending token into its LCD and fade it out (commit). */
    merge(el: Element, from: Point, to: Point) {
      const [ax, ay] = project(from[0], from[1], from[2]);
      const [bx, by] = project(to[0], to[1], to[2]);
      return runner.animate(
        el,
        [
          { transform: `translate(${ax}px, ${ay}px)`, opacity: 1 },
          { transform: `translate(${bx}px, ${by}px)`, opacity: 0 },
        ],
        { duration: 620, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" },
      );
    },
  };
  return moves;
}

/** What a lesson scene gives the player. */
export interface TxScene {
  update(
    step: { index: number },
    previous: unknown,
    options?: { animate?: boolean; speed?: number },
  ): Promise<void>;
  pause(): void;
  resume(): void;
  setSpeed(speed: number): void;
  destroy(): void;
}

/** What a scene reports while an event plays: the status line, the 해설 body and the state on screen. */
export type PhaseReport<S> = { title: string; body: string; snapshot: S | null };
