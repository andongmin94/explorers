// Reconstructed from the distributed Protocol Explorer JavaScript.
import {
  CLIENT_IP,
  ROUTER_IP,
  formatPacketTime,
  packetEvent,
} from "./helpers.js";
const DHCP_INITIAL_TRANSACTION_ID = "0x3903f326";
const DHCP_RENEWAL_TRANSACTION_ID = "0x7a1c22e5";
const dhcpPacketRow = (
  seconds,
  sourceIp,
  destinationIp,
  info,
  frameBytes,
  wire,
) => ({
  time: formatPacketTime(seconds),
  src: sourceIp,
  dst: destinationIp,
  proto: "DHCP",
  info,
  len: `${frameBytes} B`,
  wire,
});
const DHCP_CLIENT_HOSTNAME = "alice-laptop";
const DHCP_PARAMETER_REQUEST_LIST = [
  1, 3, 6, 15, 31, 33, 43, 44, 46, 47, 119, 121, 249, 252,
];
const dhcpRequestWire = (message) => ({
  udp: {
    sport: 68,
    dport: 67,
    data: {
      dhcp: {
        op: 1,
        ...message,
      },
    },
  },
});
const dhcpReplyWire = (message) => ({
  udp: {
    sport: 67,
    dport: 68,
    data: {
      dhcp: {
        op: 2,
        ...message,
      },
    },
  },
});
const DHCP_LEASE_OPTIONS = [
  [54, ROUTER_IP],
  [51, 86400],
  [58, 43200],
  [59, 75600],
  [1, "255.255.255.0"],
  [28, "192.168.1.255"],
  [3, ROUTER_IP],
  [6, "8.8.8.8"],
];
const dhcpLesson = {
  id: "dhcp",
  name: "DHCP",
  title: "Getting an Address",
  layer: 7,
  nodes: ["client", "router"],
  latency: {
    "client-router": 0.001,
  },
  labels: {
    router: ["Router", "192.168.1.1 · DHCP server"],
  },
  legend: [
    ["amber", "From the laptop"],
    ["violet", "From the DHCP server"],
  ],
  overview: {
    full: "Dynamic Host Configuration Protocol",
    description:
      "DHCP hands a device everything it needs to use a network: an IP address, the subnet mask, the router to send traffic through and the DNS servers to ask. Addresses are leased for a set time and renewed while the device stays on the network.",
    facts: [
      ["Layer", "Application (Layer 7)"],
      ["Ports", "UDP 67 (server), 68 (client)"],
      ["Hands out", "IP, mask, gateway, DNS"],
      ["Exchange", "Discover, Offer, Request, Ack"],
      ["Lease", "Renewed at half its time"],
      ["Defined In", "RFC 2131, RFC 2132"],
    ],
  },
  outro: {
    title: "On the network",
    desc: "Leased, and kept up to date",
    text: "Four messages took the laptop from no address to a working configuration, and halfway through the 24-hour lease it renewed it with a direct request to the router. Press REPLAY to watch it again.",
    facts: [
      ["Messages", "4 to join, 2 per renewal"],
      ["Address", "192.168.1.10/24"],
      ["Lease", "24 h, renewed at 12 h"],
      ["Ports", "UDP 68 → 67"],
    ],
  },
  start: {
    nodes: ["client"],
    frame: "client",
  },
  steps: [
    {
      title: "No Address Yet",
      desc: "The laptop joins the network",
      detail:
        "The laptop has just connected. It has a MAC address built in, but no IP address, no gateway and no DNS server, so it can’t talk to anything beyond its own network yet. It asks for them with DHCP.",
      facts: [
        ["IP address", "None (uses 0.0.0.0)"],
        ["MAC address", "00:00:5e:00:53:10"],
        ["Needs", "IP, mask, gateway, DNS"],
      ],
      events: [
        {
          type: "note",
          at: "client",
          text: "NO IP ADDRESS YET",
          tone: "amber",
        },
        {
          type: "show",
          nodes: ["router"],
          frame: "local",
        },
      ],
    },
    {
      title: "Discover",
      desc: "Shout to the whole network",
      detail:
        "Without an address of its own, the laptop sends from 0.0.0.0 to the broadcast address 255.255.255.255, so every device on the local network receives it. Only DHCP servers answer.",
      facts: [
        ["From", "0.0.0.0, UDP port 68"],
        ["To", "255.255.255.255, port 67"],
        ["Carries", "MAC, transaction ID"],
      ],
      events: [
        packetEvent(
          "client",
          "router",
          "amber",
          "DISCOVER",
          ["0.0.0.0 → 255.255.255.255", "any DHCP server out there?"],
          dhcpPacketRow(
            0,
            "0.0.0.0",
            "255.255.255.255",
            `DHCP Discover - Transaction ID ${DHCP_INITIAL_TRANSACTION_ID}`,
            342,
            dhcpRequestWire({
              xid: +DHCP_INITIAL_TRANSACTION_ID,
              options: [
                [53, 1],
                [61, "mac"],
                [12, DHCP_CLIENT_HOSTNAME],
                [60, "MSFT 5.0"],
                [55, DHCP_PARAMETER_REQUEST_LIST],
              ],
            }),
          ),
        ),
      ],
    },
    {
      title: "Offer",
      desc: "The router proposes an address",
      detail:
        "The router’s DHCP server picks a free address and offers it with the rest of the settings. The laptop can’t use an IP address yet, so the offer goes straight to its MAC address (some clients ask for a broadcast instead).",
      facts: [
        ["Offered", "192.168.1.10/24"],
        ["Gateway, DNS", "192.168.1.1, 8.8.8.8"],
        ["Lease", "86,400 s (24 h)"],
      ],
      events: [
        packetEvent(
          "router",
          "client",
          "violet",
          "OFFER",
          ["offer: 192.168.1.10/24", "gateway, DNS, lease 24 h"],
          dhcpPacketRow(
            0.004,
            ROUTER_IP,
            CLIENT_IP,
            `DHCP Offer - Transaction ID ${DHCP_INITIAL_TRANSACTION_ID}`,
            342,
            dhcpReplyWire({
              xid: +DHCP_INITIAL_TRANSACTION_ID,
              yiaddr: CLIENT_IP,
              options: [[53, 2], ...DHCP_LEASE_OPTIONS],
            }),
          ),
        ),
      ],
    },
    {
      title: "Request",
      desc: "Accept, out loud",
      detail:
        "The laptop asks for the offered address, naming the server it chose. It still broadcasts, so any other DHCP server that made an offer learns it wasn’t picked and can release its address.",
      facts: [
        ["Requests", "192.168.1.10"],
        ["Chosen server", "192.168.1.1"],
        ["Sent to", "255.255.255.255"],
      ],
      events: [
        packetEvent(
          "client",
          "router",
          "amber",
          "REQUEST",
          ["I’ll take 192.168.1.10", "from server 192.168.1.1"],
          dhcpPacketRow(
            0.006,
            "0.0.0.0",
            "255.255.255.255",
            `DHCP Request - Transaction ID ${DHCP_INITIAL_TRANSACTION_ID}`,
            364,
            dhcpRequestWire({
              xid: +DHCP_INITIAL_TRANSACTION_ID,
              options: [
                [53, 3],
                [61, "mac"],
                [50, CLIENT_IP],
                [54, ROUTER_IP],
                [12, DHCP_CLIENT_HOSTNAME],
                [81, DHCP_CLIENT_HOSTNAME],
                [60, "MSFT 5.0"],
                [55, DHCP_PARAMETER_REQUEST_LIST],
              ],
            }),
          ),
        ),
      ],
    },
    {
      title: "Acknowledge",
      desc: "The address is the laptop’s",
      detail:
        "The server confirms, and the laptop configures its address, mask, gateway and DNS server. Many systems first check with ARP that no other device is already using the address.",
      facts: [
        ["Address", "192.168.1.10/24"],
        ["Gateway", "192.168.1.1"],
        ["DNS server", "8.8.8.8"],
      ],
      events: [
        packetEvent(
          "router",
          "client",
          "violet",
          "ACK",
          ["192.168.1.10 is yours", "for 24 hours"],
          dhcpPacketRow(
            0.009,
            ROUTER_IP,
            CLIENT_IP,
            `DHCP ACK - Transaction ID ${DHCP_INITIAL_TRANSACTION_ID}`,
            342,
            dhcpReplyWire({
              xid: +DHCP_INITIAL_TRANSACTION_ID,
              yiaddr: CLIENT_IP,
              options: [[53, 5], ...DHCP_LEASE_OPTIONS],
            }),
          ),
        ),
        {
          type: "note",
          at: "client",
          text: "192.168.1.10/24 · 24 H LEASE",
          tone: "green",
        },
      ],
    },
    {
      title: "Renew",
      desc: "Halfway through the lease",
      detail:
        "Twelve hours later, half the lease has passed. The laptop now has an address, so it asks the router directly to extend the lease, and the router resets it to 24 hours. If the router didn’t answer, it would broadcast at 87.5%.",
      facts: [
        ["When", "50% of lease (T1 = 12 h)"],
        ["Sent to", "The router (unicast)"],
        ["If unanswered", "Broadcast at 87.5% (T2)"],
      ],
      events: [
        packetEvent(
          "client",
          "router",
          "amber",
          "REQUEST",
          ["renew 192.168.1.10", "sent straight to 192.168.1.1"],
          dhcpPacketRow(
            43200,
            CLIENT_IP,
            ROUTER_IP,
            `DHCP Request - Transaction ID ${DHCP_RENEWAL_TRANSACTION_ID}`,
            352,
            dhcpRequestWire({
              xid: +DHCP_RENEWAL_TRANSACTION_ID,
              ciaddr: CLIENT_IP,
              options: [
                [53, 3],
                [61, "mac"],
                [12, DHCP_CLIENT_HOSTNAME],
                [81, DHCP_CLIENT_HOSTNAME],
                [60, "MSFT 5.0"],
                [55, DHCP_PARAMETER_REQUEST_LIST],
              ],
            }),
          ),
        ),
        packetEvent(
          "router",
          "client",
          "violet",
          "ACK",
          ["lease renewed", "another 24 hours"],
          dhcpPacketRow(
            43200.003,
            ROUTER_IP,
            CLIENT_IP,
            `DHCP ACK - Transaction ID ${DHCP_RENEWAL_TRANSACTION_ID}`,
            342,
            dhcpReplyWire({
              xid: +DHCP_RENEWAL_TRANSACTION_ID,
              ciaddr: CLIENT_IP,
              yiaddr: CLIENT_IP,
              options: [[53, 5], ...DHCP_LEASE_OPTIONS],
            }),
          ),
        ),
      ],
    },
  ],
};
export { dhcpLesson };
