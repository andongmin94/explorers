// Reconstructed from the distributed Protocol Explorer JavaScript.
import {
  CLIENT_IP,
  ETHERNET_HEADER_BYTES,
  IPV4_HEADER_BYTES,
  TCP_HEADER_BYTES,
  formatFrameSize,
  formatPacketTime,
  packetEvent,
  tcpConnection,
  tcpHandshakeEvents,
  tcpSegmentCount,
  tcpWire,
  textLinesBytes,
} from "./helpers.js";
const SSH_SERVER_IP = "203.0.113.22";
const SSH_ENCRYPTED_EVENT = {
  locked: true,
};
// SSH padding must contain at least four bytes and align the packet to eight bytes.
const sshPaddingBytes = (packetBytes) => {
  let paddingBytes = 8 - (packetBytes % 8);
  if (paddingBytes < 4) {
    paddingBytes += 8;
  }
  return paddingBytes;
};
const sshPlainPacketBytes = (payloadBytes) =>
  5 + payloadBytes + sshPaddingBytes(5 + payloadBytes);
const sshEncryptedPacketBytes = (payloadBytes) =>
  5 + payloadBytes + sshPaddingBytes(1 + payloadBytes) + 16;
const sshStringBytes = (value) =>
  4 + (typeof value == "number" ? value : value.length);
const sshNameListBytes = (names) => sshStringBytes(names.join(","));
const sshFrameBytes = (packetBytes) =>
  packetBytes +
  tcpSegmentCount(packetBytes) *
    (ETHERNET_HEADER_BYTES + IPV4_HEADER_BYTES + TCP_HEADER_BYTES);
const SSH_KEY_EXCHANGE_ALGORITHMS = [
  "sntrup761x25519-sha512@openssh.com",
  "curve25519-sha256",
  "curve25519-sha256@libssh.org",
  "ecdh-sha2-nistp256",
  "ecdh-sha2-nistp384",
  "ecdh-sha2-nistp521",
  "diffie-hellman-group-exchange-sha256",
  "diffie-hellman-group16-sha512",
  "diffie-hellman-group18-sha512",
  "diffie-hellman-group14-sha256",
];
const SSH_CLIENT_HOST_KEY_ALGORITHMS = [
  "ssh-ed25519-cert-v01@openssh.com",
  "ecdsa-sha2-nistp256-cert-v01@openssh.com",
  "ecdsa-sha2-nistp384-cert-v01@openssh.com",
  "ecdsa-sha2-nistp521-cert-v01@openssh.com",
  "sk-ssh-ed25519-cert-v01@openssh.com",
  "sk-ecdsa-sha2-nistp256-cert-v01@openssh.com",
  "rsa-sha2-512-cert-v01@openssh.com",
  "rsa-sha2-256-cert-v01@openssh.com",
  "ssh-ed25519",
  "ecdsa-sha2-nistp256",
  "ecdsa-sha2-nistp384",
  "ecdsa-sha2-nistp521",
  "sk-ssh-ed25519@openssh.com",
  "sk-ecdsa-sha2-nistp256@openssh.com",
  "rsa-sha2-512",
  "rsa-sha2-256",
];
const SSH_SERVER_HOST_KEY_ALGORITHMS = [
  "rsa-sha2-512",
  "rsa-sha2-256",
  "ecdsa-sha2-nistp256",
  "ssh-ed25519",
];
const SSH_CIPHERS = [
  "chacha20-poly1305@openssh.com",
  "aes128-ctr",
  "aes192-ctr",
  "aes256-ctr",
  "aes128-gcm@openssh.com",
  "aes256-gcm@openssh.com",
];
const SSH_MAC_ALGORITHMS = [
  "umac-64-etm@openssh.com",
  "umac-128-etm@openssh.com",
  "hmac-sha2-256-etm@openssh.com",
  "hmac-sha2-512-etm@openssh.com",
  "hmac-sha1-etm@openssh.com",
  "umac-64@openssh.com",
  "umac-128@openssh.com",
  "hmac-sha2-256",
  "hmac-sha2-512",
  "hmac-sha1",
];
const SSH_COMPRESSION_ALGORITHMS = ["none", "zlib@openssh.com"];
const sshKexInitBytes = (keyExchanges, hostKeyAlgorithms) =>
  sshPlainPacketBytes(
    17 +
      sshNameListBytes(keyExchanges) +
      sshNameListBytes(hostKeyAlgorithms) +
      2 * sshNameListBytes(SSH_CIPHERS) +
      2 * sshNameListBytes(SSH_MAC_ALGORITHMS) +
      2 * sshNameListBytes(SSH_COMPRESSION_ALGORITHMS) +
      2 * sshNameListBytes([]) +
      1 +
      4,
  );
const SSH_CLIENT_KEXINIT_BYTES = sshKexInitBytes(
  [
    ...SSH_KEY_EXCHANGE_ALGORITHMS,
    "ext-info-c",
    "kex-strict-c-v00@openssh.com",
  ],
  SSH_CLIENT_HOST_KEY_ALGORITHMS,
);
const SSH_SERVER_KEXINIT_BYTES = sshKexInitBytes(
  [
    ...SSH_KEY_EXCHANGE_ALGORITHMS,
    "ext-info-s",
    "kex-strict-s-v00@openssh.com",
  ],
  SSH_SERVER_HOST_KEY_ALGORITHMS,
);
const SSH_HOST_KEY_BYTES = sshStringBytes("ssh-ed25519") + sshStringBytes(32);
const SSH_SIGNATURE_BYTES = sshStringBytes("ssh-ed25519") + sshStringBytes(64);
const SSH_KEX_INIT_BYTES = sshPlainPacketBytes(1 + sshStringBytes(1190));
const SSH_KEX_REPLY_BYTES = sshPlainPacketBytes(
  1 +
    sshStringBytes(SSH_HOST_KEY_BYTES) +
    sshStringBytes(1071) +
    sshStringBytes(SSH_SIGNATURE_BYTES),
);
const SSH_NEWKEYS_BYTES = sshPlainPacketBytes(1);
const SSH_USER_SERVICE_BYTES =
  sshStringBytes("alice") + sshStringBytes("ssh-connection");
const SSH_SERVICE_REQUEST_BYTES = sshEncryptedPacketBytes(
  1 + sshStringBytes("ssh-userauth"),
);
const SSH_AUTH_NONE_BYTES = sshEncryptedPacketBytes(
  1 + SSH_USER_SERVICE_BYTES + sshStringBytes("none"),
);
const SSH_AUTH_FAILURE_BYTES = sshEncryptedPacketBytes(
  1 + sshStringBytes("publickey,password") + 1,
);
const SSH_PUBLIC_KEY_OFFER_BYTES = sshEncryptedPacketBytes(
  1 +
    SSH_USER_SERVICE_BYTES +
    sshStringBytes("publickey") +
    1 +
    sshStringBytes("ssh-ed25519") +
    sshStringBytes(SSH_HOST_KEY_BYTES),
);
const SSH_PUBLIC_KEY_ACCEPT_BYTES = sshEncryptedPacketBytes(
  1 + sshStringBytes("ssh-ed25519") + sshStringBytes(SSH_HOST_KEY_BYTES),
);
const SSH_SIGNED_AUTH_BYTES = sshEncryptedPacketBytes(
  1 +
    SSH_USER_SERVICE_BYTES +
    sshStringBytes("publickey-hostbound-v00@openssh.com") +
    1 +
    sshStringBytes("ssh-ed25519") +
    sshStringBytes(SSH_HOST_KEY_BYTES) +
    sshStringBytes(SSH_HOST_KEY_BYTES) +
    sshStringBytes(SSH_SIGNATURE_BYTES),
);
const SSH_AUTH_SUCCESS_BYTES = sshEncryptedPacketBytes(1);
const SSH_CHANNEL_OPEN_BYTES = sshEncryptedPacketBytes(
  1 + sshStringBytes("session") + 4 + 4 + 4,
);
const SSH_CHANNEL_CONFIRMATION_BYTES = sshEncryptedPacketBytes(17);
const sshChannelDataBytes = (data) =>
  sshEncryptedPacketBytes(5 + sshStringBytes(data));
const SSH_KEYSTROKE_BYTES = sshChannelDataBytes(1);
const SSH_SHELL_PROMPT =
  "\x1B]0;alice@server: ~\x07\x1B[01;32malice@server\x1B[00m:\x1B[01;34m~\x1B[00m$ ";
const SSH_COMMAND_OUTPUT =
  `\r
\x1B[?2004l\r/home/alice\r
\x1B[?2004h` + SSH_SHELL_PROMPT;
const SSH_COMMAND_OUTPUT_BYTES = sshChannelDataBytes(SSH_COMMAND_OUTPUT.length);
const SSH_CONNECTION = tcpConnection(CLIENT_IP, 53210, SSH_SERVER_IP, 22);
const sshPacketRow = (
  seconds,
  sourceIp,
  destinationIp,
  info,
  packetBytes,
  wire,
) => ({
  time: formatPacketTime(seconds),
  src: sourceIp,
  dst: destinationIp,
  proto: "SSH",
  info,
  len: formatFrameSize(
    sshFrameBytes(packetBytes),
    tcpSegmentCount(packetBytes),
  ),
  wire: tcpWire(SSH_CONNECTION, sourceIp, "PA", wire),
});
const sshEncryptedRow = (
  seconds,
  sourceIp,
  destinationIp,
  info,
  packetBytes,
  description,
) =>
  sshPacketRow(
    seconds,
    sourceIp,
    destinationIp,
    `Encrypted (len=${packetBytes}): ${info}`,
    packetBytes,
    {
      ssh: {
        sealed: packetBytes,
        inside: description,
      },
    },
  );
const sshClientEvent = (
  seconds,
  label,
  payload,
  info,
  packetBytes,
  options,
  description,
) =>
  packetEvent(
    "client",
    "web",
    "amber",
    label,
    payload,
    sshEncryptedRow(
      seconds,
      CLIENT_IP,
      SSH_SERVER_IP,
      info,
      packetBytes,
      description,
    ),
    {
      ...SSH_ENCRYPTED_EVENT,
      ...options,
    },
  );
const sshServerEvent = (
  seconds,
  label,
  payload,
  info,
  packetBytes,
  options,
  description,
) =>
  packetEvent(
    "web",
    "client",
    "violet",
    label,
    payload,
    sshEncryptedRow(
      seconds,
      SSH_SERVER_IP,
      CLIENT_IP,
      info,
      packetBytes,
      description,
    ),
    {
      ...SSH_ENCRYPTED_EVENT,
      ...options,
    },
  );
const sshVersionWire = (version) => ({
  text: [version],
  name: "SSH",
});
const sshKexInitWire = (keyExchanges, hostKeyAlgorithms) => ({
  ssh: {
    msg: "kexinit",
    kex: keyExchanges,
    hostkeys: hostKeyAlgorithms,
    ciphers: SSH_CIPHERS,
    macs: SSH_MAC_ALGORITHMS,
    compression: SSH_COMPRESSION_ALGORITHMS,
  },
});
const SSH_CHANNEL_DATA_DESCRIPTION = "SSH_MSG_CHANNEL_DATA (94), channel 0:";
const SSH_QUICK_EVENT = {
  quick: true,
};
const sshLesson = {
  id: "ssh",
  name: "SSH",
  title: "Secure Remote Login",
  layer: 7,
  nodes: ["client", "router", "internet", "web"],
  latency: {
    "client-web": 0.015,
  },
  labels: {
    web: ["server.example.com", SSH_SERVER_IP],
  },
  legend: [
    ["green", "TCP"],
    ["slate", "Plain setup"],
    ["teal", "Key exchange"],
    ["amber", "From laptop"],
    ["violet", "From server"],
    [null, "Some packets not shown"],
  ],
  overview: {
    full: "Secure Shell",
    description:
      "SSH gives you an encrypted, authenticated connection to another computer, to run commands on it, copy files (SFTP, scp) or carry other connections. The server proves who it is with a host key; you prove who you are with a key pair or a password.",
    facts: [
      ["Layer", "Application (Layer 7)"],
      ["Port", "22"],
      ["Transport", "TCP"],
      ["Server proves", "Host key (known_hosts)"],
      ["You prove", "Key pair or password"],
      ["Defined In", "RFC 4251 – 4254"],
    ],
  },
  outro: {
    title: "Logged in securely",
    desc: "Encrypted from the key exchange on",
    text: "The two sides agreed on algorithms, built shared keys with a post-quantum hybrid exchange, and the server proved its identity with its host key. Alice proved hers by signing with a private key that never left the laptop, then typed a command, one packet per key.",
    facts: [
      ["Key exchange", "sntrup761 + X25519"],
      ["Cipher", "ChaCha20-Poly1305"],
      ["Login", "Ed25519 key, no password"],
      ["Port", "22"],
    ],
  },
  start: {
    nodes: ["client"],
    frame: "client",
  },
  steps: [
    {
      title: "Say Hello",
      desc: "Versions, in plain text",
      detail:
        "Alice runs “ssh alice@server.example.com”. After the TCP handshake on port 22, each side sends one line of plain text naming the SSH protocol version (2.0) and its software. Everything else in SSH is binary.",
      facts: [
        ["Laptop", "OpenSSH_for_Windows_9.5"],
        ["Server", "OpenSSH_9.6p1 Ubuntu"],
        ["Protocol", "SSH-2.0"],
      ],
      events: [
        {
          type: "show",
          nodes: ["router", "internet", "web"],
          frame: "path",
        },
        ...tcpHandshakeEvents({
          dst: SSH_SERVER_IP,
          sport: 53210,
          dport: 22,
          t: [0, 0.015, 0.03],
        }),
        packetEvent(
          "client",
          "web",
          "slate",
          "VERSION",
          ["SSH-2.0-", "OpenSSH_for_Windows_9.5"],
          sshPacketRow(
            0.03,
            CLIENT_IP,
            SSH_SERVER_IP,
            "Client: SSH-2.0-OpenSSH_for_Windows_9.5",
            textLinesBytes("SSH-2.0-OpenSSH_for_Windows_9.5"),
            sshVersionWire("SSH-2.0-OpenSSH_for_Windows_9.5"),
          ),
        ),
        packetEvent(
          "web",
          "client",
          "slate",
          "VERSION",
          ["SSH-2.0-OpenSSH_9.6p1", "Ubuntu-3ubuntu13.5"],
          sshPacketRow(
            0.045,
            SSH_SERVER_IP,
            CLIENT_IP,
            "Server: SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.5",
            textLinesBytes("SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.5"),
            sshVersionWire("SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.5"),
          ),
        ),
      ],
    },
    {
      title: "Agree on Algorithms",
      desc: "KEXINIT lists, first match wins",
      detail:
        "Each side sends a KEXINIT listing every algorithm it supports, in order of preference, for key exchange, host keys, encryption, integrity and compression. In each category the first algorithm on the laptop’s list that the server also supports is chosen.",
      facts: [
        ["Key exchange", "sntrup761x25519-sha512"],
        ["Host key", "ssh-ed25519"],
        ["Cipher", "chacha20-poly1305"],
      ],
      events: [
        packetEvent(
          "web",
          "client",
          "slate",
          "KEXINIT",
          ["server’s algorithm lists", "in order of preference"],
          sshPacketRow(
            0.045,
            SSH_SERVER_IP,
            CLIENT_IP,
            "Server: Key Exchange Init",
            SSH_SERVER_KEXINIT_BYTES,
            sshKexInitWire(
              [
                ...SSH_KEY_EXCHANGE_ALGORITHMS,
                "ext-info-s",
                "kex-strict-s-v00@openssh.com",
              ],
              SSH_SERVER_HOST_KEY_ALGORITHMS,
            ),
          ),
        ),
        packetEvent(
          "client",
          "web",
          "slate",
          "KEXINIT",
          ["laptop’s algorithm lists", "in order of preference"],
          sshPacketRow(
            0.06,
            CLIENT_IP,
            SSH_SERVER_IP,
            `Client: Key Exchange Init, ${tcpSegmentCount(SSH_CLIENT_KEXINIT_BYTES)} segments`,
            SSH_CLIENT_KEXINIT_BYTES,
            sshKexInitWire(
              [
                ...SSH_KEY_EXCHANGE_ALGORITHMS,
                "ext-info-c",
                "kex-strict-c-v00@openssh.com",
              ],
              SSH_CLIENT_HOST_KEY_ALGORITHMS,
            ),
          ),
        ),
      ],
    },
    {
      title: "Key Exchange",
      desc: "Shared keys, and a host key check",
      detail:
        "The laptop sends its half of a hybrid exchange: a Streamlined NTRU Prime key, chosen to resist future quantum computers, plus an X25519 key. The server answers with its half, its host key and a signature over the exchange. NEWKEYS switches encryption on.",
      facts: [
        ["Hybrid", "sntrup761 + X25519"],
        ["Host key", "Matches known_hosts"],
        ["First visit", "ssh asks you to confirm"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "teal",
          "KEX INIT",
          ["sntrup761 + X25519", "public keys"],
          sshPacketRow(
            0.06,
            CLIENT_IP,
            SSH_SERVER_IP,
            "Client: KEX_ECDH_INIT (sntrup761x25519 public keys)",
            SSH_KEX_INIT_BYTES,
            {
              ssh: {
                msg: "ecdh_init",
                q: 1190,
              },
            },
          ),
        ),
        packetEvent(
          "web",
          "client",
          "teal",
          "KEX REPLY",
          ["its half, its host key", "and a signature"],
          sshPacketRow(
            0.075,
            SSH_SERVER_IP,
            CLIENT_IP,
            "Server: KEX_ECDH_REPLY (host key, its half, signature)",
            SSH_KEX_REPLY_BYTES,
            {
              ssh: {
                msg: "ecdh_reply",
                ks: SSH_HOST_KEY_BYTES,
                q: 1071,
                sig: SSH_SIGNATURE_BYTES,
              },
            },
          ),
        ),
        packetEvent(
          "web",
          "client",
          "teal",
          "NEWKEYS",
          [],
          sshPacketRow(
            0.075,
            SSH_SERVER_IP,
            CLIENT_IP,
            "Server: New Keys",
            SSH_NEWKEYS_BYTES,
            {
              ssh: {
                msg: "newkeys",
              },
            },
          ),
          SSH_QUICK_EVENT,
        ),
        {
          type: "note",
          at: "client",
          text: "HOST KEY MATCHES KNOWN_HOSTS",
          tone: "green",
        },
        packetEvent(
          "client",
          "web",
          "teal",
          "NEWKEYS",
          [],
          sshPacketRow(
            0.09,
            CLIENT_IP,
            SSH_SERVER_IP,
            "Client: New Keys",
            SSH_NEWKEYS_BYTES,
            {
              ssh: {
                msg: "newkeys",
              },
            },
          ),
          SSH_QUICK_EVENT,
        ),
      ],
    },
    {
      title: "Log In with a Key",
      desc: "Sign, don’t send a secret",
      detail:
        "The server lists the login methods it accepts. The laptop offers Alice’s public key, and the server says it would accept it. The laptop then signs this session with the private key, which never leaves the laptop. The server checks the signature against authorized_keys.",
      facts: [
        ["Methods", "publickey, password"],
        ["Key", "Ed25519, private stays here"],
        ["Checked with", "~/.ssh/authorized_keys"],
      ],
      events: [
        sshClientEvent(
          0.09,
          "SERVICE REQUEST",
          [],
          "service request, ssh-userauth",
          SSH_SERVICE_REQUEST_BYTES,
          SSH_QUICK_EVENT,
          "SSH_MSG_SERVICE_REQUEST (5): “ssh-userauth”",
        ),
        sshServerEvent(
          0.105,
          "SERVICE ACCEPT",
          [],
          "service accept",
          SSH_SERVICE_REQUEST_BYTES,
          SSH_QUICK_EVENT,
          "SSH_MSG_SERVICE_ACCEPT (6): “ssh-userauth”",
        ),
        sshClientEvent(
          0.12,
          "AUTH: NONE",
          [],
          "login with method none",
          SSH_AUTH_NONE_BYTES,
          SSH_QUICK_EVENT,
          "SSH_MSG_USERAUTH_REQUEST (50): user “alice”, service “ssh-connection”, method “none”",
        ),
        sshServerEvent(
          0.135,
          "AUTH FAILURE",
          [],
          "try publickey,password",
          SSH_AUTH_FAILURE_BYTES,
          SSH_QUICK_EVENT,
          "SSH_MSG_USERAUTH_FAILURE (51): methods that can continue: “publickey,password”",
        ),
        sshClientEvent(
          0.15,
          "OFFER KEY",
          ["alice’s public key", "would you accept it?"],
          "offer public key",
          SSH_PUBLIC_KEY_OFFER_BYTES,
          {},
          "SSH_MSG_USERAUTH_REQUEST (50): method “publickey”, no signature, the ssh-ed25519 public key",
        ),
        sshServerEvent(
          0.165,
          "PK OK",
          ["yes, that key", "is in authorized_keys"],
          "public key OK",
          SSH_PUBLIC_KEY_ACCEPT_BYTES,
          {},
          "SSH_MSG_USERAUTH_PK_OK (60): the same ssh-ed25519 key",
        ),
        sshClientEvent(
          0.18,
          "SIGNED",
          ["same key, plus a signature", "made with the private key"],
          "public key + signature",
          SSH_SIGNED_AUTH_BYTES,
          {},
          "SSH_MSG_USERAUTH_REQUEST (50): method “publickey-hostbound-v00@openssh.com”, the key, the server’s host key and a signature",
        ),
        sshServerEvent(
          0.195,
          "SUCCESS",
          ["logged in"],
          "login success",
          SSH_AUTH_SUCCESS_BYTES,
          {},
          "SSH_MSG_USERAUTH_SUCCESS (52)",
        ),
      ],
    },
    {
      title: "Open a Session",
      desc: "Channels inside one connection",
      detail:
        "One SSH connection can carry many channels: a shell, file transfers, forwarded ports. The laptop opens a session channel, then asks for a terminal and a shell (not shown), and the server sends its welcome text and a prompt.",
      facts: [
        ["Channel", "session"],
        ["Then asks for", "A terminal and a shell"],
        ["Also possible", "SFTP, port forwarding"],
      ],
      events: [
        sshClientEvent(
          0.21,
          "CHANNEL OPEN",
          ["open a channel:", "session"],
          "channel open: session",
          SSH_CHANNEL_OPEN_BYTES,
          {},
          "SSH_MSG_CHANNEL_OPEN (90): “session”, channel 0, window 2 MB, packets up to 32 KB",
        ),
        sshServerEvent(
          0.225,
          "CONFIRMED",
          ["channel open"],
          "channel open confirmed",
          SSH_CHANNEL_CONFIRMATION_BYTES,
          {},
          "SSH_MSG_CHANNEL_OPEN_CONFIRMATION (91): channel 0 is open",
        ),
      ],
    },
    {
      title: "Type a Command",
      desc: "Every key is a packet",
      detail:
        "Alice types pwd. Each key goes out at once in its own encrypted packet, and the server sends the character back to be shown (the echo). Since 9.5, OpenSSH sends keys on a 20 ms beat and adds decoy packets, so typing rhythm is harder to read from the timing.",
      facts: [
        ["Per key", `1 packet, ${sshFrameBytes(SSH_KEYSTROKE_BYTES)} bytes`],
        ["Echo", "Sent back by the server"],
        ["Timing", "20 ms beat plus decoys"],
      ],
      events: [
        sshClientEvent(
          2,
          "“p”",
          [],
          "keystroke",
          SSH_KEYSTROKE_BYTES,
          SSH_QUICK_EVENT,
          `${SSH_CHANNEL_DATA_DESCRIPTION} 1 byte, “p”`,
        ),
        sshServerEvent(
          2.015,
          "ECHO",
          [],
          "echo",
          SSH_KEYSTROKE_BYTES,
          SSH_QUICK_EVENT,
          `${SSH_CHANNEL_DATA_DESCRIPTION} 1 byte, “p”, sent back to be shown`,
        ),
        sshClientEvent(
          2.14,
          "“w”",
          [],
          "keystroke",
          SSH_KEYSTROKE_BYTES,
          SSH_QUICK_EVENT,
          `${SSH_CHANNEL_DATA_DESCRIPTION} 1 byte, “w”`,
        ),
        sshServerEvent(
          2.155,
          "ECHO",
          [],
          "echo",
          SSH_KEYSTROKE_BYTES,
          SSH_QUICK_EVENT,
          `${SSH_CHANNEL_DATA_DESCRIPTION} 1 byte, “w”, sent back to be shown`,
        ),
        sshClientEvent(
          2.26,
          "“d”",
          [],
          "keystroke",
          SSH_KEYSTROKE_BYTES,
          SSH_QUICK_EVENT,
          `${SSH_CHANNEL_DATA_DESCRIPTION} 1 byte, “d”`,
        ),
        sshServerEvent(
          2.275,
          "ECHO",
          [],
          "echo",
          SSH_KEYSTROKE_BYTES,
          SSH_QUICK_EVENT,
          `${SSH_CHANNEL_DATA_DESCRIPTION} 1 byte, “d”, sent back to be shown`,
        ),
        sshClientEvent(
          2.42,
          "ENTER",
          ["Enter key"],
          "keystroke (Enter)",
          SSH_KEYSTROKE_BYTES,
          {},
          `${SSH_CHANNEL_DATA_DESCRIPTION} 1 byte, a carriage return (Enter)`,
        ),
        sshServerEvent(
          2.435,
          "OUTPUT",
          ["/home/alice", "alice@server:~$"],
          "output and a new prompt",
          SSH_COMMAND_OUTPUT_BYTES,
          {},
          `${SSH_CHANNEL_DATA_DESCRIPTION} ${SSH_COMMAND_OUTPUT.length} bytes: a new line, the shell’s terminal codes, “/home/alice”, and the coloured prompt`,
        ),
        {
          type: "note",
          at: "client",
          text: "EACH KEY IS ITS OWN PACKET",
          tone: "navy",
        },
      ],
    },
  ],
};
export { sshLesson };
