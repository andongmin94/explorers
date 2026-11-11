import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { lessonsById } from "../src/lessons/index.js";
import { getEncodedLessonPackets, getLessonPackets } from "../src/packets/encode.js";
import { translate } from "../src/i18n.js";
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
// The original distribution remains pinned in its fixture. Only these fields
// changed for the timeout example and the TLS compatibility explanations.
const reviewedCorrections = {
  tcp: {
    lesson: "f4babfed9d148f44331fb3e1f92358de77e9a9258c3809141833279d2d433c66",
    encoding: "7e337b2cfa85ca4b086f60d8bf7f476ff682ad4ffd6822c7c8b4852d8d5e5dd6",
    sequence: "3425b096af9689c3727f8b7c64c2a06c5a727b7cd77343272c7b128588baacc3",
  },
  tls: { lesson: "61f24c71bd8eb9ed1980cce0526c8a17dda3c331885702019280ad7363378155" },
  https: { lesson: "3b63bedaf277bebd6807d8770cdfd3c602b5d04d469823b704ee0572d0cd6333" },
};

test("the original 14 protocols are present", () => {
  assert.deepEqual(Object.keys(lessonsById), Object.keys(baseline));
});

for (const [id, original] of Object.entries(baseline)) {
  const expected = { ...original, ...reviewedCorrections[id] };
  test(`${id}: lesson, encoded packets and sequence match the reviewed baseline`, () => {
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

test("TCP waits for the RTO, fills the gap, and then acknowledges both segments", () => {
  const lesson = lessonsById.tcp;
  const packets = getLessonPackets(lesson);
  const frames = getEncodedLessonPackets(lesson);
  const layout = buildSequenceLayout(lesson);
  const [lost, buffered, duplicate, resend, ack] = layout.packets.slice(5, 10);
  assert.equal(lost.p.lost, true);
  assert.equal(frames[lost.index].tcp.seq, 1);
  assert.equal(frames[buffered.index].tcp.seq, 1461);
  assert.equal(duplicate.sent, buffered.arrived);
  assert.equal(frames[duplicate.index].tcp.ack, 1);
  assert.equal(frames[duplicate.index].fields.find((f) => f.name === "SACK").value, "has 1461–2920");
  assert.equal(resend.sent - lost.sent, 1);
  assert.equal(frames[resend.index].tcp.seq, frames[lost.index].tcp.seq);
  assert.equal(layout.notes.find((n) => n.e.text === "1 s RTO EXPIRED").t, resend.sent);
  assert.equal(ack.sent, resend.arrived);
  assert.equal(frames[ack.index].tcp.ack, 2921);
  assert.equal(packets.at(-1).row.time, "1.105s");
  assert.equal(lesson.outro.facts.find(([label]) => label === "Total time")[1], "1.105 s");
  assert.match(translate(lesson.steps[4].detail), /1\.052초/);
});

test("TLS and HTTPS distinguish the compatibility CCS from encrypted Finished", () => {
  for (const id of ["tls", "https"]) {
    const lesson = lessonsById[id];
    const handshake = lesson.steps.find((s) => s.title === (id === "tls" ? "Server Hello" : "TLS Handshake"));
    assert.match(translate(handshake.detail), /평문.*CCS|CCS.*평문/);
    const index = getLessonPackets(lesson).findIndex((p) => p.label === "FINISHED");
    const { fields } = getEncodedLessonPackets(lesson)[index];
    assert.deepEqual(
      fields.filter((field) => field.name === "Content type").map((field) => field.value),
      ["20 (Change Cipher Spec)", "23 (Application Data)"],
    );
  }
});
