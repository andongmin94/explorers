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
      for (const [value, , why] of question.choices) {
        assert.ok(typeof why === "string" && why.length > 10, `${where}: choice ${value} explains itself (why)`);
      }
      const described = question.choices.map(([, text]) => text !== null && text !== undefined);
      assert.ok(described.every(Boolean) || !described.some(Boolean), `${where}: all choices described, or none`);
      assert.equal(new Set(values).size, values.length, `${where}: choices are distinct`);
      assert.equal(
        values.filter((value) => value === answer).length,
        1,
        `${where}: "${answer}" is exactly one of ${JSON.stringify(values)}`,
      );
      assert.ok(question.prompt, `${where}: prompt`);
      assert.ok(!/\?.*\?/.test(question.prompt), `${where}: one question per prompt`);
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

test("the semantic answer kinds read acknowledgement, RD bit, delivery and connection opener", () => {
  const tcp = getLessonPackets(lessonsById.tcp);
  assert.equal(getPacketAnswer(tcp[4], "ack"), "79", "78 bytes from Seq=1 are acknowledged as 79");
  assert.equal(getPacketAnswer(tcp[7], "ack"), "1", "the duplicate ACK still asks for byte 1");
  assert.equal(getPacketAnswer(tcp[9], "ack"), "2921", "after the resend both segments are acknowledged");
  const dns = getLessonPackets(lessonsById.dns);
  assert.equal(getPacketAnswer(dns[0], "rd"), "1", "laptop → resolver is recursive");
  for (const i of [1, 3, 5]) assert.equal(getPacketAnswer(dns[i], "rd"), "0", `resolver query ${i} is iterative`);
  assert.equal(getPacketAnswer(tcp[0], "rd"), null);
  const dhcp = getLessonPackets(lessonsById.dhcp);
  assert.equal(getPacketAnswer(dhcp[0], "delivery"), "broadcast");
  assert.equal(getPacketAnswer(dhcp[1], "delivery"), "unicast");
  assert.equal(getPacketAnswer(dhcp[2], "delivery"), "broadcast");
  const ftp = getLessonPackets(lessonsById.ftp);
  assert.equal(getPacketAnswer(ftp[12], "connect"), "client>web:50069", "in passive mode the client opens the data connection");
});

test("choices never show internal node ids", () => {
  for (const lessonId of Object.keys(lessonQuizzes)) {
    for (const quiz of getLessonQuizzes(lessonsById[lessonId])) {
      for (const choice of quiz.choices) {
        assert.doesNotMatch(choice.text, /\b(client|router|dns|web|root|tld|auth|mx)>/, `${lessonId} packet ${quiz.packet}: ${choice.text}`);
      }
    }
  }
  const smtp = getLessonQuizzes(lessonsById.smtp).find((quiz) => quiz.kind === "route");
  assert.match(smtp.choices.find((c) => c.correct).text, /DNS 리졸버/);
  const dns = getLessonQuizzes(lessonsById.dns).find((quiz) => quiz.kind === "route");
  assert.match(dns.choices.find((c) => c.correct).text, /\.com TLD/);
});

test("lessons do not repeat another lesson's question", () => {
  const asked = getLessonQuizzes(lessonsById.http).map((quiz) => quiz.answer);
  assert.ok(!asked.includes("SYN, ACK"), "the SYN-ACK question lives in the TCP lesson");
  const https = getLessonQuizzes(lessonsById.https).map((quiz) => quiz.answer);
  assert.ok(!https.includes("CLIENT HELLO"), "the Client Hello question lives in the TLS lesson");
  const prompts = Object.values(lessonQuizzes).flat().map((q) => q.prompt);
  assert.equal(new Set(prompts).size, prompts.length);
});
