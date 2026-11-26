// Isometric drawing kit shared by every explorer scene (TypeScript port of
// shared/iso-kit.js; same output, byte for byte, for the same input).
//
// One projection, one light, one scale for every device, so scenes in different
// explorers look like parts of the same product. World units: x runs to the
// lower right, y to the lower left, z up. One unit is UNIT screen pixels along
// x; the projection is the classic 2:1 dimetric used in pixel-art isometry.
//
// Every function returns an SVG string. Faces are lit from the upper left:
// top = brightest, the face toward +y ("front", lower left) in the front tone,
// the face toward +x ("side", lower right) in shade. shared/iso.js injects the
// gradients and patterns the materials point at.
//
// Materials: pass MAT.<name> as the `fill` of box() (or `mat` of a device).
// Devices are built from them so a CPU reads as a chip, RAM as a stick, a queue
// as a slotted tray, a table as a panel of cells, a done bin as a drawer.
//
// Put the data on the devices: a process, page or transaction is a token()
// that sits on or slides between devices, never a flat card pasted next to one.

export const UNIT = 20;

/** A world point [x, y, z?] (z defaults to 0) or a screen point [sx, sy]. */
export type Point = number[];

/** A material: the fill of box() or the `mat` of a device. */
export interface Material {
  top?: string;
  front?: string;
  side?: string;
  rim?: string;
  line?: string;
  edge?: string;
  spec?: string;
  overlay?: string;
  ink?: string;
  engrave?: string;
}
type MaterialName = "plastic" | "graphite" | "pcb" | "metal" | "gold" | "glass" | "rubber" | "ic";

/** What every device returns: its SVG, the z of its top and token slots. */
export interface Device {
  svg: string;
  top: number;
  slots: Point[];
}

interface Place {
  x?: number;
  y?: number;
  z?: number;
  cls?: string;
}
interface Footprint extends Place {
  w?: number;
  d?: number;
  h?: number;
}
export interface TextOptions extends Place {
  text?: string | number;
  size?: number;
  anchor?: string;
  weight?: number;
  fill?: string;
  mono?: boolean;
  engrave?: string;
  halo?: string;
}
export interface TrayOptions extends Footprint {
  slots?: number;
  pitch?: number;
  axis?: "x" | "y";
  start?: number;
  label?: string;
  sub?: string;
  exit?: "start" | "end";
  numbers?: boolean;
  leds?: boolean;
  mat?: Material;
}
export interface Tray extends Device {
  leds: Point[];
  head: number | undefined;
  w: number;
  d: number;
  /** One pocket opening (world w along x, d along y) and its depth. */
  pocket: { w: number; d: number; depth: number };
}

/** World point → screen point. */
export function project(x: number, y: number, z = 0, unit = UNIT): [number, number] {
  return [(x - y) * unit, ((x + y) * unit) / 2 - z * unit];
}

const round = (n: number) => Math.round(n * 100) / 100;
const pt = (x: number, y: number, z?: number) => project(x, y, z).map(round).join(",");
const pts = (list: Point[]) => list.map(([x, y, z]) => pt(x, y, z)).join(" ");

const XML: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
export const escapeXml = (text: unknown) => String(text).replace(/[&<>"']/g, (c) => XML[c]);

const attrs = (o: Record<string, unknown>) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => ` ${k}="${escapeXml(v)}"`)
    .join("");

/* ---------------------------------------------------------------------------
   Materials. Each is a `fill` object for box(): wall tones (front, side) are
   plain colours so the wall gradient can mix them; `top` may be a gradient.
   rim = chamfer band round the top, line = silhouette, edge = lit top edge,
   overlay = texture laid on the top (brushed grain, gloss), ink = colour of
   text printed on the material, engrave = the light lip under engraved text.
   Light and dark variants come from theme tokens (--iso-<material>-*).
--------------------------------------------------------------------------- */
export const MAT: Readonly<Record<MaterialName, Readonly<Material>>> = Object.freeze({
  /** Matte white plastic: the default casing. */
  plastic: Object.freeze({
    top: "var(--iso-top-fill)",
    front: "var(--iso-front)",
    side: "var(--iso-side)",
    rim: "var(--iso-rim)",
    line: "var(--iso-line)",
    edge: "var(--iso-edge-lit, rgb(255 255 255 / .9))",
    ink: "var(--iso-plastic-ink)",
    engrave: "rgb(255 255 255 / .9)",
  }),
  /** Dark anodised aluminium / graphite: housings, sockets, bins. */
  graphite: Object.freeze({
    top: "url(#hw-iso-graphite) var(--iso-graphite-top)",
    front: "var(--iso-graphite-front)",
    side: "var(--iso-graphite-side)",
    rim: "var(--iso-graphite-rim)",
    line: "var(--iso-graphite-line)",
    edge: "var(--iso-graphite-edge)",
    spec: "color-mix(in oklch, var(--iso-graphite-front) 60%, white)",
    ink: "var(--iso-graphite-ink)",
    engrave: "rgb(0 0 0 / .5)",
  }),
  /** Printed circuit board: green-black solder mask. */
  pcb: Object.freeze({
    top: "url(#hw-iso-pcb) var(--iso-pcb-top)",
    front: "var(--iso-pcb-front)",
    side: "var(--iso-pcb-side)",
    rim: "var(--iso-pcb-rim)",
    line: "var(--iso-pcb-line)",
    edge: "var(--iso-pcb-edge)",
    spec: "color-mix(in oklch, var(--iso-pcb-front) 70%, white)",
    ink: "var(--iso-pcb-ink)",
    engrave: "rgb(0 0 0 / .4)",
  }),
  /** Brushed aluminium: heat spreaders, trays, drive casings. */
  metal: Object.freeze({
    top: "url(#hw-iso-metal) var(--iso-metal-top)",
    front: "var(--iso-metal-front)",
    side: "var(--iso-metal-side)",
    rim: "var(--iso-metal-rim)",
    line: "var(--iso-metal-line)",
    edge: "var(--iso-metal-edge)",
    overlay: "url(#hw-iso-brush)",
    ink: "var(--iso-metal-ink)",
    engrave: "var(--iso-metal-engrave)",
  }),
  /** Gold contacts and pins. */
  gold: Object.freeze({
    top: "url(#hw-iso-gold) var(--iso-gold)",
    front: "var(--iso-gold)",
    side: "var(--iso-gold-lo)",
    rim: "var(--iso-gold-hi)",
    line: "var(--iso-gold-lo)",
    edge: "rgb(255 248 220 / .85)",
    ink: "var(--iso-gold-lo)",
  }),
  /** Glass / LCD: dark glossy screens and windows. */
  glass: Object.freeze({
    top: "url(#hw-iso-lcd) var(--iso-glass)",
    front: "var(--iso-glass)",
    side: "var(--iso-glass)",
    rim: "var(--iso-glass-hi)",
    line: "#000",
    edge: "rgb(255 255 255 / .25)",
    spec: "var(--iso-glass-hi)",
    ink: "var(--iso-glass-ink)",
  }),
  /** Rubber: feet, gaskets, cable jackets. */
  rubber: Object.freeze({
    top: "var(--iso-rubber-top)",
    front: "var(--iso-rubber-front)",
    side: "var(--iso-rubber-side)",
    rim: "var(--iso-rubber-top)",
    line: "#000",
    edge: "rgb(255 255 255 / .08)",
    spec: "var(--iso-rubber-front)",
    ink: "#cfcdc6",
  }),
  /** Black IC package (memory chips, controllers). */
  ic: Object.freeze({
    top: "url(#hw-iso-ic) var(--iso-ic-top)",
    front: "var(--iso-ic-front)",
    side: "var(--iso-ic-side)",
    rim: "var(--iso-ic-top)",
    line: "#000",
    edge: "rgb(255 255 255 / .22)",
    spec: "color-mix(in oklch, var(--iso-ic-front) 75%, white)",
    ink: "var(--iso-ic-ink)",
  }),
});

/** World outline of a rounded rectangle at height z, as [x, y, z] points. */
function roundedOutline(
  x: number,
  y: number,
  w: number,
  d: number,
  r: number,
  z: number,
  steps = 6,
) {
  const out: Point[] = [];
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
function hull(points: Point[]) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Point, a: Point, b: Point) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Point[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Point[] = [];
  for (const q of p.reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

const screenPts = (list: Point[]) => list.map(([sx, sy]) => `${round(sx)},${round(sy)}`).join(" ");
let gradientSeq = 0;
const plainColour = (value?: string): value is string =>
  !!value && !value.includes("url(") && !value.includes("-fill");

/**
 * A solid block with softly rounded vertical corners, like a moulded part.
 *
 * The wall is one surface lit from the upper left: the front (+y) side in the
 * front tone, the right (+x) side in the side tone, blended round the corner
 * with a specular streak where the corner turns toward the light, and a
 * vertical falloff toward the floor. The top has a chamfer band and its two
 * front edges catch the light.
 *
 * fill: a MAT.* material or { top, front, side, rim, line, edge, spec,
 * overlay } overrides (CSS colours). radius in world units; 0 gives sharp
 * corners.
 */
export function box({
  x = 0,
  y = 0,
  z = 0,
  w = 1,
  d = 1,
  h = 1,
  cls = "",
  fill = {},
  stroke,
  strokeWidth = 0.8,
  radius,
  bevel,
}: Footprint & {
  fill?: Material;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
  bevel?: boolean;
} = {}) {
  const t = z + h;
  const r = Math.max(0, Math.min(radius ?? Math.min(0.3, w * 0.16, d * 0.16), w / 2, d / 2));
  const steps = r > 0.02 ? 6 : 0;
  const bottomWorld = steps
    ? roundedOutline(x, y, w, d, r, z, steps)
    : [
        [x, y, z],
        [x + w, y, z],
        [x + w, y + d, z],
        [x, y + d, z],
      ];
  const topWorld = steps
    ? roundedOutline(x, y, w, d, r, t, steps)
    : [
        [x, y, t],
        [x + w, y, t],
        [x + w, y + d, t],
        [x, y + d, t],
      ];
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
  const at = (sx: number) => Math.min(1, Math.max(0, (sx - minX) / span));
  const turn = Math.max(0.004, (Math.max(r, 0.04) * UNIT * 1.2) / span);
  const c = at(cornerX);
  const frontTone = plainColour(fill.front) ? fill.front : "var(--iso-front)";
  const sideTone = plainColour(fill.side) ? fill.side : "var(--iso-side)";
  const spec = fill.spec ?? "var(--iso-spec, white)";
  const id = `hwg${++gradientSeq}`;
  const stop = (o: number, colour: string) =>
    `<stop offset="${Math.min(1, Math.max(0, o)).toFixed(4)}" style="stop-color: ${colour}"/>`;
  const wallGradient = `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${round(minX)}" y1="0" x2="${round(maxX)}" y2="0">
      ${stop(0, `color-mix(in oklch, ${frontTone} 92%, white)`)}
      ${stop(c - turn * 1.6, frontTone)}
      ${stop(c - turn * 0.25, `color-mix(in oklch, ${frontTone} 70%, ${spec})`)}
      ${stop(c + turn * 0.6, sideTone)}
      ${stop(1, `color-mix(in oklch, ${sideTone} 90%, black)`)}
    </linearGradient>`;

  const doBevel = bevel ?? Math.min(w, d) >= 0.5;
  const b = Math.min(0.14, w * 0.09, d * 0.09);
  const topFill = fill.top ?? "var(--iso-top-fill)";
  const rim =
    fill.rim ??
    (plainColour(fill.top) ? `color-mix(in oklch, ${fill.top} 86%, black)` : "var(--iso-rim)");
  const line = stroke ?? fill.line ?? "var(--iso-line)";
  const innerWorld = steps
    ? roundedOutline(x + b, y + b, w - 2 * b, d - 2 * b, Math.max(0.01, r - b * 0.6), t, steps)
    : [
        [x + b, y + b, t],
        [x + w - b, y + b, t],
        [x + w - b, y + d - b, t],
        [x + b, y + d - b, t],
      ];
  const topFace = doBevel ? pts(innerWorld) : screenPts(top);
  // The lit rim runs from the start of the right side round to the end of
  // the front side.
  const n = steps + 1;
  const litWorld = steps ? topWorld.slice(n, 3 * n) : [topWorld[1], topWorld[2], topWorld[3]];

  return `<g class="iso-box ${cls}">
    <defs>${wallGradient}</defs>
    <polygon class="iso-wall" points="${screenPts(shell)}" fill="url(#${id})"/>
    <polygon class="iso-wall-shade" points="${screenPts(shell)}" fill="url(#hw-iso-wall-shade)"/>
    ${doBevel ? `<polygon class="iso-top iso-rim" points="${screenPts(top)}" fill="${rim}"/>` : ""}
    <polygon class="iso-top" points="${topFace}" fill="${topFill}"/>
    ${fill.overlay ? `<polygon class="iso-top-overlay" points="${topFace}" fill="${fill.overlay}"/>` : ""}
    <polyline class="iso-edge-lit" points="${pts(litWorld)}"${fill.edge ? ` style="stroke: ${fill.edge}"` : ""}/>
    <polygon class="iso-silhouette" points="${screenPts(shell)}" fill="none" stroke="${line}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>
  </g>`;
}

/** A flat quad on a horizontal plane (z), e.g. a pad, slot or screen. */
export function quad({
  x = 0,
  y = 0,
  z = 0,
  w = 1,
  d = 1,
  cls = "",
  fill = "var(--iso-top-fill)",
  stroke = "none",
  strokeWidth = 0.8,
} = {}) {
  return `<polygon class="${cls}" points="${pts([
    [x, y, z],
    [x + w, y, z],
    [x + w, y + d, z],
    [x, y + d, z],
  ])}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
}

/** A quad on the front face plane (y = const), spanning x and z. */
export function frontQuad({
  x = 0,
  y = 0,
  z = 0,
  w = 1,
  h = 1,
  cls = "",
  fill = "var(--hw-lip)",
  stroke = "none",
} = {}) {
  return `<polygon class="${cls}" points="${pts([
    [x, y, z],
    [x + w, y, z],
    [x + w, y, z + h],
    [x, y, z + h],
  ])}" fill="${fill}" stroke="${stroke}"/>`;
}

/** A quad on the side face plane (x = const), spanning y and z. */
export function sideQuad({
  x = 0,
  y = 0,
  z = 0,
  d = 1,
  h = 1,
  cls = "",
  fill = "var(--hw-lip)",
  stroke = "none",
} = {}) {
  return `<polygon class="${cls}" points="${pts([
    [x, y, z],
    [x, y + d, z],
    [x, y + d, z + h],
    [x, y, z + h],
  ])}" fill="${fill}" stroke="${stroke}"/>`;
}

/**
 * Contact shadow under a footprint: a wide soft cast shadow falling to the
 * lower right (away from the light), an ambient-occlusion halo hugging the
 * footprint, and a tight dark contact line where the part meets the floor.
 * strength scales all three (0..1.5).
 */
export function shadow({
  x = 0,
  y = 0,
  z = 0,
  w = 1,
  d = 1,
  spread = 0.35,
  cls = "",
  strength = 1,
} = {}) {
  const s = spread;
  const ao = Math.min(0.16, 0.05 + s * 0.15);
  const k = (v: number) => round(Math.min(1, v * strength));
  return `<g class="iso-contact-group ${cls}">
    <polygon class="iso-contact iso-contact-cast" points="${pts([
      [x - s * 0.15, y + s * 0.15, z],
      [x + w + s * 1.1, y + s * 0.15, z],
      [x + w + s * 1.1, y + d + s * 1.1, z],
      [x - s * 0.15, y + d + s * 1.1, z],
    ])}" fill="var(--iso-shadow)" style="filter: blur(${round(6 + s * 10)}px); opacity: ${k(0.42)}"/>
    <polygon class="iso-contact iso-contact-ao" points="${pts([
      [x - ao, y - ao, z],
      [x + w + ao * 1.6, y - ao, z],
      [x + w + ao * 1.6, y + d + ao * 1.6, z],
      [x - ao, y + d + ao * 1.6, z],
    ])}" fill="var(--iso-contact, var(--iso-shadow))" style="filter: blur(3px); opacity: ${k(0.55)}"/>
    <polygon class="iso-contact iso-contact-core" points="${pts([
      [x + 0.02, y + 0.02, z],
      [x + w + 0.05, y + 0.02, z],
      [x + w + 0.05, y + d + 0.05, z],
      [x + 0.02, y + d + 0.05, z],
    ])}" fill="var(--iso-contact, var(--iso-shadow))" style="filter: blur(1.2px); opacity: ${k(0.75)}"/>
  </g>`;
}

const textAttrs = ({
  anchor,
  size,
  weight,
  fill,
  mono,
  cls,
  kind,
}: {
  anchor: string;
  size: number;
  weight: number;
  fill: string;
  mono: boolean;
  cls: string;
  kind: string;
}) =>
  `class="${kind} ${cls}" text-anchor="${anchor}" dominant-baseline="central" font-size="${size}" font-weight="${weight}" fill="${fill}" font-family="${mono ? "var(--font-mono)" : "var(--font-sans)"}"`;

/**
 * Text lying on a top face, reading along +x. size is in px at UNIT scale.
 * anchor: start | middle | end. engrave: a colour for the light lip under
 * engraved lettering (use the material's `engrave`).
 */
export function topText({
  x = 0,
  y = 0,
  z = 0,
  text = "",
  size = 12,
  anchor = "middle",
  cls = "",
  weight = 700,
  fill = "var(--ink)",
  mono = true,
  engrave,
  halo,
}: TextOptions = {}) {
  const [sx, sy] = project(x, y, z);
  const body = escapeXml(text);
  const a = { anchor, size, weight, mono, cls, kind: "iso-top-text" };
  const lip = engrave
    ? `<text transform="matrix(1 0.5 -1 0.5 ${round(sx)} ${round(sy + 0.9)})" ${textAttrs({ ...a, fill: engrave })} aria-hidden="true">${body}</text>`
    : "";
  const haloStyle = halo
    ? ` style="paint-order: stroke; stroke: ${halo}; stroke-width: ${round(size * 0.16)}px; stroke-linejoin: round"`
    : "";
  return `${lip}<text transform="matrix(1 0.5 -1 0.5 ${round(sx)} ${round(sy)})" ${textAttrs({ ...a, fill })}${haloStyle}>${body}</text>`;
}

/** Text printed on a front face (y = const), upright, reading along +x. */
export function frontText({
  x = 0,
  y = 0,
  z = 0,
  text = "",
  size = 11,
  anchor = "middle",
  cls = "",
  weight = 600,
  fill = "var(--muted)",
  mono = true,
  engrave,
}: TextOptions = {}) {
  const [sx, sy] = project(x, y, z);
  const a = { anchor, size, weight, mono, cls, kind: "iso-front-text" };
  const lip = engrave
    ? `<text transform="matrix(1 0.5 0 1 ${round(sx)} ${round(sy + 0.8)})" ${textAttrs({ ...a, fill: engrave })} aria-hidden="true">${escapeXml(text)}</text>`
    : "";
  return `${lip}<text transform="matrix(1 0.5 0 1 ${round(sx)} ${round(sy)})" ${textAttrs({ ...a, fill })}>${escapeXml(text)}</text>`;
}

/** Text printed on a side face (x = const), upright, reading along +y. */
export function sideText({
  x = 0,
  y = 0,
  z = 0,
  text = "",
  size = 11,
  anchor = "middle",
  cls = "",
  weight = 600,
  fill = "var(--muted)",
  mono = true,
}: TextOptions = {}) {
  const [sx, sy] = project(x, y, z);
  return `<text transform="matrix(1 -0.5 0 1 ${round(sx)} ${round(sy)})" ${textAttrs({ anchor, size, weight, fill, mono, cls, kind: "iso-side-text" })}>${escapeXml(text)}</text>`;
}

/**
 * Minimum label sizes, in px as rendered on screen. Callout text is drawn at
 * LABEL.title / LABEL.sub user units; call labelScale(svg) so it never renders
 * smaller than that when the scene SVG is scaled down. Device text (topText,
 * frontText) scales with the device: give it at least LABEL.device user units
 * and check the rendered scale (stage px / viewBox width) is ≥ 1.
 */
export const LABEL = Object.freeze({ title: 15, sub: 12, device: 11, token: 12 });

/**
 * Screen-space callout: a leader line from a world point to a flat label,
 * like the printed legends on a device. dx/dy offset the label in px. The
 * label grows from where the leader meets it when labelScale() is active.
 */
export function callout({
  x = 0,
  y = 0,
  z = 0,
  dx = 0,
  dy = -40,
  title = "",
  sub = "",
  anchor = "middle",
  cls = "",
} = {}) {
  const [sx, sy] = project(x, y, z);
  const lx = sx + dx;
  const ly = sy + dy;
  const below = dy > 12;
  const foot = below ? ly - LABEL.title * 0.75 : ly + (sub ? LABEL.sub + 13 : 9);
  const subLine = sub
    ? `<text x="${round(lx)}" y="${round(ly + LABEL.title + 2)}" text-anchor="${anchor}" class="iso-callout-sub">${escapeXml(sub)}</text>`
    : "";
  return `<g class="iso-callout ${cls}">
    <line x1="${round(sx)}" y1="${round(sy)}" x2="${round(lx)}" y2="${round(foot)}" class="iso-callout-line"/>
    <circle cx="${round(sx)}" cy="${round(sy)}" r="2.6" class="iso-callout-dot"/>
    <g class="iso-callout-label" style="transform-origin: ${round(lx)}px ${round(foot)}px">
      <text x="${round(lx)}" y="${round(ly)}" text-anchor="${anchor}" class="iso-callout-title">${escapeXml(title)}</text>
      ${subLine}
    </g>
  </g>`;
}

/**
 * Keep callout labels readable when a scene SVG is drawn smaller than 1 px per
 * user unit: sets --iso-label-k on the svg so callout labels scale up to
 * render at ≥ LABEL sizes in CSS px (capped at `max`). Also sets --iso-px (user
 * units per CSS px) for explorer CSS. Returns a function that stops watching.
 */
export function labelScale(svg: SVGSVGElement | null, { max = 2.2, min = 0.75 } = {}): () => void {
  if (!svg || typeof ResizeObserver === "undefined") return () => {};
  const update = () => {
    const vb = svg.viewBox?.baseVal;
    const r = svg.getBoundingClientRect();
    if (!vb || !vb.width || !r.width) return;
    const scale = Math.min(r.width / vb.width, r.height / vb.height);
    const k = Math.min(max, Math.max(min, 1 / scale));
    svg.style.setProperty("--iso-label-k", k.toFixed(3));
    svg.style.setProperty("--iso-px", (1 / scale).toFixed(3));
  };
  update();
  const ro = new ResizeObserver(update);
  ro.observe(svg);
  const mo = new MutationObserver(update);
  mo.observe(svg, { attributes: true, attributeFilter: ["viewBox"] });
  return () => {
    ro.disconnect();
    mo.disconnect();
  };
}

/** A path along the floor (or any z) through world points [[x, y], ...]. */
export function floorPath(
  points: Point[],
  {
    z = 0,
    cls = "",
    dashed = false,
    arrow = true,
    id,
    gap = 0.3,
  }: {
    z?: number;
    cls?: string;
    dashed?: boolean;
    arrow?: boolean;
    id?: string;
    gap?: number;
  } = {},
) {
  // An arrow stops short of the device it points at, so the head never
  // touches or slides under the device's edge.
  if (arrow && gap > 0 && points.length > 1) {
    const [ax, ay, az] = points.at(-2)!;
    const [bx, by, bz] = points.at(-1)!;
    const len = Math.hypot(bx - ax, by - ay);
    if (len > 0) {
      const k = Math.min(gap, len * 0.35) / len;
      points = [...points.slice(0, -1), [bx - (bx - ax) * k, by - (by - ay) * k, bz ?? az]];
    }
  }
  const d = points.map(([x, y, pz], i) => `${i ? "L" : "M"}${pt(x, y, pz ?? z)}`).join(" ");
  return `<path${attrs({ id })} class="iso-path ${dashed ? "is-dashed" : ""} ${cls}" d="${d}"${arrow ? ' marker-end="url(#iso-arrow)"' : ""}/>`;
}

/** Screen path through screen points with rounded (quadratic) corners. */
function filletPath(list: Point[], radius: number) {
  if (list.length < 3 || radius <= 0)
    return list.map(([a, b], i) => `${i ? "L" : "M"}${round(a)},${round(b)}`).join(" ");
  let d = `M${round(list[0][0])},${round(list[0][1])}`;
  for (let i = 1; i < list.length - 1; i++) {
    const [ax, ay] = list[i - 1];
    const [bx, by] = list[i];
    const [cx, cy] = list[i + 1];
    const la = Math.hypot(ax - bx, ay - by);
    const lc = Math.hypot(cx - bx, cy - by);
    const r = Math.min(radius, la / 2, lc / 2);
    if (!la || !lc) continue;
    const p1 = [bx + ((ax - bx) / la) * r, by + ((ay - by) / la) * r];
    const p2 = [bx + ((cx - bx) / lc) * r, by + ((cy - by) / lc) * r];
    d += ` L${round(p1[0])},${round(p1[1])} Q${round(bx)},${round(by)} ${round(p2[0])},${round(p2[1])}`;
  }
  const last = list.at(-1)!;
  return `${d} L${round(last[0])},${round(last[1])}`;
}

/**
 * A cable / bus lying on the floor (or at z) through world points: a raised
 * rounded tube with a lit ridge and a soft floor shadow. active lights it in
 * the accent and runs a pulse along it (CSS; still under reduced motion).
 * width in px; plugs draws metal ferrules at both ends; arrow adds a head at
 * the end; bus: 2–4 draws parallel conductors (a ribbon bus).
 */
export function cable(
  points: Point[],
  {
    z = 0,
    active = false,
    cls = "",
    id,
    width = 6,
    radius = 14,
    plugs = true,
    arrow = false,
    pulse = true,
    bus = 1,
    color,
  }: {
    z?: number;
    active?: boolean;
    cls?: string;
    id?: string;
    width?: number;
    radius?: number;
    plugs?: boolean;
    arrow?: boolean;
    pulse?: boolean;
    bus?: number;
    color?: string;
  } = {},
) {
  if (!points || points.length < 2) return "";
  const screen = points.map(([x, y, pz]) => project(x, y, pz ?? z));
  const lanes = Math.max(1, Math.min(4, bus));
  const laneGap = width * 1.15;
  // Offset each lane perpendicular to its segments (in screen space).
  const offsetLine = (off: number) => {
    if (!off) return screen;
    return screen.map((p, i) => {
      const a = screen[Math.max(0, i - 1)];
      const b = screen[Math.min(screen.length - 1, i + 1)];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      return [p[0] - (dy / len) * off, p[1] + (dx / len) * off];
    });
  };
  const style = color ? ` style="--iso-cable-color: ${color}"` : "";
  let body = "";
  for (let l = 0; l < lanes; l++) {
    const line = offsetLine((l - (lanes - 1) / 2) * laneGap);
    const d = filletPath(line, radius);
    body += `<path class="iso-cable-shadow" d="${d}" transform="translate(1.5 ${round(width * 0.55)})" stroke-width="${round(width + 2)}"/>
      <path class="iso-cable-body" d="${d}" stroke-width="${round(width)}"/>
      <path class="iso-cable-hi" d="${d}" transform="translate(-0.4 ${round(-width * 0.18)})" stroke-width="${round(Math.max(1, width * 0.28))}"/>
      ${pulse ? `<path class="iso-cable-pulse" d="${d}" pathLength="100" stroke-width="${round(width * 0.5)}"/>` : ""}`;
  }
  let ends = "";
  if (plugs) {
    for (const [i, j] of [
      [0, 1],
      [screen.length - 1, screen.length - 2],
    ]) {
      if (arrow && i !== 0) continue;
      const [px, py] = screen[i];
      const [qx, qy] = screen[j];
      const ang = (Math.atan2(qy - py, qx - px) * 180) / Math.PI;
      const L = width * 1.7;
      const H = width * (lanes > 1 ? lanes * 1.15 + 0.4 : 1.55);
      ends += `<g class="iso-cable-plug" transform="translate(${round(px)} ${round(py)}) rotate(${round(ang)})">
        <rect x="0" y="${round(-H / 2)}" width="${round(L)}" height="${round(H)}" rx="${round(Math.min(3, H / 3))}"/>
        <rect class="iso-cable-plug-hi" x="1" y="${round(-H / 2 + 1)}" width="${round(L - 2)}" height="${round(H * 0.3)}" rx="1"/>
      </g>`;
    }
  }
  let head = "";
  if (arrow) {
    const [bx, by] = screen.at(-1)!;
    const [ax, ay] = screen.at(-2)!;
    const ang = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
    const s = width * 1.25 + 4;
    head = `<path class="iso-cable-head" transform="translate(${round(bx)} ${round(by)}) rotate(${round(ang)})" d="M${round(s * 0.35)},0 L${round(-s)},${round(-s * 0.8)} L${round(-s * 0.62)},0 L${round(-s)},${round(s * 0.8)} Z"/>`;
  }
  return `<g${attrs({ id })} class="iso-cable ${active ? "is-active" : ""} ${cls}"${style}>${body}${ends}${head}</g>`;
}

/** Shared <defs>: the arrow head used by floorPath. Put once per scene SVG. */
export function defs() {
  return `<defs>
    <marker id="iso-arrow" viewBox="0 0 12 12" refX="7" refY="6" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
      <path d="M1 1.4 11 6 1 10.6 3.6 6Z" fill="context-stroke" stroke="context-stroke" stroke-width="1" stroke-linejoin="round"/>
    </marker>
  </defs>`;
}

/** A status LED on a top face. */
export function led({
  x = 0,
  y = 0,
  z = 0,
  on = false,
  color = "var(--accent)",
  cls = "",
  size = 1,
} = {}) {
  const [sx, sy] = project(x, y, z);
  return `<g class="iso-led ${on ? "is-on" : ""} ${cls}" style="--led:${color}">
    <ellipse cx="${round(sx)}" cy="${round(sy)}" rx="${round(5 * size)}" ry="${round(2.9 * size)}" class="iso-led-halo"/>
    <ellipse cx="${round(sx)}" cy="${round(sy + 0.6 * size)}" rx="${round(3.2 * size)}" ry="${round(1.9 * size)}" class="iso-led-bezel"/>
    <ellipse cx="${round(sx)}" cy="${round(sy)}" rx="${round(2.7 * size)}" ry="${round(1.6 * size)}" class="iso-led-core"/>
    <ellipse cx="${round(sx - 0.8 * size)}" cy="${round(sy - 0.5 * size)}" rx="${round(0.9 * size)}" ry="${round(0.5 * size)}" class="iso-led-spec"/>
  </g>`;
}

/**
 * A data token: a small coloured block with a glossy bevelled top and its id
 * printed on it. Draw it at the origin and move it with place(), so it can
 * travel.
 */
export function token({
  id = "",
  text = id,
  color = "var(--accent)",
  size = 1.2,
  h = 0.55,
  cls = "",
  sub = "",
  textSize,
}: {
  id?: string;
  text?: string;
  color?: string;
  size?: number;
  h?: number;
  cls?: string;
  sub?: string;
  textSize?: number;
} = {}) {
  const fill = {
    top: `color-mix(in oklch, ${color} 88%, white)`,
    front: `color-mix(in oklch, ${color} 90%, black)`,
    side: `color-mix(in oklch, ${color} 68%, black)`,
    rim: `color-mix(in oklch, ${color} 70%, white)`,
    edge: "rgb(255 255 255 / .75)",
    spec: `color-mix(in oklch, ${color} 50%, white)`,
    overlay: "url(#hw-iso-gloss)",
  };
  const label = String(text);
  // Fit the id on the top face: mono glyphs are ~0.6em wide and the top face
  // runs along x at 1.118 px per px of text.
  const fit = (size * 0.8 * UNIT) / (Math.max(1, label.length) * 0.6 * 1.12);
  const fs = round(textSize ?? Math.max(8, Math.min(14, fit)));
  return `<g class="iso-token ${cls}"${attrs({ "data-token": id })}>
    ${shadow({ x: -size / 2, y: -size / 2, w: size, d: size, spread: 0.2, strength: 0.9 })}
    ${box({ x: -size / 2, y: -size / 2, z: 0, w: size, d: size, h, fill, radius: Math.min(0.22, size * 0.16), stroke: `color-mix(in oklch, ${color} 45%, black)`, strokeWidth: 0.7 })}
    ${topText({ x: 0, y: 0, z: h, text: label, size: fs, fill: "#fff", weight: 800, halo: `color-mix(in oklch, ${color} 55%, black)`, cls: "iso-token-id" })}
    ${sub ? frontText({ x: 0, y: size / 2, z: h / 2, text: sub, size: 9, fill: "rgb(255 255 255 / .92)", weight: 700 }) : ""}
  </g>`;
}

/** Move a token group (or any group drawn at the origin) to a world point. */
export function place(el: Element & ElementCSSInlineStyle, x: number, y: number, z = 0) {
  const [sx, sy] = project(x, y, z);
  el.style.transform = `translate(${round(sx)}px, ${round(sy)}px)`;
}

/** Animate a token group between world points with the Web Animations API. */
export function travel(
  el: Element & ElementCSSInlineStyle,
  route: Point[],
  { duration = 700, easing = "cubic-bezier(.2,.7,.2,1)" } = {},
) {
  const frames = route.map(([x, y, z = 0]) => {
    const [sx, sy] = project(x, y, z);
    return { transform: `translate(${round(sx)}px, ${round(sy)}px)` };
  });
  const last = frames.at(-1)!;
  const animation = el.animate(frames, { duration, easing, fill: "forwards" });
  animation.finished
    .then(() => {
      el.style.transform = last.transform;
      animation.cancel();
    })
    .catch(() => {});
  return animation;
}

/**
 * viewBox that fits world-space bounds [[x, y, z], ...] plus padding (px).
 */
export function fitViewBox(points: Point[], pad = 24) {
  const s = points.map(([x, y, z = 0]) => project(x, y, z));
  const xs = s.map((p) => p[0]);
  const ys = s.map((p) => p[1]);
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  return `${round(minX)} ${round(minY)} ${round(Math.max(...xs) - minX + pad)} ${round(Math.max(...ys) - minY + pad)}`;
}

/**
 * Frame a scene so its devices fill `fill` (≈ 80%) of the stage. points are
 * world points [x, y, z] (device corners incl. their tops, callout anchors);
 * labels: extra screen-space boxes [[x, y, w, h], ...] for callout text, in
 * user units. stageAspect is width / height of the stage, or the stage
 * element. Returns a viewBox string with that exact aspect, centred on the
 * content.
 */
export function fitScene(
  points: Point[],
  {
    stageAspect = 16 / 10,
    fill = 0.82,
    pad = 8,
    labels = [],
  }: {
    stageAspect?: number | Element | null;
    fill?: number;
    pad?: number;
    labels?: number[][];
  } = {},
) {
  const aspect =
    typeof stageAspect === "number"
      ? stageAspect
      : Math.max(0.2, (stageAspect?.clientWidth || 16) / (stageAspect?.clientHeight || 10));
  const s = points.map(([x, y, z = 0]) => project(x, y, z));
  for (const [lx, ly, lw, lh] of labels) s.push([lx, ly], [lx + lw, ly + lh]);
  const xs = s.map((p) => p[0]);
  const ys = s.map((p) => p[1]);
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad;
  let W = (maxX - minX) / fill;
  let H = (maxY - minY) / fill;
  if (W / H < aspect) W = H * aspect;
  else H = W / aspect;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return `${round(cx - W / 2)} ${round(cy - H / 2)} ${round(W)} ${round(H)}`;
}

/** A floor the scene stands on: a fine grid that fades toward its edges. */
/** h (slab height) is accepted for compatibility; the floor is drawn flat. */
export function floor({
  x = 0,
  y = 0,
  w = 10,
  d = 10,
  grid = 1,
  cls = "",
}: {
  x?: number;
  y?: number;
  w?: number;
  d?: number;
  h?: number;
  grid?: number;
  cls?: string;
} = {}) {
  let lines = "";
  const seg = (a: Point, b: Point) => {
    const [x1, y1] = project(a[0], a[1], a[2]).map(round);
    const [x2, y2] = project(b[0], b[1], b[2]).map(round);
    return `x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"`;
  };
  // Every fifth line is a touch stronger, like a cutting mat.
  let i = 0;
  for (let k = grid; k < w; k += grid)
    lines += `<line class="iso-grid${++i % 5 === 0 ? " is-major" : ""}" ${seg([x + k, y, 0], [x + k, y + d, 0])}/>`;
  i = 0;
  for (let k = grid; k < d; k += grid)
    lines += `<line class="iso-grid${++i % 5 === 0 ? " is-major" : ""}" ${seg([x, y + k, 0], [x + w, y + k, 0])}/>`;
  const corners = [
    [x, y],
    [x + w, y],
    [x + w, y + d],
    [x, y + d],
  ]
    .map(([a, b2]) => pt(a, b2, 0))
    .join(" ");
  return `<g class="iso-floor ${cls}" mask="url(#hw-iso-floor-fade)">
    <polygon class="iso-floor-face" points="${corners}"/>
    <g class="iso-floor-grid">${lines}</g>
  </g>`;
}

/* ---------------------------------------------------------------------------
   Parts used inside devices.
--------------------------------------------------------------------------- */

/**
 * A rectangular recess cut into a top face at height z: you see its floor and
 * the back (y = y) and left (x = x) inner walls, clipped to the opening, with
 * a lit lip along the front and right edges.
 */
export function pocket({
  x = 0,
  y = 0,
  z = 0,
  w = 1,
  d = 1,
  depth = 0.25,
  floor: floorFill = "var(--iso-metal-pocket)",
  wall = "var(--iso-metal-pocket-wall)",
  lip = "var(--iso-metal-edge)",
  cls = "",
  attrs: extra = {},
}: Footprint & {
  depth?: number;
  floor?: string;
  wall?: string;
  lip?: string;
  attrs?: Record<string, unknown>;
} = {}) {
  const id = `hwp${++gradientSeq}`;
  const open = pts([
    [x, y, z],
    [x + w, y, z],
    [x + w, y + d, z],
    [x, y + d, z],
  ]);
  const fz = z - depth;
  return `<g class="iso-pocket ${cls}"${attrs(extra)}>
    <clipPath id="${id}"><polygon points="${open}"/></clipPath>
    <g clip-path="url(#${id})">
      <polygon points="${open}" fill="${wall}"/>
      ${quad({ x, y, z: fz, w, d, fill: floorFill, cls: "iso-pocket-floor" })}
      ${frontQuad({ x, y, z: fz, w, h: depth, fill: `color-mix(in oklch, ${wall} 72%, white)` })}
      ${sideQuad({ x, y, z: fz, d, h: depth, fill: wall })}
      <polyline points="${pts([
        [x, y + d, fz],
        [x, y, fz],
        [x + w, y, fz],
      ])}" fill="none" stroke="rgb(0 0 0 / .28)" stroke-width="2.4" style="filter: blur(1.2px)"/>
    </g>
    <polyline points="${pts([
      [x, y + d, z],
      [x, y, z],
      [x + w, y, z],
    ])}" fill="none" stroke="rgb(0 0 0 / .35)" stroke-width=".8"/>
    <polyline points="${pts([
      [x + w, y, z],
      [x + w, y + d, z],
      [x, y + d, z],
    ])}" fill="none" stroke="${lip}" stroke-width="1.1" stroke-linejoin="round"/>
  </g>`;
}

/** Gold contacts along an edge: n fingers on the front (+y) face. */
function goldFingers({
  x,
  y,
  z,
  w,
  h,
  n,
  notch,
}: {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  n: number;
  notch?: number;
}) {
  let out = "";
  const pitch = w / n;
  for (let i = 0; i < n; i++) {
    if (notch !== undefined && Math.abs(i - notch) < 0.6) continue;
    out += frontQuad({
      x: x + i * pitch + pitch * 0.18,
      y,
      z,
      w: pitch * 0.64,
      h,
      fill: "url(#hw-iso-gold-v) var(--iso-gold)",
    });
  }
  return out;
}

/* ---------------------------------------------------------------------------
   Devices. Each takes a world position (x, y, z) of its back-left-bottom
   corner and returns { svg, top, slots } where `top` is the z of its upper
   surface and `slots` are world points where tokens can sit.
--------------------------------------------------------------------------- */

/**
 * CPU: a green-black substrate with copper traces, gold pads and edge pins,
 * SMD capacitors, a pin-1 mark, and a brushed-aluminium heat spreader (IHS)
 * with a chamfered flange and an engraved label. slots[0] is the IHS centre.
 */
export function chip({ x = 0, y = 0, z = 0, size = 4, label = "CPU", sub = "", cls = "" } = {}) {
  const s = size;
  const subH = 0.24;
  const f = Math.max(0.55, s * 0.17); // flange inset
  const g = f + Math.max(0.12, s * 0.035); // IHS inset
  const zt = z + subH;
  let pads = "";
  let traces = "";
  const n = Math.max(5, Math.round(s * 2.6));
  const padW = Math.min(0.13, s * 0.03);
  const padL = Math.min(0.24, f * 0.34);
  for (let i = 0; i < n; i++) {
    const p = 0.35 + (i * (s - 0.7)) / (n - 1);
    // Pads on all four margins of the substrate top.
    for (const [px, py, pw, pd] of [
      [x + p - padW / 2, y + 0.09, padW, padL],
      [x + p - padW / 2, y + s - 0.09 - padL, padW, padL],
      [x + 0.09, y + p - padW / 2, padL, padW],
      [x + s - 0.09 - padL, y + p - padW / 2, padL, padW],
    ])
      pads += quad({
        x: px,
        y: py,
        z: zt + 0.002,
        w: pw,
        d: pd,
        fill: "url(#hw-iso-gold) var(--iso-gold)",
      });
    // Traces fan in from the pads toward the flange, with a via on every other.
    const t0 = 0.09 + padL;
    const t1 = f - 0.04;
    const via = i % 2 === 0;
    for (const [a, b] of [
      [
        [x + p, y + t0],
        [x + p, y + t1],
      ],
      [
        [x + p, y + s - t0],
        [x + p, y + s - t1],
      ],
      [
        [x + t0, y + p],
        [x + t1, y + p],
      ],
      [
        [x + s - t0, y + p],
        [x + s - t1, y + p],
      ],
    ]) {
      const bend = 0.45;
      const mid = [a[0] + (b[0] - a[0]) * bend, a[1] + (b[1] - a[1]) * bend];
      const off = ((i % 3) - 1) * 0.08;
      const shifted = a[0] === b[0] ? [b[0] + off, b[1]] : [b[0], b[1] + off];
      traces += `<polyline class="iso-trace" points="${pts([
        [...a, zt + 0.003],
        [...mid, zt + 0.003],
        [...shifted, zt + 0.003],
      ])}"/>`;
      if (via) {
        const [vx, vy] = project(mid[0], mid[1], zt + 0.003);
        traces += `<ellipse class="iso-via" cx="${round(vx)}" cy="${round(vy)}" rx="1.3" ry=".75"/>`;
      }
    }
  }
  // Gold edge pins on the two visible vertical faces.
  let pins = "";
  for (let i = 0; i < n; i++) {
    const p = 0.35 + (i * (s - 0.7)) / (n - 1);
    pins += frontQuad({
      x: x + p - 0.05,
      y: y + s + 0.001,
      z: z + 0.04,
      w: 0.1,
      h: subH - 0.08,
      fill: "url(#hw-iso-gold-v) var(--iso-gold)",
    });
    pins += sideQuad({
      x: x + s + 0.001,
      y: y + p - 0.05,
      z: z + 0.04,
      d: 0.1,
      h: subH - 0.08,
      fill: "var(--iso-gold-lo)",
    });
  }
  // SMD capacitors in the margin between the pad ring and the flange.
  let caps = "";
  const cz = zt;
  const capAt = (cx: number, cy: number, alongX: boolean) => {
    const cw = alongX ? 0.26 : 0.12;
    const cd = alongX ? 0.12 : 0.26;
    return (
      box({
        x: cx,
        y: cy,
        z: cz,
        w: cw,
        d: cd,
        h: 0.07,
        fill: {
          top: "#b49a74",
          front: "#8c7556",
          side: "#6e5b42",
          line: "#3a2f22",
          edge: "rgb(255 255 255 / .4)",
        },
        radius: 0,
        bevel: false,
        strokeWidth: 0.4,
      }) +
      quad({
        x: cx,
        y: cy,
        z: cz + 0.071,
        w: alongX ? 0.06 : cw,
        d: alongX ? cd : 0.06,
        fill: "var(--iso-gold-hi)",
      }) +
      quad({
        x: alongX ? cx + cw - 0.06 : cx,
        y: alongX ? cy : cy + cd - 0.06,
        z: cz + 0.071,
        w: alongX ? 0.06 : cw,
        d: alongX ? cd : 0.06,
        fill: "var(--iso-gold-hi)",
      })
    );
  };
  const cm = (0.09 + padL + f) / 2 - 0.06;
  for (const k of [0.22, 0.3, 0.7, 0.78]) {
    caps += capAt(x + s * k, y + cm, true);
    caps += capAt(x + cm, y + s * k, false);
  }
  for (const k of [0.25, 0.75]) {
    caps += capAt(x + s * k, y + s - cm - 0.12, true);
    caps += capAt(x + s - cm - 0.12, y + s * k, false);
  }
  const flangeH = 0.1;
  const ihsH = 0.41;
  const top = z + subH + flangeH + ihsH;
  const inner = s - 2 * g;
  const fs = round(Math.max(12, Math.min(30, inner * 5.2)));
  // Label and sub sit on two lines across the reading direction (+y on the top face).
  const subSize = round(Math.max(12, fs * 0.42));
  const tri = pts([
    [x + 0.14, y + s - 0.14, zt + 0.003],
    [x + 0.5, y + s - 0.14, zt + 0.003],
    [x + 0.14, y + s - 0.5, zt + 0.003],
  ]);
  const svg = `<g class="iso-device iso-chip ${cls}">
    ${shadow({ x, y, w: s, d: s, spread: 0.45 })}
    ${box({ x, y, z, w: s, d: s, h: subH, fill: MAT.pcb, radius: 0.14 })}
    ${pins}
    <g class="iso-traces">${traces}</g>
    ${pads}
    <polygon points="${tri}" fill="var(--iso-gold)"/>
    ${caps}
    ${box({ x: x + f, y: y + f, z: zt, w: s - 2 * f, d: s - 2 * f, h: flangeH, fill: MAT.metal, radius: 0.16 })}
    ${shadow({ x: x + g, y: y + g, z: zt + flangeH, w: inner, d: inner, spread: 0.1, strength: 0.4 })}
    ${box({ x: x + g, y: y + g, z: zt + flangeH, w: inner, d: inner, h: ihsH, fill: MAT.metal, radius: 0.24 })}
    ${label ? topText({ x: x + s / 2, y: y + s / 2 - (sub ? (subSize * 0.6 + 1) / UNIT : 0), z: top, text: label, size: fs, weight: 800, fill: MAT.metal.ink, engrave: MAT.metal.engrave }) : ""}
    ${sub ? topText({ x: x + s / 2, y: y + s / 2 + (fs * 0.6 + 1) / UNIT, z: top, text: sub, size: subSize, weight: 700, fill: MAT.metal.ink, engrave: MAT.metal.engrave }) : ""}
  </g>`;
  return { svg, top, slots: [[x + s / 2, y + s / 2, top]] };
}

/**
 * RAM stick standing in a DIMM slot: a graphite slot with white latches, a
 * green PCB with black memory chips, gold edge fingers with a key notch and a
 * silkscreened label. chipsAt: the front-face centre of each chip ([x, y, z])
 * for printing frame contents; slots stays [] (put frames on the chips or a
 * tableModule).
 */
export function ramStick({
  x = 0,
  y = 0,
  z = 0,
  length = 6,
  label = "RAM",
  chips = 4,
  cls = "",
} = {}) {
  const t = 0.35;
  const hgt = 1.6;
  const base = 0.45;
  const by = y + 0.6;
  const fy = by + t; // board front face
  const bx = x + 0.3;
  const bw = length - 0.6;
  let ics = "";
  const chipsAt: Point[] = [];
  const cw = (bw - 0.4) / chips;
  for (let i = 0; i < chips; i++) {
    const cx = bx + 0.2 + i * cw + 0.1;
    ics += box({
      x: cx,
      y: fy,
      z: z + base + 0.6,
      w: cw - 0.2,
      d: 0.1,
      h: 0.82,
      fill: MAT.ic,
      radius: 0,
      bevel: false,
      strokeWidth: 0.5,
    });
    const [dx, dy] = project(cx + 0.14, fy + 0.1, z + base + 1.28);
    ics += `<circle cx="${round(dx)}" cy="${round(dy)}" r="1.1" fill="var(--iso-ic-ink)" opacity=".6"/>`;
    chipsAt.push([cx + (cw - 0.2) / 2, fy + 0.1, z + base + 0.6 + 0.41]);
  }
  const latch = (lx: number) =>
    box({
      x: lx,
      y: y + 0.3,
      z,
      w: 0.3,
      d: 1.0,
      h: base + 0.55,
      fill: MAT.plastic,
      radius: 0.06,
      strokeWidth: 0.6,
    });
  const svg = `<g class="iso-device iso-ram ${cls}">
    ${shadow({ x, y, w: length, d: 1.6, spread: 0.4 })}
    ${box({ x, y, z, w: length, d: 1.6, h: base, fill: MAT.graphite, radius: 0.12 })}
    ${quad({ x: x + 0.25, y: by - 0.05, z: z + base + 0.001, w: length - 0.5, d: t + 0.1, fill: "#0c0c0d" })}
    ${latch(x - 0.05)}
    ${box({ x: bx, y: by, z: z + base, w: bw, d: t, h: hgt, fill: MAT.pcb, radius: 0.03, bevel: false, strokeWidth: 0.6 })}
    ${goldFingers({ x: bx + 0.1, y: fy + 0.001, z: z + base + 0.02, w: bw - 0.2, h: 0.2, n: Math.round(bw * 7), notch: Math.round(bw * 7 * 0.42) })}
    ${frontQuad({ x: bx, y: fy + 0.0015, z: z + base + 0.24, w: bw, h: 0.012, fill: "var(--iso-pcb-trace)" })}
    ${ics}
    ${label ? frontText({ x: bx + 0.25, y: fy + 0.002, z: z + base + 0.32, text: label, size: 11, anchor: "start", fill: MAT.pcb.ink, weight: 700 }) : ""}
    ${latch(x + length - 0.25)}
  </g>`;
  return { svg, top: z + base + hgt, slots: [], chipsAt };
}

/**
 * SSD: a graphite 2.5" casing with a printed sticker, corner screws and a gold
 * SATA connector on the front edge. slots[0] is the sticker centre.
 */
export function ssd({ x = 0, y = 0, z = 0, w = 5, d = 3, label = "SSD", cls = "" } = {}) {
  const h = 0.42;
  const top = z + h;
  let teeth = "";
  const tn = Math.max(6, Math.round(w * 1.6));
  for (let i = 0; i < tn; i++)
    teeth += frontQuad({
      x: x + w - 0.35 - tn * 0.16 + i * 0.16,
      y: y + d + 0.001,
      z: z + 0.1,
      w: 0.09,
      h: 0.18,
      fill: "url(#hw-iso-gold-v) var(--iso-gold)",
    });
  const screws = [
    [0.28, 0.28],
    [w - 0.28, 0.28],
    [w - 0.28, d - 0.28],
    [0.28, d - 0.28],
  ]
    .map(([sx, sy]) => {
      const [a, b2] = project(x + sx, y + sy, top);
      return `<ellipse cx="${round(a)}" cy="${round(b2)}" rx="2.6" ry="1.5" class="iso-screw iso-screw-dark"/>`;
    })
    .join("");
  const svg = `<g class="iso-device iso-ssd ${cls}">
    ${shadow({ x, y, w, d, spread: 0.45 })}
    ${box({ x, y, z, w, d, h, fill: MAT.graphite, radius: 0.2 })}
    ${frontQuad({ x: x + w - 0.45 - tn * 0.16, y: y + d + 0.0005, z: z + 0.06, w: tn * 0.16 + 0.1, h: 0.26, fill: "#0b0b0c" })}
    ${teeth}
    ${screws}
    ${quad({ x: x + 0.55, y: y + 0.5, z: top + 0.001, w: w - 1.1, d: d - 1.0, fill: "var(--iso-sticker)", stroke: "rgb(0 0 0 / .25)", strokeWidth: 0.5 })}
    ${quad({ x: x + 0.55, y: y + 0.5, z: top + 0.002, w: 0.16, d: d - 1.0, fill: "var(--accent)" })}
    ${label ? topText({ x: x + w / 2 + 0.15, y: y + d / 2, z: top + 0.003, text: label, size: 14, weight: 800, fill: "var(--iso-sticker-ink)" }) : ""}
  </g>`;
  return { svg, top, slots: [[x + w / 2, y + d / 2, top]] };
}

/** Server / database: stacked units with drive bays and LEDs. */
export function server({
  x = 0,
  y = 0,
  z = 0,
  w = 4,
  d = 4,
  units = 3,
  label = "DB",
  cls = "",
  lit = 0,
} = {}) {
  const uh = 0.75;
  let body = "";
  for (let i = 0; i < units; i++) {
    const uz = z + i * uh;
    body += box({ x, y, z: uz, w, d, h: uh - 0.05 });
    // Drive bays: a dark slot with a light pull tab, then a vent grille.
    const bays = Math.max(2, Math.floor((w - 1.2) / 0.9));
    for (let b = 0; b < bays; b++) {
      const bx = x + 0.3 + b * 0.9;
      body += frontQuad({
        x: bx,
        y: y + d,
        z: uz + 0.17,
        w: 0.72,
        h: 0.34,
        fill: "var(--iso-graphite-front)",
      });
      body += frontQuad({
        x: bx + 0.06,
        y: y + d,
        z: uz + 0.22,
        w: 0.18,
        h: 0.24,
        fill: "var(--iso-metal-front)",
      });
    }
    for (let v = 0; v < 4; v++)
      body += frontQuad({
        x: x + 0.3 + bays * 0.9 + v * 0.12,
        y: y + d,
        z: uz + 0.2,
        w: 0.05,
        h: 0.28,
        fill: "var(--iso-graphite-side)",
      });
    const [lx, ly] = project(x + w - 0.45, y + d, uz + 0.36);
    body += `<circle cx="${round(lx)}" cy="${round(ly)}" r="2.2" class="iso-unit-led ${i < lit ? "is-on" : ""}"/>`;
  }
  const svg = `<g class="iso-device iso-server ${cls}">
    ${shadow({ x, y, w, d, spread: 0.6 })}
    ${body}
    ${topText({ x: x + w / 2, y: y + d / 2, z: z + units * uh - 0.05, text: label, size: 16, weight: 800, fill: "var(--ink)" })}
  </g>`;
  return {
    svg,
    top: z + units * uh - 0.05,
    slots: [[x + w / 2, y + d / 2, z + units * uh - 0.05]],
  };
}

/** Rows of key caps inside a keyboard well. */
function keyboard({ x, y, z, w, d }: { x: number; y: number; z: number; w: number; d: number }) {
  const rows = 4;
  const cols = Math.max(6, Math.round(w / 0.3));
  const gx = w / cols;
  const gy = d / rows;
  let keys = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // The bottom row has a long space bar in the middle.
      if (r === rows - 1 && c > cols * 0.3 && c < cols * 0.7) continue;
      keys += quad({
        x: x + c * gx + gx * 0.14,
        y: y + r * gy + gy * 0.16,
        z,
        w: gx * 0.72,
        d: gy * 0.68,
        fill: "var(--iso-key, var(--iso-top-fill))",
      });
    }
  }
  const r = rows - 1;
  keys += quad({
    x: x + cols * 0.3 * gx + gx,
    y: y + r * gy + gy * 0.16,
    z,
    w: (cols * 0.4 - 1) * gx,
    d: gy * 0.68,
    fill: "var(--iso-key, var(--iso-top-fill))",
  });
  return `<g class="iso-keys">${keys}</g>`;
}

/** Laptop: base with keyboard well and an open screen. */
export function laptop({
  x = 0,
  y = 0,
  z = 0,
  w = 4,
  d = 3,
  label = "",
  cls = "",
  screen = "",
} = {}) {
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
      <polygon class="iso-hinge" points="${pts([
        [x + 0.3, y + 0.02, z + 0.22],
        [x + w - 0.3, y + 0.02, z + 0.22],
        [x + w - 0.3, y + 0.02, z + 0.3],
        [x + 0.3, y + 0.02, z + 0.3],
      ])}"/>
      ${screen ? frontText({ x: x + w / 2, y: y - 0.05, z: z + 0.22 + sh / 2, text: screen, size: 11, fill: "var(--hw-lcd-ink)" }) : ""}
    </g>
    ${label ? frontText({ x: x + w / 2, y: y + d, z: z + 0.11, text: label, size: 7, fill: "var(--muted)" }) : ""}
  </g>`;
  return { svg, top: z + 0.22, slots: [[x + w / 2, y + d * 0.75, z + 0.22]] };
}

/**
 * A vertical cylinder (disc, hub, knob): top ellipse plus the lit band of its
 * wall. fill: { top, wall } colours or gradients.
 */
export function cylinder({
  cx = 0,
  cy = 0,
  z = 0,
  r = 1,
  h = 0.2,
  fill = {},
  cls = "",
  stroke = "var(--iso-line)",
}: {
  cx?: number;
  cy?: number;
  z?: number;
  r?: number;
  h?: number;
  fill?: { top?: string; wall?: string; front?: string; side?: string };
  cls?: string;
  stroke?: string;
} = {}) {
  const [px, pyTop] = project(cx, cy, z + h);
  const pyBottom = project(cx, cy, z)[1];
  const rx = r * UNIT * Math.SQRT2;
  const ry = rx / 2;
  const id = `hwc${++gradientSeq}`;
  const wall = fill.wall ?? `url(#${id})`;
  const band = `M${round(px - rx)},${round(pyTop)} L${round(px - rx)},${round(pyBottom)} A${round(rx)},${round(ry)} 0 0 0 ${round(px + rx)},${round(pyBottom)} L${round(px + rx)},${round(pyTop)} Z`;
  const front = fill.front ?? "var(--iso-front)";
  const side = fill.side ?? "var(--iso-side)";
  return `<g class="iso-cylinder ${cls}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" style="stop-color: color-mix(in oklch, ${front} 92%, white)"/>
      <stop offset=".42" style="stop-color: ${front}"/>
      <stop offset=".62" style="stop-color: var(--iso-spec, white)"/>
      <stop offset=".78" style="stop-color: ${side}"/>
      <stop offset="1" style="stop-color: color-mix(in oklch, ${side} 88%, black)"/>
    </linearGradient></defs>
    <path d="${band}" fill="${wall}" stroke="${stroke}" stroke-width=".6" stroke-opacity=".5"/>
    <ellipse cx="${round(px)}" cy="${round(pyTop)}" rx="${round(rx)}" ry="${round(ry)}" fill="${fill.top ?? "var(--iso-top-fill)"}" stroke="${stroke}" stroke-width=".6" stroke-opacity=".5"/>
  </g>`;
}

/**
 * Hard disk: a cast-aluminium chassis with a round cavity, a thick mirror
 * platter with data tracks, a raised spindle hub with screws, and corner
 * screws on the lid. The actuator arm belongs to the explorer that animates
 * it; `center` is the platter top, `top` the chassis top.
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
  const rxOf = (k: number) => r * k * UNIT * Math.SQRT2;
  const tracks = [0.97, 0.88, 0.79, 0.7, 0.61, 0.52, 0.43, 0.36]
    .map(
      (k) =>
        `<ellipse cx="${round(px)}" cy="${round(py)}" rx="${round(rxOf(k))}" ry="${round(rxOf(k) / 2)}" class="iso-platter-ring"/>`,
    )
    .join("");
  const [wx, wy] = project(cx, cy, top);
  const cavity = r * 1.08 * UNIT * Math.SQRT2;
  const screws = [
    [0.35, 0.35],
    [w - 0.35, 0.35],
    [w - 0.35, d - 0.35],
    [0.35, d - 0.35],
  ]
    .map(([sx, sy]) => {
      const [a, b2] = project(x + sx, y + sy, top);
      return `<ellipse cx="${round(a)}" cy="${round(b2)}" rx="3.4" ry="1.9" class="iso-screw"/><line x1="${round(a - 2)}" y1="${round(b2 - 0.6)}" x2="${round(a + 2)}" y2="${round(b2 + 0.6)}" class="iso-screw-slot"/>`;
    })
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
    ${box({ x, y, z, w, d, h: H, radius: 0.5, fill: MAT.metal })}
    ${screws}
    <ellipse cx="${round(wx)}" cy="${round(wy)}" rx="${round(cavity)}" ry="${round(cavity / 2)}" class="iso-cavity"/>
    <ellipse cx="${round(wx)}" cy="${round(wy + 3)}" rx="${round(cavity - 3)}" ry="${round(cavity / 2 - 3)}" class="iso-cavity-floor"/>
    ${cylinder({ cx, cy, z: platterZ, r, h: 0.16, fill: { top: "url(#hw-platter)" } })}
    ${tracks}
    ${cylinder({ cx, cy, z: platterTop, r: r * 0.2, h: 0.22, fill: { top: "url(#hw-iso-metal) var(--iso-metal-top)", front: "var(--iso-metal-front)", side: "var(--iso-metal-side)" } })}
    ${cylinder({ cx, cy, z: platterTop + 0.22, r: r * 0.08, h: 0.06, fill: { top: "var(--iso-metal-side)" } })}
  </g>`;
  return { svg, top, center: [cx, cy, platterTop], radius: r, slots: [] };
}

/**
 * A recessed socket on a top face: a slightly darker floor with shaded back
 * and left walls, so an empty slot reads as a pocket a token drops into, not
 * as a grey placeholder square.
 */
/** depth is accepted for compatibility; the recess is drawn at a fixed depth. */
export function socket({
  x = 0,
  y = 0,
  z = 0,
  w = 1,
  d = 1,
  cls = "",
}: {
  x?: number;
  y?: number;
  z?: number;
  w?: number;
  d?: number;
  depth?: number;
  cls?: string;
} = {}) {
  const t = z + 0.002;
  const wall = Math.min(0.14, w * 0.12, d * 0.12);
  return `<g class="iso-socket ${cls}">
    ${quad({ x, y, z: t, w, d, fill: "var(--iso-socket, color-mix(in srgb, var(--hw-lip) 75%, var(--iso-front)))" })}
    ${quad({ x, y, z: t + 0.001, w, d: wall, fill: "var(--iso-socket-wall, color-mix(in srgb, var(--hw-lip) 55%, var(--iso-side)))" })}
    ${quad({ x, y, z: t + 0.001, w: wall, d, fill: "var(--iso-socket-wall, color-mix(in srgb, var(--hw-lip) 55%, var(--iso-side)))" })}
    <polyline points="${pts([
      [x, y + d, t],
      [x + w, y + d, t],
      [x + w, y, t],
    ])}" fill="none" stroke="var(--iso-socket-lip, rgb(255 255 255 / .6))" stroke-width="1" stroke-linejoin="round"/>
  </g>`;
}

/** A generic cabinet / module with a recessed screen on top. mat: a MAT.* */
export function module({
  x = 0,
  y = 0,
  z = 0,
  w = 4,
  d = 3,
  h = 0.9,
  label = "",
  sub = "",
  cls = "",
  well = true,
  mat = MAT.plastic,
}: Footprint & { label?: string; sub?: string; well?: boolean; mat?: Material } = {}) {
  const svg = `<g class="iso-device iso-module ${cls}">
    ${shadow({ x, y, w, d, spread: 0.5 })}
    ${box({ x, y, z, w, d, h, fill: mat })}
    ${well ? socket({ x: x + 0.3, y: y + 0.3, z: z + h, w: w - 0.6, d: d - 0.6 }) : ""}
    ${label ? frontText({ x: x + w / 2, y: y + d, z: z + h * 0.62, text: label, size: 12, fill: mat.ink ?? "var(--ink)", weight: 700 }) : ""}
    ${sub ? frontText({ x: x + w / 2, y: y + d, z: z + h * 0.28, text: sub, size: 8, fill: "var(--muted)", weight: 500 }) : ""}
  </g>`;
  return { svg, top: z + h, slots: [[x + w / 2, y + d / 2, z + h]] };
}

/**
 * A machined tray for queues: a brushed-aluminium block with one pocket per
 * slot and dividers between them. Each slot has its number and an occupancy
 * LED printed on the face below it (front face for axis "x", right face for
 * "y"), where a token in the pocket never hides them. The label is printed on
 * a plain nameplate at the tail; an accent arrow marks the exit (head).
 *
 * slots: number of pockets; pitch: world units per slot; axis "x" (default,
 * runs to the lower right) or "y" (runs to the lower left); start: first slot
 * number; exit: "end" | "start" marks that end as the head of the queue; mat:
 * body material. Returns slots (pocket floor centres, where a token sits),
 * leds (face points), head (index of the exit slot), w, d (footprint).
 * Light a slot's LED with `.iso-tray-led[data-slot="i"]` + `.is-on`.
 */
export function tray({
  x = 0,
  y = 0,
  z = 0,
  slots = 4,
  pitch = 1.6,
  d = 2.3,
  h = 0.62,
  axis = "x",
  start = 1,
  label = "",
  sub = "",
  exit,
  numbers = true,
  leds = true,
  mat = MAT.metal,
  cls = "",
}: TrayOptions = {}): Tray {
  const back = 0.3;
  const front = 0.36;
  const div = 0.2;
  const depth = 0.34;
  const headM = exit ? 0.8 : 0.35;
  const tailM = label ? Math.max(1.2, label.length * 0.36 + 0.5, sub.length * 0.3 + 0.5) : 0.35;
  const m0 = exit === "start" ? headM : tailM;
  const m1 = exit === "start" ? tailM : headM;
  const len = m0 + m1 + slots * pitch - div;
  const X = axis === "x";
  const W = X ? len : d;
  const D = X ? d : len;
  const top = z + h;
  const graphite = mat === MAT.graphite;
  const pocketFloor = graphite ? "var(--iso-graphite-pocket)" : "var(--iso-metal-pocket)";
  const pocketWall = graphite
    ? "color-mix(in oklch, var(--iso-graphite-pocket) 80%, black)"
    : "var(--iso-metal-pocket-wall)";
  // A point at distance u along the tray and v across it (0 = back).
  const P = (u: number, v: number): Point => (X ? [x + u, y + v] : [x + v, y + u]);
  let pockets = "";
  let marks = "";
  const slotPts: Point[] = [];
  const ledPts: Point[] = [];
  const pw = pitch - div;
  const pd = d - back - front;
  for (let i = 0; i < slots; i++) {
    const u = m0 + i * pitch;
    const [px, py] = P(u, back);
    const r = X ? { x: px, y: py, w: pw, d: pd } : { x: px, y: py, w: pd, d: pw };
    pockets += pocket({
      ...r,
      z: top,
      depth,
      floor: pocketFloor,
      wall: pocketWall,
      lip: mat.edge,
      attrs: { "data-slot": i },
    });
    slotPts.push([r.x + r.w / 2, r.y + r.d / 2, top - depth + 0.01]);
    const c = u + pw / 2;
    const num = String(start + i).padStart(2, "0");
    const zf = z + h * 0.5;
    if (numbers) {
      marks += X
        ? frontText({
            x: x + c - 0.1,
            y: y + d + 0.002,
            z: zf,
            text: num,
            size: 12,
            weight: 700,
            fill: mat.ink,
            engrave: mat.engrave,
            anchor: "end",
            cls: "iso-tray-num",
          })
        : sideText({
            x: x + d + 0.002,
            y: y + c,
            z: zf,
            text: num,
            size: 12,
            weight: 700,
            fill: mat.ink,
            anchor: "middle",
            cls: "iso-tray-num",
          });
    }
    const lp = X ? [x + c + 0.22, y + d + 0.002, zf] : [x + d + 0.002, y + c + 0.22, zf];
    if (leds) {
      const [lx, ly] = project(lp[0], lp[1], lp[2]);
      marks += `<g class="iso-led iso-tray-led" data-slot="${i}" style="--led: var(--accent)">
        <circle cx="${round(lx)}" cy="${round(ly)}" r="4.6" class="iso-led-halo"/>
        <circle cx="${round(lx)}" cy="${round(ly + 0.5)}" r="2.9" class="iso-led-bezel"/>
        <circle cx="${round(lx)}" cy="${round(ly)}" r="2.3" class="iso-led-core"/>
        <circle cx="${round(lx - 0.7)}" cy="${round(ly - 0.8)}" r=".7" class="iso-led-spec"/>
      </g>`;
    }
    ledPts.push(lp);
  }
  // Exit: an accent arrow on the top of the head margin, pointing out.
  let exitMark = "";
  let head: number | undefined;
  if (exit) {
    head = exit === "start" ? 0 : slots - 1;
    const atEnd = exit !== "start";
    const u = atEnd ? len - headM / 2 + 0.04 : headM / 2 - 0.04;
    const v = back + pd / 2;
    const k = atEnd ? 1 : -1;
    const tri = [
      [u + 0.2 * k, v],
      [u - 0.16 * k, v - 0.3],
      [u - 0.16 * k, v + 0.3],
    ].map(([a2, b2]) => [...P(a2, b2), top + 0.002]);
    exitMark = `<polygon class="iso-tray-exit" points="${pts(tri)}"/>`;
  }
  let plate = "";
  if (label) {
    const u0 = exit === "start" ? len - tailM : 0;
    const cU = u0 + tailM / 2;
    const zf = z + h * 0.5;
    const [tx, ty] = P(cU, back + pd / 2);
    // The label is engraved on the nameplate top; the sub is printed on the face below.
    plate =
      topText({
        x: tx,
        y: ty,
        z: top,
        text: label,
        size: 12,
        weight: 800,
        fill: mat.ink,
        engrave: mat.engrave,
        ...(X ? {} : { size: 11 }),
      }) +
      (sub
        ? X
          ? frontText({
              x: x + cU,
              y: y + d + 0.002,
              z: zf,
              text: sub,
              size: 12,
              weight: 600,
              fill: mat.ink,
            })
          : sideText({
              x: x + d + 0.002,
              y: y + cU,
              z: zf,
              text: sub,
              size: 12,
              weight: 600,
              fill: mat.ink,
            })
        : "");
  }
  const svg = `<g class="iso-device iso-tray ${cls}">
    ${shadow({ x, y, w: W, d: D, spread: 0.5 })}
    ${box({ x, y, z, w: W, d: D, h, fill: mat, radius: 0.18 })}
    ${pockets}
    ${marks}
    ${exitMark}
    ${plate}
  </g>`;
  const pocketSize = X ? { w: pw, d: pd, depth } : { w: pd, d: pw, depth };
  return { svg, top, slots: slotPts, leds: ledPts, head, w: W, d: D, pocket: pocketSize };
}

/**
 * The screen area a token resting in a pocket can show: the opening and all
 * above it (the rim and the tray front hide the rest). Points are local to the
 * slot point (Tray.slots), so one clip path serves every pocket of a tray;
 * set it on the token inside the translated group.
 */
/** A <clipPath> holding wellClip(), for an svg's defs. */
export function wellDef(id: string, size: { w: number; d: number; depth: number }) {
  return `<clipPath id="${id}"><polygon points="${wellClip(size)}"/></clipPath>`;
}

export function wellClip({ w, d, depth }: { w: number; d: number; depth: number }) {
  const z = depth - 0.01;
  const up = z + 40;
  const corners: Point[] = [
    [-w / 2, d / 2, z],
    [w / 2, d / 2, z],
    [w / 2, -d / 2, z],
    [w / 2, -d / 2, up],
    [-w / 2, -d / 2, up],
    [-w / 2, d / 2, up],
  ];
  return pts(corners);
}

/**
 * A queue rail: a long machined tray with an OUT arrow at its head and an IN
 * mark at its tail, so the order of the queue reads at a glance. Same options
 * and return value as tray(); exit defaults to "start" (the first slot is the
 * head of the queue).
 */
export function queueRail({ exit = "start", d = 2.1, ...o }: TrayOptions = {}): Tray {
  const t = tray({ ...o, d, exit });
  return t;
}

/**
 * A table module for page tables and indexes: a white panel with a dark glass
 * window of rows × cols cells and a status LED per row on the left rim.
 * Cells are `.iso-cell[data-row][data-col]` (add `.is-on` / `.is-hot` to light
 * them); row LEDs are `.iso-row-led[data-row]`. Returns cells[r][c] (world
 * centres on the glass, for topText or tokens), rowLeds, slots (flat cells).
 * Rows run along y (front-left), columns along x.
 */
export function tableModule({
  x = 0,
  y = 0,
  z = 0,
  w = 5,
  d = 4,
  h = 0.6,
  rows = 4,
  cols = 2,
  label = "",
  headers = [],
  mat = MAT.plastic,
  cls = "",
}: Footprint & {
  rows?: number;
  cols?: number;
  label?: string;
  headers?: string[];
  mat?: Material;
} = {}) {
  const top = z + h;
  const gx = x + 0.7;
  const gy = y + (headers.length ? 0.62 : 0.32);
  const gw = w - 0.7 - 0.3;
  const gd = d - (gy - y) - 0.3;
  const cw = gw / cols;
  const ch = gd / rows;
  let cells = "";
  let lights = "";
  const centres: Point[][] = [];
  const rowLeds: Point[] = [];
  for (let r = 0; r < rows; r++) {
    const row: Point[] = [];
    for (let c = 0; c < cols; c++) {
      const cx = gx + c * cw;
      const cy = gy + r * ch;
      cells += `<polygon class="iso-cell" data-row="${r}" data-col="${c}" points="${pts([
        [cx + 0.06, cy + 0.06, top + 0.003],
        [cx + cw - 0.06, cy + 0.06, top + 0.003],
        [cx + cw - 0.06, cy + ch - 0.06, top + 0.003],
        [cx + 0.06, cy + ch - 0.06, top + 0.003],
      ])}"/>`;
      row.push([cx + cw / 2, cy + ch / 2, top + 0.003]);
    }
    centres.push(row);
    const lp = [x + 0.38, gy + r * ch + ch / 2, top];
    rowLeds.push(lp);
    lights += led({ x: lp[0], y: lp[1], z: top, cls: "iso-row-led", size: 0.9 }).replace(
      'class="iso-led',
      `data-row="${r}" class="iso-led`,
    );
  }
  const heads = headers
    .map((t, c) =>
      topText({
        x: gx + c * cw + cw / 2,
        y: y + 0.36,
        z: top,
        text: t,
        size: 12,
        weight: 700,
        fill: mat.ink,
        engrave: mat.engrave,
      }),
    )
    .join("");
  const svg = `<g class="iso-device iso-table ${cls}">
    ${shadow({ x, y, w, d, spread: 0.5 })}
    ${box({ x, y, z, w, d, h, fill: mat, radius: 0.2 })}
    ${pocket({ x: gx - 0.08, y: gy - 0.08, z: top, w: gw + 0.16, d: gd + 0.16, depth: 0.06, floor: "url(#hw-iso-lcd) var(--iso-glass)", wall: "var(--iso-glass)", lip: mat.edge })}
    ${cells}
    ${lights}
    ${heads}
    ${label ? frontText({ x: x + 0.45, y: y + d, z: z + h * 0.5, text: label, size: 12, anchor: "start", fill: mat.ink, weight: 700 }) : ""}
  </g>`;
  return { svg, top, cells: centres, rowLeds, slots: centres.flat() };
}

/**
 * A drawer / bin for finished items: a graphite cabinet with one wide open
 * pocket on top, a drawer seam and a recessed pull on the front, and a printed
 * label. Distinct from a queue tray: no numbered slots. capacity tokens fit in
 * a grid inside the pocket (slots).
 */
export function bin({
  x = 0,
  y = 0,
  z = 0,
  w = 4,
  d = 3,
  h = 1.0,
  label = "",
  capacity = 6,
  mat = MAT.graphite,
  cls = "",
}: Footprint & { label?: string; capacity?: number; mat?: Material } = {}) {
  const top = z + h;
  const m = 0.3;
  const depth = 0.3;
  const iw = w - 2 * m;
  const id = d - 2 * m;
  const cols = Math.max(1, Math.round(Math.sqrt((capacity * iw) / id)));
  const rows = Math.ceil(capacity / cols);
  const slots = [];
  for (let i = 0; i < capacity; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    slots.push([
      x + m + (iw * (c + 0.5)) / cols,
      y + m + (id * (r + 0.5)) / rows,
      top - depth + 0.01,
    ]);
  }
  const floorFill = mat === MAT.graphite ? "var(--iso-graphite-pocket)" : "var(--iso-metal-pocket)";
  const wallFill =
    mat === MAT.graphite
      ? "color-mix(in oklch, var(--iso-graphite-pocket) 80%, black)"
      : "var(--iso-metal-pocket-wall)";
  const pull =
    frontQuad({
      x: x + w / 2 - 0.55,
      y: y + d + 0.001,
      z: z + h * 0.48,
      w: 1.1,
      h: 0.14,
      fill: "rgb(0 0 0 / .55)",
    }) +
    frontQuad({
      x: x + w / 2 - 0.55,
      y: y + d + 0.002,
      z: z + h * 0.48,
      w: 1.1,
      h: 0.035,
      fill: mat.edge,
    });
  const seam =
    `<polyline points="${pts([
      [x + 0.12, y + d + 0.001, z + h * 0.82],
      [x + w - 0.12, y + d + 0.001, z + h * 0.82],
    ])}" stroke="rgb(0 0 0 / .45)" stroke-width="1" fill="none"/>` +
    `<polyline points="${pts([
      [x + 0.12, y + d + 0.001, z + h * 0.82 - 0.03],
      [x + w - 0.12, y + d + 0.001, z + h * 0.82 - 0.03],
    ])}" stroke="${mat.edge}" stroke-width=".6" fill="none"/>`;
  const svg = `<g class="iso-device iso-bin ${cls}">
    ${shadow({ x, y, w, d, spread: 0.55 })}
    ${box({ x, y, z, w, d, h, fill: mat, radius: 0.22 })}
    ${pocket({ x: x + m, y: y + m, z: top, w: iw, d: id, depth, floor: floorFill, wall: wallFill, lip: mat.edge })}
    ${seam}
    ${pull}
    ${label ? frontText({ x: x + w / 2, y: y + d, z: z + h * 0.24, text: label, size: 12, fill: mat.ink, weight: 700 }) : ""}
  </g>`;
  return { svg, top, slots };
}

/** CSS the kit's SVG relies on; injected once. */
const KIT_CSS = `
.iso-path { fill: none; stroke: var(--iso-guide, var(--iso-line)); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.iso-path.is-dashed { stroke-dasharray: 6 6; }
.iso-path.is-active { stroke: var(--accent); stroke-width: 2.6; filter: drop-shadow(0 0 4px color-mix(in srgb, var(--accent) 60%, transparent)); }
.iso-grid { stroke: var(--iso-grid, var(--grid)); stroke-width: .7; }
.iso-grid.is-major { stroke-width: 1.1; }
.iso-floor-face { fill: var(--iso-floor, transparent); }
.iso-silhouette { opacity: .55; }
.iso-edge-lit { fill: none; stroke: var(--iso-edge-lit, rgb(255 255 255 / .9)); stroke-width: 1.1; stroke-linecap: round; stroke-linejoin: round; }
.iso-edge-corner { stroke: var(--iso-edge-corner, rgb(255 255 255 / .45)); stroke-width: .8; }
.iso-floor .iso-edge-lit, .iso-floor .iso-edge-corner { display: none; }
.iso-contact { mix-blend-mode: multiply; }
.iso-top-overlay { pointer-events: none; }
.iso-trace { fill: none; stroke: var(--iso-pcb-trace); stroke-width: .8; stroke-linecap: round; stroke-linejoin: round; }
.iso-via { fill: var(--iso-gold); opacity: .75; }
.iso-callout-line { stroke: var(--iso-guide, var(--iso-line)); stroke-width: 1.1; }
.iso-callout-dot { fill: var(--iso-guide, var(--iso-line)); stroke: var(--hw-plate, #fff); stroke-width: 1.2; }
.iso-callout-label { transform: scale(var(--iso-label-k, 1)); }
.iso-callout-title, .iso-callout-sub { paint-order: stroke; stroke: var(--hw-plate, var(--bg)); stroke-width: 4px; stroke-linejoin: round; }
.iso-callout-title { fill: var(--ink); font: 700 ${LABEL.title}px var(--font-sans); letter-spacing: -.01em; }
.iso-callout-sub { fill: var(--muted); font: 500 ${LABEL.sub}px var(--font-sans); letter-spacing: 0; }
.iso-led-halo { fill: transparent; }
.iso-led-bezel { fill: rgb(0 0 0 / .35); }
.iso-led-core { fill: var(--hw-led-off); }
.iso-led-spec { fill: rgb(255 255 255 / .55); }
.iso-led.is-on .iso-led-core { fill: var(--led); }
.iso-led.is-on .iso-led-halo { fill: color-mix(in srgb, var(--led) 45%, transparent); filter: blur(2.5px); }
.iso-unit-led { fill: var(--hw-led-off); }
.iso-unit-led.is-on { fill: var(--accent); filter: drop-shadow(0 0 3px var(--accent)); }
.iso-platter-ring { fill: none; stroke: rgb(83 80 70 / .22); stroke-width: .6; }
.iso-cavity { fill: var(--iso-cavity, var(--iso-metal-pocket-wall)); }
.iso-cavity-floor { fill: var(--iso-cavity-floor, var(--iso-metal-pocket)); }
.iso-screw { fill: var(--iso-metal-side); stroke: var(--iso-metal-line); stroke-width: .5; stroke-opacity: .6; }
.iso-screw-dark { fill: var(--iso-graphite-rim); stroke: #000; }
.iso-screw-slot { stroke: var(--iso-metal-line); stroke-width: .6; opacity: .7; }
.iso-hinge { fill: var(--iso-side); opacity: .8; }
.iso-tray-exit { fill: var(--accent); }
.iso-cell { fill: var(--iso-cell, color-mix(in oklch, var(--iso-glass) 86%, white)); transition: fill 200ms ease; }
.iso-cell.is-on { fill: color-mix(in oklch, var(--accent) 55%, var(--iso-glass)); }
.iso-cell.is-hot { fill: var(--accent); }
.iso-cable { --iso-cable-color: var(--iso-cable); }
.iso-cable path { fill: none; stroke-linecap: round; stroke-linejoin: round; }
.iso-cable-shadow { stroke: var(--iso-cable-shadow); filter: blur(2.2px); }
.iso-cable-body { stroke: var(--iso-cable-color); }
.iso-cable-hi { stroke: var(--iso-cable-hi); }
.iso-cable.is-active { --iso-cable-color: color-mix(in oklch, var(--accent) 82%, black); }
.iso-cable.is-active .iso-cable-hi { stroke: color-mix(in oklch, var(--accent) 45%, white); }
.iso-cable:not(.is-active) .iso-cable-pulse { display: none; }
.iso-cable-pulse { stroke: color-mix(in oklch, var(--accent) 30%, white); stroke-dasharray: 7 93; filter: drop-shadow(0 0 3px var(--accent)); animation: iso-cable-pulse 1.4s linear infinite; }
.iso-cable-plug rect { fill: var(--iso-metal-front); stroke: var(--iso-metal-line); stroke-width: .6; }
.iso-cable-plug .iso-cable-plug-hi { fill: var(--iso-metal-hi); stroke: none; opacity: .8; }
.iso-cable .iso-cable-head { fill: var(--iso-cable-color); stroke: var(--iso-cable-color); stroke-width: 1; stroke-linejoin: round; }
.iso-cable.is-active path.iso-cable-head { fill: var(--accent); stroke: var(--accent); }
@keyframes iso-cable-pulse { from { stroke-dashoffset: 100; } to { stroke-dashoffset: 0; } }
.iso-token { transition: transform 600ms cubic-bezier(.2,.7,.2,1); }
@media (prefers-reduced-motion: reduce) {
  .iso-token { transition: none; }
  .iso-cable-pulse { animation: none; stroke-dasharray: none; opacity: .35; filter: none; }
}
`;

if (typeof document !== "undefined" && !document.getElementById("iso-kit-css")) {
  const style = document.createElement("style");
  style.id = "iso-kit-css";
  style.textContent = KIT_CSS;
  document.head.append(style);
}
