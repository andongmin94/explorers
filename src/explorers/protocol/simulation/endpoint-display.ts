// Endpoint state shown on the devices themselves: mail and port tokens sit on
// the server, a cached DNS record sits on the resolver or laptop, the laptop's
// screen shows the terminal / mail app / certificate check, and each device's
// callout carries one short live state line.
import { project, token } from "@/lib/iso/kit.ts";
import { NETWORK_TOKEN_SLOTS, PACKET_COLORS } from "./network-drawing.ts";
import type { Devices, LessonEvent, WireData } from "../types.ts";

interface EndpointToken {
  text: string;
  color: string;
  active?: boolean;
  dim?: boolean;
}
interface Endpoint {
  state: string;
  tokens?: EndpointToken[];
  screen?: (string | number)[][];
  terminal?: boolean;
}

export function ftpServerPort(packet: LessonEvent | null | undefined) {
  const tcp = packet?.row?.wire?.tcp;
  return packet?.from === "web" ? tcp?.sport : tcp?.dport;
}

const connectionText: Record<string, string> = {
  waiting: "연결 대기",
  connecting: "연결 중",
  open: "연결됨",
  closed: "종료",
  unset: "미지정",
};
const connectionColor: Record<string, string> = {
  waiting: "grey",
  connecting: "amber",
  open: "green",
  closed: "slate",
};
const escapeXml = (text: unknown) =>
  String(text).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c as "&"],
  );

/** What each endpoint shows for a lesson's device state. */
function describeEndpoints(
  lessonId: string,
  state: Devices | WireData,
  port: unknown,
): Record<string, Endpoint | null | undefined | false | 0 | ""> {
  if (!state) return {};
  if (lessonId === "dns") {
    const cached = (record: string[], where: string): Endpoint => ({
      state: `${where} 캐시: ${record[0]} → ${record[3]} · TTL ${record[2]}초`,
      tokens: [{ text: record[1], color: "green" }],
    });
    return {
      dns: state.dns && cached(state.dns, "리졸버"),
      client: state.client && cached(state.client, "노트북"),
    };
  }
  if (lessonId === "tls" && state.certificate) {
    const verified = state.certificate === "verified";
    return {
      client: verified
        ? {
            state: "인증서 검증: 신뢰 루트와 일치 ✓",
            screen: [
              ["서버 인증서", "www.example.com", 1],
              ["↓ 발급자", "중간 인증기관", 2],
              ["↓ 신뢰 루트", "목록과 일치 ✓", 3],
            ],
            tokens: [{ text: "✓", color: "green" }],
          }
        : { state: "암호화된 인증서 수신 완료", screen: [["암호화된 전송", "수신 완료"]] },
    };
  }
  if (lessonId === "ftp") {
    const { control, data, dataPort } = state;
    const tokens: EndpointToken[] = [
      { text: "21", color: connectionColor[control] ?? "grey", active: port === 21 },
    ];
    if (data !== "unset") {
      tokens.push({
        text: String(dataPort),
        color: connectionColor[data] ?? "grey",
        active: port === dataPort,
      });
    }
    return {
      web: {
        state: `제어 21 ${connectionText[control]} · ${data === "unset" ? "데이터 미지정" : `데이터 ${dataPort} ${connectionText[data]}`}`,
        tokens,
      },
    };
  }
  if (lessonId === "pop3") {
    const marked = state.mailbox === "marked";
    const deleted = state.mailbox === "deleted";
    const tokens: EndpointToken[] = deleted
      ? []
      : [{ text: "M1", color: marked ? "amber" : "slate", dim: marked }];
    tokens.push({ text: "M2", color: "slate" });
    return {
      web: {
        state: `서버 메일함 ${tokens.length}통${marked ? " · 메일 1 삭제 예정" : deleted ? " · 메일 1 삭제됨" : ""}`,
        tokens,
      },
      client: {
        state: state.localCopy ? "노트북 메일함: 메일 1 사본 보관" : "노트북 메일함: 0통",
        screen: [state.localCopy ? ["메일 1", "사본 보관"] : ["내려받은 메일", "0통"]],
        tokens: state.localCopy ? [{ text: "M1", color: "slate" }] : [],
      },
    };
  }
  if (lessonId === "imap") {
    const tokens: EndpointToken[] = [
      { text: "M1", color: "slate" },
      { text: "M2", color: state.seen ? "slate" : "blue" },
    ];
    if (state.count === 3) tokens.push({ text: "M3", color: "green" });
    const screen: string[][] = [["받은 편지함", `${state.clientCount}통`]];
    if (state.localCopy) screen.push(["메일 2", "읽음"]);
    if (state.clientCount === 3) screen.push(["새 메일 알림", "+1"]);
    return {
      web: {
        state: `서버 메일함 ${state.count}통 · 메일 2 ${state.seen ? "읽음" : "안 읽음"}`,
        tokens,
      },
      client: state.clientCount && {
        state: `메일 앱: 받은 편지함 ${state.clientCount}통`,
        screen,
      },
    };
  }
  if (lessonId === "ssh") {
    const screen: string[][] = [[`$ ${state.command}`, ""]];
    if (state.output) screen.push([state.output, ""], ["$ ", ""]);
    return {
      client: {
        state: state.output ? `터미널: ${state.output}` : `터미널: $ ${state.command}`,
        screen,
        terminal: true,
      },
    };
  }
  return {};
}

const TOKEN_SIZE = 0.85;

// A state line is printed under the device's callout; long ones wrap into
// short lines so they stay beside their device instead of running across
// the neighbouring callouts.
const STATE_LINE_UNITS = 30;
const textUnits = (text: string) =>
  [...text].reduce((sum, c) => sum + (/[ᄀ-ￜ]/.test(c) ? 2 : 1), 0);
function wrapState(text: string) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && textUnits(next) > STATE_LINE_UNITS) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}
function setStateLines(textElement: SVGTextElement, text: string) {
  if (textElement.dataset.text === text) return;
  textElement.dataset.text = text;
  const x = textElement.getAttribute("x");
  textElement.innerHTML = wrapState(text)
    .map((line, index) => `<tspan x="${x}"${index ? ' dy="15"' : ""}>${escapeXml(line)}</tspan>`)
    .join("");
}

export function createEndpointDisplay(nodes: Record<string, SVGGElement>, svg: SVGSVGElement) {
  const shown = new Map();

  function renderTokens(id: string, tokens: EndpointToken[] = []) {
    const holder = nodes[id].querySelector(".node-tokens")!;
    const slots = NETWORK_TOKEN_SLOTS[id];
    holder.innerHTML = tokens
      .slice(0, slots.length)
      .map((item, index) => {
        const offset = (slots.length - tokens.length) / 2;
        const slot = slots[Math.min(slots.length - 1, Math.floor(index + offset))];
        const [sx, sy] = project(slot[0], slot[1], slot[2]);
        return `<g class="state-token${item.active ? " is-active" : ""}${item.dim ? " is-dim" : ""}" transform="translate(${sx.toFixed(1)} ${sy.toFixed(1)})">${token({ text: item.text, color: PACKET_COLORS[item.color], size: TOKEN_SIZE, h: 0.42 })}</g>`;
      })
      .join("");
  }

  function renderScreen(lines?: (string | number)[][], terminal?: boolean) {
    const client = nodes.client;
    const group = client.querySelector(".screen-lines")!;
    client.classList.toggle("has-screen", !!lines);
    client.classList.toggle("is-terminal", !!terminal);
    group.innerHTML = (lines ?? [])
      .map(([key, value, check], index) => {
        const y = 23 + index * 8.5;
        return `<g${check ? ` data-check="${check}"` : ""}><text class="screen-key" x="5" y="${y}">${escapeXml(key)}</text>${value ? `<text class="screen-value" x="86" y="${y}" text-anchor="end">${escapeXml(value)}</text>` : ""}</g>`;
      })
      .join("");
  }

  return {
    setScale() {},
    update(lessonId: string, state: Devices | undefined, port: unknown) {
      const endpoints = describeEndpoints(lessonId, state, port);
      const key = JSON.stringify(endpoints);
      if (shown.get("key") === key) return;
      shown.set("key", key);
      for (const id of ["client", "web", "dns"]) {
        const endpoint = endpoints[id] || null;
        for (const stateText of nodes[id].querySelectorAll<SVGTextElement>(".node-state")) {
          setStateLines(stateText, endpoint?.state ?? "");
        }
        renderTokens(id, endpoint?.tokens);
        if (id === "client") renderScreen(endpoint?.screen, endpoint?.terminal);
      }
      svg.classList.toggle("has-endpoint-state", Object.values(endpoints).some(Boolean));
    },
  };
}
