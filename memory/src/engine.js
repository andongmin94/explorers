export const REFERENCE_STRING = Object.freeze([
  "A",
  "B",
  "C",
  "A",
  "D",
  "A",
  "B",
  "E",
  "A",
  "B",
]);

export const PAGE_INFO = Object.freeze(
  Object.fromEntries(
    ["A", "B", "C", "D", "E"].map((id) => [
      id,
      Object.freeze({ id, name: `페이지 ${id}` }),
    ]),
  ),
);

const snapshot = (frames) => frames.map((frame) => ({ ...frame }));

function replacementOrder(frames, algorithm) {
  const key = algorithm === "fifo" ? "loadedAt" : "lastUsedAt";
  return frames
    .filter((frame) => frame.page !== null)
    .toSorted((a, b) => a[key] - b[key])
    .map((frame) => frame.page);
}

/** One step is one completed page access, not an elapsed unit of time. */
export function simulate({ algorithm = "fifo", frameCount = 3 } = {}) {
  if (algorithm !== "fifo" && algorithm !== "lru") {
    throw new RangeError(`지원하지 않는 교체 방식: ${algorithm}`);
  }
  if (!Number.isInteger(frameCount) || frameCount < 1) {
    throw new RangeError("프레임 수는 양의 정수여야 합니다.");
  }

  const frames = Array.from({ length: frameCount }, (_, slot) => ({
    slot,
    page: null,
    loadedAt: null,
    lastUsedAt: null,
  }));
  let hits = 0;
  let faults = 0;
  let replacements = 0;
  const steps = [
    {
      index: 0,
      page: null,
      hit: null,
      fault: false,
      compulsory: false,
      victim: null,
      frameIndex: null,
      before: snapshot(frames),
      frames: snapshot(frames),
      beforeOrder: [],
      order: [],
      events: [],
      hits,
      faults,
      replacements,
    },
  ];

  REFERENCE_STRING.forEach((page, referenceIndex) => {
    const index = referenceIndex + 1;
    const before = snapshot(frames);
    const beforeOrder = replacementOrder(frames, algorithm);
    const events = [];
    let frameIndex = frames.findIndex((frame) => frame.page === page);
    const hit = frameIndex !== -1;
    // A compulsory (cold) miss is the first reference to a page. It can still
    // replace a page when RAM is full (OSTEP 22.2, the three Cs).
    const compulsory = !hit && !REFERENCE_STRING.slice(0, referenceIndex).includes(page);
    let victim = null;

    if (hit) {
      hits += 1;
      events.push({ type: "hit", page, frameIndex });
      frames[frameIndex].lastUsedAt = index;
    } else {
      faults += 1;
      events.push({ type: "miss", page });
      frameIndex = frames.findIndex((frame) => frame.page === null);
      const usesEmptyFrame = frameIndex !== -1;
      if (!usesEmptyFrame) {
        victim = beforeOrder[0];
        frameIndex = frames.findIndex((frame) => frame.page === victim);
        replacements += 1;
      }
      events.push({
        type: "select",
        page,
        frameIndex,
        victim,
        reason: usesEmptyFrame ? "empty" : algorithm,
      });
      if (victim !== null) {
        events.push({ type: "evict", page: victim, frameIndex });
      }
      frames[frameIndex] = {
        slot: frameIndex,
        page,
        loadedAt: index,
        lastUsedAt: index,
      };
      events.push({ type: "load", page, frameIndex });
    }
    events.push({ type: "access", page, frameIndex });

    steps.push({
      index,
      page,
      hit,
      fault: !hit,
      compulsory,
      victim,
      frameIndex,
      before,
      frames: snapshot(frames),
      beforeOrder,
      order: replacementOrder(frames, algorithm),
      events,
      hits,
      faults,
      replacements,
    });
  });

  const accesses = REFERENCE_STRING.length;
  return {
    algorithm,
    frameCount,
    references: REFERENCE_STRING,
    steps,
    stats: {
      accesses,
      hits,
      faults,
      replacements,
      hitRate: hits / accesses,
      faultRate: faults / accesses,
    },
  };
}
