// Kit showcase. Open /shared/kit.html (add ?theme=dark, ?explorer=memory).
//   default        every Liquid Glass part floating over the scene backdrop
//                  (toolbar, sidebar, palette, tab bar, menu, sheet), the
//                  content parts (groups, list, table, notes, readouts), then
//                  every material, device, cable and token of shared/iso-kit.js
//   ?view=console  the reference console layout every explorer page follows
import "./theme.css";
import "./hw.css";
import "./switcher.css";
import "./glass.js";
import "./iso.js";
import { bindSliders } from "./hw.js";
import {
  MAT, LABEL, bin, box, cable, callout, chip, defs, fitScene, fitViewBox, floor, floorPath, hdd, labelScale, laptop,
  led, module, place, project, queueRail, ramStick, server, shadow, ssd, tableModule, token, topText, tray,
} from "./iso-kit.js";

const q = new URLSearchParams(location.search);
if (q.get("theme")) document.documentElement.dataset.theme = q.get("theme");
if (q.get("explorer")) document.documentElement.dataset.explorer = q.get("explorer");

const COLORS = { P1: "#3b6fe0", P2: "#13896a", P3: "#8456cf", P4: "#d2731c", A: "#3b6fe0", B: "#13896a", C: "#8456cf", D: "#c8962a", E: "#d24a4a" };
const at = (x, y, z, svg) => { const [sx, sy] = project(x, y, z); return `<g transform="translate(${sx} ${sy})">${svg}</g>`; };

/* ---------- Composed scene: one CPU, a ready queue, I/O and a done bin ---------- */
function composedScene({ aspect = 1348 / 560, fill = 0.9 } = {}) {
  const ready = queueRail({ x: -2, y: 6, slots: 4, pitch: 1.7, exit: "end", label: "READY", sub: "FIFO" });
  const cpu = chip({ x: 9.2, y: 3.4, size: 5, label: "CPU", sub: "CORE 0" });
  const io = ssd({ x: 18.5, y: -1.2, w: 5.2, d: 3.4, label: "I/O" });
  const done = bin({ x: 17.4, y: 5.6, w: 4.6, d: 3.2, label: "DONE", capacity: 4 });
  // Callouts: world anchor + label offset; the label boxes join the framing.
  const notes = [
    { x: 0, y: 6.4, z: 0.62, dx: -24, dy: -64, title: "준비 큐", sub: "READY · FIFO", anchor: "end" },
    { x: 11.7, y: 5.9, z: cpu.top, dx: 0, dy: -86, title: "CPU", sub: "한 번에 하나" },
    { x: 22, y: 0.5, z: 0.42, dx: 36, dy: -56, title: "입출력 장치", sub: "CPU와 동시에 진행", anchor: "start" },
    { x: 21.4, y: 7.6, z: 1, dx: 36, dy: -24, title: "완료", sub: "DONE", anchor: "start" },
  ];
  const labels = notes.map((n) => { const [sx, sy] = project(n.x, n.y, n.z); const w = 150; const lx = sx + n.dx; return [n.anchor === "end" ? lx - w : n.anchor === "start" ? lx : lx - w / 2, sy + n.dy - 18, w, 40]; });
  const pts = [[-2, 6, 0], [ready.w - 2, 6, 0], [-2, 6 + ready.d, 0], [ready.w - 2, 6 + ready.d, 0], [9.2, 3.4, cpu.top], [14.2, 8.4, 0], [9.2, 8.4, 0], [18.5, -1.2, 0.5], [23.7, -1.2, 0], [23.7, 2.2, 0], [22, 8.8, 0], [17.4, 8.8, 0], [21, -3, 0], [0.4, -3, 0]];
  const vb = fitScene(pts, { stageAspect: aspect, fill, labels });
  const s = ready.slots;
  return `<svg class="kit-stage-svg" viewBox="${vb}" role="img" aria-label="CPU 스케줄러 장면">
    ${defs()}
    ${floor({ x: -8, y: -8, w: 40, d: 26 })}
    ${cable([[21.1, -1.1], [21.1, -3], [0.4, -3], [0.4, 6.1]], { width: 5, arrow: true })}
    ${cable([[14.1, 4.6], [16.2, 4.6], [16.2, 0.5], [18.6, 0.5]], { width: 7 })}
    ${cable([[14.1, 7.2], [17.5, 7.2]], { width: 6, bus: 2 })}
    ${cable([[ready.w - 2.05, 7.05], [9.3, 7.05]], { active: true, width: 7 })}
    ${ready.svg}${cpu.svg}${io.svg}${done.svg}
    ${notes.map((n) => callout(n)).join("")}
    ${at(...cpu.slots[0], token({ id: "P1", color: COLORS.P1 }))}
    ${at(...s[3], token({ id: "P2", color: COLORS.P2 }))}
    ${at(...s[2], token({ id: "P3", color: COLORS.P3 }))}
    ${at(...io.slots[0], token({ id: "P4", color: COLORS.P4 }))}
    ${at(...done.slots[0], token({ id: "P5", color: "#6b6964" }))}
  </svg>`;
}

/* ---------- One device per cell ---------- */
function cell(name, sig, body, bounds, note = "") {
  return `<figure class="kit-cell">
    <div class="kit-cell-art"><svg viewBox="${fitViewBox(bounds, 34)}" role="img" aria-label="${name}">${defs()}${body}</svg></div>
    <figcaption><strong>${name}</strong><code>${sig}</code>${note ? `<span>${note}</span>` : ""}</figcaption>
  </figure>`;
}

function devices() {
  const out = [];
  const c = chip({ x: 0, y: 0, size: 5, label: "CPU", sub: "CORE 0" });
  out.push(cell("chip()", "chip({ x, y, size, label, sub })", `${floor({ x: -2, y: -2, w: 9, d: 9 })}${c.svg}${at(...c.slots[0], token({ id: "P1", color: COLORS.P1 }))}`, [[0, 0, 0], [5, 0, 0], [5, 5, 0], [0, 5, 0], [0, 0, 1.6]], "PCB 기판 · 금 패드 · 히트스프레더"));
  const r = ramStick({ x: 0, y: 0, length: 8, chips: 5, label: "DDR5 · 8 GB" });
  out.push(cell("ramStick()", "ramStick({ x, y, length, chips, label }) → chipsAt", `${floor({ x: -2, y: -2, w: 12, d: 6 })}${r.svg}`, [[0, 0, 0], [8, 0, 0], [8, 1.6, 0], [0, 1.6, 0], [0, 0.6, 2.1], [8, 0.6, 2.1]], "DIMM 슬롯 · 메모리 칩 · 금 접점"));
  const t = queueRail({ x: 0, y: 0, slots: 5, pitch: 1.6, exit: "start", label: "READY QUEUE", sub: "FIFO" });
  out.push(cell("queueRail() / tray()", "queueRail({ x, y, slots, pitch, axis, exit, label }) → slots, leds, head", `${floor({ x: -2, y: -2, w: 13, d: 6 })}${t.svg.replace('data-slot="0" class="iso-led', 'data-slot="0" class="iso-led is-on').replace('data-slot="1" class="iso-led', 'data-slot="1" class="iso-led is-on')}${at(...t.slots[0], token({ id: "P2", color: COLORS.P2 }))}${at(...t.slots[1], token({ id: "P3", color: COLORS.P3 }))}`, [[0, 0, 0], [t.w, 0, 0], [t.w, t.d, 0], [0, t.d, 0], [0, 0, 1.2]], "번호 붙은 슬롯 · 점유 LED · OUT 표시"));
  const tm = tableModule({ x: 0, y: 0, w: 6, d: 5, rows: 5, cols: 2, headers: ["PAGE", "FRAME"], label: "PAGE TABLE" });
  const cellText = tm.cells.map((row, i) => topText({ x: row[0][0], y: row[0][1], z: row[0][2], text: "ABCDE"[i], size: 11, fill: "var(--iso-glass-ink)" }) + topText({ x: row[1][0], y: row[1][1], z: row[1][2], text: i < 3 ? `F${i}` : "—", size: 11, fill: i < 3 ? "var(--iso-glass-ink)" : "var(--iso-ic-ink)" })).join("");
  out.push(cell("tableModule()", "tableModule({ x, y, rows, cols, headers, label }) → cells[r][c], rowLeds", `${floor({ x: -2, y: -2, w: 10, d: 9 })}${tm.svg.replace(/(<polygon class="iso-cell)(" data-row="1")/g, "$1 is-on$2").replace('data-row="0" class="iso-led', 'data-row="0" class="iso-led is-on').replace('data-row="1" class="iso-led', 'data-row="1" class="iso-led is-on').replace('data-row="2" class="iso-led', 'data-row="2" class="iso-led is-on')}${cellText}`, [[0, 0, 0], [6, 0, 0], [6, 5, 0], [0, 5, 0], [0, 0, 0.8]], "행 LED · 유리 셀 · 머리글"));
  const b = bin({ x: 0, y: 0, w: 5, d: 3.6, label: "DONE", capacity: 4 });
  out.push(cell("bin()", "bin({ x, y, w, d, label, capacity }) → slots", `${floor({ x: -2, y: -2, w: 9, d: 8 })}${b.svg}${at(...b.slots[0], token({ id: "P1", color: COLORS.P1 }))}${at(...b.slots[1], token({ id: "P4", color: COLORS.P4 }))}`, [[0, 0, 0], [5, 0, 0], [5, 3.6, 0], [0, 3.6, 0], [0, 0, 1.6]], "완료함 · 서랍 손잡이 · 번호 없음"));
  const sd = ssd({ x: 0, y: 0, w: 6, d: 3.8, label: "SSD" });
  out.push(cell("ssd()", "ssd({ x, y, w, d, label })", `${floor({ x: -2, y: -2, w: 10, d: 8 })}${sd.svg}`, [[0, 0, 0], [6, 0, 0], [6, 3.8, 0], [0, 3.8, 0], [0, 0, 0.5]], "그래파이트 케이스 · 라벨 · SATA 단자"));
  const hd = hdd({ x: 0, y: 0, w: 9, d: 9 });
  out.push(cell("hdd()", "hdd({ x, y, w, d }) → center, radius", `${floor({ x: -2, y: -2, w: 13, d: 13 })}${hd.svg}`, [[0, 0, 0], [9, 0, 0], [9, 9, 0], [0, 9, 0]], "알루미늄 섀시 · 플래터 · 스핀들"));
  const sv = server({ x: 0, y: 0, w: 5, d: 5, units: 3, label: "DB", lit: 2 });
  out.push(cell("server()", "server({ x, y, w, d, units, label, lit })", `${floor({ x: -2, y: -2, w: 9, d: 9 })}${sv.svg}`, [[0, 0, 0], [5, 0, 0], [5, 5, 0], [0, 5, 0], [0, 0, 2.3]]));
  const lp = laptop({ x: 0, y: 0, w: 5, d: 3.6, screen: "git status" });
  out.push(cell("laptop()", "laptop({ x, y, w, d, screen })", `${floor({ x: -2, y: -2, w: 9, d: 8 })}${lp.svg}`, [[0, -0.3, 0], [5, -0.3, 0], [5, 3.6, 0], [0, 3.6, 0], [0, -0.3, 2.9], [5, -0.3, 2.9]]));
  const md = module({ x: 0, y: 0, w: 5, d: 3.4, label: "MODULE", well: true });
  out.push(cell("module()", "module({ x, y, w, d, h, label, mat })", `${floor({ x: -2, y: -2, w: 9, d: 8 })}${md.svg}`, [[0, 0, 0], [5, 0, 0], [5, 3.4, 0], [0, 3.4, 0], [0, 0, 1]], "범용 케이스 (가능하면 위 장치를 쓰세요)"));
  return out.join("");
}

function materials() {
  return Object.entries(MAT).map(([name, m]) => {
    const body = `${shadow({ x: 0, y: 0, w: 3, d: 3, spread: 0.4 })}${box({ x: 0, y: 0, w: 3, d: 3, h: 1.4, fill: m, radius: 0.28 })}${topText({ x: 1.5, y: 1.5, z: 1.4, text: name.toUpperCase(), size: 11, fill: m.ink ?? "var(--ink)", engrave: m.engrave })}`;
    return `<figure class="kit-swatch"><svg viewBox="${fitViewBox([[0, 0, 0], [3, 0, 0], [3, 3, 0], [0, 3, 0], [0, 0, 1.4]], 14)}" aria-label="${name}">${body}</svg><figcaption><code>MAT.${name}</code></figcaption></figure>`;
  }).join("");
}

function cables() {
  const b = [[-1, -1, 0], [22, -1, 0], [22, 9, 0], [-1, 9, 0]];
  return `<svg viewBox="${fitViewBox(b, 20)}" class="kit-wide" role="img" aria-label="cables">
    ${defs()}${floor({ x: -2, y: -2, w: 26, d: 13 })}
    ${cable([[0, 0], [9, 0], [9, 3]], { width: 7 })}
    ${cable([[0, 2.5], [6, 2.5], [6, 6], [10, 6]], { active: true, width: 7 })}
    ${cable([[12, 0], [20, 0], [20, 4]], { width: 6, bus: 3 })}
    ${cable([[12, 3], [17, 3], [17, 7]], { width: 6, arrow: true })}
    ${floorPath([[0, 8], [8, 8]], { dashed: true })}
    ${floorPath([[11, 8.5], [20, 8.5]], { cls: "is-active" })}
    ${callout({ x: 4.5, y: 0, dx: 0, dy: -40, title: "cable()", sub: "IDLE" })}
    ${callout({ x: 6, y: 4.2, dx: -70, dy: -14, title: "cable({ active })", sub: "PULSE", anchor: "end" })}
    ${callout({ x: 16, y: 0, dx: 0, dy: -40, title: "bus: 3", sub: "RIBBON" })}
    ${callout({ x: 17, y: 5, dx: 60, dy: -30, title: "arrow", sub: "DIRECTION", anchor: "start" })}
    ${callout({ x: 4, y: 8, dx: -40, dy: 40, title: "floorPath()", sub: "DASHED / ACTIVE", anchor: "end" })}
  </svg>`;
}

function tokens() {
  const ids = [["P1", COLORS.P1], ["P2", COLORS.P2], ["P3", COLORS.P3], ["A", COLORS.A], ["D", COLORS.D], ["E", COLORS.E], ["183", "#4a4b4e"], ["T1", "#c2185b"], ["C0", "#7a4fd6"]];
  const b = [[-1, -1, 0], [ids.length * 2, -1, 0], [ids.length * 2, 1, 0], [-1, 1, 0], [-1, -1, 1]];
  return `<svg viewBox="${fitViewBox(b, 16)}" class="kit-wide" role="img" aria-label="tokens">
    ${floor({ x: -2, y: -2, w: ids.length * 2 + 3, d: 4 })}
    ${ids.map(([id, color], i) => at(i * 2, 0, 0, token({ id, color }))).join("")}
    ${led({ x: ids.length * 2 - 0.5, y: 2, z: 0, on: true })}
  </svg>`;
}

const ICON = {
  back: '<path d="m15 5-7 7 7 7"/>',
  fwd: '<path d="m9 5 7 7-7 7"/>',
  play: '<path d="m8 5 11 7-11 7z"/>',
  reset: '<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>',
  moon: '<path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  compare: '<path d="M8 4v16M16 4v16M4 8h4M16 16h4"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
  cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3"/><rect x="9" y="9" width="6" height="6"/>',
  check: '<path d="m4 12.5 5 5L20 6.5"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
};
const svgIcon = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;
const dark = document.documentElement.dataset.theme === "dark";

const railItems = [
  ["01", "라운드 로빈", "할당량과 응답", "done", 100],
  ["02", "선착순 FCFS", "호위 효과", "progress", 40],
  ["03", "최단 작업 우선", "평균 대기 시간", "new", 0],
  ["04", "다단계 피드백 큐", "우선순위가 바뀌는 큐", "new", 0],
].map(([n, name, sub, st, pct], i) => `<a class="hw-rail-item" href="#"${i === 1 ? ' aria-current="page"' : ""}>
    <span class="hw-led hw-rail-led is-${st}"></span>
    <span class="hw-rail-text"><span class="hw-rail-name"><span class="hw-index">${n}</span> ${name}</span><span class="hw-rail-sub">${sub}</span></span>
    <span class="hw-rail-pct">${pct}%</span></a>`).join("");

function glassWindow() {
  return `<div class="kit-window">
    <div class="hw-stage kit-backdrop"><div class="hw-scene kit-backdrop-scene">${composedScene({ aspect: 1060 / 520, fill: 0.86 })}</div></div>
    <aside class="hw-rail kit-rail" aria-label="사이드바 (hw-rail)">
      <div class="hw-plate-head"><span class="hw-label">CPU 스케줄링</span></div>
      <nav class="hw-rail-body"><div class="hw-list hw-rail-list">${railItems}</div></nav>
    </aside>
    <div class="kit-toolbar">
      <div class="hw-glass hw-glass--sm kit-pill"><button class="hw-key hw-key--icon kit-flat" aria-label="뒤로">${svgIcon("back")}</button><i class="kit-sep"></i><button class="hw-key hw-key--icon kit-flat" aria-label="앞으로" disabled>${svgIcon("fwd")}</button></div>
      <div class="hw-context"><span class="hw-label">02 레슨</span><strong>선착순 FCFS</strong></div>
      <span class="kit-flex"></span>
      <div class="hw-glass hw-glass--sm kit-pill"><button class="hw-key hw-key--icon kit-flat" aria-label="비교">${svgIcon("compare")}</button><button class="hw-key hw-key--icon kit-flat" aria-label="처음으로">${svgIcon("reset")}</button><button class="hw-key hw-key--icon kit-flat" aria-pressed="true" aria-label="테마">${svgIcon("moon")}</button></div>
      <button class="hw-key">결과 비교</button>
      <div class="hw-glass hw-glass--sm kit-search">${svgIcon("search")}<span>검색</span></div>
    </div>
    <div class="kit-readout"><span class="hw-label">시각</span><span class="hw-lcd">12<small>ms</small></span></div>
    <div class="hw-tabs kit-tabbar" role="tablist"><button role="tab" aria-selected="true">해설</button><button role="tab" aria-selected="false">장면</button><button role="tab" aria-selected="false">규칙</button><button role="tab" aria-selected="false">범위</button></div>
    <section class="hw-deck kit-deck" aria-label="팔레트 (hw-deck)">
      <div class="hw-field"><span class="hw-label">배정 방식</span><div class="hw-seg" role="group"><button aria-pressed="true">라운드 로빈</button><button aria-pressed="false">FCFS</button><button aria-pressed="false">SJF</button></div></div>
      <div class="hw-field" style="flex:1 1 100%"><span class="hw-label">할당량 <span class="hw-mono" style="margin-inline-start:auto;color:var(--vlabel)">2 ms</span></span><input class="hw-slider" type="range" min="1" max="5" value="2" /><div class="hw-ticks"><span>1</span><span>5</span></div></div>
      <div class="hw-transport"><button class="hw-key hw-key--icon" aria-label="처음으로">${svgIcon("reset")}</button><button class="hw-key hw-key--accent" style="min-width:112px">${svgIcon("play")}학습 시작</button><button class="hw-key">다음 사건</button></div>
      <button class="hw-switch" role="switch" aria-checked="true">핵심 장면에서 멈추기</button>
    </section>
  </div>`;
}

function sheetWindow() {
  return `<div class="kit-window kit-window--short">
    <div class="hw-stage kit-backdrop kit-backdrop--full"><div class="hw-scene kit-backdrop-scene">${composedScene({ aspect: 1360 / 440, fill: 0.8 })}</div></div>
    <div class="kit-menu-wrap">
      <button class="explorer-trigger" type="button" aria-expanded="true" style="width:260px">
        <span class="explorer-brand-mark">${svgIcon("cpu")}</span>
        <span class="explorer-brand-copy"><span class="explorer-brand-name">CPU 스케줄링 탐색기</span><span class="explorer-brand-caption">하나의 CPU를 여러 작업이 나눠 쓰는 법</span></span>
        <span class="explorer-chevron">${svgIcon("chevron")}</span>
      </button>
      <div class="explorer-menu kit-menu">
        ${["프로토콜 탐색기", "CPU 스케줄링 탐색기", "메모리 탐색기", "트랜잭션 탐색기", "디스크 탐색기", "Git 탐색기"].map((l, i) => `<a class="explorer-item" href="#"${i === 1 ? ' aria-current="page"' : ""}${i === 3 ? " data-highlighted" : ""} style="--item-accent: var(--sys-${["blue", "orange", "green", "pink", "yellow", "purple"][i]})"><span class="explorer-item-check">${svgIcon("check")}</span>${svgIcon("cpu")}<span class="explorer-item-label">${l}</span><span class="explorer-item-dot"></span></a>`).join("")}
      </div>
    </div>
    <div class="kit-scrim"></div>
    <div class="hw-dialog kit-sheet" role="dialog" aria-label="시트 (hw-dialog)">
      <div class="hw-plate-head"><span class="hw-label">예측</span></div>
      <div class="hw-plate-body" style="display:grid;gap:10px">
        <h3 class="hw-title">P2는 언제 CPU를 받을까요?</h3>
        <p class="hw-text">P1이 할당량 2ms를 다 쓰면 준비 큐의 맨 앞 작업이 CPU를 받습니다.</p>
        <div class="hw-list"><button aria-pressed="true">2ms에 바로</button><button>P3 다음에</button><button>P1이 끝난 뒤에</button></div>
        <div style="display:flex;gap:8px;justify-content:flex-end"><button class="hw-key">취소</button><button class="hw-key hw-key--accent">실제로 확인 →</button></div>
      </div>
    </div>
  </div>`;
}

function contentParts() {
  return `<div class="kit-content">
    <aside class="hw-plate hw-side kit-side">
      <div class="hw-plate-head"><div class="hw-tabs" role="tablist"><button role="tab" aria-selected="true">해설</button><button role="tab" aria-selected="false">장면</button><button role="tab" aria-selected="false">범위</button></div><span class="hw-label">1 / 7</span></div>
      <div class="hw-plate-body">
        <div class="hw-section">
          <span class="hw-label"><span class="hw-index">핵심 장면 1</span> · 0ms</span>
          <h2 class="hw-title" style="margin-top:6px">한 번에 하나, 차례로 실행</h2>
          <p class="hw-text" style="margin-top:8px">CPU는 한 번에 한 작업만 실행합니다. 라운드 로빈은 한 차례에 최대 2ms를 주고, 작업이 남으면 준비 큐 뒤에서 다음 차례를 기다리게 합니다.</p>
        </div>
        <div class="hw-section"><div class="hw-note hw-note--accent">작업의 전체 CPU 시간, 이번 CPU 구간, 한 차례의 시간 할당량은 서로 다릅니다.</div></div>
        <div class="hw-section"><div class="hw-note">일반 메모: 상태 점과 회색 채움.</div></div>
        <div class="hw-section"><span class="hw-label">핵심 장면</span>
          <div class="hw-list"><button><span class="hw-led is-on"></span>P1 도착</button><button aria-current="true"><span class="hw-led is-on"></span>할당량 소진</button><button><span class="hw-led"></span>P2 실행</button></div>
        </div>
        <div class="hw-section" style="display:flex;gap:8px;flex-wrap:wrap"><button class="hw-key">이번 사건 다시 보기</button><button class="hw-key hw-key--accent">CPU, 먼저 맞혀보기 →</button></div>
      </div>
    </aside>
    <section class="hw-plate hw-records kit-records">
      <div class="hw-plate-head"><div class="hw-tabs" role="tablist"><button role="tab" aria-selected="true">실행 시간표</button><button role="tab" aria-selected="false">사건 기록</button><button role="tab" aria-selected="false">결과</button></div></div>
      <div class="hw-plate-body">
        <table class="hw-table"><thead><tr><th>시각</th><th>작업</th><th>일어난 일</th></tr></thead>
        <tbody>${[["0ms", "P1", "도착 → 준비 큐"], ["0ms", "P1", "CPU 배정"], ["2ms", "P1", "할당량 소진 → 준비 큐 뒤"], ["2ms", "P2", "CPU 배정"], ["3ms", "P3", "도착"], ["4ms", "P2", "입출력 요청"]].map((r, i) => `<tr${i === 2 ? ' aria-current="true"' : ""}><td class="hw-mono">${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join("")}</tbody></table>
      </div>
    </section>
    <section class="hw-plate kit-misc">
      <div class="hw-plate-head"><span class="hw-label">읽기값 · 배지 · 상태 · 입력</span></div>
      <div class="hw-plate-body hw-content" style="display:flex;flex-wrap:wrap;gap:14px;align-items:center">
        <span class="hw-lcd">128<small>KB</small></span>
        <span class="hw-lcd is-large">3.25<small>ms</small></span>
        <span class="hw-tag">단일 코어</span>
        <span style="display:inline-flex;gap:8px;align-items:center"><span class="hw-led is-on"></span><span class="hw-led" style="--led:var(--sys-green)" ></span><span class="hw-led is-on" style="--led:var(--sys-green)"></span><span class="hw-led is-progress"></span><span class="hw-led is-new"></span></span>
        <span class="hw-meter"><i class="is-on"></i><i class="is-on"></i><i class="is-half"></i><i></i><i></i></span>
        <input class="hw-input" placeholder="98, 183, 37, 122" style="width:200px" />
        <input class="hw-input hw-input--sm" value="42" style="width:64px" />
        <button class="hw-key">버튼</button><button class="hw-key hw-key--sm">작게</button><button class="hw-key" aria-pressed="true">켜짐</button><button class="hw-key" disabled>비활성</button>
        <button class="hw-switch" role="switch" aria-checked="false">꺼진 스위치</button>
        <div class="hw-seg" role="group"><button aria-pressed="false">A</button><button aria-pressed="false">B</button><button aria-pressed="true">C</button><button aria-pressed="false">D</button></div>
        <div class="hw-screen" style="flex:1 1 320px"><div class="hw-screen-head"><span class="is-on">탐색 거리</span><span>요청 순서</span><span>0–199</span></div><svg viewBox="0 0 300 40" height="40"><polyline fill="none" stroke="var(--accent)" stroke-width="2" points="0,30 60,10 120,26 180,6 240,22 300,14"/></svg></div>
      </div>
    </section>
  </div>`;
}

function showcase() {
  const theme = dark ? "light" : "dark";
  return `<div class="hw-page kit-page">
  <style>
    .hw-page.kit-page { max-width: 1480px; height: auto; margin: 0 auto; display: grid; gap: 22px; overflow: visible; padding: 10px 20px 40px; }
    .kit-page figure svg, .kit-wide { overflow: hidden; }
    .kit-page > .hw-plate { padding: 6px 18px 18px; }
    .kit-page > .hw-plate > .hw-plate-head { padding-inline: 0; }
    .kit-h { margin: 8px 0 -10px; font: 700 var(--fs-4)/22px var(--font-display); }
    .kit-window { position: relative; height: 640px; overflow: hidden; border-radius: var(--r-window); background: var(--window); box-shadow: var(--window-shadow); }
    .kit-window--short { height: 460px; }
    .kit-backdrop { position: absolute; inset: 0; overflow: hidden; }
    .kit-backdrop-scene { position: absolute; top: 64px; left: 268px; right: 16px; bottom: 16px; min-height: 0; }
    .kit-backdrop--full .kit-backdrop-scene { inset: 10px; }
    .kit-backdrop-scene > svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
    .kit-rail { position: absolute; top: 8px; left: 8px; bottom: 8px; width: 244px; z-index: 2; }
    .kit-toolbar { position: absolute; top: 8px; left: 264px; right: 8px; height: 36px; display: flex; align-items: center; gap: 8px; z-index: 3; }
    .kit-pill { display: flex; align-items: center; gap: 2px; padding: 4px; box-shadow: var(--lg-rim), var(--lg-shadow); }
    .kit-pill .kit-flat { min-height: 28px; width: 28px; background: none; box-shadow: none; backdrop-filter: none; -webkit-backdrop-filter: none; }
    .kit-pill .kit-flat:hover:not(:disabled) { background: var(--lg-hover); }
    .kit-pill .kit-flat[aria-pressed="true"] { background: var(--lg-selected); }
    .kit-sep { width: 1px; height: 20px; background: var(--vlabel-4); }
    .kit-flex { flex: 1; }
    .kit-search { display: flex; align-items: center; gap: 6px; height: 36px; width: 140px; padding: 0 12px; color: var(--vlabel-2); box-shadow: var(--lg-rim), var(--lg-shadow); }
    .kit-search svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; }
    .kit-readout { position: absolute; top: 60px; right: 20px; display: flex; gap: 8px; align-items: center; z-index: 2; }
    .kit-readout .hw-lcd { background: var(--lg-sheen), var(--lg-small); box-shadow: var(--lg-rim), 0 4px 16px rgb(0 0 0 / .08); backdrop-filter: var(--lg-backdrop); }
    .kit-tabbar { position: absolute; left: 50%; bottom: 20px; transform: translateX(-50%); z-index: 2; width: max-content; box-shadow: var(--lg-rim), var(--lg-shadow); backdrop-filter: var(--lg-backdrop); }
    .kit-deck { position: absolute; right: 16px; bottom: 16px; width: 380px; z-index: 2; }
    .kit-menu-wrap { position: absolute; top: 14px; left: 14px; z-index: 3; display: grid; gap: 8px; }
    .kit-menu { position: static; width: 260px; }
    .kit-scrim { position: absolute; inset: 0; z-index: 3; background: rgb(0 0 0 / .14); pointer-events: none; }
    .kit-sheet { position: absolute; top: 50%; left: 62%; transform: translate(-50%, -50%); width: 460px; z-index: 4; }
    .kit-content { display: grid; grid-template-columns: 380px minmax(0, 1fr); gap: 12px; }
    .kit-misc { grid-column: 1 / -1; }
    .kit-content > .hw-plate { grid-area: auto; contain: none; overflow: visible; height: auto; display: block; }
    .kit-content > .kit-misc { grid-column: 1 / -1; }
    .kit-stage { height: 520px; position: relative; }
    .kit-stage svg { position: absolute; inset: 0; width: 100%; height: 100%; }
    .kit-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 8px 22px; }
    .kit-cell { margin: 0; display: grid; grid-template-rows: 260px auto; }
    .kit-cell-art svg { width: 100%; height: 100%; }
    .kit-cell-art { min-height: 0; }
    .kit-cell figcaption, .kit-swatch figcaption { display: grid; gap: 2px; font-size: 12px; color: var(--label-2); padding-top: 6px; border-top: 1px solid var(--separator-soft); }
    .kit-cell figcaption strong { color: var(--label); font: 590 13px var(--font-sans); }
    .kit-cell code, .kit-swatch code { font: 500 12px var(--font-mono); color: var(--label-2); }
    .kit-swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 16px; }
    .kit-swatch { margin: 0; } .kit-swatch svg { width: 100%; height: 150px; }
    .kit-wide { width: 100%; height: auto; display: block; max-height: 380px; }
    @media (max-width: 1100px) { .kit-content { grid-template-columns: 1fr; } .kit-deck { width: 320px; } }
  </style>
  <header class="hw-topbar"><div class="hw-brand"><h1>Liquid Glass 키트</h1><p>shared/theme.css · hw.css · iso-kit.js — macOS 26 / iOS 26 UI kit 기준</p></div>
    <div class="hw-actions"><a class="hw-key hw-key--sm" href="?theme=${theme}">${theme === "dark" ? "다크" : "라이트"}</a><a class="hw-key hw-key--sm" href="?view=console${dark ? "&theme=dark" : ""}">콘솔</a></div></header>
  <h2 class="kit-h">유리 위 크롬 · 장면이 창 배경</h2>
  ${glassWindow()}
  <h2 class="kit-h">메뉴 · 시트</h2>
  ${sheetWindow()}
  <h2 class="kit-h">콘텐츠 (유리 아님)</h2>
  ${contentParts()}
  <h2 class="kit-h">등각 장면 (iso-kit)</h2>
  <section class="hw-plate"><div class="hw-plate-head"><span class="hw-label">장면 · fitScene + labelScale</span></div><div class="hw-scene kit-stage">${composedScene()}</div></section>
  <section class="hw-plate"><div class="hw-plate-head"><span class="hw-label">재질 · MAT</span></div><div class="kit-swatches">${materials()}</div></section>
  <section class="hw-plate"><div class="hw-plate-head"><span class="hw-label">장치</span></div><div class="kit-grid">${devices()}</div></section>
  <section class="hw-plate"><div class="hw-plate-head"><span class="hw-label">케이블과 경로</span></div>${cables()}</section>
  <section class="hw-plate"><div class="hw-plate-head"><span class="hw-label">토큰 · LED</span></div>${tokens()}</section>
</div>`;
}

function consoleView() {
  return `
<div class="hw-page" style="--p1:#3b6fe0;--p2:#13896a;--p3:#8456cf">
  <header class="hw-topbar">
    <div class="hw-brand"><h1>CPU 스케줄링 탐색기</h1></div>
    <div class="hw-context"><span class="hw-label"><span class="hw-index">01</span> 대표 시나리오</span><strong>하나의 CPU, 세 개의 작업</strong></div>
    <div class="hw-actions">
      <a class="hw-key hw-key--sm" href="?">키트</a>
      <button class="hw-key hw-key--sm hw-key--icon" aria-label="테마"><svg viewBox="0 0 24 24"><path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/></svg></button>
    </div>
  </header>
  <main class="hw-console">
    <section class="hw-plate hw-stage">
      <div class="hw-plate-head">
        <span class="hw-label"><span class="hw-index">A</span> 스케줄러</span>
        <span class="hw-tag">단일 코어</span>
        <span class="hw-lcd">0<small>MS</small></span>
      </div>
      <div class="hw-scene">${composedScene()}</div>
      <div class="hw-plate-foot"><span class="hw-led is-on"></span> P1 실행 중 · 할당량 2ms 남음</div>
    </section>
    <section class="hw-plate hw-deck">
      <div class="hw-field">
        <span class="hw-label">배정 방식</span>
        <div class="hw-seg" role="group"><button aria-pressed="true">라운드 로빈</button><button aria-pressed="false">FCFS</button></div>
      </div>
      <div class="hw-field" style="width:200px">
        <span class="hw-label">할당량 <span class="hw-mono" style="margin-inline-start:auto;color:var(--ink)">2 ms</span></span>
        <input class="hw-slider" type="range" min="1" max="5" value="2" />
        <div class="hw-ticks"><span>1</span><span>5</span></div>
      </div>
      <div class="hw-field">
        <span class="hw-label">재생</span>
        <div class="hw-transport">
          <button class="hw-key hw-key--icon" aria-label="처음으로"><svg viewBox="0 0 24 24"><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/></svg></button>
          <button class="hw-key hw-key--accent" style="min-width:120px"><svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7z"/></svg>재생</button>
          <button class="hw-key">다음 사건</button>
        </div>
      </div>
      <button class="hw-switch" role="switch" aria-checked="true">핵심 장면에서 멈추기</button>
    </section>
    <aside class="hw-plate hw-side">
      <div class="hw-plate-head"><span class="hw-label"><span class="hw-index">B</span> 지금 일어나는 일</span><span class="hw-label">1 / 7</span></div>
      <div class="hw-plate-body">
        <div class="hw-section">
          <span class="hw-label">핵심 장면 1 · 0MS</span>
          <h2 class="hw-title" style="margin-top:6px">한 번에 하나, 차례로 실행</h2>
          <p class="hw-text" style="margin-top:10px">CPU는 한 번에 한 작업만 실행합니다. 라운드 로빈은 한 차례에 최대 2ms를 주고, 작업이 남으면 준비 큐 뒤에서 다음 차례를 기다리게 합니다.</p>
        </div>
        <div class="hw-section"><div class="hw-note hw-note--accent">작업의 전체 CPU 시간, 이번 CPU 구간, 한 차례의 시간 할당량은 서로 다릅니다.</div></div>
      </div>
    </aside>
    <section class="hw-plate hw-records">
      <div class="hw-plate-head"><div class="hw-tabs" role="tablist"><button role="tab" aria-selected="true">실행 시간표</button><button role="tab" aria-selected="false">사건 기록</button></div></div>
      <div class="hw-plate-body">
        <table class="hw-table"><thead><tr><th>시각</th><th>작업</th><th>일어난 일</th></tr></thead>
        <tbody><tr aria-current="true"><td class="hw-mono">0ms</td><td>P1</td><td>도착 → 준비 큐</td></tr><tr><td class="hw-mono">0ms</td><td>P1</td><td>CPU 배정</td></tr></tbody></table>
      </div>
    </section>
  </main>
  <footer class="hw-footer"><span>조작: <kbd>Space</kbd> 재생·정지 <kbd>R</kbd> 처음으로</span><span>학습 근거 OSTEP 7장</span></footer>
</div>`;
}

document.querySelector("#app").outerHTML = q.get("view") === "console" ? consoleView() : showcase();
bindSliders(document);
for (const svg of document.querySelectorAll(".kit-stage-svg")) labelScale(svg);
// Tokens drawn with place() can travel; the composed scene draws them in place.
void place; void LABEL;
