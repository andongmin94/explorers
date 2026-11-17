import { indexMatchesHead } from "./engine.js";

export const MILESTONES = [
  { index: 1, label: "분기" },
  { index: 4, label: "첫 커밋" },
  { index: 8, label: "갈라진 이력" },
  { index: 9, label: "충돌" },
  { index: 12, label: "병합 완료" },
];

export const SOURCES = [
  {
    title: "Git · 브랜치와 HEAD",
    url: "https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell",
  },
  {
    title: "Git · 충돌과 병합",
    url: "https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging",
  },
  {
    title: "Git · 스테이징",
    url: "https://git-scm.com/docs/git-add",
  },
  {
    title: "Git · 충돌 시 저장 상태",
    url: "https://git-scm.com/docs/git-merge#_true_merge",
  },
];

export const PREDICTION = {
  question: "같은 줄의 변경이 충돌하면 HEAD는 어디에 남을까요?",
  choices: [
    {
      id: "stay",
      text: "main → C2에 그대로 남는다",
      correct: true,
      feedback:
        "맞아요. 충돌한 병합은 새 커밋을 만들지 않습니다. 파일과 index에 해결할 내용을 남기고 기다립니다.",
    },
    {
      id: "feature",
      text: "feature/title → C1으로 이동한다",
      correct: false,
      feedback:
        "merge는 브랜치를 전환하는 명령이 아닙니다. 현재 브랜치 main을 유지한 채 feature/title의 변경을 합칩니다.",
    },
    {
      id: "merge",
      text: "새 병합 커밋 C3로 이동한다",
      correct: false,
      feedback:
        "충돌 해결이 끝나기 전에는 C3가 생기지 않습니다. 내용을 결정하고 git add로 기록한 뒤 커밋해야 합니다.",
    },
  ],
};

const lessons = [
  {
    title: "같은 한 줄, 서로 다른 두 생각",
    body: "산책 안내문의 제목을 두 브랜치에서 다르게 바꿉니다. 파일 내용과 커밋 이력을 함께 따라가며 마지막에 남길 문장을 직접 정해 보세요.",
    takeaway: "작업 파일, 스테이징, 커밋은 서로 다른 상태입니다.",
    details: [
      "처음에는 main이 C0를 가리킵니다.",
      "HEAD는 현재 선택한 main을 가리킵니다.",
    ],
    focus: "history",
  },
  {
    title: "브랜치를 만들어도 커밋은 하나",
    body: "feature/title을 만들고 그 브랜치로 전환했습니다. main과 feature/title은 아직 같은 C0를 가리킵니다.",
    takeaway:
      "브랜치는 커밋을 가리키는 이름입니다. 만들기만 해서는 새 커밋이 생기지 않습니다.",
    details: [
      "HEAD → feature/title로 바뀝니다.",
      "파일과 스테이징의 내용은 그대로입니다.",
    ],
    focus: "history",
  },
  {
    title: "수정한 문장은 작업 파일에만",
    body: "제목을 ‘나만의 산책을 찾아보세요’로 고쳤습니다. 화면의 파일은 달라졌지만 스테이징과 C0에는 아직 이전 제목이 있습니다.",
    takeaway: "파일 저장은 Git 커밋이 아닙니다.",
    details: [
      "작업 파일과 스테이징을 비교하세요.",
      "두 브랜치가 가리키는 커밋은 여전히 C0입니다.",
    ],
    focus: "working",
  },
  {
    title: "git add로 다음 커밋의 내용 준비",
    body: "현재 파일 내용을 스테이징(index)에 담았습니다. 커밋할 제목은 준비됐지만 아직 이력에 새 커밋이 추가되지는 않았습니다.",
    takeaway: "add는 내용을 준비하고, commit은 그 내용을 이력에 기록합니다.",
    details: [
      "스테이징에는 add를 실행한 순간의 내용이 들어갑니다.",
      "feature/title은 아직 C0를 가리킵니다.",
    ],
    focus: "index",
  },
  {
    title: "C1 생성 · feature/title만 앞으로",
    body: "스테이징의 제목으로 C1을 만들었습니다. 부모는 C0이고, 현재 브랜치 feature/title이 C1을 가리킵니다. main은 C0에 남습니다.",
    takeaway: "커밋하면 현재 브랜치의 끝이 이동합니다.",
    details: [
      "작업 파일과 스테이징이 C1의 내용과 같아졌습니다.",
      "스테이징은 비워진 것이 아니라 커밋과 같아진 상태입니다.",
    ],
    focus: "history",
  },
  {
    title: "main으로 돌아오면 파일도 C0로",
    body: "HEAD가 main으로 옮겨갔습니다. 이 장면은 커밋을 마친 깨끗한 상태라, 작업 파일과 스테이징도 main이 가리키는 C0의 내용으로 바뀝니다.",
    takeaway:
      "C1의 수정은 사라지지 않았습니다. feature/title에서 계속 가리키고 있습니다.",
    details: [
      "현재 파일의 제목이 처음 문장으로 돌아왔습니다.",
      "브랜치 전환은 새 커밋을 만들지 않습니다.",
    ],
    focus: "working",
  },
  {
    title: "main에서 같은 줄을 다르게 수정",
    body: "이번에는 제목을 ‘우리 동네를 함께 걸어요’로 바꿉니다. feature/title의 C1에서 바꿨던 바로 그 줄입니다.",
    takeaway: "두 작업은 같은 C0에서 출발해 서로 다른 방향으로 바뀌었습니다.",
    details: [
      "아직 main의 새 제목은 작업 파일에만 있습니다.",
      "feature/title의 C1에는 다른 제목이 그대로 남아 있습니다.",
    ],
    focus: "working",
  },
  {
    title: "main의 문장도 스테이징에",
    body: "main에서 고친 제목을 스테이징에 담았습니다. 작업 파일과 index는 같아졌지만 main은 아직 C0를 가리킵니다.",
    takeaway: "같은 파일이어도 어느 시점의 내용을 커밋할지 add로 결정합니다.",
    details: [
      "이번 add는 feature/title의 C1을 수정하지 않습니다.",
      "다음 커밋의 부모는 현재 main의 끝인 C0입니다.",
    ],
    focus: "index",
  },
  {
    title: "공통 조상 C0, 서로 다른 C1과 C2",
    body: "main에 C2가 생겼습니다. C1과 C2의 부모는 모두 C0입니다. 이제 main에서 feature/title을 병합하면 같은 줄의 두 변경을 비교하게 됩니다.",
    takeaway:
      "병합은 현재 내용 둘뿐 아니라 공통 조상에서 무엇이 바뀌었는지도 비교합니다.",
    details: [
      "현재 쪽: main의 C2 · 가져올 쪽: feature/title의 C1.",
      "공통 조상: C0. 어느 제목을 남길지 자동으로 정할 수 있을까요?",
    ],
    focus: "merge",
  },
  {
    title: "충돌 · 커밋을 만들지 않고 멈춤",
    body: "같은 제목 줄을 다르게 바꿔 자동 병합이 멈췄습니다. 위쪽 HEAD 구간은 main, 아래쪽은 feature/title의 내용입니다. 남길 문장을 직접 선택하세요.",
    takeaway: "HEAD → main → C2는 그대로입니다. 아직 병합 커밋 C3는 없습니다.",
    details: [
      "index에는 공통 조상 C0, 현재 C2, 가져올 C1의 세 버전이 남습니다.",
      "한쪽을 택하거나 문장을 새로 합칠 수 있습니다. Git은 문장의 의도를 판단하지 않습니다.",
    ],
    focus: "merge",
  },
  {
    title: "문장은 정했지만, 해결 기록은 아직",
    body: "선택한 문장으로 작업 파일을 고치고 충돌 표시를 지웠습니다. 하지만 index에는 아직 미해결 상태의 세 버전이 남아 있습니다.",
    takeaway: "충돌 표시를 지우는 것과 Git에 해결을 기록하는 것은 별개입니다.",
    details: [
      "다음 git add가 이 파일을 해결된 내용으로 등록합니다.",
      "지금은 브랜치와 커밋 이력이 그대로입니다.",
    ],
    focus: "working",
  },
  {
    title: "해결한 내용을 등록 · 커밋 대기",
    body: "git add로 미해결 세 버전을 최종 파일 하나로 정리했습니다. git diff --cached에서 C2와 다른 제목 한 줄을 확인할 수 있습니다.",
    takeaway: "충돌 해결 등록이 끝나도 병합 커밋은 아직 만들어지지 않았습니다.",
    details: [
      "main은 C2, feature/title은 C1을 계속 가리킵니다.",
      "다음 커밋이 두 이력을 부모로 갖게 됩니다.",
    ],
    focus: "index",
  },
  {
    title: "C3 완성 · 부모가 두 개인 커밋",
    body: "최종 문장을 담은 C3가 C2와 C1을 부모로 연결합니다. main은 C3로 이동하고, feature/title은 C1에 남습니다.",
    takeaway: "두 이력을 연결하되, 최종 파일 내용은 사람이 결정했습니다.",
    details: [
      "작업 파일과 스테이징, C3의 내용이 같습니다.",
      "병합해도 기존 C1·C2가 덮어써지거나 feature/title이 자동 삭제되지는 않습니다.",
    ],
    focus: "history",
  },
];

export function describeStep(step) {
  const lesson = lessons[step.index];
  const eyebrow = step.index === 0
    ? "대표 시나리오 · 같은 제목, 두 변경"
    : `${step.index}번째 사건`;
  if (step.index === 11 && indexMatchesHead(step.state)) {
    return {
      ...lesson,
      eyebrow,
      body: "main의 기존 문장을 골랐습니다. git add는 인덱스의 미해결 세 버전을 C2와 같은 파일 하나로 정리합니다. 그래서 git diff --cached에는 변경이 없습니다.",
      takeaway: "파일 내용이 C2와 같아도 병합은 진행 중입니다. 다음 커밋은 C2와 C1을 부모로 기록합니다.",
    };
  }
  return { ...lesson, eyebrow };
}
