// Reconstructed from the distributed Protocol Explorer JavaScript.
import type { Lesson, WireData } from "../types.ts";
import {
  CLIENT_IP,
  TCP_TIMESTAMP_OPTIONS_BYTES,
  formatPacketTime,
  packetEvent,
  tcpConnection,
  tcpFrameBytes,
  tcpHandshakeEvents,
  tcpWire,
  textLinesBytes,
  tlsFrameBytes,
  tlsHandshakeEvents,
  tlsOpaqueWire,
  tlsTextWire,
} from "./helpers.ts";
const SMTP_SUBMISSION_IP = "203.0.113.25";
const SMTP_DNS_IP = "8.8.8.8";
const SMTP_RECIPIENT_IP = "198.51.100.25";
const SMTP_SUBMISSION_CONNECTION = tcpConnection(CLIENT_IP, 52900, SMTP_SUBMISSION_IP, 465);
const SMTP_RELAY_CONNECTION = tcpConnection(SMTP_SUBMISSION_IP, 41522, SMTP_RECIPIENT_IP, 25);
/** Encode either command lines or an opaque mail body, including its dot terminator. */
function smtpPacketRow(
  seconds: number,
  sourceIp: string,
  destinationIp: string,
  info: string,
  message: WireData,
  encrypted = true,
) {
  const isRelay = sourceIp === SMTP_RECIPIENT_IP || destinationIp === SMTP_RECIPIENT_IP;
  const connection = isRelay ? SMTP_RELAY_CONNECTION : SMTP_SUBMISSION_CONNECTION;
  const payloadBytes = message.message
    ? message.message + SMTP_TERMINATOR_BYTES
    : textLinesBytes(...message);
  const description = message.message ? `${message.what}, then a line holding only “.”` : "SMTP";
  let wirePayload;
  if (!encrypted) {
    wirePayload = {
      text: message,
      name: "SMTP",
    };
  } else if (message.message) {
    wirePayload = tlsOpaqueWire(payloadBytes, description);
  } else {
    wirePayload = tlsTextWire(message, description);
  }
  return {
    time: formatPacketTime(seconds),
    src: sourceIp,
    dst: destinationIp,
    proto: encrypted ? "SMTP (TLS)" : "SMTP",
    info,
    len: `${(encrypted ? tlsFrameBytes(payloadBytes) : tcpFrameBytes(payloadBytes)) + (isRelay ? TCP_TIMESTAMP_OPTIONS_BYTES : 0)} B`,
    wire: tcpWire(connection, sourceIp, "PA", wirePayload),
  };
}
const SMTP_DNS_OPTIONS = {
  sport: 44210,
  edns: {
    size: 1232,
  },
};
const smtpDnsRow = (
  seconds: number,
  sourceIp: string,
  destinationIp: string,
  info: string,
  frameBytes: number,
  dnsMessage: WireData,
) => ({
  time: formatPacketTime(seconds),
  src: sourceIp,
  dst: destinationIp,
  proto: "DNS",
  info,
  len: `${frameBytes} B`,
  wire: {
    udp:
      sourceIp === SMTP_SUBMISSION_IP
        ? {
            sport: SMTP_DNS_OPTIONS.sport,
            dport: 53,
            data: {
              dns: {
                rd: true,
                edns: SMTP_DNS_OPTIONS.edns,
                ...dnsMessage,
              },
            },
          }
        : {
            sport: 53,
            dport: SMTP_DNS_OPTIONS.sport,
            data: {
              dns: {
                response: true,
                rd: true,
                ra: true,
                edns: SMTP_DNS_OPTIONS.edns,
                exampleTtl: true,
                ...dnsMessage,
              },
            },
          },
  },
});
const SMTP_ENCRYPTED_EVENT = {
  locked: true,
};
const SMTP_ORIGINAL_MESSAGE_BYTES = 316;
const SMTP_SIGNED_MESSAGE_BYTES = 1316;
const SMTP_TERMINATOR_BYTES = textLinesBytes(".");
const SMTP_SUBMISSION_GREETING = ["220 smtp.example.com ESMTP Postfix"];
const SMTP_CLIENT_EHLO = ["EHLO alice-laptop"];
const SMTP_SUBMISSION_CAPABILITIES = [
  "250-smtp.example.com",
  "250-PIPELINING",
  "250-SIZE 52428800",
  "250-AUTH PLAIN LOGIN",
  "250-ENHANCEDSTATUSCODES",
  "250-8BITMIME",
  "250 SMTPUTF8",
];
const SMTP_AUTH_COMMAND = ["AUTH PLAIN AGFsaWNlAHNlY3JldA=="];
const SMTP_AUTH_SUCCESS = ["235 2.7.0 Authentication successful"];
const SMTP_SUBMISSION_ENVELOPE = [
  "MAIL FROM:<alice@example.com>",
  "RCPT TO:<bob@example.org>",
  "DATA",
];
const SMTP_ENVELOPE_REPLIES = [
  "250 2.1.0 Ok",
  "250 2.1.5 Ok",
  "354 End data with <CR><LF>.<CR><LF>",
];
const SMTP_SUBMISSION_QUEUED = ["250 2.0.0 Ok: queued as 4A1F2C3D9E"];
const SMTP_RECIPIENT_GREETING = ["220 mx.example.org ESMTP Postfix"];
const SMTP_RELAY_EHLO = ["EHLO smtp.example.com"];
const SMTP_RECIPIENT_CAPABILITIES = [
  "250-mx.example.org",
  "250-PIPELINING",
  "250-SIZE 52428800",
  "250-STARTTLS",
  "250-ENHANCEDSTATUSCODES",
  "250-8BITMIME",
  "250 SMTPUTF8",
];
const SMTP_STARTTLS_COMMAND = ["STARTTLS"];
const SMTP_STARTTLS_READY = ["220 2.0.0 Ready to start TLS"];
const SMTP_SECURE_RECIPIENT_CAPABILITIES = SMTP_RECIPIENT_CAPABILITIES.filter(
  (capability) => capability !== "250-STARTTLS",
);
const SMTP_RELAY_ENVELOPE = [
  `MAIL FROM:<alice@example.com> SIZE=${SMTP_SIGNED_MESSAGE_BYTES}`,
  "RCPT TO:<bob@example.org>",
  "DATA",
];
const SMTP_RECIPIENT_QUEUED = ["250 2.0.0 Ok: queued as 7B3E9F01A2"];
const smtpLesson: Lesson = {
  id: "smtp",
  name: "SMTP",
  title: "Sending Email",
  layer: 7,
  nodes: ["client", "router", "internet", "dns", "web", "mx"],
  latency: {
    "client-web": 0.015,
    "web-dns": 0.005,
    "web-mx": 0.02,
  },
  lifelines: ["client", "web", "dns", "mx"],
  labels: {
    web: ["smtp.example.com", SMTP_SUBMISSION_IP],
    mx: ["mx.example.org", SMTP_RECIPIENT_IP],
  },
  legend: [
    ["green", "TCP"],
    ["teal", "TLS handshake"],
    ["amber", "SMTP command"],
    ["violet", "SMTP reply"],
    ["blue", "DNS"],
  ],
  overview: {
    full: "Simple Mail Transfer Protocol",
    description:
      "SMTP moves email: from your mail app to your provider’s server, and from that server to the recipient’s. It is a conversation of short text commands, each answered with a three-digit reply code. Reading mail is a different job, done with IMAP or POP3.",
    facts: [
      ["Layer", "Application (Layer 7)"],
      ["Ports", "465/587 submit, 25 relay"],
      ["Transport", "TCP, usually with TLS"],
      ["Commands", "EHLO, MAIL, RCPT, DATA"],
      ["Replies", "2xx ok, 3xx go on, 4/5xx error"],
      ["Defined In", "RFC 5321, RFC 6409"],
    ],
  },
  outro: {
    title: "Mail delivered",
    desc: "Two hops, one message",
    text: "Alice’s provider found Bob’s mail server in DNS and relayed the message over TLS. The receiving server returned 250 after queuing the message and took responsibility for delivery. In this example its local delivery service then stored the message in Bob’s mailbox.",
    facts: [
      ["Hops", "Laptop → provider → Bob’s"],
      ["Submission", "Port 465, TLS, login"],
      ["Relay", "Port 25, STARTTLS"],
      ["Checks at Bob’s", "SPF, DKIM, DMARC"],
    ],
  },
  start: {
    nodes: ["client"],
    frame: "client",
  },
  steps: [
    {
      title: "Connect Securely",
      desc: "Port 465, TLS from the start",
      detail:
        "Alice presses Send. Her mail app connects to her provider’s submission server, smtp.example.com, on port 465. On this port TLS starts immediately, so the whole SMTP conversation, including her password, is encrypted.",
      facts: [
        ["Server", "smtp.example.com:465"],
        ["Security", "TLS from the start"],
        ["Then", "SMTP inside TLS"],
      ],
      events: [
        {
          type: "show",
          nodes: ["router", "internet", "web"],
          frame: "path",
        },
        ...tcpHandshakeEvents({
          dst: SMTP_SUBMISSION_IP,
          sport: 52900,
          dport: 465,
          t: [0, 0.015, 0.03],
        }),
        ...tlsHandshakeEvents({
          dst: SMTP_SUBMISSION_IP,
          sni: "smtp.example.com",
          sport: 52900,
          dport: 465,
          t: [0.03, 0.045, 0.062],
        }),
      ],
    },
    {
      title: "Greeting & Login",
      desc: "EHLO, then AUTH",
      detail:
        "The server greets with code 220. The app says EHLO and the server lists what it supports, including AUTH. The app logs in with AUTH PLAIN (user name and password, base64-encoded) and gets 235: authenticated.",
      facts: [
        ["Greeting", "220 … ESMTP"],
        ["Capabilities", "AUTH, PIPELINING, SIZE …"],
        ["Login result", "235 2.7.0"],
      ],
      events: [
        packetEvent(
          "web",
          "client",
          "violet",
          "220",
          ["220 smtp.example.com ESMTP"],
          smtpPacketRow(
            0.077,
            SMTP_SUBMISSION_IP,
            CLIENT_IP,
            "220 smtp.example.com ESMTP Postfix",
            SMTP_SUBMISSION_GREETING,
          ),
          SMTP_ENCRYPTED_EVENT,
        ),
        packetEvent(
          "client",
          "web",
          "amber",
          "EHLO",
          ["EHLO alice-laptop"],
          smtpPacketRow(
            0.092,
            CLIENT_IP,
            SMTP_SUBMISSION_IP,
            "EHLO alice-laptop",
            SMTP_CLIENT_EHLO,
          ),
          SMTP_ENCRYPTED_EVENT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "250",
          ["250-PIPELINING", "250-AUTH PLAIN LOGIN …"],
          smtpPacketRow(
            0.107,
            SMTP_SUBMISSION_IP,
            CLIENT_IP,
            "250 capabilities (PIPELINING, SIZE, AUTH …)",
            SMTP_SUBMISSION_CAPABILITIES,
          ),
          SMTP_ENCRYPTED_EVENT,
        ),
        packetEvent(
          "client",
          "web",
          "amber",
          "AUTH",
          ["AUTH PLAIN AGFsaWNlAHNl…", "user and password, base64"],
          smtpPacketRow(
            0.122,
            CLIENT_IP,
            SMTP_SUBMISSION_IP,
            "AUTH PLAIN (credentials)",
            SMTP_AUTH_COMMAND,
          ),
          SMTP_ENCRYPTED_EVENT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "235",
          ["235 2.7.0 Authentication", "successful"],
          smtpPacketRow(
            0.137,
            SMTP_SUBMISSION_IP,
            CLIENT_IP,
            "235 2.7.0 Authentication successful",
            SMTP_AUTH_SUCCESS,
          ),
          SMTP_ENCRYPTED_EVENT,
        ),
      ],
    },
    {
      title: "Send the Message",
      desc: "Envelope, then content",
      detail:
        "MAIL FROM and RCPT TO are the envelope: sender and recipient. PIPELINING lets all three commands share one packet. After 354 comes the message, ended by a line holding just a dot.",
      facts: [
        ["Envelope", "alice@ → bob@example.org"],
        ["Content ends", "A line with only “.”"],
        ["Result", "250 Ok: queued"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "amber",
          "MAIL · RCPT · DATA",
          ["MAIL FROM:<alice@example.com>", "RCPT TO:<bob@example.org>", "DATA"],
          smtpPacketRow(
            0.152,
            CLIENT_IP,
            SMTP_SUBMISSION_IP,
            "MAIL FROM, RCPT TO, DATA (pipelined)",
            SMTP_SUBMISSION_ENVELOPE,
          ),
          SMTP_ENCRYPTED_EVENT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "250 · 250 · 354",
          ["250 2.1.0 Ok · 250 2.1.5 Ok", "354 End data with", "<CR><LF>.<CR><LF>"],
          smtpPacketRow(
            0.167,
            SMTP_SUBMISSION_IP,
            CLIENT_IP,
            "250 Ok, 250 Ok, 354 End data with <CR><LF>.<CR><LF>",
            SMTP_ENVELOPE_REPLIES,
          ),
          SMTP_ENCRYPTED_EVENT,
        ),
        packetEvent(
          "client",
          "web",
          "amber",
          "MESSAGE",
          ["Subject: Lunch on Friday?", "… message …", "."],
          smtpPacketRow(
            0.182,
            CLIENT_IP,
            SMTP_SUBMISSION_IP,
            `Message (${SMTP_ORIGINAL_MESSAGE_BYTES} bytes), then “.”`,
            {
              message: SMTP_ORIGINAL_MESSAGE_BYTES,
              what: `Alice’s message (${SMTP_ORIGINAL_MESSAGE_BYTES} bytes)`,
            },
          ),
          SMTP_ENCRYPTED_EVENT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "250 QUEUED",
          ["250 2.0.0 Ok: queued", "as 4A1F2C3D9E"],
          smtpPacketRow(
            0.2,
            SMTP_SUBMISSION_IP,
            CLIENT_IP,
            "250 2.0.0 Ok: queued as 4A1F2C3D9E",
            SMTP_SUBMISSION_QUEUED,
          ),
          SMTP_ENCRYPTED_EVENT,
        ),
      ],
    },
    {
      title: "Find Bob’s Server",
      desc: "An MX lookup in DNS",
      detail:
        "Alice’s provider now has to deliver to example.org. It asks DNS for that domain’s MX record, which names the server that accepts its mail, then looks up that server’s address.",
      facts: [
        ["MX record", "10 mx.example.org"],
        ["Address", "A 198.51.100.25"],
        ["Asked by", "Alice’s provider"],
      ],
      events: [
        {
          type: "show",
          nodes: ["dns"],
          frame: "mailhost",
        },
        packetEvent(
          "web",
          "dns",
          "blue",
          "DNS QUERY",
          ["MX? example.org"],
          smtpDnsRow(0.205, SMTP_SUBMISSION_IP, SMTP_DNS_IP, "Standard query MX example.org", 82, {
            id: 28165,
            q: ["example.org", "MX"],
          }),
        ),
        packetEvent(
          "dns",
          "web",
          "blue",
          "DNS REPLY",
          ["example.org MX 10", "mx.example.org"],
          smtpDnsRow(
            0.21,
            SMTP_DNS_IP,
            SMTP_SUBMISSION_IP,
            "Standard query response MX 10 mx.example.org",
            101,
            {
              id: 28165,
              q: ["example.org", "MX"],
              an: [["example.org", "MX", 3600, [10, "mx.example.org"]]],
            },
          ),
        ),
        packetEvent(
          "web",
          "dns",
          "blue",
          "DNS QUERY",
          ["A? mx.example.org"],
          smtpDnsRow(
            0.215,
            SMTP_SUBMISSION_IP,
            SMTP_DNS_IP,
            "Standard query A mx.example.org",
            85,
            {
              id: 8146,
              q: ["mx.example.org", "A"],
            },
          ),
        ),
        packetEvent(
          "dns",
          "web",
          "blue",
          "DNS REPLY",
          ["mx.example.org", "A 198.51.100.25"],
          smtpDnsRow(
            0.22,
            SMTP_DNS_IP,
            SMTP_SUBMISSION_IP,
            "Standard query response A 198.51.100.25",
            101,
            {
              id: 8146,
              q: ["mx.example.org", "A"],
              an: [["mx.example.org", "A", 3600, "198.51.100.25"]],
            },
          ),
        ),
      ],
    },
    {
      title: "Server to Server",
      desc: "Port 25, upgraded with STARTTLS",
      detail:
        "The provider connects to mx.example.org on port 25. This conversation starts in plain text: the greeting and EHLO reply advertise STARTTLS, the provider asks for it, gets 220 and both sides switch to TLS.",
      facts: [
        ["Server", "mx.example.org:25"],
        ["Starts as", "Plain text"],
        ["Upgrade", "STARTTLS → 220 → TLS"],
      ],
      events: [
        {
          type: "show",
          nodes: ["mx"],
          frame: "full",
        },
        ...tcpHandshakeEvents({
          from: "web",
          to: "mx",
          src: SMTP_SUBMISSION_IP,
          dst: SMTP_RECIPIENT_IP,
          sport: 41522,
          dport: 25,
          t: [0.225, 0.245, 0.265],
          linux: true,
        }),
        packetEvent(
          "mx",
          "web",
          "violet",
          "220",
          ["220 mx.example.org ESMTP"],
          smtpPacketRow(
            0.285,
            SMTP_RECIPIENT_IP,
            SMTP_SUBMISSION_IP,
            "220 mx.example.org ESMTP Postfix",
            SMTP_RECIPIENT_GREETING,
            false,
          ),
        ),
        packetEvent(
          "web",
          "mx",
          "amber",
          "EHLO",
          ["EHLO smtp.example.com"],
          smtpPacketRow(
            0.305,
            SMTP_SUBMISSION_IP,
            SMTP_RECIPIENT_IP,
            "EHLO smtp.example.com",
            SMTP_RELAY_EHLO,
            false,
          ),
        ),
        packetEvent(
          "mx",
          "web",
          "violet",
          "250",
          ["250-PIPELINING", "250-STARTTLS …"],
          smtpPacketRow(
            0.325,
            SMTP_RECIPIENT_IP,
            SMTP_SUBMISSION_IP,
            "250 capabilities (PIPELINING, STARTTLS …)",
            SMTP_RECIPIENT_CAPABILITIES,
            false,
          ),
        ),
        packetEvent(
          "web",
          "mx",
          "amber",
          "STARTTLS",
          ["STARTTLS"],
          smtpPacketRow(
            0.345,
            SMTP_SUBMISSION_IP,
            SMTP_RECIPIENT_IP,
            "STARTTLS",
            SMTP_STARTTLS_COMMAND,
            false,
          ),
        ),
        packetEvent(
          "mx",
          "web",
          "violet",
          "220",
          ["220 2.0.0 Ready to", "start TLS"],
          smtpPacketRow(
            0.365,
            SMTP_RECIPIENT_IP,
            SMTP_SUBMISSION_IP,
            "220 2.0.0 Ready to start TLS",
            SMTP_STARTTLS_READY,
            false,
          ),
        ),
        ...tlsHandshakeEvents({
          from: "web",
          to: "mx",
          src: SMTP_SUBMISSION_IP,
          dst: SMTP_RECIPIENT_IP,
          sni: "mx.example.org",
          sport: 41522,
          dport: 25,
          t: [0.385, 0.405, 0.427],
          linux: true,
        }),
      ],
    },
    {
      title: "Deliver",
      desc: "The same transaction again",
      detail:
        "After STARTTLS, the provider repeats EHLO and sends the envelope and signed message. Bob’s server checks SPF, DKIM and DMARC, queues the message and replies 250. Its local delivery service then moves the queued message into Bob’s mailbox.",
      facts: [
        ["Login needed", "No (server to server)"],
        ["Message", "1,316 bytes (signed)"],
        ["Result", "250 Ok: queued"],
      ],
      events: [
        packetEvent(
          "web",
          "mx",
          "amber",
          "EHLO",
          ["EHLO smtp.example.com"],
          smtpPacketRow(
            0.427,
            SMTP_SUBMISSION_IP,
            SMTP_RECIPIENT_IP,
            "EHLO smtp.example.com",
            SMTP_RELAY_EHLO,
          ),
          SMTP_ENCRYPTED_EVENT,
        ),
        packetEvent(
          "mx",
          "web",
          "violet",
          "250",
          ["250-PIPELINING", "250-SIZE …"],
          smtpPacketRow(
            0.447,
            SMTP_RECIPIENT_IP,
            SMTP_SUBMISSION_IP,
            "250 capabilities (PIPELINING, SIZE …)",
            SMTP_SECURE_RECIPIENT_CAPABILITIES,
          ),
          SMTP_ENCRYPTED_EVENT,
        ),
        packetEvent(
          "web",
          "mx",
          "amber",
          "MAIL · RCPT · DATA",
          ["MAIL FROM:<alice@example.com>", "RCPT TO:<bob@example.org>", "DATA"],
          smtpPacketRow(
            0.467,
            SMTP_SUBMISSION_IP,
            SMTP_RECIPIENT_IP,
            `MAIL FROM (SIZE=${SMTP_SIGNED_MESSAGE_BYTES}), RCPT TO, DATA`,
            SMTP_RELAY_ENVELOPE,
          ),
          SMTP_ENCRYPTED_EVENT,
        ),
        packetEvent(
          "mx",
          "web",
          "violet",
          "250 · 250 · 354",
          ["250 2.1.0 Ok · 250 2.1.5 Ok", "354 End data with", "<CR><LF>.<CR><LF>"],
          smtpPacketRow(
            0.487,
            SMTP_RECIPIENT_IP,
            SMTP_SUBMISSION_IP,
            "250 Ok, 250 Ok, 354 End data with <CR><LF>.<CR><LF>",
            SMTP_ENVELOPE_REPLIES,
          ),
          SMTP_ENCRYPTED_EVENT,
        ),
        packetEvent(
          "web",
          "mx",
          "amber",
          "MESSAGE",
          ["DKIM-Signature: …", "… message …", "."],
          smtpPacketRow(
            0.507,
            SMTP_SUBMISSION_IP,
            SMTP_RECIPIENT_IP,
            `Message (${SMTP_SIGNED_MESSAGE_BYTES.toLocaleString("en-US")} bytes), then “.”`,
            {
              message: SMTP_SIGNED_MESSAGE_BYTES,
              what: `The signed message (${SMTP_SIGNED_MESSAGE_BYTES.toLocaleString("en-US")} bytes)`,
            },
          ),
          SMTP_ENCRYPTED_EVENT,
        ),
        {
          type: "note",
          at: "mx",
          text: "QUEUED FOR DELIVERY",
          tone: "amber",
        },
        packetEvent(
          "mx",
          "web",
          "violet",
          "250 QUEUED",
          ["250 2.0.0 Ok: queued", "as 7B3E9F01A2"],
          smtpPacketRow(
            0.538,
            SMTP_RECIPIENT_IP,
            SMTP_SUBMISSION_IP,
            "250 2.0.0 Ok: queued as 7B3E9F01A2",
            SMTP_RECIPIENT_QUEUED,
          ),
          SMTP_ENCRYPTED_EVENT,
        ),
        {
          type: "note",
          at: "mx",
          text: "LOCAL DELIVERY · SAVED TO MAILBOX",
          tone: "green",
        },
      ],
    },
  ],
};
export { smtpLesson };
