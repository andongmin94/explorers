/**
 * Korean particles after labels such as "P1" or "F2". Which form follows
 * depends on how the last character is read aloud: Hangul syllables by their
 * final consonant, digits by the reading the app uses ("en": 원·투·쓰리,
 * "ko": 영·일·이), Latin letters by their Korean names (엘, 엠, 엔, 알 end in
 * a consonant).
 */
const PAIRS = [
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
const DIGITS = {
  // 제로 원 투 쓰리 포 파이브 식스 세븐 에잇 나인
  en: [null, "ㄴ", null, null, null, null, null, "ㄴ", "ㅅ", "ㄴ"],
  // 영 일 이 삼 사 오 육 칠 팔 구
  ko: ["ㅇ", "ㄹ", null, "ㅁ", null, null, "ㄱ", "ㄹ", "ㄹ", null],
};
const LETTERS = { L: "ㄹ", M: "ㅁ", N: "ㄴ", R: "ㄹ" };
const FINALS = [null, "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

function finalOf(word, digits) {
  const last = String(word).trim().at(-1) ?? "";
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return FINALS[(code - 0xac00) % 28];
  if (/\d/.test(last)) return DIGITS[digits][Number(last)];
  return LETTERS[last.toUpperCase()] ?? null;
}

/** josa("P1", "가") → "P1이"; josa("F1", "으로", { digits: "ko" }) → "F1로". */
export function josa(word, particle, { digits = "en" } = {}) {
  const pair = PAIRS.find((entry) => entry.includes(particle));
  if (!pair) throw new RangeError(`unknown particle: ${particle}`);
  const final = finalOf(word, digits);
  const withConsonant = pair[0] === "으로" ? final !== null && final !== "ㄹ" : final !== null;
  return `${word}${withConsonant ? pair[0] : pair[1]}`;
}
