import test from "node:test";
import assert from "node:assert/strict";
import { REFERENCE_STRING, simulate } from "../src/engine.js";

const fifo = simulate({ algorithm: "fifo" });
const lru = simulate({ algorithm: "lru" });

test("the representative trace has the hand-calculated FIFO and LRU outcomes", () => {
  assert.deepEqual(REFERENCE_STRING, [
    "A",
    "B",
    "C",
    "A",
    "D",
    "A",
    "B",
    "E",
    "A",
    "B",
  ]);
  assert.deepEqual(
    fifo.steps.slice(1).map((step) => step.hit),
    [false, false, false, true, false, false, false, false, true, true],
  );
  assert.deepEqual(
    lru.steps.slice(1).map((step) => step.hit),
    [false, false, false, true, false, true, false, false, true, true],
  );
  assert.deepEqual(fifo.stats, {
    accesses: 10,
    hits: 3,
    faults: 7,
    replacements: 4,
    hitRate: 0.3,
    faultRate: 0.7,
  });
  assert.deepEqual(lru.stats, {
    accesses: 10,
    hits: 4,
    faults: 6,
    replacements: 3,
    hitRate: 0.4,
    faultRate: 0.6,
  });
});

test("an A hit keeps FIFO loading order but updates LRU recency", () => {
  assert.deepEqual(fifo.steps[4].beforeOrder, ["A", "B", "C"]);
  assert.deepEqual(fifo.steps[4].order, ["A", "B", "C"]);
  assert.deepEqual(lru.steps[4].beforeOrder, ["A", "B", "C"]);
  assert.deepEqual(lru.steps[4].order, ["B", "C", "A"]);
  for (const run of [fifo, lru]) {
    const a = run.steps[4].frames.find((frame) => frame.page === "A");
    assert.equal(a.loadedAt, 1);
    assert.equal(a.lastUsedAt, 4);
    assert.deepEqual(
      run.steps[4].events.map((event) => event.type),
      ["hit", "access"],
    );
  }
});

test("the D replacement causes the next A reference to miss only with FIFO", () => {
  assert.equal(fifo.steps[5].victim, "A");
  assert.equal(fifo.steps[5].frameIndex, 0);
  assert.equal(lru.steps[5].victim, "B");
  assert.equal(lru.steps[5].frameIndex, 1);
  assert.equal(fifo.steps[6].hit, false);
  assert.equal(fifo.steps[6].victim, "B");
  assert.equal(lru.steps[6].hit, true);
  assert.equal(lru.steps[6].victim, null);
  assert.deepEqual(fifo.steps[5].events, [
    { type: "miss", page: "D" },
    { type: "select", page: "D", frameIndex: 0, victim: "A", reason: "fifo" },
    { type: "evict", page: "A", frameIndex: 0 },
    { type: "load", page: "D", frameIndex: 0 },
    { type: "access", page: "D", frameIndex: 0 },
  ]);
});

test("free frames fill in physical slot order without evictions", () => {
  for (const run of [fifo, lru]) {
    assert.deepEqual(
      run.steps[0].frames.map((frame) => frame.page),
      [null, null, null],
    );
    for (let index = 1; index <= 3; index++) {
      const step = run.steps[index];
      assert.equal(step.frameIndex, index - 1);
      assert.equal(step.victim, null);
      assert.equal(
        step.events.find((event) => event.type === "select").reason,
        "empty",
      );
      assert.deepEqual(
        step.events.map((event) => event.type),
        ["miss", "select", "load", "access"],
      );
    }
  }
});

test("each step preserves frame identities, page uniqueness, and access accounting", () => {
  for (const run of [fifo, lru]) {
    for (const step of run.steps) {
      assert.equal(step.frames.length, 3);
      assert.deepEqual(
        step.frames.map((frame) => frame.slot),
        [0, 1, 2],
      );
      const pages = step.frames
        .filter((frame) => frame.page !== null)
        .map((frame) => frame.page);
      assert.equal(new Set(pages).size, pages.length);
      assert.deepEqual(new Set(step.order), new Set(pages));
      assert.equal(step.hits + step.faults, step.index);
      assert.equal(step.replacements, Math.max(0, step.faults - 3));
      if (step.index === 0) continue;
      assert.equal(step.frames[step.frameIndex].page, step.page);
      assert.deepEqual(step.before, run.steps[step.index - 1].frames);
      assert.equal(step.frames[step.frameIndex].lastUsedAt, step.index);
    }
  }
});

test("snapshots and separate runs do not share mutable frame records", () => {
  const run = simulate({ algorithm: "fifo" });
  run.steps[5].frames[0].page = "changed";
  assert.equal(run.steps[6].before[0].page, "D");
  assert.equal(run.steps[4].frames[0].page, "A");
  assert.equal(simulate({ algorithm: "fifo" }).steps[5].frames[0].page, "D");
});
