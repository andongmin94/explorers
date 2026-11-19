// The disk scene: one isometric SVG laid out along the screen horizontal.
// A request queue rail holds the eight requests as tokens in arrival order;
// the selected token is carried over a cable to the controller chip, a ribbon
// bus lights up to the drive, and the actuator arm swings the head to its
// cylinder over the platter. In front of everything a cylinder scale (0–199)
// faces the viewer: request marks on its top, a head carriage that rides it,
// and arcs above it for the seeks walked so far (the current one in accent,
// an edge turn or a C-SCAN return included).
import { REQUESTS, INITIAL_HEAD, MAX_CYLINDER } from "./engine.js";
import {
  UNIT,
  LABEL,
  project,
  callout,
  cable,
  chip,
  defs,
  fitScene,
  floor,
  hdd,
  labelScale,
  place,
  queueRail,
  token,
} from "../../shared/iso-kit.js";

const r2 = (n) => Math.round(n * 100) / 100;
const P = (x, y, z = 0) => project(x, y, z).map(r2).join(",");
const MAXC = MAX_CYLINDER;

/* ---------- Layout (world units) ---------- */
// Wide: queue rail (running to the lower left, head at its upper-right end)
// → controller → drive, left to right. Narrow (phone): the drive sits in front
// of the controller so the scene stays tall enough to read.
const QUEUE = { x: 0, y: 0, slots: 8, pitch: 1.5 };
// "short" is the wide layout for a low stage (e.g. 1280×720): the callouts
// move beside the devices so the scene is framed by its width, not its height.
const LAYOUTS = {
  wide: { drive: { x: 10.4, y: -6.6, w: 9, d: 9 }, chipX: 4.6 },
  short: { drive: { x: 10.4, y: -6.6, w: 9, d: 9 }, chipX: 4.6 },
  narrow: { drive: { x: 4.2, y: 6.2, w: 8.4, d: 8.4 }, chipX: 4.2 },
};
// World point on the floor under a screen point.
const unproject = (px, py) => [(px / UNIT + (2 * py) / UNIT) / 2, ((2 * py) / UNIT - px / UNIT) / 2, 0];
const ARM_L_K = 0.567; // arm length / drive width (5.1 for a 9-unit drive)

let queue, ctrl, CTRL, drive, DRIVE, CX, CY, PZ, R_OUT, R_IN, PIVOT, ARM_Z, ARM_L, ctrlPoint, RULER, notes;

function setLayout(mode) {
  const lay = LAYOUTS[mode];
  const wide = mode !== "narrow";
  queue = queueRail({ ...QUEUE, axis: "y", label: "REQ", numbers: false });
  const yHead = queue.slots[0][1];
  CTRL = { x: lay.chipX, y: r2(yHead - 1.9), size: 3.8 };
  ctrl = chip({ x: CTRL.x, y: CTRL.y, size: CTRL.size, label: "CTRL" });
  ctrlPoint = ctrl.slots[0];
  DRIVE = lay.drive;
  drive = hdd(DRIVE);
  [CX, CY, PZ] = drive.center;
  R_OUT = drive.radius * 0.94;
  R_IN = drive.radius * 0.3;
  // Actuator: pivot near the front-right corner; the arm length is chosen so
  // the head can reach every track from 0 (outer) to 199 (inner).
  PIVOT = [DRIVE.x + DRIVE.w * 0.85, DRIVE.y + DRIVE.d * 0.79];
  ARM_Z = drive.top + 0.32;
  ARM_L = DRIVE.w * ARM_L_K;

  // The scale spans the devices' screen width, below their lowest corner with
  // room for the seek arcs in between.
  const corners = deviceCorners();
  const xs = corners.map((p) => project(...p)[0]);
  const ys = corners.map((p) => project(...p)[1]);
  const bottom = Math.max(...project(DRIVE.x + DRIVE.w, DRIVE.y + DRIVE.d, 0).slice(1), ...ys);
  const x0 = Math.min(...xs) + 6;
  const x1 = Math.max(...xs) - 6;
  RULER = { x0, x1, pad: 30, y: bottom + 36, top: 20, face: 40 };

  const qy = queue.d;
  const [rbx, rby] = unproject(x0 + 14, RULER.y + RULER.face);
  const ruler = { title: "실린더 눈금 · 헤드 위치", sub: "호 = 지금까지의 이동 · 강조 = 이번 이동" };
  // A low stage: short titles placed in the empty floor between the devices,
  // so they add neither width nor height to the frame.
  const [rtx, rty] = unproject(x0 + 5, RULER.y - RULER.top);
  notes = mode === "short"
    ? [
        { x: 0, y: qy * 0.3, z: queue.top, dx: -96, dy: -22, title: "요청 큐", sub: "도착 순서" },
        { x: CTRL.x + 1.2, y: CTRL.y + 1.2, z: ctrl.top, dx: 0, dy: -42, title: "컨트롤러", sub: "" },
        { x: DRIVE.x + DRIVE.w - 1, y: DRIVE.y + 1, z: drive.top, dx: 10, dy: -60, title: "하드 디스크", sub: "0 바깥 · 199 안쪽" },
        { x: rtx, y: rty, z: 0, dx: 0, dy: -46, title: "실린더 눈금", sub: "", anchor: "start" },
      ]
    : wide
    ? [
        { x: 0, y: qy * 0.36, z: queue.top, dx: -96, dy: -62, title: "요청 큐 · OS 스케줄러", sub: "도착 순서 · 다음 요청 선택" },
        { x: CTRL.x + 1.2, y: CTRL.y + 1.2, z: ctrl.top, dx: 0, dy: -60, title: "컨트롤러", sub: "고른 요청 실행" },
        { x: DRIVE.x + 1.4, y: DRIVE.y + 1.4, z: drive.top, dx: 30, dy: -62, title: "하드 디스크", sub: "실린더 0 바깥쪽 · 199 안쪽" },
        { x: rbx, y: rby, z: 0, dx: 0, dy: 32, ...ruler, anchor: "start" },
      ]
    : [
        { x: 0, y: qy * 0.55, z: queue.top, dx: -10, dy: -84, title: "요청 큐", sub: "도착 순서", anchor: "end" },
        { x: CTRL.x + CTRL.size - 0.6, y: CTRL.y + 0.6, z: ctrl.top, dx: 40, dy: -60, title: "컨트롤러", sub: "고른 요청 실행", anchor: "start" },
        { x: DRIVE.x + DRIVE.w, y: DRIVE.y + 1.6, z: drive.top, dx: 26, dy: -40, title: "하드 디스크", sub: "0 바깥 · 199 안쪽", anchor: "start" },
        { x: rbx, y: rby, z: 0, dx: 0, dy: 32, title: ruler.title, sub: "호 = 지금까지의 이동", anchor: "start" },
      ];
}

// Arrival numbers on the rail's right face, reading up the rail toward its
// head (the kit's side text reads the other way, mirrored).
function slotNumbers() {
  const z = queue.top - 0.31;
  return queue.slots
    .map(([, y], i) => {
      const [px, py] = project(QUEUE.x + queue.w + 0.002, y + 0.04, z);
      return `<text class="disk-slot-num" transform="matrix(1 -0.5 0 1 ${r2(px)} ${r2(py)})" dominant-baseline="central">${String(i + 1).padStart(2, "0")}</text>`;
    })
    .join("");
}

function deviceCorners() {
  const q = [QUEUE.x, QUEUE.y, queue.w, queue.d, queue.top];
  const c = [CTRL.x, CTRL.y, CTRL.size, CTRL.size, ctrl.top];
  const d = [DRIVE.x, DRIVE.y, DRIVE.w, DRIVE.d, ARM_Z + 0.2];
  const out = [];
  for (const [x, y, w, dd, top] of [q, c, d])
    for (const [a, b] of [[x, y], [x + w, y], [x + w, y + dd], [x, y + dd]]) out.push([a, b, 0], [a, b, top]);
  return out;
}

const trackR = (c) => R_OUT - (c / MAXC) * (R_OUT - R_IN);

function headPoint(c) {
  const R = trackR(c);
  const dx = CX - PIVOT[0];
  const dy = CY - PIVOT[1];
  const D = Math.hypot(dx, dy);
  const cos = Math.max(-1, Math.min(1, (ARM_L ** 2 + D ** 2 - R ** 2) / (2 * ARM_L * D)));
  const a = Math.atan2(dy, dx) + Math.acos(cos);
  return [PIVOT[0] + ARM_L * Math.cos(a), PIVOT[1] + ARM_L * Math.sin(a)];
}

function ring(R, z, cls) {
  const [px, py] = project(CX, CY, z);
  const a = R * UNIT * Math.SQRT2;
  return `<ellipse class="${cls}" cx="${r2(px)}" cy="${r2(py)}" rx="${r2(a)}" ry="${r2(a / 2)}"/>`;
}

/* ---------- Cylinder scale ----------
   A bar turned to face the viewer (it runs along x − y, the screen
   horizontal): its top is a strip the head carriage rides on, its front face
   carries the engraved ticks and numbers upright. Screen units throughout. */
const sx = (c) => RULER.x0 + RULER.pad + (c / MAXC) * (RULER.x1 - RULER.x0 - 2 * RULER.pad);
const MAJOR = [0, 50, 100, 150, 199];

function rulerSvg() {
  const { x0, x1, y, top, face } = RULER;
  const w = x1 - x0;
  const yt = y - top;
  const yb = y + face;
  let ticks = "";
  for (let c = 10; c < MAXC; c += 10) {
    if (c % 50 === 0) continue;
    ticks += `<line class="disk-tick" x1="${r2(sx(c))}" y1="${y + 1}" x2="${r2(sx(c))}" y2="${y + 6}"/>`;
  }
  for (const c of MAJOR) {
    ticks += `<line class="disk-tick is-major" x1="${r2(sx(c))}" y1="${y + 1}" x2="${r2(sx(c))}" y2="${y + 11}"/>`;
    ticks += `<text class="disk-tick-num" x="${r2(sx(c))}" y="${y + 26}" text-anchor="middle">${c}</text>`;
  }
  const marks = REQUESTS.map(
    (c, i) => `<g class="disk-mark" data-mark="${i + 1}" transform="translate(${r2(sx(c))} ${r2(yt + top / 2)})">
      <ellipse class="disk-mark-halo" rx="8" ry="5.5"/><ellipse class="disk-mark-core" rx="4.6" ry="3.2"/></g>`,
  ).join("");
  return `<g class="disk-ruler">
    <rect class="disk-ruler-shadow" x="${r2(x0 + 6)}" y="${r2(yb - 6)}" width="${r2(w)}" height="16" rx="8"/>
    <rect class="disk-ruler-ao" x="${r2(x0 - 2)}" y="${r2(yb - 3)}" width="${r2(w + 4)}" height="6" rx="3"/>
    <path class="disk-ruler-face" d="M${x0},${y} H${x1} V${yb - 4} Q${x1},${yb} ${x1 - 4},${yb} H${x0 + 4} Q${x0},${yb} ${x0},${yb - 4} Z"/>
    <path class="disk-ruler-top" d="M${x0 + 3},${yt} H${x1 - 3} Q${x1},${yt} ${x1},${yt + 3} V${y} H${x0} V${yt + 3} Q${x0},${yt} ${x0 + 3},${yt} Z"/>
    <rect class="disk-ruler-groove" x="${r2(sx(0) - 6)}" y="${r2(yt + top / 2 - 2)}" width="${r2(sx(MAXC) - sx(0) + 12)}" height="4" rx="2"/>
    <line class="disk-ruler-edge" x1="${x0 + 3}" y1="${yt + 0.6}" x2="${x1 - 3}" y2="${yt + 0.6}"/>
    <line class="disk-ruler-lip" x1="${x0}" y1="${y}" x2="${x1}" y2="${y}"/>
    <g class="disk-ticks">${ticks}</g>
    <g id="disk-marks">${marks}</g>
  </g>`;
}

// A seek arc over the scale from cylinder a to b (screen space).
function arcPath(a, b, lift = 0) {
  const x1 = sx(a);
  const x2 = sx(b);
  const yt = RULER.y - RULER.top + RULER.top / 2 - 2;
  const h = 12 + 40 * Math.sqrt(Math.abs(b - a) / MAXC) + lift;
  return `M${r2(x1)},${r2(yt)} C${r2(x1)},${r2(yt - h * 1.33)} ${r2(x2)},${r2(yt - h * 1.33)} ${r2(x2)},${r2(yt)}`;
}

function carriageSvg(c, lit) {
  const x = sx(c);
  const { y, top, face } = RULER;
  const yt = y - top;
  const label = String(Math.round(c));
  const w = 40;
  return `<g class="disk-carriage${lit ? " is-lit" : ""}" transform="translate(${r2(x)} 0)">
    <line class="disk-needle" x1="0" y1="${yt + top / 2}" x2="0" y2="${y + face - 18}"/>
    <rect class="disk-carriage-shadow" x="${-w / 2 + 2}" y="${yt + 4}" width="${w}" height="${top - 2}" rx="5"/>
    <rect class="disk-carriage-side" x="${-w / 2}" y="${yt - 10}" width="${w}" height="${top + 2}" rx="5"/>
    <rect class="disk-carriage-top" x="${-w / 2}" y="${yt - 16}" width="${w}" height="${top - 2}" rx="5"/>
    <text class="disk-carriage-num" x="0" y="${yt - 5.5}" text-anchor="middle" dominant-baseline="central">${label}</text>
  </g>`;
}

function sceneSvg(mode) {
  const wide = mode !== "narrow";
  const yHead = queue.slots[0][1];
  const qRight = QUEUE.x + queue.w;
  const cabQ = cable([[qRight - 0.05, yHead], [CTRL.x + 0.1, yHead]], { id: "wire-queue", width: 6, pulse: true });
  const cabD = wide
    ? cable([[CTRL.x + CTRL.size - 0.1, yHead], [DRIVE.x + 0.15, yHead]], { id: "wire-drive", width: 5, bus: 2, pulse: true })
    : cable([[CTRL.x + CTRL.size / 2, CTRL.y + CTRL.size - 0.1], [CTRL.x + CTRL.size / 2, DRIVE.y + 0.15]], { id: "wire-drive", width: 5, bus: 2, pulse: true });
  return `<svg role="img" aria-labelledby="disk-scene-title" preserveAspectRatio="xMidYMid meet">
    <title id="disk-scene-title">요청 큐, 컨트롤러, 하드 디스크와 실린더 눈금 위의 헤드 이동</title>
    ${defs()}
    ${floor({ x: -14, y: -22, w: 50, d: 52 })}
    ${cabQ}
    ${cabD}
    ${queue.svg}
    <g class="disk-slot-nums">${slotNumbers()}</g>
    ${ctrl.svg}
    ${drive.svg}
    <g class="disk-platter">
      ${[0, 50, 100, 150, 199].map((c) => ring(trackR(c), PZ + 0.005, "disk-guide")).join("")}
      <g id="disk-target"></g>
      <g id="disk-head-ring"></g>
    </g>
    <g id="disk-arm"></g>
    ${rulerSvg()}
    <g id="disk-arcs"></g>
    <g id="disk-carriage"></g>
    ${notes.map((n) => callout(n)).join("")}
    <g id="disk-tokens">${REQUESTS.map(
      (c, i) => `<g class="disk-token" data-id="${i + 1}">${token({ id: String(i + 1), text: String(c), color: "var(--tok)", size: 1.28, h: 0.5, textSize: 15 })}</g>`,
    ).join("")}</g>
  </svg>`;
}


// Screen boxes for the framing: callout labels, the scale, the arcs above it.
function frameBoxes(k = 1) {
  const boxes = notes.map((n) => {
    const [ax, ay] = project(n.x, n.y, n.z);
    const w = Math.max(n.title.length * 14, n.sub.length * 9.5) * k;
    const lx = ax + n.dx;
    const left = n.anchor === "end" ? lx - w : n.anchor === "start" ? lx : lx - w / 2;
    const below = n.dy > 12;
    return [left, ay + n.dy - (below ? 4 : 16) * k, w, 38 * k];
  });
  boxes.push([RULER.x0, RULER.y - RULER.top - 24, RULER.x1 - RULER.x0, RULER.top + 24 + RULER.face]);
  return boxes;
}

// The head stack assembly, drawn like a real drive's: a bearing cartridge at
// the pivot, a cast arm with a lightening window, a thin stainless load beam
// (suspension) out to the slider that carries the head, a voice-coil fork with
// its copper coil behind the pivot, and the amber flex cable to the chassis.
// Every plate has a darker copy a little lower, so its edge shows thickness.
function armSvg(c, lit) {
  const [hx, hy] = headPoint(c);
  const [px, py] = PIVOT;
  const L = Math.hypot(hx - px, hy - py);
  const ux = (hx - px) / L;
  const uy = (hy - py) / L;
  const nx = -uy;
  const ny = ux;
  // Local arm coordinates: s along the arm from the pivot, t across it.
  const at = (s, t) => [px + ux * s + nx * t, py + uy * s + ny * t];
  const poly = (pts, z) => pts.map(([s, t]) => P(...at(s, t), z)).join(" ");
  const plate = (pts, z, depth, top, edge, cls = "") =>
    `<polygon class="disk-arm-edge ${cls}" points="${poly(pts, z - depth)}" fill="${edge}"/>
     <polygon class="disk-arm-top ${cls}" points="${poly(pts, z)}" fill="${top}"/>`;

  const zA = ARM_Z;
  const reach = L * 0.7; // where the cast arm ends and the load beam starts
  const arm = [[-0.25, 0.56], [reach, 0.19], [reach + 0.12, 0.12], [reach + 0.12, -0.12], [reach, -0.19], [-0.25, -0.56]];
  const window = [[0.95, 0.24], [reach - 0.55, 0.1], [reach - 0.55, -0.1], [0.95, -0.24]];
  const beam = [[reach - 0.1, 0.13], [L - 0.2, 0.07], [L - 0.2, -0.07], [reach - 0.1, -0.13]];
  const rib = [[reach + 0.1, 0], [L - 0.28, 0]];
  const slider = [[L - 0.26, 0.17], [L + 0.12, 0.17], [L + 0.12, -0.17], [L - 0.26, -0.17]];
  const fork = [[-0.3, 0.48], [-0.86, 0.7], [-1.0, 0.54], [-1.0, -0.54], [-0.86, -0.7], [-0.3, -0.48]];
  const coil = [[-0.46, 0.4], [-0.8, 0.55], [-0.88, 0.44], [-0.88, -0.44], [-0.8, -0.55], [-0.46, -0.4]];
  const coilHole = [[-0.58, 0.22], [-0.76, 0.3], [-0.76, -0.3], [-0.58, -0.22]];
  const shadow = [...arm, ...beam.slice(1, 3)].map(([s, t]) => [s + 0.12, t - 0.1]);

  // Flex cable: from the arm's side near the pivot to a connector on the chassis.
  const [fx, fy] = project(...at(-0.15, -0.62), zA - 0.06);
  const conn = [PIVOT[0] - 1.9, DRIVE.y + DRIVE.d - 0.55];
  const [cx2, cy2] = project(conn[0], conn[1], drive.top + 0.08);
  const [mx, my] = [(fx + cx2) / 2 - 10, Math.max(fy, cy2) + 8];
  const flex = `M${r2(fx)},${r2(fy)} Q${r2(mx)},${r2(my)} ${r2(cx2)},${r2(cy2)}`;
  const connBox = [[conn[0] - 0.32, conn[1] - 0.16], [conn[0] + 0.32, conn[1] - 0.16], [conn[0] + 0.32, conn[1] + 0.16], [conn[0] - 0.32, conn[1] + 0.16]]
    .map(([x, y]) => P(x, y, drive.top + 0.02)).join(" ");

  // Bearing cartridge: a base ring on the chassis, the hub through the arm, a cap with a screw.
  const ring = (r, z, h, top, wall, cls) => {
    const [cx, cyTop] = project(px, py, z + h);
    const cyBot = project(px, py, z)[1];
    const rx = r * UNIT * Math.SQRT2;
    const ry = rx / 2;
    return `<path class="${cls}-wall" d="M${r2(cx - rx)},${r2(cyTop)} L${r2(cx - rx)},${r2(cyBot)} A${r2(rx)},${r2(ry)} 0 0 0 ${r2(cx + rx)},${r2(cyBot)} L${r2(cx + rx)},${r2(cyTop)} Z" fill="${wall}"/>
      <ellipse class="${cls}-top" cx="${r2(cx)}" cy="${r2(cyTop)}" rx="${r2(rx)}" ry="${r2(ry)}" fill="${top}"/>`;
  };
  const [sx, sy] = project(px, py, zA + 0.3);

  return `<g class="disk-hsa">
    <polygon class="disk-arm-shadow" points="${poly(shadow, PZ + 0.01)}"/>
    <path class="disk-flex" d="${flex}"/>
    <path class="disk-flex-hi" d="${flex}" transform="translate(-0.6 -1)"/>
    <polygon class="disk-flex-conn" points="${connBox}"/>
    ${ring(0.78, drive.top, 0.16, "var(--disk-metal-top)", "var(--disk-metal-wall)", "disk-pivot-base")}
    ${plate(fork, zA - 0.02, 0.12, "var(--disk-fork-top)", "var(--disk-fork-edge)")}
    <polygon class="disk-coil" points="${poly(coil, zA)}"/>
    <polygon class="disk-coil-hole" points="${poly(coilHole, zA + 0.002)}"/>
    ${plate(arm, zA, 0.22, "var(--disk-arm-top)", "var(--disk-arm-edge)")}
    <polygon class="disk-arm-window" points="${poly(window, zA + 0.002)}"/>
    ${plate(beam, zA - 0.03, 0.05, "var(--disk-beam-top)", "var(--disk-beam-edge)")}
    <polyline class="disk-beam-rib" points="${poly(rib, zA - 0.025)}"/>
    ${plate(slider, zA - 0.06, 0.12, lit ? "var(--head)" : "var(--disk-slider-top)", lit ? "color-mix(in oklch, var(--head) 60%, black)" : "var(--disk-slider-edge)", `disk-head ${lit ? "is-lit" : ""}`)}
    ${ring(0.5, zA - 0.14, 0.4, "var(--disk-metal-top)", "var(--disk-metal-wall)", "disk-pivot-hub")}
    ${ring(0.3, zA + 0.26, 0.05, "var(--disk-cap-top)", "var(--disk-metal-wall)", "disk-pivot-cap")}
    <ellipse class="disk-screw" cx="${r2(sx)}" cy="${r2(sy - 1)}" rx="3.4" ry="1.8"/>
    <line class="disk-screw-slot" x1="${r2(sx - 2.4)}" y1="${r2(sy - 2.2)}" x2="${r2(sx + 2.4)}" y2="${r2(sy + 0.2)}"/>
  </g>`;
}

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const isEdge = (c) => c === 0 || c === MAXC;

export function createDiskScene(host, { onPhase, onHead } = {}) {
  const narrow = matchMedia("(max-width: 759px)");
  const $ = (s) => host.querySelector(s);
  let tokens;
  let shown = null;
  let svg;
  let stopLabels = () => {};
  let points = [];
  let mode = "wide";
  const modeFor = () => (narrow.matches ? "narrow" : host.clientHeight && host.clientWidth / host.clientHeight > 2.7 ? "short" : "wide");

  function frame() {
    if (!svg) return;
    // A phone draws the SVG at its own aspect (width 100%, height auto).
    const wide = mode !== "narrow";
    const opts = { stageAspect: wide ? host : 1.12, fill: wide ? 0.96 : 0.97, pad: 4 };
    // Callout labels grow by 1/scale under labelScale(): frame them at that size.
    let vb = fitScene(points, { ...opts, labels: frameBoxes(1) });
    const width = svg.getBoundingClientRect().width || host.clientWidth;
    const k = width ? Math.min(2.2, Math.max(1, Number(vb.split(" ")[2]) / width)) : 1;
    if (k > 1) vb = fitScene(points, { ...opts, labels: frameBoxes(k) });
    if (svg.getAttribute("viewBox") !== vb) svg.setAttribute("viewBox", vb);
  }
  function build() {
    mode = modeFor();
    setLayout(mode);
    stopLabels();
    host.innerHTML = sceneSvg(mode);
    svg = host.querySelector("svg");
    points = deviceCorners();
    frame();
    stopLabels = labelScale(svg);
    tokens = new Map([...host.querySelectorAll(".disk-token")].map((g) => [Number(g.dataset.id), g]));
  }
  build();
  if (typeof ResizeObserver !== "undefined")
    new ResizeObserver(() => {
      if (modeFor() === mode) return frame();
      cancel();
      build();
      if (shown) snap(...shown);
    }).observe(host);
  // Crossing the phone breakpoint redraws the scene in the other layout.
  narrow.addEventListener("change", () => {
    cancel();
    build();
    if (shown) snap(...shown);
  });
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let active = null;

  function drawHead(c, lit = true) {
    $("#disk-arm").innerHTML = armSvg(c, lit);
    $("#disk-head-ring").innerHTML = ring(trackR(c), PZ + 0.01, "disk-head-track");
    $("#disk-carriage").innerHTML = carriageSvg(c, lit);
    onHead?.(Math.round(c));
  }
  function drawTarget(c) {
    $("#disk-target").innerHTML = c == null ? "" : ring(trackR(c), PZ + 0.01, "disk-target-track");
  }
  // route: [cylinder, k] points; the legs after `from` (k > from) are the
  // current request's seek and draw in the accent, earlier ones stay faint.
  function drawRoute(points, from = Infinity) {
    let s = "";
    let cur = "";
    for (let i = 1; i < points.length; i++) {
      const [a] = points[i - 1];
      const [b, k, mark] = points[i];
      if (a === b) continue;
      // A C-SCAN return runs edge to edge (marked while it is under way).
      const ret = mark === "return" || (isEdge(a) && isEdge(b));
      const now = k > from;
      const d = arcPath(a, b, ret ? 10 : 0);
      const cls = `disk-arc${now ? " is-now" : ""}${ret ? " is-return" : ""}`;
      if (now) cur += `<path class="${cls}" d="${d}"${i === points.length - 1 ? ' marker-end="url(#disk-arc-head)"' : ""}/>`;
      else s += `<path class="${cls}" d="${d}"/>`;
    }
    const dots = points.map(([c]) => `<circle class="disk-arc-dot" cx="${r2(sx(c))}" cy="${r2(RULER.y - RULER.top / 2 - 2)}" r="2.6"/>`).join("");
    $("#disk-arcs").innerHTML = `<defs><marker id="disk-arc-head" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 10 5 0 10 3 5Z" class="disk-arc-head"/></marker></defs>${s}${cur}${dots}`;
  }
  function setWires(stage) {
    $("#wire-queue").classList.toggle("is-active", stage === "controller");
    $("#wire-drive").classList.toggle("is-active", stage === "seek");
  }
  function setTokens(state, selected = null) {
    for (const [id, g] of tokens) {
      const done = state.completed.some((r) => r.id === id);
      g.classList.toggle("is-served", done);
      g.classList.toggle("is-selected", selected === id);
      place(g, ...queue.slots[id - 1]);
      host.querySelector(`.iso-tray-led[data-slot="${id - 1}"]`)?.classList.toggle("is-on", !done);
      $(`[data-mark="${id}"]`).setAttribute("class", `disk-mark${done ? " is-served" : selected === id ? " is-selected" : ""}`);
    }
  }
  function lastFrom(route) {
    const k = route.at(-1)?.[1] ?? 0;
    return k > 0 ? k - 1 : Infinity;
  }
  function snap(step, route) {
    shown = [step, route];
    setTokens(step.state);
    drawHead(step.state.head, step.index > 0);
    drawTarget(null);
    drawRoute(route, lastFrom(route));
    setWires(null);
  }

  function cancel() {
    if (active) active.cancelled = true;
    active = null;
    host.dataset.moving = "false";
  }

  // A clock that honours pause and speed for the arm, which is redrawn per
  // frame rather than transformed. Timer-driven so it keeps time even where
  // animation frames are throttled.
  function tween(run, duration, onFrame) {
    return new Promise((resolve) => {
      let t = 0;
      let last = performance.now();
      const tick = () => {
        if (run.cancelled) return resolve(false);
        const now = performance.now();
        if (!run.paused) t += (now - last) * run.speed;
        last = now;
        const p = Math.min(1, t / duration);
        onFrame?.(p);
        if (p >= 1) return resolve(true);
        setTimeout(tick, 16);
      };
      tick();
    });
  }

  // Carry a token along a world-space polyline with place(), on the same clock.
  function carry(run, el, route, duration) {
    const seg = route.slice(1).map((p, i) => Math.hypot(p[0] - route[i][0], p[1] - route[i][1], p[2] - route[i][2]));
    const total = seg.reduce((x, y) => x + y, 0);
    return tween(run, duration, (p) => {
      let d = ease(p) * total;
      let i = 0;
      while (i < seg.length - 1 && d > seg[i]) d -= seg[i++];
      const f = seg[i] ? Math.min(1, d / seg[i]) : 1;
      const [a, b] = [route[i], route[i + 1]];
      place(el, a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f);
    });
  }

  /**
   * Show a step. route: [cylinder, k] head positions up to this step
   * (engine routePoints). With motion, plays select → controller → seek →
   * arrive; the seek follows step.path (an edge, or a C-SCAN return).
   */
  async function update(step, { motion = false, speed = 1, route = [[INITIAL_HEAD, 0]] } = {}) {
    cancel();
    shown = [step, route];
    if (!motion || !step.index || reduced.matches) {
      snap(step, route);
      onPhase?.(step.index ? "done" : "idle", step);
      return;
    }
    const run = { cancelled: false, paused: false, speed };
    active = run;
    host.dataset.moving = "true";
    const request = step.request;
    const id = request.id;
    const el = tokens.get(id);
    el.parentNode.append(el); // the carried token draws above the others
    const k = step.index;
    const before = route.filter((p) => p[1] <= k - 1);

    setTokens(step.before, id);
    drawHead(step.before.head, k > 1);
    drawRoute(before, Infinity);
    drawTarget(null);
    setWires(null);
    onPhase?.("select", step);
    await tween(run, step.candidates[1] ? 1000 : 700);
    if (run.cancelled) return;

    setWires("controller");
    onPhase?.("controller", step);
    const from = queue.slots[id - 1];
    const lift = 1.5;
    await carry(run, el, [from, [from[0], from[1], from[2] + lift], [ctrlPoint[0], ctrlPoint[1], ctrlPoint[2] + lift], ctrlPoint], 900);
    if (run.cancelled) return;

    setWires("seek");
    drawTarget(request.cylinder);
    onPhase?.("seek", step);
    // Walk the path by length (the C-SCAN return included, counted or not).
    const path = step.path ?? [step.before.head, request.cylinder];
    const legs = path.slice(1).map((c, i) => Math.abs(c - path[i]));
    const length = legs.reduce((x, y) => x + y, 0) || 1;
    await tween(run, 900 + length * 5, (p) => {
      let d = ease(p) * length;
      const passed = [];
      let i = 0;
      while (i < legs.length - 1 && d > legs[i]) {
        d -= legs[i++];
        passed.push(path[i]);
      }
      const f = legs[i] ? Math.min(1, d / legs[i]) : 1;
      const c = path[i] + (path[i + 1] - path[i]) * f;
      const k0 = k - 1;
      const at = (cyl, run2) => [cyl, k0 + run2 / length];
      let acc = 0;
      const pts = passed.map((cyl, j) => at(cyl, (acc += legs[j])));
      drawHead(c, true);
      const tip = at(c, acc + f * legs[i]);
      if (path[i] !== path[i + 1] && isEdge(path[i]) && isEdge(path[i + 1])) tip.push("return");
      drawRoute([...before, ...pts, tip], k0);
    });
    if (run.cancelled) return;

    drawTarget(null);
    setWires(null);
    drawRoute(route, k - 1);
    onPhase?.("arrive", step);
    await carry(run, el, [ctrlPoint, [ctrlPoint[0], ctrlPoint[1], ctrlPoint[2] + lift], [from[0], from[1], from[2] + lift], from], 700);
    if (run.cancelled) return;
    setTokens(step.state);
    host.dataset.moving = "false";
    active = null;
  }

  return {
    update,
    setSpeed(speed) {
      if (active) active.speed = speed;
    },
    pause() {
      if (active) active.paused = true;
    },
    resume() {
      if (active) active.paused = false;
    },
  };
}
