// Reconstructed from the distributed Protocol Explorer JavaScript.
const SEQUENCE_ANIMATION_TIMINGS = {
  draw: 620,
  quick: 320,
  stagger: 160,
  tipFraction: 0.7,
  note: 700,
};
const DEFAULT_LIFELINE_ORDER = [
  "client",
  "router",
  "internet",
  "dns",
  "web",
  "mx",
  "root",
  "tld",
  "auth",
];
const SEQUENCE_PIXELS_PER_SECOND = 3e3;
const SEQUENCE_TIME_BREAK_THRESHOLD = 0.25;
const SEQUENCE_TIME_BREAK_HEIGHT = 58;
const SEQUENCE_ARRIVAL_SPACING = 18;
const SEQUENCE_MIN_TIME_SPACING = 9;
const SEQUENCE_SEND_SPACING = 30;
const SEQUENCE_NOTE_HEIGHT = 30;
const SEQUENCE_NOTE_SEND_SPACING = 22;
const SEQUENCE_STEP_HEIGHT = 30;
const SEQUENCE_TOP_PADDING = 30;
const SEQUENCE_BOTTOM_PADDING = 40;
const roundTimestamp = (timestamp) => Math.round(timestamp * 1e6) / 1e6;
/** Lesson latency values are in seconds and apply in either direction. */
function getLinkLatency(lesson, from, to) {
  const latency =
    lesson.latency?.[`${from}-${to}`] ?? lesson.latency?.[`${to}-${from}`];
  if (latency === undefined)
    throw new Error(`${lesson.id}: no delay between ${from} and ${to}`);
  return latency;
}
function formatElapsedTimeBreak(seconds) {
  return seconds >= 3600
    ? `${+(seconds / 3600).toFixed(1)} h later`
    : seconds >= 60
      ? `${+(seconds / 60).toFixed(1)} min later`
      : `${seconds < 10 ? seconds.toFixed(2) : seconds.toFixed(1)} s later`;
}
/**
 * Convert lesson events into diagram coordinates. Sends and arrivals remain
 * chronological; long idle intervals use a labeled break instead of empty space.
 * Packet `p` and note `e` retain the original event objects for the diagram and
 * inspector. Their numeric `index` is the same index used by the packet table.
 */
function buildSequenceLayout(lesson) {
  const items = [];
  let packetIndex = 0;
  let noteIndex = 0;
  lesson.steps.forEach((step, stepIndex) =>
    step.events.forEach((event) => {
      if (event.type === "packet") {
        items.push({
          type: "packet",
          p: event,
          step: stepIndex,
          index: packetIndex++,
        });
      }
      if (event.type === "stream") {
        event.packets.forEach((packet) =>
          items.push({
            type: "packet",
            p: packet,
            step: stepIndex,
            index: packetIndex++,
          }),
        );
      }
      if (event.type === "note") {
        items.push({
          type: "note",
          e: event,
          step: stepIndex,
          index: noteIndex++,
        });
      }
    }),
  );
  const activeNodes = new Set(
    items.flatMap((item) =>
      item.type === "packet" ? [item.p.from, item.p.to] : [],
    ),
  );
  const lifelines = (lesson.lifelines ?? DEFAULT_LIFELINE_ORDER).filter(
    (node) => activeNodes.has(node),
  );
  const packets = items
    .filter((item) => item.type === "packet")
    .map((item, order) => {
      const { p: packet } = item;
      const sent = roundTimestamp(parseFloat(packet.row.time));
      const latency = getLinkLatency(lesson, packet.from, packet.to);
      return {
        ...item,
        k: order,
        sent,
        arrived: roundTimestamp(sent + latency),
      };
    });
  const notes = items
    .map((item, index) => ({
      it: item,
      i: index,
    }))
    .filter(({ it: item }) => item.type === "note")
    .map(({ it: item, i: itemIndex }) => {
      const previousPacket = items
        .slice(0, itemIndex)
        .findLast((candidate) => candidate.type === "packet");
      const nextPacket = items
        .slice(itemIndex + 1)
        .find((candidate) => candidate.type === "packet");
      const previousArrival = previousPacket
        ? packets.find((candidate) => candidate.index === previousPacket.index)
            .arrived
        : 0;
      const nextSend =
        nextPacket && nextPacket.step === item.step
          ? packets.find((candidate) => candidate.index === nextPacket.index)
              .sent
          : -Infinity;
      const lane = lifelines.includes(item.e.at) ? item.e.at : null;
      const between = previousPacket
        ? [previousPacket.p.from, previousPacket.p.to]
        : null;
      return {
        ...item,
        order: itemIndex,
        t: Math.max(previousArrival, nextSend),
        lane,
        between,
      };
    });
  // At equal timestamps: arrivals (0), notes (0.5), then sends (1). Original
  // event order breaks ties so labels stay deterministic across redraws.
  const timeline = [
    ...packets.flatMap((packet) => [
      {
        t: packet.sent,
        kind: 1,
        order: items.indexOf(
          items.find(
            (item) => item.type === "packet" && item.index === packet.index,
          ),
        ),
        pk: packet,
        end: "sent",
      },
      {
        t: packet.arrived,
        kind: 0,
        order: packet.k,
        pk: packet,
        end: "arrived",
      },
    ]),
    ...notes.map((note) => ({
      t: note.t,
      kind: 0.5,
      order: note.order,
      n: note,
    })),
  ].sort(
    (left, right) =>
      left.t - right.t || left.kind - right.kind || left.order - right.order,
  );
  const steps = [];
  const breaks = [];
  let cursorY = SEQUENCE_TOP_PADDING;
  let previousEvent = null;
  let previousSendY = -Infinity;
  let previousNoteBottom = -Infinity;
  for (const event of timeline) {
    if (previousEvent) {
      const elapsed = roundTimestamp(event.t - previousEvent.t);
      if (elapsed > SEQUENCE_TIME_BREAK_THRESHOLD) {
        breaks.push({
          y: cursorY + SEQUENCE_TIME_BREAK_HEIGHT / 2,
          seconds: elapsed,
        });
        cursorY += SEQUENCE_TIME_BREAK_HEIGHT;
      } else if (elapsed > 0) {
        cursorY += Math.max(
          SEQUENCE_MIN_TIME_SPACING,
          elapsed * SEQUENCE_PIXELS_PER_SECOND,
        );
      } else if (event.kind === previousEvent.kind && event.kind === 0) {
        cursorY += SEQUENCE_ARRIVAL_SPACING;
      }
    }
    if (event.kind === 1) {
      cursorY = Math.max(
        cursorY,
        previousSendY + SEQUENCE_SEND_SPACING,
        previousNoteBottom + SEQUENCE_NOTE_SEND_SPACING,
      );
    }
    const stepIndex =
      event.pk && event.end === "sent"
        ? event.pk.step
        : event.n
          ? event.n.step
          : null;
    if (stepIndex !== null && !steps.some((step) => step.step === stepIndex)) {
      cursorY += SEQUENCE_STEP_HEIGHT / 2;
      steps.push({
        step: stepIndex,
        y: cursorY,
      });
      cursorY += SEQUENCE_STEP_HEIGHT / 2;
    }
    if (event.n) {
      cursorY += SEQUENCE_NOTE_HEIGHT / 2;
      event.n.y = cursorY;
      previousNoteBottom = cursorY + 10;
      cursorY += SEQUENCE_NOTE_HEIGHT / 2;
    } else {
      event.pk[event.end === "sent" ? "ySent" : "yArrived"] = cursorY;
    }
    if (event.kind === 1) {
      previousSendY = cursorY;
    }
    previousEvent = event;
  }
  return {
    lifelines,
    packets,
    notes,
    steps,
    breaks,
    height: cursorY + SEQUENCE_BOTTOM_PADDING,
  };
}
export {
  SEQUENCE_ANIMATION_TIMINGS,
  buildSequenceLayout,
  formatElapsedTimeBreak,
  getLinkLatency,
};
