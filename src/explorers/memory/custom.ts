// 직접 실험: the learner's own reference string, frame count and two policies.
// The configuration lives in the URL query so a run can be shared:
//   ?lesson=custom&refs=ABCADABEAB&frames=3&policies=fifo,lru
// parseCustom() never throws: a broken query falls back to the defaults and
// reports what was wrong, in Korean, for the form to show.
import type { Algorithm } from "./types.ts";

export const CUSTOM_PAGES = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
export const MAX_REFS = 16;
export const MIN_FRAMES = 1;
export const MAX_FRAMES = 6;
export const CUSTOM_POLICIES: readonly Algorithm[] = ["fifo", "lru", "opt", "clock"];

export interface CustomConfig {
  refs: string[];
  frames: number;
  policies: [Algorithm, Algorithm];
}

export const DEFAULT_CUSTOM: CustomConfig = {
  refs: "ABCDABEABCDE".split(""),
  frames: 3,
  policies: ["fifo", "lru"],
};

/** Ready-made inputs for the form: each shows something on its own. */
export const PRESETS: { id: string; label: string; config: CustomConfig }[] = [
  {
    id: "textbook",
    label: "레슨 01 순서",
    config: { refs: "ABCADABEAB".split(""), frames: 3, policies: ["fifo", "lru"] },
  },
  {
    id: "loop",
    label: "반복 루프",
    config: { refs: "ABCDABCDABCD".split(""), frames: 3, policies: ["lru", "opt"] },
  },
  {
    id: "belady",
    label: "Belady 순서",
    config: { refs: "ABCDABEABCDE".split(""), frames: 4, policies: ["fifo", "lru"] },
  },
  {
    id: "locality",
    label: "지역성 강함",
    config: { refs: "ABACABADAEAFAGAH".split(""), frames: 3, policies: ["fifo", "clock"] },
  },
];

/** Letters from free text: spaces, commas and lower case are accepted. */
export function refsFromText(text: string): string[] {
  return [...text.toUpperCase().replace(/[\s,·]+/g, "")];
}

/** Every problem with a configuration, as sentences to show; [] when it can run. */
export function validateCustom(config: {
  refs: string[];
  frames: number;
  policies: readonly string[];
}): string[] {
  const errors: string[] = [];
  const wrong = [
    ...new Set(config.refs.filter((p) => !(CUSTOM_PAGES as readonly string[]).includes(p))),
  ];
  if (!config.refs.length) errors.push("접근 순서를 한 번 이상 입력하세요.");
  else if (wrong.length)
    errors.push(`페이지는 A부터 H까지만 쓸 수 있습니다. 바꿀 글자: ${wrong.join(" ")}`);
  if (config.refs.length > MAX_REFS)
    errors.push(
      `접근은 ${MAX_REFS}번까지 입력할 수 있습니다. 지금은 ${config.refs.length}번입니다.`,
    );
  if (!Number.isInteger(config.frames) || config.frames < MIN_FRAMES || config.frames > MAX_FRAMES)
    errors.push(`프레임 수는 ${MIN_FRAMES}개부터 ${MAX_FRAMES}개까지 고를 수 있습니다.`);
  const [a, b] = config.policies;
  if (
    config.policies.length !== 2 ||
    ![a, b].every((p) => CUSTOM_POLICIES.includes(p as Algorithm))
  )
    errors.push("비교할 정책을 FIFO·LRU·OPT·클럭 중에서 두 개 고르세요.");
  else if (a === b) errors.push("두 정책이 같습니다. 서로 다른 정책 두 개를 고르세요.");
  return errors;
}

/** The query string (without "?") for a configuration. */
export function customQuery(config: CustomConfig): string {
  const q = new URLSearchParams({
    lesson: "custom",
    refs: config.refs.join(""),
    frames: String(config.frames),
    policies: config.policies.join(","),
  });
  return q.toString();
}

/** The configuration in a query string, or the defaults with the reasons it was rejected. */
export function parseCustom(search: string): { config: CustomConfig; errors: string[] } {
  const q = new URLSearchParams(search);
  if (!q.has("refs") && !q.has("frames") && !q.has("policies"))
    return { config: DEFAULT_CUSTOM, errors: [] };
  const config = {
    refs: refsFromText(q.get("refs") ?? ""),
    frames: Number(q.get("frames") ?? DEFAULT_CUSTOM.frames),
    policies: (q.get("policies") ?? DEFAULT_CUSTOM.policies.join(",")).split(","),
  };
  const errors = validateCustom(config);
  if (errors.length) return { config: DEFAULT_CUSTOM, errors };
  return { config: { ...config, policies: config.policies as [Algorithm, Algorithm] }, errors };
}

/** The distinct pages of a reference string, in alphabetical order. */
export const pagesOf = (refs: readonly string[]) => [...new Set(refs)].toSorted();
