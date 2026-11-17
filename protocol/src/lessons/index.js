// Reconstructed from the distributed Protocol Explorer JavaScript.
import { httpLesson } from "./http.js";
import { httpsLesson } from "./https.js";
import { tcpLesson } from "./tcp.js";
import { udpLesson } from "./udp.js";
import { ipLesson } from "./ip.js";
import { dnsLesson } from "./dns.js";
import { dhcpLesson } from "./dhcp.js";
import { icmpLesson } from "./icmp.js";
import { smtpLesson } from "./smtp.js";
import { pop3Lesson } from "./pop3.js";
import { imapLesson } from "./imap.js";
import { ftpLesson } from "./ftp.js";
import { sshLesson } from "./ssh.js";
import { tlsLesson } from "./tls.js";
const lessonsById = {
  http: httpLesson,
  https: httpsLesson,
  tcp: tcpLesson,
  udp: udpLesson,
  ip: ipLesson,
  dns: dnsLesson,
  dhcp: dhcpLesson,
  icmp: icmpLesson,
  smtp: smtpLesson,
  pop3: pop3Lesson,
  imap: imapLesson,
  ftp: ftpLesson,
  ssh: sshLesson,
  tls: tlsLesson,
};
const protocolCatalog = [
  {
    id: "http",
    name: "HTTP",
    full: "Hypertext Transfer Protocol",
    group: "application",
  },
  {
    id: "https",
    name: "HTTPS",
    full: "HTTP Secure",
    group: "security",
  },
  {
    id: "tcp",
    name: "TCP",
    full: "Transmission Control Protocol",
    group: "core",
  },
  {
    id: "udp",
    name: "UDP",
    full: "User Datagram Protocol",
    group: "core",
  },
  {
    id: "ip",
    name: "IP",
    full: "Internet Protocol",
    group: "core",
  },
  {
    id: "dns",
    name: "DNS",
    full: "Domain Name System",
    group: "application",
  },
  {
    id: "dhcp",
    name: "DHCP",
    full: "Dynamic Host Configuration",
    group: "application",
  },
  {
    id: "icmp",
    name: "ICMP",
    full: "Internet Control Message",
    group: "core",
  },
  {
    id: "smtp",
    name: "SMTP",
    full: "Simple Mail Transfer Protocol",
    group: "application",
  },
  {
    id: "pop3",
    name: "POP3",
    full: "Post Office Protocol v3",
    group: "application",
  },
  {
    id: "imap",
    name: "IMAP",
    full: "Internet Message Access",
    group: "application",
  },
  {
    id: "ftp",
    name: "FTP",
    full: "File Transfer Protocol",
    group: "application",
  },
  {
    id: "ssh",
    name: "SSH",
    full: "Secure Shell",
    group: "security",
  },
  {
    id: "tls",
    name: "TLS/SSL",
    full: "Transport Layer Security",
    group: "security",
  },
];
export { lessonsById, protocolCatalog };
