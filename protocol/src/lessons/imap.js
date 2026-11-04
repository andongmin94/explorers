// Reconstructed from the distributed Protocol Explorer JavaScript.
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
} from "./helpers.js";
const IMAP_SERVER_IP = "198.51.100.143";
const IMAP_CONNECTION = tcpConnection(CLIENT_IP, 53140, IMAP_SERVER_IP, 993);
const imapLines = (...e) => e;
const imapPacketRow = (e, t, s, a, n) => ({
  time: formatPacketTime(e),
  src: t,
  dst: s,
  proto: "IMAP (TLS)",
  info: a,
  len: `${tlsFrameBytes(textLinesBytes(...n))} B`,
  wire: tcpWire(IMAP_CONNECTION, t, "PA", tlsTextWire(n, "IMAP")),
});
const IMAP_ENCRYPTED_EVENT = {
  locked: !0,
};
const IMAP_GREETING = imapLines(
  "* OK [CAPABILITY IMAP4rev1 IDLE LITERAL+ AUTH=PLAIN] Service ready",
);
const IMAP_LOGIN_COMMAND = imapLines("a1 LOGIN bob secret");
const IMAP_LOGIN_REPLY = imapLines("a1 OK LOGIN completed");
const IMAP_SELECT_COMMAND = imapLines("a2 SELECT INBOX");
const IMAP_SELECT_REPLY = imapLines(
  "* FLAGS (\\Answered \\Flagged \\Deleted \\Seen \\Draft)",
  "* OK [PERMANENTFLAGS (\\Answered \\Flagged \\Deleted \\Seen \\Draft \\*)] Flags permitted",
  "* 2 EXISTS",
  "* 0 RECENT",
  "* OK [UNSEEN 2] Message 2 is first unseen",
  "* OK [UIDVALIDITY 1700000000] UIDs valid",
  "* OK [UIDNEXT 3] Predicted next UID",
  "a2 OK [READ-WRITE] SELECT completed",
);
const IMAP_FETCH_COMMAND = imapLines("a3 FETCH 2 BODY[]");
const IMAP_FETCH_BYTES =
  textLinesBytes("* 2 FETCH (FLAGS (\\Seen) BODY[] {3216}") +
  3216 +
  textLinesBytes(")", "a3 OK FETCH completed") +
  TLS_RECORD_OVERHEAD_BYTES;
const IMAP_FETCH_FRAME_BYTES =
  IMAP_FETCH_BYTES +
  tcpSegmentCount(IMAP_FETCH_BYTES) *
    (ETHERNET_HEADER_BYTES + IPV4_HEADER_BYTES + TCP_HEADER_BYTES);
const imapLesson = {
  id: "imap",
  name: "IMAP",
  title: "Mail That Stays in Sync",
  layer: 7,
  nodes: ["client", "router", "internet", "web"],
  latency: {
    "client-web": 0.015,
  },
  labels: {
    web: ["imap.example.org", IMAP_SERVER_IP],
  },
  legend: [
    ["green", "TCP"],
    ["teal", "TLS handshake"],
    ["amber", "IMAP command"],
    ["violet", "IMAP response"],
    [null, "Data ACKs not shown"],
  ],
  overview: {
    full: "Internet Message Access Protocol",
    description:
      "IMAP lets mail apps work with a mailbox that stays on the server. Folders, read and flagged marks and deletions are kept there, so a phone, a laptop and webmail all see the same mailbox. The server can also tell an app about new mail as it arrives.",
    facts: [
      ["Layer", "Application (Layer 7)"],
      ["Ports", "993 (TLS), 143 (STARTTLS)"],
      ["Transport", "TCP"],
      ["Model", "Mail stays on the server"],
      ["Syncs", "Folders and flags"],
      ["Defined In", "RFC 9051, RFC 3501"],
    ],
  },
  outro: {
    title: "Mailbox in sync",
    desc: "Read once, read everywhere",
    text: "Bob’s app opened his inbox, read a message, which marked it \\Seen on the server for all his devices, and then waited with IDLE until the server announced new mail. Nothing was deleted: the server still holds everything.",
    facts: [
      ["Messages", "2, then 3 (new mail)"],
      ["Read mark", "\\Seen, stored on server"],
      ["New mail", "Pushed during IDLE"],
      ["Port", "993, TLS from the start"],
    ],
  },
  start: {
    nodes: ["client"],
    frame: "client",
  },
  steps: [
    {
      title: "Connect Securely",
      desc: "Port 993, TLS from the start",
      detail:
        "Bob’s app connects to imap.example.org on port 993, where TLS starts right away. The server greets with an untagged “* OK” line that also lists its capabilities, such as IDLE.",
      facts: [
        ["Server", "imap.example.org:993"],
        ["Security", "TLS from the start"],
        ["Greeting", "* OK [CAPABILITY …]"],
      ],
      events: [
        {
          type: "show",
          nodes: ["router", "internet", "web"],
          frame: "path",
        },
        ...tcpHandshakeEvents({
          dst: IMAP_SERVER_IP,
          sport: 53140,
          dport: 993,
          t: [0, 0.015, 0.03],
        }),
        ...tlsHandshakeEvents({
          dst: IMAP_SERVER_IP,
          sni: "imap.example.org",
          sport: 53140,
          dport: 993,
          t: [0.03, 0.045, 0.062],
        }),
        packetEvent(
          "web",
          "client",
          "violet",
          "* OK",
          ["* OK [CAPABILITY IMAP4rev1", "IDLE …] Service ready"],
          imapPacketRow(
            0.077,
            IMAP_SERVER_IP,
            CLIENT_IP,
            "* OK [CAPABILITY …] Service ready",
            IMAP_GREETING,
          ),
          IMAP_ENCRYPTED_EVENT,
        ),
      ],
    },
    {
      title: "Log In",
      desc: "Commands carry tags",
      detail:
        "Every command starts with a tag the app chooses, like a1, and the server ends its answer with the same tag. That way several commands can be in flight and each reply is matched up. Lines starting with * are untagged data.",
      facts: [
        ["Command", "a1 LOGIN bob ••••"],
        ["Reply", "a1 OK LOGIN completed"],
        ["Tags", "Match replies to commands"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "amber",
          "a1 LOGIN",
          ["a1 LOGIN bob ••••••"],
          imapPacketRow(
            0.092,
            CLIENT_IP,
            IMAP_SERVER_IP,
            "a1 LOGIN (user and password)",
            IMAP_LOGIN_COMMAND,
          ),
          IMAP_ENCRYPTED_EVENT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "a1 OK",
          ["a1 OK LOGIN completed"],
          imapPacketRow(
            0.107,
            IMAP_SERVER_IP,
            CLIENT_IP,
            "a1 OK LOGIN completed",
            IMAP_LOGIN_REPLY,
          ),
          IMAP_ENCRYPTED_EVENT,
        ),
      ],
    },
    {
      title: "Open the Inbox",
      desc: "SELECT a folder",
      detail:
        "SELECT INBOX opens the folder. The server reports the message count, the flags it supports and the first unread message, then confirms the folder is open read-write.",
      facts: [
        ["Messages", "* 2 EXISTS"],
        ["First unread", "Message 2"],
        ["Access", "[READ-WRITE]"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "amber",
          "a2 SELECT",
          ["a2 SELECT INBOX"],
          imapPacketRow(
            0.122,
            CLIENT_IP,
            IMAP_SERVER_IP,
            "a2 SELECT INBOX",
            IMAP_SELECT_COMMAND,
          ),
          IMAP_ENCRYPTED_EVENT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "a2 OK",
          ["* 2 EXISTS", "* OK [UNSEEN 2]", "a2 OK [READ-WRITE]"],
          imapPacketRow(
            0.137,
            IMAP_SERVER_IP,
            CLIENT_IP,
            "* 2 EXISTS … a2 OK [READ-WRITE] SELECT completed",
            IMAP_SELECT_REPLY,
          ),
          IMAP_ENCRYPTED_EVENT,
        ),
      ],
    },
    {
      title: "Read a Message",
      desc: "FETCH, and the \\Seen flag",
      detail:
        "FETCH 2 BODY[] downloads message 2 (three TCP segments). That sets its \\Seen flag on the server, so it shows as read on Bob’s phone too, and the message stays there.",
      facts: [
        ["Command", "a3 FETCH 2 BODY[]"],
        ["Flag set", "\\Seen (on the server)"],
        ["Sent as", "3 TCP segments"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "amber",
          "a3 FETCH",
          ["a3 FETCH 2 BODY[]"],
          imapPacketRow(
            0.152,
            CLIENT_IP,
            IMAP_SERVER_IP,
            "a3 FETCH 2 BODY[]",
            IMAP_FETCH_COMMAND,
          ),
          IMAP_ENCRYPTED_EVENT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "MESSAGE",
          [
            "* 2 FETCH (FLAGS (\\Seen)",
            "BODY[] {3216} …)",
            "a3 OK FETCH completed",
          ],
          {
            time: formatPacketTime(0.167),
            src: IMAP_SERVER_IP,
            dst: CLIENT_IP,
            proto: "IMAP (TLS)",
            info: `* 2 FETCH (FLAGS (\\Seen) BODY[] …), ${tcpSegmentCount(IMAP_FETCH_BYTES)} segments`,
            len: formatFrameSize(
              IMAP_FETCH_FRAME_BYTES,
              tcpSegmentCount(IMAP_FETCH_BYTES),
            ),
            wire: tcpWire(IMAP_CONNECTION, IMAP_SERVER_IP, "PA", {
              tls: [
                {
                  type: "appdata",
                  length: IMAP_FETCH_BYTES - 5,
                  inner: {
                    what: "* 2 FETCH (FLAGS (\\Seen) BODY[] {3216}, the 3,216-byte message, then a3 OK FETCH completed",
                  },
                },
              ],
            }),
          },
          IMAP_ENCRYPTED_EVENT,
        ),
        {
          type: "note",
          at: "web",
          text: "STILL ON SERVER · \\SEEN",
          tone: "green",
        },
      ],
    },
    {
      title: "Wait for New Mail",
      desc: "IDLE: the server pushes",
      detail:
        "IDLE tells the server “let me know when something changes”. About 42 seconds later Alice’s message arrives and the server pushes “* 3 EXISTS” straight away. The app ends IDLE with DONE and can fetch the new mail.",
      facts: [
        ["Command", "a4 IDLE"],
        ["Server says", "* 3 EXISTS (new mail)"],
        ["Ended by", "DONE"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "amber",
          "a4 IDLE",
          ["a4 IDLE"],
          imapPacketRow(
            0.182,
            CLIENT_IP,
            IMAP_SERVER_IP,
            "a4 IDLE",
            imapLines("a4 IDLE"),
          ),
          IMAP_ENCRYPTED_EVENT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "+ idling",
          ["+ idling"],
          imapPacketRow(
            0.197,
            IMAP_SERVER_IP,
            CLIENT_IP,
            "+ idling",
            imapLines("+ idling"),
          ),
          IMAP_ENCRYPTED_EVENT,
        ),
        {
          type: "note",
          at: "web",
          text: "NEW MAIL ARRIVED",
          tone: "navy",
        },
        packetEvent(
          "web",
          "client",
          "violet",
          "* 3 EXISTS",
          ["* 3 EXISTS", "* 1 RECENT"],
          imapPacketRow(
            42.515,
            IMAP_SERVER_IP,
            CLIENT_IP,
            "* 3 EXISTS, * 1 RECENT",
            imapLines("* 3 EXISTS", "* 1 RECENT"),
          ),
          IMAP_ENCRYPTED_EVENT,
        ),
        packetEvent(
          "client",
          "web",
          "amber",
          "DONE",
          ["DONE"],
          imapPacketRow(
            42.53,
            CLIENT_IP,
            IMAP_SERVER_IP,
            "DONE",
            imapLines("DONE"),
          ),
          IMAP_ENCRYPTED_EVENT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "a4 OK",
          ["a4 OK IDLE terminated"],
          imapPacketRow(
            42.545,
            IMAP_SERVER_IP,
            CLIENT_IP,
            "a4 OK IDLE terminated",
            imapLines("a4 OK IDLE terminated"),
          ),
          IMAP_ENCRYPTED_EVENT,
        ),
      ],
    },
  ],
};
export { imapLesson };
