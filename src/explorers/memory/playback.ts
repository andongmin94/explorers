// Playback of one lesson: which access is on screen, the timer, the guided
// stops and the scene's animation of one access (port of the state machine
// in memory/src/main.js). An external store: React reads snapshot() through
// usePlayback (useSyncExternalStore); the scene is driven imperatively.
//
// `index` is the access the page is heading to (or showing); `committed` the
// last one that finished. While an access plays (`busy`) index = committed + 1.
import { useSyncExternalStore } from "react";

import type { Progress } from "@/lib/lesson-kit.ts";
import { extrasFor, runsFor } from "./lessons.ts";
import type { MemoryScene, Phase } from "./scene.ts";
import type { Extras, Lesson, Milestone, Mode, Run, Runs } from "./types.ts";

const SPEEDS: Record<number, number> = { 1: 2, 2: 0.5, 0.5: 1 };

export interface PlaybackSnapshot {
  mode: Mode;
  run: Run;
  /** The access on screen (or being played). */
  index: number;
  /** The last access that finished. */
  committed: number;
  speed: number;
  playing: boolean;
  /** An access is being played in the scene. */
  busy: boolean;
  motionPaused: boolean;
  guided: boolean;
  /** What the scene is doing right now (stage head, foot, 해설 while busy). */
  phase: Phase;
}

export class Playback {
  readonly lesson: Lesson;
  readonly runs: Runs;
  readonly extras: Extras;
  readonly milestones: Milestone[];
  readonly total: number;
  private progress: Progress;
  private scene: MemoryScene | null = null;

  private modeId: string;
  private index = 0;
  private committed = 0;
  private speed = 1;
  private playing = false;
  private busy = false;
  private motionPaused = false;
  private resumeAutomatically = false;
  private guided = true;
  private revision = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private hints = true;
  private phase: Phase = { kind: "ready", title: "", body: "" };

  private listeners = new Set<() => void>();
  private cached: PlaybackSnapshot | null = null;

  constructor(lesson: Lesson, progress: Progress) {
    this.lesson = lesson;
    this.progress = progress;
    this.runs = runsFor(lesson);
    this.extras = extrasFor(lesson);
    this.milestones = lesson.milestones(this.runs);
    this.total = lesson.references.length;
    this.modeId = lesson.modes[0].id;
    // The start screen is the first 핵심 장면.
    progress.markScene(0);
  }

  /* ---------- store ---------- */

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  snapshot = (): PlaybackSnapshot => {
    this.cached ??= {
      mode: this.mode(),
      run: this.run(),
      index: this.index,
      committed: this.committed,
      speed: this.speed,
      playing: this.playing,
      busy: this.busy,
      motionPaused: this.motionPaused,
      guided: this.guided,
      phase: this.phase,
    };
    return this.cached;
  };
  private emit() {
    this.cached = null;
    for (const fn of this.listeners) fn();
  }

  mode(id = this.modeId): Mode {
    return this.lesson.modes.find((m) => m.id === id)!;
  }
  run(): Run {
    return this.runs[this.modeId];
  }

  /* ---------- scene ---------- */

  /** The scene reports each phase of an access (and the resting state). */
  onPhase = (phase: Phase) => {
    this.phase = phase;
    this.emit();
  };

  get frameCount() {
    return this.mode().frameCount;
  }

  attachScene(scene: MemoryScene) {
    this.scene = scene;
    scene.setHints(this.hints);
    // Mid-access (StrictMode remount, theme switch): show the access as finished.
    void scene.update(this.run().steps[this.busy ? this.index : this.committed], null, {
      animate: false,
      algorithm: this.mode().algorithm,
    });
  }
  detachScene(scene: MemoryScene) {
    if (this.scene === scene) this.scene = null;
  }

  /** Next-victim marks in the scene (hidden while a victim prediction is pending). */
  setHints(on: boolean) {
    this.hints = on;
    this.scene?.setHints(on);
  }

  /* ---------- playback (main.js) ---------- */

  pause() {
    this.playing = false;
    clearTimeout(this.timer);
    this.motionPaused = this.busy;
    this.scene?.pause();
    this.emit();
  }

  private schedule() {
    clearTimeout(this.timer);
    if (this.playing && !this.busy)
      this.timer = setTimeout(() => void this.navigate(this.index + 1, true), 700 / this.speed);
  }

  async navigate(target: number, animate = false, startPaused = false) {
    clearTimeout(this.timer);
    const token = ++this.revision;
    const previous = this.run().steps[this.committed];
    target = Math.max(0, Math.min(this.total, target));
    const sequential = animate && target === this.committed + 1;
    this.index = target;
    this.busy = sequential;
    if (!startPaused) this.resumeAutomatically = this.playing;
    this.motionPaused = startPaused;
    if (!sequential) this.committed = target;
    this.emit();
    await (this.scene?.update(this.run().steps[target], previous, {
      animate: sequential,
      speed: this.speed,
      paused: startPaused,
      algorithm: this.mode().algorithm,
    }) ?? Promise.resolve());
    if (token !== this.revision) return;
    this.busy = false;
    this.committed = target;
    this.motionPaused = false;
    const stop = this.milestones.some((m) => m.index === target);
    if (stop) this.progress.markScene(target);
    if (target === this.total || (this.guided && stop)) this.playing = false;
    this.emit();
    this.schedule();
  }

  async togglePlay() {
    if (this.playing || (this.busy && !this.motionPaused)) return this.pause();
    if (this.index === this.total && !this.busy) await this.navigate(0);
    this.playing = !this.busy || this.resumeAutomatically;
    this.motionPaused = false;
    this.scene?.resume();
    this.emit();
    if (!this.busy) this.schedule();
  }

  /** One access forward, played (→, 다음 접근). */
  nextAccess() {
    if (this.busy || this.index === this.total) return;
    this.pause();
    return this.navigate(this.index + 1, true);
  }
  /** Jump to an access without playing it (seek slider, records, keypad). */
  seek(target: number) {
    this.pause();
    return this.navigate(target);
  }
  back() {
    return this.seek(this.index - 1);
  }
  reset() {
    return this.seek(0);
  }
  /** Play this access again from the RAM before it. */
  async replay() {
    const at = this.index;
    this.pause();
    await this.navigate(at - 1);
    await this.navigate(at, true);
  }
  /** Play the access a prediction asked about. */
  reveal(atIndex: number) {
    return this.navigate(atIndex, true);
  }

  setMode(id: string) {
    if (id === this.modeId) return;
    this.modeId = id;
    return this.navigate(this.index, this.busy, this.motionPaused);
  }
  /** 이 방식으로 다시 보기: that condition from the start. */
  replayMode(id: string) {
    this.pause();
    this.modeId = id;
    return this.navigate(0);
  }

  setGuided(on: boolean) {
    this.guided = on;
    this.emit();
  }
  cycleSpeed() {
    this.setSpeed(SPEEDS[this.speed] ?? 1);
  }
  /** Playback speed: 0.5, 1 or 2 (the deck's speed segments). */
  setSpeed(speed: number) {
    if (speed === this.speed) return;
    this.speed = speed;
    this.scene?.setSpeed(this.speed);
    this.schedule();
    this.emit();
  }

  dispose() {
    clearTimeout(this.timer);
    this.listeners.clear();
  }
}

/** The playback snapshot, re-rendering on every change. */
export function usePlayback(playback: Playback): PlaybackSnapshot {
  return useSyncExternalStore(playback.subscribe, playback.snapshot, playback.snapshot);
}
