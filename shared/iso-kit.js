// Isometric drawing kit shared by every explorer scene.
//
// One projection, one light, one scale for every device, so scenes in different
// explorers look like parts of the same product. World units: x runs to the
// lower right, y to the lower left, z up. One unit is UNIT screen pixels along
// x; the projection is the classic 2:1 dimetric used in pixel-art isometry.
//
// Every function returns an SVG string. Faces are lit from the upper left:
// top = --iso-top-fill, the face toward +y ("front", lower left) =
// --iso-front-fill, the face toward +x ("side", lower right) = --iso-side-fill.
// shared/iso.js injects the gradients those fills point at.
//
// Put the data on the devices: a process, page or transaction is a token()
// that sits on or slides between devices, never a flat card pasted next to one.

export const UNIT = 20;

/** World point → screen point. */
export function project(x, y, z = 0, unit = UNIT) {
  return [(x - y) * unit, ((x + y) * unit) / 2 - z * unit];
}

const round = (n) => Math.round(n * 100) / 100;
const pt = (x, y, z) => project(x, y, z).map(round).join(",");
const pts = (list) => list.map(([x, y, z]) => pt(x, y, z)).join(" ");

export const escapeXml = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const attrs = (o) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => ` ${k}="${escapeXml(v)}"`)
    .join("");

/** World outline of a rounded rectangle at height z, as [x, y, z] points. */
function roundedOutline(x, y, w, d, r, z, steps = 6) {
  const out = [];
  // Corners in order: back-left, back-right, front-right, front-left.
  const corners = [
    [x + r, y + r, Math.PI, 1.5 * Math.PI],
    [x + w - r, y + r, 1.5 * Math.PI, 2 * Math.PI],
    [x + w - r, y + d - r, 0, 0.5 * Math.PI],
    [x + r, y + d - r, 0.5 * Math.PI, Math.PI],
  ];
  for (const [cx, cy, a0, a1] of corners) {
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps;
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, z]);
    }
  }
  return out;
}

/** Convex hull of screen points (monotone chain). */
function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper = [];
  for (const q of p.reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

const screenPts = (list) => list.map(([sx, sy]) => `${round(sx)},${round(sy)}`).join(" ");
let gradientSeq = 0;
const plainColour = (value) => value && !value.includes("url(") && !value.includes("-fill");

/**
 * A solid block with softly rounded vertical corners, like a moulded part.
 *
 * The wall is one surface lit from the upper left: the front (+y) side in the
 * front tone, the right (+x) side in the side tone, blended round the corner
 * with a specular streak where the corner turns toward the light, and a
 * vertical falloff toward the floor. The top has a chamfer band and its two
 * front edges catch the light. A soft silhouette holds it on the floor.
 *
 * fill: { top, front, side } overrides (CSS colours). radius in world units;
 * 0 gives sharp corners.
 */
export function box({ x = 0, y = 0, z = 0, w = 1, d = 1, h = 1, cls = "", fill = {}, stroke = "var(--iso-line)", strokeWidth = 0.8, radius, bevel } = {}) {
  const t = z + h;
  const r = Math.max(0, Math.min(radius ?? Math.min(0.3, w * 0.16, d * 0.16), w / 2, d / 2));
  const steps = r > 0.02 ? 6 : 0;
  const bottomWorld = steps ? roundedOutline(x, y, w, d, r, z, steps) : [[x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z]];
  const topWorld = steps ? roundedOutline(x, y, w, d, r, t, steps) : [[x, y, t], [x + w, y, t], [x + w, y + d, t], [x, y + d, t]];
  const bottom = bottomWorld.map(([a, b, c]) => project(a, b, c));
  const top = topWorld.map(([a, b, c]) => project(a, b, c));
  const shell = hull([...bottom, ...top]);

  // Horizontal light across the wall: front tone left of the front-right
  // corner, side tone right of it, a highlight on the turn.
  const xs = shell.map((q) => q[0]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const span = Math.max(1, maxX - minX);
  const cornerX = project(x + w, y + d, z)[0];
  const at = (sx) => Math.min(1, Math.max(0, (sx - minX) / span));
  const turn = Math.max(0.004, (r * UNIT * 1.2) / span);
  const c = at(cornerX);
  const frontTone = plainColour(fill.front) ? fill.front : "var(--iso-front)";
  const sideTone = plainColour(fill.side) ? fill.side : "var(--iso-side)";
  const id = `hwg${++gradientSeq}`;
  const stop = (o, colour) => `<stop offset="${Math.min(1, Math.max(0, o)).toFixed(4)}" style="stop-color: ${colour}"/>`;
  const wallGradient = `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${round(minX)}" y1="0" x2="${round(maxX)}" y2="0">
      ${stop(0, `color-mix(in oklch, ${frontTone} 92%, white)`)}
      ${stop(c - turn * 1.6, frontTone)}
      ${stop(c - turn * 0.25, `color-mix(in oklch, ${frontTone} 70%, var(--iso-spec, white))`)}
      ${stop(c + turn * 0.6, sideTone)}
      ${stop(1, `color-mix(in oklch, ${sideTone} 90%, black)`)}
    </linearGradient>`;

  const doBevel = bevel ?? Math.min(w, d) >= 0.5;
  const b = Math.min(0.14, w * 0.09, d * 0.09);
  const topFill = fill.top ?? "var(--iso-top-fill)";
  const rim = plainColour(fill.top) ? `color-mix(in oklch, ${fill.top} 86%, black)` : "var(--iso-rim)";
  const innerWorld = steps
    ? roundedOutline(x + b, y + b, w - 2 * b, d - 2 * b, Math.max(0.01, r - b * 0.6), t, steps)
    : [[x + b, y + b, t], [x + w - b, y + b, t], [x + w - b, y + d - b, t], [x + b, y + d - b, t]];
  // The lit rim runs from the start of the right side round to the end of
  // the front side.
  const n = steps + 1;
  const litWorld = steps ? topWorld.slice(n, 3 * n) : [topWorld[1], topWorld[2], topWorld[3]];

  return `<g class="iso-box ${cls}">
    <defs>${wallGradient}</defs>
    <polygon class="iso-wall" points="${screenPts(shell)}" fill="url(#${id})"/>
    <polygon class="iso-wall-shade" points="${screenPts(shell)}" fill="url(#hw-iso-wall-shade)"/>
    ${doBevel
      ? `<polygon class="iso-top iso-rim" points="${screenPts(top)}" fill="${rim}"/>
    <polygon class="iso-top" points="${pts(innerWorld)}" fill="${topFill}"/>`
      : `<polygon class="iso-top" points="${screenPts(top)}" fill="${topFill}"/>`}
    <polyline class="iso-edge-lit" points="${pts(litWorld)}"/>
    <polygon class="iso-silhouette" points="${screenPts(shell)}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>
  </g>`;
}

/** A flat quad on a horizontal plane (z), e.g. a pad, slot or screen. */
export function quad({ x = 0, y = 0, z = 0, w = 1, d = 1, cls = "", fill = "var(--iso-top-fill)", stroke = "none", strokeWidth = 0.8 } = {}) {
  return `<polygon class="${cls}" points="${pts([[x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z]])}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
}

/** A quad on the front face plane (y = const), spanning x and z. */
export function frontQuad({ x = 0, y = 0, z = 0, w = 1, h = 1, cls = "", fill = "var(--hw-lip)", stroke = "none" } = {}) {
  return `<polygon class="${cls}" points="${pts([[x, y, z], [x + w, y, z], [x + w, y, z + h], [x, y, z + h]])}" fill="${fill}" stroke="${stroke}"/>`;
}

/** A quad on the side face plane (x = const), spanning y and z. */
export function sideQuad({ x = 0, y = 0, z = 0, d = 1, h = 1, cls = "", fill = "var(--hw-lip)", stroke = "none" } = {}) {
  return `<polygon class="${cls}" points="${pts([[x, y, z], [x, y + d, z], [x, y + d, z + h], [x, y, z + h]])}" fill="${fill}" stroke="${stroke}"/>`;
}

/** Soft contact shadow under a footprint. */
export function shadow({ x = 0, y = 0, w = 1, d = 1, spread = 0.35, cls = "" } = {}) {
  const s = spread;
  const core = 0.08;
  return `<g class="iso-contact-group ${cls}">
    <polygon class="iso-contact" points="${pts([[x - s * 0.3, y + s * 0.2, 0], [x + w + s, y + s * 0.2, 0], [x + w + s, y + d + s, 0], [x - s * 0.3, y + d + s, 0]])}" fill="var(--iso-shadow)" style="filter: blur(9px); opacity: .45"/>
    <polygon class="iso-contact" points="${pts([[x - core, y - core, 0], [x + w + core * 2, y - core, 0], [x + w + core * 2, y + d + core * 2, 0], [x - core, y + d + core * 2, 0]])}" fill="var(--iso-shadow)" style="filter: blur(2.5px); opacity: .5"/>
  </g>`;
}

/**
 * Text lying on a top face, reading along +x. size is in px at UNIT scale.
 * anchor: start | middle | end.
 */
export function topText({ x = 0, y = 0, z = 0, text = "", size = 12, anchor = "middle", cls = "", weight = 700, fill = "var(--ink)", mono = true } = {}) {
  const [sx, sy] = project(x, y, z);
  return `<text class="iso-top-text ${cls}" transform="matrix(1 0.5 -1 0.5 ${round(sx)} ${round(sy)})" text-anchor="${anchor}" dominant-baseline="central" font-size="${size}" font-weight="${weight}" fill="${fill}" font-family="${mono ? "var(--font-mono)" : "var(--font-sans)"}">${escapeXml(text)}</text>`;
}

/** Text printed on a front face (y = const), upright, reading along +x. */
export function frontText({ x = 0, y = 0, z = 0, text = "", size = 11, anchor = "middle", cls = "", weight = 600, fill = "var(--muted)", mono = true } = {}) {
  const [sx, sy] = project(x, y, z);
  return `<text class="iso-front-text ${cls}" transform="matrix(1 0.5 0 1 ${round(sx)} ${round(sy)})" text-anchor="${anchor}" dominant-baseline="central" font-size="${size}" font-weight="${weight}" fill="${fill}" font-family="${mono ? "var(--font-mono)" : "var(--font-sans)"}">${escapeXml(text)}</text>`;
}

/** Text printed on a side face (x = const), upright, reading along +y. */
export function sideText({ x = 0, y = 0, z = 0, text = "", size = 11, anchor = "middle", cls = "", weight = 600, fill = "var(--muted)", mono = true } = {}) {
  const [sx, sy] = project(x, y, z);
  return `<text class="iso-side-text ${cls}" transform="matrix(-1 0.5 0 1 ${round(sx)} ${round(sy)})" text-anchor="${anchor}" dominant-baseline="central" font-size="${size}" font-weight="${weight}" fill="${fill}" font-family="${mono ? "var(--font-mono)" : "var(--font-sans)"}">${escapeXml(text)}</text>`;
}

/**
 * Screen-space callout: a leader line from a world point to a flat label,
 * like the printed legends on a device. dx/dy offset the label in px.
 */
export function callout({ x = 0, y = 0, z = 0, dx = 0, dy = -40, title = "", sub = "", anchor = "middle", cls = "" } = {}) {
  const [sx, sy] = project(x, y, z);
  const lx = sx + dx;
  const ly = sy + dy;
  const subLine = sub ? `<text x="${round(lx)}" y="${round(ly + 15)}" text-anchor="${anchor}" class="iso-callout-sub">${escapeXml(sub)}</text>` : "";
  return `<g class="iso-callout ${cls}">
    <line x1="${round(sx)}" y1="${round(sy)}" x2="${round(lx)}" y2="${round(ly + (sub ? 22 : 8))}" class="iso-callout-line"/>
    <circle cx="${round(sx)}" cy="${round(sy)}" r="2.2" class="iso-callout-dot"/>
    <text x="${round(lx)}" y="${round(ly)}" text-anchor="${anchor}" class="iso-callout-title">${escapeXml(title)}</text>
    ${subLine}
  </g>`;
}

/** A path along the floor (or any z) through world points [[x, y], ...]. */
export function floorPath(points, { z = 0, cls = "", dashed = false, arrow = true, id, gap = 0.3 } = {}) {
  // An arrow stops short of the device it points at, so the head never
  // touches or slides under the device's edge.
  if (arrow && gap > 0 && points.length > 1) {
    const [ax, ay, az] = points.at(-2);
    const [bx, by, bz] = points.at(-1);
    const len = Math.hypot(bx - ax, by - ay);
    if (len > 0) {
      const k = Math.min(gap, len * 0.35) / len;
      points = [...points.slice(0, -1), [bx - (bx - ax) * k, by - (by - ay) * k, bz ?? az]];
    }
  }
  const d = points.map(([x, y, pz], i) => `${i ? "L" : "M"}${pt(x, y, pz ?? z)}`).join(" ");
  return `<path${attrs({ id })} class="iso-path ${dashed ? "is-dashed" : ""} ${cls}" d="${d}"${arrow ? ' marker-end="url(#iso-arrow)"' : ""}/>`;
}

/** Shared <defs>: the arrow head used by floorPath. Put once per scene SVG. */
export function defs() {
  return `<defs>
    <marker id="iso-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M1 1 9 5 1 9" fill="none" stroke="context-stroke" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
  </defs>`;
}

/** A status LED on a top face. */
export function led({ x = 0, y = 0, z = 0, on = false, color = "var(--accent)", cls = "" } = {}) {
  const [sx, sy] = project(x, y, z);
  return `<g class="iso-led ${on ? "is-on" : ""} ${cls}" style="--led:${color}">
    <ellipse cx="${round(sx)}" cy="${round(sy)}" rx="4.2" ry="2.4" class="iso-led-halo"/>
    <ellipse cx="${round(sx)}" cy="${round(sy)}" rx="2.6" ry="1.5" class="iso-led-core"/>
  </g>`;
}

/**
 * A data token: a small coloured block with its id printed on top.
 * Draw it at the origin and move it with place(), so it can travel.
 */
export function token({ id = "", text = id, color = "var(--accent)", size = 1.2, h = 0.55, cls = "", sub = "" } = {}) {
  const fill = {
    top: `color-mix(in oklch, ${color} 78%, white)`,
    front: `color-mix(in oklch, ${color} 92%, black)`,
    side: `color-mix(in oklch, ${color} 72%, black)`,
  };
  return `<g class="iso-token ${cls}"${attrs({ "data-token": id })}>
    ${shadow({ x: -size / 2, y: -size / 2, w: size, d: size, spread: 0.18 })}
    ${box({ x: -size / 2, y: -size / 2, z: 0, w: size, d: size, h, fill, stroke: `color-mix(in oklch, ${color} 55%, black)`, strokeWidth: 0.7 })}
    ${topText({ x: 0, y: 0, z: h, text, size: 11, fill: "#fff", weight: 800 })}
    ${sub ? frontText({ x: 0, y: size / 2, z: h / 2, text: sub, size: 8, fill: "rgb(255 255 255 / .9)" }) : ""}
  </g>`;
}

/** Move a token group (or any group drawn at the origin) to a world point. */
export function place(el, x, y, z = 0) {
  const [sx, sy] = project(x, y, z);
  el.style.transform = `translate(${round(sx)}px, ${round(sy)}px)`;
}

/** Animate a token group between world points with the Web Animations API. */
export function travel(el, route, { duration = 700, easing = "cubic-bezier(.2,.7,.2,1)" } = {}) {
  const frames = route.map(([x, y, z = 0]) => {
    const [sx, sy] = project(x, y, z);
    return { transform: `translate(${round(sx)}px, ${round(sy)}px)` };
  });
  const last = frames.at(-1);
  const animation = el.animate(frames, { duration, easing, fill: "forwards" });
  animation.finished.then(() => {
    el.style.transform = last.transform;
    animation.cancel();
  }).catch(() => {});
  return animation;
}

/**
 * viewBox that fits world-space bounds [[x, y, z], ...] plus padding (px).
 */
export function fitViewBox(points, pad = 24) {
  const s = points.map(([x, y, z = 0]) => project(x, y, z));
  const xs = s.map((p) => p[0]);
  const ys = s.map((p) => p[1]);
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  return `${round(minX)} ${round(minY)} ${round(Math.max(...xs) - minX + pad)} ${round(Math.max(...ys) - minY + pad)}`;
}

/** A floor plate the scene stands on: a thin slab with a fine grid. */
export function floor({ x = 0, y = 0, w = 10, d = 10, h = 0.25, grid = 1, cls = "" } = {}) {
  let lines = "";
  for (let i = grid; i < w; i += grid) lines += `<line class="iso-grid" x1="${pt(x + i, y, 0).split(",")[0]}" y1="${pt(x + i, y, 0).split(",")[1]}" x2="${pt(x + i, y + d, 0).split(",")[0]}" y2="${pt(x + i, y + d, 0).split(",")[1]}"/>`;
  for (let j = grid; j < d; j += grid) lines += `<line class="iso-grid" x1="${pt(x, y + j, 0).split(",")[0]}" y1="${pt(x, y + j, 0).split(",")[1]}" x2="${pt(x + w, y + j, 0).split(",")[0]}" y2="${pt(x + w, y + j, 0).split(",")[1]}"/>`;
  // No slab and no hard edge: a faint grid on the table that fades out
  // toward its borders, so devices read as standing on an open surface.
  const corners = [[x, y], [x + w, y], [x + w, y + d], [x, y + d]].map(([a, b2]) => pt(a, b2, 0)).join(" ");
  return `<g class="iso-floor ${cls}" mask="url(#hw-iso-floor-fade)">
    <polygon class="iso-floor-face" points="${corners}"/>
    <g class="iso-floor-grid">${lines}</g>
  </g>`;
}

/* ---------------------------------------------------------------------------
   Devices. Each takes a world position (x, y, z) of its back-left-bottom
   corner and returns { svg, top, slots } where `top` is the z of its upper
   surface and `slots` are world points where tokens can sit.
--------------------------------------------------------------------------- */

/** CPU: a substrate board with a raised heat-spreader and gold pins. */
export function chip({ x = 0, y = 0, z = 0, size = 4, label = "CPU", cls = "" } = {}) {
  const pad = size * 0.16;
  const core = size - pad * 2;
  let pins = "";
  const n = Math.max(4, Math.round(size * 2));
  for (let i = 0; i < n; i++) {
    const p = pad * 0.6 + (i * (size - pad * 1.2)) / (n - 1);
    pins += frontQuad({ x: x + p - 0.06, y: y + size, z: z + 0.02, w: 0.12, h: 0.14, fill: "var(--hw-pin, #c9a75a)" });
    pins += sideQuad({ x: x + size, y: y + p - 0.06, z: z + 0.02, d: 0.12, h: 0.14, fill: "var(--hw-pin, #b8964b)" });
  }
  const svg = `<g class="iso-device iso-chip ${cls}">
    ${shadow({ x, y, w: size, d: size, spread: 0.5 })}
    ${box({ x, y, z, w: size, d: size, h: 0.3, fill: { top: "var(--iso-board-fill, var(--iso-top-fill))" } })}
    ${pins}
    ${box({ x: x + pad, y: y + pad, z: z + 0.3, w: core, d: core, h: 0.45 })}
    ${quad({ x: x + pad + 0.25, y: y + pad + 0.25, z: z + 0.751, w: core - 0.5, d: core - 0.5, fill: "none", stroke: "var(--hw-edge)", strokeWidth: 1 })}
    ${topText({ x: x + size / 2, y: y + size / 2, z: z + 0.76, text: label, size: 15, weight: 800, fill: "var(--ink)" })}
  </g>`;
  return { svg, top: z + 0.75, slots: [[x + size / 2, y + size / 2, z + 0.75]] };
}

/** RAM stick on a slot: a thin board standing on its edge, with chips. */
export function ramStick({ x = 0, y = 0, z = 0, length = 6, label = "RAM", chips = 4, cls = "" } = {}) {
  const t = 0.35;
  const hgt = 1.6;
  let ics = "";
  for (let i = 0; i < chips; i++) {
    const cx = x + 0.5 + (i * (length - 1)) / chips;
    ics += box({ x: cx, y: y + 0.6 + t, z: z + 0.65, w: (length - 1) / chips - 0.25, d: 0.12, h: 0.75, fill: { top: "#3b3b38", front: "#2a2a28", side: "#1f1f1e" }, stroke: "#151514", strokeWidth: 0.5 });
  }
  const svg = `<g class="iso-device iso-ram ${cls}">
    ${shadow({ x, y, w: length, d: 1.6, spread: 0.4 })}
    ${box({ x, y, z, w: length, d: 1.6, h: 0.45 })}
    ${quad({ x: x + 0.2, y: y + 0.55, z: z + 0.451, w: length - 0.4, d: 0.5, fill: "var(--hw-lip)" })}
    ${box({ x: x + 0.3, y: y + 0.6, z: z + 0.45, w: length - 0.6, d: t, h: hgt, fill: { top: "#3f4a43", front: "#33403a", side: "#27312c" }, stroke: "#1c2420" })}
    ${ics}
    ${frontText({ x: x + length / 2, y: y + 0.6 + t, z: z + 0.45 + 0.3, text: label, size: 8, fill: "var(--ink)" })}
  </g>`;
  return { svg, top: z + 0.45 + hgt, slots: [] };
}

/** SSD / drive: a flat slab with a dark label window and a connector. */
export function ssd({ x = 0, y = 0, z = 0, w = 5, d = 3, label = "SSD", cls = "" } = {}) {
  let teeth = "";
  for (let i = 0; i < 8; i++) teeth += frontQuad({ x: x + w - 1.6 + i * 0.17, y: y + d, z: z + 0.08, w: 0.09, h: 0.18, fill: "var(--hw-pin, #c9a75a)" });
  const svg = `<g class="iso-device iso-ssd ${cls}">
    ${shadow({ x, y, w, d, spread: 0.45 })}
    ${box({ x, y, z, w, d, h: 0.42 })}
    ${quad({ x: x + 0.45, y: y + 0.45, z: z + 0.421, w: w - 0.9, d: d - 0.9, fill: "var(--hw-well-flat, #1d1d1c)" })}
    ${topText({ x: x + w / 2, y: y + d / 2, z: z + 0.43, text: label, size: 14, weight: 800, fill: "#f1f0ec" })}
    ${teeth}
  </g>`;
  return { svg, top: z + 0.42, slots: [[x + w / 2, y + d / 2, z + 0.42]] };
}

/** Server / database: stacked units with drive bays and LEDs. */
export function server({ x = 0, y = 0, z = 0, w = 4, d = 4, units = 3, label = "DB", cls = "", lit = 0 } = {}) {
  const uh = 0.75;
  let body = "";
  for (let i = 0; i < units; i++) {
    const uz = z + i * uh;
    body += box({ x, y, z: uz, w, d, h: uh - 0.05 });
    // Drive bays: a dark slot with a light pull tab, then a vent grille.
    const bays = Math.max(2, Math.floor((w - 1.2) / 0.9));
    for (let b = 0; b < bays; b++) {
      const bx = x + 0.3 + b * 0.9;
      body += frontQuad({ x: bx, y: y + d, z: uz + 0.17, w: 0.72, h: 0.34, fill: "var(--iso-bay, color-mix(in srgb, var(--hw-lip) 60%, var(--iso-side)))" });
      body += frontQuad({ x: bx + 0.06, y: y + d, z: uz + 0.22, w: 0.18, h: 0.24, fill: "var(--iso-top-fill)" });
    }
    for (let v = 0; v < 4; v++) body += frontQuad({ x: x + 0.3 + bays * 0.9 + v * 0.12, y: y + d, z: uz + 0.2, w: 0.05, h: 0.28, fill: "var(--iso-bay, color-mix(in srgb, var(--hw-lip) 60%, var(--iso-side)))" });
    const [lx, ly] = project(x + w - 0.45, y + d, uz + 0.36);
    body += `<circle cx="${round(lx)}" cy="${round(ly)}" r="2.2" class="iso-unit-led ${i < lit ? "is-on" : ""}"/>`;
  }
  const svg = `<g class="iso-device iso-server ${cls}">
    ${shadow({ x, y, w, d, spread: 0.6 })}
    ${body}
    ${topText({ x: x + w / 2, y: y + d / 2, z: z + units * uh - 0.05, text: label, size: 16, weight: 800, fill: "var(--ink)" })}
  </g>`;
  return { svg, top: z + units * uh - 0.05, slots: [[x + w / 2, y + d / 2, z + units * uh - 0.05]] };
}

/** Rows of key caps inside a keyboard well. */
function keyboard({ x, y, z, w, d }) {
  const rows = 4;
  const cols = Math.max(6, Math.round(w / 0.3));
  const gx = w / cols;
  const gy = d / rows;
  let keys = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // The bottom row has a long space bar in the middle.
      if (r === rows - 1 && c > cols * 0.3 && c < cols * 0.7) continue;
      keys += quad({ x: x + c * gx + gx * 0.14, y: y + r * gy + gy * 0.16, z, w: gx * 0.72, d: gy * 0.68, fill: "var(--iso-key, var(--iso-top-fill))" });
    }
  }
  const r = rows - 1;
  keys += quad({ x: x + cols * 0.3 * gx + gx, y: y + r * gy + gy * 0.16, z, w: (cols * 0.4 - 1) * gx, d: gy * 0.68, fill: "var(--iso-key, var(--iso-top-fill))" });
  return `<g class="iso-keys">${keys}</g>`;
}

/** Laptop: base with keyboard well and an open screen. */
export function laptop({ x = 0, y = 0, z = 0, w = 4, d = 3, label = "", cls = "", screen = "" } = {}) {
  const sh = 2.6;
  const svg = `<g class="iso-device iso-laptop ${cls}">
    ${shadow({ x, y, w, d, spread: 0.45 })}
    ${box({ x, y, z, w, d, h: 0.22 })}
    ${socket({ x: x + 0.3, y: y + 0.3, z: z + 0.22, w: w - 0.6, d: d * 0.52 })}
    ${keyboard({ x: x + 0.3, y: y + 0.3, z: z + 0.222, w: w - 0.6, d: d * 0.52 })}
    ${socket({ x: x + w * 0.34, y: y + d * 0.64, z: z + 0.22, w: w * 0.32, d: d * 0.22 })}
    <g class="iso-laptop-lid">
      ${box({ x, y: y - 0.22, z: z + 0.2, w, d: 0.22, h: sh, radius: 0.12, bevel: false })}
      ${frontQuad({ x: x + 0.16, y: y + 0.001, z: z + 0.36, w: w - 0.32, h: sh - 0.3, fill: "var(--iso-screen-bezel, #121211)" })}
      ${frontQuad({ x: x + 0.26, y: y + 0.002, z: z + 0.46, w: w - 0.52, h: sh - 0.5, fill: "url(#hw-iso-glass) #1b1b1a" })}
      <polygon class="iso-hinge" points="${pts([[x + 0.3, y + 0.02, z + 0.22], [x + w - 0.3, y + 0.02, z + 0.22], [x + w - 0.3, y + 0.02, z + 0.3], [x + 0.3, y + 0.02, z + 0.3]])}"/>
      ${screen ? frontText({ x: x + w / 2, y: y - 0.05, z: z + 0.22 + sh / 2, text: screen, size: 10, fill: "var(--hw-lcd-ink)" }) : ""}
    </g>
    ${label ? frontText({ x: x + w / 2, y: y + d, z: z + 0.11, text: label, size: 7, fill: "var(--muted)" }) : ""}
  </g>`;
  return { svg, top: z + 0.22, slots: [[x + w / 2, y + d * 0.75, z + 0.22]] };
}

/**
 * A vertical cylinder (disc, hub, knob): top ellipse plus the lit band of its
 * wall. fill: { top, wall } colours or gradients.
 */
export function cylinder({ cx = 0, cy = 0, z = 0, r = 1, h = 0.2, fill = {}, cls = "", stroke = "var(--iso-line)" } = {}) {
  const [px, pyTop] = project(cx, cy, z + h);
  const pyBottom = project(cx, cy, z)[1];
  const rx = r * UNIT * Math.SQRT2;
  const ry = rx / 2;
  const id = `hwc${++gradientSeq}`;
  const wall = fill.wall ?? `url(#${id})`;
  const band = `M${round(px - rx)},${round(pyTop)} L${round(px - rx)},${round(pyBottom)} A${round(rx)},${round(ry)} 0 0 0 ${round(px + rx)},${round(pyBottom)} L${round(px + rx)},${round(pyTop)} Z`;
  return `<g class="iso-cylinder ${cls}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" style="stop-color: color-mix(in oklch, var(--iso-front) 92%, white)"/>
      <stop offset=".42" style="stop-color: var(--iso-front)"/>
      <stop offset=".62" style="stop-color: var(--iso-spec, white)"/>
      <stop offset=".78" style="stop-color: var(--iso-side)"/>
      <stop offset="1" style="stop-color: color-mix(in oklch, var(--iso-side) 88%, black)"/>
    </linearGradient></defs>
    <path d="${band}" fill="${wall}" stroke="${stroke}" stroke-width=".6" stroke-opacity=".5"/>
    <ellipse cx="${round(px)}" cy="${round(pyTop)}" rx="${round(rx)}" ry="${round(ry)}" fill="${fill.top ?? "var(--iso-top-fill)"}" stroke="${stroke}" stroke-width=".6" stroke-opacity=".5"/>
  </g>`;
}

/**
 * Hard disk: a cast chassis with a round cavity, a thick mirror platter with
 * data tracks, a raised spindle hub with screws, and corner screws on the
 * lid. The actuator arm belongs to the explorer that animates it; `center` is
 * the platter top, `top` the chassis top.
 */
export function hdd({ x = 0, y = 0, z = 0, w = 9, d = 9, cls = "" } = {}) {
  const H = 0.7;
  const cx = x + w * 0.45;
  const cy = y + d * 0.5;
  const r = Math.min(w, d) * 0.38;
  const top = z + H;
  const platterZ = top - 0.08;
  const platterTop = platterZ + 0.16;
  const [px, py] = project(cx, cy, platterTop);
  const rxOf = (k) => r * k * UNIT * Math.SQRT2;
  const tracks = [0.97, 0.88, 0.79, 0.7, 0.61, 0.52, 0.43, 0.36]
    .map((k) => `<ellipse cx="${round(px)}" cy="${round(py)}" rx="${round(rxOf(k))}" ry="${round(rxOf(k) / 2)}" class="iso-platter-ring"/>`)
    .join("");
  const [wx, wy] = project(cx, cy, top);
  const cavity = r * 1.08 * UNIT * Math.SQRT2;
  const screws = [[0.35, 0.35], [w - 0.35, 0.35], [w - 0.35, d - 0.35], [0.35, d - 0.35]]
    .map(([sx, sy]) => { const [a, b2] = project(x + sx, y + sy, top); return `<ellipse cx="${round(a)}" cy="${round(b2)}" rx="3.2" ry="1.7" class="iso-screw"/>`; })
    .join("");
  const svg = `<g class="iso-device iso-hdd ${cls}">
    <defs>
      <radialGradient id="hw-platter" cx="32%" cy="28%" r="85%">
        <stop offset="0" style="stop-color: var(--platter-hi, #fff)"/>
        <stop offset=".45" style="stop-color: var(--platter-mid, #d9d8d3)"/>
        <stop offset=".7" style="stop-color: var(--platter-hi, #fff)"/>
        <stop offset="1" style="stop-color: var(--platter-lo, #b9b8b2)"/>
      </radialGradient>
    </defs>
    ${shadow({ x, y, w, d, spread: 0.8 })}
    ${box({ x, y, z, w, d, h: H, radius: 0.5 })}
    ${screws}
    <ellipse cx="${round(wx)}" cy="${round(wy)}" rx="${round(cavity)}" ry="${round(cavity / 2)}" class="iso-cavity"/>
    <ellipse cx="${round(wx)}" cy="${round(wy + 3)}" rx="${round(cavity - 3)}" ry="${round(cavity / 2 - 3)}" class="iso-cavity-floor"/>
    ${cylinder({ cx, cy, z: platterZ, r, h: 0.16, fill: { top: "url(#hw-platter)" } })}
    ${tracks}
    ${cylinder({ cx, cy, z: platterTop, r: r * 0.2, h: 0.22 })}
    ${cylinder({ cx, cy, z: platterTop + 0.22, r: r * 0.08, h: 0.06, fill: { top: "var(--hw-lip)" } })}
  </g>`;
  return { svg, top, center: [cx, cy, platterTop], radius: r, slots: [] };
}

/**
 * A recessed socket on a top face: a slightly darker floor with shaded back
 * and left walls, so an empty slot reads as a pocket a token drops into, not
 * as a grey placeholder square.
 */
export function socket({ x = 0, y = 0, z = 0, w = 1, d = 1, depth = 0.12, cls = "" } = {}) {
  const t = z + 0.002;
  const wall = Math.min(0.14, w * 0.12, d * 0.12);
  return `<g class="iso-socket ${cls}">
    ${quad({ x, y, z: t, w, d, fill: "var(--iso-socket, color-mix(in srgb, var(--hw-lip) 75%, var(--iso-front)))" })}
    ${quad({ x, y, z: t + 0.001, w, d: wall, fill: "var(--iso-socket-wall, color-mix(in srgb, var(--hw-lip) 55%, var(--iso-side)))" })}
    ${quad({ x, y, z: t + 0.001, w: wall, d, fill: "var(--iso-socket-wall, color-mix(in srgb, var(--hw-lip) 55%, var(--iso-side)))" })}
    <polyline points="${pts([[x, y + d, t], [x + w, y + d, t], [x + w, y, t]])}" fill="none" stroke="var(--iso-socket-lip, rgb(255 255 255 / .6))" stroke-width="1" stroke-linejoin="round"/>
  </g>`;
}

/** A generic cabinet / module with a recessed screen on top (for queues, frames). */
export function module({ x = 0, y = 0, z = 0, w = 4, d = 3, h = 0.9, label = "", sub = "", cls = "", well = true } = {}) {
  const svg = `<g class="iso-device iso-module ${cls}">
    ${shadow({ x, y, w, d, spread: 0.5 })}
    ${box({ x, y, z, w, d, h })}
    ${well ? socket({ x: x + 0.3, y: y + 0.3, z: z + h, w: w - 0.6, d: d - 0.6 }) : ""}
    ${label ? frontText({ x: x + w / 2, y: y + d, z: z + h * 0.62, text: label, size: 9, fill: "var(--ink)", weight: 700 }) : ""}
    ${sub ? frontText({ x: x + w / 2, y: y + d, z: z + h * 0.28, text: sub, size: 7.5, fill: "var(--muted)", weight: 500 }) : ""}
  </g>`;
  return { svg, top: z + h, slots: [[x + w / 2, y + d / 2, z + h]] };
}

/** CSS the kit's SVG relies on; injected once. */
const KIT_CSS = `
.iso-path { fill: none; stroke: var(--iso-guide, var(--iso-line)); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.iso-path.is-dashed { stroke-dasharray: 5 6; }
.iso-path.is-active { stroke: var(--accent); stroke-width: 2.2; filter: drop-shadow(0 0 4px color-mix(in srgb, var(--accent) 60%, transparent)); }
.iso-grid { stroke: var(--grid); stroke-width: .6; opacity: .85; }
.iso-floor-face { fill: var(--iso-floor, transparent); }
.iso-silhouette { opacity: .55; }
.iso-edge-lit { fill: none; stroke: var(--iso-edge-lit, rgb(255 255 255 / .9)); stroke-width: 1.1; stroke-linecap: round; stroke-linejoin: round; }
.iso-edge-corner { stroke: var(--iso-edge-corner, rgb(255 255 255 / .45)); stroke-width: .8; }
.iso-floor .iso-edge-lit, .iso-floor .iso-edge-corner { display: none; }
.iso-contact { mix-blend-mode: multiply; }
.iso-callout-line { stroke: var(--iso-guide, var(--iso-line)); stroke-width: 1; }
.iso-callout-dot { fill: var(--iso-guide, var(--iso-line)); }
.iso-callout-title { fill: var(--ink); font: 700 13px var(--font-sans); letter-spacing: -.01em; }
.iso-callout-sub { fill: var(--muted); font: 500 11px var(--font-mono); letter-spacing: .05em; }
.iso-led-halo { fill: transparent; }
.iso-led-core { fill: var(--hw-led-off); }
.iso-led.is-on .iso-led-core { fill: var(--led); }
.iso-led.is-on .iso-led-halo { fill: color-mix(in srgb, var(--led) 35%, transparent); filter: blur(2px); }
.iso-unit-led { fill: var(--hw-led-off); }
.iso-unit-led.is-on { fill: var(--accent); filter: drop-shadow(0 0 3px var(--accent)); }
.iso-platter-ring { fill: none; stroke: rgb(83 80 70 / .22); stroke-width: .6; }
.iso-cavity { fill: var(--iso-cavity, #d5d4cf); }
.iso-cavity-floor { fill: var(--iso-cavity-floor, #c3c2bc); }
.iso-screw { fill: var(--iso-side); stroke: var(--iso-line); stroke-width: .5; stroke-opacity: .5; }
.iso-hinge { fill: var(--iso-side); opacity: .8; }
.iso-token { transition: transform 600ms cubic-bezier(.2,.7,.2,1); }
@media (prefers-reduced-motion: reduce) { .iso-token { transition: none; } }
`;

if (typeof document !== "undefined" && !document.getElementById("iso-kit-css")) {
  const style = document.createElement("style");
  style.id = "iso-kit-css";
  style.textContent = KIT_CSS;
  document.head.append(style);
}
