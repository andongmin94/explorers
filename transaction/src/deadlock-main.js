import "./styles.css";
import "./deadlock.css";
import "./deadlock-controls.css";
import { simulateDeadlock } from "./deadlock-engine.js";
import {
  describeDeadlockStep,
  DEADLOCK_MILESTONES,
  DEADLOCK_SOURCES,
  DEADLOCK_NOTES,
} from "./deadlock-lesson.js";
import { createDeadlockScene } from "./deadlock-scene.js";

const $ = (selector) => document.querySelector(selector);
const run = simulateDeadlock(),
  last = run.steps.length - 1;
let index = 0,
  completed = 0,
  busy = false,
  playing = false,
  paused = false,
  guided = true,
  speed = 1,
  revision = 0,
  timer = null;
const current = () => run.steps[completed];
const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const tx = (id) => `<b class="tx-id ${id.toLowerCase()}">${id}</b>`;
const actions = {
  initial: "시작 전",
  begin: "시작",
  write: "쓰기",
  wait: "잠금 대기",
  detect: "교착 감지",
  rollback: "롤백",
  resume: "쓰기 재개",
  commit: "커밋",
};
const paths = {
  db: '<path d="M4 5c0-4 16-4 16 0v14c0 4-16 4-16 0V5m0 0c0 4 16 4 16 0M4 12c0 4 16 4 16 0"/>',
  play: '<path d="m8 5 11 7-11 7z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  reset: '<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  next: '<path d="m9 5 7 7-7 7"/>',
  moon: '<path d="M20 14a8 8 0 0 1-10-10 8 8 0 1 0 10 10Z"/>',
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;

$("#app").innerHTML = `
<header class="app-header"><div class="brand-icon">${icon("db")}</div><div><h1>트랜잭션 탐색기</h1><p>보면서 이해하는 데이터베이스</p></div><div class="scenario-heading"><small>교착 상태 시나리오</small><strong>서로의 잠금을 기다리는 두 주문</strong></div><div class="header-actions"><button class="button icon-button" data-action="theme" aria-label="어두운 테마로 전환">${icon("moon")}</button></div></header>
<nav class="scenario-nav" aria-label="트랜잭션 시나리오"><a href="./"><b>01</b> 재고 갱신</a><a href="./deadlock.html" aria-current="page"><b>02</b> 교착 상태와 롤백</a></nav>
<main class="workspace deadlock-workspace">
<aside class="panel setup-panel"><button class="panel-head setup-toggle" data-action="setup" aria-expanded="true" aria-controls="setup-content"><h2>실험 조건</h2><span>두 행 · 두 주문 ⌄</span></button><div class="setup-content" id="setup-content"><div class="section-label">엇갈린 잠금 순서</div><div class="dl-orders"><div class="dl-order">${tx("T1")} <strong>A → B</strong><span>A를 먼저 수정</span></div><div class="dl-order">${tx("T2")} <strong>B → A</strong><span>B를 먼저 수정</span></div></div><p class="rule-summary">두 주문 모두 두 행을 1씩 줄이려 합니다. <b>첫 잠금을 놓지 않은 채</b> 상대가 잠근 행을 요청합니다.</p><div class="scenario-goal"><span>처음 확정 재고</span><strong>A <b>10</b> · B <b>20</b></strong><small>UPDATE는 각 행의 stock − 1</small></div><div class="section-label">이번 장면에서 볼 것</div><ol class="recipe"><li><b>보유</b><span>누가 어느 행을 잠갔나</span></li><li><b>대기</b><span>누구를 기다리고 있나</span></li><li><b>순환</b><span>서로 기다려 멈추는 순간</span></li><li><b>해소</b><span>롤백 → 잠금 해제 → 재개</span></li></ol><div class="isolation"><b>READ COMMITTED</b><span>PostgreSQL · 고정된 사건 순서</span></div><details class="model-notes"><summary>이 실험의 범위</summary><ul>${DEADLOCK_NOTES.map((text) => `<li>${text}</li>`).join("")}</ul></details></div></aside>
<section class="panel scene-panel"><div class="panel-head"><h2>잠금과 대기의 연결</h2><b class="step-clock"><span id="step-count">0</span><small>/ ${last} 사건</small></b></div><div id="deadlock-scene"></div><div class="scene-summary"><div class="dl-summary-copy"><strong id="state-summary"></strong><span id="commit-summary"></span></div><button class="replay-event" data-action="replay" disabled>↻ 이번 사건 다시 보기</button></div><div class="transport"><div class="learning-mode"><button role="switch" aria-checked="true" data-action="guided"><i></i>핵심 장면에서 멈추기</button><span id="playback-hint"></span></div><div class="playback-buttons"><button class="button icon-button" data-action="reset" aria-label="처음으로">${icon("reset")}</button><button class="button icon-button" data-action="back" aria-label="이전 사건">${icon("back")}</button><button class="button primary play-button" data-action="play">${icon("play")}<span>학습 시작</span></button><button class="button" data-action="next">다음 사건 ${icon("next")}</button><button class="button speed-button" data-action="speed" aria-label="재생 속도 변경">1×</button></div><div class="seek-row"><span>0</span><input id="seek" type="range" min="0" max="${last}" value="0" step="1" aria-label="처리한 사건 수"/><span>${last}</span></div></div></section>
<aside class="panel lesson-panel"><div class="panel-head"><h2>단계 해설</h2><span>교착 상태와 롤백</span></div><nav id="milestones" aria-label="핵심 학습 장면"></nav><div class="lesson-content"><div id="explanation"></div><div class="event-card"><div class="event-card-head"><strong id="event-title"></strong><span id="event-number"></span></div><p id="event-body" aria-live="polite"></p><code id="current-sql"></code><div id="dl-facts"></div></div><ul id="lesson-details" class="lesson-details"></ul><div class="insight"><b>!</b><p id="takeaway"></p></div><button class="button prediction-button" data-action="predict" hidden>롤백으로 무엇이 취소될까? →</button></div></aside>
<section class="panel records-panel"><div class="record-tabs" role="tablist" aria-label="관찰 기록"><button id="tab-timeline" role="tab" aria-selected="true" aria-controls="record-timeline" data-record="timeline">실행 순서</button><button id="tab-log" role="tab" aria-selected="false" aria-controls="record-log" data-record="log" tabindex="-1">잠금 기록 <span id="log-count"></span></button><button id="tab-results" role="tab" aria-selected="false" aria-controls="record-results" data-record="results" tabindex="-1">재고 결과</button><span class="record-hint">기록을 눌러 그 사건으로 이동</span></div><section id="record-timeline" role="tabpanel" aria-labelledby="tab-timeline"><div class="history-legend"><span><strong>사건별 잠금과 재고</strong> 각 사건을 처리한 뒤의 상태</span><span><i class="waiting-sample"></i>잠금 대기 · 미확정 값은 확정 재고에 포함하지 않음</span></div><div class="timeline-wrap" id="timeline"></div></section><section id="record-log" role="tabpanel" aria-labelledby="tab-log" hidden><div id="sql-log" class="sql-log"></div></section><section id="record-results" role="tabpanel" aria-labelledby="tab-results" hidden><div id="result-metrics"></div></section></section></main>
<footer><span><kbd>Space</kbd> 재생·정지 <kbd>←</kbd><kbd>→</kbd> 사건 이동 <kbd>R</kbd> 처음으로</span><span>학습 근거 ${DEADLOCK_SOURCES.map((source) => `<a href="${source.url}" target="_blank" rel="noreferrer">${source.title} ↗</a>`).join(" · ")}</span></footer><dialog id="prediction-dialog" aria-labelledby="prediction-title"></dialog>`;

const scene = createDeadlockScene($("#deadlock-scene"), {
  onPhase(phase) {
    $("#event-title").textContent = phase.title;
    if (phase.body) {
      $("#event-body").textContent = phase.body;
      if (busy) $("#explanation p").textContent = phase.body;
    }
    if (phase.snapshot) renderState(run.steps[index], phase.snapshot);
  },
});

function renderState(step, state) {
  $("#state-summary").textContent = state.deadlocked
    ? "교착 상태 · 서로의 잠금을 기다림"
    : state.commits
      ? "T1 커밋 완료 · T2는 롤백됨"
      : state.rollbacks
        ? state.clients.T1.waitingFor
          ? "T2 롤백 · T1 재개 가능"
          : "T1이 두 행의 잠금 보유"
        : `확정 재고 A ${state.rows.A.committed} · B ${state.rows.B.committed}`;
  $("#commit-summary").textContent =
    `커밋 ${state.commits} · 롤백 ${state.rollbacks}`;
  const values = (s) => [
    ...["A", "B"].flatMap((row) => [
      [`${row} 확정`, String(s.rows[row].committed)],
      [
        `${row} 미확정`,
        s.rows[row].pending
          ? `${s.rows[row].pending.client} · ${s.rows[row].pending.value}`
          : "없음",
      ],
      [`${row} 보유`, s.rows[row].owner || "없음"],
    ]),
    [
      "대기 요청",
      ["T1", "T2"]
        .filter((id) => s.clients[id].waitingFor)
        .map((id) => {
          const row = s.clients[id].waitingFor;
          return `${id} → ${row}${s.rows[row].owner ? "" : " (재개 가능)"}`;
        })
        .join(" / ") || "없음",
    ],
  ];
  const before = values(step.before),
    after = values(state);
  $("#dl-facts").hidden = !step.index;
  $("#dl-facts").innerHTML =
    `<table class="dl-change-table change-table"><caption>직전 → 현재</caption><thead><tr><th scope="col">항목</th><th scope="col">직전</th><th scope="col">현재</th></tr></thead><tbody>${after.map(([label, value], i) => `<tr data-changed="${value !== before[i][1]}"><th scope="row">${label}</th><td>${before[i][1]}</td><td>${value}</td></tr>`).join("")}</tbody></table>`;
}
function controls() {
  const moving = playing || (busy && !paused);
  $('[data-action="play"]').innerHTML =
    `${icon(moving ? "pause" : "play")}<span>${moving ? "일시정지" : completed === last && !busy ? "다시 재생" : index ? "이어서 재생" : "학습 시작"}</span>`;
  $('[data-action="play"]').setAttribute(
    "aria-label",
    moving ? "일시정지" : "재생",
  );
  $('[data-action="back"]').disabled = !index;
  $('[data-action="next"]').disabled = busy || index === last;
  $('[data-action="replay"]').disabled = busy || !index;
  $('[data-action="guided"]').setAttribute("aria-checked", String(guided));
  $("#deadlock-scene").setAttribute("aria-busy", String(busy));
  $("#playback-hint").textContent = busy
    ? paused
      ? "현재 상태에서 멈췄습니다."
      : "잠금과 요청의 이동을 따라가세요."
    : index === last
      ? "한 트랜잭션만 커밋했습니다."
      : "장면을 읽고 이어서 재생하세요.";
}
function render() {
  const step = busy ? run.steps[index] : current(),
    lesson = describeDeadlockStep(step);
  $("#step-count").textContent = index;
  $("#seek").value = index;
  $("#seek").setAttribute(
    "aria-valuetext",
    `${index} / ${last}번째 사건${busy ? " 처리 중" : " 완료"}`,
  );
  $("#explanation").innerHTML =
    `<span class="eyebrow">${busy ? `${index}번째 사건 · 처리 중` : lesson.eyebrow}</span><h3>${busy ? `${step.client || "DB"} · ${actions[step.action]} 처리 중` : lesson.title}</h3><p>${busy ? "현재 장면의 잠금과 재고 변화를 따라가세요." : lesson.summary}</p>`;
  $("#event-title").textContent =
    `${step.client || "DB"} · ${actions[step.action]}`;
  $("#event-number").textContent = step.index
    ? `${step.index}번째 사건`
    : "시작 전";
  $("#event-body").textContent = busy
    ? "요청이 처리되는 위치와 상태를 확인하세요."
    : lesson.details[0] || lesson.summary;
  $("#current-sql").hidden = !step.sql;
  $("#current-sql").textContent = step.sql || "";
  $("#lesson-details").innerHTML = lesson.details
    .slice(1)
    .map((text) => `<li>${text}</li>`)
    .join("");
  $("#lesson-details").hidden = busy;
  $("#takeaway").textContent = lesson.takeaway;
  $('[data-action="predict"]').hidden = busy || step.action !== "detect";
  const active = DEADLOCK_MILESTONES.findLastIndex((m) => m.index <= index);
  $("#milestones").innerHTML = DEADLOCK_MILESTONES.map(
    (m, i) =>
      `<button data-seek="${m.index}" class="milestone ${active === i ? "current" : ""}" aria-label="${i + 1}. ${m.label}" ${active === i ? 'aria-current="step"' : ""}><b>${i + 1}</b><span>${m.label}</span></button>`,
  ).join("");
  renderState(step, busy ? step.before : step.state);
  renderRecords();
  controls();
}
function renderRecords() {
  const steps = run.steps.slice(1);
  const cell = (step, text, cls = "") =>
    `<td class="${step.index === index ? "current" : ""}">${step.index <= completed ? `<button data-seek="${step.index}" class="trace-cell ${cls}">${text}</button>` : '<span class="future-cell" aria-label="아직 실행하지 않음">—</span>'}</td>`;
  const actorText = (step, id) => {
    if (step.action === "detect")
      return id === step.state.victim ? "중단 대상" : "대기 유지";
    if (step.client === id)
      return `${actions[step.action]}${step.row && step.action !== "rollback" ? ` ${step.row}` : ""}`;
    const client = step.state.clients[id];
    if (client.waitingFor)
      return `${client.waitingFor} ${step.state.rows[client.waitingFor].owner ? "잠금 대기" : "재개 가능"}`;
    return {
      idle: "—",
      active: "진행 중",
      committed: "커밋 완료",
      aborted: "롤백 완료",
    }[client.status];
  };
  const actors = ["T1", "T2"]
    .map(
      (id, actorIndex) =>
        `<tr class="dl-actor-history"><th scope="row">${tx(id)}<span>주문 ${actorIndex + 1}</span></th>${steps.map((s) => cell(s, actorText(s, id), s.state.clients[id].waitingFor && s.state.rows[s.state.clients[id].waitingFor].owner ? "waiting" : s.state.clients[id].status === "idle" ? "" : id.toLowerCase())).join("")}</tr>`,
    )
    .join("");
  const rows = ["A", "B"]
    .map(
      (row) =>
        `<tr class="dl-row-history"><th scope="row"><b class="dl-row-id">${row}</b><span>행 상태</span></th>${steps
          .map((s) => {
            const state = s.state.rows[row];
            return cell(
              s,
              `<b class="dl-history-owner ${state.owner?.toLowerCase() || ""}">${state.owner ? `${state.owner} 보유` : "잠금 없음"}</b><span>확정 <strong>${state.committed}</strong></span><small class="${state.pending ? "has-pending" : ""}">${state.pending ? `미확정 ${state.pending.value}` : "미확정 없음"}</small>`,
              "dl-state-cell",
            );
          })
          .join("")}</tr>`,
    )
    .join("");
  const eventLabel = (step) =>
    step.action === "detect"
      ? "DB 감지"
      : `${actions[step.action]}${step.row && step.action !== "rollback" ? ` ${step.row}` : ""}`;
  $("#timeline").innerHTML =
    `<table class="trace-table"><thead><tr class="dl-history-groups"><th>흐름</th><th colspan="4">01 · 잠금 확보</th><th colspan="3">02 · 교착 상태</th><th colspan="3">03 · 해소와 확정</th></tr><tr class="dl-history-events"><th>사건</th>${steps.map((s) => `<th class="${s.index === index ? "current" : ""}"><button data-seek="${s.index}" aria-label="${s.index}번째 사건으로 이동" ${s.index === index ? 'aria-current="step"' : ""}><b>${String(s.index).padStart(2, "0")}</b><span>${eventLabel(s)}</span></button></th>`).join("")}</tr></thead><tbody>${actors}${rows}</tbody></table>`;
  $("#log-count").textContent = completed;
  $("#sql-log").innerHTML = completed
    ? steps
        .slice(0, completed)
        .map(
          (s) =>
            `<button data-seek="${s.index}" class="log-row ${s.index === index ? "current" : ""}"><b class="event-index">${s.index}</b>${s.client ? tx(s.client) : '<b class="tx-id">DB</b>'}<span><strong>${describeDeadlockStep(s).title}</strong><code>${escape(s.sql || (s.action === "rollback" ? "DB가 T2를 중단 · SQLSTATE 40P01" : "DB가 대기 관계의 순환을 확인"))}</code></span><small>A ${s.state.rows.A.owner || "—"}<br/>B ${s.state.rows.B.owner || "—"}</small></button>`,
        )
        .join("")
    : '<p class="empty-note">재생하면 각 요청과 잠금의 결과가 쌓입니다.</p>';
  const state = current().state;
  $("#result-metrics").innerHTML =
    `<div class="metrics"><div><span>A 확정 재고</span><b>${state.rows.A.committed}<small>개</small></b></div><div><span>B 확정 재고</span><b>${state.rows.B.committed}<small>개</small></b></div><div><span>커밋한 주문</span><b>${state.commits}<small>/ 2</small></b></div><div><span>롤백한 주문</span><b>${state.rollbacks}<small>/ 2</small></b></div></div><p class="result-note">${completed === last ? "T2의 미확정 변경을 버리고 T1만 두 행의 감소를 확정했습니다. T2의 주문을 끝내려면 새 트랜잭션으로 다시 시도해야 합니다." : "현재까지 완료한 사건의 결과입니다. 미확정 쓰기는 이 숫자를 아직 바꾸지 않습니다."}</p>`;
}
function pause() {
  playing = false;
  clearTimeout(timer);
  timer = null;
  paused = busy;
  scene.pause();
  controls();
}
function schedule() {
  clearTimeout(timer);
  if (playing && !busy && index < last)
    timer = setTimeout(() => move(index + 1, true), 520 / speed);
}
async function move(next, motion = false) {
  const token = ++revision;
  clearTimeout(timer);
  index = Math.max(0, Math.min(last, next));
  busy = motion;
  paused = false;
  render();
  await scene.update(run.steps[index], current(), { animate: motion, speed });
  if (token !== revision) return;
  completed = index;
  busy = false;
  paused = false;
  render();
  if (
    index === last ||
    (playing && guided && DEADLOCK_MILESTONES.some((m) => m.index === index))
  )
    playing = false;
  controls();
  schedule();
}
function jump(next) {
  pause();
  move(next, false);
}
function play() {
  if (playing || (busy && !paused)) {
    pause();
    return;
  }
  if (completed === last && !busy) {
    completed = index = 0;
    scene.update(run.steps[0], null, { animate: false });
    render();
  }
  playing = true;
  paused = false;
  scene.resume();
  controls();
  schedule();
}
async function replay() {
  const target = index;
  pause();
  await move(target - 1, false);
  await move(target, true);
}
function selectRecord(name) {
  document.querySelectorAll("[data-record]").forEach((button) => {
    const selected = button.dataset.record === name;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  for (const id of ["timeline", "log", "results"])
    $(`#record-${id}`).hidden = id !== name;
}
function predict() {
  pause();
  $("#prediction-dialog").innerHTML =
    `<div class="dialog-heading"><div><span class="eyebrow">T2를 롤백 대상으로 선택한 직후</span><h2 id="prediction-title">어느 미확정 값이 취소될까요?</h2></div><button class="button icon-button" data-action="close" aria-label="닫기">×</button></div><div class="prediction-evidence"><span>T1이 쓴 A <b>9 · 미확정</b></span><span>T2가 쓴 B <b>19 · 미확정</b></span><span>확정 재고 <b>A 10 · B 20</b></span></div><div class="prediction-choices"><button class="button" data-answer="t2">T2의 B = 19만 취소</button><button class="button" data-answer="both">A = 9와 B = 19 모두 취소</button><button class="button" data-answer="t1">T1의 A = 9만 취소</button></div><div id="prediction-feedback" aria-live="polite"></div>`;
  $("#prediction-dialog").showModal();
}
document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.seek) {
    jump(Number(button.dataset.seek));
    return;
  }
  if (button.dataset.record) {
    selectRecord(button.dataset.record);
    return;
  }
  if (button.dataset.answer) {
    document.querySelectorAll("[data-answer]").forEach((b) => {
      b.disabled = true;
      b.classList.toggle("correct", b.dataset.answer === "t2");
    });
    $("#prediction-feedback").innerHTML =
      `<strong>${button.dataset.answer === "t2" ? "맞았습니다." : "롤백의 경계는 한 트랜잭션입니다."}</strong><p>T2가 쓴 B = 19만 폐기합니다. T1의 A = 9는 미확정 상태로 남고, 확정 재고 A = 10·B = 20은 그대로입니다.</p><button class="button primary" data-action="verify">롤백 과정 확인 →</button>`;
    return;
  }
  switch (button.dataset.action) {
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
      button.textContent = `${speed}×`;
      schedule();
      break;
    case "guided":
      guided = !guided;
      controls();
      break;
    case "predict":
      predict();
      break;
    case "close":
      button.closest("dialog").close();
      break;
    case "verify":
      $("#prediction-dialog").close();
      move(index + 1, true);
      break;
    case "setup": {
      const open = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!open));
      $("#setup-content").hidden = open;
      break;
    }
    case "theme": {
      const dark = document.documentElement.dataset.theme !== "dark";
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      localStorage.setItem("transaction-theme", dark ? "dark" : "light");
      button.setAttribute(
        "aria-label",
        dark ? "밝은 테마로 전환" : "어두운 테마로 전환",
      );
      break;
    }
  }
});
$("#seek").addEventListener("input", (e) => jump(Number(e.target.value)));
$(".record-tabs").addEventListener("keydown", (e) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
  const tabs = [...document.querySelectorAll("[data-record]")],
    at = tabs.indexOf(document.activeElement);
  if (at < 0) return;
  e.preventDefault();
  const next =
    e.key === "Home"
      ? 0
      : e.key === "End"
        ? tabs.length - 1
        : (at + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  tabs[next].focus();
  selectRecord(tabs[next].dataset.record);
});
document.addEventListener("keydown", (e) => {
  if (
    document.querySelector("dialog[open]") ||
    e.target.closest("input,select,textarea,button,a")
  )
    return;
  if (e.code === "Space") {
    e.preventDefault();
    play();
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    jump(index - 1);
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    jump(index + 1);
  } else if (e.key.toLowerCase() === "r") jump(0);
});
document.documentElement.dataset.theme =
  localStorage.getItem("transaction-theme") || "light";
if (document.documentElement.dataset.theme === "dark")
  $('[data-action="theme"]').setAttribute("aria-label", "밝은 테마로 전환");
const compactLayout = matchMedia("(max-width:1099px)");
function syncSetupLayout() {
  $('[data-action="setup"]').setAttribute(
    "aria-expanded",
    String(!compactLayout.matches),
  );
  $("#setup-content").hidden = compactLayout.matches;
}
syncSetupLayout();
compactLayout.addEventListener("change", syncSetupLayout);
const observer = new ResizeObserver(() =>
  $(".workspace").style.setProperty(
    "--stage-height",
    $(".scene-panel").getBoundingClientRect().height + "px",
  ),
);
observer.observe($(".scene-panel"));
scene.update(current(), null, { animate: false });
render();
