// 오개념 바로잡기 for the four Git lessons: beliefs learners commonly bring
// to branches and merging, each set right with evidence read from the
// lesson's own run (commit ids, parents, refs, index stages), never typed in.
// `scene` is the 1-based 핵심 장면 in `variant`'s milestones (the lesson's
// default variant when absent). None sits on a step that asks a prediction,
// and the 해설 hides them while one is open.
// Source: Pro Git 1.3 (snapshots), 2.2 (staging), 3.2 (merging), 3.6 (rebasing).
import { josa } from "@/lib/josa.ts";
import type { Misconception } from "@/lib/lesson-kit.ts";
import { FILE_NAME, changedLabels } from "./engine.ts";
import type { LessonBase as Lesson } from "./lesson-model.ts";
import type { Commit, GitState, Run } from "./types.ts";

export interface GitMisconception extends Misconception {
  /** The variant whose 핵심 장면 shows it (every variant, when absent). */
  variant?: string;
}

/** A particle after a commit id or file name as it is read (C1 씨원, C1' 씨원프라임). */
const g = (word: string, particle: string) => {
  const reading = word.endsWith("'") ? `${word.slice(0, -1)}프라임` : word;
  return word + josa(reading, particle, { digits: "en" }).slice(reading.length);
};
const commitOf = (state: GitState, id: string) => state.commits.find((c) => c.id === id)!;
const tip = (state: GitState, branch: string) => state.refs[branch]!;
const ids = (commits: Commit[]) => commits.map((c) => c.id).join("·");
const lastState = (run: Run) => run.steps.at(-1)!.state;

/** The 1-based 핵심 장면 at step `index` in `variant` (throws if there is none). */
export function sceneOf(lesson: Lesson, index: number, variant?: string | null) {
  const k = lesson.milestones(variant ?? lesson.defaultVariant).findIndex((m) => m.index === index);
  if (k < 0) throw new RangeError(`${lesson.id}: no 핵심 장면 at step ${index}`);
  return k + 1;
}

/** Steps of a run by action, in order. */
const stepsOf = (run: Run, action: string) => run.steps.filter((s) => s.action === action);

export function misconceptionsFor(lesson: Lesson): GitMisconception[] {
  if (lesson.id === "fast-forward") {
    const ff = lesson.simulate("ff");
    const noff = lesson.simulate("no-ff");
    const add = stepsOf(ff, "stage")[0];
    const commit = stepsOf(ff, "commit")[0];
    const merge = ff.steps.at(-1)!;
    const merged = commitOf(lastState(noff), tip(lastState(noff), "main"));
    const theirs = commitOf(lastState(noff), merged.parents[1]);
    return [
      {
        id: "git-add-commits",
        scene: sceneOf(lesson, commit.index, "ff"),
        wrong: "git add를 하면 파일이 저장소에 커밋된다.",
        right:
          "git add는 다음 커밋에 넣을 내용을 인덱스(스테이징 영역)에 준비할 뿐입니다. 이력에 기록하는 것은 git commit입니다.",
        check: `git add 직후(${add.index}번째 사건)에도 커밋은 ${ids(add.state.commits)} ${add.state.commits.length}개였고, git commit 뒤에야 ${g(commit.state.refs[commit.state.currentBranch]!, "이/가")} 생겼습니다.`,
      },
      {
        id: "merge-always-commit",
        variant: "ff",
        scene: sceneOf(lesson, merge.index, "ff"),
        wrong: "git merge는 항상 병합 커밋을 만든다.",
        right:
          "현재 브랜치의 끝이 가져올 커밋의 조상이면 Git은 포인터만 앞으로 옮깁니다(fast-forward). 병합 커밋은 이력이 갈라졌거나 --no-ff를 줄 때 생깁니다.",
        check: `병합 전후 커밋은 ${merge.before.commits.length}개 → ${merge.state.commits.length}개 그대로이고, main만 ${tip(merge.before, "main")} → ${g(tip(merge.state, "main"), "으로/로")} 옮겨졌습니다.`,
      },
      {
        id: "ff-rewrites",
        variant: "ff",
        scene: sceneOf(lesson, merge.index, "ff"),
        wrong: "fast-forward는 커밋을 옮기거나 고쳐서 기록을 바꾼다.",
        right: "fast-forward는 브랜치 이름만 움직입니다. 기존 커밋은 내용도 부모도 그대로입니다.",
        check: `병합 뒤에도 ${tip(merge.state, "main")}의 부모는 ${commitOf(merge.state, tip(merge.state, "main")).parents.join("·")} 그대로이고, 커밋 목록도 ${ids(merge.state.commits)}입니다.`,
      },
      {
        id: "noff-new-change",
        variant: "no-ff",
        scene: sceneOf(lesson, noff.steps.at(-1)!.index, "no-ff"),
        wrong: "--no-ff로 만든 병합 커밋에는 새로운 변경이 들어 있다.",
        right:
          "fast-forward가 가능한 상황의 --no-ff 병합 커밋은 가져온 커밋과 내용이 같습니다. 달라지는 것은 이력의 모양입니다.",
        check: `병합 커밋 ${merged.id}의 부모는 ${merged.parents.join("·")}이고, 파일 내용은 ${g(theirs.id, "과/와")} ${merged.content === theirs.content ? "한 글자도 다르지 않습니다" : "다릅니다"}.`,
      },
    ];
  }

  if (lesson.id === "auto-merge") {
    const run = lesson.simulate("three-way");
    const end = lastState(run);
    const merge = run.steps.at(-1)!;
    const commit = stepsOf(run, "commit")[0];
    const made = commitOf(commit.state, tip(commit.state, commit.state.currentBranch));
    const lines = made.content.trimEnd().split("\n").length;
    const merged = commitOf(end, tip(end, "main"));
    const [ours, theirs] = merged.parents.map((id) => commitOf(end, id));
    return [
      {
        id: "commit-is-diff",
        scene: sceneOf(lesson, commit.index),
        wrong: "커밋에는 바꾼 줄(차이)만 저장된다.",
        right:
          "Git 커밋은 그 순간 파일 전체의 스냅샷을 가리킵니다. 차이(diff)는 두 스냅샷을 비교해 그때그때 계산합니다(Pro Git 1.3).",
        check: `${made.id}에서 바꾼 줄은 ${changedLabels(made.content).join("·")} 한 줄이지만, ${made.id}에는 ${FILE_NAME} ${lines}줄 전체가 담겼습니다.`,
      },
      {
        id: "same-file-conflicts",
        scene: sceneOf(lesson, merge.index),
        wrong: "두 브랜치가 같은 파일을 고치면 병합할 때 충돌한다.",
        right:
          "충돌은 같은 파일이 아니라 같은 부분(같은 줄이나 맞닿은 줄)을 양쪽이 다르게 바꿨을 때 생깁니다.",
        check: `${ours.id}(${changedLabels(ours.content).join("·")})와 ${theirs.id}(${changedLabels(theirs.content).join("·")}) 모두 ${g(FILE_NAME, "을/를")} 고쳤지만, 충돌 없이 병합 커밋 ${g(merged.id, "이/가")} 바로 만들어졌습니다.`,
      },
      {
        id: "auto-merge-correct",
        scene: sceneOf(lesson, merge.index),
        wrong: "자동 병합이 됐으면 합친 코드도 맞다.",
        right:
          "Git은 줄 단위 텍스트만 합칩니다. 합친 결과가 의미상 맞는지(빌드·테스트)는 사람이 확인해야 합니다.",
        check: `${merged.id}에는 ${changedLabels(merged.content).join("·")} 두 변경이 함께 들어갔습니다. Git은 두 줄이 서로 어울리는지 확인하지 않았습니다.`,
      },
    ];
  }

  if (lesson.id === "conflict") {
    const run = lesson.simulate(null);
    const merge = stepsOf(run, "merge")[0];
    const resolve = stepsOf(run, "resolve")[0];
    const working = merge.state.working.split("\n");
    const markers = working.filter((l) => /^(<<<<<<<|=======|>>>>>>>)/.test(l)).length;
    const button = working.find((l) => l.startsWith("버튼:"))!;
    const stages = Object.keys(resolve.state.index.stages ?? {}).length;
    const end = lastState(run);
    const merged = commitOf(end, tip(end, "main"));
    return [
      {
        id: "same-file-conflicts",
        scene: sceneOf(lesson, merge.index),
        wrong: "두 브랜치가 같은 파일을 고치면 파일 전체가 충돌한다.",
        right:
          "충돌은 같은 부분을 양쪽이 다르게 바꾼 곳에만 생깁니다. 같은 파일의 다른 줄은 Git이 알아서 합칩니다.",
        check: `${FILE_NAME}에서 충돌 표시 ${markers}줄은 제목 줄만 감쌌고, 같은 파일의 ‘${button}’ 줄은 main 쪽 변경으로 자동 병합됐습니다.`,
      },
      {
        id: "save-resolves",
        scene: sceneOf(lesson, resolve.index),
        wrong: "충돌 표시를 지우고 파일을 저장하면 충돌이 해결된다.",
        right:
          "저장은 작업 트리만 바꿉니다. Git은 인덱스를 보고 판단하므로 git add로 해결을 기록해야 합니다.",
        check: `파일을 고쳐 저장한 뒤에도 인덱스에는 stage 1·2·3 항목 ${stages}개가 남아 있어 ${g(FILE_NAME, "은/는")} 여전히 미해결(unmerged)입니다.`,
      },
      {
        id: "auto-merge-correct",
        scene: sceneOf(lesson, run.steps.at(-1)!.index),
        wrong: "Git이 자동으로 합친 줄은 따로 확인할 필요가 없다.",
        right:
          "자동 병합은 텍스트가 겹치지 않았다는 뜻일 뿐입니다. 고른 제목과 자동으로 들어온 버튼이 함께 맞는지는 사람이 확인합니다.",
        check: `${merged.id}의 버튼 줄은 아무도 손대지 않았는데 ‘${button.replace(/^버튼:\s*/, "")}’가 들어갔고, 제목만 사람이 골랐습니다.`,
      },
    ];
  }

  // rebase
  const rebase = lesson.simulate("rebase");
  const merge = lesson.simulate("merge");
  const step = stepsOf(rebase, "rebase")[0];
  const after = step.state;
  const replayed = commitOf(after, tip(after, "feature/title"));
  const original = commitOf(after, replayed.replayOf!);
  const rebaseEnd = lastState(rebase);
  const mergeEnd = lastState(merge);
  return [
    {
      id: "rebase-moves",
      variant: "rebase",
      scene: sceneOf(lesson, step.index, "rebase"),
      wrong: "rebase는 기존 커밋을 그대로 다른 곳으로 옮긴다.",
      right:
        "rebase는 같은 변경을 새 부모 위에 다시 적용해 새 커밋을 만듭니다. 부모가 다르니 해시도 다른 커밋입니다.",
      check: `${original.id}의 부모는 ${original.parents.join("·")}, 새로 생긴 ${replayed.id}의 부모는 ${replayed.parents.join("·")}입니다. 커밋 수는 ${step.before.commits.length}개 → ${after.commits.length}개로 늘었고 ${g(original.id, "은/는")} 어느 브랜치도 가리키지 않습니다.`,
    },
    {
      id: "rebase-other-result",
      variant: "merge",
      scene: sceneOf(lesson, merge.steps.at(-1)!.index, "merge"),
      wrong: "rebase와 merge는 합친 결과 파일이 서로 다르다.",
      right:
        "같은 두 변경을 합치면 최종 파일은 같습니다. 다른 것은 이력의 모양(한 줄 대 병합 커밋)입니다.",
      check: `rebase 뒤 main의 ${g(tip(rebaseEnd, "main"), "과/와")} merge 뒤 main의 ${g(tip(mergeEnd, "main"), "은/는")} ${rebaseEnd.working === mergeEnd.working ? "같은" : "다른"} ${g(FILE_NAME, "을/를")} 담고 있습니다.`,
    },
    {
      id: "rebase-shared-safe",
      variant: "rebase",
      scene: sceneOf(lesson, rebase.steps.at(-1)!.index, "rebase"),
      wrong: "rebase는 이력을 깔끔하게 할 뿐이라 이미 공유한 브랜치에 해도 안전하다.",
      right:
        "rebase는 커밋을 새로 만들어 바꿔치기합니다. 남이 이미 받은 커밋을 rebase하면 같은 변경이 두 번 들어오는 등 이력이 어긋납니다(Pro Git 3.6).",
      check: `원래 ${g(original.id, "과/와")} 새 ${g(replayed.id, "은/는")} 다른 커밋입니다. 동료가 ${g(original.id, "을/를")} 받아 갔다면 그 이력에는 ${g(replayed.id, "이/가")} 없습니다.`,
    },
  ];
}
