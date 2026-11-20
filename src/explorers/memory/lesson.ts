// Lesson text for the memory explorer, following the shared learning model
// 목표 → 관찰 → 예측 → 확인 → 설명 → 비교 → 정리 (docs/DESIGN.md).
// Prose names a frame "프레임 0"; "F0" is only a compact label in the scene
// and tables. LRU compares the 마지막 접근, FIFO the 적재 순서.
import { eul, eun, ga, josa } from "@/lib/josa.ts";
import { BELADY_STRING, countFaults } from "./policies.ts";
import type {
  Algorithm,
  Frame,
  Milestone,
  Quiz,
  QuizChoice,
  Recap,
  Run,
  Runs,
  Step,
  StepDescription,
} from "./types.ts";

const policyName = (algorithm: Algorithm) => (algorithm === "fifo" ? "FIFO" : "LRU");
const pageName = (page: string) => `페이지 ${page}`;
export const frameName = (slot: number | null, pair?: string) =>
  pair ? josa(`프레임 ${slot}`, pair) : `프레임 ${slot}`;
const LOOP = ["A", "B", "C", "D", "A", "B", "C", "D"];

/** Milestones (핵심 장면) follow the fixed ten-access, three-frame lesson. */
export function buildMilestones(run: Run): Milestone[] {
  return [
    { index: 0, title: "어떤 페이지를 내보낼까" },
    { index: 1, title: "빈 프레임부터 채우기" },
    { index: 4, title: "같은 페이지 다시 읽기" },
    { index: 5, title: "RAM이 찼을 때의 선택" },
    { index: 6, title: "선택이 다음 접근에 미치는 영향" },
    { index: run.references.length, title: "결과 비교와 정리" },
  ];
}

/** Compulsory misses: the first reference to each page (OSTEP 22.2). */
export const compulsoryCount = (run: Run, upTo = run.references.length) =>
  run.steps.slice(1, upTo + 1).filter((step) => step.compulsory).length;

/** Where the page was last thrown out before this step, if it was. */
function evictedAt(step: Step, run: Run) {
  for (let i = step.index - 1; i >= 1; i--) {
    const earlier = run.steps[i];
    if (earlier.page === step.page) return null;
    if (earlier.victim === step.page) return earlier.index;
  }
  return null;
}

function victimReason(step: Step, algorithm: Algorithm) {
  const victim = step.before.find((frame) => frame.page === step.victim)!;
  // The particle follows the page letter, not the note in parentheses.
  const particle = eul(step.victim!).slice(step.victim!.length);
  return algorithm === "fifo"
    ? `적재 순서가 가장 앞선 ${step.victim}(${victim.loadedAt}번째 적재)${particle}`
    : `마지막 접근이 가장 이른 ${step.victim}(${victim.lastUsedAt}번째 접근)${particle}`;
}

/** The current access in one compact label: "이번 접근 · D 부재 · A 교체". */
function eventLabel(step: Step) {
  if (step.index === 0) return "";
  if (step.hit) return `${step.page} 적중`;
  if (step.victim === null) return `${step.page} 부재 · 빈 프레임 ${step.frameIndex}`;
  return `${step.page} 부재 · ${step.victim} 교체`;
}

function stepBody(step: Step, run: Run) {
  const algorithm = run.algorithm;
  const total = run.references.length;
  if (step.index === 0) {
    return "페이지 A~E를 정해진 순서로 10번 읽는데, RAM에는 프레임이 3개뿐입니다. 프레임이 모두 차면 한 페이지를 내보내야 하고, 무엇을 내보내는지에 따라 다음 접근의 결과가 달라집니다.";
  }
  if (step.index === total) {
    const cold = compulsoryCount(run);
    return `${total}번의 접근을 마쳤습니다. ${policyName(algorithm)}의 결과는 적중 ${step.hits}회, 페이지 부재 ${step.faults}회, 페이지 교체 ${step.replacements}회입니다. 부재 ${step.faults}회 중 ${cold}회는 A~E를 처음 참조한 강제 부재입니다.`;
  }
  if (step.hit) {
    const after = run.steps.find((entry) => entry.victim !== null);
    const consequence =
      after && step.index === after.index + 1
        ? `${after.index}번째에 ${eul(after.victim!)} 내보내고 ${eul(step.page)} 남긴 결과입니다. `
        : "";
    if (step.index === 4) {
      return `${eun(step.page)} 이미 ${frameName(step.frameIndex)}에 있어 적중입니다. 운영체제는 관여하지 않고, 주소 변환 장치(MMU)가 페이지 테이블로 주소를 바로 바꿉니다. ${algorithm === "fifo" ? "FIFO는 적재 순서를 그대로 둡니다." : `LRU는 ${step.index}번째를 ${step.page}의 마지막 접근으로 기록합니다.`}`;
    }
    return `${consequence}${eun(step.page)} ${frameName(step.frameIndex)}에 남아 있어 적중입니다. ${algorithm === "fifo" ? "적재 순서는 바뀌지 않습니다." : `마지막 접근을 ${step.index}번째로 기록합니다.`}`;
  }
  if (step.victim === null) {
    if (step.index === 1)
      return `페이지 테이블의 A 항목이 미상주라 페이지 부재입니다. 운영체제가 저장장치에서 A를 읽어 빈 ${frameName(0)}에 적재하고, CPU가 같은 접근을 다시 시도합니다. 저장장치 읽기는 RAM보다 훨씬 느려, 그동안 운영체제는 다른 준비된 프로세스를 실행합니다.`;
    const free = step.frames.filter((frame) => frame.page === null).length;
    return free
      ? `${step.page}도 처음 참조하는 페이지라 부재입니다. 빈 ${frameName(step.frameIndex)}에 적재하므로 내보낼 페이지가 없습니다.`
      : `${eul(step.page)} ${frameName(step.frameIndex)}에 적재하면 세 프레임이 모두 찹니다. 지금까지 부재 ${step.faults}회, 교체 ${step.replacements}회입니다.`;
  }
  const out = evictedAt(step, run);
  const why = out
    ? `${ga(step.page)} RAM에 없어 부재입니다. ${out}번째 접근에서 내보낸 페이지입니다.`
    : `${eun(step.page)} 처음 참조하는 페이지라 부재이고, 빈 프레임이 없습니다.`;
  return `${why} ${policyName(algorithm)}는 ${victimReason(step, algorithm)} 내보내고 ${eul(step.page)} ${frameName(step.frameIndex)}에 적재합니다.`;
}

/** The per-step takeaway (핵심): changes every step and follows the policy. */
function stepKey(step: Step, run: Run) {
  const algorithm = run.algorithm;
  const total = run.references.length;
  if (step.index === 0)
    return "페이지 부재(page fault)는 오류가 아니라 요청한 페이지가 RAM에 없는 상황입니다. 그때 운영체제가 저장장치에서 페이지를 읽어 옵니다.";
  if (step.index === total) {
    const belady = [3, 4].map((frames) => countFaults(BELADY_STRING, frames, "fifo").faults);
    return `Belady의 모순(Belady's anomaly): FIFO는 프레임을 늘려도 부재가 늘 수 있습니다. ${eun(BELADY_STRING.join("\u00a0"))} 프레임 3개에서 ${belady[0]}회, 4개에서 ${belady[1]}회입니다. LRU와 OPT는 스택 알고리즘이라 이런 일이 없습니다.`;
  }
  if (step.index === 1)
    return "그 페이지를 처음 참조할 때의 부재를 강제 부재(compulsory miss)라고 합니다. RAM이 가득 차 있으면 강제 부재에도 교체가 일어날 수 있습니다.";
  if (step.index === 2)
    return "부재가 늘어도 빈 프레임을 쓰는 동안에는 교체 수가 늘지 않습니다. 부재와 교체는 같은 횟수가 아닙니다.";
  if (step.index === 3)
    return "프레임 3개가 모두 찼습니다. 다음 부재부터는 운영체제가 한 페이지를 골라 내보내야 합니다.";
  if (step.hit) {
    if (algorithm === "fifo") {
      if (step.index === 4)
        return "적중해도 FIFO 순서는 바뀌지 않고, 페이지도 다른 프레임으로 옮기지 않습니다.";
      const frame = step.frames[step.frameIndex];
      return `FIFO는 적중을 기록하지 않습니다. ${ga(step.page)} 남은 것은 ${frame.loadedAt}번째에 적재돼 적재 순서가 뒤쪽이기 때문입니다.`;
    }
    if (step.index === 4)
      return "실제 하드웨어는 접근마다 순서를 적지 않고 참조 비트만 켭니다. 운영체제는 이 비트로 LRU를 근사합니다(예: 클럭 알고리즘). 이 화면의 LRU는 정확한 순서를 아는 이상적인 모델입니다.";
    return "LRU는 최근에 쓴 페이지를 곧 다시 쓴다는 시간 지역성에 기댑니다. 이 접근 순서에서는 그 가정이 맞아 적중했습니다.";
  }
  if (
    step.victim !== null &&
    step.index === run.steps.find((entry) => entry.victim !== null)!.index
  )
    return "이 실험은 읽기만 하므로 내보낸 페이지를 저장장치에 다시 쓸 필요가 없습니다. 저장장치의 원본은 남아 있고, 비워진 프레임을 다른 페이지에 씁니다.";
  if (step.compulsory)
    return `${eun(step.page)} 처음 참조해 강제 부재이지만, RAM이 가득 차 있어 교체도 일어났습니다. 강제 부재는 어떤 정책으로도 피할 수 없습니다.`;
  if (algorithm === "lru") {
    const loop = countFaults(LOOP, run.frameCount, "lru");
    return `LRU는 시간 지역성에 기댑니다. 반복해 쓰는 페이지 수가 프레임 수보다 크면 이 가정이 깨집니다. 예: 프레임 ${run.frameCount}개로 ${eul(LOOP.join(" "))} 읽으면 LRU는 ${LOOP.length}번 중 ${loop.faults}번 부재입니다.`;
  }
  return `${eun(step.page)} 이미 읽었던 페이지라 강제 부재가 아닙니다. 프레임이 모자라 내보냈다가 다시 읽는 용량 부재입니다.`;
}

/** Everything the 해설 tab shows for one committed step. */
export function describeStep(step: Step, run: Run): StepDescription {
  const algorithm = run.algorithm;
  const milestones = buildMilestones(run);
  const chapter = milestones.findLast((milestone) => milestone.index <= step.index)!;
  const stop = milestones.findIndex((milestone) => milestone.index === step.index);
  const titles: Record<number, string> = {
    0: "어떤 페이지를 내보내야 부재가 줄까?",
    1: "빈 프레임부터 채웁니다",
    4: "다시 읽어도, RAM 위치는 그대로",
    5: "가득 찬 RAM, 무엇을 내보낼까",
    6: "한 번의 교체가 다음 접근을 바꿉니다",
  };
  return {
    eyebrow: `${stop >= 0 ? `핵심 장면 ${stop + 1}/${milestones.length}` : `${step.index}번째 접근`} · ${policyName(algorithm)}`,
    chapterId: chapter.index,
    title:
      step.index === run.references.length
        ? "같은 접근 순서, 다른 부재 횟수"
        : titles[chapter.index],
    body: stepBody(step, run),
    goal:
      step.index === 0
        ? "학습 목표: 페이지 부재가 언제 생기는지, 그리고 내보낼 페이지를 고르는 기준이 다음 적중을 어떻게 바꾸는지 설명할 수 있다."
        : "",
    eventTitle: eventLabel(step),
    key: stepKey(step, run),
  };
}

function victimWhy(frame: Frame, step: Step, algorithm: Algorithm) {
  const victim = step.before.find((entry) => entry.page === step.victim)!;
  const fifoVictim = step.before.reduce((a, b) => (b.loadedAt! < a.loadedAt! ? b : a));
  const lruVictim = step.before.reduce((a, b) => (b.lastUsedAt! < a.lastUsedAt! ? b : a));
  if (frame.page === step.victim) {
    return algorithm === "fifo"
      ? `${eun(pageName(frame.page!))} ${frame.loadedAt}번째에 적재돼 지금 RAM에서 적재 순서가 가장 앞입니다. 최근에 다시 읽었는지는 FIFO의 기준이 아니므로 ${frameName(frame.slot, "을/를")} 재사용합니다.`
      : `${pageName(frame.page!)}의 마지막 접근은 ${frame.lastUsedAt}번째로 지금 RAM에서 가장 이릅니다. LRU는 적재 순서 대신 마지막 접근을 비교해 ${frameName(frame.slot, "을/를")} 재사용합니다.`;
  }
  if (algorithm === "fifo") {
    if (frame.page === lruVictim.page)
      return `${eun(frame.page!)} ${frame.loadedAt}번째에 적재돼 ${victim.page}보다 늦게 들어왔습니다. 마지막 접근이 가장 이른 페이지를 고르는 것은 LRU의 기준입니다.`;
    return `${eun(frame.page!)} ${frame.loadedAt}번째에 적재돼 ${victim.page}(${victim.loadedAt}번째)보다 늦게 들어왔습니다. FIFO는 가장 먼저 들어온 페이지부터 내보냅니다.`;
  }
  if (frame.page === fifoVictim.page)
    return `${eun(frame.page!)} 가장 먼저 적재됐지만 ${frame.lastUsedAt}번째에 다시 접근했습니다. 적재 순서는 FIFO의 기준이고, LRU는 마지막 접근을 비교합니다.`;
  return `${frame.page}의 마지막 접근은 ${frame.lastUsedAt}번째로 ${victim.page}(${victim.lastUsedAt}번째)보다 늦습니다. LRU는 마지막 접근이 가장 이른 페이지를 내보냅니다.`;
}

/**
 * The prediction for the next step, or null. Every choice carries `why`: the
 * reason it is right or the misconception it reflects. The access right after
 * the first replacement asks for the result and its reason, so the scene
 * (which shows what is in RAM) does not answer it.
 */
export function predictionFor(step: Step | null | undefined, run: Run | null = null): Quiz | null {
  if (!step || step.index === 0) return null;
  const history = (run?.references ?? []).slice(0, step.index - 1);
  const firstReplacement = run?.steps.find((entry) => entry.victim !== null);
  if (run && firstReplacement && step.index === firstReplacement.index + 1) {
    const previous = run.steps[step.index - 1];
    const algorithm = run.algorithm;
    const page = step.page;
    const lruText = `LRU는 4번째 ${page} 접근을 마지막 접근으로 기록해, ${previous.index}번째에 ${eul(previous.victim!)} 내보냈습니다.`;
    const choices: QuizChoice[] = [
      {
        id: "hit-recent",
        label: "적중",
        detail: `4번째에 다시 읽은 ${eun(page)} RAM에 남아 있다`,
        correct: Boolean(step.hit),
        why:
          algorithm === "fifo"
            ? `‘최근에 읽었으니 남는다’는 LRU의 기준입니다. FIFO는 적중을 기록하지 않아, ${previous.index}번째에 가장 먼저 적재된 ${ga(previous.victim!)} 나갔습니다.`
            : lruText,
      },
      {
        id: "fault-first",
        label: "부재",
        detail: `${previous.index}번째에 가장 먼저 적재된 ${ga(page)} 나갔다`,
        correct: !step.hit,
        why:
          algorithm === "fifo"
            ? `FIFO는 적재 순서만 봅니다. ${eun(page)} 1번째에 적재돼 가장 앞이었고, 4번째 적중은 그 순서를 바꾸지 않았습니다.`
            : `가장 먼저 적재된 페이지를 내보내는 것은 FIFO의 기준입니다. ${lruText}`,
      },
      {
        id: "fault-cold",
        label: "부재",
        detail: `${eul(page)} 처음 참조하는 강제 부재다`,
        correct: false,
        why: `${eun(page)} 1번째에 이미 읽었습니다. 강제 부재는 그 페이지를 처음 참조할 때의 부재입니다.`,
      },
    ];
    return {
      kind: "outcome",
      id: `${algorithm}-${step.index}`,
      atIndex: step.index,
      beforeIndex: step.index - 1,
      page,
      history,
      question: `${step.index}번째 접근은 다시 ${pageName(page)}입니다. ${policyName(algorithm)}에서 결과와 그 이유는?`,
      rule: `${previous.index}번째 접근에서 ${policyName(algorithm)}가 무엇을 기준으로 내보냈는지 떠올려 보세요.`,
      choices,
      correctId: choices.find((choice) => choice.correct)!.id,
      // Two choices share each result, so the verdict quotes the whole choice.
      answer: ((c: QuizChoice) => `‘${c.label} · ${c.detail}’`)(
        choices.find((choice) => choice.correct)!,
      ),
    };
  }
  if (step.victim === null) return null;
  const select = step.events.find((event) => event.type === "select")!;
  const algorithm = (select.type === "select" ? select.reason : "fifo") as Algorithm;
  return {
    kind: "victim",
    id: `${algorithm}-${step.index}`,
    atIndex: step.index,
    beforeIndex: step.index - 1,
    page: step.page,
    history,
    question: `${step.index}번째 접근은 ${pageName(step.page)}입니다. 어느 페이지를 내보낼까요?`,
    rule:
      algorithm === "fifo"
        ? "FIFO · 지금 RAM에서 적재 순서가 가장 앞선 페이지를 내보냅니다."
        : "LRU · 지금 RAM에서 마지막 접근이 가장 이른 페이지를 내보냅니다.",
    choices: step.before.map((frame) => ({
      id: frame.page!,
      label: pageName(frame.page!),
      slot: frame.slot,
      correct: frame.page === step.victim,
      // Revealed after answering; showing it up front gives the answer away.
      detail: `F${frame.slot} · 적재 ${frame.loadedAt}번째 · 마지막 접근 ${frame.lastUsedAt}번째`,
      why: victimWhy(frame, step, algorithm),
    })),
    correctId: step.victim,
    answer: pageName(step.victim),
  };
}

/**
 * Whether the scene's next-victim marks (#1, the lit LED, the deciding key in
 * the 프레임 tab and its sentence) may show. They are hidden while a victim
 * prediction is pending or open, and while an access is being played.
 */
export function victimHintsVisible({
  nextQuiz = null,
  answered = false,
  busy = false,
  open = null,
}: {
  nextQuiz?: Quiz | null;
  answered?: boolean;
  busy?: boolean;
  open?: Quiz | null;
} = {}) {
  if (busy) return false;
  if (open?.kind === "victim" && !answered) return false;
  if (nextQuiz?.kind === "victim" && !answered) return false;
  return true;
}

/** The 정리 panel content: 핵심 정리 and 확인 문제 (asked without the scene). */
export function recapFor(runs: Runs): Recap {
  const opt = countFaults(runs.fifo.references, runs.fifo.frameCount, "opt");
  const cold = compulsoryCount(runs.fifo);
  return {
    points: [
      `페이지 부재는 오류가 아니라 요청한 페이지가 RAM에 없는 상황입니다. A~E를 처음 참조한 ${cold}회는 강제 부재라 어떤 정책도 피할 수 없습니다.`,
      "FIFO는 적재 순서만, LRU는 마지막 접근을 봅니다. 4번째 A 적중을 기록했는지가 5번째에 내보낼 페이지와 6번째 결과를 갈랐습니다.",
      `미래를 아는 OPT(MIN)는 이 순서에서 부재 ${opt.faults}회로, FIFO ${runs.fifo.stats.faults}회·LRU ${runs.lru.stats.faults}회보다 적습니다. 실제 정책을 재는 기준선입니다.`,
    ],
    recall: [
      {
        id: "fifo-victim",
        question: "FIFO에서 4번째 A가 적중한 뒤 5번째 D를 넣을 때, A를 내보낸 이유는?",
        choices: [
          {
            label: "A가 가장 먼저 적재됐기 때문",
            correct: true,
            why: "FIFO는 적재 순서만 봅니다. 4번째 적중은 그 순서를 바꾸지 않습니다.",
          },
          {
            label: "A를 가장 오래 쓰지 않았기 때문",
            why: "그것은 LRU의 기준입니다. A는 4번째에 쓰여 오히려 마지막 접근이 가장 늦습니다.",
          },
          {
            label: "A가 프레임 0에 있기 때문",
            why: "프레임 번호는 RAM의 자리일 뿐 교체 기준이 아닙니다.",
          },
        ],
      },
      {
        id: "compulsory",
        question: "강제 부재(compulsory miss)에 대한 설명으로 맞는 것은?",
        choices: [
          {
            label:
              "그 페이지를 처음 참조할 때 생기고, RAM이 가득 차 있으면 교체도 함께 일어나는 부재",
            correct: true,
            why: "8번째 E가 그 예입니다. 처음 참조했고, RAM이 차 있어 D를 내보냈습니다.",
          },
          {
            label: "빈 프레임을 채울 때만 생기고 교체는 없는 부재",
            why: "빈 프레임이 남은 동안만 그렇습니다. 5번째 D와 8번째 E는 처음 참조인데 교체도 일어났습니다.",
          },
          {
            label: "교체 정책을 바꾸면 줄일 수 있는 부재",
            why: `처음 참조는 어떤 정책도 피할 수 없습니다. FIFO·LRU·OPT 모두 강제 부재가 ${cold}회입니다.`,
          },
        ],
      },
    ],
  };
}
