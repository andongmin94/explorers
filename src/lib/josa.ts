// Korean particles after a word that may end in Hangul, a digit or Latin.
//   josa("T1", "이/가") → "T1이", josa("9", "을/를") → "9를", josa("CYL", "으로") → "CYL로"
//   josa("P3", "가", { digits: "en" }) → "P3가" (피쓰리)
// The particle is a pair ("이/가") or either form of it ("가", "이", "으로").
// Digits are read in Korean by default (영·일·이·삼…); pass digits: "en" for
// ids read in English (원·투·쓰리…), as the CPU explorer does for P1–P3.

type Final = string | null;

const PAIRS: [string, string][] = [
  ["이", "가"],
  ["은", "는"],
  ["을", "를"],
  ["과", "와"],
  ["으로", "로"],
  ["이었", "였"],
  ["이라", "라"],
  ["아", "야"],
];
// Final consonant of each digit's reading: null = none, "ㄹ" matters for 으로/로.
const DIGITS: Record<"en" | "ko", Final[]> = {
  // 제로 원 투 쓰리 포 파이브 식스 세븐 에잇 나인
  en: [null, "ㄴ", null, null, null, null, null, "ㄴ", "ㅅ", "ㄴ"],
  // 영 일 이 삼 사 오 육 칠 팔 구
  ko: ["ㅇ", "ㄹ", null, "ㅁ", null, null, "ㄱ", "ㄹ", "ㄹ", null],
};
// Latin letters read as Korean (엘, 엠, 엔, 알): final consonant sound.
const LETTERS: Record<string, Final> = { L: "ㄹ", M: "ㅁ", N: "ㄴ", R: "ㄹ" };
const FINALS: Final[] = [
  null,
  "ㄱ",
  "ㄲ",
  "ㄳ",
  "ㄴ",
  "ㄵ",
  "ㄶ",
  "ㄷ",
  "ㄹ",
  "ㄺ",
  "ㄻ",
  "ㄼ",
  "ㄽ",
  "ㄾ",
  "ㄿ",
  "ㅀ",
  "ㅁ",
  "ㅂ",
  "ㅄ",
  "ㅅ",
  "ㅆ",
  "ㅇ",
  "ㅈ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ",
];

export interface JosaOptions {
  digits?: "en" | "ko";
}

function finalOf(word: string | number, digits: "en" | "ko"): Final {
  const last = String(word).trim().at(-1) ?? "";
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return FINALS[(code - 0xac00) % 28];
  if (/\d/.test(last)) return DIGITS[digits][Number(last)];
  return LETTERS[last.toUpperCase()] ?? null;
}

/** Attach the right particle; throws RangeError for an unknown particle. */
export function josa(
  word: string | number,
  particle: string,
  { digits = "ko" }: JosaOptions = {},
): string {
  const wanted = particle.includes("/") ? particle.split("/") : [particle];
  const pair = PAIRS.find((entry) => wanted.every((form) => entry.includes(form)));
  if (!pair) throw new RangeError(`unknown particle: ${particle}`);
  const final = finalOf(word, digits);
  const withConsonant = pair[0] === "으로" ? final !== null && final !== "ㄹ" : final !== null;
  return `${word}${withConsonant ? pair[0] : pair[1]}`;
}

export const ga = (w: string | number) => josa(w, "이/가");
export const eul = (w: string | number) => josa(w, "을/를");
export const eun = (w: string | number) => josa(w, "은/는");
export const ro = (w: string | number) => josa(w, "으로");
