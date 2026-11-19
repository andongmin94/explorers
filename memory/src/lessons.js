// The memory explorer's lessons (shared/DESIGN.md → "Lessons and the lesson
// rail"). Each lesson is one reference string with two conditions (modes)
// and its own question, 핵심 장면, predictions, comparison and 정리.
//
//   01 FIFO와 LRU   — the original lesson; its text lives in lesson.js.
//   02 OPT와 LRU    — OPT (Belady's MIN) as the unreachable baseline.
//   03 Belady의 모순 — FIFO with 3 vs 4 frames (9 → 10 faults).
//   04 클럭과 LRU   — reference bits and a hand approximate LRU.
//
// Sources: OSTEP ch. 22 (22.2 three Cs, 22.4 OPT, 22.6 workloads, 22.8 clock),
// Silberschatz, Operating System Concepts 10.4 (FIFO, Belady's anomaly,
// OPT, LRU and stack algorithms, second-chance).
import { eul, eun, ga, josa } from "../../shared/josa.js";
import { REFERENCE_STRING, replacementOrder, simulate } from "./engine.js";
import { buildMilestones, describeStep, predictionFor, recapFor } from "./lesson.js";

export const POLICY = { fifo: "FIFO", lru: "LRU", opt: "OPT", clock: "클럭" };
export const RULES = {
  fifo: "적재 순서가 가장 앞선 페이지를 내보냅니다. 적중해도 적재 순서는 바뀌지 않습니다.",
  lru: "마지막 접근이 가장 이른 페이지를 내보냅니다. 적중하면 마지막 접근을 갱신합니다.",
  opt: "다음 접근이 가장 늦은 페이지(다시 쓰이지 않으면 그 페이지)를 내보냅니다. 앞으로의 접근 순서를 알아야 합니다.",
  clock: "바늘이 프레임을 돌며 참조 비트가 1이면 0으로 끄고 넘어가고(두 번째 기회), 0인 페이지를 내보냅니다. 접근한 페이지는 참조 비트가 1이 됩니다.",
};
/** Short criterion for the comparison columns. */
export const CRITERION = {
  fifo: "적재 순서가 가장 앞선 페이지부터",
  lru: "마지막 접근이 가장 이른 페이지부터",
  opt: "다음 접근이 가장 늦은 페이지부터",
  clock: "바늘이 만난 참조 비트 0인 페이지부터",
};

const pageName = (page) => `페이지 ${page}`;
const frameName = (slot, pair) => (pair ? josa(`프레임 ${slot}`, pair) : `프레임 ${slot}`);
const nth = (n) => `${n}번째`;
const topic = (algorithm) => eun(POLICY[algorithm]);
const compulsory = (run) => run.steps.filter((step) => step.compulsory).length;

/* ---------- Runs ---------- */

export function runsFor(lesson) {
  return Object.fromEntries(
    lesson.modes.map((mode) => [mode.id, simulate({ algorithm: mode.algorithm, frameCount: mode.frameCount, references: lesson.references })]),
  );
}

/* ---------- Generic text for lessons 02–04 ---------- */

/** Where the page was last thrown out before this step, if it was. */
function evictedAt(step, run) {
  for (let i = step.index - 1; i >= 1; i--) {
    const earlier = run.steps[i];
    if (earlier.page === step.page) return null;
    if (earlier.victim === step.page) return earlier.index;
  }
  return null;
}

/** "적재 순서가 가장 앞선 A(1번째 적재)를" … the reason the victim went, ending in 을/를. */
function victimReason(step, algorithm) {
  const v = step.before.find((frame) => frame.page === step.victim);
  const obj = (note) => `${step.victim}(${note})${eul(step.victim).slice(step.victim.length)}`;
  if (algorithm === "fifo") return `적재 순서가 가장 앞선 ${obj(`${v.loadedAt}번째 적재`)}`;
  if (algorithm === "lru") return `마지막 접근이 가장 이른 ${obj(`${v.lastUsedAt}번째 접근`)}`;
  if (algorithm === "opt")
    return v.nextUseAt === null ? `앞으로 다시 쓰이지 않는 ${eul(step.victim)}` : `다음 접근이 가장 늦은 ${obj(`${v.nextUseAt}번째`)}`;
  return `바늘이 멈춘 참조 비트 0의 ${eul(step.victim)}`;
}

function sweepText(step) {
  const swept = step.events.filter((event) => event.type === "sweep").map((event) => event.page);
  if (!swept.length) return `바늘이 가리킨 ${step.victim}의 참조 비트가 이미 0입니다.`;
  return `바늘이 ${swept.join("·")}의 참조 비트를 1에서 0으로 끄며 넘어갑니다(두 번째 기회).`;
}

function genericBody(step, run, lesson) {
  const algorithm = run.algorithm;
  const total = run.references.length;
  if (step.index === 0) return lesson.intro;
  if (step.index === total) {
    const tail = lesson.endNote?.(run) ?? "";
    return `${total}번의 접근을 마쳤습니다. ${topic(algorithm)} 적중 ${step.hits}회, 페이지 부재 ${step.faults}회, 페이지 교체 ${step.replacements}회입니다.${tail ? ` ${tail}` : ""}`;
  }
  if (step.hit) {
    const at = `${eun(step.page)} ${frameName(step.frameIndex)}에 있어 적중입니다.`;
    if (algorithm === "fifo") return `${at} 적재 순서는 바뀌지 않습니다.`;
    if (algorithm === "lru") return `${at} 마지막 접근을 ${nth(step.index)}로 기록합니다.`;
    if (algorithm === "opt") return `${at} OPT는 접근을 기록하지 않습니다. 다음 선택도 앞으로의 접근 순서만 봅니다.`;
    const was = step.before[step.frameIndex].ref;
    return `${at} ${was ? "참조 비트는 이미 1입니다." : "하드웨어가 참조 비트를 0에서 1로 켭니다."}`;
  }
  if (step.victim === null) {
    const free = step.frames.filter((frame) => frame.page === null).length;
    return free
      ? `${eun(step.page)} 처음 참조하는 페이지라 부재입니다. 빈 ${frameName(step.frameIndex)}에 적재하므로 내보낼 페이지가 없습니다.`
      : `${eul(step.page)} ${frameName(step.frameIndex)}에 적재하면 프레임 ${run.frameCount}개가 모두 찹니다. 다음 부재부터는 내보낼 페이지를 골라야 합니다.`;
  }
  const out = evictedAt(step, run);
  const why = out ? `${eun(step.page)} ${out}번째 접근에서 내보낸 페이지라 부재입니다.` : `${eun(step.page)} 처음 참조하는 페이지라 부재이고, 빈 프레임이 없습니다.`;
  if (algorithm === "clock") return `${why} ${sweepText(step)} ${ga(step.victim)} 나가고 ${eul(step.page)} ${frameName(step.frameIndex)}에 적재합니다.`;
  return `${why} ${topic(algorithm)} ${victimReason(step, algorithm)} 내보내고 ${eul(step.page)} ${frameName(step.frameIndex)}에 적재합니다.`;
}

function eventLabel(step) {
  if (step.index === 0) return "";
  if (step.hit) return `${step.page} 적중`;
  if (step.victim === null) return `${step.page} 부재 · 빈 프레임 ${step.frameIndex}`;
  return `${step.page} 부재 · ${step.victim} 교체`;
}

/** Which simpler policy would have picked this page from the same RAM (for the why of a wrong choice). */
function confusion(frame, step, algorithm, others) {
  for (const other of others) {
    if (other === algorithm || other === "clock") continue;
    if (replacementOrder(step.before, other)[0] !== frame.page) continue;
    if (other === "fifo") return "가장 먼저 적재된 페이지를 내보내는 것은 FIFO의 기준입니다.";
    if (other === "lru") return "마지막 접근이 가장 이른 페이지를 고르는 것은 LRU의 기준입니다.";
    if (other === "opt") return "다음 접근이 가장 늦은 페이지를 고르는 것은 미래를 아는 OPT의 기준입니다.";
  }
  return "";
}

function victimWhy(frame, step, algorithm, others) {
  const v = step.before.find((entry) => entry.page === step.victim);
  const reuse = frameName(frame.slot, "을/를");
  if (frame.page === step.victim) {
    if (algorithm === "fifo")
      return `${eun(pageName(frame.page))} ${frame.loadedAt}번째에 적재돼 지금 RAM에서 적재 순서가 가장 앞입니다. 그 뒤의 적중은 FIFO의 순서를 바꾸지 않으므로 ${reuse} 재사용합니다.`;
    if (algorithm === "lru")
      return `${pageName(frame.page)}의 마지막 접근은 ${frame.lastUsedAt}번째로 지금 RAM에서 가장 이릅니다. LRU는 지나간 접근만 보고 ${reuse} 재사용합니다.`;
    if (algorithm === "opt")
      return frame.nextUseAt === null
        ? `${eun(pageName(frame.page))} 앞으로 다시 쓰이지 않습니다. OPT는 그런 페이지부터 내보내 ${reuse} 재사용합니다.`
        : `${pageName(frame.page)}의 다음 접근은 ${frame.nextUseAt}번째로 RAM에서 가장 늦습니다. OPT는 가장 늦게 필요한 페이지를 내보내 ${reuse} 재사용합니다.`;
    return `바늘은 ${frameName(step.handBefore)}에서 출발합니다. ${sweepText(step)} 참조 비트가 0인 ${frame.page}에서 멈춰 ${reuse} 재사용합니다.`;
  }
  const mix = confusion(frame, step, algorithm, others);
  let fact;
  if (algorithm === "fifo") fact = `${eun(frame.page)} ${frame.loadedAt}번째에 적재돼 ${v.page}(${v.loadedAt}번째)보다 늦게 들어왔습니다.`;
  else if (algorithm === "lru") fact = `${frame.page}의 마지막 접근은 ${frame.lastUsedAt}번째로 ${v.page}(${v.lastUsedAt}번째)보다 늦습니다.`;
  else if (algorithm === "opt") fact = `${eun(frame.page)} ${frame.nextUseAt}번째에 다시 쓰여 ${v.page}${v.nextUseAt === null ? "(다시 쓰이지 않음)" : `(${v.nextUseAt}번째)`}보다 먼저 필요합니다.`;
  else {
    const swept = step.events.some((event) => event.type === "sweep" && event.page === frame.page);
    fact = swept
      ? `${eun(frame.page)} 참조 비트가 1이라 바늘이 0으로 끄고 지나갑니다(두 번째 기회).`
      : `바늘이 ${frame.page}에 닿기 전에 참조 비트가 0인 ${v.page}에서 멈춥니다.`;
  }
  return mix ? `${fact} ${mix}` : fact;
}

function detailOf(frame, algorithm, step) {
  if (algorithm === "opt") return `F${frame.slot} · 다음 접근 ${frame.nextUseAt === null ? "없음" : `${frame.nextUseAt}번째`}`;
  if (algorithm === "clock") return `F${frame.slot} · 참조 비트 ${frame.ref}${frame.slot === step.handBefore ? " · 바늘 위치" : ""}`;
  return `F${frame.slot} · 적재 ${frame.loadedAt}번째 · 마지막 접근 ${frame.lastUsedAt}번째`;
}

const VICTIM_RULE = {
  fifo: "FIFO · 지금 RAM에서 적재 순서가 가장 앞선 페이지를 내보냅니다.",
  lru: "LRU · 지금 RAM에서 마지막 접근이 가장 이른 페이지를 내보냅니다.",
  opt: "OPT · 지금 RAM에서 다음 접근이 가장 늦은 페이지를 내보냅니다.",
  clock: "클럭 · 바늘 위치부터 돌며 참조 비트 1은 0으로 끄고 넘어가고, 0인 페이지를 내보냅니다.",
};

function victimQuiz(step, run, mode, lesson) {
  const algorithm = run.algorithm;
  const others = [...lesson.modes.map((m) => m.algorithm), "fifo", "lru"];
  return {
    kind: "victim",
    id: `${mode.id}-${step.index}`,
    atIndex: step.index,
    beforeIndex: step.index - 1,
    page: step.page,
    history: run.references.slice(0, step.index - 1),
    question: `${step.index}번째 접근은 ${pageName(step.page)}입니다. 어느 페이지를 내보낼까요?`,
    rule: VICTIM_RULE[algorithm],
    choices: step.before.map((frame) => ({
      id: frame.page,
      label: pageName(frame.page),
      slot: frame.slot,
      correct: frame.page === step.victim,
      // Revealed after answering; showing it up front gives the answer away.
      detail: detailOf(frame, algorithm, step),
      why: victimWhy(frame, step, algorithm, others),
    })),
    correctId: step.victim,
    answer: pageName(step.victim),
  };
}

function outcomeQuiz(step, run, mode, spec) {
  const choices = spec.choices.map((c) => ({ ...c, correct: c.id === spec.correct }));
  const right = choices.find((c) => c.correct);
  return {
    kind: "outcome",
    id: `${mode.id}-${step.index}`,
    atIndex: step.index,
    beforeIndex: step.index - 1,
    page: step.page,
    history: run.references.slice(0, step.index - 1),
    question: `${step.index}번째 접근은 다시 ${pageName(step.page)}입니다. ${mode.label}에서 결과와 그 이유는?`,
    rule: spec.rule,
    choices,
    correctId: right.id,
    // Two choices share each result, so the verdict quotes the whole choice.
    answer: `‘${right.label} · ${right.detail}’`,
  };
}

/** Builds the lesson API for lessons 02–04 from their data. */
function scripted(data) {
  const lesson = {
    ...data,
    milestones: () => data.scenes,
    describe(step, run, mode) {
      const scenes = data.scenes;
      const chapter = scenes.findLast((m) => m.index <= step.index);
      const stop = scenes.findIndex((m) => m.index === step.index);
      const total = run.references.length;
      const keyFn = data.keys[mode.id]?.[step.index] ?? data.keys.all?.[step.index];
      return {
        eyebrow: `${stop >= 0 ? `핵심 장면 ${stop + 1}/${scenes.length}` : `${step.index}번째 접근`} · ${mode.label}`,
        chapterId: chapter.index,
        title: step.index === 0 ? data.question : step.index === total ? data.endTitle : typeof chapter.heading === "string" ? chapter.heading : chapter.heading[mode.id],
        body: genericBody(step, run, data),
        goal: step.index === 0 ? data.goal : "",
        eventTitle: eventLabel(step),
        key: typeof keyFn === "function" ? keyFn(step, run) : (keyFn ?? data.fallbackKey(step, run)),
      };
    },
    predict(step, run, mode) {
      if (!step || step.index === 0) return null;
      const spec = data.quizzes[mode.id]?.find((q) => q.at === step.index);
      if (!spec) return null;
      return spec.kind === "victim" ? victimQuiz(step, run, mode, lesson) : outcomeQuiz(step, run, mode, spec);
    },
  };
  return lesson;
}

/* ---------- 01 FIFO와 LRU (text in lesson.js) ---------- */

const FIFO_LRU = {
  id: "fifo-lru",
  name: "FIFO와 LRU",
  sub: "같은 접근, 다른 교체",
  references: REFERENCE_STRING,
  modeLabel: "교체 방식",
  modes: [
    { id: "fifo", algorithm: "fifo", frameCount: 3, label: "FIFO" },
    { id: "lru", algorithm: "lru", frameCount: 3, label: "LRU" },
  ],
  fork: 4,
  milestones: (runs) => buildMilestones(runs.fifo),
  describe: (step, run) => describeStep(step, run),
  predict: (step, run) => predictionFor(step, run),
  recap: (runs) => recapFor(runs),
  forkText: () =>
    "<b>갈림길은 4번째 A 적중입니다.</b> FIFO는 A의 적재 순서를 그대로 두고, LRU는 A의 마지막 접근을 4번째로 기록합니다. 그래서 5번째 D를 넣을 때 FIFO는 A, LRU는 B를 내보내고, 6번째 A가 각각 부재와 적중으로 갈립니다.",
  compareNote: (runs, { opt }) =>
    `이 접근 순서에서는 LRU의 부재가 ${runs.fifo.stats.faults - runs.lru.stats.faults}회 적고, 기준선 OPT(MIN)는 부재 ${opt}회입니다. 다른 접근 순서에서는 차이가 달라질 수 있습니다.`,
  rules: [
    ["시작", "RAM 프레임 3개는 처음에 모두 비어 있습니다."],
    ["접근", "A B C A D A B E A B, 정해진 10번의 읽기를 두 방식에 똑같이 적용합니다."],
  ],
};

/* ---------- 02 OPT와 LRU ---------- */

const LOOP = Object.freeze(["A", "B", "C", "D", "A", "B", "C", "D", "A", "B", "C", "D"]);

const OPT_LRU = scripted({
  id: "opt",
  name: "OPT와 LRU",
  sub: "미래를 아는 기준선",
  references: LOOP,
  modeLabel: "교체 방식",
  modes: [
    { id: "opt", algorithm: "opt", frameCount: 3, label: "OPT" },
    { id: "lru", algorithm: "lru", frameCount: 3, label: "LRU" },
  ],
  question: "미래를 알면 부재를 얼마나 줄일 수 있을까?",
  intro: "페이지 A~D를 A B C D 순서로 세 번 반복해 12번 읽는데, RAM에는 프레임이 3개뿐입니다. OPT는 앞으로의 접근 순서를 모두 안다고 가정하고, LRU는 지나간 접근만 봅니다.",
  goal: "학습 목표: OPT가 다음 접근이 가장 늦은 페이지를 내보내는 이유와, 실제 운영체제가 OPT를 쓸 수 없어 기준선으로만 쓰는 이유를 설명할 수 있다.",
  endTitle: "미래를 아는 기준선과의 차이",
  scenes: [
    { index: 0, title: "미래를 알면 얼마나 줄까", heading: "미래를 알면 부재를 얼마나 줄일 수 있을까?" },
    { index: 3, title: "프레임이 모두 찼을 때", heading: "세 프레임이 모두 찼습니다" },
    { index: 4, title: "과거를 볼까, 미래를 볼까", heading: "누구를 내보낼까: 과거와 미래" },
    { index: 5, title: "남긴 페이지가 곧 쓰인다", heading: "한 번의 선택이 다음 접근을 가릅니다" },
    { index: 7, title: "다음 접근이 가장 늦은 페이지", heading: { opt: "OPT는 늘 가장 먼 미래를 봅니다", lru: "LRU는 늘 곧 쓸 페이지를 내보냅니다" } },
    { index: 12, title: "결과 비교와 정리", heading: "미래를 아는 기준선과의 차이" },
  ],
  endNote: (run) =>
    run.algorithm === "opt"
      ? "어떤 정책도 이 접근 순서에서 이보다 부재가 적을 수 없습니다."
      : "반복하는 페이지 4개가 프레임 3개에 담기지 않아 모든 접근이 부재였습니다.",
  quizzes: {
    opt: [
      { at: 4, kind: "victim" },
      {
        at: 5,
        kind: "outcome",
        rule: "4번째 접근에서 OPT가 무엇을 기준으로 내보냈는지 떠올려 보세요.",
        correct: "hit-future",
        choices: [
          { id: "hit-future", label: "적중", detail: "곧 다시 쓸 A는 RAM에 남아 있다", why: "OPT는 4번째에 다음 접근이 가장 늦은 C(7번째)를 내보내, 5번째에 쓸 A를 남겼습니다." },
          { id: "fault-oldest", label: "부재", detail: "마지막 접근이 가장 이른 A가 4번째에 나갔다", why: "마지막 접근이 가장 이른 페이지를 내보내는 것은 LRU의 기준입니다. OPT는 과거가 아니라 다음 접근을 비교합니다." },
          { id: "fault-cold", label: "부재", detail: "A를 처음 참조하는 강제 부재다", why: "A는 1번째에 이미 읽었습니다. 강제 부재는 그 페이지를 처음 참조할 때의 부재입니다." },
        ],
      },
    ],
    lru: [
      { at: 4, kind: "victim" },
      {
        at: 5,
        kind: "outcome",
        rule: "4번째 접근에서 LRU가 무엇을 기준으로 내보냈는지 떠올려 보세요.",
        correct: "fault-oldest",
        choices: [
          { id: "hit-future", label: "적중", detail: "곧 다시 쓸 A는 RAM에 남아 있다", why: "‘곧 다시 쓸 페이지를 남긴다’는 OPT의 기준입니다. LRU는 미래를 모르고, 마지막 접근이 1번째로 가장 이른 A를 4번째에 내보냈습니다." },
          { id: "fault-oldest", label: "부재", detail: "마지막 접근이 가장 이른 A가 4번째에 나갔다", why: "LRU는 지나간 접근만 봅니다. A는 1번째 이후 쓰이지 않아 4번째에 나갔고, 바로 5번째에 다시 필요해졌습니다." },
          { id: "fault-cold", label: "부재", detail: "A를 처음 참조하는 강제 부재다", why: "A는 1번째에 이미 읽었습니다. 강제 부재는 그 페이지를 처음 참조할 때의 부재입니다." },
        ],
      },
    ],
  },
  keys: {
    all: {
      0: "OPT(MIN)는 Belady가 제안한 이론상 최적 정책입니다. 같은 접근 순서에서 어떤 정책도 OPT보다 부재가 적을 수 없습니다.",
      1: "처음 참조할 때의 부재는 강제 부재(compulsory miss)입니다. 미래를 아는 OPT도 이것은 피할 수 없습니다.",
      2: "빈 프레임이 남아 있는 동안에는 어떤 정책이든 결과가 같습니다. 정책은 프레임이 찬 뒤에야 갈립니다.",
      3: "반복하는 페이지는 A~D 4개인데 프레임은 3개입니다. 다음 D부터는 하나를 내보내야 합니다.",
    },
    opt: {
      4: (step) => `OPT는 ${step.before.map((f) => `${f.page} ${f.nextUseAt}번째`).join(" · ")}의 다음 접근을 비교합니다. 이 미래 정보는 실제 운영체제가 가질 수 없습니다.`,
      5: "OPT가 남긴 A가 적중했습니다. 과거가 아니라 앞으로의 접근을 보고 고른 결과입니다.",
      6: "4번째의 선택 하나로 5·6번째 A·B가 모두 적중했습니다. 내보낸 C는 7번째에야 필요합니다.",
      9: "OPT의 부재는 이제 3~4번째 접근마다 한 번입니다. 매번 가장 늦게 필요한 페이지만 내보내기 때문입니다.",
      10: (step) => `${eun(step.victim)} 앞으로 다시 쓰이지 않습니다. OPT는 그런 페이지를 가장 먼저 내보냅니다.`,
      12: (step, run) => `부재 ${step.faults}회 중 ${compulsory(run)}회는 A~D를 처음 참조한 강제 부재입니다. 다시 읽은 부재는 ${step.faults - compulsory(run)}회뿐입니다.`,
    },
    lru: {
      4: "LRU는 마지막 접근이 1번째로 가장 이른 A를 내보냈습니다. 그런데 A는 바로 다음 5번째에 다시 쓰입니다.",
      5: "반복하는 페이지 수(4)가 프레임 수(3)보다 크면 LRU는 매번 곧 쓸 페이지를 막 내보낸 상태가 됩니다.",
      6: "OSTEP 22.6의 반복 접근(looping) 부하입니다. 이 경우 LRU와 FIFO 모두 최악의 결과를 냅니다.",
      9: "LRU의 가정(최근에 쓴 페이지를 곧 다시 쓴다)이 이 반복에서는 정반대로 틀립니다.",
      12: (step, run) => `부재 ${step.faults}회 중 ${compulsory(run)}회만 강제 부재이고, 나머지 ${step.faults - compulsory(run)}회는 내보냈다가 다시 읽은 용량 부재입니다.`,
    },
  },
  fallbackKey(step, run) {
    if (step.hit) return `${eun(step.page)} RAM에 남아 있어 저장장치를 읽지 않았습니다. 지금까지 적중 ${step.hits}회입니다.`;
    if (run.algorithm === "opt") return `${eul(step.victim)} 내보낸 이유는 미래의 접근 순서입니다. ${step.victim}의 다음 접근이 RAM의 세 페이지 중 가장 늦습니다.`;
    return `${ga(step.victim)} 나갔지만 ${step.victim}도 곧 다시 쓰입니다. 지금까지 ${step.index}번 모두 부재입니다.`;
  },
  fork: 3,
  forkText: () =>
    "<b>갈림길은 4번째 D입니다.</b> OPT는 다음 접근이 가장 늦은 C를, LRU는 마지막 접근이 가장 이른 A를 내보냅니다. 그래서 5번째 A가 OPT에서는 적중, LRU에서는 부재가 됩니다.",
  compareNote: (runs) =>
    `이 반복에서 OPT의 부재는 ${runs.opt.stats.faults}회, LRU는 ${runs.lru.stats.faults}회입니다. 반복하는 페이지가 프레임보다 많은 부하에서 LRU의 약점이 가장 크게 드러납니다.`,
  recap: (runs) => ({
    points: [
      `OPT(MIN)는 다음 접근이 가장 늦은 페이지를 내보냅니다. 이 반복에서 부재 ${runs.opt.stats.faults}회로, LRU ${runs.lru.stats.faults}회의 절반입니다.`,
      "LRU는 지나간 접근만 봅니다. 반복하는 페이지 수가 프레임 수보다 크면 매번 곧 쓸 페이지를 내보내 모든 접근이 부재가 됩니다.",
      "실제 운영체제는 미래를 알 수 없어 OPT를 쓰지 못합니다. OPT는 다른 정책이 얼마나 좋은지 재는 기준선입니다.",
    ],
    recall: [
      {
        id: "opt-victim",
        question: "OPT가 4번째 D를 넣을 때 A·B·C 중 C를 내보낸 이유는?",
        choices: [
          { label: "C의 다음 접근(7번째)이 가장 늦기 때문", correct: true, why: "A는 5번째, B는 6번째에 다시 쓰여 C보다 먼저 필요합니다." },
          { label: "C가 가장 늦게 적재됐기 때문", why: "적재 순서는 FIFO의 기준이고, FIFO라면 가장 먼저 적재된 A를 내보냅니다. OPT는 다음 접근을 비교합니다." },
          { label: "C의 마지막 접근이 가장 이르기 때문", why: "그것은 LRU의 기준입니다. C의 마지막 접근은 3번째로 오히려 가장 늦습니다." },
        ],
      },
      {
        id: "opt-real",
        question: "실제 운영체제가 OPT를 쓰지 않는 이유는?",
        choices: [
          { label: "앞으로의 접근 순서를 미리 알 수 없어서", correct: true, why: "OPT는 미래를 알아야 합니다. 그래서 시뮬레이션에서 다른 정책을 재는 기준선으로 씁니다." },
          { label: "OPT가 LRU보다 부재가 많아서", why: `OPT는 어떤 정책보다 부재가 적거나 같습니다. 이 순서에서 OPT ${runs.opt.stats.faults}회, LRU ${runs.lru.stats.faults}회입니다.` },
          { label: "OPT는 프레임이 4개 이상이어야 동작해서", why: "OPT는 프레임 수와 상관없이 정의됩니다. 이 레슨도 프레임 3개로 돌렸습니다." },
        ],
      },
    ],
  }),
  rules: [
    ["시작", "RAM 프레임 3개는 처음에 모두 비어 있습니다."],
    ["접근", "A B C D를 세 번 반복하는 12번의 읽기를 두 방식에 똑같이 적용합니다."],
    ["미래", "OPT만 앞으로의 접근 순서를 봅니다. 실제 운영체제에는 없는 정보입니다."],
  ],
});

/* ---------- 03 Belady의 모순 ---------- */

// The textbook string 1 2 3 4 1 2 5 1 2 3 4 5 with pages named A–E.
export const BELADY_PAGES = Object.freeze(["A", "B", "C", "D", "A", "B", "E", "A", "B", "C", "D", "E"]);

const BELADY = scripted({
  id: "belady",
  name: "Belady의 모순",
  sub: "FIFO · 프레임 3개와 4개",
  references: BELADY_PAGES,
  modeLabel: "프레임 수",
  modes: [
    { id: "f3", algorithm: "fifo", frameCount: 3, label: "프레임 3개" },
    { id: "f4", algorithm: "fifo", frameCount: 4, label: "프레임 4개" },
  ],
  question: "프레임을 늘리면 부재는 항상 줄어들까?",
  intro: "페이지 A~E를 정해진 순서로 12번 읽습니다. 같은 FIFO로 RAM 프레임이 3개일 때와 4개일 때를 나란히 봅니다.",
  goal: "학습 목표: FIFO에서 프레임을 늘려도 부재가 늘 수 있는 Belady의 모순이 왜 생기는지, LRU에서는 왜 생기지 않는지 설명할 수 있다.",
  endTitle: "프레임을 늘렸는데 부재가 늘었습니다",
  scenes: [
    { index: 0, title: "프레임을 늘리면 줄까", heading: "프레임을 늘리면 부재는 항상 줄어들까?" },
    { index: 4, title: "네 번째 페이지 D", heading: "네 번째 페이지가 들어올 때" },
    { index: 6, title: "프레임 4개가 앞섭니다", heading: "프레임이 많으면 처음엔 유리합니다" },
    { index: 7, title: "E가 들어올 때", heading: "FIFO는 적중을 기억하지 않습니다" },
    { index: 9, title: "순서가 뒤집힙니다", heading: "앞서던 쪽이 연달아 부재를 냅니다" },
    { index: 12, title: "결과 비교와 정리", heading: "프레임을 늘렸는데 부재가 늘었습니다" },
  ],
  endNote: () => "같은 FIFO로 프레임 3개는 부재 9회, 4개는 10회입니다.",
  quizzes: {
    f3: [
      { at: 7, kind: "victim" },
      {
        at: 8,
        kind: "outcome",
        rule: "7번째에 FIFO가 무엇을 기준으로 내보냈는지, A가 언제 적재됐는지 떠올려 보세요.",
        correct: "hit-late",
        choices: [
          { id: "hit-late", label: "적중", detail: "5번째에 다시 적재된 A는 적재 순서가 뒤쪽이라 남아 있다", why: "7번째에 적재 순서가 가장 앞선 것은 4번째에 들어온 D였습니다. A는 5번째에 다시 적재돼 남았습니다." },
          { id: "fault-first", label: "부재", detail: "7번째 E가 가장 먼저 들어온 A를 내보냈다", why: "A는 4번째에 한 번 나갔다가 5번째에 다시 적재됐습니다. 7번째에 가장 앞선 것은 D(4번째 적재)입니다." },
          { id: "fault-small", label: "부재", detail: "프레임이 3개뿐이라 A가 남을 자리가 없다", why: "프레임 수만으로 정해지지 않습니다. 7번째에 D가 나가 A와 B가 RAM에 남았습니다." },
        ],
      },
    ],
    f4: [
      { at: 7, kind: "victim" },
      {
        at: 8,
        kind: "outcome",
        rule: "7번째에 FIFO가 무엇을 기준으로 내보냈는지 떠올려 보세요. 5번째 A는 적중이었습니다.",
        correct: "fault-first",
        choices: [
          { id: "hit-more", label: "적중", detail: "프레임이 4개라 A가 남아 있다", why: "프레임이 많다고 오래 남지는 않습니다. FIFO는 7번째에 1번째로 적재된 A를 먼저 내보냈고, 5번째 적중은 그 순서를 바꾸지 않았습니다." },
          { id: "fault-first", label: "부재", detail: "7번째 E가 적재 순서가 가장 앞선 A를 내보냈다", why: "A는 1번째에 적재돼 가장 앞이었고, 5번째 적중은 FIFO의 순서를 바꾸지 않았습니다." },
          { id: "fault-cold", label: "부재", detail: "A를 처음 참조하는 강제 부재다", why: "A는 1번째에 이미 읽었습니다. 강제 부재는 그 페이지를 처음 참조할 때의 부재입니다." },
        ],
      },
    ],
  },
  keys: {
    all: {
      0: "Belady의 모순(Belady's anomaly)은 프레임을 늘렸는데 부재가 늘어나는 현상입니다. FIFO에서 생길 수 있습니다.",
      1: "처음 참조할 때의 부재는 강제 부재(compulsory miss)입니다. 프레임 수와 상관없이 A~E 다섯 번은 피할 수 없습니다.",
      2: "빈 프레임을 채우는 동안에는 프레임 수가 달라도 결과가 같습니다.",
      3: "여기까지는 두 조건이 똑같습니다. 차이는 네 번째 페이지 D에서 시작합니다.",
    },
    f3: {
      4: "프레임 3개는 이미 찼습니다. FIFO가 가장 먼저 들어온 A를 내보내고 D를 적재합니다.",
      5: "4번째에 내보낸 A를 바로 다시 읽어 용량 부재입니다. 프레임이 하나 모자라 생긴 부재입니다.",
      6: "B도 같은 이유로 부재입니다. 지금 프레임 3개는 부재 6회, 프레임 4개는 4회입니다.",
      7: "FIFO는 적재 순서만 봅니다. 4번째에 들어온 D가 가장 앞이라 나갑니다.",
      8: "A는 5번째에 다시 적재돼 적재 순서가 뒤쪽이었습니다. 그래서 남아 있어 적중입니다.",
      9: (step) => `B도 6번째에 다시 적재돼 남아 있어 적중입니다. 이제 두 조건의 부재가 ${step.faults}회로 같습니다.`,
      12: (step) => `프레임 3개의 FIFO는 부재 ${step.faults}회로 마쳤습니다. 프레임 4개일 때와 비교해 보세요.`,
    },
    f4: {
      4: "프레임 4개에는 아직 빈 자리가 있어 D를 교체 없이 적재합니다.",
      5: "A가 RAM에 남아 있어 적중입니다. FIFO는 이 적중을 기록하지 않아 A의 적재 순서는 여전히 1번째입니다.",
      6: "B도 적중입니다. 지금 프레임 4개는 부재 4회, 프레임 3개는 6회로 앞서 있습니다.",
      7: "FIFO는 적중을 기억하지 않아 5번째에 쓴 A가 나갔습니다. 이제 프레임 3개의 RAM(E·A·B)에 있는 A가 프레임 4개의 RAM에는 없습니다.",
      8: "7번째에 내보낸 A를 바로 다시 읽어 부재입니다. 프레임이 많은 쪽이 적은 쪽의 페이지를 모두 담지 못하면 이런 일이 생깁니다.",
      9: (step) => `B도 부재입니다. 8·9번째 두 번의 부재로 두 조건의 부재가 ${step.faults}회로 같아졌습니다.`,
      12: (step) => `프레임을 늘렸는데 부재는 ${step.faults}회로 더 많습니다. 이것이 Belady의 모순입니다.`,
    },
  },
  fallbackKey(step, run) {
    if (step.hit) return `${eun(step.page)} RAM에 남아 있어 적중입니다. 지금까지 부재 ${step.faults}회입니다.`;
    return `FIFO가 ${step.victim}(${step.before.find((f) => f.page === step.victim).loadedAt}번째 적재)${eul(step.victim).slice(step.victim.length)} 내보냈습니다. 지금까지 부재 ${step.faults}회입니다.`;
  },
  fork: 6,
  forkText: () =>
    "<b>갈림길은 7번째 E입니다.</b> 프레임 3개에서는 4번째에 적재된 D가, 프레임 4개에서는 1번째에 적재된 A가 나갑니다. 그 뒤 8·9번째 A·B가 3개에서는 적중, 4개에서는 부재로 갈립니다.",
  compareNote: (runs, { lruCounts }) =>
    `프레임 4개의 부재는 ${runs.f4.stats.faults}회로 3개(${runs.f3.stats.faults}회)보다 많습니다. 같은 순서에서 LRU는 ${lruCounts[0]}회 → ${lruCounts[1]}회로 줄어듭니다(스택 알고리즘).`,
  recap: (runs, { lruCounts }) => ({
    points: [
      `FIFO는 프레임을 3개에서 4개로 늘리자 부재가 ${runs.f3.stats.faults}회에서 ${runs.f4.stats.faults}회로 늘었습니다. 이것이 Belady의 모순입니다.`,
      "프레임 4개의 FIFO는 5·6번째 적중을 기록하지 않아, 7번째에 곧 쓸 A를 내보내고 8번째부터 연달아 부재를 냈습니다.",
      `LRU는 스택 알고리즘이라 프레임 n개일 때의 RAM 페이지가 n+1개일 때도 늘 RAM에 있습니다. 같은 순서에서 ${lruCounts[0]}회 → ${lruCounts[1]}회로 줄어듭니다.`,
    ],
    recall: [
      {
        id: "belady-what",
        question: "Belady의 모순이란?",
        choices: [
          { label: "FIFO에서 프레임을 늘렸는데 부재가 늘어나는 현상", correct: true, why: `이 레슨에서 프레임 3개는 ${runs.f3.stats.faults}회, 4개는 ${runs.f4.stats.faults}회였습니다.` },
          { label: "프레임을 늘리면 부재가 반드시 줄어드는 성질", why: "우리가 기대하는 성질이지만 FIFO는 이를 보장하지 않습니다. 그 예외가 Belady의 모순입니다." },
          { label: "LRU에서 프레임을 늘리면 부재가 느는 현상", why: `LRU는 스택 알고리즘이라 이 현상이 없습니다. 같은 순서에서 ${lruCounts[0]}회 → ${lruCounts[1]}회입니다.` },
        ],
      },
      {
        id: "belady-lru",
        question: "LRU에 Belady의 모순이 없는 이유는?",
        choices: [
          { label: "프레임 n개일 때 RAM의 페이지가 n+1개일 때도 늘 RAM에 있어서(스택 알고리즘)", answer: "스택 알고리즘", correct: true, why: "마지막 접근이 늦은 n개는 늘 n+1개 안에 들어 있습니다. 그래서 프레임을 늘려 부재가 늘 수 없습니다." },
          { label: "LRU가 적재 순서를 기록해서", why: "적재 순서는 FIFO의 기준이고, 바로 그 때문에 FIFO에서 모순이 생깁니다." },
          { label: "LRU가 미래의 접근을 알아서", why: "미래를 아는 것은 OPT입니다. LRU는 지나간 접근만 봅니다." },
        ],
      },
    ],
  }),
  rules: [
    ["시작", "두 조건 모두 RAM 프레임이 처음에 비어 있습니다."],
    ["접근", "A B C D A B E A B C D E, 교과서의 1 2 3 4 1 2 5 1 2 3 4 5를 A~E로 바꾼 12번의 읽기입니다."],
    ["정책", "두 조건 모두 FIFO이고, 프레임 수만 3개와 4개로 다릅니다."],
  ],
});

/* ---------- 04 클럭과 LRU ---------- */

export const CLOCK_PAGES = Object.freeze(["A", "B", "C", "D", "B", "A", "B", "C", "D"]);

const CLOCK = scripted({
  id: "clock",
  name: "클럭과 LRU",
  sub: "참조 비트로 하는 근사",
  references: CLOCK_PAGES,
  modeLabel: "교체 방식",
  modes: [
    { id: "clock", algorithm: "clock", frameCount: 3, label: "CLOCK" },
    { id: "lru", algorithm: "lru", frameCount: 3, label: "LRU" },
  ],
  question: "참조 비트 하나로 LRU를 흉내 낼 수 있을까?",
  intro: "페이지 A~D를 정해진 순서로 9번 읽고, RAM 프레임은 3개입니다. 클럭은 접근 순서를 기록하지 않고 프레임마다 참조 비트 1개와 원형으로 도는 바늘만 씁니다.",
  goal: "학습 목표: 클럭 알고리즘이 참조 비트로 두 번째 기회를 주어 LRU를 근사하는 방식과, 그 근사가 LRU와 갈리는 순간을 설명할 수 있다.",
  endTitle: "비트 하나로 한 근사",
  scenes: [
    { index: 0, title: "참조 비트로 LRU 흉내", heading: "참조 비트 하나로 LRU를 흉내 낼 수 있을까?" },
    { index: 4, title: "모든 비트가 1일 때", heading: { clock: "비트가 모두 1이면 한 바퀴를 돕니다", lru: "첫 교체: 같은 A, 다른 근거" } },
    { index: 5, title: "적중하면 비트가 켜집니다", heading: { clock: "접근이 참조 비트를 켭니다", lru: "LRU는 접근마다 기록합니다" } },
    { index: 6, title: "두 번째 기회", heading: { clock: "켜진 비트는 두 번째 기회입니다", lru: "같은 C, 다른 근거" } },
    { index: 8, title: "다시 한 바퀴", heading: { clock: "비트가 다시 모두 1입니다", lru: "마지막 접근이 가장 이른 D" } },
    { index: 9, title: "결과 비교와 정리", heading: "비트 하나로 한 근사" },
  ],
  endNote: (run) =>
    run.algorithm === "clock" ? "9번째에는 A와 B의 비트가 모두 0이라, 바늘이 먼저 닿은 B가 나갔습니다." : "9번째에는 마지막 접근이 6번째로 가장 이른 A가 나갔습니다.",
  quizzes: {
    clock: [{ at: 6, kind: "victim" }, { at: 9, kind: "victim" }],
    lru: [{ at: 6, kind: "victim" }, { at: 9, kind: "victim" }],
  },
  keys: {
    all: {
      0: "실제 하드웨어는 접근 순서를 기록하지 않고, 페이지에 접근할 때 참조 비트(use bit)만 1로 켭니다(OSTEP 22.8).",
      1: "처음 참조할 때의 부재는 강제 부재(compulsory miss)입니다. 적재하면서 그 페이지에 접근하므로 참조 비트도 1입니다.",
      2: "빈 프레임을 채우는 동안에는 바늘이 움직이지 않습니다.",
    },
    clock: {
      3: "세 프레임이 찼고 참조 비트가 모두 1입니다. 다음 부재에서 바늘이 처음으로 움직입니다.",
      4: "모든 비트가 1이면 바늘이 한 바퀴를 돌며 모두 0으로 끄고, 출발점의 A를 내보냅니다. 이때 클럭은 FIFO처럼 동작합니다.",
      5: "B에 접근하자 하드웨어가 B의 참조 비트를 다시 1로 켰습니다. 운영체제는 순서가 아니라 이 비트만 봅니다.",
      6: "B는 5번째에 쓰여 비트가 1이라 살아남고, 비트가 0인 C가 나갔습니다. 같은 RAM에서 FIFO라면 가장 먼저 적재된 B를 내보냅니다.",
      7: "B가 다시 적중했습니다. 6번째에 두 번째 기회를 준 덕분입니다.",
      8: "비트가 다시 모두 1이라 바늘이 한 바퀴를 돌았습니다. 접근이 잦으면 비트가 금방 모두 켜져 구분력이 떨어집니다.",
      9: "참조 비트 하나로는 A(6번째)와 B(7번째) 중 어느 쪽을 먼저 썼는지 알 수 없습니다. 바늘이 먼저 닿은 B가 나갔습니다.",
    },
    lru: {
      3: "세 프레임이 찼습니다. LRU는 접근할 때마다 마지막 접근을 정확히 기록합니다.",
      4: "LRU는 마지막 접근이 가장 이른 A를 내보냅니다. 클럭도 같은 A를 내보내지만 근거는 다릅니다.",
      5: "LRU는 B의 마지막 접근을 5번째로 기록합니다. 이런 기록을 접근마다 하려면 하드웨어 비용이 큽니다.",
      6: "마지막 접근이 3번째로 가장 이른 C가 나갔습니다. 클럭도 참조 비트로 같은 C를 골랐습니다.",
      7: "B가 적중했습니다. LRU는 B의 마지막 접근을 7번째로 갱신합니다.",
      8: "마지막 접근이 4번째로 가장 이른 D가 나갔습니다. 클럭도 한 바퀴를 돌아 같은 D를 내보냅니다.",
      9: "LRU는 A의 마지막 접근(6번째)이 B(7번째)보다 이르다는 것을 알아 A를 내보냈습니다. 같은 RAM에서 클럭은 B를 내보냅니다.",
      2: "빈 프레임을 채우는 동안에는 LRU도 내보낼 페이지를 고르지 않습니다.",
    },
  },
  fallbackKey(step) {
    return step.hit ? `${eun(step.page)} RAM에 남아 있어 적중입니다.` : `${ga(step.victim)} 나가고 ${ga(step.page)} 들어왔습니다.`;
  },
  fork: 8,
  forkText: () =>
    "<b>갈림길은 9번째 D입니다.</b> 6번째와 8번째에는 두 방식이 같은 페이지를 내보냈습니다. 9번째에는 A와 B의 참조 비트가 모두 0이라 클럭은 바늘이 먼저 닿은 B를, LRU는 마지막 접근이 더 이른 A를 내보냅니다.",
  compareNote: (runs, { fifo }) =>
    `이 순서에서 부재는 클럭 ${runs.clock.stats.faults}회, LRU ${runs.lru.stats.faults}회, 같은 RAM의 FIFO ${fifo}회입니다. 다른 접근 순서에서는 클럭과 LRU의 차이가 달라질 수 있습니다.`,
  recap: (runs, { fifo }) => ({
    points: [
      "클럭은 프레임마다 참조 비트 1개만 둡니다. 접근하면 1이 되고, 바늘이 지나며 1을 0으로 끄면서 두 번째 기회를 줍니다.",
      "6번째에 클럭은 5번째에 쓴 B를 살리고 C를 내보내 LRU와 같은 선택을 했습니다. 비트가 모두 1이면 한 바퀴를 돌아 FIFO처럼 동작합니다(4·8번째).",
      `비트 하나로는 순서를 다 알 수 없어 9번째에는 LRU와 다른 B를 내보냈습니다. 부재는 클럭 ${runs.clock.stats.faults}회 · LRU ${runs.lru.stats.faults}회 · FIFO ${fifo}회입니다.`,
    ],
    recall: [
      {
        id: "clock-bit",
        question: "클럭에서 바늘이 가리킨 페이지의 참조 비트가 1이면?",
        choices: [
          { label: "0으로 끄고 다음 프레임으로 넘어간다", correct: true, why: "그 페이지에 두 번째 기회를 줍니다. 다음 바퀴까지 다시 접근되지 않으면 그때 내보냅니다." },
          { label: "바로 그 페이지를 내보낸다", why: "내보내는 것은 참조 비트가 0일 때입니다. 1은 최근에 쓰였다는 표시입니다." },
          { label: "비트를 그대로 두고 넘어간다", why: "비트를 끄지 않으면 모두 1일 때 바늘이 멈추지 못합니다. 끄면서 지나가므로 한 바퀴 안에 반드시 멈춥니다." },
        ],
      },
      {
        id: "clock-why",
        question: "운영체제가 정확한 LRU 대신 클럭을 쓰는 이유는?",
        choices: [
          { label: "접근마다 순서를 기록하는 비용이 커서, 하드웨어가 켜는 참조 비트로 근사한다", answer: "참조 비트로 근사", correct: true, why: "정확한 LRU는 접근마다 기록을 고쳐야 합니다. 참조 비트는 하드웨어가 접근할 때 켜 주므로 비용이 거의 없습니다." },
          { label: "클럭이 LRU보다 항상 부재가 적어서", why: "클럭은 근사일 뿐입니다. 이 순서에서 부재 수는 같았지만 9번째 선택은 달랐습니다." },
          { label: "클럭은 미래의 접근을 알 수 있어서", why: "미래를 아는 것은 OPT입니다. 클럭은 지나간 접근의 흔적(참조 비트)만 봅니다." },
        ],
      },
    ],
  }),
  rules: [
    ["시작", "RAM 프레임 3개는 처음에 비어 있고, 바늘은 프레임 0을 가리킵니다."],
    ["접근", "A B C D B A B C D, 정해진 9번의 읽기를 두 방식에 똑같이 적용합니다."],
    ["참조 비트", "적재하거나 적중하면 그 프레임의 비트가 1이 됩니다. 바늘은 교체 뒤 다음 프레임으로 갑니다."],
  ],
});

export const LESSONS = [FIFO_LRU, OPT_LRU, BELADY, CLOCK];

/**
 * Yardsticks a lesson quotes but does not animate: OPT on the same input,
 * LRU with 3 and 4 frames, and FIFO with the lesson's frame count.
 */
export function extrasFor(lesson) {
  const frames = lesson.modes[0].frameCount;
  const faults = (algorithm, frameCount = frames) => simulate({ algorithm, frameCount, references: lesson.references }).stats.faults;
  return { opt: faults("opt"), lruCounts: [faults("lru", 3), faults("lru", 4)], fifo: faults("fifo") };
}
