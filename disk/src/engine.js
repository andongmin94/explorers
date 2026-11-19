export const REQUESTS = Object.freeze([98, 183, 37, 122, 14, 124, 65, 67]);
export const INITIAL_HEAD = 53;
export function simulate(
  algorithm = "fcfs",
  requests = REQUESTS,
  initialHead = INITIAL_HEAD,
) {
  if (!["fcfs", "sstf"].includes(algorithm))
    throw new RangeError("Unknown algorithm");
  let head = initialHead,
    total = 0;
  const pending = requests.map((cylinder, i) => ({ id: i + 1, cylinder }));
  const completed = [];
  const state = () => ({
    head,
    total,
    pending: pending.map((r) => ({ ...r })),
    completed: completed.map((r) => ({ ...r })),
  });
  const steps = [
    {
      index: 0,
      request: null,
      distance: 0,
      before: state(),
      state: state(),
      candidates: [],
    },
  ];
  while (pending.length) {
    const before = state();
    const candidates = pending.map((r) => ({
      ...r,
      distance: Math.abs(r.cylinder - head),
    }));
    if (algorithm === "sstf")
      candidates.sort((a, b) => a.distance - b.distance || a.id - b.id);
    const selected = candidates[0];
    const request = pending.splice(
      pending.findIndex((r) => r.id === selected.id),
      1,
    )[0];
    const distance = Math.abs(request.cylinder - head);
    head = request.cylinder;
    total += distance;
    completed.push(request);
    steps.push({
      index: steps.length,
      request,
      distance,
      before,
      state: state(),
      candidates,
    });
  }
  return { algorithm, steps, total, order: completed.map((r) => r.cylinder) };
}

/**
 * LOOK: sweep in one direction to the farthest request, then reverse. Used
 * only for the comparison note (SSTF is not the minimum even here).
 */
export function look(requests = REQUESTS, initialHead = INITIAL_HEAD, direction = "down") {
  const below = requests.filter((c) => c < initialHead).sort((a, b) => b - a);
  const above = requests.filter((c) => c >= initialHead).sort((a, b) => a - b);
  const order = direction === "down" ? [...below, ...above] : [...above, ...below];
  let head = initialHead,
    total = 0;
  for (const c of order) {
    total += Math.abs(c - head);
    head = c;
  }
  return { order, total };
}

/**
 * SCAN: like LOOK, but the head runs on to the disk edge (cylinder 0 or
 * `max`) before reversing. Used only for the comparison note.
 */
export function scan(requests = REQUESTS, initialHead = INITIAL_HEAD, direction = "down", max = 199) {
  const below = requests.filter((c) => c < initialHead).sort((a, b) => b - a);
  const above = requests.filter((c) => c >= initialHead).sort((a, b) => a - b);
  const [first, second, edge] = direction === "down" ? [below, above, 0] : [above, below, max];
  const order = second.length ? [...first, edge, ...second] : first;
  let head = initialHead,
    total = 0;
  for (const c of order) {
    total += Math.abs(c - head);
    head = c;
  }
  return { order: order.filter((c, i) => !(second.length && i === first.length)), total };
}
