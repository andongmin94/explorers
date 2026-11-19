// Prediction quiz: "what will the next packet be?" The questions are written
// by hand in lessons/quizzes.js; the correct answer is never written there but
// read off the real packet (getLessonPackets order), so a question cannot
// disagree with what the scene then shows.
import { getLessonPackets } from "./packets/encode.js";
import { lessonQuizzes } from "./lessons/quizzes.js";

// Wireshark's order for TCP flag names.
const TCP_FLAG_NAMES = [
  ["F", "FIN"],
  ["S", "SYN"],
  ["R", "RST"],
  ["P", "PSH"],
  ["A", "ACK"],
  ["U", "URG"],
];

const transportOf = (packet) => packet.row?.wire?.tcp ?? packet.row?.wire?.udp ?? null;

/** The last A record in a DNS response carried by this packet. */
function dnsAnswerAddress(packet) {
  const answers = packet.row?.wire?.udp?.data?.dns?.an ?? [];
  const record = answers.findLast(([, type]) => type === "A");
  if (record) return record[3];
  // Fall back to the summary line: "... response A 203.0.113.10".
  return packet.row?.info?.match(/\bA (\d{1,3}(?:\.\d{1,3}){3})\b/)?.[1] ?? null;
}

const READERS = {
  /** The IPv4 address a DNS answer hands back. */
  address: dnsAnswerAddress,
  /** TCP flags as Wireshark prints them: "SYN, ACK". */
  flags(packet) {
    const flags = packet.row?.wire?.tcp?.flags;
    if (typeof flags === "string") {
      const names = TCP_FLAG_NAMES.filter(([letter]) => flags.includes(letter)).map(([, name]) => name);
      return names.length ? names.join(", ") : null;
    }
    return packet.row?.info?.match(/\[([A-Z]{3}(?:, [A-Z]{3})*)\]/)?.[1] ?? null;
  },
  /** The packet's name in the scene (its tag and sequence label). */
  message: (packet) => packet.label ?? null,
  /** Destination port. */
  port(packet) {
    const port = transportOf(packet)?.dport;
    return port === undefined ? null : String(port);
  },
  /** Source port (after NAT where the packet was rewritten). */
  sport(packet) {
    const port = transportOf(packet)?.sport;
    return port === undefined ? null : String(port);
  },
  /** Which link the packet takes: "from>to" node ids. */
  route: (packet) => (packet.from && packet.to ? `${packet.from}>${packet.to}` : null),
};

/** The correct answer for `kind`, read off the packet; null if it has none. */
function getPacketAnswer(packet, kind) {
  const read = READERS[kind];
  if (!packet || !read) return null;
  const value = read(packet);
  return value === undefined || value === null || value === "" ? null : String(value);
}

const quizCache = new WeakMap();

/** A lesson's questions with their packets and graded choices, in packet order. */
function getLessonQuizzes(lesson) {
  if (!quizCache.has(lesson)) quizCache.set(lesson, buildLessonQuizzes(lesson));
  return quizCache.get(lesson);
}
function buildLessonQuizzes(lesson) {
  const packets = getLessonPackets(lesson);
  return (lessonQuizzes[lesson.id] ?? [])
    .map((question) => {
      const packet = packets[question.packet];
      const answer = getPacketAnswer(packet, question.kind);
      return {
        ...question,
        packetData: packet,
        answer,
        choices: question.choices.map(([value, text = value]) => ({
          value,
          text,
          correct: value === answer,
        })),
      };
    })
    .filter((quiz) => quiz.answer !== null && quiz.choices.some((choice) => choice.correct))
    .sort((a, b) => a.packet - b.packet);
}

/** Index of the next packet still to be sent, or -1 when none is left. */
const getUpcomingPacket = (playback) => playback?.packets.indexOf("future") ?? -1;

/**
 * The question for the packet about to be sent, if there is one. While a
 * stream is in flight its next packet can still be asked about, so the check
 * is on packet states, not on events.
 */
function getQuizForStep(lesson, playback) {
  if (!lesson || !playback || playback.done) return null;
  const upcoming = getUpcomingPacket(playback);
  if (upcoming < 0) return null;
  return getLessonQuizzes(lesson).find((quiz) => quiz.packet === upcoming) ?? null;
}

/** The first question at or after the upcoming packet (for "what's next"). */
function nextQuiz(lesson, playback) {
  const upcoming = getUpcomingPacket(playback);
  if (upcoming < 0) return null;
  return getLessonQuizzes(lesson).find((quiz) => quiz.packet >= upcoming) ?? null;
}

export { getLessonQuizzes, getPacketAnswer, getQuizForStep, getUpcomingPacket, nextQuiz };
