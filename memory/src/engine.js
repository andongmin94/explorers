// Page replacement engine: one step is one completed page access, not an
// elapsed unit of time. Pure and deterministic; every lesson runs on it.
//
//   simulate({ algorithm: "fifo" | "lru" | "opt" | "clock", frameCount, references })
//
// FIFO compares the 적재 순서 (loadedAt), LRU the 마지막 접근 (lastUsedAt),
// OPT the 다음 접근 (nextUseAt, needs the future), Clock the reference bit
// (ref) under a circular hand (OSTEP 22.2–22.8, Silberschatz 10.4).

/** Lesson 01's reference string (three frames). */
export const REFERENCE_STRING = Object.freeze(["A", "B", "C", "A", "D", "A", "B", "E", "A", "B"]);

export const ALGORITHMS = Object.freeze(["fifo", "lru", "opt", "clock"]);

export const PAGE_INFO = Object.freeze(
  Object.fromEntries(["A", "B", "C", "D", "E"].map((id) => [id, Object.freeze({ id, name: `페이지 ${id}` })])),
);

/** The 1-based access number at which `page` is next used after access `after`, or null (never again). */
export function nextUseOf(references, page, after) {
  const at = references.indexOf(page, after);
  return at === -1 ? null : at + 1;
}

const snapshot = (frames, references, index, algorithm) =>
  frames.map((frame) => {
    const copy = { ...frame };
    if (frame.page !== null) copy.nextUseAt = nextUseOf(references, frame.page, index);
    else copy.nextUseAt = null;
    if (algorithm !== "clock") delete copy.ref;
    return copy;
  });

/**
 * Order in which the policy would replace the resident pages; [0] goes first.
 * Ties (OPT: several pages never used again) go to the page loaded first.
 */
export function replacementOrder(frames, algorithm, { hand = 0 } = {}) {
  const resident = frames.filter((frame) => frame.page !== null);
  if (algorithm === "fifo") return resident.toSorted((a, b) => a.loadedAt - b.loadedAt).map((f) => f.page);
  if (algorithm === "lru") return resident.toSorted((a, b) => a.lastUsedAt - b.lastUsedAt).map((f) => f.page);
  if (algorithm === "opt") {
    const far = (f) => f.nextUseAt ?? Infinity;
    return resident.toSorted((a, b) => far(b) - far(a) || a.loadedAt - b.loadedAt).map((f) => f.page);
  }
  // Clock: from the hand, the first page whose reference bit is 0 goes; pages
  // with the bit set get a second chance (cleared) and come after.
  const n = frames.length;
  const round = Array.from({ length: n }, (_, k) => frames[(hand + k) % n]).filter((f) => f.page !== null);
  return [...round.filter((f) => !f.ref), ...round.filter((f) => f.ref)].map((f) => f.page);
}

export function simulate({ algorithm = "fifo", frameCount = 3, references = REFERENCE_STRING } = {}) {
  if (!ALGORITHMS.includes(algorithm)) throw new RangeError(`지원하지 않는 교체 방식: ${algorithm}`);
  if (!Number.isInteger(frameCount) || frameCount < 1) throw new RangeError("프레임 수는 양의 정수여야 합니다.");

  const frames = Array.from({ length: frameCount }, (_, slot) => ({
    slot,
    page: null,
    loadedAt: null,
    lastUsedAt: null,
    ref: 0,
  }));
  let hand = 0;
  let hits = 0;
  let faults = 0;
  let replacements = 0;
  const orderOf = (fs) => replacementOrder(fs, algorithm, { hand });
  const start = snapshot(frames, references, 0, algorithm);
  const steps = [
    {
      index: 0,
      page: null,
      hit: null,
      fault: false,
      compulsory: false,
      victim: null,
      frameIndex: null,
      before: start,
      frames: start,
      beforeOrder: [],
      order: [],
      handBefore: algorithm === "clock" ? 0 : null,
      hand: algorithm === "clock" ? 0 : null,
      events: [],
      hits,
      faults,
      replacements,
    },
  ];

  references.forEach((page, referenceIndex) => {
    const index = referenceIndex + 1;
    // "before" is seen from the previous access: its next-use numbers count from there.
    const before = snapshot(frames, references, referenceIndex, algorithm);
    const handBefore = hand;
    const beforeOrder = orderOf(before);
    const events = [];
    let frameIndex = frames.findIndex((frame) => frame.page === page);
    const hit = frameIndex !== -1;
    // A compulsory (cold) miss is the first reference to a page. It can still
    // replace a page when RAM is full (OSTEP 22.2, the three Cs).
    const compulsory = !hit && !references.slice(0, referenceIndex).includes(page);
    let victim = null;

    if (hit) {
      hits += 1;
      events.push({ type: "hit", page, frameIndex });
      frames[frameIndex].lastUsedAt = index;
      frames[frameIndex].ref = 1;
    } else {
      faults += 1;
      events.push({ type: "miss", page });
      frameIndex = frames.findIndex((frame) => frame.page === null);
      const usesEmptyFrame = frameIndex !== -1;
      if (!usesEmptyFrame) {
        if (algorithm === "clock") {
          // Sweep: a set bit is cleared and the hand moves on (second chance).
          while (frames[hand].ref) {
            frames[hand].ref = 0;
            events.push({ type: "sweep", page: frames[hand].page, frameIndex: hand });
            hand = (hand + 1) % frameCount;
          }
          frameIndex = hand;
          victim = frames[hand].page;
          hand = (hand + 1) % frameCount;
        } else {
          victim = beforeOrder[0];
          frameIndex = frames.findIndex((frame) => frame.page === victim);
        }
        replacements += 1;
      }
      events.push({ type: "select", page, frameIndex, victim, reason: usesEmptyFrame ? "empty" : algorithm });
      if (victim !== null) events.push({ type: "evict", page: victim, frameIndex });
      frames[frameIndex] = { slot: frameIndex, page, loadedAt: index, lastUsedAt: index, ref: 1 };
      events.push({ type: "load", page, frameIndex });
    }
    events.push({ type: "access", page, frameIndex });

    const after = snapshot(frames, references, index, algorithm);
    steps.push({
      index,
      page,
      hit,
      fault: !hit,
      compulsory,
      victim,
      frameIndex,
      before,
      frames: after,
      beforeOrder,
      order: orderOf(after),
      handBefore: algorithm === "clock" ? handBefore : null,
      hand: algorithm === "clock" ? hand : null,
      events,
      hits,
      faults,
      replacements,
    });
  });

  const accesses = references.length;
  return {
    algorithm,
    frameCount,
    references,
    steps,
    stats: { accesses, hits, faults, replacements, hitRate: hits / accesses, faultRate: faults / accesses },
  };
}
