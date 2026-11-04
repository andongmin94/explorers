// Reconstructed from the distributed Protocol Explorer JavaScript.
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
const LANGUAGE_STORAGE_KEY = "protocol-explorer:lang";
const supportedLanguages = [
  {
    code: "en",
    name: "English",
    short: "EN",
    html: "en",
  },
  {
    code: "es",
    name: "Español",
    short: "ES",
    html: "es",
    load: () => import("./locales/es.js"),
  },
  {
    code: "pt",
    name: "Português",
    short: "PT",
    html: "pt-BR",
    load: () => import("./locales/pt.js"),
  },
  {
    code: "fr",
    name: "Français",
    short: "FR",
    html: "fr",
    load: () => import("./locales/fr.js"),
  },
  {
    code: "de",
    name: "Deutsch",
    short: "DE",
    html: "de",
    load: () => import("./locales/de.js"),
  },
  {
    code: "tr",
    name: "Türkçe",
    short: "TR",
    html: "tr",
    load: () => import("./locales/tr.js"),
  },
  {
    code: "id",
    name: "Bahasa Indonesia",
    short: "ID",
    html: "id",
    load: () => import("./locales/id.js"),
  },
  {
    code: "ja",
    name: "日本語",
    short: "JA",
    html: "ja",
    load: () => import("./locales/ja.js"),
  },
  {
    code: "zh",
    name: "简体中文",
    short: "ZH",
    html: "zh-CN",
    load: () => import("./locales/zh.js"),
  },
  {
    code: "zh-TW",
    name: "繁體中文",
    short: "TW",
    html: "zh-TW",
    load: () => import("./locales/zh-TW.js"),
  },
  {
    code: "ko",
    name: "한국어",
    short: "KO",
    html: "ko",
    load: () => import("./locales/ko.js"),
  },
  {
    code: "hi",
    name: "हिन्दी",
    short: "HI",
    html: "hi",
    load: () => import("./locales/hi.js"),
  },
  {
    code: "ar",
    name: "العربية",
    short: "AR",
    html: "ar",
    dir: "rtl",
    load: () => import("./locales/ar.js"),
  },
  {
    code: "he",
    name: "עברית",
    short: "HE",
    html: "he",
    dir: "rtl",
    load: () => import("./locales/he.js"),
  },
];
let currentLanguage = "en";
let currentLanguagePack = null;
const languageListeners = new Set();
function interpolateTranslation(text, values) {
  if (!values) {
    return text;
  }
  return text.replace(/\{(\w+)\}/g, (placeholder, name) =>
    name in values ? values[name] : placeholder,
  );
}

/** Exact strings take priority over patterns; interpolation precedes locale typography. */
function translate(text, values) {
  if (typeof text !== "string" || !text) {
    return text;
  }
  let translated = text;
  if (currentLanguagePack) {
    const exactTranslation = currentLanguagePack.strings[text];
    if (exactTranslation !== undefined) {
      translated = exactTranslation;
    } else {
      for (const [pattern, replacement] of currentLanguagePack.patterns) {
        if (pattern.test(text)) {
          translated = text.replace(pattern, replacement);
          break;
        }
      }
    }
  }
  translated = interpolateTranslation(translated, values);
  return currentLanguagePack?.post
    ? currentLanguagePack.post(translated)
    : translated;
}
const getLanguage = () => currentLanguage;
const isRtl = () =>
  supportedLanguages.find((language) => language.code === currentLanguage)
    .dir === "rtl";
const isolateLtrText = (text) => (isRtl() ? `⁦${text}⁩` : text);
const RTL_CHARACTERS = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefc]/;
const needsLtrDirection = (text) => isRtl() && !RTL_CHARACTERS.test(text);
const localizedUpperCase = (text) =>
  text.toLocaleUpperCase(
    supportedLanguages.find((language) => language.code === currentLanguage)
      .html,
  );
const translatedElementContent = (text, uppercase = false) =>
  `data-t="${escapeHtml(text)}"${uppercase ? " data-t-upper" : ""}>${escapeHtml(uppercase ? localizedUpperCase(translate(text)) : translate(text))}`;
function translateDom(root) {
  root.querySelectorAll("[data-t]").forEach((element) => {
    const translated = translate(element.dataset.t);
    element.textContent = element.hasAttribute("data-t-upper")
      ? localizedUpperCase(translated)
      : translated;
  });
  root.querySelectorAll("[data-t-title]").forEach((element) => {
    element.title = translate(element.dataset.tTitle);
  });
  root.querySelectorAll("[data-t-label]").forEach((element) => {
    element.setAttribute("aria-label", translate(element.dataset.tLabel));
  });
}
async function loadLanguagePack(languageCode) {
  const language = supportedLanguages.find(
    (candidate) => candidate.code === languageCode,
  );
  if (!language?.load) {
    return null;
  }
  const { strings, patterns = [], post } = (await language.load()).default;
  return {
    strings,
    patterns,
    post,
  };
}
let languageRequestId = 0;
async function setLanguage(requestedCode, persist = true) {
  const requestId = ++languageRequestId;
  const languageCode = supportedLanguages.some(
    (language) => language.code === requestedCode,
  )
    ? requestedCode
    : "en";
  const languagePack = await loadLanguagePack(languageCode);
  // A slower import must not overwrite a language selected more recently.
  if (requestId !== languageRequestId) {
    return;
  }
  currentLanguagePack = languagePack;
  currentLanguage = languageCode;
  const language = supportedLanguages.find(
    (candidate) => candidate.code === languageCode,
  );
  document.documentElement.lang = language.html;
  document.documentElement.dir = language.dir ?? "ltr";
  if (persist) {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, languageCode);
    } catch {}
  }
  languageListeners.forEach((listener) => listener(languageCode));
}
const onLanguageChange = (listener) => languageListeners.add(listener);
async function restoreLanguage() {
  let savedLanguage = null;
  try {
    savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {}
  if (savedLanguage && savedLanguage !== "en") {
    await setLanguage(savedLanguage, false).catch(() => {});
  }
}
export {
  escapeHtml,
  getLanguage,
  isRtl,
  isolateLtrText,
  localizedUpperCase,
  needsLtrDirection,
  onLanguageChange,
  restoreLanguage,
  setLanguage,
  supportedLanguages,
  translate,
  translateDom,
  translatedElementContent,
};
