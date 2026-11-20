// Lesson 03 (병합 충돌): the scenario, 핵심 장면, predictions, per-step 해설
// and 정리 (port of git/src/lesson.js, unchanged content).
import { josa } from "@/lib/josa.ts";
import { LABELS, type RecallQuestion } from "@/lib/lesson-kit.ts";
import { indexMatchesHead, RESOLUTIONS } from "./engine.ts";
import type {
  Described,
  Feedback,
  Milestone,
  Prediction,
  PredictionChoice,
  PredictionSpec,
  Source,
  StepText,
} from "./lesson-model.ts";
import type { Step } from "./types.ts";

/** The scenario shown in the header and on the start screen (목표). */
export const SCENARIO = {
  title: "같은 제목 줄, 두 변경",
  question: "두 브랜치가 같은 줄을 고치면 Git은 어떻게 할까?",
  body: "산책 안내문 welcome.txt의 제목을 main과 feature/title에서 서로 다르게 바꾼 뒤 병합합니다. 사건마다 작업 트리, 인덱스, 커밋 이력이 어떻게 달라지는지 따라가 보세요.",
  goal: `${LABELS.goal}: 공통 조상과 비교해 충돌하는 줄을 가려내고, 충돌을 풀어 병합 커밋을 만들 때까지 작업 트리·인덱스·커밋의 변화를 설명합니다.`,
};

/**
 * The 핵심 장면: the 장면 tab lists them and guided playback stops at each.
 * One list for both. Step 9 (the conflict) also stops when guided mode is
 * off, because the learner has to choose the resolution there.
 */
export const MILESTONES: Milestone[] = [
  { index: 4, label: "첫 커밋 C1" },
  { index: 8, label: "갈라진 이력" },
  { index: 9, label: "충돌" },
  { index: 10, label: "파일 편집 직후" },
  { index: 11, label: "커밋 직전" },
  { index: 12, label: "병합 완료" },
];
export const GUIDED_STOPS = MILESTONES.map((m) => m.index);
/** The resolution choice: playback cannot pass this step without one. */
export const GATE = 9;

export const SOURCES: Source[] = [
  {
    title: "Git · 브랜치와 HEAD",
    url: "https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell",
  },
  {
    title: "Git · 충돌과 병합",
    url: "https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging",
  },
  {
    title: "Git · 인덱스(스테이징)",
    url: "https://git-scm.com/docs/git-add",
  },
  {
    title: "Git · 충돌 시 저장 상태",
    url: "https://git-scm.com/docs/git-merge#_true_merge",
  },
];

/** 범위 tab: terms, the model's limits and the merge-state notes. */
export const SCOPE: [string, string][] = [
  ["작업 트리", "디스크에서 직접 편집하는 파일입니다. 저장해도 Git 이력은 바뀌지 않습니다."],
  [
    "인덱스(스테이징)",
    "다음 커밋에 담을 스냅샷입니다. git add가 작업 트리의 내용을 여기에 복사합니다.",
  ],
  [
    "커밋 · 브랜치 · HEAD",
    "커밋은 스냅샷과 부모를 기록한 이력의 한 지점, 브랜치는 커밋 하나를 가리키는 이동 가능한 이름, HEAD는 지금 작업 중인 브랜치입니다.",
  ],
  [
    "충돌",
    "공통 조상과 비교해 두 브랜치가 같은 줄(또는 바로 맞닿은 줄)을 서로 다르게 바꿔 자동 병합이 멈춘 상태입니다. 한쪽만 바꾼 줄은 Git이 자동으로 합칩니다.",
  ],
  [
    "MERGE_HEAD",
    "병합이 진행 중인 동안 Git이 가져오는 커밋(여기서는 C1)을 적어 두는 파일 .git/MERGE_HEAD입니다.",
  ],
  ["git merge --abort", "충돌 중인 병합을 취소하고 병합 전 상태(main → C2)로 되돌립니다."],
  [
    "모델의 범위",
    "로컬 저장소 하나, 브랜치 두 개, 파일 하나, 텍스트 충돌 하나의 고정 시나리오입니다. 원격 저장소·push·pull·rebase·fast-forward는 다루지 않습니다. C0–C3는 실제 해시가 아닌 이름이고, 장치 사이의 이동은 저장 상태의 변화를 나타낼 뿐입니다.",
  ],
];

const quoted = (label: string, pair: string) =>
  `‘${label}’${josa(label, pair).slice(label.length)}`;

/**
 * Predictions asked at a 핵심 장면 before the next decision, keyed by the
 * step they are asked at. `verify.step` is the step that answers the
 * question; for 10 that is step 10 itself (its git status, hidden until the
 * learner answers). Every choice carries `why`: the misconception it
 * reflects, or why it is right. `short` names it in "정답은 X입니다."
 */
export const PREDICTIONS: Record<number, PredictionSpec> = {
  8: {
    target: "병합 뒤 main의 위치",
    question: "main에서 git merge feature/title을 실행하면, 그 직후 main은 어느 커밋을 가리킬까요?",
    context: "main → C2, feature/title → C1. 두 브랜치가 같은 제목 줄을 서로 다르게 수정했습니다.",
    verify: { step: 9, label: `${LABELS.reveal} (git merge)` },
    choices: [
      {
        id: "stay",
        text: "main → C2에 그대로 남는다",
        short: "main → C2",
        correct: true,
        why: "자동으로 합칠 수 없는 줄이 있으면 병합은 새 커밋을 만들지 않고 멈춥니다. 작업 트리와 인덱스에 해결할 내용을 남기고 기다립니다.",
      },
      {
        id: "feature",
        text: "feature/title → C1으로 이동한다",
        correct: false,
        why: "merge는 브랜치를 전환하는 명령이 아닙니다. 현재 브랜치 main을 유지한 채 feature/title의 변경을 합칩니다.",
      },
      {
        id: "merge",
        text: "새 병합 커밋 C3로 이동한다",
        correct: false,
        why: "같은 줄을 양쪽이 다르게 바꾸면 Git은 어느 문장을 남길지 정하지 못합니다. 사람이 정하기 전에는 C3가 생기지 않습니다.",
      },
    ],
  },
  10: {
    target: "해결 여부",
    question: "이제 충돌이 해결된 상태일까요?",
    context:
      "작업 트리의 충돌 표시를 지우고 최종 제목을 저장했습니다. 아직 Git 명령은 실행하지 않았습니다.",
    verify: { step: 10, label: `${LABELS.reveal} (git status)` },
    choices: [
      {
        id: "done",
        text: "예. 충돌 표시를 지웠으니 해결됐다",
        correct: false,
        why: "Git은 작업 트리의 글자를 보고 판단하지 않습니다. 인덱스에 stage 1·2·3이 남아 있는 한 git status는 계속 both modified를 보여 줍니다.",
      },
      {
        id: "add",
        text: "아니요. git add로 해결을 등록해야 한다",
        short: "git add로 등록해야 한다",
        correct: true,
        why: "git add가 stage 1·2·3 항목을 지우고 작업 트리 파일을 일반 항목(stage 0)으로 등록해야 해결로 기록됩니다.",
      },
      {
        id: "again",
        text: "아니요. git merge를 다시 실행해야 한다",
        correct: false,
        why: "병합은 이미 진행 중입니다. 다시 병합할 필요 없이 고친 파일을 Git에 등록하면 됩니다.",
      },
    ],
  },
  11: {
    target: "C3의 부모 수",
    question: (choice: string | null) =>
      choice === "ours"
        ? "main 문장을 골라도 C3의 부모는 몇 개일까요?"
        : `${quoted(RESOLUTIONS.find((r) => r.id === choice)?.label ?? "선택한 해결안", "으로")} 커밋하면 C3의 부모는 몇 개일까요?`,
    context: (choice: string | null) =>
      choice === "ours"
        ? "main 문장을 골라 인덱스의 내용이 C2와 똑같습니다. git status는 병합이 아직 진행 중이라고 알려 줍니다."
        : "해결한 파일을 git add로 등록했습니다. git status는 병합이 아직 진행 중이라고 알려 줍니다.",
    verify: { step: 12, label: `${LABELS.reveal} (git commit)` },
    choices: [
      {
        id: "one",
        text: "하나 · C2만",
        correct: false,
        why: "git commit은 HEAD(C2)에 더해 가져온 커밋 C1도 부모로 기록합니다. 파일 내용과 상관없이 C1의 이력이 합쳐졌다는 사실이 남습니다.",
      },
      {
        id: "two",
        text: "둘 · C2와 C1",
        correct: true,
        why: "첫째 부모는 HEAD의 C2, 둘째 부모는 .git/MERGE_HEAD에 적힌 C1입니다. 어느 문장을 골라도 C3는 두 부모를 가집니다.",
      },
      {
        id: "none",
        text: "새 커밋이 생기지 않는다",
        correct: false,
        why: "병합이 진행 중이면 git commit이 병합 커밋을 만듭니다. 내용이 C2와 같아도 그래야 C1이 main의 이력에 들어옵니다.",
      },
    ],
  },
};
for (const q of Object.values(PREDICTIONS)) {
  const right = q.choices.find((c) => c.correct)!;
  right.short ??= right.text;
}

/** The prediction asked at a step, with wording adapted to the resolution. */
export function predictionAt(index: number, choice?: string | null): Prediction | null {
  const q = PREDICTIONS[index];
  if (!q) return null;
  const resolve = (v: string | ((choice: string | null) => string)) =>
    typeof v === "function" ? v(choice ?? null) : v;
  return { ...q, index, question: resolve(q.question), context: resolve(q.context) };
}

/** Verdict ("맞았습니다." or "정답은 ‘…’입니다.") and the picked option's why. */
export function feedback(q: { choices: PredictionChoice[] }, id: string): Feedback {
  const picked = q.choices.find((c) => c.id === id)!;
  const right = q.choices.find((c) => c.correct)!;
  const verdict = picked.correct ? LABELS.correct : LABELS.wrong(`‘${right.short!}’`);
  return {
    correct: Boolean(picked.correct),
    verdict,
    why: picked.why,
    text: `${verdict} ${picked.why}`,
  };
}

/** Stage-foot status lines. `resolvedPending` is shown while prediction 10 is open. */
export const STATE_NAMES: Record<string, string> = {
  clean: "변경 없음 · 작업 트리, 인덱스, HEAD 커밋이 같습니다",
  modified: "작업 트리만 수정됨 · 아직 git add 전입니다",
  staged: "인덱스에 준비됨 · 아직 커밋 전입니다",
  conflict: "충돌 1곳 · 병합 커밋은 아직 없습니다",
  resolved: "파일 편집 완료 · 인덱스에는 아직 세 버전이 있습니다",
  resolvedPending: "파일 편집 완료 · 충돌 표시를 지웠습니다",
  registered: "해결 등록 완료 · 병합 커밋을 기다립니다",
  done: "병합 완료 · 두 작업의 이력을 함께 보존했습니다",
};

// Terminal output as Git prints it (checked with git 2.56; tabs as spaces).
const MERGE_OUTPUT = [
  "$ git merge feature/title",
  "Auto-merging welcome.txt",
  "CONFLICT (content): Merge conflict in welcome.txt",
  "Automatic merge failed; fix conflicts and then commit the result.",
];
const STATUS_UNMERGED = [
  "$ git status",
  "On branch main",
  "You have unmerged paths.",
  '  (fix conflicts and run "git commit")',
  '  (use "git merge --abort" to abort the merge)',
  "",
  "Unmerged paths:",
  '  (use "git add <file>..." to mark resolution)',
  "        both modified:   welcome.txt",
  "",
  'no changes added to commit (use "git add" and/or "git commit -a")',
];
const STATUS_STAGED = [
  "$ git status",
  "On branch main",
  "All conflicts fixed but you are still merging.",
  '  (use "git commit" to conclude merge)',
  "",
  "Changes to be committed:",
  "        modified:   welcome.txt",
];
const STATUS_STAGED_SAME = STATUS_STAGED.slice(0, 4);

const lessons: StepText[] = [
  {
    title: SCENARIO.question,
    body: SCENARIO.body,
    goal: SCENARIO.goal,
    takeaway: null,
    details: ["처음에는 main이 C0를 가리킵니다.", "HEAD는 현재 선택한 main을 가리킵니다."],
    focus: "history",
  },
  {
    title: "브랜치를 만들어도 커밋은 하나",
    body: "feature/title을 만들고 그 브랜치로 전환했습니다. main과 feature/title은 아직 같은 C0를 가리킵니다.",
    takeaway: "브랜치는 커밋을 가리키는 이름입니다. 만들기만 해서는 새 커밋이 생기지 않습니다.",
    details: ["HEAD → feature/title로 바뀝니다.", "작업 트리와 인덱스의 내용은 그대로입니다."],
    focus: "history",
  },
  {
    title: "수정한 문장은 작업 트리에만",
    body: "제목을 ‘나만의 산책을 찾아보세요’로 고쳤습니다. 작업 트리의 파일은 달라졌지만 인덱스와 C0에는 아직 이전 제목이 있습니다.",
    takeaway: "파일 저장은 Git 커밋이 아닙니다.",
    details: ["작업 트리와 인덱스를 비교하세요.", "두 브랜치가 가리키는 커밋은 여전히 C0입니다."],
    focus: "working",
  },
  {
    title: "git add로 다음 커밋의 내용 준비",
    body: "현재 파일 내용을 인덱스(스테이징)에 담았습니다. 커밋할 제목은 준비됐지만 아직 이력에 새 커밋이 추가되지는 않았습니다.",
    takeaway: "add는 내용을 준비하고, commit은 그 내용을 이력에 기록합니다.",
    details: [
      "인덱스에는 add를 실행한 순간의 내용이 들어갑니다.",
      "feature/title은 아직 C0를 가리킵니다.",
    ],
    focus: "index",
  },
  {
    title: "C1 생성 · feature/title만 앞으로",
    body: "인덱스의 제목으로 C1을 만들었습니다. 부모는 C0이고, 현재 브랜치 feature/title이 C1을 가리킵니다. main은 C0에 남습니다.",
    takeaway: "커밋하면 현재 브랜치의 끝이 이동합니다.",
    details: [
      "작업 트리와 인덱스가 C1의 내용과 같아졌습니다.",
      "인덱스는 비워진 것이 아니라 커밋과 같아진 상태입니다.",
    ],
    focus: "history",
  },
  {
    title: "main으로 돌아오면 파일도 C0로",
    body: "HEAD가 main으로 옮겨갔습니다. 커밋을 마친 깨끗한 상태라, 작업 트리와 인덱스도 main이 가리키는 C0의 내용으로 바뀝니다.",
    takeaway: "C1의 수정은 사라지지 않았습니다. feature/title에서 계속 가리키고 있습니다.",
    details: [
      "현재 파일의 제목이 처음 문장으로 돌아왔습니다.",
      "브랜치 전환은 새 커밋을 만들지 않습니다.",
    ],
    focus: "working",
  },
  {
    title: "main에서 같은 줄을 다르게 수정",
    body: "이번에는 제목을 ‘우리 동네를 함께 걸어요’로 바꿉니다. feature/title의 C1에서 바꿨던 바로 그 줄입니다. 4번째 줄 버튼도 ‘동네 코스 보기’로 고칩니다.",
    takeaway: "두 작업은 같은 C0에서 출발해 서로 다른 방향으로 바뀌었습니다.",
    details: [
      "버튼 줄은 main에서만 바뀝니다. feature/title의 C1에서는 C0 그대로입니다.",
      "제목과 버튼 사이의 3번째 줄 ‘출발’은 어느 쪽도 바꾸지 않습니다.",
    ],
    focus: "working",
  },
  {
    title: "main의 변경도 인덱스에",
    body: "main에서 고친 제목과 버튼을 인덱스에 담았습니다. 작업 트리와 인덱스는 같아졌지만 main은 아직 C0를 가리킵니다.",
    takeaway: "같은 파일이어도 어느 시점의 내용을 커밋할지 add로 결정합니다.",
    details: [
      "이번 add는 feature/title의 C1을 수정하지 않습니다.",
      "다음 커밋의 부모는 현재 main의 끝인 C0입니다.",
    ],
    focus: "index",
  },
  {
    title: "공통 조상 C0, 서로 다른 C1과 C2",
    body: "main에 C2가 생겼습니다. C1과 C2의 부모는 모두 C0입니다. 이제 main에서 feature/title을 병합하면 Git은 두 끝을 C0와 각각 비교합니다.",
    takeaway: "병합은 현재 내용 둘뿐 아니라 공통 조상에서 무엇이 바뀌었는지도 비교합니다.",
    details: [
      "현재 쪽: main의 C2 · 가져올 쪽: feature/title의 C1.",
      "버튼 줄은 C0 대비 main만 바꿨고, 제목 줄은 양쪽이 다르게 바꿨습니다. 어느 줄을 자동으로 정할 수 있을까요?",
    ],
    focus: "merge",
  },
  {
    title: "충돌 · 커밋을 만들지 않고 멈춤",
    body: "버튼 줄은 C0에서 main만 바꿨으므로 Git이 main 쪽을 자동으로 택했습니다. 제목 줄은 양쪽이 다르게 바꿔 자동 병합이 멈췄습니다. 위쪽 HEAD 구간은 main, 아래쪽은 feature/title의 내용입니다.",
    takeaway: "HEAD → main → C2는 그대로입니다. 아직 병합 커밋 C3는 없습니다.",
    terminal: MERGE_OUTPUT,
    details: [
      "공통 조상이 있어야 ‘한쪽만 바꾼 줄’을 가려낼 수 있습니다. C0가 없으면 버튼 줄도 충돌로 보입니다.",
      "인덱스에는 공통 조상 C0(stage 1), 현재 C2(stage 2, ours), 가져올 C1(stage 3, theirs)의 세 버전이 기록됩니다.",
    ],
    focus: "merge",
  },
  {
    title: "문장은 정했지만, 해결 기록은 아직",
    body: "선택한 문장으로 작업 트리의 파일을 고치고 충돌 표시를 지웠습니다. 하지만 인덱스에는 아직 세 버전이 남아 있어 git status는 여전히 미해결로 보여 줍니다.",
    takeaway: "충돌 표시를 지우는 것과 Git에 해결을 기록하는 것은 별개입니다.",
    terminal: STATUS_UNMERGED,
    details: [
      "다음 git add가 이 파일을 해결된 내용으로 등록합니다.",
      "자동 병합된 버튼 줄 ‘동네 코스 보기’는 어느 해결안에서도 그대로 남습니다.",
    ],
    // While prediction 10 is open: only what the learner did, nothing Git reports.
    pending: {
      title: "충돌 표시를 지운 파일",
      body: "선택한 문장으로 작업 트리의 파일을 고치고 충돌 표시를 지웠습니다. 아직 Git 명령은 실행하지 않았습니다.",
      takeaway: null,
      terminal: null,
      details: ["자동 병합된 버튼 줄 ‘동네 코스 보기’는 어느 해결안에서도 그대로 남습니다."],
    },
    focus: "working",
  },
  {
    title: "해결한 내용을 등록 · 커밋 대기",
    body: "git add가 stage 1·2·3 항목을 지우고 작업 트리 파일을 일반 항목(stage 0)으로 등록했습니다. 인덱스에는 C2와 다른 제목 한 줄이 담겼습니다.",
    takeaway: "충돌 해결 등록이 끝나도 병합 커밋은 아직 만들어지지 않았습니다.",
    terminal: STATUS_STAGED,
    details: [
      "main은 C2, feature/title은 C1을 계속 가리킵니다.",
      "다음 커밋은 HEAD의 C2와 MERGE_HEAD의 C1을 부모로 갖게 됩니다.",
    ],
    // While prediction 11 is open: no word about the next commit's parents.
    pending: { details: ["main은 C2, feature/title은 C1을 계속 가리킵니다."] },
    focus: "index",
  },
  {
    title: "C3 완성 · 부모가 두 개인 커밋",
    body: "최종 문장을 담은 C3가 C2와 C1을 부모로 연결합니다. 둘째 부모 C1은 MERGE_HEAD에서 왔습니다. main은 C3로 이동하고, feature/title은 C1에 남습니다.",
    takeaway: "두 이력을 연결하되, 최종 파일 내용은 사람이 결정했습니다.",
    details: [
      "작업 트리와 인덱스, C3의 내용이 같습니다.",
      "병합해도 기존 C1·C2가 덮어써지거나 feature/title이 자동 삭제되지는 않습니다.",
    ],
    focus: "history",
  },
];

/** Eyebrow: "대표 시나리오", "핵심 장면 3/6 · 9번째 사건" or "5번째 사건". */
export function eyebrowFor(index: number): string {
  if (index === 0) return LABELS.scenario;
  const k = MILESTONES.findIndex((m) => m.index === index);
  const event = `${index}번째 사건`;
  return k < 0 ? event : `${LABELS.scene} ${k + 1}/${MILESTONES.length} · ${event}`;
}

/**
 * The 해설 for one step. `pending` is true while the prediction asked at this
 * step is still open: the step then shows nothing that answers it.
 */
export function describeStep(
  step: Step,
  { pending = false }: { pending?: boolean } = {},
): Described {
  const { pending: hidden, ...lesson } = lessons[step.index];
  let out = { ...lesson, eyebrow: eyebrowFor(step.index) } as Described;
  if (step.index === 11 && indexMatchesHead(step.state)) {
    out = {
      ...out,
      body: "main의 기존 문장을 골랐습니다. git add가 stage 1·2·3 항목을 지우고 C2와 똑같은 파일을 일반 항목(stage 0)으로 등록했습니다. 이번에는 인덱스에 C2와 달라진 줄이 없습니다.",
      takeaway: pending
        ? "파일 내용이 C2와 같아도 병합은 아직 진행 중입니다."
        : "파일 내용이 C2와 같아도 병합은 진행 중입니다. 다음 커밋은 C2와 C1을 부모로 기록합니다.",
      terminal: STATUS_STAGED_SAME,
    };
  }
  if (pending && hidden) out = { ...out, ...hidden };
  return out;
}

/** 정리: shown in 해설 once the merge commit exists. */
export const RECAP: { points: string[]; recall: RecallQuestion[] } = {
  points: [
    "병합은 공통 조상 C0와 비교합니다. 한쪽만 바꾼 버튼 줄은 자동으로 합치고, 양쪽이 다르게 바꾼 제목 줄에서 멈춥니다.",
    "충돌 표시를 지우는 것은 작업 트리 편집일 뿐입니다. git add가 stage 1·2·3을 지워 해결을 기록합니다.",
    "어느 문장을 골라도 C3는 C2와 C1, 두 부모를 가집니다. 내용은 사람이, 이력의 연결은 Git이 정합니다.",
  ],
  recall: [
    {
      id: "status-after-edit",
      question:
        "충돌 표시를 지우고 파일을 저장한 직후, git status는 welcome.txt를 어떻게 보여 줄까요?",
      choices: [
        {
          label: "both modified · 아직 미해결",
          correct: true,
          why: "Git은 인덱스를 보고 판단합니다. git add 전에는 stage 1·2·3이 남아 있어 미해결입니다.",
        },
        {
          label: "All conflicts fixed · 해결 완료",
          why: "파일 저장은 작업 트리만 바꿉니다. 해결을 기록하는 것은 git add입니다.",
        },
        {
          label: "nothing to commit · 병합 끝",
          why: "병합 커밋을 만들기 전에는 병합이 끝나지 않습니다.",
        },
      ],
    },
    {
      id: "one-sided-line",
      question: "공통 조상 C0에서 main만 바꾼 버튼 줄은 병합할 때 어떻게 될까요?",
      choices: [
        {
          label: "main의 버튼이 자동으로 들어간다",
          correct: true,
          why: "C0와 비교해 한쪽만 바뀐 줄은 그쪽 변경을 택합니다. 그래서 어느 해결안에서도 ‘동네 코스 보기’가 남습니다.",
        },
        {
          label: "제목 줄처럼 충돌한다",
          why: "양쪽이 모두 다르게 바꾼 줄(또는 바로 맞닿은 줄)만 충돌합니다. 버튼 줄은 ‘출발’ 줄을 사이에 두고 떨어져 있습니다.",
        },
        {
          label: "C0의 ‘코스 보기’로 돌아간다",
          why: "병합은 한쪽의 변경을 버리지 않습니다. feature/title이 이 줄을 그대로 둔 것은 ‘바꾸지 않음’일 뿐입니다.",
        },
      ],
    },
  ],
};
