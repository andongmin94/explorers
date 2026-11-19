import { josa } from "./josa.js";
import { BELADY_STRING, countFaults } from "./policies.js";

const policyName = (algorithm) => (algorithm === "fifo" ? "FIFO" : "LRU");
const pageName = (page) => `페이지 ${page}`;
const ko = { digits: "ko" };
const frameName = (slot, particle) => josa(`프레임 ${slot}`, particle, ko);
const LOOP = ["A", "B", "C", "D", "A", "B", "C", "D"];

function choiceReason(step, algorithm) {
  const victim = step.before.find((frame) => frame.page === step.victim);
  if (algorithm === "fifo") {
    return `${pageName(victim.page)}는 ${victim.loadedAt}번째 접근 때 RAM에 들어왔습니다. 현재 RAM에 있는 페이지 중 적재 차례가 가장 앞이므로 이 페이지의 ${frameName(victim.slot, "을")} 재사용합니다. 최근에 다시 읽었는지는 FIFO의 선택 기준에 포함되지 않습니다.`;
  }
  return `${pageName(victim.page)}의 마지막 접근은 ${victim.lastUsedAt}번째였습니다. 현재 RAM에 있는 페이지 중 가장 오래 참조되지 않았으므로 이 페이지의 ${frameName(victim.slot, "을")} 재사용합니다. LRU는 적재 차례 대신 기록된 마지막 접근 차례를 비교합니다.`;
}

function currentEvent(step, algorithm) {
  if (step.index === 0) {
    return {
      eventTitle: "첫 접근을 기다립니다",
      eventBody: "RAM의 F0~F2가 모두 비어 있습니다. 첫 요청은 페이지 A입니다.",
    };
  }
  if (step.hit) {
    return {
      eventTitle: `${step.index}번째 접근 · ${step.page} 적중`,
      eventBody: `저장장치에서 다시 읽지 않고 프레임 ${step.frameIndex}의 ${pageName(step.page)}를 사용했습니다. 운영체제는 관여하지 않고, 주소 변환 장치(MMU)가 페이지 테이블로 주소를 바꿉니다. ${algorithm === "fifo" ? "적재 순서는 그대로 유지됩니다." : `이 모델의 LRU는 ${step.index}번째를 ${step.page}의 마지막 접근으로 기록합니다.`}`,
    };
  }
  if (step.victim === null) {
    return {
      eventTitle: `${step.index}번째 접근 · ${step.page} 부재 · 빈 프레임 사용`,
      eventBody: `비어 있던 프레임 ${step.frameIndex}에 저장장치에서 읽은 ${pageName(step.page)}를 적재했습니다. 요청을 마쳤고, 기존 페이지를 내보내는 교체는 발생하지 않았습니다.`,
    };
  }
  const victim = step.before.find((frame) => frame.page === step.victim);
  const reason =
    algorithm === "fifo"
      ? `${step.victim}가 ${victim.loadedAt}번째 접근 때 가장 먼저 적재됐습니다.`
      : `${step.victim}의 마지막 접근이 ${victim.lastUsedAt}번째로 가장 오래됐습니다.`;
  return {
    eventTitle: `${step.index}번째 접근 · ${step.victim}를 내보내고 ${step.page} 적재`,
    eventBody: `${reason} ${step.victim}의 RAM 사본을 내보내고 ${step.page}를 프레임 ${step.frameIndex}에 읽어 요청을 처리했습니다.`,
  };
}

/** Milestones follow the fixed ten-access, three-frame lesson. */
export function buildMilestones(run) {
  return [
    { index: 0, title: "페이지와 프레임" },
    { index: 1, title: "빈 프레임부터 채우기" },
    { index: 4, title: "같은 페이지 다시 읽기" },
    { index: 5, title: "RAM이 찼을 때의 선택" },
    { index: 6, title: "선택이 다음 접근에 미치는 영향" },
    { index: run.references.length, title: "같은 조건에서 결과 비교" },
  ];
}

/** Keep the concept readable while the current access details change below it. */
export function describeStep(step, run) {
  const algorithm = run.algorithm;
  const milestones = buildMilestones(run);
  const chapter = milestones.findLast(
    (milestone) => milestone.index <= step.index,
  );
  const common = {
    eyebrow: `${step.index === 0 ? "접근 전" : `${step.index} / ${run.references.length}번째 접근`} · ${policyName(algorithm)}`,
    chapterId: chapter.index,
    ...currentEvent(step, algorithm),
  };

  if (chapter.index === 0) {
    return {
      ...common,
      title: "다섯 페이지, 세 개의 RAM 칸",
      body: "페이지는 가상 주소 공간을 같은 크기로 나눈 단위(A~E)이고, 프레임은 RAM을 같은 크기로 나눈 칸(F0~F2)입니다. CPU가 가상 주소에 접근하면 주소 변환 장치(MMU)가 그 주소가 속한 페이지의 항목을 페이지 테이블에서 조회합니다. 항목에는 상주 여부와 프레임 번호가 있습니다. 페이지의 원본은 저장장치(SSD)에 있습니다.",
      insight:
        "프레임 번호는 RAM의 자리, 페이지 문자는 그 자리에 담긴 내용입니다. 페이지 부재(page fault)는 오류가 아니라 요청한 페이지가 RAM에 없는 상황입니다.",
    };
  }

  if (chapter.index === 1) {
    return {
      ...common,
      title: "빈 프레임부터 채웁니다",
      body: "페이지 테이블 항목이 미상주이면 페이지 부재입니다. 운영체제가 저장장치의 페이지를 빈 프레임에 적재하고 그 번호를 페이지 테이블에 기록합니다. 그다음 CPU가 같은 접근을 다시 시도합니다. RAM 접근은 약 100나노초지만 저장장치 읽기는 SSD도 수십 마이크로초 이상, HDD는 수 밀리초가 걸립니다. 그동안 이 프로세스는 기다리고, 운영체제는 다른 준비된 프로세스를 실행합니다.",
      insight:
        "빈 RAM을 처음 채우는 부재를 강제(초기) 부재라고 합니다. 부재이지만 다른 페이지를 내보내지 않았으므로 교체 수는 늘지 않습니다.",
    };
  }

  if (chapter.index === 4) {
    return {
      ...common,
      title: "다시 읽어도, RAM 위치는 그대로",
      body: `RAM에 있는 페이지를 다시 읽으면 적중입니다. 운영체제는 관여하지 않고, MMU가 같은 프레임으로 주소를 변환합니다. ${algorithm === "fifo" ? "FIFO는 페이지를 다시 읽어도 처음 RAM에 들어온 순서를 유지합니다." : "이 모델의 LRU는 이번 접근 차례를 기록해 이 페이지를 가장 최근에 사용한 것으로 취급합니다."}`,
      insight:
        algorithm === "fifo"
          ? "교체 우선순위가 달라져도 RAM 안의 페이지를 옆 프레임으로 옮기지는 않습니다. 프레임 배치와 교체를 위한 기록을 함께 살펴보세요."
          : "실제 하드웨어는 접근마다 순서를 적지 않고 참조 비트만 켭니다. 운영체제는 이 비트로 LRU를 근사합니다(예: 클럭 알고리즘). 이 화면의 LRU는 정확한 순서를 아는 이상적인 모델입니다.",
    };
  }

  if (chapter.index === 5) {
    return {
      ...common,
      title: "가득 찬 RAM, 무엇을 남길까",
      body: `${pageName(step.page)}를 요청했을 때 RAM에 빈 프레임이 없었습니다. 페이지 부재를 처리하는 운영체제가 내보낼 페이지를 고릅니다. ${algorithm === "fifo" ? "FIFO는 적재할 때 기록한 차례를" : "LRU는 접근 때마다 남은 기록으로 마지막 접근 차례를"} 비교해 한 페이지를 내보냈습니다. 그 자리에 ${step.page}를 적재한 뒤 CPU의 읽기를 마쳤습니다.`,
      insight:
        "이 실험은 읽기만 하므로 내보낸 페이지를 저장장치에 다시 쓸 필요가 없습니다. 저장장치의 원본은 남아 있고, 비워진 RAM 프레임을 다른 페이지에 사용합니다.",
    };
  }

  if (step.index === run.references.length) {
    const opt = countFaults(run.references, run.frameCount, "opt");
    const belady = [3, 4].map((frames) => countFaults(BELADY_STRING, frames, "fifo").faults);
    return {
      ...common,
      title: "같은 접근 순서, 다른 부재 횟수",
      body: `${run.references.length}번의 접근을 마쳤습니다. ${policyName(algorithm)}의 결과는 적중 ${step.hits}회, 페이지 부재 ${step.faults}회, 페이지 교체 ${step.replacements}회입니다. 같은 세 프레임과 같은 접근 순서로 다른 정책의 결과를 비교해 보세요.`,
      insight: `기준선은 앞으로 가장 늦게 쓰일 페이지를 내보내는 OPT(MIN)입니다. 이 순서에서 부재 ${opt.faults}회이지만, 미래를 알아야 해 비교 기준으로만 씁니다. FIFO는 프레임을 늘려도 부재가 늘 수 있습니다(벨레이디의 역설: ${josa(BELADY_STRING.join(" "), "은", ko)} 프레임 3개에서 ${belady[0]}회, 4개에서 ${belady[1]}회).`,
    };
  }

  const loop = countFaults(LOOP, run.frameCount, "lru");
  return {
    ...common,
    title: "한 번의 교체가 다음 접근을 바꿉니다",
    body: `앞에서 무엇을 남겼는지에 따라 같은 요청도 적중하거나 부재가 됩니다. ${algorithm === "fifo" ? "FIFO는 최근에 읽은 페이지라도 적재 차례가 가장 앞이면 내보냅니다." : "LRU는 적중할 때에도 마지막 접근 기록을 갱신하고, 가장 오래 참조하지 않은 페이지부터 내보냅니다."} 현재 RAM의 내용과 이번 접근 결과를 연결해 보세요.`,
    insight: `LRU는 최근에 쓴 페이지를 곧 다시 쓴다는 시간 지역성에 기댑니다. 반복 범위가 프레임보다 크면 이 가정이 깨집니다. 예: 프레임 ${run.frameCount}개로 ${LOOP.join(" ")}를 읽으면 LRU는 ${LOOP.length}번 중 ${loop.faults}번 부재입니다.`,
  };
}

/**
 * Pass the next completed step; reveal explanation only after the learner
 * chooses. With the run, the access right after the first replacement asks
 * for hit or fault instead, so both policies get the same question.
 */
export function predictionFor(step, run = null) {
  const history = (run?.references ?? []).slice(0, step.index - 1);
  const firstReplacement = run?.steps.find((entry) => entry.victim !== null);
  if (run && firstReplacement && step.index === firstReplacement.index + 1) {
    const previous = run.steps[step.index - 1];
    const algorithm = run.algorithm;
    return {
      kind: "outcome",
      atIndex: step.index,
      beforeIndex: step.index - 1,
      page: step.page,
      history,
      question: `${step.index}번째 접근은 페이지 ${step.page}입니다. ${policyName(algorithm)}에서는 적중일까요, 부재일까요?`,
      rule: `${previous.index}번째 접근에서 ${policyName(algorithm)}가 무엇을 내보냈는지 떠올려 보세요.`,
      choices: [
        { id: "hit", label: "적중", detail: "RAM에 남아 있음" },
        { id: "fault", label: "부재", detail: "저장장치에서 다시 읽음" },
      ],
      correctId: step.hit ? "hit" : "fault",
      explanation: `${previous.index}번째 접근에서 ${policyName(algorithm)}는 ${josa(previous.victim, "를")} 내보냈습니다. ${step.hit ? `${josa(step.page, "는")} RAM에 남아 적중입니다.` : `${josa(step.page, "가")} RAM에 없어 부재입니다.`}`,
    };
  }
  if (step.victim === null) return null;
  const algorithm = step.events.find((event) => event.type === "select").reason;
  return {
    kind: "victim",
    atIndex: step.index,
    beforeIndex: step.index - 1,
    page: step.page,
    history,
    question: `${step.index}번째 접근은 페이지 ${step.page}입니다. 어느 페이지의 자리를 비울까요?`,
    rule:
      algorithm === "fifo"
        ? "FIFO · 현재 RAM에 가장 먼저 들어온 페이지를 선택합니다."
        : "LRU · 현재 RAM에서 마지막 접근이 가장 오래된 페이지를 선택합니다.",
    choices: step.before.map((frame) => ({
      id: frame.page,
      label: pageName(frame.page),
      slot: frame.slot,
      // Revealed after answering; showing it up front gives the answer away.
      detail: `프레임 ${frame.slot} · 적재 ${frame.loadedAt}번째 · 최근 접근 ${frame.lastUsedAt}번째`,
    })),
    correctId: step.victim,
    explanation: choiceReason(step, algorithm),
  };
}
