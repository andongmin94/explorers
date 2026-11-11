// Reconstructed from the distributed Protocol Explorer JavaScript.
import { getLinkLatency } from "../simulation/timeline.js";

/** Expand stream events into the same packet order used by the inspector. */
const getLessonPackets = (lesson) =>
  lesson.steps
    .flatMap((step) => step.events)
    .flatMap((event) =>
      event.type === "packet"
        ? [event]
        : event.type === "stream"
          ? event.packets
          : [],
    );
/**
 * Write a protocol layer in network byte order and record its field ranges.
 * Ranges are half-open [from, to). A null byte means the lesson intentionally
 * omits that byte (for example ciphertext), rather than inventing its value.
 * Zero-length fields carry explanations without claiming bytes on the wire.
 */
class PacketLayerBuilder {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.bytes = [];
    this.fields = [];
  }
  get length() {
    return this.bytes.length;
  }
  u8(value) {
    this.bytes.push(value & 255);
    return this;
  }
  u16(value) {
    this.bytes.push((value >>> 8) & 255, value & 255);
    return this;
  }
  u24(value) {
    this.bytes.push((value >>> 16) & 255, (value >>> 8) & 255, value & 255);
    return this;
  }
  u32(value) {
    this.bytes.push(
      (value >>> 24) & 255,
      (value >>> 16) & 255,
      (value >>> 8) & 255,
      value & 255,
    );
    return this;
  }
  raw(bytes) {
    for (const byte of bytes) this.bytes.push(byte);
    return this;
  }
  ascii(text) {
    for (const byte of new TextEncoder().encode(text)) this.bytes.push(byte);
    return this;
  }
  unknown(byteCount) {
    for (let index = 0; index < byteCount; index++) this.bytes.push(null);
    return this;
  }
  field(name, value, writeBytes = () => {}, metadata = {}) {
    const startOffset = this.length;
    writeBytes();
    this.fields.push({
      name,
      value: String(value),
      from: startOffset,
      to: this.length,
      ...metadata,
    });
    return this;
  }
}
const ipv4ToBytes = (address) => address.split(".").map(Number);
const macToBytes = (address) =>
  address.split(":").map((octet) => parseInt(octet, 16));
function ipv6ToBytes(address) {
  const [prefix, suffix] = address.split("::");
  const prefixGroups = prefix ? prefix.split(":") : [];
  const suffixGroups = suffix !== undefined && suffix ? suffix.split(":") : [];
  return [
    ...prefixGroups,
    ...Array(8 - prefixGroups.length - suffixGroups.length).fill("0"),
    ...suffixGroups,
  ].flatMap((group) => [parseInt(group, 16) >> 8, parseInt(group, 16) & 255]);
}
const formatHexValue = (value, width = 4) =>
  `0x${value.toString(16).padStart(width, "0")}`;
/** One's-complement checksum; unknown input bytes leave the checksum unknown. */
function internetChecksum(bytes) {
  let sum = 0;
  for (let offset = 0; offset < bytes.length; offset += 2) {
    const highByte = bytes[offset];
    const lowByte = offset + 1 < bytes.length ? bytes[offset + 1] : 0;
    if (highByte === null || lowByte === null) return null;
    sum += (highByte << 8) | lowByte;
  }
  while (sum > 65535) sum = (sum & 65535) + (sum >>> 16);
  return ~sum & 65535;
}
/** Translate layer-relative field ranges to offsets in the complete frame. */
function combinePacketLayers(packetLayers) {
  const bytes = [];
  const fields = [];
  const layers = [];
  for (const packetLayer of packetLayers) {
    const layerOffset = bytes.length;
    layers.push({
      id: packetLayer.id,
      name: packetLayer.name,
      from: layerOffset,
      to: layerOffset + packetLayer.length,
      summary: packetLayer.summary,
    });
    for (const field of packetLayer.fields)
      fields.push({
        ...field,
        layer: packetLayer.id,
        from: field.from + layerOffset,
        to: field.to + layerOffset,
      });
    bytes.push(...packetLayer.bytes);
  }
  return {
    bytes,
    fields,
    layers,
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
const isLocalNetworkAddress = (address) =>
  address.startsWith("192.168.1.") ||
  address === "0.0.0.0" ||
  address === "255.255.255.255";
const isClientAddress = (address) =>
  address === ENCODING_CLIENT_IP || address === "0.0.0.0";
const getInitialTtl = (address) =>
  isClientAddress(address) || address === ENCODING_DNS_IP
    ? 128
    : address === ENCODING_ISP_IP
      ? 255
      : 64;
const getExampleHopCount = (address) =>
  address === ENCODING_ROUTER_LAN_IP
    ? 0
    : address === ENCODING_ISP_IP
      ? 1
      : address === ENCODING_DNS_IP
        ? 10
        : 12;
const ENCODING_TCP_MSS = 1460;
// Stable example identifiers make repeated inspection of a lesson reproducible.
function hashExampleValue(text) {
  let hash = 2166136261;
  for (const character of text)
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
}
const CRLF = `\r
`;
const escapeTextValue = (text) => JSON.stringify(text).slice(1, -1);
function encodeTextLines(id, name, lines) {
  const layer = new PacketLayerBuilder(id, name);
  lines.forEach((line, index) =>
    layer.field(
      index ? "" : "Text",
      `${escapeTextValue(line)}␍␊`,
      () => layer.ascii(line + CRLF),
      {
        mono: true,
      },
    ),
  );
  return layer;
}
/** Preserve field annotations when a lesson shows only part of an application message. */
function encodePayloadSlice(packetRow, payload) {
  const completeLayer = encodeApplicationPayload(packetRow, payload);
  if (!payload.take) return completeLayer;
  const [startOffset, endOffset] = payload.take;
  const slicedLayer = new PacketLayerBuilder(
    completeLayer.id,
    `${completeLayer.name} · bytes ${startOffset + 1}–${endOffset} of ${completeLayer.length.toLocaleString("en-US")}`,
  );
  slicedLayer.bytes = completeLayer.bytes.slice(startOffset, endOffset);
  slicedLayer.fields = completeLayer.fields
    .filter((field) =>
      field.from === field.to
        ? field.from >= startOffset && field.from <= endOffset
        : field.to > startOffset && field.from < endOffset,
    )
    .map((field) => ({
      ...field,
      from: Math.max(0, field.from - startOffset),
      to: Math.min(endOffset, field.to) - startOffset,
    }));
  return slicedLayer;
}
function encodeApplicationPayload(packetRow, payload) {
  if (payload.ascii !== undefined) {
    const layer = new PacketLayerBuilder(
      "app",
      payload.name ?? getApplicationProtocolName(packetRow),
    );
    layer.field(
      "Data",
      `"${payload.ascii}" (${payload.ascii.length} bytes)`,
      () => layer.ascii(payload.ascii),
      {
        mono: true,
        note: payload.note,
      },
    );
    return layer;
  }
  if (payload.text)
    return encodeTextLines(
      "app",
      payload.name ?? getApplicationProtocolName(packetRow),
      payload.text,
    );
  if (payload.http) {
    const layer = encodeTextLines("app", "HTTP", payload.http.lines);
    if (payload.http.body) {
      layer.field(
        "Body",
        `${payload.http.body.toLocaleString("en-US")} bytes: ${payload.http.what}`,
        () => layer.unknown(payload.http.body),
        {
          hidden: true,
          note: "The page itself; its contents are not part of the lesson.",
        },
      );
    }
    return layer;
  }
  if (payload.opaque !== undefined) {
    const layer = new PacketLayerBuilder(
      "app",
      payload.name ?? getApplicationProtocolName(packetRow),
    );
    layer.field(
      "Data",
      `${payload.opaque.toLocaleString("en-US")} bytes: ${payload.what}`,
      () => layer.unknown(payload.opaque),
      {
        hidden: true,
        note: payload.note,
      },
    );
    return layer;
  }
  if (payload.tls) return encodeTlsRecords(payload.tls);
  if (payload.ssh) return encodeSshPacket(payload.ssh);
  if (payload.dns) return encodeDnsMessage(payload.dns);
  if (payload.dhcp) return encodeDhcpMessage(payload.dhcp);
  if (payload.rtp) return encodeRtpPacket(payload.rtp);
  throw new Error(`unknown payload for ${packetRow.info}`);
}
const getApplicationProtocolName = (packetRow) =>
  packetRow.proto.replace(" (TLS)", "").replace("-DATA", " data");
const TLS_RECORD_TYPES = {
  handshake: [22, "Handshake"],
  ccs: [20, "Change Cipher Spec"],
  appdata: [23, "Application Data"],
  alert: [21, "Alert"],
};
function encodeTlsRecords(records) {
  const layer = new PacketLayerBuilder(
    "tls",
    `TLS 1.3 · ${records.length} record${records.length > 1 ? "s" : ""}`,
  );
  for (const record of records) {
    const [contentType, contentName] = TLS_RECORD_TYPES[record.type];
    const recordLength = record.length;
    layer.field(
      "Record",
      `${contentName}, ${recordLength.toLocaleString("en-US")} byte${recordLength === 1 ? "" : "s"}`,
      () => {},
      {
        heading: true,
      },
    );
    layer.field(
      "Content type",
      `${contentType} (${contentName})`,
      () => layer.u8(contentType),
      {
        depth: 1,
        note: record.inner
          ? "Every encrypted record says Application Data on the outside; the real type is inside."
          : undefined,
      },
    );
    layer.field(
      "Version",
      record.legacy ? "0x0301 (TLS 1.0)" : "0x0303 (TLS 1.2)",
      () => layer.u16(record.legacy ? 769 : 771),
      {
        depth: 1,
        note: record.legacy
          ? "A Client Hello’s record says TLS 1.0 so old middleboxes let it through; the real versions are offered inside."
          : "TLS 1.3 records say 1.2 on the outside, for compatibility.",
      },
    );
    layer.field(
      "Length",
      recordLength.toLocaleString("en-US"),
      () => layer.u16(recordLength),
      {
        depth: 1,
      },
    );
    if (record.type === "ccs")
      layer.field("Change cipher spec", "1", () => layer.u8(1), {
        depth: 1,
        note: "Has no job in TLS 1.3; sent so middleboxes see a familiar handshake.",
      });
    else if (record.hello) {
      const hello = record.hello;
      layer.field(
        "Handshake type",
        `${hello.type} (${hello.name})`,
        () => layer.u8(hello.type),
        {
          depth: 1,
        },
      );
      layer.field(
        "Length",
        (recordLength - 4).toLocaleString("en-US"),
        () => layer.u24(recordLength - 4),
        {
          depth: 1,
        },
      );
      layer.field(
        "Contents",
        `${(recordLength - 4).toLocaleString("en-US")} bytes`,
        () => layer.unknown(recordLength - 4),
        {
          depth: 1,
          hidden: true,
          note: hello.note,
        },
      );
      for (const [fieldName, fieldValue] of hello.fields)
        layer.field(fieldName, fieldValue, () => {}, {
          depth: 2,
        });
    } else {
      layer.field(
        "Encrypted data",
        `${recordLength.toLocaleString("en-US")} bytes`,
        () => layer.unknown(recordLength),
        {
          depth: 1,
          hidden: true,
          note: "Ciphertext, ending in a 16-byte tag that shows any change. Only the two ends can read it.",
        },
      );
      if (record.inner) {
        layer.field("Inside", record.inner.what, () => {}, {
          depth: 2,
          inside: true,
        });
        for (const line of record.inner.text ?? [])
          layer.field("", `${escapeTextValue(line)}␍␊`, () => {}, {
            depth: 3,
            inside: true,
            mono: true,
          });
      }
    }
  }
  return layer;
}
function encodeSshPacket(message) {
  const layer = new PacketLayerBuilder("ssh", "SSH");
  if (message.sealed) {
    layer.name = "SSH · encrypted packet";
    layer.field(
      "Encrypted packet",
      `${message.sealed} bytes`,
      () => layer.unknown(message.sealed),
      {
        hidden: true,
        note: "With chacha20-poly1305 even the length is encrypted; a 16-byte tag at the end shows any change.",
      },
    );
    layer.field("Inside", message.inside, () => {}, {
      depth: 1,
      inside: true,
    });
    return layer;
  }
  const payloadLayer = new PacketLayerBuilder("x", "");
  const writeStringField = (name, text, depth = 1) =>
    payloadLayer.field(
      name,
      text.length > 60 ? `${text.slice(0, 57)}…` : text,
      () => payloadLayer.u32(text.length).ascii(text),
      {
        depth,
        mono: true,
      },
    );
  if (message.msg === "kexinit") {
    payloadLayer.field("Message", "20 (KEXINIT)", () => payloadLayer.u8(20));
    payloadLayer.field(
      "Cookie",
      "16 random bytes",
      () => payloadLayer.unknown(16),
      {
        depth: 1,
        hidden: true,
      },
    );
    const negotiationLists = [
      ["Key exchange", message.kex],
      ["Host keys", message.hostkeys],
      ["Ciphers, out", message.ciphers],
      ["Ciphers, in", message.ciphers],
      ["MACs, out", message.macs],
      ["MACs, in", message.macs],
      ["Compression, out", message.compression],
      ["Compression, in", message.compression],
      ["Languages, out", []],
      ["Languages, in", []],
    ];
    for (const [name, algorithms] of negotiationLists)
      writeStringField(name, algorithms.join(","));
    payloadLayer.field("First packet follows", "0", () => payloadLayer.u8(0), {
      depth: 1,
    });
    payloadLayer.field("Reserved", "0", () => payloadLayer.u32(0), {
      depth: 1,
    });
  } else if (message.msg === "ecdh_init") {
    payloadLayer.field("Message", "30 (KEX_ECDH_INIT)", () =>
      payloadLayer.u8(30),
    );
    payloadLayer.field(
      "Public keys",
      `${message.q} bytes (sntrup761 1,158 + X25519 32)`,
      () => payloadLayer.u32(message.q).unknown(message.q),
      {
        depth: 1,
        hidden: true,
      },
    );
  } else if (message.msg === "ecdh_reply") {
    payloadLayer.field("Message", "31 (KEX_ECDH_REPLY)", () =>
      payloadLayer.u8(31),
    );
    payloadLayer.field(
      "Host key",
      `${message.ks} bytes: ssh-ed25519 public key`,
      () => payloadLayer.u32(message.ks).unknown(message.ks),
      {
        depth: 1,
        hidden: true,
      },
    );
    payloadLayer.field(
      "Server’s half",
      `${message.q} bytes (sntrup761 ciphertext 1,039 + X25519 32)`,
      () => payloadLayer.u32(message.q).unknown(message.q),
      {
        depth: 1,
        hidden: true,
      },
    );
    payloadLayer.field(
      "Signature",
      `${message.sig} bytes: ssh-ed25519 signature over the exchange`,
      () => payloadLayer.u32(message.sig).unknown(message.sig),
      {
        depth: 1,
        hidden: true,
      },
    );
  } else if (message.msg === "newkeys") {
    payloadLayer.field("Message", "21 (NEWKEYS)", () => payloadLayer.u8(21), {
      note: "From the next packet on, this side encrypts.",
    });
  }
  let paddingLength = 8 - ((5 + payloadLayer.length) % 8);
  if (paddingLength < 4) {
    paddingLength += 8;
  }
  layer.field(
    "Packet length",
    1 + payloadLayer.length + paddingLength,
    () => layer.u32(1 + payloadLayer.length + paddingLength),
    {
      note: "Bytes after this field.",
    },
  );
  layer.field("Padding length", paddingLength, () => layer.u8(paddingLength), {
    note: "Random padding brings the packet to a multiple of 8 bytes.",
  });
  const payloadOffset = layer.length;
  layer.raw(payloadLayer.bytes);
  for (const field of payloadLayer.fields)
    layer.fields.push({
      ...field,
      from: field.from + payloadOffset,
      to: field.to + payloadOffset,
    });
  layer.field(
    "Padding",
    `${paddingLength} random bytes`,
    () => layer.unknown(paddingLength),
    {
      hidden: true,
    },
  );
  return layer;
}
const DNS_RECORD_TYPES = {
  A: 1,
  NS: 2,
  MX: 15,
  AAAA: 28,
  OPT: 41,
};
function encodeDnsMessage(message) {
  const layer = new PacketLayerBuilder("dns", "DNS");
  // DNS compression pointers refer to previously written suffixes within this message.
  const nameOffsets = new Map();
  const writeDomainName = (domain) => {
    const labels = domain.split(".");
    for (let labelIndex = 0; labelIndex < labels.length; labelIndex++) {
      const suffix = labels.slice(labelIndex).join(".");
      if (nameOffsets.has(suffix))
        return layer.u16(49152 | nameOffsets.get(suffix));
      if (layer.length < 16383) {
        nameOffsets.set(suffix, layer.length);
      }
      layer.u8(labels[labelIndex].length).ascii(labels[labelIndex]);
    }
    layer.u8(0);
  };
  const flags =
    (message.response ? 32768 : 0) |
    (message.aa ? 1024 : 0) |
    (message.rd ? 256 : 0) |
    (message.ra ? 128 : 0);
  const flagNames = [
    message.response ? "response" : "query",
    message.aa && "AA (authoritative)",
    message.rd && "RD (recursion desired)",
    message.ra && "RA (recursion available)",
  ].filter(Boolean);
  const recordsOrEmpty = (records) => records ?? [];
  const additionalCount =
    recordsOrEmpty(message.ar).length + (message.edns ? 1 : 0);
  layer.field(
    "Transaction ID",
    formatHexValue(message.id),
    () => layer.u16(message.id),
    {
      note: "Picked at random; the answer must carry the same one.",
      example: true,
    },
  );
  layer.field(
    "Flags",
    `${formatHexValue(flags)}: ${flagNames.join(", ")}`,
    () => layer.u16(flags),
  );
  layer.field("Questions", 1, () => layer.u16(1));
  layer.field("Answers", recordsOrEmpty(message.an).length, () =>
    layer.u16(recordsOrEmpty(message.an).length),
  );
  layer.field("Authority records", recordsOrEmpty(message.ns).length, () =>
    layer.u16(recordsOrEmpty(message.ns).length),
  );
  layer.field("Additional records", additionalCount, () =>
    layer.u16(additionalCount),
  );
  const [questionName, questionType] = message.q;
  layer.field(
    "Question",
    `${questionName}, type ${questionType}, class IN`,
    () => {
      writeDomainName(questionName);
      layer.u16(DNS_RECORD_TYPES[questionType]).u16(1);
    },
  );
  const writeResourceRecord = (
    sectionName,
    [ownerName, recordType, ttl, recordData],
  ) => {
    const displayValue =
      recordType === "MX" ? `${recordData[0]} ${recordData[1]}` : recordData;
    layer.field(
      sectionName,
      `${ownerName} ${recordType} ${displayValue} (TTL ${ttl.toLocaleString("en-US")} s)`,
      () => {
        writeDomainName(ownerName);
        layer.u16(DNS_RECORD_TYPES[recordType]).u16(1).u32(ttl);
        const lengthOffset = layer.length;
        layer.u16(0);
        if (recordType === "A") {
          layer.raw(ipv4ToBytes(recordData));
        } else if (recordType === "AAAA") {
          layer.raw(ipv6ToBytes(recordData));
        } else if (recordType === "NS") {
          writeDomainName(recordData);
        } else if (recordType === "MX") {
          layer.u16(recordData[0]);
          writeDomainName(recordData[1]);
        }
        const dataLength = layer.length - lengthOffset - 2;
        layer.bytes[lengthOffset] = dataLength >> 8;
        layer.bytes[lengthOffset + 1] = dataLength & 255;
      },
      {
        example: message.exampleTtl && sectionName === "Answer",
      },
    );
  };
  recordsOrEmpty(message.an).forEach((record) =>
    writeResourceRecord("Answer", record),
  );
  recordsOrEmpty(message.ns).forEach((record) =>
    writeResourceRecord("Authority", record),
  );
  recordsOrEmpty(message.ar).forEach((record) =>
    writeResourceRecord("Additional", record),
  );
  if (message.edns) {
    layer.field(
      "EDNS",
      `UDP size ${message.edns.size}, DNSSEC OK = 0`,
      () => layer.u8(0).u16(41).u16(message.edns.size).u32(0).u16(0),
      {
        note: "Says how big a UDP answer can be. DNSSEC signatures are not asked for here, to keep the lesson short; a validating resolver like 8.8.8.8 does ask for them.",
      },
    );
  }
  return layer;
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
function encodeDhcpMessage(message) {
  const layer = new PacketLayerBuilder(
    "dhcp",
    `DHCP ${DHCP_MESSAGE_TYPES[message.options.find(([optionCode]) => optionCode === 53)[1]]}`,
  );
  const writeAddressField = (name, address, note) =>
    layer.field(name, address, () => layer.raw(ipv4ToBytes(address)), {
      note,
    });
  layer.field(
    "Message",
    message.op === 1
      ? "1 (request, from a client)"
      : "2 (reply, from a server)",
    () => layer.u8(message.op),
  );
  layer.field("Hardware", "Ethernet, 6-byte addresses", () =>
    layer.u8(1).u8(6),
  );
  layer.field("Hops", "0", () => layer.u8(0));
  layer.field(
    "Transaction ID",
    formatHexValue(message.xid, 8),
    () => layer.u32(message.xid),
    {
      note: "Chosen by the client; every reply repeats it.",
    },
  );
  layer.field("Seconds", "0", () => layer.u16(0));
  layer.field(
    "Flags",
    "0x0000 (unicast replies are fine)",
    () => layer.u16(0),
    {
      note: "Broadcast flag off: the server may send straight to the client’s MAC address.",
    },
  );
  writeAddressField(
    "Client address",
    message.ciaddr ?? "0.0.0.0",
    "Filled in only when the client already has an address (renewing).",
  );
  writeAddressField(
    "Your address",
    message.yiaddr ?? "0.0.0.0",
    "The address the server is giving out.",
  );
  writeAddressField("Next server", message.siaddr ?? "0.0.0.0");
  writeAddressField("Relay agent", "0.0.0.0");
  layer.field(
    "Client MAC",
    EXAMPLE_MAC_ADDRESSES.laptop,
    () =>
      layer
        .raw(macToBytes(EXAMPLE_MAC_ADDRESSES.laptop))
        .raw(Array(10).fill(0)),
    {
      example: true,
    },
  );
  layer.field("Server name, boot file", "empty", () =>
    layer.raw(Array(192).fill(0)),
  );
  layer.field(
    "Magic cookie",
    "99.130.83.99 (DHCP)",
    () => layer.raw([99, 130, 83, 99]),
    {
      note: "Marks the options that follow as DHCP.",
    },
  );
  for (const [optionCode, optionValue] of message.options) {
    const [optionName, valueType] = DHCP_OPTION_DEFINITIONS[optionCode];
    const displayValue =
      valueType === "type"
        ? `${optionValue} (${DHCP_MESSAGE_TYPES[optionValue]})`
        : valueType === "secs"
          ? `${optionValue.toLocaleString("en-US")} s (${optionValue / 3600} h)`
          : valueType === "list"
            ? optionValue.join(", ")
            : valueType === "mac"
              ? `01 ${EXAMPLE_MAC_ADDRESSES.laptop}`
              : optionValue;
    layer.field(
      `Option ${optionCode}`,
      `${optionName}: ${displayValue}`,
      () => {
        layer.u8(optionCode);
        if (valueType === "ip") {
          layer.u8(4).raw(ipv4ToBytes(optionValue));
        } else if (valueType === "type") {
          layer.u8(1).u8(optionValue);
        } else if (valueType === "secs") {
          layer.u8(4).u32(optionValue);
        } else if (valueType === "text") {
          layer.u8(optionValue.length).ascii(optionValue);
        } else if (valueType === "list") {
          layer.u8(optionValue.length).raw(optionValue);
        } else if (valueType === "mac") {
          layer.u8(7).u8(1).raw(macToBytes(EXAMPLE_MAC_ADDRESSES.laptop));
        } else if (valueType === "fqdn") {
          layer
            .u8(3 + optionValue.length)
            .u8(0)
            .u8(0)
            .u8(0)
            .ascii(optionValue);
        }
      },
      {
        example: ["text", "list", "fqdn"].includes(valueType),
      },
    );
  }
  layer.field("End", "255", () => layer.u8(255));
  if (layer.length < 300) {
    const paddingLength = 300 - layer.length;
    layer.field(
      "Padding",
      `${paddingLength} zero bytes, up to the 300-byte minimum`,
      () => layer.raw(Array(paddingLength).fill(0)),
    );
  }
  return layer;
}
function encodeRtpPacket(packet) {
  const layer = new PacketLayerBuilder("rtp", "RTP + audio");
  layer.field("Version etc.", "2, no padding, no extension, no CSRCs", () =>
    layer.u8(128),
  );
  layer.field(
    "Marker, payload type",
    `${packet.marker ? 1 : 0}, ${packet.pt} (Opus, agreed when the call was set up)`,
    () => layer.u8((packet.marker ? 128 : 0) | packet.pt),
    {
      example: true,
    },
  );
  layer.field("Sequence number", packet.seq, () => layer.u16(packet.seq), {
    note: "Counts up by one per packet, so the app can spot a missing or late one.",
    example: true,
  });
  layer.field("Timestamp", packet.ts, () => layer.u32(packet.ts), {
    note: "Audio clock at 48,000 per second: +960 per 20 ms frame.",
    example: true,
  });
  layer.field(
    "SSRC",
    formatHexValue(packet.ssrc, 8),
    () => layer.u32(packet.ssrc),
    {
      note: "Identifies this audio stream.",
      example: true,
    },
  );
  layer.field(
    "Audio",
    `${packet.audio} bytes of Opus audio (20 ms)`,
    () => layer.unknown(packet.audio),
    {
      hidden: true,
    },
  );
  return layer;
}
const TCP_FLAG_DEFINITIONS = [
  ["F", 1, "FIN"],
  ["S", 2, "SYN"],
  ["R", 4, "RST"],
  ["P", 8, "PSH"],
  ["A", 16, "ACK"],
];
function decodeTcpFlags(flagLetters) {
  const flags = TCP_FLAG_DEFINITIONS.filter(([letter]) =>
    flagLetters.includes(letter),
  );
  return {
    bits: flags.reduce((bits, [, flagBit]) => bits | flagBit, 0),
    names: flags.map(([, , name]) => name).join(", "),
  };
}
const buildTransportPseudoHeader = (
  sourceIp,
  destinationIp,
  protocol,
  length,
) => [
  ...ipv4ToBytes(sourceIp),
  ...ipv4ToBytes(destinationIp),
  0,
  protocol,
  length >> 8,
  length & 255,
];
/**
 * Encode one lesson in chronological order. Connection state tracks TCP byte
 * numbers and simulated arrivals; prior frames supply ICMP quotes and NAT IDs.
 * This generates educational wire examples, not traffic captured from a host.
 */
class LessonPacketEncoder {
  constructor(lesson) {
    this.lesson = lesson;
    this.endpointAliases = new Map();
    this.ipIds = new Map();
    this.connections = new Map();
    this.pendingDeliveries = [];
    this.remoteEndpoints = new Map();
    this.frames = [];
  }
  nextIpIdentification(address) {
    if (!this.ipIds.has(address)) {
      this.ipIds.set(address, hashExampleValue(`id ${address}`) & 65535);
    }
    const identification = this.ipIds.get(address);
    this.ipIds.set(address, (identification + 1) & 65535);
    return identification;
  }
  getEndpointMac(address, nextHop) {
    if (!this.remoteEndpoints.has(address)) {
      this.remoteEndpoints.set(address, this.remoteEndpoints.size);
    }
    const endpointIndex = this.remoteEndpoints.get(address);
    return `00:00:5e:00:53:${(nextHop ? 128 + endpointIndex : 64 + endpointIndex).toString(16)}`;
  }
  describeLink(packetRow) {
    const { src: sourceIp, dst: destinationIp } = packetRow;
    if (
      isLocalNetworkAddress(sourceIp) ||
      isLocalNetworkAddress(destinationIp)
    ) {
      const sourceIsLocal = isLocalNetworkAddress(sourceIp);
      const isBroadcast =
        destinationIp === "255.255.255.255" || destinationIp === "Broadcast";
      return {
        at: "Seen on the laptop’s home network",
        src: sourceIsLocal
          ? EXAMPLE_MAC_ADDRESSES.laptop
          : EXAMPLE_MAC_ADDRESSES.lan,
        dst: isBroadcast
          ? EXAMPLE_MAC_ADDRESSES.all
          : sourceIsLocal
            ? EXAMPLE_MAC_ADDRESSES.lan
            : EXAMPLE_MAC_ADDRESSES.laptop,
        srcNote: sourceIsLocal
          ? "The laptop’s network card."
          : "The router’s side facing the home network.",
        dstNote: isBroadcast
          ? "Broadcast: every device on the network receives it."
          : sourceIsLocal
            ? "The router: anything beyond the home network goes to it first."
            : "The laptop.",
      };
    }
    return sourceIp === ENCODING_ROUTER_WAN_IP
      ? {
          at: "Seen as it leaves the router’s internet side",
          src: EXAMPLE_MAC_ADDRESSES.wan,
          dst: EXAMPLE_MAC_ADDRESSES.isp,
          srcNote: "The router’s internet-facing port.",
          dstNote: "The internet provider’s router, the next hop.",
        }
      : {
          at: `Seen as it leaves ${sourceIp}`,
          src: this.getEndpointMac(sourceIp),
          dst: this.getEndpointMac(sourceIp, true),
          srcNote: "The sender’s network card.",
          dstNote:
            "The sender’s next router; each hop puts the packet in a new frame.",
        };
  }
  getTtl(packetRow, wire) {
    return wire.ttl !== undefined
      ? wire.ttl
      : isLocalNetworkAddress(packetRow.dst) &&
          !isLocalNetworkAddress(packetRow.src)
        ? getInitialTtl(packetRow.src) - getExampleHopCount(packetRow.src)
        : getInitialTtl(packetRow.src);
  }
  getConnection(packetRow, tcp) {
    // Both directions share a connection; NAT aliases keep its original identity.
    const resolveAlias = (endpointKey) =>
      this.endpointAliases.get(endpointKey) ?? endpointKey;
    const sourceKey = resolveAlias(`${packetRow.src}:${tcp.sport}`);
    const destinationKey = resolveAlias(`${packetRow.dst}:${tcp.dport}`);
    const connectionKey = [sourceKey, destinationKey].sort().join(" ");
    if (!this.connections.has(connectionKey)) {
      this.connections.set(connectionKey, {
        key: connectionKey,
        endpoints: {},
        timestampsEnabled: false,
      });
    }
    const connection = this.connections.get(connectionKey);
    for (const [endpointKey, address] of [
      [sourceKey, sourceKey.split(":")[0]],
      [destinationKey, destinationKey.split(":")[0]],
    ])
      connection.endpoints[endpointKey] ??= {
        ip: address,
        initialSequenceNumber: hashExampleValue(
          `isn ${connectionKey} ${endpointKey}`,
        ),
        nextSequenceNumber: 0,
        nextExpectedSequence: 0,
        outOfOrderRanges: [],
        timestampBase: hashExampleValue(`ts ${endpointKey}`) % 4e9,
        peerTimestamp: 0,
        receiveWindow: isClientAddress(address) ? [1026, 8] : [501, 7],
      };
    return {
      connection,
      sender: connection.endpoints[sourceKey],
      receiver: connection.endpoints[destinationKey],
      sourceKey,
      destinationKey,
    };
  }
  deliverPending(timestamp) {
    this.pendingDeliveries = this.pendingDeliveries.filter((delivery) => {
      if (delivery.at > timestamp + 1e-9) return true;
      const receiver = delivery.to;
      if (delivery.seq === receiver.nextExpectedSequence) {
        receiver.nextExpectedSequence += delivery.len;
        receiver.outOfOrderRanges.sort(
          (leftRange, rightRange) => leftRange[0] - rightRange[0],
        );
        // Filling a gap can also acknowledge ranges that arrived earlier.
        while (
          receiver.outOfOrderRanges.length &&
          receiver.outOfOrderRanges[0][0] <= receiver.nextExpectedSequence
        ) {
          receiver.nextExpectedSequence = Math.max(
            receiver.nextExpectedSequence,
            receiver.outOfOrderRanges.shift()[1],
          );
        }
      } else if (delivery.seq > receiver.nextExpectedSequence) {
        receiver.outOfOrderRanges.push([
          delivery.seq,
          delivery.seq + delivery.len,
        ]);
      }
      if (delivery.tsval) {
        receiver.peerTimestamp = delivery.tsval;
      }
      return false;
    });
  }
  encodeTcpSegment(
    packetRow,
    tcp,
    payloadLayer,
    timestamp,
    packet,
    segmentCount,
  ) {
    const { connection, sender, receiver } = this.getConnection(packetRow, tcp);
    const { bits: flagBits, names: flagNames } = decodeTcpFlags(tcp.flags);
    const hasSyn = flagBits & 2;
    const hasFin = flagBits & 1;
    const hasAck = flagBits & 16;
    const payloadLength = payloadLayer ? payloadLayer.length : 0;
    const senderIsClient = isClientAddress(sender.ip);
    if (hasSyn && !hasAck) {
      connection.timestampsEnabled = !senderIsClient;
    }
    const options = [];
    const timestampMs = Math.round(timestamp * 1e3);
    const timestampValue = (sender.timestampBase + timestampMs) >>> 0;
    if (hasSyn && !hasAck && senderIsClient) {
      options.push(
        ["MSS", 1460],
        ["NOP"],
        ["WS", 8],
        ["NOP"],
        ["NOP"],
        ["SACKP"],
      );
    } else if (hasSyn && !hasAck) {
      options.push(
        ["MSS", 1460],
        ["SACKP"],
        ["TS", timestampValue, 0],
        ["NOP"],
        ["WS", 7],
      );
    } else if (hasSyn) {
      options.push(
        ...(connection.timestampsEnabled
          ? [
              ["MSS", 1460],
              ["SACKP"],
              ["TS", timestampValue, sender.peerTimestamp],
              ["NOP"],
              ["WS", 7],
            ]
          : [["MSS", 1460], ["NOP"], ["NOP"], ["SACKP"], ["NOP"], ["WS", 7]]),
      );
    } else if (connection.timestampsEnabled) {
      options.push(
        ["NOP"],
        ["NOP"],
        ["TS", timestampValue, sender.peerTimestamp],
      );
    }
    if (tcp.sack) {
      const receivedRanges =
        receiver && sender.outOfOrderRanges.map(([start, end]) => [start, end]);
      options.push(["NOP"], ["NOP"], ["SACK", receivedRanges]);
    }
    const maximumSegmentSize = connection.timestampsEnabled
      ? ENCODING_TCP_MSS - 12
      : ENCODING_TCP_MSS;
    const firstSegmentLength = Math.min(payloadLength, maximumSegmentSize);
    const sequenceNumber = tcp.seq ?? sender.nextSequenceNumber;
    const acknowledgmentNumber = hasAck
      ? (tcp.ack ?? sender.nextExpectedSequence)
      : 0;
    // An explicit sequence number represents a retransmission. SYN and FIN each
    // consume one sequence number; losses never enter the receiver's queue.
    if (tcp.seq === undefined) {
      sender.nextSequenceNumber +=
        payloadLength + (hasSyn ? 1 : 0) + (hasFin ? 1 : 0);
    }
    if (!packet.lost) {
      this.pendingDeliveries.push({
        at: timestamp + getLinkLatency(this.lesson, packet.from, packet.to),
        to: receiver,
        seq: sequenceNumber,
        len: payloadLength + (hasSyn ? 1 : 0) + (hasFin ? 1 : 0),
        tsval: connection.timestampsEnabled ? timestampValue : 0,
      });
    }
    const header = new PacketLayerBuilder("tcp", "");
    const optionsLength = options.reduce(
      (total, [optionType, optionValue]) =>
        total +
        {
          NOP: 1,
          MSS: 4,
          WS: 3,
          SACKP: 2,
          TS: 10,
          SACK: 2 + 8 * (optionType === "SACK" ? optionValue.length : 0),
        }[optionType],
      0,
    );
    const headerLength = 20 + optionsLength;
    header.summary = `${tcp.sport} → ${tcp.dport}, ${flagNames}`;
    header.name = `TCP · ${headerLength} bytes`;
    header.field("Source port", tcp.sport, () => header.u16(tcp.sport), {
      note: senderIsClient
        ? packetRow.src === ENCODING_ROUTER_WAN_IP
          ? "The router’s NAT swapped in its own port for the laptop’s."
          : "Picked by the laptop’s system for this connection."
        : undefined,
    });
    header.field("Destination port", tcp.dport, () => header.u16(tcp.dport));
    header.field(
      "Sequence number",
      hasSyn ? "0 (relative)" : `${sequenceNumber} (relative)`,
      () => header.u32((sender.initialSequenceNumber + sequenceNumber) >>> 0),
      {
        note: hasSyn
          ? "This side’s starting number. Shown as 0; the real one is random."
          : "Position of this segment’s first byte, counted from this side’s SYN.",
      },
    );
    header.field(
      "Real sequence number",
      (sender.initialSequenceNumber + sequenceNumber) >>> 0,
      () => {},
      {
        depth: 1,
        example: true,
      },
    );
    header.field(
      "Acknowledgment",
      hasAck ? `${acknowledgmentNumber} (relative)` : "0 (not used yet)",
      () =>
        header.u32(
          hasAck
            ? (receiver.initialSequenceNumber + acknowledgmentNumber) >>> 0
            : 0,
        ),
      {
        note: hasAck
          ? "The next byte this side expects: everything before it has arrived."
          : "A first SYN has nothing to acknowledge.",
      },
    );
    header.field(
      "Header length",
      `${headerLength} bytes`,
      () => header.u8((headerLength / 4) << 4),
      {
        note: optionsLength
          ? `20 bytes, plus ${optionsLength} of options.`
          : undefined,
      },
    );
    header.field("Flags", `${formatHexValue(flagBits, 3)} (${flagNames})`, () =>
      header.u8(flagBits),
    );
    const windowScale = sender.receiveWindow[1];
    const windowSize = hasSyn
      ? hasAck && connection.timestampsEnabled
        ? 65160
        : 64240
      : sender.receiveWindow[0];
    header.field(
      "Window",
      hasSyn
        ? `${windowSize}`
        : `${windowSize} (× ${2 ** windowScale} = ${(windowSize * 2 ** windowScale).toLocaleString("en-US")} bytes)`,
      () => header.u16(windowSize),
      {
        note: "How much more data this side can take right now.",
        example: true,
      },
    );
    const checksumOffset = header.length;
    header.field("Checksum", "", () => header.u16(0), {
      note: "Covers the header, the data and the IP addresses, so damage is caught.",
    });
    header.field("Urgent pointer", "0", () => header.u16(0));
    if (options.length) {
      header.field("Options", `${optionsLength} bytes`, () => {}, {
        heading: true,
      });
      for (const [optionType, optionValue, echoValue] of options) {
        if (optionType === "NOP") {
          header.field("No-op", "1", () => header.u8(1), {
            depth: 1,
            note: "Spacing, so the next option lines up.",
          });
        }
        if (optionType === "MSS") {
          header.field(
            "Maximum segment size",
            `${optionValue} bytes`,
            () => header.u8(2).u8(4).u16(optionValue),
            {
              depth: 1,
              note: "The most data this side wants in one segment.",
            },
          );
        }
        if (optionType === "WS") {
          header.field(
            "Window scale",
            `× ${2 ** optionValue}`,
            () => header.u8(3).u8(3).u8(optionValue),
            {
              depth: 1,
              note: "Window values are multiplied by this, so windows can be larger than 64 KB.",
            },
          );
        }
        if (optionType === "SACKP") {
          header.field("SACK permitted", "yes", () => header.u8(4).u8(2), {
            depth: 1,
            note: "This side understands selective acknowledgements.",
          });
        }
        if (optionType === "TS") {
          header.field(
            "Timestamps",
            `value ${optionValue}, echo ${echoValue}`,
            () => header.u8(8).u8(10).u32(optionValue).u32(echoValue),
            {
              depth: 1,
              note: "Used to measure round trips; both sides offered them.",
              example: true,
            },
          );
        }
        if (optionType === "SACK") {
          header.field(
            "SACK",
            optionValue
              .map(([start, end]) => `has ${start}–${end - 1}`)
              .join(", "),
            () => {
              header.u8(5).u8(2 + 8 * optionValue.length);
              for (const [start, end] of optionValue)
                header
                  .u32((receiver.initialSequenceNumber + start) >>> 0)
                  .u32((receiver.initialSequenceNumber + end) >>> 0);
            },
            {
              depth: 1,
              note: "The receiver has these bytes buffered beyond the cumulative ACK.",
            },
          );
        }
      }
    }
    const firstSegmentBytes = payloadLayer
      ? payloadLayer.bytes.slice(0, firstSegmentLength)
      : [];
    const checksum = internetChecksum([
      ...buildTransportPseudoHeader(
        packetRow.src,
        packetRow.dst,
        6,
        headerLength + firstSegmentLength,
      ),
      ...header.bytes,
      ...firstSegmentBytes,
    ]);
    const checksumField = header.fields.find(
      (field) => field.name === "Checksum",
    );
    if (checksum === null) {
      header.bytes[checksumOffset] = header.bytes[checksumOffset + 1] = null;
      checksumField.value = "covers bytes not shown here";
      checksumField.hidden = true;
    } else {
      header.bytes[checksumOffset] = checksum >> 8;
      header.bytes[checksumOffset + 1] = checksum & 255;
      checksumField.value = formatHexValue(checksum);
    }
    return {
      header,
      first: firstSegmentLength,
      segments: Math.max(
        1,
        segmentCount ?? Math.ceil(payloadLength / maximumSegmentSize),
      ),
      mss: maximumSegmentSize,
      seq: sequenceNumber,
      ack: acknowledgmentNumber,
      hlen: headerLength,
    };
  }
  encodeFrame(packet, packetIndex, lessonPackets) {
    const packetRow = packet.row;
    const wire = packetRow.wire;
    if (!wire) return null;
    const timestamp = parseFloat(packetRow.time);
    this.deliverPending(timestamp);
    if (wire.alias) {
      this.endpointAliases.set(wire.alias[0], wire.alias[1]);
    }
    const link = wire.arp
      ? {
          at: "Seen on the laptop’s home network",
          src: packetRow.src,
          dst:
            packetRow.dst === "Broadcast"
              ? EXAMPLE_MAC_ADDRESSES.all
              : packetRow.dst,
          srcNote: "The sender’s network card.",
          dstNote:
            packetRow.dst === "Broadcast"
              ? "Broadcast: every device on the network receives it."
              : "Straight back to the device that asked.",
        }
      : this.describeLink(packetRow);
    const layers = [];
    const ethernet = new PacketLayerBuilder("eth", "Ethernet II · 14 bytes");
    ethernet.summary = `${link.src} → ${link.dst}`;
    ethernet.field(
      "Destination",
      link.dst,
      () => ethernet.raw(macToBytes(link.dst)),
      {
        note: link.dstNote,
        example: link.dst !== EXAMPLE_MAC_ADDRESSES.all,
      },
    );
    ethernet.field(
      "Source",
      link.src,
      () => ethernet.raw(macToBytes(link.src)),
      {
        note: link.srcNote,
        example: true,
      },
    );
    ethernet.field(
      "Type",
      wire.arp ? "0x0806 (ARP)" : "0x0800 (IPv4)",
      () => ethernet.u16(wire.arp ? 2054 : 2048),
      {
        note: "What the frame carries.",
      },
    );
    layers.push(ethernet);
    let segmentCount = 1;
    let tcpSegment = null;
    let ipIdentification;
    if (wire.arp) {
      const arp = new PacketLayerBuilder(
        "arp",
        `ARP ${wire.arp.op === 1 ? "request" : "reply"} · 28 bytes`,
      );
      arp.field("Hardware type", "1 (Ethernet)", () => arp.u16(1));
      arp.field("Protocol type", "0x0800 (IPv4)", () => arp.u16(2048));
      arp.field("Address sizes", "6 (MAC), 4 (IPv4)", () => arp.u8(6).u8(4));
      arp.field(
        "Operation",
        wire.arp.op === 1 ? "1 (request: who has …?)" : "2 (reply: … is at …)",
        () => arp.u16(wire.arp.op),
      );
      arp.field(
        "Sender MAC",
        wire.arp.sender[0],
        () => arp.raw(macToBytes(wire.arp.sender[0])),
        {
          example: true,
        },
      );
      arp.field("Sender IP", wire.arp.sender[1], () =>
        arp.raw(ipv4ToBytes(wire.arp.sender[1])),
      );
      arp.field(
        "Target MAC",
        wire.arp.target[0],
        () => arp.raw(macToBytes(wire.arp.target[0])),
        {
          note:
            wire.arp.op === 1
              ? "All zeros: this is what the request wants to find out."
              : undefined,
          example: wire.arp.op === 2,
        },
      );
      arp.field("Target IP", wire.arp.target[1], () =>
        arp.raw(ipv4ToBytes(wire.arp.target[1])),
      );
      layers.push(arp);
    } else {
      const protocolNumber = wire.tcp ? 6 : wire.udp ? 17 : 1;
      const transportLayers = [];
      let transportHeader;
      if (wire.tcp) {
        // Large messages show the first segment, while sequence tracking above
        // accounts for the full illustrated transfer.
        const payloadLayer = wire.tcp.data
          ? encodePayloadSlice(packetRow, wire.tcp.data)
          : null;
        tcpSegment = this.encodeTcpSegment(
          packetRow,
          wire.tcp,
          payloadLayer,
          timestamp,
          packet,
          wire.tcp.segments,
        );
        segmentCount = tcpSegment.segments;
        transportHeader = tcpSegment.header;
        transportLayers.push(transportHeader);
        if (payloadLayer) {
          payloadLayer.full = payloadLayer.length;
          if (tcpSegment.first < payloadLayer.length) {
            payloadLayer.bytes = payloadLayer.bytes.slice(0, tcpSegment.first);
            payloadLayer.cut = true;
          }
          transportLayers.push(payloadLayer);
        }
      } else if (wire.udp) {
        const payloadLayer = encodePayloadSlice(packetRow, wire.udp.data);
        const udp = new PacketLayerBuilder("udp", "UDP · 8 bytes");
        const udpLength = 8 + payloadLayer.length;
        udp.summary = `${wire.udp.sport} → ${wire.udp.dport}`;
        udp.field("Source port", wire.udp.sport, () => udp.u16(wire.udp.sport));
        udp.field("Destination port", wire.udp.dport, () =>
          udp.u16(wire.udp.dport),
        );
        udp.field("Length", `${udpLength} bytes`, () => udp.u16(udpLength), {
          note: "UDP header and data. That is all of UDP: no numbering, no acknowledgements.",
        });
        const checksum = internetChecksum([
          ...buildTransportPseudoHeader(
            packetRow.src,
            packetRow.dst,
            17,
            udpLength,
          ),
          ...udp.bytes,
          0,
          0,
          ...payloadLayer.bytes,
        ]);
        udp.field(
          "Checksum",
          checksum === null
            ? "covers bytes not shown here"
            : formatHexValue(checksum || 65535),
          () =>
            checksum === null ? udp.unknown(2) : udp.u16(checksum || 65535),
          {
            note: "Covers the header, the data and the IP addresses.",
            hidden: checksum === null,
          },
        );
        transportLayers.push(udp, payloadLayer);
      } else if (wire.icmp) {
        const icmpMessage = wire.icmp;
        const icmp = new PacketLayerBuilder("icmp", "");
        const icmpDescriptions = {
          "8,0": "Echo request",
          "0,0": "Echo reply",
          "11,0": "Time exceeded (TTL reached 0)",
          "3,3": "Destination unreachable (port unreachable)",
        };
        icmp.field(
          "Type",
          `${icmpMessage.type}`,
          () => icmp.u8(icmpMessage.type),
          {
            note: icmpDescriptions[`${icmpMessage.type},${icmpMessage.code}`],
          },
        );
        icmp.field("Code", `${icmpMessage.code}`, () =>
          icmp.u8(icmpMessage.code),
        );
        const checksumOffset = icmp.length;
        icmp.field("Checksum", "", () => icmp.u16(0), {
          note: "Covers the whole ICMP message.",
        });
        if (icmpMessage.type === 8 || icmpMessage.type === 0) {
          icmp.field(
            "Identifier",
            formatHexValue(icmpMessage.id),
            () => icmp.u16(icmpMessage.id),
            {
              note: "Matches replies to this ping program.",
            },
          );
          icmp.field(
            "Sequence number",
            icmpMessage.seq,
            () => icmp.u16(icmpMessage.seq),
            {
              note: "Windows counts up across every ping it sends.",
            },
          );
          icmp.field(
            "Data",
            `"${icmpMessage.data}" (${icmpMessage.data.length} bytes)`,
            () => icmp.ascii(icmpMessage.data),
            {
              note:
                icmpMessage.type === 8
                  ? "Windows ping’s filler: the alphabet, a to w, then again."
                  : "Sent back exactly as it came.",
              mono: true,
            },
          );
        } else {
          icmp.field("Unused", "0", () => icmp.u32(0));
          const originalFrame = this.frames[packetIndex + icmpMessage.quote];
          const ethernetHeaderLength = 14;
          const originalIpBytes = originalFrame.bytes.slice(
            ethernetHeaderLength,
            ethernetHeaderLength +
              (originalFrame.ipLength ??
                originalFrame.bytes.length - ethernetHeaderLength),
          );
          const quotedBytes = originalIpBytes.slice(
            0,
            icmpMessage.quoteBytes === 8 ? 28 : originalIpBytes.length,
          );
          quotedBytes[8] = icmpMessage.ttl;
          quotedBytes[10] = quotedBytes[11] = 0;
          const quotedHeaderChecksum = internetChecksum(
            quotedBytes.slice(0, 20),
          );
          quotedBytes[10] = quotedHeaderChecksum >> 8;
          quotedBytes[11] = quotedHeaderChecksum & 255;
          icmp.field(
            "Original packet",
            icmpMessage.quoteBytes === 8
              ? "its IP header and first 8 bytes (28 bytes)"
              : `all ${quotedBytes.length} bytes of it`,
            () => icmp.raw(quotedBytes),
            {
              note: `The packet that caused this, as the reporting device received it (TTL ${icmpMessage.ttl}), so the sender can tell which packet it was.`,
            },
          );
          icmp.field(
            "Its source, destination",
            `${packetRow.dst} → ${lessonPackets[packetIndex + icmpMessage.quote].row.dst}`,
            () => {},
            {
              depth: 1,
            },
          );
        }
        const checksum = internetChecksum(icmp.bytes);
        icmp.bytes[checksumOffset] = checksum >> 8;
        icmp.bytes[checksumOffset + 1] = checksum & 255;
        icmp.fields.find((field) => field.name === "Checksum").value =
          formatHexValue(checksum);
        icmp.name = `ICMP · ${icmpDescriptions[`${icmpMessage.type},${icmpMessage.code}`]}`;
        transportLayers.push(icmp);
      }
      const totalLength =
        20 + transportLayers.reduce((total, layer) => total + layer.length, 0);
      const ipv4 = new PacketLayerBuilder("ip", "IPv4 · 20 bytes");
      const ttl = this.getTtl(packetRow, wire);
      const dontFragment = wire.tcp
        ? true
        : (wire.df ??
          (!isClientAddress(packetRow.src) &&
            !!wire.udp &&
            packetRow.src !== ENCODING_DNS_IP &&
            packetRow.src !== ENCODING_ROUTER_LAN_IP));
      const identification =
        wire.natOf !== undefined
          ? this.frames[packetIndex + wire.natOf].ipId
          : this.nextIpIdentification(packetRow.src);
      const ttlExplanation = isClientAddress(packetRow.src)
        ? `Windows starts at 128.${ttl !== 128 ? ` Set to ${ttl} on purpose here.` : ""}`
        : isLocalNetworkAddress(packetRow.dst) &&
            !isLocalNetworkAddress(packetRow.src)
          ? `Started at ${getInitialTtl(packetRow.src)}; ${getExampleHopCount(packetRow.src)} router${getExampleHopCount(packetRow.src) === 1 ? "" : "s"} on the way each took 1.`
          : `As sent: this system starts at ${getInitialTtl(packetRow.src)}.`;
      ipv4.summary = `${packetRow.src} → ${packetRow.dst}`;
      ipv4.field("Version, header length", "4, 20 bytes", () => ipv4.u8(69), {
        note: "IPv4, with no options.",
      });
      ipv4.field("DSCP, ECN", "0, 0", () => ipv4.u8(0), {
        note: "Priority and congestion marks; 0 means ordinary traffic.",
      });
      ipv4.field(
        "Total length",
        `${totalLength} bytes`,
        () => ipv4.u16(totalLength),
        {
          note: "This header and everything inside it.",
        },
      );
      ipv4.field(
        "Identification",
        formatHexValue(identification),
        () => ipv4.u16(identification),
        {
          note: "Lets the receiver reassemble the pieces if the packet gets split.",
          example: true,
        },
      );
      ipv4.field(
        "Flags",
        dontFragment ? "DF (don’t fragment)" : "none",
        () => ipv4.u16(dontFragment ? 16384 : 0),
        {
          note: dontFragment
            ? "Routers must not split it; if it’s too big they report back instead."
            : "Routers may split it if a link is too small.",
          example: !wire.tcp,
        },
      );
      ipv4.field("Time to live", ttl, () => ipv4.u8(ttl), {
        note: ttlExplanation,
        example: packetRow.src === ENCODING_ISP_IP,
      });
      ipv4.field(
        "Protocol",
        protocolNumber === 6
          ? "6 (TCP)"
          : protocolNumber === 17
            ? "17 (UDP)"
            : "1 (ICMP)",
        () => ipv4.u8(protocolNumber),
      );
      const checksumOffset = ipv4.length;
      ipv4.field("Header checksum", "", () => ipv4.u16(0), {
        note: "Covers this header only; every router recomputes it after lowering the TTL.",
      });
      ipv4.field("Source", packetRow.src, () =>
        ipv4.raw(ipv4ToBytes(packetRow.src)),
      );
      ipv4.field("Destination", packetRow.dst, () =>
        ipv4.raw(ipv4ToBytes(packetRow.dst)),
      );
      const headerChecksum = internetChecksum(ipv4.bytes);
      ipv4.bytes[checksumOffset] = headerChecksum >> 8;
      ipv4.bytes[checksumOffset + 1] = headerChecksum & 255;
      ipv4.fields.find((field) => field.name === "Header checksum").value =
        formatHexValue(headerChecksum);
      layers.push(ipv4, ...transportLayers);
      ipIdentification = identification;
    }
    const encodedFrame = combinePacketLayers(layers);
    const ipLength = wire.arp ? undefined : encodedFrame.bytes.length - 14;
    if (encodedFrame.bytes.length < 60) {
      const padding = new PacketLayerBuilder(
        "pad",
        `Ethernet padding · ${60 - encodedFrame.bytes.length} bytes`,
      );
      const paddingLength = 60 - encodedFrame.bytes.length;
      padding.field(
        "Padding",
        `${paddingLength} zero bytes`,
        () => padding.raw(Array(paddingLength).fill(0)),
        {
          note: "Ethernet frames are at least 60 bytes (64 with the checksum the card adds), so short ones are padded.",
        },
      );
      const encodedPadding = combinePacketLayers([padding]);
      encodedFrame.layers.push({
        ...encodedPadding.layers[0],
        from: encodedFrame.bytes.length,
        to: 60,
      });
      for (const field of encodedPadding.fields)
        encodedFrame.fields.push({
          ...field,
          from: field.from + encodedFrame.bytes.length,
          to: field.to + encodedFrame.bytes.length,
        });
      encodedFrame.bytes.push(...encodedPadding.bytes);
    }
    const result = {
      index: packetIndex,
      at: link.at,
      ...encodedFrame,
      ipLength,
      ipId: ipIdentification,
      segments: segmentCount,
      tcp: tcpSegment && {
        seq: tcpSegment.seq,
        ack: tcpSegment.ack,
        hlen: tcpSegment.hlen,
        mss: tcpSegment.mss,
      },
      messageLength: (() => {
        const messageLayer = layers.find((layer) => layer.full !== undefined);
        return messageLayer ? messageLayer.full : null;
      })(),
    };
    this.frames[packetIndex] = result;
    return result;
  }
}
const encodedLessonCache = new WeakMap();
/** Cache by lesson identity; each new lesson is encoded with fresh connection state. */
function getEncodedLessonPackets(lesson) {
  if (!encodedLessonCache.has(lesson)) {
    const encoder = new LessonPacketEncoder(lesson);
    const packets = getLessonPackets(lesson);
    encodedLessonCache.set(
      lesson,
      packets.map((packet, index) =>
        encoder.encodeFrame(packet, index, packets),
      ),
    );
  }
  return encodedLessonCache.get(lesson);
}
export { getEncodedLessonPackets, getLessonPackets };
