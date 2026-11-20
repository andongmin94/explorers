// Reconstructed from the distributed Protocol Explorer JavaScript.
import type { Lesson } from "../types.ts";
import { httpLesson } from "./http.ts";
import { httpsLesson } from "./https.ts";
import { tcpLesson } from "./tcp.ts";
import { udpLesson } from "./udp.ts";
import { ipLesson } from "./ip.ts";
import { dnsLesson } from "./dns.ts";
import { dhcpLesson } from "./dhcp.ts";
import { icmpLesson } from "./icmp.ts";
import { smtpLesson } from "./smtp.ts";
import { pop3Lesson } from "./pop3.ts";
import { imapLesson } from "./imap.ts";
import { ftpLesson } from "./ftp.ts";
import { sshLesson } from "./ssh.ts";
import { tlsLesson } from "./tls.ts";
const lessonsById: Record<string, Lesson> = {
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
export interface ProtocolEntry {
  id: string;
  name: string;
  full: string;
  group: "core" | "application" | "security";
}
const protocolCatalog: ProtocolEntry[] = [
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
