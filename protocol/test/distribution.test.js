import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { lessonsById } from "../src/lessons/index.js";
import { getEncodedLessonPackets } from "../src/packets/encode.js";
import { buildSequenceLayout } from "../src/simulation/timeline.js";

// These hashes were captured before the readability refactor. Keep them fixed:
// regenerating them from modified code would hide a change in lesson behavior.
const baseline = JSON.parse(
  await readFile(
    new URL("./fixtures/distribution-baseline.json", import.meta.url),
    "utf8",
  ),
);
const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

test("the original 14 protocols are present", () => {
  assert.deepEqual(Object.keys(lessonsById), Object.keys(baseline));
});

for (const [id, expected] of Object.entries(baseline)) {
  test(`${id}: lesson content, packet bytes and sequence layout match the distribution`, () => {
    const lesson = lessonsById[id];
    const packets = getEncodedLessonPackets(lesson);
    assert.equal(lesson.steps.length, expected.steps);
    assert.equal(packets.length, expected.packets);
    assert.equal(digest(lesson), expected.lesson, "lesson content changed");
    assert.equal(
      digest(packets),
      expected.encoding,
      "packet bytes or decoded fields changed",
    );
    assert.equal(
      digest(buildSequenceLayout(lesson)),
      expected.sequence,
      "sequence layout changed",
    );
  });
}
