// Prediction quiz: "what will the next packet be?" The questions are written
// by hand in lessons/quizzes.js; the correct answer is never written there but
// read off the real packet (getLessonPackets order), so a question cannot
// disagree with what the scene then shows.
import type {
  Lesson,
  LessonEvent,
  LessonStep,
  PlaybackState,
  Quiz,
  QuizQuestion,
} from "./types.ts";
import { getLessonPackets } from "./packets/encode.ts";
import { lessonQuizzes } from "./lessons/quizzes.ts";
import { NETWORK_NODE_LABELS } from "./simulation/network-drawing.ts";
import { translate } from "./i18n.ts";

/** A node's name as the lesson shows it (lesson labels first, e.g. smtp.example.com for "web"). */
const nodeName = (lesson: Lesson, id: string) =>
  translate((lesson.labels?.[id] ?? NETWORK_NODE_LABELS[id])?.[0] ?? id);

/**
 * The text of a choice that gives no text of its own. Route values are node
 * ids ("dns>root"), never shown as such: they read as "DNS 리졸버 → 루트 서버".
 */
function defaultChoiceText(lesson: Lesson, kind: string, value: string) {
  if (kind === "route")
    return value
      .split(">")
      .map((id: string) => nodeName(lesson, id))
      .join(" → ");
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

const transportOf = (packet: LessonEvent) => packet.row?.wire?.tcp ?? packet.row?.wire?.udp ?? null;

/** The last A record in a DNS response carried by this packet. */
function dnsAnswerAddress(packet: LessonEvent) {
  const answers = packet.row?.wire?.udp?.data?.dns?.an ?? [];
  const record = answers.findLast(([, type]: string[]) => type === "A");
  if (record) return record[3];
  // Fall back to the summary line: "... response A 203.0.113.10".
  return packet.row?.info?.match(/\bA (\d{1,3}(?:\.\d{1,3}){3})\b/)?.[1] ?? null;
}

const READERS: Record<string, (packet: LessonEvent) => unknown> = {
  /** The IPv4 address a DNS answer hands back. */
  address: dnsAnswerAddress,
  /** TCP flags as Wireshark prints them: "SYN, ACK". */
  flags(packet: LessonEvent) {
    const flags = packet.row?.wire?.tcp?.flags;
    if (typeof flags === "string") {
      const names = TCP_FLAG_NAMES.filter(([letter]) => flags.includes(letter)).map(
        ([, name]) => name,
      );
      return names.length ? names.join(", ") : null;
    }
    return packet.row?.info?.match(/\[([A-Z]{3}(?:, [A-Z]{3})*)\]/)?.[1] ?? null;
  },
  /** The packet's name in the scene (its tag and sequence label). */
  message: (packet: LessonEvent) => packet.label ?? null,
  /** Destination port. */
  port(packet: LessonEvent) {
    const port = transportOf(packet)?.dport;
    return port === undefined ? null : String(port);
  },
  /** Source port (after NAT where the packet was rewritten). */
  sport(packet: LessonEvent) {
    const port = transportOf(packet)?.sport;
    return port === undefined ? null : String(port);
  },
  /** IPv4 source address (after NAT where the packet was rewritten). */
  source: (packet: LessonEvent) => packet.row?.src ?? null,
  /** Which link the packet takes: "from>to" node ids. */
  route: (packet: LessonEvent) => (packet.from && packet.to ? `${packet.from}>${packet.to}` : null),
  /** Who opens a TCP connection, and to which port: "from>to:dport". */
  connect(packet: LessonEvent) {
    const port = packet.row?.wire?.tcp?.dport;
    return packet.from && packet.to && port !== undefined
      ? `${packet.from}>${packet.to}:${port}`
      : null;
  },
  /** TCP acknowledgement number, as Wireshark prints it (relative). */
  ack(packet: LessonEvent) {
    const ack = packet.row?.wire?.tcp?.ack;
    if (ack !== undefined && ack !== null) return String(ack);
    return packet.row?.info?.match(/\bAck=(\d+)/)?.[1] ?? null;
  },
  /** DNS RD (recursion desired) bit of a DNS message: "1" or "0". */
  rd(packet: LessonEvent) {
    const dns = packet.row?.wire?.udp?.data?.dns;
    return dns ? (dns.rd ? "1" : "0") : null;
  },
  /** "broadcast" when the IPv4 destination is 255.255.255.255, else "unicast". */
  delivery(packet: LessonEvent) {
    const dst = packet.row?.dst;
    return dst ? (dst === "255.255.255.255" ? "broadcast" : "unicast") : null;
  },
};

/** The correct answer for `kind`, read off the packet; null if it has none. */
function getPacketAnswer(packet: LessonEvent | undefined, kind: string) {
  const read = READERS[kind];
  if (!packet || !read) return null;
  const value = read(packet);
  return value === undefined || value === null || value === "" ? null : String(value);
}

const quizCache = new WeakMap<Lesson, Quiz[]>();

/** A lesson's questions with their packets and graded choices, in packet order. */
function getLessonQuizzes(lesson: Lesson): Quiz[] {
  if (!quizCache.has(lesson)) quizCache.set(lesson, buildLessonQuizzes(lesson));
  return quizCache.get(lesson)!;
}
function buildLessonQuizzes(lesson: Lesson): Quiz[] {
  const packets = getLessonPackets(lesson);
  const where = getPacketPositions(lesson);
  return (lessonQuizzes[lesson.id] ?? [])
    .map((question: QuizQuestion): Quiz => {
      const packet = packets[question.packet];
      const answer = getPacketAnswer(packet, question.kind);
      return {
        ...question,
        packetData: packet,
        answer,
        step: where[question.packet]?.step ?? -1,
        choices: question.choices.map(([value, text, why]) => ({
          value,
          text: text ?? defaultChoiceText(lesson, question.kind, value),
          why,
          correct: value === answer,
        })),
      };
    })
    .filter((quiz: Quiz) => quiz.answer !== null && quiz.choices.some((choice) => choice.correct))
    .sort((a, b) => a.packet - b.packet);
}

/** Index of the next packet still to be sent, or -1 when none is left. */
const getUpcomingPacket = (playback: PlaybackState | null | undefined) =>
  playback?.packets.indexOf("future") ?? -1;

/**
 * The question for the packet about to be sent, if there is one. While a
 * stream is in flight its next packet can still be asked about, so the check
 * is on packet states, not on events.
 */
function getQuizForStep(lesson: Lesson, playback: PlaybackState | null | undefined) {
  if (!lesson || !playback || playback.done) return null;
  const upcoming = getUpcomingPacket(playback);
  if (upcoming < 0) return null;
  return getLessonQuizzes(lesson).find((quiz: Quiz) => quiz.packet === upcoming) ?? null;
}

/** The first question at or after the upcoming packet (for "what's next"). */
function nextQuiz(lesson: Lesson, playback: PlaybackState | null | undefined) {
  const upcoming = getUpcomingPacket(playback);
  if (upcoming < 0) return null;
  return getLessonQuizzes(lesson).find((quiz: Quiz) => quiz.packet >= upcoming) ?? null;
}

/**
 * Where each packet sits in the player's event list: { step, event, k }.
 * `event` is the index in createLessonPlayer's events (a focus event comes
 * first), `k` the packet's position inside a stream (0 for single packets).
 */
function getPacketPositions(lesson: Lesson) {
  const positions: { step: number; event: number; k: number }[] = [];
  let eventIndex = 1;
  lesson.steps.forEach((step: LessonStep, stepIndex: number) =>
    step.events.forEach((event: LessonEvent) => {
      if (event.type === "packet") positions.push({ step: stepIndex, event: eventIndex, k: 0 });
      if (event.type === "stream")
        event.packets!.forEach((_, k) => positions.push({ step: stepIndex, event: eventIndex, k }));
      eventIndex++;
    }),
  );
  return positions;
}

/**
 * The 핵심 장면 of a lesson: the steps with a prediction, in order. Guided
 * playback stops before each of their questions.
 */
function getKeySteps(lesson: Lesson) {
  return [...new Set(getLessonQuizzes(lesson).map((quiz: Quiz) => quiz.step))].sort(
    (a, b) => a - b,
  );
}

/**
 * Guided stops: player event indices to hold before (a question about the
 * event's first packet) and packets inside a stream to hold before.
 */
function getGuidedStops(lesson: Lesson) {
  const where = getPacketPositions(lesson);
  const events = new Set<number>();
  const midStream = new Set<number>();
  for (const quiz of getLessonQuizzes(lesson)) {
    const position = where[quiz.packet];
    if (position.k === 0) events.add(position.event);
    else midStream.add(quiz.packet);
  }
  return { events, midStream };
}

/**
 * The question that still hides the explanation: the one for the upcoming
 * packet, until it is answered or the packet has passed. `answered` holds
 * the packet indices answered in this lesson.
 */
function getPendingQuiz(
  lesson: Lesson,
  playback: PlaybackState | null | undefined,
  answered = new Set(),
) {
  const quiz = getQuizForStep(lesson, playback);
  return quiz && !answered.has(quiz.packet) ? quiz : null;
}

export {
  getGuidedStops,
  getKeySteps,
  getLessonQuizzes,
  getPacketAnswer,
  getPacketPositions,
  getPendingQuiz,
  getQuizForStep,
  getUpcomingPacket,
  nextQuiz,
};
