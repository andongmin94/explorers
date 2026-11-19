// The Git explorer's lessons, in teaching order. The rail lists them
// ({ id, name, sub }); ?lesson=<id> opens one, the bare page opens the first.
//   01 fast-forward  main has not moved: git merge only moves main (vs --no-ff)
//   02 auto-merge    different lines: three-way merge makes the commit itself
//   03 conflict      the same line: stop, choose, git add, merge commit
//   04 rebase        replay C1 on C2 (C1') and fast-forward, vs a merge commit
// Every command output was checked with git 2.56 in a scratch repository.
import {
  CONTENTS,
  FILE_NAME,
  LESSON_CONTENTS,
  RESOLUTIONS,
  VERSIONS,
  changedLabels,
  compareMergeBases,
  contentKindOf,
  simulateAutoMerge,
  simulateFastForward,
  simulateGit,
  simulateRebase,
} from "./engine.js";
import * as conflict from "./lesson.js";
import { BASE_STATES, OUTPUT, feedbackFor, makeLesson } from "./lesson-model.js";
import { LABELS } from "../../shared/lesson-kit.js";

export const SOURCE = {
  branches: { title: "Pro Git 3.1 · 브랜치란", url: "https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell" },
  merging: { title: "Pro Git 3.2 · 브랜치와 병합의 기초", url: "https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging" },
  rebasing: { title: "Pro Git 3.6 · Rebase하기", url: "https://git-scm.com/book/en/v2/Git-Branching-Rebasing" },
  ff: { title: "git-merge · fast-forward", url: "https://git-scm.com/docs/git-merge#_fast_forward_merge" },
};

const changedColumn = {
  label: "C0 대비 바뀐 줄",
  value: (content) => changedLabels(content).join(" · ") || "없음",
};

/* The steps every lesson shares up to C1 (and, in 02 and 04, up to C2). */
const SETUP = [
  // 0: the start screen; question, body and goal come from the scenario.
  { details: ["처음에는 main이 C0를 가리킵니다.", "HEAD는 현재 선택한 main을 가리킵니다."], focus: "history" },
  {
    title: "브랜치를 만들어도 커밋은 하나",
    body: "feature/title을 만들고 그 브랜치로 전환했습니다. main과 feature/title은 아직 같은 C0를 가리킵니다.",
    takeaway: "브랜치는 커밋을 가리키는 이름입니다. 만들기만 해서는 새 커밋이 생기지 않습니다.",
    details: ["HEAD → feature/title로 바뀝니다.", "작업 트리와 인덱스의 내용은 그대로입니다."],
    focus: "history",
  },
  {
    title: "feature에서 제목 수정",
    body: "제목을 ‘나만의 산책을 찾아보세요’로 고쳤습니다. 작업 트리의 파일만 달라졌고 인덱스와 C0에는 이전 제목이 있습니다.",
    takeaway: "파일 저장은 Git 커밋이 아닙니다.",
    details: ["바꾼 줄은 2번째 줄 ‘제목’ 하나입니다."],
    focus: "working",
  },
  {
    title: "git add로 다음 커밋 준비",
    body: "현재 파일 내용을 인덱스에 담았습니다. 아직 이력에 새 커밋은 없습니다.",
    takeaway: "add는 내용을 준비하고, commit은 그 내용을 이력에 기록합니다.",
    details: ["feature/title과 main 모두 아직 C0를 가리킵니다."],
    focus: "index",
  },
  {
    title: "C1 생성 · feature/title만 앞으로",
    body: "인덱스의 내용으로 C1을 만들었습니다. 부모는 C0이고, HEAD가 가리키는 feature/title만 C1으로 옮겨갔습니다. main은 C0에 남습니다.",
    takeaway: "커밋하면 현재 브랜치의 끝만 이동합니다.",
    details: ["작업 트리와 인덱스가 C1의 내용과 같아졌습니다."],
    focus: "history",
  },
];

const DIVERGE = [
  {
    title: "main으로 돌아오면 파일도 C0로",
    body: "HEAD가 main으로 옮겨갔습니다. 작업 트리와 인덱스도 main이 가리키는 C0의 내용으로 바뀝니다.",
    takeaway: "C1의 수정은 사라지지 않았습니다. feature/title이 계속 가리킵니다.",
    details: ["브랜치 전환은 새 커밋을 만들지 않습니다."],
    focus: "working",
  },
  {
    title: "main에서는 버튼만 수정",
    body: "이번에는 4번째 줄 버튼을 ‘동네 코스 보기’로 고칩니다. 제목 줄은 C0 그대로 둡니다.",
    takeaway: "두 작업은 같은 C0에서 출발해 서로 다른 줄을 바꿨습니다.",
    details: ["제목(2번째 줄)과 버튼(4번째 줄) 사이의 ‘출발’ 줄은 어느 쪽도 바꾸지 않습니다."],
    focus: "working",
  },
  {
    title: "main의 변경도 인덱스에",
    body: "main에서 고친 버튼을 인덱스에 담았습니다. main은 아직 C0를 가리킵니다.",
    takeaway: "다음 커밋의 부모는 현재 main의 끝인 C0입니다.",
    details: ["이번 add는 feature/title의 C1을 바꾸지 않습니다."],
    focus: "index",
  },
  {
    title: "공통 조상 C0, 서로 다른 C1과 C2",
    body: "main에 C2가 생겼습니다. C1과 C2의 부모는 모두 C0입니다. 두 끝을 나란히 놓으면 제목 줄과 버튼 줄, 두 줄이 다릅니다.",
    takeaway: "이력이 갈라졌습니다. C1에도 C2에도 상대의 변경이 없습니다.",
    details: ["C1: 새 제목 · 옛 버튼 / C2: 옛 제목 · 새 버튼."],
    focus: "history",
  },
];

/* ------------------------------------------------------------ 01 */

const fastForward = makeLesson({
  id: "fast-forward",
  name: "Fast-forward",
  sub: "갈라지지 않은 이력의 병합",
  title: "main이 그대로일 때의 병합",
  scenario: {
    question: "갈라지지 않았으면 병합 커밋이 생길까?",
    body: "feature/title에서 welcome.txt의 제목을 고쳐 커밋합니다. 그동안 main에는 아무 커밋도 생기지 않습니다. 이 상태에서 main으로 feature/title을 병합합니다.",
    goal: `${LABELS.goal}: main이 브랜치 이후 움직이지 않았을 때 git merge가 포인터만 옮기는 fast-forward를 설명하고, --no-ff가 남기는 병합 커밋과 구별합니다.`,
  },
  simulate: simulateFastForward,
  variants: [
    { id: "ff", label: "git merge (fast-forward)" },
    { id: "no-ff", label: "git merge --no-ff" },
  ],
  fork: 5,
  milestones: {
    ff: [
      { index: 3, label: "커밋 직전" },
      { index: 4, label: "C1 · main은 그대로" },
      { index: 5, label: "병합 직전" },
      { index: 6, label: "fast-forward" },
    ],
    "no-ff": [
      { index: 3, label: "커밋 직전" },
      { index: 4, label: "C1 · main은 그대로" },
      { index: 5, label: "병합 직전" },
      { index: 6, label: "--no-ff 병합 커밋" },
    ],
  },
  predictions: {
    3: {
      target: "커밋 뒤 main의 위치",
      question: "지금 git commit을 하면 main은 어느 커밋을 가리킬까요?",
      context: "HEAD → feature/title → C0, main → C0. 고친 제목이 인덱스에 준비돼 있습니다.",
      verify: { step: 4, label: `${LABELS.reveal} (git commit)` },
      choices: [
        {
          id: "stay",
          text: "C0 그대로",
          correct: true,
          why: "커밋은 HEAD가 가리키는 브랜치, 지금은 feature/title만 앞으로 옮깁니다. main은 C0에 남습니다.",
        },
        {
          id: "follow",
          text: "새 커밋 C1으로 함께 이동",
          why: "브랜치는 각자 따로 움직이는 이름입니다. 같은 커밋에서 출발했어도 현재 브랜치가 아닌 main은 따라오지 않습니다.",
        },
        {
          id: "none",
          text: "어느 커밋도 가리키지 않는다",
          why: "HEAD가 다른 브랜치로 옮겨가도 main이라는 이름은 지워지지 않고 원래 커밋을 계속 가리킵니다.",
        },
      ],
    },
    5: {
      target: "병합 커밋이 생길지",
      question: "main에서 git merge feature/title을 실행하면 새 커밋이 생길까요?",
      context: "main → C0, feature/title → C1. C1의 부모는 C0이고, main에는 그 뒤로 커밋이 없습니다.",
      verify: { step: 6, label: `${LABELS.reveal} (git merge)` },
      variant: "ff",
      choices: [
        {
          id: "move",
          text: "아니요. main이 C1으로 옮겨질 뿐이다",
          short: "main이 C1으로 옮겨질 뿐",
          correct: true,
          why: "main의 끝 C0가 C1의 조상이라 합칠 갈래가 없습니다. Git은 main을 C1까지 앞으로 옮기고(fast-forward) 새 커밋을 만들지 않습니다.",
        },
        {
          id: "commit",
          text: "예. 부모가 둘인 병합 커밋이 생긴다",
          why: "병합 커밋은 갈라진 두 갈래를 잇는 커밋입니다. 갈라지지 않은 이력에서는 --no-ff를 붙일 때만 만들어집니다.",
        },
        {
          id: "conflict",
          text: "충돌이 나서 멈춘다",
          why: "main은 C0 이후 아무것도 바꾸지 않았습니다. 양쪽이 바꾼 줄이 없으니 충돌할 곳도 없습니다.",
        },
      ],
    },
  },
  steps: {
    common: [
      ...SETUP,
      {
        title: "main으로 돌아오기 · main은 C0 그대로",
        body: "HEAD가 main으로 옮겨가고 작업 트리와 인덱스도 C0의 내용이 됐습니다. main은 브랜치를 만든 뒤로 한 번도 움직이지 않았습니다.",
        takeaway: "C1은 main의 끝 C0 바로 다음에 이어진 커밋입니다.",
        details: ["main → C0, feature/title → C1.", "C0에서 C1까지는 갈라짐 없이 한 줄입니다."],
        focus: "history",
      },
    ],
    ff: [
      {
        title: "main이 C1으로 이동 · 새 커밋 없음",
        body: "Git은 main을 C1까지 앞으로 옮겼습니다(fast-forward). 작업 트리와 인덱스도 C1의 내용이 됐습니다. 커밋은 여전히 두 개입니다.",
        takeaway: "갈라지지 않은 이력의 병합은 포인터 이동입니다. 합칠 것이 없으니 병합 커밋도 없습니다.",
        terminal: OUTPUT.fastForward("C0", "C1"),
        details: ["main과 feature/title이 같은 C1을 가리킵니다.", "실제 출력의 Updating 뒤에는 C0, C1 대신 짧은 해시가 나옵니다."],
        focus: "history",
      },
    ],
    "no-ff": [
      {
        title: "--no-ff · 병합 커밋 C2",
        body: "--no-ff를 붙이면 fast-forward가 가능해도 병합 커밋을 만듭니다. C2의 부모는 C0와 C1이고, 파일 내용은 C1과 같습니다.",
        takeaway: "--no-ff는 ‘여기서 기능 브랜치를 합쳤다’는 기록을 이력에 남깁니다.",
        terminal: OUTPUT.mergeCommit("git merge --no-ff feature/title", false),
        details: ["main → C2, feature/title → C1.", "커밋 메시지는 편집기에서 확인하며 기본값은 ‘Merge branch 'feature/title'’입니다."],
        focus: "history",
      },
    ],
  },
  done: {
    ff: "병합 완료 · main이 C1으로 앞으로 이동했습니다",
    "no-ff": "병합 완료 · 병합 커밋 C2가 C0와 C1을 잇습니다",
  },
  recap: {
    points: [
      "main이 브랜치 이후 움직이지 않았다면 git merge는 main을 앞으로 옮길 뿐입니다(fast-forward). 새 커밋은 없습니다.",
      "--no-ff는 같은 상황에서도 부모가 둘인 병합 커밋을 만들어 기능 브랜치의 흔적을 남깁니다. 파일 내용은 같습니다.",
      "병합 커밋이 꼭 필요한 것은 이력이 갈라졌을 때입니다.",
    ],
    recall: [
      {
        id: "ff-when",
        question: "main → C0, feature → C2이고 C0는 C2의 조상입니다. main에서 git merge feature를 하면?",
        answer: "main이 C2로 이동",
        choices: [
          { label: "main이 C2로 이동 · 새 커밋 없음", correct: true, why: "main의 끝이 상대의 조상이면 갈래가 없습니다. Git은 포인터만 앞으로 옮깁니다." },
          { label: "부모가 둘인 병합 커밋이 생긴다", why: "그것은 --no-ff를 붙였을 때입니다. 기본 git merge는 fast-forward가 가능하면 커밋을 만들지 않습니다." },
          { label: "충돌로 멈춘다", why: "main은 아무것도 바꾸지 않았습니다. 충돌은 양쪽이 같은 줄을 다르게 바꿨을 때만 생깁니다." },
        ],
      },
      {
        id: "ff-same",
        question: "fast-forward 병합과 --no-ff 병합의 결과에서 같은 것은?",
        answer: "작업 트리의 파일 내용",
        choices: [
          { label: "작업 트리의 파일 내용", correct: true, why: "둘 다 C1의 변경을 그대로 가져옵니다. 다른 것은 이력의 모양입니다." },
          { label: "커밋 수", why: "--no-ff는 병합 커밋 하나를 더 만듭니다. fast-forward는 커밋을 만들지 않습니다." },
          { label: "main이 가리키는 커밋", why: "fast-forward는 main → C1, --no-ff는 main → 새 병합 커밋 C2입니다." },
        ],
      },
    ],
  },
  scope: [
    ["fast-forward", "현재 브랜치의 끝이 가져올 커밋의 조상일 때, 병합 커밋 없이 브랜치 포인터만 앞으로 옮기는 병합입니다."],
    ["--no-ff", "fast-forward가 가능해도 부모가 둘인 병합 커밋을 만들게 하는 옵션입니다."],
    ["--ff-only", "fast-forward가 불가능하면 병합을 거부하는 옵션입니다. 이 레슨에서는 다루지 않습니다."],
    ["모델의 범위", "로컬 저장소 하나, 브랜치 두 개, 파일 하나입니다. C0–C2는 실제 해시가 아닌 이름이고, 터미널 출력의 Updating 줄에도 이 이름을 씁니다."],
  ],
  sources: [SOURCE.merging, SOURCE.ff, SOURCE.branches],
  layout: { nodes: { C0: [19.1, 2.2], C1: [22, 6], C2: [24.9, 2.2] }, versions: VERSIONS.fastForward },
  commitColumn: changedColumn,
  comparison: {
    title: "fast-forward와 --no-ff",
    fork: "갈림길: main이 움직이지 않았다면 Git은 기본으로 포인터만 옮기고, --no-ff는 그래도 병합 커밋을 남깁니다.",
    rows: ["명령", "새 커밋", "main의 위치", "이력 모양", "파일 내용"],
    columns: [
      { variant: "ff", label: "fast-forward", values: ["git merge feature/title", "없음", "C1 (feature/title과 같은 커밋)", "C0 → C1 한 줄", "C1과 같음"] },
      { variant: "no-ff", label: "--no-ff", values: ["git merge --no-ff feature/title", "C2 · 부모 C0 + C1", "C2", "갈라졌다 C2에서 합쳐짐", "C1과 같음"] },
    ],
  },
  result: {
    ff: { headline: "fast-forward · 포인터만 이동", text: "main이 C1으로 앞으로 옮겨졌습니다. 이력은 한 줄이고 새 커밋은 없습니다." },
    "no-ff": { headline: "--no-ff · 병합 커밋", text: "C1과 같은 내용의 병합 커밋 C2가 C0와 C1을 잇습니다." },
  },
});

/* ------------------------------------------------------------ 02 */

const autoMerge = makeLesson({
  id: "auto-merge",
  name: "3-way 자동 병합",
  sub: "다른 줄, 공통 조상",
  title: "다른 줄을 고친 두 브랜치",
  scenario: {
    question: "서로 다른 줄을 고쳤다면 Git이 혼자 합칠 수 있을까?",
    body: "feature/title은 제목(2번째 줄)을, main은 버튼(4번째 줄)을 고칩니다. 두 줄 사이의 ‘출발’ 줄은 그대로입니다. 병합할 때 공통 조상 C0가 어떤 역할을 하는지 따라가 보세요.",
    goal: `${LABELS.goal}: 두 끝과 공통 조상을 함께 비교하는 3-way 병합이 줄마다 바뀐 쪽을 고르는 원리를 설명하고, 두 끝만 비교하면 왜 정할 수 없는지 말합니다.`,
  },
  simulate: simulateAutoMerge,
  variants: [{ id: "three-way", label: "3-way 병합 (C0와 비교)" }],
  fork: 8,
  milestones: {
    "three-way": [
      { index: 4, label: "첫 커밋 C1" },
      { index: 7, label: "C2 직전" },
      { index: 8, label: "갈라진 이력" },
      { index: 9, label: "자동 병합" },
    ],
  },
  predictions: {
    7: {
      target: "두 끝의 차이",
      question: "C1과 곧 만들 C2, 두 끝만 나란히 놓으면 몇 줄이 다를까요?",
      context: "feature/title의 C1은 제목만, main의 다음 커밋 C2는 버튼만 고칩니다.",
      verify: { step: 8, label: `${LABELS.reveal} (git commit)` },
      choices: [
        {
          id: "one",
          text: "1줄 · 각자 한 줄씩 고쳤으니",
          why: "각자 한 줄씩 바꿨어도 두 끝에는 상대의 변경이 없습니다. C1은 새 제목·옛 버튼, C2는 옛 제목·새 버튼이라 두 줄이 다릅니다.",
        },
        {
          id: "two",
          text: "2줄 · 제목과 버튼",
          short: "2줄",
          correct: true,
          why: "C1과 C2는 제목 줄도 버튼 줄도 서로 다릅니다. 두 끝만 보아서는 어느 쪽이 바꾼 줄인지 알 수 없습니다.",
        },
        {
          id: "zero",
          text: "0줄 · 다른 줄을 고쳐 겹치지 않는다",
          why: "겹치지 않는 것은 ‘바꾼 줄’입니다. 결과 파일끼리 비교하면 각자 바꾼 줄이 모두 차이로 보입니다.",
        },
      ],
    },
    8: {
      target: "병합 결과",
      question: "main에서 git merge feature/title을 실행하면 어떻게 될까요?",
      context: "main → C2(버튼 수정), feature/title → C1(제목 수정). 두 커밋의 부모는 모두 C0입니다.",
      verify: { step: 9, label: `${LABELS.reveal} (git merge)` },
      choices: [
        {
          id: "conflict",
          text: "두 줄이 달라서 충돌로 멈춘다",
          why: "충돌은 양쪽이 같은 줄(또는 맞닿은 줄)을 다르게 바꿨을 때입니다. C0와 비교하면 각 줄은 한쪽만 바꿨습니다.",
        },
        {
          id: "commit",
          text: "Git이 병합 커밋 C3를 바로 만든다",
          short: "병합 커밋 C3를 바로 만든다",
          correct: true,
          why: "C0와 비교하면 제목은 feature만, 버튼은 main만 바꿨습니다. Git이 줄마다 바뀐 쪽을 택해 C2와 C1을 부모로 하는 C3를 만듭니다.",
        },
        {
          id: "ff",
          text: "main이 C1으로 fast-forward한다",
          why: "main에 C2가 생겨 이력이 갈라졌습니다. main의 끝 C2가 C1의 조상이 아니니 포인터만 옮길 수 없습니다.",
        },
      ],
    },
  },
  steps: {
    common: [...SETUP, ...DIVERGE.slice(0, 3), {
      ...DIVERGE[3],
      // While prediction 8 is open: nothing about how the merge will go.
      pending: { takeaway: "이력이 갈라졌습니다. C1에도 C2에도 상대의 변경이 없습니다." },
    }],
    "three-way": [
      {
        title: "자동 병합 · 병합 커밋 C3",
        body: "Git이 C0·C2·C1 세 버전을 비교했습니다. 제목 줄은 C0 대비 feature만, 버튼 줄은 main만 바꿨으므로 각각 바뀐 쪽을 택했습니다. 고칠 곳이 없어 곧바로 C2와 C1을 부모로 하는 C3를 만들었습니다.",
        takeaway: "공통 조상이 있어 ‘누가 바꿨는지’ 가려낼 수 있습니다. 그래서 다른 줄의 변경은 자동으로 합쳐집니다.",
        terminal: OUTPUT.mergeCommit("git merge feature/title", true),
        details: ["2 +-는 첫째 부모 C2 대비 바뀐 제목 한 줄입니다.", "C3의 메시지는 기본값 ‘Merge branch 'feature/title'’입니다."],
        focus: "merge",
      },
    ],
  },
  done: { "three-way": "병합 완료 · C3가 두 변경을 모두 담았습니다" },
  recap: {
    points: [
      "병합은 두 끝 C2·C1과 공통 조상 C0, 세 버전을 비교합니다(3-way).",
      "C0 대비 한쪽만 바꾼 줄은 그쪽 변경을 택합니다. 서로 다른 줄을 고쳤다면 Git이 스스로 병합 커밋을 만듭니다.",
      "두 끝만 비교하면 다른 줄마다 누가 바꿨는지 알 수 없습니다. 공통 조상이 있어야 자동 병합이 됩니다.",
    ],
    recall: [
      {
        id: "auto-lines",
        question: "C0에서 main은 1번째 줄만, feature는 5번째 줄만 고쳤습니다. 병합하면?",
        answer: "두 변경을 담은 병합 커밋이 생긴다",
        choices: [
          { label: "두 변경을 담은 병합 커밋이 생긴다", correct: true, why: "C0 대비 각 줄을 한쪽만 바꿨으니 Git이 줄마다 바뀐 쪽을 택합니다." },
          { label: "5번째 줄에서 충돌한다", why: "main은 5번째 줄을 바꾸지 않았습니다. 한쪽만 바꾼 줄은 충돌하지 않습니다." },
          { label: "main이 fast-forward한다", why: "양쪽 모두 커밋해 이력이 갈라졌습니다. 포인터만 옮길 수 없습니다." },
        ],
      },
      {
        id: "auto-base",
        question: "두 끝 C2와 C1만 비교하면 왜 버튼 줄을 정할 수 없을까요?",
        answer: "어느 쪽이 바꿨는지 모르기 때문",
        choices: [
          { label: "어느 쪽이 바꿨는지 모르기 때문", correct: true, why: "‘코스 보기’와 ‘동네 코스 보기’ 중 무엇이 원래 문장인지는 C0를 봐야 압니다." },
          { label: "버튼 줄이 한쪽에만 있어서", why: "버튼 줄은 C1과 C2 모두에 있습니다. 내용이 다를 뿐입니다." },
          { label: "버튼 줄은 언제나 충돌로 처리돼서", why: "줄의 종류는 상관없습니다. C0와 비교해 한쪽만 바꿨으면 자동으로 합쳐집니다." },
        ],
      },
    ],
  },
  scope: [
    ["공통 조상(병합 기준)", "두 브랜치가 갈라지기 전 마지막 공통 커밋입니다. 여기서는 C0입니다. Git이 자동으로 찾습니다."],
    ["3-way 병합", "공통 조상과 두 끝, 세 버전을 비교합니다. 한쪽만 바꾼 줄은 그쪽을, 양쪽이 같게 바꾼 줄은 그 내용을 택합니다."],
    ["2-way 비교", "두 끝만 비교하는 생각 실험입니다. 다른 줄마다 누가 바꿨는지 알 수 없습니다. Git은 이렇게 병합하지 않습니다."],
    ["모델의 범위", "로컬 저장소 하나, 파일 하나, 서로 떨어진 두 줄의 변경입니다. C0–C3는 실제 해시가 아닌 이름입니다."],
  ],
  sources: [SOURCE.merging, SOURCE.branches],
  layout: { nodes: { C0: [19.1, 2.2], C1: [22, 6], C2: [22, 2.2], C3: [24.9, 2.2] }, versions: VERSIONS.diverged },
  commitColumn: changedColumn,
  comparison: {
    title: "두 끝만 비교 vs 공통 조상과 비교",
    fork: "갈림길: 같은 C2와 C1이라도 C0를 함께 보면 줄마다 누가 바꿨는지 알 수 있습니다. 두 끝만 보면 다른 줄은 모두 사람이 정해야 합니다.",
    note: "두 끝만 비교하는 방식은 생각 실험입니다. Git은 언제나 공통 조상을 찾아 3-way로 병합합니다.",
    lines: compareMergeBases(),
  },
  result: {
    "three-way": { headline: "3-way 자동 병합", text: "C0와 비교해 줄마다 바뀐 쪽을 택했습니다. C3에는 새 제목과 새 버튼이 함께 있습니다." },
  },
});

/* ------------------------------------------------------------ 04 */

const rebase = makeLesson({
  id: "rebase",
  name: "Rebase와 Merge",
  sub: "커밋을 다시 적용해 한 줄로",
  title: "갈라진 이력을 한 줄로",
  scenario: {
    question: "병합 커밋 없이 갈라진 이력을 합칠 수 있을까?",
    body: "레슨 02와 같은 두 커밋, feature의 제목 C1과 main의 버튼 C2에서 시작합니다. 이번에는 feature/title에서 git rebase main을 실행한 뒤 main으로 병합합니다.",
    goal: `${LABELS.goal}: rebase가 커밋을 새 부모 위에 다시 만들어(C1 → C1') 이력을 한 줄로 만드는 과정을 설명하고, 병합 커밋을 남기는 merge와 비교합니다.`,
  },
  simulate: simulateRebase,
  variants: [
    { id: "rebase", label: "rebase 후 fast-forward" },
    { id: "merge", label: "merge (병합 커밋)" },
  ],
  fork: 8,
  milestones: {
    rebase: [
      { index: 8, label: "갈라진 이력" },
      { index: 9, label: "rebase 직전" },
      { index: 10, label: "C1' 생성" },
      { index: 11, label: "병합 직전" },
      { index: 12, label: "한 줄 이력" },
    ],
    merge: [
      { index: 8, label: "갈라진 이력" },
      { index: 9, label: "병합 커밋 C3" },
    ],
  },
  predictions: {
    9: {
      variant: "rebase",
      target: "rebase 뒤 feature/title",
      question: "git rebase main을 실행하면 feature/title은 어느 커밋을 가리킬까요?",
      context: "feature/title → C1(부모 C0), main → C2(부모 C0). HEAD는 feature/title입니다.",
      verify: { step: 10, label: `${LABELS.reveal} (git rebase)` },
      choices: [
        {
          id: "same",
          text: "C1 그대로 · 부모만 C2로 바뀐다",
          why: "커밋은 한번 만들면 고칠 수 없습니다. 부모가 다르면 같은 변경이라도 다른 커밋이라, Git은 새 커밋을 만듭니다.",
        },
        {
          id: "new",
          text: "새 커밋 C1' · 부모는 C2",
          short: "새 커밋 C1'",
          correct: true,
          why: "rebase는 C1이 C0에서 바꾼 내용을 C2 위에 다시 적용해 새 커밋 C1'을 만들고 feature/title을 옮깁니다.",
        },
        {
          id: "merge",
          text: "병합 커밋 C3 · 부모 C2와 C1",
          why: "그것은 merge의 결과입니다. rebase는 병합 커밋을 만들지 않고 커밋을 다시 적용합니다.",
        },
      ],
    },
    11: {
      variant: "rebase",
      target: "rebase 뒤의 병합",
      question: "이제 main에서 git merge feature/title을 실행하면 어떻게 될까요?",
      context: "main → C2, feature/title → C1'. HEAD는 main입니다.",
      verify: { step: 12, label: `${LABELS.reveal} (git merge)` },
      choices: [
        {
          id: "ff",
          text: "main이 C1'으로 이동 · 새 커밋 없음",
          short: "main이 C1'으로 이동",
          correct: true,
          why: "C1'의 부모가 C2, 즉 main의 끝입니다. 갈래가 없으니 레슨 01처럼 fast-forward로 main만 앞으로 옮깁니다.",
        },
        {
          id: "commit",
          text: "부모가 둘인 병합 커밋이 생긴다",
          why: "rebase로 이력이 한 줄이 됐습니다. 합칠 갈래가 없으니 병합 커밋도 필요 없습니다.",
        },
        {
          id: "both",
          text: "C1과 C1'이 둘 다 main에 들어온다",
          why: "main의 이력은 부모를 따라갑니다. C1'의 부모는 C2라서 원래 C1은 main의 이력에 들어오지 않습니다.",
        },
      ],
    },
  },
  steps: {
    common: [...SETUP, ...DIVERGE],
    rebase: [
      {
        title: "feature/title로 전환",
        body: "HEAD가 feature/title로 옮겨가 작업 트리에 C1의 내용이 펼쳐졌습니다. 제목은 새 것이고, 버튼은 아직 C0의 ‘코스 보기’입니다.",
        takeaway: "rebase는 옮길 브랜치에서 실행합니다. 여기서는 feature/title을 main 위로 옮깁니다.",
        details: ["main → C2, feature/title → C1."],
        focus: "working",
      },
      {
        title: "C1을 C2 위에 다시 적용 · C1'",
        body: "Git이 C1의 변경(제목 줄)을 C2 위에 다시 적용해 새 커밋 C1'을 만들었습니다. C1'의 부모는 C2이고, 새 제목과 main의 버튼을 함께 담습니다. feature/title은 C1'으로 옮겨졌습니다.",
        takeaway: "C1과 C1'은 같은 변경이지만 부모가 달라 다른 커밋입니다. 원래 C1은 이제 어느 브랜치도 가리키지 않습니다.",
        terminal: OUTPUT.rebase,
        details: ["실제 Git은 ‘Rebasing (1/1)’ 진행 표시 뒤에 이 줄을 출력합니다.", "C1'의 메시지는 C1과 같은 ‘나만의 산책 제목’입니다."],
        focus: "history",
      },
      {
        title: "main으로 돌아오기",
        body: "HEAD가 main으로 옮겨가 작업 트리가 C2의 내용이 됐습니다. feature/title의 C1'은 C2 바로 다음에 이어진 커밋입니다.",
        takeaway: "rebase는 feature/title만 옮겼습니다. main은 아직 C2에 있습니다.",
        details: ["main → C2, feature/title → C1'."],
        focus: "history",
      },
      {
        title: "main이 C1'으로 이동 · 한 줄 이력",
        body: "main이 C1'까지 앞으로 이동했습니다(fast-forward). 이력은 C0 → C2 → C1' 한 줄이고 병합 커밋은 없습니다.",
        takeaway: "rebase는 이력을 한 줄로 만들지만 커밋을 새로 만듭니다. 이미 push해 남이 받은 커밋은 rebase하지 않습니다(Pro Git 3.6).",
        terminal: OUTPUT.fastForward("C2", "C1'"),
        details: ["최종 파일은 merge로 합친 결과와 같습니다.", "원래 C1은 저장소에 남지만 어느 브랜치의 이력에도 없습니다."],
        focus: "history",
      },
    ],
    merge: [
      {
        title: "merge · 병합 커밋 C3",
        body: "main에서 바로 병합했습니다. 레슨 02처럼 C2와 C1을 부모로 하는 병합 커밋 C3가 생기고, 갈라졌던 모양이 이력에 그대로 남습니다.",
        takeaway: "merge는 기존 커밋을 바꾸지 않습니다. 대신 병합 커밋이 하나 늘어납니다.",
        terminal: OUTPUT.mergeCommit("git merge feature/title", true),
        details: ["main → C3, feature/title → C1.", "최종 파일은 rebase로 합친 결과와 같습니다."],
        focus: "merge",
      },
    ],
  },
  done: {
    rebase: "완료 · C0 → C2 → C1' 한 줄 이력, 병합 커밋 없음",
    merge: "병합 완료 · C3가 갈라진 두 이력을 잇습니다",
  },
  recap: {
    points: [
      "rebase는 feature의 커밋을 main 끝 위에 다시 적용해 새 커밋(C1 → C1')을 만듭니다. 이어지는 main 병합은 fast-forward라 이력이 한 줄입니다.",
      "merge는 기존 커밋을 그대로 두고 두 부모의 병합 커밋을 남깁니다. 최종 파일은 같습니다.",
      "rebase는 커밋을 버리고 새로 만듭니다. 이미 push해 남이 받은 커밋은 rebase하지 않습니다(Pro Git 3.6).",
    ],
    recall: [
      {
        id: "rebase-id",
        question: "rebase 뒤 C1'과 원래 C1의 관계는?",
        answer: "같은 변경, 다른 커밋",
        choices: [
          { label: "같은 변경을 담은 다른 커밋 · 부모가 다르다", correct: true, why: "C1'은 C1의 변경을 C2 위에 다시 적용한 새 커밋입니다. 부모가 달라 id도 다릅니다." },
          { label: "이름만 바뀐 같은 커밋", why: "커밋은 고칠 수 없습니다. 부모가 바뀌면 새 커밋이 생깁니다." },
          { label: "C1을 부모로 하는 다음 커밋", why: "C1'의 부모는 C2입니다. C1은 C1'의 이력에 들어 있지 않습니다." },
        ],
      },
      {
        id: "rebase-shared",
        question: "동료가 이미 받아 간 feature 커밋을 rebase해 다시 push하면?",
        answer: "같은 변경이 두 번 들어올 수 있다",
        choices: [
          { label: "동료 쪽에 옛 커밋이 남아 같은 변경이 두 번 들어올 수 있다", correct: true, why: "동료의 이력은 옛 C1을 기준으로 이어집니다. 새 C1'과 다시 합치면 같은 변경이 중복되고 이력이 꼬입니다." },
          { label: "내용이 같으니 아무 문제 없다", why: "내용은 같아도 커밋은 다릅니다. Git은 C1과 C1'을 서로 다른 커밋으로 다룹니다." },
          { label: "Git이 rebase를 거부한다", why: "로컬 rebase는 언제나 가능합니다. 그래서 공유한 커밋은 rebase하지 않는 규칙이 필요합니다." },
        ],
      },
    ],
  },
  scope: [
    ["rebase", "현재 브랜치의 커밋을 다른 커밋 위에 다시 적용해 새 커밋으로 만듭니다. 원래 커밋은 브랜치에서 빠집니다."],
    ["C1'", "C1의 변경을 C2 위에 다시 적용한 새 커밋입니다. 실제 Git에서는 해시가 완전히 다릅니다."],
    ["rebase의 위험", "이미 저장소 밖에 내보내 다른 사람이 받은 커밋은 rebase하지 않습니다. 동료의 이력과 어긋나 같은 변경이 중복됩니다(Pro Git 3.6)."],
    ["모델의 범위", "로컬 저장소 하나, feature 커밋 하나입니다. 대화형 rebase, 충돌이 나는 rebase, push·pull은 다루지 않습니다."],
  ],
  sources: [SOURCE.rebasing, SOURCE.merging],
  layout: {
    nodes: { C0: [19.1, 2.2], C1: [22, 6], C2: [22, 2.2], "C1'": [24.9, 2.2], C3: [24.9, 2.2] },
    below: ["C1'"],
    versions: VERSIONS.diverged,
  },
  commitColumn: changedColumn,
  comparison: {
    title: "rebase와 merge",
    fork: "갈림길: 같은 두 커밋을 합치되, rebase는 커밋을 다시 만들어 한 줄로, merge는 커밋을 그대로 두고 병합 커밋으로 잇습니다.",
    rows: ["새로 생긴 커밋", "이력 모양", "원래 C1", "최종 파일", "공유한 커밋에"],
    columns: [
      { variant: "rebase", label: "rebase", values: ["C1' (C1을 다시 만든 것)", "C0 → C2 → C1' 한 줄", "어느 브랜치에도 없음", "새 제목 · 동네 코스 보기", "쓰지 않기"] },
      { variant: "merge", label: "merge", values: ["C3 (부모 C2 + C1)", "갈라졌다 C3에서 합쳐짐", "그대로 이력에 남음", "새 제목 · 동네 코스 보기", "안전"] },
    ],
  },
  result: {
    rebase: { headline: "rebase · 한 줄 이력", text: "C1을 C2 위에 다시 적용한 C1'까지 main이 앞으로 이동했습니다. 병합 커밋은 없습니다." },
    merge: { headline: "merge · 병합 커밋", text: "C2와 C1을 부모로 하는 C3가 갈라진 이력을 잇습니다." },
  },
});

/* ------------------------------------------------------------ 03 */

const indexHidden = (index, pending, state) => pending && state.status === "resolved";

/** Lesson 03 (lesson.js, unchanged content) in the shape main.js drives. */
const conflictLesson = {
  id: "conflict",
  name: "병합 충돌",
  sub: "같은 줄을 고친 두 브랜치",
  title: "갈라진 작업을 하나의 이력으로",
  scenario: conflict.SCENARIO,
  simulate: (variant) => simulateGit(variant ?? "both"),
  variants: RESOLUTIONS.map((r) => ({ id: r.id, label: r.label })),
  defaultVariant: null,
  gate: { step: conflict.GATE, resume: 10, recheck: [11] },
  fork: conflict.GATE,
  compareLabel: "해결안 비교",
  sceneTotal: conflict.MILESTONES.length,
  milestones: () => conflict.MILESTONES,
  guidedStops: () => conflict.GUIDED_STOPS,
  predictionAt: (index, variant) => conflict.predictionAt(index, variant),
  hasPrediction: (index) => Boolean(conflict.PREDICTIONS[index]),
  predictionSteps: Object.keys(conflict.PREDICTIONS).map(Number),
  feedback: conflict.feedback,
  eyebrowFor: (index) => conflict.eyebrowFor(index),
  describeStep: (step, { pending = false } = {}) => conflict.describeStep(step, { pending }),
  editNote: (step) =>
    step.index === 10 ? "충돌 표시를 지우고 선택한 제목을 저장" : step.index === 6 ? `${FILE_NAME}의 제목과 버튼을 수정하고 저장` : `${FILE_NAME}의 제목을 수정하고 저장`,
  status(state, { index, last, pending }) {
    const names = conflict.STATE_NAMES;
    if (state.merge) {
      if (state.status === "conflict") return names.conflict;
      if (state.index.status === "unmerged") return indexHidden(index, pending, state) ? names.resolvedPending : names.resolved;
      return names.registered;
    }
    if (index === last) return names.done;
    return names[state.status];
  },
  recap: conflict.RECAP,
  scope: conflict.SCOPE,
  sources: [SOURCE.merging, ...conflict.SOURCES.slice(2), SOURCE.branches],
  layout: {
    nodes: { C0: [19.1, 2.2], C1: [22, 6], C2: [22, 2.2], C3: [24.9, 2.2] },
    versions: VERSIONS.conflict,
    kindOf: contentKindOf,
  },
  commitColumn: { label: "제목 줄", value: (content) => content.split("\n").find((l) => l.startsWith("제목:"))?.replace(/^제목:\s*/, "") ?? "" },
};

export const LESSONS = [fastForward, autoMerge, conflictLesson, rebase];

export { BASE_STATES, feedbackFor, CONTENTS, LESSON_CONTENTS };
