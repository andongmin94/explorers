// The network scene, drawn with the shared isometric kit.
//
// Every device stands on one floor at one scale. Devices are placed in world
// units (shared/iso-kit.js: x to the lower right, y to the lower left, z up)
// and joined by floor routes. A route is a list of world points; each link has
// one lane per direction, offset to the right of travel, so a request and its
// reply never overlap. network-animation.js moves packet tokens along these
// lanes in screen coordinates (the projected points exported below).
import { translate } from "../i18n.js";
import {
  box,
  callout,
  defs as isoDefs,
  fitViewBox,
  floor,
  laptop,
  led,
  module,
  project,
  server,
  topText,
} from "../../../shared/iso-kit.js";

/** Packet colours: tokens, lanes, LEDs and sequence arrows read these. */
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
  client: { x: 2, y: 17.8, w: 5, d: 3.4 },
  router: { x: 7.5, y: 13.5, w: 3, d: 3 },
  internet: { x: 12.3, y: 9.3, w: 4.4, d: 4.4 },
  dns: { x: 2.5, y: 4.5, w: 3, d: 3 },
  // Nodes that never share a lesson share a spot: web/tld, root/mx.
  web: { x: 11.9, y: 0, w: 3.4, d: 3.4 },
  tld: { x: 12.1, y: 0.2, w: 3, d: 3 },
  root: { x: 21, y: 9, w: 3, d: 3 },
  mx: { x: 21, y: 9, w: 3, d: 3 },
  auth: { x: 14.3, y: 20, w: 3, d: 3 },
};
const LAPTOP_SCREEN_HEIGHT = 2.6;
const SERVER_UNIT = 0.75;
const DEVICE_TOPS = {
  client: 0.22,
  router: 0.9,
  internet: 0.55,
  dns: 3 * SERVER_UNIT - 0.05,
  web: 4 * SERVER_UNIT - 0.05,
  root: 3 * SERVER_UNIT - 0.05,
  mx: 3 * SERVER_UNIT - 0.05,
  tld: 3 * SERVER_UNIT - 0.05,
  auth: 3 * SERVER_UNIT - 0.05,
};
const centerOf = (id) => {
  const { x, y, w, d } = DEVICES[id];
  return [x + w / 2, y + d / 2];
};

// Floor routes for each link, from the first node's edge to the second's.
const LINKS = {
  "client>router": [[7, 19.5], [9, 19.5], [9, 16.5]],
  "router>internet": [[10.5, 15], [14.5, 15], [14.5, 13.7]],
  "internet>dns": [[12.3, 11.5], [4, 11.5], [4, 7.5]],
  "internet>web": [[13.6, 9.3], [13.6, 3.4]],
  "internet>tld": [[13.6, 9.3], [13.6, 3.2]],
  "internet>root": [[16.7, 10.5], [21, 10.5]],
  "internet>mx": [[16.7, 10.5], [21, 10.5]],
  "internet>auth": [[15.8, 13.7], [15.8, 20]],
};
const LANE_OFFSET = 0.3;

/** Offset an axis-aligned polyline to the right of its direction of travel. */
function offsetRoute(points, distance) {
  const normals = points.slice(1).map(([x, y], index) => {
    const [px, py] = points[index];
    const length = Math.hypot(x - px, y - py) || 1;
    // Right of travel on the floor, as seen on screen.
    return [-(y - py) / length, (x - px) / length];
  });
  return points.map(([x, y], index) => {
    const before = normals[index - 1];
    const after = normals[index];
    const [nx, ny] =
      before && after
        ? before[0] === after[0] && before[1] === after[1]
          ? before
          : [before[0] + after[0], before[1] + after[1]]
        : (before ?? after);
    return [x + nx * distance, y + ny * distance];
  });
}

const screenPoints = (points) =>
  points.map(([x, y]) => project(x, y, 0).map((v) => Math.round(v * 10) / 10));

// Each lane is a list of screen points [[x, y], ...] in the network SVG.
const NETWORK_LANES = {};
for (const [link, points] of Object.entries(LINKS)) {
  const [from, to] = link.split(">");
  NETWORK_LANES[`${from}>${to}`] = screenPoints(offsetRoute(points, LANE_OFFSET));
  NETWORK_LANES[`${to}>${from}`] = screenPoints(
    offsetRoute([...points].reverse(), LANE_OFFSET),
  );
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

// Device names: screen-space callouts (title, address, and a live state line).
const CALLOUTS = {
  client: { dx: -14, dy: -80, anchor: "middle", z: LAPTOP_SCREEN_HEIGHT + 0.3 },
  router: { dx: -64, dy: -64, anchor: "middle" },
  internet: { dx: 0, dy: 46, anchor: "middle", z: 0.28, front: true },
  dns: { dx: -40, dy: -58, anchor: "middle" },
  web: { dx: -36, dy: -58, anchor: "middle" },
  root: { dx: 50, dy: -56, anchor: "middle" },
  mx: { dx: 50, dy: -56, anchor: "middle" },
  tld: { dx: 40, dy: -58, anchor: "middle" },
  auth: { dx: -96, dy: 6, anchor: "middle" },
};
function renderNodeLabel(id) {
  const [name, address] = NETWORK_NODE_LABELS[id];
  const { dx, dy, anchor, z, front } = CALLOUTS[id];
  const [cx, centerY] = centerOf(id);
  // A callout either points at the top of the device or at its front face.
  const cy = front ? DEVICES[id].y + DEVICES[id].d : centerY;
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
  const [sx, sy] = project(cx, cy, z ?? DEVICE_TOPS[id]);
  const state = `<text class="node-state" x="${(sx + dx).toFixed(1)}" y="${(sy + dy + 30).toFixed(1)}" text-anchor="${anchor}"></text>`;
  const origin = dy < 0 ? "center-bottom" : "left-top";
  return `<g class="node-label" data-origin="${origin}">${markup
    .replace('class="iso-callout-title"', 'class="iso-callout-title node-name"')
    .replace('class="iso-callout-sub"', 'class="iso-callout-sub node-ip"')
    .replace("</g>", `${state}</g>`)}</g>`;
}

/* ---------- Devices ---------- */

function drawRouter() {
  const { x, y, w, d } = DEVICES.router;
  const h = DEVICE_TOPS.router;
  let leds = "";
  for (let i = 0; i < 4; i++) {
    leds += led({ x: x + 0.7 + i * 0.55, y: y + d - 0.45, z: h, on: true, color: "var(--accent)", cls: "router-led" });
  }
  return `${module({ x, y, w, d, h, well: false }).svg}
    ${box({ x: x + 0.35, y: y + 0.35, z: h, w: 0.2, d: 0.2, h: 1.5 })}
    ${box({ x: x + w - 0.55, y: y + 0.35, z: h, w: 0.2, d: 0.2, h: 1.5 })}
    ${topText({ x: x + w / 2, y: y + d / 2 - 0.25, z: h, text: "ROUTER", size: 11, weight: 800 })}
    ${leds}`;
}

function drawInternet() {
  const { x, y, w, d } = DEVICES.internet;
  const h = DEVICE_TOPS.internet;
  let ports = "";
  for (let i = 0; i < 6; i++) {
    ports += led({ x: x + 0.7 + i * 0.6, y: y + d - 0.45, z: h, on: i % 2 === 0, color: "var(--accent)" });
  }
  return `${module({ x, y, w, d, h }).svg}
    ${topText({ x: x + w / 2, y: y + d / 2 - 0.2, z: h, text: "INTERNET", size: 13, weight: 800 })}
    ${ports}`;
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

const FLOOR = { x: -6, y: -10, w: 40, d: 38 };
const NETWORK_VIEWBOX = fitViewBox(
  [
    [FLOOR.x, FLOOR.y, 0],
    [FLOOR.x + FLOOR.w, FLOOR.y, 0],
    [FLOOR.x + FLOOR.w, FLOOR.y + FLOOR.d, 0],
    [FLOOR.x, FLOOR.y + FLOOR.d, 0],
  ],
  20,
)
  .split(" ")
  .map(Number);

function renderNetworkDefs() {
  const markers = Object.entries(PACKET_COLORS)
    .map(
      ([name, color]) =>
        `<marker id="head-${name}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M1 1 9 5 1 9" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></marker>`,
    )
    .join("");
  return isoDefs().replace("</defs>", `${markers}</defs>`);
}

const lanePath = (points) =>
  points.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");

/** Render the static scene; network-animation.js controls its nodes and layers. */
function renderNetworkDiagram() {
  const lanes = Object.entries(NETWORK_LANES)
    .map(
      ([laneId, points]) =>
        `<path class="lane" data-lane="${laneId}" d="${lanePath(points)}" marker-end="url(#head-idle)"/>`,
    )
    .join("");
  const nodes = DRAW_ORDER.map(
    (id) =>
      `<g class="node" data-node="${id}"><g class="node-body">${DRAW[id]()}<g class="node-tokens"></g></g>${renderNodeLabel(id)}</g>`,
  ).join("");
  return `
  <svg class="network is-booting" viewBox="${NETWORK_VIEWBOX.join(" ")}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${translate("Network diagram")}">
    ${renderNetworkDefs()}
    ${floor({ ...FLOOR, cls: "network-floor" })}
    <g class="lanes">${lanes}</g>
    <g class="pulse-layer"></g>
    ${nodes}
    <g class="packet-layer"></g>
    <g class="note-layer"></g>
  </svg>`;
}

export {
  NETWORK_FOCUS_GROUPS,
  NETWORK_LANES,
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
