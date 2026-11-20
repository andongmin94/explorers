// Types every transaction lesson shares: the 해설 of one event, the 핵심
// 장면 list and the prediction a lesson asks.
export type ClientId = "T1" | "T2";

/** The 해설 for one event (describeStep and friends). */
export interface StepText {
  eyebrow: string;
  title: string;
  summary: string;
  goal: string;
  details: string[];
  key: string;
  sql: string | null;
}

/** A 핵심 장면: a guided stop at the event `index`. */
export interface Milestone {
  index: number;
  label: string;
  description: string;
}

export interface QuizOption {
  id: string;
  label: string;
  feedback: string;
}

/** A prediction asked at one event (before the next one plays). */
export interface Quiz {
  /** Stable id within the lesson (isolation lessons ask two). */
  id?: string;
  /** Where playback stopped ("T1 커밋 직후"). */
  label?: string;
  /** What is predicted, for the key ("최종 재고, 먼저 맞혀보기 →"). */
  target?: string;
  question: string;
  facts: [string, string][];
  options: QuizOption[];
  answerId: string;
}
