// The lesson source uses English keys; the app always renders their Korean text.
import korean from "./locales/ko.ts";

const escapeHtml = (value: unknown) =>
  String(value).replace(
    /[&<>"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
      })[character as "&" | "<" | ">" | '"'],
  );

type Values = Record<string, string | number>;

function interpolateTranslation(text: string, values?: Values) {
  if (!values) {
    return text;
  }
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    name in values ? String(values[name]) : placeholder,
  );
}

/** Exact strings take priority over patterns; preserve protocol names and bytes. */
function translate(text: string, values?: Values): string;
function translate<T>(text: T, values?: Values): T;
function translate(text: unknown, values?: Values): unknown {
  if (typeof text !== "string" || !text) {
    return text;
  }
  let translated = korean.strings[text];
  if (translated === undefined) {
    translated = text;
    for (const [pattern, replacement] of korean.patterns) {
      if (pattern.test(text)) {
        translated = text.replace(pattern, replacement as string);
        break;
      }
    }
  }
  return interpolateTranslation(translated, values);
}

// Korean and technical packet values both use left-to-right presentation.
const isRtl = () => false;
const isolateLtrText = (text: string) => text;
const needsLtrDirection = () => false;
const localizedUpperCase = (text: string) => text.toLocaleUpperCase("ko");

export { escapeHtml, isRtl, isolateLtrText, localizedUpperCase, needsLtrDirection, translate };
