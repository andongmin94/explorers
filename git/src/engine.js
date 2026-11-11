export const FILE_NAME = "welcome.txt";

const file = (title) => `[산책 안내]\n제목: ${title}\n버튼: 코스 보기\n`;

export const CONTENTS = {
  base: file("오늘의 산책을 시작하세요"),
  feature: file("나만의 산책을 찾아보세요"),
  main: file("우리 동네를 함께 걸어요"),
  both: file("우리 동네에서 나만의 산책을 찾아보세요"),
};

export const RESOLUTIONS = [
  {
    id: "both",
    label: "두 의도를 합치기",
    description: "동네와 나만의 산책이라는 두 의도를 새 문장에 담습니다.",
    content: CONTENTS.both,
  },
  {
    id: "ours",
    label: "main 문장 유지",
    description: "현재 브랜치의 문장을 선택합니다. 병합 이력은 남습니다.",
    content: CONTENTS.main,
  },
  {
    id: "theirs",
    label: "feature 문장 선택",
    description: "가져오는 브랜치의 문장을 최종 제목으로 선택합니다.",
    content: CONTENTS.feature,
  },
];

const copy = (value) => structuredClone(value);

export function indexMatchesHead(state) {
  const head = state.commits.find((commit) => commit.id === state.refs[state.currentBranch]);
  return state.index.content === head.content;
}

const conflictContent = [
  "[산책 안내]",
  "<<<<<<< HEAD",
  "제목: 우리 동네를 함께 걸어요",
  "=======",
  "제목: 나만의 산책을 찾아보세요",
  ">>>>>>> feature/title",
  "버튼: 코스 보기",
  "",
].join("\n");

export function simulateGit(resolution = "both") {
  const selected = RESOLUTIONS.find((option) => option.id === resolution);
  if (!selected) throw new RangeError(`Unknown resolution: ${resolution}`);

  const state = {
    currentBranch: "main",
    refs: { main: "C0", "feature/title": null },
    commits: [
      {
        id: "C0",
        parents: [],
        branch: "main",
        message: "산책 안내 만들기",
        content: CONTENTS.base,
      },
    ],
    working: CONTENTS.base,
    index: { status: "clean", content: CONTENTS.base, stages: null },
    merge: null,
    status: "clean",
    resolution,
  };
  const steps = [
    {
      index: 0,
      action: "initial",
      command: "",
      title: "하나의 시작점, C0",
      before: copy(state),
      state: copy(state),
    },
  ];
  const event = (action, command, title, change) => {
    const before = copy(state);
    change();
    steps.push({
      index: steps.length,
      action,
      command,
      title,
      before,
      state: copy(state),
    });
  };
  const stage = () => {
    state.index = { status: "staged", content: state.working, stages: null };
    state.status = "staged";
  };
  const commit = (id, message, parents) => {
    state.commits.push({
      id,
      parents,
      branch: state.currentBranch,
      message,
      content: state.index.content,
    });
    state.refs[state.currentBranch] = id;
    // A commit leaves the index populated with the committed file snapshot.
    state.index.status = "clean";
    state.status = "clean";
    state.merge = null;
  };

  event("branch", "git switch -c feature/title", "새 브랜치에서 시작", () => {
    state.refs["feature/title"] = "C0";
    state.currentBranch = "feature/title";
  });
  event("edit", "", "feature에서 제목 수정", () => {
    state.working = CONTENTS.feature;
    state.status = "modified";
  });
  event("stage", `git add ${FILE_NAME}`, "수정한 파일을 스테이징", stage);
  event(
    "commit",
    'git commit -m "나만의 산책 제목"',
    "feature의 C1 기록",
    () => {
      commit("C1", "나만의 산책 제목", ["C0"]);
    },
  );
  event("switch", "git switch main", "main의 파일로 돌아오기", () => {
    state.currentBranch = "main";
    state.working = CONTENTS.base;
    state.index = { status: "clean", content: CONTENTS.base, stages: null };
  });
  event("edit", "", "main에서도 같은 줄 수정", () => {
    state.working = CONTENTS.main;
    state.status = "modified";
  });
  event("stage", `git add ${FILE_NAME}`, "main의 변경을 스테이징", stage);
  event(
    "commit",
    'git commit -m "함께 걷는 동네 제목"',
    "main의 C2 기록",
    () => {
      commit("C2", "함께 걷는 동네 제목", ["C0"]);
    },
  );
  event("merge", "git merge feature/title", "같은 줄에서 병합 충돌", () => {
    state.working = conflictContent;
    state.index = {
      status: "unmerged",
      content: null,
      stages: {
        base: CONTENTS.base,
        ours: CONTENTS.main,
        theirs: CONTENTS.feature,
      },
    };
    state.merge = {
      target: "feature/title",
      base: "C0",
      ours: "C2",
      theirs: "C1",
    };
    state.status = "conflict";
  });
  event("resolve", "", "최종 문장을 직접 결정", () => {
    state.working = selected.content;
    state.status = "resolved";
  });
  event("stage", `git add ${FILE_NAME}`, "해결한 파일을 Git에 등록", stage);
  event(
    "commit",
    'git commit -m "두 제목의 병합 해결"',
    "두 부모를 가진 병합 커밋",
    () => {
      commit("C3", "두 제목의 병합 해결", ["C2", "C1"]);
    },
  );

  return { steps, resolution };
}
