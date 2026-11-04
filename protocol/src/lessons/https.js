// Reconstructed from the distributed Protocol Explorer JavaScript.
import {
  CLIENT_IP,
  ETHERNET_HEADER_BYTES,
  IPV4_HEADER_BYTES,
  TCP_HEADER_BYTES,
  TLS_FINISHED_WIRE,
  TLS_RECORD_OVERHEAD_BYTES,
  formatByteSize,
  formatFrameSize,
  formatPacketTime,
  packetEvent,
  tcpConnection,
  tcpHandshakeEvents,
  tcpSegmentCount,
  tcpWire,
  textLinesBytes,
} from "./helpers.js";
const HTTPS_DNS_IP = "8.8.8.8";
const HTTPS_SERVER_IP = "203.0.113.10";
const HTTPS_ENCRYPTED_EVENT = {
  locked: !0,
};
const HTTPS_REQUEST_LINES = [
  "GET / HTTP/1.1",
  "Host: www.example.com",
  "Connection: keep-alive",
  'sec-ch-ua: "Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
  "sec-ch-ua-mobile: ?0",
  'sec-ch-ua-platform: "Windows"',
  "Upgrade-Insecure-Requests: 1",
  "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
  "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Sec-Fetch-Site: none",
  "Sec-Fetch-Mode: navigate",
  "Sec-Fetch-User: ?1",
  "Sec-Fetch-Dest: document",
  "Accept-Encoding: gzip, deflate, br, zstd",
  "Accept-Language: en-US,en;q=0.9",
  "",
];
const HTTPS_REQUEST_BYTES =
  textLinesBytes(...HTTPS_REQUEST_LINES) + TLS_RECORD_OVERHEAD_BYTES;
const HTTPS_BODY_BYTES = 12500;
const HTTPS_RESPONSE_LINES = [
  "HTTP/1.1 200 OK",
  "Date: Sat, 31 Oct 2026 09:41:00 GMT",
  "Content-Type: text/html; charset=utf-8",
  `Content-Length: ${HTTPS_BODY_BYTES}`,
  "Connection: keep-alive",
  "Strict-Transport-Security: max-age=31536000",
  "",
];
const HTTPS_RESPONSE_BYTES =
  textLinesBytes(...HTTPS_RESPONSE_LINES) +
  HTTPS_BODY_BYTES +
  TLS_RECORD_OVERHEAD_BYTES;
const HTTPS_RESPONSE_SEGMENTS = tcpSegmentCount(HTTPS_RESPONSE_BYTES);
const HTTPS_RESPONSE_FRAME_BYTES =
  HTTPS_RESPONSE_BYTES +
  HTTPS_RESPONSE_SEGMENTS *
    (ETHERNET_HEADER_BYTES + IPV4_HEADER_BYTES + TCP_HEADER_BYTES);
const HTTPS_SESSION_TICKET_BYTES = 2 * (217 + TLS_RECORD_OVERHEAD_BYTES);
const HTTPS_TOTAL_SECONDS = 0.13;
const HTTPS_CLIENT_HELLO_WIRE = {
  tls: [
    {
      type: "handshake",
      legacy: !0,
      length: 1845,
      hello: {
        type: 1,
        name: "Client Hello",
        note: "Everything the browser supports. Browsers vary a few details from one connection to the next.",
        fields: [
          ["Server name (SNI)", "www.example.com"],
          ["Versions offered", "TLS 1.3, TLS 1.2"],
          ["Key shares", "X25519MLKEM768 (1,216 bytes), X25519"],
          ["App protocols (ALPN)", "h2, http/1.1"],
        ],
      },
    },
  ],
};
const HTTPS_SERVER_HELLO_WIRE = {
  tls: [
    {
      type: "handshake",
      length: 1210,
      hello: {
        type: 2,
        name: "Server Hello",
        note: "The server’s choices and its half of the hybrid key exchange.",
        fields: [
          ["Version", "TLS 1.3"],
          ["Cipher suite", "TLS_AES_128_GCM_SHA256"],
          ["Key share", "X25519MLKEM768 (1,120 bytes)"],
        ],
      },
    },
    {
      type: "ccs",
      length: 1,
    },
    {
      type: "appdata",
      length: 2724,
      inner: {
        what: "Encrypted Extensions (ALPN: http/1.1), Certificate (the chain), Certificate Verify (the signature), Finished",
      },
    },
  ],
};
const HTTPS_SESSION_TICKET_RECORD = {
  type: "appdata",
  length: HTTPS_SESSION_TICKET_BYTES / 2 - 5,
  inner: {
    what: "New Session Ticket: lets a later visit resume",
  },
};
const HTTPS_CONNECTION = tcpConnection(CLIENT_IP, 52411, HTTPS_SERVER_IP, 443);
const HTTPS_DNS_QUESTION = {
  id: 31810,
  rd: !0,
  q: ["www.example.com", "A"],
};
const httpsDnsWire = (e, t) => ({
  udp:
    e === CLIENT_IP
      ? {
          sport: 61744,
          dport: 53,
          data: {
            dns: t,
          },
        }
      : {
          sport: 53,
          dport: 61744,
          data: {
            dns: t,
          },
        },
});
const HTTPS_MESSAGE_DATA = {
  REQUEST: HTTPS_REQUEST_BYTES,
  RESPONSE: HTTPS_RESPONSE_BYTES,
  SEGMENTS: HTTPS_RESPONSE_SEGMENTS,
  RESPONSE_FRAMES: HTTPS_RESPONSE_FRAME_BYTES,
  TICKETS: HTTPS_SESSION_TICKET_BYTES,
  REQUEST_LINES: HTTPS_REQUEST_LINES,
  RESPONSE_LINES: HTTPS_RESPONSE_LINES,
  BODY: HTTPS_BODY_BYTES,
  TICKET: HTTPS_SESSION_TICKET_RECORD,
};
const httpsLesson = {
  id: "https",
  name: "HTTPS",
  title: "Secure Web",
  layer: 7,
  nodes: ["client", "router", "dns", "internet", "web"],
  latency: {
    "client-dns": 0.012,
    "client-web": 0.017,
  },
  legend: [
    ["blue", "DNS"],
    ["green", "TCP"],
    ["teal", "TLS handshake"],
    ["amber", "HTTP request"],
    ["violet", "HTTP response"],
    [null, "Data ACKs not shown"],
  ],
  overview: {
    full: "HTTP Secure",
    description:
      "HTTPS is HTTP sent through an encrypted TLS connection. TLS proves the server is who it claims to be with a certificate, agrees on fresh encryption keys, and then protects every request and response from being read or changed on the way.",
    facts: [
      ["Layer", "Application (HTTP over TLS)"],
      ["Default Port", "443"],
      ["Transport", "TCP"],
      ["Security", "TLS 1.3 (1.2 still common)"],
      ["Proves", "Server identity (certificate)"],
      ["Defined In", "RFC 9110, RFC 8446"],
    ],
  },
  outro: {
    title: "Secure page delivered",
    desc: "Encrypted, except the lookup",
    text: "The browser looked up the address in plain DNS, opened a TCP connection, checked the server’s certificate and agreed on keys in one round trip. Every HTTP byte after that travelled encrypted. Press REPLAY to watch it again.",
    facts: [
      ["Round trips", "4 (DNS, TCP, TLS, HTTP)"],
      ["Total time", `${HTTPS_TOTAL_SECONDS.toFixed(3)} s`],
      ["Cipher", "TLS_AES_128_GCM_SHA256"],
      ["Still visible", "IPs, server name, sizes"],
    ],
  },
  start: {
    nodes: ["client"],
    frame: "client",
  },
  steps: [
    {
      title: "Secure Request",
      desc: "Browser asks for https://",
      detail:
        "You type https://www.example.com. The “s” tells the browser to protect the connection with TLS, on port 443 by default. Before it can connect at all, it still has to find the server’s IP address.",
      facts: [
        ["URL", "https://www.example.com/"],
        ["Port", "443"],
        ["Next hop", "Router 192.168.1.1"],
      ],
      events: [
        {
          type: "type-url",
          text: "https://www.example.com",
          secure: !0,
        },
        {
          type: "show",
          nodes: ["router"],
          frame: "local",
        },
      ],
    },
    {
      title: "DNS Lookup",
      desc: "Same lookup as HTTP, not encrypted",
      detail:
        "The lookup is exactly the same as for plain HTTP: a query to 8.8.8.8 over UDP port 53. It is not encrypted, so anyone on the path can see which name you asked for, unless the browser uses DNS over HTTPS.",
      facts: [
        ["Resolver", "8.8.8.8 (had it cached)"],
        ["Encrypted", "No (plain DNS)"],
        ["Answer", "A 203.0.113.10"],
      ],
      events: [
        {
          type: "show",
          nodes: ["internet", "dns"],
          frame: "lookup",
        },
        packetEvent(
          "client",
          "dns",
          "blue",
          "DNS QUERY",
          ["A? www.example.com"],
          {
            time: formatPacketTime(0),
            src: CLIENT_IP,
            dst: HTTPS_DNS_IP,
            proto: "DNS",
            info: "Standard query A www.example.com",
            len: "75 B",
            wire: httpsDnsWire(CLIENT_IP, HTTPS_DNS_QUESTION),
          },
        ),
        packetEvent("dns", "client", "blue", "DNS REPLY", ["A 203.0.113.10"], {
          time: formatPacketTime(0.012),
          src: HTTPS_DNS_IP,
          dst: CLIENT_IP,
          proto: "DNS",
          info: "Standard query response A 203.0.113.10",
          len: "91 B",
          wire: httpsDnsWire(HTTPS_DNS_IP, {
            ...HTTPS_DNS_QUESTION,
            response: !0,
            ra: !0,
            an: [["www.example.com", "A", 1722, "203.0.113.10"]],
            exampleTtl: !0,
          }),
        }),
      ],
    },
    {
      title: "TCP Handshake",
      desc: "Opens a connection to port 443",
      detail:
        "TLS rides on TCP, so the same three-way handshake comes first, this time to port 443. Nothing is encrypted yet.",
      facts: [
        ["Server port", "443"],
        ["Client port", "52411 (ephemeral)"],
        ["Handshake", "SYN → SYN-ACK → ACK"],
      ],
      events: [
        {
          type: "show",
          nodes: ["web"],
          frame: "full",
        },
        ...tcpHandshakeEvents({
          dst: HTTPS_SERVER_IP,
          sport: 52411,
          dport: 443,
          t: [0.024, 0.041, 0.058],
          quick: !1,
        }),
      ],
    },
    {
      title: "TLS Handshake",
      desc: "Agrees on keys, checks the certificate",
      detail:
        "The browser offers ciphers and key shares, including a post-quantum hybrid. The server picks it and sends its own share, then its certificate, already encrypted. The browser checks it against authorities it trusts.",
      facts: [
        ["Version", "TLS 1.3"],
        ["Key exchange", "X25519MLKEM768 (hybrid)"],
        ["Server name", "Sent in clear (SNI)"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "teal",
          "CLIENT HELLO",
          ["TLS 1.3, SNI www.example.com", "key shares: hybrid + x25519"],
          {
            time: formatPacketTime(0.058),
            src: CLIENT_IP,
            dst: HTTPS_SERVER_IP,
            proto: "TLSv1.3",
            info: "Client Hello (SNI=www.example.com), 2 segments",
            len: "1.9 KB",
            wire: tcpWire(
              HTTPS_CONNECTION,
              CLIENT_IP,
              "PA",
              HTTPS_CLIENT_HELLO_WIRE,
            ),
          },
        ),
        packetEvent(
          "web",
          "client",
          "teal",
          "SERVER HELLO",
          ["cipher: AES_128_GCM_SHA256", "then encrypted: cert, Finished"],
          {
            time: formatPacketTime(0.076),
            src: HTTPS_SERVER_IP,
            dst: CLIENT_IP,
            proto: "TLSv1.3",
            info: "Server Hello + encrypted handshake, 3 segments",
            len: "4.0 KB",
            wire: tcpWire(
              HTTPS_CONNECTION,
              HTTPS_SERVER_IP,
              "PA",
              HTTPS_SERVER_HELLO_WIRE,
            ),
          },
        ),
        {
          type: "note",
          at: "client",
          text: "CERTIFICATE VALID",
          tone: "green",
        },
        packetEvent(
          "client",
          "web",
          "teal",
          "FINISHED",
          ["handshake complete (encrypted)"],
          {
            time: formatPacketTime(0.094),
            src: CLIENT_IP,
            dst: HTTPS_SERVER_IP,
            proto: "TLSv1.3",
            info: "Change Cipher Spec, Finished (encrypted)",
            len: "118 B",
            wire: tcpWire(HTTPS_CONNECTION, CLIENT_IP, "PA", TLS_FINISHED_WIRE),
          },
        ),
      ],
    },
    {
      title: "Encrypted Exchange",
      desc: "HTTP inside TLS records",
      detail:
        "The GET and 200 OK are the same HTTP messages as before, sealed in TLS records that look like random “application data” on the wire. The server also hands over two session tickets, so a later visit can skip part of the handshake.",
      facts: [
        ["Inside", "GET / and 200 OK"],
        ["Tickets", "2, for faster reconnects"],
        ["Still visible", "IPs, server name, sizes"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "amber",
          "APP DATA",
          ["inside: GET / HTTP/1.1", "outside: encrypted bytes"],
          {
            time: formatPacketTime(0.094),
            src: CLIENT_IP,
            dst: HTTPS_SERVER_IP,
            proto: "TLSv1.3",
            info: "Application Data (HTTP request)",
            len: formatFrameSize(
              HTTPS_REQUEST_BYTES +
                ETHERNET_HEADER_BYTES +
                IPV4_HEADER_BYTES +
                TCP_HEADER_BYTES,
            ),
            wire: tcpWire(HTTPS_CONNECTION, CLIENT_IP, "PA", {
              tls: [
                {
                  type: "appdata",
                  length: HTTPS_REQUEST_BYTES - 5,
                  inner: {
                    what: "The HTTP request",
                    text: HTTPS_REQUEST_LINES,
                  },
                },
              ],
            }),
          },
          HTTPS_ENCRYPTED_EVENT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "TICKETS",
          [],
          {
            time: formatPacketTime(0.111),
            src: HTTPS_SERVER_IP,
            dst: CLIENT_IP,
            proto: "TLSv1.3",
            info: "New Session Ticket ×2 (encrypted)",
            len: formatFrameSize(
              HTTPS_SESSION_TICKET_BYTES +
                ETHERNET_HEADER_BYTES +
                IPV4_HEADER_BYTES +
                TCP_HEADER_BYTES,
            ),
            wire: tcpWire(HTTPS_CONNECTION, HTTPS_SERVER_IP, "PA", {
              tls: [HTTPS_SESSION_TICKET_RECORD, HTTPS_SESSION_TICKET_RECORD],
            }),
          },
          {
            ...HTTPS_ENCRYPTED_EVENT,
            quick: !0,
          },
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "APP DATA",
          [
            "inside: HTTP/1.1 200 OK",
            `outside: ${formatByteSize(HTTPS_RESPONSE_FRAME_BYTES)}, ${HTTPS_RESPONSE_SEGMENTS} segments`,
          ],
          {
            time: formatPacketTime(0.112),
            src: HTTPS_SERVER_IP,
            dst: CLIENT_IP,
            proto: "TLSv1.3",
            info: `Application Data (HTTP response), ${HTTPS_RESPONSE_SEGMENTS} segments`,
            len: formatFrameSize(
              HTTPS_RESPONSE_FRAME_BYTES,
              HTTPS_RESPONSE_SEGMENTS,
            ),
            wire: tcpWire(HTTPS_CONNECTION, HTTPS_SERVER_IP, "PA", {
              tls: [
                {
                  type: "appdata",
                  length: HTTPS_RESPONSE_BYTES - 5,
                  inner: {
                    what: `The HTTP response, then the ${HTTPS_BODY_BYTES.toLocaleString("en-US")}-byte page`,
                    text: HTTPS_RESPONSE_LINES,
                  },
                },
              ],
            }),
          },
          HTTPS_ENCRYPTED_EVENT,
        ),
      ],
    },
    {
      title: "Page Rendering",
      desc: "Browser shows the padlock",
      detail:
        "The browser decrypts the response, paints the page and shows a padlock: the connection is private and the server proved its identity. The Strict-Transport-Security header tells it to use HTTPS for this site from now on.",
      facts: [
        ["Document", `text/html, ${formatByteSize(HTTPS_BODY_BYTES)}`],
        ["Remembers", "HTTPS only (HSTS), 1 year"],
        ["Total time", `${HTTPS_TOTAL_SECONDS.toFixed(3)} s`],
      ],
      events: [
        {
          type: "camera",
          frame: "client",
        },
        {
          type: "render",
        },
      ],
    },
  ],
};
export {
  HTTPS_CLIENT_HELLO_WIRE,
  HTTPS_MESSAGE_DATA,
  HTTPS_SERVER_HELLO_WIRE,
  httpsLesson,
};
