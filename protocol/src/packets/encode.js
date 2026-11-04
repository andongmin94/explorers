// Reconstructed from the distributed Protocol Explorer JavaScript.
import { getLinkLatency } from "../simulation/timeline.js";
const getLessonPackets = (e) =>
  e.steps
    .flatMap((t) => t.events)
    .flatMap((t) =>
      t.type === "packet" ? [t] : t.type === "stream" ? t.packets : [],
    );
class PacketLayerBuilder {
  constructor(t, s) {
    ((this.id = t), (this.name = s), (this.bytes = []), (this.fields = []));
  }
  get length() {
    return this.bytes.length;
  }
  u8(t) {
    return (this.bytes.push(t & 255), this);
  }
  u16(t) {
    return (this.bytes.push((t >>> 8) & 255, t & 255), this);
  }
  u24(t) {
    return (this.bytes.push((t >>> 16) & 255, (t >>> 8) & 255, t & 255), this);
  }
  u32(t) {
    return (
      this.bytes.push(
        (t >>> 24) & 255,
        (t >>> 16) & 255,
        (t >>> 8) & 255,
        t & 255,
      ),
      this
    );
  }
  raw(t) {
    for (const s of t) this.bytes.push(s);
    return this;
  }
  ascii(t) {
    for (const s of new TextEncoder().encode(t)) this.bytes.push(s);
    return this;
  }
  unknown(t) {
    for (let s = 0; s < t; s++) this.bytes.push(null);
    return this;
  }
  field(t, s, a = () => {}, n = {}) {
    const o = this.length;
    return (
      a(),
      this.fields.push({
        name: t,
        value: String(s),
        from: o,
        to: this.length,
        ...n,
      }),
      this
    );
  }
}
const ipv4ToBytes = (e) => e.split(".").map(Number);
const macToBytes = (e) => e.split(":").map((t) => parseInt(t, 16));
function ipv6ToBytes(e) {
  const [t, s] = e.split("::"),
    a = t ? t.split(":") : [],
    n = s !== void 0 && s ? s.split(":") : [];
  return [...a, ...Array(8 - a.length - n.length).fill("0"), ...n].flatMap(
    (r) => [parseInt(r, 16) >> 8, parseInt(r, 16) & 255],
  );
}
const formatHexValue = (e, t = 4) => `0x${e.toString(16).padStart(t, "0")}`;
function internetChecksum(e) {
  let t = 0;
  for (let s = 0; s < e.length; s += 2) {
    const a = e[s],
      n = s + 1 < e.length ? e[s + 1] : 0;
    if (a === null || n === null) return null;
    t += (a << 8) | n;
  }
  for (; t > 65535;) t = (t & 65535) + (t >>> 16);
  return ~t & 65535;
}
function combinePacketLayers(e) {
  const t = [],
    s = [],
    a = [];
  for (const n of e) {
    const o = t.length;
    a.push({
      id: n.id,
      name: n.name,
      from: o,
      to: o + n.length,
      summary: n.summary,
    });
    for (const r of n.fields)
      s.push({
        ...r,
        layer: n.id,
        from: r.from + o,
        to: r.to + o,
      });
    t.push(...n.bytes);
  }
  return {
    bytes: t,
    fields: s,
    layers: a,
  };
}
const ENCODING_CLIENT_IP = "192.168.1.10";
const ENCODING_ROUTER_LAN_IP = "192.168.1.1";
const ENCODING_ROUTER_WAN_IP = "198.51.100.7";
const ENCODING_ISP_IP = "198.51.100.1";
const ENCODING_DNS_IP = "8.8.8.8";
const EXAMPLE_MAC_ADDRESSES = {
  laptop: "00:00:5e:00:53:10",
  lan: "00:00:5e:00:53:01",
  wan: "00:00:5e:00:53:02",
  isp: "00:00:5e:00:53:fe",
  all: "ff:ff:ff:ff:ff:ff",
};
const isLocalNetworkAddress = (e) =>
  e.startsWith("192.168.1.") || e === "0.0.0.0" || e === "255.255.255.255";
const isClientAddress = (e) => e === ENCODING_CLIENT_IP || e === "0.0.0.0";
const getInitialTtl = (e) =>
  isClientAddress(e) || e === ENCODING_DNS_IP
    ? 128
    : e === ENCODING_ISP_IP
      ? 255
      : 64;
const getExampleHopCount = (e) =>
  e === ENCODING_ROUTER_LAN_IP
    ? 0
    : e === ENCODING_ISP_IP
      ? 1
      : e === ENCODING_DNS_IP
        ? 10
        : 12;
const ENCODING_TCP_MSS = 1460;
function hashExampleValue(e) {
  let t = 2166136261;
  for (const s of e) t = Math.imul(t ^ s.charCodeAt(0), 16777619);
  return t >>> 0;
}
const CRLF = `\r
`;
const escapeTextValue = (e) => JSON.stringify(e).slice(1, -1);
function encodeTextLines(e, t, s) {
  const a = new PacketLayerBuilder(e, t);
  return (
    s.forEach((n, o) =>
      a.field(
        o ? "" : "Text",
        `${escapeTextValue(n)}␍␊`,
        () => a.ascii(n + CRLF),
        {
          mono: !0,
        },
      ),
    ),
    a
  );
}
function encodePayloadSlice(e, t) {
  const s = encodeApplicationPayload(e, t);
  if (!t.take) return s;
  const [a, n] = t.take,
    o = new PacketLayerBuilder(
      s.id,
      `${s.name} · bytes ${a + 1}–${n} of ${s.length.toLocaleString("en-US")}`,
    );
  return (
    (o.bytes = s.bytes.slice(a, n)),
    (o.fields = s.fields
      .filter((r) =>
        r.from === r.to ? r.from >= a && r.from <= n : r.to > a && r.from < n,
      )
      .map((r) => ({
        ...r,
        from: Math.max(0, r.from - a),
        to: Math.min(n, r.to) - a,
      }))),
    o
  );
}
function encodeApplicationPayload(e, t) {
  if (t.ascii !== void 0) {
    const s = new PacketLayerBuilder(
      "app",
      t.name ?? getApplicationProtocolName(e),
    );
    return (
      s.field(
        "Data",
        `"${t.ascii}" (${t.ascii.length} bytes)`,
        () => s.ascii(t.ascii),
        {
          mono: !0,
          note: t.note,
        },
      ),
      s
    );
  }
  if (t.text)
    return encodeTextLines(
      "app",
      t.name ?? getApplicationProtocolName(e),
      t.text,
    );
  if (t.http) {
    const s = encodeTextLines("app", "HTTP", t.http.lines);
    return (
      t.http.body &&
        s.field(
          "Body",
          `${t.http.body.toLocaleString("en-US")} bytes: ${t.http.what}`,
          () => s.unknown(t.http.body),
          {
            hidden: !0,
            note: "The page itself; its contents are not part of the lesson.",
          },
        ),
      s
    );
  }
  if (t.opaque !== void 0) {
    const s = new PacketLayerBuilder(
      "app",
      t.name ?? getApplicationProtocolName(e),
    );
    return (
      s.field(
        "Data",
        `${t.opaque.toLocaleString("en-US")} bytes: ${t.what}`,
        () => s.unknown(t.opaque),
        {
          hidden: !0,
          note: t.note,
        },
      ),
      s
    );
  }
  if (t.tls) return encodeTlsRecords(t.tls);
  if (t.ssh) return encodeSshPacket(t.ssh);
  if (t.dns) return encodeDnsMessage(t.dns);
  if (t.dhcp) return encodeDhcpMessage(t.dhcp);
  if (t.rtp) return encodeRtpPacket(t.rtp);
  throw new Error(`unknown payload for ${e.info}`);
}
const getApplicationProtocolName = (e) =>
  e.proto.replace(" (TLS)", "").replace("-DATA", " data");
const TLS_RECORD_TYPES = {
  handshake: [22, "Handshake"],
  ccs: [20, "Change Cipher Spec"],
  appdata: [23, "Application Data"],
  alert: [21, "Alert"],
};
function encodeTlsRecords(e, t) {
  const s = new PacketLayerBuilder(
    "tls",
    `TLS 1.3 · ${e.length} record${e.length > 1 ? "s" : ""}`,
  );
  for (const a of e) {
    const [n, o] = TLS_RECORD_TYPES[a.type],
      r = a.length;
    if (
      (s.field(
        "Record",
        `${o}, ${r.toLocaleString("en-US")} byte${r === 1 ? "" : "s"}`,
        () => {},
        {
          heading: !0,
        },
      ),
      s.field("Content type", `${n} (${o})`, () => s.u8(n), {
        depth: 1,
        note: a.inner
          ? "Every encrypted record says Application Data on the outside; the real type is inside."
          : void 0,
      }),
      s.field(
        "Version",
        a.legacy ? "0x0301 (TLS 1.0)" : "0x0303 (TLS 1.2)",
        () => s.u16(a.legacy ? 769 : 771),
        {
          depth: 1,
          note: a.legacy
            ? "A Client Hello’s record says TLS 1.0 so old middleboxes let it through; the real versions are offered inside."
            : "TLS 1.3 records say 1.2 on the outside, for compatibility.",
        },
      ),
      s.field("Length", r.toLocaleString("en-US"), () => s.u16(r), {
        depth: 1,
      }),
      a.type === "ccs")
    )
      s.field("Change cipher spec", "1", () => s.u8(1), {
        depth: 1,
        note: "Has no job in TLS 1.3; sent so middleboxes see a familiar handshake.",
      });
    else if (a.hello) {
      const i = a.hello;
      (s.field("Handshake type", `${i.type} (${i.name})`, () => s.u8(i.type), {
        depth: 1,
      }),
        s.field("Length", (r - 4).toLocaleString("en-US"), () => s.u24(r - 4), {
          depth: 1,
        }),
        s.field(
          "Contents",
          `${(r - 4).toLocaleString("en-US")} bytes`,
          () => s.unknown(r - 4),
          {
            depth: 1,
            hidden: !0,
            note: i.note,
          },
        ));
      for (const [l, c] of i.fields)
        s.field(l, c, () => {}, {
          depth: 2,
        });
    } else if (
      (s.field(
        "Encrypted data",
        `${r.toLocaleString("en-US")} bytes`,
        () => s.unknown(r),
        {
          depth: 1,
          hidden: !0,
          note: "Ciphertext, ending in a 16-byte tag that shows any change. Only the two ends can read it.",
        },
      ),
      a.inner)
    ) {
      s.field("Inside", a.inner.what, () => {}, {
        depth: 2,
        inside: !0,
      });
      for (const i of a.inner.text ?? [])
        s.field("", `${escapeTextValue(i)}␍␊`, () => {}, {
          depth: 3,
          inside: !0,
          mono: !0,
        });
    }
  }
  return s;
}
function encodeSshPacket(e) {
  const t = new PacketLayerBuilder("ssh", "SSH");
  if (e.sealed)
    return (
      (t.name = "SSH · encrypted packet"),
      t.field(
        "Encrypted packet",
        `${e.sealed} bytes`,
        () => t.unknown(e.sealed),
        {
          hidden: !0,
          note: "With chacha20-poly1305 even the length is encrypted; a 16-byte tag at the end shows any change.",
        },
      ),
      t.field("Inside", e.inside, () => {}, {
        depth: 1,
        inside: !0,
      }),
      t
    );
  const s = new PacketLayerBuilder("x", ""),
    a = (r, i, l = 1) =>
      s.field(
        r,
        i.length > 60 ? `${i.slice(0, 57)}…` : i,
        () => s.u32(i.length).ascii(i),
        {
          depth: l,
          mono: !0,
        },
      );
  if (e.msg === "kexinit") {
    (s.field("Message", "20 (KEXINIT)", () => s.u8(20)),
      s.field("Cookie", "16 random bytes", () => s.unknown(16), {
        depth: 1,
        hidden: !0,
      }));
    const r = [
      ["Key exchange", e.kex],
      ["Host keys", e.hostkeys],
      ["Ciphers, out", e.ciphers],
      ["Ciphers, in", e.ciphers],
      ["MACs, out", e.macs],
      ["MACs, in", e.macs],
      ["Compression, out", e.compression],
      ["Compression, in", e.compression],
      ["Languages, out", []],
      ["Languages, in", []],
    ];
    for (const [i, l] of r) a(i, l.join(","));
    (s.field("First packet follows", "0", () => s.u8(0), {
      depth: 1,
    }),
      s.field("Reserved", "0", () => s.u32(0), {
        depth: 1,
      }));
  } else
    e.msg === "ecdh_init"
      ? (s.field("Message", "30 (KEX_ECDH_INIT)", () => s.u8(30)),
        s.field(
          "Public keys",
          `${e.q} bytes (sntrup761 1,158 + X25519 32)`,
          () => s.u32(e.q).unknown(e.q),
          {
            depth: 1,
            hidden: !0,
          },
        ))
      : e.msg === "ecdh_reply"
        ? (s.field("Message", "31 (KEX_ECDH_REPLY)", () => s.u8(31)),
          s.field(
            "Host key",
            `${e.ks} bytes: ssh-ed25519 public key`,
            () => s.u32(e.ks).unknown(e.ks),
            {
              depth: 1,
              hidden: !0,
            },
          ),
          s.field(
            "Server’s half",
            `${e.q} bytes (sntrup761 ciphertext 1,039 + X25519 32)`,
            () => s.u32(e.q).unknown(e.q),
            {
              depth: 1,
              hidden: !0,
            },
          ),
          s.field(
            "Signature",
            `${e.sig} bytes: ssh-ed25519 signature over the exchange`,
            () => s.u32(e.sig).unknown(e.sig),
            {
              depth: 1,
              hidden: !0,
            },
          ))
        : e.msg === "newkeys" &&
          s.field("Message", "21 (NEWKEYS)", () => s.u8(21), {
            note: "From the next packet on, this side encrypts.",
          });
  let n = 8 - ((5 + s.length) % 8);
  (n < 4 && (n += 8),
    t.field("Packet length", 1 + s.length + n, () => t.u32(1 + s.length + n), {
      note: "Bytes after this field.",
    }),
    t.field("Padding length", n, () => t.u8(n), {
      note: "Random padding brings the packet to a multiple of 8 bytes.",
    }));
  const o = t.length;
  t.raw(s.bytes);
  for (const r of s.fields)
    t.fields.push({
      ...r,
      from: r.from + o,
      to: r.to + o,
    });
  return (
    t.field("Padding", `${n} random bytes`, () => t.unknown(n), {
      hidden: !0,
    }),
    t
  );
}
const DNS_RECORD_TYPES = {
  A: 1,
  NS: 2,
  MX: 15,
  AAAA: 28,
  OPT: 41,
};
function encodeDnsMessage(e) {
  const t = new PacketLayerBuilder("dns", "DNS"),
    s = new Map(),
    a = (d) => {
      const y = d.split(".");
      for (let w = 0; w < y.length; w++) {
        const k = y.slice(w).join(".");
        if (s.has(k)) return t.u16(49152 | s.get(k));
        (t.length < 16383 && s.set(k, t.length), t.u8(y[w].length).ascii(y[w]));
      }
      t.u8(0);
    },
    n =
      (e.response ? 32768 : 0) |
      (e.aa ? 1024 : 0) |
      (e.rd ? 256 : 0) |
      (e.ra ? 128 : 0),
    o = [
      e.response ? "response" : "query",
      e.aa && "AA (authoritative)",
      e.rd && "RD (recursion desired)",
      e.ra && "RA (recursion available)",
    ].filter(Boolean),
    r = (d) => d ?? [],
    i = r(e.ar).length + (e.edns ? 1 : 0);
  (t.field("Transaction ID", formatHexValue(e.id), () => t.u16(e.id), {
    note: "Picked at random; the answer must carry the same one.",
    example: !0,
  }),
    t.field("Flags", `${formatHexValue(n)}: ${o.join(", ")}`, () => t.u16(n)),
    t.field("Questions", 1, () => t.u16(1)),
    t.field("Answers", r(e.an).length, () => t.u16(r(e.an).length)),
    t.field("Authority records", r(e.ns).length, () => t.u16(r(e.ns).length)),
    t.field("Additional records", i, () => t.u16(i)));
  const [l, c] = e.q;
  t.field("Question", `${l}, type ${c}, class IN`, () => {
    (a(l), t.u16(DNS_RECORD_TYPES[c]).u16(1));
  });
  const h = (d, [y, w, k, g]) => {
    const T = w === "MX" ? `${g[0]} ${g[1]}` : g;
    t.field(
      d,
      `${y} ${w} ${T} (TTL ${k.toLocaleString("en-US")} s)`,
      () => {
        (a(y), t.u16(DNS_RECORD_TYPES[w]).u16(1).u32(k));
        const v = t.length;
        (t.u16(0),
          w === "A"
            ? t.raw(ipv4ToBytes(g))
            : w === "AAAA"
              ? t.raw(ipv6ToBytes(g))
              : w === "NS"
                ? a(g)
                : w === "MX" && (t.u16(g[0]), a(g[1])));
        const I = t.length - v - 2;
        ((t.bytes[v] = I >> 8), (t.bytes[v + 1] = I & 255));
      },
      {
        example: e.exampleTtl && d === "Answer",
      },
    );
  };
  return (
    r(e.an).forEach((d) => h("Answer", d)),
    r(e.ns).forEach((d) => h("Authority", d)),
    r(e.ar).forEach((d) => h("Additional", d)),
    e.edns &&
      t.field(
        "EDNS",
        `UDP size ${e.edns.size}, DNSSEC OK = 0`,
        () => t.u8(0).u16(41).u16(e.edns.size).u32(0).u16(0),
        {
          note: "Says how big a UDP answer can be. DNSSEC signatures are not asked for here, to keep the lesson short; a validating resolver like 8.8.8.8 does ask for them.",
        },
      ),
    t
  );
}
const DHCP_MESSAGE_TYPES = [
  "",
  "Discover",
  "Offer",
  "Request",
  "Decline",
  "ACK",
  "NAK",
  "Release",
  "Inform",
];
const DHCP_OPTION_DEFINITIONS = {
  1: ["Subnet mask", "ip"],
  3: ["Router", "ip"],
  6: ["DNS server", "ip"],
  12: ["Host name", "text"],
  28: ["Broadcast address", "ip"],
  50: ["Requested address", "ip"],
  51: ["Lease time", "secs"],
  53: ["Message type", "type"],
  54: ["Server identifier", "ip"],
  55: ["Parameters wanted", "list"],
  58: ["Renewal time (T1)", "secs"],
  59: ["Rebinding time (T2)", "secs"],
  60: ["Vendor class", "text"],
  61: ["Client identifier", "mac"],
  81: ["Client FQDN", "fqdn"],
};
function encodeDhcpMessage(e) {
  const t = new PacketLayerBuilder(
      "dhcp",
      `DHCP ${DHCP_MESSAGE_TYPES[e.options.find(([a]) => a === 53)[1]]}`,
    ),
    s = (a, n, o) =>
      t.field(a, n, () => t.raw(ipv4ToBytes(n)), {
        note: o,
      });
  (t.field(
    "Message",
    e.op === 1 ? "1 (request, from a client)" : "2 (reply, from a server)",
    () => t.u8(e.op),
  ),
    t.field("Hardware", "Ethernet, 6-byte addresses", () => t.u8(1).u8(6)),
    t.field("Hops", "0", () => t.u8(0)),
    t.field("Transaction ID", formatHexValue(e.xid, 8), () => t.u32(e.xid), {
      note: "Chosen by the client; every reply repeats it.",
    }),
    t.field("Seconds", "0", () => t.u16(0)),
    t.field("Flags", "0x0000 (unicast replies are fine)", () => t.u16(0), {
      note: "Broadcast flag off: the server may send straight to the client’s MAC address.",
    }),
    s(
      "Client address",
      e.ciaddr ?? "0.0.0.0",
      "Filled in only when the client already has an address (renewing).",
    ),
    s(
      "Your address",
      e.yiaddr ?? "0.0.0.0",
      "The address the server is giving out.",
    ),
    s("Next server", e.siaddr ?? "0.0.0.0"),
    s("Relay agent", "0.0.0.0"),
    t.field(
      "Client MAC",
      EXAMPLE_MAC_ADDRESSES.laptop,
      () =>
        t.raw(macToBytes(EXAMPLE_MAC_ADDRESSES.laptop)).raw(Array(10).fill(0)),
      {
        example: !0,
      },
    ),
    t.field("Server name, boot file", "empty", () => t.raw(Array(192).fill(0))),
    t.field(
      "Magic cookie",
      "99.130.83.99 (DHCP)",
      () => t.raw([99, 130, 83, 99]),
      {
        note: "Marks the options that follow as DHCP.",
      },
    ));
  for (const [a, n] of e.options) {
    const [o, r] = DHCP_OPTION_DEFINITIONS[a],
      i =
        r === "type"
          ? `${n} (${DHCP_MESSAGE_TYPES[n]})`
          : r === "secs"
            ? `${n.toLocaleString("en-US")} s (${n / 3600} h)`
            : r === "list"
              ? n.join(", ")
              : r === "mac"
                ? `01 ${EXAMPLE_MAC_ADDRESSES.laptop}`
                : n;
    t.field(
      `Option ${a}`,
      `${o}: ${i}`,
      () => {
        (t.u8(a),
          r === "ip"
            ? t.u8(4).raw(ipv4ToBytes(n))
            : r === "type"
              ? t.u8(1).u8(n)
              : r === "secs"
                ? t.u8(4).u32(n)
                : r === "text"
                  ? t.u8(n.length).ascii(n)
                  : r === "list"
                    ? t.u8(n.length).raw(n)
                    : r === "mac"
                      ? t
                          .u8(7)
                          .u8(1)
                          .raw(macToBytes(EXAMPLE_MAC_ADDRESSES.laptop))
                      : r === "fqdn" &&
                        t
                          .u8(3 + n.length)
                          .u8(0)
                          .u8(0)
                          .u8(0)
                          .ascii(n));
      },
      {
        example: ["text", "list", "fqdn"].includes(r),
      },
    );
  }
  if ((t.field("End", "255", () => t.u8(255)), t.length < 300)) {
    const a = 300 - t.length;
    t.field("Padding", `${a} zero bytes, up to the 300-byte minimum`, () =>
      t.raw(Array(a).fill(0)),
    );
  }
  return t;
}
function encodeRtpPacket(e) {
  const t = new PacketLayerBuilder("rtp", "RTP + audio");
  return (
    t.field("Version etc.", "2, no padding, no extension, no CSRCs", () =>
      t.u8(128),
    ),
    t.field(
      "Marker, payload type",
      `${e.marker ? 1 : 0}, ${e.pt} (Opus, agreed when the call was set up)`,
      () => t.u8((e.marker ? 128 : 0) | e.pt),
      {
        example: !0,
      },
    ),
    t.field("Sequence number", e.seq, () => t.u16(e.seq), {
      note: "Counts up by one per packet, so the app can spot a missing or late one.",
      example: !0,
    }),
    t.field("Timestamp", e.ts, () => t.u32(e.ts), {
      note: "Audio clock at 48,000 per second: +960 per 20 ms frame.",
      example: !0,
    }),
    t.field("SSRC", formatHexValue(e.ssrc, 8), () => t.u32(e.ssrc), {
      note: "Identifies this audio stream.",
      example: !0,
    }),
    t.field(
      "Audio",
      `${e.audio} bytes of Opus audio (20 ms)`,
      () => t.unknown(e.audio),
      {
        hidden: !0,
      },
    ),
    t
  );
}
const TCP_FLAG_DEFINITIONS = [
  ["F", 1, "FIN"],
  ["S", 2, "SYN"],
  ["R", 4, "RST"],
  ["P", 8, "PSH"],
  ["A", 16, "ACK"],
];
function decodeTcpFlags(e) {
  const t = TCP_FLAG_DEFINITIONS.filter(([s]) => e.includes(s));
  return {
    bits: t.reduce((s, [, a]) => s | a, 0),
    names: t.map(([, , s]) => s).join(", "),
  };
}
const buildTransportPseudoHeader = (e, t, s, a) => [
  ...ipv4ToBytes(e),
  ...ipv4ToBytes(t),
  0,
  s,
  a >> 8,
  a & 255,
];
class LessonPacketEncoder {
  constructor(t) {
    ((this.lesson = t),
      (this.alias = new Map()),
      (this.ids = new Map()),
      (this.conns = new Map()),
      (this.pending = []),
      (this.remote = new Map()),
      (this.built = []));
  }
  ipId(t) {
    this.ids.has(t) || this.ids.set(t, hashExampleValue(`id ${t}`) & 65535);
    const s = this.ids.get(t);
    return (this.ids.set(t, (s + 1) & 65535), s);
  }
  endpointMac(t, s) {
    this.remote.has(t) || this.remote.set(t, this.remote.size);
    const a = this.remote.get(t);
    return `00:00:5e:00:53:${(s ? 128 + a : 64 + a).toString(16)}`;
  }
  link(t) {
    const { src: s, dst: a } = t;
    if (isLocalNetworkAddress(s) || isLocalNetworkAddress(a)) {
      const n = isLocalNetworkAddress(s),
        o = a === "255.255.255.255" || a === "Broadcast";
      return {
        at: "Seen on the laptop’s home network",
        src: n ? EXAMPLE_MAC_ADDRESSES.laptop : EXAMPLE_MAC_ADDRESSES.lan,
        dst: o
          ? EXAMPLE_MAC_ADDRESSES.all
          : n
            ? EXAMPLE_MAC_ADDRESSES.lan
            : EXAMPLE_MAC_ADDRESSES.laptop,
        srcNote: n
          ? "The laptop’s network card."
          : "The router’s side facing the home network.",
        dstNote: o
          ? "Broadcast: every device on the network receives it."
          : n
            ? "The router: anything beyond the home network goes to it first."
            : "The laptop.",
      };
    }
    return s === ENCODING_ROUTER_WAN_IP
      ? {
          at: "Seen as it leaves the router’s internet side",
          src: EXAMPLE_MAC_ADDRESSES.wan,
          dst: EXAMPLE_MAC_ADDRESSES.isp,
          srcNote: "The router’s internet-facing port.",
          dstNote: "The internet provider’s router, the next hop.",
        }
      : {
          at: `Seen as it leaves ${s}`,
          src: this.endpointMac(s),
          dst: this.endpointMac(s, !0),
          srcNote: "The sender’s network card.",
          dstNote:
            "The sender’s next router; each hop puts the packet in a new frame.",
        };
  }
  ttl(t, s) {
    return s.ttl !== void 0
      ? s.ttl
      : isLocalNetworkAddress(t.dst) && !isLocalNetworkAddress(t.src)
        ? getInitialTtl(t.src) - getExampleHopCount(t.src)
        : getInitialTtl(t.src);
  }
  conn(t, s) {
    const a = (l) => this.alias.get(l) ?? l,
      n = a(`${t.src}:${s.sport}`),
      o = a(`${t.dst}:${s.dport}`),
      r = [n, o].sort().join(" ");
    this.conns.has(r) ||
      this.conns.set(r, {
        key: r,
        ends: {},
        ts: !1,
      });
    const i = this.conns.get(r);
    for (const [l, c] of [
      [n, n.split(":")[0]],
      [o, o.split(":")[0]],
    ])
      i.ends[l] ??= {
        ip: c,
        isn: hashExampleValue(`isn ${r} ${l}`),
        next: 0,
        got: 0,
        ooo: [],
        tsBase: hashExampleValue(`ts ${l}`) % 4e9,
        peerTs: 0,
        win: isClientAddress(c) ? [1026, 8] : [501, 7],
      };
    return {
      c: i,
      me: i.ends[n],
      peer: i.ends[o],
      meKey: n,
      peerKey: o,
    };
  }
  deliver(t) {
    this.pending = this.pending.filter((s) => {
      if (s.at > t + 1e-9) return !0;
      const a = s.to;
      if (s.seq === a.got)
        for (
          a.got += s.len, a.ooo.sort((n, o) => n[0] - o[0]);
          a.ooo.length && a.ooo[0][0] <= a.got;
        )
          a.got = Math.max(a.got, a.ooo.shift()[1]);
      else s.seq > a.got && a.ooo.push([s.seq, s.seq + s.len]);
      return (s.tsval && (a.peerTs = s.tsval), !1);
    });
  }
  tcp(t, s, a, n, o, r) {
    const { c: i, me: l, peer: c } = this.conn(t, s),
      { bits: h, names: d } = decodeTcpFlags(s.flags),
      y = h & 2,
      w = h & 1,
      k = h & 16,
      g = a ? a.length : 0,
      T = isClientAddress(l.ip);
    y && !k && (i.ts = !T);
    const v = [],
      I = Math.round(n * 1e3),
      q = (l.tsBase + I) >>> 0;
    if (
      (y && !k && T
        ? v.push(["MSS", 1460], ["NOP"], ["WS", 8], ["NOP"], ["NOP"], ["SACKP"])
        : y && !k
          ? v.push(["MSS", 1460], ["SACKP"], ["TS", q, 0], ["NOP"], ["WS", 7])
          : y
            ? v.push(
                ...(i.ts
                  ? [
                      ["MSS", 1460],
                      ["SACKP"],
                      ["TS", q, l.peerTs],
                      ["NOP"],
                      ["WS", 7],
                    ]
                  : [
                      ["MSS", 1460],
                      ["NOP"],
                      ["NOP"],
                      ["SACKP"],
                      ["NOP"],
                      ["WS", 7],
                    ]),
              )
            : i.ts && v.push(["NOP"], ["NOP"], ["TS", q, l.peerTs]),
      s.sack)
    ) {
      const V = c && l.ooo.map(([ee, Ke]) => [ee, Ke]);
      v.push(["NOP"], ["NOP"], ["SACK", V]);
    }
    const re = i.ts ? ENCODING_TCP_MSS - 12 : ENCODING_TCP_MSS,
      C = Math.min(g, re),
      Z = s.seq ?? l.next,
      R = k ? (s.ack ?? l.got) : 0;
    (s.seq === void 0 && (l.next += g + (y ? 1 : 0) + (w ? 1 : 0)),
      o.lost ||
        this.pending.push({
          at: n + getLinkLatency(this.lesson, o.from, o.to),
          to: c,
          seq: Z,
          len: g + (y ? 1 : 0) + (w ? 1 : 0),
          tsval: i.ts ? q : 0,
        }));
    const x = new PacketLayerBuilder("tcp", ""),
      H = v.reduce(
        (V, [ee, Ke]) =>
          V +
          {
            NOP: 1,
            MSS: 4,
            WS: 3,
            SACKP: 2,
            TS: 10,
            SACK: 2 + 8 * (ee === "SACK" ? Ke.length : 0),
          }[ee],
        0,
      ),
      we = 20 + H;
    ((x.summary = `${s.sport} → ${s.dport}, ${d}`),
      (x.name = `TCP · ${we} bytes`),
      x.field("Source port", s.sport, () => x.u16(s.sport), {
        note: T
          ? t.src === ENCODING_ROUTER_WAN_IP
            ? "The router’s NAT swapped in its own port for the laptop’s."
            : "Picked by the laptop’s system for this connection."
          : void 0,
      }),
      x.field("Destination port", s.dport, () => x.u16(s.dport)),
      x.field(
        "Sequence number",
        y ? "0 (relative)" : `${Z} (relative)`,
        () => x.u32((l.isn + Z) >>> 0),
        {
          note: y
            ? "This side’s starting number. Shown as 0; the real one is random."
            : "Position of this segment’s first byte, counted from this side’s SYN.",
        },
      ),
      x.field("Real sequence number", (l.isn + Z) >>> 0, () => {}, {
        depth: 1,
        example: !0,
      }),
      x.field(
        "Acknowledgment",
        k ? `${R} (relative)` : "0 (not used yet)",
        () => x.u32(k ? (c.isn + R) >>> 0 : 0),
        {
          note: k
            ? "The next byte this side expects: everything before it has arrived."
            : "A first SYN has nothing to acknowledge.",
        },
      ),
      x.field("Header length", `${we} bytes`, () => x.u8((we / 4) << 4), {
        note: H ? `20 bytes, plus ${H} of options.` : void 0,
      }),
      x.field("Flags", `${formatHexValue(h, 3)} (${d})`, () => x.u8(h)));
    const ce = l.win[1],
      P = y ? (k && i.ts ? 65160 : 64240) : l.win[0];
    x.field(
      "Window",
      y
        ? `${P}`
        : `${P} (× ${2 ** ce} = ${(P * 2 ** ce).toLocaleString("en-US")} bytes)`,
      () => x.u16(P),
      {
        note: "How much more data this side can take right now.",
        example: !0,
      },
    );
    const A = x.length;
    if (
      (x.field("Checksum", "", () => x.u16(0), {
        note: "Covers the header, the data and the IP addresses, so damage is caught.",
      }),
      x.field("Urgent pointer", "0", () => x.u16(0)),
      v.length)
    ) {
      x.field("Options", `${H} bytes`, () => {}, {
        heading: !0,
      });
      for (const [V, ee, Ke] of v)
        (V === "NOP" &&
          x.field("No-op", "1", () => x.u8(1), {
            depth: 1,
            note: "Spacing, so the next option lines up.",
          }),
          V === "MSS" &&
            x.field(
              "Maximum segment size",
              `${ee} bytes`,
              () => x.u8(2).u8(4).u16(ee),
              {
                depth: 1,
                note: "The most data this side wants in one segment.",
              },
            ),
          V === "WS" &&
            x.field(
              "Window scale",
              `× ${2 ** ee}`,
              () => x.u8(3).u8(3).u8(ee),
              {
                depth: 1,
                note: "Window values are multiplied by this, so windows can be larger than 64 KB.",
              },
            ),
          V === "SACKP" &&
            x.field("SACK permitted", "yes", () => x.u8(4).u8(2), {
              depth: 1,
              note: "This side understands selective acknowledgements.",
            }),
          V === "TS" &&
            x.field(
              "Timestamps",
              `value ${ee}, echo ${Ke}`,
              () => x.u8(8).u8(10).u32(ee).u32(Ke),
              {
                depth: 1,
                note: "Used to measure round trips; both sides offered them.",
                example: !0,
              },
            ),
          V === "SACK" &&
            x.field(
              "SACK",
              ee.map(([Te, et]) => `has ${Te}–${et - 1}`).join(", "),
              () => {
                x.u8(5).u8(2 + 8 * ee.length);
                for (const [Te, et] of ee)
                  x.u32((c.isn + Te) >>> 0).u32((c.isn + et) >>> 0);
              },
              {
                depth: 1,
                note: "Bytes that arrived after the gap, so only the gap needs resending.",
              },
            ));
    }
    const _ = a ? a.bytes.slice(0, C) : [],
      J = internetChecksum([
        ...buildTransportPseudoHeader(t.src, t.dst, 6, we + C),
        ...x.bytes,
        ..._,
      ]),
      Re = x.fields.find((V) => V.name === "Checksum");
    return (
      J === null
        ? ((x.bytes[A] = x.bytes[A + 1] = null),
          (Re.value = "covers bytes not shown here"),
          (Re.hidden = !0))
        : ((x.bytes[A] = J >> 8),
          (x.bytes[A + 1] = J & 255),
          (Re.value = formatHexValue(J))),
      {
        header: x,
        first: C,
        segments: Math.max(1, r ?? Math.ceil(g / re)),
        mss: re,
        seq: Z,
        ack: R,
        hlen: we,
      }
    );
  }
  frame(t, s, a) {
    const n = t.row,
      o = n.wire;
    if (!o) return null;
    const r = parseFloat(n.time);
    (this.deliver(r), o.alias && this.alias.set(o.alias[0], o.alias[1]));
    const i = o.arp
        ? {
            at: "Seen on the laptop’s home network",
            src: n.src,
            dst: n.dst === "Broadcast" ? EXAMPLE_MAC_ADDRESSES.all : n.dst,
            srcNote: "The sender’s network card.",
            dstNote:
              n.dst === "Broadcast"
                ? "Broadcast: every device on the network receives it."
                : "Straight back to the device that asked.",
          }
        : this.link(n),
      l = [],
      c = new PacketLayerBuilder("eth", "Ethernet II · 14 bytes");
    ((c.summary = `${i.src} → ${i.dst}`),
      c.field("Destination", i.dst, () => c.raw(macToBytes(i.dst)), {
        note: i.dstNote,
        example: i.dst !== EXAMPLE_MAC_ADDRESSES.all,
      }),
      c.field("Source", i.src, () => c.raw(macToBytes(i.src)), {
        note: i.srcNote,
        example: !0,
      }),
      c.field(
        "Type",
        o.arp ? "0x0806 (ARP)" : "0x0800 (IPv4)",
        () => c.u16(o.arp ? 2054 : 2048),
        {
          note: "What the frame carries.",
        },
      ),
      l.push(c));
    let h = 1,
      d = null,
      y;
    if (o.arp) {
      const T = new PacketLayerBuilder(
        "arp",
        `ARP ${o.arp.op === 1 ? "request" : "reply"} · 28 bytes`,
      );
      (T.field("Hardware type", "1 (Ethernet)", () => T.u16(1)),
        T.field("Protocol type", "0x0800 (IPv4)", () => T.u16(2048)),
        T.field("Address sizes", "6 (MAC), 4 (IPv4)", () => T.u8(6).u8(4)),
        T.field(
          "Operation",
          o.arp.op === 1 ? "1 (request: who has …?)" : "2 (reply: … is at …)",
          () => T.u16(o.arp.op),
        ),
        T.field(
          "Sender MAC",
          o.arp.sender[0],
          () => T.raw(macToBytes(o.arp.sender[0])),
          {
            example: !0,
          },
        ),
        T.field("Sender IP", o.arp.sender[1], () =>
          T.raw(ipv4ToBytes(o.arp.sender[1])),
        ),
        T.field(
          "Target MAC",
          o.arp.target[0],
          () => T.raw(macToBytes(o.arp.target[0])),
          {
            note:
              o.arp.op === 1
                ? "All zeros: this is what the request wants to find out."
                : void 0,
            example: o.arp.op === 2,
          },
        ),
        T.field("Target IP", o.arp.target[1], () =>
          T.raw(ipv4ToBytes(o.arp.target[1])),
        ),
        l.push(T));
    } else {
      const T = o.tcp ? 6 : o.udp ? 17 : 1,
        v = [];
      let I;
      if (o.tcp) {
        const P = o.tcp.data ? encodePayloadSlice(n, o.tcp.data) : null;
        ((d = this.tcp(n, o.tcp, P, r, t, o.tcp.segments)),
          (h = d.segments),
          (I = d.header),
          v.push(I),
          P &&
            ((P.full = P.length),
            d.first < P.length &&
              ((P.bytes = P.bytes.slice(0, d.first)), (P.cut = !0)),
            v.push(P)));
      } else if (o.udp) {
        const P = encodePayloadSlice(n, o.udp.data),
          A = new PacketLayerBuilder("udp", "UDP · 8 bytes"),
          _ = 8 + P.length;
        ((A.summary = `${o.udp.sport} → ${o.udp.dport}`),
          A.field("Source port", o.udp.sport, () => A.u16(o.udp.sport)),
          A.field("Destination port", o.udp.dport, () => A.u16(o.udp.dport)),
          A.field("Length", `${_} bytes`, () => A.u16(_), {
            note: "UDP header and data. That is all of UDP: no numbering, no acknowledgements.",
          }));
        const J = internetChecksum([
          ...buildTransportPseudoHeader(n.src, n.dst, 17, _),
          ...A.bytes,
          0,
          0,
          ...P.bytes,
        ]);
        (A.field(
          "Checksum",
          J === null
            ? "covers bytes not shown here"
            : formatHexValue(J || 65535),
          () => (J === null ? A.unknown(2) : A.u16(J || 65535)),
          {
            note: "Covers the header, the data and the IP addresses.",
            hidden: J === null,
          },
        ),
          v.push(A, P));
      } else if (o.icmp) {
        const P = o.icmp,
          A = new PacketLayerBuilder("icmp", ""),
          _ = {
            "8,0": "Echo request",
            "0,0": "Echo reply",
            "11,0": "Time exceeded (TTL reached 0)",
            "3,3": "Destination unreachable (port unreachable)",
          };
        (A.field("Type", `${P.type}`, () => A.u8(P.type), {
          note: _[`${P.type},${P.code}`],
        }),
          A.field("Code", `${P.code}`, () => A.u8(P.code)));
        const J = A.length;
        if (
          (A.field("Checksum", "", () => A.u16(0), {
            note: "Covers the whole ICMP message.",
          }),
          P.type === 8 || P.type === 0)
        )
          (A.field("Identifier", formatHexValue(P.id), () => A.u16(P.id), {
            note: "Matches replies to this ping program.",
          }),
            A.field("Sequence number", P.seq, () => A.u16(P.seq), {
              note: "Windows counts up across every ping it sends.",
            }),
            A.field(
              "Data",
              `"${P.data}" (${P.data.length} bytes)`,
              () => A.ascii(P.data),
              {
                note:
                  P.type === 8
                    ? "Windows ping’s filler: the alphabet, a to w, then again."
                    : "Sent back exactly as it came.",
                mono: !0,
              },
            ));
        else {
          A.field("Unused", "0", () => A.u32(0));
          const V = this.built[s + P.quote],
            ee = 14,
            Ke = V.bytes.slice(ee, ee + (V.ipLength ?? V.bytes.length - ee)),
            Te = Ke.slice(0, P.quoteBytes === 8 ? 28 : Ke.length);
          ((Te[8] = P.ttl), (Te[10] = Te[11] = 0));
          const et = internetChecksum(Te.slice(0, 20));
          ((Te[10] = et >> 8),
            (Te[11] = et & 255),
            A.field(
              "Original packet",
              P.quoteBytes === 8
                ? "its IP header and first 8 bytes (28 bytes)"
                : `all ${Te.length} bytes of it`,
              () => A.raw(Te),
              {
                note: `The packet that caused this, as the reporting device received it (TTL ${P.ttl}), so the sender can tell which packet it was.`,
              },
            ),
            A.field(
              "Its source, destination",
              `${n.dst} → ${a[s + P.quote].row.dst}`,
              () => {},
              {
                depth: 1,
              },
            ));
        }
        const Re = internetChecksum(A.bytes);
        ((A.bytes[J] = Re >> 8),
          (A.bytes[J + 1] = Re & 255),
          (A.fields.find((V) => V.name === "Checksum").value =
            formatHexValue(Re)),
          (A.name = `ICMP · ${_[`${P.type},${P.code}`]}`),
          v.push(A));
      }
      const re = 20 + v.reduce((P, A) => P + A.length, 0),
        C = new PacketLayerBuilder("ip", "IPv4 · 20 bytes"),
        Z = this.ttl(n, o),
        R = o.tcp
          ? !0
          : (o.df ??
            (!isClientAddress(n.src) &&
              !!o.udp &&
              n.src !== ENCODING_DNS_IP &&
              n.src !== ENCODING_ROUTER_LAN_IP)),
        x =
          o.natOf !== void 0 ? this.built[s + o.natOf].ipId : this.ipId(n.src),
        H = isClientAddress(n.src)
          ? `Windows starts at 128.${Z !== 128 ? ` Set to ${Z} on purpose here.` : ""}`
          : isLocalNetworkAddress(n.dst) && !isLocalNetworkAddress(n.src)
            ? `Started at ${getInitialTtl(n.src)}; ${getExampleHopCount(n.src)} router${getExampleHopCount(n.src) === 1 ? "" : "s"} on the way each took 1.`
            : `As sent: this system starts at ${getInitialTtl(n.src)}.`;
      ((C.summary = `${n.src} → ${n.dst}`),
        C.field("Version, header length", "4, 20 bytes", () => C.u8(69), {
          note: "IPv4, with no options.",
        }),
        C.field("DSCP, ECN", "0, 0", () => C.u8(0), {
          note: "Priority and congestion marks; 0 means ordinary traffic.",
        }),
        C.field("Total length", `${re} bytes`, () => C.u16(re), {
          note: "This header and everything inside it.",
        }),
        C.field("Identification", formatHexValue(x), () => C.u16(x), {
          note: "Lets the receiver reassemble the pieces if the packet gets split.",
          example: !0,
        }),
        C.field(
          "Flags",
          R ? "DF (don’t fragment)" : "none",
          () => C.u16(R ? 16384 : 0),
          {
            note: R
              ? "Routers must not split it; if it’s too big they report back instead."
              : "Routers may split it if a link is too small.",
            example: !o.tcp,
          },
        ),
        C.field("Time to live", Z, () => C.u8(Z), {
          note: H,
          example: n.src === ENCODING_ISP_IP,
        }),
        C.field(
          "Protocol",
          T === 6 ? "6 (TCP)" : T === 17 ? "17 (UDP)" : "1 (ICMP)",
          () => C.u8(T),
        ));
      const we = C.length;
      (C.field("Header checksum", "", () => C.u16(0), {
        note: "Covers this header only; every router recomputes it after lowering the TTL.",
      }),
        C.field("Source", n.src, () => C.raw(ipv4ToBytes(n.src))),
        C.field("Destination", n.dst, () => C.raw(ipv4ToBytes(n.dst))));
      const ce = internetChecksum(C.bytes);
      ((C.bytes[we] = ce >> 8),
        (C.bytes[we + 1] = ce & 255),
        (C.fields.find((P) => P.name === "Header checksum").value =
          formatHexValue(ce)),
        l.push(C, ...v),
        (y = x));
    }
    const w = combinePacketLayers(l),
      k = o.arp ? void 0 : w.bytes.length - 14;
    if (w.bytes.length < 60) {
      const T = new PacketLayerBuilder(
          "pad",
          `Ethernet padding · ${60 - w.bytes.length} bytes`,
        ),
        v = 60 - w.bytes.length;
      T.field("Padding", `${v} zero bytes`, () => T.raw(Array(v).fill(0)), {
        note: "Ethernet frames are at least 60 bytes (64 with the checksum the card adds), so short ones are padded.",
      });
      const I = combinePacketLayers([T]);
      w.layers.push({
        ...I.layers[0],
        from: w.bytes.length,
        to: 60,
      });
      for (const q of I.fields)
        w.fields.push({
          ...q,
          from: q.from + w.bytes.length,
          to: q.to + w.bytes.length,
        });
      w.bytes.push(...I.bytes);
    }
    const g = {
      index: s,
      at: i.at,
      ...w,
      ipLength: k,
      ipId: y,
      segments: h,
      tcp: d && {
        seq: d.seq,
        ack: d.ack,
        hlen: d.hlen,
        mss: d.mss,
      },
      messageLength: (() => {
        const T = l.find((v) => v.full !== void 0);
        return T ? T.full : null;
      })(),
    };
    return ((this.built[s] = g), g);
  }
}
const encodedLessonCache = new WeakMap();
function getEncodedLessonPackets(e) {
  if (!encodedLessonCache.has(e)) {
    const t = new LessonPacketEncoder(e),
      s = getLessonPackets(e);
    encodedLessonCache.set(
      e,
      s.map((a, n) => t.frame(a, n, s)),
    );
  }
  return encodedLessonCache.get(e);
}
export { getEncodedLessonPackets, getLessonPackets };
