// Reconstructed from the distributed Protocol Explorer JavaScript.
const escapeHtml = (e) =>
  String(e).replace(
    /[&<>"]/g,
    (t) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
      })[t],
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
const interpolateTranslation = (e, t) =>
  t ? e.replace(/\{(\w+)\}/g, (s, a) => (a in t ? t[a] : s)) : e;
function translate(e, t) {
  if (typeof e != "string" || !e) return e;
  let s = e;
  if (currentLanguagePack) {
    const a = currentLanguagePack.strings[e];
    if (a !== void 0) s = a;
    else
      for (const [n, o] of currentLanguagePack.patterns)
        if (n.test(e)) {
          s = e.replace(n, o);
          break;
        }
  }
  return (
    (s = interpolateTranslation(s, t)),
    currentLanguagePack?.post ? currentLanguagePack.post(s) : s
  );
}
const getLanguage = () => currentLanguage;
const isRtl = () =>
  supportedLanguages.find((e) => e.code === currentLanguage).dir === "rtl";
const isolateLtrText = (e) => (isRtl() ? `⁦${e}⁩` : e);
const RTL_CHARACTERS = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefc]/;
const needsLtrDirection = (e) => isRtl() && !RTL_CHARACTERS.test(e);
const localizedUpperCase = (e) =>
  e.toLocaleUpperCase(
    supportedLanguages.find((t) => t.code === currentLanguage).html,
  );
const translatedElementContent = (e, t = !1) =>
  `data-t="${escapeHtml(e)}"${t ? " data-t-upper" : ""}>${escapeHtml(t ? localizedUpperCase(translate(e)) : translate(e))}`;
function translateDom(e) {
  (e.querySelectorAll("[data-t]").forEach((t) => {
    const s = translate(t.dataset.t);
    t.textContent = t.hasAttribute("data-t-upper") ? localizedUpperCase(s) : s;
  }),
    e
      .querySelectorAll("[data-t-title]")
      .forEach((t) => (t.title = translate(t.dataset.tTitle))),
    e
      .querySelectorAll("[data-t-label]")
      .forEach((t) =>
        t.setAttribute("aria-label", translate(t.dataset.tLabel)),
      ));
}
async function loadLanguagePack(e) {
  const t = supportedLanguages.find((o) => o.code === e);
  if (!t?.load) return null;
  const { strings: s, patterns: a = [], post: n } = (await t.load()).default;
  return {
    strings: s,
    patterns: a,
    post: n,
  };
}
let languageRequestId = 0;
async function setLanguage(e, t = !0) {
  const s = ++languageRequestId,
    a = supportedLanguages.some((r) => r.code === e) ? e : "en",
    n = await loadLanguagePack(a);
  if (s !== languageRequestId) return;
  ((currentLanguagePack = n), (currentLanguage = a));
  const o = supportedLanguages.find((r) => r.code === a);
  if (
    ((document.documentElement.lang = o.html),
    (document.documentElement.dir = o.dir ?? "ltr"),
    t)
  )
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, a);
    } catch {}
  languageListeners.forEach((r) => r(a));
}
const onLanguageChange = (e) => languageListeners.add(e);
async function restoreLanguage() {
  let e = null;
  try {
    e = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {}
  e && e !== "en" && (await setLanguage(e, !1).catch(() => {}));
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
