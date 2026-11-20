// Reconstructed from the distributed Protocol Explorer JavaScript.
import type { Lesson, LessonEvent, PacketRow, WireData } from "../types.ts";
const UDP_CLIENT_IP = "192.168.1.10";
const UDP_SERVER_IP = "203.0.113.20";
const udpPacketEvent = (
  from: string,
  to: string,
  color: string,
  label: string,
  payload: string[],
  row: PacketRow,
  options: Partial<LessonEvent> = {},
): LessonEvent => ({
  type: "packet",
  from,
  to,
  color,
  label,
  payload,
  row,
  ...options,
});
const rtpDatagramWire = (packetNumber: number, outgoing: boolean) => ({
  udp: {
    ...(outgoing
      ? {
          sport: 5e4,
          dport: 5004,
        }
      : {
          sport: 5004,
          dport: 5e4,
        }),
    data: {
      rtp: {
        seq: (outgoing ? 21737 : 4418) + packetNumber,
        ts: (outgoing ? 2617440 : 913280) + 960 * (packetNumber - 1),
        ssrc: outgoing ? 1590076113 : 460833806,
        pt: 111,
        marker: packetNumber === 1,
        audio: 80,
      },
    },
  },
});
const outgoingVoiceEvent = (packetNumber: number, time: string, options?: WireData) =>
  udpPacketEvent(
    "client",
    "web",
    "amber",
    `VOICE ${packetNumber}`,
    [],
    {
      time,
      src: UDP_CLIENT_IP,
      dst: UDP_SERVER_IP,
      proto: "UDP",
      info: "50000 → 5004 Len=92",
      len: "134 B",
      wire: rtpDatagramWire(packetNumber, true),
    },
    options,
  );
const incomingVoiceEvent = (packetNumber: number, time: string) =>
  udpPacketEvent("web", "client", "violet", `REMOTE ${packetNumber}`, [], {
    time,
    src: UDP_SERVER_IP,
    dst: UDP_CLIENT_IP,
    proto: "UDP",
    info: "5004 → 50000 Len=92",
    len: "134 B",
    wire: rtpDatagramWire(packetNumber, false),
  });
const udpLesson: Lesson = {
  id: "udp",
  name: "UDP",
  title: "Fast Datagrams",
  layer: 4,
  nodes: ["client", "router", "internet", "web"],
  latency: {
    "client-web": 0.017,
  },
  labels: {
    web: ["Media Server", UDP_SERVER_IP],
  },
  legend: [
    ["amber", "Your voice"],
    ["violet", "Their voice"],
  ],
  overview: {
    full: "User Datagram Protocol",
    description:
      "UDP sends data in independent packets called datagrams, with no connection, no acknowledgements and no resends. That keeps it fast and light: right for voice, video, games and DNS, where a late answer is worse than a missing one.",
    facts: [
      ["Layer", "Transport (Layer 4)"],
      ["Connection", "None"],
      ["Reliability", "None (no ACKs, no resends)"],
      ["Ordering", "Not guaranteed"],
      ["Header", "8 bytes"],
      ["Defined In", "RFC 768"],
    ],
  },
  outro: {
    title: "Call keeps flowing",
    desc: "Fast, simple, no guarantees",
    text: "Audio started with the very first packet, every datagram travelled on its own, and the one that was lost was simply gone: UDP never noticed. The app covered the gap and the call carried on. Press REPLAY to watch it again.",
    facts: [
      ["Datagrams", "11 (1 lost, never resent)"],
      ["Setup time", "0 ms (no handshake)"],
      ["Header", "8 bytes (TCP: 20+)"],
      ["Shown", "The first 0.2 s of a call"],
    ],
  },
  start: {
    nodes: ["client"],
    frame: "client",
  },
  steps: [
    {
      title: "Send Right Away",
      desc: "No handshake, data goes first",
      detail:
        "A call app already knows the media server’s address and port from signing in. It doesn’t open a connection: the very first datagram already carries 20 ms of your voice, behind an 8-byte UDP header.",
      facts: [
        ["Setup", "None"],
        ["Header", "8 bytes"],
        ["Ports", "50000 → 5004"],
      ],
      events: [
        {
          type: "show",
          nodes: ["router", "internet", "web"],
          frame: "full",
        },
        udpPacketEvent(
          "client",
          "web",
          "amber",
          "VOICE 1",
          ["UDP 50000 → 5004", "80 B of audio + 12 B RTP header"],
          {
            time: "0.000s",
            src: UDP_CLIENT_IP,
            dst: UDP_SERVER_IP,
            proto: "UDP",
            info: "50000 → 5004 Len=92",
            len: "134 B",
            wire: rtpDatagramWire(1, true),
          },
        ),
      ],
    },
    {
      title: "A Stream of Datagrams",
      desc: "One every 20 ms, each on its own",
      detail:
        "The app keeps sending a datagram every 20 ms. Each one stands alone, with its own header and no link to the others. UDP doesn’t number them, and nothing comes back to confirm they arrived.",
      facts: [
        ["Rate", "1 datagram / 20 ms"],
        ["Numbering", "None in UDP itself"],
        ["Confirmation", "None (no ACKs)"],
      ],
      events: [
        {
          type: "stream",
          from: "client",
          to: "web",
          color: "amber",
          label: "4 DATAGRAMS",
          payload: ["voice frames 2–5", "each with its own 8-byte header"],
          packets: [
            outgoingVoiceEvent(2, "0.020s"),
            outgoingVoiceEvent(3, "0.040s"),
            outgoingVoiceEvent(4, "0.060s"),
            outgoingVoiceEvent(5, "0.080s"),
          ],
        },
      ],
    },
    {
      title: "Lost on the Way",
      desc: "Nobody resends it",
      detail:
        "Frame 7 is dropped somewhere on the internet. The media server never asks for it, and UDP never tells the laptop: there are no acknowledgements to miss. The datagrams after it arrive as normal.",
      facts: [
        ["Lost", "Voice frame 7"],
        ["Resent", "Never (no ACKs)"],
        ["Missing", "20 ms of audio"],
      ],
      events: [
        {
          type: "stream",
          from: "client",
          to: "web",
          color: "amber",
          label: "3 DATAGRAMS",
          payload: ["voice frames 6–8", "frame 7 is lost"],
          packets: [
            outgoingVoiceEvent(6, "0.100s"),
            outgoingVoiceEvent(7, "0.120s", {
              lost: true,
            }),
            outgoingVoiceEvent(8, "0.140s"),
          ],
        },
        {
          type: "note",
          at: "web",
          text: "FRAME 7 LOST · NOT RESENT",
          tone: "amber",
        },
      ],
    },
    {
      title: "Replies Come Back",
      desc: "The other voice comes back",
      detail:
        "The other person’s voice arrives the same way, as separate datagrams sent to port 50000. They get back in because your router remembered the outgoing port when it translated your address (NAT).",
      facts: [
        ["Ports", "5004 → 50000"],
        ["Direction", "Independent of ours"],
        ["Through NAT", "Router remembers the port"],
      ],
      events: [
        {
          type: "stream",
          from: "web",
          to: "client",
          color: "violet",
          label: "3 DATAGRAMS",
          payload: ["the other person’s voice", "sent to port 50000"],
          packets: [
            incomingVoiceEvent(1, "0.150s"),
            incomingVoiceEvent(2, "0.170s"),
            incomingVoiceEvent(3, "0.190s"),
          ],
        },
      ],
    },
    {
      title: "The App Decides",
      desc: "Reliability is up to the app",
      detail:
        "The media server receives voice frames 6 and 8 from the laptop. Their RTP sequence numbers reveal the gap. Its audio decoder conceals the missing 20 ms so playback can continue. The laptop keeps sending.",
      facts: [
        ["Ordering", "App’s job (e.g. RTP)"],
        ["Loss", "Hidden by the app"],
        ["Also on UDP", "DNS, games, QUIC"],
      ],
      events: [
        {
          type: "note",
          at: "web",
          text: "APP COVERS THE 20 MS GAP",
          tone: "green",
        },
      ],
    },
  ],
};
export { udpLesson };
