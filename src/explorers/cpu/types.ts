// Shapes of the CPU scheduler simulation (engine.ts) and the lesson content
// built from it (lesson.ts, policy-lesson.ts, lessons.ts). All times are ms.

export type Algorithm = "rr" | "fcfs" | "sjf" | "srtf";

/** A job: arrives once, then alternates CPU bursts and I/O waits (io.length = cpu.length - 1). */
export interface ProcessDef {
  id: string;
  name: string;
  arrival: number;
  cpu: number[];
  io: number[];
}

export type Status = "new" | "ready" | "running" | "blocked" | "done";

/** A job's state in one frame. */
export interface ProcState {
  status: Status;
  cpuRemaining: number;
  burstRemaining: number;
  cpuDone: number;
  readyWait: number;
  ioRemaining: number;
  firstRun: number | null;
  finishedAt: number | null;
  /** Only in frames built mid-move (frameAtMove): the job is arriving right now. */
  arriving?: boolean;
}

export type MoveType = "arrive" | "unblock" | "preempt" | "dispatch" | "block" | "complete";
export type EventType = MoveType | "idle";

/** Why the CPU was (re)assigned at a boundary. */
export type Cause = "start" | "idle" | "block" | "complete" | "quantum" | "preempt" | "keep";

/** One event at a boundary. Moves carry the job id; "idle" carries only `until`. */
export interface SimEvent {
  type: EventType;
  id?: string;
  from?: Status;
  to?: Status;
  duration?: number;
  until?: number;
  candidates?: string[];
  cause?: Cause;
}
/** An event that moves a job between zones (every type but "idle"). */
export type MoveEvent = SimEvent & { type: MoveType; id: string; to: Status };

export interface BlockedEntry {
  id: string;
  remaining: number;
  until?: number;
}

/** State after the boundary events at t and before [t, t+1) runs (t = -1: start screen). */
export interface Frame {
  t: number;
  running: string | null;
  ready: string[];
  blocked: BlockedEntry[];
  completed: string[];
  quantumLeft: number | null;
  states: Record<string, ProcState>;
  events: SimEvent[];
}

export interface Segment {
  id: string | null;
  start: number;
  end: number;
  reason: string;
}

export interface IoSegment {
  id: string;
  start: number;
  end: number;
}

export interface Decision {
  time: number;
  candidates: string[];
  chosen: string;
  cause: Cause;
}

export interface ProcessStats {
  id: string;
  arrival: number;
  cpu: number;
  io: number;
  firstRun: number;
  completion: number;
  response: number;
  waiting: number;
  turnaround: number;
}

export interface Stats {
  makespan: number;
  busy: number;
  idle: number;
  utilization: number;
  contextSwitches: number;
  averageWaiting: number;
  averageResponse: number;
  averageTurnaround: number;
  perProcess: ProcessStats[];
}

export interface SimResult {
  algorithm: Algorithm;
  quantum: number;
  processes: ProcessDef[];
  frames: Frame[];
  segments: Segment[];
  ioSegments: IoSegment[];
  decisions: Decision[];
  stats: Stats;
}

/** Where every job is while the scene presents one move: zone → ids in order. */
export interface SceneView {
  new: string[];
  ready: string[];
  running: string | null;
  blocked: string[];
  done: string[];
}

/* ---------- Lesson content ---------- */

export interface Milestone {
  time: number;
  kind: string;
  title: string;
  id?: string;
}

export interface Chapter {
  eyebrow: string;
  title: string;
  body: string;
  key: string;
}

export interface Intro {
  eyebrow: string;
  title: string;
  body: string;
  goal: string;
  terms: [string, string][];
}

export interface StepNotes {
  key: string;
  notes: string[];
}

export interface PredictionChoice {
  id: string;
  correct: boolean;
  why: string;
}

export interface FollowUp {
  question: string;
  context: string | null;
  answer: number;
  choices: number[];
  explanation: string;
}

export interface Prediction {
  id: string;
  decision: Decision;
  beforeTime: number;
  running: string | null;
  runningNote: string;
  readyLabel: string;
  ready: string[];
  joined: string[];
  choices: PredictionChoice[];
  explanation: string;
  followUp: FollowUp | null;
  hint: string;
}

export interface ComparisonCopy {
  head: string;
  body: string;
  caveat?: string;
  /** May contain <b> for the current quantum. */
  extra?: string;
}

/** Both methods of a lesson on the same jobs (only the lesson's two methods are present). */
export type Runs = Record<Algorithm, SimResult>;
