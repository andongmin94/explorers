// Reconstructed from the distributed Protocol Explorer JavaScript.
import "./styles.css";
import { lessonsById, protocolCatalog } from "./lessons/index.js";
import { recordLessonProgress } from "./progress.js";
import { prefersReducedMotion } from "./ui/motion.js";
import {
  isRtl,
  onLanguageChange,
  restoreLanguage,
  setLanguage,
  translateDom,
} from "./i18n.js";
import {
  bindLanguageMenu,
  bindThemeToggle,
  fitTopbarText,
  renderTopbar,
  translateTopbar,
  updateLearningProgress,
  updateTopbar,
} from "./ui/header.js";
import {
  bindSidebar,
  renderSidebar,
  updateSidebar,
  updateSidebarProgress,
} from "./ui/sidebar.js";
import { playbackClock } from "./simulation/clock.js";
import {
  bindSequenceScrolling,
  refreshSequenceDiagram,
  updateSequenceDiagram,
} from "./ui/sequence.js";
import { createPacketInspector } from "./ui/inspector.js";
import { createViewSwitcher, renderSimulationPanel } from "./ui/stage.js";
import {
  bindOverviewBackButton,
  invalidateOverview,
  renderOverviewPanel,
  updateOverviewPanel,
} from "./ui/overview.js";
import {
  bindPacketTable,
  fitPlaybackButton,
  renderPacketTable,
  translatePacketTable,
  updatePacketTable,
  updatePlaybackSpeedLabel,
} from "./ui/packet-table.js";
import { createNetworkAnimation } from "./simulation/network-animation.js";
import { createLessonPlayer } from "./simulation/player.js";
await restoreLanguage();
const appElement = document.querySelector("#app");
appElement.innerHTML = `
  <div class="shell">
    ${renderTopbar()}
    <main class="workspace">
      ${renderSidebar(lessonsById)}
      ${renderSimulationPanel()}
      ${renderOverviewPanel()}
      ${renderPacketTable()}
    </main>
    <div class="scrim" aria-hidden="true"></div>
  </div>
`;
const LAYOUT_BREAKPOINTS = [
  {
    name: "wide",
    min: 1440,
    canvas: 1672,
  },
  {
    name: "medium",
    min: 1100,
    canvas: 1180,
  },
  {
    name: "tablet",
    min: 900,
    canvas: 900,
  },
  {
    name: "narrow",
    min: 640,
    canvas: 640,
  },
  {
    name: "phone",
    min: 0,
    canvas: 380,
  },
];
const documentRoot = document.documentElement;
const shellElement = appElement.querySelector(".shell");
function updateResponsiveLayout() {
  const e = documentRoot.clientWidth,
    t = LAYOUT_BREAKPOINTS.find((n) => e >= n.min),
    s = t.name === "wide" ? e / t.canvas : Math.min(1, e / t.canvas),
    a = !["wide", "medium"].includes(t.name);
  ((documentRoot.dataset.layout = t.name),
    documentRoot.classList.toggle("is-stacked", a),
    documentRoot.classList.toggle(
      "is-single",
      t.name === "narrow" || t.name === "phone",
    ),
    a ? (drawerElement.inert = !isDrawerOpen()) : setDrawerOpen(!1),
    (shellElement.style.zoom = s),
    (shellElement.style.width = `${e / s}px`),
    (shellElement.style.height = a ? "" : `${window.innerHeight / s}px`),
    (shellElement.style.minHeight = a ? `${window.innerHeight / s}px` : ""),
    fitTopbarText(appElement));
}
const drawerButton = appElement.querySelector(".drawer-btn");
const drawerElement = appElement.querySelector(".sidebar");
const isDrawerOpen = () => shellElement.classList.contains("is-drawer-open");
function setDrawerOpen(e) {
  const t = documentRoot.classList.contains("is-stacked");
  (shellElement.classList.toggle("is-drawer-open", e),
    documentRoot.classList.toggle("is-locked", e),
    drawerButton.setAttribute("aria-expanded", e),
    (drawerElement.inert = t && !e),
    e
      ? drawerElement.querySelector(".drawer-close").focus({
          preventScroll: !0,
        })
      : t &&
        drawerElement.contains(document.activeElement) &&
        drawerButton.focus({
          preventScroll: !0,
        }));
}
drawerButton.addEventListener("click", () => setDrawerOpen(!isDrawerOpen()));
drawerElement
  .querySelector(".drawer-close")
  .addEventListener("click", () => setDrawerOpen(!1));
appElement
  .querySelector(".scrim")
  .addEventListener("click", () => setDrawerOpen(!1));
updateResponsiveLayout();
window.addEventListener("resize", updateResponsiveLayout);
window.addEventListener("orientationchange", updateResponsiveLayout);
const topbarElement = appElement.querySelector(".topbar");
const sidebarElement = appElement.querySelector(".sidebar");
const overviewElement = appElement.querySelector(".overview");
const packetsElement = appElement.querySelector(".packets");
const simulationElement = appElement.querySelector(".simulation");
const sequenceElement = appElement.querySelector(".sequence");
let currentLesson = null;
let lessonPlayer = null;
let currentPlaybackState = null;
const viewController = createViewSwitcher(simulationElement, (e) =>
  lessonPlayer?.setMode(e),
);
const getVisiblePacketIndices = () =>
  [...packetsElement.querySelectorAll("tr[data-packet]")]
    .filter((e) => !e.hidden && e.dataset.shown === "1")
    .map((e) => Number(e.dataset.packet));
const packetInspector = createPacketInspector(
  simulationElement.querySelector(".inspector"),
  {
    visible: getVisiblePacketIndices,
    onChange: (e) => {
      for (const n of appElement.querySelectorAll(".is-inspected"))
        n.classList.remove("is-inspected");
      if (
        (documentRoot.classList.toggle("is-inspecting", e !== null), e === null)
      )
        return;
      appElement
        .querySelectorAll(
          `tr[data-packet="${e}"], .seq-arrow[data-packet="${e}"]`,
        )
        .forEach((n) => n.classList.add("is-inspected"));
      const t = packetsElement.querySelector(`tr[data-packet="${e}"]`),
        s = packetsElement.querySelector(".packet-scroll"),
        a = packetsElement.querySelector("thead").offsetHeight;
      t.offsetTop < s.scrollTop + a
        ? s.scrollTo({
            top: t.offsetTop - a,
            behavior: "smooth",
          })
        : t.offsetTop + t.offsetHeight > s.scrollTop + s.clientHeight &&
          s.scrollTo({
            top: t.offsetTop + t.offsetHeight - s.clientHeight,
            behavior: "smooth",
          });
    },
  },
);
const inspectPacket = (e) => {
  ((currentPlaybackState?.playing || currentPlaybackState?.running) &&
    lessonPlayer.pause(),
    packetInspector.open(currentLesson, e));
};
sequenceElement.addEventListener("click", (e) => {
  const t = e.target.closest(".seq-arrow.is-shown");
  t && inspectPacket(Number(t.dataset.packet));
});
bindSequenceScrolling(sequenceElement);
const networkAnimation = createNetworkAnimation(
  appElement.querySelector(".network"),
);
updateLearningProgress(topbarElement, lessonsById);
bindThemeToggle(topbarElement);
function updateAppPlaybackState(e, t = currentLesson) {
  (updateTopbar(topbarElement, e, t),
    updateSidebar(sidebarElement, e, t),
    updateOverviewPanel(
      overviewElement,
      e,
      t,
      protocolCatalog.findIndex((a) => a.id === t.id),
    ),
    updatePacketTable(packetsElement, e, t));
  const s = packetInspector.index();
  (s !== null &&
    !getVisiblePacketIndices().includes(s) &&
    packetInspector.close(),
    updateSequenceDiagram(sequenceElement, e, t));
}
function selectLesson(e) {
  if (currentLesson?.id === e) return lessonPlayer.reset();
  (packetInspector.close(),
    lessonPlayer?.dispose(),
    (currentLesson = lessonsById[e]));
  const t = currentLesson;
  ((lessonPlayer = createLessonPlayer(
    t,
    networkAnimation,
    (s) => {
      ((currentPlaybackState = s),
        recordLessonProgress(t, s) &&
          (updateLearningProgress(topbarElement, lessonsById),
          updateSidebarProgress(sidebarElement, lessonsById)),
        updateAppPlaybackState(s, t));
    },
    {
      mode: viewController.view(),
    },
  )),
    lessonPlayer.reset());
}
function refreshAppTranslations() {
  (translateDom(appElement),
    translateTopbar(topbarElement),
    fitTopbarText(topbarElement),
    updateLearningProgress(topbarElement, lessonsById),
    currentLesson &&
      (invalidateOverview(overviewElement),
      translatePacketTable(packetsElement, currentLesson),
      networkAnimation.retext(),
      refreshSequenceDiagram(sequenceElement),
      packetInspector.isOpen() &&
        packetInspector.open(currentLesson, packetInspector.index()),
      currentPlaybackState && updateAppPlaybackState(currentPlaybackState)));
}
onLanguageChange(() => {
  if (!document.startViewTransition || prefersReducedMotion())
    return refreshAppTranslations();
  (documentRoot.classList.add("is-retexting"),
    document
      .startViewTransition(refreshAppTranslations)
      .finished.finally(() => documentRoot.classList.remove("is-retexting")));
});
bindLanguageMenu(topbarElement, (e) => setLanguage(e));
const closeDrawerAfterSelection = () =>
  isDrawerOpen() && setTimeout(() => setDrawerOpen(!1), 220);
bindSidebar(sidebarElement, {
  onStep: (e) => {
    (lessonPlayer.jump(e), closeDrawerAfterSelection());
  },
  onSelect: (e) => {
    (selectLesson(e), closeDrawerAfterSelection());
  },
});
bindOverviewBackButton(overviewElement, () => lessonPlayer.reset());
const PLAYBACK_SPEED_OPTIONS = [0.5, 1, 1.5, 2];
const PLAYBACK_SPEED_STORAGE_KEY = "protocol-explorer:speed";
function setPlaybackSpeed(e, t = !0) {
  if (
    (playbackClock.setSpeed(e), updatePlaybackSpeedLabel(packetsElement, e), t)
  )
    try {
      localStorage.setItem(PLAYBACK_SPEED_STORAGE_KEY, e);
    } catch {}
}
try {
  const e = Number(localStorage.getItem(PLAYBACK_SPEED_STORAGE_KEY));
  PLAYBACK_SPEED_OPTIONS.includes(e) && setPlaybackSpeed(e, !1);
} catch {}
const cyclePlaybackSpeed = () =>
  setPlaybackSpeed(
    PLAYBACK_SPEED_OPTIONS[
      (PLAYBACK_SPEED_OPTIONS.indexOf(playbackClock.speed) + 1) %
        PLAYBACK_SPEED_OPTIONS.length
    ],
  );
document.fonts.ready.then(() => {
  (fitPlaybackButton(packetsElement), fitTopbarText(topbarElement));
});
bindPacketTable(packetsElement, {
  toggle: () => lessonPlayer.toggle(),
  step: () => lessonPlayer.step(),
  reset: () => lessonPlayer.reset(),
  prev: () => jumpToPreviousStep(),
  speed: cyclePlaybackSpeed,
  inspect: inspectPacket,
});
function jumpToNextStep() {
  if (!currentPlaybackState?.started) return lessonPlayer.jump(0);
  currentPlaybackState.activeStep < currentLesson.steps.length - 1 &&
    lessonPlayer.jump(currentPlaybackState.activeStep + 1);
}
function jumpToPreviousStep() {
  if (currentPlaybackState?.started) {
    if (currentPlaybackState.done)
      return lessonPlayer.jump(currentLesson.steps.length - 1);
    currentPlaybackState.activeStep > 0
      ? lessonPlayer.jump(currentPlaybackState.activeStep - 1)
      : lessonPlayer.reset();
  }
}
const navigateForward = () =>
  packetInspector.isOpen() ? packetInspector.step(1) : jumpToNextStep();
const navigateBackward = () =>
  packetInspector.isOpen() ? packetInspector.step(-1) : jumpToPreviousStep();
const keyboardActions = {
  " ": () => lessonPlayer.toggle(),
  ArrowRight: () => (isRtl() ? navigateBackward() : navigateForward()),
  ArrowLeft: () => (isRtl() ? navigateForward() : navigateBackward()),
  Escape: () =>
    isDrawerOpen()
      ? setDrawerOpen(!1)
      : packetInspector.isOpen()
        ? packetInspector.close()
        : lessonPlayer.reset(),
  v: () => viewController.toggle(),
  V: () => viewController.toggle(),
};
const isTextInputTarget = (e) =>
  e instanceof Element &&
  e.closest('input, textarea, select, [contenteditable="true"], .lang-menu');
for (const e of ["keydown", "keyup"])
  window.addEventListener(e, (t) => {
    const s = keyboardActions[t.key];
    !s ||
      !lessonPlayer ||
      t.ctrlKey ||
      t.metaKey ||
      t.altKey ||
      isTextInputTarget(t.target) ||
      (t.preventDefault(), e === "keydown" && !t.repeat && s());
  });
document.fonts.ready.then(() => selectLesson("http"));
