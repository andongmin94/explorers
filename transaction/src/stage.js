// Scene parts shared by both transaction pages: one floor, a database server
// at the back, two client laptops (T1 lower left, T2 lower right) and the SQL
// routes between them. Everything is drawn with shared/iso-kit.js; this file
// only fixes the layout and adds the moving SQL tokens and a pausable motion
// runner that honours the explorer's speed and pause controls.
import {
  box,
  callout,
  defs,
  floor,
  floorPath,
  frontText,
  laptop,
  place,
  project,
  quad,
  server,
  shadow,
  topText,
  travel,
} from "../../shared/iso-kit.js";

export const COLORS = { T1: "var(--t1)", T2: "var(--t2)" };
export const DB = { x: 0, y: 0, w: 6, d: 6, units: 3 };
export const DB_TOP = DB.units * 0.75 - 0.05;
export const LAPTOPS = {
  T1: { x: -1.6, y: 10, w: 4.6, d: 3 },
  T2: { x: 10, y: -1.6, w: 4.6, d: 3 },
};
// Request routes run laptop → database edge. Responses run them backwards.
export const ROUTES = {
  T1: [[3.15, 11.5], [4.5, 11.5], [4.5, 6.2]],
  T2: [[12.3, 1.55], [12.3, 4.5], [6.2, 4.5]],
};
// Where a blocked request stops: just outside the database, on its own route.
export const PARK = { T1: [4.5, 7.7], T2: [7.7, 4.5] };
const FLOOR = { x: -2.6, y: -2.6, w: 18.2, d: 16.6 };
const SCREEN_LINES = [2.0, 0.98];

/** A rectangular SQL token with its label printed on top. Drawn at the origin. */
export function sqlToken({ text, color, w = 2.3, d = 1.1, h = 0.5 }) {
  const fill = {
    top: `color-mix(in oklch, ${color} 82%, white)`,
    front: `color-mix(in oklch, ${color} 94%, black)`,
    side: `color-mix(in oklch, ${color} 70%, black)`,
  };
  return `<g class="tx-token">
    ${shadow({ x: -w / 2, y: -d / 2, w, d, spread: 0.18 })}
    ${box({ x: -w / 2, y: -d / 2, z: 0, w, d, h, fill, stroke: `color-mix(in oklch, ${color} 55%, black)`, strokeWidth: 0.7 })}
    ${topText({ x: 0, y: 0, z: h, text, size: 12, fill: "#fff", weight: 800 })}
  </g>`;
}

/** Laptop with three screen lines: status, then two labelled values. */
function client(id, labels) {
  const l = LAPTOPS[id];
  const y = l.y - 0.06;
  const rows = labels
    .map(
      (label, i) =>
        frontText({ x: l.x + 0.42, y, z: SCREEN_LINES[i], text: label, size: 15, anchor: "start", weight: 600, fill: "var(--tx-screen-dim)", cls: "tx-screen-label" }) +
        `<g data-screen="${id}-${i}">${frontText({ x: l.x + l.w - 0.42, y, z: SCREEN_LINES[i], text: "—", size: 20, anchor: "end", fill: "var(--hw-lcd-ink)", weight: 700, cls: "tx-screen-value" })}</g>`,
    )
    .join("");
  return `<g class="tx-client" data-client="${id}" style="--tx:${COLORS[id]}">${laptop({ ...l }).svg}<g class="tx-screen">${rows}</g></g>`;
}

// Views fitted to the devices, callouts and SQL routes (measured), not to the
// floor: the floor runs past the stage edges. The deadlock page reaches
// further down for the wait-for graph printed in front of the routes.
export const VIEWS = { inventory: "-316 -104 692 285", deadlock: "-318 -105 694 380" };

/**
 * The static scene: floor, routes, devices, callouts and empty groups the
 * page scene fills (dbTop, pending, edges, movers).
 */
export function sceneSvg({ label, dbTop = "", floorMarks = "", screens, dbSub, dbTitle = "재고 DB", names = { T1: "T1 · 주문 1", T2: "T2 · 주문 2" }, view = VIEWS.inventory }) {
  const lt = LAPTOPS;
  const lanes = Object.entries(ROUTES)
    .map(([id, route]) => `<g class="tx-lane" data-lane="${id}">${floorPath(route, { dashed: true, arrow: false })}</g>`)
    .join("");
  return `<svg viewBox="${view}" role="img" aria-label="${label}">
    ${defs()}
    ${floor({ x: FLOOR.x - 6, y: FLOOR.y - 6, w: FLOOR.w + 12, d: FLOOR.d + 12 })}
    ${floorMarks}
    <g class="tx-lanes">${lanes}</g>
    <g class="tx-db">${server({ ...DB, label: "" }).svg}${dbTop}<g class="tx-pending"></g></g>
    <g class="tx-parked"></g>
    ${client("T2", screens)}
    ${client("T1", screens)}
    ${callout({ x: DB.x + DB.w / 2, y: DB.y, z: DB_TOP, dx: 0, dy: -66, title: dbTitle, sub: dbSub })}
    ${callout({ x: lt.T1.x + 1.2, y: lt.T1.y, z: 2.8, dx: -34, dy: -52, title: names.T1, sub: "IDLE", cls: "tx-callout-t1" })}
    ${callout({ x: lt.T2.x + lt.T2.w - 1.2, y: lt.T2.y, z: 2.8, dx: 34, dy: -52, title: names.T2, sub: "IDLE", cls: "tx-callout-t2" })}
    <g class="tx-movers"><g class="tx-mover" data-mover="T1"></g><g class="tx-mover" data-mover="T2"></g></g>
    <g class="tx-hold" aria-hidden="true"></g>
  </svg>`;
}

/** A dark LCD well printed on the database top. */
export function well({ x, y, w, d }) {
  return quad({ x, y, z: DB_TOP + 0.002, w, d, fill: "var(--tx-well)", stroke: "var(--iso-line)", strokeWidth: 0.6 });
}
export function slot({ x, y, w, d }) {
  return quad({ x, y, z: DB_TOP + 0.002, w, d, fill: "var(--hw-lip)" });
}
export const printed = (o) => topText({ z: DB_TOP + 0.01, size: 12, weight: 600, fill: "var(--muted)", ...o });

/** Set a laptop's screen values: [status, value1, value2]. */
export function setScreen(root, id, values) {
  values.forEach((value, i) => {
    const el = root.querySelector(`[data-screen="${id}-${i}"] text`);
    if (el && el.textContent !== String(value)) el.textContent = value;
  });
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], (a[2] ?? 0) - (b[2] ?? 0));
/** Resample a polyline into evenly spaced points so travel() keeps one speed. */
function resample(route, step = 0.5) {
  const out = [route[0]];
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1];
    const b = route[i];
    const n = Math.max(1, Math.round(dist(a, b) / step));
    for (let k = 1; k <= n; k++) out.push([0, 1, 2].map((j) => (a[j] ?? 0) + ((b[j] ?? 0) - (a[j] ?? 0)) * (k / n)));
  }
  return out;
}
const length = (route) => route.slice(1).reduce((sum, p, i) => sum + dist(route[i], p), 0);

/**
 * Pausable motion. Every animation of the current event goes through one run,
 * so pause, speed and cancellation reach all of them.
 */
export function createRunner(svg) {
  const holder = svg.querySelector(".tx-hold");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let run = null;
  const track = async (animation) => {
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
    start(speed) {
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
    setSpeed(speed) {
      if (!run) return;
      run.speed = speed;
      run.animations.forEach((a) => a.updatePlaybackRate(speed));
    },
    /** Move a token along world points; duration grows with distance. */
    glide(el, route, { per = 150, base = 260 } = {}) {
      const points = resample(route.map(([x, y, z = 0]) => [x, y, z]));
      return track(travel(el, points, { duration: base + length(points) * per, easing: "cubic-bezier(.35,.05,.35,1)" }));
    },
    hold(ms) {
      return track(holder.animate([{ opacity: 0 }, { opacity: 0 }], { duration: ms }));
    },
    animate(el, frames, options) {
      return track(el.animate(frames, options));
    },
  };
  return api;
}

/** Show a token in a mover group at a world point. */
export function showToken(el, { text, color, at, w }) {
  el.innerHTML = sqlToken({ text, color, w: w ?? Math.max(1.3, 0.55 + String(text).length * 0.36) });
  el.style.opacity = "1";
  place(el, ...at);
}
export function hideToken(el) {
  el.style.opacity = "0";
  el.innerHTML = "";
}

export { place };

/** A larger status LED for the database top (same classes as the kit's led()). */
export function lamp({ x, y, z = DB_TOP + 0.01 }) {
  const [sx, sy] = project(x, y, z);
  return `<g class="iso-led tx-lamp">
    <ellipse cx="${sx}" cy="${sy}" rx="9" ry="5.2" class="iso-led-halo"/>
    <ellipse cx="${sx}" cy="${sy}" rx="5.6" ry="3.2" class="iso-led-core"/>
  </g>`;
}
export function setLamp(el, owner) {
  el.classList.toggle("is-on", Boolean(owner));
  el.style.setProperty("--led", owner ? COLORS[owner] : "var(--accent)");
}

/** The callout under each laptop doubles as its status line. */
export function setStatus(svg, id, text) {
  const sub = svg.querySelector(`.tx-callout-${id.toLowerCase()} .iso-callout-sub`);
  if (sub.textContent !== text) sub.textContent = text;
}

/** Token moves both scenes share: request out, response back, DB activity. */
export function createMoves(svg, runner) {
  const movers = Object.fromEntries(Object.keys(ROUTES).map((id) => [id, svg.querySelector(`[data-mover="${id}"]`)]));
  const lane = (id, on) => svg.querySelector(`[data-lane="${id}"]`).classList.toggle("is-active", on);
  const moves = {
    movers,
    edge: (id) => ROUTES[id].at(-1),
    reset() {
      for (const id of Object.keys(movers)) {
        hideToken(movers[id]);
        lane(id, false);
      }
    },
    async send(id, label, route) {
      showToken(movers[id], { text: label, color: COLORS[id], at: route[0] });
      lane(id, true);
      const ok = await runner.glide(movers[id], route);
      lane(id, false);
      return ok;
    },
    /** A token back to the laptop, from the database edge or from a parked spot. */
    async respond(id, label, from = null) {
      const back = [...ROUTES[id]].reverse();
      if (from) back[0] = from;
      const ok = await moves.send(id, label, back);
      hideToken(movers[id]);
      return ok;
    },
    /** Lift a token from the database edge onto a slot on the top. */
    async rise(id, slotAt) {
      const [ex, ey] = moves.edge(id);
      const ok = await runner.glide(movers[id], [[ex, ey, 0], [ex, ey, DB_TOP + 0.05], slotAt], { per: 120 });
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
    merge(el, from, to) {
      const [ax, ay] = project(...from);
      const [bx, by] = project(...to);
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

