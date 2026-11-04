// Reconstructed from the distributed Protocol Explorer JavaScript.
import { protocolCatalog } from "../lessons/index.js";
import { icons } from "./icons.js";
import { getLessonCompletion, getLessonStatus } from "../progress.js";
import { animateTextChange } from "./motion.js";
import {
  getLanguage,
  localizedUpperCase,
  supportedLanguages,
  translate,
  translatedElementContent,
} from "../i18n.js";
const LOGO_SVG = `
<svg class="logo-cube" viewBox="0 0 64 64" aria-hidden="true">
  <g fill="currentColor" stroke="var(--bg)" stroke-width="2.4" stroke-linejoin="round">
    <path d="M32 3 L58 16.5 L32 30 L6 16.5 Z" />
    <path d="M6 16.5 L32 30 L32 45.5 L6 32 Z" />
    <path d="M58 16.5 L32 30 L32 45.5 L58 32 Z" />
    <path d="M6 32 L32 45.5 L32 61 L6 47.5 Z" />
    <path d="M58 32 L32 45.5 L32 61 L58 47.5 Z" />
  </g>
</svg>`;
function renderLearningProgress() {
  const e = protocolCatalog
    .map((t, s) => `<span class="learning-seg"><i style="--i:${s}"></i></span>`)
    .join("");
  return `
  <div class="learning">
    <div class="learning-head">
      <span class="learning-label" ${translatedElementContent("LEARNING PROGRESS")}</span>
      <span class="learning-value"></span>
    </div>
    <div class="learning-bars" role="img">${e}</div>
    <div class="learning-sub"><span class="learning-done"></span> / ${protocolCatalog.length} <span ${translatedElementContent("COMPLETE")}</span> <span class="dot">·</span> <span class="learning-active"></span> <span ${translatedElementContent("IN PROGRESS")}</span></div>
  </div>`;
}
function updateLearningProgress(e, t) {
  const s = protocolCatalog
      .map((o) => ({
        name: o.name,
        value: getLessonCompletion(t[o.id]),
        status: getLessonStatus(t[o.id]),
      }))
      .sort((o, r) => r.value - o.value),
    a = Math.round((s.reduce((o, r) => o + r.value, 0) / s.length) * 100),
    n = e.querySelector(".learning");
  (n.querySelectorAll(".learning-seg").forEach((o, r) => {
    const i = s[r];
    (o.classList.toggle("partial", i.value > 0 && i.value < 1),
      (o.title = `${i.name}: ${Math.round(i.value * 100)}%`),
      (o.firstElementChild.style.width = `${i.value * 100}%`));
  }),
    n.querySelector(".learning-bars").setAttribute(
      "aria-label",
      translate("{pct}% complete", {
        pct: a,
      }),
    ),
    animateTextChange(n.querySelector(".learning-value"), `${a}%`),
    animateTextChange(
      n.querySelector(".learning-done"),
      String(s.filter((o) => o.status === "done").length),
    ),
    animateTextChange(
      n.querySelector(".learning-active"),
      String(s.filter((o) => o.status === "progress").length),
    ));
}
function renderAuthorCredit() {
  return `
  <a class="credit" href="https://x.com/DilumSanjaya" target="_blank" rel="noopener noreferrer" data-t-title="Dilum Sanjaya on X" title="${translate("Dilum Sanjaya on X")}">
    <span class="credit-label" ${translatedElementContent("DESIGNED BY")}</span>
    <span class="credit-name">
      <svg class="credit-x" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M17.75 3h3.07l-6.71 7.67L22 21h-6.18l-4.84-6.33L5.44 21H2.37l7.18-8.2L2 3h6.33l4.38 5.79L17.75 3Zm-1.08 16.18h1.7L7.4 4.73H5.58l11.09 14.45Z"/></svg>
      DilumSanjaya
    </span>
  </a>`;
}
function renderLanguageMenu() {
  const e = supportedLanguages
    .map(
      (
        t,
      ) => `<button type="button" role="menuitemradio" data-lang="${t.code}" lang="${t.html}" aria-checked="${t.code === getLanguage()}">
      <span>${t.name}</span><b>${t.short}</b></button>`,
    )
    .join("");
  return `
  <div class="lang">
    <button class="menu-btn" type="button" aria-haspopup="menu" aria-expanded="false" data-t-label="Language" aria-label="${translate("Language")}" data-t-title="Language" title="${translate("Language")}">
      ${icons.globe}<span class="lang-code">${supportedLanguages.find((t) => t.code === getLanguage()).short}</span>${icons.caret}
    </button>
    <div class="lang-menu" role="menu" hidden>${e}</div>
  </div>`;
}
function bindLanguageMenu(e, t) {
  const s = e.querySelector(".lang"),
    a = s.querySelector(".menu-btn"),
    n = s.querySelector(".lang-menu"),
    o = () => [...n.querySelectorAll("[data-lang]")];
  function r(l, c = !0) {
    l !== !n.hidden &&
      ((n.hidden = !l),
      a.setAttribute("aria-expanded", l),
      l
        ? (c &&
            (
              o().find((h) => h.getAttribute("aria-checked") === "true") ??
              o()[0]
            ).focus(),
          document.addEventListener("pointerdown", i, !0))
        : document.removeEventListener("pointerdown", i, !0));
  }
  const i = (l) => !s.contains(l.target) && r(!1, !1);
  (a.addEventListener("click", () => r(n.hidden, !0)),
    n.addEventListener("click", async (l) => {
      const c = l.target.closest("[data-lang]");
      if (c && (r(!1), a.focus(), c.dataset.lang !== getLanguage())) {
        s.classList.add("is-loading");
        try {
          await t(c.dataset.lang);
        } finally {
          s.classList.remove("is-loading");
        }
      }
    }),
    s.addEventListener("keydown", (l) => {
      if (n.hidden) return;
      const c = o(),
        h = c.indexOf(document.activeElement);
      l.key === "ArrowDown" || l.key === "ArrowUp"
        ? (l.preventDefault(),
          c[
            (h + (l.key === "ArrowDown" ? 1 : -1) + c.length) % c.length
          ].focus())
        : l.key === "Home" || l.key === "End"
          ? (l.preventDefault(), c[l.key === "Home" ? 0 : c.length - 1].focus())
          : l.key === "Escape"
            ? (l.preventDefault(), r(!1), a.focus())
            : l.key === "Tab" && r(!1, !1);
    }));
}
function updateLanguageMenu(e) {
  const t = getLanguage();
  ((e.querySelector(".lang-code").textContent = supportedLanguages.find(
    (s) => s.code === t,
  ).short),
    e
      .querySelectorAll(".lang-menu [data-lang]")
      .forEach((s) => s.setAttribute("aria-checked", s.dataset.lang === t)));
}
function translateTopbar(e) {
  (updateLanguageMenu(e),
    e.querySelectorAll(".osi-chips span").forEach(
      (t, s) =>
        (t.title = translate("Layer {n}: {name}", {
          n: s + 1,
          name: translate(OSI_LAYER_NAMES[s]),
        })),
    ),
    delete e.dataset.lesson);
}
const OSI_LAYER_NAMES = [
  "Physical",
  "Data Link",
  "Network",
  "Transport",
  "Session",
  "Presentation",
  "Application",
];
function fitTopbarText(e) {
  fitStepLabel(e.querySelector(".topbar .now-step"));
  const t = e.querySelector(".brand-text h1"),
    s = e.querySelector(".brand-text p");
  if (!t?.offsetWidth || !s) return;
  s.style.letterSpacing = s.style.fontSize = "";
  const a = measureTextWidth,
    n = a(t),
    o = a(s);
  if (o <= n) return;
  const r = getComputedStyle(s),
    i = parseFloat(r.fontSize),
    l = parseFloat(r.letterSpacing) / i,
    c = 0.02;
  s.style.letterSpacing = `${c}em`;
  const h = a(s);
  h <= n
    ? (s.style.letterSpacing = `${l - ((o - n) / (o - h)) * (l - c)}em`)
    : (s.style.fontSize = `${(i * n) / h}px`);
}
function renderCurrentLesson() {
  return `
  <div class="now">
    <div class="now-label" ${translatedElementContent("NOW LEARNING")}</div>
    <div class="now-title"><span class="now-name"></span></div>
    <div class="now-progress">
      <span class="now-dots"></span>
      <span class="now-step"></span>
    </div>
  </div>`;
}
function renderOsiLayers() {
  const e = OSI_LAYER_NAMES.map(
    (t, s) =>
      `<span data-layer="${s + 1}" title="${translate("Layer {n}: {name}", {
        n: s + 1,
        name: translate(t),
      })}">${s + 1}</span>`,
  ).join("");
  return `
  <div class="osi">
    <div class="osi-head">
      <span class="osi-label" ${translatedElementContent("OSI LAYER")}</span>
      <span class="osi-name"></span>
    </div>
    <div class="osi-chips"><i class="osi-marker"></i>${e}</div>
  </div>`;
}
function renderTopbar() {
  return `
  <header class="topbar">
    <button class="drawer-btn" type="button" data-t-label="Protocols" aria-label="${translate("Protocols")}" aria-expanded="false" aria-controls="protocols">${icons.menu}<span ${translatedElementContent("PROTOCOLS")}</span></button>
    <div class="brand">
      <div class="logo-frame">
        <span class="corner tl"></span><span class="corner tr"></span>
        <span class="corner bl"></span><span class="corner br"></span>
        ${LOGO_SVG}
      </div>
      <div class="brand-text">
        <h1>PROTOCOL <em>EXPLORER</em></h1>
        <p ${translatedElementContent("LEARN HOW THE INTERNET WORKS")}</p>
      </div>
    </div>

    <span class="topbar-sep"></span>
    ${renderCurrentLesson()}
    <span class="topbar-sep"></span>
    ${renderOsiLayers()}

    <div class="topbar-tools">
      <span class="topbar-sep"></span>
      ${renderLearningProgress()}
      <span class="topbar-sep"></span>
      ${renderAuthorCredit()}
      <span class="topbar-sep"></span>
      ${renderLanguageMenu()}
      <div class="theme-toggle" role="group" data-t-label="Theme" aria-label="${translate("Theme")}">
        <button type="button" data-theme-choice="light" aria-pressed="false" data-t-label="Light mode" aria-label="${translate("Light mode")}" data-t-title="Light mode" title="${translate("Light mode")}">${icons.sun}</button>
        <button type="button" data-theme-choice="dark" aria-pressed="false" data-t-label="Dark mode" aria-label="${translate("Dark mode")}" data-t-title="Dark mode" title="${translate("Dark mode")}">${icons.moon}</button>
      </div>
    </div>
  </header>`;
}
function setTopbarLesson(e, t) {
  const s = e.dataset.layer ? Number(e.dataset.layer) : null;
  ((e.dataset.lesson = t.id),
    (e.dataset.layer = t.layer),
    animateTextChange(
      e.querySelector(".now-name"),
      `${t.name} · ${localizedUpperCase(translate(t.title))}`,
    ),
    animateTextChange(
      e.querySelector(".osi-name"),
      localizedUpperCase(translate(OSI_LAYER_NAMES[t.layer - 1])),
      s && t.layer < s ? -1 : 1,
    ));
  const a = e.querySelector(".now-dots");
  (a.children.length !== t.steps.length &&
    (a.innerHTML = t.steps.map(() => "<i></i>").join("")),
    a.style.setProperty("--dots", t.steps.length));
  const n = e.querySelector(`.osi-chips [data-layer="${t.layer}"]`);
  (e
    .querySelectorAll(".osi-chips span")
    .forEach((o) => o.classList.toggle("is-active", o === n)),
    positionOsiMarker(e),
    s === null &&
      (requestAnimationFrame(() =>
        e.querySelector(".osi-marker").classList.add("is-ready"),
      ),
      new ResizeObserver(() => positionOsiMarker(e, !1)).observe(
        e.querySelector(".osi-chips"),
      )));
}
function positionOsiMarker(e, t = !0) {
  const s = e.querySelector(".osi-chips .is-active"),
    a = e.querySelector(".osi-marker");
  !s ||
    !s.offsetWidth ||
    (t || (a.style.transition = "none"),
    (a.style.left = `${s.offsetLeft}px`),
    (a.style.width = `${s.offsetWidth}px`),
    t || requestAnimationFrame(() => a.style.removeProperty("transition")));
}
function updateTopbar(e, t, s) {
  (e.dataset.lesson !== s.id && setTopbarLesson(e, s),
    e
      .querySelectorAll(".now-dots i")
      .forEach((o, r) => (o.className = `is-${t.steps[r]}`)));
  const a = s.steps[t.activeStep],
    n = t.done
      ? translate("LESSON COMPLETE")
      : t.started
        ? translate("STEP {n}/{total} · {title}", {
            n: t.activeStep + 1,
            total: s.steps.length,
            title: localizedUpperCase(translate(a.title)),
          })
        : translate("OVERVIEW · {n} STEPS", {
            n: s.steps.length,
          });
  animateTextChange(
    e.querySelector(".now-step"),
    n,
    t.started ? 1 : -1,
    fitStepLabel,
  );
}
function fitStepLabel(e) {
  if (!e) return;
  e.style.letterSpacing = "";
  const t = e.getBoundingClientRect().width - 0.5,
    s = measureTextWidth(e);
  if (t <= 0 || s <= t) return;
  const a = getComputedStyle(e).letterSpacing;
  e.style.letterSpacing = "0px";
  const n = measureTextWidth(e);
  e.style.letterSpacing = n >= t ? "0px" : `calc(${a} * ${(t - n) / (s - n)})`;
}
const measureTextWidth = (e) => {
  const t = document.createRange();
  return (t.selectNodeContents(e), t.getBoundingClientRect().width);
};
const THEME_STORAGE_KEY = "protocol-explorer:theme";
const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
const THEME_COLORS = {
  light: "#fdfdfe",
  dark: "#0b1020",
};
function updateThemeButtons(e, t) {
  let s = null;
  try {
    s = localStorage.getItem(THEME_STORAGE_KEY);
  } catch {}
  if (s)
    for (const a of document.querySelectorAll('meta[name="theme-color"]'))
      a.content = THEME_COLORS[t];
  e.querySelectorAll("[data-theme-choice]").forEach((a) => {
    const n = a.dataset.themeChoice === t;
    (a.classList.toggle("is-active", n), a.setAttribute("aria-pressed", n));
  });
}
function applyTheme(e, t, s) {
  const a = document.documentElement;
  if (a.dataset.theme === t) return updateThemeButtons(e, t);
  const n = () => {
    ((a.dataset.theme = t), updateThemeButtons(e, t));
  };
  if (
    !s ||
    !document.startViewTransition ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return n();
  const o = s.getBoundingClientRect(),
    r = o.left + o.width / 2,
    i = o.top + o.height / 2,
    l = Math.hypot(Math.max(r, innerWidth - r), Math.max(i, innerHeight - i));
  document.startViewTransition(n).ready.then(() =>
    a.animate(
      {
        clipPath: [
          `circle(0px at ${r}px ${i}px)`,
          `circle(${l}px at ${r}px ${i}px)`,
        ],
      },
      {
        duration: 650,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        pseudoElement: "::view-transition-new(root)",
      },
    ),
  );
}
function bindThemeToggle(e) {
  (updateThemeButtons(e, document.documentElement.dataset.theme),
    e.querySelector(".theme-toggle").addEventListener("click", (t) => {
      const s = t.target.closest("[data-theme-choice]");
      if (s) {
        try {
          localStorage.setItem(THEME_STORAGE_KEY, s.dataset.themeChoice);
        } catch {}
        applyTheme(e, s.dataset.themeChoice, s);
      }
    }),
    systemThemeQuery.addEventListener("change", (t) => {
      let s = null;
      try {
        s = localStorage.getItem(THEME_STORAGE_KEY);
      } catch {}
      s || applyTheme(e, t.matches ? "dark" : "light");
    }));
}
export {
  bindLanguageMenu,
  bindThemeToggle,
  fitTopbarText,
  renderTopbar,
  translateTopbar,
  updateLearningProgress,
  updateTopbar,
};
