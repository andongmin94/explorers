import assert from "node:assert/strict";
import test from "node:test";
import { lessonsById } from "../src/lessons/index.js";
import { lessonQuizzes } from "../src/lessons/quizzes.js";
import { getLessonPackets } from "../src/packets/encode.js";
import { getLessonQuizzes, getPacketAnswer, getQuizForStep } from "../src/quiz.js";

for (const [lessonId, questions] of Object.entries(lessonQuizzes)) {
  test(`${lessonId}: every prediction question is graded by its packet`, () => {
    const lesson = lessonsById[lessonId];
    assert.ok(lesson, `lesson ${lessonId} exists`);
    const packets = getLessonPackets(lesson);
    for (const question of questions) {
      const where = `${lessonId} packet ${question.packet} (${question.kind})`;
      const packet = packets[question.packet];
      assert.ok(packet, `${where}: packet exists`);
      const answer = getPacketAnswer(packet, question.kind);
      assert.equal(typeof answer, "string", `${where}: answer read off the packet`);
      const values = question.choices.map(([value]) => value);
      assert.equal(new Set(values).size, values.length, `${where}: choices are distinct`);
      assert.equal(
        values.filter((value) => value === answer).length,
        1,
        `${where}: "${answer}" is exactly one of ${JSON.stringify(values)}`,
      );
      assert.ok(question.prompt && question.explain, `${where}: prompt and explanation`);
    }
    assert.equal(getLessonQuizzes(lesson).length, questions.length, "no question dropped");
  });
}

test("getPacketAnswer reads each kind off the packet data", () => {
  const http = getLessonPackets(lessonsById.http);
  assert.equal(getPacketAnswer(http[1], "address"), "203.0.113.10");
  assert.equal(getPacketAnswer(http[2], "port"), "80");
  assert.equal(getPacketAnswer(http[2], "sport"), "52344");
  assert.equal(getPacketAnswer(http[2], "flags"), "SYN");
  assert.equal(getPacketAnswer(http[3], "flags"), "SYN, ACK");
  assert.equal(getPacketAnswer(http[3], "route"), "web>client");
  assert.equal(getPacketAnswer(http[3], "message"), "SYN-ACK");
  assert.equal(getPacketAnswer(http[3], "nonsense"), null);
  assert.equal(getPacketAnswer(undefined, "port"), null);
});

test("getQuizForStep offers the question for the packet about to be sent", () => {
  const dhcp = lessonsById.dhcp;
  const count = getLessonPackets(dhcp).length;
  const at = (sent) => ({
    started: sent > 0,
    done: false,
    packets: Array.from({ length: count }, (_, index) => (index < sent ? "past" : "future")),
  });
  assert.equal(getQuizForStep(dhcp, at(0))?.packet, 0);
  assert.equal(getQuizForStep(dhcp, at(2))?.packet, 2);
  assert.equal(getQuizForStep(dhcp, at(count)), null);
  assert.equal(getQuizForStep(dhcp, { ...at(1), done: true }), null);
  assert.equal(getQuizForStep(lessonsById.http, at(0)), null, "no question before HTTP's DNS query");
});
