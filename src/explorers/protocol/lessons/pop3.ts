// Reconstructed from the distributed Protocol Explorer JavaScript.
import type { Lesson } from "../types.ts";
import {
  CLIENT_IP,
  ETHERNET_HEADER_BYTES,
  IPV4_HEADER_BYTES,
  TCP_HEADER_BYTES,
  TLS_RECORD_OVERHEAD_BYTES,
  formatFrameSize,
  formatPacketTime,
  packetEvent,
  tcpConnection,
  tcpHandshakeEvents,
  tcpSegmentCount,
  tcpWire,
  textLinesBytes,
  tlsFrameBytes,
  tlsHandshakeEvents,
  tlsTextWire,
} from "./helpers.ts";
const POP3_SERVER_IP = "198.51.100.110";
const POP3_CONNECTION = tcpConnection(CLIENT_IP, 53010, POP3_SERVER_IP, 995);
const pop3Lines = (...lines: string[]) => lines;
const pop3PacketRow = (
  seconds: number,
  sourceIp: string,
  destinationIp: string,
  info: string,
  lines: string[],
) => ({
  time: formatPacketTime(seconds),
  src: sourceIp,
  dst: destinationIp,
  proto: "POP (TLS)",
  info,
  len: `${tlsFrameBytes(textLinesBytes(...lines))} B`,
  wire: tcpWire(POP3_CONNECTION, sourceIp, "PA", tlsTextWire(lines, "POP3")),
});
const POP3_ENCRYPTED_EVENT = {
  locked: true,
};
const POP3_DOWNLOAD_BYTES =
  textLinesBytes("+OK 1904 octets") + 1904 + textLinesBytes(".") + TLS_RECORD_OVERHEAD_BYTES;
const POP3_DOWNLOAD_FRAME_BYTES =
  POP3_DOWNLOAD_BYTES +
  tcpSegmentCount(POP3_DOWNLOAD_BYTES) *
    (ETHERNET_HEADER_BYTES + IPV4_HEADER_BYTES + TCP_HEADER_BYTES);
const pop3Lesson: Lesson = {
  id: "pop3",
  name: "POP3",
  title: "Downloading Email",
  layer: 7,
  nodes: ["client", "router", "internet", "web"],
  latency: {
    "client-web": 0.015,
  },
  labels: {
    web: ["pop.example.org", POP3_SERVER_IP],
  },
  legend: [
    ["green", "TCP"],
    ["teal", "TLS handshake"],
    ["amber", "POP3 command"],
    ["violet", "POP3 reply"],
    [null, "Data ACKs not shown"],
  ],
  overview: {
    full: "Post Office Protocol, version 3",
    description:
      "POP3 lets a mail app download messages from a mailbox on a server. It was designed for one device that fetches mail and then removes it from the server. Commands are short words, and every reply starts with +OK or -ERR.",
    facts: [
      ["Layer", "Application (Layer 7)"],
      ["Ports", "995 (TLS), 110 (STLS)"],
      ["Transport", "TCP"],
      ["Model", "Download, then delete"],
      ["Replies", "+OK or -ERR"],
      ["Defined In", "RFC 1939"],
    ],
  },
  outro: {
    title: "Mail downloaded",
    desc: "And gone from the server",
    text: "Bob’s app logged in, saw two messages, downloaded the first and deleted it, which the server carried out at QUIT. That message now lives only on this laptop, which is why POP3 suits one device and IMAP suits several.",
    facts: [
      ["Messages", "2 waiting, 1 downloaded"],
      ["Deleted", "At QUIT (UPDATE state)"],
      ["Port", "995, TLS from the start"],
      ["Best for", "A single device"],
    ],
  },
  start: {
    nodes: ["client"],
    frame: "client",
  },
  steps: [
    {
      title: "Connect Securely",
      desc: "Port 995, TLS from the start",
      detail:
        "Bob’s mail app connects to pop.example.org on port 995, where TLS starts right away. Inside it, the server greets with +OK. (On port 110 the session starts in plain text and is upgraded with the STLS command.)",
      facts: [
        ["Server", "pop.example.org:995"],
        ["Security", "TLS from the start"],
        ["Greeting", "+OK Dovecot ready."],
      ],
      events: [
        {
          type: "show",
          nodes: ["router", "internet", "web"],
          frame: "path",
        },
        ...tcpHandshakeEvents({
          dst: POP3_SERVER_IP,
          sport: 53010,
          dport: 995,
          t: [0, 0.015, 0.03],
        }),
        ...tlsHandshakeEvents({
          dst: POP3_SERVER_IP,
          sni: "pop.example.org",
          sport: 53010,
          dport: 995,
          t: [0.03, 0.045, 0.062],
        }),
        packetEvent(
          "web",
          "client",
          "violet",
          "+OK",
          ["+OK Dovecot ready."],
          pop3PacketRow(
            0.077,
            POP3_SERVER_IP,
            CLIENT_IP,
            "+OK Dovecot ready.",
            pop3Lines("+OK Dovecot ready."),
          ),
          POP3_ENCRYPTED_EVENT,
        ),
      ],
    },
    {
      title: "Log In",
      desc: "USER, then PASS",
      detail:
        "The app sends the user name with USER and the password with PASS. Each command gets its own +OK. Because the session is inside TLS, the password isn’t readable on the way.",
      facts: [
        ["Commands", "USER bob, PASS ••••"],
        ["Replies", "+OK, +OK Logged in."],
        ["Protected by", "TLS"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "amber",
          "USER",
          ["USER bob"],
          pop3PacketRow(0.092, CLIENT_IP, POP3_SERVER_IP, "USER bob", pop3Lines("USER bob")),
          POP3_ENCRYPTED_EVENT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "+OK",
          ["+OK"],
          pop3PacketRow(0.107, POP3_SERVER_IP, CLIENT_IP, "+OK", pop3Lines("+OK")),
          POP3_ENCRYPTED_EVENT,
        ),
        packetEvent(
          "client",
          "web",
          "amber",
          "PASS",
          ["PASS ••••••"],
          pop3PacketRow(
            0.122,
            CLIENT_IP,
            POP3_SERVER_IP,
            "PASS (password)",
            pop3Lines("PASS secret"),
          ),
          POP3_ENCRYPTED_EVENT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "+OK",
          ["+OK Logged in."],
          pop3PacketRow(
            0.137,
            POP3_SERVER_IP,
            CLIENT_IP,
            "+OK Logged in.",
            pop3Lines("+OK Logged in."),
          ),
          POP3_ENCRYPTED_EVENT,
        ),
      ],
    },
    {
      title: "Check the Mailbox",
      desc: "STAT and LIST",
      detail:
        "STAT returns the number of messages and their total size: 2 messages, 5120 bytes. LIST gives each message’s number and size, ending with a line holding just a dot.",
      facts: [
        ["STAT", "+OK 2 5120"],
        ["Message 1", "1904 bytes"],
        ["Message 2", "3216 bytes"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "amber",
          "STAT",
          ["STAT"],
          pop3PacketRow(0.152, CLIENT_IP, POP3_SERVER_IP, "STAT", pop3Lines("STAT")),
          { ...POP3_ENCRYPTED_EVENT, devicesAfter: { mailbox: "stored" } },
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "+OK",
          ["+OK 2 5120"],
          pop3PacketRow(0.167, POP3_SERVER_IP, CLIENT_IP, "+OK 2 5120", pop3Lines("+OK 2 5120")),
          POP3_ENCRYPTED_EVENT,
        ),
        packetEvent(
          "client",
          "web",
          "amber",
          "LIST",
          ["LIST"],
          pop3PacketRow(0.182, CLIENT_IP, POP3_SERVER_IP, "LIST", pop3Lines("LIST")),
          POP3_ENCRYPTED_EVENT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "+OK",
          ["+OK 2 messages:", "1 1904 · 2 3216 · ."],
          pop3PacketRow(
            0.197,
            POP3_SERVER_IP,
            CLIENT_IP,
            "+OK 2 messages: 1 1904, 2 3216",
            pop3Lines("+OK 2 messages:", "1 1904", "2 3216", "."),
          ),
          POP3_ENCRYPTED_EVENT,
        ),
      ],
    },
    {
      title: "Download",
      desc: "RETR 1",
      detail:
        "RETR 1 asks for the first message. The server answers +OK with its size, then the message and a closing dot: 1904 bytes plus the reply line, two TCP segments.",
      facts: [
        ["Command", "RETR 1"],
        ["Reply", "+OK 1904 octets"],
        ["Sent as", "2 TCP segments"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "amber",
          "RETR 1",
          ["RETR 1"],
          pop3PacketRow(0.212, CLIENT_IP, POP3_SERVER_IP, "RETR 1", pop3Lines("RETR 1")),
          POP3_ENCRYPTED_EVENT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "MESSAGE",
          ["+OK 1904 octets", "… message …", "."],
          {
            time: formatPacketTime(0.227),
            src: POP3_SERVER_IP,
            dst: CLIENT_IP,
            proto: "POP (TLS)",
            info: `+OK 1904 octets, message, “.” (${tcpSegmentCount(POP3_DOWNLOAD_BYTES)} segments)`,
            len: formatFrameSize(POP3_DOWNLOAD_FRAME_BYTES, tcpSegmentCount(POP3_DOWNLOAD_BYTES)),
            wire: tcpWire(POP3_CONNECTION, POP3_SERVER_IP, "PA", {
              tls: [
                {
                  type: "appdata",
                  length: POP3_DOWNLOAD_BYTES - 5,
                  inner: {
                    what: "+OK 1904 octets, the 1,904-byte message, then a line holding only “.”",
                  },
                },
              ],
            }),
          },
          { ...POP3_ENCRYPTED_EVENT, devicesAfter: { localCopy: true } },
        ),
      ],
    },
    {
      title: "Delete & Quit",
      desc: "Deleted only at QUIT",
      detail:
        "DELE 1 only marks the message. The server removes it when the app says QUIT: if the connection dropped before that, nothing would be deleted. Many apps offer “leave a copy on the server”, which skips DELE.",
      facts: [
        ["DELE 1", "Marks message 1"],
        ["Removed", "At QUIT"],
        ["Option", "Leave a copy on server"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "amber",
          "DELE 1",
          ["DELE 1"],
          pop3PacketRow(0.242, CLIENT_IP, POP3_SERVER_IP, "DELE 1", pop3Lines("DELE 1")),
          { ...POP3_ENCRYPTED_EVENT, devicesAfter: { mailbox: "marked" } },
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "+OK",
          ["+OK Marked to be deleted."],
          pop3PacketRow(
            0.257,
            POP3_SERVER_IP,
            CLIENT_IP,
            "+OK Marked to be deleted.",
            pop3Lines("+OK Marked to be deleted."),
          ),
          POP3_ENCRYPTED_EVENT,
        ),
        packetEvent(
          "client",
          "web",
          "amber",
          "QUIT",
          ["QUIT"],
          pop3PacketRow(0.272, CLIENT_IP, POP3_SERVER_IP, "QUIT", pop3Lines("QUIT")),
          { ...POP3_ENCRYPTED_EVENT, devicesAfter: { mailbox: "deleted" } },
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "+OK",
          ["+OK Logging out,", "messages deleted."],
          pop3PacketRow(
            0.287,
            POP3_SERVER_IP,
            CLIENT_IP,
            "+OK Logging out, messages deleted.",
            pop3Lines("+OK Logging out, messages deleted."),
          ),
          POP3_ENCRYPTED_EVENT,
        ),
        {
          type: "note",
          at: "web",
          text: "MESSAGE 1 DELETED",
          tone: "amber",
        },
      ],
    },
  ],
};
export { pop3Lesson };
