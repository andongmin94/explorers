// Reconstructed from the distributed Protocol Explorer JavaScript.
import { SEQUENCE_ANIMATION_TIMINGS } from "./timeline.js";
import { animateWithClock, playbackClock, waitWithClock } from "./clock.js";

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
  let singleEvent = false;
  let atStepStart = false;
  let packetStates = [];
  let eventToken = { cancelled: false };
  let delayToken = null;
  let currentMode = mode;
  let notificationQueued = false;
  let disposed = false;

  function getState() {
    const done = nextEventIndex >= events.length && runningEventIndex === -1;
    const started = atStepStart || nextEventIndex > 0 || runningEventIndex !== -1;
    const activeEventIndex =
      atStepStart ? -1 : runningEventIndex !== -1 ? runningEventIndex : nextEventIndex - 1;
    const activeStep =
      atStepStart ? events[nextEventIndex].step : activeEventIndex >= 0 ? events[activeEventIndex].step : 0;
    const isPacketEvent = (event) =>
      event.type === "packet" || event.type === "stream";
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
          (atStepStart || runningEventIndex !== -1 || activeEventIndex < lastEventByStep[stepIndex])
        ) return "active";
        return finishedSteps.has(stepIndex) ? "done" : "todo";
      }),
      packets: events.flatMap((event, eventIndex) => {
        if (!isPacketEvent(event)) return [];
        if (eventIndex === runningEventIndex) return packetStates;
        const packets = event.type === "stream" ? event.packets : [event];
        if (eventIndex >= nextEventIndex) return packets.map(() => "future");
        return packets.map(packet => packet.lost ? "lost" : "past");
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

  function restoreScene(animate = true) {
    const previousScene = renderer.snapshot();
    if (atStepStart && nextEventIndex === 0) renderer.apply(events[0]);
    else if (nextEventIndex === 0) renderer.overview(lesson.nodes, lesson.labels);
    else
      events.slice(0, nextEventIndex).forEach((event) => renderer.apply(event));
    if (animate) renderer.morph(previousScene, eventToken);
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
    const event = events[eventIndex];
    const packets = event.type === "stream" ? event.packets : event.type === "packet" ? [event] : [];
    packetStates = packets.map(() => event.type === "stream" ? "future" : "current");
    function setPacketState(index, state) {
      if (token !== eventToken || token.cancelled || packetStates[index] === state) return;
      packetStates[index] = state;
      notifyStateChange();
    }
    atStepStart = false;
    packetArrived = false;
    runningEventIndex = eventIndex;
    notifyStateChange();
    if (currentMode === "sequence") {
      renderer.apply(event);
      const duration = getSequenceEventDuration(event);
      if (packets.length) {
        const { stagger, draw, quick } = SEQUENCE_ANIMATION_TIMINGS;
        await animateWithClock(duration, token, progress => {
          packets.forEach((packet, index) => {
            const elapsed = progress * duration - index * stagger;
            if (elapsed < 0) return;
            const drawTime = packet.quick ? quick : draw;
            if (elapsed >= drawTime * SEQUENCE_ANIMATION_TIMINGS.tipFraction) {
              setPacketState(index, packet.lost ? "lost" : "past");
            } else {
              setPacketState(index, "current");
            }
          });
        });
      } else {
        await waitWithClock(duration, token);
      }
    } else {
      await renderer.run(event, token, () => {
        if (token === eventToken && event.devicesAfter) {
          packetArrived = true;
          notifyStateChange();
        }
      }, setPacketState);
    }

    // A reset or jump may have replaced the event while it was in flight.
    if (token !== eventToken) return;
    runningEventIndex = -1;
    nextEventIndex = eventIndex + 1;
    const stepIndex = events[eventIndex].step;
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

  function cancelPendingWork() {
    eventToken.cancelled = true;
    eventToken = { cancelled: false };
    if (delayToken) delayToken.cancelled = true;
    delayToken = null;
    runningEventIndex = -1;
    atStepStart = false;
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
    setMode(nextMode) {
      // The current flight keeps its clock when the other view is opened.
      currentMode = nextMode;
    },
    jump(stepIndex, { paused = false } = {}) {
      cancelPendingWork();
      nextEventIndex = events.findIndex((event) => event.step === stepIndex);
      atStepStart = paused;
      restoreScene(!paused);
      if (paused) pause();
      else play();
    },
  };
}
export { createLessonPlayer };
