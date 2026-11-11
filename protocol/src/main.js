// Reconstructed from the distributed Protocol Explorer JavaScript.
import "./styles.css";
import "./neobrutal.css";
import { lessonsById, protocolCatalog } from "./lessons/index.js";
import { recordLessonProgress } from "./progress.js";
import {
  bindThemeToggle,
  fitTopbarText,
  renderTopbar,
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
  updateSequenceDiagram,
} from "./ui/sequence.js";
import { createPacketInspector } from "./ui/inspector.js";
import { createViewSwitcher, renderSimulationPanel } from "./ui/stage.js";
import {
  bindOverviewBackButton,
  renderOverviewPanel,
  updateOverviewPanel,
} from "./ui/overview.js";
import {
  bindPacketTable,
  fitPlaybackButton,
  renderPacketTable,
  updatePacketTable,
  updatePlaybackSpeedLabel,
} from "./ui/packet-table.js";
import { createNetworkAnimation } from "./simulation/network-animation.js";
import { createLessonPlayer } from "./simulation/player.js";
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
  // Keep diagram coordinates fixed while scaling the surrounding layout.
  const viewportWidth = documentRoot.clientWidth;
  const breakpoint = LAYOUT_BREAKPOINTS.find(
    (candidate) => viewportWidth >= candidate.min,
  );
  const scale =
    breakpoint.name === "wide"
      ? viewportWidth / breakpoint.canvas
      : Math.min(1, viewportWidth / breakpoint.canvas);
  const isStacked = !["wide", "medium"].includes(breakpoint.name);
  documentRoot.dataset.layout = breakpoint.name;
  documentRoot.classList.toggle("is-stacked", isStacked);
  documentRoot.classList.toggle(
    "is-single",
    breakpoint.name === "narrow" || breakpoint.name === "phone",
  );
  if (isStacked) {
    drawerElement.inert = !isDrawerOpen();
  } else {
    setDrawerOpen(false);
  }
  shellElement.style.zoom = scale;
  shellElement.style.width = `${viewportWidth / scale}px`;
  shellElement.style.height = isStacked
    ? ""
    : `${window.innerHeight / scale}px`;
  shellElement.style.minHeight = isStacked
    ? `${window.innerHeight / scale}px`
    : "";
  fitTopbarText(appElement);
}
const drawerButton = appElement.querySelector(".drawer-btn");
const drawerElement = appElement.querySelector(".sidebar");

const isDrawerOpen = () => shellElement.classList.contains("is-drawer-open");

function setDrawerOpen(open) {
  const isStacked = documentRoot.classList.contains("is-stacked");
  shellElement.classList.toggle("is-drawer-open", open);
  documentRoot.classList.toggle("is-locked", open);
  drawerButton.setAttribute("aria-expanded", open);
  drawerElement.inert = isStacked && !open;
  if (open) {
    drawerElement.querySelector(".drawer-close").focus({
      preventScroll: true,
    });
  } else if (isStacked && drawerElement.contains(document.activeElement)) {
    drawerButton.focus({
      preventScroll: true,
    });
  }
}
drawerButton.addEventListener("click", () => setDrawerOpen(!isDrawerOpen()));
drawerElement
  .querySelector(".drawer-close")
  .addEventListener("click", () => setDrawerOpen(false));
appElement
  .querySelector(".scrim")
  .addEventListener("click", () => setDrawerOpen(false));
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
const viewController = createViewSwitcher(simulationElement, (view) =>
  lessonPlayer?.setMode(view),
);

const getVisiblePacketIndices = () =>
  [...packetsElement.querySelectorAll("tr[data-packet]")]
    .filter((row) => !row.hidden && row.dataset.shown === "1")
    .map((row) => Number(row.dataset.packet));
const packetInspector = createPacketInspector(
  simulationElement.querySelector(".inspector"),
  {
    visible: getVisiblePacketIndices,
    onChange: (packetIndex) => {
      for (const highlightedElement of appElement.querySelectorAll(
        ".is-inspected",
      )) {
        highlightedElement.classList.remove("is-inspected");
      }
      documentRoot.classList.toggle("is-inspecting", packetIndex !== null);
      if (packetIndex === null) {
        return;
      }
      appElement
        .querySelectorAll(
          `tr[data-packet="${packetIndex}"], .seq-arrow[data-packet="${packetIndex}"]`,
        )
        .forEach((matchingElement) =>
          matchingElement.classList.add("is-inspected"),
        );
      const packetRow = packetsElement.querySelector(
        `tr[data-packet="${packetIndex}"]`,
      );
      const scrollContainer = packetsElement.querySelector(".packet-scroll");
      const headerHeight = packetsElement.querySelector("thead").offsetHeight;
      if (packetRow.offsetTop < scrollContainer.scrollTop + headerHeight) {
        scrollContainer.scrollTo({
          top: packetRow.offsetTop - headerHeight,
          behavior: "smooth",
        });
      } else if (
        packetRow.offsetTop + packetRow.offsetHeight >
        scrollContainer.scrollTop + scrollContainer.clientHeight
      ) {
        scrollContainer.scrollTo({
          top:
            packetRow.offsetTop +
            packetRow.offsetHeight -
            scrollContainer.clientHeight,
          behavior: "smooth",
        });
      }
    },
  },
);
const inspectPacket = (packetIndex) => {
  if (currentPlaybackState?.playing || currentPlaybackState?.running) {
    lessonPlayer.pause();
  }
  packetInspector.open(currentLesson, packetIndex);
};
sequenceElement.addEventListener("click", (event) => {
  const arrow = event.target.closest(".seq-arrow.is-shown");
  if (arrow) {
    inspectPacket(Number(arrow.dataset.packet));
  }
});
bindSequenceScrolling(sequenceElement);
const networkAnimation = createNetworkAnimation(
  appElement.querySelector(".network"),
);
updateLearningProgress(topbarElement, lessonsById);
bindThemeToggle(topbarElement);
/** Render one shared playback snapshot across all panels. */

function updateAppPlaybackState(state, lesson = currentLesson) {
  if (state.labels) networkAnimation.setLabels(state.labels);
  networkAnimation.setDevices(lesson.id, state.devices, state.event, state.running);
  updateTopbar(topbarElement, state, lesson);
  updateSidebar(sidebarElement, state, lesson);
  updateOverviewPanel(
    overviewElement,
    state,
    lesson,
    protocolCatalog.findIndex((protocol) => protocol.id === lesson.id),
  );
  updatePacketTable(packetsElement, state, lesson);
  const inspectedIndex = packetInspector.index();
  if (
    inspectedIndex !== null &&
    !getVisiblePacketIndices().includes(inspectedIndex)
  ) {
    packetInspector.close();
  }
  updateSequenceDiagram(sequenceElement, state, lesson);
}

function selectLesson(lessonId) {
  if (currentLesson?.id === lessonId) {
    return lessonPlayer.reset();
  }
  packetInspector.close();
  lessonPlayer?.dispose();
  currentLesson = lessonsById[lessonId];
  // Capture this lesson: asynchronous notifications must not read a newer one.
  const selectedLesson = currentLesson;
  lessonPlayer = createLessonPlayer(
    selectedLesson,
    networkAnimation,
    (state) => {
      currentPlaybackState = state;
      if (recordLessonProgress(selectedLesson, state)) {
        updateLearningProgress(topbarElement, lessonsById);
        updateSidebarProgress(sidebarElement, lessonsById);
      }
      updateAppPlaybackState(state, selectedLesson);
    },
    {
      mode: viewController.view(),
    },
  );
  lessonPlayer.reset();
}

const closeDrawerAfterSelection = () =>
  isDrawerOpen() && setTimeout(() => setDrawerOpen(false), 220);
bindSidebar(sidebarElement, {
  onStep: (stepIndex) => {
    lessonPlayer.jump(stepIndex);
    closeDrawerAfterSelection();
  },
  onSelect: (lessonId) => {
    selectLesson(lessonId);
    closeDrawerAfterSelection();
  },
});
bindOverviewBackButton(overviewElement, () => lessonPlayer.reset());
const PLAYBACK_SPEED_OPTIONS = [0.5, 1, 1.5, 2];
const PLAYBACK_SPEED_STORAGE_KEY = "protocol-explorer:speed";

function setPlaybackSpeed(speed, persist = true) {
  playbackClock.setSpeed(speed);
  updatePlaybackSpeedLabel(packetsElement, speed);
  if (persist) {
    try {
      localStorage.setItem(PLAYBACK_SPEED_STORAGE_KEY, speed);
    } catch {}
  }
}
try {
  const savedSpeed = Number(localStorage.getItem(PLAYBACK_SPEED_STORAGE_KEY));
  if (PLAYBACK_SPEED_OPTIONS.includes(savedSpeed)) {
    setPlaybackSpeed(savedSpeed, false);
  }
} catch {}

const cyclePlaybackSpeed = () =>
  setPlaybackSpeed(
    PLAYBACK_SPEED_OPTIONS[
      (PLAYBACK_SPEED_OPTIONS.indexOf(playbackClock.speed) + 1) %
        PLAYBACK_SPEED_OPTIONS.length
    ],
  );
document.fonts.ready.then(() => {
  fitPlaybackButton(packetsElement);
  fitTopbarText(topbarElement);
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
  if (!currentPlaybackState?.started) {
    return lessonPlayer.jump(0);
  }
  if (currentPlaybackState.activeStep < currentLesson.steps.length - 1) {
    lessonPlayer.jump(currentPlaybackState.activeStep + 1);
  }
}

function jumpToPreviousStep() {
  if (currentPlaybackState?.started) {
    if (currentPlaybackState.done) {
      return lessonPlayer.jump(currentLesson.steps.length - 1);
    }
    if (currentPlaybackState.activeStep > 0) {
      lessonPlayer.jump(currentPlaybackState.activeStep - 1);
    } else {
      lessonPlayer.reset();
    }
  }
}

const navigateForward = () =>
  packetInspector.isOpen() ? packetInspector.step(1) : jumpToNextStep();

const navigateBackward = () =>
  packetInspector.isOpen() ? packetInspector.step(-1) : jumpToPreviousStep();
const keyboardActions = {
  " ": () => lessonPlayer.toggle(),
  ArrowRight: navigateForward,
  ArrowLeft: navigateBackward,
  Escape: () =>
    isDrawerOpen()
      ? setDrawerOpen(false)
      : packetInspector.isOpen()
        ? packetInspector.close()
        : lessonPlayer.reset(),
  v: () => viewController.toggle(),
  V: () => viewController.toggle(),
};
const isTextInputTarget = (target) =>
  target instanceof Element &&
  target.closest(
    'input, textarea, select, [contenteditable="true"]',
  );
for (const eventType of ["keydown", "keyup"]) {
  window.addEventListener(eventType, (event) => {
    const action = keyboardActions[event.key];
    if (
      !action ||
      !lessonPlayer ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      isTextInputTarget(event.target)
    ) {
      return;
    }
    event.preventDefault();
    if (eventType === "keydown" && !event.repeat) {
      action();
    }
  });
}
document.fonts.ready.then(() => selectLesson("http"));
