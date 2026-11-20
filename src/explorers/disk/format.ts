// Wording helpers shared by the disk page's panels.
import { josa } from "@/lib/josa.ts";

/**
 * keep-all still breaks after a hyphen ("C-" / "SCAN") and before "= 31칸":
 * glue rule names such as C-SCAN with a word joiner and keep a short
 * equation's "=" on its line, in the rendered text only (the data stays as
 * is). The vanilla page ran the same replacement over its text nodes.
 */
export const fix = (text: string) =>
  /[A-Z]-[A-Z]| [=−+] /.test(text)
    ? text.replace(/([A-Z])-(?=[A-Z])/g, "$1-⁠").replace(/ ([=−+]) /g, " $1 ")
    : text;

/** "SCAN으로", "LOOK으로" (룩), "C-SCAN으로": the method names as they are read. */
export const ro = (name: string) => (name === "LOOK" ? "LOOK으로" : josa(name, "으로"));
