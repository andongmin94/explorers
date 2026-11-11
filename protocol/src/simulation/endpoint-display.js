import { escapeHtml } from "../i18n.js";

export function ftpServerPort(packet) {
  const tcp = packet?.row?.wire?.tcp;
  return packet?.from === "web" ? tcp?.sport : tcp?.dport;
}

const connectionText = { waiting: "연결 대기", connecting: "연결 중", open: "연결됨", closed: "종료", unset: "미지정" };
const portIcon = '<path d="M1 2h16v9h-5v3H6v-3H1z M5 5v3m4-3v3m4-3v3"/>';
const mailIcon = '<path d="M1 2h16v12H1z M2 3l7 6 7-6"/>';
const terminalIcon = '<path d="m3 2 6 5-6 5m7 0h7"/>';

function panel(title, icon, rows, kind = "") {
  const width = 212, header = 23, rowHeight = 25;
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
      web: panel(`서버 메일함 · ${state.count}통`, mailIcon, rows),
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
    const belowLaptop = id === "client" && scale > 1.35;
    const x = id === "web" ? 750 : 146;
    const y = id === "web" ? 165 : belowLaptop ? 565 : 305;
    const card = group.querySelector(".endpoint-card");
    const dy = belowLaptop ? 0 : -Number(card.dataset.height);
    group.firstElementChild.setAttribute("d", id === "web" ? "M747 158h15l25 27" :
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
      for (const id of ["client", "web"]) {
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
