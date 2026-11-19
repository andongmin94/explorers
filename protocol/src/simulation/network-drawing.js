// The network scene, drawn with the shared isometric kit.
//
// Every device stands on one floor at one scale, in world units
// (shared/iso-kit.js: x to the lower right, y to the lower left, z up). The
// internet hub sits in the middle; the local chain (laptop → router → hub)
// runs along the screen horizontal and the servers fan out around the hub,
// so even the DNS lesson (seven devices) reads as one tidy star.
//
// Each link is a two-conductor cable() (full duplex): one conductor per
// direction. network-animation.js moves packet tokens along the conductor of
// the direction they travel (NETWORK_LANES, screen points) and lights only
// that conductor while a packet is on it.
import { translate } from "../i18n.js";
import {
  LABEL,
  MAT,
  UNIT,
  box,
  cable,
  callout,
  cylinder,
  defs as isoDefs,
  floor,
  frontQuad,
  laptop,
  led,
  project,
  quad,
  server,
  shadow,
  topText,
} from "../../../shared/iso-kit.js";

/** Packet colours: tokens, LEDs and sequence arrows read these. */
const PACKET_COLORS = {
  idle: "var(--iso-line)",
  navy: "var(--pk-navy)",
  blue: "var(--pk-blue)",
  green: "var(--pk-green)",
  amber: "var(--pk-amber)",
  violet: "var(--pk-violet)",
  teal: "var(--pk-teal)",
  slate: "var(--pk-slate)",
  grey: "var(--pk-grey)",
};

// Footprints (back-left corner, width along x, depth along y).
const DEVICES = {
  client: { x: -9.5, y: 9.3, w: 5, d: 3.4 },
  router: { x: -4.1, y: 5.2, w: 3.2, d: 2.6 },
  internet: { x: 0, y: 0, w: 4, d: 4 },
  dns: { x: -7.5, y: -4.6, w: 3, d: 3 },
  // Nodes that never share a lesson share a spot: web/tld, root/mx.
  web: { x: 0.3, y: -7.9, w: 3.4, d: 3.4 },
  tld: { x: 0.5, y: -7.7, w: 3, d: 3 },
  root: { x: 8, y: 0.5, w: 3, d: 3 },
  mx: { x: 8, y: 0.5, w: 3, d: 3 },
  auth: { x: 2, y: 8, w: 3, d: 3 },
};
const LAPTOP_SCREEN_HEIGHT = 2.6;
const SERVER_UNIT = 0.75;
const ROUTER_HEIGHT = 0.62;
const ANTENNA_HEIGHT = 1.7;
const PLINTH_HEIGHT = 0.5;
const HUB = { r: 1.25, h: 0.55 };
const DEVICE_TOPS = {
  client: 0.22,
  router: ROUTER_HEIGHT,
  internet: PLINTH_HEIGHT + HUB.h + 0.1,
  dns: 3 * SERVER_UNIT - 0.05,
  web: 4 * SERVER_UNIT - 0.05,
  root: 3 * SERVER_UNIT - 0.05,
  mx: 3 * SERVER_UNIT - 0.05,
  tld: 3 * SERVER_UNIT - 0.05,
  auth: 3 * SERVER_UNIT - 0.05,
};
/** Highest point of each device (for framing): laptop lid, router antennae. */
const DEVICE_HEIGHTS = {
  ...DEVICE_TOPS,
  client: LAPTOP_SCREEN_HEIGHT + 0.3,
  router: ROUTER_HEIGHT + ANTENNA_HEIGHT,
};
const centerOf = (id) => {
  const { x, y, w, d } = DEVICES[id];
  return [x + w / 2, y + d / 2];
};

// Cable routes for each link (world floor points), from the first node's edge
// to the second's, along world axes.
const LINKS = {
  "client>router": [[-4.5, 11], [-2.5, 11], [-2.5, 7.8]],
  "router>internet": [[-0.9, 6.5], [1, 6.5], [1, 4]],
  "internet>dns": [[0, 1.6], [-6, 1.6], [-6, -1.6]],
  "internet>web": [[2, 0], [2, -4.5]],
  "internet>tld": [[2, 0], [2, -4.7]],
  "internet>root": [[4, 2], [8, 2]],
  "internet>mx": [[4, 2], [8, 2]],
  "internet>auth": [[3.5, 4], [3.5, 8]],
};
const CABLE_WIDTH = 6;
const CABLE_GAP = CABLE_WIDTH * 1.15; // cable(): distance between bus conductors

const toScreen = (points) => points.map(([x, y]) => project(x, y, 0));
const toWorld = ([sx, sy]) => [(sx / UNIT + (2 * sy) / UNIT) / 2, ((2 * sy) / UNIT - sx / UNIT) / 2];

/** The same perpendicular offset cable() uses for its bus conductors. */
function offsetLine(screen, off) {
  return screen.map((p, i) => {
    const a = screen[Math.max(0, i - 1)];
    const b = screen[Math.min(screen.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    return [p[0] - (dy / len) * off, p[1] + (dx / len) * off];
  });
}
const roundPoints = (points) => points.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);

// Each lane is the conductor to the right of travel, as screen points.
const NETWORK_LANES = {};
for (const [link, points] of Object.entries(LINKS)) {
  const [from, to] = link.split(">");
  NETWORK_LANES[`${from}>${to}`] = roundPoints(offsetLine(toScreen(points), CABLE_GAP / 2));
  NETWORK_LANES[`${to}>${from}`] = roundPoints(offsetLine(toScreen([...points].reverse()), CABLE_GAP / 2));
}

// Logical packet endpoints expand to the physical lanes traversed in order.
const NETWORK_ROUTES = {
  "client>dns": ["client>router", "router>internet", "internet>dns"],
  "dns>client": ["dns>internet", "internet>router", "router>client"],
  "client>web": ["client>router", "router>internet", "internet>web"],
  "web>client": ["web>internet", "internet>router", "router>client"],
  "dns>root": ["dns>internet", "internet>root"],
  "root>dns": ["root>internet", "internet>dns"],
  "dns>tld": ["dns>internet", "internet>tld"],
  "tld>dns": ["tld>internet", "internet>dns"],
  "dns>auth": ["dns>internet", "internet>auth"],
  "auth>dns": ["auth>internet", "internet>dns"],
  "client>router": ["client>router"],
  "router>client": ["router>client"],
  "client>internet": ["client>router", "router>internet"],
  "internet>client": ["internet>router", "router>client"],
  "router>web": ["router>internet", "internet>web"],
  "web>router": ["web>internet", "internet>router"],
  "web>dns": ["web>internet", "internet>dns"],
  "dns>web": ["dns>internet", "internet>web"],
  "web>mx": ["web>internet", "internet>mx"],
  "mx>web": ["mx>internet", "internet>web"],
};

const NETWORK_NODE_LABELS = {
  internet: ["Internet", ""],
  client: ["Client", "192.168.1.10"],
  router: ["Router", "192.168.1.1"],
  dns: ["DNS Resolver", "8.8.8.8"],
  web: ["Web Server", "203.0.113.10"],
  root: ["Root Server", "198.41.0.4"],
  tld: [".com TLD Server", "192.5.6.30"],
  auth: ["Authoritative Server", "198.51.100.53"],
  mx: ["Mail Server", "198.51.100.25"],
};
const NETWORK_SHORT_LABELS = {
  client: "Client",
  router: "Router",
  dns: "DNS Resolver",
  internet: "Internet",
  web: "Web Server",
  root: "Root Server",
  tld: ".com Server",
  auth: "Authoritative",
  mx: "Mail Server",
};

/** Floor point under each device (for arrival rings) and its footprint radius. */
const NETWORK_NODE_CENTERS = Object.fromEntries(
  Object.keys(DEVICES).map((id) => [id, project(...centerOf(id), 0)]),
);
const NETWORK_NODE_RADII = Object.fromEntries(
  Object.entries(DEVICES).map(([id, { w, d }]) => [id, ((w + d) / 2) * 20 * 0.9]),
);
/** Notes rise from the top of each device. */
const NETWORK_NOTE_ANCHORS = Object.fromEntries(
  Object.keys(DEVICES).map((id) => {
    const lift = id === "client" ? LAPTOP_SCREEN_HEIGHT + 0.5 : DEVICE_TOPS[id] + 0.2;
    const [x, y] = project(...centerOf(id), lift);
    return [id, { x, y, side: "top" }];
  }),
);
/** World slots on top of a device where state tokens (mail, ports, cache) sit. */
const NETWORK_TOKEN_SLOTS = Object.fromEntries(
  Object.keys(DEVICES).map((id) => {
    const [cx, cy] = centerOf(id);
    const z = DEVICE_TOPS[id];
    if (id === "client") {
      // On the keyboard deck, in front of the screen.
      return [id, [-1.4, 0, 1.4].map((dx) => [cx + dx, cy + 0.7, z])];
    }
    return [id, [-1, 0, 1].map((dx) => [cx + dx * 0.95, cy + dx * 0.0, z])];
  }),
);
/** World points that bound each device (footprint at the floor and at its top). */
const NETWORK_NODE_BOUNDS = Object.fromEntries(
  Object.entries(DEVICES).map(([id, { x, y, w, d }]) => {
    const top = DEVICE_HEIGHTS[id];
    // The laptop lid stands just behind its base.
    const y0 = id === "client" ? y - 0.25 : y;
    const corners = [[x, y0], [x + w, y0], [x + w, y + d], [x, y + d]];
    return [id, [...corners.map(([a, b]) => [a, b, 0]), ...corners.map(([a, b]) => [a, b, top])]];
  }),
);

const NETWORK_FOCUS_GROUPS = {
  client: ["client"],
  local: ["client", "router"],
  lookup: ["client", "router", "internet", "dns"],
  root: ["client", "router", "internet", "dns", "root"],
  tld: ["client", "router", "internet", "dns", "root", "tld"],
  path: ["client", "router", "internet", "web"],
  mailhost: ["client", "router", "internet", "dns", "web"],
  servers: ["internet", "dns", "web", "mx"],
  full: ["client", "router", "dns", "internet", "web", "root", "tld", "auth", "mx"],
};

// Device names: screen-space callouts (title, address, and a live state
// line), placed in the free space around the star so they never sit on a
// cable or packet lane: the laptop to its left, the router above its
// antennae, the servers on their outer side.
const CALLOUTS = {
  client: { dx: -64, dy: -18, anchor: "end", z: LAPTOP_SCREEN_HEIGHT + 0.2 },
  router: { dx: -40, dy: -80, anchor: "middle", z: ROUTER_HEIGHT + ANTENNA_HEIGHT * 0.5 },
  internet: { dx: 34, dy: 52, anchor: "start", z: PLINTH_HEIGHT, front: true },
  dns: { dx: -56, dy: -44, anchor: "end" },
  web: { dx: -6, dy: -62, anchor: "middle" },
  tld: { dx: -6, dy: -62, anchor: "middle" },
  root: { dx: 52, dy: -30, anchor: "start" },
  mx: { dx: 52, dy: -30, anchor: "start" },
  auth: { dx: 44, dy: 34, anchor: "start", front: true, z: 0.8 },
};
// A short, wide stage (e.g. 1280 × 720) has no height to spare: the labels
// move beside their devices instead of above or below them.
const CALLOUTS_WIDE = {
  ...CALLOUTS,
  internet: { dx: 35, dy: 44, anchor: "middle", z: PLINTH_HEIGHT, front: true },
  dns: { dx: -60, dy: -40, anchor: "end" },
  web: { dx: 62, dy: -24, anchor: "start" },
  tld: { dx: 62, dy: -24, anchor: "start" },
  root: { dx: 56, dy: -8, anchor: "start" },
  mx: { dx: 56, dy: -8, anchor: "start" },
};
const LABEL_LAYOUTS = { tall: CALLOUTS, wide: CALLOUTS_WIDE };
function renderNodeLabel(id, layout) {
  const [name, address] = NETWORK_NODE_LABELS[id];
  const { dx, dy, anchor, z, front } = LABEL_LAYOUTS[layout][id];
  // A callout either points at the front face or at the top. On top it
  // points near the back corner, clear of the name engraved in the middle.
  const dev = DEVICES[id];
  const onTop = !front && id !== "client";
  const [cx, centerY] = onTop ? [dev.x + dev.w * 0.2, dev.y + dev.d * 0.2] : centerOf(id);
  const cy = front ? dev.y + dev.d : centerY;
  const markup = callout({
    x: cx,
    y: cy,
    z: z ?? DEVICE_TOPS[id],
    dx,
    dy,
    anchor,
    title: translate(name),
    sub: address || " ",
    cls: "node-callout",
  });
  // A third line, printed under the address, carries the device's live state.
  // It sits inside the callout label so labelScale() scales it too.
  const [sx, sy] = project(cx, cy, z ?? DEVICE_TOPS[id]);
  const state = `<text class="node-state" x="${(sx + dx).toFixed(1)}" y="${(sy + dy + LABEL.title + LABEL.sub + 6).toFixed(1)}" text-anchor="${anchor}"></text>`;
  return `<g class="node-label" data-layout="${layout}">${markup
    .replace('class="iso-callout-title"', 'class="iso-callout-title node-name"')
    .replace('class="iso-callout-sub"', 'class="iso-callout-sub node-ip"')
    .replace("</g>", `${state}</g>`)}</g>`;
}

/* ---------- Devices ---------- */

// Router: a graphite housing with two antennae at the back, a row of LAN/WAN
// ports on the front face and a link LED above each port.
function drawRouter() {
  const { x, y, w, d } = DEVICES.router;
  const h = ROUTER_HEIGHT;
  const antenna = (ax) => `
    ${shadow({ x: ax, y: y + 0.25, z: h, w: 0.24, d: 0.24, spread: 0.12, strength: 0.6 })}
    ${box({ x: ax, y: y + 0.25, z: h, w: 0.24, d: 0.24, h: ANTENNA_HEIGHT, fill: MAT.rubber, radius: 0.1, bevel: false })}`;
  let ports = "";
  let leds = "";
  for (let i = 0; i < 4; i++) {
    const px = x + 0.45 + i * 0.62;
    ports += frontQuad({ x: px, y: y + d + 0.001, z: 0.12, w: 0.44, h: 0.3, fill: "#0d0d0e" });
    ports += frontQuad({ x: px + 0.08, y: y + d + 0.002, z: 0.16, w: 0.28, h: 0.08, fill: "var(--iso-gold)" });
    leds += led({ x: px + 0.22, y: y + d - 0.32, z: h, on: true, color: i === 3 ? "var(--pk-amber)" : "var(--accent)", cls: "router-led", size: 0.85 });
  }
  return `<g class="iso-device net-router">
    ${shadow({ x, y, w, d, spread: 0.5 })}
    ${box({ x, y, z: 0, w, d, h, fill: MAT.graphite, radius: 0.3 })}
    ${ports}
    ${quad({ x: x + 0.35, y: y + 0.75, z: h + 0.001, w: w - 0.7, d: 0.9, fill: "rgb(0 0 0 / .18)" })}
    ${topText({ x: x + w / 2, y: y + 1.2, z: h, text: "ROUTER", size: 12, weight: 800, fill: MAT.graphite.ink, engrave: MAT.graphite.engrave })}
    ${leds}
    ${antenna(x + 0.3)}
    ${antenna(x + w - 0.54)}
  </g>`;
}

// Internet: a brushed-metal plinth carrying a graphite hub with a glass globe
// face (meridians and parallels in the accent) and a ring of uplink LEDs.
function drawInternet() {
  const { x, y, w, d } = DEVICES.internet;
  const [cx, cy] = centerOf("internet");
  const topZ = PLINTH_HEIGHT + HUB.h;
  const graphite = { top: "var(--iso-graphite-top)", front: "var(--iso-graphite-front)", side: "var(--iso-graphite-side)" };
  const [gx, gy] = project(cx, cy, topZ + 0.06);
  const rx = (r) => (r * UNIT * Math.SQRT2).toFixed(1);
  const ry = (r) => ((r * UNIT * Math.SQRT2) / 2).toFixed(1);
  const g = HUB.r * 0.82;
  const globe = `<g class="net-globe">
    <ellipse cx="${gx.toFixed(1)}" cy="${gy.toFixed(1)}" rx="${rx(g)}" ry="${ry(g)}"/>
    <ellipse cx="${gx.toFixed(1)}" cy="${gy.toFixed(1)}" rx="${rx(g * 0.62)}" ry="${ry(g * 0.62)}"/>
    <ellipse cx="${gx.toFixed(1)}" cy="${gy.toFixed(1)}" rx="${rx(g * 0.25)}" ry="${ry(g * 0.25)}"/>
    <path d="M${(gx - +rx(g)).toFixed(1)},${gy.toFixed(1)} H${(gx + +rx(g)).toFixed(1)} M${gx.toFixed(1)},${(gy - +ry(g)).toFixed(1)} V${(gy + +ry(g)).toFixed(1)}"/>
  </g>`;
  let leds = "";
  for (let i = 0; i < 5; i++) {
    leds += led({ x: x + w - 0.38, y: y + 0.55 + i * 0.72, z: PLINTH_HEIGHT, on: i % 2 === 0, color: "var(--accent)", cls: "hub-led", size: 0.85 });
  }
  return `<g class="iso-device net-internet">
    ${shadow({ x, y, w, d, spread: 0.6 })}
    ${box({ x, y, z: 0, w, d, h: PLINTH_HEIGHT, fill: MAT.metal, radius: 0.35 })}
    ${cylinder({ cx, cy, z: PLINTH_HEIGHT, r: HUB.r, h: HUB.h, fill: graphite, stroke: "var(--iso-graphite-line)" })}
    ${cylinder({ cx, cy, z: topZ, r: HUB.r * 0.9, h: 0.06, fill: { top: "url(#hw-iso-lcd) var(--iso-glass)", front: "var(--iso-glass)", side: "var(--iso-glass)" }, stroke: "#000" })}
    ${globe}
    ${topText({ x: cx - 0.2, y: y + d - 0.42, z: PLINTH_HEIGHT, text: "INTERNET", size: 12, weight: 800, fill: MAT.metal.ink, engrave: MAT.metal.engrave })}
    ${leds}
  </g>`;
}

function drawServer(id, label, units = 3) {
  const { x, y, w, d } = DEVICES[id];
  return server({ x, y, w, d, units, label, lit: units }).svg;
}

// The laptop's screen is a front-facing plane: a matrix maps local 2D
// coordinates (px, y down) onto it, so the URL bar and page content can be
// drawn and measured like flat SVG.
const SCREEN_WIDTH = (DEVICES.client.w - 0.44) * 20;
const SCREEN_HEIGHT = (LAPTOP_SCREEN_HEIGHT - 0.4) * 20;
function screenMatrix() {
  const { x, y } = DEVICES.client;
  const [sx, sy] = project(x + 0.22, y - 0.1, LAPTOP_SCREEN_HEIGHT);
  return `matrix(1 0.5 0 1 ${sx.toFixed(2)} ${sy.toFixed(2)})`;
}
function drawClient() {
  const { x, y, w, d } = DEVICES.client;
  const lines = [0, 1, 2, 3]
    .map((i) => `<polyline points="${36},${21 + i * 5.5} ${SCREEN_WIDTH - 6},${21 + i * 5.5}" pathLength="1"/>`)
    .join("");
  return `${laptop({ x, y, w, d }).svg}
    <g class="laptop-screen" transform="${screenMatrix()}">
      <clipPath id="screen-clip"><rect width="${SCREEN_WIDTH}" height="${SCREEN_HEIGHT}"/></clipPath>
      <g clip-path="url(#screen-clip)">
        <g class="screen-content">
          <rect x="6" y="19" width="24" height="19" rx="1.5"/>
          ${lines}
        </g>
        <g class="screen-lines"></g>
        <g class="url-bar">
          <rect class="url-box" x="3" y="3" width="${SCREEN_WIDTH - 6}" height="11" rx="2"/>
          <g class="url-globe" transform="translate(6 5)"><circle cx="3.5" cy="3.5" r="3"/><path d="M0.5 3.5h6"/></g>
          <g class="url-lock" transform="translate(5.5 4.6)"><path d="M1.5 3.4V2.3a2 2 0 0 1 4 0v1.1"/><rect x="0.5" y="3.4" width="6" height="4" rx="0.8"/></g>
          <text class="url-text" x="15" y="8.6"></text>
          <rect class="url-caret" x="15" y="5" width="1" height="7"/>
          <path class="url-check" d="M0 8.5 l2.2 2.2 l4 -4.4" pathLength="1"/>
        </g>
      </g>
    </g>`;
}

const DRAW = {
  client: drawClient,
  router: drawRouter,
  internet: drawInternet,
  dns: () => drawServer("dns", "DNS"),
  web: () => drawServer("web", "WEB", 4),
  root: () => drawServer("root", "ROOT"),
  mx: () => drawServer("mx", "MX"),
  tld: () => drawServer("tld", "TLD"),
  auth: () => drawServer("auth", "NS"),
};

// Painter's order: back to front (smaller x + y first).
const DRAW_ORDER = Object.keys(DEVICES).sort(
  (a, b) => centerOf(a)[0] + centerOf(a)[1] - (centerOf(b)[0] + centerOf(b)[1]),
);

const FLOOR = { x: -22, y: -22, w: 44, d: 46 };
// Before the first camera fit: frame every device.
const NETWORK_VIEWBOX = (() => {
  const s = Object.values(NETWORK_NODE_BOUNDS).flat().map(([x, y, z]) => project(x, y, z));
  const xs = s.map((p) => p[0]);
  const ys = s.map((p) => p[1]);
  const pad = 40;
  return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...ys) - Math.min(...ys) + 2 * pad];
})();

/**
 * One link: the idle full-duplex cable, and above it one lit conductor per
 * direction (shown while a packet is on that lane).
 */
function renderLink(link, points) {
  const [from, to] = link.split(">");
  const lane = (laneId) =>
    `<g class="lane" data-lane="${laneId}">${cable(NETWORK_LANES[laneId].map(toWorld), { active: true, width: CABLE_WIDTH - 1, plugs: false })}</g>`;
  return `<g class="link" data-link="${link}" data-from="${from}" data-to="${to}">
    ${cable(points, { bus: 2, width: CABLE_WIDTH, cls: "link-cable" })}
    ${lane(`${from}>${to}`)}${lane(`${to}>${from}`)}
  </g>`;
}

/** Render the static scene; network-animation.js controls its nodes and layers. */
function renderNetworkDiagram() {
  const links = Object.entries(LINKS)
    .map(([link, points]) => renderLink(link, points))
    .join("");
  const nodes = DRAW_ORDER.map(
    (id) =>
      `<g class="node" data-node="${id}"><g class="node-body">${DRAW[id]()}<g class="node-tokens"></g></g>${renderNodeLabel(id, "tall")}${renderNodeLabel(id, "wide")}</g>`,
  ).join("");
  return `
  <svg class="network is-booting" viewBox="${NETWORK_VIEWBOX.map((v) => v.toFixed(1)).join(" ")}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${translate("Network diagram")}">
    ${isoDefs()}
    ${floor({ ...FLOOR, cls: "network-floor" })}
    <g class="lanes">${links}</g>
    <g class="pulse-layer"></g>
    ${nodes}
    <g class="packet-layer"></g>
    <g class="note-layer"></g>
  </svg>`;
}

export {
  NETWORK_FOCUS_GROUPS,
  NETWORK_LANES,
  NETWORK_NODE_BOUNDS,
  NETWORK_NODE_CENTERS,
  NETWORK_NODE_LABELS,
  NETWORK_NODE_RADII,
  NETWORK_NOTE_ANCHORS,
  NETWORK_ROUTES,
  NETWORK_SHORT_LABELS,
  NETWORK_TOKEN_SLOTS,
  NETWORK_VIEWBOX,
  PACKET_COLORS,
  SCREEN_WIDTH,
  renderNetworkDiagram,
};
