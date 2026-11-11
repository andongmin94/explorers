import "./styles.css";
import { simulate } from "./engine.js";
import {
  describeEventLog,
  describeStep,
  buildMilestones,
  predictionFor,
  MODEL_NOTES,
  SOURCES,
} from "./lesson.js";
import { createTransactionScene } from "./scene.js";

const $ = (s) => document.querySelector(s);
const runs = {
  naive: simulate({ mode: "naive" }),
  locked: simulate({ mode: "locked" }),
};
let mode = "naive",
  index = 0,
  committed = 0,
  speed = 1,
  playing = false,
  busy = false,
  motionPaused = false,
  guided = true,
  revision = 0,
  timer = null,
  record = "timeline",
  quiz = null;
const run = () => runs[mode],
  current = () => run().steps[committed];
const tx = (id) => `<b class="tx-id ${id.toLowerCase()}">${id}</b>`;
const escape = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const actions = {
  initial: "시작 전",
  begin: "시작",
  read: "읽기",
  calculate: "앱 계산",
  write: "쓰기",
  wait: "잠금 대기",
  commit: "커밋",
  "resume-read": "읽기 재개",
  "resume-write": "쓰기 재개",
};
const icons = {
  db: '<path d="M4 5c0-4 16-4 16 0v14c0 4-16 4-16 0V5m0 0c0 4 16 4 16 0M4 12c0 4 16 4 16 0"/>',
  play: '<path d="m8 5 11 7-11 7z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  reset: '<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  next: '<path d="m9 5 7 7-7 7"/>',
  moon: '<path d="M20 14a8 8 0 0 1-10-10 8 8 0 1 0 10 10Z"/>',
  compare: '<path d="M4 4v16h16M8 15V9M13 15V5M18 15v-4"/>',
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
$("#app").innerHTML =
  `<header class="app-header"><div class="brand-icon">${icon("db")}</div><div><h1>트랜잭션 탐색기</h1><p>보면서 이해하는 데이터베이스</p></div><div class="scenario-heading"><small>대표 시나리오 03</small><strong>같은 재고, 두 개의 주문</strong></div><div class="header-actions"><button class="button" data-action="compare">${icon("compare")}<span>두 방식 비교</span></button><button class="button icon-button" data-action="theme" aria-label="어두운 테마로 전환">${icon("moon")}</button></div></header>
<nav class="scenario-nav" aria-label="트랜잭션 시나리오"><a href="./" aria-current="page"><b>01</b> 재고 갱신</a><a href="./deadlock.html"><b>02</b> 교착 상태와 롤백</a></nav>
<main class="workspace"><aside class="panel setup-panel"><button class="panel-head setup-toggle" data-action="setup" aria-expanded="true" aria-controls="setup-content"><h2>실험 조건</h2><span>재고 한 행 ⌄</span></button><div class="setup-content" id="setup-content"><div class="section-label">값을 읽는 방법</div><div class="mode-toggle" role="group" aria-label="읽기 잠금 방식"><button data-mode="naive" aria-pressed="true"><strong>일반 SELECT</strong><span>읽은 뒤 앱에서 계산</span></button><button data-mode="locked" aria-pressed="false"><strong>읽기부터 잠금</strong><span>SELECT FOR UPDATE</span></button></div><p class="rule-summary" id="rule-summary"></p><div class="scenario-goal"><span>두 주문이 각각 1개 감소</span><strong>10 − 1 − 1 = <b>8</b></strong><small>기대하는 최종 재고</small></div><div class="section-label">한 주문의 네 단계</div><ol class="recipe"><li><b>읽기</b><span>DB의 값을 앱에 보관</span></li><li><b>계산</b><span>앱에서 읽은 값 − 1</span></li><li><b>쓰기</b><span>계산한 숫자로 UPDATE</span></li><li><b>확정</b><span>COMMIT · 잠금 해제</span></li></ol><div class="isolation"><b>READ COMMITTED</b><span>PostgreSQL · 고정된 사건 순서</span></div><details class="model-notes"><summary>이 실험의 범위</summary><ul>${MODEL_NOTES.map((t) => `<li>${t}</li>`).join("")}<li>실제 데이터베이스 연결이나 실행 시간 측정 없이 한 행의 상태 변화를 재현합니다.</li></ul></details></div></aside>
<section class="panel scene-panel"><div class="panel-head"><h2>요청과 잠금의 흐름</h2><b class="step-clock"><span id="step-count">0</span><small>/ 11 사건</small></b></div><div id="transaction-scene"></div><div class="scene-summary"><strong id="state-summary"></strong><button class="replay-event" data-action="replay" disabled>↻ 이번 사건 다시 보기</button><span id="commit-summary"></span></div><div class="transport"><div class="learning-mode"><button role="switch" aria-checked="true" data-action="guided"><i></i>핵심 장면에서 멈추기</button><span id="playback-hint"></span></div><div class="playback-buttons"><button class="button icon-button" data-action="reset" aria-label="처음으로">${icon("reset")}</button><button class="button icon-button" data-action="back" aria-label="이전 사건">${icon("back")}</button><button class="button primary play-button" data-action="play">${icon("play")}<span>학습 시작</span></button><button class="button" data-action="next">다음 사건 ${icon("next")}</button><button class="button speed-button" data-action="speed" aria-label="재생 속도 변경">1×</button></div><div class="seek-row"><span>0</span><input id="seek" type="range" min="0" max="11" value="0" step="1" aria-label="처리한 사건 수"/><span>11</span></div></div></section>
<aside class="panel lesson-panel"><div class="panel-head"><h2>단계 해설</h2><span id="lesson-mode"></span></div><nav id="milestones" aria-label="핵심 학습 장면"></nav><div class="lesson-content"><div id="explanation"></div><div class="event-card"><div class="event-card-head"><strong id="event-title"></strong><span id="event-number"></span></div><p id="event-body" aria-live="polite"></p><code id="current-sql"></code><div id="change-facts"></div></div><ul id="lesson-details" class="lesson-details"></ul><div class="insight"><b>!</b><p id="takeaway"></p></div><button class="button prediction-button" data-action="predict" hidden>대기 다음의 결과, 맞혀보기 →</button><button class="button primary conclusion-button" data-action="compare" hidden>전체 실행 결과 비교 →</button></div></aside>
<section class="panel records-panel"><div class="record-tabs" role="tablist" aria-label="관찰 기록"><button id="tab-timeline" role="tab" aria-selected="true" aria-controls="record-timeline" data-record="timeline">실행 순서</button><button id="tab-log" role="tab" aria-selected="false" aria-controls="record-log" data-record="log" tabindex="-1">사건 기록 <span id="log-count"></span></button><button id="tab-results" role="tab" aria-selected="false" aria-controls="record-results" data-record="results" tabindex="-1">재고 결과</button><span class="record-hint">기록을 눌러 그 사건으로 이동</span></div><section id="record-timeline" role="tabpanel" aria-labelledby="tab-timeline"><div class="history-legend"><span>각 사건을 처리한 뒤의 상태</span><span>${tx("T1")} 주문 1 ${tx("T2")} 주문 2 <i class="waiting-sample"></i>대기</span></div><div class="timeline-wrap" id="timeline"></div></section><section id="record-log" role="tabpanel" aria-labelledby="tab-log" hidden><div id="log-summary" class="history-legend"></div><div id="sql-log" class="sql-log"></div></section><section id="record-results" role="tabpanel" aria-labelledby="tab-results" hidden><div id="result-metrics"></div></section></section></main>
<footer><span><kbd>Space</kbd> 재생·정지 <kbd>←</kbd><kbd>→</kbd> 사건 이동 <kbd>R</kbd> 처음으로</span><span>학습 근거 ${SOURCES.map((s) => `<a href="${s.url}" target="_blank" rel="noreferrer">${s.title} ↗</a>`).join(" · ")}</span></footer><dialog id="prediction-dialog" aria-labelledby="prediction-title"></dialog><dialog id="comparison-dialog" aria-labelledby="comparison-title"></dialog>`;

const scene = createTransactionScene($("#transaction-scene"), {
  onPhase(phase) {
    $("#event-title").textContent = phase.title;
    if (phase.body) {
      $("#event-body").textContent = phase.body;
      if (busy) $("#explanation p").textContent = phase.body;
    }
    $("#event-number").textContent = index ? `${index}번째 사건` : "시작 전";
    if (phase.snapshot) {
      renderChanges(run().steps[index], phase.snapshot);
      renderSummary(phase.snapshot);
    }
  },
});
function renderChanges(step, state) {
  const values = (s) => [
    ["확정 재고", s.committedStock + "개"],
    [
      "미확정 값",
      s.uncommitted
        ? s.uncommitted.client + " · " + s.uncommitted.stock
        : "없음",
    ],
    ["잠금 보유", s.rowLock.owner || "없음"],
    [
      "대기 요청",
      s.rowLock.waiting.length
        ? s.rowLock.waiting.join(", ") +
          (s.rowLock.owner ? " · 잠금 대기" : " · 재개 가능")
        : "없음",
    ],
  ];
  const before = values(step.before),
    after = values(state);
  $("#change-facts").hidden = !step.index;
  $("#change-facts").innerHTML =
    '<table class="change-table"><caption>직전 → 현재</caption><thead><tr><th scope="col">항목</th><th scope="col">직전</th><th scope="col">현재</th></tr></thead><tbody>' +
    after
      .map(
        ([label, value], i) =>
          '<tr data-changed="' +
          (before[i][1] !== value) +
          '"><th scope="row">' +
          label +
          "</th><td>" +
          before[i][1] +
          "</td><td>" +
          value +
          "</td></tr>",
      )
      .join("") +
    "</tbody></table>";
}
function renderSummary(state) {
  $("#state-summary").textContent =
    !busy && committed === 11
      ? "최종 확정 재고 " + state.committedStock + "개"
      : state.uncommitted
        ? "확정 " +
          state.committedStock +
          " · " +
          state.uncommitted.client +
          " 미확정 " +
          state.uncommitted.stock
        : "확정 재고 " + state.committedStock + "개";
  $("#commit-summary").textContent =
    "커밋 " + state.completedTransactions + " / 2" + (busy ? " · 처리 중" : "");
}
function controls() {
  const moving = playing || (busy && !motionPaused);
  $('[data-action="play"]').innerHTML =
    `${icon(moving ? "pause" : "play")}<span>${moving ? "일시정지" : committed === 11 && !busy ? "다시 재생" : index === 0 ? "학습 시작" : "이어서 재생"}</span>`;
  $('[data-action="play"]').setAttribute(
    "aria-label",
    moving ? "일시정지" : "재생",
  );
  $('[data-action="back"]').disabled = index === 0;
  $('[data-action="next"]').disabled = index === 11 || busy;
  $('[data-action="replay"]').disabled = index === 0 || busy;
  $('[data-action="guided"]').setAttribute("aria-checked", String(guided));
  $("#transaction-scene").setAttribute("aria-busy", String(busy));
  $("#playback-hint").textContent = busy
    ? motionPaused
      ? "요청의 이동을 멈췄습니다."
      : "요청과 응답을 따라가세요."
    : index === 11
      ? "두 주문 완료 · 확정 재고를 비교하세요."
      : playing
        ? "다음 사건을 준비합니다."
        : "장면을 읽고 이어서 재생하세요.";
}
function render() {
  const step = current(),
    state = step.state,
    lessonStep = busy ? run().steps[index] : step,
    lesson = describeStep(lessonStep, run());
  $("#step-count").textContent = index;
  $("#seek").value = index;
  $("#seek").setAttribute(
    "aria-valuetext",
    `${index} / 11번째 사건${busy ? " 처리 중" : " 처리 완료"}`,
  );
  document
    .querySelectorAll("[data-mode]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.mode === mode)),
    );
  $("#rule-summary").innerHTML =
    mode === "naive"
      ? "<b>읽은 값은 앱에 남습니다.</b> 이후 UPDATE가 잠금을 기다려도 앱의 계산은 자동으로 바뀌지 않습니다."
      : "<b>값을 읽을 때부터 행을 보호합니다.</b> 다른 FOR UPDATE는 앞선 커밋 뒤의 값을 읽습니다.";
  renderSummary(state);
  $("#lesson-mode").textContent =
    mode === "naive" ? "일반 SELECT" : "FOR UPDATE";
  $("#explanation").innerHTML =
    `<span class="eyebrow">${busy ? `${index}번째 사건 · 처리 중` : lesson.eyebrow}</span><h3>${busy ? `${lessonStep.client} · ${actions[lessonStep.action]} 처리 중` : lesson.title}</h3><p>${busy ? "장면의 현재 상태를 보며 이번 사건을 따라가세요." : lesson.summary}</p>`;
  $("#event-title").textContent = step.index
    ? `${step.client} · ${actions[step.action]}`
    : "두 주문, 같은 목표";
  $("#event-body").textContent = step.index
    ? lesson.details[0]
    : "각 주문은 자신이 읽은 재고에서 1을 뺀 숫자를 DB에 씁니다.";
  $("#event-number").textContent = step.index ? `${step.index}번째` : "시작 전";
  const shownSql = busy ? run().steps[index].sql : step.sql;
  $("#current-sql").hidden = !shownSql;
  $("#current-sql").textContent = shownSql || "";
  renderChanges(lessonStep, busy ? lessonStep.before : state);
  $("#lesson-details").innerHTML = lesson.details
    .slice(1)
    .map((t) => `<li>${t}</li>`)
    .join("");
  $("#lesson-details").hidden = busy;
  $("#takeaway").textContent = lesson.takeaway;
  $('[data-action="predict"]').hidden = busy || !predictionFor(step, run());
  $(".conclusion-button").hidden = committed !== 11;
  const milestones = buildMilestones(run());
  const activeMilestone = milestones.findLastIndex((m) => m.index <= index);
  const labels = [
    "첫 읽기",
    mode === "locked" ? "대기" : "같은 값",
    "미확정",
    "갈림길",
    "결과",
  ];
  $("#milestones").innerHTML = milestones
    .map(
      (m, i) =>
        `<button data-seek="${m.index}" class="milestone ${i === activeMilestone ? "current" : ""}" aria-label="${i + 1}. ${m.label}" ${i === activeMilestone ? 'aria-current="step"' : ""} title="${m.label} · ${committed >= m.index ? m.description : m.index + "번째 사건에서 확인"}"><b>${i + 1}</b><span>${labels[i]}</span></button>`,
    )
    .join("");
  renderRecords();
  controls();
}
function renderRecords() {
  const steps = run().steps.slice(1);
  const cell = (step, text, cls = "") =>
    `<td class="${step.index === index ? "current" : ""}">${step.index <= committed ? `<button data-seek="${step.index}" class="trace-cell ${cls}">${text}</button>` : '<span class="future-cell">·</span>'}</td>`;
  const timelineRows = ["T1", "T2"]
    .map(
      (id) =>
        `<tr><th scope="row">${tx(id)}</th>${steps.map((s) => cell(s, s.client === id ? `${actions[s.action]}${["read", "resume-read"].includes(s.action) ? `<b>${s.state.clients[id].localRead}</b>` : ["write", "resume-write", "calculate"].includes(s.action) ? `<b>${s.state.clients[id].localWrite}</b>` : ""}` : "", s.client === id ? `${id.toLowerCase()} ${s.action === "wait" ? "waiting" : ""}` : "")).join("")}</tr>`,
    )
    .join("");
  $("#timeline").innerHTML =
    `<table class="trace-table"><thead><tr><th>사건</th>${steps.map((s) => `<th><button data-seek="${s.index}" aria-label="${s.index}번째 사건으로 이동">${s.index}</button></th>`).join("")}</tr></thead><tbody>${timelineRows}<tr><th scope="row">확정 재고</th>${steps.map((s) => cell(s, s.state.committedStock)).join("")}</tr><tr><th scope="row">행 잠금</th>${steps.map((s) => cell(s, s.state.rowLock.owner || "—", s.state.rowLock.owner?.toLowerCase() || "")).join("")}</tr></tbody></table>`;
  const { entries, counts } = describeEventLog(steps.slice(0, committed));
  $("#log-count").textContent = entries.length;
  $("#log-summary").textContent = `새 SQL ${counts.sql}건 · 앱 계산 ${counts.calculate}건 · SQL 재개 ${counts.resume}건`;
  $("#sql-log").innerHTML = entries.length
    ? entries.map(({ step: s, kind, origin }) => {
        const label = kind === "sql" ? `새 SQL · ${actions[s.action]}` : kind === "resume" ? `SQL 재개 · ${s.action === "resume-read" ? "읽기" : "쓰기"}` : "앱 계산";
        const detail = s.sql || `${s.state.clients[s.client].localRead} − 1 = ${s.state.clients[s.client].localWrite}`;
        const link = kind === "resume" ? `<button class="log-origin" data-origin="${origin}">↖ ${origin}번 원요청 · 잠금 대기 시작</button>` : "";
        return `<div><button data-seek="${s.index}" class="log-row ${s.index === index ? "current" : ""}"><b class="event-index">${s.index}</b>${tx(s.client)}<span><strong>${label}</strong><code>${escape(detail)}</code></span><small>확정 ${s.state.committedStock}<br/>${s.state.uncommitted ? `미확정 ${s.state.uncommitted.stock}` : "미확정 없음"}</small></button>${link}</div>`;
      }).join("")
    : '<p class="empty-note">사건을 진행하면 요청과 계산, 대기 중이던 SQL의 재개가 차례로 기록됩니다.</p>';
  const s = current().state;
  $("#result-metrics").innerHTML =
    `<div class="metrics"><div><span>처음 재고</span><b>10<small>개</small></b></div><div><span>기대하는 최종 재고</span><b>8<small>개</small></b></div><div class="${committed === 11 ? "important" : ""}"><span>${committed === 11 ? "최종" : "현재"} 확정 재고</span><b>${s.committedStock}<small>개</small></b></div><div><span>완료한 트랜잭션</span><b>${s.completedTransactions}<small>/ 2</small></b></div></div><p class="result-note">${committed === 11 ? (mode === "naive" ? "두 트랜잭션이 모두 커밋했지만 재고 감소는 한 번만 남았습니다." : "T1의 10 → 9, T2의 9 → 8이 모두 반영됐습니다.") : "이 값은 현재까지 완료한 사건의 결과입니다. 마지막 커밋까지 재생해 최종 재고를 확인하세요."}</p>`;
}
function pause() {
  playing = false;
  clearTimeout(timer);
  timer = null;
  motionPaused = busy;
  scene.pause();
  controls();
}
function schedule() {
  clearTimeout(timer);
  if (playing && !busy && index < 11)
    timer = setTimeout(() => move(index + 1, true), 520 / speed);
}
async function move(next, motion = false) {
  const token = ++revision;
  clearTimeout(timer);
  index = Math.max(0, Math.min(11, next));
  busy = motion;
  motionPaused = false;
  render();
  await scene.update(run().steps[index], current(), { animate: motion, speed });
  if (token !== revision) return;
  committed = index;
  busy = false;
  motionPaused = false;
  render();
  if (
    index === 11 ||
    (playing &&
      guided &&
      (buildMilestones(run()).some((m) => m.index === index) ||
        predictionFor(current(), run())))
  )
    playing = false;
  controls();
  schedule();
}
function jump(next) {
  pause();
  return move(next, false);
}
async function replayEvent() {
  const target = index;
  pause();
  await move(target - 1, false);
  await move(target, true);
}
function play() {
  if (playing || (busy && !motionPaused)) {
    pause();
    return;
  }
  if (committed === 11 && !busy) {
    committed = 0;
    index = 0;
    scene.update(run().steps[0], null, { animate: false });
    render();
  }
  playing = true;
  motionPaused = false;
  scene.resume();
  controls();
  schedule();
}
function selectRecord(name) {
  record = name;
  document.querySelectorAll("[data-record]").forEach((b) => {
    const selected = b.dataset.record === name;
    b.setAttribute("aria-selected", String(selected));
    b.tabIndex = selected ? 0 : -1;
  });
  for (const id of ["timeline", "log", "results"])
    $(`#record-${id}`).hidden = id !== name;
}
function showComparison() {
  pause();
  $("#comparison-dialog").innerHTML =
    `<div class="dialog-heading"><div><span class="eyebrow">같은 10개 · 같은 두 주문</span><h2 id="comparison-title">잠금은 언제 시작해야 할까?</h2></div><button class="button icon-button" data-action="close" aria-label="닫기">×</button></div><p class="dialog-intro">두 방식 모두 UPDATE가 행을 잠급니다. 차이는 T2가 계산에 사용할 값을 언제 읽는지입니다.</p><div class="comparison-grid">${["naive", "locked"].map((m) => `<article><span class="eyebrow">${m === "naive" ? "일반 SELECT" : "SELECT FOR UPDATE"}</span><h3>최종 재고 <b>${runs[m].stats.actualStock}</b>개</h3><div class="comparison-story"><span>T1 읽기 <b>10</b></span><i>→</i><span>T1 커밋 <b>9</b></span></div><div class="comparison-story"><span>T2 읽기 <b>${m === "naive" ? 10 : 9}</b></span><i>→</i><span>T2 커밋 <b>${runs[m].stats.actualStock}</b></span></div><p>${m === "naive" ? "T2는 먼저 읽은 10으로 계산한 9를 씁니다. 쓰기 잠금을 기다려도 이 숫자는 바뀌지 않습니다." : "T2의 읽기가 T1의 커밋을 기다립니다. 갱신된 9를 읽고 8을 계산합니다."}</p><strong class="comparison-result">${m === "naive" ? "감소 1회 유실" : "감소 2회 모두 반영"}</strong><button class="button" data-mode="${m}" data-close="true">이 방식으로 다시 보기 →</button></article>`).join("")}</div><p class="dialog-footnote">SET stock = stock - 1처럼 DB 안에서 한 문장으로 감소시키는 방법은 이 실험의 분리된 읽기·계산·쓰기와 다릅니다.</p>`;
  $("#comparison-dialog").showModal();
}
function showPrediction() {
  pause();
  quiz = predictionFor(current(), run());
  if (!quiz) return;
  $("#prediction-dialog").innerHTML =
    `<div class="dialog-heading"><div><span class="eyebrow">현재 상태로 다음 사건 예측</span><h2 id="prediction-title">${quiz.question}</h2></div><button class="button icon-button" data-action="close" aria-label="닫기">×</button></div><div class="prediction-evidence"><span>확정 재고 <b>${current().state.committedStock}</b></span><span>T2가 읽은 값 <b>${current().state.clients.T2.localRead ?? "아직 없음"}</b></span><span>T2의 계산 <b>${current().state.clients.T2.localWrite ?? "아직 없음"}</b></span></div><div class="prediction-choices">${quiz.options.map((o) => `<button class="button" data-answer="${o.id}">${o.label}</button>`).join("")}</div><div id="prediction-feedback" aria-live="polite"></div>`;
  $("#prediction-dialog").showModal();
}

document.addEventListener("click", async (e) => {
  const button = e.target.closest("button");
  if (!button) return;
  if (button.dataset.mode) {
    pause();
    revision++;
    mode = button.dataset.mode;
    index = 0;
    committed = 0;
    busy = false;
    motionPaused = false;
    scene.update(current(), null, { animate: false });
    render();
    if (button.dataset.close) button.closest("dialog").close();
    return;
  }
  if (button.dataset.origin) {
    await jump(Number(button.dataset.origin));
    $(`#sql-log [data-seek="${button.dataset.origin}"]`).focus();
    return;
  }
  if (button.dataset.seek) {
    jump(Number(button.dataset.seek));
    return;
  }
  if (button.dataset.record) {
    selectRecord(button.dataset.record);
    return;
  }
  if (button.dataset.answer) {
    const correct = button.dataset.answer === quiz.answerId;
    document.querySelectorAll("[data-answer]").forEach((b) => {
      b.disabled = true;
      b.classList.toggle("correct", b.dataset.answer === quiz.answerId);
    });
    $("#prediction-feedback").innerHTML =
      `<strong>${correct ? "맞았습니다." : "현재 값의 차이를 다시 살펴보세요."}</strong><p>${quiz.explanation}</p><button class="button primary" data-action="verify">실제 요청 재개 보기 →</button>`;
    return;
  }
  switch (button.dataset.action) {
    case "play":
      play();
      break;
    case "replay":
      replayEvent();
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
    case "speed":
      speed = speed === 1 ? 2 : speed === 2 ? 0.5 : 1;
      button.textContent = `${speed}×`;
      schedule();
      break;
    case "guided":
      guided = !guided;
      controls();
      break;
    case "compare":
      showComparison();
      break;
    case "predict":
      showPrediction();
      break;
    case "verify":
      $("#prediction-dialog").close();
      move(index + 1, true);
      break;
    case "close":
      button.closest("dialog").close();
      break;
    case "setup": {
      const expanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!expanded));
      $("#setup-content").hidden = expanded;
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
    e.target.closest("input,select,textarea,button")
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
if (matchMedia("(max-width:1099px)").matches) {
  $(".setup-toggle").setAttribute("aria-expanded", "false");
  $("#setup-content").hidden = true;
}
const panelObserver = new ResizeObserver(() =>
  $(".workspace").style.setProperty(
    "--stage-height",
    $(".scene-panel").getBoundingClientRect().height + "px",
  ),
);
panelObserver.observe($(".scene-panel"));
scene.update(current(), null, { animate: false });
render();
selectRecord(record);
