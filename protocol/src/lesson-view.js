// What the side plate shows for one playback snapshot, without the DOM (the
// tests read it too). Three views follow the learning model:
//   overview — 목표: a scenario question, the setup, 학습 목표, then reference
//   step     — 관찰/설명: the current step and the packet on the wire
//   recap    — 정리: 핵심 정리, 확인 문제, progress, the next protocol
// While a prediction for the upcoming packet is still unanswered, nothing in
// the side plate may give its answer away: the step it belongs to shows only
// a placeholder, and reference facts that contain the answer are left out.
import { translate } from "./i18n.js";
import { getLessonPackets } from "./packets/encode.js";
import { getKeySteps } from "./quiz.js";
import { learning } from "./lessons/learning.js";

const OSI_NAMES = ["Physical", "Data Link", "Network", "Transport", "Session", "Presentation", "Application"];

const HOLD_TITLE = "다음 패킷을 먼저 맞혀 보세요";
const HOLD_TEXT = "답을 고르거나 패킷이 지나가면 이 단계의 설명이 열립니다.";

/** The facts that do not contain the pending answer. */
const factsWithout = (facts, pending) =>
  pending
    ? facts.filter(([label, value]) => !`${translate(label)} ${translate(value)}`.includes(pending.answer))
    : facts;

/** Is this step's text hidden by a pending prediction? */
const isStepHeld = (pending, stepIndex) => Boolean(pending) && pending.step === stepIndex;

/** "핵심 장면 2/5" for a step with a prediction, else null. */
function keySceneOf(lesson, stepIndex) {
  const keys = getKeySteps(lesson);
  const k = keys.indexOf(stepIndex);
  return k < 0 ? null : { k: k + 1, total: keys.length };
}

function buildOverviewState(playback, lesson, lessonOrder = 0, { pending = null } = {}) {
  const packets = getLessonPackets(lesson);
  const activeEvent = playback.event;
  const held = playback.started && !playback.done && isStepHeld(pending, playback.activeStep);
  const showPacket =
    !held &&
    playback.started &&
    !playback.done &&
    (activeEvent?.type === "packet" || activeEvent?.type === "stream") &&
    activeEvent.step === playback.activeStep;
  let firstPacketNumber = showPacket
    ? packets.indexOf(
        activeEvent.type === "stream"
          ? activeEvent.packets[0]
          : packets.find((packet) => packet.row === activeEvent.row),
      ) + 1
    : 0;
  let displayedPacket = activeEvent;
  if (showPacket && playback.running && activeEvent.type === "stream") {
    const firstIndex = firstPacketNumber - 1;
    const sent = activeEvent.packets.findLastIndex((_, i) => playback.packets[firstIndex + i] !== "future");
    displayedPacket = activeEvent.packets[sent];
    firstPacketNumber += sent;
  }
  const view = !playback.started ? "overview" : playback.done ? "recap" : "step";
  const info = learning[lesson.id] ?? {};
  const state = {
    lesson,
    order: lessonOrder,
    view,
    held,
    title: view === "overview" ? "대표 시나리오" : view === "recap" ? "정리" : translate("STEP DETAILS"),
    rank: view === "overview" ? -1 : view === "recap" ? lesson.steps.length : playback.activeStep,
    overview: {
      layer: `L${lesson.layer} · ${translate(OSI_NAMES[lesson.layer - 1])} · ${lesson.steps.length}단계`,
      question: info.question ?? lesson.name,
      setup: info.setup ?? "",
      goal: info.goal ? `학습 목표: ${info.goal}` : "",
      reference: `참고 · ${lesson.name} · ${translate(lesson.overview.full)}`,
      description: translate(lesson.overview.description),
      facts: factsWithout(lesson.overview.facts, view === "overview" ? pending : null),
    },
    content: null,
    recap: null,
    packet: null,
  };
  if (view === "recap") {
    state.recap = {
      label: `정리 · ${lesson.name}`,
      title: lesson.outro.title,
      desc: lesson.outro.desc,
      points: info.points ?? [],
      recall: info.recall ?? [],
    };
    return state;
  }
  if (view === "step") {
    const step = lesson.steps[playback.activeStep];
    const key = keySceneOf(lesson, playback.activeStep);
    const label = [
      translate("STEP {n} OF {total}", { n: playback.activeStep + 1, total: lesson.steps.length }),
      key && `핵심 장면 ${key.k}/${key.total}`,
    ]
      .filter(Boolean)
      .join(" · ");
    state.content = held
      ? { label, key, title: HOLD_TITLE, desc: "", text: HOLD_TEXT, facts: [], hold: true }
      : { label, key, title: step.title, desc: step.desc, text: step.detail, facts: step.facts ?? [], hold: false };
  }
  if (showPacket && displayedPacket) {
    state.packet = {
      number: firstPacketNumber,
      count: displayedPacket.type === "stream" ? displayedPacket.packets.length : 1,
      total: packets.length,
      event: displayedPacket,
      lost: playback.packets[firstPacketNumber - 1] === "lost",
    };
  }
  return state;
}

/** Every string the side plate's 해설 tab shows for this state (for tests). */
function visibleLessonText(state) {
  const parts = [];
  if (state.view === "overview") {
    const o = state.overview;
    parts.push(o.layer, o.question, o.setup, o.goal, o.reference, o.description);
    for (const [label, value] of o.facts) parts.push(translate(label), translate(value));
  } else if (state.view === "step") {
    const c = state.content;
    parts.push(c.label, translate(c.title), translate(c.desc), translate(c.text));
    for (const [label, value] of c.facts) parts.push(translate(label), translate(value));
    if (state.packet) parts.push(translate(state.packet.event.label), ...state.packet.event.payload.map((line) => translate(line)));
  }
  return parts.filter(Boolean).join("\n");
}

/** The title the 장면 list shows for a step (hidden while its prediction is pending). */
const stepListTitle = (lesson, stepIndex, pending, status) =>
  isStepHeld(pending, stepIndex) && status !== "done" ? "예측 뒤에 공개" : translate(lesson.steps[stepIndex].title);

export { HOLD_TITLE, buildOverviewState, isStepHeld, keySceneOf, stepListTitle, visibleLessonText };
