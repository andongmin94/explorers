// Reconstructed from the distributed Protocol Explorer JavaScript.
import { protocolCatalog } from "../lessons/index.js";
import { icons } from "./icons.js";
import { getLessonCompletion, getLessonStatus } from "../progress.js";
import { animateTextChange } from "./motion.js";
import {
  localizedUpperCase,
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
  const segments = protocolCatalog
    .map(
      (protocol, index) =>
        `<span class="learning-seg"><i style="--i:${index}"></i></span>`,
    )
    .join("");
  return `
  <div class="learning">
    <div class="learning-head">
      <span class="learning-label" ${translatedElementContent("LEARNING PROGRESS")}</span>
      <span class="learning-value"></span>
    </div>
    <div class="learning-bars" role="img">${segments}</div>
    <div class="learning-sub"><span class="learning-done"></span> / ${protocolCatalog.length} <span ${translatedElementContent("COMPLETE")}</span> <span class="dot">·</span> <span class="learning-active"></span> <span ${translatedElementContent("IN PROGRESS")}</span></div>
  </div>`;
}

function updateLearningProgress(topbar, lessons) {
  const progressByProtocol = protocolCatalog
    .map((protocol) => ({
      name: protocol.name,
      value: getLessonCompletion(lessons[protocol.id]),
      status: getLessonStatus(lessons[protocol.id]),
    }))
    .sort((left, right) => right.value - left.value);
  const completionPercent = Math.round(
    (progressByProtocol.reduce((sum, progress) => sum + progress.value, 0) /
      progressByProtocol.length) *
      100,
  );
  const progressPanel = topbar.querySelector(".learning");
  progressPanel.querySelectorAll(".learning-seg").forEach((segment, index) => {
    const progress = progressByProtocol[index];
    segment.classList.toggle(
      "partial",
      progress.value > 0 && progress.value < 1,
    );
    segment.title = `${progress.name}: ${Math.round(progress.value * 100)}%`;
    segment.firstElementChild.style.width = `${progress.value * 100}%`;
  });
  progressPanel.querySelector(".learning-bars").setAttribute(
    "aria-label",
    translate("{pct}% complete", {
      pct: completionPercent,
    }),
  );
  animateTextChange(
    progressPanel.querySelector(".learning-value"),
    `${completionPercent}%`,
  );
  animateTextChange(
    progressPanel.querySelector(".learning-done"),
    String(
      progressByProtocol.filter((progress) => progress.status === "done")
        .length,
    ),
  );
  animateTextChange(
    progressPanel.querySelector(".learning-active"),
    String(
      progressByProtocol.filter((progress) => progress.status === "progress")
        .length,
    ),
  );
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

function fitTopbarText(root) {
  fitStepLabel(root.querySelector(".topbar .now-step"));
  const heading = root.querySelector(".brand-text h1");
  const tagline = root.querySelector(".brand-text p");
  if (!heading?.offsetWidth || !tagline) {
    return;
  }
  tagline.style.letterSpacing = tagline.style.fontSize = "";
  const headingWidth = measureTextWidth(heading);
  const taglineWidth = measureTextWidth(tagline);
  if (taglineWidth <= headingWidth) {
    return;
  }
  const taglineStyle = getComputedStyle(tagline);
  const fontSize = parseFloat(taglineStyle.fontSize);
  const originalSpacingEm = parseFloat(taglineStyle.letterSpacing) / fontSize;
  const minimumSpacingEm = 0.02;
  tagline.style.letterSpacing = `${minimumSpacingEm}em`;
  const compactWidth = measureTextWidth(tagline);
  if (compactWidth <= headingWidth) {
    tagline.style.letterSpacing = `${originalSpacingEm - ((taglineWidth - headingWidth) / (taglineWidth - compactWidth)) * (originalSpacingEm - minimumSpacingEm)}em`;
  } else {
    tagline.style.fontSize = `${(fontSize * headingWidth) / compactWidth}px`;
  }
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
  const layerChips = OSI_LAYER_NAMES.map(
    (name, index) =>
      `<span data-layer="${index + 1}" title="${translate("Layer {n}: {name}", {
        n: index + 1,
        name: translate(name),
      })}">${index + 1}</span>`,
  ).join("");
  return `
  <div class="osi">
    <div class="osi-head">
      <span class="osi-label" ${translatedElementContent("OSI LAYER")}</span>
      <span class="osi-name"></span>
    </div>
    <div class="osi-chips"><i class="osi-marker"></i>${layerChips}</div>
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
        <h1>프로토콜 <em>탐색기</em></h1>
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
      <div class="theme-toggle" role="group" data-t-label="Theme" aria-label="${translate("Theme")}">
        <button type="button" data-theme-choice="light" aria-pressed="false" data-t-label="Light mode" aria-label="${translate("Light mode")}" data-t-title="Light mode" title="${translate("Light mode")}">${icons.sun}</button>
        <button type="button" data-theme-choice="dark" aria-pressed="false" data-t-label="Dark mode" aria-label="${translate("Dark mode")}" data-t-title="Dark mode" title="${translate("Dark mode")}">${icons.moon}</button>
      </div>
    </div>
  </header>`;
}

function setTopbarLesson(topbar, lesson) {
  const previousLayer = topbar.dataset.layer
    ? Number(topbar.dataset.layer)
    : null;
  topbar.dataset.lesson = lesson.id;
  topbar.dataset.layer = lesson.layer;
  animateTextChange(
    topbar.querySelector(".now-name"),
    `${lesson.name} · ${localizedUpperCase(translate(lesson.title))}`,
  );
  animateTextChange(
    topbar.querySelector(".osi-name"),
    localizedUpperCase(translate(OSI_LAYER_NAMES[lesson.layer - 1])),
    previousLayer && lesson.layer < previousLayer ? -1 : 1,
  );
  const progressDots = topbar.querySelector(".now-dots");
  if (progressDots.children.length !== lesson.steps.length) {
    progressDots.innerHTML = lesson.steps.map(() => "<i></i>").join("");
  }
  progressDots.style.setProperty("--dots", lesson.steps.length);
  const activeChip = topbar.querySelector(
    `.osi-chips [data-layer="${lesson.layer}"]`,
  );
  topbar
    .querySelectorAll(".osi-chips span")
    .forEach((chip) => chip.classList.toggle("is-active", chip === activeChip));
  positionOsiMarker(topbar);
  if (previousLayer === null) {
    requestAnimationFrame(() =>
      topbar.querySelector(".osi-marker").classList.add("is-ready"),
    );
    new ResizeObserver(() => positionOsiMarker(topbar, false)).observe(
      topbar.querySelector(".osi-chips"),
    );
  }
}

function positionOsiMarker(topbar, animate = true) {
  const activeChip = topbar.querySelector(".osi-chips .is-active");
  const marker = topbar.querySelector(".osi-marker");
  if (!activeChip || !activeChip.offsetWidth) {
    return;
  }
  if (!animate) {
    marker.style.transition = "none";
  }
  marker.style.left = `${activeChip.offsetLeft}px`;
  marker.style.width = `${activeChip.offsetWidth}px`;
  if (!animate) {
    requestAnimationFrame(() => marker.style.removeProperty("transition"));
  }
}

function updateTopbar(topbar, playback, lesson) {
  if (topbar.dataset.lesson !== lesson.id) {
    setTopbarLesson(topbar, lesson);
  }
  topbar
    .querySelectorAll(".now-dots i")
    .forEach((dot, index) => (dot.className = `is-${playback.steps[index]}`));
  const activeStep = lesson.steps[playback.activeStep];
  const stepLabel = playback.done
    ? translate("LESSON COMPLETE")
    : playback.started
      ? translate("STEP {n}/{total} · {title}", {
          n: playback.activeStep + 1,
          total: lesson.steps.length,
          title: localizedUpperCase(translate(activeStep.title)),
        })
      : translate("OVERVIEW · {n} STEPS", {
          n: lesson.steps.length,
        });
  animateTextChange(
    topbar.querySelector(".now-step"),
    stepLabel,
    playback.started ? 1 : -1,
    fitStepLabel,
  );
}

function fitStepLabel(label) {
  if (!label) {
    return;
  }
  label.style.letterSpacing = "";
  const availableWidth = label.getBoundingClientRect().width - 0.5;
  const naturalWidth = measureTextWidth(label);
  if (availableWidth <= 0 || naturalWidth <= availableWidth) {
    return;
  }
  const originalSpacing = getComputedStyle(label).letterSpacing;
  label.style.letterSpacing = "0px";
  const compactWidth = measureTextWidth(label);
  label.style.letterSpacing =
    compactWidth >= availableWidth
      ? "0px"
      : `calc(${originalSpacing} * ${(availableWidth - compactWidth) / (naturalWidth - compactWidth)})`;
}
const measureTextWidth = (element) => {
  const range = document.createRange();
  range.selectNodeContents(element);
  return range.getBoundingClientRect().width;
};
const THEME_STORAGE_KEY = "protocol-explorer:theme";
const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
const THEME_COLORS = {
  light: "#f4f5f7",
  dark: "#18191c",
};

function updateThemeButtons(topbar, theme) {
  let savedTheme = null;
  try {
    savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  } catch {}
  if (savedTheme) {
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
      meta.content = THEME_COLORS[theme];
    }
  }
  topbar.querySelectorAll("[data-theme-choice]").forEach((button) => {
    const selected = button.dataset.themeChoice === theme;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", selected);
  });
}

function applyTheme(topbar, theme, originButton) {
  const root = document.documentElement;
  if (root.dataset.theme === theme) {
    return updateThemeButtons(topbar, theme);
  }
  const updateTheme = () => {
    root.dataset.theme = theme;
    updateThemeButtons(topbar, theme);
  };
  if (
    !originButton ||
    !document.startViewTransition ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return updateTheme();
  }
  const buttonRect = originButton.getBoundingClientRect();
  const centerX = buttonRect.left + buttonRect.width / 2;
  const centerY = buttonRect.top + buttonRect.height / 2;
  const radius = Math.hypot(
    Math.max(centerX, innerWidth - centerX),
    Math.max(centerY, innerHeight - centerY),
  );
  document.startViewTransition(updateTheme).ready.then(() =>
    root.animate(
      {
        clipPath: [
          `circle(0px at ${centerX}px ${centerY}px)`,
          `circle(${radius}px at ${centerX}px ${centerY}px)`,
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

function bindThemeToggle(topbar) {
  updateThemeButtons(topbar, document.documentElement.dataset.theme);
  topbar.querySelector(".theme-toggle").addEventListener("click", (event) => {
    const button = event.target.closest("[data-theme-choice]");
    if (button) {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, button.dataset.themeChoice);
      } catch {}
      applyTheme(topbar, button.dataset.themeChoice, button);
    }
  });
  systemThemeQuery.addEventListener("change", (event) => {
    let savedTheme = null;
    try {
      savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {}
    if (!savedTheme) {
      applyTheme(topbar, event.matches ? "dark" : "light");
    }
  });
}
export {
  bindThemeToggle,
  fitTopbarText,
  renderTopbar,
  updateLearningProgress,
  updateTopbar,
};
