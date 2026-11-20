import "../../shared/theme.css";
import "../../shared/hw.css";
import "./styles.css";
import "../../shared/switcher.js";
import "../../shared/iso.js";
import { bindSliders, icon, syncSlider } from "../../shared/hw.js";
import { paginate, plateTabs, rowWindow } from "../../shared/fit.js";
import { preFrame, simulate } from "./engine.js";
import { createSchedulerScene } from "./scene.js";
import { eventLabel, frameAtMove, processDetails } from "./lesson.js";
import { LESSONS, METHODS, lessonRuns } from "./lessons.js";
import { josa } from "./josa.js";
import { LABELS, bindRecap, createProgress, progressHtml, recapHtml } from "../../shared/lesson-kit.js";
import { currentLesson, mountRail, nextLesson, progressIdFor } from "../../shared/lesson-rail.js";

const number = (value) => Number(value.toFixed(2)).toLocaleString("ko-KR");
// Korean reading text: a number never wraps away from its unit, and the right
// side of an equation stays on the line with its "=" (text only, not tags).
const keepUnits = (html) =>
  html.replace(/(\d) (ms|회)(?![^<]*>)/g, "$1\u00a0$2").replace(/ = (?=\d)(?![^<]*>)/g, "\u00a0=\u00a0");
const ledFor = (id) => `<span class="hw-led is-on" style="--led:var(--${id ? id.toLowerCase() : "sys-gray"})"></span>`;
const recipe = (p) =>
  p.cpu.map((c, i) => `${i ? `입출력 ${p.io[i - 1]} → ` : ""}CPU ${c}`).join(" → ");
const app = document.querySelector("#app");

// One lesson per page (?lesson=…): its jobs, its two methods and its content.
const lesson = currentLesson(LESSONS);
const lessonNumber = String(LESSONS.indexOf(lesson) + 1).padStart(2, "0");
const content = lesson.content;
const PROCESSES = lesson.processes;
const hasQuantum = lesson.methods.includes("rr");
const hasIo = PROCESSES.some((p) => p.io.length);
const methodLabel = (m) => (m === "rr" ? `RR · ${quantum}ms` : METHODS[m].label);

let algorithm = lesson.methods[0],
  quantum = lesson.quantum ?? 2,
  speed = 1,
  // -1 is the start screen (목표): nobody has arrived or been picked yet.
  time = -1,
  playing = false;
const run = (method = algorithm) => simulate({ algorithm: method, quantum, processes: PROCESSES });
let result = run();
let pre = preFrame(result);
const frameOf = (t) => (t < 0 ? pre : result.frames[t]);
let accumulator = 0,
  lastTick = 0,
  animationId = 0,
  quiz = null;
let guided = true,
  transitioning = false,
  motionPaused = false,
  resumeAutomatically = false,
  movingEvent = null,
  displayedFrame = pre,
  transitionId = 0,
  selectedProcess = null;
const STEP_DURATION = 1600;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

app.outerHTML = `
<div class="hw-page cpu-page" id="app">
  <header class="hw-topbar">
    <div class="hw-brand"><h1>CPU 스케줄링 탐색기</h1><p>보면서 이해하는 운영체제</p></div>
    <div class="hw-context"><span class="hw-label"><span class="hw-index">${lessonNumber}</span> 레슨</span><strong>${lesson.title}</strong></div>
    <div class="hw-actions">
      <button class="hw-key hw-key--sm" data-action="compare">${icon("compare")}<span>${LABELS.compare}</span></button>
      <button class="hw-key hw-key--sm hw-key--icon" data-action="theme" aria-label="어두운 테마로 전환"></button>
    </div>
  </header>

  <main class="hw-console">
    <section class="hw-plate hw-stage" aria-labelledby="stage-label">
      <div class="hw-plate-head">
        <span class="hw-label" id="stage-label"><span class="hw-index">A</span> 스케줄러</span>
        <span class="hw-tag" id="algo-tag"></span>
        <span class="hw-lcd" role="timer" aria-label="시뮬레이션 시각"><span id="clock">0</span><small>ms</small></span>
      </div>
      <div class="hw-scene cpu-scene" id="scene" role="group" tabindex="-1"></div>
      <div class="hw-plate-foot" aria-hidden="true"><span class="hw-led is-on" id="status-led"></span><span id="status-text"></span></div>
    </section>

    <section class="hw-plate hw-deck${hasQuantum ? "" : " cpu-no-quantum"}" aria-label="실험 조건과 재생">
      <div class="hw-field cpu-algorithm">
        <span class="hw-label" id="algorithm-label">CPU 배정 방식</span>
        <div class="hw-seg" role="group" aria-labelledby="algorithm-label">${lesson.methods.map((m) => `<button data-algorithm="${m}" aria-pressed="${m === algorithm}">${METHODS[m].label}</button>`).join("")}</div>
      </div>
      ${hasQuantum ? `<div class="hw-field cpu-quantum">
        <label class="hw-label" for="quantum">시간 할당량 <output class="hw-mono" id="quantum-value" for="quantum">${quantum}ms</output></label>
        <input class="hw-slider" id="quantum" type="range" min="1" max="5" step="1" value="${quantum}" aria-describedby="quantum-help" />
        <div class="hw-ticks" id="quantum-help"><span>1</span><span>5</span></div>
      </div>` : ""}
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
        <span class="hw-label" id="seek-end">20ms</span>
      </div>
      <div class="cpu-guided">
        <button class="hw-switch" data-action="guided" role="switch" aria-checked="true">${LABELS.guided}</button>
        <span class="hw-muted" id="playback-hint"></span>
      </div>
    </section>

    <aside class="hw-plate hw-side" aria-labelledby="side-label">
      <div class="hw-plate-head cpu-side-head">
        <span class="hw-label" id="side-label"><span class="hw-index">B</span><span class="cpu-sr">학습 패널</span></span>
        <div class="hw-tabs" role="tablist" aria-labelledby="side-label">
          <button type="button" data-tab="now" aria-selected="true">${LABELS.explainTab}</button>
          <button type="button" data-tab="scenes">${LABELS.scenesTab}</button>
          <button type="button" data-tab="process">작업</button>
          <button type="button" data-tab="rules">${LABELS.scopeTab}</button>
        </div>
      </div>
      <div class="hw-plate-body hw-fit" data-panel="now">
        <div class="hw-fill cpu-pages" id="now-pages">
          <div id="explanation" tabindex="-1" aria-live="polite" aria-atomic="true"></div>
        </div>
        <div class="cpu-side-actions">
          <button class="hw-key cpu-wide" data-action="predict"></button>
          <button class="hw-key cpu-wide" data-action="compare" data-conclusion hidden>${LABELS.compareEnd}</button>
          <div class="hw-pager" id="now-pager"></div>
        </div>
      </div>
      <div class="hw-plate-body hw-fit" data-panel="scenes" hidden>
        <span class="hw-label cpu-panel-label">${LABELS.jumpToScene} <span class="hw-muted" id="scene-progress"></span></span>
        <nav class="hw-list hw-fill cpu-milestones" id="milestones" aria-label="핵심 학습 장면"></nav>
      </div>
      <div class="hw-plate-body hw-fit" data-panel="process" hidden>
        <div class="hw-seg cpu-process-pick" role="group" aria-label="자세히 볼 작업">${PROCESSES.map((p) => `<button type="button" data-pick="${p.id}" aria-pressed="false">${ledFor(p.id)}${p.id}</button>`).join("")}</div>
        <div class="hw-fill cpu-pages" id="process-detail"></div>
      </div>
      <div class="hw-plate-body hw-fit" data-panel="rules" hidden>
        <span class="hw-label cpu-panel-label">이 모델의 범위 · 흔한 오해</span>
        <ul class="hw-list hw-fill cpu-rules" id="rules">${content.rules.map((rule) => `<li>${rule}</li>`).join("")}</ul>
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
        <div class="cpu-tl-screen">
          <div class="cpu-tl-head">
            <span class="cpu-legend"><i class="cpu-swatch is-run"></i>CPU 실행</span>
            <span class="cpu-legend"><i class="cpu-swatch is-ready"></i>준비 큐 대기</span>
            ${hasIo ? `<span class="cpu-legend"><i class="cpu-swatch is-io"></i>입출력 대기</span>
            <span class="cpu-legend"><i class="cpu-swatch is-idle"></i>CPU 유휴</span>` : ""}
            <span class="cpu-usage" id="live-usage"></span>
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
    <div class="hw-plate-head"><span class="hw-label"><span class="hw-index">?</span> ${LABELS.predictTitle}</span><button class="hw-key hw-key--sm hw-key--icon" data-action="close-dialog" aria-label="닫기">${icon("close")}</button></div>
    <div id="prediction-body"></div>
  </dialog>
  <dialog id="comparison-dialog" class="hw-dialog cpu-compare" aria-labelledby="comparison-title">
    <div class="hw-plate-head"><span class="hw-label"><span class="hw-index">C</span> ${LABELS.compare} · ${LABELS.compareSub}</span><button class="hw-key hw-key--sm hw-key--icon" data-action="close-dialog" aria-label="닫기">${icon("close")}</button></div>
    <div id="comparison-body"></div>
  </dialog>
</div>`;

const root = document.querySelector("#app");
const $ = (selector) => root.querySelector(selector);
const rail = mountRail({ explorer: "cpu", title: "CPU 스케줄링", lessons: LESSONS, current: lesson.id });
const scene = createSchedulerScene($("#scene"), PROCESSES, (frame, view, move) =>
  presentFrame(frameAtMove(frame, view, move), move),
);

const sidePanel = plateTabs($(".hw-side"));
const nowPager = paginate($("#now-pages"), { label: "해설", pager: $("#now-pager") });
const scenePager = paginate($("#milestones"), { label: "장면" });
const processPager = paginate($("#process-detail"), { label: "상세" });
paginate($("#rules"), { label: "범위" });
// Totals come from the lesson's first method at its starting quantum.
const defaultMilestones = content.milestones(result);
const recallCount = content.recall(lessonRuns(lesson)).length;
const progress = createProgress(progressIdFor("cpu", LESSONS, lesson.id), { scenes: defaultMilestones.length, recall: recallCount });
rail.watch(progress);
progress.onChange((summary) => {
  const line = $("#now-pages .hw-progress");
  if (line) line.outerHTML = progressHtml(summary);
});
let shownMilestone = null;
const logWindow = rowWindow($(".cpu-log-box"), $("#event-log"), { current: () => $("#event-log tr[aria-current]") });
// Content that changes starts again on its first page.
function refill(pager, el, html, before) {
  html = keepUnits(html);
  if (el.dataset.html === html) return false;
  el.dataset.html = html;
  el.innerHTML = html;
  before?.(el);
  pager.refresh();
  pager.show(0);
  return true;
}

/* 정리: shown in 해설 after the finish chapter. The panel's sections become
   direct children of the paged column so they split into whole pages. */
let currentRecall = [];
function recapBlocks() {
  const runs = lessonRuns(lesson, quantum);
  currentRecall = content.recall(runs);
  const template = document.createElement("template");
  template.innerHTML = recapHtml({ id: "cpu", points: [], recall: currentRecall, next: nextLesson(LESSONS, lesson.id) });
  const panel = template.content.querySelector(".hw-recap");
  // Each 핵심 정리 point is its own block so short windows split between points.
  panel.firstElementChild.remove();
  const points = content.recapPoints(result, runs).map((point, i) =>
    i
      ? `<p class="hw-text cpu-recap-point">${point}</p>`
      : `<div class="cpu-recap-point"><span class="hw-label"><span class="hw-index">${LABELS.recap}</span> ${LABELS.recapPoints}</span><p class="hw-text">${point}</p></div>`,
  );
  return points.join("") + [...panel.children].map((child) => child.outerHTML).join("");
}
function fillRecap(box) {
  box.querySelector(".hw-recap-foot")?.insertAdjacentHTML("afterbegin", progressHtml(progress.summary()));
  bindRecap(box, { recall: currentRecall, progress, onAnswer: showRecallWhy });
}
// The answer note becomes its own block in the paged column, so a question
// and its feedback split into whole pages instead of overflowing one.
function showRecallWhy(question) {
  const box = $(`#now-pages [data-recall="${question.id}"]`);
  let wrap = box?.nextElementSibling;
  if (box && !wrap?.classList.contains("cpu-recall-why")) {
    wrap = document.createElement("div");
    wrap.className = "cpu-recall-why";
    box.after(wrap);
    wrap.append(box.querySelector(".hw-recall-why"));
  }
  requestAnimationFrame(() => {
    nowPager.refresh();
    if (wrap) nowPager.showItem(wrap);
  });
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
  $("#algo-tag").textContent = METHODS[algorithm].tag(quantum);
  if (hasQuantum) {
    $("#quantum").disabled = !rr;
    $("#quantum").value = quantum;
    $("#quantum-value").textContent = rr ? `${quantum}ms` : "사용 안 함";
    $(".cpu-quantum").classList.toggle("is-disabled", !rr);
  }
  $("#seek").max = result.stats.makespan;
  $("#seek-end").textContent = `${result.stats.makespan}ms`;
  $("#milestones").innerHTML = content.milestones(result)
    .map(
      (m, i) =>
        `<button data-time="${m.time}" data-milestone><span class="hw-index">${String(i + 1).padStart(2, "0")}</span><span class="cpu-grow">${m.title}</span><span class="hw-mono hw-muted">${m.time}ms</span></button>`,
    )
    .join("");
  scenePager.refresh();
  bindSliders(root);
  if (hasQuantum) syncSlider($("#quantum"));
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
// SJF and SRTF pick from anywhere in the queue; SRTF preempts on arrival.
const shortestMoves = {
  preempt: "더 짧은 작업에 밀린 작업이 진행한 계산을 보존한 채 준비 큐로 이동합니다.",
  dispatch: "준비 큐에서 남은 CPU 시간이 가장 짧은 작업이 CPU로 이동합니다.",
  complete: "CPU 시간을 다 쓴 작업이 완료 칸으로 이동합니다.",
};
const moveText = (type) =>
  (["sjf", "srtf"].includes(algorithm) && shortestMoves[type]) ||
  (!hasIo && type === "complete" ? shortestMoves.complete : moveExplanations[type]);

function render(animate = false, previous = null) {
  const frame = frameOf(time);
  movingEvent = null;
  const motion = scene.update(frame, previous, {
    animate: animate && !reducedMotion.matches,
    speed,
    quantum: algorithm === "rr" ? quantum : null,
    algorithm,
    cpuNote: METHODS[algorithm].cpu(quantum),
    queueNote: METHODS[algorithm].queue,
  });
  if (!movingEvent) presentFrame(frame);
  return motion;
}

function presentFrame(frame, move = null) {
  displayedFrame = frame;
  movingEvent = move;
  $("#scene").setAttribute(
    "aria-label",
    `${time}밀리초. ${move ? `${eventLabel(move, algorithm)} 이동 중` : `CPU ${frame.running || "대기"}`}. 준비 큐 ${frame.ready.join(", ") || "없음"}. 입출력 ${frame.blocked.map((b) => b.id).join(", ") || "없음"}. 완료 ${frame.completed.join(", ") || "없음"}. 작업을 선택하면 상세 정보를 볼 수 있습니다.`,
  );
  const clock = Math.max(0, time);
  $("#clock").textContent = clock;
  $("#seek").value = clock;
  $("#seek").setAttribute("aria-valuetext", `${clock}밀리초, 전체 ${result.stats.makespan}밀리초`);
  syncSlider($("#seek"));

  const milestones = content.milestones(result);
  const finished = time === result.stats.makespan;
  const intro = time < 0 && !move;
  let html;
  if (intro) {
    // 목표: the question and the setup; nothing that has not happened yet.
    const goal = content.intro(result);
    html = `<div id="explanation" tabindex="-1" aria-live="polite" aria-atomic="true"><span class="hw-label"><span class="hw-index">${lessonNumber}</span> ${goal.eyebrow}</span><h2 class="hw-title">${goal.title}</h2><p class="hw-text">${goal.body}</p></div>
    <p class="hw-text cpu-goal">${goal.goal}</p>
    <dl class="hw-list cpu-terms">${goal.terms.map(([term, meaning]) => `<div><dt>${term}</dt><dd class="hw-muted">${meaning}</dd></div>`).join("")}</dl>`;
  } else {
    const description = content.chapter(frame, result);
    let { key, notes } = content.stepNotes(frame, result);
    if (move) {
      const order = frame.events.length + 1;
      description.eyebrow = `${time} ms · 이번 사건 ${order}/${result.frames[time].events.length}`;
      description.title = eventLabel(move, algorithm);
      description.body = moveText(move.type);
      key = `이동 직전 준비 큐 · ${frame.ready.join(" → ") || "비어 있음"}`;
      notes = [];
    }
    const visibleEvents = move ? [...frame.events, move] : frame.events;
    const events = (visibleEvents.length
      ? visibleEvents
          .map((e) => `<li>${ledFor(e.id)}<span>${eventLabel(e, algorithm)}${e === move ? '<span class="hw-muted"> · 이동 중</span>' : ""}</span></li>`)
          .join("")
      : `<li>${ledFor(frame.running)}<span>${frame.running ? `${josa(frame.running, "가")} 다음 사건까지 실행을 이어갑니다.` : "입출력이 끝나기를 기다립니다."}</span></li>`) +
      notes.map((note) => `<li class="cpu-event-note"><span class="hw-muted">${note}</span></li>`).join("");
    const canReplay = !move && time >= 0 && result.frames[time].events.length > 0;
    html = `<div id="explanation" tabindex="-1" aria-live="polite" aria-atomic="true"><span class="hw-label">${description.eyebrow}</span><h2 class="hw-title">${description.title}</h2><p class="hw-text">${description.body}</p></div>
    <div><span class="hw-label cpu-events-head">${LABELS.now} 사건${canReplay ? `<button type="button" class="hw-key hw-key--sm" data-action="replay-event">${LABELS.now} 사건 다시 보기</button>` : ""}</span><ul class="hw-list cpu-events" id="current-events">${events}</ul></div>
    <div><p class="hw-note hw-note--accent" id="insight"><span><b>${LABELS.key}</b> · ${key}</span></p></div>`;
    if (finished && !move) html += recapBlocks();
  }
  refill(nowPager, $("#now-pages"), html, finished && !move && !intro ? fillRecap : null);

  const active = Math.max(0, milestones.findLastIndex((m) => m.time <= time));
  if (!intro && !move && milestones[active].time === time) progress.markScene(milestones[active].id ?? milestones[active].kind);
  root.querySelectorAll("[data-milestone]").forEach((b, i) => {
    b.classList.toggle("is-done", i < active);
    if (i === active) b.setAttribute("aria-current", "true");
    else b.removeAttribute("aria-current");
  });
  $("#scene-progress").textContent = `· ${active + 1} / ${milestones.length}`;
  const activeButton = root.querySelectorAll("[data-milestone]")[active];
  if (activeButton !== shownMilestone) scenePager.showItem((shownMilestone = activeButton));
  const hasNext = result.decisions.some((d) => d.time > time && d.candidates.length > 1);
  $('[data-action="predict"]').innerHTML = hasNext ? LABELS.predict("다음 CPU 배정") : `앞선 장면에서 다시 예측 ${icon("arrow")}`;
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
  const p = PROCESSES.find((entry) => entry.id === selectedProcess);
  const detail = processDetails(displayedFrame, result, selectedProcess);
  if (movingEvent?.id === selectedProcess) detail.body = `${eventLabel(movingEvent, algorithm)} 이동 중입니다.`;
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
    const left = frame.states[frame.running].burstRemaining;
    const until = {
      rr: `할당량 ${frame.quantumLeft}ms 남음`,
      fcfs: hasIo ? "입출력 요청 또는 완료까지" : `완료까지 ${left}ms`,
      sjf: `완료까지 ${left}ms`,
      srtf: `남은 ${left}ms · 더 짧은 작업이 오면 선점`,
    }[algorithm];
    text = `${frame.running} 실행 중 · ${until}`;
  } else {
    text = finished ? "세 작업을 모두 처리했습니다" : time < 0 ? "시작 전 · 아직 도착한 작업이 없습니다" : "CPU 유휴 · 준비된 작업이 없습니다";
  }
  $("#status-led").style.setProperty("--led", led ? `var(--${led.toLowerCase()})` : "var(--label-3)");
  $("#status-led").classList.toggle("is-on", !!led);
  $("#status-text").textContent = text;

  $("#scene").setAttribute("aria-busy", String(transitioning));
  const play = $('[data-action="play"]');
  const playLabel = canPause ? LABELS.pause : finished && !transitioning ? LABELS.replay : time < 0 ? LABELS.start : LABELS.resume;
  play.innerHTML = `${icon(canPause ? "pause" : finished && !transitioning ? "replay" : "play")}<span>${playLabel}</span>`;
  play.setAttribute("aria-label", playLabel);
  $('[data-action="back"]').disabled = time < 0;
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
        : time < 0
          ? "핵심 장면마다 멈춥니다."
          : "장면을 살펴본 뒤 이어서 재생하세요.";
}

function seek(next, animate = false) {
  pause();
  moveTo(Math.max(-1, Math.min(result.stats.makespan, next)), animate);
  if (time <= 0 && matchMedia("(max-width: 759px)").matches) $(".hw-stage").scrollIntoView({ block: "start", behavior: "instant" });
}
function pause() {
  playing = false;
  motionPaused = transitioning;
  cancelAnimationFrame(animationId);
  scene.pause();
  updateControls();
}
function moveTo(next, animate) {
  const previous = frameOf(time);
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
    if (movingEvent) presentFrame(frameOf(time));
    lastTick = performance.now();
    if (autoAdvance && playing && (time === result.stats.makespan || (guided && content.milestones(result).some((m) => m.time === time)))) pause();
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
  if (time === result.stats.makespan && !transitioning) seek(-1);
  playing = true;
  motionPaused = false;
  scene.resume();
  lastTick = performance.now();
  // From the start screen the jobs arrive right away.
  if (time < 0 && !transitioning) moveTo(0, true);
  updateControls();
  animationId = requestAnimationFrame(tick);
}
function reconfigure() {
  pause();
  ++transitionId;
  transitioning = false;
  result = run();
  pre = preFrame(result);
  time = -1;
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
  const rows = PROCESSES.map((p) => {
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
    <span class="hw-label">ms</span><div class="cpu-ticks">${ticks}</div>
    <span class="hw-label">CPU</span><div class="cpu-lane">${cpu}</div>
    ${rows}
    <i class="cpu-cursor" aria-hidden="true" style="--at:${Math.max(0, time) / total}"></i>
  </div>`;
  const elapsed = Math.max(0, time);
  const busy = result.frames.slice(0, elapsed).filter((f) => f.running).length;
  $("#live-usage").textContent = hasIo
    ? `경과 ${elapsed}ms · CPU 실행 ${busy}ms · 유휴 ${elapsed - busy}ms`
    : `경과 ${elapsed}ms · 완료 ${displayedFrame.completed.length}/${PROCESSES.length}`;
}
function renderLog() {
  const entries = (time < 0 ? [] : result.frames.slice(0, time).concat(displayedFrame))
    .reverse()
    .flatMap((f) => f.events.map((e) => ({ t: f.t, e })));
  $("#event-log").innerHTML = entries
    .map(
      ({ t, e }) =>
        `<tr data-time="${t}"${t === time ? ' aria-current="true"' : ""}><td><button class="cpu-time-link hw-mono" data-time="${t}" aria-label="${t}ms 사건으로 이동">${t}ms</button></td><td class="cpu-nowrap">${ledFor(e.id)} ${e.id || "CPU"}</td><td>${eventLabel(e, algorithm).replace(`${e.id} `, "")}</td></tr>`,
    )
    .join("");
  $("#log-count").textContent = entries.length;
  logWindow.refresh();
}
function renderMetrics() {
  const frame = displayedFrame;
  $("#metrics").innerHTML = PROCESSES.map((p) => {
    const s = frame.states[p.id];
    const turnaround = s.finishedAt === null ? (s.arriving ? "도착 중" : s.status === "new" ? "도착 전" : "진행 중") : `${s.finishedAt - p.arrival}ms`;
    const remaining = s.status === "done" ? "완료" : `${s.cpuRemaining}ms${s.status === "blocked" ? ` · 입출력 ${s.ioRemaining}ms` : ""}`;
    return `<tr class="is-clickable" data-process="${p.id}"${p.id === selectedProcess ? ' aria-current="true"' : ""}><td><button class="cpu-process-link" data-process="${p.id}">${ledFor(p.id)}<span><b class="hw-mono">${p.id}</b> ${p.name}<span class="hw-muted hw-mono cpu-cell-help">${p.arrival}ms 도착 · ${recipe(p)}</span></span></button></td><td class="hw-mono">${remaining}</td><td class="hw-mono">${s.firstRun === null ? "아직 실행 전" : `${number(s.firstRun - p.arrival)}ms`}</td><td class="hw-mono">${s.readyWait}ms</td><td class="hw-mono">${turnaround}</td></tr>`;
  }).join("");
}

/* ---------- Dialogs ---------- */

function openPrediction() {
  pause();
  const prediction = content.prediction(result, time);
  const { decision } = prediction;
  quiz = { ...prediction, answered: false, followAnswered: false };
  seek(prediction.beforeTime);
  const follow = prediction.followUp;
  $("#prediction-body").innerHTML = keepUnits(`
    <div class="hw-plate-body">
      <div class="hw-section">
        <span class="hw-label">${time < 0 ? "시작 전" : `${time}ms`}에서 멈춤</span>
        <h2 class="hw-title" id="prediction-title">${decision.time}ms, ${decision.cause === "keep" ? "CPU는 누가 쓰게 될까요?" : "다음 CPU는 누구에게 돌아갈까요?"}</h2>
        <p class="hw-text hw-muted">${prediction.hint}</p>
      </div>
      <div class="hw-section">
        <dl class="hw-list cpu-quiz-context">
          <div><dt class="hw-label">지금 CPU</dt><dd><b>${prediction.running || "유휴"}</b> <span class="hw-muted">${prediction.runningNote}</span></dd></div>
          <div><dt class="hw-label">${prediction.readyLabel}</dt><dd><b>${prediction.ready.join(prediction.readyLabel.includes("→") ? " → " : " · ") || "비어 있음"}</b></dd></div>
          <div><dt class="hw-label">${decision.time}ms에 들어오는 작업</dt><dd>${prediction.joined.join(" · ") || (hasIo ? "도착·입출력 복귀 없음" : "새로 도착하는 작업 없음")}</dd></div>
        </dl>
      </div>
      <div class="hw-section">
        <span class="hw-label">${decision.time}ms에 CPU를 받을 작업</span>
        <div class="cpu-choices">${prediction.choices
          .map(({ id }) => `<button class="hw-key" data-answer="${id}">${ledFor(id)}<span><b>${id}</b> ${PROCESSES.find((p) => p.id === id).name}</span></button>`)
          .join("")}</div>
        <div id="quiz-feedback" aria-live="polite"></div>
      </div>
      ${follow ? `<div class="hw-section" id="quiz-follow" hidden>
        <span class="hw-label">이어서 · 숫자로 예측</span>
        <p class="hw-text">${follow.question}${follow.context ? ` <span class="hw-muted">(${follow.context})</span>` : ""}</p>
        <div class="cpu-choices cpu-choices--numbers" style="--n:${follow.choices.length}">${follow.choices.map((n) => `<button class="hw-key" data-number="${n}"><b class="hw-mono">${n}ms</b></button>`).join("")}</div>
        <div id="quiz-follow-feedback" aria-live="polite"></div>
      </div>` : ""}
    </div>
    <div class="hw-plate-foot cpu-dialog-actions"><button class="hw-key hw-key--accent" data-action="quiz-continue" hidden>${LABELS.reveal}</button></div>`);
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
function showReveal() {
  const key = $('[data-action="quiz-continue"]');
  key.hidden = false;
  key.focus();
}
function answerPrediction(answer) {
  if (quiz.answered) return;
  quiz.answered = true;
  const chosen = quiz.decision.chosen;
  const picked = quiz.choices.find((choice) => choice.id === answer);
  const correct = picked.correct;
  progress.markPrediction(quiz.id, correct);
  markChoices("[data-answer]", "answer", chosen, answer);
  const right = quiz.choices.find((choice) => choice.correct);
  $("#quiz-feedback").innerHTML = keepUnits(`<div class="hw-note ${correct ? "hw-note--accent" : ""}"><div><p class="hw-heading">${correct ? LABELS.correct : LABELS.wrong(chosen)}</p><p>${picked.why}</p>${correct ? "" : `<p class="hw-muted">${right.why}</p>`}</div></div>`);
  // The feedback restates the queue, so the context makes room for the follow-up.
  $("#prediction-body .cpu-quiz-context").closest(".hw-section").hidden = true;
  $("#prediction-body .hw-section > .hw-text.hw-muted").hidden = true;
  $("#prediction-body").classList.add("is-answered");
  if (!quiz.followUp) return showReveal();
  $("#quiz-follow").hidden = false;
  $("[data-number]")?.focus();
}
function answerNumber(value) {
  if (!quiz.answered || quiz.followAnswered) return;
  quiz.followAnswered = true;
  const { answer, explanation } = quiz.followUp;
  const correct = Number(value) === answer;
  markChoices("[data-number]", "number", String(answer), String(value));
  $("#quiz-follow-feedback").innerHTML = keepUnits(`<div class="hw-note ${correct ? "hw-note--accent" : ""}"><div><p>${correct ? LABELS.correct : LABELS.wrong(`${answer}ms`)} ${explanation}</p></div></div>`);
  showReveal();
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
  progress.markCompared();
  const runs = lessonRuns(lesson, quantum);
  const [a, b] = lesson.methods.map((m) => runs[m]);
  const [labelA, labelB] = lesson.methods.map(methodLabel);
  const scale = Math.max(a.stats.makespan, b.stats.makespan);
  const summary = content.compare(runs, { quantum, processes: PROCESSES });
  const allRows = [
    ["평균 최초 응답", "도착 → 첫 CPU 실행", "averageResponse", "ms"],
    ["평균 대기 시간(준비 큐)", "준비 큐에서 기다린 시간", "averageWaiting", "ms"],
    ["평균 반환 시간", "도착 → 완료", "averageTurnaround", "ms"],
    ["전체 완료 시각", "모든 작업이 끝난 시각", "makespan", "ms"],
    ["CPU 활용률", "실행 시간 ÷ 전체 시간", "utilization", "%"],
    ["문맥 교환", "서로 다른 작업 사이의 전환(작업 전환)", "contextSwitches", "회"],
  ];
  // Without I/O the CPU never idles: utilization is 100% in both runs.
  const rows = allRows.filter(([, , key]) => hasIo || key !== "utilization");
  const other = lesson.methods.find((m) => m !== algorithm);
  const better = (key, a, b) => {
    if (a === b) return ["", ""];
    const higherIsBetter = key === "utilization";
    const aWins = higherIsBetter ? a > b : a < b;
    return aWins ? [" is-better", ""] : ["", " is-better"];
  };
  $("#comparison-body").innerHTML = keepUnits(`
    <div class="hw-plate-body">
      <div class="hw-section">
        <h2 class="hw-title" id="comparison-title">${lesson.question}</h2>
      </div>
      <div class="hw-section cpu-compare-runs">
        <span class="hw-label">${labelA}</span>${comparisonTimeline(a, scale)}<span class="hw-mono">${a.stats.makespan}ms</span>
        <span class="hw-label">${labelB}</span>${comparisonTimeline(b, scale)}<span class="hw-mono">${b.stats.makespan}ms</span>
      </div>
      <div class="hw-section cpu-table-scroll">
        <table class="hw-table cpu-compare-table"><thead><tr><th>지표</th><th>${labelA}</th><th>${labelB}</th></tr></thead><tbody>${rows
          .map(([title, description, key, unit]) => {
            const [betterA, betterB] = better(key, a.stats[key], b.stats[key]);
            return `<tr><td>${title}<span class="hw-muted cpu-cell-help">${description}</span></td><td class="hw-mono${betterA}">${number(a.stats[key])}${unit}</td><td class="hw-mono${betterB}">${number(b.stats[key])}${unit}</td></tr>`;
          })
          .join("")}</tbody></table>
      </div>
      <div class="hw-section">
        <div class="hw-note hw-note--accent"><div><p class="hw-heading">${summary.head}</p><p>${summary.body}</p>${summary.caveat ? `<p class="hw-muted">${summary.caveat}</p>` : ""}</div></div>
        ${summary.extra ? `<p class="hw-text hw-muted cpu-sweep">${summary.extra}</p>` : ""}
      </div>
    </div>
    <div class="hw-plate-foot cpu-dialog-actions">
      <button class="hw-key" data-action="try-other">${josa(METHODS[other].label, "으로")} 다시 보기 ${icon("arrow")}</button>
      <button class="hw-key hw-key--accent" data-action="close-dialog">계속 살펴보기</button>
    </div>`);
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
      seek(-1);
      break;
    case "replay-event": {
      // Play this boundary's moves again from the moment before.
      const at = time;
      seek(at - 1);
      seek(at, true);
      break;
    }
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
      algorithm = lesson.methods.find((m) => m !== algorithm);
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
$("#quantum")?.addEventListener("input", (e) => {
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
  } else if (e.key.toLowerCase() === "r" && !e.ctrlKey && !e.metaKey && !e.altKey) {
    seek(-1);
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});

updateThemeButton();
updateSettings();
render();
