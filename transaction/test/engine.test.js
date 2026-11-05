import assert from "node:assert/strict";
import test from "node:test";
import { simulate, visibleStockFor } from "../src/engine.js";

test("both transactions commit, but only locked reading preserves both decrements", () => {
  assert.deepEqual(simulate({ mode: "naive" }).stats, {
    initialStock: 10,
    expectedStock: 8,
    actualStock: 9,
    completedTransactions: 2,
    lostDecrements: 1,
    waits: 1,
  });
  assert.deepEqual(simulate({ mode: "locked" }).stats, {
    initialStock: 10,
    expectedStock: 8,
    actualStock: 8,
    completedTransactions: 2,
    lostDecrements: 0,
    waits: 1,
  });
});

test("naive reading retains stale application values even while UPDATE waits", () => {
  const { steps } = simulate({ mode: "naive" });
  assert.equal(steps[4].state.clients.T1.localRead, 10);
  assert.equal(steps[4].state.clients.T2.localRead, 10);
  assert.equal(steps[4].state.rowLock.owner, null);
  assert.deepEqual(steps[6].state.rowLock, {
    owner: "T1",
    mode: "update",
    waiting: [],
  });
  assert.equal(steps[7].state.clients.T2.localWrite, 9);
  assert.equal(steps[8].action, "wait");
  assert.equal(steps[8].sql, "UPDATE inventory SET stock = 9 WHERE id = 1;");
  assert.deepEqual(steps[8].events, [
    { type: "wait", client: "T2", request: "write", blockedBy: "T1" },
  ]);
  assert.equal(steps[8].state.uncommitted.client, "T1");
  assert.equal(steps[9].state.committedStock, 9);
  assert.equal(steps[9].state.clients.T2.localRead, 10);
  assert.equal(steps[10].action, "resume-write");
  assert.equal(steps[10].sql, steps[8].sql);
  assert.deepEqual(steps[10].state.uncommitted, {
    client: "T2",
    stock: 9,
    version: 2,
  });
  assert.deepEqual(
    steps[10].events.map((event) => event.type),
    ["resume", "lock", "write"],
  );
});

test("SELECT FOR UPDATE waits before reading and returns the committed updated row", () => {
  const { steps } = simulate({ mode: "locked" });
  assert.equal(steps[3].state.rowLock.owner, "T1");
  assert.equal(steps[3].state.rowLock.mode, "for-update");
  assert.equal(steps[4].action, "wait");
  assert.match(steps[4].sql, /FOR UPDATE;/);
  assert.equal(steps[4].state.clients.T2.localRead, null);
  assert.equal(steps[4].state.clients.T2.localWrite, null);
  assert.equal(steps[6].state.rowLock.mode, "for-update");
  assert.equal(steps[7].state.committedStock, 9);
  assert.equal(steps[7].state.clients.T2.localRead, null);
  assert.equal(steps[8].action, "resume-read");
  assert.equal(steps[8].sql, steps[4].sql);
  assert.equal(steps[8].state.clients.T2.localRead, 9);
  assert.equal(steps[8].state.rowLock.owner, "T2");
  assert.deepEqual(
    steps[8].events.map((event) => event.type),
    ["resume", "lock", "read"],
  );
  assert.equal(steps[9].state.clients.T2.localWrite, 8);
  assert.equal(steps[10].sql, "UPDATE inventory SET stock = 8 WHERE id = 1;");
});

test("uncommitted writes are private; saved app reads are not fresh SELECT snapshots", () => {
  for (const mode of ["naive", "locked"]) {
    const { steps } = simulate({ mode });
    const writing = steps[6].state;
    assert.equal(writing.committedStock, 10);
    assert.equal(visibleStockFor(writing, "T1"), 9);
    assert.equal(visibleStockFor(writing, "T2"), 10);
    const afterCommit = steps.find((step) => step.action === "commit").state;
    assert.equal(afterCommit.uncommitted, null);
    assert.equal(visibleStockFor(afterCommit, "T1"), 9);
    assert.equal(visibleStockFor(afterCommit, "T2"), 9);
    assert.equal(
      afterCommit.clients.T2.localRead,
      mode === "naive" ? 10 : null,
    );
  }
});

test("only COMMIT changes the committed row; each write stays locked until then", () => {
  for (const mode of ["naive", "locked"]) {
    const run = simulate({ mode });
    assert.deepEqual(
      run.steps.map((step) => step.state.committedStock),
      mode === "naive"
        ? [10, 10, 10, 10, 10, 10, 10, 10, 10, 9, 9, 9]
        : [10, 10, 10, 10, 10, 10, 10, 9, 9, 9, 9, 8],
    );
    for (const step of run.steps) {
      const state = step.state;
      if (state.uncommitted) {
        assert.equal(state.uncommitted.client, state.rowLock.owner);
        assert.equal(state.uncommitted.version, state.committedVersion + 1);
      }
      if (step.action !== "commit") {
        assert.equal(state.committedStock, step.before.committedStock);
        assert.equal(state.committedVersion, step.before.committedVersion);
      } else {
        assert.equal(state.committedVersion, step.before.committedVersion + 1);
        assert.equal(state.uncommitted, null);
        assert.equal(state.rowLock.owner, null);
        assert.deepEqual(
          step.events.map((event) => event.type),
          ["commit", "release"],
        );
      }
      for (const waiting of state.rowLock.waiting) {
        assert.equal(state.clients[waiting].status, "waiting");
        assert.notEqual(state.rowLock.owner, waiting);
      }
    }
    assert.equal(run.steps.at(-1).state.committedVersion, 2);
    assert.deepEqual(run.steps.at(-1).state.rowLock, {
      owner: null,
      mode: null,
      waiting: [],
    });
  }
});

test("timelines are deterministic independent snapshots with continuous before/after states", () => {
  for (const mode of ["naive", "locked"]) {
    const run = simulate({ mode });
    assert.deepEqual(run, simulate({ mode }));
    assert.equal(run.steps.length, 12);
    for (let i = 1; i < run.steps.length; i += 1) {
      assert.deepEqual(run.steps[i].before, run.steps[i - 1].state);
      assert.notEqual(run.steps[i].before, run.steps[i - 1].state);
      assert.notEqual(
        run.steps[i].state.clients.T1,
        run.steps[i].before.clients.T1,
      );
    }
  }
});
