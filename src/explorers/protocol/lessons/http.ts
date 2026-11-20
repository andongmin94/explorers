// Reconstructed from the distributed Protocol Explorer JavaScript.
import type { Lesson, WireData } from "../types.ts";
import {
  CLIENT_IP,
  ETHERNET_HEADER_BYTES,
  IPV4_HEADER_BYTES,
  TCP_HEADER_BYTES,
  TCP_MSS,
  formatByteSize,
  formatFrameSize,
  formatPacketTime,
  packetEvent,
  tcpConnection,
  tcpFrameBytes,
  tcpHandshakeEvents,
  tcpSegmentCount,
  tcpWire,
  textLinesBytes,
} from "./helpers.ts";
const HTTP_DNS_IP = "8.8.8.8";
const HTTP_SERVER_IP = "203.0.113.10";
const HTTP_REQUEST_LINES = [
  "GET / HTTP/1.1",
  "Host: www.example.com",
  "Connection: keep-alive",
  "Upgrade-Insecure-Requests: 1",
  "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
  "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Encoding: gzip, deflate",
  "Accept-Language: en-US,en;q=0.9",
  "",
];
const HTTP_REQUEST_BYTES = textLinesBytes(...HTTP_REQUEST_LINES);
const HTTP_BODY_BYTES = 12500;
const HTTP_RESPONSE_LINES = [
  "HTTP/1.1 200 OK",
  "Date: Sat, 31 Oct 2026 09:41:00 GMT",
  "Content-Type: text/html; charset=utf-8",
  `Content-Length: ${HTTP_BODY_BYTES}`,
  "Connection: keep-alive",
  "",
];
const HTTP_RESPONSE_BYTES = textLinesBytes(...HTTP_RESPONSE_LINES) + HTTP_BODY_BYTES;
const HTTP_CONNECTION = tcpConnection(CLIENT_IP, 52344, HTTP_SERVER_IP, 80);
const HTTP_DNS_QUESTION = {
  id: 15642,
  rd: true,
  q: ["www.example.com", "A"],
};
const httpDnsWire = (sourceIp: string, dnsMessage: WireData) => ({
  udp:
    sourceIp === CLIENT_IP
      ? {
          sport: 59321,
          dport: 53,
          data: {
            dns: dnsMessage,
          },
        }
      : {
          sport: 53,
          dport: 59321,
          data: {
            dns: dnsMessage,
          },
        },
});
const HTTP_RESPONSE_SEGMENTS = tcpSegmentCount(HTTP_RESPONSE_BYTES);
const HTTP_RESPONSE_FRAME_BYTES =
  HTTP_RESPONSE_BYTES +
  HTTP_RESPONSE_SEGMENTS * (ETHERNET_HEADER_BYTES + IPV4_HEADER_BYTES + TCP_HEADER_BYTES);
const HTTP_TOTAL_SECONDS = 0.094;
const httpLesson: Lesson = {
  id: "http",
  name: "HTTP",
  title: "Web Communication",
  layer: 7,
  nodes: ["client", "router", "dns", "internet", "web"],
  latency: {
    "client-dns": 0.012,
    "client-web": 0.017,
  },
  legend: [
    ["blue", "DNS"],
    ["green", "TCP"],
    ["amber", "Request"],
    ["violet", "Response"],
    [null, "Data ACKs not shown"],
  ],
  overview: {
    full: "Hypertext Transfer Protocol",
    description:
      "HTTP is the protocol of the web: a client asks for a resource, such as an HTML page, and the server answers with a status code, headers and usually a body. Every exchange is one request and one response, written as readable text in HTTP/1.1.",
    facts: [
      ["Layer", "Application (Layer 7)"],
      ["Default Port", "80 (HTTPS: 443)"],
      ["Transport", "TCP"],
      ["Data Format", "Text (headers + optional body)"],
      ["Common Methods", "GET, POST, PUT, DELETE, HEAD"],
      ["Defined In", "RFC 9110, RFC 9112"],
    ],
  },
  outro: {
    title: "Page delivered",
    desc: "One request, one response",
    text: "In under a tenth of a second the laptop looked up an address, opened a TCP connection and exchanged one HTTP request and response, all of it readable by anyone on the path. Press REPLAY to watch it again.",
    facts: [
      ["Round trips", "3 (DNS, TCP, HTTP)"],
      ["Total time", `${HTTP_TOTAL_SECONDS.toFixed(3)} s`],
      ["Page size", formatByteSize(HTTP_BODY_BYTES)],
      ["Response", `Sent as ${HTTP_RESPONSE_SEGMENTS} TCP segments`],
    ],
  },
  start: {
    nodes: ["client"],
    frame: "client",
  },
  steps: [
    {
      title: "Client Request",
      desc: "Browser prepares the request",
      detail:
        "You open http://www.example.com. The browser will send a GET request, but packets travel to IP addresses, not names, so first it needs the server’s address. (Browsers now try https:// first; this is the plain version.)",
      facts: [
        ["URL", "http://www.example.com/"],
        ["Method", "GET"],
        ["Next hop", "Router 192.168.1.1"],
      ],
      events: [
        {
          type: "type-url",
          text: "www.example.com",
        },
        {
          type: "show",
          nodes: ["router"],
          frame: "local",
        },
      ],
    },
    {
      title: "DNS Resolution",
      desc: "Finds the server’s IP address",
      detail:
        "The laptop asks the DNS server it was given by DHCP, 8.8.8.8, for the address of www.example.com. The query goes over UDP port 53 and the answer is an A record with the IPv4 address. (On a network with IPv6 it would also ask for an AAAA record.)",
      facts: [
        ["Resolver", "8.8.8.8 (had it cached)"],
        ["Transport", "UDP, port 53"],
        ["Answer", "A 203.0.113.10"],
      ],
      events: [
        {
          type: "show",
          nodes: ["internet", "dns"],
          frame: "lookup",
        },
        packetEvent("client", "dns", "blue", "DNS QUERY", ["A? www.example.com"], {
          time: formatPacketTime(0),
          src: CLIENT_IP,
          dst: HTTP_DNS_IP,
          proto: "DNS",
          info: "Standard query A www.example.com",
          len: "75 B",
          wire: httpDnsWire(CLIENT_IP, HTTP_DNS_QUESTION),
        }),
        packetEvent("dns", "client", "blue", "DNS REPLY", ["A 203.0.113.10"], {
          time: formatPacketTime(0.012),
          src: HTTP_DNS_IP,
          dst: CLIENT_IP,
          proto: "DNS",
          info: "Standard query response A 203.0.113.10",
          len: "91 B",
          wire: httpDnsWire(HTTP_DNS_IP, {
            ...HTTP_DNS_QUESTION,
            response: true,
            ra: true,
            an: [["www.example.com", "A", 1745, "203.0.113.10"]],
            exampleTtl: true,
          }),
        }),
      ],
    },
    {
      title: "TCP Connection",
      desc: "Establishes a reliable link",
      detail:
        "HTTP runs on top of TCP. Before any page data moves, the laptop and the server open a connection to port 80 with a three-way handshake: SYN, SYN-ACK, ACK.",
      facts: [
        ["Server port", "80"],
        ["Client port", "52344 (ephemeral)"],
        ["Handshake", "SYN → SYN-ACK → ACK"],
      ],
      events: [
        {
          type: "show",
          nodes: ["web"],
          frame: "full",
        },
        ...tcpHandshakeEvents({
          dst: HTTP_SERVER_IP,
          sport: 52344,
          dport: 80,
          t: [0.024, 0.041, 0.058],
          quick: false,
        }),
      ],
    },
    {
      title: "HTTP Exchange",
      desc: "Request and response messages",
      detail: `The browser sends a GET request with a Host header. The server answers 200 OK with the HTML in the body: ${formatByteSize(HTTP_BODY_BYTES)}, too big for one packet, so TCP splits it into ${HTTP_RESPONSE_SEGMENTS} segments of up to ${TCP_MSS} bytes (drawn here as one).`,
      facts: [
        ["Status", "200 OK"],
        ["Body", `text/html, ${formatByteSize(HTTP_BODY_BYTES)}`],
        ["Sent as", `${HTTP_RESPONSE_SEGMENTS} TCP segments`],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "amber",
          "GET /",
          ["GET / HTTP/1.1", "Host: www.example.com"],
          {
            time: formatPacketTime(0.058),
            src: CLIENT_IP,
            dst: HTTP_SERVER_IP,
            proto: "HTTP",
            info: "GET / HTTP/1.1",
            len: `${tcpFrameBytes(HTTP_REQUEST_BYTES)} B`,
            wire: tcpWire(HTTP_CONNECTION, CLIENT_IP, "PA", {
              text: HTTP_REQUEST_LINES,
            }),
          },
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "200 OK",
          [
            "HTTP/1.1 200 OK",
            `${formatByteSize(HTTP_BODY_BYTES)} in ${HTTP_RESPONSE_SEGMENTS} segments`,
          ],
          {
            time: formatPacketTime(0.076),
            src: HTTP_SERVER_IP,
            dst: CLIENT_IP,
            proto: "HTTP",
            info: `HTTP/1.1 200 OK (text/html), ${HTTP_RESPONSE_SEGMENTS} segments`,
            len: formatFrameSize(HTTP_RESPONSE_FRAME_BYTES, HTTP_RESPONSE_SEGMENTS),
            wire: tcpWire(HTTP_CONNECTION, HTTP_SERVER_IP, "PA", {
              http: {
                lines: HTTP_RESPONSE_LINES,
                body: HTTP_BODY_BYTES,
                what: "the HTML page",
              },
            }),
          },
        ),
      ],
    },
    {
      title: "Page Rendering",
      desc: "Browser displays the content",
      detail:
        "The browser parses the HTML and paints the page. Linked CSS, images and scripts would each start more requests just like this one, reusing the open connection where they can.",
      facts: [
        ["Document", `text/html, ${formatByteSize(HTTP_BODY_BYTES)}`],
        ["Connection", "Kept open for reuse"],
        ["Total time", `${HTTP_TOTAL_SECONDS.toFixed(3)} s`],
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
export { httpLesson };
