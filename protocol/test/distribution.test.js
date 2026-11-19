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
// Endpoint readouts are additional network-diagram state, outside the original wire/lesson fixture.
const digest = (value) => createHash("sha256").update(JSON.stringify(value, (key, item) =>
  key === "devices" || key === "devicesAfter" ? undefined : item,
)).digest("hex");
// The fixture preserves the original distribution. The behavioral tests below
// cover the reviewed lesson corrections and the shared LAN frame encoder.
const reviewedCorrections = {
  udp: {
    lesson: "d523d7cbbe25cb03f422c73a34be8152dc6bc7f669b1ebc9ff30f1def567aabc",
    sequence: "81af9a223b138ba9dfa31f6db5acf1664d31e300ebe30342fbdc3d49d6d4b17f",
  },
  ip: {
    lesson: "ce928370c39e7315a16dc28f6b37d7008afaebc9d04b7dd0f69e96bd9873da53",
    encoding: "97ff96fae163df84696d0740455cda9cc3e9f4d2a5ef33efb3052025274c2d5b",
    sequence: "f544a71076427313a3e018970c4d281757e71a5d8f95b3b875d0b9e093c9172d",
  },
  dhcp: {
    lesson: "fcf2031ceb653cca14b1ed9d797dc0f009dbccb59a8c6ece056ad36c7505c895",
    encoding: "b7e084412e3c60768ecf47ddd81c1b5b66a6ce470a8592344c10f436eb7a3b2a",
    sequence: "34fe4cc1cc3e6d4f0d3f3bb1c3316d86dc2e02b313b85fb89821b8bf169e6e35",
  },
  icmp: { encoding: "9db27999c606d0ad13d34336d04ee5a48aebc49ac24c2ef34c5d7a1d81ea42f0" },
  smtp: {
    lesson: "36aa3125bc0d34a6a7d8eebf9677628d1bcf1b58e857e56cc8aa8069d932981a",
    sequence: "82645d0874e689e99ae336f069d04b0e3f13d05eccc286866e6759b0d94f3382",
  },
  tcp: {
    lesson: "f4babfed9d148f44331fb3e1f92358de77e9a9258c3809141833279d2d433c66",
    encoding: "7e337b2cfa85ca4b086f60d8bf7f476ff682ad4ffd6822c7c8b4852d8d5e5dd6",
    sequence: "3425b096af9689c3727f8b7c64c2a06c5a727b7cd77343272c7b128588baacc3",
  },
  // Steps 2–4 state as a fact that the resolver's own queries are iterative
  // (RD=0); only the facts changed, not the packets or the sequence.
  dns: { lesson: "98da24902b9d294738ec1a22020190f315666ba9238adde6e25b4b6e18076ec0" },
  tls: { lesson: "61f24c71bd8eb9ed1980cce0526c8a17dda3c331885702019280ad7363378155" },
  https: { lesson: "3b63bedaf277bebd6807d8770cdfd3c602b5d04d469823b704ee0572d0cd6333" },
};

test("the original 14 protocols are present", () => {
  assert.deepEqual(Object.keys(lessonsById), Object.keys(baseline));
});

test("DHCP Ethernet fields and destination-first bytes match LAN delivery", () => {
  const client = "00:00:5e:00:53:10", router = "00:00:5e:00:53:01", all = "ff:ff:ff:ff:ff:ff";
  const expected = [[client, all], [router, client], [client, all], [router, client], [client, router], [router, client]];
  getEncodedLessonPackets(lessonsById.dhcp).forEach((frame, i) => {
    const [source, destination] = expected[i];
    const mac = (name) => frame.fields.find((f) => f.layer === "eth" && f.name === name).value;
    assert.deepEqual([mac("Source"), mac("Destination")], [source, destination]);
    assert.equal(Buffer.from(frame.bytes.slice(0, 12)).toString("hex"), (destination + source).replaceAll(":", ""));
  });
});

test("NAT forwarding retains the original sender's TTL in its explanation", () => {
  const before = getEncodedLessonPackets(lessonsById.ip)[2].fields.find((f) => f.name === "Time to live");
  const after = getEncodedLessonPackets(lessonsById.ip)[3].fields.find((f) => f.name === "Time to live");
  assert.equal(Number(before.value) - Number(after.value), 1);
  assert.match(translate(after.note), /128.*라우터.*127/);
});

test("UDP conceals loss at the receiving endpoint and distinguishes RTP from audio", () => {
  const lesson = lessonsById.udp;
  const lost = getLessonPackets(lesson).find((packet) => packet.lost);
  const note = buildSequenceLayout(lesson).notes.at(-1);
  assert.equal(note.lane, lost.to);
  const frame = getEncodedLessonPackets(lesson)[0];
  const audio = frame.fields.find((f) => f.name === "Audio");
  assert.equal(audio.to - audio.from, 80);
  assert.match(translate(getLessonPackets(lesson)[0].payload[1]), /80 B.*12 B/);
});

test("SMTP separates the delivery queue, the acknowledgement, and local storage", () => {
  const lastEvents = lessonsById.smtp.steps.at(-1).events.slice(-3);
  assert.deepEqual(lastEvents.map((event) => event.type), ["note", "packet", "note"]);
  assert.equal(lastEvents[0].at, lastEvents[1].from);
  assert.equal(lastEvents[2].at, lastEvents[1].from);
  assert.match(lastEvents[1].row.info, /250 .*queued/);
  assert.match(translate(lastEvents[0].text), /대기열/);
  assert.match(translate(lastEvents[2].text), /메일함에 저장/);
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

test("DNS names the resolver's queries iterative (RD=0) and the laptop's recursive", () => {
  const lesson = lessonsById.dns;
  const frames = getEncodedLessonPackets(lesson);
  const flags = (i) => frames[i].fields.findLast((f) => f.name === "Flags").value;
  assert.match(flags(0), /RD/);
  for (const [step, packet] of [[1, 1], [2, 3], [3, 5]]) {
    assert.deepEqual(lesson.steps[step].facts.at(-1), ["Query flags", "RD=0 (iterative query)"]);
    assert.doesNotMatch(flags(packet), /RD/);
  }
  assert.match(translate(lesson.steps[1].detail), /재귀 질의\(RD=1\).*반복 질의\(RD=0\)/);
});
