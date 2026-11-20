// The CPU explorer's lessons, listed in the lesson rail (shared/lesson-rail.js).
// Each lesson is one scenario: its jobs, the two methods it compares, and its
// content (question, 핵심 장면, predictions, comparison, 정리). Lesson 01 uses
// the RR / FCFS content in lesson.js; the others use policy-lesson.js.
// Source: OSTEP ch. 7 (7.3 FIFO, 7.4 SJF, 7.5 STCF, 7.6 RR).
import { DEFAULT_PROCESSES, simulate } from "./engine.js";
import {
  buildMilestones,
  buildPrediction,
  comparisonSummary,
  describeChapter,
  describeIntro,
  quantumSweep,
  recallQuestions,
  recapPoints,
  stepNotes,
  sweepSummary,
} from "./lesson.js";
import * as policy from "./policy-lesson.js";
import { fmt, methodName, waitingLine, waitsLine } from "./policy-lesson.js";
import { josa } from "./josa.js";

/** Method key labels and the stage tag. */
export const METHODS = {
  rr: { label: "라운드 로빈", tag: (q) => `RR · ${q} ms`, cpu: (q) => `LED = 남은 할당량 (${q} ms)`, queue: "FIFO · 1번이 다음 차례" },
  fcfs: { label: "FCFS", tag: () => "FCFS · 비선점", cpu: () => "FCFS · 구간이 끝날 때까지", queue: "FIFO · 1번이 다음 차례" },
  sjf: { label: "SJF", tag: () => "SJF · 비선점", cpu: () => "SJF · 끝날 때까지 실행", queue: "가장 짧은 작업부터" },
  srtf: { label: "SRTF", tag: () => "SRTF · 선점", cpu: () => "SRTF · 더 짧은 작업이 오면 선점", queue: "남은 시간 짧은 작업부터" },
};

const RR_RULES = [
  "CPU는 하나이며 한 번에 한 작업만 실행합니다.",
  "CPU 구간(CPU 버스트)은 입출력 없이 계산하는 구간입니다. 작업은 CPU 구간과 입출력을 번갈아 거칩니다.",
  "선점은 실행 중인 작업에게서 CPU를 거두는 것입니다. 라운드 로빈은 할당량이 끝날 때만 선점합니다.",
  '오해: "도착하면 바로 실행된다", "입출력 복귀가 선점한다". 도착·입출력 복귀는 실행 중인 작업을 선점하지 않고 준비 큐 뒤에 줄을 섭니다.',
  "CPU 구간이 끝나는 시각에 할당량도 끝나면 구간 종료가 우선합니다. 작업은 입출력이나 완료로 갑니다.",
  "같은 시각에는 도착·입출력 복귀를 먼저 큐에 넣고, 할당량이 끝난 작업을 맨 뒤에 넣습니다.",
  "입출력은 CPU와 따로 진행됩니다. 여러 작업의 입출력이 겹칠 수 있습니다.",
  "문맥 교환(작업 전환) 비용은 0 ms로 단순화했습니다.",
  "대기 시간(준비 큐)에 입출력 대기는 포함하지 않습니다. 반환 시간은 완료 시각 − 도착 시각입니다.",
  "FCFS는 긴 CPU 구간이 앞에 서면 짧은 작업들이 줄줄이 기다립니다(호위 효과, convoy effect). 다음 레슨에서 SJF와 비교합니다.",
];

/** Lesson 01: one CPU, three jobs with I/O; RR vs FCFS (content in lesson.js). */
const rrLesson = {
  intro: describeIntro,
  milestones: buildMilestones,
  chapter: describeChapter,
  stepNotes,
  prediction: (result, time) => ({
    ...buildPrediction(result, time),
    readyLabel: "준비 큐 · 앞 → 뒤",
    hint: `실행 중인 작업의 남은 ${result.algorithm === "rr" ? "할당량·구간" : "CPU 구간"}과 규칙을 근거로 준비 큐를 직접 만들어 보세요.`,
  }),
  recapPoints: (result, runs) => recapPoints(result, runs.fcfs),
  recall: (runs) => recallQuestions(runs.rr, runs.fcfs),
  compare(runs, { quantum, processes }) {
    const summary = comparisonSummary(runs.rr, runs.fcfs);
    const sweep = quantumSweep(simulate, processes);
    const mark = (q, value) => (q === quantum ? `<b>${value}</b>` : value);
    return {
      head: summary.response,
      body: `${summary.finish} ${summary.cause}`,
      caveat: summary.caveat,
      extra: sweepSummary(sweep, Math.max(...processes.flatMap((p) => p.cpu)), mark),
    };
  },
  rules: RR_RULES,
};

const job = (id, name, arrival, cpu) => ({ id, name, arrival, cpu: [cpu], io: [] });
const list = (processes) => processes.map((p) => `${josa(p.id, "는")} ${p.cpu[0]} ms`).join(", ");

/* ---------- 02 · SJF vs FCFS ---------- */

const SJF_JOBS = [job("P1", "동영상 변환", 0, 8), job("P2", "메시지 전송", 0, 2), job("P3", "사진 압축", 0, 5)];

const sjfLesson = {
  ...policy,
  intro: (result) => ({
    eyebrow: METHODS[result.algorithm].tag(),
    title: "짧은 작업을 먼저 하면 평균 대기는 얼마나 줄까요?",
    body: `세 작업이 0 ms에 함께 도착해 P1 → P2 → P3 순서로 줄을 섭니다. CPU 시간은 ${list(SJF_JOBS)}이고 입출력은 없습니다. ${
      result.algorithm === "fcfs" ? "FCFS는 줄을 선 순서대로 실행합니다." : "SJF는 CPU 시간이 가장 짧은 작업부터 실행합니다."
    }`,
    goal: "학습 목표: 작업별 대기 시간과 평균 대기를 계산하고, 실행 순서가 평균 대기를 어떻게 바꾸는지 설명합니다.",
    terms: [
      ["대기 시간", "준비 큐에서 CPU를 기다린 시간"],
      ["평균 대기", "세 작업 대기 시간의 평균"],
      ["CPU 시간", "작업이 끝나기까지 필요한 계산 시간"],
    ],
  }),
  chapter: (frame, result) => policy.chapter(frame, result, sjfLesson),
  stepNotes: (frame, result) => policy.stepNotes(frame, result, sjfLesson),
  finishKey: (result) =>
    result.algorithm === "fcfs"
      ? "긴 작업 하나가 맨 앞에 서면 뒤의 모든 작업이 그만큼 기다립니다. 같은 작업을 SJF로 실행해 비교해 보세요."
      : "SJF는 작업 길이를 미리 알아야 쓸 수 있습니다. 같은 작업을 FCFS로 실행해 비교해 보세요.",
  recapPoints(result, { fcfs, sjf }) {
    const waits = fcfs.stats.perProcess.filter((p) => p.waiting > 0);
    return [
      `FCFS: 8 ms짜리 P1이 맨 앞에 서면 ${waits.map((p) => p.id).join("·")}가 ${waits.map((p) => `${p.waiting} ms`).join(", ")}를 기다립니다(호위 효과). 평균 대기 ${fmt(fcfs.stats.averageWaiting)} ms.`,
      `SJF: 짧은 순서(${sjf.segments.map((s) => s.id).join(" → ")})로 실행하면 평균 대기 ${fmt(sjf.stats.averageWaiting)} ms, 평균 반환 ${fmt(sjf.stats.averageTurnaround)} ms(FCFS ${fmt(fcfs.stats.averageTurnaround)} ms)입니다.`,
      "SJF는 각 작업의 CPU 시간을 미리 알아야 합니다. 실제 운영체제는 이를 알 수 없어 과거 실행으로 추정합니다(OSTEP 7.4).",
    ];
  },
  recall: () => [
    {
      id: "convoy",
      question: "FCFS에서 CPU 시간이 긴 작업이 맨 앞에 서면 어떤 일이 생길까요?",
      choices: [
        { label: "뒤의 짧은 작업들이 그 시간만큼 줄줄이 기다린다", correct: true, why: "호위 효과(convoy effect)입니다. 긴 작업의 시간이 뒤 작업 모두의 대기 시간에 더해집니다." },
        { label: "짧은 작업이 긴 작업을 선점한다", why: "FCFS는 비선점입니다. 짧은 작업도 앞 작업이 끝날 때까지 기다립니다." },
        { label: "평균 대기 시간은 실행 순서와 관계없다", why: "CPU 시간의 합은 같아도 누가 먼저 하느냐에 따라 각 작업의 대기 시간이 달라집니다. 이 실험에서도 6 ms와 3 ms로 다릅니다." },
      ],
    },
    {
      id: "sjf-limit",
      question: "실제 운영체제가 SJF를 그대로 쓰기 어려운 이유는 무엇일까요?",
      answer: "CPU 시간을 미리 알 수 없다",
      choices: [
        { label: "문맥 교환이 너무 많아서", why: "SJF는 비선점이라 작업이 끝날 때만 바꿉니다. 이 실험에서도 전환은 FCFS와 같은 2회입니다." },
        { label: "작업의 CPU 시간을 미리 알 수 없어서", correct: true, why: "SJF는 길이를 안다고 가정합니다. 실제로는 과거 CPU 구간으로 다음 길이를 추정할 뿐입니다(OSTEP 7.4)." },
        { label: "평균 대기 시간이 FCFS보다 늘어서", why: "함께 도착한 작업이라면 SJF 순서가 평균 대기를 가장 짧게 만듭니다. 이 실험에서도 6 ms → 3 ms로 줄었습니다." },
      ],
    },
  ],
  compare({ fcfs, sjf }) {
    return {
      head: waitingLine(fcfs, sjf),
      body: `평균 반환 시간은 FCFS ${fmt(fcfs.stats.averageTurnaround)} ms, SJF ${fmt(sjf.stats.averageTurnaround)} ms입니다. 작업별 대기(FCFS→SJF): ${waitsLine(fcfs, sjf)}. 갈림길은 0 ms의 첫 선택입니다. FCFS는 맨 앞의 긴 P1을, SJF는 가장 짧은 P2를 고릅니다.`,
      caveat: `전체 완료 시각은 두 방식 모두 ${fcfs.stats.makespan} ms입니다. 순서만 바뀌었을 뿐 CPU가 한 일의 양은 같습니다. SJF는 CPU 시간을 미리 안다고 가정합니다.`,
    };
  },
  rules: [
    "CPU는 하나이며 한 번에 한 작업만 실행합니다. 이 레슨의 작업은 입출력 없이 CPU만 씁니다.",
    "세 작업 모두 0 ms에 도착하며, 같은 시각에는 P1 → P2 → P3 순서로 줄을 섭니다.",
    "SJF는 준비 큐 전체에서 CPU 시간이 가장 짧은 작업을 고릅니다. 줄의 위치는 상관없습니다. 길이가 같으면 먼저 줄을 선 작업이 우선입니다.",
    "SJF는 각 작업의 CPU 시간을 미리 안다고 가정합니다. 실제 운영체제는 과거 CPU 구간으로 추정합니다(OSTEP 7.4).",
    "대기 시간 = 반환 시간 − CPU 시간 (입출력이 없을 때). 반환 시간 = 완료 시각 − 도착 시각.",
    '오해: "짧은 작업을 먼저 하면 전체가 빨리 끝난다". 전체 완료 시각은 같고, 줄어드는 것은 평균 대기와 평균 반환입니다.',
    "문맥 교환 비용은 0 ms로 단순화했습니다. 출처: OSTEP 7.3 FIFO, 7.4 SJF.",
  ],
};

/* ---------- 03 · SRTF vs SJF ---------- */

const SRTF_JOBS = [job("P1", "백업", 0, 8), job("P2", "알림 처리", 1, 2), job("P3", "검색", 2, 3)];

const srtfLesson = {
  ...policy,
  intro: (result) => ({
    eyebrow: METHODS[result.algorithm].tag(),
    title: "긴 작업을 멈추고 짧은 작업에 CPU를 주면 무엇이 좋아질까요?",
    body: `P1(백업, 8 ms)이 0 ms에 먼저 도착해 실행을 시작합니다. 1 ms에 P2(2 ms), 2 ms에 P3(3 ms)가 뒤따라 도착합니다. ${
      result.algorithm === "sjf"
        ? "SJF는 CPU가 빌 때만 가장 짧은 작업을 고릅니다."
        : "SRTF는 작업이 도착할 때마다 남은 시간을 비교해 다시 고릅니다."
    }`,
    goal: "학습 목표: 선점(SRTF)과 비선점(SJF)을 구분하고, 도착 순간마다 남은 시간을 비교해 누가 CPU를 받을지 판단합니다.",
    terms: [
      ["남은 시간", "작업이 앞으로 더 써야 하는 CPU 시간"],
      ["선점", "실행 중인 작업에게서 CPU를 거둠"],
      ["반환 시간", "도착 → 완료 시각"],
    ],
  }),
  chapter: (frame, result) => policy.chapter(frame, result, srtfLesson),
  stepNotes: (frame, result) => policy.stepNotes(frame, result, srtfLesson),
  finishKey: (result) =>
    result.algorithm === "sjf"
      ? "비선점 SJF에서는 늦게 온 짧은 작업도 긴 작업 뒤에서 기다립니다. SRTF로 실행해 비교해 보세요."
      : "SRTF는 짧은 작업을 바로 끼워 넣어 평균 반환 시간을 줄입니다. SJF와 비교해 보세요.",
  recapPoints(result, { sjf, srtf }) {
    const first = srtf.segments.find((s) => s.reason === "preempt");
    return [
      `SJF는 비선점이라 1 ms에 온 P2(2 ms)도 P1이 끝나는 ${sjf.segments[0].end} ms까지 기다립니다. 평균 대기 ${fmt(sjf.stats.averageWaiting)} ms, 평균 반환 ${fmt(sjf.stats.averageTurnaround)} ms.`,
      `SRTF는 ${first.end} ms에 ${josa(first.id, "을")} 선점해 짧은 작업을 먼저 끝냅니다. 평균 대기 ${fmt(srtf.stats.averageWaiting)} ms, 평균 반환 ${fmt(srtf.stats.averageTurnaround)} ms.`,
      "선점은 새 작업이 남은 시간보다 짧을 때만 일어납니다. 2 ms에 온 P3(3 ms)는 남은 1 ms의 P2를 선점하지 못합니다.",
    ];
  },
  recall: () => [
    {
      id: "nonpreemptive",
      question: "SJF에서 긴 작업이 실행 중일 때 더 짧은 작업이 도착하면 어떻게 될까요?",
      answer: "끝날 때까지 기다린다",
      choices: [
        { label: "곧바로 CPU를 받는다", why: "그것은 선점 방식인 SRTF입니다. SJF는 실행 중인 작업을 멈추지 않습니다." },
        { label: "실행 중인 작업이 끝날 때까지 기다린다", correct: true, why: "SJF는 비선점입니다. CPU가 빌 때 준비 큐에서 가장 짧은 작업을 고릅니다." },
        { label: "할당량이 끝나면 CPU를 받는다", why: "할당량은 라운드 로빈의 개념입니다. SJF에는 할당량이 없습니다." },
      ],
    },
    {
      id: "preempt-rule",
      question: "SRTF에서 새 작업이 도착했을 때 선점이 일어나는 조건은 무엇일까요?",
      answer: "새 작업이 실행 중 작업의 남은 시간보다 짧을 때",
      choices: [
        { label: "새 작업의 CPU 시간이 실행 중 작업의 남은 시간보다 짧을 때", correct: true, why: "SRTF는 남은 시간을 비교합니다. 같거나 길면 실행 중인 작업이 계속합니다." },
        { label: "새 작업이 실행 중 작업의 전체 길이보다 짧을 때", why: "이미 실행한 부분은 비교하지 않습니다. 2 ms에 온 P3(3 ms)는 P2의 전체 2 ms가 아니라 남은 1 ms와 비교됩니다." },
        { label: "새 작업이 도착하면 언제나", why: "더 짧을 때만 선점합니다. 이 실험의 2 ms에서 P3는 P2를 선점하지 못했습니다." },
      ],
    },
  ],
  compare({ sjf, srtf }) {
    const first = srtf.segments.find((s) => s.reason === "preempt");
    const newcomer = srtf.segments.find((s) => s.start === first.end).id;
    return {
      head: waitingLine(sjf, srtf),
      body: `평균 반환 시간은 SJF ${fmt(sjf.stats.averageTurnaround)} ms, SRTF ${fmt(srtf.stats.averageTurnaround)} ms입니다. 작업별 대기(SJF→SRTF): ${waitsLine(sjf, srtf)}. 갈림길은 ${first.end} ms에 ${josa(newcomer, "가")} 도착한 순간입니다. SJF는 ${josa(first.id, "을")} 계속 실행하고, SRTF는 ${josa(first.id, "을")} 선점합니다.`,
      caveat: `선점하면 문맥 교환이 늘어납니다(SJF ${sjf.stats.contextSwitches}회, SRTF ${srtf.stats.contextSwitches}회). 이 모델은 전환 비용을 0 ms로 둡니다. 긴 ${josa(first.id, "은")} 짧은 작업이 계속 오면 오래 밀릴 수 있습니다(기아).`,
    };
  },
  rules: [
    "CPU는 하나이며 한 번에 한 작업만 실행합니다. 이 레슨의 작업은 입출력 없이 CPU만 씁니다.",
    "도착: P1 0 ms, P2 1 ms, P3 2 ms. 준비 큐는 도착 순서로 줄을 서고, 방식이 그중 하나를 고릅니다.",
    "SJF는 CPU가 빌 때만 고릅니다(비선점). SRTF는 작업이 준비 큐에 들어올 때마다 다시 고릅니다(선점).",
    "SRTF는 새 작업의 CPU 시간과 실행 중 작업의 남은 시간을 비교합니다. 새 작업이 더 짧을 때만 선점하고, 같으면 실행 중인 작업이 계속합니다.",
    '오해: "선점되면 처음부터 다시 실행한다". 진행한 만큼은 보존되고 남은 시간만 이어서 실행합니다.',
    "SRTF는 OSTEP의 STCF(Shortest Time-to-Completion First, 7.5)와 같습니다. 두 방식 모두 CPU 시간을 미리 안다고 가정합니다.",
    "문맥 교환 비용은 0 ms로 단순화했습니다.",
  ],
};

/**
 * id, name, sub: the rail. title: the header context. methods: the two
 * methods of the lesson's mode switch (the first is shown first). quantum:
 * the RR quantum at start (only lessons with RR show the slider).
 */
export const LESSONS = [
  {
    id: "rr",
    name: "RR과 FCFS",
    sub: "라운드 로빈 · 응답과 완료",
    title: "하나의 CPU, 세 개의 작업",
    question: "빠른 응답과 빠른 완료는 같은 뜻일까요?",
    methods: ["rr", "fcfs"],
    quantum: 2,
    processes: DEFAULT_PROCESSES,
    content: rrLesson,
  },
  {
    id: "sjf",
    name: "SJF와 FCFS",
    sub: "짧은 작업 먼저 · 호위 효과",
    title: "긴 작업이 맨 앞에 선 줄",
    question: "짧은 작업을 먼저 하면 평균 대기는 얼마나 줄까요?",
    methods: ["fcfs", "sjf"],
    quantum: null,
    processes: SJF_JOBS,
    content: sjfLesson,
  },
  {
    id: "srtf",
    name: "SRTF와 SJF",
    sub: "선점 · 남은 시간 비교",
    title: "실행 중에 도착한 짧은 작업",
    question: "긴 작업을 멈추고 짧은 작업에 CPU를 주면 무엇이 좋아질까요?",
    methods: ["sjf", "srtf"],
    quantum: null,
    processes: SRTF_JOBS,
    content: srtfLesson,
  },
];

/** Both methods of a lesson on the same jobs: { [algorithm]: result }. */
export function lessonRuns(lesson, quantum = lesson.quantum ?? 2) {
  return Object.fromEntries(
    lesson.methods.map((algorithm) => [algorithm, simulate({ algorithm, quantum, processes: lesson.processes })]),
  );
}

export { methodName };
