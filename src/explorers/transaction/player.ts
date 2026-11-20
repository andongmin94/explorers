// The event player every transaction lesson shares (port of createPlayer in
// the vanilla console.js): play/pause, step, seek, replay, speed and guided
// stops over the current run's steps. An external store: React reads
// snapshot() through usePlayer (useSyncExternalStore); the scene is driven
// imperatively (attachScene). index = the event shown or playing, done = the
// last event whose motion finished.
import { useSyncExternalStore } from "react";

import type { TxScene } from "./stage.ts";

/** What the player needs of a step. */
export interface PlayerStep {
  index: number;
}

export interface PlayerSnapshot {
  mode: string;
  index: number;
  done: number;
  busy: boolean;
  playing: boolean;
  paused: boolean;
  guided: boolean;
  speed: number;
  /** Index of the last step of the current run. */
  last: number;
  /** The scene's status line (stage foot). */
  status: string;
  /** While an event plays: the scene's current explanation of its phase. */
  phaseBody: string;
  /** While an event plays: the state the scene shows right now. */
  phaseState: unknown;
}

export interface PlayerOptions {
  runs: Record<string, { steps: PlayerStep[] }>;
  mode: string;
  /** Guided play halts after these events. */
  stopAt: (mode: string, index: number) => boolean;
  /** Called on every change (the vanilla render()): progress bookkeeping. */
  onRender?: (snap: PlayerSnapshot) => void;
}

export class Player {
  private runs: PlayerOptions["runs"];
  private stopAt: PlayerOptions["stopAt"];
  private onRender: PlayerOptions["onRender"];
  private scene: TxScene | null = null;

  mode: string;
  private s = {
    index: 0,
    done: 0,
    busy: false,
    playing: false,
    paused: false,
    autoAdvance: false,
    guided: true,
    speed: 1,
    revision: 0,
    timer: null as ReturnType<typeof setTimeout> | null,
  };
  private status = "";
  private phaseBody = "";
  private phaseState: unknown = null;

  private listeners = new Set<() => void>();
  private cached: PlayerSnapshot | null = null;

  constructor({ runs, mode, stopAt, onRender }: PlayerOptions) {
    this.runs = runs;
    this.mode = mode;
    this.stopAt = stopAt;
    this.onRender = onRender;
  }

  /* ---------- store ---------- */

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  snapshot = (): PlayerSnapshot => {
    const s = this.s;
    this.cached ??= {
      mode: this.mode,
      index: s.index,
      done: s.done,
      busy: s.busy,
      playing: s.playing,
      paused: s.paused,
      guided: s.guided,
      speed: s.speed,
      last: this.last(),
      status: this.status,
      phaseBody: this.phaseBody,
      phaseState: this.phaseState,
    };
    return this.cached;
  };
  /** The vanilla render(): repaint from the state (React does the painting). */
  private render() {
    this.cached = null;
    const snap = this.snapshot();
    this.onRender?.(snap);
    // The phase text belongs to the event in flight.
    if (!this.s.busy && this.phaseBody) {
      this.phaseBody = "";
      this.cached = null;
    }
    for (const fn of this.listeners) fn();
  }

  /* ---------- scene ---------- */

  steps() {
    return this.runs[this.mode].steps;
  }
  last() {
    return this.steps().length - 1;
  }

  attachScene(scene: TxScene) {
    this.scene = scene;
    void scene.update(this.steps()[this.s.done], null, { animate: false });
    this.render();
  }
  detachScene(scene: TxScene) {
    if (this.scene !== scene) return;
    this.pause();
    this.scene = null;
  }

  /** The scene reports each phase of the event it plays. */
  onPhase = ({ title, body, snapshot }: { title: string; body: string; snapshot: unknown }) => {
    this.status = title;
    if (this.s.busy) {
      if (body) this.phaseBody = body;
      if (snapshot) this.phaseState = snapshot;
    }
    this.cached = null;
    for (const fn of this.listeners) fn();
  };

  private update(step: number, previous: number | null, animate: boolean) {
    return (
      this.scene?.update(this.steps()[step], previous === null ? null : this.steps()[previous], {
        animate,
        speed: this.s.speed,
      }) ?? Promise.resolve()
    );
  }

  /* ---------- the player (createPlayer) ---------- */

  pause = () => {
    const s = this.s;
    s.playing = false;
    if (s.timer) clearTimeout(s.timer);
    s.timer = null;
    s.paused = s.busy;
    this.scene?.pause();
    this.render();
  };
  private schedule() {
    const s = this.s;
    if (s.timer) clearTimeout(s.timer);
    if (s.playing && !s.busy && s.index < this.last())
      s.timer = setTimeout(() => void this.move(s.index + 1, true), 520 / s.speed);
  }
  move = async (next: number, motion = false) => {
    const s = this.s;
    const token = ++s.revision;
    if (s.timer) clearTimeout(s.timer);
    s.index = Math.max(0, Math.min(this.last(), next));
    s.busy = motion;
    s.autoAdvance = s.playing;
    s.paused = false;
    this.phaseState = null;
    this.render();
    await this.update(s.index, s.done, motion);
    if (token !== s.revision) return;
    s.done = s.index;
    s.busy = false;
    s.paused = false;
    if (s.index === this.last() || (s.playing && s.guided && this.stopAt(this.mode, s.index)))
      s.playing = false;
    this.render();
    this.schedule();
  };
  jump = (next: number) => {
    this.pause();
    return this.move(next, false);
  };
  play = () => {
    const s = this.s;
    if (s.playing || (s.busy && !s.paused)) return this.pause();
    if (s.done === this.last() && !s.busy) {
      s.done = 0;
      s.index = 0;
      void this.update(0, null, false);
    }
    s.playing = !s.busy || s.autoAdvance;
    s.paused = false;
    this.scene?.resume();
    this.render();
    this.schedule();
  };
  replay = async () => {
    const target = this.s.index;
    this.pause();
    await this.move(target - 1, false);
    await this.move(target, true);
  };
  restart = () => {
    const s = this.s;
    this.pause();
    s.revision++;
    s.index = 0;
    s.done = 0;
    s.busy = false;
    s.paused = false;
    void this.update(0, null, false);
    this.render();
  };
  next = () => {
    this.pause();
    return this.move(this.s.index + 1, true);
  };
  cycleSpeed = () => {
    const s = this.s;
    s.speed = s.speed === 1 ? 2 : s.speed === 2 ? 0.5 : 1;
    this.scene?.setSpeed(s.speed);
    this.schedule();
    this.render();
  };
  setGuided = (on: boolean) => {
    this.s.guided = on;
    this.render();
  };
  /**
   * Switch to another run. The runs may differ in length: rewind before
   * switching so nothing reads past the end of the shorter run.
   */
  setMode = (mode: string) => {
    if (!(mode in this.runs)) return;
    this.pause();
    Object.assign(this.s, { index: 0, done: 0, busy: false });
    this.mode = mode;
    this.restart();
  };
}

export function usePlayer(player: Player) {
  return useSyncExternalStore(player.subscribe, player.snapshot, player.snapshot);
}
