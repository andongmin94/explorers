// Disk scheduling engine: pure functions, no DOM (port of disk/src/engine.js).
//
// simulate() serves a batch of requests (all arrived before the start) one
// request per step. The OS picks the next request each time the previous one
// is done (OSTEP 37.5; Silberschatz 10th ed. 11.2). Distances are cylinder
// differences; for the sweep methods a step may pass an edge (`via`) before it
// reaches its request.
import type {
  Algorithm,
  Candidate,
  DiskRequest,
  DiskState,
  Direction,
  Pick,
  Run,
  Served,
  SimulateOptions,
  Step,
} from "./types.ts";

export const REQUESTS: readonly number[] = Object.freeze([98, 183, 37, 122, 14, 124, 65, 67]);
export const INITIAL_HEAD = 53;
export const MAX_CYLINDER = 199;
export const ALGORITHMS: readonly Algorithm[] = Object.freeze([
  "fcfs",
  "sstf",
  "scan",
  "look",
  "cscan",
]);

const sign = (direction: Direction) => (direction === "up" ? 1 : -1);
const nearest = <R extends DiskRequest>(list: R[], head: number): R =>
  list.reduce((a, b) => {
    const da = Math.abs(a.cylinder - head);
    const db = Math.abs(b.cylinder - head);
    return db < da || (db === da && b.id < a.id) ? b : a;
  });

/**
 * The next request and how the head gets there.
 * Returns { request, path: [from, ...via, to], direction } — path lists the
 * cylinders the head passes through (an edge it turns at, or both edges of a
 * C-SCAN return). `jump` is the index in `path` where the C-SCAN return starts.
 */
export function pick(
  algorithm: string,
  pending: DiskRequest[],
  head: number,
  direction: Direction = "down",
  { max = MAX_CYLINDER }: { max?: number } = {},
): Pick | null {
  if (!pending.length) return null;
  if (algorithm === "fcfs") {
    const request = pending.reduce((a, b) => (b.id < a.id ? b : a));
    return { request, path: [head, request.cylinder], direction };
  }
  if (algorithm === "sstf") {
    const request = nearest(pending, head);
    return { request, path: [head, request.cylinder], direction };
  }
  if (!["scan", "look", "cscan"].includes(algorithm)) throw new RangeError("Unknown algorithm");
  const ahead = (dir: Direction) => pending.filter((r) => (r.cylinder - head) * sign(dir) >= 0);
  const here = ahead(direction);
  if (here.length) {
    const request = nearest(here, head);
    return { request, path: [head, request.cylinder], direction };
  }
  const edge = direction === "up" ? max : 0;
  const other = direction === "up" ? 0 : max;
  if (algorithm === "cscan") {
    // Run on to the edge, return to the other edge without serving, sweep on.
    const request = nearest(pending, other);
    const path = head === edge ? [head] : [head, edge];
    const jump = path.length - 1;
    return {
      request,
      path: [...path, other, request.cylinder].filter((c, i, a) => i === 0 || c !== a[i - 1]),
      direction,
      jump,
    };
  }
  const back: Direction = direction === "up" ? "down" : "up";
  const request = nearest(pending, head);
  const path =
    algorithm === "scan" && head !== edge
      ? [head, edge, request.cylinder]
      : [head, request.cylinder];
  return { request, path, direction: back };
}

/** Length of a path; a C-SCAN return (from path[jump]) counts only if countReturn. */
export function pathLength(
  path: number[],
  { jump = -1, countReturn = true }: { jump?: number; countReturn?: boolean } = {},
) {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    if (i - 1 === jump && !countReturn) continue;
    total += Math.abs(path[i] - path[i - 1]);
  }
  return total;
}

/**
 * Serve every request. options: direction ("down" toward 0 / "up" toward
 * max) for the sweep methods, max cylinder, countReturn (C-SCAN return seek
 * counted as movement; default true).
 */
export function simulate(
  algorithm: string = "fcfs",
  requests: readonly number[] = REQUESTS,
  initialHead = INITIAL_HEAD,
  options: SimulateOptions = {},
): Run {
  if (!(ALGORITHMS as readonly string[]).includes(algorithm))
    throw new RangeError("Unknown algorithm");
  const { direction: startDirection = "down", max = MAX_CYLINDER, countReturn = true } = options;
  let head = initialHead,
    total = 0,
    direction: Direction = startDirection;
  const pending: DiskRequest[] = requests.map((cylinder, i) => ({ id: i + 1, cylinder }));
  const completed: Served[] = [];
  const state = (): DiskState => ({
    head,
    total,
    direction,
    pending: pending.map((r) => ({ ...r })),
    completed: completed.map((r) => ({ ...r })),
  });
  const steps: Step[] = [
    {
      index: 0,
      request: null,
      distance: 0,
      path: [head],
      before: state(),
      state: state(),
      candidates: [],
    },
  ];
  while (pending.length) {
    const before = state();
    const candidates: Candidate[] = pending.map((r) => ({
      ...r,
      distance: Math.abs(r.cylinder - head),
    }));
    if (algorithm === "sstf") candidates.sort((a, b) => a.distance - b.distance || a.id - b.id);
    const choice = pick(algorithm, pending, head, direction, { max })!;
    const request = pending.splice(
      pending.findIndex((r) => r.id === choice.request.id),
      1,
    )[0];
    const distance = pathLength(choice.path, { jump: choice.jump ?? -1, countReturn });
    head = request.cylinder;
    total += distance;
    direction = choice.direction;
    completed.push({ ...request, wait: total });
    steps.push({
      index: steps.length,
      request,
      distance,
      path: choice.path,
      via: choice.path.slice(1, -1),
      jump: choice.jump ?? -1,
      before,
      state: state(),
      candidates,
    });
  }
  return {
    algorithm: algorithm as Algorithm,
    steps,
    total,
    order: completed.map((r) => r.cylinder),
    waits: completed.map((r) => ({ id: r.id, cylinder: r.cylinder, wait: r.wait })),
  };
}

/** A head position for the route graph: [cylinder, k] (+ "return" while a C-SCAN return is drawn). */
export type RoutePoint = [number, number] | [number, number, "return"];

/**
 * Head positions for the route graph: [cylinder, k] where k is the step
 * index (fractional for edges passed within a step, spaced by distance).
 */
export function routePoints(steps: Step[], upTo = steps.length - 1): RoutePoint[] {
  const points: RoutePoint[] = [[steps[0].state.head, 0]];
  for (const step of steps.slice(1, upTo + 1)) {
    const path = step.path ?? [step.before.head, step.state.head];
    const legs = path.slice(1).map((c, i) => Math.abs(c - path[i]));
    const length = legs.reduce((a, b) => a + b, 0) || 1;
    let run = 0;
    for (let i = 1; i < path.length; i++) {
      run += legs[i - 1];
      points.push([path[i], i === path.length - 1 ? step.index : step.index - 1 + run / length]);
    }
  }
  return points;
}

/**
 * Longest wait of a request at `cylinder` when requests keep arriving and it
 * arrives just after the head passed it (head moves 1 cylinder per unit).
 * SCAN: the head goes to the far edge and back: 2·max(c, max − c).
 * C-SCAN: one full cycle wherever c is: max (+ max for the return if counted).
 */
export function worstWait(
  algorithm: string,
  cylinder: number,
  { max = MAX_CYLINDER, countReturn = true }: { max?: number; countReturn?: boolean } = {},
) {
  if (algorithm === "scan") return 2 * Math.max(cylinder, max - cylinder);
  if (algorithm === "cscan") return countReturn ? 2 * max : max;
  throw new RangeError("worstWait: scan or cscan");
}

/**
 * LOOK: sweep in one direction to the farthest request, then reverse.
 */
export function look(
  requests: readonly number[] = REQUESTS,
  initialHead = INITIAL_HEAD,
  direction: Direction = "down",
) {
  const run = simulate("look", requests, initialHead, { direction });
  return { order: run.order, total: run.total };
}

/**
 * SCAN: like LOOK, but the head runs on to the disk edge (cylinder 0 or
 * `max`) before reversing.
 */
export function scan(
  requests: readonly number[] = REQUESTS,
  initialHead = INITIAL_HEAD,
  direction: Direction = "down",
  max = MAX_CYLINDER,
) {
  const run = simulate("scan", requests, initialHead, { direction, max });
  return { order: run.order, total: run.total };
}

/**
 * The shortest total head movement that serves a batch on a line: go first to
 * the nearer of the two extreme requests, then sweep to the other one (no
 * disk edge needed). Any order is at least this long (every request between
 * the extremes is passed on the way).
 */
export function shortestTotal(requests: readonly number[], head: number) {
  if (!requests.length) return 0;
  const lo = Math.min(head, ...requests);
  const hi = Math.max(head, ...requests);
  return hi - lo + Math.min(head - lo, hi - head);
}

/** Requests still pending that the head passes over (strictly between) during a step. */
export function passedOver(step: Step) {
  if (!step.request) return [];
  const legs = step.path.slice(1).map((c, i) => [step.path[i], c] as const);
  return step.before.pending.filter(
    (r) =>
      r.id !== step.request!.id &&
      legs.some(
        ([a, b], i) =>
          i !== step.jump && r.cylinder > Math.min(a, b) && r.cylinder < Math.max(a, b),
      ),
  );
}

/** Scale ticks for cylinders 0–max: about five, at round steps, ending at max. */
export function ticksFor(max: number): number[] {
  const raw = max / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => s >= raw * 0.85) ?? 10 * p;
  const out: number[] = [];
  for (let c = 0; c < max - step * 0.45; c += step) out.push(Math.round(c));
  out.push(max);
  return out;
}
