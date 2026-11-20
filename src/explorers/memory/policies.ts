/**
 * Fault counts for any reference string, independent of the lesson engine.
 * Used for yardsticks the scene does not animate: OPT (MIN), a loop that is
 * larger than memory, and Belady's anomaly under FIFO.
 */
export function countFaults<T>(references: readonly T[], frameCount: number, policy: string) {
  if (!["fifo", "lru", "opt"].includes(policy)) throw new RangeError(`unknown policy: ${policy}`);
  if (!Number.isInteger(frameCount) || frameCount < 1)
    throw new RangeError("frameCount must be a positive integer");
  const resident: { page: T; loadedAt: number; lastUsedAt: number }[] = [];
  let hits = 0,
    faults = 0,
    replacements = 0;
  references.forEach((page, index) => {
    const entry = resident.find((frame) => frame.page === page);
    if (entry) {
      hits += 1;
      entry.lastUsedAt = index;
      return;
    }
    faults += 1;
    if (resident.length === frameCount) {
      replacements += 1;
      let victim;
      if (policy === "fifo") victim = resident.reduce((a, b) => (b.loadedAt < a.loadedAt ? b : a));
      else if (policy === "lru")
        victim = resident.reduce((a, b) => (b.lastUsedAt < a.lastUsedAt ? b : a));
      else {
        // OPT: evict the page whose next use is furthest away (never = Infinity).
        const nextUse = (frame: { page: T }) => {
          const at = references.indexOf(frame.page, index + 1);
          return at === -1 ? Infinity : at;
        };
        victim = resident.reduce((a, b) => (nextUse(b) > nextUse(a) ? b : a));
      }
      resident.splice(resident.indexOf(victim), 1);
    }
    resident.push({ page, loadedAt: index, lastUsedAt: index });
  });
  return { hits, faults, replacements };
}

/** The textbook string for Belady's anomaly: FIFO faults rise from 3 to 4 frames. */
export const BELADY_STRING: readonly number[] = Object.freeze([1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5]);
