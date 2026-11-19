// Lesson text for the disk scheduling explorer. main.js decides when each
// sentence shows; this file only words it.

export const NAMES = { fcfs: "FCFS", sstf: "SSTF" };
export const RULE_SHORT = { fcfs: "도착 순서", sstf: "가까운 순서" };
export const RULES = {
  fcfs: "도착한 순서를 지킵니다. 헤드에서 멀리 있어도 먼저 들어온 요청을 먼저 처리합니다.",
  sstf: "현재 헤드에서 거리가 가장 짧은 요청을 고릅니다. 한 요청을 마칠 때마다 거리를 다시 비교합니다.",
};

// Who does what: the OS scheduler picks from the queue, the controller
// carries the chosen request out on the drive.
export const STAGES = [
  { kind: "select", label: "OS가 큐에서 선택" },
  { kind: "controller", label: "컨트롤러가 받아 실행" },
  { kind: "seek", label: "헤드 이동" },
  { kind: "arrive", label: "도착·합산" },
];

const JOSA = { "은": "는", "이": "가", "을": "를", "과": "와", "으로": "로" };
// Number words: 1 일, 3 삼, 6 육, 7 칠, 8 팔 and every 0 ending (십, 백, 천, 영) end in a consonant.
const finalOf = (word) => {
  const s = String(word).trim();
  const last = s.at(-1) ?? "";
  if (/[0-9]/.test(last)) {
    if (last === "0") return "ㅇ";
    return { 1: "ㄹ", 3: "ㅁ", 6: "ㄱ", 7: "ㄹ", 8: "ㄹ" }[last] ?? "";
  }
  const code = last.charCodeAt(0) - 0xac00;
  if (code >= 0 && code < 11172) return code % 28 ? String(code % 28) : "";
  return /[lmnr]$/i.test(last) ? "ㄴ" : "";
};

/** `word` followed by the right particle: josa(3, "은") → "3은", josa(2, "은") → "2는". */
export function josa(word, particle) {
  const fin = finalOf(word);
  const pair = Object.entries(JOSA).find(([a, b]) => particle === a || particle === b);
  if (!pair) return `${word}${particle}`;
  const [withFinal, without] = pair;
  // (으)로: a final ㄹ takes 로, like a vowel.
  if (withFinal === "으로") return `${word}${fin && fin !== "ㄹ" && fin !== "8" ? "으로" : "로"}`;
  return `${word}${fin ? withFinal : without}`;
}

/** Position (1-based) in which the request at `cylinder` is served. */
export const servicePosition = (run, cylinder) => run.order.indexOf(cylinder) + 1;

/** Scenes to jump to; SSTF adds the two moments its greedy choice is close or costly. */
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
      const flips = Math.sign(close.state.head - close.before.head) !== Math.sign(prev.state.head - prev.before.head);
      items.push({ n: close.index, label: `${close.distance} vs ${close.candidates[1].distance} · 근소한 차이로 ${flips ? "반대 방향" : "같은 방향"}` });
    }
    const back = run.steps.slice(1).reduce((a, b) => (b.distance > a.distance ? b : a));
    items.push({ n: back.index, label: `${back.before.head} → ${back.state.head} · ${back.distance}칸 되돌아가기` });
  } else {
    items.push({ n: 3, label: "방향 변화" });
  }
  items.push({ n: last, label: "결과 · 전체 이동 거리" });
  return items.sort((a, b) => a.n - b.n);
}

export const TAKEAWAY = {
  fcfs: "FCFS는 순서를 지키지만, 먼 요청 사이를 왕복할 수 있습니다.",
  sstf: "SSTF가 이 예제에서는 덜 움직입니다. 하지만 먼 요청은 계속 뒤로 밀릴 수 있습니다.",
};

/** The concrete starvation picture: where the far request 183 ends up. */
export function starvationNote(runs, cylinder = 183) {
  const f = servicePosition(runs.fcfs, cylinder);
  const s = servicePosition(runs.sstf, cylinder);
  return `${cylinder}번 요청은 FCFS에서 ${f}번째, SSTF에서 ${s}번째${s === runs.sstf.order.length ? "(마지막)" : ""}로 처리됩니다. 65 근처에 요청이 계속 들어오면 ${josa(cylinder, "은")} 계속 밀립니다.`;
}

export const MODEL_NOTES = [
  "실린더 0–199, 처음 헤드 53, 요청 8개가 모두 시작 전에 도착한 고정 예제입니다. 실린더 0이 가장 바깥쪽, 199가 가장 안쪽입니다.",
  "이동 거리는 실린더 번호 차이입니다. 1칸 = 실린더 1개 차이, CYL = 실린더. 회전 대기·전송 시간·실제 탐색 시간은 계산하지 않습니다.",
  "다음 요청은 OS의 스케줄러가 큐에서 고르고, 컨트롤러는 고른 요청을 받아 헤드를 움직인다고 가정합니다.",
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
    return `${step.state.head}번 도착 · ${step.distance}칸 (비교한 ${runnerUp.cylinder}번은 ${runnerUp.distance}칸)`;
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
          : `OS 스케줄러가 현재 헤드 ${step.before.head}에서 가장 가까운 요청을 고릅니다. 거리는 |${r.cylinder} − ${step.before.head}| = ${step.distance}입니다.${runnerUp ? ` 다음 후보 ${runnerUp.cylinder}번은 ${runnerUp.distance}칸입니다.` : ""}`,
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
  if (index === 0)
    return {
      eyebrow: "대표 시나리오",
      title: "어떤 순서가 덜 움직일까?",
      body: `헤드는 53번 실린더에서 시작합니다. 같은 8개 요청도 무엇을 먼저 고르느냐에 따라 이동 거리가 달라집니다. ${RULES[algorithm]}`,
    };
  if (index === 8)
    return {
      eyebrow: "8번째 요청 · 처리 완료",
      title: `모든 요청 완료 · ${state.total}칸`,
      body: `${algorithm === "fcfs" ? "도착 순서" : "현재 위치에서 가까운 순서"}로 8개 요청을 모두 처리했습니다. 이동 거리는 ${state.total}칸입니다.`,
    };
  const nearer = algorithm === "fcfs" ? nearerThanChosen(step) : null;
  return {
    eyebrow: `${index}번째 요청 · 처리 완료`,
    title: `${step.before.head} → ${state.head}, ${step.distance}칸 이동`,
    body:
      algorithm === "fcfs"
        ? `요청 ${step.request.id}번은 남은 요청 중 가장 먼저 도착했습니다. ${
            nearer
              ? `더 가까운 ${nearer.cylinder}번(${nearer.distance}칸)이 있어도 도착 순서를 따릅니다.`
              : "마침 남은 요청 중 가장 가깝기도 합니다."
          }`
        : `직전 헤드 ${step.before.head}에서 가장 가까운 요청이 ${state.head}번이었습니다. 다음 선택은 새 위치 ${josa(state.head, "을")} 기준으로 합니다.`,
  };
}

export const COMPARE_STORY = {
  fcfs: "먼 요청과 가까운 요청을 도착 순서대로 오가며 크게 왕복합니다.",
  sstf: "현재 위치에서 가까운 요청을 고르며 이 요청 묶음의 이동을 줄입니다.",
};
