// Reconstructed from the distributed Protocol Explorer JavaScript.
const EASE_OUT_EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";
const EASE_IN_CUBIC = "cubic-bezier(0.5, 0, 0.75, 0)";
const reducedMotionQuery = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
);
const prefersReducedMotion = () => reducedMotionQuery.matches;
const contentTransitions = new WeakMap();
function transitionContent(
  e,
  t,
  {
    axis: s = "x",
    dir: a = 1,
    distance: n = 24,
    out: o = 160,
    inn: r = 300,
  } = {},
) {
  if (prefersReducedMotion()) return t();
  const i = (w) => (s === "x" ? `translateX(${w}px)` : `translateY(${w}px)`),
    l = contentTransitions.get(e);
  if (l?.phase === "out") {
    ((l.update = t), (l.dir = a));
    return;
  }
  const c = getComputedStyle(e),
    h = {
      transform: c.transform,
      opacity: Number(c.opacity),
    };
  if (l?.phase === "in" && h.opacity < 0.5) {
    (l.entering.cancel(),
      t(),
      (l.entering = e.animate(
        [
          h,
          {
            transform: "none",
            opacity: 1,
          },
        ],
        {
          duration: r * (1 - h.opacity),
          easing: EASE_OUT_EXPO,
        },
      )),
      (l.entering.onfinish = () =>
        contentTransitions.get(e) === l && contentTransitions.delete(e)));
    return;
  }
  l?.entering.cancel();
  const d = {
    phase: "out",
    update: t,
    dir: a,
  };
  contentTransitions.set(e, d);
  const y = e.animate(
    [
      h,
      {
        transform: i(-n * a),
        opacity: 0,
      },
    ],
    {
      duration: o * h.opacity,
      easing: l ? "linear" : EASE_IN_CUBIC,
      fill: "forwards",
    },
  );
  y.onfinish = () => {
    contentTransitions.get(e) === d &&
      (d.update(),
      (d.phase = "in"),
      (d.entering = e.animate(
        [
          {
            transform: i(n * d.dir),
            opacity: 0,
          },
          {
            transform: "none",
            opacity: 1,
          },
        ],
        {
          duration: r,
          easing: EASE_OUT_EXPO,
        },
      )),
      y.cancel(),
      (d.entering.onfinish = () =>
        contentTransitions.get(e) === d && contentTransitions.delete(e)));
  };
}
const getReadingDirection = () =>
  document.documentElement.dir === "rtl" ? -1 : 1;
const slideContent = (e, t, s = 1, a = 24) =>
  transitionContent(e, t, {
    axis: "x",
    dir: s * getReadingDirection(),
    distance: a,
  });
function animateTextChange(e, t, s = 1, a) {
  if (e.dataset.text === t) return;
  const n = e.dataset.text === void 0;
  e.dataset.text = t;
  const o = () => {
    ((e.textContent = t), a?.(e));
  };
  if (n) return o();
  transitionContent(e, o, {
    axis: "y",
    dir: s,
    distance: 10,
    out: 120,
    inn: 240,
  });
}
function smoothScrollTo(e, t) {
  const s = e.scrollTop,
    a = Math.max(0, Math.min(t, e.scrollHeight - e.clientHeight)) - s;
  if (Math.abs(a) < 1) return;
  if (prefersReducedMotion()) return (e.scrollTop = s + a);
  const n = Math.min(650, 280 + Math.abs(a) * 0.8),
    o = (e._glide = {});
  if (!e._glideWatched) {
    e._glideWatched = !0;
    const l = () => e._glide && (e._glide.stopped = !0);
    (e.addEventListener("wheel", l, {
      passive: !0,
    }),
      e.addEventListener("touchstart", l, {
        passive: !0,
      }));
  }
  let r;
  const i = (l) => {
    if (o.stopped || e._glide !== o) return;
    r ??= l;
    const c = Math.min(1, (l - r) / n);
    ((e.scrollTop = s + a * (c < 0.5 ? 4 * c ** 3 : 1 - (2 - 2 * c) ** 3 / 2)),
      c < 1 && requestAnimationFrame(i));
  };
  requestAnimationFrame(i);
}
export {
  EASE_OUT_EXPO,
  animateTextChange,
  prefersReducedMotion,
  slideContent,
  smoothScrollTo,
};
