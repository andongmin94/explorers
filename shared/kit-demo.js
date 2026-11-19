// Reference console built only from the shared kit. Open /shared/kit.html
// (add ?theme=dark or ?explorer=memory to try other looks). Every explorer
// page follows this structure.
import "./theme.css";
import "./hw.css";
import "./iso.js";
import { bindSliders } from "./hw.js";
import { callout, chip, defs, fitViewBox, floor, floorPath, place, ramStick, ssd, token } from "./iso-kit.js";

const q = new URLSearchParams(location.search);
if (q.get("theme")) document.documentElement.dataset.theme = q.get("theme");
if (q.get("explorer")) document.documentElement.dataset.explorer = q.get("explorer");

const ram = ramStick({ x: 0, y: 6, length: 7, label: "READY QUEUE" });
const cpu = chip({ x: 10, y: 2, size: 5 });
const disk = ssd({ x: 18, y: 7, w: 5, d: 3.4, label: "I/O" });

const scene = `<svg viewBox="${fitViewBox([[-1, -1, 0], [25, -1, 0], [25, 13, 0], [-1, 13, 0], [12, 4, 4]], 30)}" role="img" aria-label="CPU 스케줄러 장면">
  ${defs()}
  ${floor({ x: -1, y: -1, w: 26, d: 14 })}
  ${floorPath([[7.5, 7.5], [10, 7.5], [10, 6]], { cls: "is-active" })}
  ${floorPath([[15.5, 6], [18, 6], [18, 8]], { dashed: true })}
  ${floorPath([[19, 10.6], [19, 12], [3, 12], [3, 9.4]], { dashed: true })}
  ${ram.svg}
  ${cpu.svg}
  ${disk.svg}
  ${callout({ x: 3.5, y: 6, z: 2, dx: -10, dy: -70, title: "준비 큐", sub: "READY · FIFO" })}
  ${callout({ x: 12.5, y: 4.5, z: 0.8, dx: 0, dy: -90, title: "CPU", sub: "ONE AT A TIME" })}
  ${callout({ x: 20.5, y: 8.7, z: 0.5, dx: 20, dy: -70, title: "입출력", sub: "RUNS IN PARALLEL" })}
  <g id="tokens">
    <g class="slot" data-id="P1">${token({ id: "P1", color: "var(--p1)" })}</g>
    <g class="slot" data-id="P2">${token({ id: "P2", color: "var(--p2)" })}</g>
    <g class="slot" data-id="P3">${token({ id: "P3", color: "var(--p3)" })}</g>
  </g>
</svg>`;

document.querySelector("#app").outerHTML = `
<div class="hw-page" style="--p1:#3b6fe0;--p2:#13896a;--p3:#8456cf">
  <header class="hw-topbar">
    <div class="hw-brand"><h1>CPU 스케줄링 탐색기</h1></div>
    <div class="hw-context"><span class="hw-label"><span class="hw-index">01</span> 대표 시나리오</span><strong>하나의 CPU, 세 개의 작업</strong></div>
    <div class="hw-actions">
      <button class="hw-key hw-key--sm">결과 비교</button>
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
      <div class="hw-scene">${scene}</div>
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
          <button class="hw-key hw-key--icon" aria-label="이전"><svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg></button>
          <button class="hw-key hw-key--accent" style="min-width:120px"><svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7z"/></svg>재생</button>
          <button class="hw-key hw-key--icon" aria-label="다음"><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></button>
          <button class="hw-key">다음 사건</button>
          <button class="hw-key hw-key--icon hw-mono">1×</button>
        </div>
      </div>
      <div class="hw-seek"><span class="hw-label">0MS</span><input class="hw-slider" type="range" min="0" max="20" value="0"/><span class="hw-label">20MS</span></div>
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
        <div class="hw-section">
          <span class="hw-label">이번 시각의 사건</span>
          <ul class="hw-list"><li><span class="hw-led is-on" style="--led:var(--p1)"></span>P1 도착 → 준비 큐</li><li><span class="hw-led is-on" style="--led:var(--p1)"></span>P1 CPU 배정</li></ul>
        </div>
        <div class="hw-section">
          <div class="hw-note hw-note--accent">작업의 전체 CPU 시간, 이번 CPU 구간, 한 차례의 시간 할당량은 서로 다릅니다.</div>
        </div>
        <div class="hw-section">
          <span class="hw-label">핵심 장면으로 이동</span>
          <div class="hw-list">
            <button aria-current="true"><span class="hw-index">01</span>하나의 CPU, 세 개의 작업<span class="hw-mono hw-muted" style="margin-inline-start:auto">0ms</span></button>
            <button><span class="hw-index">02</span>할당량이 끝나면 차례 넘기기<span class="hw-mono hw-muted" style="margin-inline-start:auto">2ms</span></button>
            <button><span class="hw-index">03</span>입출력 중에는 다른 작업 실행<span class="hw-mono hw-muted" style="margin-inline-start:auto">4ms</span></button>
          </div>
        </div>
        <div class="hw-section"><button class="hw-key" style="width:100%">다음 실행, 먼저 맞혀보기 →</button></div>
      </div>
    </aside>

    <section class="hw-plate hw-records">
      <div class="hw-plate-head"><div class="hw-tabs" role="tablist"><button role="tab" aria-selected="true">실행 시간표</button><button role="tab" aria-selected="false">사건 기록</button><button role="tab" aria-selected="false">작업별 지표</button></div><span class="hw-label">기록을 눌러 그 순간으로 이동</span></div>
      <div class="hw-plate-body hw-scroll">
        <table class="hw-table"><thead><tr><th>시각</th><th>작업</th><th>일어난 일</th></tr></thead>
        <tbody><tr data-time="0" aria-current="true"><td class="hw-mono">0ms</td><td>P1</td><td>도착 → 준비 큐</td></tr><tr data-time="0"><td class="hw-mono">0ms</td><td>P1</td><td>CPU 배정</td></tr><tr data-time="1"><td class="hw-mono">1ms</td><td>P2</td><td>도착 → 준비 큐</td></tr></tbody></table>
      </div>
    </section>
  </main>
  <footer class="hw-footer"><span>조작: <kbd>Space</kbd> 재생·정지 <kbd>←</kbd><kbd>→</kbd> 1ms 이동 <kbd>R</kbd> 처음으로</span><span>학습 근거 OSTEP 7장</span></footer>
</div>`;

bindSliders(document);
const slots = { P1: [12.5, 4.5, cpu.top], P2: [2.2, 7.3, 0.45], P3: [4.2, 7.3, 0.45] };
for (const g of document.querySelectorAll("#tokens .slot")) place(g, ...slots[g.dataset.id]);
