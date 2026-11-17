import assert from "node:assert/strict";
import test from "node:test";
import { simulate } from "../src/engine.js";
import { getPresentationState } from "../src/presentation.js";

test("T1 commit publishes the row and releases its lock together, preserving T2's cache", () => {
  for (const mode of ["naive", "locked"]) {
    const run = simulate({ mode });
    const step = run.steps.find(
      (item) => item.action === "commit" && item.client === "T1",
    );
    const original = structuredClone(step);
    const request = getPresentationState(step, "request");
    assert.equal(request, step.before);
    assert.equal(request.committedStock, 10);
    assert.equal(request.uncommitted.stock, 9);
    assert.equal(request.rowLock.owner, "T1");

    const database = getPresentationState(step, "database");
    assert.notEqual(database, step.state);
    assert.equal(database.committedStock, 9);
    assert.equal(database.committedVersion, 1);
    assert.equal(database.uncommitted, null);
    assert.equal(database.completedTransactions, 1);
    assert.deepEqual(database.rowLock, {
      owner: null,
      mode: null,
      waiting: ["T2"],
    });
    assert.equal(database.clients.T2.status, "waiting");
    assert.equal(database.clients.T2.localRead, mode === "naive" ? 10 : null);
    assert.equal(database.clients.T2.localWrite, mode === "naive" ? 9 : null);
    assert.deepEqual(database.clients.T1, step.before.clients.T1);
    assert.equal(database.clients.T1.status, "active");

    const complete = getPresentationState(step, "complete");
    assert.equal(complete, step.state);
    assert.equal(complete.clients.T1.status, "committed");
    assert.deepEqual(complete.rowLock, database.rowLock);
    assert.deepEqual(step, original);

    const waiting = run.steps.find((item) => item.action === "wait");
    assert.equal(getPresentationState(waiting, "database"), waiting.state);
  }
});

test("resumed naive UPDATE locks and writes 9 while the app keeps its earlier read of 10", () => {
  const step = simulate({ mode: "naive" }).steps.find(
    (item) => item.action === "resume-write",
  );
  const original = structuredClone(step);
  const request = getPresentationState(step, "request");
  assert.equal(request.rowLock.owner, null);
  assert.equal(request.clients.T2.status, "waiting");

  const database = getPresentationState(step, "database");
  assert.equal(database.committedStock, 9);
  assert.equal(database.completedTransactions, 1);
  assert.deepEqual(database.uncommitted, {
    client: "T2",
    stock: 9,
    version: 2,
  });
  assert.deepEqual(database.rowLock, {
    owner: "T2",
    mode: "update",
    waiting: [],
  });
  assert.equal(database.clients.T2.status, "active");
  assert.equal(database.clients.T2.localRead, 10);
  assert.equal(database.clients.T2.localWrite, 9);
  assert.equal(getPresentationState(step, "complete").clients.T2.localRead, 10);
  assert.deepEqual(step, original);
});

test("resumed FOR UPDATE acquires the lock before the returning 9 reaches the app", () => {
  const step = simulate({ mode: "locked" }).steps.find(
    (item) => item.action === "resume-read",
  );
  const original = structuredClone(step);
  const request = getPresentationState(step, "request");
  assert.equal(request.clients.T2.status, "waiting");
  assert.equal(request.clients.T2.localRead, null);

  const database = getPresentationState(step, "database");
  assert.equal(database.committedStock, 9);
  assert.equal(database.uncommitted, null);
  assert.deepEqual(database.rowLock, {
    owner: "T2",
    mode: "for-update",
    waiting: [],
  });
  assert.equal(database.clients.T2.status, "active");
  assert.equal(database.clients.T2.localRead, null);
  assert.equal(database.clients.T2.localWrite, null);

  const complete = getPresentationState(step, "complete");
  assert.equal(complete.clients.T2.localRead, 9);
  assert.equal(complete.clients.T2.localWrite, null);
  assert.deepEqual(complete.rowLock, database.rowLock);
  assert.deepEqual(step, original);
});
