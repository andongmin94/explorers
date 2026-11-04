// Reconstructed from the distributed Protocol Explorer JavaScript.
import {
  EASE_OUT_EXPO,
  prefersReducedMotion,
  smoothScrollTo,
} from "./motion.js";
import {
  escapeHtml,
  isolateLtrText,
  localizedUpperCase,
  translate,
} from "../i18n.js";
import { NETWORK_NODE_LABELS } from "../simulation/network-drawing.js";
import {
  SEQUENCE_ANIMATION_TIMINGS,
  buildSequenceLayout,
  formatElapsedTimeBreak,
} from "../simulation/timeline.js";
import { playbackClock } from "../simulation/clock.js";
const SEQUENCE_SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const SEQUENCE_LEFT_PADDING = 78;
const SEQUENCE_RIGHT_PADDING = 30;
const SEQUENCE_MIN_LANE_WIDTH = 124;
const SEQUENCE_LOCK_PATH =
  "M-3.2 -1 V-2.6 a3.2 3.2 0 0 1 6.4 0 V-1 M-4.4 -1 h8.8 v6.4 h-8.8 z";
function renderSequencePanel() {
  return `
  <div class="sequence" data-t-label="Sequence diagram" aria-label="${translate("Sequence diagram")}">
    <div class="seq-head"></div>
    <div class="seq-scroll"><svg class="seq-svg" xmlns="${SEQUENCE_SVG_NAMESPACE}"></svg></div>
  </div>`;
}
const getLifelineName = (e, t) =>
  translate((e.labels?.[t] ?? NETWORK_NODE_LABELS[t])[0]);
function getLifelineAddress(e, t, s) {
  const a = (e.labels?.[t] ?? NETWORK_NODE_LABELS[t])[1];
  return a || (s.packets.find((n) => n.p.from === t)?.p.row.src ?? "");
}
function renderSequenceArrow(e, t, s) {
  const { p: a } = e,
    n = t[a.from],
    o = a.lost ? (t[a.from] + t[a.to]) / 2 : t[a.to],
    [r, i] = [e.ySent, a.lost ? (e.ySent + e.yArrived) / 2 : e.yArrived],
    l = Math.hypot(o - n, i - r),
    [c, h] = [(o - n) / l, (i - r) / l],
    d = a.lost ? 0 : 9,
    [y, w] = [o - c * d, i - h * d];
  let k = (Math.atan2(i - r, o - n) * 180) / Math.PI;
  (k > 90 && (k -= 180), k < -90 && (k += 180));
  const g = a.row,
    T = `${isolateLtrText(`#${e.index + 1} · ${g.time} · ${g.src} → ${g.dst} · ${g.proto}`)} · ${translate(g.info)} · ${isolateLtrText(g.len)}`,
    v = a.lost
      ? `<path class="seq-cross" d="M${o - 6},${i - 6} L${o + 6},${i + 6} M${o + 6},${i - 6} L${o - 6},${i + 6}"/>`
      : `<path class="seq-tip" d="M${o},${i} L${y - h * 4.5},${w + c * 4.5} L${y + h * 4.5},${w - c * 4.5} Z"/>`;
  return `
    <g class="seq-arrow c-${a.color}${a.lost ? " is-lost" : ""}" data-packet="${e.index}" data-len="${l.toFixed(1)}" data-geo="${[n, r, o, i, k.toFixed(2)].join(" ")}">
      <title>${escapeHtml(T)}</title>
      <text class="seq-time" x="${SEQUENCE_LEFT_PADDING - 14}" y="${r}">${escapeHtml(g.time)}</text>
      <circle class="seq-dot" cx="${n}" cy="${r}" r="2.6"/>
      <line class="seq-line" x1="${n}" y1="${r}" x2="${y}" y2="${w}"/>
      ${v}
      <g class="seq-label">
        <rect class="seq-label-bg" y="-17" height="15" rx="2"/>
        ${a.locked ? `<path class="seq-lock" d="${SEQUENCE_LOCK_PATH}"/>` : ""}
        <text class="seq-label-text" y="-6" text-anchor="middle">${escapeHtml(translate(a.label))}</text>
      </g>
    </g>`;
}
function renderSequenceNote(e, t, s) {
  const a = e.lane,
    n = a && s.indexOf(a) === s.length - 1 && s.length > 1,
    o = a
      ? t[a]
      : e.between
        ? (t[e.between[0]] + t[e.between[1]]) / 2
        : t[s[0]],
    r = a ? (n ? "left" : "right") : "center";
  return `
    <g class="seq-note tone-${e.e.tone ?? "navy"}" data-note="${e.index}" data-side="${r}" transform="translate(${o} ${e.y})">
      ${a ? '<circle class="seq-note-dot" r="3.5"/>' : ""}
      <rect class="seq-note-bg" y="-10" height="20" rx="2"/>
      <text class="seq-note-text" y="0.5">${escapeHtml(translate(e.e.text))}</text>
    </g>`;
}
function renderSequenceTimeBreak(e, t) {
  const s = (a) => {
    let n = `M0 ${a}`;
    for (let o = 0; o < t; o += 12) n += " q3 -3 6 0 q3 3 6 0";
    return n;
  };
  return `
    <g class="seq-break" transform="translate(0 ${e.y})">
      <rect class="seq-break-band" x="0" y="-15" width="${t}" height="30"/>
      <path class="seq-wave" d="${s(-6)} ${s(6)}"/>
      <g transform="translate(${t / 2} 0)">
        <rect class="seq-break-bg" y="-10" height="20" rx="10"/>
        <text class="seq-break-text" y="0.5" text-anchor="middle">${escapeHtml(translate(formatElapsedTimeBreak(e.seconds)))}</text>
      </g>
    </g>`;
}
function polygonsOverlap(e, t) {
  for (const s of [e, t])
    for (let a = 0; a < s.length; a++) {
      const [n, o] = [s[a], s[(a + 1) % s.length]],
        [r, i] = [o[1] - n[1], n[0] - o[0]],
        l = (d) => d.map(([y, w]) => y * r + w * i),
        [c, h] = [l(e), l(t)];
      if (Math.max(...c) <= Math.min(...h) || Math.max(...h) <= Math.min(...c))
        return !1;
    }
  return !0;
}
const rectanglePolygon = (e, t, s, a) => [
  [e, t],
  [s, t],
  [s, a],
  [e, a],
];
function layoutSequenceLabels(e) {
  const t = (i) => i.querySelector("text").getComputedTextLength(),
    s = [...e.querySelectorAll(".seq-note")].map((i) => ({
      g: i,
      w: t(i),
    })),
    a = [...e.querySelectorAll(".seq-arrow")].map((i) => ({
      arrow: i,
      g: i.querySelector(".seq-label"),
      w: t(i.querySelector(".seq-label")),
    })),
    n = [...e.querySelectorAll(".seq-break")].map((i) => ({
      g: i,
      w: t(i),
    })),
    o = [...e.querySelectorAll(".seq-step")].map((i) => ({
      g: i,
      w: t(i),
    })),
    r = [...e.querySelectorAll(".seq-cross")].map((i) => {
      const [l, c] = i
        .getAttribute("d")
        .match(/[-\d.]+/g)
        .map(Number);
      return rectanglePolygon(l - 3, c - 3, l + 15, c + 15);
    });
  (o.forEach(({ g: i, w: l }) =>
    i.querySelector("line").setAttribute("x1", 12 + l + 10),
  ),
    s.forEach(({ g: i, w: l }) => {
      const c = i.querySelector("text"),
        h = i.querySelector("rect"),
        d = i.dataset.side,
        y = d === "right" ? 10 : d === "left" ? -10 - l - 16 : -l / 2 - 8;
      (h.setAttribute("x", y),
        h.setAttribute("width", l + 16),
        c.setAttribute("x", y + 8));
      const [w, k] = i
        .getAttribute("transform")
        .match(/[-\d.]+/g)
        .map(Number);
      r.push(rectanglePolygon(w + y, k - 10, w + y + l + 16, k + 10));
    }),
    n.forEach(({ g: i, w: l }) => {
      const c = i.querySelector(".seq-break-bg");
      (c.setAttribute("x", -l / 2 - 10), c.setAttribute("width", l + 20));
    }),
    a.sort((i, l) => l.w - i.w),
    a.forEach(({ arrow: i, g: l, w: c }) => {
      const h = l.querySelector("text"),
        d = l.querySelector(".seq-lock"),
        y = d ? 14 : 0;
      (h.setAttribute("x", y / 2),
        d && d.setAttribute("transform", `translate(${-c / 2 - 4} -10)`));
      const w = l.querySelector("rect");
      (w.setAttribute("x", -c / 2 - 5 - y / 2),
        w.setAttribute("width", c + 10 + y));
      const [k, g, T, v, I] = i.dataset.geo.split(" ").map(Number),
        q = c / 2 + 6 + y / 2,
        [re, C] = [
          Math.cos((I * Math.PI) / 180),
          Math.sin((I * Math.PI) / 180),
        ],
        Z = [
          [-q - 2, -21],
          [q + 2, -21],
          [q + 2, 3],
          [-q - 2, 3],
        ].map(([A, _]) => [A * re - _ * C, A * C + _ * re]),
        R = (A) => {
          const [_, J] = [k + (T - k) * A, g + (v - g) * A];
          return {
            cx: _,
            cy: J,
            box: Z.map(([Re, V]) => [_ + Re, J + V]),
          };
        },
        x = Math.hypot(T - k, v - g),
        H = Math.min(0.45, (q + 8) / x),
        we = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.12, 0.88]
          .filter((A) => A >= H && A <= 1 - H)
          .map(R),
        ce = (A) => r.filter((_) => polygonsOverlap(A.box, _)).length,
        P =
          we.find((A) => !ce(A)) ??
          [...we, R(0.5)].sort((A, _) => ce(A) - ce(_))[0];
      (r.push(P.box),
        l.setAttribute(
          "transform",
          `translate(${P.cx.toFixed(1)} ${P.cy.toFixed(1)}) rotate(${I})`,
        ));
    }));
}
function drawSequenceDiagram(e, t) {
  const s = e.querySelector(".seq-scroll"),
    a = e.querySelector(".seq-svg"),
    n = buildSequenceLayout(t),
    o = Math.max(
      s.clientWidth,
      SEQUENCE_LEFT_PADDING +
        SEQUENCE_RIGHT_PADDING +
        n.lifelines.length * SEQUENCE_MIN_LANE_WIDTH,
    ),
    r =
      (o - SEQUENCE_LEFT_PADDING - SEQUENCE_RIGHT_PADDING) / n.lifelines.length,
    i = Object.fromEntries(
      n.lifelines.map((d, y) => [
        d,
        Math.round(SEQUENCE_LEFT_PADDING + r * (y + 0.5)),
      ]),
    ),
    l = e.querySelector(".seq-head");
  ((l.innerHTML =
    `<div class="seq-head-track" style="width:${o}px">` +
    n.lifelines
      .map(
        (d) =>
          `<span class="seq-who" style="left:${i[d]}px; max-width:${Math.floor(r - 10)}px"><b>${escapeHtml(getLifelineName(t, d))}</b><i>${escapeHtml(getLifelineAddress(t, d, n))}</i></span>`,
      )
      .join("") +
    "</div>"),
    (l.style.height = `${Math.max(46, ...[...l.querySelectorAll(".seq-who")].map((d) => d.offsetHeight + 6))}px`));
  const c = n.lifelines
      .map(
        (d) =>
          `<line class="seq-life" x1="${i[d]}" y1="0" x2="${i[d]}" y2="${n.height}"/>`,
      )
      .join(""),
    h = n.steps
      .map(
        (d) => `
    <g class="seq-step" data-step="${d.step}" transform="translate(0 ${d.y})">
      <line class="seq-step-line" x1="10" y1="0" x2="${o - 10}" y2="0"/>
      <text class="seq-step-text" x="12" y="0.5"><tspan class="seq-step-num">${translate(
        "STEP {n}",
        {
          n: d.step + 1,
        },
      )}</tspan> · ${escapeHtml(localizedUpperCase(translate(t.steps[d.step].title)))}</text>
    </g>`,
      )
      .join("");
  (a.setAttribute("viewBox", `0 0 ${o} ${n.height}`),
    a.setAttribute("width", o),
    a.setAttribute("height", n.height),
    (a.innerHTML =
      c +
      n.breaks.map((d) => renderSequenceTimeBreak(d, o)).join("") +
      h +
      n.notes.map((d) => renderSequenceNote(d, i, n.lifelines)).join("") +
      [
        ...n.packets.filter((d) => !d.p.lost),
        ...n.packets.filter((d) => d.p.lost),
      ]
        .map((d) => renderSequenceArrow(d, i))
        .join("")),
    layoutSequenceLabels(a),
    (e._layout = n),
    (e._lesson = t),
    (e._width = s.clientWidth),
    (e.dataset.lesson = t.id),
    (s.scrollTop = 0),
    (s.scrollLeft = 0),
    syncSequenceHeaderScroll(e));
}
const syncSequenceHeaderScroll = (e) => {
  const t = e.querySelector(".seq-head-track");
  t &&
    (t.style.transform = `translateX(${-e.querySelector(".seq-scroll").scrollLeft}px)`);
};
function refreshSequenceDiagram(e) {
  if (!e._lesson || e.dataset.lesson !== e._want) return;
  const t = e.querySelector(".seq-scroll"),
    s = t.scrollTop;
  (drawSequenceDiagram(e, e._lesson),
    e._state && applySequenceState(e, e._state, e._lesson),
    e
      .querySelector(".seq-svg")
      .getAnimations({
        subtree: !0,
      })
      .forEach((a) => a.finish()),
    (t.scrollTop = s));
}
function bindSequenceScrolling(e) {
  const t = e.querySelector(".seq-scroll");
  (t.addEventListener("scroll", () => syncSequenceHeaderScroll(e), {
    passive: !0,
  }),
    new ResizeObserver(
      () =>
        Math.abs(t.clientWidth - e._width) >= 1 && refreshSequenceDiagram(e),
    ).observe(t));
}
const getSequenceElementOpacity = (e) => Number(getComputedStyle(e).opacity);
function revealSequenceElement(e, t, s) {
  const a = getSequenceElementOpacity(e);
  if (
    (e
      .getAnimations({
        subtree: !0,
      })
      .forEach((l) => l.cancel()),
    e.classList.add("is-shown"),
    prefersReducedMotion() ||
      ((t === "fade" || a > 0) &&
        (e.animate(
          [
            {
              opacity: a,
            },
            {
              opacity: 1,
            },
          ],
          {
            duration: 260 * (1 - a),
            delay: a > 0 ? 0 : s,
            easing: "ease-out",
            fill: "backwards",
          },
        ),
        t === "fade" || a > 0.5)))
  )
    return;
  const n = e.querySelector(".seq-line"),
    o = Number(e.dataset.len),
    r =
      t === "quick"
        ? SEQUENCE_ANIMATION_TIMINGS.quick
        : SEQUENCE_ANIMATION_TIMINGS.draw,
    i = (l, c, h) =>
      playbackClock.track(
        l.animate(c, {
          delay: s,
          fill: "backwards",
          ...h,
        }),
      );
  (s &&
    i(
      e,
      [
        {
          opacity: 0,
        },
        {
          opacity: 1,
        },
      ],
      {
        duration: 1,
      },
    ),
    e.classList.contains("is-lost")
      ? i(
          n,
          [
            {
              opacity: 0,
            },
            {
              opacity: 1,
            },
          ],
          {
            duration: r,
            easing: "ease-out",
          },
        )
      : i(
          n,
          [
            {
              strokeDasharray: `${o} ${o}`,
              strokeDashoffset: o,
            },
            {
              strokeDasharray: `${o} ${o}`,
              strokeDashoffset: 0,
            },
          ],
          {
            duration: r,
            easing: EASE_OUT_EXPO,
          },
        ),
    i(
      e.querySelector(".seq-tip, .seq-cross"),
      [
        {
          opacity: 0,
        },
        {
          opacity: 1,
        },
      ],
      {
        duration: 160,
        delay: s + r * 0.7,
        easing: "ease-out",
      },
    ),
    i(
      e.querySelector(".seq-label"),
      [
        {
          opacity: 0,
        },
        {
          opacity: 1,
        },
      ],
      {
        duration: 240,
        delay: s + r * 0.3,
        easing: "ease-out",
      },
    ));
}
function hideSequenceElement(e) {
  const t = getSequenceElementOpacity(e);
  (e
    .getAnimations({
      subtree: !0,
    })
    .forEach((s) => s.cancel()),
    e.classList.remove("is-shown"),
    !prefersReducedMotion() &&
      t > 0 &&
      e.animate(
        [
          {
            opacity: t,
          },
          {
            opacity: 0,
          },
        ],
        {
          duration: 180 * t,
          easing: t < 1 ? "linear" : "ease-in",
        },
      ));
}
function applySequenceState(e, t, s) {
  const a = e.querySelector(".seq-svg"),
    n = e._layout,
    o = [];
  let r = 0;
  a.querySelectorAll(".seq-arrow").forEach((w) => {
    const k = Number(w.dataset.packet),
      g = t.packets[k],
      T = !t.started || g !== "future",
      v = t.started && g === "current";
    (T &&
      !w.classList.contains("is-shown") &&
      o.push({
        g: w,
        current: v,
        y: n.packets[k].yArrived,
      }),
      !T && w.classList.contains("is-shown") && hideSequenceElement(w),
      w.classList.toggle("is-current", v));
  });
  const i = o.length && o.every((w) => w.current);
  (o.forEach((w, k) => {
    const g = n.packets.find((T) => T.index === Number(w.g.dataset.packet))?.p
      .quick;
    i
      ? revealSequenceElement(
          w.g,
          g ? "quick" : "draw",
          k * SEQUENCE_ANIMATION_TIMINGS.stagger,
        )
      : revealSequenceElement(w.g, "fade", Math.min(r++ * 14, 420));
  }),
    a.querySelectorAll(".seq-note").forEach((w) => {
      const k = !t.started || t.notes[Number(w.dataset.note)] !== "future";
      (k &&
        !w.classList.contains("is-shown") &&
        (revealSequenceElement(w, "fade", 0),
        o.push({
          g: w,
          y: n.notes[Number(w.dataset.note)].y,
        })),
        !k && w.classList.contains("is-shown") && hideSequenceElement(w));
    }),
    a
      .querySelectorAll(".seq-step")
      .forEach((w) =>
        w.classList.toggle(
          "is-active",
          t.started && !t.done && Number(w.dataset.step) === t.activeStep,
        ),
      ));
  const l = e.querySelector(".seq-scroll");
  if (!t.started) return o.length && smoothScrollTo(l, 0);
  const h = [
      ...a.querySelectorAll(".seq-arrow.is-shown, .seq-note.is-shown"),
    ].map((w) =>
      w.dataset.packet !== void 0
        ? n.packets[Number(w.dataset.packet)].yArrived
        : n.notes[Number(w.dataset.note)].y,
    ),
    d = h.length ? Math.max(...h) : 0,
    y = l.clientHeight;
  d > l.scrollTop + y - 44
    ? smoothScrollTo(l, d - y * 0.62)
    : d < l.scrollTop + 30 && smoothScrollTo(l, d - y * 0.4);
}
function transitionSequenceLesson(e, t, s) {
  const a = [e.querySelector(".seq-scroll"), e.querySelector(".seq-head")];
  ((e._want = t.id), (e._state = s));
  const n = () => {
    e._want === t.id &&
      (a.forEach((o) => o.getAnimations().forEach((r) => r.cancel())),
      drawSequenceDiagram(e, t),
      applySequenceState(e, e._state),
      prefersReducedMotion() ||
        a.forEach((o) =>
          o.animate(
            [
              {
                opacity: 0,
              },
              {
                opacity: 1,
              },
            ],
            {
              duration: 260,
              easing: "ease-out",
            },
          ),
        ));
  };
  if (!e.dataset.lesson || prefersReducedMotion()) return n();
  (a.forEach((o) => {
    const r = Number(getComputedStyle(o).opacity);
    (o.getAnimations().forEach((i) => i.cancel()),
      o.animate(
        [
          {
            opacity: r,
          },
          {
            opacity: 0,
          },
        ],
        {
          duration: 160 * r,
          easing: r < 1 ? "linear" : "ease-in",
          fill: "forwards",
        },
      ));
  }),
    setTimeout(n, 170));
}
function updateSequenceDiagram(e, t, s) {
  if (((e._state = t), e._want !== s.id))
    return transitionSequenceLesson(e, s, t);
  e.dataset.lesson === s.id && applySequenceState(e, t);
}
export {
  bindSequenceScrolling,
  refreshSequenceDiagram,
  renderSequencePanel,
  updateSequenceDiagram,
};
