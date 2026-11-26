import test from "node:test";
import assert from "node:assert/strict";
import { LESSONS } from "../lessons.ts";

const byId = Object.fromEntries(LESSONS.map((l) => [l.id, l]));
const item = (lesson: string, id: string) => byId[lesson].misconceptions.find((m) => m.id === id)!;

test("every Git lesson sets 2–4 misconceptions right, each at a 핵심 장면 of its variant", () => {
  for (const lesson of LESSONS) {
    const items = lesson.misconceptions;
    assert.ok(items.length >= 2 && items.length <= 4, `${lesson.id}: ${items.length}`);
    assert.equal(new Set(items.map((m) => m.id)).size, items.length);
    for (const m of items) {
      const where = `${lesson.id}/${m.id}`;
      assert.match(m.right, /[다)]\.$/, `${where}: 합니다체`);
      const variants = m.variant
        ? [m.variant]
        : lesson.gate
          ? [null]
          : lesson.variants.map((v) => v.id);
      for (const v of variants) {
        if (v)
          assert.ok(
            lesson.variants.some((x) => x.id === v),
            `${where}: ${v}`,
          );
        const scenes = lesson.milestones(v);
        assert.ok(m.scene! >= 1 && m.scene! <= scenes.length, `${where}: scene ${m.scene}`);
      }
    }
  }
});

test("a misconception never sits on a step whose prediction it would answer, except where it is hidden until answered", () => {
  // The 해설 hides notes while a prediction at that step is open (side.tsx);
  // only 03's 'save-resolves' shares its step with a prediction (git status at step 10).
  for (const lesson of LESSONS)
    for (const m of lesson.misconceptions) {
      const v = m.variant ?? lesson.defaultVariant;
      const index = lesson.milestones(v)[m.scene! - 1].index;
      if (lesson.hasPrediction(index, v))
        assert.equal(`${lesson.id}/${m.id}`, "conflict/save-resolves");
    }
});

test("the checks quote the runs: commits, parents, refs, index stages", () => {
  assert.match(
    item("fast-forward", "git-add-commits").check,
    /커밋은 C0 1개였고, git commit 뒤에야 C1이 생겼습니다/,
  );
  assert.match(
    item("fast-forward", "merge-always-commit").check,
    /2개 → 2개 그대로이고, main만 C0 → C1으로/,
  );
  assert.match(
    item("fast-forward", "noff-new-change").check,
    /C2의 부모는 C0·C1이고, 파일 내용은 C1과 한 글자도 다르지 않습니다/,
  );
  assert.match(
    item("auto-merge", "commit-is-diff").check,
    /제목 한 줄이지만, C1에는 welcome\.txt 4줄 전체/,
  );
  assert.match(item("auto-merge", "same-file-conflicts").check, /충돌 없이 병합 커밋 C3가/);
  assert.match(
    item("conflict", "same-file-conflicts").check,
    /충돌 표시 3줄은 제목 줄만.*‘버튼: 동네 코스 보기’ 줄은 main 쪽 변경으로 자동 병합/,
  );
  assert.match(item("conflict", "save-resolves").check, /stage 1·2·3 항목 3개가 남아/);
  assert.match(
    item("rebase", "rebase-moves").check,
    /C1의 부모는 C0, 새로 생긴 C1'의 부모는 C2.*3개 → 4개/,
  );
  assert.match(
    item("rebase", "rebase-other-result").check,
    /C1'과 merge 뒤 main의 C3는 같은 welcome\.txt/,
  );
});
