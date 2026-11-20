// Reconstructed from the distributed Protocol Explorer JavaScript.
import type { CancelToken } from "../types.ts";
let playbackSpeed = 1;
let playbackPaused = false;
const trackedAnimations = new Set<Animation>();

function syncAnimationPlayback(animation: Animation) {
  animation.playbackRate = playbackSpeed;
  if (playbackPaused && animation.playState === "running") animation.pause();
  if (!playbackPaused && animation.playState === "paused") animation.play();
}

/** Shared playback controls for animation frames and Web Animations. */
const playbackClock = {
  get speed() {
    return playbackSpeed;
  },
  get paused() {
    return playbackPaused;
  },
  setSpeed(speed: number) {
    playbackSpeed = speed;
    trackedAnimations.forEach(syncAnimationPlayback);
  },
  pause() {
    playbackPaused = true;
    trackedAnimations.forEach(syncAnimationPlayback);
  },
  resume() {
    playbackPaused = false;
    trackedAnimations.forEach(syncAnimationPlayback);
  },
  track(animation: Animation) {
    trackedAnimations.add(animation);
    syncAnimationPlayback(animation);
    const untrack = () => trackedAnimations.delete(animation);
    animation.addEventListener("finish", untrack);
    animation.addEventListener("cancel", untrack);
    return animation;
  },
};

/**
 * Advance in playback time: pauses consume no time, and speed changes apply
 * from the next frame. A duration callback allows the view to change mid-wait.
 * Cancellation resolves normally; callers discard stale work using the token.
 * @param {number|(() => number)} duration Milliseconds at normal playback speed.
 * @param {{cancelled: boolean}} token Shared cancellation state.
 * @param {(progress: number) => void} onFrame Progress from 0 to 1.
 */
function animateWithClock(
  duration: number | (() => number),
  token: CancelToken,
  onFrame: (progress: number) => void = () => {},
) {
  return new Promise<void>((resolve) => {
    let previousTimestamp: number | null = null;
    let elapsed = 0;
    function tick(timestamp: number) {
      if (token.cancelled) {
        resolve();
        return;
      }
      if (previousTimestamp !== null && !playbackPaused) {
        elapsed += (timestamp - previousTimestamp) * playbackSpeed;
      }
      previousTimestamp = timestamp;
      const currentDuration = typeof duration === "function" ? duration() : duration;
      const progress =
        currentDuration > 0 ? Math.max(0, Math.min(1, elapsed / currentDuration)) : 1;
      onFrame(progress);
      if (progress < 1) requestAnimationFrame(tick);
      else resolve();
    }
    requestAnimationFrame(tick);
  });
}
const waitWithClock = (duration: number | (() => number), token: CancelToken) =>
  animateWithClock(duration, token);
export { animateWithClock, playbackClock, waitWithClock };
