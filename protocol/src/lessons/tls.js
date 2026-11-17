// Reconstructed from the distributed Protocol Explorer JavaScript.
import {
  CLIENT_IP,
  ETHERNET_HEADER_BYTES,
  IPV4_HEADER_BYTES,
  TCP_HEADER_BYTES,
  TCP_MSS,
  TLS_FINISHED_WIRE,
  TLS_RECORD_OVERHEAD_BYTES,
  formatFrameSize,
  formatPacketTime,
  packetEvent,
  tcpConnection,
  tcpHandshakeEvents,
  tcpWire,
} from "./helpers.js";
import {
  HTTPS_CLIENT_HELLO_WIRE,
  HTTPS_MESSAGE_DATA,
  HTTPS_SERVER_HELLO_WIRE,
} from "./https.js";
const TLS_SERVER_IP = "203.0.113.10";
const TLS_ENCRYPTED_EVENT = {
  locked: true,
};
const TLS_FRAME_HEADER_BYTES =
  ETHERNET_HEADER_BYTES + IPV4_HEADER_BYTES + TCP_HEADER_BYTES;
const TLS_SERVER_HELLO_BYTES = 1215;
const TLS_CHANGE_CIPHER_SPEC_BYTES = 6;
const TLS_ENCRYPTED_HANDSHAKE_BYTES = 2729;
const TLS_HANDSHAKE_FLIGHT_BYTES =
  TLS_SERVER_HELLO_BYTES +
  TLS_CHANGE_CIPHER_SPEC_BYTES +
  TLS_ENCRYPTED_HANDSHAKE_BYTES;
const TLS_HANDSHAKE_SEGMENT_SIZES = [];
for (
  let remainingBytes = TLS_HANDSHAKE_FLIGHT_BYTES;
  remainingBytes > 0;
  remainingBytes -= TCP_MSS
) {
  TLS_HANDSHAKE_SEGMENT_SIZES.push(Math.min(TCP_MSS, remainingBytes));
}
const TLS_CLOSE_NOTIFY_BYTES = 2 + TLS_RECORD_OVERHEAD_BYTES;
const tlsPacketRow = (
  seconds,
  sourceIp,
  destinationIp,
  info,
  sizeLabel,
  protocol = "TLSv1.3",
) => ({
  time: formatPacketTime(seconds),
  src: sourceIp,
  dst: destinationIp,
  proto: protocol,
  info,
  len: sizeLabel,
});
const TLS_CONNECTION = tcpConnection(CLIENT_IP, 52411, TLS_SERVER_IP, 443);
const withPacketWire = (row, wire) => ({
  ...row,
  wire,
});
const TLS_HANDSHAKE_SEGMENT_OFFSETS = TLS_HANDSHAKE_SEGMENT_SIZES.map(
  (segmentBytes, segmentIndex) =>
    TLS_HANDSHAKE_SEGMENT_SIZES.slice(0, segmentIndex).reduce(
      (totalBytes, segmentBytes) => totalBytes + segmentBytes,
      0,
    ),
);
const tlsLesson = {
  id: "tls",
  name: "TLS/SSL",
  title: "Encryption Explained",
  layer: 6,
  nodes: ["client", "router", "internet", "web"],
  latency: {
    "client-web": 0.017,
  },
  labels: {
    web: ["www.example.com", TLS_SERVER_IP],
  },
  legend: [
    ["green", "TCP"],
    ["teal", "TLS handshake"],
    ["amber", "From browser"],
    ["violet", "From server"],
    [null, "Data ACKs not shown"],
  ],
  overview: {
    full: "Transport Layer Security",
    description:
      "TLS puts a secure channel on top of TCP. In this connection the certificate authenticates the server, and the negotiated keys protect the application data. HTTPS and secure email use TLS. SSL was its predecessor.",
    facts: [
      ["Sits", "Between TCP and the app"],
      ["OSI layer", "Often placed at 6"],
      ["Current", "TLS 1.3 (RFC 8446)"],
      ["Retired", "SSL 2 and 3, TLS 1.0 and 1.1"],
      ["Proves", "Server identity (certificate)"],
      ["Port", "The app’s own (443, 993 …)"],
    ],
  },
  outro: {
    title: "Secure from start to finish",
    desc: "One round trip to set up",
    text: "The hellos exchanged key shares in plaintext. The certificate and signature authenticated the server inside the encrypted handshake. TLS also protected the HTTP data and close_notify alert. The compatibility Change Cipher Spec (CCS) records travelled in plaintext.",
    facts: [
      ["Version", "TLS 1.3"],
      ["Cipher", "TLS_AES_128_GCM_SHA256"],
      ["Key exchange", "X25519MLKEM768"],
      ["Setup", "1 round trip"],
    ],
  },
  start: {
    nodes: ["client"],
    frame: "client",
  },
  steps: [
    {
      title: "Client Hello",
      desc: "Everything the browser supports",
      detail:
        "After the TCP handshake the browser lists what it can do: TLS versions, cipher suites, and key shares for the groups it expects, including the post-quantum hybrid X25519MLKEM768. It also names the site (SNI) and the protocols it speaks (ALPN).",
      facts: [
        ["Versions", "TLS 1.3, TLS 1.2"],
        ["Key shares", "X25519MLKEM768, X25519"],
        ["SNI, ALPN", "www.example.com; h2, http/1.1"],
      ],
      events: [
        {
          type: "show",
          nodes: ["router", "internet", "web"],
          frame: "path",
        },
        ...tcpHandshakeEvents({
          dst: TLS_SERVER_IP,
          sport: 52411,
          dport: 443,
          t: [0, 0.017, 0.034],
        }),
        packetEvent(
          "client",
          "web",
          "teal",
          "CLIENT HELLO",
          ["versions, ciphers, key shares", "SNI www.example.com"],
          withPacketWire(
            tlsPacketRow(
              0.034,
              CLIENT_IP,
              TLS_SERVER_IP,
              "Client Hello (SNI=www.example.com), 2 segments",
              "1.9 KB",
            ),
            tcpWire(TLS_CONNECTION, CLIENT_IP, "PA", HTTPS_CLIENT_HELLO_WIRE),
          ),
        ),
      ],
    },
    {
      title: "Server Hello",
      desc: "Choices made, keys computed",
      detail:
        "The server selects TLS 1.3 and sends its key share. Both sides derive handshake keys. The next handshake messages, including the certificate and Finished, are encrypted. This trace also includes a plaintext compatibility Change Cipher Spec (CCS) record, which does not change the keys.",
      facts: [
        ["Cipher", "TLS_AES_128_GCM_SHA256"],
        ["Group", "X25519MLKEM768"],
        ["Remaining handshake messages", "Encrypted"],
      ],
      events: [
        packetEvent(
          "web",
          "client",
          "teal",
          "SERVER HELLO",
          ["TLS 1.3, AES_128_GCM", "its key share"],
          withPacketWire(
            tlsPacketRow(
              0.052,
              TLS_SERVER_IP,
              CLIENT_IP,
              "Server Hello, Change Cipher Spec (+ encrypted)",
              `${TLS_HANDSHAKE_SEGMENT_SIZES[0] + TLS_FRAME_HEADER_BYTES} B`,
            ),
            tcpWire(TLS_CONNECTION, TLS_SERVER_IP, "A", {
              ...HTTPS_SERVER_HELLO_WIRE,
              take: [0, TLS_HANDSHAKE_SEGMENT_SIZES[0]],
            }),
          ),
        ),
        {
          type: "note",
          at: "client",
          text: "SHARED SECRET COMPUTED",
          tone: "teal",
        },
      ],
    },
    {
      title: "Certificate",
      desc: "Who the server is, proven",
      detail:
        "Now encrypted, the flight continues: the chosen protocol (http/1.1), the certificate chain, a signature made with the certificate’s private key, and Finished.",
      facts: [
        ["Chain", "Site → intermediate → root"],
        ["Signature", "Proves the private key"],
        ["Checked", "Name, dates, trusted root"],
      ],
      events: [
        {
          type: "stream",
          from: "web",
          to: "client",
          color: "teal",
          label: `${TLS_HANDSHAKE_SEGMENT_SIZES.length - 1} SEGMENTS`,
          locked: true,
          payload: [
            "encrypted: http/1.1, certificates,",
            "signature, Finished",
          ],
          devicesAfter: { certificate: "received" },
          packets: TLS_HANDSHAKE_SEGMENT_SIZES.slice(1).map(
            (segmentBytes, segmentIndex) =>
              packetEvent(
                "web",
                "client",
                "teal",
                "ENCRYPTED",
                [],
                withPacketWire(
                  tlsPacketRow(
                    0.052,
                    TLS_SERVER_IP,
                    CLIENT_IP,
                    segmentIndex === TLS_HANDSHAKE_SEGMENT_SIZES.length - 2
                      ? "Encrypted handshake (certificate, verify, Finished)"
                      : "Encrypted handshake (continued)",
                    `${segmentBytes + TLS_FRAME_HEADER_BYTES} B`,
                  ),
                  tcpWire(
                    TLS_CONNECTION,
                    TLS_SERVER_IP,
                    segmentIndex === TLS_HANDSHAKE_SEGMENT_SIZES.length - 2
                      ? "PA"
                      : "A",
                    {
                      ...HTTPS_SERVER_HELLO_WIRE,
                      take: [
                        TLS_HANDSHAKE_SEGMENT_OFFSETS[segmentIndex + 1],
                        TLS_HANDSHAKE_SEGMENT_OFFSETS[segmentIndex + 1] +
                          segmentBytes,
                      ],
                    },
                  ),
                ),
                TLS_ENCRYPTED_EVENT,
              ),
          ),
        },
        {
          type: "note",
          at: "client",
          text: "CHAIN LEADS TO A TRUSTED ROOT",
          tone: "green",
          devicesAfter: { certificate: "verified" },
        },
      ],
    },
    {
      title: "Finished",
      desc: "One round trip, then data",
      detail:
        "The browser sends its own Finished: a check value over everything both sides said, keyed with the new secret, so any tampering with the hellos would show. TLS 1.3 needs one round trip before data flows; TLS 1.2 needed two.",
      facts: [
        ["Round trips", "1 (TLS 1.2: 2)"],
        ["Covers", "The whole handshake"],
        ["Change Cipher Spec", "Plaintext compatibility record"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "teal",
          "FINISHED",
          ["check value over", "the whole handshake"],
          withPacketWire(
            tlsPacketRow(
              0.07,
              CLIENT_IP,
              TLS_SERVER_IP,
              "Change Cipher Spec, Finished (encrypted)",
              "118 B",
            ),
            tcpWire(TLS_CONNECTION, CLIENT_IP, "PA", TLS_FINISHED_WIRE),
          ),
          { ...TLS_ENCRYPTED_EVENT, devicesAfter: { certificate: null } },
        ),
      ],
    },
    {
      title: "Encrypted Data",
      desc: "Records, tags and tickets",
      detail:
        "HTTP now travels in encrypted records, each with a 16-byte tag that exposes any change. The server also sends two session tickets: next time the browser can resume with one and skip the certificate.",
      facts: [
        ["Per record", `${TLS_RECORD_OVERHEAD_BYTES} bytes of overhead`],
        ["Tickets", "2, for resuming later"],
        ["Visible", "IPs, SNI, sizes, timing"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "amber",
          "APP DATA",
          ["inside: GET / HTTP/1.1"],
          withPacketWire(
            tlsPacketRow(
              0.07,
              CLIENT_IP,
              TLS_SERVER_IP,
              "Application Data (HTTP request)",
              formatFrameSize(
                HTTPS_MESSAGE_DATA.REQUEST + TLS_FRAME_HEADER_BYTES,
              ),
            ),
            tcpWire(TLS_CONNECTION, CLIENT_IP, "PA", {
              tls: [
                {
                  type: "appdata",
                  length: HTTPS_MESSAGE_DATA.REQUEST - 5,
                  inner: {
                    what: "The HTTP request",
                    text: HTTPS_MESSAGE_DATA.REQUEST_LINES,
                  },
                },
              ],
            }),
          ),
          TLS_ENCRYPTED_EVENT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "TICKETS",
          ["2 session tickets", "for resuming later"],
          withPacketWire(
            tlsPacketRow(
              0.087,
              TLS_SERVER_IP,
              CLIENT_IP,
              "New Session Ticket ×2 (encrypted)",
              formatFrameSize(
                HTTPS_MESSAGE_DATA.TICKETS + TLS_FRAME_HEADER_BYTES,
              ),
            ),
            tcpWire(TLS_CONNECTION, TLS_SERVER_IP, "PA", {
              tls: [HTTPS_MESSAGE_DATA.TICKET, HTTPS_MESSAGE_DATA.TICKET],
            }),
          ),
          TLS_ENCRYPTED_EVENT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "APP DATA",
          [
            "inside: HTTP/1.1 200 OK",
            `${HTTPS_MESSAGE_DATA.SEGMENTS} segments`,
          ],
          withPacketWire(
            tlsPacketRow(
              0.088,
              TLS_SERVER_IP,
              CLIENT_IP,
              `Application Data (HTTP response), ${HTTPS_MESSAGE_DATA.SEGMENTS} segments`,
              formatFrameSize(
                HTTPS_MESSAGE_DATA.RESPONSE_FRAMES,
                HTTPS_MESSAGE_DATA.SEGMENTS,
              ),
            ),
            tcpWire(TLS_CONNECTION, TLS_SERVER_IP, "PA", {
              tls: [
                {
                  type: "appdata",
                  length: HTTPS_MESSAGE_DATA.RESPONSE - 5,
                  inner: {
                    what: `The HTTP response, then the ${HTTPS_MESSAGE_DATA.BODY.toLocaleString("en-US")}-byte page`,
                    text: HTTPS_MESSAGE_DATA.RESPONSE_LINES,
                  },
                },
              ],
            }),
          ),
          TLS_ENCRYPTED_EVENT,
        ),
      ],
    },
    {
      title: "Closing",
      desc: "close_notify, then TCP",
      detail:
        "After 75 idle seconds the server closes the connection. It first sends a close_notify alert, encrypted like everything else, so the browser knows the data ended on purpose and wasn’t cut short by an attacker. Then TCP closes as usual.",
      facts: [
        ["Alert", "close_notify"],
        ["Why", "Shows nothing was cut off"],
        ["Then", "TCP FIN from both sides"],
      ],
      events: [
        packetEvent(
          "web",
          "client",
          "violet",
          "CLOSE_NOTIFY",
          ["alert: close_notify", "encrypted"],
          withPacketWire(
            tlsPacketRow(
              75.088,
              TLS_SERVER_IP,
              CLIENT_IP,
              "Application Data (inside: close_notify alert)",
              `${TLS_CLOSE_NOTIFY_BYTES + TLS_FRAME_HEADER_BYTES} B`,
            ),
            tcpWire(TLS_CONNECTION, TLS_SERVER_IP, "PA", {
              tls: [
                {
                  type: "appdata",
                  length: TLS_CLOSE_NOTIFY_BYTES - 5,
                  inner: {
                    what: "Alert: close_notify (the data ends here, on purpose)",
                  },
                },
              ],
            }),
          ),
          TLS_ENCRYPTED_EVENT,
        ),
        packetEvent(
          "web",
          "client",
          "green",
          "FIN",
          [],
          withPacketWire(
            tlsPacketRow(
              75.088,
              TLS_SERVER_IP,
              CLIENT_IP,
              "443 → 52411 [FIN, ACK]",
              "60 B",
              "TCP",
            ),
            tcpWire(TLS_CONNECTION, TLS_SERVER_IP, "FA"),
          ),
          {
            quick: true,
          },
        ),
        packetEvent(
          "client",
          "web",
          "green",
          "FIN",
          [],
          withPacketWire(
            tlsPacketRow(
              75.105,
              CLIENT_IP,
              TLS_SERVER_IP,
              "52411 → 443 [FIN, ACK]",
              "60 B",
              "TCP",
            ),
            tcpWire(TLS_CONNECTION, CLIENT_IP, "FA"),
          ),
          {
            quick: true,
          },
        ),
      ],
    },
  ],
};
export { tlsLesson };
