// Protocol explorer: a console on the shared hardware kit. The stage shows the
// network (or sequence) scene, the deck holds playback, the side plate explains
// the lesson, the records plate holds the packet table and inspector, and the
// protocol picker sits at the left (a drawer on narrower screens).
import "../../shared/theme.css";
import "../../shared/hw.css";
import "./styles.css";
import "../../shared/switcher.js";
import "../../shared/iso.js";
import { lessonsById, protocolCatalog } from "./lessons/index.js";
import {
  getLearningSummary,
  markKeyScene,
  markPrediction,
  markRecall,
  recordLessonProgress,
  sharedProgress,
} from "./progress.js";
import { getGuidedStops, getKeySteps, getPendingQuiz, getUpcomingPacket } from "./quiz.js";
import { learning } from "./lessons/learning.js";
import { translate } from "./i18n.js";
import {
  bindThemeToggle,
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
import { bindSequenceScrolling, updateSequenceDiagram } from "./ui/sequence.js";
import { createPacketInspector } from "./ui/inspector.js";
import { createViewSwitcher, renderSimulationPanel } from "./ui/stage.js";
import {
  bindOverviewBackButton,
  renderOverviewPanel,
  updateOverviewPanel,
} from "./ui/overview.js";
import { bindPacketTable, fitPacketRows, renderPacketTable, updatePacketTable } from "./ui/packet-table.js";
import { SPEEDS, bindDeck, renderDeck, updateDeck, updateDeckGuided, updateDeckSpeed } from "./ui/deck.js";
import { createNetworkAnimation } from "./simulation/network-animation.js";
import { createLessonPlayer } from "./simulation/player.js";
import { createQuiz, renderQuizDialog, renderQuizFoot } from "./ui/quiz.js";

const appElement = document.querySelector("#app");
appElement.innerHTML = `
  <div class="hw-page pe-page shell">
    ${renderTopbar()}
    <main class="hw-console has-rail pe-console workspace">
      ${renderSidebar(lessonsById)}
      ${renderSimulationPanel()}
      ${renderDeck()}
      ${renderOverviewPanel()}
      ${renderPacketTable()}
    </main>
    <footer class="hw-footer">
      <span>조작: <kbd>Space</kbd> 재생·일시정지 <kbd>←</kbd><kbd>→</kbd> 이전·다음 단계 (검사 중에는 패킷) <kbd>R</kbd> 처음으로 <kbd>V</kbd> 보기 전환 <kbd>Esc</kbd> 닫기</span>
      <span>교육용 패킷 시나리오 · 실제 통신을 캡처하지 않습니다</span>
    </footer>
    <div class="hw-rail-scrim pe-scrim" aria-hidden="true"></div>
    ${renderQuizDialog()}
  </div>
`;

const documentRoot = document.documentElement;
const shellElement = appElement.querySelector(".shell");
const topbarElement = appElement.querySelector(".topbar");
const sidebarElement = appElement.querySelector(".sidebar");
const overviewElement = appElement.querySelector(".overview");
const packetsElement = appElement.querySelector(".packets");
const stageElement = appElement.querySelector(".pe-stage");
const deckElement = appElement.querySelector(".pe-deck");
const sequenceElement = appElement.querySelector(".sequence");
overviewElement.insertAdjacentHTML("beforeend", renderQuizFoot());

/* ---------- Protocol drawer (below the three-column width) ---------- */

const drawerQuery = window.matchMedia("(max-width: 1279px)");
const drawerButton = topbarElement.querySelector(".drawer-btn");
const isDrawerOpen = () => shellElement.classList.contains("is-drawer-open");

function setDrawerOpen(open) {
  const isDrawer = drawerQuery.matches;
  shellElement.classList.toggle("is-drawer-open", open && isDrawer);
  shellElement.classList.toggle("is-rail-open", open && isDrawer);
  documentRoot.classList.toggle("is-locked", open && isDrawer);
  drawerButton.setAttribute("aria-expanded", open && isDrawer);
  sidebarElement.inert = isDrawer && !open;
  if (open && isDrawer) {
    (sidebarElement.querySelector('.proto[aria-current="true"]') ??
      sidebarElement.querySelector(".drawer-close")).focus({ preventScroll: true });
  } else if (isDrawer && sidebarElement.contains(document.activeElement)) {
    drawerButton.focus({ preventScroll: true });
  }
}
drawerButton.addEventListener("click", () => setDrawerOpen(!isDrawerOpen()));
sidebarElement.querySelector(".drawer-close").addEventListener("click", () => setDrawerOpen(false));
appElement.querySelector(".pe-scrim").addEventListener("click", () => setDrawerOpen(false));
drawerQuery.addEventListener("change", () => setDrawerOpen(false));
setDrawerOpen(false);

/* ---------- Playback wiring ---------- */

let currentLesson = null;
let lessonPlayer = null;
let currentPlaybackState = null;
let guidedStops = { events: new Set(), midStream: new Set() };
// A packet inside a stream the guided mode already held before.
let heldInStream = -1;

/* ---------- Guided playback (핵심 장면에서 멈추기) ---------- */

const GUIDED_STORAGE_KEY = "protocol-explorer:guided";
let guided = true;
try {
  guided = localStorage.getItem(GUIDED_STORAGE_KEY) !== "0";
} catch {}
const viewController = createViewSwitcher(stageElement, (view) => lessonPlayer?.setMode(view));

const getVisiblePacketIndices = () =>
  [...packetsElement.querySelectorAll("tr[data-packet]")]
    .filter((row) => !row.hidden && row.dataset.shown === "1")
    .map((row) => Number(row.dataset.packet));

const packetInspector = createPacketInspector(packetsElement.querySelector(".inspector"), {
  visible: getVisiblePacketIndices,
  isLost: (index) => currentPlaybackState?.packets[index] === "lost",
  onChange: (packetIndex) => {
    for (const highlighted of appElement.querySelectorAll(".is-inspected")) {
      highlighted.classList.remove("is-inspected");
    }
    documentRoot.classList.toggle("is-inspecting", packetIndex !== null);
    packetsElement.classList.toggle("is-inspecting", packetIndex !== null);
    if (packetIndex === null) return fitPacketRows(packetsElement);
    appElement
      .querySelectorAll(`tr[data-packet="${packetIndex}"], .seq-arrow[data-packet="${packetIndex}"]`)
      .forEach((element) => element.classList.add("is-inspected"));
    fitPacketRows(packetsElement);
    const row = packetsElement.querySelector(`tr[data-packet="${packetIndex}"]`);
    const scroller = packetsElement.querySelector(".packet-scroll");
    const headerHeight = packetsElement.querySelector("thead").offsetHeight;
    if (row.offsetTop < scroller.scrollTop + headerHeight) {
      scroller.scrollTo({ top: row.offsetTop - headerHeight, behavior: "smooth" });
    } else if (row.offsetTop + row.offsetHeight > scroller.scrollTop + scroller.clientHeight) {
      scroller.scrollTo({
        top: row.offsetTop + row.offsetHeight - scroller.clientHeight,
        behavior: "smooth",
      });
    }
  },
});

const inspectPacket = (packetIndex) => {
  if (!getVisiblePacketIndices().includes(packetIndex)) return;
  if (currentPlaybackState?.playing || currentPlaybackState?.running) lessonPlayer.pause();
  packetInspector.open(currentLesson, packetIndex);
};
sequenceElement.addEventListener("click", (event) => {
  const arrow = event.target.closest(".seq-arrow.is-shown");
  if (arrow) inspectPacket(Number(arrow.dataset.packet));
});
bindSequenceScrolling(sequenceElement);

const networkAnimation = createNetworkAnimation(appElement.querySelector(".network"));
const quiz = createQuiz({
  foot: overviewElement.querySelector(".pe-quiz-foot"),
  dialog: appElement.querySelector("#prediction-dialog"),
  player: () => lessonPlayer,
  lesson: () => currentLesson,
  playback: () => currentPlaybackState,
  onAnswer: (lesson, question, correct) => {
    markPrediction(lesson, question.packet, correct);
    if (lesson === currentLesson && currentPlaybackState) updateAppPlaybackState(currentPlaybackState, lesson);
  },
});
updateLearningProgress(topbarElement, lessonsById);
bindThemeToggle(topbarElement);

/** One short status line under the stage: playback state and packets sent. */
function updateStageStatus(state, lesson) {
  const total = state.packets.length;
  const sent = state.packets.filter((packet) => packet !== "future").length;
  const pending = !state.playing && getPendingQuiz(lesson, state, quiz.answered(lesson));
  const status = !state.started
    ? `${translate("OVERVIEW · {n} STEPS", { n: lesson.steps.length })} · 학습 시작을 누르면 시작합니다`
    : state.done
      ? `${translate("END OF SCENARIO")} · 패킷 ${total}개 모두 전송 · 정리`
      : pending
        ? `핵심 장면 · 다음 패킷을 먼저 맞혀 보세요 · 패킷 ${sent}/${total}`
        : `${state.playing ? "재생 중" : "일시정지"} · 패킷 ${sent}/${total}`;
  const foot = stageElement.querySelector(".stage-status");
  if (foot.textContent !== status) foot.textContent = status;
  stageElement.querySelector(".stage-led").classList.toggle("is-on", state.playing);
  const lcd = stageElement.querySelector(".stage-lcd-value");
  lcd.textContent = state.started
    ? `${Math.min(state.activeStep + 1, lesson.steps.length)}/${lesson.steps.length}`
    : `0/${lesson.steps.length}`;
}

/** Render one shared playback snapshot across all panels. */
function updateAppPlaybackState(state, lesson = currentLesson) {
  // Guided: hold before a predicted packet inside a stream (packet events are
  // held by the player itself, before the event starts).
  const upcoming = getUpcomingPacket(state);
  if (guided && state.playing && state.running && guidedStops.midStream.has(upcoming) && heldInStream !== upcoming) {
    heldInStream = upcoming;
    lessonPlayer.pause();
  }
  const keySteps = getKeySteps(lesson);
  if (state.started && !state.done && keySteps.includes(state.activeStep)) markKeyScene(lesson, state.activeStep);
  const pending = getPendingQuiz(lesson, state, quiz.answered(lesson));
  if (state.labels) networkAnimation.setLabels(state.labels);
  networkAnimation.setDevices(lesson.id, state.devices, state.event, state.running);
  updateTopbar(topbarElement, state, lesson);
  updateSidebar(sidebarElement, state, lesson);
  updateOverviewPanel(
    overviewElement,
    state,
    lesson,
    protocolCatalog.findIndex((protocol) => protocol.id === lesson.id),
    {
      pending,
      summary: getLearningSummary(lesson, { scenes: keySteps.length, recall: learning[lesson.id]?.recall ?? [] }),
    },
  );
  updatePacketTable(packetsElement, state, lesson);
  updateDeck(deckElement, state, lesson);
  updateStageStatus(state, lesson);
  const inspectedIndex = packetInspector.index();
  if (inspectedIndex !== null && !getVisiblePacketIndices().includes(inspectedIndex)) {
    packetInspector.close();
  }
  updateSequenceDiagram(sequenceElement, state, lesson);
  // The sequence's step label would name the pending answer (e.g. "Server Hello").
  sequenceElement.querySelectorAll(".seq-step").forEach((label) =>
    label.classList.toggle(
      "is-masked",
      Boolean(pending) && Number(label.dataset.step) === pending.step && state.steps[pending.step] !== "done",
    ),
  );
  quiz.update(state, lesson);
}

/** Back to the overview; a pending quiz reveal no longer applies. */
function resetLesson() {
  quiz.cancel();
  quiz.clearAnswers(currentLesson);
  heldInStream = -1;
  lessonPlayer.reset();
}

function selectLesson(lessonId) {
  if (currentLesson?.id === lessonId) return resetLesson();
  quiz.cancel();
  packetInspector.close();
  lessonPlayer?.dispose();
  currentLesson = lessonsById[lessonId];
  quiz.clearAnswers(currentLesson);
  heldInStream = -1;
  guidedStops = getGuidedStops(currentLesson);
  const stops = guidedStops;
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
    { mode: viewController.view(), stopBefore: (eventIndex) => guided && stops.events.has(eventIndex) },
  );
  lessonPlayer.reset();
}

const closeDrawerAfterSelection = () => isDrawerOpen() && setTimeout(() => setDrawerOpen(false), 220);

function jumpToStep(index) {
  quiz.cancel();
  heldInStream = -1;
  lessonPlayer.jump(index, {
    paused: currentPlaybackState.started && !currentPlaybackState.playing,
  });
}
function jumpToNextStep() {
  if (!currentPlaybackState?.started) return jumpToStep(0);
  if (currentPlaybackState.activeStep < currentLesson.steps.length - 1) {
    jumpToStep(currentPlaybackState.activeStep + 1);
  }
}
function jumpToPreviousStep() {
  if (!currentPlaybackState?.started) return;
  if (currentPlaybackState.done) return jumpToStep(currentLesson.steps.length - 1);
  if (currentPlaybackState.activeStep > 0) jumpToStep(currentPlaybackState.activeStep - 1);
  else resetLesson();
}

bindSidebar(sidebarElement, {
  onSelect: (lessonId) => {
    selectLesson(lessonId);
    closeDrawerAfterSelection();
  },
});
bindOverviewBackButton(overviewElement, resetLesson, (stepIndex) => jumpToStep(stepIndex), {
  onNextLesson: (lessonId) => selectLesson(lessonId),
  recallProgress: (lesson) => ({
    markRecall(id, correct) {
      markRecall(lesson, id, correct);
      sharedProgress.markRecall(`${lesson.id}:${id}`, correct);
    },
  }),
  onRecall: (lesson) => {
    if (lesson === currentLesson && currentPlaybackState) updateAppPlaybackState(currentPlaybackState, lesson);
  },
});

/* ---------- Speed ---------- */

const PLAYBACK_SPEED_STORAGE_KEY = "protocol-explorer:speed";
function setPlaybackSpeed(speed, persist = true) {
  playbackClock.setSpeed(speed);
  updateDeckSpeed(deckElement, speed);
  if (persist) {
    try {
      localStorage.setItem(PLAYBACK_SPEED_STORAGE_KEY, speed);
    } catch {}
  }
}
try {
  const savedSpeed = Number(localStorage.getItem(PLAYBACK_SPEED_STORAGE_KEY));
  if (SPEEDS.includes(savedSpeed)) setPlaybackSpeed(savedSpeed, false);
} catch {}

bindDeck(deckElement, {
  toggle: () => lessonPlayer.toggle(),
  step: () => lessonPlayer.step(),
  reset: resetLesson,
  prev: () => jumpToPreviousStep(),
  next: () => jumpToNextStep(),
  speed: (speed) => setPlaybackSpeed(speed),
  guided: () => {
    guided = !guided;
    updateDeckGuided(deckElement, guided);
    try {
      localStorage.setItem(GUIDED_STORAGE_KEY, guided ? "1" : "0");
    } catch {}
  },
  seek: (value) => (value === 0 ? resetLesson() : jumpToStep(value - 1)),
});
updateDeckGuided(deckElement, guided);
bindPacketTable(packetsElement, { inspect: inspectPacket });

/* ---------- Keyboard ---------- */

const navigateForward = () => (packetInspector.isOpen() ? packetInspector.step(1) : jumpToNextStep());
const navigateBackward = () => (packetInspector.isOpen() ? packetInspector.step(-1) : jumpToPreviousStep());
const keyboardActions = {
  " ": () => lessonPlayer.toggle(),
  ArrowRight: navigateForward,
  ArrowLeft: navigateBackward,
  Escape: () => (isDrawerOpen() ? setDrawerOpen(false) : packetInspector.isOpen() && packetInspector.close()),
  r: () => resetLesson(),
  R: () => resetLesson(),
  v: () => viewController.toggle(),
  V: () => viewController.toggle(),
};
const isTextInputTarget = (target) =>
  target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]');
for (const eventType of ["keydown", "keyup"]) {
  window.addEventListener(eventType, (event) => {
    const action = keyboardActions[event.key];
    if (
      !action ||
      !lessonPlayer ||
      quiz.isOpen() ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      isTextInputTarget(event.target)
    ) {
      return;
    }
    event.preventDefault();
    if (eventType === "keydown" && !event.repeat) action();
  });
}

document.fonts.ready.then(() => selectLesson("http"));
