// Reconstructed from the distributed Protocol Explorer JavaScript.
const SEQUENCE_ANIMATION_TIMINGS = {
  draw: 620,
  quick: 320,
  stagger: 160,
  note: 700,
};
const DEFAULT_LIFELINE_ORDER = [
  "client",
  "router",
  "internet",
  "dns",
  "web",
  "mx",
  "root",
  "tld",
  "auth",
];
const SEQUENCE_PIXELS_PER_SECOND = 3e3;
const SEQUENCE_TIME_BREAK_THRESHOLD = 0.25;
const SEQUENCE_TIME_BREAK_HEIGHT = 58;
const SEQUENCE_ARRIVAL_SPACING = 18;
const SEQUENCE_MIN_TIME_SPACING = 9;
const SEQUENCE_SEND_SPACING = 30;
const SEQUENCE_NOTE_HEIGHT = 30;
const SEQUENCE_NOTE_SEND_SPACING = 22;
const SEQUENCE_STEP_HEIGHT = 30;
const SEQUENCE_TOP_PADDING = 30;
const SEQUENCE_BOTTOM_PADDING = 40;
const roundTimestamp = (e) => Math.round(e * 1e6) / 1e6;
function getLinkLatency(e, t, s) {
  const a = e.latency?.[`${t}-${s}`] ?? e.latency?.[`${s}-${t}`];
  if (a === void 0) throw new Error(`${e.id}: no delay between ${t} and ${s}`);
  return a;
}
function formatElapsedTimeBreak(e) {
  return e >= 3600
    ? `${+(e / 3600).toFixed(1)} h later`
    : e >= 60
      ? `${+(e / 60).toFixed(1)} min later`
      : `${e < 10 ? e.toFixed(2) : e.toFixed(1)} s later`;
}
function buildSequenceLayout(e) {
  const t = [];
  let s = 0,
    a = 0;
  e.steps.forEach((g, T) =>
    g.events.forEach((v) => {
      (v.type === "packet" &&
        t.push({
          type: "packet",
          p: v,
          step: T,
          index: s++,
        }),
        v.type === "stream" &&
          v.packets.forEach((I) =>
            t.push({
              type: "packet",
              p: I,
              step: T,
              index: s++,
            }),
          ),
        v.type === "note" &&
          t.push({
            type: "note",
            e: v,
            step: T,
            index: a++,
          }));
    }),
  );
  const n = new Set(
      t.flatMap((g) => (g.type === "packet" ? [g.p.from, g.p.to] : [])),
    ),
    o = (e.lifelines ?? DEFAULT_LIFELINE_ORDER).filter((g) => n.has(g)),
    r = t
      .filter((g) => g.type === "packet")
      .map((g, T) => {
        const { p: v } = g,
          I = roundTimestamp(parseFloat(v.row.time)),
          q = getLinkLatency(e, v.from, v.to);
        return {
          ...g,
          k: T,
          sent: I,
          arrived: roundTimestamp(I + q),
        };
      }),
    i = t
      .map((g, T) => ({
        it: g,
        i: T,
      }))
      .filter(({ it: g }) => g.type === "note")
      .map(({ it: g, i: T }) => {
        const v = t.slice(0, T).findLast((R) => R.type === "packet"),
          I = t.slice(T + 1).find((R) => R.type === "packet"),
          q = v ? r.find((R) => R.index === v.index).arrived : 0,
          re =
            I && I.step === g.step
              ? r.find((R) => R.index === I.index).sent
              : -1 / 0,
          C = o.includes(g.e.at) ? g.e.at : null,
          Z = v ? [v.p.from, v.p.to] : null;
        return {
          ...g,
          order: T,
          t: Math.max(q, re),
          lane: C,
          between: Z,
        };
      }),
    l = [
      ...r.flatMap((g) => [
        {
          t: g.sent,
          kind: 1,
          order: t.indexOf(
            t.find((T) => T.type === "packet" && T.index === g.index),
          ),
          pk: g,
          end: "sent",
        },
        {
          t: g.arrived,
          kind: 0,
          order: g.k,
          pk: g,
          end: "arrived",
        },
      ]),
      ...i.map((g) => ({
        t: g.t,
        kind: 0.5,
        order: g.order,
        n: g,
      })),
    ].sort((g, T) => g.t - T.t || g.kind - T.kind || g.order - T.order),
    c = [],
    h = [];
  let d = SEQUENCE_TOP_PADDING,
    y = null,
    w = -1 / 0,
    k = -1 / 0;
  for (const g of l) {
    if (y) {
      const v = roundTimestamp(g.t - y.t);
      v > SEQUENCE_TIME_BREAK_THRESHOLD
        ? (h.push({
            y: d + SEQUENCE_TIME_BREAK_HEIGHT / 2,
            seconds: v,
          }),
          (d += SEQUENCE_TIME_BREAK_HEIGHT))
        : v > 0
          ? (d += Math.max(
              SEQUENCE_MIN_TIME_SPACING,
              v * SEQUENCE_PIXELS_PER_SECOND,
            ))
          : g.kind === y.kind &&
            g.kind === 0 &&
            (d += SEQUENCE_ARRIVAL_SPACING);
    }
    g.kind === 1 &&
      (d = Math.max(
        d,
        w + SEQUENCE_SEND_SPACING,
        k + SEQUENCE_NOTE_SEND_SPACING,
      ));
    const T = g.pk && g.end === "sent" ? g.pk.step : g.n ? g.n.step : null;
    (T !== null &&
      !c.some((v) => v.step === T) &&
      ((d += SEQUENCE_STEP_HEIGHT / 2),
      c.push({
        step: T,
        y: d,
      }),
      (d += SEQUENCE_STEP_HEIGHT / 2)),
      g.n
        ? ((d += SEQUENCE_NOTE_HEIGHT / 2),
          (g.n.y = d),
          (k = d + 10),
          (d += SEQUENCE_NOTE_HEIGHT / 2))
        : (g.pk[g.end === "sent" ? "ySent" : "yArrived"] = d),
      g.kind === 1 && (w = d),
      (y = g));
  }
  return {
    lifelines: o,
    packets: r,
    notes: i,
    steps: c,
    breaks: h,
    height: d + SEQUENCE_BOTTOM_PADDING,
  };
}
export {
  SEQUENCE_ANIMATION_TIMINGS,
  buildSequenceLayout,
  formatElapsedTimeBreak,
  getLinkLatency,
};
