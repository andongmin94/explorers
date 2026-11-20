// Reconstructed from the distributed Protocol Explorer JavaScript.
import type { Lesson, WireData } from "../types.ts";
import {
  CLIENT_IP,
  TCP_MSS,
  formatPacketTime,
  packetEvent,
  tcpConnection,
  tcpFrameBytes,
  tcpHandshakeEvents,
  tcpWire,
  textLinesBytes,
} from "./helpers.ts";
const TCP_SERVER_IP = "203.0.113.10";
const TCP_CLIENT_PORT = 49152;
const TCP_REQUEST_LINES = [
  "GET / HTTP/1.1",
  "Host: www.example.com",
  "User-Agent: curl/8.9.1",
  "Accept: */*",
  "",
];
const TCP_REQUEST_BYTES = textLinesBytes(...TCP_REQUEST_LINES);
const TCP_RESPONSE_BYTES = 2 * TCP_MSS;
const TCP_CONNECTION = tcpConnection(CLIENT_IP, TCP_CLIENT_PORT, TCP_SERVER_IP, 80);
const tcpPacketRow = (
  seconds: number,
  sourceIp: string,
  destinationIp: string,
  info: string,
  frameBytes: number,
  wire: WireData,
) => ({
  time: formatPacketTime(seconds),
  src: sourceIp,
  dst: destinationIp,
  proto: "TCP",
  info,
  len: `${frameBytes} B`,
  wire,
});
const tcpClientRow = (
  seconds: number,
  info: string,
  frameBytes: number,
  flags: string,
  data?: WireData,
  options?: WireData,
) =>
  tcpPacketRow(
    seconds,
    CLIENT_IP,
    TCP_SERVER_IP,
    `${TCP_CLIENT_PORT} → 80 ${info}`,
    frameBytes,
    tcpWire(TCP_CONNECTION, CLIENT_IP, flags, data, options),
  );
const tcpServerRow = (
  seconds: number,
  info: string,
  frameBytes: number,
  flags: string,
  data?: WireData,
  options?: WireData,
) =>
  tcpPacketRow(
    seconds,
    TCP_SERVER_IP,
    CLIENT_IP,
    `80 → ${TCP_CLIENT_PORT} ${info}`,
    frameBytes,
    tcpWire(TCP_CONNECTION, TCP_SERVER_IP, flags, data, options),
  );
const tcpResponseSegment = (startByte: number) => ({
  opaque: TCP_MSS,
  what: `the HTTP response, bytes ${startByte}–${startByte + TCP_MSS - 1}`,
  name: "HTTP",
});
const tcpLesson: Lesson = {
  id: "tcp",
  name: "TCP",
  title: "Reliable Delivery",
  layer: 4,
  nodes: ["client", "router", "internet", "web"],
  latency: {
    "client-web": 0.017,
  },
  legend: [
    ["green", "Handshake and ACKs"],
    ["amber", "Data from laptop"],
    ["violet", "Data from server"],
    ["slate", "Closing (FIN)"],
  ],
  overview: {
    full: "Transmission Control Protocol",
    description:
      "TCP turns the internet’s best-effort packet delivery into a reliable, ordered stream of bytes. It numbers every byte, acknowledges what arrives, resends what goes missing, and paces the sender so neither the other side nor the network is overwhelmed.",
    facts: [
      ["Layer", "Transport (Layer 4)"],
      ["Connection", "Three-way handshake"],
      ["Reliability", "Sequence numbers + ACKs"],
      ["Recovery", "Retransmission"],
      ["Header", "20–60 bytes"],
      ["Defined In", "RFC 9293"],
    ],
  },
  outro: {
    title: "Connection closed",
    desc: "Every byte accounted for",
    text: "TCP opened a connection, numbered and acknowledged every byte, spotted a gap and resent just the missing segment, then closed both directions cleanly. curl received every byte in order and never saw the loss. Press REPLAY to watch it again.",
    facts: [
      ["Segments", "14 (1 lost, 1 resent)"],
      [
        "Bytes delivered",
        `${TCP_REQUEST_BYTES} up, ${TCP_RESPONSE_BYTES.toLocaleString("en-US")} down`,
      ],
      ["Retransmission trigger", "1 s timeout (RTO)"],
      ["Total time", "1.105 s"],
    ],
  },
  start: {
    nodes: ["client"],
    frame: "client",
  },
  steps: [
    {
      title: "Open Connection",
      desc: "Three-way handshake",
      detail:
        "curl already knows the server’s address. Before any data moves, both sides choose a starting sequence number and confirm it: SYN, SYN-ACK, ACK. The numbers here are relative; real ones start at a random value.",
      facts: [
        ["Server", "203.0.113.10, port 80"],
        ["Client port", `${TCP_CLIENT_PORT} (ephemeral)`],
        ["Flags", "SYN → SYN-ACK → ACK"],
      ],
      events: [
        {
          type: "show",
          nodes: ["router", "internet", "web"],
          frame: "full",
        },
        ...tcpHandshakeEvents({
          dst: TCP_SERVER_IP,
          sport: TCP_CLIENT_PORT,
          dport: 80,
          t: [0, 0.017, 0.034],
          quick: false,
        }),
      ],
    },
    {
      title: "Send Data",
      desc: "Every byte is numbered",
      detail: `curl sends its ${TCP_REQUEST_BYTES}-byte HTTP request: bytes 1 to ${TCP_REQUEST_BYTES}. The server’s ACK number, ${TCP_REQUEST_BYTES + 1}, is the next byte it expects, which means everything before it has arrived.`,
      facts: [
        ["Sent", `${TCP_REQUEST_BYTES} bytes (seq 1–${TCP_REQUEST_BYTES})`],
        ["ACK", `${TCP_REQUEST_BYTES + 1} = next byte expected`],
        ["Flags", "PSH, ACK"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "amber",
          "DATA",
          [`seq=1  len=${TCP_REQUEST_BYTES}`, "GET / HTTP/1.1 …"],
          tcpClientRow(
            0.034,
            `[PSH, ACK] Seq=1 Ack=1 Len=${TCP_REQUEST_BYTES}`,
            tcpFrameBytes(TCP_REQUEST_BYTES),
            "PA",
            {
              text: TCP_REQUEST_LINES,
              name: "HTTP",
            },
          ),
        ),
        packetEvent(
          "web",
          "client",
          "green",
          "ACK",
          [`ack=${TCP_REQUEST_BYTES + 1}`],
          tcpServerRow(0.051, `[ACK] Seq=1 Ack=${TCP_REQUEST_BYTES + 1}`, tcpFrameBytes(0), "A"),
        ),
      ],
    },
    {
      title: "Two Segments Back",
      desc: "One of them is lost",
      detail: `The server answers with ${TCP_RESPONSE_BYTES.toLocaleString("en-US")} bytes: two full segments of ${TCP_MSS.toLocaleString("en-US")} bytes, the most that fits in one packet here, sent back to back. The first is dropped somewhere on the internet; the second gets through.`,
      facts: [
        ["Segment 1", `bytes 1–${TCP_MSS} (lost)`],
        ["Segment 2", `bytes ${TCP_MSS + 1}–${TCP_RESPONSE_BYTES}`],
        ["Segment size", `${TCP_MSS.toLocaleString("en-US")} bytes (MSS)`],
      ],
      events: [
        {
          type: "stream",
          from: "web",
          to: "client",
          color: "violet",
          label: "2 SEGMENTS",
          payload: [`seq=1 and seq=${TCP_MSS + 1}`, "the first is lost"],
          packets: [
            packetEvent(
              "web",
              "client",
              "violet",
              "DATA",
              [],
              tcpServerRow(
                0.052,
                `[ACK] Seq=1 Ack=${TCP_REQUEST_BYTES + 1} Len=${TCP_MSS}`,
                tcpFrameBytes(TCP_MSS),
                "A",
                tcpResponseSegment(1),
              ),
              {
                lost: true,
              },
            ),
            packetEvent(
              "web",
              "client",
              "violet",
              "DATA",
              [],
              tcpServerRow(
                0.052,
                `[PSH, ACK] Seq=${TCP_MSS + 1} Ack=${TCP_REQUEST_BYTES + 1} Len=${TCP_MSS}`,
                tcpFrameBytes(TCP_MSS),
                "PA",
                tcpResponseSegment(TCP_MSS + 1),
              ),
            ),
          ],
        },
        {
          type: "note",
          at: "internet",
          text: "SEGMENT 1 LOST",
          tone: "amber",
        },
      ],
    },
    {
      title: "A Gap Is Noticed",
      desc: "Duplicate ACK with SACK",
      detail: `Bytes ${TCP_MSS + 1}–${TCP_RESPONSE_BYTES} arrive, but 1–${TCP_MSS} never did. An ACK can only count bytes received in order, so the laptop repeats ACK 1 at once and adds a SACK block saying it already holds ${TCP_MSS + 1}–${TCP_RESPONSE_BYTES}.`,
      facts: [
        ["ACK", "1 (still waiting for byte 1)"],
        ["SACK", `holds bytes ${TCP_MSS + 1}–${TCP_RESPONSE_BYTES}`],
        ["Sent", "At once, not delayed"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "green",
          "DUP ACK",
          ["ack=1", `sack: has ${TCP_MSS + 1}–${TCP_RESPONSE_BYTES}`],
          tcpClientRow(
            0.069,
            `[ACK] Seq=${TCP_REQUEST_BYTES + 1} Ack=1 SLE=${TCP_MSS + 1} SRE=${TCP_RESPONSE_BYTES + 1}`,
            66,
            "A",
            undefined,
            {
              sack: true,
            },
          ),
        ),
      ],
    },
    {
      title: "Resend the Gap",
      desc: "The retransmission timer expires",
      detail:
        "The SACK reports that segment 2 arrived. With just one duplicate ACK, the server still cannot tell whether segment 1 was lost or delayed. In this example its retransmission timer is 1 second. At 1.052 s the timer expires and the server resends segment 1. The laptop now has both segments and advances its cumulative ACK to 2921.",
      facts: [
        ["Resent", `bytes 1–${TCP_MSS} only`],
        ["Next ACK", `${TCP_RESPONSE_BYTES + 1} (everything)`],
        ["curl saw", "Every byte, in order"],
      ],
      events: [
        { type: "note", at: "web", text: "1 s RTO EXPIRED", tone: "amber" },
        packetEvent(
          "web",
          "client",
          "violet",
          "RESEND",
          ["seq=1  len=1460", "just the missing segment"],
          tcpServerRow(
            1.052,
            `[TCP Retransmission] Seq=1 Ack=${TCP_REQUEST_BYTES + 1} Len=${TCP_MSS}`,
            tcpFrameBytes(TCP_MSS),
            "A",
            tcpResponseSegment(1),
            {
              seq: 1,
            },
          ),
        ),
        packetEvent(
          "client",
          "web",
          "green",
          "ACK",
          [`ack=${TCP_RESPONSE_BYTES + 1}`],
          tcpClientRow(
            1.069,
            `[ACK] Seq=${TCP_REQUEST_BYTES + 1} Ack=${TCP_RESPONSE_BYTES + 1}`,
            tcpFrameBytes(0),
            "A",
          ),
        ),
      ],
    },
    {
      title: "Close Connection",
      desc: "Each side says goodbye",
      detail:
        "curl is done, so it closes. Each direction closes on its own: the laptop sends FIN and the server acknowledges it, then the server sends its own FIN and the laptop acknowledges that. The laptop keeps the connection’s details for a while (TIME-WAIT).",
      facts: [
        ["Closed by", "A FIN from each side"],
        ["Order", "FIN → ACK → FIN → ACK"],
        ["Then", "Laptop waits (TIME-WAIT)"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "slate",
          "FIN",
          [`seq=${TCP_REQUEST_BYTES + 1}  ack=${TCP_RESPONSE_BYTES + 1}`],
          tcpClientRow(
            1.07,
            `[FIN, ACK] Seq=${TCP_REQUEST_BYTES + 1} Ack=${TCP_RESPONSE_BYTES + 1}`,
            tcpFrameBytes(0),
            "FA",
          ),
        ),
        packetEvent(
          "web",
          "client",
          "green",
          "ACK",
          [`ack=${TCP_REQUEST_BYTES + 2}`],
          tcpServerRow(
            1.087,
            `[ACK] Seq=${TCP_RESPONSE_BYTES + 1} Ack=${TCP_REQUEST_BYTES + 2}`,
            tcpFrameBytes(0),
            "A",
          ),
        ),
        packetEvent(
          "web",
          "client",
          "slate",
          "FIN",
          [`seq=${TCP_RESPONSE_BYTES + 1}  ack=${TCP_REQUEST_BYTES + 2}`],
          tcpServerRow(
            1.088,
            `[FIN, ACK] Seq=${TCP_RESPONSE_BYTES + 1} Ack=${TCP_REQUEST_BYTES + 2}`,
            tcpFrameBytes(0),
            "FA",
          ),
        ),
        packetEvent(
          "client",
          "web",
          "green",
          "ACK",
          [`ack=${TCP_RESPONSE_BYTES + 2}`],
          tcpClientRow(
            1.105,
            `[ACK] Seq=${TCP_REQUEST_BYTES + 2} Ack=${TCP_RESPONSE_BYTES + 2}`,
            tcpFrameBytes(0),
            "A",
          ),
        ),
      ],
    },
  ],
};
export { tcpLesson };
