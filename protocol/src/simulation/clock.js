// Reconstructed from the distributed Protocol Explorer JavaScript.
let playbackSpeed = 1;
let playbackPaused = !1;
const trackedAnimations = new Set();
function syncAnimationPlayback(e) {
  ((e.playbackRate = playbackSpeed),
    playbackPaused && e.playState === "running" && e.pause(),
    !playbackPaused && e.playState === "paused" && e.play());
}
const playbackClock = {
  get speed() {
    return playbackSpeed;
  },
  get paused() {
    return playbackPaused;
  },
  setSpeed(e) {
    ((playbackSpeed = e), trackedAnimations.forEach(syncAnimationPlayback));
  },
  pause() {
    ((playbackPaused = !0), trackedAnimations.forEach(syncAnimationPlayback));
  },
  resume() {
    ((playbackPaused = !1), trackedAnimations.forEach(syncAnimationPlayback));
  },
  track(e) {
    (trackedAnimations.add(e), syncAnimationPlayback(e));
    const t = () => trackedAnimations.delete(e);
    return (
      e.addEventListener("finish", t),
      e.addEventListener("cancel", t),
      e
    );
  },
};
function animateWithClock(e, t, s = () => {}) {
  return new Promise((a) => {
    let n = null,
      o = 0;
    const r = (i) => {
      if (t.cancelled) return a();
      (n !== null && !playbackPaused && (o += (i - n) * playbackSpeed),
        (n = i));
      const l = typeof e == "function" ? e() : e,
        c = l > 0 ? Math.max(0, Math.min(1, o / l)) : 1;
      (s(c), c < 1 ? requestAnimationFrame(r) : a());
    };
    requestAnimationFrame(r);
  });
}
const waitWithClock = (e, t) => animateWithClock(e, t);
export { animateWithClock, playbackClock, waitWithClock };
