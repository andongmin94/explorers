// Types of the memory explorer: the page replacement engine, its steps and
// the lesson data (port of memory/src/*.js; behaviour unchanged).
import type { Misconception } from "@/lib/lesson-kit.ts";

export type Algorithm = "fifo" | "lru" | "opt" | "clock";
/** Why a frame was picked: an empty frame or the policy. */
export type SelectReason = "empty" | Algorithm;

/** One RAM frame as a step sees it. `ref` exists only under Clock. */
export interface Frame {
  slot: number;
  page: string | null;
  loadedAt: number | null;
  lastUsedAt: number | null;
  ref?: number;
  /** The access number at which the page is next used, or null (never again). */
  nextUseAt?: number | null;
}

export type SimEvent =
  | { type: "hit"; page: string; frameIndex: number }
  | { type: "miss"; page: string }
  | { type: "sweep"; page: string; frameIndex: number }
  | {
      type: "select";
      page: string;
      frameIndex: number;
      victim: string | null;
      reason: SelectReason;
    }
  | { type: "evict"; page: string; frameIndex: number }
  | { type: "load"; page: string; frameIndex: number }
  | { type: "access"; page: string; frameIndex: number };

/**
 * One completed page access. Index 0 is the empty start: there `page`,
 * `frameIndex` and `hit` are null at runtime (every reader checks `index`
 * first, as the vanilla code did), so they are typed for the accesses.
 */
export interface Step {
  index: number;
  page: string;
  hit: boolean | null;
  fault: boolean;
  compulsory: boolean;
  victim: string | null;
  frameIndex: number;
  before: Frame[];
  frames: Frame[];
  beforeOrder: string[];
  order: string[];
  handBefore: number | null;
  hand: number | null;
  events: SimEvent[];
  hits: number;
  faults: number;
  replacements: number;
}

export interface Stats {
  accesses: number;
  hits: number;
  faults: number;
  replacements: number;
  hitRate: number;
  faultRate: number;
}

export interface Run {
  algorithm: Algorithm;
  frameCount: number;
  references: readonly string[];
  steps: Step[];
  stats: Stats;
}

export interface SimulateOptions {
  algorithm?: Algorithm;
  frameCount?: number;
  references?: readonly string[];
}

/** One condition of a lesson (a policy with a frame count). */
export interface Mode {
  id: string;
  algorithm: Algorithm;
  frameCount: number;
  label: string;
}

export interface Milestone {
  index: number;
  title: string;
  heading?: string | Record<string, string>;
}

/** Everything the 해설 tab shows for one committed step. */
export interface StepDescription {
  eyebrow: string;
  chapterId: number;
  title: string;
  body: string;
  goal: string;
  eventTitle: string;
  key: string;
}

export interface QuizChoice {
  id: string;
  label: string;
  detail: string;
  correct: boolean;
  why: string;
  /** Victim choices: the frame the page sits in. */
  slot?: number;
}

export interface Quiz {
  kind: "victim" | "outcome";
  id: string;
  atIndex: number;
  beforeIndex: number;
  page: string;
  history: string[];
  question: string;
  rule: string;
  choices: QuizChoice[];
  correctId: string;
  answer: string;
}

export interface RecallChoice {
  label: string;
  correct?: boolean;
  why: string;
}
export interface RecallQuestion {
  id: string;
  question: string;
  answer?: string;
  choices: RecallChoice[];
}
export interface Recap {
  points: string[];
  recall: RecallQuestion[];
}

/** Yardsticks a lesson quotes but does not animate. */
export interface Extras {
  opt: number;
  lruCounts: [number, number];
  fifo: number;
}

export type Runs = Record<string, Run>;

export interface Lesson {
  id: string;
  name: string;
  sub: string;
  references: readonly string[];
  /** The pages the scene keeps on the SSD and in the page table (A–E, or the custom input's). */
  pages: readonly string[];
  modeLabel: string;
  modes: Mode[];
  fork: number;
  rules: [string, string][];
  milestones(runs: Runs): Milestone[];
  describe(step: Step, run: Run, mode: Mode): StepDescription;
  predict(step: Step | undefined, run: Run, mode: Mode): Quiz | null;
  recap(runs: Runs, extras: Extras): Recap;
  /** 오개념 바로잡기: 2–4 beliefs this lesson's run sets right, each at its 핵심 장면. */
  misconceptions(runs: Runs, extras: Extras): Misconception[];
  forkText(runs: Runs, extras: Extras): string;
  compareNote(runs: Runs, extras: Extras): string;
}
