import test from "node:test";
import assert from "node:assert/strict";
import { josa } from "../src/josa.js";

test("process ids take particles by their English reading (피원·피투·피쓰리)", () => {
  assert.equal(josa("P1", "가"), "P1이");
  assert.equal(josa("P2", "가"), "P2가");
  assert.equal(josa("P3", "이"), "P3가");
  assert.equal(josa("P1", "로"), "P1으로");
  assert.equal(josa("P2", "으로"), "P2로");
  assert.equal(josa("P1", "였"), "P1이었");
  assert.equal(josa("P3", "이었"), "P3였");
  assert.equal(josa("P1", "는"), "P1은");
  assert.equal(josa("작업", "가"), "작업이");
  assert.throws(() => josa("P1", "의"), RangeError);
});
