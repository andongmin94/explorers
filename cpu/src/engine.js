/** One CPU, independent I/O waits and zero scheduling overhead. All times are ms. */
export const DEFAULT_PROCESSES = [
  { id: "P1", name: "문서 미리보기", arrival: 0, cpu: [5, 3], io: [4] },
  { id: "P2", name: "파일 검색", arrival: 1, cpu: [2, 2], io: [3] },
  { id: "P3", name: "수식 계산", arrival: 2, cpu: [4], io: [] },
];

const sum = (values) => values.reduce((total, value) => total + value, 0);

/**
 * A frame at t is the state after boundary events and before executing [t, t+1).
 * At a shared boundary, arrivals / I/O returns enter in input order before the
 * expired process rejoins the tail. Finishing a burst takes precedence over an
 * expiring quantum. FCFS keeps the CPU until a burst finishes.
 */
export function simulate({
  algorithm = "rr",
  quantum = 2,
  processes = DEFAULT_PROCESSES,
} = {}) {
  if (!["rr", "fcfs"].includes(algorithm)) {
    throw new RangeError("algorithm must be rr or fcfs");
  }
  if (!Number.isInteger(quantum) || quantum < 1) {
    throw new RangeError("quantum must be a positive integer");
  }
  const definitions = processes.map((process) => ({
    ...process,
    cpu: [...process.cpu],
    io: [...process.io],
  }));
  const ids = new Set();
  for (const process of definitions) {
    if (
      ids.has(process.id) ||
      !Number.isInteger(process.arrival) ||
      process.arrival < 0 ||
      !process.cpu.length ||
      process.io.length !== process.cpu.length - 1 ||
      [...process.cpu, ...process.io].some(
        (time) => !Number.isInteger(time) || time < 1,
      )
    ) {
      throw new RangeError(
        "processes need unique ids, nonnegative integer arrivals and positive alternating CPU/I/O bursts",
      );
    }
    ids.add(process.id);
  }
  const jobs = definitions.map((process) => ({
    ...process,
    status: "new",
    burst: 0,
    burstRemaining: process.cpu[0],
    cpuRemaining: sum(process.cpu),
    cpuDone: 0,
    readyWait: 0,
    until: null,
    firstRun: null,
    finishedAt: null,
  }));
  const ready = [];
  const completed = [];
  const frames = [];
  const segments = [];
  const ioSegments = [];
  const decisions = [];
  let running = null;
  let quantumLeft = null;
  let segment = null;
  let lastDispatchedId = null;
  let contextSwitches = 0;
  let busy = 0;
  let idle = 0;
  let t = 0;

  const finishSegment = (reason) => {
    segments.push({ ...segment, end: t, reason });
    segment = null;
  };

  for (;;) {
    const events = [];
    let expired = null;
    let cause = t === 0 ? "start" : "idle";

    if (running && running.burstRemaining === 0) {
      if (running.burst < running.cpu.length - 1) {
        const duration = running.io[running.burst];
        running.status = "blocked";
        running.until = t + duration;
        running.burst += 1;
        running.burstRemaining = running.cpu[running.burst];
        ioSegments.push({ id: running.id, start: t, end: running.until });
        events.push({
          type: "block",
          id: running.id,
          from: "running",
          to: "blocked",
          duration,
          until: running.until,
        });
        cause = "block";
      } else {
        running.status = "done";
        running.finishedAt = t;
        completed.push(running.id);
        events.push({
          type: "complete",
          id: running.id,
          from: "running",
          to: "done",
        });
        cause = "complete";
      }
      finishSegment(cause);
      running = null;
      quantumLeft = null;
    } else if (running && algorithm === "rr" && quantumLeft === 0) {
      expired = running;
      finishSegment("quantum");
      running = null;
      quantumLeft = null;
      cause = "quantum";
    }

    // Stable input order resolves simultaneous arrivals and I/O completions.
    for (const job of jobs) {
      if (job.status === "new" && job.arrival === t) {
        job.status = "ready";
        ready.push(job);
        events.push({ type: "arrive", id: job.id, from: "new", to: "ready" });
      } else if (job.status === "blocked" && job.until === t) {
        job.status = "ready";
        job.until = null;
        ready.push(job);
        events.push({
          type: "unblock",
          id: job.id,
          from: "blocked",
          to: "ready",
        });
      }
    }
    if (expired) {
      expired.status = "ready";
      ready.push(expired);
      events.push({
        type: "preempt",
        id: expired.id,
        from: "running",
        to: "ready",
      });
    }

    if (!running && ready.length) {
      if (segment) finishSegment("idle");
      const candidates = ready.map((job) => job.id);
      running = ready.shift();
      running.status = "running";
      running.firstRun ??= t;
      quantumLeft = algorithm === "rr" ? quantum : null;
      segment = { id: running.id, start: t };
      // Counts changes between actual jobs, excluding initial/self dispatch and idle.
      if (lastDispatchedId !== null && lastDispatchedId !== running.id)
        contextSwitches += 1;
      lastDispatchedId = running.id;
      decisions.push({ time: t, candidates, chosen: running.id, cause });
      events.push({
        type: "dispatch",
        id: running.id,
        from: "ready",
        to: "running",
        candidates,
        cause,
      });
    }
    if (!running && completed.length < jobs.length && !segment) {
      segment = { id: null, start: t };
      const nextWake = Math.min(
        ...jobs.flatMap((job) =>
          job.status === "new"
            ? [job.arrival]
            : job.status === "blocked"
              ? [job.until]
              : [],
        ),
      );
      events.push({ type: "idle", until: nextWake });
    }

    frames.push({
      t,
      running: running?.id ?? null,
      ready: ready.map((job) => job.id),
      blocked: jobs
        .filter((job) => job.status === "blocked")
        .map((job) => ({
          id: job.id,
          remaining: job.until - t,
          until: job.until,
        })),
      completed: [...completed],
      quantumLeft,
      states: Object.fromEntries(
        jobs.map((job) => [
          job.id,
          {
            status: job.status,
            cpuRemaining: job.cpuRemaining,
            burstRemaining: job.burstRemaining,
            cpuDone: job.cpuDone,
            readyWait: job.readyWait,
            ioRemaining: job.status === "blocked" ? job.until - t : 0,
            firstRun: job.firstRun,
            finishedAt: job.finishedAt,
          },
        ]),
      ),
      events,
    });
    if (completed.length === jobs.length) break;

    for (const job of ready) job.readyWait += 1;
    if (running) {
      running.cpuRemaining -= 1;
      running.burstRemaining -= 1;
      running.cpuDone += 1;
      if (algorithm === "rr") quantumLeft -= 1;
      busy += 1;
    } else {
      idle += 1;
    }
    t += 1;
  }

  const perProcess = jobs.map((job) => ({
    id: job.id,
    arrival: job.arrival,
    cpu: sum(job.cpu),
    io: sum(job.io),
    firstRun: job.firstRun,
    completion: job.finishedAt,
    response: job.firstRun - job.arrival,
    waiting: job.readyWait,
    turnaround: job.finishedAt - job.arrival,
  }));
  const average = (key) =>
    perProcess.length
      ? perProcess.reduce((total, process) => total + process[key], 0) /
        perProcess.length
      : 0;
  return {
    algorithm,
    quantum,
    processes: definitions,
    frames,
    segments,
    ioSegments,
    decisions,
    stats: {
      makespan: t,
      busy,
      idle,
      utilization: t ? (busy / t) * 100 : 0,
      contextSwitches,
      averageWaiting: average("waiting"),
      averageResponse: average("response"),
      averageTurnaround: average("turnaround"),
      perProcess,
    },
  };
}
