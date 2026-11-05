import test from "node:test";
import assert from "node:assert/strict";
import { CONTENTS, RESOLUTIONS, simulateGit } from "../src/engine.js";

test("branch creation and staging move no commit pointers", () => {
  const { steps } = simulateGit();
  assert.equal(steps.length, 13);
  assert.equal(steps[0].state.refs["feature/title"], null);
  assert.equal(steps[1].state.currentBranch, "feature/title");
  assert.deepEqual(steps[1].state.refs, { main: "C0", "feature/title": "C0" });
  assert.equal(steps[1].state.commits.length, 1);
  assert.equal(steps[2].state.working, CONTENTS.feature);
  assert.equal(steps[2].state.index.content, CONTENTS.base);
  assert.equal(steps[3].state.index.content, CONTENTS.feature);
  assert.deepEqual(steps[3].state.refs, steps[1].state.refs);
  assert.equal(steps[3].state.commits.length, 1);
  assert.deepEqual(steps[4].state.refs, { main: "C0", "feature/title": "C1" });
});

test("switch restores main's snapshot without deleting feature history", () => {
  const { steps } = simulateGit();
  const state = steps[5].state;
  assert.equal(state.currentBranch, "main");
  assert.equal(state.working, CONTENTS.base);
  assert.equal(state.index.content, CONTENTS.base);
  assert.equal(state.index.status, "clean");
  assert.equal(
    state.commits.find((commit) => commit.id === "C1").content,
    CONTENTS.feature,
  );
  assert.equal(state.refs["feature/title"], "C1");
  assert.deepEqual(
    steps[8].state.commits.map(({ id, parents }) => [id, parents]),
    [
      ["C0", []],
      ["C1", ["C0"]],
      ["C2", ["C0"]],
    ],
  );
});

test("merge conflict preserves both tips and three index stages", () => {
  const { steps } = simulateGit();
  const before = steps[8].state;
  const conflict = steps[9].state;
  assert.deepEqual(conflict.refs, before.refs);
  assert.equal(conflict.commits.length, 3);
  assert.equal(conflict.currentBranch, "main");
  assert.equal(conflict.status, "conflict");
  assert.equal(conflict.index.status, "unmerged");
  assert.equal(conflict.index.content, null);
  assert.deepEqual(conflict.index.stages, {
    base: CONTENTS.base,
    ours: CONTENTS.main,
    theirs: CONTENTS.feature,
  });
  assert.deepEqual(conflict.merge, {
    target: "feature/title",
    base: "C0",
    ours: "C2",
    theirs: "C1",
  });
  assert.match(
    conflict.working,
    /<<<<<<< HEAD\n제목: 우리 동네를 함께 걸어요\n=======\n제목: 나만의 산책을 찾아보세요\n>>>>>>> feature\/title/,
  );
});

test("editing conflict markers is separate from marking the index resolved", () => {
  const { steps } = simulateGit();
  const edited = steps[10].state;
  assert.equal(edited.working, CONTENTS.both);
  assert.doesNotMatch(edited.working, /<<<<<<<|=======|>>>>>>>/);
  assert.equal(edited.status, "resolved");
  assert.equal(edited.index.status, "unmerged");
  assert.deepEqual(edited.index.stages, steps[9].state.index.stages);
  assert.deepEqual(edited.refs, steps[9].state.refs);
  const staged = steps[11].state;
  assert.equal(staged.index.status, "staged");
  assert.equal(staged.index.content, CONTENTS.both);
  assert.equal(staged.index.stages, null);
  assert.deepEqual(staged.merge, steps[9].state.merge);
  assert.deepEqual(staged.refs, steps[9].state.refs);
  assert.equal(staged.commits.length, 3);
});

test("merge commit has both parents and advances only the current branch", () => {
  const { steps } = simulateGit();
  const result = steps[12].state;
  assert.deepEqual(result.refs, { main: "C3", "feature/title": "C1" });
  assert.deepEqual(result.commits.at(-1).parents, ["C2", "C1"]);
  assert.equal(result.commits.at(-1).content, CONTENTS.both);
  assert.equal(result.working, CONTENTS.both);
  assert.deepEqual(result.index, {
    status: "clean",
    content: CONTENTS.both,
    stages: null,
  });
  assert.equal(result.merge, null);
  assert.equal(result.status, "clean");
});

test("all three resolutions preserve two-parent history, including an unchanged main tree", () => {
  for (const option of RESOLUTIONS) {
    const { steps, resolution } = simulateGit(option.id);
    assert.equal(resolution, option.id);
    assert.equal(steps[10].state.working, option.content);
    assert.equal(steps[10].state.index.status, "unmerged");
    assert.equal(steps[11].state.index.content, option.content);
    assert.equal(steps[12].state.working, option.content);
    assert.equal(steps[12].state.commits.at(-1).content, option.content);
    assert.deepEqual(steps[12].state.commits.at(-1).parents, ["C2", "C1"]);
  }
  const ours = simulateGit("ours").steps;
  assert.equal(
    ours[8].state.commits.at(-1).content,
    ours[12].state.commits.at(-1).content,
  );
  assert.equal(ours[12].state.commits.length, 4);
});

test("events retain independent before/after snapshots and independent runs", () => {
  const { steps } = simulateGit();
  for (let i = 1; i < steps.length; i++) {
    assert.deepEqual(steps[i].before, steps[i - 1].state);
    assert.notEqual(steps[i].before, steps[i - 1].state);
    assert.notEqual(steps[i].before.refs, steps[i - 1].state.refs);
  }
  steps[9].state.refs.main = "changed";
  steps[9].state.commits[0].message = "changed";
  steps[9].state.index.stages.base = "changed";
  assert.equal(steps[10].before.refs.main, "C2");
  assert.equal(steps[10].before.commits[0].message, "산책 안내 만들기");
  assert.equal(steps[10].before.index.stages.base, CONTENTS.base);
  assert.equal(simulateGit().steps[0].state.refs.main, "C0");
});
