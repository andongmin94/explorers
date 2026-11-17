// The lesson source uses English keys; the app always renders their Korean text.
import korean from "./locales/ko.js";

const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
      })[character],
  );

function interpolateTranslation(text, values) {
  if (!values) {
    return text;
  }
  return text.replace(/\{(\w+)\}/g, (placeholder, name) =>
    name in values ? values[name] : placeholder,
  );
}

/** Exact strings take priority over patterns; preserve protocol names and bytes. */
function translate(text, values) {
  if (typeof text !== "string" || !text) {
    return text;
  }
  let translated = korean.strings[text];
  if (translated === undefined) {
    translated = text;
    for (const [pattern, replacement] of korean.patterns) {
      if (pattern.test(text)) {
        translated = text.replace(pattern, replacement);
        break;
      }
    }
  }
  return interpolateTranslation(translated, values);
}

// Korean and technical packet values both use left-to-right presentation.
const isRtl = () => false;
const isolateLtrText = (text) => text;
const needsLtrDirection = () => false;
const localizedUpperCase = (text) => text.toLocaleUpperCase("ko");
const translatedElementContent = (text, uppercase = false) =>
  `data-t="${escapeHtml(text)}"${uppercase ? " data-t-upper" : ""}>${escapeHtml(uppercase ? localizedUpperCase(translate(text)) : translate(text))}`;

export {
  escapeHtml,
  isRtl,
  isolateLtrText,
  localizedUpperCase,
  needsLtrDirection,
  translate,
  translatedElementContent,
};
