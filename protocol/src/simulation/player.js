// Reconstructed from the distributed Protocol Explorer JavaScript.
import { SEQUENCE_ANIMATION_TIMINGS } from "./timeline.js";
import { playbackClock, waitWithClock } from "./clock.js";
const PLAYER_EVENT_DELAYS = {
  network: {
    event: 450,
    step: 1100,
    quick: 120,
  },
  sequence: {
    event: 260,
    step: 650,
    quick: 80,
  },
};
function getSequenceEventDuration(e) {
  return e.type === "packet"
    ? e.quick
      ? SEQUENCE_ANIMATION_TIMINGS.quick
      : SEQUENCE_ANIMATION_TIMINGS.draw
    : e.type === "stream"
      ? (e.packets.length - 1) * SEQUENCE_ANIMATION_TIMINGS.stagger +
        SEQUENCE_ANIMATION_TIMINGS.draw
      : e.type === "note"
        ? SEQUENCE_ANIMATION_TIMINGS.note
        : 0;
}
function createLessonPlayer(e, t, s, { mode: a = "network" } = {}) {
  const n = [
      {
        type: "focus",
        ...e.start,
        step: 0,
      },
      ...e.steps.flatMap((R, x) =>
        R.events.map((H) => ({
          ...H,
          step: x,
        })),
      ),
    ],
    o = e.steps.map((R, x) => n.findLastIndex((H) => H.step === x));
  let r = 0,
    i = -1,
    l = !1,
    c = {
      cancelled: !1,
    },
    h = null,
    d = a;
  function y() {
    const R = r >= n.length && i === -1,
      x = r > 0 || i !== -1,
      H = i !== -1 ? i : r - 1,
      we = H >= 0 ? n[H].step : 0,
      ce = (A) => A.type === "packet" || A.type === "stream",
      P = H >= 0 && ce(n[H]) ? H : -1;
    return {
      playing: l,
      running: i !== -1,
      started: x,
      done: R,
      activeStep: we,
      event: H >= 0 ? n[H] : null,
      steps: e.steps.map((A, _) =>
        _ === we && x && !R ? "active" : o[_] < r ? "done" : "todo",
      ),
      packets: n.flatMap((A, _) => {
        if (!ce(A)) return [];
        const J = _ === P ? "current" : _ < r ? "past" : "future";
        return A.type === "stream" ? A.packets.map(() => J) : [J];
      }),
      notes: n.flatMap((A, _) =>
        A.type === "note" ? [_ < r || _ === i ? "past" : "future"] : [],
      ),
    };
  }
  let w = !1,
    k = !1;
  function g() {
    w ||
      ((w = !0),
      queueMicrotask(() => {
        ((w = !1), k || s(y()));
      }));
  }
  function T() {
    const R = t.snapshot();
    (r === 0
      ? t.overview(e.nodes, e.labels)
      : n.slice(0, r).forEach((x) => t.apply(x)),
      t.morph(R, c));
  }
  function v(R) {
    const x = n[R + 1],
      H = PLAYER_EVENT_DELAYS[d];
    return x.step !== n[R].step
      ? H.step
      : x.quick && n[R].quick
        ? H.quick
        : H.event;
  }
  async function I() {
    if (i !== -1) return;
    if (r >= n.length) {
      ((l = !1), g());
      return;
    }
    const R = r,
      x = c;
    if (
      ((i = R),
      g(),
      d === "sequence"
        ? (t.apply(n[R]),
          await waitWithClock(getSequenceEventDuration(n[R]), x))
        : await t.run(n[R], x),
      x !== c ||
        (x.finish &&
          ((c = {
            cancelled: !1,
          }),
          t.clear(),
          t.apply(n[R])),
        (i = -1),
        (r = R + 1),
        r >= n.length && (l = !1),
        g(),
        !l))
    )
      return;
    const H = (h = {
      cancelled: !1,
    });
    (await waitWithClock(() => v(R), H),
      h === H && (h = null),
      !H.cancelled && l && I());
  }
  function q() {
    ((c.cancelled = !0),
      (c = {
        cancelled: !1,
      }),
      h && (h.cancelled = !0),
      (h = null),
      (i = -1),
      t.clear(),
      playbackClock.resume());
  }
  function re() {
    (q(), (l = !1), (r = 0), T(), g());
  }
  function C() {
    (r >= n.length && i === -1 && re(),
      (l = !0),
      playbackClock.resume(),
      g(),
      i === -1 && !h && I());
  }
  function Z() {
    ((l = !1), playbackClock.pause(), g());
  }
  return {
    reset: re,
    dispose() {
      (q(), (l = !1), (k = !0));
    },
    toggle: () => (l ? Z() : C()),
    pause: Z,
    play: C,
    step() {
      ((l = !1),
        h && (h.cancelled = !0),
        (h = null),
        playbackClock.resume(),
        g(),
        i === -1 && I());
    },
    setMode(R) {
      R !== d &&
        ((d = R),
        R === "sequence" && i !== -1 && ((c.finish = !0), (c.cancelled = !0)));
    },
    jump(R) {
      (q(), (r = n.findIndex((x) => x.step === R)), T(), C());
    },
  };
}
export { createLessonPlayer };
