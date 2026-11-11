import "./styles.css";
import { DEFAULT_PROCESSES, simulate } from "./engine.js";
import { createSchedulerScene } from "./scene.js";
import {
  describeChapter,
  describeComparison,
  buildMilestones,
  eventLabel,
  frameAtMove,
  processDetails,
} from "./lesson.js";

const icons = {
  chip: '<rect x="6" y="6" width="12" height="12" rx="1"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4M9 9h6v6H9z"/>',
  play: '<path d="m8 5 11 7-11 7z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  next: '<path d="m9 5 7 7-7 7"/>',
  reset: '<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
  moon: '<path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/>',
  compare: '<path d="M4 4v16h16M8 15v-4m5 4V7m5 8v-6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
const colors = { P1: "p1", P2: "p2", P3: "p3" };
const number = (value) => Number(value.toFixed(2)).toLocaleString("ko-KR");
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

app.innerHTML = `
  <header class="topbar">
    <div class="brand"><span class="brand-icon">${icon("chip")}</span><div><h1>CPU 스케줄링 <span>탐색기</span></h1><p>보면서 이해하는 운영체제</p></div></div>
    <div class="lesson-context"><span class="eyebrow">대표 시나리오 01</span><b>하나의 CPU, 세 개의 작업</b></div>
    <div class="top-actions"><button class="button compare-button" data-action="compare" aria-label="실행 결과 비교">${icon("compare")}<span>결과 비교</span></button><button class="button icon-button" data-action="theme" aria-label="어두운 테마로 전환"></button></div>
  </header>
  <main class="workspace">
    <aside class="panel setup-panel">
      <button class="panel-head setup-toggle" data-action="setup" aria-expanded="true" aria-controls="setup-content"><h2>실험 조건</h2><span class="small-label">고정된 세 작업 <span class="chevron">⌄</span></span></button>
      <div id="setup-content" class="setup-content">
        <div class="setting-label"><label id="algorithm-label">CPU 배정 방식</label><span id="algorithm-short" class="tag">RR</span></div>
        <div class="segmented" role="group" aria-labelledby="algorithm-label"><button data-algorithm="rr" aria-pressed="true">라운드 로빈</button><button data-algorithm="fcfs" aria-pressed="false">FCFS</button></div>
        <p id="algorithm-help" class="muted setting-help"></p>
        <div class="quantum-setting"><div class="setting-label"><label for="quantum">시간 할당량</label><output id="quantum-value" for="quantum">2 <small>ms</small></output></div><input id="quantum" type="range" min="1" max="5" value="2" step="1" aria-describedby="quantum-help"/><div class="range-ends"><span>1ms</span><span>5ms</span></div><p id="quantum-help" class="muted">한 번에 연속으로 쓸 수 있는 CPU 시간</p></div>
        <div class="section-caption">같은 작업, 다른 실행 순서</div>
        <div class="process-list">${DEFAULT_PROCESSES.map((p) => `<button class="process-spec ${colors[p.id]}" data-process="${p.id}" aria-label="${p.id} ${p.name} 작업 상세"><div class="process-spec-head"><b class="process-id">${p.id}</b><strong>${p.name}</strong><span>${p.arrival}ms 도착</span></div><div class="burst-recipe">${p.cpu.map((c, i) => `${i ? `<span class="burst io">입출력 ${p.io[i - 1]}</span><i>→</i>` : ""}<span class="burst">CPU ${c}</span>${i < p.cpu.length - 1 ? "<i>→</i>" : ""}`).join("")}</div><div class="process-status" id="status-${p.id}"></div></button>`).join("")}</div>
        <details class="model-notes"><summary>이 실험의 규칙</summary><ul><li>CPU는 하나이며 한 번에 한 작업만 실행합니다.</li><li>입출력은 CPU와 독립적으로 진행됩니다. 여러 작업의 입출력이 겹칠 수 있습니다.</li><li>문맥 교환 비용은 0ms로 단순화했습니다.</li><li>같은 시각에는 도착·입출력 복귀를 먼저 큐에 넣고, 시간이 만료된 작업을 맨 뒤에 넣습니다.</li><li>모든 시간은 학습용 가상 시간입니다.</li></ul></details>
      </div>
    </aside>
    <section class="panel scene-panel">
      <div class="panel-head"><h2>CPU 스케줄러</h2><div class="scene-head-status"><span class="tag">단일 코어</span><b class="clock"><span id="clock">0</span><small>ms</small></b></div></div>
      <div id="scene" tabindex="-1"></div>
      <div class="scene-summary"><span id="running-summary"></span><span id="queue-summary"></span></div>
      <div class="transport"><div class="learning-mode"><button data-action="guided" role="switch" aria-checked="true"><i></i>핵심 장면에서 멈추기</button><span id="playback-hint">재생하면 첫 장면부터 따라갑니다.</span></div>
        <div class="playback-buttons"><button class="button icon-button" data-action="reset" title="처음으로 (R)" aria-label="처음으로">${icon("reset")}</button><button class="button icon-button" data-action="back" title="1ms 이전 (←)" aria-label="1ms 이전">${icon("back")}</button><button class="button primary play-button" data-action="play">${icon("play")}<span>재생</span></button><button class="button icon-button" data-action="step" title="1ms 다음 (→)" aria-label="1ms 다음">${icon("next")}</button><button class="button next-event" data-action="event">다음 사건 ${icon("arrow")}</button><button class="button speed-button" data-action="speed" aria-label="재생 속도 변경">1×</button></div>
        <div class="seek-row"><span id="seek-time">0ms</span><input id="seek" type="range" min="0" step="1" value="0" aria-label="시뮬레이션 시각"/><span id="seek-end">20ms</span></div>
      </div>
    </section>
    <aside class="panel lesson-panel">
      <div class="panel-head"><h2>지금 일어나는 일</h2><span class="small-label" id="lesson-progress"></span></div>
      <div class="lesson-content"><div id="chapter-content"><div id="explanation" tabindex="-1" aria-live="polite" aria-atomic="true"></div><div class="event-card"><div class="event-card-head">이번 시각의 사건 <span id="event-time"></span></div><ul id="current-events"></ul></div><div class="insight" id="insight"></div><button class="button primary conclusion-button" data-action="compare" hidden>같은 작업, 다른 방식으로 비교 →</button><button class="button prediction-button" data-action="predict">다음 실행, 먼저 맞혀보기 ${icon("arrow")}</button><div class="section-caption">핵심 장면으로 이동</div><nav id="milestones" aria-label="핵심 학습 장면"></nav></div><div id="process-detail" hidden></div></div>
    </aside>
    <section class="panel records-panel"><div class="record-tabs" role="tablist" aria-label="관찰 기록"><button id="tab-timeline" role="tab" aria-selected="true" aria-controls="record-timeline" data-record="timeline">실행 시간표</button><button id="tab-log" role="tab" aria-selected="false" aria-controls="record-log" data-record="log" tabindex="-1">사건 기록 <span id="log-count"></span></button><button id="tab-metrics" role="tab" aria-selected="false" aria-controls="record-metrics" data-record="metrics" tabindex="-1">작업별 지표</button><span class="record-hint">기록을 눌러 그 순간으로 이동</span></div><section id="record-timeline" class="timeline-panel" role="tabpanel" aria-labelledby="tab-timeline">
      <div class="timeline-subhead"><span class="small-label">지나온 시간이 쌓이는 기록</span><div class="state-legend"><span><i class="sample running"></i>CPU 실행</span><span><i class="sample waiting"></i>준비 큐 대기</span><span><i class="sample blocked"></i>입출력 대기</span></div></div>
      <div class="timeline-wrap"><div id="timeline"></div></div>
      <div class="timeline-footer"><span id="live-usage"></span><span>눈금이나 기록을 누르면 해당 시각으로 이동합니다.</span></div>
    </section>
    <section id="record-log" class="log-panel" role="tabpanel" aria-labelledby="tab-log" hidden><div class="log-scroll"><table><thead><tr><th>시각</th><th>작업</th><th>일어난 일</th></tr></thead><tbody id="event-log"></tbody></table></div></section>
    <section id="record-metrics" class="metrics-panel" role="tabpanel" aria-labelledby="tab-metrics" hidden><div class="metrics-scroll"><table><thead><tr><th>작업</th><th title="도착부터 처음 CPU를 받기까지">최초 응답</th><th title="준비 큐에서 기다린 누적 시간">CPU 대기</th><th title="도착부터 완료까지">반환 시간</th></tr></thead><tbody id="metrics"></tbody></table></div><p class="metrics-note">CPU 대기에 입출력 대기는 포함하지 않습니다. 반환 시간은 작업이 끝나면 표시됩니다.</p></section></section>
  </main>
  <footer class="page-footer"><span>조작: <kbd>Space</kbd> 재생·정지 <kbd>←</kbd><kbd>→</kbd> 1ms 이동 <kbd>R</kbd> 처음으로</span><span>학습 근거 <a href="https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf" target="_blank" rel="noreferrer">OSTEP 7장 ↗</a> · <a href="https://cs341.cs.illinois.edu/coursebook/Scheduling" target="_blank" rel="noreferrer">Illinois CS341 ↗</a></span></footer>
  <dialog id="prediction-dialog" class="dialog prediction-dialog" aria-labelledby="prediction-title"><div class="dialog-head"><span class="eyebrow">예측 → 확인 → 이해</span><button class="button icon-button" data-action="close-dialog" aria-label="닫기">×</button></div><div id="prediction-body"></div></dialog>
  <dialog id="comparison-dialog" class="dialog comparison-dialog" aria-labelledby="comparison-title"><div class="dialog-head"><span class="eyebrow">같은 입력으로 공정하게 비교</span><button class="button icon-button" data-action="close-dialog" aria-label="닫기">×</button></div><div id="comparison-body"></div></dialog>
`;

await document.fonts.ready;
const scene = createSchedulerScene(
  document.querySelector("#scene"),
  DEFAULT_PROCESSES,
  (frame, view, move) => presentFrame(frameAtMove(frame, view, move), move),
);
const $ = (selector) => document.querySelector(selector);
if (innerWidth < 1100) {
  $("#setup-content").hidden = true;
  $(".setup-toggle").setAttribute("aria-expanded", "false");
}

function updateThemeButton() {
  const dark = document.documentElement.dataset.theme === "dark";
  $('[data-action="theme"]').innerHTML = icon(dark ? "sun" : "moon");
  $('[data-action="theme"]').setAttribute(
    "aria-label",
    `${dark ? "밝은" : "어두운"} 테마로 전환`,
  );
}

function updateSettings() {
  document
    .querySelectorAll("[data-algorithm]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.algorithm === algorithm)),
    );
  $("#algorithm-short").textContent = algorithm === "rr" ? "RR" : "FCFS";
  $("#algorithm-help").textContent =
    algorithm === "rr"
      ? "할당량이 끝나면 준비 큐 맨 뒤로 갑니다."
      : "먼저 온 작업을 입출력 요청·완료까지 실행합니다.";
  $("#quantum").disabled = algorithm === "fcfs";
  $(".quantum-setting").classList.toggle("disabled", algorithm === "fcfs");
  $("#quantum-value").innerHTML =
    algorithm === "rr" ? `${quantum} <small>ms</small>` : "제한 없음";
  $("#quantum-help").textContent =
    algorithm === "rr"
      ? "한 번에 연속으로 쓸 수 있는 CPU 시간"
      : "FCFS에서는 시간 할당량을 사용하지 않습니다.";
  $("#seek").max = result.stats.makespan;
  $("#seek-end").textContent = `${result.stats.makespan}ms`;
  $("#milestones").innerHTML = buildMilestones(result)
    .map(
      (m, i) =>
        `<button class="milestone" data-time="${m.time}"><span class="milestone-num">${i + 1}</span><span>${m.title}</span><small>${m.time}ms</small></button>`,
    )
    .join("");
}

const stateNames = {
  new: "도착 예정",
  ready: "준비 큐에서 대기",
  running: "CPU 실행 중",
  blocked: "입출력 대기",
  done: "완료",
};
const stateNamesForMove = { ready: "준비 큐로", running: "CPU로", blocked: "입출력 장치로", done: "완료 칸으로" };
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
  $("#scene").setAttribute("aria-label", `${time}밀리초. ${move ? eventLabel(move) + " 이동 중" : "CPU " + (frame.running || "대기")}. 준비 큐 ${frame.ready.join(", ") || "없음"}. 작업을 선택하면 상세 정보를 볼 수 있습니다.`);
  $("#clock").textContent = time;
  $("#seek").value = time;
  $("#seek").setAttribute(
    "aria-valuetext",
    `${time}밀리초, 전체 ${result.stats.makespan}밀리초`,
  );
  $("#seek-time").textContent = `${time}ms`;
  DEFAULT_PROCESSES.forEach((p) => {
    const state = frame.states[p.id];
    const label = move?.id === p.id ? `${stateNamesForMove[move.to]} 이동 중` : stateNames[state.status];
    $(`#status-${p.id}`).innerHTML =
      `<span class="state-name ${state.status}">${label}</span><span>남은 CPU <b>${state.cpuRemaining}ms</b></span>`;
  });
  const description = describeChapter(frame, result);
  if (move) {
    const order = frame.events.length + 1;
    const explanations = {
      arrive: "도착한 작업이 준비 큐 뒤에 합류합니다.",
      unblock: "입출력이 끝난 작업이 준비 큐 뒤에 합류합니다.",
      preempt: "시간 할당량을 다 쓴 작업이 진행한 계산을 보존한 채 준비 큐 뒤로 이동합니다.",
      dispatch: "준비 큐에서 가장 오래 기다린 맨 앞 작업이 CPU로 이동합니다.",
      block: "현재 CPU 구간을 마친 작업이 입출력 장치로 이동합니다.",
      complete: "마지막 CPU 구간을 마친 작업이 완료 칸으로 이동합니다.",
    };
    description.eyebrow = `${time} ms · 이번 시각의 사건 ${order}/${result.frames[time].events.length}`;
    description.title = eventLabel(move);
    description.body = explanations[move.type];
    description.insight = `이동 직전 준비 큐 · ${frame.ready.join(" → ") || "비어 있음"}`;
  }
  $("#explanation").innerHTML =
    `<span class="eyebrow">${description.eyebrow}</span><h3>${description.title}</h3><p>${description.body}</p>`;
  $("#insight").innerHTML =
    `<span class="insight-mark">!</span><p>${description.insight}</p>`;
  $("#event-time").textContent = `${time}ms`;
  const visibleEvents = move ? [...frame.events, move] : frame.events;
  $("#current-events").innerHTML = visibleEvents.length
    ? visibleEvents
        .map(
          (e) =>
            `<li>${e.id ? `<b class="mini-id ${colors[e.id]}">${e.id}</b>` : '<b class="mini-id neutral">CPU</b>'}<span>${eventLabel(e).replace(`${e.id} `, "")}${e === move ? " · 이동 중" : ""}</span></li>`,
        )
        .join("")
    : `<li><b class="mini-id ${colors[frame.running] || "neutral"}">${frame.running || "CPU"}</b><span>${frame.running ? "다음 사건까지 실행을 이어갑니다." : "입출력이 끝나기를 기다립니다."}</span></li>`;
  const milestones = buildMilestones(result),
    active = Math.max(
      0,
      milestones.findLastIndex((m) => m.time <= time),
    );
  $("#lesson-progress").textContent = `${active + 1} / ${milestones.length}`;
  document.querySelectorAll(".milestone").forEach((b, i) => {
    b.classList.toggle("is-active", i === active);
    b.classList.toggle("is-done", i < active);
    if (i === active) b.setAttribute("aria-current", "step");
    else b.removeAttribute("aria-current");
  });
  $('[data-action="predict"]').textContent = !result.decisions.some(
    (d) => d.time > time && d.candidates.length > 1,
  )
    ? "앞선 장면에서 다시 예측 →"
    : "다음 실행, 먼저 맞혀보기 →";
  $(".conclusion-button").hidden = time !== result.stats.makespan;
  $('[data-action="predict"]').hidden = time === result.stats.makespan;
  renderTimeline();
  renderLog();
  renderMetrics();
  renderProcessDetail();
  updateControls();
}

function renderProcessDetail() {
  $(".lesson-panel h2").textContent = selectedProcess
    ? "작업 상세"
    : "단계 해설";
  $("#chapter-content").hidden = !!selectedProcess;
  $("#process-detail").hidden = !selectedProcess;
  document.querySelectorAll("[data-process]").forEach((b) => {
    b.setAttribute(
      "aria-pressed",
      String(b.dataset.process === selectedProcess),
    );
  });
  if (!selectedProcess) return;
  const detail = processDetails(displayedFrame, result, selectedProcess);
  if (movingEvent?.id === selectedProcess) detail.body = `${eventLabel(movingEvent)} 이동 중입니다.`;
  $("#process-detail").innerHTML =
    `<button class="text-button detail-back" data-action="chapter">← 단계 해설로 돌아가기</button><div class="detail-heading"><span class="process-id ${colors[selectedProcess]}">${selectedProcess}</span><h3>${detail.title.replace(`${selectedProcess} · `, "")}</h3></div><p class="detail-body">${detail.body}</p><div class="section-caption">작업이 끝나기까지의 순서</div><div class="phase-list">${detail.phases.map((p, i) => `<div class="phase ${p.status}"><span class="phase-order">${i + 1}</span><div><strong>${p.kind === "cpu" ? "CPU 실행" : "입출력"}</strong><span>${p.used} / ${p.total}ms</span><div class="phase-meter"><i style="width:${(p.used / p.total) * 100}%"></i></div></div><small>${p.status === "past" ? "완료" : p.status === "current" ? "현재 구간" : "예정"}</small></div>`).join("")}</div><dl class="detail-metrics">${detail.metrics.map((m) => `<div><dt>${m.label}<small>${m.help}</small></dt><dd>${m.value}</dd></div>`).join("")}</dl><p class="detail-insight">${detail.insight}</p>`;
}

function updateControls() {
  const frame = displayedFrame;
  const canPause = playing || (transitioning && !motionPaused);
  $("#running-summary").innerHTML = transitioning
    ? `<i class="status-square idle"></i><b>작업 이동 중</b>`
    : frame.running
      ? `<i class="status-square ${colors[frame.running]}"></i><b>${frame.running} 실행 중</b><span>${algorithm === "rr" ? `남은 할당량 ${frame.quantumLeft}ms` : "입출력 요청 또는 완료까지"}</span>`
      : `<i class="status-square idle"></i><b>${time === result.stats.makespan ? "모든 작업 완료" : "CPU 유휴"}</b>`;
  $("#queue-summary").textContent =
    `${movingEvent ? "이동 직전 · " : ""}준비 ${frame.ready.length} · 입출력 ${frame.blocked.length} · 완료 ${frame.completed.length}`;

  $("#scene").setAttribute("aria-busy", String(transitioning));
  $('[data-action="play"]').innerHTML =
    `${icon(canPause ? "pause" : time === result.stats.makespan && !transitioning ? "reset" : "play")}<span>${canPause ? "일시정지" : time === result.stats.makespan && !transitioning ? "다시 재생" : time === 0 ? "학습 시작" : "이어서 재생"}</span>`;
  $('[data-action="play"]').setAttribute(
    "aria-label",
    canPause ? "일시정지" : "재생",
  );
  $('[data-action="back"]').disabled = time === 0;
  $('[data-action="step"]').disabled = $('[data-action="event"]').disabled =
    time === result.stats.makespan;
  $('[data-action="guided"]').setAttribute("aria-checked", String(guided));
  $("#playback-hint").textContent = transitioning
    ? motionPaused
      ? "이동을 멈췄습니다. 이어서 재생할 수 있습니다."
      : "작업이 이동 중입니다."
    : time === result.stats.makespan
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
  if (time === 0 && matchMedia("(max-width: 759px)").matches)
    $(".scene-panel").scrollIntoView({ block: "start", behavior: "instant" });
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
    if (
      autoAdvance &&
      playing &&
      (time === result.stats.makespan ||
        (guided && buildMilestones(result).some((m) => m.time === time)))
    )
      pause();
    updateControls();
  });
}
function tick(now) {
  if (!playing) return;
  if (!transitioning) accumulator += Math.min(now - lastTick, 250) * speed;
  lastTick = now;
  const duration = STEP_DURATION;
  if (!transitioning && accumulator >= duration && time < result.stats.makespan)
    moveTo(time + 1, true);
  if (!transitioning) scene.setProgress(accumulator / duration);
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

function timelineBar(start, end, classes, label, title) {
  const visibleEnd = Math.min(end, time);
  if (visibleEnd <= start) return "";
  const observedTitle =
    title.replace(`${start}–${end}ms`, `${start}–${visibleEnd}ms`) +
    (visibleEnd < end ? " · 진행 중" : "");
  return `<button class="timeline-bar ${classes}" style="left:${(start / result.stats.makespan) * 100}%;width:${((visibleEnd - start) / result.stats.makespan) * 100}%" data-time="${start}" title="${observedTitle}" aria-label="${observedTitle}">${label}</button>`;
}
function renderTimeline() {
  const total = result.stats.makespan;
  const ticks = Array.from(
    { length: total + 1 },
    (_, t) =>
      `<button class="time-tick ${t === time ? "current" : ""}" data-time="${t}" style="left:${(t / total) * 100}%" aria-label="${t}밀리초로 이동">${t}</button>`,
  ).join("");
  const cpu = result.segments
    .map((s) =>
      timelineBar(
        s.start,
        s.end,
        s.id ? `${colors[s.id]} cpu-bar` : "idle-bar",
        s.id || "유휴",
        `${s.start}–${s.end}ms · ${s.id || "CPU 유휴"}`,
      ),
    )
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
    return `<div class="timeline-row"><span class="lane-label ${colors[p.id]}">${p.id}</span><div class="time-lane">${runs.map((s) => timelineBar(s.start, s.end, `${colors[p.id]} state-${s.state}`, s.state === "blocked" ? "입출력" : "", `${p.id} · ${s.start}–${s.end}ms · ${stateNames[s.state]}`)).join("")}</div></div>`;
  }).join("");
  $("#timeline").innerHTML =
    `<div class="timeline-axis"><span>시간 <small>ms</small></span><div>${ticks}</div></div><div class="timeline-tracks" style="--total:${total};--cursor:${(time / total) * 100}%"><div class="timeline-row cpu-row"><span class="lane-label">CPU</span><div class="time-lane">${cpu}</div></div>${rows}<div class="time-cursor"><i></i></div></div>`;
  const busy = result.frames.slice(0, time).filter((f) => f.running).length;
  $("#live-usage").innerHTML =
    `<b>CPU 실행 ${busy}ms</b><span>유휴 ${time - busy}ms</span><span>경과 ${time}ms</span>`;
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
        `<tr class="${t === time ? "current-row" : ""}"><td><button data-time="${t}" class="time-link" aria-label="${t}ms 사건으로 이동">${t}ms</button></td><td><span class="mini-id ${colors[e.id] || "neutral"}">${e.id || "CPU"}</span></td><td>${eventLabel(e).replace(`${e.id} `, "")}</td></tr>`,
    )
    .join("");
  $("#log-count").textContent = `${entries.length}개 사건`;
}
function renderMetrics() {
  const frame = displayedFrame;
  $("#metrics").innerHTML = DEFAULT_PROCESSES.map((p) => {
    const s = frame.states[p.id];
    const turnaround = s.finishedAt === null
      ? (s.arriving ? "도착 중" : s.status === "new" ? "도착 전" : "진행 중")
      : `${s.finishedAt - p.arrival}ms`;
    return `<tr><td><b class="mini-id ${colors[p.id]}">${p.id}</b></td><td>${s.firstRun === null ? "아직 실행 전" : `${number(s.firstRun - p.arrival)}ms`}</td><td>${s.readyWait}ms</td><td>${turnaround}</td></tr>`;
  }).join("");
}

function openPrediction() {
  pause();
  const decision =
    result.decisions.find((d) => d.time > time && d.candidates.length > 1) ||
    result.decisions.find((d) => d.candidates.length > 1);
  quiz = { decision, answered: false };
  seek(decision.time - 1);
  const before = result.frames[time];
  const nextEvents = result.frames[decision.time].events.filter(
    (e) => e.type !== "dispatch",
  );
  const running = before.running;
  $("#prediction-body").innerHTML =
    `<h2 id="prediction-title">${decision.time}ms, 다음 CPU는<br>누구에게 돌아갈까요?</h2><p class="dialog-intro">${time}ms 장면에 멈췄습니다. 지금의 준비 큐에 다음 사건을 적용해 순서를 예상해 보세요.</p><div class="quiz-context"><div><span>지금 CPU</span><strong>${running || "유휴"}</strong><small>${running ? (algorithm === "rr" ? `할당량 ${before.quantumLeft}ms 남음 · 현재 CPU 구간 ${before.states[running].burstRemaining}ms 남음` : `현재 CPU 구간 ${before.states[running].burstRemaining}ms 남음`) : "실행 중인 작업 없음"}</small></div><div><span>지금 준비 큐 · 앞 → 뒤</span><strong>${before.ready.join(" → ") || "비어 있음"}</strong></div><div><span>${decision.time}ms에 일어날 사건</span><ul>${nextEvents.map((e) => `<li><b>${e.id || "CPU"}</b> ${eventLabel(e).replace(`${e.id} `, "")}</li>`).join("")}</ul></div></div><div class="quiz-options">${DEFAULT_PROCESSES.map((p) => `<button class="quiz-choice ${colors[p.id]}" data-answer="${p.id}"><b>${p.id}</b><span>${p.name}</span></button>`).join("")}</div><div id="quiz-feedback" aria-live="polite"></div><button class="button primary quiz-continue" data-action="quiz-continue" hidden>실제 이동을 보며 확인 ${icon("arrow")}</button>`;
  $("#prediction-dialog").showModal();
}
function answerPrediction(answer) {
  if (quiz.answered) return;
  quiz.answered = true;
  const d = quiz.decision,
    correct = answer === d.chosen;
  document.querySelectorAll(".quiz-choice").forEach((b) => {
    b.disabled = true;
    b.classList.toggle("correct", b.dataset.answer === d.chosen);
    b.classList.toggle("incorrect", b.dataset.answer === answer && !correct);
  });
  $("#quiz-feedback").innerHTML =
    `<h3>${correct ? "맞았습니다." : "실제 차례는 " + d.chosen + "입니다."}</h3><p>배정 직전 준비 큐는 <strong>${d.candidates.join(" → ")}</strong>입니다. 맨 앞의 ${d.chosen}가 먼저 CPU를 받습니다.</p><p class="muted">${d.cause === "quantum" ? "같은 시각에 도착·복귀한 작업을 넣은 뒤, 시간이 만료된 작업을 맨 뒤에 넣습니다." : "입출력 완료와 새 도착은 기존에 기다리던 작업을 추월하지 않습니다."}</p>`;
  $(".quiz-continue").hidden = false;
}

function comparisonTimeline(run) {
  const scale = Math.max(
    result.stats.makespan,
    simulate({ algorithm: algorithm === "rr" ? "fcfs" : "rr", quantum }).stats
      .makespan,
  );
  return `<div class="comparison-track" style="--scale:${scale}">${run.segments.map((s) => `<span class="comparison-segment ${s.id ? colors[s.id] : "idle-bar"}" style="left:${(s.start / scale) * 100}%;width:${((s.end - s.start) / scale) * 100}%" title="${s.start}–${s.end}ms · ${s.id || "유휴"}">${s.end - s.start >= 2 ? s.id || "유휴" : ""}</span>`).join("")}</div>`;
}
function openComparison() {
  pause();
  const rr = simulate({ algorithm: "rr", quantum }),
    fcfs = simulate({ algorithm: "fcfs" });
  const diff = rr.stats.averageResponse - fcfs.stats.averageResponse;
  const responseMessage =
    diff < 0
      ? `라운드 로빈의 평균 최초 응답은 ${number(-diff)}ms 더 빠릅니다.`
      : diff > 0
        ? `FCFS의 평균 최초 응답은 ${number(diff)}ms 더 빠릅니다.`
        : "두 방식의 평균 최초 응답 시간이 같습니다.";
  const endDiff = rr.stats.makespan - fcfs.stats.makespan;
  const finishMessage =
    endDiff > 0
      ? `전체 완료는 FCFS가 ${endDiff}ms 빠릅니다.`
      : endDiff < 0
        ? `전체 완료도 라운드 로빈이 ${-endDiff}ms 빠릅니다.`
        : "전체 완료 시각은 같습니다.";
  const explanation = describeComparison(rr, fcfs);
  const rows = [
    ["평균 최초 응답", "도착 → 첫 CPU 실행", "averageResponse", "ms"],
    ["평균 CPU 대기", "준비 큐에서 기다린 시간", "averageWaiting", "ms"],
    ["평균 반환 시간", "도착 → 완료", "averageTurnaround", "ms"],
    ["전체 완료 시각", "모든 작업이 끝난 시각", "makespan", "ms"],
    ["CPU 활용률", "실행 시간 ÷ 전체 시간", "utilization", "%"],
    ["작업 전환", "서로 다른 작업 사이의 전환", "contextSwitches", "회"],
  ];
  $("#comparison-body").innerHTML =
    `<h2 id="comparison-title">빠른 응답과 빠른 완료는<br>같은 뜻일까요?</h2><p class="dialog-intro">작업과 도착 시각은 그대로 두고, CPU 배정 방식만 바꿨습니다. 아래는 끝까지 실행한 결과입니다.</p><div class="comparison-timelines"><div><b>라운드 로빈 <small>${quantum}ms씩</small></b>${comparisonTimeline(rr)}<span>${rr.stats.makespan}ms 완료</span></div><div><b>FCFS <small>먼저 온 순서</small></b>${comparisonTimeline(fcfs)}<span>${fcfs.stats.makespan}ms 완료</span></div></div><div class="comparison-table-wrap"><table class="comparison-table"><thead><tr><th>지표</th><th>RR · ${quantum}ms</th><th>FCFS</th></tr></thead><tbody>${rows.map(([title, description, key, unit]) => `<tr><th>${title}<small>${description}</small></th><td>${number(rr.stats[key])}<small>${unit}</small></td><td>${number(fcfs.stats[key])}<small>${unit}</small></td></tr>`).join("")}</tbody></table></div><div class="comparison-takeaway"><b>${responseMessage}</b><p>${finishMessage} ${explanation}</p><p class="muted">특정 방식이 항상 더 좋다는 뜻은 아닙니다. 실제 운영체제에서는 문맥 교환 비용도 발생합니다.</p></div><div class="dialog-actions"><button class="button" data-action="try-other">${algorithm === "rr" ? "FCFS" : "라운드 로빈"}으로 직접 실행 ${icon("arrow")}</button><button class="button primary" data-action="close-dialog">계속 살펴보기</button></div>`;
  $("#comparison-dialog").showModal();
}

app.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || button.disabled) return;
  if (button.dataset.process) {
    selectedProcess =
      button.dataset.process === selectedProcess
        ? null
        : button.dataset.process;
    renderProcessDetail();
    return;
  }
  if (button.dataset.record) {
    document.querySelectorAll("[data-record]").forEach((tab) => {
      const active = tab === button;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      $(`#record-${tab.dataset.record}`).hidden = !active;
    });
    return;
  }
  if (button.dataset.algorithm) {
    algorithm = button.dataset.algorithm;
    reconfigure();
    return;
  }
  if (button.dataset.time !== undefined) {
    seek(Number(button.dataset.time));
    if (button.classList.contains("milestone")) {
      $(".lesson-content").scrollTop = 0;
      $("#explanation").focus({ preventScroll: true });
      $("#explanation").scrollIntoView({ block: "nearest" });
    }
    return;
  }
  if (button.dataset.answer) {
    answerPrediction(button.dataset.answer);
    return;
  }
  switch (button.dataset.action) {
    case "chapter":
      selectedProcess = null;
      renderProcessDetail();
      break;
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
      seek(
        result.frames.find((f) => f.t > time && f.events.length)?.t ??
          result.stats.makespan,
        true,
      );
      break;
    case "speed":
      speed = speed === 1 ? 2 : speed === 2 ? 0.5 : 1;
      button.textContent = `${speed}×`;
      scene.setSpeed(speed);
      break;
    case "theme": {
      const next =
        document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("cpu-explorer:theme", next);
      updateThemeButton();
      break;
    }
    case "setup": {
      const el = $("#setup-content");
      el.hidden = !el.hidden;
      button.setAttribute("aria-expanded", String(!el.hidden));
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
      button.closest("dialog").close();
      break;
    case "try-other":
      $("#comparison-dialog").close();
      algorithm = algorithm === "rr" ? "fcfs" : "rr";
      reconfigure();
      break;
  }
});
$(".record-tabs").addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const tabs = [...document.querySelectorAll("[data-record]")];
  const index = tabs.indexOf(document.activeElement);
  if (index < 0) return;
  event.preventDefault();
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
          tabs.length;
  tabs[next].click();
  tabs[next].focus();
});
$("#quantum").addEventListener("input", (e) => {
  quantum = Number(e.target.value);
  reconfigure();
});
$("#seek").addEventListener("input", (e) => seek(Number(e.target.value)));
document.addEventListener("keydown", (e) => {
  if (
    document.querySelector("dialog[open]") ||
    e.target.closest("input,select,textarea,button,a,summary")
  )
    return;
  if (e.code === "Space") {
    e.preventDefault();
    togglePlay();
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    seek(time + 1, true);
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    seek(time - 1);
  } else if (e.key.toLowerCase() === "r") seek(0);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});
updateThemeButton();
updateSettings();
render();
