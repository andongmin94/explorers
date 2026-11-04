// Reconstructed from the distributed Protocol Explorer JavaScript.
const DNS_CLIENT_IP = "192.168.1.10";
const DNS_RESOLVER_IP = "8.8.8.8";
const DNS_ROOT_IP = "198.41.0.4";
const DNS_TLD_IP = "192.5.6.30";
const DNS_AUTHORITATIVE_IP = "198.51.100.53";
const dnsPacketEvent = (from, to, color, label, payload, row) => ({
  type: "packet",
  from,
  to,
  color,
  label,
  payload,
  row,
});
const DNS_QUESTION = ["www.example.com", "A"];
const DNS_EDNS_OPTIONS = {
  size: 1232,
};
const DNS_TLD_HOSTNAMES = [
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
].map((serverLetter) => `${serverLetter}.gtld-servers.net`);
const DNS_TLD_IPV4_ADDRESSES = [
  "192.5.6.30",
  "192.33.14.30",
  "192.26.92.30",
  "192.31.80.30",
  "192.12.94.30",
  "192.35.51.30",
  "192.42.93.30",
  "192.54.112.30",
  "192.43.172.30",
  "192.48.79.30",
  "192.52.178.30",
  "192.41.162.30",
  "192.55.83.30",
];
const DNS_TLD_IPV6_ADDRESSES = [
  "2001:503:a83e::2:30",
  "2001:503:231d::2:30",
  "2001:503:83eb::30",
  "2001:500:856e::30",
  "2001:502:1ca1::30",
  "2001:503:d414::30",
  "2001:503:eea3::30",
  "2001:502:8cc::30",
  "2001:503:39c1::30",
  "2001:502:7094::30",
  "2001:503:d2d::30",
  "2001:500:d937::30",
  "2001:501:b1f9::30",
];
const dnsQueryWire = (sourcePort, dnsMessage) => ({
  udp: {
    sport: sourcePort,
    dport: 53,
    data: {
      dns: dnsMessage,
    },
  },
});
const dnsResponseWire = (destinationPort, dnsMessage) => ({
  udp: {
    sport: 53,
    dport: destinationPort,
    data: {
      dns: dnsMessage,
    },
  },
});
const dnsLesson = {
  id: "dns",
  name: "DNS",
  title: "Name Resolution",
  layer: 7,
  nodes: ["client", "router", "internet", "dns", "root", "tld", "auth"],
  latency: {
    "client-dns": 0.012,
    "dns-root": 0.005,
    "dns-tld": 0.01,
    "dns-auth": 0.02,
  },
  legend: [
    ["blue", "Query"],
    ["amber", "Referral"],
    ["green", "Answer"],
    [null, "DNSSEC not requested here"],
  ],
  overview: {
    full: "Domain Name System",
    description:
      "DNS turns names like www.example.com into the IP addresses computers use to reach each other. No single server knows every name: the system is a hierarchy of servers, and answers are cached along the way so most lookups never have to go far.",
    facts: [
      ["Layer", "Application (Layer 7)"],
      ["Port", "53, UDP (TCP if large)"],
      ["Turns", "Names into IP addresses"],
      ["Hierarchy", "Root → TLD → authoritative"],
      ["Caching", "For each record’s TTL"],
      ["Defined In", "RFC 1034, RFC 1035"],
    ],
  },
  outro: {
    title: "Name resolved",
    desc: "And remembered for an hour",
    text: "Starting from an empty cache, the resolver walked from the root to .com to example.com’s own server, then answered the laptop. Until the TTL runs out, the next lookup for this name is answered straight from a cache. Press REPLAY to watch it again.",
    facts: [
      ["Queries", "4 (laptop 1, resolver 3)"],
      ["Total time", "0.094 s"],
      ["Transport", "UDP, port 53"],
      ["Cached for", "3600 s (TTL)"],
    ],
  },
  start: {
    nodes: ["client"],
    frame: "client",
  },
  steps: [
    {
      title: "Ask the Resolver",
      desc: "The laptop hands the question off",
      detail:
        "The browser needs the IP address of www.example.com and neither it nor Windows has one cached. The laptop sends one question to the recursive resolver it was given, 8.8.8.8, and asks it to do the whole lookup (recursion desired).",
      facts: [
        ["Question", "www.example.com, type A"],
        ["Asked", "8.8.8.8 (recursive)"],
        ["Flags", "RD (recursion desired)"],
      ],
      events: [
        {
          type: "type-url",
          text: "www.example.com",
        },
        {
          type: "show",
          nodes: ["router", "internet", "dns"],
          frame: "lookup",
        },
        dnsPacketEvent(
          "client",
          "dns",
          "blue",
          "DNS QUERY",
          ["A? www.example.com", "flags: RD"],
          {
            time: "0.000s",
            src: DNS_CLIENT_IP,
            dst: DNS_RESOLVER_IP,
            proto: "DNS",
            info: "Standard query A www.example.com",
            len: "75 B",
            wire: dnsQueryWire(54871, {
              id: 39486,
              rd: true,
              q: DNS_QUESTION,
            }),
          },
        ),
      ],
    },
    {
      title: "Root Server",
      desc: "Points the way to .com",
      detail:
        "The resolver’s cache is empty (it has just started), so it begins at the top. A root server doesn’t know the address, but it knows which servers handle .com and replies with a referral. Many resolvers send it only “com”, not the full name.",
      facts: [
        ["Server", "a.root-servers.net"],
        ["Root servers", "13 names, 1,000+ anycast sites"],
        ["Reply", "Referral (13 .com servers)"],
      ],
      events: [
        {
          type: "note",
          at: "dns",
          text: "NOT IN CACHE",
          tone: "amber",
        },
        {
          type: "show",
          nodes: ["root"],
          frame: "root",
        },
        dnsPacketEvent(
          "dns",
          "root",
          "blue",
          "DNS QUERY",
          ["A? www.example.com"],
          {
            time: "0.012s",
            src: DNS_RESOLVER_IP,
            dst: DNS_ROOT_IP,
            proto: "DNS",
            info: "Standard query A www.example.com",
            len: "86 B",
            wire: dnsQueryWire(38143, {
              id: 20935,
              q: DNS_QUESTION,
              edns: DNS_EDNS_OPTIONS,
            }),
          },
        ),
        dnsPacketEvent(
          "root",
          "dns",
          "amber",
          "REFERRAL",
          ["no answer: ask .com", "com. NS a.gtld-servers.net …"],
          {
            time: "0.017s",
            src: DNS_ROOT_IP,
            dst: DNS_RESOLVER_IP,
            proto: "DNS",
            info: "Referral: com. NS ×13 (with glue)",
            len: "882 B",
            wire: dnsResponseWire(38143, {
              id: 20935,
              response: true,
              q: DNS_QUESTION,
              edns: DNS_EDNS_OPTIONS,
              ns: DNS_TLD_HOSTNAMES.map((hostname) => [
                "com",
                "NS",
                172800,
                hostname,
              ]),
              ar: [
                ...DNS_TLD_HOSTNAMES.map((hostname, serverIndex) => [
                  hostname,
                  "A",
                  172800,
                  DNS_TLD_IPV4_ADDRESSES[serverIndex],
                ]),
                ...DNS_TLD_HOSTNAMES.map((hostname, serverIndex) => [
                  hostname,
                  "AAAA",
                  172800,
                  DNS_TLD_IPV6_ADDRESSES[serverIndex],
                ]),
              ],
            }),
          },
        ),
      ],
    },
    {
      title: ".com TLD Server",
      desc: "Points the way to example.com",
      detail:
        "The resolver asks one of the .com servers. They don’t store addresses for every site either, but they know which name servers each .com domain uses, so this reply is another referral, with those servers’ addresses (glue) attached.",
      facts: [
        ["Server", "a.gtld-servers.net"],
        ["Knows", "Name servers of .com domains"],
        ["Reply", "Referral + glue addresses"],
      ],
      events: [
        {
          type: "show",
          nodes: ["tld"],
          frame: "tld",
        },
        dnsPacketEvent(
          "dns",
          "tld",
          "blue",
          "DNS QUERY",
          ["A? www.example.com"],
          {
            time: "0.022s",
            src: DNS_RESOLVER_IP,
            dst: DNS_TLD_IP,
            proto: "DNS",
            info: "Standard query A www.example.com",
            len: "86 B",
            wire: dnsQueryWire(41766, {
              id: 11152,
              q: DNS_QUESTION,
              edns: DNS_EDNS_OPTIONS,
            }),
          },
        ),
        dnsPacketEvent(
          "tld",
          "dns",
          "amber",
          "REFERRAL",
          ["no answer: ask example.com", "example.com. NS ns1.example.com"],
          {
            time: "0.032s",
            src: DNS_TLD_IP,
            dst: DNS_RESOLVER_IP,
            proto: "DNS",
            info: "Referral: example.com. NS ×2 (with glue)",
            len: "154 B",
            wire: dnsResponseWire(41766, {
              id: 11152,
              response: true,
              q: DNS_QUESTION,
              edns: DNS_EDNS_OPTIONS,
              ns: [
                ["example.com", "NS", 172800, "ns1.example.com"],
                ["example.com", "NS", 172800, "ns2.example.com"],
              ],
              ar: [
                ["ns1.example.com", "A", 172800, DNS_AUTHORITATIVE_IP],
                ["ns2.example.com", "A", 172800, "198.51.100.54"],
              ],
            }),
          },
        ),
      ],
    },
    {
      title: "Authoritative Server",
      desc: "Gives the actual answer",
      detail:
        "Finally the resolver asks example.com’s own name server, which holds the domain’s records. It answers with the A record and marks the reply authoritative. The domain owner sets how long it may be cached: here, 3600 seconds.",
      facts: [
        ["Server", "ns1.example.com"],
        ["Answer", "A 203.0.113.10"],
        ["Flags", "AA (authoritative), TTL 3600"],
      ],
      events: [
        {
          type: "show",
          nodes: ["auth"],
          frame: "full",
        },
        dnsPacketEvent(
          "dns",
          "auth",
          "blue",
          "DNS QUERY",
          ["A? www.example.com"],
          {
            time: "0.042s",
            src: DNS_RESOLVER_IP,
            dst: DNS_AUTHORITATIVE_IP,
            proto: "DNS",
            info: "Standard query A www.example.com",
            len: "86 B",
            wire: dnsQueryWire(50911, {
              id: 58884,
              q: DNS_QUESTION,
              edns: DNS_EDNS_OPTIONS,
            }),
          },
        ),
        dnsPacketEvent(
          "auth",
          "dns",
          "green",
          "ANSWER",
          ["www.example.com A 203.0.113.10", "TTL 3600 · flag AA"],
          {
            time: "0.062s",
            src: DNS_AUTHORITATIVE_IP,
            dst: DNS_RESOLVER_IP,
            proto: "DNS",
            info: "Response A 203.0.113.10 (authoritative)",
            len: "102 B",
            wire: dnsResponseWire(50911, {
              id: 58884,
              response: true,
              aa: true,
              q: DNS_QUESTION,
              edns: DNS_EDNS_OPTIONS,
              an: [["www.example.com", "A", 3600, "203.0.113.10"]],
            }),
          },
        ),
      ],
    },
    {
      title: "Answer & Cache",
      desc: "The laptop gets its address",
      detail:
        "The resolver sends the answer back to the laptop and keeps a copy. For the next hour it can answer this name straight away, which is why the lookup in the HTTP lesson took only 24 ms. The laptop caches it too.",
      facts: [
        ["Answer", "A 203.0.113.10"],
        ["Flags", "RD, RA (recursion available)"],
        ["Cached by", "Resolver and laptop"],
      ],
      events: [
        dnsPacketEvent(
          "dns",
          "client",
          "green",
          "ANSWER",
          ["A 203.0.113.10 · TTL 3600", "flags: RD RA"],
          {
            time: "0.082s",
            src: DNS_RESOLVER_IP,
            dst: DNS_CLIENT_IP,
            proto: "DNS",
            info: "Standard query response A 203.0.113.10",
            len: "91 B",
            wire: dnsResponseWire(54871, {
              id: 39486,
              response: true,
              rd: true,
              ra: true,
              q: DNS_QUESTION,
              an: [["www.example.com", "A", 3600, "203.0.113.10"]],
            }),
          },
        ),
        {
          type: "note",
          at: "dns",
          text: "CACHED · TTL 3600 S",
          tone: "green",
        },
      ],
    },
  ],
};
export { dnsLesson };
