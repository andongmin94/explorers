// Reconstructed from the distributed Protocol Explorer JavaScript.
import { translate } from "../i18n.js";
const ISO_COS = Math.cos(Math.PI / 6);
const ISO_SIN = 0.5;
const ISO_STROKE_COLOR = "var(--k-line-1b3fae)";
function createIsometricProjection(e, t) {
  return (s, a, n = 0) => [e + (s - a) * ISO_COS, t + (s + a) * ISO_SIN - n];
}
const formatSvgPoint = ([e, t]) => `${e.toFixed(2)},${t.toFixed(2)}`;
const svgPolygon = (e, t = "") =>
  `<polygon points="${e.map(formatSvgPoint).join(" ")}" ${t}/>`;
const svgPolyline = (e, t = "") =>
  `<polyline points="${e.map(formatSvgPoint).join(" ")}" fill="none" ${t}/>`;
function createBoxFaces(e, t, s, a, n, o, r) {
  return {
    top: (i, l) => e(t + i, s + l, a + r),
    left: (i, l) => e(t + i, s + o, a + l),
    right: (i, l) => e(t + n, s + o - i, a + l),
  };
}
const isometricRectangle = (e, t, s, a, n, o = "") =>
  svgPolygon([e(t, s), e(t + a, s), e(t + a, s + n), e(t, s + n)], o);
function isometricCircle(e, t, s, a, n = "") {
  const o = [];
  for (let r = 0; r < 28; r++) {
    const i = (r / 28) * Math.PI * 2;
    o.push(e(t + a * Math.cos(i), s + a * Math.sin(i)));
  }
  return svgPolygon(o, n);
}
function isometricBox(e, t, s, a, n, o, r, i = {}) {
  const {
      top: l = "var(--k-fill-f4f7fe)",
      left: c = "var(--k-fill-e5edfc)",
      right: h = "var(--k-fill-d0def8)",
      stroke: d = ISO_STROKE_COLOR,
      sw: y = 1.7,
    } = i,
    w = `stroke="${d}" stroke-width="${y}" stroke-linejoin="round"`;
  return [
    svgPolygon(
      [
        e(t, s, a + r),
        e(t + n, s, a + r),
        e(t + n, s + o, a + r),
        e(t, s + o, a + r),
      ],
      `fill="${l}" ${w}`,
    ),
    svgPolygon(
      [
        e(t, s + o, a),
        e(t + n, s + o, a),
        e(t + n, s + o, a + r),
        e(t, s + o, a + r),
      ],
      `fill="${c}" ${w}`,
    ),
    svgPolygon(
      [
        e(t + n, s + o, a),
        e(t + n, s, a),
        e(t + n, s, a + r),
        e(t + n, s + o, a + r),
      ],
      `fill="${h}" ${w}`,
    ),
  ].join("");
}
function isometricGrid(e, t, s, a, n, o, r) {
  let i = "";
  for (let l = o; l < a; l += o)
    i += svgPolyline([e(t + l, s), e(t + l, s + n)], r);
  for (let l = o; l < n; l += o)
    i += svgPolyline([e(t, s + l), e(t + a, s + l)], r);
  return i;
}
const ISO_STROKE = `stroke="${ISO_STROKE_COLOR}"`;
const ISO_OUTLINE = `${ISO_STROKE} stroke-width="1.3" stroke-linejoin="round"`;
const ISO_FACE_GRADIENTS = {
  top: "url(#face-top)",
  left: "url(#face-left)",
  right: "url(#face-right)",
};
const isometricShadow = (e, t, s, a, n, o) =>
  svgPolygon(
    [e(t + a, s), e(t + a + o, s), e(t + a + o, s + n), e(t + a, s + n)],
    'class="iso-shadow"',
  );
function drawRouter(e, t) {
  const s = createIsometricProjection(e, t),
    a = 70,
    n = 70,
    o = 33,
    r = createBoxFaces(s, 0, 0, 0, a, n, o);
  let i = isometricShadow(s, 0, 0, a, n, 34);
  i += isometricBox(s, 0, 0, 0, a, n, o, {
    ...ISO_FACE_GRADIENTS,
    sw: 2.2,
  });
  const l = [
    [9, 7],
    [19.5, 5],
    [28, 7],
    [39, 5],
  ];
  for (const [w, k] of l)
    i += isometricRectangle(
      r.top,
      w,
      30.5,
      k,
      5,
      `fill="var(--k-fill-a9c0ee)" ${ISO_STROKE} stroke-width="1.5"`,
    );
  i += isometricRectangle(
    r.top,
    30,
    32,
    3,
    2,
    `fill="${ISO_STROKE_COLOR}" stroke="none"`,
  );
  const c = r.left;
  ((i += isometricCircle(
    c,
    9.5,
    17,
    5,
    `fill="none" ${ISO_STROKE} stroke-width="2.6"`,
  )),
    (i += isometricRectangle(
      c,
      17,
      13,
      3.6,
      8,
      `fill="${ISO_STROKE_COLOR}" stroke="none"`,
    )),
    (i += isometricRectangle(
      c,
      15.5,
      20,
      6.6,
      2,
      `fill="${ISO_STROKE_COLOR}" stroke="none"`,
    )),
    (i += isometricRectangle(
      c,
      15.5,
      11.5,
      6.6,
      2,
      `fill="${ISO_STROKE_COLOR}" stroke="none"`,
    )),
    (i += isometricRectangle(
      c,
      30,
      8,
      13,
      11,
      `fill="var(--k-fill-f4f7fe)" ${ISO_STROKE} stroke-width="2"`,
    )));
  const h = r.right;
  ((i += isometricRectangle(
    h,
    9,
    9,
    52,
    15,
    `fill="var(--k-fill-e8effd)" ${ISO_STROKE} stroke-width="2"`,
  )),
    (i += isometricRectangle(
      h,
      13,
      12,
      44,
      9,
      `fill="var(--k-fill-c4d5f6)" ${ISO_OUTLINE}`,
    )));
  for (let w = 0; w < 3; w++)
    i += svgPolyline(
      [h(16, 14 + w * 2.6), h(54, 14 + w * 2.6)],
      'stroke="var(--k-line-8ea9e2)" stroke-width="0.9"',
    );
  const [d, y] = r.top(16, 8);
  return (
    (i += `<ellipse cx="${d}" cy="${y}" rx="5.2" ry="2.8" fill="var(--k-fill-c9d8f6)" ${ISO_STROKE} stroke-width="1.5"/>`),
    (i += `<path d="M${d - 3.2},${y} L${d - 1.4},${y - 40} L${d + 1.4},${y - 40} L${d + 3.2},${y} Z" fill="var(--k-fill-c9d8f6)" ${ISO_STROKE} stroke-width="1.6" stroke-linejoin="round"/>`),
    (i += `<circle cx="${d}" cy="${y - 43.5}" r="4" fill="var(--k-fill-f4f7fe)" ${ISO_STROKE} stroke-width="1.8"/>`),
    `<g class="device router">${i}</g>`
  );
}
function drawDnsServer(e, t) {
  const s = createIsometricProjection(e, t),
    a = 40.5,
    n = 40.5,
    o = 13.6,
    r = 2.9;
  let i = isometricShadow(s, 0, 0, a, n, 30);
  i += isometricBox(s, 1.5, 1.5, 0, a - 3, n - 3, o * 3 + r * 2, {
    top: "var(--k-fill-2f55c2)",
    left: "var(--k-fill-2f55c2)",
    right: "var(--k-fill-24479f)",
  });
  for (let l = 0; l < 3; l++) {
    const c = l * (o + r),
      h = createBoxFaces(s, 0, 0, c, a, n, o);
    ((i += isometricBox(s, 0, 0, c, a, n, o, {
      ...ISO_FACE_GRADIENTS,
      sw: 1.9,
    })),
      l === 0
        ? ((i += isometricRectangle(
            h.left,
            4,
            3.8,
            7,
            5.6,
            `fill="var(--k-fill-5ed6ea)" ${ISO_OUTLINE}`,
          )),
          (i += isometricRectangle(
            h.left,
            13,
            3.8,
            9,
            5.6,
            `fill="var(--k-fill-d7e3fa)" ${ISO_OUTLINE}`,
          )),
          (i += isometricRectangle(
            h.left,
            24,
            3.8,
            6,
            5.6,
            `fill="var(--k-fill-5ed6ea)" ${ISO_OUTLINE}`,
          )))
        : ((i += isometricRectangle(
            h.left,
            4,
            3.8,
            27,
            5.6,
            `fill="var(--k-fill-5ed6ea)" ${ISO_OUTLINE}`,
          )),
          (i += isometricRectangle(
            h.left,
            4,
            3.8,
            9,
            5.6,
            'fill="var(--k-fill-a6eef6)" stroke="none"',
          ))),
      (i += isometricRectangle(
        h.right,
        4,
        3.8,
        32,
        5.6,
        `fill="var(--k-fill-9fbcf0)" ${ISO_OUTLINE}`,
      )),
      l === 2 &&
        ((i += isometricRectangle(
          h.top,
          8.5,
          8.5,
          23.5,
          23.5,
          `fill="var(--k-fill-dfe8fb)" ${ISO_STROKE} stroke-width="1.6"`,
        )),
        (i += isometricGrid(
          h.top,
          8.5,
          8.5,
          23.5,
          23.5,
          2.6,
          'stroke="var(--k-line-7d9be0)" stroke-width="0.6"',
        ))));
  }
  return `<g class="device dns">${i}</g>`;
}
function drawWebServer(e, t) {
  const s = createIsometricProjection(e, t),
    a = 56.6,
    n = 56.6,
    o = 70,
    r = createBoxFaces(s, 0, 0, 0, a, n, o);
  let i = isometricShadow(s, 0, 0, a, n, 40);
  ((i += isometricBox(s, 0, 0, 0, a, n, o, {
    top: "url(#face-top)",
    left: "var(--k-fill-f4f8ff)",
    right: "url(#face-right)",
    sw: 2.3,
  })),
    (i += isometricRectangle(
      r.top,
      10,
      10,
      37,
      37,
      `fill="var(--k-fill-c9d8f4)" ${ISO_STROKE} stroke-width="1.2"`,
    )));
  for (let d = 2.2; d < 37; d += 2.2)
    i += svgPolyline(
      [r.top(10 + d, 10), r.top(10 + d, 47)],
      'stroke="var(--k-line-9db5e6)" stroke-width="0.7"',
    );
  const l = r.left;
  for (let d = 0; d < 3; d++) {
    const y = 6 + d * 20.5;
    ((i += isometricRectangle(
      l,
      4.5,
      y,
      47.5,
      17,
      `fill="var(--k-fill-f5f8ff)" ${ISO_STROKE} stroke-width="2"`,
    )),
      (i += isometricRectangle(
        l,
        7.5,
        y + 3,
        41.5,
        11,
        `fill="var(--k-fill-e3ebfc)" ${ISO_OUTLINE}`,
      )));
    const w = [
      [10, 5],
      [16, 3],
      [21, 3],
      [36, 3.4],
    ];
    for (const [k, g] of w)
      i += isometricRectangle(
        l,
        k,
        y + 5,
        g,
        7,
        'fill="var(--k-fill-3d63c9)" stroke="none"',
      );
    i += isometricRectangle(
      l,
      26,
      y + 6,
      7,
      5,
      'fill="var(--k-fill-a7bff0)" stroke="none"',
    );
  }
  const c = r.right,
    h = `fill="none" ${ISO_STROKE} stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"`;
  return (
    (i += isometricRectangle(
      c,
      8,
      34,
      40,
      27,
      `fill="var(--k-fill-c7d8f7)" ${h}`,
    )),
    (i += svgPolyline([c(8, 52), c(30, 52), c(30, 46), c(48, 46)], h)),
    (i += svgPolyline([c(14, 40), c(26, 40), c(26, 34)], h)),
    (i += svgPolyline([c(36, 61), c(36, 54), c(44, 54)], h)),
    (i += isometricRectangle(
      c,
      8,
      9,
      16,
      15,
      `fill="var(--k-fill-c7d8f7)" ${h}`,
    )),
    (i += isometricRectangle(
      c,
      30,
      9,
      16,
      15,
      `fill="var(--k-fill-c7d8f7)" ${h}`,
    )),
    (i += svgPolyline([c(30, 19), c(36, 19), c(36, 24)], h)),
    (i += `<circle cx="${c(47, 1)[0]}" cy="${c(47, 1)[1]}" r="2.6" fill="${ISO_STROKE_COLOR}"/>`),
    `<g class="device web">${i}</g>`
  );
}
function drawClientLaptop(e, t) {
  const s = createIsometricProjection(e, t),
    a = 56,
    n = 86,
    o = 5,
    r = createBoxFaces(s, 0, 0, 0, a, n, o);
  let i = isometricShadow(s, -4, 0, a + 4, n, 30);
  i += svgPolygon(
    [s(-4, n), s(a, n), s(a + 10, n + 8), s(-4, n + 8)],
    'class="iso-shadow"',
  );
  const l = 64,
    c = 3,
    h = 3,
    d = 82,
    y = (v) => (I, q) => s(v - (c * q) / l, h + d - I, o + q),
    w = y(-7),
    k = y(0),
    g = (v, I, q, re, C) => [
      v(I, q),
      v(I + re, q),
      v(I + re, q + C),
      v(I, q + C),
    ];
  ((i += svgPolygon(
    g(w, 0, 0, d, l),
    `fill="var(--k-fill-e2ebfc)" ${ISO_STROKE} stroke-width="2" stroke-linejoin="round"`,
  )),
    (i += svgPolygon(
      [w(0, 0), k(0, 0), k(0, l), w(0, l)],
      `fill="var(--k-fill-cddcf8)" ${ISO_STROKE} stroke-width="1.6" stroke-linejoin="round"`,
    )),
    (i += svgPolygon(
      [w(0, l), k(0, l), k(d, l), w(d, l)],
      `fill="var(--k-fill-cddcf8)" ${ISO_STROKE} stroke-width="1.6" stroke-linejoin="round"`,
    )),
    (i += svgPolygon(
      g(k, 0, 0, d, l),
      `fill="var(--k-fill-f4f7fe)" ${ISO_STROKE} stroke-width="2" stroke-linejoin="round"`,
    )),
    (i += svgPolygon(
      g(k, 4.5, 5, d - 9, l - 9.5),
      `fill="var(--k-fill-dce6fb)" ${ISO_STROKE} stroke-width="1.5" stroke-linejoin="round"`,
    )),
    (i += svgPolygon(
      g(k, 4.5, l - 14, d - 9, 9.5),
      `fill="var(--k-fill-f2f6fe)" ${ISO_STROKE} stroke-width="1.2" stroke-linejoin="round"`,
    )),
    (i += svgPolyline(
      [k(9, l - 9.3), k(24, l - 9.3)],
      'stroke="var(--k-line-9db5e8)" stroke-width="2.2" stroke-linecap="round"',
    )),
    (i += '<g class="screen-content">'),
    (i += svgPolygon(
      g(k, 10, 13, 22, 24),
      'fill="var(--k-fill-a9c0ec)" stroke="none"',
    )));
  for (let v = 0; v < 4; v++)
    i += svgPolyline(
      [k(38, 33 - v * 6), k(68, 33 - v * 6)],
      'stroke="var(--k-line-a9c0ec)" stroke-width="3.2" stroke-linecap="round" pathLength="1"',
    );
  ((i += "</g>"),
    (i += isometricBox(s, 0, 0, 0, a, n, o, {
      top: "var(--k-fill-f5f8ff)",
      left: "var(--k-fill-dfe8fc)",
      right: "var(--k-fill-cddcf8)",
      sw: 2.1,
    })));
  const T = r.top;
  i += isometricRectangle(
    T,
    6,
    9,
    27,
    68,
    `fill="var(--k-fill-dce7fb)" ${ISO_STROKE} stroke-width="1.6"`,
  );
  for (let v = 6 + 5.4; v < 33; v += 5.4)
    i += svgPolyline(
      [T(v, 9), T(v, 77)],
      `stroke="${ISO_STROKE_COLOR}" stroke-width="0.9"`,
    );
  for (let v = 9 + 4.85; v < 77; v += 4.85)
    i += svgPolyline(
      [T(6, v), T(33, v)],
      `stroke="${ISO_STROKE_COLOR}" stroke-width="0.9"`,
    );
  return (
    (i += isometricRectangle(
      T,
      38,
      28,
      13,
      30,
      `fill="var(--k-fill-c3d4f5)" ${ISO_OUTLINE}`,
    )),
    `<g class="device laptop">${i}</g>`
  );
}
function drawInternetCloud(e, t) {
  const s = [
      [-60, 10, 21],
      [-32, -16, 20],
      [-6, -36, 17],
      [22, -36, 26],
      [46, -16, 20],
      [58, 3, 22],
      [40, 22, 24],
      [-24, 24, 24],
      [8, 2, 32],
      [-20, 6, 26],
    ],
    a = (i, l = 0, c = 0) =>
      s
        .map(
          ([h, d, y]) =>
            `<circle cx="${e + h + l}" cy="${t + d + c}" r="${y}" ${i}/>`,
        )
        .join(""),
    n = e + 20,
    o = t,
    r = 19.5;
  return `<g class="device cloud">
    <clipPath id="cloud-clip">${a("")}</clipPath>
    <ellipse cx="${e + 12}" cy="${t + 44}" rx="80" ry="10" class="iso-shadow round"/>
    ${a(`fill="var(--k-fill-fdfdff)" ${ISO_STROKE} stroke-width="4.6"`)}
    <g clip-path="url(#cloud-clip)">
      ${a('fill="var(--k-fill-e3eaf8)"')}
      ${a('fill="var(--k-fill-fdfdff)"', 3, -4)}
    </g>
    <g fill="none" ${ISO_STROKE} stroke-width="2.4" stroke-linecap="round">
      <circle cx="${n}" cy="${o}" r="${r}" fill="var(--k-fill-fdfdff)"/>
      <ellipse cx="${n}" cy="${o}" rx="8.5" ry="${r}"/>
      <line x1="${n}" y1="${o - r}" x2="${n}" y2="${o + r}"/>
      <path d="M${n - r},${o} H${n + r}"/>
      <path d="M${n - 16},${o - 10} Q${n},${o - 5} ${n + 16},${o - 10} M${n - 16},${o + 10} Q${n},${o + 15} ${n + 16},${o + 10}"/>
    </g>
  </g>`;
}
const NETWORK_VIEWBOX = [45, 66, 810, 490];
const NETWORK_GRID_CENTER = [450, 311];
const NETWORK_BACKGROUND_BOUNDS =
  'x="-500" y="-500" width="1900" height="1500"';
const PACKET_COLORS = {
  idle: "var(--k-line-bccae6)",
  navy: "#0b3aa8",
  blue: "#1f6fe8",
  green: "#12a56b",
  amber: "#f2ac0a",
  violet: "#7656e0",
  teal: "#0e95a3",
  slate: "#5d6f95",
};
function createBidirectionalLanes(e, t, [s, a], [n, o], r = 5.5) {
  const i = Math.hypot(n - s, o - a),
    l = (-(o - a) / i) * r,
    c = ((n - s) / i) * r;
  return {
    [`${e}>${t}`]: [s + l, a + c, n + l, o + c],
    [`${t}>${e}`]: [n - l, o - c, s - l, a - c],
  };
}
const NETWORK_LANES = {
  "client>router": [262, 430, 371, 383],
  "router>client": [376, 355, 268, 403],
  "router>internet": [508.4, 357.1, 668.4, 434.8],
  "internet>router": [663.6, 444.6, 503.6, 366.9],
  "internet>dns": [690, 418, 690, 231],
  "dns>internet": [712, 229, 712, 404],
  "internet>web": [776, 418, 776, 254],
  "web>internet": [797, 264, 797, 438],
  ...createBidirectionalLanes("internet", "root", [799, 432], [928, 316]),
  ...createBidirectionalLanes("internet", "tld", [812, 457], [968, 440]),
  ...createBidirectionalLanes("internet", "auth", [796, 492], [925, 580]),
  ...createBidirectionalLanes("internet", "mx", [812, 455], [956, 395]),
};
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
const INTERNET_POSITION = [728, 460];
const DNS_POSITION = [701, 185];
const WEB_SERVER_POSITION = [812, 203];
const ROOT_SERVER_POSITION = [960, 300];
const TLD_SERVER_POSITION = [1005, 430];
const AUTH_SERVER_POSITION = [960, 575];
const MAIL_SERVER_POSITION = [1010, 380];
const NETWORK_NODE_CENTERS = {
  client: [214, 446],
  dns: [701, 180],
  router: [440, 360],
  internet: [732, 458],
  web: [812, 206],
  root: [960, 296],
  tld: [1005, 426],
  auth: [960, 571],
  mx: [1010, 378],
};
const NETWORK_NOTE_ANCHORS = {
  client: {
    x: 205,
    y: 372,
    side: "top",
  },
  router: {
    x: 440,
    y: 290,
    side: "top",
  },
  web: {
    x: 758,
    y: 200,
    side: "left",
  },
  dns: {
    x: 662,
    y: 212,
    side: "left",
  },
  internet: {
    x: 732,
    y: 396,
    side: "top",
  },
  mx: {
    x: 955,
    y: 345,
    side: "left",
  },
};
const NETWORK_FOCUS_GROUPS = {
  client: ["client"],
  local: ["client", "router"],
  lookup: ["client", "router", "internet", "dns"],
  root: ["client", "router", "internet", "dns", "root"],
  tld: ["client", "router", "internet", "dns", "root", "tld"],
  path: ["client", "router", "internet", "web"],
  mailhost: ["client", "router", "internet", "dns", "web"],
  servers: ["internet", "dns", "web", "mx"],
  full: [
    "client",
    "router",
    "dns",
    "internet",
    "web",
    "root",
    "tld",
    "auth",
    "mx",
  ],
};
const renderNodeLabel = (e, t, s, a, n = "start", o = "left-bottom") =>
  `<g class="node-label" data-origin="${o}"><text class="node-name" x="${e}" y="${t}" text-anchor="${n}">${translate(s)}</text>` +
  (a
    ? `<text class="node-ip" x="${e}" y="${t + 18}" text-anchor="${n}">${a}</text>`
    : "") +
  "</g>";
function renderNetworkDefs() {
  const e = (
    t,
  ) => `<marker id="head-${t}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6.2" markerHeight="6.2" orient="auto-start-reverse">
       <path d="M0,0.6 L10,5 L0,9.4 Z" fill="${PACKET_COLORS[t]}"/></marker>`;
  return `<defs>
    ${Object.keys(PACKET_COLORS).map(e).join("")}
    <pattern id="iso-grid" width="62.354" height="36" patternUnits="userSpaceOnUse" x="9" y="4">
      <path d="M0,0 L62.354,36 M62.354,0 L0,36" stroke="var(--k-line-e4eaf5)" stroke-width="1"/>
    </pattern>
    <!-- the grid fades into the panel towards the edges -->
    <radialGradient id="grid-vignette" gradientUnits="userSpaceOnUse" cx="${NETWORK_GRID_CENTER[0]}" cy="${NETWORK_GRID_CENTER[1]}" r="560">
      <stop offset="0" stop-color="var(--k-fill-fefeff)" stop-opacity="0"/>
      <stop offset="0.6" stop-color="var(--k-fill-fefeff)" stop-opacity="0.4"/>
      <stop offset="1" stop-color="var(--k-fill-fefeff)" stop-opacity="1"/>
    </radialGradient>
    <!-- soft ground shadows, darkest against the device -->
    <linearGradient id="shadow-fade" x1="0" y1="0.25" x2="1" y2="0.75">
      <stop offset="0" stop-color="var(--k-shadow-8d9ab3)" stop-opacity="0.3"/>
      <stop offset="1" stop-color="var(--k-shadow-8d9ab3)" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="shadow-round">
      <stop offset="0" stop-color="var(--k-shadow-8d9ab3)" stop-opacity="0.26"/>
      <stop offset="1" stop-color="var(--k-shadow-8d9ab3)" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="face-top" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="var(--k-fill-f8fbff)"/><stop offset="1" stop-color="var(--k-fill-e6eefc)"/>
    </linearGradient>
    <linearGradient id="face-left" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="var(--k-fill-eff5ff)"/><stop offset="1" stop-color="var(--k-fill-dae5fb)"/>
    </linearGradient>
    <linearGradient id="face-right" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="var(--k-fill-e0eafc)"/><stop offset="1" stop-color="var(--k-fill-c7d7f6)"/>
    </linearGradient>
  </defs>`;
}
const URL_BAR_SVG = `
  <g class="url-holder" transform="translate(60 334)"><g class="url-bar">
    <path d="M128 26 L140 58" class="url-leader"/>
    <rect class="url-box" width="168" height="26" rx="3"/>
    <g class="url-globe" transform="translate(9 6)">
      <circle cx="7" cy="7" r="6"/><ellipse cx="7" cy="7" rx="2.6" ry="6"/><path d="M1.4 5h11.2M1.4 9h11.2"/>
    </g>
    <g class="url-lock" transform="translate(10 5)">
      <path d="M3 7 V4.6 a3.5 3.5 0 0 1 7 0 V7"/><rect x="1" y="7" width="11" height="8" rx="1.6"/>
    </g>
    <text class="url-text" x="29" y="17.5"></text>
    <rect class="url-caret" x="29" y="6.5" width="1.6" height="13"/>
    <path class="url-check" d="M0 13.5 l3.5 3.5 l6.5 -7" pathLength="1"/>
  </g></g>`;
const renderNetworkNode = (e, t) => `<g class="node" data-node="${e}">${t}</g>`;
function renderNetworkDiagram() {
  const e = Object.entries(NETWORK_LANES)
    .map(([t, s]) => {
      const [a, n, o, r] = s.map((i) => i.toFixed(1));
      return `<path class="lane" data-lane="${t}" d="M${a},${n} L${o},${r}" marker-end="url(#head-idle)"/>`;
    })
    .join("");
  return `
  <svg class="network is-booting" viewBox="${NETWORK_VIEWBOX.join(" ")}" preserveAspectRatio="xMidYMid meet" data-t-label="Network diagram" aria-label="${translate("Network diagram")}">
    ${renderNetworkDefs()}
    <rect ${NETWORK_BACKGROUND_BOUNDS} fill="url(#iso-grid)"/>
    <rect ${NETWORK_BACKGROUND_BOUNDS} fill="url(#grid-vignette)"/>
    <g class="lanes">${e}</g>
    <g class="pulse-layer"></g>
    ${renderNetworkNode("internet", drawInternetCloud(...INTERNET_POSITION) + renderNodeLabel(INTERNET_POSITION[0] - 2, 524, ...NETWORK_NODE_LABELS.internet, "start", "center-top"))}
    ${renderNetworkNode("client", drawClientLaptop(240, 446) + renderNodeLabel(73, 494, ...NETWORK_NODE_LABELS.client, "start", "right-top") + URL_BAR_SVG)}
    ${renderNetworkNode("router", drawRouter(440, 339) + renderNodeLabel(407, 426, ...NETWORK_NODE_LABELS.router, "start", "left-top"))}
    ${renderNetworkNode("dns", drawDnsServer(...DNS_POSITION) + renderNodeLabel(654, 160, ...NETWORK_NODE_LABELS.dns, "end", "right-bottom"))}
    ${renderNetworkNode("web", drawWebServer(...WEB_SERVER_POSITION) + renderNodeLabel(773, 106, ...NETWORK_NODE_LABELS.web))}
    ${renderNetworkNode("root", drawDnsServer(...ROOT_SERVER_POSITION) + renderNodeLabel(925, 228, ...NETWORK_NODE_LABELS.root))}
    ${renderNetworkNode("tld", drawDnsServer(...TLD_SERVER_POSITION) + renderNodeLabel(970, 360, ...NETWORK_NODE_LABELS.tld))}
    ${renderNetworkNode("auth", drawDnsServer(...AUTH_SERVER_POSITION) + renderNodeLabel(925, 505, ...NETWORK_NODE_LABELS.auth))}
    ${renderNetworkNode("mx", drawWebServer(...MAIL_SERVER_POSITION) + renderNodeLabel(968, 286, ...NETWORK_NODE_LABELS.mx))}
    <g class="packet-layer"></g>
    <g class="note-layer"></g>
  </svg>`;
}
export {
  NETWORK_FOCUS_GROUPS,
  NETWORK_LANES,
  NETWORK_NODE_CENTERS,
  NETWORK_NODE_LABELS,
  NETWORK_NOTE_ANCHORS,
  NETWORK_ROUTES,
  NETWORK_SHORT_LABELS,
  PACKET_COLORS,
  renderNetworkDiagram,
};
