/**
 * Korean particles after labels such as "P1" or "F2", as the CPU explorer
 * reads them: digits in English (피원·피투·피쓰리), so josa("P3", "가") is
 * "P3가". The shared rules live in src/lib/josa.ts.
 */
import { josa as base } from "@/lib/josa.ts";

/** josa("P1", "가") → "P1이"; josa("F1", "으로", { digits: "ko" }) → "F1로". */
export const josa = (
  word: string | number,
  particle: string,
  { digits = "en" as "en" | "ko" } = {},
) => base(word, particle, { digits });
