// 직접 실험: the learner's own input, read from and written to the URL query
// so a run can be shared (?lesson=custom&head=53&max=199&dir=down&q=98,183,…&algs=sstf,look).
// Pure: parse, validate (Korean messages), serialise.
import { josa } from "@/lib/josa.ts";
import { ALGORITHMS, INITIAL_HEAD, MAX_CYLINDER, REQUESTS } from "./engine.ts";
import type { Algorithm, Direction, DiskInput } from "./types.ts";

export const MAX_REQUESTS = 12;
export const MIN_MAX = 19;
export const MAX_MAX = 999;

export interface CustomInput extends DiskInput {
  /** The two methods compared (distinct). */
  pair: [Algorithm, Algorithm];
}

/** The textbook batch (Silberschatz 11.2), compared SSTF vs LOOK. */
export const DEFAULT_INPUT: CustomInput = {
  requests: [...REQUESTS],
  head: INITIAL_HEAD,
  max: MAX_CYLINDER,
  direction: "down",
  pair: ["sstf", "look"],
};

export interface Preset {
  id: string;
  label: string;
  note: string;
  input: CustomInput;
}

export const PRESETS: Preset[] = [
  {
    id: "textbook",
    label: "교재 예제",
    note: "레슨 01–03과 같은 요청 8개",
    input: DEFAULT_INPUT,
  },
  {
    id: "starve",
    label: "기아 실험",
    note: "헤드 근처에 요청이 몰리고 하나만 멀리",
    input: {
      requests: [52, 47, 55, 44, 58, 190, 41, 61, 38, 64],
      head: 50,
      max: 199,
      direction: "down",
      pair: ["sstf", "scan"],
    },
  },
  {
    id: "edge",
    label: "끝까지 갈까",
    note: "진행 방향 끝 쪽이 비어 있는 큐",
    input: {
      requests: [120, 90, 150, 70, 160, 110],
      head: 100,
      max: 199,
      direction: "down",
      pair: ["scan", "look"],
    },
  },
  {
    id: "return",
    label: "복귀 비용",
    note: "양쪽 끝에 요청이 흩어진 큐",
    input: {
      requests: [180, 20, 150, 45, 195, 5, 120, 70],
      head: 100,
      max: 199,
      direction: "up",
      pair: ["scan", "cscan"],
    },
  },
];

/** The form as typed: every field a string, so a half-typed value can be shown and checked. */
export interface Draft {
  head: string;
  max: string;
  direction: Direction;
  requests: string;
  a: Algorithm;
  b: Algorithm;
}

export const draftOf = (input: CustomInput): Draft => ({
  head: String(input.head),
  max: String(input.max),
  direction: input.direction,
  requests: input.requests.join(", "),
  a: input.pair[0],
  b: input.pair[1],
});

export type DraftErrors = Partial<Record<"head" | "max" | "requests" | "pair", string>>;

const INT = /^\d+$/;

/** Check a draft: either the input, or a message per field (합니다체). */
export function validate(
  draft: Draft,
): { ok: true; input: CustomInput } | { ok: false; errors: DraftErrors } {
  const errors: DraftErrors = {};
  const maxText = draft.max.trim();
  const max = Number(maxText);
  if (!INT.test(maxText) || max < MIN_MAX || max > MAX_MAX)
    errors.max = `마지막 실린더는 ${MIN_MAX}부터 ${MAX_MAX}까지의 정수로 입력합니다.`;
  const limit = errors.max ? MAX_MAX : max;
  const headText = draft.head.trim();
  const head = Number(headText);
  if (!INT.test(headText) || head > limit)
    errors.head = `시작 헤드는 0부터 ${limit}까지의 정수로 입력합니다.`;
  const parts = draft.requests
    .split(/[\s,，、·]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const bad = parts.filter((p) => !INT.test(p) || Number(p) > limit);
  if (!parts.length) errors.requests = "요청 실린더를 하나 이상 입력합니다. 예: 98, 183, 37";
  else if (bad.length)
    errors.requests = `‘${bad[0]}’${josa(bad[0], "은/는").slice(bad[0].length)} 0부터 ${limit}까지의 정수가 아닙니다. 쉼표나 공백으로 구분합니다.`;
  else if (parts.length > MAX_REQUESTS)
    errors.requests = `요청은 ${MAX_REQUESTS}개까지 넣을 수 있습니다. 지금 ${parts.length}개입니다.`;
  const dup = parts.find((p, i) => parts.indexOf(p) !== i && INT.test(p));
  if (!errors.requests && dup !== undefined)
    errors.requests = `${dup}번 실린더가 두 번 들어 있습니다. 같은 실린더는 한 번만 넣습니다.`;
  if (draft.a === draft.b) errors.pair = "서로 다른 두 방식을 고릅니다.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    input: {
      requests: parts.map(Number),
      head,
      max,
      direction: draft.direction,
      pair: [draft.a, draft.b],
    },
  };
}

const isAlgorithm = (s: string): s is Algorithm => (ALGORITHMS as readonly string[]).includes(s);

/**
 * The input named by the query, or the default. A query that does not
 * validate falls back to the default and says why (shown on the page).
 */
export function readInput(search: string): { input: CustomInput; problem: string | null } {
  const q = new URLSearchParams(search);
  if (!["head", "max", "dir", "q", "algs"].some((k) => q.has(k)))
    return { input: DEFAULT_INPUT, problem: null };
  const algs = (q.get("algs") ?? "").split(",");
  const draft: Draft = {
    head: q.get("head") ?? String(DEFAULT_INPUT.head),
    max: q.get("max") ?? String(DEFAULT_INPUT.max),
    direction: q.get("dir") === "up" ? "up" : "down",
    requests: q.get("q") ?? DEFAULT_INPUT.requests.join(","),
    a: isAlgorithm(algs[0]) ? algs[0] : DEFAULT_INPUT.pair[0],
    b: isAlgorithm(algs[1]) ? algs[1] : DEFAULT_INPUT.pair[1],
  };
  const result = validate(draft);
  if (result.ok) return { input: result.input, problem: null };
  return {
    input: DEFAULT_INPUT,
    problem: `주소의 입력을 쓸 수 없어 기본 입력으로 엽니다. ${Object.values(result.errors)[0]}`,
  };
}

/** The query of an input (lesson=custom first). */
export function queryOf(input: CustomInput): string {
  const q = new URLSearchParams({
    lesson: "custom",
    head: String(input.head),
    max: String(input.max),
    dir: input.direction,
    q: input.requests.join(","),
    algs: input.pair.join(","),
  });
  return `?${q.toString().replaceAll("%2C", ",")}`;
}

export const sameInput = (a: CustomInput, b: CustomInput) => queryOf(a) === queryOf(b);
