// The Git engine (port of git/src/engine.js): every lesson's history as a
// list of events, each with an independent before/after snapshot of the
// working tree, the index and the commit graph.
import type {
  Action,
  CompareLine,
  ContentKind,
  GitState,
  LineInfo,
  LineKind,
  Resolution,
  Run,
  Step,
  Versions,
} from "./types.ts";

export const FILE_NAME = "welcome.txt";

/** The button line: only main changes it (C0 → C2); feature/title keeps C0's. */
export const BUTTONS = { base: "코스 보기", main: "동네 코스 보기" };

export const TITLES = {
  base: "오늘의 산책을 시작하세요",
  feature: "나만의 산책을 찾아보세요",
  main: "우리 동네를 함께 걸어요",
  both: "우리 동네에서 나만의 산책을 찾아보세요",
};

// Line 3 never changes. It keeps the title (line 2) and the button (line 4)
// apart, so Git merges main's button change on its own next to the title
// conflict (changes on touching lines would join the conflict).
const file = (title: string, button = BUTTONS.base) =>
  `[산책 안내]\n제목: ${title}\n출발: 공원 입구\n버튼: ${button}\n`;

export const CONTENTS = {
  base: file(TITLES.base),
  feature: file(TITLES.feature),
  main: file(TITLES.main, BUTTONS.main),
  // Merge results: whichever title is chosen, the button keeps main's change,
  // because against the common ancestor C0 only main changed that line.
  both: file(TITLES.both, BUTTONS.main),
  theirs: file(TITLES.feature, BUTTONS.main),
};

export const RESOLUTIONS: Resolution[] = [
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
    label: "feature/title 문장 선택",
    description:
      "가져오는 브랜치의 문장을 최종 제목으로 선택합니다. 버튼 줄은 자동 병합된 main의 것이 남습니다.",
    content: CONTENTS.theirs,
  },
];

const copy = <T>(value: T): T => structuredClone(value);

/** Lesson 03: which title a file snapshot carries: base, main, feature, both or conflict. */
export function contentKindOf(content: string | null | undefined): ContentKind {
  if (content == null || /^<<<<<<< /m.test(content)) return "conflict";
  const title = /^제목: (.*)$/m.exec(content)?.[1];
  const hit = Object.entries(TITLES).find(([, value]) => value === title);
  return hit ? (hit[0] as ContentKind) : "conflict";
}

export function indexMatchesHead(state: GitState): boolean {
  const head = state.commits.find((commit) => commit.id === state.refs[state.currentBranch])!;
  return state.index.content === head.content;
}

const conflictContent = [
  "[산책 안내]",
  "<<<<<<< HEAD",
  `제목: ${TITLES.main}`,
  "=======",
  `제목: ${TITLES.feature}`,
  ">>>>>>> feature/title",
  "출발: 공원 입구",
  // Auto-merged: C0 → C2 changed this line, C0 → C1 did not.
  `버튼: ${BUTTONS.main}`,
  "",
].join("\n");

export function simulateGit(resolution = "both"): Run & { resolution: string } {
  const selected = RESOLUTIONS.find((option) => option.id === resolution);
  if (!selected) throw new RangeError(`Unknown resolution: ${resolution}`);

  const state: GitState = {
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
  const steps: Step[] = [
    {
      index: 0,
      action: "initial",
      command: "",
      title: "하나의 시작점, C0",
      before: copy(state),
      state: copy(state),
    },
  ];
  const event = (action: Action, command: string, title: string, change: () => void) => {
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
  const commit = (id: string, message: string, parents: string[]) => {
    state.commits.push({
      id,
      parents,
      branch: state.currentBranch,
      message,
      content: state.index.content!,
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
  event("stage", `git add ${FILE_NAME}`, "수정한 파일을 인덱스에 등록", stage);
  event("commit", 'git commit -m "나만의 산책 제목"', "feature의 C1 기록", () => {
    commit("C1", "나만의 산책 제목", ["C0"]);
  });
  event("switch", "git switch main", "main의 파일로 돌아오기", () => {
    state.currentBranch = "main";
    state.working = CONTENTS.base;
    state.index = { status: "clean", content: CONTENTS.base, stages: null };
  });
  event("edit", "", "main에서 제목과 버튼 수정", () => {
    state.working = CONTENTS.main;
    state.status = "modified";
  });
  event("stage", `git add ${FILE_NAME}`, "main의 변경을 인덱스에 등록", stage);
  event("commit", 'git commit -m "함께 걷는 동네 제목과 버튼"', "main의 C2 기록", () => {
    commit("C2", "함께 걷는 동네 제목과 버튼", ["C0"]);
  });
  event("merge", "git merge feature/title", "제목 줄 충돌 · 버튼 줄 자동 병합", () => {
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
  event("commit", 'git commit -m "두 제목의 병합 해결"', "두 부모를 가진 병합 커밋", () => {
    commit("C3", "두 제목의 병합 해결", ["C2", "C1"]);
  });

  return { steps, resolution };
}

/* ------------------------------------------------------------------------
 * Lessons 01, 02 and 04 share welcome.txt and C0. feature/title always
 * changes the title (line 2); in 02 and 04 main changes only the button
 * (line 4). Line 3 sits between them, so the two changes never touch.
 * Every output below was checked with git 2.56 in a scratch repository.
 * ---------------------------------------------------------------------- */

export const LESSON_CONTENTS = {
  base: CONTENTS.base,
  feature: CONTENTS.feature,
  /** main's own change in 02 and 04: the button only. */
  mainButton: file(TITLES.base, BUTTONS.main),
  /** Both changes: feature's title and main's button. */
  merged: file(TITLES.feature, BUTTONS.main),
};

/** The versions a lesson's lines are coloured against: C0, main's change, feature's change. */
export const VERSIONS: Record<"conflict" | "fastForward" | "diverged", Versions> = {
  conflict: { base: CONTENTS.base, main: CONTENTS.main, feature: CONTENTS.feature },
  fastForward: { base: CONTENTS.base, main: CONTENTS.base, feature: CONTENTS.feature },
  diverged: { base: CONTENTS.base, main: LESSON_CONTENTS.mainButton, feature: CONTENTS.feature },
};

/**
 * Who wrote each line of a snapshot: "plain" (never changes), "base" (C0's
 * text of a line that changes), "main", "feature", "both" (a new line neither
 * branch wrote, e.g. a hand-made resolution), "marker" (conflict markers).
 * Inside a conflict the two halves take their side's colour; a changed line
 * outside the markers is flagged `auto` (Git merged it on its own).
 */
export function lineKinds(content: string, versions: Versions): LineInfo[] {
  const split = (text: string) => text.trimEnd().split("\n");
  const base = split(versions.base);
  const main = split(versions.main);
  const feature = split(versions.feature);
  const lines = split(content);
  const conflict = lines.some((l) => l.startsWith("<<<<<<< "));
  let side: LineKind | null = null;
  return lines.map((text) => {
    const marker = /^(<<<<<<<|=======|>>>>>>>)/.exec(text)?.[1];
    if (marker) {
      side = ({ "<<<<<<<": "main", "=======": "feature", ">>>>>>>": null } as const)[
        marker as "<<<<<<<" | "=======" | ">>>>>>>"
      ];
      return { text, kind: "marker" as const, auto: false };
    }
    if (side) return { text, kind: side, auto: false };
    let kind: LineKind;
    if (base.includes(text))
      kind = main.includes(text) && feature.includes(text) ? "plain" : "base";
    else if (main.includes(text) && !feature.includes(text)) kind = "main";
    else if (feature.includes(text) && !main.includes(text)) kind = "feature";
    else kind = "both";
    return { text, kind, auto: conflict && (kind === "main" || kind === "feature") };
  });
}

/** Which lines differ from C0, by their label ("제목", "버튼"). */
export function changedLabels(content: string, base: string = CONTENTS.base): string[] {
  const before = base.trimEnd().split("\n");
  return content
    .trimEnd()
    .split("\n")
    .filter((line, i) => line !== before[i])
    .map((line) => line.split(":")[0]);
}

export interface Recorder {
  steps: Step[];
  branch(): void;
  edit(content: string, title: string, note: string): void;
  stage(title: string): void;
  commit(id: string, message: string, title: string): void;
  switchTo(branch: string, title: string): void;
  mergeFastForward(title: string): void;
  mergeCommit(id: string, command: string, content: string, title: string): void;
  rebase(onto: string, replayed: { id: string; content: string }, title: string): void;
}

/**
 * A small recorder for the lesson histories: each call applies one event to
 * the state and keeps an independent before/after snapshot.
 */
function recorder(): Recorder {
  const state: GitState = {
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
  };
  const steps: Step[] = [
    {
      index: 0,
      action: "initial",
      command: "",
      title: "하나의 시작점, C0",
      before: copy(state),
      state: copy(state),
    },
  ];
  const event = (
    action: Action,
    command: string,
    title: string,
    change: () => void,
    extra: { note?: string } = {},
  ) => {
    const before = copy(state);
    change();
    steps.push({
      index: steps.length,
      action,
      command,
      title,
      ...extra,
      before,
      state: copy(state),
    });
  };
  const tip = (branch: string) => state.commits.find((c) => c.id === state.refs[branch])!;
  const checkout = (content: string) => {
    state.working = content;
    state.index = { status: "clean", content, stages: null };
    state.status = "clean";
  };
  return {
    steps,
    branch() {
      event("branch", "git switch -c feature/title", "새 브랜치에서 시작", () => {
        state.refs["feature/title"] = state.refs.main;
        state.currentBranch = "feature/title";
      });
    },
    edit(content, title, note) {
      event(
        "edit",
        "",
        title,
        () => {
          state.working = content;
          state.status = "modified";
        },
        { note },
      );
    },
    stage(title) {
      event("stage", `git add ${FILE_NAME}`, title, () => {
        state.index = { status: "staged", content: state.working, stages: null };
        state.status = "staged";
      });
    },
    commit(id, message, title) {
      event("commit", `git commit -m "${message}"`, title, () => {
        state.commits.push({
          id,
          parents: [state.refs[state.currentBranch]!],
          branch: state.currentBranch,
          message,
          content: state.index.content!,
        });
        state.refs[state.currentBranch] = id;
        state.index.status = "clean";
        state.status = "clean";
      });
    },
    switchTo(branch, title) {
      event("switch", `git switch ${branch}`, title, () => {
        state.currentBranch = branch;
        checkout(tip(branch).content);
      });
    },
    /** Fast-forward: the current branch moves to the other tip; no new commit. */
    mergeFastForward(title) {
      event("merge-ff", "git merge feature/title", title, () => {
        const to = tip("feature/title");
        state.refs[state.currentBranch] = to.id;
        checkout(to.content);
      });
    },
    /** A merge Git completes on its own: a commit with two parents. */
    mergeCommit(id, command, content, title) {
      event("merge-commit", command, title, () => {
        const ours = state.refs[state.currentBranch]!;
        const theirs = state.refs["feature/title"]!;
        state.commits.push({
          id,
          parents: [ours, theirs],
          branch: state.currentBranch,
          message: "Merge branch 'feature/title'",
          content,
        });
        state.refs[state.currentBranch] = id;
        checkout(content);
      });
    },
    /**
     * Rebase the current branch onto `onto`: its commit is replayed as a new
     * commit (C1 → C1'); the old one stays in the repository but no branch
     * points at it any more.
     */
    rebase(onto, replayed, title) {
      event("rebase", `git rebase ${onto}`, title, () => {
        const old = tip(state.currentBranch);
        state.commits.push({
          id: replayed.id,
          parents: [state.refs[onto]!],
          branch: state.currentBranch,
          message: old.message,
          content: replayed.content,
          replayOf: old.id,
        });
        old.orphan = true;
        state.refs[state.currentBranch] = replayed.id;
        checkout(replayed.content);
      });
    },
  };
}

/** feature/title gets its title commit C1, then main is checked out again. */
function featureTitle(git: Recorder, back = "main으로 돌아오기") {
  git.branch();
  git.edit(CONTENTS.feature, "feature에서 제목 수정", `${FILE_NAME}의 제목을 수정하고 저장`);
  git.stage("수정한 파일을 인덱스에 등록");
  git.commit("C1", "나만의 산책 제목", "feature의 C1 기록");
  git.switchTo("main", back);
}

/** main changes only the button: C2. */
function mainButton(git: Recorder) {
  git.edit(
    LESSON_CONTENTS.mainButton,
    "main에서 버튼만 수정",
    `${FILE_NAME}의 버튼을 수정하고 저장`,
  );
  git.stage("main의 변경을 인덱스에 등록");
  git.commit("C2", "동네 코스 버튼", "main의 C2 기록");
}

/** Lesson 01: main has not moved since the branch. mode "ff" | "no-ff". */
export function simulateFastForward(mode = "ff"): Run & { variant: string } {
  if (mode !== "ff" && mode !== "no-ff") throw new RangeError(`Unknown mode: ${mode}`);
  const git = recorder();
  featureTitle(git, "main은 C0 그대로");
  if (mode === "ff") git.mergeFastForward("main이 C1으로 이동");
  else
    git.mergeCommit(
      "C2",
      "git merge --no-ff feature/title",
      CONTENTS.feature,
      "--no-ff · 병합 커밋 C2",
    );
  return { steps: git.steps, variant: mode };
}

/** Lesson 02: both branches changed different, non-adjacent lines. */
export function simulateAutoMerge(mode = "three-way"): Run & { variant: string } {
  if (mode !== "three-way") throw new RangeError(`Unknown mode: ${mode}`);
  const git = recorder();
  featureTitle(git);
  mainButton(git);
  git.mergeCommit(
    "C3",
    "git merge feature/title",
    LESSON_CONTENTS.merged,
    "자동 병합 · 병합 커밋 C3",
  );
  return { steps: git.steps, variant: mode };
}

/**
 * Lesson 02's thought experiment: compare only the two tips, line by line,
 * without C0. Every line that differs is undecidable ("?"); Git never merges
 * this way. Returns [{ label, ours, theirs, twoWay, threeWay }].
 */
export function compareMergeBases(
  base: string = CONTENTS.base,
  ours: string = LESSON_CONTENTS.mainButton,
  theirs: string = CONTENTS.feature,
): CompareLine[] {
  const [b, o, t] = [base, ours, theirs].map((s) => s.trimEnd().split("\n"));
  return o.map((line, i) => {
    const label = line.split(":")[0];
    const same = line === t[i];
    let threeWay: string | null;
    if (same) threeWay = line;
    else if (line === b[i]) threeWay = t[i];
    else if (t[i] === b[i]) threeWay = line;
    else threeWay = null; // both changed: a conflict
    return { label, base: b[i], ours: line, theirs: t[i], twoWay: same ? line : null, threeWay };
  });
}

/** Lesson 04: the same diverged history, joined by rebase or by merge. */
export function simulateRebase(mode = "rebase"): Run & { variant: string } {
  if (mode !== "rebase" && mode !== "merge") throw new RangeError(`Unknown mode: ${mode}`);
  const git = recorder();
  featureTitle(git);
  mainButton(git);
  if (mode === "rebase") {
    git.switchTo("feature/title", "feature/title로 전환");
    git.rebase(
      "main",
      { id: "C1'", content: LESSON_CONTENTS.merged },
      "C1을 C2 위에 다시 적용 · C1'",
    );
    git.switchTo("main", "main으로 돌아오기");
    git.mergeFastForward("main이 C1'으로 이동");
  } else {
    git.mergeCommit(
      "C3",
      "git merge feature/title",
      LESSON_CONTENTS.merged,
      "자동 병합 · 병합 커밋 C3",
    );
  }
  return { steps: git.steps, variant: mode };
}
