// Shapes of the Git explorer's engine (engine.ts) and lessons (lessons.ts).

/** One commit in the repository. `replayOf` / `orphan` come from a rebase. */
export interface Commit {
  id: string;
  parents: string[];
  branch: string;
  message: string;
  content: string;
  /** The commit this one replays (C1' ← C1). */
  replayOf?: string;
  /** No branch reaches this commit any more (the original of a rebase). */
  orphan?: boolean;
}

export type StageKey = "base" | "ours" | "theirs";
export type IndexStatus = "clean" | "staged" | "unmerged" | "comparing";

export interface GitIndex {
  status: IndexStatus;
  /** The staged snapshot (stage 0); null while the file is unmerged. */
  content: string | null;
  /** Stages 1–3 of an unmerged file. */
  stages: Partial<Record<StageKey, string>> | null;
}

export interface MergeInfo {
  target: string;
  base: string;
  ours: string;
  theirs: string;
}

export type WorkStatus = "clean" | "modified" | "staged" | "conflict" | "resolved";

export interface GitState {
  currentBranch: string;
  refs: Record<string, string | null>;
  commits: Commit[];
  working: string;
  index: GitIndex;
  merge: MergeInfo | null;
  status: WorkStatus;
  resolution?: string;
}

export type Action =
  | "initial"
  | "branch"
  | "edit"
  | "stage"
  | "commit"
  | "switch"
  | "merge"
  | "resolve"
  | "merge-ff"
  | "merge-commit"
  | "rebase";

/** One event of a run with independent before/after snapshots. */
export interface Step {
  index: number;
  action: Action;
  command: string;
  title: string;
  /** The edit note shown instead of a command ("…을 수정하고 저장"). */
  note?: string;
  before: GitState;
  state: GitState;
}

export interface Run {
  steps: Step[];
  resolution?: string;
  variant?: string;
}

/** The three versions a file's lines are coloured against. */
export interface Versions {
  base: string;
  main: string;
  feature: string;
}

export type LineKind = "plain" | "base" | "main" | "feature" | "both" | "marker";
export interface LineInfo {
  text: string;
  kind: LineKind;
  auto: boolean;
}

export type ContentKind = "base" | "main" | "feature" | "both" | "conflict";

export interface Resolution {
  id: string;
  label: string;
  description: string;
  content: string;
}

export interface CompareLine {
  label: string;
  base: string;
  ours: string;
  theirs: string;
  twoWay: string | null;
  threeWay: string | null;
}
