// Lesson text for the disk scheduling explorer. main.js decides when each
// sentence shows; this file only words it.

export const NAMES = { fcfs: "FCFS", sstf: "SSTF" };
export const RULE_SHORT = { fcfs: "도착 순서", sstf: "가까운 순서" };
export const RULES = {
  fcfs: "도착한 순서를 지킵니다. 헤드에서 멀리 있어도 먼저 들어온 요청을 먼저 처리합니다.",
  sstf: "현재 헤드에서 거리가 가장 짧은 요청을 고릅니다. 한 요청을 마칠 때마다 거리를 다시 비교합니다.",
};

export const STAGES = [
  { kind: "select", label: "선택" },
  { kind: "controller", label: "컨트롤러 전달" },
  { kind: "seek", label: "헤드 이동" },
  { kind: "arrive", label: "도착·합산" },
];

export const MILESTONES = [
  { n: 0, label: "시작 · 헤드 53, 요청 8개" },
  { n: 1, label: "첫 선택" },
  { n: 3, label: "방향 변화" },
  { n: 8, label: "결과 · 전체 이동 거리" },
];

export const TAKEAWAY = {
  fcfs: "FCFS는 순서를 지키지만, 먼 요청 사이를 왕복할 수 있습니다.",
  sstf: "SSTF가 이 예제에서는 덜 움직입니다. 새 요청이 계속 가까이 들어오면 먼 요청이 오래 기다릴 수 있지만, 이 고정 예제에서는 모두 완료됩니다.",
};

export const MODEL_NOTES = [
  "실린더 0–199, 처음 헤드 53, 요청 8개가 모두 시작 전에 도착한 고정 예제입니다.",
  "이동 거리는 실린더 번호 차이입니다. 회전 대기·전송 시간·실제 탐색 시간은 계산하지 않습니다.",
  "헤드가 움직이는 HDD 모델입니다. SSD에는 같은 기계적 탐색이 없습니다.",
  "실제 디스크의 논리 블록 주소와 물리 위치 배치는 단순히 대응하지 않을 수 있습니다.",
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
          : `요청 ${r.id} · ${r.cylinder}번 실린더 선택`,
      body:
        algorithm === "fcfs"
          ? "남은 요청 중 먼저 도착한 요청을 선택합니다. 가까운 위치인지는 선택 기준이 아닙니다."
          : `현재 헤드 ${step.before.head}에서 가장 가까운 요청을 선택합니다. 거리는 |${r.cylinder} − ${step.before.head}| = ${step.distance}입니다.${runnerUp ? ` 다음 후보 ${runnerUp.cylinder}번은 ${runnerUp.distance}칸입니다.` : ""}`,
    };
  }
  if (kind === "controller")
    return {
      title: `요청 ${r.id} → 컨트롤러`,
      body: "선택된 요청이 디스크 컨트롤러에 도착하면 헤드가 움직입니다.",
    };
  if (kind === "seek")
    return {
      title: `${step.before.head} → ${r.cylinder} · ${direction(step)}${step.distance}칸 이동 중`,
      body: `선택한 트랙으로 헤드를 옮깁니다. 이번 이동 ${step.distance}칸은 도착 후 누적 이동에 더합니다.`,
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
      body: `헤드는 53번에서 시작합니다. 같은 8개 요청도 무엇을 먼저 고르느냐에 따라 이동 거리가 달라집니다. ${RULES[algorithm]}`,
    };
  if (index === 8)
    return {
      eyebrow: "8번째 요청 · 처리 완료",
      title: `모든 요청 완료 · ${state.total}칸`,
      body: `${algorithm === "fcfs" ? "도착 순서" : "현재 위치에서 가까운 순서"}로 8개 요청을 모두 처리했습니다. 이동 거리는 ${state.total}칸입니다.`,
    };
  return {
    eyebrow: `${index}번째 요청 · 처리 완료`,
    title: `${step.before.head} → ${state.head}, ${step.distance}칸 이동`,
    body:
      algorithm === "fcfs"
        ? `요청 ${step.request.id}는 남은 요청 중 가장 먼저 도착했습니다. 이동 거리가 ${step.distance}칸이어도 도착 순서를 따릅니다.`
        : `직전 헤드 ${step.before.head}에서 가장 가까운 요청이 ${state.head}번이었습니다. 다음 선택은 새 위치 ${state.head}를 기준으로 합니다.`,
  };
}

export const COMPARE_STORY = {
  fcfs: "먼 요청과 가까운 요청을 도착 순서대로 오가며 크게 왕복합니다.",
  sstf: "현재 위치에서 가까운 요청을 고르며 이 요청 묶음의 이동을 줄입니다.",
};
