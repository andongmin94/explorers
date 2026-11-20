// Wording and number formatting shared by the CPU page's panels.
import type { Algorithm, ProcessDef, Status } from "./types.ts";

export const number = (value: number) => Number(value.toFixed(2)).toLocaleString("ko-KR");

/**
 * Korean reading text: a number never wraps away from its unit, and the right
 * side of an equation stays on the line with its "=". For plain strings
 * (content with <b> tags goes through it before dangerouslySetInnerHTML).
 */
export const keepUnits = (text: string) =>
  text.replace(/(\d) (ms|회)(?![^<]*>)/g, "$1 $2").replace(/ = (?=\d)(?![^<]*>)/g, " = ");

/** A job's colour token (var(--p1) …), grey for the CPU itself. */
export const colorOf = (id: string | null | undefined) =>
  id ? `var(--${id.toLowerCase()})` : "var(--sys-gray)";

/** "CPU 5 → 입출력 4 → CPU 3" */
export const recipe = (p: ProcessDef) =>
  p.cpu.map((c, i) => `${i ? `입출력 ${p.io[i - 1]} → ` : ""}CPU ${c}`).join(" → ");

export const stateNames: Record<Status, string> = {
  new: "도착 예정",
  ready: "준비 큐에서 대기",
  running: "CPU 실행 중",
  blocked: "입출력 대기",
  done: "완료",
};

const moveExplanations: Record<string, string> = {
  arrive: "도착한 작업이 준비 큐 뒤에 합류합니다.",
  unblock: "입출력이 끝난 작업이 준비 큐 뒤에 합류합니다.",
  preempt: "시간 할당량을 다 쓴 작업이 진행한 계산을 보존한 채 준비 큐 뒤로 이동합니다.",
  dispatch: "준비 큐 맨 앞(가장 먼저 줄을 선) 작업이 CPU로 이동합니다.",
  block: "현재 CPU 구간을 마친 작업이 입출력 장치로 이동합니다.",
  complete: "마지막 CPU 구간을 마친 작업이 완료 칸으로 이동합니다.",
};
// SJF and SRTF pick from anywhere in the queue; SRTF preempts on arrival.
const shortestMoves: Record<string, string> = {
  preempt: "더 짧은 작업에 밀린 작업이 진행한 계산을 보존한 채 준비 큐로 이동합니다.",
  dispatch: "준비 큐에서 남은 CPU 시간이 가장 짧은 작업이 CPU로 이동합니다.",
  complete: "CPU 시간을 다 쓴 작업이 완료 칸으로 이동합니다.",
};

/** What a move means, said while the token travels. */
export const moveText = (type: string, algorithm: Algorithm, hasIo: boolean) =>
  (["sjf", "srtf"].includes(algorithm) && shortestMoves[type]) ||
  (!hasIo && type === "complete" ? shortestMoves.complete : moveExplanations[type]);
