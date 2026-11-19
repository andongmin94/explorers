import "../../shared/theme.css";
import "../../shared/hw.css";
import "./styles.css";
import "../../shared/switcher.js";
import "../../shared/iso.js";
import { bindSliders, icon, syncSlider } from "../../shared/hw.js";
import { paginate, plateTabs } from "../../shared/fit.js";
import { followRows } from "./fit-rows.js";
import { simulate, look, REQUESTS, INITIAL_HEAD } from "./engine.js";
import { createDiskScene } from "./scene.js";
import {
  COMPARE_STORY,
  MODEL_NOTES,
  NAMES,
  RULE_SHORT,
  STAGES,
  TAKEAWAY,
  josa,
  lessonAt,
  milestonesFor,
  phaseText,
  servicePosition,
  starvationNote,
} from "./lesson.js";

const $ = (s) => document.querySelector(s);
const SIDE_TABS = [
  ["lesson", "해설"],
  ["distance", "거리"],
  ["scenes", "장면"],
  ["scope", "범위"],
];
const N = REQUESTS.length;
const runs = { fcfs: simulate("fcfs"), sstf: simulate("sstf") };
const sweep = look(REQUESTS, INITIAL_HEAD, "down");
let algorithm = "fcfs",
  index = 0,
  committed = 0,
  busy = false,
  paused = false,
  resumeAutomatically = false,
  playing = false,
  guided = true,
  speed = 1,
  timer = null,
  revision = 0,
  record = "path",
  phase = "idle";
const run = () => runs[algorithm];
const current = () => run().steps[committed];
const heads = (n) => run().steps.slice(0, n + 1).map((s) => s.state.head);

document.documentElement.dataset.theme = localStorage.getItem("disk-theme") || "light";
const dark = () => document.documentElement.dataset.theme === "dark";

$("#app").outerHTML = `
<div class="hw-page disk-page">
  <header class="hw-topbar">
    <div class="hw-brand"><h1>디스크 스케줄링 탐색기</h1><p>보면서 이해하는 운영체제</p></div>
    <div class="hw-context"><span class="hw-label"><span class="hw-index">04</span> 대표 시나리오</span><strong>같은 요청, 다른 이동 거리</strong></div>
    <div class="hw-actions">
      <button class="hw-key hw-key--sm" data-action="compare">${icon("compare")}<span>두 방식 비교</span></button>
      <button class="hw-key hw-key--sm hw-key--icon" data-action="theme" aria-label="${dark() ? "밝은" : "어두운"} 테마로 전환">${icon(dark() ? "sun" : "moon")}</button>
    </div>
  </header>

  <main class="hw-console">
    <section class="hw-plate hw-stage" aria-labelledby="stage-label">
      <div class="hw-plate-head">
        <span class="hw-label" id="stage-label"><span class="hw-index">A</span> 요청 선택과 헤드 이동</span>
        <span class="hw-tag" id="stage-mode"></span>
        <div class="disk-lcds">
          <span class="hw-label">헤드</span><span class="hw-lcd" id="lcd-head">53<small>CYL</small></span>
          <span class="hw-label">누적 이동</span><span class="hw-lcd" id="lcd-total">0<small>CYL</small></span>
        </div>
      </div>
      <div class="hw-scene disk-scene" id="disk-scene" tabindex="-1"></div>
      <div class="hw-plate-foot"><span class="hw-led" id="foot-led"></span><span id="status" aria-live="polite"></span></div>
    </section>

    <section class="hw-plate hw-deck" aria-label="실험 조작">
      <div class="hw-field">
        <span class="hw-label">다음 요청을 고르는 기준</span>
        <div class="hw-seg" role="group" aria-label="스케줄링 알고리즘">
          <button data-algorithm="fcfs" aria-pressed="true">FCFS <span class="hw-muted">${RULE_SHORT.fcfs}</span></button>
          <button data-algorithm="sstf" aria-pressed="false">SSTF <span class="hw-muted">${RULE_SHORT.sstf}</span></button>
        </div>
      </div>
      <div class="hw-field disk-transport-field">
        <span class="hw-label">재생</span>
        <div class="hw-transport">
          <button class="hw-key hw-key--icon" data-action="reset" aria-label="처음으로">${icon("reset")}</button>
          <button class="hw-key hw-key--icon" data-action="back" aria-label="이전 요청">${icon("back")}</button>
          <button class="hw-key hw-key--accent disk-play" data-action="play" aria-label="재생"></button>
          <button class="hw-key" data-action="next">다음 요청 ${icon("next")}</button>
          <button class="hw-key hw-key--icon" data-action="replay" aria-label="이번 요청 다시 보기">${icon("replay")}</button>
          <button class="hw-key hw-key--icon hw-mono" data-action="speed" aria-label="재생 속도 1배, 바꾸기">1×</button>
        </div>
      </div>
      <div class="hw-seek">
        <span class="hw-label">0</span>
        <input id="seek" class="hw-slider" type="range" min="0" max="${N}" step="1" value="0" aria-label="처리한 요청 수" />
        <span class="hw-label">${N}</span>
      </div>
      <button class="hw-switch" role="switch" aria-checked="true" data-action="guided">요청마다 멈추기</button>
    </section>

    <aside class="hw-plate hw-side" aria-labelledby="side-label">
      <div class="hw-plate-head">
        <span class="hw-label" id="side-label"><span class="hw-index">B</span> 학습</span>
        <div class="hw-tabs" role="tablist" aria-label="학습 패널">${SIDE_TABS.map(
          ([id, label], i) => `<button type="button" id="side-tab-${id}" data-tab="${id}" aria-controls="side-${id}" aria-selected="${i === 0}">${label}</button>`,
        ).join("")}</div>
      </div>
      <div class="hw-plate-body hw-fit" id="side-lesson" data-panel="lesson" aria-labelledby="side-tab-lesson">
        <div class="hw-fill disk-pages" id="lesson-pages">
          <div class="hw-section">
            <span class="hw-label" id="eyebrow"></span>
            <h2 class="hw-title disk-title" id="lesson-title"></h2>
          </div>
          <p class="hw-text" id="lesson-body"></p>
          <div class="hw-section">
            <span class="hw-label">한 요청의 네 단계</span>
            <ol class="hw-list disk-stages" id="stages"></ol>
          </div>
          <div class="hw-section"><p class="hw-note hw-note--accent" id="takeaway"></p></div>
        </div>
        <div class="disk-cta">
          <button class="hw-key disk-wide" data-action="predict">다음 선택, 먼저 맞혀보기 ${icon("arrow")}</button>
          <button class="hw-key hw-key--accent disk-wide" data-action="compare" data-conclusion hidden>전체 이동 거리 비교 ${icon("arrow")}</button>
        </div>
      </div>
      <div class="hw-plate-body hw-fit" id="side-distance" data-panel="distance" aria-labelledby="side-tab-distance">
        <div class="hw-fill disk-pages" id="remaining"></div>
      </div>
      <div class="hw-plate-body hw-fit" id="side-scenes" data-panel="scenes" aria-labelledby="side-tab-scenes">
        <div class="hw-fill hw-list disk-milestones" id="milestones" aria-label="핵심 장면으로 이동"></div>
      </div>
      <div class="hw-plate-body hw-fit" id="side-scope" data-panel="scope" aria-labelledby="side-tab-scope">
        <div class="hw-fill disk-pages" id="scope-pages">${MODEL_NOTES.map(
          (n, i) => `<div class="hw-section"><span class="hw-label">모델 ${String(i + 1).padStart(2, "0")}</span><p class="hw-text disk-note">${n}</p></div>`,
        ).join("")}</div>
      </div>
    </aside>

    <section class="hw-plate hw-records" aria-label="관찰 기록">
      <div class="hw-plate-head">
        <div class="hw-tabs" role="tablist" aria-label="관찰 기록">
          <button role="tab" aria-selected="true" id="tab-path" aria-controls="record-path" data-record="path">헤드 이동 경로</button>
          <button role="tab" aria-selected="false" id="tab-log" aria-controls="record-log" data-record="log" tabindex="-1">처리 기록 <span class="hw-mono hw-muted" id="log-count">0</span></button>
          <button role="tab" aria-selected="false" id="tab-results" aria-controls="record-results" data-record="results" tabindex="-1">누적 결과</button>
        </div>
        <span class="hw-label disk-records-hint">완료한 요청을 눌러 그 순간으로 이동</span>
      </div>
      <div class="hw-plate-body hw-scroll">
        <section id="record-path" role="tabpanel" aria-labelledby="tab-path"></section>
        <section id="record-log" role="tabpanel" aria-labelledby="tab-log" hidden>
          <p class="hw-text hw-muted" id="log-empty">요청을 처리하면 선택 순서와 이동 거리가 기록됩니다.</p>
          <table class="hw-table" id="log-table"><thead><tr><th>처리 순서</th><th>원래 요청</th><th>헤드 이동</th><th>이번 거리</th><th>누적 거리</th></tr></thead><tbody></tbody></table>
        </section>
        <section id="record-results" role="tabpanel" aria-labelledby="tab-results" hidden></section>
      </div>
    </section>
  </main>

  <footer class="hw-footer">
    <span>조작: <kbd>Space</kbd> 재생·정지 <kbd>←</kbd><kbd>→</kbd> 요청 이동 <kbd>R</kbd> 처음으로</span>
    <a href="https://pages.cs.wisc.edu/~remzi/OSTEP/file-disks.pdf" target="_blank" rel="noreferrer">학습 근거 · OSTEP: Hard Disk Drives ↗</a>
  </footer>

  <dialog class="hw-dialog disk-dialog" id="comparison-dialog" aria-labelledby="comparison-title"></dialog>
  <dialog class="hw-dialog disk-dialog" id="prediction-dialog" aria-labelledby="prediction-title"></dialog>
</div>`;

const scene = createDiskScene($("#disk-scene"), {
  onHead(c) {
    $("#lcd-head").innerHTML = `${c}<small>CYL</small>`;
  },
  onPhase(kind, step) {
    phase = kind;
    const text = phaseText(kind, step, algorithm);
    $("#status").textContent = text.title;
    $("#foot-led").classList.toggle("is-on", busy || kind === "done");
    const shown = kind === "arrive" || kind === "done" ? step.state : step.before;
    $("#lcd-total").innerHTML = `${shown.total}<small>CYL</small>`;
    if (busy && text.body) $("#lesson-body").textContent = text.body;
    renderStages(step);
    pagers?.lesson.refresh();
  },
});

/* ---------- One screen: side tabs and pages, records rows that fit ---------- */

plateTabs($(".hw-side"));
const pagers = {
  lesson: paginate($("#lesson-pages"), { label: "쪽" }),
  distance: paginate($("#remaining"), { label: "쪽" }),
  scenes: paginate($("#milestones"), { label: "쪽" }),
  scope: paginate($("#scope-pages"), { label: "쪽" }),
};
const logRows = followRows($(".hw-records > .hw-plate-body"));
let lessonKey = "";

/* ---------- Rendering ---------- */

function renderStages(step) {
  const at = STAGES.findIndex((s) => s.kind === phase);
  const reached = (i) => (busy ? i <= at : index > 0);
  const detail = {
    select: step.index ? `요청 ${step.request.id} · ${step.request.cylinder}` : "",
    controller: "",
    seek: step.index ? `${step.before.head} → ${step.state.head}` : "",
    arrive: step.index ? `${step.before.total} + ${step.distance} = ${step.state.total}` : "",
  };
  $("#stages").innerHTML = STAGES.map(
    (s, i) =>
      `<li${busy && i === at ? ' aria-current="step"' : ""}><span class="hw-led${reached(i) ? " is-on" : ""}"></span><span class="hw-index">${i + 1}</span>${s.label}<span class="hw-mono hw-muted disk-stage-detail">${reached(i) ? detail[s.kind] : ""}</span></li>`,
  ).join("");
}

function controls() {
  const moving = playing || (busy && !paused);
  const play = $('[data-action="play"]');
  play.innerHTML = moving
    ? `${icon("pause")}일시정지`
    : `${icon("play")}${committed === N && !busy ? "다시 재생" : index ? "이어서 재생" : "학습 시작"}`;
  play.setAttribute("aria-label", moving ? "일시정지" : "재생");
  $('[data-action="next"]').disabled = index === N || busy;
  $('[data-action="back"]').disabled = index === 0;
  $('[data-action="replay"]').disabled = index === 0 || busy;
  $('[data-action="guided"]').setAttribute("aria-checked", String(guided));
  $("#disk-scene").setAttribute("aria-busy", String(busy));
}

function render() {
  const step = current();
  const state = step.state;
  const target = run().steps[index];
  const seek = $("#seek");
  seek.value = index;
  seek.setAttribute("aria-valuetext", `${index} / ${N} 요청${busy ? " 처리 중" : " 완료"}`);
  syncSlider(seek);
  document
    .querySelectorAll(".hw-seg [data-algorithm]")
    .forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.algorithm === algorithm)));
  $("#stage-mode").textContent = `${NAMES[algorithm]} · ${RULE_SHORT[algorithm]}`;

  if (busy) {
    $("#eyebrow").textContent = `${index}번째 요청 · 처리 중`;
    $("#lesson-title").textContent = `요청 ${target.request.id} · ${target.request.cylinder}번 처리 중`;
  } else {
    const l = lessonAt(algorithm, index, step);
    $("#eyebrow").textContent = l.eyebrow;
    $("#lesson-title").textContent = l.title;
    $("#lesson-body").textContent = l.body;
  }
  renderStages(busy ? target : step);

  // The distances behind the choice just made are shown; the next choice's
  // distances are left for the learner to work out (and the prediction).
  const cells = (list, dist) =>
    `<div class="disk-distances">${list
      .map((r) => `<span${r.id === step.request?.id ? ' class="is-chosen"' : ""}><b class="hw-mono">${r.cylinder}</b><span class="hw-mono hw-muted">${dist(r)}</span></span>`)
      .join("")}</div>`;
  const last = committed
    ? `<div class="hw-section"><span class="hw-label">직전 선택 · 헤드 ${step.before.head}에서 잰 거리</span>${cells(step.candidates.slice().sort((a, b) => a.id - b.id), (r) => `${r.distance}칸`)}</div>`
    : "";
  $("#remaining").innerHTML = busy
    ? `<div class="hw-section"><span class="hw-label">남은 요청까지의 거리</span><p class="hw-text hw-muted disk-body">${josa(`요청 ${target.request.id}번`, "을")} 처리하는 중입니다. 헤드가 도착하면 남은 요청까지 거리를 다시 잽니다.</p></div>`
    : state.pending.length
      ? `<div class="hw-section"><span class="hw-label">다음 후보 · 헤드 ${state.head}</span>${cells(state.pending, () => "?칸")}
      <p class="hw-text hw-muted disk-small">${algorithm === "fcfs" ? "FCFS는 거리가 아니라 도착 순서로 선택" : "SSTF는 이 거리 중 최솟값을 선택 · 직접 계산한 뒤 맞혀보세요"}</p></div>${last}`
      : `${last}<div class="hw-section"><p class="hw-text hw-muted disk-body">남은 요청이 없습니다. 처리 기록과 두 방식 비교에서 전체 이동을 확인하세요.</p></div>`;
  $("#takeaway").textContent = algorithm === "sstf" ? `${TAKEAWAY.sstf} ${starvationNote(runs)}` : TAKEAWAY.fcfs;
  $('[data-action="predict"]').hidden = busy || committed === N;
  $("[data-conclusion]").hidden = committed !== N;
  $("#milestones").innerHTML = milestonesFor(algorithm, run()).map(
    (m) =>
      `<button data-seek="${m.n}"${m.n === index ? ' aria-current="true"' : ""}><span class="hw-index">${String(m.n).padStart(2, "0")}</span>${m.label}</button>`,
  ).join("");
  const key = `${algorithm}:${index}`;
  pagers.lesson.refresh();
  if (key !== lessonKey) pagers.lesson.show(0);
  lessonKey = key;
  pagers.distance.refresh();
  pagers.scenes.refresh();
  const here = $("#milestones [aria-current]");
  if (here) pagers.scenes.showItem(here);
  renderRecords();
  controls();
}

// A stop's label sits in a free corner next to its dot: on the left, on the
// vertical side away from the line arriving from the previous stop (the first
// stop uses the right, away from the line leaving it), so no line crosses it.
function labelPlace(seen, i) {
  const c = seen[i].state.head;
  const prev = seen[i - 1];
  const other = prev ?? seen[i + 1];
  const above = other ? other.state.head > c : true;
  return `${prev ? "is-left" : "is-right"} ${above ? "is-above" : "is-below"}`;
}

function renderRecords() {
  const seen = run().steps.slice(0, committed + 1);
  $("#log-count").textContent = committed;
  // Route screen: a seek graph, processing order across and cylinder down
  // (0 outer at the top). Each stop is a key that seeks to that moment.
  const px = (k) => ((k / N) * 100).toFixed(2);
  const py = (c) => ((c / 199) * 100).toFixed(2);
  const TICKS = [0, 50, 100, 150, 199];
  $("#record-path").innerHTML = `<div class="hw-screen disk-route-screen">
      <div class="hw-screen-head"><span class="is-on">HEAD ROUTE</span><span>${NAMES[algorithm]} · ${committed} / ${N}</span><span>${committed < N ? "처리한 요청만 표시" : `누적 ${current().state.total} CYL`}</span></div>
      <div class="disk-plot">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          ${TICKS.map((c) => `<line class="disk-plot-row" x1="0" y1="${py(c)}" x2="100" y2="${py(c)}"/>`).join("")}
          ${Array.from({ length: N + 1 }, (_, k) => `<line class="disk-plot-col" x1="${px(k)}" y1="0" x2="${px(k)}" y2="100"/>`).join("")}
          <polyline class="disk-plot-line" points="${seen.map((s) => `${px(s.index)},${py(s.state.head)}`).join(" ")}"/>
        </svg>
        ${[0, 100, 199].map((c) => `<span class="disk-plot-cyl" style="--y:${py(c)}%">${c}</span>`).join("")}
        ${seen
          .map(
            (s, i) =>
              `<button class="disk-stop ${labelPlace(seen, i)}" style="--x:${px(s.index)}%;--y:${py(s.state.head)}%" data-seek="${s.index}"${s.index === committed ? ' aria-current="true"' : ""} aria-label="${s.index ? `${s.index}번째 요청, 헤드 ${s.state.head}` : "시작, 헤드 53"}으로 이동"><i></i><span><b>${s.state.head}</b>${s.index ? `<small>+${s.distance}</small>` : ""}</span></button>`,
          )
          .join("")}
      </div>
      <div class="disk-plot-axis" aria-hidden="true">${Array.from({ length: N + 1 }, (_, k) => `<span style="--x:${px(k)}%">${k ? `${k}번째` : "시작"}</span>`).join("")}</div>
    </div>`;
  $("#log-empty").hidden = committed > 0;
  $("#log-table").hidden = !committed;
  $("#log-table tbody").innerHTML = seen
        .slice(1)
        .map(
          (s) =>
            `<tr class="is-clickable" data-seek-row="${s.index}"${s.index === committed ? ' aria-current="true"' : ""}><td><button class="disk-rowlink" data-seek="${s.index}">${s.index}번째</button></td><td>요청 ${s.request.id}</td><td class="hw-mono">${s.before.head} → ${s.state.head}</td><td class="hw-mono">${s.distance}칸</td><td class="hw-mono">${s.state.total}칸</td></tr>`,
        )
    .join("");
  logRows.refresh();
  const s = current().state;
  const longest = Math.max(0, ...seen.slice(1).map((x) => x.distance));
  $("#record-results").innerHTML = `<dl class="disk-metrics">
      <div><dt class="hw-label">처리한 요청</dt><dd class="hw-mono">${committed}<small>/ ${N}</small></dd></div>
      <div><dt class="hw-label">요청당 평균 이동</dt><dd class="hw-mono">${committed ? (s.total / committed).toFixed(1) : "—"}<small>칸</small></dd></div>
      <div><dt class="hw-label">가장 긴 한 번 이동</dt><dd class="hw-mono">${committed ? longest : "—"}<small>칸</small></dd></div>
    </dl>
    <p class="hw-text hw-muted disk-small">${committed === N ? "같은 요청 전체를 처리한 결과입니다. 두 방식 비교에서 이동 경로와 합계를 함께 확인하세요." : "현재까지 완료한 요청의 결과입니다. 누적 이동 거리는 장면의 표시창에 있습니다."}</p>`;
}

/* ---------- Playback ---------- */

function pause() {
  playing = false;
  clearTimeout(timer);
  paused = busy;
  scene.pause();
  controls();
}
function schedule() {
  clearTimeout(timer);
  if (playing && !busy && index < N) timer = setTimeout(() => move(index + 1, true), 480 / speed);
}
async function move(next, motion = false) {
  const token = ++revision;
  clearTimeout(timer);
  index = Math.max(0, Math.min(N, next));
  busy = motion;
  paused = false;
  resumeAutomatically = playing;
  if (motion) render();
  await scene.update(run().steps[index], { motion, speed, heads: heads(index) });
  if (token !== revision) return;
  committed = index;
  busy = false;
  paused = false;
  render();
  if (index === N || (guided && playing)) playing = false;
  controls();
  schedule();
}
function jump(next) {
  pause();
  move(next, false);
}
async function replay() {
  const target = index;
  pause();
  await move(target - 1, false);
  await move(target, true);
}
function play() {
  if (playing || (busy && !paused)) {
    pause();
    return;
  }
  if (busy && paused && !resumeAutomatically) {
    paused = false;
    scene.resume();
    controls();
    return;
  }
  if (committed === N && !busy) {
    committed = index = 0;
    scene.update(current(), { heads: heads(0) });
    render();
  }
  playing = true;
  paused = false;
  scene.resume();
  controls();
  schedule();
}
function focusScene(block = "start") {
  $("#disk-scene").focus({ preventScroll: true });
  if (matchMedia("(max-width: 759px)").matches) $("#disk-scene").scrollIntoView({ block, behavior: "instant" });
}
function changeAlgorithm(name) {
  pause();
  revision++;
  algorithm = name;
  index = committed = 0;
  busy = paused = false;
  scene.update(current(), { heads: heads(0) });
  render();
  focusScene();
}
function selectRecord(name) {
  record = name;
  document.querySelectorAll("[data-record]").forEach((b) => {
    const yes = b.dataset.record === name;
    b.setAttribute("aria-selected", String(yes));
    b.tabIndex = yes ? 0 : -1;
  });
  for (const id of ["path", "log", "results"]) $(`#record-${id}`).hidden = id !== name;
  logRows.refresh();
}

/* ---------- Dialogs ---------- */

// The same seek graph as the records screen: order across, cylinder down.
function miniPath(r) {
  const w = 300,
    h = 132,
    x = (k) => 10 + k * ((w - 20) / N),
    y = (c) => 8 + (c / 199) * (h - 16);
  const pts = r.steps.map((s) => `${x(s.index).toFixed(1)},${y(s.state.head).toFixed(1)}`).join(" ");
  return `<div class="hw-screen disk-mini-screen">
    <div class="hw-screen-head"><span class="is-on">HEAD ROUTE</span><span>CYL 0 → 199 ↓</span></div>
    <svg class="disk-mini" viewBox="0 0 ${w} ${h}" role="img" aria-label="${r.order.join(", ")} 순서의 헤드 이동 경로">
      ${[0, 50, 100, 150, 199].map((c) => `<line x1="4" y1="${y(c)}" x2="${w - 4}" y2="${y(c)}"/>`).join("")}
      <polyline points="${pts}"/>
      ${r.steps.map((s) => `<circle cx="${x(s.index).toFixed(1)}" cy="${y(s.state.head).toFixed(1)}" r="2.8"/>`).join("")}
    </svg>
  </div>`;
}

function dialogHead(label, title, id) {
  return `<div class="hw-plate-head"><div class="disk-dialog-title"><span class="hw-label">${label}</span><h2 class="hw-title" id="${id}">${title}</h2></div><button class="hw-key hw-key--sm hw-key--icon" data-action="close" aria-label="닫기">${icon("close")}</button></div>`;
}

function comparison() {
  pause();
  $("#comparison-dialog").innerHTML = `${dialogHead(`같은 요청 ${N}개 · 같은 시작점 ${INITIAL_HEAD}`, "순서가 바꾸는 이동 거리", "comparison-title")}
    <div class="disk-compare">${Object.entries(runs)
      .map(
        ([name, r]) => `<section>
          <span class="hw-label"><span class="hw-index">${name === "fcfs" ? "01" : "02"}</span> ${NAMES[name]} · ${RULE_SHORT[name]}</span>
          <span class="hw-lcd is-large">${r.total}<small>CYL</small></span>
          ${miniPath(r)}
          <p class="hw-mono disk-order">${INITIAL_HEAD} → ${r.order.join(" → ")}</p>
          <p class="hw-text">${COMPARE_STORY[name]} 183번은 ${servicePosition(r, 183)}번째로 처리됩니다.</p>
          <button class="hw-key${name === algorithm ? "" : " hw-key--accent"}" data-algorithm="${name}" data-close="true">이 방식으로 다시 보기 ${icon("arrow")}</button>
        </section>`,
      )
      .join("")}</div>
    <div class="hw-plate-foot">SSTF는 FCFS보다 ${runs.fcfs.total - runs.sstf.total}칸 덜 움직이지만 이 예제에서도 최소는 아닙니다. 먼저 바깥쪽으로 쓸고 돌아오는 ${INITIAL_HEAD} → ${josa(sweep.order.join(" → "), "은")} ${sweep.total}칸입니다. 한 방향으로 쓸어 가는 이 생각이 다음 방식인 SCAN/LOOK입니다.</div>`;
  $("#comparison-dialog").showModal();
}

function prediction() {
  pause();
  const next = run().steps[committed + 1];
  if (!next) return;
  const head = current().state.head;
  $("#prediction-dialog").innerHTML = `${dialogHead(`${NAMES[algorithm]} · 현재 헤드 ${head}`, "다음에 어느 요청을 고를까요?", "prediction-title")}
    <div class="hw-plate-body">
      <p class="hw-text">${algorithm === "fcfs" ? "도착 순서를 근거로 선택하세요. 요청 번호가 도착 순서입니다." : `헤드 ${head}에서 각 실린더까지 거리를 직접 계산해 선택하세요.`} 버튼은 실린더 번호 순서입니다.</p>
      <div class="disk-choices">${current()
        .state.pending.slice()
        .sort((a, b) => a.cylinder - b.cylinder || a.id - b.id)
        .map(
          (r) =>
            `<button class="hw-key" data-answer="${r.id}">${algorithm === "fcfs" ? `<span class="hw-label">요청 ${r.id}번</span>` : ""}<b class="hw-mono">${r.cylinder}</b></button>`,
        )
        .join("")}</div>
      <div id="prediction-feedback" aria-live="polite"></div>
    </div>`;
  $("#prediction-dialog").showModal();
}

// What the answer explains: FCFS names the arrival order (even when a nearer
// request exists); SSTF shows the distances the learner was asked to compute.
function predictionFeedback(next, chosenId) {
  const chosen = next.candidates.find((c) => c.id === chosenId);
  if (algorithm === "fcfs") {
    const wrong = chosen.id === next.request.id ? "" : ` ${chosen.cylinder}번은 요청 ${chosen.id}번으로 더 늦게 도착했습니다.`;
    return `${josa(`${next.request.cylinder}번`, "을")} 고릅니다. 요청 ${next.request.id}번이 남은 요청 중 먼저 도착했기 때문입니다.${wrong}`;
  }
  const near = next.candidates.slice(0, 2).map((c) => `${c.cylinder}번 ${c.distance}칸`).join(" · ");
  const wrong = chosen.id === next.request.id ? "" : ` 고른 ${chosen.cylinder}번은 ${chosen.distance}칸입니다.`;
  return `${josa(`${next.request.cylinder}번`, "을")} 고릅니다. 헤드 ${next.before.head}에서 가까운 순서: ${near}.${wrong}`;
}

function answer(b) {
  const next = run().steps[committed + 1];
  const correct = Number(b.dataset.answer) === next.request.id;
  document.querySelectorAll("[data-answer]").forEach((x) => {
    x.disabled = true;
    x.classList.toggle("is-correct", Number(x.dataset.answer) === next.request.id);
  });
  $("#prediction-feedback").innerHTML = `<div class="hw-section">
      <h3 class="hw-heading">${correct ? "맞았습니다." : "선택 기준을 다시 확인하세요."}</h3>
      <p class="hw-text">${predictionFeedback(next, Number(b.dataset.answer))}</p>
      <button class="hw-key hw-key--accent" data-action="verify">실제 이동으로 확인 ${icon("arrow")}</button>
    </div>`;
  $('[data-action="verify"]').focus();
}

/* ---------- Events ---------- */

document.addEventListener("click", (e) => {
  const row = e.target.closest("tr[data-seek-row]");
  if (row && !e.target.closest("button")) {
    jump(Number(row.dataset.seekRow));
    return;
  }
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.algorithm) {
    if (b.dataset.close) b.closest("dialog").close();
    changeAlgorithm(b.dataset.algorithm);
    return;
  }
  if (b.dataset.seek !== undefined) {
    jump(Number(b.dataset.seek));
    return;
  }
  if (b.dataset.record) {
    selectRecord(b.dataset.record);
    return;
  }
  if (b.dataset.answer) {
    answer(b);
    return;
  }
  switch (b.dataset.action) {
    case "play":
      play();
      break;
    case "next":
      pause();
      move(index + 1, true);
      break;
    case "back":
      jump(index - 1);
      break;
    case "reset":
      jump(0);
      break;
    case "replay":
      replay();
      break;
    case "speed":
      speed = speed === 1 ? 2 : speed === 2 ? 0.5 : 1;
      scene.setSpeed(speed);
      b.textContent = `${speed}×`;
      b.setAttribute("aria-label", `재생 속도 ${speed}배, 바꾸기`);
      schedule();
      break;
    case "guided":
      guided = !guided;
      controls();
      break;
    case "compare":
      comparison();
      break;
    case "predict":
      prediction();
      break;
    case "verify":
      $("#prediction-dialog").close();
      focusScene("nearest");
      move(index + 1, true);
      break;
    case "close":
      b.closest("dialog").close();
      break;
    case "theme": {
      const toDark = !dark();
      document.documentElement.dataset.theme = toDark ? "dark" : "light";
      localStorage.setItem("disk-theme", toDark ? "dark" : "light");
      b.setAttribute("aria-label", toDark ? "밝은 테마로 전환" : "어두운 테마로 전환");
      b.innerHTML = icon(toDark ? "sun" : "moon");
      break;
    }
  }
});
$("#seek").addEventListener("input", (e) => jump(Number(e.target.value)));
$(".hw-records .hw-tabs").addEventListener("keydown", (e) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
  const tabs = [...document.querySelectorAll("[data-record]")];
  const at = tabs.indexOf(document.activeElement);
  if (at < 0) return;
  e.preventDefault();
  const next =
    e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : (at + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  tabs[next].focus();
  selectRecord(tabs[next].dataset.record);
});
document.addEventListener("keydown", (e) => {
  if (document.querySelector("dialog[open]") || e.target.closest("button,input,select,textarea,summary,a")) return;
  if (e.code === "Space") {
    e.preventDefault();
    play();
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    jump(index + 1);
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    jump(index - 1);
  } else if (e.key.toLowerCase() === "r") jump(0);
});

// Deep link: ?algo=sstf&step=3 opens that moment; &play=next animates the next
// request, &record=log picks a records tab, &dialog=compare|predict opens one.
const q = new URLSearchParams(location.search);
if (q.get("algo") in runs) algorithm = q.get("algo");
index = committed = Math.max(0, Math.min(N, Number(q.get("step")) || 0));
if (q.get("record")) record = q.get("record");
bindSliders(document);
scene.update(current(), { heads: heads(index) });
render();
selectRecord(record);
if (q.get("play") === "next") move(index + 1, true);
if (q.get("dialog") === "compare") comparison();
if (q.get("dialog") === "predict") prediction();
