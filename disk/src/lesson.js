// Lesson text for the disk scheduling explorer. main.js decides when each
// sentence shows; this file only words it. Nothing here may state a result
// (a total, where 183 ends up) before the step that produces it.
import { josa } from "../../shared/josa.js";

export { josa };
const eun = (w) => josa(w, "은/는");
const eul = (w) => josa(w, "을/를");

export const NAMES = { fcfs: "FCFS", sstf: "SSTF" };
export const RULE_SHORT = { fcfs: "도착 순서", sstf: "가까운 순서" };
export const RULES = {
  fcfs: "도착한 순서를 지킵니다. 헤드에서 멀리 있어도 먼저 들어온 요청을 먼저 처리합니다.",
  sstf: "현재 헤드에서 거리가 가장 짧은 요청을 고릅니다. 한 요청을 마칠 때마다 거리를 다시 비교합니다.",
};
export const GOAL = "학습 목표: 다음 요청을 고르는 기준이 이동 거리와 먼 요청의 차례를 어떻게 바꾸는지 설명한다.";

// Who does what: the OS scheduler picks from the queue, the controller
// carries the chosen request out on the drive.
export const STAGES = [
  { kind: "select", label: "OS가 큐에서 선택" },
  { kind: "controller", label: "컨트롤러가 받아 실행" },
  { kind: "seek", label: "헤드 이동" },
  { kind: "arrive", label: "도착·합산" },
];

/** Position (1-based) in which the request at `cylinder` is served. */
export const servicePosition = (run, cylinder) => run.order.indexOf(cylinder) + 1;

const moveSign = (step) => Math.sign(step.state.head - step.before.head);

/**
 * 핵심 장면: the guided stops and the 장면 tab. `label` names what happened
 * (shown once reached); `preview` says only where it is (shown before).
 */
export function milestonesFor(algorithm, run) {
  const last = run.steps.length - 1;
  const items = [
    { n: 0, label: "시작 · 헤드 53, 요청 8개" },
    { n: 1, label: "첫 선택" },
  ];
  if (algorithm === "sstf") {
    const close = run.steps.find((s) => s.index > 1 && s.candidates[1] && s.candidates[1].distance - s.distance <= 2);
    if (close) {
      const prev = run.steps[close.index - 1];
      const flips = moveSign(close) !== moveSign(prev);
      items.push({ n: close.index, label: `${close.distance} vs ${close.candidates[1].distance} · 근소한 차이로 ${flips ? "반대 방향" : "같은 방향"}`, preview: "거리 비교" });
    }
    const back = run.steps.slice(1).reduce((a, b) => (b.distance > a.distance ? b : a));
    items.push({ n: back.index, label: `${back.before.head} → ${back.state.head} · ${back.distance}칸 되돌아가기`, preview: "큰 이동" });
  } else {
    items.push({ n: 3, label: "방향 변화", preview: "세 번째 선택" });
  }
  items.push({ n: last, label: "결과 · 전체 이동 거리" });
  return items.sort((a, b) => a.n - b.n).map((m) => ({ ...m, preview: m.preview ?? m.label }));
}

/** Where "핵심 장면에서 멈추기" pauses playback: every 핵심 장면 after the start. */
export const guidedStops = (algorithm, run) => milestonesFor(algorithm, run).map((m) => m.n).filter((n) => n > 0);

/** The concrete starvation picture: where the far request 183 ends up. */
export function starvationNote(runs, cylinder = 183) {
  const f = servicePosition(runs.fcfs, cylinder);
  const s = servicePosition(runs.sstf, cylinder);
  return `${cylinder}번 요청은 FCFS에서 ${f}번째, SSTF에서 ${s}번째${s === runs.sstf.order.length ? "(마지막)" : ""}로 처리됩니다. 65 근처에 요청이 계속 들어오면 ${eun(cylinder)} 계속 밀립니다.`;
}

/**
 * The 핵심 note for the step just committed. It changes per step and only
 * names what has already happened: totals appear at the last step, the
 * starvation of 183 once it is the only request left.
 */
export function takeawayAt(algorithm, index, runs, far = 183) {
  const run = runs[algorithm];
  const n = run.steps.length - 1;
  const step = run.steps[index];
  const prev = run.steps[index - 1];
  if (algorithm === "fcfs") {
    if (index === 0) return "FCFS는 거리를 보지 않습니다. 대기 큐의 도착 순서가 곧 처리 순서입니다.";
    if (index === n) return `FCFS 합계 ${step.state.total}칸. 순서는 공정하지만 헤드가 바깥쪽과 안쪽을 크게 오갔습니다.`;
    if (step.request.cylinder === far)
      return `가장 먼 ${far}번도 도착 순서대로 ${index}번째에 처리됩니다. FCFS에서는 뒤에 온 요청이 앞지르지 못합니다.`;
    if (index > 1 && moveSign(step) !== moveSign(prev))
      return `방향을 바꿔 ${step.distance}칸을 되돌아갑니다. FCFS는 왕복을 줄이지 않습니다.`;
    if (nearerThanChosen(step)) return `도착 순서를 지키는 대가로 이번에 ${step.distance}칸을 움직였습니다.`;
    return "이번에는 도착 순서와 가까운 순서가 일치했습니다.";
  }
  if (index === 0) return "SSTF는 요청을 마칠 때마다 현재 헤드에서 거리를 다시 잽니다. 도착 순서는 거리가 같을 때만 봅니다.";
  if (index === n) return `SSTF 합계 ${step.state.total}칸. ${starvationNote(runs, far)}`;
  const runnerUp = step.candidates[1];
  if (index > 1 && runnerUp && runnerUp.distance - step.distance <= 2 && moveSign(step) !== moveSign(prev))
    return `${step.distance}칸 대 ${runnerUp.distance}칸, ${runnerUp.distance - step.distance}칸 차이로 방향이 바뀌었습니다. SSTF는 지금 위치만 보고 고릅니다.`;
  const longest = run.steps.slice(1).reduce((a, b) => (b.distance > a.distance ? b : a));
  if (step === longest)
    return `한쪽을 다 처리한 뒤에야 ${step.distance}칸을 되돌아갑니다. 가까운 것만 고르면 큰 이동은 뒤로 미뤄집니다.`;
  const left = step.state.pending;
  if (left.length === 1 && left[0].cylinder === far)
    return `남은 요청은 가장 먼 ${far}번뿐입니다. ${index}개가 처리되는 동안 계속 기다렸습니다.`;
  return `${index}개를 처리하는 동안 가장 먼 ${far}번은 아직 대기 중입니다. 더 가까운 요청이 먼저 뽑힙니다.`;
}

export const MODEL_NOTES = [
  "실린더 0–199, 처음 헤드 53, 요청 8개가 모두 시작 전에 도착한 고정 예제입니다. 실린더 0이 가장 바깥쪽, 199가 가장 안쪽입니다.",
  "이동 거리는 실린더 번호 차이입니다. 1칸 = 실린더 1개 차이, CYL = 실린더. 회전 대기·전송 시간·실제 탐색 시간은 계산하지 않습니다.",
  "다음 요청은 OS의 스케줄러가 큐에서 고르고, 컨트롤러는 고른 요청을 받아 헤드를 움직인다고 가정합니다.",
  "실제 드라이브는 여러 요청을 한꺼번에 받아 내부에서 다시 정렬하기도 합니다(NCQ, 회전까지 고려하는 SPTF · OSTEP 37.5). 여기서는 OS가 하나씩 골라 보내는 경우만 봅니다.",
  "헤드가 움직이는 HDD 모델입니다. SSD에는 같은 기계적 탐색이 없습니다.",
  "실제 OS는 디스크의 기하 구조를 정확히 모르므로 가장 가까운 블록 번호로 근사합니다(OSTEP 37장). SSTF는 회전 지연도 무시합니다.",
  "SSTF의 거리가 같으면 먼저 도착한 요청을 선택합니다.",
  "팔의 움직임은 위치 관계를 보여 주는 투영도이며 실제 부품의 치수나 지연 측정값이 아닙니다.",
];

const direction = (step) =>
  !step.distance ? "" : step.state.head > step.before.head ? "안쪽 " : "바깥쪽 ";

function arrivalTitle(step, algorithm) {
  const runnerUp = algorithm === "sstf" && step.candidates[1];
  if (runnerUp)
    return `${step.state.head}번 도착 · ${step.distance}칸 (비교한 ${eun(`${runnerUp.cylinder}번`)} ${runnerUp.distance}칸)`;
  return `${step.before.head} → ${step.state.head} · ${step.distance}칸 이동 완료`;
}

/** The nearest other request at the moment a FCFS choice was made, if any is nearer. */
export function nearerThanChosen(step) {
  const others = step.candidates.filter((c) => c.id !== step.request.id);
  const nearest = others.reduce((a, b) => (b.distance < a.distance ? b : a), others[0]);
  return nearest && nearest.distance < step.distance ? nearest : null;
}

/** Status line + explanation for one stage of one request. */
export function phaseText(kind, step, algorithm) {
  const r = step.request;
  if (kind === "idle")
    return {
      title: algorithm === "sstf" ? `SSTF · 헤드 ${step.state.head}에서 가장 가까운 요청부터` : "FCFS · 먼저 도착한 요청부터",
      body: "",
    };
  if (kind === "done") return { title: arrivalTitle(step, algorithm), body: "" };
  if (kind === "select") {
    const runnerUp = algorithm === "sstf" ? step.candidates[1] : null;
    return {
      title:
        algorithm === "sstf"
          ? `헤드 ${step.before.head} 기준 · 가장 가까운 ${r.cylinder}번 선택`
          : `요청 ${r.id}번 · ${r.cylinder}번 실린더 선택`,
      body:
        algorithm === "fcfs"
          ? "OS 스케줄러가 남은 요청 중 먼저 도착한 요청을 큐에서 고릅니다. 가까운 위치인지는 선택 기준이 아닙니다."
          : `OS 스케줄러가 현재 헤드 ${step.before.head}에서 가장 가까운 요청을 고릅니다. 거리는 |${r.cylinder} − ${step.before.head}| = ${step.distance}입니다.${runnerUp ? ` 다음 후보 ${eun(`${runnerUp.cylinder}번`)} ${runnerUp.distance}칸입니다.` : ""}`,
    };
  }
  if (kind === "controller")
    return {
      title: `요청 ${r.id}번 → 컨트롤러`,
      body: "컨트롤러는 고른 요청을 받아 실행할 뿐입니다. 요청이 도착하면 헤드를 움직입니다.",
    };
  if (kind === "seek")
    return {
      title: `${step.before.head} → ${r.cylinder} · ${direction(step)}${step.distance}칸 이동 중`,
      body: `선택한 실린더로 헤드를 옮깁니다. 이번 이동 ${step.distance}칸은 도착 후 누적 이동에 더합니다.`,
    };
  return {
    title: arrivalTitle(step, algorithm),
    body: `|${r.cylinder} − ${step.before.head}| = ${step.distance}칸. ${step.before.total} + ${step.distance} = ${step.state.total}칸으로 누적됩니다.`,
  };
}

/** Eyebrow, title and body of the lesson panel when no request is moving. */
export function lessonAt(algorithm, index, step) {
  const state = step.state;
  const last = state.pending.length === 0 && index > 0;
  if (index === 0)
    return {
      eyebrow: "대표 시나리오",
      title: "어떤 순서가 덜 움직일까?",
      body: `헤드는 53번 실린더, 요청 8개는 대기 큐에 있습니다. 같은 요청도 무엇을 먼저 고르느냐에 따라 이동 거리가 달라집니다. ${NAMES[algorithm]}: ${RULE_SHORT[algorithm]}.`,
      goal: GOAL,
    };
  if (last)
    return {
      eyebrow: "모두 완료",
      title: `모든 요청 완료 · ${state.total}칸`,
      body: `${algorithm === "fcfs" ? "도착 순서" : "현재 위치에서 가까운 순서"}로 8개 요청을 모두 처리했습니다. 이동 거리는 ${state.total}칸입니다.`,
    };
  const nearer = algorithm === "fcfs" ? nearerThanChosen(step) : null;
  return {
    eyebrow: `${index}번째 요청`,
    title: `${step.before.head} → ${state.head}, ${step.distance}칸 이동`,
    body:
      algorithm === "fcfs"
        ? `${eun(`요청 ${step.request.id}번`)} 남은 요청 중 가장 먼저 도착했습니다. ${
            nearer
              ? `더 가까운 ${nearer.cylinder}번(${nearer.distance}칸)이 있어도 도착 순서를 따릅니다.`
              : "마침 남은 요청 중 가장 가깝기도 합니다."
          }`
        : `직전 헤드 ${step.before.head}에서 가장 가까운 요청이 ${state.head}번이었습니다. 다음 선택은 새 위치 ${eul(state.head)} 기준으로 합니다.`,
  };
}

/**
 * The prediction for the step about to be played. The scene is behind the
 * dialog, so the prompt carries what the learner needs.
 * - SSTF: "which cylinder next?" — choices are cylinders only.
 * - FCFS: picking the next cylinder is trivial once the queue is listed, so it
 *   asks "how long is the next move?" — choices are the distances to every
 *   pending request; the nearest one is the SSTF misconception.
 * Every choice carries `why`: why it is right, or the misconception behind it.
 */
export function predictionFor(algorithm, run, index) {
  const step = run.steps[index];
  const head = step.before.head;
  const answer = step.request;
  const pending = step.before.pending.map((r) => ({ ...r, distance: Math.abs(r.cylinder - head) }));
  const nearest = pending.reduce((a, b) => (b.distance < a.distance || (b.distance === a.distance && b.id < a.id) ? b : a));
  const right = pending.find((r) => r.id === answer.id);
  if (algorithm === "fcfs") {
    const queue = pending.map((r) => r.cylinder).join(" · ");
    const byDistance = new Map();
    for (const r of pending) byDistance.set(r.distance, [...(byDistance.get(r.distance) ?? []), r]);
    const choices = [...byDistance.entries()]
      .sort((x, y) => x[0] - y[0])
      .map(([d, rs]) => {
        const correct = rs.some((r) => r.id === answer.id);
        const names = rs.map((r) => `${r.cylinder}번`).join("·");
        let why;
        if (correct)
          why = `FCFS는 큐 맨 앞의 ${right.cylinder}번으로 갑니다: |${right.cylinder} − ${head}| = ${d}칸.${nearest.id === right.id ? " 마침 가장 가까운 요청이기도 합니다." : " 더 가까운 요청이 있어도 도착 순서를 따릅니다."}`;
        else if (rs.includes(nearest))
          why = `${d}칸은 가장 가까운 ${names}까지의 거리입니다. 가까운 순서로 고르는 것은 SSTF의 기준입니다.`;
        else {
          const pos = pending.indexOf(rs[0]) + 1;
          why = `${d}칸은 ${names}까지의 거리입니다. ${eun(`${rs[0].cylinder}번`)} 큐에서 ${pos}번째라 아직 차례가 아닙니다.`;
        }
        return { id: d, label: `${d}칸`, answer: `${d}칸`, correct, why };
      });
    return {
      question: "FCFS의 다음 이동은 몇 칸일까요?",
      prompt: `헤드 ${head}. 대기 큐(도착 순서): ${queue}. FCFS가 고를 요청을 정하고 거리를 계산하세요.`,
      choices,
    };
  }
  const prev = run.steps[index - 1];
  const sign = index > 1 ? moveSign(prev) : 0;
  const ahead = sign
    ? pending.filter((r) => Math.sign(r.cylinder - head) === sign).reduce((a, b) => (!a || b.distance < a.distance ? b : a), null)
    : null;
  const first = pending.reduce((a, b) => (b.id < a.id ? b : a));
  const why = (r) => {
    if (r.id === answer.id) {
      const close = pending.filter((o) => o.id !== r.id && o.distance - r.distance <= 2);
      return `헤드 ${head}에서 ${r.distance}칸으로 가장 가깝습니다.${close.length ? ` ${close[0].cylinder}번(${close[0].distance}칸)과는 ${close[0].distance - r.distance}칸 차이입니다.` : ""}`;
    }
    if (ahead && r.id === ahead.id)
      return `진행 방향을 유지하는 것은 SCAN/LOOK의 생각입니다. SSTF는 방향과 상관없이 ${right.distance}칸인 ${eul(`${right.cylinder}번`)} 고릅니다(${eun(`${r.cylinder}번`)} ${r.distance}칸).`;
    if (r.id === first.id)
      return `먼저 도착한 요청을 고르는 것은 FCFS입니다. SSTF는 거리를 잽니다: ${eun(`${r.cylinder}번`)} ${r.distance}칸, ${eun(`${right.cylinder}번`)} ${right.distance}칸.`;
    return `${eun(`${r.cylinder}번`)} ${r.distance}칸입니다. 가장 가까운 ${eun(`${right.cylinder}번`)} ${right.distance}칸입니다.`;
  };
  return {
    question: "다음에 어느 실린더로 갈까요?",
    prompt: `헤드 ${head}에서 각 실린더까지 거리를 직접 계산해 고르세요. 버튼은 실린더 번호 순서입니다.`,
    choices: pending
      .slice()
      .sort((a, b) => a.cylinder - b.cylinder || a.id - b.id)
      .map((r) => ({ id: r.id, label: String(r.cylinder), answer: `${r.cylinder}번`, correct: r.id === answer.id, why: why(r) })),
  };
}

/** The comparison dialog's foot: the fork, then where SSTF stands (LOOK/SCAN). */
export function compareNote(runs, sweep, scanTotal) {
  const f = runs.fcfs.steps[1];
  const s = runs.sstf.steps[1];
  return `갈림길은 첫 선택입니다. FCFS는 먼저 도착한 ${f.request.cylinder}번(${f.distance}칸), SSTF는 가까운 ${s.request.cylinder}번(${s.distance}칸)으로 갑니다. SSTF는 FCFS보다 ${runs.fcfs.total - runs.sstf.total}칸 덜 움직이지만 최소는 아닙니다. 끝 요청에서 바로 돌아오는 LOOK은 ${sweep.total}칸(0까지 가는 SCAN은 ${scanTotal}칸). SCAN 계열의 핵심은 한 방향으로 쓸어 기아를 막는 것입니다.`;
}

export const COMPARE_STORY = {
  fcfs: "먼 요청과 가까운 요청을 도착 순서대로 오가며 크게 왕복합니다.",
  sstf: "현재 위치에서 가까운 요청을 고르며 이 요청 묶음의 이동을 줄입니다.",
};

/** Further study after the recap: the sweep idea, with its source. */
export const FURTHER = {
  text: "더 볼 거리: SCAN·LOOK(엘리베이터) — 한 방향으로 끝까지 쓸고 돌아와 먼 요청도 차례를 보장합니다.",
  href: "https://pages.cs.wisc.edu/~remzi/OSTEP/file-disks.pdf",
  source: "OSTEP 37.5 ↗",
};

const RECALL = {
  fcfsFirst: {
    id: "fcfs-first",
    question: "헤드 50. 요청이 90, 45, 10 순서로 도착했습니다. FCFS가 처음 처리하는 요청은?",
    choices: [
      { label: "10", why: "10은 마지막에 도착했습니다. FCFS는 도착 순서 그대로 처리합니다." },
      { label: "45", why: "가장 가까운 요청(5칸)을 고르는 것은 SSTF의 기준입니다." },
      { label: "90", correct: true, why: "가장 먼저 도착한 요청입니다. 40칸 떨어져 있어도 FCFS는 거리를 보지 않습니다." },
    ],
  },
  sstfFirst: {
    id: "sstf-first",
    question: "헤드 50. 요청이 90, 45, 10 순서로 도착했습니다. SSTF가 처음 처리하는 요청은?",
    choices: [
      { label: "10", why: "10은 40칸입니다. 바깥쪽 끝부터 쓰는 것은 SCAN의 방향 규칙이지 SSTF가 아닙니다." },
      { label: "45", correct: true, why: "5칸으로 가장 가깝습니다. 45에 도착하면 거기서 다시 거리를 잽니다." },
      { label: "90", why: "먼저 도착한 요청을 고르는 것은 FCFS입니다. 90은 40칸 떨어져 있습니다." },
    ],
  },
  starve: {
    id: "sstf-starve",
    question: "헤드 근처에 새 요청이 계속 들어온다면 SSTF에서는 어떤 일이 생길 수 있을까요?",
    choices: [
      { label: "먼 요청이 계속 밀린다", correct: true, why: "가까운 요청이 계속 생기면 먼 요청은 뽑히지 않습니다(기아). 이 예제의 183번도 마지막이었습니다." },
      { label: "모두 도착 순서대로 기다린다", why: "그것은 FCFS입니다. SSTF는 도착 순서를 거리가 같을 때만 봅니다." },
      { label: "이동이 FCFS보다 길어진다", why: "SSTF는 가까운 요청을 골라 보통 이동을 줄입니다. 이 예제에서도 236칸으로 FCFS의 640칸보다 짧았습니다." },
    ],
  },
};
export const RECALL_TOTAL = Object.keys(RECALL).length;

/** The 정리 panel at the end of a run: points and recall questions for that run. */
export function recapFor(algorithm, runs, sweep, scanTotal) {
  if (algorithm === "fcfs")
    return {
      points: [
        `FCFS는 거리를 보지 않고 도착 순서대로 처리합니다. 먼 183번도 ${servicePosition(runs.fcfs, 183)}번째에 차례가 옵니다.`,
        `대가는 왕복입니다. 이 요청 묶음에서 헤드가 ${runs.fcfs.total}칸을 움직였습니다.`,
        "같은 입력을 가까운 순서로 고르면 무엇이 달라지는지 SSTF로 다시 보세요.",
      ],
      recall: [RECALL.fcfsFirst],
    };
  return {
    points: [
      `SSTF는 매번 현재 헤드에서 가장 가까운 요청을 다시 고릅니다. 이 예제에서 ${runs.sstf.total}칸(FCFS ${runs.fcfs.total}칸).`,
      `대가는 먼 요청의 대기입니다. 183번은 FCFS에서 ${servicePosition(runs.fcfs, 183)}번째, SSTF에서 ${servicePosition(runs.sstf, 183)}번째(마지막)였고, 가까운 요청이 계속 오면 계속 밀립니다(기아).`,
      `SSTF도 최소는 아닙니다. LOOK은 ${sweep.total}칸(0까지 가는 SCAN은 ${scanTotal}칸)이며, SCAN 계열은 한 방향으로 쓸어 기아를 막습니다.`,
    ],
    recall: [RECALL.sstfFirst, RECALL.starve],
  };
}
