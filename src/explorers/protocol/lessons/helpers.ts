// Reconstructed from the distributed Protocol Explorer JavaScript.
import type { LessonEvent, PacketRow, WireData } from "../types.ts";

const CLIENT_IP = "192.168.1.10";
const ROUTER_IP = "192.168.1.1";
const PUBLIC_NAT_IP = "198.51.100.7";
const ETHERNET_HEADER_BYTES = 14;
const IPV4_HEADER_BYTES = 20;
const TCP_HEADER_BYTES = 20;
const TLS_RECORD_OVERHEAD_BYTES = 22;
const TCP_MSS = 1460;
const formatPacketTime = (seconds: number) => `${seconds.toFixed(3)}s`;
const tcpFrameBytes = (payloadBytes: number) =>
  Math.max(60, ETHERNET_HEADER_BYTES + IPV4_HEADER_BYTES + TCP_HEADER_BYTES + payloadBytes);
const tlsFrameBytes = (payloadBytes: number) =>
  ETHERNET_HEADER_BYTES +
  IPV4_HEADER_BYTES +
  TCP_HEADER_BYTES +
  TLS_RECORD_OVERHEAD_BYTES +
  payloadBytes;
// Text protocol lines include the terminating CRLF sent on the wire.
const textLinesBytes = (...lines: string[]) =>
  lines.reduce((totalBytes, line) => totalBytes + line.length + 2, 0);
const formatByteSize = (byteCount: number) =>
  byteCount >= 1024 ? `${(byteCount / 1024).toFixed(1)} KB` : `${byteCount} B`;
const tcpSegmentCount = (payloadBytes: number) => Math.ceil(payloadBytes / TCP_MSS);
const formatFrameSize = (byteCount: number, segmentCount = 1) =>
  segmentCount > 1 ? formatByteSize(byteCount) : `${byteCount} B`;
/** One animation event and its matching packet-table/inspector data. */
const packetEvent = (
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
/** Resolve source/destination ports for either direction of one connection. */
export interface TcpConnection {
  a: string;
  b: string;
  ports: (sourceIp: string) => { sport: number; dport: number };
}
function tcpConnection(
  clientIp: string,
  clientPort: number,
  serverIp: string,
  serverPort: number,
): TcpConnection {
  return {
    a: clientIp,
    b: serverIp,
    ports: (sourceIp: string) =>
      sourceIp === clientIp
        ? {
            sport: clientPort,
            dport: serverPort,
          }
        : {
            sport: serverPort,
            dport: clientPort,
          },
  };
}
const tcpWire = (
  connection: TcpConnection,
  sourceIp: string,
  flags: string,
  data?: WireData,
  options: WireData = {},
): WireData => ({
  tcp: {
    ...connection.ports(sourceIp),
    flags,
    data,
    ...options,
  },
});
const TCP_TIMESTAMP_OPTIONS_BYTES = 12;
/** Build SYN, SYN-ACK and ACK events; Linux examples include timestamp options. */
function tcpHandshakeEvents({
  from = "client",
  to = "web",
  src: sourceIp = CLIENT_IP,
  dst: destinationIp,
  sport: sourcePort,
  dport: destinationPort,
  t: times,
  quick = true,
  linux = false,
}: {
  from?: string;
  to?: string;
  src?: string;
  dst: string;
  sport: number;
  dport: number;
  t: number[];
  quick?: boolean;
  linux?: boolean;
}) {
  const tcpHandshakeRow = (
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
  const handshakePayload = (lines: string[]) => (quick ? [] : lines);
  const connection = tcpConnection(sourceIp, sourcePort, destinationIp, destinationPort);
  const timestampOptionsBytes = linux ? TCP_TIMESTAMP_OPTIONS_BYTES : 0;
  return [
    packetEvent(
      from,
      to,
      "green",
      "SYN",
      handshakePayload(["seq=0"]),
      tcpHandshakeRow(
        times[0],
        sourceIp,
        destinationIp,
        `${sourcePort} → ${destinationPort} [SYN] Seq=0`,
        linux ? 74 : 66,
        tcpWire(connection, sourceIp, "S"),
      ),
      {
        quick,
      },
    ),
    packetEvent(
      to,
      from,
      "green",
      "SYN-ACK",
      handshakePayload(["seq=0 ack=1"]),
      tcpHandshakeRow(
        times[1],
        destinationIp,
        sourceIp,
        `${destinationPort} → ${sourcePort} [SYN, ACK] Seq=0 Ack=1`,
        linux ? 74 : 66,
        tcpWire(connection, destinationIp, "SA"),
      ),
      {
        quick,
      },
    ),
    packetEvent(
      from,
      to,
      "green",
      "ACK",
      handshakePayload(["seq=1 ack=1"]),
      tcpHandshakeRow(
        times[2],
        sourceIp,
        destinationIp,
        `${sourcePort} → ${destinationPort} [ACK] Seq=1 Ack=1`,
        tcpFrameBytes(timestampOptionsBytes),
        tcpWire(connection, sourceIp, "A"),
      ),
      {
        quick,
      },
    ),
  ];
}
const TLS_SERVER_FLIGHT_BYTES = 2862;
const tlsClientHelloWire = (serverName: string) => ({
  tls: [
    {
      type: "handshake",
      legacy: true,
      length: 512,
      hello: {
        type: 1,
        name: "Client Hello",
        note: "What this client supports. Its exact contents vary from client to client; this is an example.",
        fields: [
          ["Server name (SNI)", serverName],
          ["Versions offered", "TLS 1.3, TLS 1.2"],
          ["Key share", "X25519"],
          ["Padding", "up to 512 bytes"],
        ],
      },
    },
  ],
});
const tlsServerHelloWire = (keyShare = "X25519", handshakeBytes = 122) => ({
  tls: [
    {
      type: "handshake",
      length: handshakeBytes,
      hello: {
        type: 2,
        name: "Server Hello",
        note: "The server’s choices and its key share.",
        fields: [
          ["Version", "TLS 1.3"],
          ["Cipher suite", "TLS_AES_128_GCM_SHA256"],
          ["Key share", keyShare],
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
        what: "Encrypted Extensions, Certificate (the chain), Certificate Verify (the signature), Finished",
      },
    },
  ],
});
const TLS_FINISHED_WIRE = {
  tls: [
    {
      type: "ccs",
      length: 1,
    },
    {
      type: "appdata",
      length: 53,
      inner: {
        what: "Finished: a check value over the whole handshake",
      },
    },
  ],
};
const tlsTextWire = (lines: string[], description: string) => ({
  tls: [
    {
      type: "appdata",
      length: textLinesBytes(...lines) + 17,
      inner: {
        what: description,
        text: lines,
      },
    },
  ],
});
const tlsOpaqueWire = (payloadBytes: number, description: string) => ({
  tls: [
    {
      type: "appdata",
      length: payloadBytes + 17,
      inner: {
        what: description,
      },
    },
  ],
});
/** Build the abbreviated TLS exchange shared by the secure mail lessons. */
function tlsHandshakeEvents({
  from = "client",
  to = "web",
  src: sourceIp = CLIENT_IP,
  dst: destinationIp,
  sni: serverName,
  sport: sourcePort,
  dport: destinationPort,
  t: times,
  linux = false,
}: {
  from?: string;
  to?: string;
  src?: string;
  dst: string;
  sni: string;
  sport: number;
  dport: number;
  t: number[];
  linux?: boolean;
}) {
  const tlsHandshakeRow = (
    seconds: number,
    sourceIp: string,
    destinationIp: string,
    info: string,
    sizeLabel: string,
    wire: WireData,
  ) => ({
    time: formatPacketTime(seconds),
    src: sourceIp,
    dst: destinationIp,
    proto: "TLSv1.3",
    info,
    len: sizeLabel,
    wire,
  });
  const connection = tcpConnection(sourceIp, sourcePort, destinationIp, destinationPort);
  const timestampOptionsBytes = linux ? TCP_TIMESTAMP_OPTIONS_BYTES : 0;
  const serverFlightFrameBytes =
    TLS_SERVER_FLIGHT_BYTES +
    2 * (ETHERNET_HEADER_BYTES + IPV4_HEADER_BYTES + TCP_HEADER_BYTES + timestampOptionsBytes);
  return [
    packetEvent(
      from,
      to,
      "teal",
      "CLIENT HELLO",
      [],
      tlsHandshakeRow(
        times[0],
        sourceIp,
        destinationIp,
        `Client Hello (SNI=${serverName})`,
        `${517 + ETHERNET_HEADER_BYTES + IPV4_HEADER_BYTES + TCP_HEADER_BYTES + timestampOptionsBytes} B`,
        tcpWire(connection, sourceIp, "PA", tlsClientHelloWire(serverName)),
      ),
      {
        quick: true,
      },
    ),
    packetEvent(
      to,
      from,
      "teal",
      "SERVER HELLO",
      [],
      tlsHandshakeRow(
        times[1],
        destinationIp,
        sourceIp,
        "Server Hello + encrypted handshake, 2 segments",
        formatByteSize(serverFlightFrameBytes),
        tcpWire(connection, destinationIp, "PA", tlsServerHelloWire()),
      ),
      {
        quick: true,
      },
    ),
    packetEvent(
      from,
      to,
      "teal",
      "FINISHED",
      [],
      tlsHandshakeRow(
        times[2],
        sourceIp,
        destinationIp,
        "Change Cipher Spec, Finished (encrypted)",
        `${64 + ETHERNET_HEADER_BYTES + IPV4_HEADER_BYTES + TCP_HEADER_BYTES + timestampOptionsBytes} B`,
        tcpWire(connection, sourceIp, "PA", TLS_FINISHED_WIRE),
      ),
      {
        quick: true,
      },
    ),
  ];
}
export {
  CLIENT_IP,
  ETHERNET_HEADER_BYTES,
  IPV4_HEADER_BYTES,
  PUBLIC_NAT_IP,
  ROUTER_IP,
  TCP_HEADER_BYTES,
  TCP_MSS,
  TCP_TIMESTAMP_OPTIONS_BYTES,
  TLS_FINISHED_WIRE,
  TLS_RECORD_OVERHEAD_BYTES,
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
  tlsFrameBytes,
  tlsHandshakeEvents,
  tlsOpaqueWire,
  tlsTextWire,
};
