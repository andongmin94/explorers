// 직접 실험: the learner's own jobs (arrival + alternating CPU / I/O bursts),
// the RR quantum and two methods to compare. Kept in the URL query so a run
// can be shared:
//   ?lesson=custom&jobs=0:5-4-3,1:2-3-2,2:4&q=2&methods=rr,fcfs
// A job is "arrival:cpu-io-cpu…" (odd count: it starts and ends with CPU).
// parseCustom() never throws: a broken query runs the defaults and says why.
import { josa } from "./josa.ts";
import type { Algorithm, ProcessDef } from "./types.ts";

export const MAX_JOBS = 5;
export const MAX_ARRIVAL = 20;
export const MAX_BURST = 9;
/** CPU, I/O, CPU, I/O, CPU at most. */
export const MAX_PHASES = 5;
export const MIN_QUANTUM = 1;
export const MAX_QUANTUM = 5;
export const CUSTOM_METHODS: readonly Algorithm[] = ["rr", "fcfs", "sjf", "srtf"];

export interface CustomJob {
  arrival: number;
  /** Alternating bursts: CPU, I/O, CPU, … (odd length). */
  bursts: number[];
}
export interface CustomConfig {
  jobs: CustomJob[];
  quantum: number;
  methods: [Algorithm, Algorithm];
}

export const DEFAULT_CUSTOM: CustomConfig = {
  jobs: [
    { arrival: 0, bursts: [6] },
    { arrival: 1, bursts: [2, 3, 1] },
    { arrival: 2, bursts: [3] },
    { arrival: 4, bursts: [1, 2, 2] },
  ],
  quantum: 2,
  methods: ["rr", "srtf"],
};

export const PRESETS: { id: string; label: string; config: CustomConfig }[] = [
  {
    id: "lesson01",
    label: "레슨 01 작업",
    config: {
      jobs: [
        { arrival: 0, bursts: [5, 4, 3] },
        { arrival: 1, bursts: [2, 3, 2] },
        { arrival: 2, bursts: [4] },
      ],
      quantum: 2,
      methods: ["rr", "fcfs"],
    },
  },
  {
    id: "convoy",
    label: "호위 효과",
    config: {
      jobs: [
        { arrival: 0, bursts: [9] },
        { arrival: 0, bursts: [1] },
        { arrival: 0, bursts: [2] },
        { arrival: 1, bursts: [1] },
      ],
      quantum: 2,
      methods: ["fcfs", "sjf"],
    },
  },
  {
    id: "preempt",
    label: "짧은 작업 끼어들기",
    config: {
      jobs: [
        { arrival: 0, bursts: [8] },
        { arrival: 1, bursts: [2] },
        { arrival: 3, bursts: [1] },
        { arrival: 5, bursts: [2] },
      ],
      quantum: 3,
      methods: ["sjf", "srtf"],
    },
  },
  {
    id: "io",
    label: "입출력이 잦은 작업",
    config: {
      jobs: [
        { arrival: 0, bursts: [1, 3, 1, 3, 1] },
        { arrival: 0, bursts: [7] },
        { arrival: 2, bursts: [2, 2, 2] },
      ],
      quantum: 1,
      methods: ["rr", "fcfs"],
    },
  },
];

/** The engine's jobs: P1…P5, named 작업 1…5. */
export function processesOf(config: CustomConfig): ProcessDef[] {
  return config.jobs.map((job, i) => ({
    id: `P${i + 1}`,
    name: `작업 ${i + 1}`,
    arrival: job.arrival,
    cpu: job.bursts.filter((_, k) => k % 2 === 0),
    io: job.bursts.filter((_, k) => k % 2 === 1),
  }));
}

/** "5 4 3" → [5, 4, 3]; anything that is not a whole number becomes NaN. */
export function burstsFromText(text: string): number[] {
  const parts = text
    .trim()
    .split(/[\s,·\-→>]+/)
    .filter(Boolean);
  return parts.map((part) => (/^\d+$/.test(part) ? Number(part) : Number.NaN));
}

/** Problems per field, as sentences to show; `all` is every problem. */
export function validateCustom(config: {
  jobs: { arrival: number; bursts: number[] }[];
  quantum: number;
  methods: readonly string[];
}): { all: string[]; jobs: string[][]; quantum: string | null; methods: string | null } {
  const jobs = config.jobs.map((job, i) => {
    const name = `P${i + 1}`;
    const errors: string[] = [];
    if (!Number.isInteger(job.arrival) || job.arrival < 0 || job.arrival > MAX_ARRIVAL)
      errors.push(`${name}의 도착 시각은 0부터 ${MAX_ARRIVAL}까지의 정수여야 합니다.`);
    if (!job.bursts.length) errors.push(`${name}의 CPU 구간을 하나 이상 입력하세요.`);
    else if (job.bursts.some((b) => !Number.isInteger(b) || b < 1 || b > MAX_BURST))
      errors.push(`${name}의 구간 길이는 1부터 ${MAX_BURST}까지의 정수여야 합니다.`);
    else if (job.bursts.length % 2 === 0)
      errors.push(
        `${josa(name, "은")} CPU 구간으로 끝나야 합니다. CPU·입출력·CPU처럼 홀수 개를 입력하세요.`,
      );
    else if (job.bursts.length > MAX_PHASES)
      errors.push(`${name}의 구간은 CPU·입출력을 합쳐 ${MAX_PHASES}개까지입니다.`);
    return errors;
  });
  const quantum =
    !Number.isInteger(config.quantum) ||
    config.quantum < MIN_QUANTUM ||
    config.quantum > MAX_QUANTUM
      ? `시간 할당량은 ${MIN_QUANTUM}부터 ${MAX_QUANTUM} ms까지 고를 수 있습니다.`
      : null;
  const [a, b] = config.methods;
  const methods =
    config.methods.length !== 2 || ![a, b].every((m) => CUSTOM_METHODS.includes(m as Algorithm))
      ? "비교할 방식을 라운드 로빈·FCFS·SJF·SRTF 중에서 두 개 고르세요."
      : a === b
        ? "두 방식이 같습니다. 서로 다른 방식 두 개를 고르세요."
        : null;
  const count =
    config.jobs.length < 1 || config.jobs.length > MAX_JOBS
      ? `작업은 1개부터 ${MAX_JOBS}개까지 만들 수 있습니다.`
      : null;
  const all = [
    ...(count ? [count] : []),
    ...jobs.flat(),
    ...(quantum ? [quantum] : []),
    ...(methods ? [methods] : []),
  ];
  return { all, jobs, quantum, methods };
}

export const jobText = (job: CustomJob) => job.bursts.join(" ");

/** The query string (without "?") for a configuration. */
export function customQuery(config: CustomConfig): string {
  return new URLSearchParams({
    lesson: "custom",
    jobs: config.jobs.map((j) => `${j.arrival}:${j.bursts.join("-")}`).join(","),
    q: String(config.quantum),
    methods: config.methods.join(","),
  }).toString();
}

/** The configuration in a query string, or the defaults with the reasons it was rejected. */
export function parseCustom(search: string): { config: CustomConfig; errors: string[] } {
  const q = new URLSearchParams(search);
  if (!q.has("jobs") && !q.has("q") && !q.has("methods"))
    return { config: DEFAULT_CUSTOM, errors: [] };
  const jobs = (q.get("jobs") ?? "")
    .split(",")
    .filter(Boolean)
    .map((part) => {
      const [arrival, bursts = ""] = part.split(":");
      return {
        arrival: /^\d+$/.test(arrival) ? Number(arrival) : Number.NaN,
        bursts: burstsFromText(bursts.replaceAll("-", " ")),
      };
    });
  const config = {
    jobs,
    quantum: Number(q.get("q") ?? DEFAULT_CUSTOM.quantum),
    methods: (q.get("methods") ?? DEFAULT_CUSTOM.methods.join(",")).split(","),
  };
  const { all } = validateCustom(config);
  if (all.length) return { config: DEFAULT_CUSTOM, errors: all };
  return { config: { ...config, methods: config.methods as [Algorithm, Algorithm] }, errors: [] };
}
