// Types of the protocol explorer's lesson data and playback.
//
// Lessons were reconstructed from the deployed JavaScript: an event is one of
// several kinds (packet, stream, note, show, camera, render, focus) that share
// most fields, so LessonEvent is one interface with optional fields rather
// than a union. Wire data (the per-protocol structures encode.ts turns into
// bytes) is heterogeneous by nature and stays loosely typed.

// oxlint-disable-next-line typescript/no-explicit-any -- protocol structures of every kind (TCP, DNS, TLS, SSH …)
export type WireData = any;

/** [name, address] of a device, as the scene, sequence and packets show it. */
export type NodeLabel = [string, string] | string[];
export type Labels = Record<string, NodeLabel>;
/** Endpoint readouts of the network scene (connection states, ports …). */
export type Devices = Record<string, string | number | boolean | null>;

/** One packet-table row (and the wire data its bytes are encoded from). */
export interface PacketRow {
  time: string;
  src: string;
  dst: string;
  proto: string;
  info: string;
  len: string;
  wire?: WireData;
  [key: string]: unknown;
}

export interface LessonEvent {
  type: string;
  step?: number;
  from?: string;
  to?: string;
  color?: string;
  label?: string;
  payload?: string[];
  row?: PacketRow;
  packets?: LessonEvent[];
  lost?: boolean;
  locked?: boolean;
  quick?: boolean;
  labelsAfter?: Labels;
  devicesAfter?: Devices;
  /** note: where it appears, its text and tone. */
  at?: string;
  text?: string;
  tone?: string;
  /** focus/camera: the camera frame. */
  frame?: string;
  // oxlint-disable-next-line typescript/no-explicit-any -- show / render / camera events carry their own fields
  [key: string]: any;
}

export interface LessonStep {
  title: string;
  desc: string;
  detail: string;
  facts?: [string, string][];
  events: LessonEvent[];
}

export interface Lesson {
  id: string;
  name: string;
  title: string;
  layer: number;
  nodes: string[];
  latency?: Record<string, number>;
  legend?: [string | null, string][];
  overview: { full: string; description: string; facts: [string, string][] };
  outro: { title: string; desc: string; text?: string; facts?: [string, string][] };
  /** The opening camera: the devices shown and the frame. */
  start: Omit<LessonEvent, "type"> & { type?: string };
  steps: LessonStep[];
  labels?: Labels;
  devices?: Devices;
  lifelines?: string[];
  // oxlint-disable-next-line typescript/no-explicit-any -- lesson-specific extras
  [key: string]: any;
}

export type StepStatus = "active" | "done" | "todo";
export type PacketStatus = "future" | "current" | "past" | "lost";

/** One playback snapshot (createLessonPlayer's getState). */
export interface PlaybackState {
  held: boolean;
  devices: Devices | undefined;
  playing: boolean;
  running: boolean;
  started: boolean;
  done: boolean;
  activeStep: number;
  labels: Labels | undefined;
  event: LessonEvent | null;
  steps: StepStatus[];
  packets: PacketStatus[];
  notes: ("past" | "future")[];
}

export interface CancelToken {
  cancelled: boolean;
}

/** What the player asks of a scene (the network animation, or a test stub). */
export interface Renderer {
  clear(immediate?: boolean): void;
  // oxlint-disable-next-line typescript/no-explicit-any -- the scene's own snapshot
  snapshot(): any;
  overview(nodes: string[], labels?: Labels): void;
  // oxlint-disable-next-line typescript/no-explicit-any -- the scene's own snapshot
  morph(previous: any, token: CancelToken): void;
  apply(event: LessonEvent): void;
  run(
    event: LessonEvent,
    token: CancelToken,
    landed: () => void,
    setPacketState: (index: number, state: PacketStatus) => void,
    mode: ViewMode,
  ): Promise<unknown> | void;
}

export type ViewMode = "network" | "sequence";

/** A prediction question as written in lessons/quizzes.ts. */
export interface QuizQuestion {
  packet: number;
  kind: string;
  prompt: string;
  /** [value, text (null: the value itself, or the route's node names), why]. */
  choices: [string, string | null, string][];
}

export interface QuizChoice {
  value: string;
  text: string;
  why: string;
  correct: boolean;
}

/** A graded question: its packet, answer and the step it belongs to. */
export interface Quiz extends Omit<QuizQuestion, "choices"> {
  packetData: LessonEvent;
  answer: string | null;
  step: number;
  choices: QuizChoice[];
}
