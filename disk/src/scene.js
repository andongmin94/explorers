// The disk scene: one isometric SVG. A request queue module holds the eight
// requests as tokens in arrival order; the selected token is carried to the
// controller chip, the actuator arm swings the head to its cylinder over the
// platter, and a cylinder ruler printed on the floor draws the path walked so
// far (the classic disk-scheduling zigzag).
import { REQUESTS, INITIAL_HEAD } from "./engine.js";
import {
  UNIT,
  project,
  callout,
  chip,
  defs,
  floor,
  floorPath,
  hdd,
  module,
  place,
  token,
  topText,
} from "../../shared/iso-kit.js";

const r2 = (n) => Math.round(n * 100) / 100;
const P = (x, y, z = 0) => project(x, y, z).map(r2).join(",");

/* ---------- Layout (world units) ---------- */
const QUEUE = { x: 0, y: 0, w: 12, d: 2.4, h: 0.6 };
const slotPoint = (i) => [0.95 + i * 1.44, QUEUE.y + QUEUE.d / 2, QUEUE.h];
const CTRL = { x: 14.8, y: 0.2, size: 3.2 };
// The drive is the one device whose place depends on the layout. A wide
// desktop stage puts it right of the controller, a little toward the viewer,
// so the cluster fills a typical stage instead of one very wide row; a phone keeps it in front so the scene stays tall.
const DRIVE_NARROW = { x: 14, y: 5, w: 11, d: 11 };
const DRIVE_WIDE = { x: 20, y: -7, w: 11, d: 11 };

const queue = module({ ...QUEUE, label: "", well: true });
const ctrl = chip({ x: CTRL.x, y: CTRL.y, size: CTRL.size, label: "CTRL" });
const ctrlPoint = [CTRL.x + CTRL.size / 2, CTRL.y + CTRL.size / 2, ctrl.top];
const ARM_L = 5.1;
let DRIVE, drive, CX, CY, PZ, R_OUT, R_IN, PIVOT, ARM_Z;
function setLayout(wide) {
  DRIVE = wide ? DRIVE_WIDE : DRIVE_NARROW;
  drive = hdd(DRIVE);
  [CX, CY, PZ] = drive.center;
  R_OUT = drive.radius * 0.94;
  R_IN = drive.radius * 0.3;
  // Actuator: pivot near the front-right corner; the arm length is chosen so
  // the head can reach every track from 0 (outer) to 199 (inner).
  PIVOT = [DRIVE.x + DRIVE.w * 0.9, DRIVE.y + DRIVE.d * 0.84];
  ARM_Z = drive.top + 0.32;
}
setLayout(true);
const trackR = (c) => R_OUT - (c / 199) * (R_OUT - R_IN);

function headPoint(c) {
  const R = trackR(c);
  const dx = CX - PIVOT[0];
  const dy = CY - PIVOT[1];
  const D = Math.hypot(dx, dy);
  const cos = Math.max(-1, Math.min(1, (ARM_L ** 2 + D ** 2 - R ** 2) / (2 * ARM_L * D)));
  const a = Math.atan2(dy, dx) + Math.acos(cos);
  return [PIVOT[0] + ARM_L * Math.cos(a), PIVOT[1] + ARM_L * Math.sin(a)];
}

/* ---------- Cylinder ruler on the floor ---------- */
const RULER = { x0: 0.6, x1: 11.6, y0: 4.6, row0: 5.6, row: 1.15 };
const rx = (c) => RULER.x0 + (c / 199) * (RULER.x1 - RULER.x0);
const ry = (k) => RULER.row0 + k * RULER.row;
const Z_FLOOR = 0.01;

function ring(R, z, cls) {
  const [px, py] = project(CX, CY, z);
  const a = R * UNIT * Math.SQRT2;
  return `<ellipse class="${cls}" cx="${r2(px)}" cy="${r2(py)}" rx="${r2(a)}" ry="${r2(a / 2)}"/>`;
}

function line(a, b, cls) {
  const [x1, y1] = project(...a);
  const [x2, y2] = project(...b);
  return `<line class="${cls}" x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}"/>`;
}

function rulerSvg() {
  let s = `<g class="disk-ruler">`;
  for (let k = 0; k <= 8; k++)
    s += line([rx(0), ry(k), Z_FLOOR], [rx(199), ry(k), Z_FLOOR], "disk-ruler-row");
  for (const c of [0, 50, 100, 150, 199]) {
    s += line([rx(c), RULER.y0, Z_FLOOR], [rx(c), ry(8), Z_FLOOR], "disk-ruler-col");
    s += topText({ x: rx(c), y: RULER.y0 - 0.7, z: Z_FLOOR, text: String(c), size: 12, weight: 500, fill: "var(--muted)" });
  }
  s += line([rx(0), RULER.y0, Z_FLOOR], [rx(199), RULER.y0, Z_FLOOR], "disk-ruler-axis");
  for (let k = 1; k <= 8; k++)
    s += topText({ x: rx(0) - 0.55, y: ry(k), z: Z_FLOOR, text: String(k), size: 12, weight: 500, fill: "var(--muted)" });
  s += `<g id="disk-marks">${REQUESTS.map((c, i) => {
    const [x, y] = project(rx(c), RULER.y0, Z_FLOOR);
    return `<polygon class="disk-mark" data-mark="${i + 1}" points="${r2(x)},${r2(y - 4)} ${r2(x + 6)},${r2(y)} ${r2(x)},${r2(y + 4)} ${r2(x - 6)},${r2(y)}"/>`;
  }).join("")}</g>`;
  s += `<polyline id="disk-route" class="disk-route" points=""/><g id="disk-route-dots"></g></g>`;
  return s;
}

// Each view is fitted to the devices, callouts, ruler and the token lift (not
// to the floor, which runs past the stage edges).
const VIEW = { wide: "-378 -84 1228 462", narrow: "-412 -97 904 531" };

function sceneSvg(wide) {
  return `<svg viewBox="${wide ? VIEW.wide : VIEW.narrow}" role="img" aria-labelledby="disk-scene-title">
    <title id="disk-scene-title">요청 큐, 컨트롤러, 하드 디스크와 헤드 이동 경로</title>
    ${defs()}
    ${wide ? floor({ x: -6, y: -16, w: 40, d: 34 }) : floor({ x: -1.4, y: -1, w: 27.4, d: 17.8 })}
    ${rulerSvg()}
    ${floorPath([[QUEUE.w, 1.2], [CTRL.x, 1.2]], { cls: "disk-wire", id: "wire-queue", arrow: true })}
    ${floorPath(wide ? [[CTRL.x + CTRL.size, CTRL.y + CTRL.size / 2], [DRIVE.x, CTRL.y + CTRL.size / 2]] : [[CTRL.x + CTRL.size / 2, CTRL.y + CTRL.size], [CTRL.x + CTRL.size / 2, DRIVE.y]], { cls: "disk-wire", id: "wire-drive", arrow: true })}
    ${queue.svg}
    ${ctrl.svg}
    ${drive.svg}
    <g class="disk-platter">
      ${[0, 50, 100, 150, 199].map((c) => ring(trackR(c), PZ + 0.005, "disk-guide")).join("")}
      <g id="disk-target"></g>
      <g id="disk-head-ring"></g>
    </g>
    <g id="disk-arm"></g>
    ${callout({ x: 1.4, y: 0.2, z: QUEUE.h, dx: -30, dy: -64, title: "요청 큐 · OS 스케줄러", sub: "도착 순서 · 다음 요청 선택" })}
    ${callout({ x: CTRL.x + 0.4, y: CTRL.y + 0.6, z: ctrl.top, dx: -6, dy: -74, title: "컨트롤러", sub: "고른 요청 실행" })}
    ${callout({ x: DRIVE.x + DRIVE.w, y: DRIVE.y + 1.2, z: drive.top, dx: 40, dy: -64, title: "하드 디스크", sub: "실린더 0 바깥쪽 · 199 안쪽" })}
    ${callout({ x: rx(0), y: ry(8), z: Z_FLOOR, dx: -36, dy: -58, title: "헤드 이동 경로", sub: "실린더 × 처리 순서" })}
    <g id="disk-tokens">${REQUESTS.map(
      (c, i) => `<g class="disk-token" data-id="${i + 1}">${token({ id: String(i + 1), text: String(c), color: "var(--tok)", size: 1.08, h: 0.5 })}</g>`,
    ).join("")}</g>
  </svg>`;
}

function armSvg(c, lit) {
  const [hx, hy] = headPoint(c);
  const [px, py] = PIVOT;
  const len = Math.hypot(hx - px, hy - py);
  const ux = (hx - px) / len;
  const uy = (hy - py) / len;
  const nx = -uy;
  const ny = ux;
  const poly = (pts, z) => pts.map(([x, y]) => P(x, y, z)).join(" ");
  const back = [px - ux * 0.9, py - uy * 0.9];
  const arm = [
    [back[0] + nx * 0.42, back[1] + ny * 0.42],
    [hx - ux * 0.3 + nx * 0.14, hy - uy * 0.3 + ny * 0.14],
    [hx - ux * 0.3 - nx * 0.14, hy - uy * 0.3 - ny * 0.14],
    [back[0] - nx * 0.42, back[1] - ny * 0.42],
  ];
  const slider = [
    [hx - ux * 0.38 + nx * 0.26, hy - uy * 0.38 + ny * 0.26],
    [hx + ux * 0.26 + nx * 0.26, hy + uy * 0.26 + ny * 0.26],
    [hx + ux * 0.26 - nx * 0.26, hy + uy * 0.26 - ny * 0.26],
    [hx - ux * 0.38 - nx * 0.26, hy - uy * 0.38 - ny * 0.26],
  ];
  const shadowPts = arm.map(([x, y]) => [x + 0.18, y + 0.32]);
  const [ox, oy] = project(px, py, drive.top);
  const [tx, ty] = project(px, py, ARM_Z + 0.06);
  const pr = 0.62 * UNIT * Math.SQRT2;
  return `<polygon class="disk-arm-shadow" points="${poly(shadowPts, PZ + 0.01)}"/>
    <ellipse class="disk-pivot-base" cx="${r2(ox)}" cy="${r2(oy)}" rx="${r2(pr)}" ry="${r2(pr / 2)}"/>
    <rect class="disk-pivot-base" x="${r2(ox - pr)}" y="${r2(ty)}" width="${r2(pr * 2)}" height="${r2(oy - ty)}"/>
    <polygon class="disk-arm-body" points="${poly(arm, ARM_Z)}"/>
    <polygon class="disk-head ${lit ? "is-lit" : ""}" points="${poly(slider, ARM_Z + 0.02)}"/>
    <ellipse class="disk-pivot-cap" cx="${r2(tx)}" cy="${r2(ty)}" rx="${r2(pr)}" ry="${r2(pr / 2)}"/>`;
}

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export function createDiskScene(host, { onPhase, onHead } = {}) {
  const narrow = matchMedia("(max-width: 759px)");
  const $ = (s) => host.querySelector(s);
  let tokens;
  let shown = null;
  function build() {
    setLayout(!narrow.matches);
    host.innerHTML = sceneSvg(!narrow.matches);
    tokens = new Map([...host.querySelectorAll(".disk-token")].map((g) => [Number(g.dataset.id), g]));
  }
  build();
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
    onHead?.(Math.round(c));
  }
  function drawTarget(c) {
    $("#disk-target").innerHTML = c == null ? "" : ring(trackR(c), PZ + 0.01, "disk-target-track");
  }
  function drawRoute(points) {
    const xy = points.map(([c, k]) => project(rx(c), ry(k), Z_FLOOR).map(r2));
    $("#disk-route").setAttribute("points", xy.map((p) => p.join(",")).join(" "));
    $("#disk-route-dots").innerHTML = xy
      .map(([x, y], i) => `<circle class="disk-route-dot${i === xy.length - 1 ? " is-last" : ""}" cx="${x}" cy="${y}" r="${i === xy.length - 1 ? 4.2 : 3}"/>`)
      .join("");
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
      const i = id - 1;
      place(g, ...slotPoint(i));
      $(`[data-mark="${id}"]`).setAttribute("class", `disk-mark${done ? " is-served" : selected === id ? " is-selected" : ""}`);
    }
  }
  function snap(step, route) {
    shown = [step, route];
    setTokens(step.state);
    drawHead(step.state.head, step.index > 0);
    drawTarget(null);
    drawRoute(route);
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
    drawRoute(before);
    drawTarget(null);
    setWires(null);
    onPhase?.("select", step);
    await tween(run, step.candidates[1] ? 1000 : 700);
    if (run.cancelled) return;

    setWires("controller");
    onPhase?.("controller", step);
    const from = slotPoint(id - 1);
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
      drawRoute([...before, ...pts, at(c, acc + f * legs[i])]);
    });
    if (run.cancelled) return;

    drawTarget(null);
    setWires(null);
    drawRoute(route);
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
