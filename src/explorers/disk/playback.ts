// Playback of one lesson: which request is on screen, the guided stops and
// the scene's four-stage moves (port of the state machine in
// disk/src/main.js). An external store: React reads snapshot() through
// useSyncExternalStore (usePlayback); the scene is driven imperatively
// (attachScene) and reports its stage (onPhase) and head (onHead) back.
import { useSyncExternalStore } from "react";

import type { Progress } from "@/lib/lesson-kit.ts";
import { REQUESTS, routePoints } from "./engine.ts";
import type { Lesson } from "./lessons.ts";
import type { DiskScene } from "./scene.ts";
import type { Algorithm, Phase, Run, Step } from "./types.ts";

export const N = REQUESTS.length;
const SPEEDS: Record<number, number> = { 1: 2, 2: 0.5, 0.5: 1 };

export interface PlaybackSnapshot {
  algorithm: Algorithm;
  run: Run;
  /** The request on screen or travelling (0 = start). */
  index: number;
  /** The last request whose move has landed. */
  committed: number;
  /** A request is travelling in the scene. */
  busy: boolean;
  /** The travelling request is paused. */
  paused: boolean;
  playing: boolean;
  guided: boolean;
  speed: number;
  /** The scene's current stage and the step it belongs to. */
  phase: Phase;
  phaseStep: Step;
  /** The stage foot's lamp. */
  led: boolean;
  /** 누적 이동 in the readout (the total before or after the moving request). */
  shownTotal: number;
}

export class Playback {
  readonly lesson: Lesson;
  private progress: Progress;
  private scene: DiskScene | null = null;

  algorithm: Algorithm;
  index = 0;
  committed = 0;
  busy = false;
  paused = false;
  playing = false;
  guided = true;
  speed = 1;
  private resumeAutomatically = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private revision = 0;
  private phase: Phase = "idle";
  private phaseStep: Step;
  private led = false;
  private shownTotal = 0;

  private listeners = new Set<() => void>();
  private cached: PlaybackSnapshot | null = null;
  private head: number;
  private headListeners = new Set<() => void>();
  /** Called after a method switch or a revealed prediction (the page focuses the scene). */
  private onFocusScene: ((block: ScrollLogicalPosition) => void) | null = null;
  setOnFocusScene(fn: ((block: ScrollLogicalPosition) => void) | null) {
    this.onFocusScene = fn;
  }

  constructor(lesson: Lesson, progress: Progress, search = globalThis.location?.search ?? "") {
    this.lesson = lesson;
    this.progress = progress;
    // Deep link: ?algo=sstf&step=3 opens that moment.
    const q = new URLSearchParams(search);
    const algo = q.get("algo");
    this.algorithm =
      algo && (lesson.algorithms as string[]).includes(algo)
        ? (algo as Algorithm)
        : lesson.algorithms[0];
    this.index = this.committed = Math.max(0, Math.min(N, Number(q.get("step")) || 0));
    this.phaseStep = this.current();
    this.head = this.phaseStep.state.head;
    this.shownTotal = this.phaseStep.state.total;
  }

  /* ---------- store ---------- */

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  snapshot = (): PlaybackSnapshot => {
    this.cached ??= {
      algorithm: this.algorithm,
      run: this.run(),
      index: this.index,
      committed: this.committed,
      busy: this.busy,
      paused: this.paused,
      playing: this.playing,
      guided: this.guided,
      speed: this.speed,
      phase: this.phase,
      phaseStep: this.phaseStep,
      led: this.led,
      shownTotal: this.shownTotal,
    };
    return this.cached;
  };
  private emit() {
    this.cached = null;
    for (const fn of this.listeners) fn();
  }

  /** The head readout changes every frame of a seek: its own tiny store. */
  subscribeHead = (fn: () => void) => {
    this.headListeners.add(fn);
    return () => this.headListeners.delete(fn);
  };
  headSnapshot = () => this.head;

  /* ---------- scene ---------- */

  onHead = (cylinder: number) => {
    if (cylinder === this.head) return;
    this.head = cylinder;
    for (const fn of this.headListeners) fn();
  };

  onPhase = (kind: Phase, step: Step) => {
    this.phase = kind;
    this.phaseStep = step;
    this.led = this.busy || kind === "done";
    this.shownTotal = (kind === "arrive" || kind === "done" ? step.state : step.before).total;
    this.emit();
  };

  attachScene(scene: DiskScene) {
    this.scene = scene;
    // A move cut short by a remount (dev StrictMode) plays again.
    if (this.busy) {
      void this.move(this.index, true);
      return;
    }
    void scene.update(this.current(), { route: this.route(this.index) });
    this.render();
  }
  detachScene(scene: DiskScene) {
    if (this.scene === scene) this.scene = null;
  }

  /* ---------- the run ---------- */

  run(alg: Algorithm = this.algorithm): Run {
    return this.lesson.runs[alg];
  }
  current(): Step {
    return this.run().steps[this.committed];
  }
  route(n: number) {
    return routePoints(this.run().steps, n);
  }

  /** A 핵심 장면 counts once it is on screen (not mid-move). */
  private render() {
    const scenes = this.lesson.scenes[this.algorithm];
    if (!this.busy && scenes.some((m) => m.n === this.committed))
      this.progress.markScene(`${this.algorithm}:${this.committed}`);
    this.emit();
  }

  /* ---------- controls ---------- */

  pause() {
    this.playing = false;
    clearTimeout(this.timer);
    this.paused = this.busy;
    this.scene?.pause();
    this.emit();
  }

  private schedule() {
    clearTimeout(this.timer);
    if (this.playing && !this.busy && this.index < N)
      this.timer = setTimeout(() => void this.move(this.index + 1, true), 480 / this.speed);
  }

  private async move(next: number, motion = false) {
    const token = ++this.revision;
    clearTimeout(this.timer);
    this.index = Math.max(0, Math.min(N, next));
    this.busy = motion;
    this.paused = false;
    this.resumeAutomatically = this.playing;
    if (motion) this.render();
    await this.scene?.update(this.run().steps[this.index], {
      motion,
      speed: this.speed,
      route: this.route(this.index),
    });
    if (token !== this.revision) return;
    this.committed = this.index;
    this.busy = false;
    this.paused = false;
    if (
      this.index === N ||
      (this.guided && this.playing && this.lesson.stops[this.algorithm].includes(this.index))
    )
      this.playing = false;
    this.render();
    this.schedule();
  }

  /** Show a request without its move (←, →, R, the seek bar, records). */
  jump(next: number) {
    this.pause();
    void this.move(next, false);
  }
  /** "다음 요청": play the next request's move. */
  next() {
    this.pause();
    void this.move(this.index + 1, true);
  }
  back() {
    this.jump(this.index - 1);
  }
  reset() {
    this.jump(0);
  }
  /** The current request's move again, from the moment before. */
  async replay() {
    const target = this.index;
    this.pause();
    await this.move(target - 1, false);
    await this.move(target, true);
  }
  /** Play the request after a revealed prediction. */
  reveal() {
    this.onFocusScene?.("nearest");
    void this.move(this.index + 1, true);
  }

  togglePlay() {
    if (this.playing || (this.busy && !this.paused)) {
      this.pause();
      return;
    }
    if (this.busy && this.paused && !this.resumeAutomatically) {
      this.paused = false;
      this.scene?.resume();
      this.emit();
      return;
    }
    if (this.committed === N && !this.busy) {
      this.committed = this.index = 0;
      void this.scene?.update(this.current(), { route: this.route(0) });
      this.render();
    }
    this.playing = true;
    this.paused = false;
    this.scene?.resume();
    this.emit();
    this.schedule();
  }

  setGuided(on: boolean) {
    this.guided = on;
    this.emit();
  }
  cycleSpeed() {
    this.speed = SPEEDS[this.speed] ?? 1;
    this.scene?.setSpeed(this.speed);
    this.emit();
    this.schedule();
  }
  setAlgorithm(name: Algorithm) {
    this.pause();
    this.revision++;
    this.algorithm = name;
    this.index = this.committed = 0;
    this.busy = this.paused = false;
    void this.scene?.update(this.current(), { route: this.route(0) });
    this.render();
    this.onFocusScene?.("start");
  }

  dispose() {
    clearTimeout(this.timer);
    this.listeners.clear();
    this.headListeners.clear();
  }
}

/** The playback snapshot, re-rendering on every change. */
export function usePlayback(playback: Playback): PlaybackSnapshot {
  return useSyncExternalStore(playback.subscribe, playback.snapshot, playback.snapshot);
}

/** The head cylinder (re-renders only the readout during a seek). */
export function useHead(playback: Playback): number {
  return useSyncExternalStore(playback.subscribeHead, playback.headSnapshot, playback.headSnapshot);
}
