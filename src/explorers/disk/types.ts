// Shapes of the disk scheduling engine (engine.ts) and the lesson content
// built from it (lesson.ts, lesson-sweep.ts, lessons.ts). Distances are in
// cylinders (칸).
import type { Misconception, RecallQuestion } from "@/lib/lesson-kit.ts";

export type Algorithm = "fcfs" | "sstf" | "scan" | "look" | "cscan";
/** "down" moves toward cylinder 0 (outer), "up" toward the last cylinder. */
export type Direction = "up" | "down";

export interface DiskRequest {
  /** Arrival order, 1-based. */
  id: number;
  cylinder: number;
}
export interface Candidate extends DiskRequest {
  distance: number;
}
export interface Served extends DiskRequest {
  /** Head travel from the start until this request was served. */
  wait: number;
}

export interface DiskState {
  head: number;
  total: number;
  direction: Direction;
  pending: DiskRequest[];
  completed: Served[];
}

/** One served request (index ≥ 1) or the start (index 0, no request). */
export interface Step {
  index: number;
  request: DiskRequest | null;
  distance: number;
  /** Cylinders the head passes: [from, ...edges, to]. */
  path: number[];
  /** The edges passed within the step (absent on the start step). */
  via?: number[];
  /** Index in `path` where a C-SCAN return starts (-1: none; absent on the start step). */
  jump?: number;
  before: DiskState;
  state: DiskState;
  candidates: Candidate[];
}

export interface Pick {
  request: DiskRequest;
  path: number[];
  direction: Direction;
  jump?: number;
}

export interface Run {
  algorithm: Algorithm;
  steps: Step[];
  total: number;
  order: number[];
  waits: { id: number; cylinder: number; wait: number }[];
}

export interface SimulateOptions {
  direction?: Direction;
  max?: number;
  countReturn?: boolean;
}

/** A 핵심 장면: `label` once reached, `preview` before. */
export interface Milestone {
  n: number;
  label: string;
  preview: string;
}

export interface LessonText {
  eyebrow: string;
  title: string;
  body: string;
  goal?: string;
}

export type Phase = "idle" | "select" | "controller" | "seek" | "arrive" | "done";

export interface PhaseText {
  title: string;
  body: string;
}

export interface PredictionChoice {
  id: number;
  label: string;
  answer: string;
  correct: boolean;
  why: string;
}
export interface Prediction {
  question: string;
  prompt: string;
  choices: PredictionChoice[];
}

/** The input a lesson runs: the same batch for both methods. */
export interface DiskInput {
  /** Cylinders in arrival order. */
  requests: number[];
  head: number;
  /** The last cylinder (the first is 0). */
  max: number;
  /** Where the head was moving before the start (SCAN/LOOK/C-SCAN). */
  direction: Direction;
}

/** A misconception set right at one of the method's 핵심 장면 (scene is 1-based). */
export interface DiskMisconception extends Misconception {
  /** The method whose 핵심 장면 shows it (both, when absent). */
  algorithm?: Algorithm;
}

export interface Recap {
  points: string[];
  recall: RecallQuestion[];
}

/** One lesson's content API (lesson 01 or a sweep lesson), bound to its runs. */
export interface LessonApi {
  algorithms: Algorithm[];
  names: Partial<Record<Algorithm, string>>;
  ruleShort: Partial<Record<Algorithm, string>>;
  milestonesFor: (alg: Algorithm) => Milestone[];
  lessonAt: (alg: Algorithm, index: number) => LessonText;
  takeawayAt: (alg: Algorithm, index: number) => string;
  phaseText: (kind: Phase, step: Step, alg: Algorithm) => PhaseText;
  predictionFor: (alg: Algorithm, index: number) => Prediction;
  compareStory: Partial<Record<Algorithm, string>>;
  compareExtra: (alg: Algorithm) => string;
  compareNote: () => string;
  recapFor: (alg: Algorithm) => Recap;
  recallTotal: number;
  notes: string[];
  distanceHint: (alg: Algorithm) => string;
  worstWait: ((alg: Algorithm, cylinder: number) => number) | null;
  waits: boolean;
  /** 오개념 바로잡기: shown at their 핵심 장면 and listed in 정리. */
  misconceptions: DiskMisconception[];
}
