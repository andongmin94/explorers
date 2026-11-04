// Reconstructed from the distributed Protocol Explorer JavaScript.
import {
  CLIENT_IP,
  TCP_MSS,
  formatPacketTime,
  packetEvent,
  tcpConnection,
  tcpFrameBytes,
  tcpHandshakeEvents,
  tcpWire,
  textLinesBytes,
} from "./helpers.js";
const FTP_SERVER_IP = "203.0.113.21";
const FTP_FILE_BYTES = 4e3;
const FTP_PASSIVE_PORT = 195 * 256 + 149;
const FTP_CONTROL_CONNECTION = tcpConnection(
  CLIENT_IP,
  52800,
  FTP_SERVER_IP,
  21,
);
const FTP_DATA_CONNECTION = tcpConnection(
  CLIENT_IP,
  52801,
  FTP_SERVER_IP,
  FTP_PASSIVE_PORT,
);
const ftpPacketRow = (e, t, s, a, n) => ({
  time: formatPacketTime(e),
  src: t,
  dst: s,
  proto: "FTP",
  info: a,
  len: `${tcpFrameBytes(textLinesBytes(n))} B`,
  wire: tcpWire(FTP_CONTROL_CONNECTION, t, "PA", {
    text: [n],
    name: "FTP",
  }),
});
const ftpCommandEvent = (e, t) =>
  packetEvent(
    "client",
    "web",
    "amber",
    t.split(" ")[0],
    [t],
    ftpPacketRow(e, CLIENT_IP, FTP_SERVER_IP, t, t),
  );
const ftpReplyEvent = (e, t, s, a) =>
  packetEvent(
    "web",
    "client",
    "violet",
    t,
    s,
    ftpPacketRow(e, FTP_SERVER_IP, CLIENT_IP, a, a),
  );
const FTP_DATA_SEGMENT_SIZES = [];
for (let e = FTP_FILE_BYTES; e > 0; e -= TCP_MSS)
  FTP_DATA_SEGMENT_SIZES.push(Math.min(TCP_MSS, e));
const ftpDataRow = (e, t) => {
  const s = 1 + t * TCP_MSS;
  return {
    time: formatPacketTime(0.225),
    src: FTP_SERVER_IP,
    dst: CLIENT_IP,
    proto: "FTP-DATA",
    info: `FTP Data: ${e} bytes (Seq=${s})`,
    len: `${tcpFrameBytes(e)} B`,
    wire: tcpWire(
      FTP_DATA_CONNECTION,
      FTP_SERVER_IP,
      t === FTP_DATA_SEGMENT_SIZES.length - 1 ? "PA" : "A",
      {
        opaque: e,
        what: `report.pdf, bytes ${s}–${s + e - 1}`,
        name: "FTP data",
        note: "The file itself, unencrypted: anyone on the path could read it.",
      },
    ),
  };
};
const ftpLesson = {
  id: "ftp",
  name: "FTP",
  title: "Transferring Files",
  layer: 7,
  nodes: ["client", "router", "internet", "web"],
  latency: {
    "client-web": 0.015,
  },
  labels: {
    web: ["ftp.example.com", FTP_SERVER_IP],
  },
  legend: [
    ["green", "TCP"],
    ["amber", "FTP command"],
    ["violet", "FTP reply"],
    ["blue", "File data"],
    [null, "Data ACKs not shown"],
  ],
  overview: {
    full: "File Transfer Protocol",
    description:
      "FTP moves files between a client and a server. It is unusual in using two TCP connections: one for commands and replies, and a fresh one for each file or listing. It dates from the early 1970s and sends everything, passwords included, as plain text.",
    facts: [
      ["Layer", "Application (Layer 7)"],
      ["Ports", "21 control, data varies"],
      ["Connections", "Control + one per transfer"],
      ["Encryption", "None (plain text)"],
      ["Safer options", "SFTP, or FTPS (FTP + TLS)"],
      ["Defined In", "RFC 959"],
    ],
  },
  outro: {
    title: "File downloaded",
    desc: "Two connections, no encryption",
    text: "Commands went over the control connection, the file over its own data connection, and closing that connection marked the end of the file. Anyone on the path could have read the password and the file, which is why SFTP or FTPS is used today.",
    facts: [
      ["Connections", "2 (control + data)"],
      [
        "File",
        `${FTP_FILE_BYTES.toLocaleString("en-US")} bytes, ${FTP_DATA_SEGMENT_SIZES.length} segments`,
      ],
      ["Password", "Sent in plain text"],
      ["Use instead", "SFTP or FTPS"],
    ],
  },
  start: {
    nodes: ["client"],
    frame: "client",
  },
  steps: [
    {
      title: "Control Connection",
      desc: "Port 21, plain text",
      detail:
        "The FTP app opens a TCP connection to ftp.example.com on port 21. This control connection carries commands and replies for the whole session. The server greets with 220. Like SMTP, every reply starts with a three-digit code.",
      facts: [
        ["Server", "ftp.example.com:21"],
        ["Greeting", "220 (vsFTPd 3.0.5)"],
        ["Encrypted", "No"],
      ],
      events: [
        {
          type: "show",
          nodes: ["router", "internet", "web"],
          frame: "path",
        },
        ...tcpHandshakeEvents({
          dst: FTP_SERVER_IP,
          sport: 52800,
          dport: 21,
          t: [0, 0.015, 0.03],
        }),
        ftpReplyEvent(
          0.045,
          "220",
          ["220 (vsFTPd 3.0.5)"],
          "220 (vsFTPd 3.0.5)",
        ),
      ],
    },
    {
      title: "Log In",
      desc: "USER and PASS, readable by anyone",
      detail:
        "The app sends USER, the server asks for the password with 331, and PASS sends it. Nothing is encrypted, so the user name and password cross every network on the way as readable text.",
      facts: [
        ["Commands", "USER alice, PASS secret"],
        ["Result", "230 Login successful."],
        ["Visible to", "Anyone on the path"],
      ],
      events: [
        ftpCommandEvent(0.06, "USER alice"),
        ftpReplyEvent(
          0.075,
          "331",
          ["331 Please specify", "the password."],
          "331 Please specify the password.",
        ),
        ftpCommandEvent(0.09, "PASS secret"),
        {
          type: "note",
          at: "router",
          text: "PASSWORD IN PLAIN TEXT",
          tone: "amber",
        },
        ftpReplyEvent(
          0.105,
          "230",
          ["230 Login successful."],
          "230 Login successful.",
        ),
      ],
    },
    {
      title: "Passive Mode",
      desc: "The server names a data port",
      detail:
        "TYPE I asks for a byte-for-byte binary copy. PASV asks the server to open a port for the data connection. The reply encodes the address and port as six numbers: 195 × 256 + 149 = port 50069. The laptop connects out, which works through NAT.",
      facts: [
        ["Reply", "227 (203,0,113,21,195,149)"],
        ["Data port", "195 × 256 + 149 = 50069"],
        ["Active mode", "Server dials in: NAT blocks"],
      ],
      events: [
        ftpCommandEvent(0.12, "TYPE I"),
        ftpReplyEvent(
          0.135,
          "200",
          ["200 Switching to", "Binary mode."],
          "200 Switching to Binary mode.",
        ),
        ftpCommandEvent(0.15, "PASV"),
        ftpReplyEvent(
          0.165,
          "227",
          ["227 Entering Passive Mode", "(203,0,113,21,195,149)."],
          "227 Entering Passive Mode (203,0,113,21,195,149).",
        ),
      ],
    },
    {
      title: "Data Connection",
      desc: "A second TCP connection",
      detail:
        "The app opens a second TCP connection, to port 50069, and asks for the file on the control connection with RETR. The server answers 150 there and starts sending the file over the new connection.",
      facts: [
        ["Data to", `ftp.example.com:${FTP_PASSIVE_PORT}`],
        ["Command", "RETR report.pdf"],
        ["Reply", "150 Opening BINARY …"],
      ],
      events: [
        ...tcpHandshakeEvents({
          dst: FTP_SERVER_IP,
          sport: 52801,
          dport: FTP_PASSIVE_PORT,
          t: [0.18, 0.195, 0.21],
        }),
        ftpCommandEvent(0.21, "RETR report.pdf"),
        packetEvent(
          "web",
          "client",
          "violet",
          "150",
          ["150 Opening BINARY mode", "data connection …"],
          ftpPacketRow(
            0.225,
            FTP_SERVER_IP,
            CLIENT_IP,
            "150 Opening BINARY mode data connection …",
            `150 Opening BINARY mode data connection for report.pdf (${FTP_FILE_BYTES} bytes).`,
          ),
        ),
      ],
    },
    {
      title: "The File Arrives",
      desc: "Closing the connection ends it",
      detail: `The ${FTP_FILE_BYTES.toLocaleString("en-US")} bytes arrive in ${FTP_DATA_SEGMENT_SIZES.length} TCP segments. FTP sends no length marker in the data itself: the server closes the data connection to mark the end of the file. Once the laptop has acknowledged everything, the server confirms with 226 on the control connection.`,
      facts: [
        ["File", `report.pdf, ${FTP_FILE_BYTES.toLocaleString("en-US")} bytes`],
        ["Segments", FTP_DATA_SEGMENT_SIZES.join(" + ")],
        ["End of file", "Data connection closed"],
      ],
      events: [
        {
          type: "stream",
          from: "web",
          to: "client",
          color: "blue",
          label: `${FTP_DATA_SEGMENT_SIZES.length} SEGMENTS`,
          payload: [
            "report.pdf",
            `${FTP_FILE_BYTES.toLocaleString("en-US")} bytes, readable by anyone`,
          ],
          packets: FTP_DATA_SEGMENT_SIZES.map((e, t) =>
            packetEvent("web", "client", "blue", "DATA", [], ftpDataRow(e, t)),
          ),
        },
        packetEvent(
          "web",
          "client",
          "green",
          "FIN",
          ["end of file:", "data connection closed"],
          {
            time: formatPacketTime(0.225),
            src: FTP_SERVER_IP,
            dst: CLIENT_IP,
            proto: "TCP",
            info: `${FTP_PASSIVE_PORT} → 52801 [FIN, ACK] Seq=${FTP_FILE_BYTES + 1} Ack=1`,
            len: `${tcpFrameBytes(0)} B`,
            wire: tcpWire(FTP_DATA_CONNECTION, FTP_SERVER_IP, "FA"),
          },
        ),
        ftpReplyEvent(
          0.255,
          "226",
          ["226 Transfer complete."],
          "226 Transfer complete.",
        ),
      ],
    },
    {
      title: "Quit",
      desc: "Close the control connection",
      detail:
        "QUIT ends the session and the server says goodbye with 221. For anything sensitive, SFTP (a different protocol, run over SSH) or FTPS (FTP inside TLS) gives the same job encryption.",
      facts: [
        ["Command", "QUIT"],
        ["Reply", "221 Goodbye."],
        ["Encrypted cousins", "SFTP, FTPS"],
      ],
      events: [
        ftpCommandEvent(0.27, "QUIT"),
        ftpReplyEvent(0.285, "221", ["221 Goodbye."], "221 Goodbye."),
      ],
    },
  ],
};
export { ftpLesson };
