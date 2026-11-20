// Reconstructed from the distributed Protocol Explorer JavaScript.
import type {
  CancelToken,
  Lesson,
  LessonEvent,
  PacketStatus,
  PlaybackState,
  Renderer,
  StepStatus,
  ViewMode,
} from "../types.ts";
import { SEQUENCE_ANIMATION_TIMINGS } from "./timeline.ts";
import { playbackClock, waitWithClock } from "./clock.ts";

const PLAYER_EVENT_DELAYS: Record<ViewMode, { event: number; step: number; quick: number }> = {
  network: { event: 450, step: 1100, quick: 120 },
  sequence: { event: 260, step: 650, quick: 80 },
};

/**
 * `stopBefore(eventIndex)` (guided playback) holds continuous playback just
 * before that event; playing again runs it. A single step never holds.
 *
 * Both diagrams use the same packet departures and arrivals. Sequence mode
 * uses its shorter travel times and applies local scene changes immediately.
 * The callback drives the sidebar, explanation, packet table and diagram.
 */
function createLessonPlayer(
  lesson: Lesson,
  renderer: Renderer,
  onStateChange: (state: PlaybackState) => void,
  {
    mode = "network",
    stopBefore = () => false,
  }: { mode?: ViewMode; stopBefore?: (eventIndex: number) => boolean } = {},
) {
  const events: LessonEvent[] = [
    { type: "focus", ...lesson.start, step: 0 },
    ...lesson.steps.flatMap((step, stepIndex: number) =>
      step.events.map((event) => ({ ...event, step: stepIndex })),
    ),
  ];
  const lastEventByStep = lesson.steps.map((_step, stepIndex: number) =>
    events.findLastIndex((event) => event.step === stepIndex),
  );
  // A packet can change an endpoint's label on arrival, including after seeking.
  const labelsAtPosition = [lesson.labels];
  for (const event of events) {
    const previous = labelsAtPosition.at(-1);
    labelsAtPosition.push(event.labelsAfter ? { ...previous, ...event.labelsAfter } : previous);
  }
  const deviceStates = [lesson.devices];
  for (const event of events) {
    const previous = deviceStates.at(-1);
    deviceStates.push(event.devicesAfter ? { ...previous, ...event.devicesAfter } : previous);
  }
  let packetArrived = false;
  const finishedSteps = new Set();
  let nextEventIndex = 0;
  let runningEventIndex = -1;
  let playing = false;
  let singleEvent = false;
  let atStepStart = false;
  let packetStates: PacketStatus[] = [];
  let eventToken: CancelToken = { cancelled: false };
  let delayToken: CancelToken | null = null;
  let currentMode: ViewMode = mode;
  let notificationQueued = false;
  let disposed = false;
  // The event a guided stop already held before; playing on runs it.
  let heldBefore = -1;

  function getState(): PlaybackState {
    const done = nextEventIndex >= events.length && runningEventIndex === -1;
    const started = atStepStart || nextEventIndex > 0 || runningEventIndex !== -1;
    const activeEventIndex = atStepStart
      ? -1
      : runningEventIndex !== -1
        ? runningEventIndex
        : nextEventIndex - 1;
    const activeStep = atStepStart
      ? events[nextEventIndex].step!
      : activeEventIndex >= 0
        ? events[activeEventIndex].step!
        : 0;
    const isPacketEvent = (event: LessonEvent) =>
      event.type === "packet" || event.type === "stream";
    // Endpoint changes become visible on arrival, or immediately for a local note.
    const devicePosition =
      runningEventIndex !== -1 && (packetArrived || events[runningEventIndex].type === "note")
        ? nextEventIndex + 1
        : nextEventIndex;
    return {
      held:
        !playing &&
        runningEventIndex === -1 &&
        heldBefore === nextEventIndex &&
        nextEventIndex < events.length,
      devices: deviceStates[devicePosition],
      playing,
      running: runningEventIndex !== -1,
      started,
      done,
      activeStep,
      labels: labelsAtPosition[nextEventIndex],
      event: activeEventIndex >= 0 ? events[activeEventIndex] : null,
      steps: lesson.steps.map((_step, stepIndex: number): StepStatus => {
        if (
          stepIndex === activeStep &&
          started &&
          (atStepStart || runningEventIndex !== -1 || activeEventIndex < lastEventByStep[stepIndex])
        )
          return "active";
        return finishedSteps.has(stepIndex) ? "done" : "todo";
      }),
      packets: events.flatMap((event, eventIndex): PacketStatus[] => {
        if (!isPacketEvent(event)) return [];
        if (eventIndex === runningEventIndex) return packetStates;
        const packets = event.type === "stream" ? event.packets! : [event];
        if (eventIndex >= nextEventIndex) return packets.map(() => "future");
        return packets.map((packet) => (packet.lost ? "lost" : "past"));
      }),
      notes: events.flatMap((event, eventIndex): ("past" | "future")[] =>
        event.type === "note"
          ? [eventIndex < nextEventIndex || eventIndex === runningEventIndex ? "past" : "future"]
          : [],
      ),
    };
  }

  function notifyStateChange() {
    if (notificationQueued) return;
    notificationQueued = true;
    queueMicrotask(() => {
      notificationQueued = false;
      if (!disposed) onStateChange(getState());
    });
  }

  function restoreScene(animate = true) {
    const previousScene = renderer.snapshot();
    if (atStepStart && nextEventIndex === 0) renderer.apply(events[0]);
    else if (nextEventIndex === 0) renderer.overview(lesson.nodes, lesson.labels);
    else events.slice(0, nextEventIndex).forEach((event) => renderer.apply(event));
    if (animate) renderer.morph(previousScene, eventToken);
  }

  function getDelayAfter(eventIndex: number) {
    const nextEvent = events[eventIndex + 1];
    const delays = PLAYER_EVENT_DELAYS[currentMode];
    if (nextEvent.step !== events[eventIndex].step) return delays.step;
    return nextEvent.quick && events[eventIndex].quick ? delays.quick : delays.event;
  }

  async function runNextEvent() {
    if (runningEventIndex !== -1) return;
    if (nextEventIndex >= events.length) {
      playing = false;
      notifyStateChange();
      return;
    }

    const eventIndex = nextEventIndex;
    if (playing && !singleEvent && heldBefore !== eventIndex && stopBefore(eventIndex)) {
      heldBefore = eventIndex;
      pause();
      return;
    }
    const token = eventToken;
    const event = events[eventIndex];
    const packets =
      event.type === "stream" ? event.packets! : event.type === "packet" ? [event] : [];
    packetStates = packets.map((): PacketStatus =>
      event.type === "stream" ? "future" : "current",
    );
    function setPacketState(index: number, state: PacketStatus) {
      if (token !== eventToken || token.cancelled || packetStates[index] === state) return;
      packetStates[index] = state;
      notifyStateChange();
    }
    atStepStart = false;
    packetArrived = false;
    runningEventIndex = eventIndex;
    notifyStateChange();
    if (currentMode === "sequence" && !packets.length) {
      renderer.apply(event);
      await waitWithClock(event.type === "note" ? SEQUENCE_ANIMATION_TIMINGS.note : 0, token);
    } else {
      await renderer.run(
        event,
        token,
        () => {
          if (token === eventToken && event.devicesAfter) {
            packetArrived = true;
            notifyStateChange();
          }
        },
        setPacketState,
        currentMode,
      );
    }

    // A reset or jump may have replaced the event while it was in flight.
    if (token !== eventToken) return;
    runningEventIndex = -1;
    nextEventIndex = eventIndex + 1;
    const stepIndex = events[eventIndex].step!;
    if (lastEventByStep[stepIndex] === eventIndex) finishedSteps.add(stepIndex);
    if (singleEvent || nextEventIndex >= events.length) playing = false;
    notifyStateChange();
    if (!playing) return;

    const waitToken = { cancelled: false };
    delayToken = waitToken;
    await waitWithClock(() => getDelayAfter(eventIndex), waitToken);
    if (delayToken === waitToken) delayToken = null;
    if (!waitToken.cancelled && playing) runNextEvent();
  }

  function cancelPendingWork(immediate = false) {
    eventToken.cancelled = true;
    eventToken = { cancelled: false };
    if (delayToken) delayToken.cancelled = true;
    delayToken = null;
    runningEventIndex = -1;
    atStepStart = false;
    renderer.clear(immediate);
    playbackClock.resume();
  }

  function reset() {
    cancelPendingWork();
    heldBefore = -1;
    finishedSteps.clear();
    playing = false;
    nextEventIndex = 0;
    restoreScene();
    notifyStateChange();
  }

  /** release: an event index to play through without a guided hold (a prediction's reveal). */
  function play({ release }: { release?: number } = {}) {
    if (nextEventIndex >= events.length && runningEventIndex === -1) reset();
    if (release !== undefined) heldBefore = release;
    if (runningEventIndex === -1) singleEvent = false;
    playing = true;
    playbackClock.resume();
    notifyStateChange();
    if (runningEventIndex === -1 && !delayToken) runNextEvent();
  }

  function pause() {
    playing = false;
    playbackClock.pause();
    notifyStateChange();
  }

  return {
    reset,
    dispose() {
      cancelPendingWork();
      playing = false;
      disposed = true;
    },
    toggle: () => (playing ? pause() : play()),
    pause,
    play,
    step() {
      playing = true;
      singleEvent = true;
      if (delayToken) delayToken.cancelled = true;
      delayToken = null;
      playbackClock.resume();
      notifyStateChange();
      if (runningEventIndex === -1) runNextEvent();
    },
    setMode(nextMode: ViewMode) {
      // The current flight keeps its clock when the other view is opened.
      currentMode = nextMode;
    },
    jump(stepIndex: number, { paused = false } = {}) {
      cancelPendingWork(paused);
      nextEventIndex = events.findIndex((event) => event.step === stepIndex);
      // Jumping to a step start is already the stop before its first event.
      heldBefore = nextEventIndex;
      atStepStart = paused;
      restoreScene(!paused);
      if (paused) pause();
      else play();
    },
  };
}
export { createLessonPlayer };
