// Reconstructed from the distributed Protocol Explorer JavaScript.
import { translate } from "../i18n.js";
import {
  NETWORK_FOCUS_GROUPS,
  NETWORK_LANES,
  NETWORK_NODE_CENTERS,
  NETWORK_NODE_LABELS,
  NETWORK_NOTE_ANCHORS,
  NETWORK_ROUTES,
  PACKET_COLORS,
} from "./network-drawing.js";
import { animateWithClock, waitWithClock } from "./clock.js";
const NETWORK_SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const PACKET_PIXELS_PER_MILLISECOND = 0.21;
const PACKET_HOP_PAUSE_MS = 140;
const URL_TYPING_INTERVAL_MS = 55;
const CAMERA_MOVE_DURATION_MS = 1100;
const CAMERA_CONTENT_PADDING = 14;
const CAMERA_MIN_WIDTH = 470;
const URL_VISIBLE_CAMERA_FRAMES = ["client"];
const PACKET_TRAIL_OFFSETS = [10, 20, 30];
const NETWORK_NOTE_HOLD_MS = 1500;
const NETWORK_LABEL_SCALE_WIDTH = 700;
const NETWORK_MAX_LABEL_SCALE = 1.8;
const URL_BAR_SCALE_ORIGIN = [140, 58];
const URL_BAR_POSITION = [60, 334];
const WIDE_CHARACTER_PATTERN =
  /[\u1100-\u115f\u2e80-\u303e\u3041-\u33ff\u3400-\u4dbf\u4e00-\u9fff\ua960-\ua97f\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/;
const estimateTextUnits = (e) =>
  [...e].reduce(
    (t, s) =>
      t +
      (WIDE_CHARACTER_PATTERN.test(s)
        ? 2
        : BIDI_CONTROL_PATTERN.test(s)
          ? 0
          : 1),
    0,
  );
const BIDI_CONTROL_PATTERN = /[\u200e\u200f\u2066-\u2069]/;
const RTL_CHARACTER_PATTERN = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefc]/;
const measureSvgTextWidth = (e, t, s = 0) =>
  Math.max(t, e.getComputedTextLength() + s);
const easeInOutCubic = (e) =>
  e < 0.5 ? 4 * e * e * e : 1 - (-2 * e + 2) ** 3 / 2;
const easeOutBack = (e) => 1 + 2.2 * (e - 1) ** 3 + 1.2 * (e - 1) ** 2;
const easeOutCubic = (e) => 1 - (1 - e) ** 3;
const easeInCubic = (e) => e * e * e;
function createNetworkSvgElement(e, t, s) {
  const a = document.createElementNS(NETWORK_SVG_NAMESPACE, e);
  for (const [n, o] of Object.entries(t)) a.setAttribute(n, o);
  return (s?.appendChild(a), a);
}
const interpolateLinePoint = ([e, t, s, a], n) => ({
  x: e + (s - e) * n,
  y: t + (a - t) * n,
});
const getLineLength = ([e, t, s, a]) => Math.hypot(s - e, a - t);
function createNetworkAnimation(e) {
  const t = Object.fromEntries(
      [...e.querySelectorAll(".lane")].map((p) => [p.dataset.lane, p]),
    ),
    s = Object.fromEntries(
      [...e.querySelectorAll(".node")].map((p) => [p.dataset.node, p]),
    ),
    a = e.querySelector(".packet-layer"),
    n = e.querySelector(".pulse-layer"),
    o = e.querySelector(".note-layer"),
    r = e.querySelector(".url-bar"),
    i = r.querySelector(".url-box"),
    l = r.querySelector(".url-text"),
    c = r.querySelector(".url-caret"),
    h = r.querySelector(".url-check"),
    d = [...e.querySelectorAll(".screen-content > *")],
    y = new Set(),
    w = new Set();
  let k = Object.keys(s),
    g = !0,
    T = !1,
    v = "full",
    I = e.getAttribute("viewBox").split(" ").map(Number);
  const q = [...e.querySelectorAll(".node-label")],
    re = e.querySelector(".url-holder");
  let C = 1,
    Z = 1;
  function R(p) {
    if ((p.removeAttribute("transform"), C === 1)) return;
    const m = p.getBBox(),
      [S, $] = p.dataset.origin.split("-"),
      L =
        S === "left" ? m.x : S === "right" ? m.x + m.width : m.x + m.width / 2,
      E = $ === "top" ? m.y : m.y + m.height;
    p.setAttribute(
      "transform",
      `translate(${L.toFixed(1)} ${E.toFixed(1)}) scale(${C.toFixed(3)}) translate(${(-L).toFixed(1)} ${(-E).toFixed(1)})`,
    );
  }
  function x() {
    const p = e.getBoundingClientRect().width,
      m = p
        ? Math.min(
            NETWORK_MAX_LABEL_SCALE,
            Math.max(1, NETWORK_LABEL_SCALE_WIDTH / p),
          )
        : 1;
    if (Math.abs(m - C) < 0.01) return;
    ((C = m),
      (Z = 1 + (m - 1) * 0.6),
      e.classList.toggle("is-scaled", m > 1),
      q.forEach(R));
    const [S, $] = URL_BAR_SCALE_ORIGIN;
    re.setAttribute(
      "transform",
      `translate(${URL_BAR_POSITION[0] + S} ${URL_BAR_POSITION[1] + $}) scale(${Z.toFixed(3)}) translate(${-S} ${-$})`,
    );
  }
  function H(p) {
    const m = p.getBBox(),
      S = p.transform?.baseVal.consolidate()?.matrix;
    return S
      ? {
          x: S.a * m.x + S.e,
          y: S.d * m.y + S.f,
          width: S.a * m.width,
          height: S.d * m.height,
        }
      : m;
  }
  function we(p, m) {
    if (m) return s[p].getBBox();
    const S = [...s[p].children]
        .filter((E) => !E.classList.contains("url-holder"))
        .map(H),
      $ = Math.min(...S.map((E) => E.x)),
      L = Math.min(...S.map((E) => E.y));
    return {
      x: $,
      y: L,
      width: Math.max(...S.map((E) => E.x + E.width)) - $,
      height: Math.max(...S.map((E) => E.y + E.height)) - L,
    };
  }
  function ce(p) {
    ((v = p),
      r.classList.toggle("is-away", !URL_VISIBLE_CAMERA_FRAMES.includes(p)));
  }
  function P(p) {
    const S = NETWORK_FOCUS_GROUPS[p]
        .filter((F) => k.includes(F))
        .map((F) => we(F, URL_VISIBLE_CAMERA_FRAMES.includes(p))),
      $ = Math.min(...S.map((F) => F.x)) - CAMERA_CONTENT_PADDING,
      L = Math.min(...S.map((F) => F.y)) - CAMERA_CONTENT_PADDING,
      E = Math.max(...S.map((F) => F.x + F.width)) + CAMERA_CONTENT_PADDING - $,
      M =
        Math.max(...S.map((F) => F.y + F.height)) + CAMERA_CONTENT_PADDING - L,
      { width: X, height: U } = e.getBoundingClientRect(),
      Y = Math.min(X / E, U / M, X / CAMERA_MIN_WIDTH);
    return [$ + E / 2 - X / Y / 2, L + M / 2 - U / Y / 2, X / Y, U / Y];
  }
  function A(p) {
    ((I = p), e.setAttribute("viewBox", p.map((m) => m.toFixed(2)).join(" ")));
  }
  let _ = {
    cancelled: !1,
  };
  async function J(p, m, S) {
    _.cancelled = !0;
    const $ = (_ = {
        cancelled: !1,
      }),
      L = I;
    await animateWithClock(
      m,
      {
        get cancelled() {
          return S.cancelled || $.cancelled;
        },
      },
      (E) => {
        const M = easeInOutCubic(E);
        A(L.map((X, U) => X + (p[U] - X) * M));
      },
    );
  }
  function Re(p, m) {
    return (ce(p), J(P(p), CAMERA_MOVE_DURATION_MS, m));
  }
  function V() {
    ((_.cancelled = !0), x(), A(P(v)));
  }
  new ResizeObserver(V).observe(e);
  function ee(p, m) {
    const S = s[p];
    (m ? y.add(p) : y.delete(p),
      (S.style.opacity = m ? 1 : 0),
      S.removeAttribute("transform"));
  }
  async function Ke(p, m, { delay: S = 0, ring: $ = !0 } = {}) {
    const L = s[p];
    (y.add(p),
      (L.style.opacity = 0),
      S && (await waitWithClock(S, m)),
      await animateWithClock(650, m, (E) => {
        (L.setAttribute(
          "transform",
          `translate(0 ${(-46 * (1 - easeOutBack(E))).toFixed(2)})`,
        ),
          (L.style.opacity = Math.min(1, E * 2.4)));
      }),
      !m.cancelled && (L.removeAttribute("transform"), $ && An(p, "navy", m)));
  }
  async function Te(p, m, S = 0) {
    const $ = s[p];
    (y.delete(p),
      ($.style.opacity = 1),
      S && (await waitWithClock(S, m)),
      await animateWithClock(380, m, (L) => {
        ($.setAttribute(
          "transform",
          `translate(0 ${(-30 * easeInCubic(L)).toFixed(2)})`,
        ),
          ($.style.opacity = 1 - L));
      }),
      !m.cancelled && ($.removeAttribute("transform"), ($.style.opacity = 0)));
  }
  function et(p, m) {
    const S = s[p];
    animateWithClock(340, m, ($) => {
      $ < 1
        ? S.setAttribute(
            "transform",
            `translate(0 ${(-5 * Math.sin(Math.PI * $)).toFixed(2)})`,
          )
        : S.removeAttribute("transform");
    });
  }
  function Ms(p, m) {
    const [S, $] = NETWORK_LANES[p],
      L = interpolateLinePoint(NETWORK_LANES[p], m);
    (t[p].setAttribute("d", `M${S},${$} L${L.x.toFixed(1)},${L.y.toFixed(1)}`),
      (t[p].style.visibility = m > 0.01 ? "" : "hidden"));
  }
  async function Ra(p, m, S, $ = 0) {
    (Ms(p, m ? 0 : 1),
      $ && (await waitWithClock($, S)),
      await animateWithClock(m ? 520 : 300, S, (L) =>
        Ms(p, m ? easeOutCubic(L) : 1 - easeInCubic(L)),
      ));
  }
  function ms(p, m = 0) {
    for (const S of Object.keys(t)) {
      const [$, L] = S.split(">"),
        E = y.has($) && y.has(L),
        M = E !== w.has(S);
      (E ? w.add(S) : w.delete(S), p ? M && Ra(S, E, p, m) : Ms(S, E ? 1 : 0));
    }
  }
  function Ds(p) {
    ((g = p),
      d.forEach((m) => {
        ((m.style.opacity = p ? 1 : 0),
          (m.style.strokeDasharray = m.tagName === "polyline" ? 1 : ""),
          (m.style.strokeDashoffset =
            m.tagName === "polyline" ? (p ? 0 : 1) : ""));
      }));
  }
  async function En(p, m, S = 0) {
    (Ds(!p), (g = p), S && (await waitWithClock(S, m)));
    const $ = p ? d : [...d].reverse();
    for (const L of $) {
      if (m.cancelled) return;
      const E = L.tagName === "polyline";
      ((L.style.opacity = 1),
        await animateWithClock(p ? 240 : 110, m, (M) => {
          const X = p ? easeOutCubic(M) : 1 - M;
          E ? (L.style.strokeDashoffset = 1 - X) : (L.style.opacity = X);
        }),
        p || (L.style.opacity = 0));
    }
  }
  async function Xr(p, m, S) {
    const $ = Re(m, S);
    await waitWithClock(CAMERA_MOVE_DURATION_MS * 0.45, S);
    for (const [L, E] of p.entries()) {
      if (S.cancelled) return;
      const M = Ke(E, S);
      L === p.length - 1 ? await M : await waitWithClock(200, S);
    }
    S.cancelled || (ms(S), await $, await waitWithClock(300, S));
  }
  async function Qr({ nodes: p, frame: m }, S) {
    const $ = Object.keys(s).filter((L) => y.has(L) && !p.includes(L));
    ($.forEach((L) => y.delete(L)),
      ms(S),
      En(!1, S),
      $.forEach((L, E) => Te(L, S, 120 + E * 70)),
      await waitWithClock(250, S),
      await Re(m, S),
      await waitWithClock(250, S));
  }
  async function zr({ at: p, text: m, tone: S = "navy" }, $) {
    const {
        x: L,
        y: E,
        side: M,
      } = NETWORK_NOTE_ANCHORS[p] ?? {
        x: NETWORK_NODE_CENTERS[p][0],
        y: NETWORK_NODE_CENTERS[p][1],
        side: "top",
      },
      X = translate(m),
      U = createNetworkSvgElement(
        "g",
        {
          transform: `translate(${L} ${E}) scale(${Z.toFixed(3)})`,
        },
        o,
      ),
      Y = createNetworkSvgElement(
        "g",
        {
          class: `note ${S}`,
        },
        U,
      ),
      F = createNetworkSvgElement(
        "text",
        {
          class: "note-text",
          "dominant-baseline": "central",
        },
        Y,
      );
    F.textContent = X;
    const te = measureSvgTextWidth(F, estimateTextUnits(X) * 7.4, 3) + 30,
      [tt, pe] = M === "left" ? [-te - 9, -13] : [-te / 2, -38],
      Ft =
        M === "left"
          ? `M${tt},${pe} h${te} v8 l8,5 l-8,5 v8 h${-te} z`
          : `M${tt},${pe} h${te} v26 h${-te / 2 + 7} l-7,8 l-7,-8 h${-te / 2 + 7} z`;
    (F.setAttribute("x", tt + 23),
      F.setAttribute("y", pe + 13),
      Y.insertBefore(
        createNetworkSvgElement("circle", {
          class: "note-dot",
          cx: tt + 13,
          cy: pe + 13,
          r: 3.5,
        }),
        F,
      ),
      Y.insertBefore(
        createNetworkSvgElement("path", {
          class: "note-box",
          d: Ft,
        }),
        Y.firstChild,
      ),
      et(p, $),
      await animateWithClock(320, $, (Se) =>
        Y.setAttribute("transform", `scale(${easeOutBack(Se).toFixed(3)})`),
      ),
      await waitWithClock(NETWORK_NOTE_HOLD_MS, $),
      await animateWithClock(200, $, (Se) => {
        (Y.setAttribute(
          "transform",
          `scale(${(1 - easeInCubic(Se) * 0.3).toFixed(3)})`,
        ),
          (Y.style.opacity = 1 - Se));
      }),
      U.remove());
  }
  function kn(p, m) {
    const S = t[p];
    (S.classList.toggle("is-active", !!m),
      (S.style.stroke = m ? PACKET_COLORS[m] : ""),
      S.setAttribute("marker-end", `url(#head-${m || "idle"})`));
  }
  const Qt = {};
  function Zr(p, m) {
    ((Qt[p] = (Qt[p] ?? 0) + 1), kn(p, m));
  }
  function Ia(p) {
    ((Qt[p] = Math.max(0, (Qt[p] ?? 0) - 1)), Qt[p] || kn(p));
  }
  async function An(p, m, S) {
    const [$, L] = NETWORK_NODE_CENTERS[p],
      E = createNetworkSvgElement(
        "circle",
        {
          cx: $,
          cy: L,
          fill: "none",
          stroke: PACKET_COLORS[m],
          "stroke-width": 2,
        },
        n,
      );
    (await animateWithClock(700, S, (M) => {
      (E.setAttribute("r", 14 + M * 46),
        E.setAttribute("opacity", 0.6 * (1 - M)));
    }),
      E.remove());
  }
  function Jr(p, m, S = [], $ = !1) {
    const L = translate(m),
      E = S.map((G) => translate(G)),
      M = PACKET_TRAIL_OFFSETS.map((G, Ee) =>
        createNetworkSvgElement(
          "circle",
          {
            r: 3.6 - Ee,
            fill: PACKET_COLORS[p],
            opacity: 0.45 - Ee * 0.12,
          },
          a,
        ),
      ),
      X = createNetworkSvgElement(
        "g",
        {
          class: "packet",
        },
        a,
      );
    (createNetworkSvgElement(
      "circle",
      {
        r: 13,
        fill: PACKET_COLORS[p],
        opacity: 0.18,
      },
      X,
    ),
      createNetworkSvgElement(
        "circle",
        {
          r: 6,
          fill: PACKET_COLORS[p],
          stroke: "var(--panel)",
          "stroke-width": 2,
        },
        X,
      ));
    const U = 15,
      Y = $ ? 14 : 0,
      F = E.length ? E.length * U + 9 : 0,
      te = createNetworkSvgElement(
        "g",
        {
          class: `packet-tag ${p}`,
          transform: `translate(0 -16) scale(${Z.toFixed(3)})`,
        },
        X,
      ),
      tt = E.map((G, Ee) => {
        const st = createNetworkSvgElement(
          "text",
          {
            y: -F + 6 + Ee * U,
            "dominant-baseline": "hanging",
            class: "packet-field",
          },
          te,
        );
        return ((st.textContent = G), st);
      }),
      pe = createNetworkSvgElement(
        "text",
        {
          "text-anchor": "middle",
          "dominant-baseline": "central",
          x: Y / 2,
          y: -F - 10.5,
          class: "packet-label",
        },
        te,
      );
    pe.textContent = L;
    const Ft = measureSvgTextWidth(pe, estimateTextUnits(L) * 7.6),
      Se = Math.max(
        Ft + 16 + Y,
        ...tt.map(
          (G, Ee) =>
            measureSvgTextWidth(G, estimateTextUnits(E[Ee]) * 6.2) + 16,
        ),
      );
    if (
      (tt.forEach((G, Ee) => {
        const st = RTL_CHARACTER_PATTERN.test(E[Ee]);
        (G.setAttribute("x", st ? Se / 2 - 8 : -Se / 2 + 8),
          st && G.setAttribute("text-anchor", "end"));
      }),
      te.insertBefore(
        createNetworkSvgElement("rect", {
          x: -Se / 2,
          y: -F - 22,
          width: Se,
          height: 22,
          rx: 3,
          fill: PACKET_COLORS[p],
        }),
        pe,
      ),
      F &&
        te.insertBefore(
          createNetworkSvgElement("rect", {
            x: -Se / 2,
            y: -F - 4,
            width: Se,
            height: F + 4,
            rx: 3,
            class: "packet-body",
            stroke: PACKET_COLORS[p],
          }),
          te.firstChild,
        ),
      $)
    ) {
      const G = -Ft / 2 - 4;
      createNetworkSvgElement(
        "path",
        {
          class: "packet-lock",
          d: `M${G - 6},${-F - 10} v-2.4 a3,3 0 0 1 6,0 v2.4 M${G - 7.5},${-F - 10} h9 v6.5 h-9 z`,
        },
        te,
      );
    }
    return {
      g: X,
      trail: M,
    };
  }
  const Hs = (p, m, S = 1) =>
    p.setAttribute(
      "transform",
      `translate(${m.x.toFixed(1)} ${m.y.toFixed(1)}) scale(${S.toFixed(3)})`,
    );
  async function Oa(
    {
      from: p,
      to: m,
      color: S,
      label: $,
      payload: L,
      locked: E,
      lost: M,
      quick: X,
    },
    U,
  ) {
    const Y = NETWORK_ROUTES[`${p}>${m}`],
      F = X
        ? PACKET_PIXELS_PER_MILLISECOND * 2.4
        : PACKET_PIXELS_PER_MILLISECOND,
      te = M ? Y.findIndex((G) => G.includes("internet")) : -1,
      tt = Y.filter((G, Ee) => te < 0 || Ee <= te);
    tt.forEach((G) => Zr(G, S));
    const pe = Jr(S, $, L, E),
      Ft = interpolateLinePoint(NETWORK_LANES[Y[0]], 0);
    await animateWithClock(X ? 140 : 220, U, (G) =>
      Hs(pe.g, Ft, easeOutBack(G)),
    );
    let Se = Ft;
    for (const [G, Ee] of Y.entries()) {
      if (U.cancelled) return;
      const st = NETWORK_LANES[Ee],
        xn = G === te ? 0.55 : 1;
      if (
        (await animateWithClock((getLineLength(st) * xn) / F, U, (Ha) => {
          ((Se = interpolateLinePoint(st, Ha * xn)),
            Hs(pe.g, Se),
            pe.trail.forEach((_a, ai) => {
              const Fa = interpolateLinePoint(
                st,
                Math.max(
                  0,
                  Ha * xn - PACKET_TRAIL_OFFSETS[ai] / getLineLength(st),
                ),
              );
              (_a.setAttribute("cx", Fa.x), _a.setAttribute("cy", Fa.y));
            }));
        }),
        U.cancelled)
      )
        return;
      if (G === te) return ti(pe, Se, tt, U);
      (et(Ee.split(">")[1], U),
        G < Y.length - 1 &&
          (await waitWithClock(X ? 40 : PACKET_HOP_PAUSE_MS, U)));
    }
    (An(m, S, U),
      await animateWithClock(180, U, (G) => {
        (Hs(pe.g, Se, 1 - easeInCubic(G)),
          pe.trail.forEach((Ee) => Ee.setAttribute("opacity", 0.3 * (1 - G))));
      }),
      pe.g.remove(),
      pe.trail.forEach((G) => G.remove()),
      Y.forEach(Ia),
      await waitWithClock(150, U));
  }
  async function ei({ packets: p, spacing: m = 480 }, S) {
    const $ = [];
    for (const [L, E] of p.entries()) {
      if (S.cancelled) return;
      ($.push(Oa(E, S)), L < p.length - 1 && (await waitWithClock(m, S)));
    }
    await Promise.all($);
  }
  async function ti(p, m, S, $) {
    const L = createNetworkSvgElement(
      "path",
      {
        class: "drop-cross",
        d: "M-6,-6 L6,6 M6,-6 L-6,6",
        transform: `translate(${m.x} ${m.y})`,
      },
      a,
    );
    (await animateWithClock(520, $, (E) => {
      (Hs(
        p.g,
        {
          x: m.x,
          y: m.y + 26 * easeInCubic(E),
        },
        1 - 0.4 * E,
      ),
        (p.g.style.opacity = 1 - E),
        p.trail.forEach((M) => M.setAttribute("opacity", 0.3 * (1 - E))),
        L.setAttribute(
          "transform",
          `translate(${m.x} ${m.y}) scale(${easeOutBack(Math.min(1, E * 2)).toFixed(3)})`,
        ));
    }),
      p.g.remove(),
      p.trail.forEach((E) => E.remove()),
      S.forEach(Ia),
      await waitWithClock(500, $),
      await animateWithClock(250, $, (E) => (L.style.opacity = 1 - E)),
      L.remove());
  }
  let Na = {};
  function qa(p) {
    Na = p;
    for (const [m, S] of Object.entries(s)) {
      const [$, L] = p[m] ?? NETWORK_NODE_LABELS[m],
        E = [translate($), L],
        M = [S.querySelector(".node-name"), S.querySelector(".node-ip")],
        X = S.querySelector(".node-label");
      M.forEach((U, Y) => {
        if (!U || U.textContent === E[Y]) return;
        if (!(y.has(m) && S.style.opacity !== "0"))
          return ((U.textContent = E[Y]), R(X));
        U.animate(
          [
            {
              opacity: 1,
            },
            {
              opacity: 0,
            },
          ],
          {
            duration: 140,
            fill: "forwards",
          },
        ).onfinish = (te) => {
          ((U.textContent = E[Y]),
            R(X),
            te.target.cancel(),
            U.animate(
              [
                {
                  opacity: 0,
                },
                {
                  opacity: 1,
                },
              ],
              {
                duration: 220,
              },
            ));
        };
      });
    }
  }
  function Ma(p, m) {
    (r.classList.toggle("is-secure", !!m), (l.textContent = p));
    const S = l.getComputedTextLength();
    (i.setAttribute("width", (S + 58).toFixed(1)),
      h.setAttribute("transform", `translate(${(S + 38).toFixed(1)} 0)`));
  }
  async function si(p, m, S) {
    (Ma(p, m),
      (l.textContent = ""),
      c.setAttribute("x", 29),
      r.classList.add("is-visible", "is-typing"),
      await waitWithClock(400, S));
    for (let $ = 1; $ <= p.length; $++) {
      if (S.cancelled) return;
      ((l.textContent = p.slice(0, $)),
        c.setAttribute("x", 30 + l.getComputedTextLength()),
        await waitWithClock(URL_TYPING_INTERVAL_MS, S));
    }
    S.cancelled ||
      (r.classList.remove("is-typing"),
      et("client", S),
      await waitWithClock(500, S));
  }
  async function ni(p) {
    (await waitWithClock(200, p),
      await En(!0, p),
      !p.cancelled &&
        (r.classList.add("is-loaded"),
        An("client", "green", p),
        await waitWithClock(500, p)));
  }
  function Da() {
    (r.classList.remove("is-visible", "is-typing", "is-loaded"),
      (l.textContent = ""));
  }
  return (
    Object.keys(t).forEach((p) => Ms(p, 0)),
    {
      run(p, m) {
        return p.type === "packet"
          ? Oa(p, m)
          : p.type === "stream"
            ? ei(p, m)
            : p.type === "type-url"
              ? si(p.text, p.secure, m)
              : p.type === "focus"
                ? Qr(p, m)
                : p.type === "show"
                  ? Xr(p.nodes, p.frame, m)
                  : p.type === "camera"
                    ? Re(p.frame, m)
                    : p.type === "render"
                      ? ni(m)
                      : p.type === "note"
                        ? zr(p, m)
                        : Promise.resolve();
      },
      retext() {
        qa(Na);
      },
      overview(p, m = {}) {
        ((k = p),
          qa(m),
          Object.keys(s).forEach((S) => ee(S, k.includes(S))),
          ms(),
          Da(),
          Ds(!0),
          ce("full"),
          V());
      },
      apply(p) {
        (p.type === "focus" &&
          (Object.keys(s).forEach((m) => ee(m, p.nodes.includes(m))),
          ms(),
          Da(),
          Ds(!1),
          ce(p.frame),
          V()),
          p.type === "type-url" &&
            (Ma(p.text, p.secure), r.classList.add("is-visible")),
          p.type === "show" && (p.nodes.forEach((m) => ee(m, !0)), ms()),
          (p.type === "show" || p.type === "camera") && (ce(p.frame), V()),
          p.type === "render" && (Ds(!0), r.classList.add("is-loaded")));
      },
      snapshot() {
        return {
          view: I,
          visible: new Set(y),
          lanes: new Set(w),
          page: g,
          fresh: !T,
        };
      },
      morph(p, m) {
        ((T = !0), e.classList.remove("is-booting"));
        const S = NETWORK_FOCUS_GROUPS.full.filter(
            (E) => y.has(E) && !p.visible.has(E),
          ),
          $ = [...p.visible].filter((E) => !y.has(E));
        if (!p.fresh) {
          const E = I;
          (A(p.view), J(E, CAMERA_MOVE_DURATION_MS * 0.8, m));
        }
        ($.forEach((E, M) => Te(E, m, M * 60)),
          S.forEach((E, M) =>
            Ke(E, m, {
              delay: (p.fresh ? 150 : 250) + M * 110,
              ring: !1,
            }),
          ));
        const L = S.length ? 500 + S.length * 110 : 0;
        for (const E of Object.keys(t)) {
          const M = w.has(E);
          M !== p.lanes.has(E) && Ra(E, M, m, M ? L : 0);
        }
        g !== p.page && En(g, m, g ? L + 200 : 0);
      },
      clear() {
        for (const p of [...a.children, ...o.children])
          p.animate(
            [
              {
                opacity: 1,
              },
              {
                opacity: 0,
              },
            ],
            {
              duration: 160,
            },
          ).onfinish = () => p.remove();
        (n.replaceChildren(),
          Object.keys(t).forEach((p) => {
            ((Qt[p] = 0), kn(p));
          }));
      },
    }
  );
}
export { createNetworkAnimation };
