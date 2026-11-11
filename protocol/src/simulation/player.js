// Reconstructed from the distributed Protocol Explorer JavaScript.
import { SEQUENCE_ANIMATION_TIMINGS } from "./timeline.js";
import { playbackClock, waitWithClock } from "./clock.js";

const PLAYER_EVENT_DELAYS = {
  network: { event: 450, step: 1100, quick: 120 },
  sequence: { event: 260, step: 650, quick: 80 },
};

function getSequenceEventDuration(event) {
  if (event.type === "packet") {
    return event.quick
      ? SEQUENCE_ANIMATION_TIMINGS.quick
      : SEQUENCE_ANIMATION_TIMINGS.draw;
  }
  if (event.type === "stream") {
    return (
      (event.packets.length - 1) * SEQUENCE_ANIMATION_TIMINGS.stagger +
      SEQUENCE_ANIMATION_TIMINGS.draw
    );
  }
  return event.type === "note" ? SEQUENCE_ANIMATION_TIMINGS.note : 0;
}

/**
 * Play ordered lesson events through the network renderer. Sequence mode
 * applies each event immediately and lets its separate diagram animate it.
 * The callback drives the sidebar, explanation, packet table and diagram.
 */
function createLessonPlayer(
  lesson,
  renderer,
  onStateChange,
  { mode = "network" } = {},
) {
  const events = [
    { type: "focus", ...lesson.start, step: 0 },
    ...lesson.steps.flatMap((step, stepIndex) =>
      step.events.map((event) => ({ ...event, step: stepIndex })),
    ),
  ];
  const lastEventByStep = lesson.steps.map((step, stepIndex) =>
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
  let eventToken = { cancelled: false };
  let delayToken = null;
  let currentMode = mode;
  let notificationQueued = false;
  let disposed = false;

  function getState() {
    const done = nextEventIndex >= events.length && runningEventIndex === -1;
    const started = nextEventIndex > 0 || runningEventIndex !== -1;
    const activeEventIndex =
      runningEventIndex !== -1 ? runningEventIndex : nextEventIndex - 1;
    const activeStep =
      activeEventIndex >= 0 ? events[activeEventIndex].step : 0;
    const isPacketEvent = (event) =>
      event.type === "packet" || event.type === "stream";
    const currentPacketEvent =
      activeEventIndex >= 0 && isPacketEvent(events[activeEventIndex])
        ? activeEventIndex
        : -1;
    // Endpoint changes become visible on arrival, or immediately for a local note.
    const devicePosition = runningEventIndex !== -1 &&
      (packetArrived || events[runningEventIndex].type === "note") ? nextEventIndex + 1 : nextEventIndex;
    return {
      devices: deviceStates[devicePosition],
      playing,
      running: runningEventIndex !== -1,
      started,
      done,
      activeStep,
      labels: labelsAtPosition[nextEventIndex],
      event: activeEventIndex >= 0 ? events[activeEventIndex] : null,
      steps: lesson.steps.map((step, stepIndex) => {
        if (
          stepIndex === activeStep &&
          started &&
          (runningEventIndex !== -1 || activeEventIndex < lastEventByStep[stepIndex])
        ) return "active";
        return finishedSteps.has(stepIndex) ? "done" : "todo";
      }),
      packets: events.flatMap((event, eventIndex) => {
        if (!isPacketEvent(event)) return [];
        const status =
          eventIndex === currentPacketEvent
            ? "current"
            : eventIndex < nextEventIndex
              ? "past"
              : "future";
        return event.type === "stream"
          ? event.packets.map(() => status)
          : [status];
      }),
      notes: events.flatMap((event, eventIndex) =>
        event.type === "note"
          ? [
              eventIndex < nextEventIndex || eventIndex === runningEventIndex
                ? "past"
                : "future",
            ]
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

  function restoreScene() {
    const previousScene = renderer.snapshot();
    if (nextEventIndex === 0) renderer.overview(lesson.nodes, lesson.labels);
    else
      events.slice(0, nextEventIndex).forEach((event) => renderer.apply(event));
    renderer.morph(previousScene, eventToken);
  }

  function getDelayAfter(eventIndex) {
    const nextEvent = events[eventIndex + 1];
    const delays = PLAYER_EVENT_DELAYS[currentMode];
    if (nextEvent.step !== events[eventIndex].step) return delays.step;
    return nextEvent.quick && events[eventIndex].quick
      ? delays.quick
      : delays.event;
  }

  async function runNextEvent() {
    if (runningEventIndex !== -1) return;
    if (nextEventIndex >= events.length) {
      playing = false;
      notifyStateChange();
      return;
    }

    const eventIndex = nextEventIndex;
    const token = eventToken;
    packetArrived = false;
    runningEventIndex = eventIndex;
    notifyStateChange();
    if (currentMode === "sequence") {
      renderer.apply(events[eventIndex]);
      await waitWithClock(getSequenceEventDuration(events[eventIndex]), token);
    } else {
      await renderer.run(events[eventIndex], token, () => {
        if (token === eventToken && events[eventIndex].devicesAfter) {
          packetArrived = true;
          notifyStateChange();
        }
      });
    }

    // Reset/jump replaces the token. Switching to sequence view instead asks
    // this event to finish instantly while retaining its playback position.
    if (token !== eventToken) return;
    if (token.finish) {
      eventToken = { cancelled: false };
      renderer.clear();
      renderer.apply(events[eventIndex]);
    }
    runningEventIndex = -1;
    nextEventIndex = eventIndex + 1;
    const stepIndex = events[eventIndex].step;
    if (lastEventByStep[stepIndex] === eventIndex) finishedSteps.add(stepIndex);
    if (nextEventIndex >= events.length) playing = false;
    notifyStateChange();
    if (!playing) return;

    const waitToken = { cancelled: false };
    delayToken = waitToken;
    await waitWithClock(() => getDelayAfter(eventIndex), waitToken);
    if (delayToken === waitToken) delayToken = null;
    if (!waitToken.cancelled && playing) runNextEvent();
  }

  function cancelPendingWork() {
    eventToken.cancelled = true;
    eventToken = { cancelled: false };
    if (delayToken) delayToken.cancelled = true;
    delayToken = null;
    runningEventIndex = -1;
    renderer.clear();
    playbackClock.resume();
  }

  function reset() {
    cancelPendingWork();
    finishedSteps.clear();
    playing = false;
    nextEventIndex = 0;
    restoreScene();
    notifyStateChange();
  }

  function play() {
    if (nextEventIndex >= events.length && runningEventIndex === -1) reset();
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
      playing = false;
      if (delayToken) delayToken.cancelled = true;
      delayToken = null;
      playbackClock.resume();
      notifyStateChange();
      if (runningEventIndex === -1) runNextEvent();
    },
    setMode(nextMode) {
      if (nextMode === currentMode) return;
      currentMode = nextMode;
      if (nextMode === "sequence" && runningEventIndex !== -1) {
        eventToken.finish = true;
        eventToken.cancelled = true;
      }
    },
    jump(stepIndex) {
      cancelPendingWork();
      nextEventIndex = events.findIndex((event) => event.step === stepIndex);
      restoreScene();
      play();
    },
  };
}
export { createLessonPlayer };
