// The protocol explorer's state machine (port of the vanilla main.js wiring,
// ui/quiz.js and the inspector's open/close/step) as an external store for
// React. One lesson player runs at a time; its snapshots drive the network
// scene, the sequence view and every panel. The imperative scenes attach
// themselves (attachNetwork / attachSequence) and are updated here, at the
// same moments the vanilla page updated them.
import { useSyncExternalStore } from "react";

import { lessonsById, protocolCatalog } from "./lessons/index.ts";
import { getLessonPackets } from "./packets/encode.ts";
import { markKeyScene, markPrediction, recordLessonProgress } from "./progress.ts";
import {
  getGuidedStops,
  getKeySteps,
  getLessonQuizzes,
  getPacketPositions,
  getPendingQuiz,
  getQuizForStep,
  getUpcomingPacket,
  nextQuiz,
} from "./quiz.ts";
import { playbackClock } from "./simulation/clock.ts";
import { createNetworkAnimation } from "./simulation/network-animation.ts";
import { createLessonPlayer } from "./simulation/player.ts";
import { updateSequenceDiagram, type SequencePanel } from "./simulation/sequence.ts";
import type { Lesson, LessonEvent, PlaybackState, Quiz, Renderer, ViewMode } from "./types.ts";

type NetworkScene = ReturnType<typeof createNetworkAnimation>;
type Player = ReturnType<typeof createLessonPlayer>;

export const SPEEDS = [0.5, 1, 1.5, 2];
const GUIDED_STORAGE_KEY = "protocol-explorer:guided";
const SPEED_STORAGE_KEY = "protocol-explorer:speed";
const VIEW_STORAGE_KEY = "protocol-explorer:view";

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: keep it for this visit */
  }
};

/** The prediction sheet while it is open. */
export interface QuizSession {
  quiz: Quiz;
  lesson: Lesson;
  wasPlaying: boolean;
  /** The chosen answer (index), once answered. */
  picked: number | null;
}

export interface Snapshot {
  lesson: Lesson;
  /** Position in the protocol list (slide direction, "01"). */
  order: number;
  playback: PlaybackState | null;
  guided: boolean;
  speed: number;
  view: ViewMode;
  /** The prediction that still hides its answer. */
  pending: Quiz | null;
  /** The question that can be opened now (the key is enabled). */
  available: Quiz | null;
  /** The next question at or after the upcoming packet (the key's label). */
  upcoming: Quiz | null;
  /** Whether `available` was already answered in this run. */
  availableAnswered: boolean;
  quiz: QuizSession | null;
  /** The packet open in the inspector. */
  inspected: number | null;
}

/** The lesson named by ?lesson=…, else HTTP (the vanilla page always opened HTTP). */
export function initialLessonId(search: string = globalThis.location?.search ?? "") {
  const id = new URLSearchParams(search).get("lesson");
  return id && lessonsById[id] ? id : "http";
}

export class ProtocolController {
  lesson: Lesson;
  playback: PlaybackState | null = null;
  guided = read(GUIDED_STORAGE_KEY) !== "0";
  speed = 1;
  view: ViewMode = read(VIEW_STORAGE_KEY) === "sequence" ? "sequence" : "network";
  private player: Player | null = null;
  private network: NetworkScene | null = null;
  private sequence: SequencePanel | null = null;
  private stops = { events: new Set<number>(), midStream: new Set<number>() };
  /** A packet inside a stream the guided mode already held before. */
  private heldInStream = -1;
  /** lesson id → packets whose prediction was answered in this run. */
  private answered = new Map<string, Set<number>>();
  private quiz: QuizSession | null = null;
  /** Playing on to show a predicted packet: pause once it has arrived. */
  private reveal: { lesson: Lesson; packet: number; wasPlaying: boolean } | null = null;
  private inspected: number | null = null;
  private listeners = new Set<() => void>();
  private cached: Snapshot | null = null;

  /** What the player draws on: the attached network scene (a no-op until it mounts). */
  private renderer: Renderer = {
    clear: (immediate) => this.network?.clear(immediate),
    snapshot: () => this.network?.snapshot(),
    overview: (nodes, labels) => this.network?.overview(nodes, labels),
    morph: (previous, token) => {
      if (previous) this.network?.morph(previous, token);
    },
    apply: (event) => this.network?.apply(event),
    run: (event, token, landed, setPacketState, mode) =>
      this.network ? this.network.run(event, token, landed, setPacketState, mode) : undefined,
  };

  constructor(lessonId = initialLessonId()) {
    this.lesson = lessonsById[lessonId];
    const savedSpeed = Number(read(SPEED_STORAGE_KEY));
    if (SPEEDS.includes(savedSpeed)) this.speed = savedSpeed;
    playbackClock.setSpeed(this.speed);
  }

  /* ---------- store ---------- */

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): Snapshot => {
    if (this.cached) return this.cached;
    const lesson = this.lesson;
    const state = this.playback;
    const answered = this.answeredIn(lesson);
    const reveal = this.reveal;
    const available = reveal || !state ? null : getQuizForStep(lesson, state);
    const upcoming = reveal
      ? (getLessonQuizzes(lesson).find((quiz) => quiz.packet > reveal.packet) ?? null)
      : (available ?? (state ? nextQuiz(lesson, state) : null));
    this.cached = {
      lesson,
      order: protocolCatalog.findIndex((protocol) => protocol.id === lesson.id),
      playback: state,
      guided: this.guided,
      speed: this.speed,
      view: this.view,
      pending: state ? getPendingQuiz(lesson, state, answered) : null,
      available,
      upcoming,
      availableAnswered: Boolean(available && answered.has(available.packet)),
      quiz: this.quiz,
      inspected: this.inspected,
    };
    return this.cached;
  };

  private emit() {
    this.cached = null;
    for (const listener of this.listeners) listener();
  }

  private answeredIn(lesson: Lesson) {
    return this.answered.get(lesson.id) ?? new Set<number>();
  }

  /* ---------- scenes ---------- */

  /** The network scene mounted: start the first lesson once fonts are in (labels are measured). */
  attachNetwork(scene: NetworkScene) {
    this.network = scene;
    if (this.player) {
      // A remount (React StrictMode in development): draw the lesson again from the start.
      this.resetLesson();
      return;
    }
    // The start screen shows the lesson's network at once; the lesson starts
    // (and lays the labels out again) when the fonts are in.
    scene.overview(this.lesson.nodes, this.lesson.labels);
    const begin = () => {
      if (this.network && !this.player) this.selectLesson(this.lesson.id, true);
    };
    if (typeof document !== "undefined" && document.fonts?.ready)
      void document.fonts.ready.then(begin);
    else begin();
  }

  detachNetwork(scene: NetworkScene) {
    if (this.network === scene) this.network = null;
  }

  attachSequence(panel: SequencePanel) {
    this.sequence = panel;
    if (this.playback) this.updateSequence(this.playback);
  }

  detachSequence(panel: SequencePanel) {
    if (this.sequence === panel) this.sequence = null;
  }

  /* ---------- lessons ---------- */

  /** Open a protocol; the open one starts over. */
  selectLesson(lessonId: string, first = false) {
    if (!first && this.lesson.id === lessonId && this.player) return this.resetLesson();
    this.cancelQuiz();
    this.inspected = null;
    this.player?.dispose();
    const lesson = lessonsById[lessonId];
    this.lesson = lesson;
    this.answered.delete(lesson.id);
    this.heldInStream = -1;
    this.stops = getGuidedStops(lesson);
    const stops = this.stops;
    this.playback = null;
    // Each lesson has its own URL (?lesson=…), so a reload keeps it.
    if (!first && typeof history !== "undefined") {
      const url = lessonId === "http" ? "./" : `./?lesson=${encodeURIComponent(lessonId)}`;
      history.replaceState(null, "", url);
    }
    // Asynchronous notifications must not read a newer lesson.
    const player = createLessonPlayer(
      lesson,
      this.renderer,
      (state) => this.onState(state, lesson),
      {
        mode: this.view,
        stopBefore: (eventIndex) => this.guided && stops.events.has(eventIndex),
      },
    );
    this.player = player;
    player.reset();
    this.emit();
  }

  /** Back to the overview; a pending reveal no longer applies. */
  resetLesson() {
    this.cancelQuiz();
    this.answered.delete(this.lesson.id);
    this.heldInStream = -1;
    this.player?.reset();
  }

  private onState(state: PlaybackState, lesson: Lesson) {
    if (lesson !== this.lesson) return;
    this.playback = state;
    recordLessonProgress(lesson, state);
    // Guided: hold before a predicted packet inside a stream (packet events
    // are held by the player itself, before the event starts).
    const upcoming = getUpcomingPacket(state);
    if (
      this.guided &&
      state.playing &&
      state.running &&
      this.stops.midStream.has(upcoming) &&
      this.heldInStream !== upcoming
    ) {
      this.heldInStream = upcoming;
      this.player?.pause();
    }
    const keySteps = getKeySteps(lesson);
    if (state.started && !state.done && keySteps.includes(state.activeStep))
      markKeyScene(lesson, state.activeStep);
    if (state.labels) this.network?.setLabels(state.labels);
    this.network?.setDevices(lesson.id, state.devices, state.event, state.running);
    if (this.inspected !== null && !this.visiblePackets().includes(this.inspected))
      this.inspected = null;
    this.updateSequence(state);
    // Playing on to reveal: stop once the packet has arrived, unless the
    // lesson was already playing before the question was opened.
    const reveal = this.reveal;
    if (reveal) {
      const status = state.packets[reveal.packet];
      if (reveal.lesson !== lesson || !state.started) this.reveal = null;
      else if (status === "past" || status === "lost") {
        this.reveal = null;
        if (!reveal.wasPlaying && state.playing) this.player?.pause();
      } else if (!state.playing) this.reveal = null; // paused by hand
    }
    this.emit();
  }

  private updateSequence(state: PlaybackState) {
    const panel = this.sequence;
    if (!panel) return;
    const lesson = this.lesson;
    updateSequenceDiagram(panel, state, lesson);
    // The sequence's step label would name the pending answer (e.g. "Server Hello").
    const pending = getPendingQuiz(lesson, state, this.answeredIn(lesson));
    panel
      .querySelectorAll<SVGGElement>(".seq-step")
      .forEach((label) =>
        label.classList.toggle(
          "is-masked",
          Boolean(pending) &&
            Number(label.dataset.step) === pending!.step &&
            state.steps[pending!.step] !== "done",
        ),
      );
    this.markInspected();
  }

  /** The inspected packet's arrow in the sequence view. */
  private markInspected() {
    const panel = this.sequence;
    if (!panel) return;
    for (const arrow of panel.querySelectorAll<SVGGElement>(".seq-arrow")) {
      arrow.classList.toggle("is-inspected", Number(arrow.dataset.packet) === this.inspected);
    }
  }

  /* ---------- playback ---------- */

  toggle = () => this.player?.toggle();
  stepEvent = () => this.player?.step();
  pause = () => this.player?.pause();

  jumpToStep(index: number) {
    if (!this.player) return;
    this.cancelQuiz();
    this.heldInStream = -1;
    this.player.jump(index, {
      paused: Boolean(this.playback?.started && !this.playback.playing),
    });
  }

  next = () => {
    const state = this.playback;
    if (!state?.started) return this.jumpToStep(0);
    if (state.activeStep < this.lesson.steps.length - 1) this.jumpToStep(state.activeStep + 1);
  };

  previous = () => {
    const state = this.playback;
    if (!state?.started) return;
    if (state.done) return this.jumpToStep(this.lesson.steps.length - 1);
    if (state.activeStep > 0) this.jumpToStep(state.activeStep - 1);
    else this.resetLesson();
  };

  /** The deck's seek slider: 0 = overview, n = step n. */
  seek = (value: number) => (value === 0 ? this.resetLesson() : this.jumpToStep(value - 1));

  setSpeed(speed: number) {
    this.speed = speed;
    playbackClock.setSpeed(speed);
    write(SPEED_STORAGE_KEY, String(speed));
    this.emit();
  }

  setGuided(on: boolean) {
    this.guided = on;
    write(GUIDED_STORAGE_KEY, on ? "1" : "0");
    this.emit();
  }

  setView(view: ViewMode) {
    if (view === this.view) return;
    this.view = view;
    this.player?.setMode(view);
    write(VIEW_STORAGE_KEY, view);
    this.emit();
  }

  toggleView = () => this.setView(this.view === "sequence" ? "network" : "sequence");

  /* ---------- prediction ---------- */

  openQuiz = () => {
    const state = this.playback;
    const lesson = this.lesson;
    if (!state) return;
    const quiz = getQuizForStep(lesson, state);
    if (!quiz) return;
    const wasPlaying = state.playing;
    if (state.playing) this.player?.pause();
    this.quiz = { quiz, lesson, wasPlaying, picked: null };
    this.emit();
  };

  answerQuiz(index: number) {
    const open = this.quiz;
    if (!open || open.picked !== null) return;
    const picked = open.quiz.choices[index];
    if (!this.answered.has(open.lesson.id)) this.answered.set(open.lesson.id, new Set());
    this.answered.get(open.lesson.id)!.add(open.quiz.packet);
    markPrediction(open.lesson, open.quiz.packet, picked.correct);
    this.quiz = { ...open, picked: index };
    // The step's explanation opens now that the answer is given.
    if (this.playback) this.updateSequence(this.playback);
    this.emit();
  }

  closeQuiz = () => {
    if (!this.quiz) return;
    this.quiz = null;
    this.emit();
  };

  /** 실제로 확인: play through the guided hold until the predicted packet has arrived. */
  revealQuiz = () => {
    const open = this.quiz;
    if (!open) return;
    this.quiz = null;
    this.emit();
    if (open.lesson !== this.lesson) return;
    this.reveal = { lesson: open.lesson, packet: open.quiz.packet, wasPlaying: open.wasPlaying };
    this.player?.play({ release: getPacketPositions(open.lesson)[open.quiz.packet].event });
  };

  /** Forget a pending reveal (new lesson, reset, jump). */
  private cancelQuiz() {
    this.reveal = null;
    this.quiz = null;
  }

  /* ---------- inspector ---------- */

  /** Packets on the table (sent so far); the inspector steps through these. */
  visiblePackets(): number[] {
    const state = this.playback;
    if (!state?.started) return [];
    return state.packets.flatMap((status, index) => (status === "future" ? [] : [index]));
  }

  inspect = (index: number) => {
    if (!this.visiblePackets().includes(index)) return;
    if (this.playback?.playing || this.playback?.running) this.player?.pause();
    this.inspected = index;
    this.markInspected();
    this.emit();
  };

  closeInspector = () => {
    if (this.inspected === null) return;
    this.inspected = null;
    this.markInspected();
    this.emit();
  };

  stepInspector = (direction: 1 | -1) => {
    if (this.inspected === null) return;
    const visible = this.visiblePackets();
    const next = visible[visible.indexOf(this.inspected) + direction];
    if (next === undefined) return;
    this.inspected = next;
    this.markInspected();
    this.emit();
  };

  /** ←/→: the inspector's packets while it is open, else the steps. */
  forward = () => (this.inspected !== null ? this.stepInspector(1) : this.next());
  backward = () => (this.inspected !== null ? this.stepInspector(-1) : this.previous());

  /** Stop the player (page unload in tests, hot reload). */
  dispose() {
    this.player?.dispose();
    this.player = null;
  }
}

export function useController(controller: ProtocolController) {
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
}

/** The packets of a lesson in table order (memoised by encode.ts). */
export const lessonPackets = (lesson: Lesson): LessonEvent[] => getLessonPackets(lesson);
