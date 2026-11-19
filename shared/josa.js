// Korean particles after a word that may end in Hangul, a digit or Latin.
// josa("T1", "이/가") → "T1이", josa("9", "을/를") → "9를", josa("CYL", "으로") → "CYL로".

const DIGIT_FINAL = { 0: true, 1: true, 2: false, 3: true, 4: false, 5: false, 6: true, 7: true, 8: true, 9: false };
const DIGIT_RIEUL = { 1: true, 7: true, 8: true };
// Latin letters read as Korean (엘, 알, 엠, 엔): final consonant sound.
const LATIN_FINAL = { l: "rieul", r: "rieul", m: true, n: true };

function finalOf(word) {
  const s = String(word).trim();
  const ch = s.at(-1) ?? "";
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28;
    return { has: jong !== 0, rieul: jong === 8 };
  }
  if (/[0-9]/.test(ch)) return { has: DIGIT_FINAL[ch], rieul: Boolean(DIGIT_RIEUL[ch]) };
  const low = ch.toLowerCase();
  if (low in LATIN_FINAL) {
    const v = LATIN_FINAL[low];
    return { has: Boolean(v), rieul: v === "rieul" };
  }
  return { has: false, rieul: false };
}

const PAIRS = {
  "이/가": ["이", "가"],
  "을/를": ["을", "를"],
  "은/는": ["은", "는"],
  "과/와": ["과", "와"],
  "이었/였": ["이었", "였"],
  "이라/라": ["이라", "라"],
  "아/야": ["아", "야"],
};

/** Attach the right particle. pair is "이/가", "을/를", "은/는", "과/와", "으로" … */
export function josa(word, pair) {
  const { has, rieul } = finalOf(word);
  if (pair === "으로" || pair === "으로/로") return `${word}${has && !rieul ? "으로" : "로"}`;
  const [withFinal, without] = PAIRS[pair] ?? pair.split("/");
  return `${word}${has ? withFinal : without}`;
}

export const ga = (w) => josa(w, "이/가");
export const eul = (w) => josa(w, "을/를");
export const eun = (w) => josa(w, "은/는");
export const ro = (w) => josa(w, "으로");
