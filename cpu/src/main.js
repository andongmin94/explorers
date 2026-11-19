import "../../shared/theme.css";
import "../../shared/hw.css";
import "./styles.css";
import "../../shared/switcher.js";
import "../../shared/iso.js";
import { bindSliders, icon, syncSlider } from "../../shared/hw.js";
import { paginate, plateTabs, rowWindow } from "../../shared/fit.js";
import { DEFAULT_PROCESSES, simulate } from "./engine.js";
import { createSchedulerScene } from "./scene.js";
import {
  describeChapter,
  comparisonSummary,
  buildMilestones,
  buildPrediction,
  eventLabel,
  frameAtMove,
  momentNotes,
  processDetails,
  quantumSweep,
} from "./lesson.js";
import { josa } from "./josa.js";

const number = (value) => Number(value.toFixed(2)).toLocaleString("ko-KR");
const ledFor = (id) => `<span class="hw-led is-on" style="--led:var(--${id ? id.toLowerCase() : "muted"})"></span>`;
const recipe = (p) =>
  p.cpu.map((c, i) => `${i ? `입출력 ${p.io[i - 1]} → ` : ""}CPU ${c}`).join(" → ");
const app = document.querySelector("#app");

let algorithm = "rr",
  quantum = 2,
  speed = 1,
  time = 0,
  playing = false;
let result = simulate({ algorithm, quantum });
let accumulator = 0,
  lastTick = 0,
  animationId = 0,
  quiz = null;
let guided = true,
  transitioning = false,
  motionPaused = false,
  resumeAutomatically = false,
  movingEvent = null,
  displayedFrame = result.frames[0],
  transitionId = 0,
  selectedProcess = null;
const STEP_DURATION = 1600;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

app.outerHTML = `
<div class="hw-page cpu-page" id="app">
  <header class="hw-topbar">
    <div class="hw-brand"><h1>CPU 스케줄링 탐색기</h1><p>보면서 이해하는 운영체제</p></div>
    <div class="hw-context"><span class="hw-label"><span class="hw-index">01</span> 대표 시나리오</span><strong>하나의 CPU, 세 개의 작업</strong></div>
    <div class="hw-actions">
      <button class="hw-key hw-key--sm" data-action="compare">${icon("compare")}<span>결과 비교</span></button>
      <button class="hw-key hw-key--sm hw-key--icon" data-action="theme" aria-label="어두운 테마로 전환"></button>
    </div>
  </header>

  <main class="hw-console">
    <section class="hw-plate hw-stage" aria-labelledby="stage-label">
      <div class="hw-plate-head">
        <span class="hw-label" id="stage-label"><span class="hw-index">A</span> 스케줄러</span>
        <span class="hw-tag" id="algo-tag">RR · 2ms</span>
        <span class="hw-lcd" role="timer" aria-label="시뮬레이션 시각"><span id="clock">0</span><small>MS</small></span>
      </div>
      <div class="hw-scene cpu-scene" id="scene" role="group" tabindex="-1"></div>
      <div class="hw-plate-foot" aria-hidden="true"><span class="hw-led is-on" id="status-led"></span><span id="status-text"></span></div>
    </section>

    <section class="hw-plate hw-deck" aria-label="실험 조건과 재생">
      <div class="hw-field cpu-algorithm">
        <span class="hw-label" id="algorithm-label">CPU 배정 방식</span>
        <div class="hw-seg" role="group" aria-labelledby="algorithm-label"><button data-algorithm="rr" aria-pressed="true">라운드 로빈</button><button data-algorithm="fcfs" aria-pressed="false">FCFS</button></div>
      </div>
      <div class="hw-field cpu-quantum">
        <label class="hw-label" for="quantum">시간 할당량 <output class="hw-mono" id="quantum-value" for="quantum">2 MS</output></label>
        <input class="hw-slider" id="quantum" type="range" min="1" max="5" step="1" value="2" aria-describedby="quantum-help" />
        <div class="hw-ticks" id="quantum-help"><span>1</span><span>5</span></div>
      </div>
      <div class="hw-field cpu-transport">
        <span class="hw-label">재생</span>
        <div class="hw-transport">
          <button class="hw-key hw-key--icon" data-action="reset" title="처음으로 (R)" aria-label="처음으로">${icon("reset")}</button>
          <button class="hw-key hw-key--icon" data-action="back" title="1ms 이전 (←)" aria-label="1ms 이전">${icon("back")}</button>
          <button class="hw-key hw-key--accent cpu-play" data-action="play"></button>
          <button class="hw-key hw-key--icon" data-action="step" title="1ms 다음 (→)" aria-label="1ms 다음">${icon("next")}</button>
          <button class="hw-key" data-action="event">다음 사건</button>
          <button class="hw-key hw-key--icon hw-mono" data-action="speed" aria-label="재생 속도 1배, 눌러서 변경">1×</button>
        </div>
      </div>
      <div class="hw-seek">
        <span class="hw-label">0</span>
        <input class="hw-slider" id="seek" type="range" min="0" step="1" value="0" aria-label="시뮬레이션 시각" />
        <span class="hw-label" id="seek-end">20MS</span>
      </div>
      <div class="cpu-guided">
        <button class="hw-switch" data-action="guided" role="switch" aria-checked="true">핵심 장면에서 멈추기</button>
        <span class="hw-muted" id="playback-hint"></span>
      </div>
    </section>

    <aside class="hw-plate hw-side" aria-labelledby="side-label">
      <div class="hw-plate-head cpu-side-head">
        <span class="hw-label" id="side-label"><span class="hw-index">B</span><span class="cpu-sr">학습 패널</span></span>
        <div class="hw-tabs" role="tablist" aria-labelledby="side-label">
          <button type="button" data-tab="now" aria-selected="true">해설</button>
          <button type="button" data-tab="scenes">장면</button>
          <button type="button" data-tab="process">작업</button>
          <button type="button" data-tab="rules">규칙</button>
        </div>
      </div>
      <div class="hw-plate-body hw-fit" data-panel="now">
        <div class="hw-fill cpu-pages" id="now-pages">
          <div id="explanation" tabindex="-1" aria-live="polite" aria-atomic="true"></div>
          <div>
            <span class="hw-label">이번 시각의 사건</span>
            <ul class="hw-list cpu-events" id="current-events"></ul>
          </div>
          <div><p class="hw-note hw-note--accent" id="insight"></p></div>
        </div>
        <div class="cpu-side-actions">
          <button class="hw-key cpu-wide" data-action="predict"></button>
          <button class="hw-key cpu-wide" data-action="compare" data-conclusion hidden>다른 방식과 비교 ${icon("arrow")}</button>
          <div class="hw-pager" id="now-pager"></div>
        </div>
      </div>
      <div class="hw-plate-body hw-fit" data-panel="scenes" hidden>
        <span class="hw-label cpu-panel-label">핵심 장면으로 이동 <span class="hw-muted" id="scene-progress"></span></span>
        <nav class="hw-list hw-fill cpu-milestones" id="milestones" aria-label="핵심 학습 장면"></nav>
      </div>
      <div class="hw-plate-body hw-fit" data-panel="process" hidden>
        <div class="hw-seg cpu-process-pick" role="group" aria-label="자세히 볼 작업">${DEFAULT_PROCESSES.map((p) => `<button type="button" data-pick="${p.id}" aria-pressed="false">${ledFor(p.id)}${p.id}</button>`).join("")}</div>
        <div class="hw-fill cpu-pages" id="process-detail"></div>
      </div>
      <div class="hw-plate-body hw-fit" data-panel="rules" hidden>
        <span class="hw-label cpu-panel-label">이 실험의 규칙</span>
        <ul class="hw-list hw-fill cpu-rules" id="rules">
          <li>CPU는 하나이며 한 번에 한 작업만 실행합니다.</li>
          <li>CPU 구간(CPU 버스트)은 입출력 없이 계산하는 구간입니다. 작업은 CPU 구간과 입출력을 번갈아 거칩니다.</li>
          <li>선점은 실행 중인 작업에게서 CPU를 거두는 것입니다. 라운드 로빈은 할당량이 끝날 때만 선점합니다.</li>
          <li>도착·입출력 복귀는 실행 중인 작업을 선점하지 않습니다. 준비 큐 뒤에 줄을 섭니다.</li>
          <li>CPU 구간이 끝나는 시각에 할당량도 끝나면 구간 종료가 우선합니다. 작업은 입출력이나 완료로 갑니다.</li>
          <li>같은 시각에는 도착·입출력 복귀를 먼저 큐에 넣고, 할당량이 끝난 작업을 맨 뒤에 넣습니다.</li>
          <li>입출력은 CPU와 따로 진행됩니다. 여러 작업의 입출력이 겹칠 수 있습니다.</li>
          <li>문맥 교환(작업 전환) 비용은 0ms로 단순화했습니다.</li>
          <li>대기 시간(준비 큐)에 입출력 대기는 포함하지 않습니다. 반환 시간은 완료 시각 − 도착 시각입니다.</li>
          <li>FCFS는 긴 CPU 구간이 앞에 서면 짧은 작업들이 줄줄이 기다리는 호위 효과(convoy effect)가 생길 수 있습니다.</li>
        </ul>
      </div>
    </aside>

    <section class="hw-plate hw-records" aria-label="관찰 기록">
      <div class="hw-plate-head">
        <div class="hw-tabs" role="tablist" aria-label="관찰 기록">
          <button id="tab-timeline" role="tab" aria-selected="true" aria-controls="record-timeline" data-record="timeline">실행 시간표</button>
          <button id="tab-log" role="tab" aria-selected="false" aria-controls="record-log" data-record="log" tabindex="-1">사건 기록 <span class="hw-mono hw-muted" id="log-count"></span></button>
          <button id="tab-metrics" role="tab" aria-selected="false" aria-controls="record-metrics" data-record="metrics" tabindex="-1">작업별 지표</button>
        </div>
        <span class="hw-label cpu-records-hint">기록을 눌러 그 순간으로 이동</span>
      </div>
      <div class="hw-plate-body" id="record-timeline" role="tabpanel" aria-labelledby="tab-timeline">
        <div class="hw-screen cpu-tl-screen">
          <div class="hw-screen-head cpu-tl-head">
            <span class="cpu-legend"><i class="cpu-swatch is-run"></i>CPU 실행</span>
            <span class="cpu-legend"><i class="cpu-swatch is-ready"></i>준비 큐 대기</span>
            <span class="cpu-legend"><i class="cpu-swatch is-io"></i>입출력 대기</span>
            <span class="cpu-legend"><i class="cpu-swatch is-idle"></i>CPU 유휴</span>
            <span class="is-on cpu-usage" id="live-usage"></span>
          </div>
          <div class="cpu-tl-scroll"><div id="timeline"></div></div>
        </div>
      </div>
      <div class="hw-plate-body" id="record-log" role="tabpanel" aria-labelledby="tab-log" hidden>
        <div class="hw-scroll cpu-log-box"><table class="hw-table"><thead><tr><th>시각</th><th>작업</th><th>일어난 일</th></tr></thead><tbody id="event-log"></tbody></table></div>
      </div>
      <div class="hw-plate-body" id="record-metrics" role="tabpanel" aria-labelledby="tab-metrics" hidden>
        <div class="cpu-table-scroll"><table class="hw-table"><thead><tr><th>작업 · 눌러서 자세히</th><th>남은 CPU</th><th title="도착부터 처음 CPU를 받기까지">최초 응답</th><th title="준비 큐에서 기다린 누적 시간">대기 시간(준비 큐)</th><th title="도착부터 완료까지 · 작업이 끝나면 표시">반환 시간</th></tr></thead><tbody id="metrics"></tbody></table></div>
      </div>
    </section>
  </main>

  <footer class="hw-footer">
    <span>조작: <kbd>Space</kbd> 재생·정지 <kbd>←</kbd><kbd>→</kbd> 1ms 이동 <kbd>R</kbd> 처음으로</span>
    <span>학습 근거 <a href="https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf" target="_blank" rel="noreferrer">OSTEP 7장 ↗</a> · <a href="https://cs341.cs.illinois.edu/coursebook/Scheduling" target="_blank" rel="noreferrer">Illinois CS341 ↗</a></span>
  </footer>

  <dialog id="prediction-dialog" class="hw-dialog" aria-labelledby="prediction-title">
    <div class="hw-plate-head"><span class="hw-label"><span class="hw-index">?</span> 예측 → 확인 → 이해</span><button class="hw-key hw-key--sm hw-key--icon" data-action="close-dialog" aria-label="닫기">${icon("close")}</button></div>
    <div id="prediction-body"></div>
  </dialog>
  <dialog id="comparison-dialog" class="hw-dialog cpu-compare" aria-labelledby="comparison-title">
    <div class="hw-plate-head"><span class="hw-label"><span class="hw-index">C</span> 같은 입력으로 공정하게 비교</span><button class="hw-key hw-key--sm hw-key--icon" data-action="close-dialog" aria-label="닫기">${icon("close")}</button></div>
    <div id="comparison-body"></div>
  </dialog>
</div>`;

const root = document.querySelector("#app");
const $ = (selector) => root.querySelector(selector);
const scene = createSchedulerScene($("#scene"), DEFAULT_PROCESSES, (frame, view, move) =>
  presentFrame(frameAtMove(frame, view, move), move),
);

const sidePanel = plateTabs($(".hw-side"));
const nowPager = paginate($("#now-pages"), { label: "해설", pager: $("#now-pager") });
const scenePager = paginate($("#milestones"), { label: "장면" });
const processPager = paginate($("#process-detail"), { label: "상세" });
paginate($("#rules"), { label: "규칙" });
let shownMilestone = null;
const logWindow = rowWindow($(".cpu-log-box"), $("#event-log"), { current: () => $("#event-log tr[aria-current]") });
// Content that changes starts again on its first page.
function refill(pager, el, html) {
  if (el.dataset.html === html) return;
  el.dataset.html = html;
  el.innerHTML = html;
  pager.refresh();
  pager.show(0);
}

function updateThemeButton() {
  const dark = document.documentElement.dataset.theme === "dark";
  const button = $('[data-action="theme"]');
  button.innerHTML = icon(dark ? "sun" : "moon");
  button.setAttribute("aria-label", `${dark ? "밝은" : "어두운"} 테마로 전환`);
}

function updateSettings() {
  root.querySelectorAll("[data-algorithm]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.algorithm === algorithm)));
  const rr = algorithm === "rr";
  $("#algo-tag").textContent = rr ? `RR · ${quantum}ms` : "FCFS · 비선점";
  $("#quantum").disabled = !rr;
  $("#quantum").value = quantum;
  $("#quantum-value").textContent = rr ? `${quantum} MS` : "사용 안 함";
  $(".cpu-quantum").classList.toggle("is-disabled", !rr);
  $("#seek").max = result.stats.makespan;
  $("#seek-end").textContent = `${result.stats.makespan}MS`;
  $("#milestones").innerHTML = buildMilestones(result)
    .map(
      (m, i) =>
        `<button data-time="${m.time}" data-milestone><span class="hw-index">${String(i + 1).padStart(2, "0")}</span><span class="cpu-grow">${m.title}</span><span class="hw-mono hw-muted">${m.time}ms</span></button>`,
    )
    .join("");
  scenePager.refresh();
  bindSliders(root);
  syncSlider($("#quantum"));
}

const stateNames = {
  new: "도착 예정",
  ready: "준비 큐에서 대기",
  running: "CPU 실행 중",
  blocked: "입출력 대기",
  done: "완료",
};
const moveExplanations = {
  arrive: "도착한 작업이 준비 큐 뒤에 합류합니다.",
  unblock: "입출력이 끝난 작업이 준비 큐 뒤에 합류합니다.",
  preempt: "시간 할당량을 다 쓴 작업이 진행한 계산을 보존한 채 준비 큐 뒤로 이동합니다.",
  dispatch: "준비 큐 맨 앞(가장 먼저 줄을 선) 작업이 CPU로 이동합니다.",
  block: "현재 CPU 구간을 마친 작업이 입출력 장치로 이동합니다.",
  complete: "마지막 CPU 구간을 마친 작업이 완료 칸으로 이동합니다.",
};

function render(animate = false, previous = null) {
  const frame = result.frames[time];
  movingEvent = null;
  const motion = scene.update(frame, previous, {
    animate: animate && !reducedMotion.matches,
    speed,
    quantum: algorithm === "rr" ? quantum : null,
  });
  if (!movingEvent) presentFrame(frame);
  return motion;
}

function presentFrame(frame, move = null) {
  displayedFrame = frame;
  movingEvent = move;
  $("#scene").setAttribute(
    "aria-label",
    `${time}밀리초. ${move ? `${eventLabel(move)} 이동 중` : `CPU ${frame.running || "대기"}`}. 준비 큐 ${frame.ready.join(", ") || "없음"}. 입출력 ${frame.blocked.map((b) => b.id).join(", ") || "없음"}. 완료 ${frame.completed.join(", ") || "없음"}. 작업을 선택하면 상세 정보를 볼 수 있습니다.`,
  );
  $("#clock").textContent = time;
  $("#seek").value = time;
  $("#seek").setAttribute("aria-valuetext", `${time}밀리초, 전체 ${result.stats.makespan}밀리초`);
  syncSlider($("#seek"));

  const description = describeChapter(frame, result);
  if (move) {
    const order = frame.events.length + 1;
    description.eyebrow = `${time} ms · 이번 시각의 사건 ${order}/${result.frames[time].events.length}`;
    description.title = eventLabel(move);
    description.body = moveExplanations[move.type];
    description.insight = `이동 직전 준비 큐 · ${frame.ready.join(" → ") || "비어 있음"}`;
  }
  const visibleEvents = move ? [...frame.events, move] : frame.events;
  const notes = move ? [] : momentNotes(frame, result);
  const events = (visibleEvents.length
    ? visibleEvents
        .map((e) => `<li>${ledFor(e.id)}<span>${eventLabel(e)}${e === move ? '<span class="hw-muted"> · 이동 중</span>' : ""}</span></li>`)
        .join("")
    : `<li>${ledFor(frame.running)}<span>${frame.running ? `${josa(frame.running, "가")} 다음 사건까지 실행을 이어갑니다.` : "입출력이 끝나기를 기다립니다."}</span></li>`) +
    notes.map((note) => `<li class="cpu-event-note"><span class="hw-muted">${note}</span></li>`).join("");
  refill(
    nowPager,
    $("#now-pages"),
    `<div id="explanation" tabindex="-1" aria-live="polite" aria-atomic="true"><span class="hw-label">${description.eyebrow}</span><h2 class="hw-title">${description.title}</h2><p class="hw-text">${description.body}</p></div>
    <div><span class="hw-label">이번 시각의 사건</span><ul class="hw-list cpu-events" id="current-events">${events}</ul></div>
    <div><p class="hw-note hw-note--accent" id="insight">${description.insight}</p></div>`,
  );

  const milestones = buildMilestones(result);
  const active = Math.max(0, milestones.findLastIndex((m) => m.time <= time));
  root.querySelectorAll("[data-milestone]").forEach((b, i) => {
    b.classList.toggle("is-done", i < active);
    if (i === active) b.setAttribute("aria-current", "true");
    else b.removeAttribute("aria-current");
  });
  $("#scene-progress").textContent = `· ${active + 1} / ${milestones.length}`;
  const activeButton = root.querySelectorAll("[data-milestone]")[active];
  if (activeButton !== shownMilestone) scenePager.showItem((shownMilestone = activeButton));
  const finished = time === result.stats.makespan;
  const hasNext = result.decisions.some((d) => d.time > time && d.candidates.length > 1);
  $('[data-action="predict"]').innerHTML = `${hasNext ? "다음 실행, 먼저 맞혀보기" : "앞선 장면에서 다시 예측"} ${icon("arrow")}`;
  $('[data-action="predict"]').hidden = finished;
  $("[data-conclusion]").hidden = !finished;
  renderTimeline();
  renderLog();
  renderMetrics();
  renderProcessDetail();
  updateControls();
}

function renderProcessDetail() {
  root.querySelectorAll("#metrics [data-process]").forEach((r) => (r.ariaCurrent = r.dataset.process === selectedProcess ? "true" : null));
  root.querySelectorAll("[data-pick]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.pick === selectedProcess)));
  scene.select(selectedProcess);
  if (!selectedProcess)
    return refill(processPager, $("#process-detail"), `<p class="hw-text hw-muted">작업 키를 누르거나, 장면의 작업이나 작업별 지표의 행을 누르면 그 작업의 순서와 시간 분해를 볼 수 있습니다.</p>`);
  const p = DEFAULT_PROCESSES.find((entry) => entry.id === selectedProcess);
  const detail = processDetails(displayedFrame, result, selectedProcess);
  if (movingEvent?.id === selectedProcess) detail.body = `${eventLabel(movingEvent)} 이동 중입니다.`;
  const status = { past: "완료", current: "현재 구간", future: "예정" };
  refill(processPager, $("#process-detail"), `
    <div class="cpu-detail-head">
      <span class="hw-label">${p.id} · ${p.arrival}ms 도착</span>
      <h2 class="hw-title">${p.name}</h2>
      <p class="hw-text">${detail.body}</p>
    </div>
    <div>
      <span class="hw-label">작업이 끝나기까지의 순서</span>
      <ol class="hw-list cpu-phases">${detail.phases
        .map(
          (ph, i) => `<li class="is-${ph.status}" style="--led:var(--${p.id.toLowerCase()})"><span class="hw-index">${i + 1}</span><span class="cpu-grow"><span>${ph.kind === "cpu" ? "CPU 실행" : "입출력"} <span class="hw-mono hw-muted">${ph.used} / ${ph.total}ms</span></span><span class="cpu-meter" aria-hidden="true"><i style="width:${(ph.used / ph.total) * 100}%"></i></span></span><span class="hw-label">${status[ph.status]}</span></li>`,
        )
        .join("")}</ol>
    </div>
    <div>
      <span class="hw-label">시간 분해</span>
      <dl class="hw-list cpu-detail-metrics">${detail.metrics
        .map((m) => `<div><dt><span>${m.label}</span><span class="hw-muted">${m.help}</span></dt><dd class="hw-mono">${m.value}</dd></div>`)
        .join("")}</dl>
    </div>
    <div><p class="hw-note">${detail.insight}</p></div>`);
}

function updateControls() {
  const frame = displayedFrame;
  const finished = time === result.stats.makespan;
  const canPause = playing || (transitioning && !motionPaused);
  let led = frame.running,
    text;
  if (transitioning) {
    text = frame.running ? `${josa(frame.running, "가")} CPU 사용 중 · 작업 이동 중` : "CPU 비어 있음 · 작업 이동 중";
  } else if (frame.running) {
    text = `${frame.running} 실행 중 · ${algorithm === "rr" ? `할당량 ${frame.quantumLeft}ms 남음` : "입출력 요청 또는 완료까지"}`;
  } else {
    text = finished ? "세 작업을 모두 처리했습니다" : "CPU 유휴 · 준비된 작업이 없습니다";
  }
  $("#status-led").style.setProperty("--led", led ? `var(--${led.toLowerCase()})` : "var(--hw-led-off)");
  $("#status-led").classList.toggle("is-on", !!led);
  $("#status-text").textContent = text;

  $("#scene").setAttribute("aria-busy", String(transitioning));
  const play = $('[data-action="play"]');
  play.innerHTML = `${icon(canPause ? "pause" : finished && !transitioning ? "replay" : "play")}<span>${canPause ? "일시정지" : finished && !transitioning ? "다시 재생" : time === 0 ? "학습 시작" : "이어서 재생"}</span>`;
  play.setAttribute("aria-label", canPause ? "일시정지" : "재생");
  $('[data-action="back"]').disabled = time === 0;
  $('[data-action="step"]').disabled = $('[data-action="event"]').disabled = finished;
  $('[data-action="guided"]').setAttribute("aria-checked", String(guided));
  $("#playback-hint").textContent = transitioning
    ? motionPaused
      ? "이동을 멈췄습니다. 이어서 재생할 수 있습니다."
      : "작업이 이동 중입니다."
    : finished
      ? "학습 완료 · 결과를 비교해 보세요."
      : playing
        ? guided
          ? "다음 핵심 장면에서 자동으로 멈춥니다."
          : "전체 과정을 연속으로 재생합니다."
        : time === 0
          ? "재생하면 첫 장면부터 따라갑니다."
          : "장면을 살펴본 뒤 이어서 재생하세요.";
}

function seek(next, animate = false) {
  pause();
  moveTo(Math.max(0, Math.min(result.stats.makespan, next)), animate);
  if (time === 0 && matchMedia("(max-width: 759px)").matches) $(".hw-stage").scrollIntoView({ block: "start", behavior: "instant" });
}
function pause() {
  playing = false;
  motionPaused = transitioning;
  cancelAnimationFrame(animationId);
  scene.pause();
  updateControls();
}
function moveTo(next, animate) {
  const previous = result.frames[time];
  const autoAdvance = playing;
  resumeAutomatically = autoAdvance;
  const token = ++transitionId;
  time = next;
  accumulator = 0;
  transitioning = animate && !reducedMotion.matches;
  motionPaused = false;
  const motion = render(transitioning, previous);
  scene.setProgress(0);
  scene.resume();
  motion.then(() => {
    if (token !== transitionId) return;
    transitioning = false;
    if (movingEvent) presentFrame(result.frames[time]);
    lastTick = performance.now();
    if (autoAdvance && playing && (time === result.stats.makespan || (guided && buildMilestones(result).some((m) => m.time === time)))) pause();
    updateControls();
  });
}
function tick(now) {
  if (!playing) return;
  if (!transitioning) accumulator += Math.min(now - lastTick, 250) * speed;
  lastTick = now;
  if (!transitioning && accumulator >= STEP_DURATION && time < result.stats.makespan) moveTo(time + 1, true);
  if (!transitioning) scene.setProgress(accumulator / STEP_DURATION);
  animationId = requestAnimationFrame(tick);
}
function togglePlay() {
  if (playing || (transitioning && !motionPaused)) return pause();
  if (transitioning && motionPaused && !resumeAutomatically) {
    motionPaused = false;
    scene.resume();
    updateControls();
    return;
  }
  if (time === result.stats.makespan && !transitioning) seek(0);
  playing = true;
  motionPaused = false;
  scene.resume();
  lastTick = performance.now();
  updateControls();
  animationId = requestAnimationFrame(tick);
}
function reconfigure() {
  pause();
  ++transitionId;
  transitioning = false;
  result = simulate({ algorithm, quantum });
  time = 0;
  accumulator = 0;
  updateSettings();
  render();
}

/* ---------- Records ---------- */

function timelineBar(start, end, classes, label, title) {
  const visibleEnd = Math.min(end, time);
  if (visibleEnd <= start) return "";
  const observed = title.replace(`${start}–${end}ms`, `${start}–${visibleEnd}ms`) + (visibleEnd < end ? " · 진행 중" : "");
  const total = result.stats.makespan;
  return `<button class="cpu-bar ${classes}" style="left:${(start / total) * 100}%;width:${((visibleEnd - start) / total) * 100}%" data-time="${start}" title="${observed}" aria-label="${observed}">${label}</button>`;
}
function renderTimeline() {
  const total = result.stats.makespan;
  const ticks = Array.from(
    { length: total + 1 },
    (_, t) => `<button class="cpu-tick" data-time="${t}" style="left:${(t / total) * 100}%"${t === time ? ' aria-current="true"' : ""} aria-label="${t}밀리초로 이동">${t}</button>`,
  ).join("");
  const cpu = result.segments
    .map((s) => timelineBar(s.start, s.end, s.id ? `is-run is-${s.id.toLowerCase()}` : "is-idle", s.id || "유휴", `${s.start}–${s.end}ms · ${s.id || "CPU 유휴"}`))
    .join("");
  const rows = DEFAULT_PROCESSES.map((p) => {
    const runs = [];
    for (let t = 0; t < total; t++) {
      const state = result.frames[t].states[p.id].status;
      if (!["running", "blocked", "ready"].includes(state)) continue;
      const last = runs.at(-1);
      if (last?.state === state && last.end === t) last.end++;
      else runs.push({ start: t, end: t + 1, state });
    }
    const kind = { running: "is-run", ready: "is-ready", blocked: "is-io" };
    const bars = runs
      .map((s) => timelineBar(s.start, s.end, `${kind[s.state]} is-${p.id.toLowerCase()}`, s.state === "blocked" ? "입출력" : "", `${p.id} · ${s.start}–${s.end}ms · ${stateNames[s.state]}`))
      .join("");
    return `<span class="hw-label">${ledFor(p.id)}${p.id}</span><div class="cpu-lane">${bars}</div>`;
  }).join("");
  $("#timeline").innerHTML = `<div class="cpu-tl">
    <span class="hw-label">MS</span><div class="cpu-ticks">${ticks}</div>
    <span class="hw-label">CPU</span><div class="cpu-lane">${cpu}</div>
    ${rows}
    <i class="cpu-cursor" aria-hidden="true" style="--at:${time / total}"></i>
  </div>`;
  const busy = result.frames.slice(0, time).filter((f) => f.running).length;
  $("#live-usage").textContent = `경과 ${time}ms · CPU 실행 ${busy}ms · 유휴 ${time - busy}ms`;
}
function renderLog() {
  const entries = result.frames
    .slice(0, time)
    .concat(displayedFrame)
    .reverse()
    .flatMap((f) => f.events.map((e) => ({ t: f.t, e })));
  $("#event-log").innerHTML = entries
    .map(
      ({ t, e }) =>
        `<tr data-time="${t}"${t === time ? ' aria-current="true"' : ""}><td><button class="cpu-time-link hw-mono" data-time="${t}" aria-label="${t}ms 사건으로 이동">${t}ms</button></td><td class="cpu-nowrap">${ledFor(e.id)} ${e.id || "CPU"}</td><td>${eventLabel(e).replace(`${e.id} `, "")}</td></tr>`,
    )
    .join("");
  $("#log-count").textContent = entries.length;
  logWindow.refresh();
}
function renderMetrics() {
  const frame = displayedFrame;
  $("#metrics").innerHTML = DEFAULT_PROCESSES.map((p) => {
    const s = frame.states[p.id];
    const turnaround = s.finishedAt === null ? (s.arriving ? "도착 중" : s.status === "new" ? "도착 전" : "진행 중") : `${s.finishedAt - p.arrival}ms`;
    const remaining = s.status === "done" ? "완료" : `${s.cpuRemaining}ms${s.status === "blocked" ? ` · 입출력 ${s.ioRemaining}ms` : ""}`;
    return `<tr class="is-clickable" data-process="${p.id}"${p.id === selectedProcess ? ' aria-current="true"' : ""}><td><button class="cpu-process-link" data-process="${p.id}">${ledFor(p.id)}<span><b class="hw-mono">${p.id}</b> ${p.name}<span class="hw-muted hw-mono cpu-cell-help">${p.arrival}ms 도착 · ${recipe(p)}</span></span></button></td><td class="hw-mono">${remaining}</td><td class="hw-mono">${s.firstRun === null ? "아직 실행 전" : `${number(s.firstRun - p.arrival)}ms`}</td><td class="hw-mono">${s.readyWait}ms</td><td class="hw-mono">${turnaround}</td></tr>`;
  }).join("");
}

/* ---------- Dialogs ---------- */

function openPrediction() {
  pause();
  const prediction = buildPrediction(result, time);
  const { decision } = prediction;
  quiz = { ...prediction, answered: false, followAnswered: false };
  seek(prediction.beforeTime);
  $("#prediction-body").innerHTML = `
    <div class="hw-plate-body">
      <div class="hw-section">
        <span class="hw-label">${time}MS 장면에서 멈춤</span>
        <h2 class="hw-title" id="prediction-title">${decision.time}ms, 다음 CPU는 누구에게 돌아갈까요?</h2>
        <p class="hw-text hw-muted">실행 중인 작업의 남은 할당량·구간과 규칙을 근거로 ${decision.time}ms의 준비 큐를 직접 만들어 보세요.</p>
      </div>
      <div class="hw-section">
        <dl class="hw-list cpu-quiz-context">
          <div><dt class="hw-label">지금 CPU</dt><dd><b>${prediction.running || "유휴"}</b> <span class="hw-muted">${prediction.runningNote}</span></dd></div>
          <div><dt class="hw-label">준비 큐 · 앞 → 뒤</dt><dd><b>${prediction.ready.join(" → ") || "비어 있음"}</b></dd></div>
          <div><dt class="hw-label">${decision.time}ms에 들어오는 작업</dt><dd>${prediction.joined.join(" · ") || "도착·입출력 복귀 없음"}</dd></div>
        </dl>
      </div>
      <div class="hw-section">
        <span class="hw-label">${decision.time}ms에 CPU를 받을 작업</span>
        <div class="cpu-choices">${prediction.choices
          .map((id) => `<button class="hw-key" data-answer="${id}">${ledFor(id)}<span><b>${id}</b> ${DEFAULT_PROCESSES.find((p) => p.id === id).name}</span></button>`)
          .join("")}</div>
        <div id="quiz-feedback" aria-live="polite"></div>
      </div>
      <div class="hw-section" id="quiz-follow" hidden>
        <span class="hw-label">이어서 · 숫자로 예측</span>
        <p class="hw-text">${prediction.followUp.question}</p>
        <div class="cpu-choices cpu-choices--numbers">${prediction.followUp.choices.map((n) => `<button class="hw-key" data-number="${n}"><b class="hw-mono">${n}ms</b></button>`).join("")}</div>
        <div id="quiz-follow-feedback" aria-live="polite"></div>
      </div>
    </div>
    <div class="hw-plate-foot cpu-dialog-actions"><button class="hw-key hw-key--accent" data-action="quiz-continue" hidden>실제 이동을 보며 확인 ${icon("arrow")}</button></div>`;
  $("#prediction-dialog").showModal();
}
function markChoices(selector, attribute, correctValue, picked) {
  root.querySelectorAll(selector).forEach((b) => {
    const value = b.dataset[attribute];
    b.disabled = value !== correctValue && value !== picked;
    b.setAttribute("aria-disabled", "true");
    if (value === correctValue) b.insertAdjacentHTML("beforeend", '<span class="hw-tag">정답</span>');
    else if (value === picked) b.insertAdjacentHTML("beforeend", '<span class="hw-tag">내 선택</span>');
  });
}
function answerPrediction(answer) {
  if (quiz.answered) return;
  quiz.answered = true;
  const chosen = quiz.decision.chosen,
    correct = answer === chosen;
  markChoices("[data-answer]", "answer", chosen, answer);
  $("#quiz-feedback").innerHTML = `<div class="hw-note ${correct ? "hw-note--accent" : ""}"><div><p class="hw-heading">${correct ? "맞았습니다." : `실제 차례는 ${chosen}입니다.`}</p><p>${quiz.explanation}</p></div></div>`;
  // The feedback restates the queue, so the context makes room for the follow-up.
  $("#prediction-body .cpu-quiz-context").closest(".hw-section").hidden = true;
  $("#prediction-body .hw-section > .hw-text.hw-muted").hidden = true;
  $("#quiz-follow").hidden = false;
  $("[data-number]")?.focus();
}
function answerNumber(value) {
  if (!quiz.answered || quiz.followAnswered) return;
  quiz.followAnswered = true;
  const { answer, explanation } = quiz.followUp;
  markChoices("[data-number]", "number", String(answer), String(value));
  $("#quiz-follow-feedback").innerHTML = `<div class="hw-note ${Number(value) === answer ? "hw-note--accent" : ""}"><div><p>${Number(value) === answer ? "맞았습니다. " : ""}${explanation}</p></div></div>`;
  $('[data-action="quiz-continue"]').hidden = false;
  $('[data-action="quiz-continue"]').focus();
}

function comparisonTimeline(run, scale) {
  return `<div class="cpu-lane cpu-compare-lane">${run.segments
    .map(
      (s) =>
        `<span class="cpu-bar ${s.id ? `is-run is-${s.id.toLowerCase()}` : "is-idle"}" style="left:${(s.start / scale) * 100}%;width:${((s.end - s.start) / scale) * 100}%" title="${s.start}–${s.end}ms · ${s.id || "유휴"}">${s.end - s.start >= 2 ? s.id || "유휴" : ""}</span>`,
    )
    .join("")}</div>`;
}
function openComparison() {
  pause();
  const rr = simulate({ algorithm: "rr", quantum }),
    fcfs = simulate({ algorithm: "fcfs" });
  const scale = Math.max(rr.stats.makespan, fcfs.stats.makespan);
  const summary = comparisonSummary(rr, fcfs);
  const sweep = quantumSweep(simulate, DEFAULT_PROCESSES);
  const mark = (q, value) => (q === quantum ? `<b>${value}</b>` : value);
  const rows = [
    ["평균 최초 응답", "도착 → 첫 CPU 실행", "averageResponse", "ms"],
    ["평균 대기 시간(준비 큐)", "준비 큐에서 기다린 시간", "averageWaiting", "ms"],
    ["평균 반환 시간", "도착 → 완료", "averageTurnaround", "ms"],
    ["전체 완료 시각", "모든 작업이 끝난 시각", "makespan", "ms"],
    ["CPU 활용률", "실행 시간 ÷ 전체 시간", "utilization", "%"],
    ["문맥 교환", "서로 다른 작업 사이의 전환(작업 전환)", "contextSwitches", "회"],
  ];
  const better = (key, a, b) => {
    if (a === b) return ["", ""];
    const higherIsBetter = key === "utilization";
    const aWins = higherIsBetter ? a > b : a < b;
    return aWins ? [" is-better", ""] : ["", " is-better"];
  };
  $("#comparison-body").innerHTML = `
    <div class="hw-plate-body">
      <div class="hw-section">
        <h2 class="hw-title" id="comparison-title">빠른 응답과 빠른 완료는 같은 뜻일까요?</h2>
        <p class="hw-text hw-muted">작업과 도착 시각은 그대로 두고 CPU 배정 방식만 바꿔 끝까지 실행한 결과입니다.</p>
      </div>
      <div class="hw-section cpu-compare-runs">
        <span class="hw-label">RR · ${quantum}ms</span>${comparisonTimeline(rr, scale)}<span class="hw-mono">${rr.stats.makespan}ms</span>
        <span class="hw-label">FCFS</span>${comparisonTimeline(fcfs, scale)}<span class="hw-mono">${fcfs.stats.makespan}ms</span>
      </div>
      <div class="hw-section cpu-table-scroll">
        <table class="hw-table cpu-compare-table"><thead><tr><th>지표</th><th>RR · ${quantum}ms</th><th>FCFS</th></tr></thead><tbody>${rows
          .map(([title, description, key, unit]) => {
            const [a, b] = better(key, rr.stats[key], fcfs.stats[key]);
            return `<tr><td>${title}<span class="hw-muted cpu-cell-help">${description}</span></td><td class="hw-mono${a}">${number(rr.stats[key])}${unit}</td><td class="hw-mono${b}">${number(fcfs.stats[key])}${unit}</td></tr>`;
          })
          .join("")}</tbody></table>
      </div>
      <div class="hw-section">
        <div class="hw-note hw-note--accent"><div><p class="hw-heading">${summary.response}</p><p>${summary.finish} ${summary.cause}</p><p class="hw-muted">${summary.caveat}</p></div></div>
        <p class="hw-text hw-muted cpu-sweep">할당량 ${sweep.map((r) => mark(r.quantum, `${r.quantum}`)).join("·")}ms → 문맥 교환 ${sweep.map((r) => mark(r.quantum, r.switches)).join("·")}회, 전체 완료 ${sweep.map((r) => mark(r.quantum, r.makespan)).join("·")}ms. 할당량이 작을수록 전환이 늘고, 가장 긴 CPU 구간 이상이면 FCFS와 같아집니다.</p>
      </div>
    </div>
    <div class="hw-plate-foot cpu-dialog-actions">
      <button class="hw-key" data-action="try-other">${josa(algorithm === "rr" ? "FCFS" : "라운드 로빈", "으로")} 직접 실행 ${icon("arrow")}</button>
      <button class="hw-key hw-key--accent" data-action="close-dialog">계속 살펴보기</button>
    </div>`;
  $("#comparison-dialog").showModal();
}

/* ---------- Input ---------- */

function selectProcess(id, toggle = true) {
  selectedProcess = toggle && id === selectedProcess ? null : id;
  renderProcessDetail();
  sidePanel.select(selectedProcess || !toggle ? "process" : "now");
  if (selectedProcess && matchMedia("(max-width: 1099px)").matches) $(".hw-side").scrollIntoView({ block: "start", behavior: "smooth" });
}

root.addEventListener("click", (event) => {
  const target = event.target.closest("button, [data-process], tr[data-time]");
  if (!target || target.disabled) return;
  if (target.dataset.process) return selectProcess(target.dataset.process);
  if (target.dataset.pick) return selectProcess(target.dataset.pick, false);
  if (target.dataset.record) {
    root.querySelectorAll("[data-record]").forEach((tab) => {
      const active = tab === target;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      $(`#record-${tab.dataset.record}`).hidden = !active;
    });
    return;
  }
  if (target.dataset.algorithm) {
    if (target.dataset.algorithm === algorithm) return;
    algorithm = target.dataset.algorithm;
    return reconfigure();
  }
  if (target.dataset.time !== undefined) {
    seek(Number(target.dataset.time));
    if (target.hasAttribute("data-milestone")) {
      sidePanel.select("now");
      $("#explanation").focus({ preventScroll: true });
      $("#explanation").scrollIntoView({ block: "nearest" });
    }
    return;
  }
  if (target.dataset.answer) return answerPrediction(target.dataset.answer);
  if (target.dataset.number) return answerNumber(target.dataset.number);
  switch (target.dataset.action) {
    case "guided":
      guided = !guided;
      updateControls();
      break;
    case "play":
      togglePlay();
      break;
    case "back":
      seek(time - 1);
      break;
    case "step":
      seek(time + 1, true);
      break;
    case "reset":
      seek(0);
      break;
    case "event":
      seek(result.frames.find((f) => f.t > time && f.events.length)?.t ?? result.stats.makespan, true);
      break;
    case "speed":
      speed = speed === 1 ? 2 : speed === 2 ? 0.5 : 1;
      target.textContent = `${speed}×`;
      target.setAttribute("aria-label", `재생 속도 ${speed}배, 눌러서 변경`);
      scene.setSpeed(speed);
      break;
    case "theme": {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem("cpu-explorer:theme", next);
      } catch {}
      updateThemeButton();
      break;
    }
    case "compare":
      openComparison();
      break;
    case "predict":
      openPrediction();
      break;
    case "quiz-continue":
      $("#prediction-dialog").close();
      $("#scene").focus({ preventScroll: true });
      $("#scene").scrollIntoView({ block: "nearest", behavior: "instant" });
      seek(quiz.decision.time, true);
      break;
    case "close-dialog":
      target.closest("dialog").close();
      break;
    case "try-other":
      $("#comparison-dialog").close();
      algorithm = algorithm === "rr" ? "fcfs" : "rr";
      reconfigure();
      break;
  }
});
// Scene tokens are SVG groups with role="button"; give them keyboard activation.
$("#scene").addEventListener("keydown", (event) => {
  const tokenEl = event.target.closest?.("[data-process]");
  if (!tokenEl || (event.key !== "Enter" && event.key !== " ")) return;
  event.preventDefault();
  event.stopPropagation();
  selectProcess(tokenEl.dataset.process);
});
$(".hw-records .hw-tabs").addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const tabs = [...root.querySelectorAll("[data-record]")];
  const index = tabs.indexOf(document.activeElement);
  if (index < 0) return;
  event.preventDefault();
  const next =
    event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  tabs[next].click();
  tabs[next].focus();
});
$("#quantum").addEventListener("input", (e) => {
  quantum = Number(e.target.value);
  reconfigure();
});
$("#seek").addEventListener("input", (e) => seek(Number(e.target.value)));
document.addEventListener("keydown", (e) => {
  if (document.querySelector("dialog[open]") || e.target.closest?.("input,select,textarea,button,a,summary,[role='button']")) return;
  if (e.code === "Space") {
    e.preventDefault();
    togglePlay();
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    seek(time + 1, true);
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    seek(time - 1);
  } else if (e.key.toLowerCase() === "r" && !e.ctrlKey && !e.metaKey && !e.altKey) seek(0);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});

updateThemeButton();
updateSettings();
render();
