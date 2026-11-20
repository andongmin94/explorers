// Top bar: brand (the shared switcher replaces it), the lesson being learned,
// the OSI layer as a row of LEDs, learning progress on an LCD with one LED per
// protocol, and the theme key.
import { protocolCatalog } from "../lessons/index.js";
import { getLessonCompletion, getLessonStatus } from "../progress.js";
import { animateTextChange } from "./motion.js";
import { localizedUpperCase, translate } from "../i18n.js";
import { icon } from "../../../shared/hw.js";

const OSI_LAYER_NAMES = [
  "Physical",
  "Data Link",
  "Network",
  "Transport",
  "Session",
  "Presentation",
  "Application",
];

const menuIcon =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';

function renderTopbar() {
  const osiLeds = OSI_LAYER_NAMES.map(
    (name, index) =>
      `<span class="osi-cell" data-layer="${index + 1}" title="${translate("Layer {n}: {name}", { n: index + 1, name: translate(name) })}"><span class="hw-led"></span><span class="osi-num">${index + 1}</span></span>`,
  ).join("");
  const progressLeds = protocolCatalog
    .map((protocol) => `<span class="hw-led" data-progress="${protocol.id}"></span>`)
    .join("");
  return `
  <header class="hw-topbar topbar">
    <button class="hw-key hw-key--sm hw-rail-btn drawer-btn" type="button" aria-expanded="false" aria-controls="protocols">${menuIcon}<span>프로토콜</span></button>
    <div class="hw-brand"><h1>프로토콜 탐색기</h1><p>인터넷 작동 원리 배우기</p></div>
    <div class="hw-context now">
      <span class="hw-label">${translate("NOW LEARNING")}</span>
      <strong class="now-name"></strong>
    </div>
    <div class="hw-context osi">
      <span class="hw-label">${translate("OSI LAYER")} <span class="osi-name"></span></span>
      <div class="osi-leds" role="img">${osiLeds}</div>
    </div>
    <div class="hw-context learning">
      <span class="hw-label">${translate("LEARNING PROGRESS")} <span class="learning-sub"><span class="learning-done">0</span>/${protocolCatalog.length} 완료 · <span class="learning-active">0</span> 진행 중</span></span>
      <div class="learning-row"><span class="hw-lcd learning-lcd"><span class="learning-value">0</span><small>%</small></span><span class="learning-leds" role="img">${progressLeds}</span></div>
    </div>
    <div class="hw-actions">
      <button class="hw-key hw-key--sm hw-key--icon theme-toggle" type="button" aria-pressed="false"></button>
    </div>
  </header>`;
}

function updateLearningProgress(topbar, lessons) {
  const progress = protocolCatalog.map((protocol) => ({
    id: protocol.id,
    name: protocol.name,
    value: getLessonCompletion(lessons[protocol.id]),
    status: getLessonStatus(lessons[protocol.id]),
  }));
  const percent = Math.round(
    (progress.reduce((sum, item) => sum + item.value, 0) / progress.length) * 100,
  );
  for (const item of progress) {
    const ledElement = topbar.querySelector(`[data-progress="${item.id}"]`);
    ledElement.className = `hw-led is-${item.status}`;
    ledElement.title = `${item.name}: ${Math.round(item.value * 100)}%`;
  }
  topbar
    .querySelector(".learning-leds")
    .setAttribute("aria-label", translate("{pct}% complete", { pct: percent }));
  animateTextChange(topbar.querySelector(".learning-value"), String(percent));
  topbar.querySelector(".learning-done").textContent = progress.filter(
    (item) => item.status === "done",
  ).length;
  topbar.querySelector(".learning-active").textContent = progress.filter(
    (item) => item.status === "progress",
  ).length;
}

function updateTopbar(topbar, playback, lesson) {
  if (topbar.dataset.lesson === lesson.id) return;
  const previousLayer = Number(topbar.dataset.layer) || null;
  topbar.dataset.lesson = lesson.id;
  topbar.dataset.layer = lesson.layer;
  animateTextChange(
    topbar.querySelector(".now-name"),
    `${lesson.name} · ${localizedUpperCase(translate(lesson.title))}`,
  );
  const layerName = translate(OSI_LAYER_NAMES[lesson.layer - 1]);
  animateTextChange(
    topbar.querySelector(".osi-name"),
    `L${lesson.layer} ${layerName}`,
    previousLayer && lesson.layer < previousLayer ? -1 : 1,
  );
  topbar.querySelector(".osi-leds").setAttribute(
    "aria-label",
    translate("Layer {n}: {name}", { n: lesson.layer, name: layerName }),
  );
  topbar.querySelectorAll(".osi-cell").forEach((cell) => {
    const layer = Number(cell.dataset.layer);
    cell.classList.toggle("is-active", layer === lesson.layer);
    cell.firstElementChild.classList.toggle("is-on", layer === lesson.layer);
  });
}

/* ---------- Theme ---------- */

const THEME_STORAGE_KEY = "protocol-explorer:theme";
const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
const THEME_COLORS = { light: "#eeeeec", dark: "#171716" };

function readSavedTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

function updateThemeButton(topbar, theme) {
  if (readSavedTheme()) {
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
      meta.content = THEME_COLORS[theme];
    }
  }
  const button = topbar.querySelector(".theme-toggle");
  const dark = theme === "dark";
  button.innerHTML = icon(dark ? "sun" : "moon");
  button.setAttribute("aria-pressed", dark);
  button.setAttribute("aria-label", translate(dark ? "Light mode" : "Dark mode"));
  button.title = translate(dark ? "Light mode" : "Dark mode");
}

function applyTheme(topbar, theme, originButton) {
  const root = document.documentElement;
  const update = () => {
    root.dataset.theme = theme;
    updateThemeButton(topbar, theme);
  };
  if (root.dataset.theme === theme) return update();
  if (
    !originButton ||
    !document.startViewTransition ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return update();
  }
  const rect = originButton.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  document.startViewTransition(update).ready.then(() =>
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      {
        duration: 650,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        pseudoElement: "::view-transition-new(root)",
      },
    ),
  );
}

function bindThemeToggle(topbar) {
  updateThemeButton(topbar, document.documentElement.dataset.theme);
  const button = topbar.querySelector(".theme-toggle");
  button.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {}
    applyTheme(topbar, next, button);
  });
  systemThemeQuery.addEventListener("change", (event) => {
    if (!readSavedTheme()) applyTheme(topbar, event.matches ? "dark" : "light");
  });
}

export { bindThemeToggle, renderTopbar, updateLearningProgress, updateTopbar };
