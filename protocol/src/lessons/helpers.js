// Reconstructed from the distributed Protocol Explorer JavaScript.
const CLIENT_IP = "192.168.1.10";
const ROUTER_IP = "192.168.1.1";
const PUBLIC_NAT_IP = "198.51.100.7";
const ETHERNET_HEADER_BYTES = 14;
const IPV4_HEADER_BYTES = 20;
const TCP_HEADER_BYTES = 20;
const TLS_RECORD_OVERHEAD_BYTES = 22;
const TCP_MSS = 1460;
const formatPacketTime = (e) => `${e.toFixed(3)}s`;
const tcpFrameBytes = (e) =>
  Math.max(
    60,
    ETHERNET_HEADER_BYTES + IPV4_HEADER_BYTES + TCP_HEADER_BYTES + e,
  );
const tlsFrameBytes = (e) =>
  ETHERNET_HEADER_BYTES +
  IPV4_HEADER_BYTES +
  TCP_HEADER_BYTES +
  TLS_RECORD_OVERHEAD_BYTES +
  e;
const textLinesBytes = (...e) => e.reduce((t, s) => t + s.length + 2, 0);
const formatByteSize = (e) =>
  e >= 1024 ? `${(e / 1024).toFixed(1)} KB` : `${e} B`;
const tcpSegmentCount = (e) => Math.ceil(e / TCP_MSS);
const formatFrameSize = (e, t = 1) => (t > 1 ? formatByteSize(e) : `${e} B`);
const packetEvent = (e, t, s, a, n, o, r = {}) => ({
  type: "packet",
  from: e,
  to: t,
  color: s,
  label: a,
  payload: n,
  row: o,
  ...r,
});
function tcpConnection(e, t, s, a) {
  return {
    a: e,
    b: s,
    ports: (n) =>
      n === e
        ? {
            sport: t,
            dport: a,
          }
        : {
            sport: a,
            dport: t,
          },
  };
}
const tcpWire = (e, t, s, a, n = {}) => ({
  tcp: {
    ...e.ports(t),
    flags: s,
    data: a,
    ...n,
  },
});
const TCP_TIMESTAMP_OPTIONS_BYTES = 12;
function tcpHandshakeEvents({
  from: e = "client",
  to: t = "web",
  src: s = CLIENT_IP,
  dst: a,
  sport: n,
  dport: o,
  t: r,
  quick: i = !0,
  linux: l = !1,
}) {
  const c = (w, k, g, T, v, I) => ({
      time: formatPacketTime(w),
      src: k,
      dst: g,
      proto: "TCP",
      info: T,
      len: `${v} B`,
      wire: I,
    }),
    h = (w) => (i ? [] : w),
    d = tcpConnection(s, n, a, o),
    y = l ? TCP_TIMESTAMP_OPTIONS_BYTES : 0;
  return [
    packetEvent(
      e,
      t,
      "green",
      "SYN",
      h(["seq=0"]),
      c(r[0], s, a, `${n} → ${o} [SYN] Seq=0`, l ? 74 : 66, tcpWire(d, s, "S")),
      {
        quick: i,
      },
    ),
    packetEvent(
      t,
      e,
      "green",
      "SYN-ACK",
      h(["seq=0 ack=1"]),
      c(
        r[1],
        a,
        s,
        `${o} → ${n} [SYN, ACK] Seq=0 Ack=1`,
        l ? 74 : 66,
        tcpWire(d, a, "SA"),
      ),
      {
        quick: i,
      },
    ),
    packetEvent(
      e,
      t,
      "green",
      "ACK",
      h(["seq=1 ack=1"]),
      c(
        r[2],
        s,
        a,
        `${n} → ${o} [ACK] Seq=1 Ack=1`,
        tcpFrameBytes(y),
        tcpWire(d, s, "A"),
      ),
      {
        quick: i,
      },
    ),
  ];
}
const TLS_SERVER_FLIGHT_BYTES = 2862;
const tlsClientHelloWire = (e) => ({
  tls: [
    {
      type: "handshake",
      legacy: !0,
      length: 512,
      hello: {
        type: 1,
        name: "Client Hello",
        note: "What this client supports. Its exact contents vary from client to client; this is an example.",
        fields: [
          ["Server name (SNI)", e],
          ["Versions offered", "TLS 1.3, TLS 1.2"],
          ["Key share", "X25519"],
          ["Padding", "up to 512 bytes"],
        ],
      },
    },
  ],
});
const tlsServerHelloWire = (e = "X25519", t = 122) => ({
  tls: [
    {
      type: "handshake",
      length: t,
      hello: {
        type: 2,
        name: "Server Hello",
        note: "The server’s choices and its key share.",
        fields: [
          ["Version", "TLS 1.3"],
          ["Cipher suite", "TLS_AES_128_GCM_SHA256"],
          ["Key share", e],
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
const tlsTextWire = (e, t) => ({
  tls: [
    {
      type: "appdata",
      length: textLinesBytes(...e) + 17,
      inner: {
        what: t,
        text: e,
      },
    },
  ],
});
const tlsOpaqueWire = (e, t) => ({
  tls: [
    {
      type: "appdata",
      length: e + 17,
      inner: {
        what: t,
      },
    },
  ],
});
function tlsHandshakeEvents({
  from: e = "client",
  to: t = "web",
  src: s = CLIENT_IP,
  dst: a,
  sni: n,
  sport: o,
  dport: r,
  t: i,
  linux: l = !1,
}) {
  const c = (w, k, g, T, v, I) => ({
      time: formatPacketTime(w),
      src: k,
      dst: g,
      proto: "TLSv1.3",
      info: T,
      len: v,
      wire: I,
    }),
    h = tcpConnection(s, o, a, r),
    d = l ? TCP_TIMESTAMP_OPTIONS_BYTES : 0,
    y =
      TLS_SERVER_FLIGHT_BYTES +
      2 * (ETHERNET_HEADER_BYTES + IPV4_HEADER_BYTES + TCP_HEADER_BYTES + d);
  return [
    packetEvent(
      e,
      t,
      "teal",
      "CLIENT HELLO",
      [],
      c(
        i[0],
        s,
        a,
        `Client Hello (SNI=${n})`,
        `${517 + ETHERNET_HEADER_BYTES + IPV4_HEADER_BYTES + TCP_HEADER_BYTES + d} B`,
        tcpWire(h, s, "PA", tlsClientHelloWire(n)),
      ),
      {
        quick: !0,
      },
    ),
    packetEvent(
      t,
      e,
      "teal",
      "SERVER HELLO",
      [],
      c(
        i[1],
        a,
        s,
        "Server Hello + encrypted handshake, 2 segments",
        formatByteSize(y),
        tcpWire(h, a, "PA", tlsServerHelloWire()),
      ),
      {
        quick: !0,
      },
    ),
    packetEvent(
      e,
      t,
      "teal",
      "FINISHED",
      [],
      c(
        i[2],
        s,
        a,
        "Change Cipher Spec, Finished (encrypted)",
        `${64 + ETHERNET_HEADER_BYTES + IPV4_HEADER_BYTES + TCP_HEADER_BYTES + d} B`,
        tcpWire(h, s, "PA", TLS_FINISHED_WIRE),
      ),
      {
        quick: !0,
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
