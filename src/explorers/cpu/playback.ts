// Playback of one lesson: the clock, the guided stops and the scene's moves
// (port of the state machine in cpu/src/main.js). An external store: React
// reads snapshot() through useSyncExternalStore (usePlayback), and the scene
// is driven imperatively (attachScene). Times are ms; -1 is the start screen.
import { useSyncExternalStore } from "react";

import type { Progress } from "@/lib/lesson-kit.ts";
import { preFrame, simulate } from "./engine.ts";
import { frameAtMove } from "./lesson.ts";
import { METHODS, type Lesson } from "./lessons.ts";
import type { SchedulerScene } from "./scene.ts";
import type { Algorithm, Frame, SceneView, SimEvent, SimResult } from "./types.ts";

/** One simulated millisecond at 1× speed. */
export const STEP_DURATION = 1600;
const SPEEDS: Record<number, number> = { 1: 2, 2: 0.5, 0.5: 1 };

export interface PlaybackSnapshot {
  algorithm: Algorithm;
  quantum: number;
  speed: number;
  /** Simulation time; -1 is the start screen (목표). */
  time: number;
  playing: boolean;
  guided: boolean;
  /** A move is travelling in the scene. */
  transitioning: boolean;
  motionPaused: boolean;
  result: SimResult;
  /** The frame on screen: mid-move frames hide what has not happened yet. */
  frame: Frame;
  /** The event travelling right now, if any. */
  move: SimEvent | null;
  finished: boolean;
}

export class Playback {
  readonly lesson: Lesson;
  private progress: Progress;
  private scene: SchedulerScene | null = null;
  private reducedMotion =
    typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;

  algorithm: Algorithm;
  quantum: number;
  speed = 1;
  time = -1;
  playing = false;
  guided = true;
  transitioning = false;
  motionPaused = false;
  result: SimResult;
  private pre: Frame;
  private displayedFrame: Frame;
  private movingEvent: SimEvent | null = null;
  private resumeAutomatically = false;
  private accumulator = 0;
  private lastTick = 0;
  private animationId = 0;
  private transitionId = 0;

  private listeners = new Set<() => void>();
  private cached: PlaybackSnapshot | null = null;
  /** Called when playback jumps back to the start (the page scrolls the stage into view on phones). */
  private onRewind: (() => void) | null = null;
  setOnRewind(fn: (() => void) | null) {
    this.onRewind = fn;
  }

  constructor(lesson: Lesson, progress: Progress) {
    this.lesson = lesson;
    this.progress = progress;
    this.algorithm = lesson.methods[0];
    this.quantum = lesson.quantum ?? 2;
    this.result = this.run();
    this.pre = preFrame(this.result);
    this.displayedFrame = this.pre;
  }

  /* ---------- store ---------- */

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  snapshot = (): PlaybackSnapshot => {
    this.cached ??= {
      algorithm: this.algorithm,
      quantum: this.quantum,
      speed: this.speed,
      time: this.time,
      playing: this.playing,
      guided: this.guided,
      transitioning: this.transitioning,
      motionPaused: this.motionPaused,
      result: this.result,
      frame: this.displayedFrame,
      move: this.movingEvent,
      finished: this.time === this.result.stats.makespan,
    };
    return this.cached;
  };
  private emit() {
    this.cached = null;
    for (const fn of this.listeners) fn();
  }

  /* ---------- scene ---------- */

  /** The scene calls this before each move it animates. */
  onMove = (frame: Frame, view: SceneView, move: SimEvent) =>
    this.presentFrame(frameAtMove(frame, view, move), move);

  attachScene(scene: SchedulerScene) {
    this.scene = scene;
    this.render();
  }
  detachScene(scene: SchedulerScene) {
    if (this.scene === scene) this.scene = null;
  }
  select(id: string | null) {
    this.scene?.select(id);
  }

  /* ---------- the run ---------- */

  private run(method: Algorithm = this.algorithm) {
    return simulate({ algorithm: method, quantum: this.quantum, processes: this.lesson.processes });
  }
  frameOf(t: number): Frame {
    return t < 0 ? this.pre : this.result.frames[t];
  }
  private milestones() {
    return this.lesson.content.milestones(this.result);
  }

  private render(animate = false, previous: Frame | null = null): Promise<void> {
    const frame = this.frameOf(this.time);
    this.movingEvent = null;
    const method = METHODS[this.algorithm];
    const motion =
      this.scene?.update(frame, previous, {
        animate: animate && !this.reducedMotion?.matches,
        speed: this.speed,
        quantum: this.algorithm === "rr" ? this.quantum : null,
        algorithm: this.algorithm,
        cpuNote: method.cpu(this.quantum),
        queueNote: method.queue,
      }) ?? Promise.resolve();
    if (!this.movingEvent) this.presentFrame(frame);
    return motion;
  }

  private presentFrame(frame: Frame, move: SimEvent | null = null) {
    this.displayedFrame = frame;
    this.movingEvent = move;
    // A 핵심 장면 counts once it is on screen (not mid-move, not the start screen).
    const intro = this.time < 0 && !move;
    const milestones = this.milestones();
    const active = Math.max(
      0,
      milestones.findLastIndex((m) => m.time <= this.time),
    );
    if (!intro && !move && milestones[active].time === this.time)
      this.progress.markScene(milestones[active].id ?? milestones[active].kind);
    this.emit();
  }

  /* ---------- controls ---------- */

  seek(next: number, animate = false) {
    this.pause();
    this.moveTo(Math.max(-1, Math.min(this.result.stats.makespan, next)), animate);
    if (this.time <= 0) this.onRewind?.();
  }

  pause() {
    this.playing = false;
    this.motionPaused = this.transitioning;
    cancelAnimationFrame(this.animationId);
    this.scene?.pause();
    this.emit();
  }

  private moveTo(next: number, animate: boolean) {
    const previous = this.frameOf(this.time);
    const autoAdvance = this.playing;
    this.resumeAutomatically = autoAdvance;
    const token = ++this.transitionId;
    this.time = next;
    this.accumulator = 0;
    this.transitioning = animate && !this.reducedMotion?.matches;
    this.motionPaused = false;
    const motion = this.render(this.transitioning, previous);
    this.scene?.setProgress(0);
    this.scene?.resume();
    void motion.then(() => {
      if (token !== this.transitionId) return;
      this.transitioning = false;
      if (this.movingEvent) this.presentFrame(this.frameOf(this.time));
      this.lastTick = performance.now();
      const atStop =
        this.time === this.result.stats.makespan ||
        (this.guided && this.milestones().some((m) => m.time === this.time));
      if (autoAdvance && this.playing && atStop) this.pause();
      this.emit();
    });
  }

  private tick = (now: number) => {
    if (!this.playing) return;
    if (!this.transitioning) this.accumulator += Math.min(now - this.lastTick, 250) * this.speed;
    this.lastTick = now;
    if (
      !this.transitioning &&
      this.accumulator >= STEP_DURATION &&
      this.time < this.result.stats.makespan
    )
      this.moveTo(this.time + 1, true);
    if (!this.transitioning) this.scene?.setProgress(this.accumulator / STEP_DURATION);
    this.animationId = requestAnimationFrame(this.tick);
  };

  togglePlay() {
    if (this.playing || (this.transitioning && !this.motionPaused)) return this.pause();
    if (this.transitioning && this.motionPaused && !this.resumeAutomatically) {
      this.motionPaused = false;
      this.scene?.resume();
      this.emit();
      return;
    }
    if (this.time === this.result.stats.makespan && !this.transitioning) this.seek(-1);
    this.playing = true;
    this.motionPaused = false;
    this.scene?.resume();
    this.lastTick = performance.now();
    // From the start screen the jobs arrive right away.
    if (this.time < 0 && !this.transitioning) this.moveTo(0, true);
    this.emit();
    this.animationId = requestAnimationFrame(this.tick);
  }

  /** 1 ms forward with the moves (→). */
  step() {
    this.seek(this.time + 1, true);
  }
  /** 1 ms back, no animation (←). */
  back() {
    this.seek(this.time - 1);
  }
  /** Back to the start screen (R). */
  reset() {
    this.seek(-1);
  }
  /** The next boundary with events, played. */
  nextEvent() {
    const next =
      this.result.frames.find((f) => f.t > this.time && f.events.length)?.t ??
      this.result.stats.makespan;
    this.seek(next, true);
  }
  /** Play this boundary's moves again from the moment before. */
  replayEvent() {
    const at = this.time;
    this.seek(at - 1);
    this.seek(at, true);
  }

  setGuided(on: boolean) {
    this.guided = on;
    this.emit();
  }
  cycleSpeed() {
    this.speed = SPEEDS[this.speed] ?? 1;
    this.scene?.setSpeed(this.speed);
    this.emit();
  }
  setAlgorithm(algorithm: Algorithm) {
    if (algorithm === this.algorithm) return;
    this.algorithm = algorithm;
    this.reconfigure();
  }
  setQuantum(quantum: number) {
    if (quantum === this.quantum) return;
    this.quantum = quantum;
    this.reconfigure();
  }

  private reconfigure() {
    this.pause();
    ++this.transitionId;
    this.transitioning = false;
    this.result = this.run();
    this.pre = preFrame(this.result);
    this.time = -1;
    this.accumulator = 0;
    this.render();
    this.emit();
  }

  dispose() {
    cancelAnimationFrame(this.animationId);
    this.listeners.clear();
  }
}

/** The playback snapshot, re-rendering on every change. */
export function usePlayback(playback: Playback): PlaybackSnapshot {
  return useSyncExternalStore(playback.subscribe, playback.snapshot, playback.snapshot);
}
