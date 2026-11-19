import test from "node:test";
import assert from "node:assert/strict";
import { josa } from "../src/josa.js";

test("frame labels take particles by their Sino-Korean reading (영·일·이)", () => {
  const ko = { digits: "ko" };
  assert.equal(josa("F0", "를", ko), "F0을");
  assert.equal(josa("F1", "를", ko), "F1을");
  assert.equal(josa("F2", "을", ko), "F2를");
  assert.equal(josa("F0", "로", ko), "F0으로");
  assert.equal(josa("F1", "으로", ko), "F1로");
  assert.equal(josa("F2", "으로", ko), "F2로");
  assert.equal(josa("프레임 2", "을", ko), "프레임 2를");
  assert.equal(josa("페이지 A", "은", ko), "페이지 A는");
});
