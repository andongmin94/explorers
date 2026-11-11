import { escapeHtml, translate } from "../i18n.js";
import { NETWORK_NODE_LABELS, PACKET_COLORS } from "./network-drawing.js";

export function ftpServerPort(packet) {
  const tcp = packet?.row?.wire?.tcp;
  return packet?.from === "web" ? tcp?.sport : tcp?.dport;
}

const connectionText = { waiting: "연결 대기", connecting: "연결 중", open: "연결됨", closed: "종료", unset: "미지정" };
const portIcon = '<path d="M1 2h16v9h-5v3H6v-3H1z M5 5v3m4-3v3m4-3v3"/>';
const mailIcon = '<path d="M1 2h16v12H1z M2 3l7 6 7-6"/>';
const terminalIcon = '<path d="m3 2 6 5-6 5m7 0h7"/>';
const certificateIcon = '<path d="m9 1 7 3v4c0 4-4 6-7 8-3-2-7-4-7-8V4z m-3 7 2 2 5-5"/>';

// Keep the readable message off the mobile DNS route as the marker moves.
export function renderDnsReadout(element, state, event) {
  const packet = event?.type === "packet" ? event : null;
  const record = state?.client ?? state?.dns;
  if (!packet && !record) {
    element.hidden = true;
    return;
  }
  const arrived = record && (!packet || packet.devicesAfter?.[packet.to] === record);
  let route, lines;
  if (arrived) {
    const [name, type, ttl, address] = record;
    const authoritative = packet?.row.wire.udp.data.dns.aa;
    route = `${state.client ? "클라이언트" : "DNS 리졸버"} · 캐시 저장`;
    lines = [`${name} · ${type} ${address}`, `TTL ${ttl}초${authoritative ? " · 권한 있는 응답(AA)" : ""}`];
  } else {
    route = [packet.from, packet.to].map(id => translate(NETWORK_NODE_LABELS[id][0])).join(" → ");
    lines = packet.payload.map(line => translate(line));
  }
  element.style.setProperty("--dns-color", PACKET_COLORS[arrived ? "green" : packet.color]);
  element.innerHTML = `<header><b>${escapeHtml(arrived ? "응답" : translate(packet.label))}</b>${escapeHtml(route)}</header>
    ${lines.map(line => `<div>${escapeHtml(line)}</div>`).join("")}`;
  element.hidden = false;
}

function panel(title, icon, rows, kind = "") {
  const width = kind === "certificate" ? 248 : 212, header = 23, rowHeight = 25;
  const height = header + rows.length * rowHeight + 3;
  return `<g class="endpoint-card ${kind}" data-height="${height}">
    <rect class="endpoint-shadow" x="3" y="3" width="${width}" height="${height}" rx="3"/>
    <rect class="endpoint-case" width="${width}" height="${height}" rx="3"/>
    <path class="endpoint-rule" d="M0 ${header}h${width}"/>
    <g class="endpoint-icon" transform="translate(9 4)">${icon}</g>
    <text class="endpoint-heading" x="35" y="16">${title}</text>
    ${rows.map(([label, value, tone = ""], i) => {
      const y = header + i * rowHeight;
      return `<g class="endpoint-row ${tone}">
        <rect class="endpoint-highlight" x="2" y="${y + 1}" width="${width - 4}" height="${rowHeight - 1}"/>
        <text class="endpoint-key" x="10" y="${y + 18}">${escapeHtml(label)}</text>
        <text class="endpoint-value" x="${width - 10}" y="${y + 18}" text-anchor="end">${escapeHtml(value)}</text>
      </g>`;
    }).join("")}</g>`;
}

function devicePanels(lessonId, state, port) {
  if (!state) return {};
  if (lessonId === "dns") {
    const cacheBadge = '<g class="endpoint-card cache-badge" data-height="30"><rect class="endpoint-case" width="87" height="30" rx="3"/><text x="43.5" y="21" text-anchor="middle">캐시 저장</text></g>';
    return { dns: state.dns && cacheBadge, client: state.client && cacheBadge };
  }
  if (lessonId === "tls" && state.certificate) {
    const verified = state.certificate === "verified";
    return { client: panel("클라이언트 · 인증서 검증", certificateIcon,
      verified ? [["서버 인증서", "www.example.com"], ["↓ 발급자", "중간 인증기관"], ["↓ 신뢰 루트", "기기 목록과 일치 ✓"]]
        : [["암호화된 전송", "수신 완료"]], "certificate") };
  }
  if (lessonId === "ftp") {
    const { control, data, dataPort } = state;
    return { web: panel("서버 포트", portIcon, [
      ["제어  21", connectionText[control], port === 21 ? "active" : control],
      [data === "unset" ? "데이터" : `데이터  ${dataPort}`, connectionText[data], port === dataPort ? "active" : data],
    ]) };
  }
  if (lessonId === "pop3") {
    const marked = state.mailbox === "marked", deleted = state.mailbox === "deleted";
    const rows = deleted ? [] : [["메일 1", marked ? "삭제 예정" : "보관", marked ? "marked" : ""]];
    rows.push(["메일 2", "보관"]);
    return {
      web: panel(`서버 메일함 · ${rows.length}통`, mailIcon, rows),
      client: panel("노트북 메일함", mailIcon, [state.localCopy ? ["메일 1", "사본 보관"] : ["내려받은 메일", "0통"]]),
    };
  }
  if (lessonId === "imap") {
    const rows = [["메일 1", "읽음"], ["메일 2", state.seen ? "읽음" : "안 읽음"]];
    if (state.count === 3) rows.push(["메일 3", "새 메일", "fresh"]);
    const local = [["받은 편지함", `${state.clientCount}통`]];
    if (state.localCopy) local.push(["메일 2", "읽음"]);
    if (state.clientCount === 3) local.push(["새 메일 알림", "+1", "fresh"]);
    return {
      web: panel(`서버 메일함 · ${state.count}통`, mailIcon, rows, "imap-mailbox"),
      client: state.clientCount && panel("노트북 메일 앱", mailIcon, local),
    };
  }
  if (lessonId === "ssh") {
    const rows = [[`$ ${state.command}`, ""]];
    if (state.output) rows.push([state.output, ""], ["$ ", ""]);
    return { client: panel("SSH 터미널", terminalIcon, rows, "terminal") };
  }
  return {};
}

// Keep each readout attached to its own device. The physical packet lanes stay visible below.
export function createEndpointDisplay(nodes) {
  const readouts = new Map();
  let scale = 1;
  function place(id, group) {
    const card = group.querySelector(".endpoint-card");
    if (card.classList.contains("cache-badge")) {
      const resolver = id === "dns";
      const x = resolver ? 706 : 226, y = resolver ? 93 : 361;
      group.firstElementChild.setAttribute("d", resolver ? "M706 130V93" : "M207 385l19-24");
      group.lastElementChild.setAttribute("transform",
        `translate(${x} ${y}) scale(${1.3 * scale}) translate(-43.5 -30)`);
      return;
    }
    if (card.classList.contains("certificate") && scale > 1.35) {
      group.firstElementChild.setAttribute("d", "M202 380l-25-37V246");
      group.lastElementChild.setAttribute("transform",
        `translate(100 246) scale(${1.35 * scale}) translate(0 ${-Number(card.dataset.height)})`);
      return;
    }
    const belowLaptop = id === "client" && scale > 1.35;
    const x = id === "web" ? 750 : 146;
    const serverY = card.classList.contains("imap-mailbox") && scale > 1.35 ? 205 : 165;
    const y = id === "web" ? serverY : belowLaptop ? 565 : 305;
    const dy = belowLaptop ? 0 : -Number(card.dataset.height);
    group.firstElementChild.setAttribute("d", id === "web" ? `M747 ${serverY - 7}h15L787 185` :
      belowLaptop ? "M253 478l23 25v62" : "M150 305v23l44 54");
    group.lastElementChild.setAttribute("transform",
      `translate(${x} ${y}) scale(${scale}) translate(${id === "web" ? -212 : 0} ${dy})`);
  }
  return {
    setScale(value) {
      scale = value;
      for (const [id, group] of readouts) place(id, group);
    },
    update(lessonId, state, port) {
      const panels = devicePanels(lessonId, state, port);
      for (const id of ["client", "web", "dns"]) {
        let group = readouts.get(id);
        if (!panels[id]) {
          group?.remove();
          readouts.delete(id);
          continue;
        }
        if (!group) {
          group = document.createElementNS("http://www.w3.org/2000/svg", "g");
          group.setAttribute("class", "endpoint-display");
          group.innerHTML = '<path class="endpoint-leader"/><g></g>';
          nodes[id].append(group);
          readouts.set(id, group);
        }
        if (group._panel !== panels[id]) {
          group.lastElementChild.innerHTML = panels[id];
          group._panel = panels[id];
          place(id, group);
        }
      }
    },
  };
}
