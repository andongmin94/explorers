// What one transaction lesson gives the shared console (app.tsx): its runs,
// its scene, its 해설 and the parts of the records and the comparison that
// differ between lessons. lost-update.tsx, deadlock.tsx and isolation.tsx
// each build one.
import type { ReactNode } from "react";

import type { RecallQuestion } from "@/lib/lesson-kit.ts";
import type { LessonId } from "./lessons.ts";
import type { PlayerSnapshot } from "./player.ts";
import type { PhaseReport, TxScene } from "./stage.ts";
import type { ClientId, Milestone, Quiz, StepText } from "./types.ts";

/** The part of a step the console reads (every engine's steps have these). */
export interface TxStep {
  index: number;
  action: string;
  client: ClientId | null;
  sql: string | null;
  before: unknown;
  state: unknown;
}

export interface Source {
  title: string;
  url: string;
}

/** What the records and the comparison get to render. */
export interface RecordProps {
  mode: string;
  snap: PlayerSnapshot;
  steps: TxStep[];
  onSeek: (index: number) => void;
}

export interface ComparisonColumn {
  mode: string;
  /** The column's label ("일반 SELECT", "반대 순서 · T1 A → B · T2 B → A"). */
  label: string;
  /** The large readout: value and unit pairs ("9", "개") or ("9", "A"), ("19", "B"). */
  lcd: [string | number, string][];
  tag: string;
  rows: [ClientId, ReactNode][];
  text: string;
}

export interface TxPage {
  lessonId: LessonId;
  /** The progress id's totals: scenes and recall questions. */
  modes: string[];
  modeLabels: Record<string, string>;
  /** The deck field label and the segmented control's accessible name. */
  modeField: string;
  modeAria: string;
  /** data-mode or data-order on the mode keys (kept from the vanilla page). */
  modeAttr: "mode" | "order";
  runs: Record<string, { steps: TxStep[] }>;
  stageLabel: string;
  stageTag: (mode: string) => string;
  createScene: (host: HTMLElement, onPhase: (report: PhaseReport<unknown>) => void) => TxScene;
  /** Accessible summary of the scene. */
  sceneLabel: string;
  describe: (step: TxStep, mode: string) => StepText;
  /** "T1 · 읽기" for the title while an event plays. */
  busyTitle: (step: TxStep) => string;
  busyHint: string;
  milestones: (mode: string) => Milestone[];
  /** A 핵심 장면 not reached yet shows only where it is (isolation lessons). */
  hideUnseenMilestones: boolean;
  stopAt: (mode: string, index: number) => boolean;
  /** The prediction asked at a finished event, if any. */
  prediction: (step: TxStep, mode: string) => Quiz | null;
  predictionKey: (mode: string, quiz: Quiz) => string;
  predictionTarget: (quiz: Quiz) => string;
  predictionWhere: (quiz: Quiz) => string;
  wrongAnswer: (quiz: Quiz) => string;
  /** Hide the 이번 사건 section of an event that sends no SQL (isolation lessons). */
  hideEmptySql: boolean;
  /** DB 상태 · 직전 → 현재: labelled values of a state. */
  changes: (state: unknown) => [string, string][];
  noChange: string;
  scope: {
    ruleLabel: string;
    rules: Record<string, string>;
    condition: string;
    notes: string[];
    legend: string[];
  };
  recap: { points: string[]; recall: RecallQuestion[] };
  sources: Source[];
  resultsTab: string;
  Timeline: (props: RecordProps) => ReactNode;
  Log: (props: RecordProps) => ReactNode;
  Results: (props: RecordProps) => ReactNode;
  comparison: {
    title: string;
    lead: string;
    columns: () => ComparisonColumn[];
    foot?: ReactNode;
  };
}
