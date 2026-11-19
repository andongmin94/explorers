import test from "node:test";
import assert from "node:assert/strict";
import { REFERENCE_STRING, simulate } from "../src/engine.js";
import { BELADY_STRING, countFaults } from "../src/policies.js";

test("FIFO and LRU counts agree with the lesson engine", () => {
  for (const policy of ["fifo", "lru"]) {
    const { stats } = simulate({ algorithm: policy });
    assert.deepEqual(countFaults(REFERENCE_STRING, 3, policy), {
      hits: stats.hits,
      faults: stats.faults,
      replacements: stats.replacements,
    });
  }
});

test("OPT evicts the page used furthest in the future and is the lower bound here", () => {
  // A B C | A hit | D evicts C (never used again) | A B hit | E evicts D | A B hit
  assert.deepEqual(countFaults(REFERENCE_STRING, 3, "opt"), { hits: 5, faults: 5, replacements: 2 });
  for (const policy of ["fifo", "lru"])
    assert.ok(countFaults(REFERENCE_STRING, 3, "opt").faults <= countFaults(REFERENCE_STRING, 3, policy).faults);
});

test("a loop larger than memory defeats LRU, and FIFO shows Belady's anomaly", () => {
  assert.equal(countFaults(["A", "B", "C", "D", "A", "B", "C", "D"], 3, "lru").faults, 8);
  assert.equal(countFaults(BELADY_STRING, 3, "fifo").faults, 9);
  assert.equal(countFaults(BELADY_STRING, 4, "fifo").faults, 10);
  assert.throws(() => countFaults(REFERENCE_STRING, 3, "clock"), RangeError);
});
