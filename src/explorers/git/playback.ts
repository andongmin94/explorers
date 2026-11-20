// Playback of one Git lesson (port of the flow in git/src/main.js): the
// current event, guided stops, the gated resolution choice, predictions that
// were answered or passed, and the scene's animated steps. An external store:
// React reads snapshot() through useSyncExternalStore (usePlayback); the scene
// is driven imperatively (attachScene).
import { useSyncExternalStore } from "react";

import type { Progress } from "@/lib/lesson-kit.ts";
import type { Lesson } from "./lesson-model.ts";
import type { GitScene, ScenePhase } from "./scene.ts";
import type { GitState, Run } from "./types.ts";

const SPEEDS: Record<number, number> = { 1: 2, 2: 0.5, 0.5: 1 };

export interface PlaybackSnapshot {
  choice: string | null;
  run: Run;
  index: number;
  /** The last event played to its end (events after it are not shown in the log). */
  completed: number;
  /** A step is being animated. */
  busy: boolean;
  paused: boolean;
  playing: boolean;
  guided: boolean;
  speed: number;
  /** What the scene reports while it plays a step. */
  phase: ScenePhase | null;
  /** The state the well, the facts and the status line show (the scene's phase state). */
  shown: GitState;
  /** Predictions answered or passed by (their step then shows what answers them). */
  settled: ReadonlySet<number>;
  /** Bumped on every full render (a render closes an open prediction). */
  renders: number;
}

export class Playback {
  readonly lesson: Lesson;
  readonly gate: number;
  private progress: Progress;
  private scene: GitScene | null = null;
  private started = false;

  choice: string | null;
  run: Run;
  index = 0;
  completed = 0;
  busy = false;
  paused = false;
  playing = false;
  guided = true;
  speed = 1;
  private resumeAutomatically = false;
  private revision = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private phase: ScenePhase | null = null;
  private shown: GitState;
  private renders = 0;
  private readonly settled = new Set<number>();
  /** `settled` as of the last render: an answer shows only once the sheet closes. */
  private settledShown: ReadonlySet<number> = new Set();

  private listeners = new Set<() => void>();
  private cached: PlaybackSnapshot | null = null;
  /** Shows a block of the 해설 (the resolution choices of lesson 03's gate: tab, page, focus). */
  private onShow: ((key: "resolution" | "terminal") => void) | null = null;
  setOnShow(fn: ((key: "resolution" | "terminal") => void) | null) {
    this.onShow = fn;
  }
  /** Bring a block of the 해설 into view (its tab and page). */
  show(key: "resolution" | "terminal") {
    this.onShow?.(key);
  }

  constructor(lesson: Lesson, progress: Progress) {
    this.lesson = lesson;
    this.progress = progress;
    this.gate = lesson.gate?.step ?? -1;
    this.choice = lesson.defaultVariant;
    this.run = lesson.simulate(this.choice);
    this.shown = this.run.steps[0].state;
  }

  /* ---------- store ---------- */

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  snapshot = (): PlaybackSnapshot => {
    this.cached ??= {
      choice: this.choice,
      run: this.run,
      index: this.index,
      completed: this.completed,
      busy: this.busy,
      paused: this.paused,
      playing: this.playing,
      guided: this.guided,
      speed: this.speed,
      phase: this.phase,
      shown: this.shown,
      settled: this.settledShown,
      renders: this.renders,
    };
    return this.cached;
  };
  private emit() {
    this.cached = null;
    for (const fn of this.listeners) fn();
  }

  lastIndex = () => this.run.steps.length - 1;
  guidedStops = () => this.lesson.guidedStops(this.choice);
  /** A prediction is asked at this step and not answered or passed yet. */
  pendingAt = (i: number) => this.lesson.hasPrediction(i, this.choice) && !this.settledShown.has(i);

  /* ---------- scene ---------- */

  onPhase = (next: ScenePhase) => {
    this.phase = next;
    this.shown = next.state;
    this.emit();
  };

  attachScene(scene: GitScene) {
    this.scene = scene;
    if (this.started) {
      void scene.update(this.run.steps[this.index]);
      return;
    }
    this.started = true;
    this.render();
    void scene.update(this.run.steps[0]);
    // Deep link to a moment: ?lesson=conflict&step=12&choice=both (add &animate to play into it).
    const query = new URLSearchParams(globalThis.location?.search ?? "");
    if (this.lesson.variants.some((v) => v.id === query.get("choice"))) {
      this.choice = query.get("choice");
      this.run = this.lesson.simulate(this.choice);
    }
    const startAt = Number(query.get("step"));
    if (startAt > 0) {
      if (query.has("animate"))
        void this.move(startAt - 1, false).then(() => this.move(startAt, true));
      else void this.move(startAt, false);
    }
  }
  detachScene(scene: GitScene) {
    if (this.scene === scene) this.scene = null;
  }

  /** The vanilla render(): everything on screen follows the current step. */
  private render() {
    const step = this.run.steps[this.index];
    this.shown = this.busy ? step.before : step.state;
    this.settledShown = new Set(this.settled);
    this.renders++;
    this.emit();
  }
  /** Re-render after a prediction closed (its answer may now show). */
  refresh() {
    this.render();
  }

  /* ---------- flow ---------- */

  pause() {
    this.playing = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.paused = this.busy;
    this.scene?.pause();
    this.emit();
  }
  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    if (this.playing && !this.busy && this.index < this.lastIndex())
      this.timer = setTimeout(() => void this.move(this.index + 1, true), 560 / this.speed);
  }
  async move(next: number, motion = false) {
    const lesson = this.lesson;
    let target = Math.max(0, Math.min(this.lastIndex(), next));
    if (lesson.gate && target > this.gate && !this.choice) {
      target = this.gate;
      this.playing = false;
    }
    // Moving past a prediction's step without answering it skips it.
    for (const k of lesson.predictionSteps) if (k < target) this.settled.add(k);
    const token = ++this.revision;
    if (this.timer) clearTimeout(this.timer);
    this.index = target;
    if (!motion) this.completed = target;
    this.busy = motion;
    this.resumeAutomatically = this.playing;
    this.paused = false;
    this.phase = null;
    this.render();
    await this.scene?.update(this.run.steps[this.index], { animate: motion, speed: this.speed });
    if (token !== this.revision) return;
    const index = this.index;
    this.completed = index;
    this.busy = false;
    this.paused = false;
    // Progress counts the 핵심 장면 of the lesson's main path.
    if (
      lesson.guidedStops(lesson.defaultVariant).includes(index) &&
      (lesson.gate || this.choice === lesson.defaultVariant)
    )
      this.progress.markScene(index);
    this.render();
    if (
      index === this.lastIndex() ||
      index === this.gate ||
      (this.playing && this.guided && this.guidedStops().includes(index))
    )
      this.playing = false;
    this.emit();
    this.schedule();
  }
  jump(next: number) {
    this.pause();
    void this.move(next, false);
  }
  next() {
    this.pause();
    void this.move(this.index + 1, true);
  }
  reset() {
    this.pause();
    this.choice = this.lesson.defaultVariant;
    this.run = this.lesson.simulate(this.choice);
    this.completed = 0;
    this.settled.clear();
    void this.move(0, false);
  }
  togglePlay() {
    if (this.playing || (this.busy && !this.paused)) {
      this.pause();
      return;
    }
    if (this.index === this.gate && !this.busy) {
      this.show("resolution");
      return;
    }
    if (this.completed === this.lastIndex() && !this.busy) this.reset();
    this.playing = this.busy ? this.resumeAutomatically : true;
    this.paused = false;
    this.scene?.resume();
    this.emit();
    this.schedule();
  }
  async replay() {
    const target = this.index;
    this.pause();
    await this.move(target - 1, false);
    await this.move(target, true);
  }
  /** Play the other method from the fork: lesson 03's resolutions, the others' variants. */
  async playVariant(id: string) {
    const lesson = this.lesson;
    this.pause();
    this.choice = id;
    this.run = lesson.simulate(this.choice);
    // Predictions after the fork are worded for one method: ask them again.
    for (const k of lesson.predictionSteps) if (k > lesson.fork) this.settled.delete(k);
    if (lesson.gate) return this.move(lesson.gate.resume, true);
    await this.move(lesson.fork, false);
    await this.move(lesson.fork + 1, true);
  }
  chooseAgain() {
    const lesson = this.lesson;
    if (!lesson.gate) return this.jump(lesson.fork);
    this.choice = null;
    this.run = lesson.simulate(this.choice);
    // Prediction 11 is worded for the chosen sentence: ask it again.
    for (const k of lesson.gate.recheck) this.settled.delete(k);
    this.jump(this.gate);
    this.show("resolution");
  }
  cycleSpeed() {
    this.speed = SPEEDS[this.speed] ?? 1;
    this.scene?.setSpeed(this.speed);
    this.emit();
    this.schedule();
  }
  setGuided(on: boolean) {
    this.guided = on;
    this.emit();
  }
  /** A prediction was answered: its step may show the answer once the sheet closes. */
  settle(index: number) {
    this.settled.add(index);
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer);
    this.listeners.clear();
  }
}

/** The playback snapshot, re-rendering on every change. */
export function usePlayback(playback: Playback): PlaybackSnapshot {
  return useSyncExternalStore(playback.subscribe, playback.snapshot, playback.snapshot);
}
