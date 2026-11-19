// Prediction quiz: "what will the next packet be?" The questions are written
// by hand in lessons/quizzes.js; the correct answer is never written there but
// read off the real packet (getLessonPackets order), so a question cannot
// disagree with what the scene then shows.
import { getLessonPackets } from "./packets/encode.js";
import { lessonQuizzes } from "./lessons/quizzes.js";
import { NETWORK_NODE_LABELS } from "./simulation/network-drawing.js";
import { translate } from "./i18n.js";

/** A node's name as the lesson shows it (lesson labels first, e.g. smtp.example.com for "web"). */
const nodeName = (lesson, id) => translate((lesson.labels?.[id] ?? NETWORK_NODE_LABELS[id])?.[0] ?? id);

/**
 * The text of a choice that gives no text of its own. Route values are node
 * ids ("dns>root"), never shown as such: they read as "DNS 리졸버 → 루트 서버".
 */
function defaultChoiceText(lesson, kind, value) {
  if (kind === "route") return value.split(">").map((id) => nodeName(lesson, id)).join(" → ");
  return value;
}

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
  /** Who opens a TCP connection, and to which port: "from>to:dport". */
  connect(packet) {
    const port = packet.row?.wire?.tcp?.dport;
    return packet.from && packet.to && port !== undefined ? `${packet.from}>${packet.to}:${port}` : null;
  },
  /** TCP acknowledgement number, as Wireshark prints it (relative). */
  ack(packet) {
    const ack = packet.row?.wire?.tcp?.ack;
    if (ack !== undefined && ack !== null) return String(ack);
    return packet.row?.info?.match(/\bAck=(\d+)/)?.[1] ?? null;
  },
  /** DNS RD (recursion desired) bit of a DNS message: "1" or "0". */
  rd(packet) {
    const dns = packet.row?.wire?.udp?.data?.dns;
    return dns ? (dns.rd ? "1" : "0") : null;
  },
  /** "broadcast" when the IPv4 destination is 255.255.255.255, else "unicast". */
  delivery(packet) {
    const dst = packet.row?.dst;
    return dst ? (dst === "255.255.255.255" ? "broadcast" : "unicast") : null;
  },
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
        choices: question.choices.map(([value, text = defaultChoiceText(lesson, question.kind, value)]) => ({
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
