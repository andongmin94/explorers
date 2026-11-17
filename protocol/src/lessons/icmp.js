// Reconstructed from the distributed Protocol Explorer JavaScript.
import {
  CLIENT_IP,
  ROUTER_IP,
  formatPacketTime,
  packetEvent,
} from "./helpers.js";
const ICMP_SERVER_IP = "203.0.113.10";
const ICMP_SECOND_HOP_IP = "198.51.100.1";
const icmpPacketRow = (
  seconds,
  sourceIp,
  destinationIp,
  info,
  sizeLabel,
  wire,
) => ({
  time: formatPacketTime(seconds),
  src: sourceIp,
  dst: destinationIp,
  proto: "ICMP",
  info,
  len: sizeLabel,
  wire,
});
const ICMP_ECHO_DATA = "abcdefghijklmnopqrstuvwabcdefghi";
const icmpEchoWire = (type, sequenceNumber, ttl) => ({
  icmp: {
    type,
    code: 0,
    id: 1,
    seq: sequenceNumber,
    data: ICMP_ECHO_DATA,
  },
  ...(ttl
    ? {
        ttl,
      }
    : {}),
});
const icmpErrorWire = (type, code, ttl, quotedBytes = "all") => ({
  icmp: {
    type,
    code,
    quote: -1,
    ttl,
    quoteBytes: quotedBytes,
  },
});
const icmpLesson = {
  id: "icmp",
  name: "ICMP",
  title: "Network Diagnostics",
  layer: 3,
  nodes: ["client", "router", "internet", "web"],
  latency: {
    "client-router": 0.001,
    "client-internet": 0.005,
    "client-web": 0.017,
  },
  legend: [
    ["amber", "Ping / probe"],
    ["green", "Echo reply"],
    ["slate", "Error report"],
  ],
  overview: {
    full: "Internet Control Message Protocol",
    description:
      "ICMP is how the network reports back: a router says a packet’s time ran out, a server says nothing is listening on a port. Tools like ping and traceroute are built from these messages. It travels inside IP but carries no application data.",
    facts: [
      ["Layer", "Network (Layer 3)"],
      ["Carried in", "IP (protocol 1)"],
      ["Messages", "A type and a code"],
      ["Tools", "ping, tracert / traceroute"],
      ["Often", "Filtered by firewalls"],
      ["Defined In", "RFC 792 (IPv6: RFC 4443)"],
    ],
  },
  outro: {
    title: "The network answered",
    desc: "Replies, expiries and errors",
    text: "An echo request measured the round trip, packets with a small TTL made each router on the path identify itself, and a closed port was reported straight back. Press REPLAY to watch it again.",
    facts: [
      ["Round trip", "34 ms"],
      ["Path", "12 routers, server at hop 13"],
      ["Types used", "8, 0, 11 and 3"],
      ["Reply TTL", "52 (64 − 12 routers)"],
    ],
  },
  start: {
    nodes: ["client"],
    frame: "client",
  },
  steps: [
    {
      title: "Ping",
      desc: "Echo request",
      detail:
        "“ping -n 1 203.0.113.10” sends one ICMP echo request (plain ping sends four, a second apart): type 8, code 0, with an identifier, a sequence number and 32 bytes of filler. The server’s system answers by itself, no application needed.",
      facts: [
        ["Type, code", "8, 0 (echo request)"],
        ["Data", "32 bytes (Windows)"],
        ["TTL", "128"],
      ],
      events: [
        {
          type: "show",
          nodes: ["router", "internet", "web"],
          frame: "full",
        },
        packetEvent(
          "client",
          "web",
          "amber",
          "ECHO REQUEST",
          ["type 8 · seq 1", "32 bytes of data"],
          icmpPacketRow(
            0,
            CLIENT_IP,
            ICMP_SERVER_IP,
            "Echo (ping) request id=0x0001, seq=1, ttl=128",
            "74 B",
            icmpEchoWire(8, 1),
          ),
        ),
      ],
    },
    {
      title: "Echo Reply",
      desc: "Round-trip time",
      detail:
        "The server sends back an echo reply, type 0, with the same identifier, sequence number and data. Ping prints the time it took and the TTL the reply arrived with: “bytes=32 time=34ms TTL=52”.",
      facts: [
        ["Type, code", "0, 0 (echo reply)"],
        ["Round trip", "34 ms"],
        ["TTL on arrival", "52 (64 − 12 routers)"],
      ],
      events: [
        packetEvent(
          "web",
          "client",
          "green",
          "ECHO REPLY",
          ["type 0 · seq 1", "same 32 bytes back"],
          icmpPacketRow(
            0.017,
            ICMP_SERVER_IP,
            CLIENT_IP,
            "Echo (ping) reply id=0x0001, seq=1, ttl=52",
            "74 B",
            icmpEchoWire(0, 1),
          ),
        ),
        {
          type: "note",
          at: "client",
          text: "TIME=34MS TTL=52",
          tone: "green",
        },
      ],
    },
    {
      title: "TTL 1",
      desc: "The first router answers",
      detail:
        "“ping -n 1 -i 1” sends the same request with a TTL of 1. The home router lowers it to 0, so it must drop the packet, and it sends back a Time Exceeded message from its own address: “Reply from 192.168.1.1: TTL expired in transit.”",
      facts: [
        ["Sent with", "TTL 1"],
        ["Dropped by", "Router 192.168.1.1"],
        ["Type, code", "11, 0 (time exceeded)"],
      ],
      events: [
        packetEvent(
          "client",
          "router",
          "amber",
          "TTL 1",
          ["echo request", "expires at the first router"],
          icmpPacketRow(
            1,
            CLIENT_IP,
            ICMP_SERVER_IP,
            "Echo (ping) request id=0x0001, seq=2, ttl=1",
            "74 B",
            icmpEchoWire(8, 2, 1),
          ),
        ),
        packetEvent(
          "router",
          "client",
          "slate",
          "TIME EXCEEDED",
          ["type 11 · from 192.168.1.1", "quotes the dropped header"],
          icmpPacketRow(
            1.001,
            ROUTER_IP,
            CLIENT_IP,
            "Time-to-live exceeded (in transit)",
            "102 B",
            icmpErrorWire(11, 0, 1),
          ),
        ),
      ],
    },
    {
      title: "TTL 2",
      desc: "The next router answers",
      detail:
        "With “-i 2”, the home router lowers the TTL to 1 and forwards it. The first router at the internet provider lowers it to 0 and reports back from 198.51.100.1. The home router translates the report back to the laptop like any reply.",
      facts: [
        ["Sent with", "TTL 2"],
        ["Dropped by", "ISP router 198.51.100.1"],
        ["Type, code", "11, 0 (time exceeded)"],
      ],
      events: [
        packetEvent(
          "client",
          "internet",
          "amber",
          "TTL 2",
          ["echo request", "expires at the second router"],
          icmpPacketRow(
            2,
            CLIENT_IP,
            ICMP_SERVER_IP,
            "Echo (ping) request id=0x0001, seq=3, ttl=2",
            "74 B",
            icmpEchoWire(8, 3, 2),
          ),
        ),
        {
          type: "note",
          at: "internet",
          text: "HOP 2 · 198.51.100.1",
          tone: "navy",
        },
        packetEvent(
          "internet",
          "client",
          "slate",
          "TIME EXCEEDED",
          ["type 11 · from 198.51.100.1", "quotes the dropped header"],
          icmpPacketRow(
            2.005,
            ICMP_SECOND_HOP_IP,
            CLIENT_IP,
            "Time-to-live exceeded (in transit)",
            "70 B",
            icmpErrorWire(11, 0, 1, 8),
          ),
        ),
      ],
    },
    {
      title: "That’s Traceroute",
      desc: "TTL 1, 2, 3 … until it arrives",
      detail:
        "tracert automates this: it raises the TTL by one each time, sends three probes per hop and lists who reports back. Hops 3 to 12 work the same way, and with TTL 13 the request finally reaches the server, which replies normally.",
      facts: [
        ["Hops", "12 routers, then the server"],
        ["Per hop", "3 probes"],
        ["On Linux", "traceroute sends UDP"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "amber",
          "TTL 13",
          ["echo request", "enough hops to arrive"],
          icmpPacketRow(
            3,
            CLIENT_IP,
            ICMP_SERVER_IP,
            "Echo (ping) request id=0x0001, seq=4, ttl=13",
            "74 B",
            icmpEchoWire(8, 4, 13),
          ),
        ),
        packetEvent(
          "web",
          "client",
          "green",
          "ECHO REPLY",
          ["the server itself answers", "end of the route"],
          icmpPacketRow(
            3.017,
            ICMP_SERVER_IP,
            CLIENT_IP,
            "Echo (ping) reply id=0x0001, seq=4, ttl=52",
            "74 B",
            icmpEchoWire(0, 4),
          ),
        ),
      ],
    },
    {
      title: "Unreachable",
      desc: "Nothing listening on that port",
      detail:
        "An app sends a UDP datagram to port 9999, where nothing is listening. The server can’t deliver it, so it replies with Destination Unreachable, code 3 (port unreachable), quoting the start of the datagram. Many firewalls drop such packets silently instead.",
      facts: [
        ["Type, code", "3, 3 (port unreachable)"],
        ["Other codes", "0 net, 1 host, 4 too big"],
        ["Firewalls", "Often silent instead"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "amber",
          "UDP",
          ["to port 9999", "nothing listening there"],
          {
            time: formatPacketTime(4),
            src: CLIENT_IP,
            dst: ICMP_SERVER_IP,
            proto: "UDP",
            info: "52500 → 9999 Len=18",
            len: "60 B",
            wire: {
              udp: {
                sport: 52500,
                dport: 9999,
                data: {
                  ascii: "hello, anyone here",
                  name: "App data",
                  note: "What the app sent; nothing on the server is listening for it.",
                },
              },
            },
          },
        ),
        packetEvent(
          "web",
          "client",
          "slate",
          "UNREACHABLE",
          ["type 3 · code 3", "port unreachable"],
          icmpPacketRow(
            4.017,
            ICMP_SERVER_IP,
            CLIENT_IP,
            "Destination unreachable (Port unreachable)",
            "88 B",
            icmpErrorWire(3, 3, 116),
          ),
        ),
      ],
    },
  ],
};
export { icmpLesson };
