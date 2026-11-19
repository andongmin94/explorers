/** One CPU, independent I/O waits and zero scheduling overhead. All times are ms. */
export const DEFAULT_PROCESSES = [
  { id: "P1", name: "문서 미리보기", arrival: 0, cpu: [5, 3], io: [4] },
  { id: "P2", name: "파일 검색", arrival: 1, cpu: [2, 2], io: [3] },
  { id: "P3", name: "수식 계산", arrival: 2, cpu: [4], io: [] },
];

const sum = (values) => values.reduce((total, value) => total + value, 0);

/**
 * The moment before the first boundary (t = -1): nobody has arrived or been
 * picked yet. The start screen shows it, so the first CPU pick is not given
 * away before the learner starts or predicts it.
 */
export function preFrame(result) {
  return {
    t: -1,
    running: null,
    ready: [],
    blocked: [],
    completed: [],
    quantumLeft: null,
    states: Object.fromEntries(
      result.processes.map((process) => [
        process.id,
        {
          status: "new",
          cpuRemaining: sum(process.cpu),
          burstRemaining: process.cpu[0],
          cpuDone: 0,
          readyWait: 0,
          ioRemaining: 0,
          firstRun: null,
          finishedAt: null,
        },
      ]),
    ),
    events: [],
  };
}

/**
 * A frame at t is the state after boundary events and before executing [t, t+1).
 * At a shared boundary, arrivals / I/O returns enter in input order before the
 * expired process rejoins the tail. Finishing a burst takes precedence over an
 * expiring quantum. FCFS keeps the CPU until a burst finishes.
 *
 * SJF (non-preemptive) and SRTF (preemptive SJF, OSTEP's STCF) pick the ready
 * job with the shortest current CPU burst left; ties go to the job that queued
 * first. SJF runs it until the burst ends. SRTF re-decides whenever a job
 * enters the ready queue: a newcomer with strictly less left preempts the
 * running job; otherwise the running job keeps the CPU (recorded as a "keep"
 * decision). Both assume burst lengths are known in advance (OSTEP 7.4).
 * The ready queue keeps its arrival order (candidates too): the policy scans
 * it for the shortest, so queue position never gives the pick away.
 */
export const ALGORITHMS = ["rr", "fcfs", "sjf", "srtf"];
export const SHORTEST = new Set(["sjf", "srtf"]);

export function simulate({
  algorithm = "rr",
  quantum = 2,
  processes = DEFAULT_PROCESSES,
} = {}) {
  if (!ALGORITHMS.includes(algorithm)) {
    throw new RangeError(`algorithm must be one of ${ALGORITHMS.join(", ")}`);
  }
  const shortest = SHORTEST.has(algorithm);
  // Pick order: queue order for RR/FCFS; shortest burst left, then queue order.
  const ordered = (list) =>
    shortest
      ? list
          .map((job, index) => [job, index])
          .sort((a, b) => a[0].burstRemaining - b[0].burstRemaining || a[1] - b[1])
          .map(([job]) => job)
      : list;
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
    // SRTF: a job that just became ready with less left than the running
    // job's current burst takes the CPU; otherwise the running job keeps it.
    const joined = events.some((event) => event.type === "arrive" || event.type === "unblock");
    if (algorithm === "srtf" && running && joined) {
      const best = ordered(ready)[0];
      if (best.burstRemaining < running.burstRemaining) {
        expired = running;
        finishSegment("preempt");
        running = null;
        cause = "preempt";
      } else {
        decisions.push({
          time: t,
          candidates: [running, ...ready].map((job) => job.id),
          chosen: running.id,
          cause: "keep",
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
      running = ordered(ready)[0];
      ready.splice(ready.indexOf(running), 1);
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
