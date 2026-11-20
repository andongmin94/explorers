// Wording helpers shared by the Git page's panels (from git/src/main.js).
import type { GitState } from "./types.ts";

export const pad = (n: number) => String(n).padStart(2, "0");

// Word joiners where Korean text must not break: inside an option like
// --no-ff ("--" / "no-ff") and between a closing bracket or quote and the
// particle after it ("버튼(4번째 줄)" / "을").
export const keepFlags = (text: string | null | undefined) =>
  String(text ?? "")
    .replace(/--[a-z][\w-]*/g, (flag) => flag.replaceAll("-", "-⁠"))
    .replace(/([)’”'"])(?=[가-힣])/g, "$1⁠");

/** The title line of a snapshot ("제목: …" without the label). */
export const titleOf = (content: string) =>
  content
    .split("\n")
    .find((line) => line.startsWith("제목:"))
    ?.replace(/^제목:\s*/, "") ?? "";

export const headCommit = (state: GitState) =>
  state.commits.find((c) => c.id === state.refs[state.currentBranch])!;

const indexNames: Record<string, string> = {
  clean: "커밋과 같음",
  staged: "다음 커밋 준비",
  unmerged: "미해결 세 버전",
  comparing: "세 버전 기록 중",
};
/** The index row of the 변화 tab; `pending` hides "unresolved" while prediction 10 is open. */
export const indexLabel = (state: GitState, pending = false) =>
  state.merge && state.index.status === "staged"
    ? "해결 등록 완료"
    : pending && state.index.status === "unmerged"
      ? "stage 1·2·3"
      : indexNames[state.index.status];
