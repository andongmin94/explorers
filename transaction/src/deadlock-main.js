import "../../shared/theme.css";
import "../../shared/hw.css";
import "./styles.css";
import "../../shared/switcher.js";
import "../../shared/iso.js";
import { simulateDeadlock } from "./deadlock-engine.js";
import { describeDeadlockStep, deadlockPrediction, DEADLOCK_LEGEND, DEADLOCK_MILESTONES, DEADLOCK_SOURCES, DEADLOCK_NOTES } from "./deadlock-lesson.js";
import { createDeadlockScene } from "./deadlock-scene.js";
import {
  $,
  bindConsole,
  createSide,
  followRows,
  createPlayer,
  deck,
  dialogHead,
  escape,
  footer,
  pad,
  recordsHead,
  sideHead,
  sidePanel,
  stage,
  syncControls,
  topbar,
  tx,
} from "./console.js";

const run = simulateDeadlock();
let quiz = null;
const steps = () => run.steps;
const LAST = run.steps.length - 1;
let status = "";
let phaseBody = "";
const actions = {
  initial: "시작 전",
  begin: "시작",
  write: "쓰기",
  wait: "잠금 대기",
  detect: "교착 감지",
  rollback: "중단·롤백",
  resume: "쓰기 재개",
  commit: "커밋",
};
const GROUPS = { 1: "01 · 잠금 확보", 5: "02 · 교착 상태", 8: "03 · 해소와 확정" };

$("#app").outerHTML = `<div class="hw-page tx-page">
  ${topbar({ page: 1, context: { label: "교착 상태 시나리오", title: "서로의 잠금을 기다리는 두 주문" } })}
  <main class="hw-console">
    ${stage({ label: "잠금과 대기의 연결", sceneId: "scene", total: LAST })}
    ${deck({ total: LAST })}
    <aside class="hw-plate hw-side" aria-labelledby="lesson-label">
      ${sideHead([["lesson", "해설"], ["scenes", "장면"], ["scope", "범위"]])}
      ${sidePanel(
        "lesson",
        `<div class="hw-fill tx-pages" id="lesson-pages">
          <div class="hw-section">
            <span class="hw-label" id="eyebrow"></span>
            <h2 class="hw-title tx-lesson-title" id="lesson-title"></h2>
          </div>
          <p class="hw-text" id="lesson-summary"></p>
          <div class="hw-section" id="event-section">
            <span class="hw-label">이번 사건</span>
            <code class="tx-sql" id="current-sql"></code>
          </div>
          <ul class="tx-details" id="lesson-details"></ul>
          <div class="hw-section" id="changes"></div>
          <div class="hw-section" id="takeaway-section"><p class="hw-note hw-note--accent" id="takeaway"></p></div>
        </div>`,
        `<div class="tx-cta" id="cta">
          <button class="hw-key tx-wide" data-action="predict">중단되면 B는? 결과 맞혀보기 →</button>
        </div>`,
      )}
      ${sidePanel("scenes", `<div class="hw-fill hw-list tx-milestones" id="milestones" aria-label="핵심 장면으로 이동"></div>`)}
      ${sidePanel(
        "scope",
        `<div class="hw-fill tx-pages" id="scope-pages">
          <div class="hw-section tx-fact"><span class="hw-label">잠금 순서</span><p class="hw-text">T1은 A → B, T2는 B → A. 첫 잠금을 놓지 않은 채 상대가 잠근 행을 요청합니다.</p></div>
          <div class="hw-section tx-fact"><span class="hw-label">처음 확정 재고</span><p class="hw-text">A 10 · B 20 · UPDATE는 각 행의 stock − 1</p></div>
          <div class="hw-section tx-fact"><span class="hw-label">볼 것</span><p class="hw-text">보유 → 대기 → 순환 → 해소 (롤백 → 잠금 해제 → 재개)</p></div>
          <div class="hw-section tx-fact"><span class="hw-label">데이터베이스</span><p class="hw-text">PostgreSQL · READ COMMITTED · 고정된 사건 순서</p></div>
          ${DEADLOCK_NOTES.map((t, i) => `<div class="hw-section tx-fact"><span class="hw-label">모델 ${pad(i + 1)}</span><p class="hw-text">${t}</p></div>`).join("")}
          ${DEADLOCK_LEGEND.map((t) => `<div class="hw-section tx-fact"><span class="hw-label">장면 표시</span><p class="hw-text">${t}</p></div>`).join("")}
        </div>`,
      )}
    </aside>
    <section class="hw-plate hw-records" aria-label="관찰 기록">
      ${recordsHead([["timeline", "실행 순서"], ["log", `잠금 기록 <span class="hw-mono" id="log-count"></span>`], ["results", "재고 결과"]])}
      <div class="hw-plate-body hw-scroll" id="record-timeline" role="tabpanel" aria-labelledby="tab-timeline" data-record-panel="timeline">
        <table class="hw-table tx-table"><thead><tr><th>사건</th><th>T1 · 주문 1</th><th>T2 · 주문 2</th><th>행 A</th><th>행 B</th></tr></thead><tbody></tbody></table>
      </div>
      <div class="hw-plate-body hw-scroll" id="record-log" role="tabpanel" aria-labelledby="tab-log" data-record-panel="log" hidden>
        <p class="hw-text hw-muted" id="log-empty">재생하면 각 요청과 잠금의 결과가 쌓입니다.</p>
        <table class="hw-table tx-table" id="log-table"><thead><tr><th>사건</th><th>주체</th><th>일어난 일</th><th>SQL · DB 동작</th><th>잠금</th></tr></thead><tbody></tbody></table>
      </div>
      <div class="hw-plate-body" id="record-results" role="tabpanel" aria-labelledby="tab-results" data-record-panel="results" hidden></div>
    </section>
  </main>
  ${footer(DEADLOCK_SOURCES)}
  <dialog class="hw-dialog" id="prediction-dialog" aria-labelledby="prediction-title"></dialog>
</div>`;

let player;
let side;
let lessonKey = -1;
const scene = createDeadlockScene($("#scene"), {
  onPhase({ title, body, snapshot }) {
    status = title;
    $("#status").textContent = title;
    if (!player?.state.busy) return;
    if (body) {
      phaseBody = body;
      $("#lesson-summary").textContent = body;
    }
    if (snapshot) renderChanges(steps()[player.state.index], snapshot);
    side?.refresh("lesson-pages");
  },
});

player = createPlayer({
  steps,
  scene,
  render,
  stopAt: (i) => DEADLOCK_MILESTONES.some((m) => m.index === i),
});

function renderChanges(step, state) {
  const values = (s) => [
    ...["A", "B"].flatMap((row) => [
      [`${row} 확정`, String(s.rows[row].committed)],
      [`${row} 미확정`, s.rows[row].pending ? `${s.rows[row].pending.client} · ${s.rows[row].pending.value}` : "없음"],
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
  const before = values(step.before);
  const changed = values(state)
    .map(([label, value], i) => [label, before[i][1], value])
    .filter(([, was, now]) => was !== now);
  $("#changes").classList.toggle("tx-off", !step.index);
  $("#changes").innerHTML = `<span class="hw-label">DB 상태 · 직전 → 현재</span>${
    changed.length
      ? `<ul class="hw-list tx-changes">${changed.map(([label, was, now]) => `<li><span>${label}</span><span class="hw-mono"><span class="hw-muted">${was}</span> → <b>${now}</b></span></li>`).join("")}</ul>`
      : `<p class="hw-text hw-muted tx-gap">잠금과 재고는 바뀌지 않았습니다.</p>`
  }`;
}

function render() {
  const s = player.state;
  const step = s.busy ? steps()[s.index] : steps()[s.done];
  const lesson = describeDeadlockStep(step);
  $("#eyebrow").textContent = s.busy ? `${s.index}번째 사건 · 처리 중` : lesson.eyebrow;
  $("#lesson-title").textContent = s.busy ? `${step.client || "DB"} · ${actions[step.action]} 처리 중` : lesson.title;
  $("#lesson-summary").textContent = s.busy ? phaseBody || "현재 장면의 잠금과 재고 변화를 따라가세요." : lesson.summary;
  $("#event-section").classList.toggle("tx-off", step.index === 0);
  $("#lesson-details").classList.toggle("tx-off", step.index === 0);
  $("#current-sql").hidden = !step.sql;
  $("#current-sql").textContent = step.sql || "";
  $("#lesson-details").innerHTML = s.busy ? "" : lesson.details.map((t) => `<li>${t}</li>`).join("");
  renderChanges(step, s.busy ? step.before : step.state);
  $("#takeaway").textContent = lesson.takeaway;
  $("#takeaway-section").classList.toggle("tx-off", s.busy);
  $("#cta").hidden = s.busy || step.action !== "detect";
  const active = DEADLOCK_MILESTONES.findLastIndex((m) => m.index <= s.index);
  $("#milestones").innerHTML = DEADLOCK_MILESTONES.map(
    (m, i) =>
      `<button data-seek="${m.index}"${i === active ? ' aria-current="true"' : ""} title="${escape(m.description)}"><span class="hw-index">${pad(i + 1)}</span><span class="tx-grow">${m.label}${s.done >= m.index ? `<span class="hw-muted tx-desc"> · ${m.description}</span>` : ""}</span><span class="hw-mono hw-muted">#${pad(m.index)}</span></button>`,
  ).join("");
  side.refresh("lesson-pages", { reset: s.index !== lessonKey });
  lessonKey = s.index;
  side.refresh("milestones", { item: $("#milestones [aria-current]") });
  side.refresh("scope-pages");
  renderRecords();
  if (!s.busy) phaseBody = "";
  syncControls(player, { sceneEl: $("#scene"), status });
}

function renderRecords() {
  const s = player.state;
  const all = steps().slice(1);
  const actorText = (step, id) => {
    if (step.action === "detect") return id === step.state.victim ? "중단 대상" : "대기 유지";
    if (step.client === id) return `${actions[step.action]}${step.row && step.action !== "rollback" ? ` ${step.row}` : ""}`;
    const c = step.state.clients[id];
    if (c.waitingFor) return `${c.waitingFor} ${step.state.rows[c.waitingFor].owner ? "잠금 대기" : "재개 가능"}`;
    return { idle: "—", active: "진행 중", committed: "커밋 완료", aborted: "중단됨 (ROLLBACK 필요)" }[c.status];
  };
  const blocked = (step, id) => {
    const row = step.state.clients[id].waitingFor;
    return Boolean(row && step.state.rows[row].owner);
  };
  const rowCell = (step, row) => {
    const r = step.state.rows[row];
    return `<td class="tx-nowrap">${r.owner ? tx(r.owner) : '<span class="hw-muted">잠금 없음</span>'} <span class="hw-mono">확정 ${r.committed}<span class="hw-muted"> · ${r.pending ? `미확정 ${r.pending.value}` : "미확정 없음"}</span></span></td>`;
  };
  const body = all
    .map((step) => {
      const group = GROUPS[step.index] ? `<tr class="tx-group"><th colspan="5">${GROUPS[step.index]}</th></tr>` : "";
      const reached = step.index <= s.done;
      const head = reached
        ? `<button class="tx-seek" data-seek="${step.index}" aria-label="${step.index}번째 사건으로 이동">${pad(step.index)}</button>`
        : `<span class="hw-muted hw-mono">${pad(step.index)}</span>`;
      if (!reached) return `${group}<tr class="is-future" data-step="${step.index}"><td>${head}</td><td colspan="4" class="hw-muted">·</td></tr>`;
      const actor = (id) => `<td class="${blocked(step, id) ? "tx-wait" : step.client === id ? "" : "hw-muted"}">${actorText(step, id)}</td>`;
      return `${group}<tr data-row-seek="${step.index}" data-step="${step.index}"${step.index === s.index ? ' aria-current="true"' : ""}><td>${head}</td>${actor("T1")}${actor("T2")}${rowCell(step, "A")}${rowCell(step, "B")}</tr>`;
    })
    .join("");
  $("#record-timeline tbody").innerHTML = body;
  timelineRows.refresh();

  const done = all.slice(0, s.done);
  $("#log-count").textContent = done.length || "";
  $("#log-empty").hidden = done.length > 0;
  $("#log-table").hidden = !done.length;
  $("#log-table tbody").innerHTML = done
        .map(
          (step) =>
            `<tr data-row-seek="${step.index}"${step.index === s.index ? ' aria-current="true"' : ""}><td><button class="tx-seek" data-seek="${step.index}" aria-label="${step.index}번째 사건으로 이동">${pad(step.index)}</button></td><td>${step.client ? tx(step.client) : '<span class="tx-id">DB</span>'}</td><td>${describeDeadlockStep(step).title}</td><td><code class="tx-code">${escape(step.sql || (step.action === "rollback" ? "T2의 A UPDATE → ERROR: deadlock detected (40P01)" : "DB가 대기 관계의 순환을 확인"))}</code></td><td class="hw-mono tx-nowrap">A ${step.state.rows.A.owner || "—"} · B ${step.state.rows.B.owner || "—"}</td></tr>`,
        )
    .join("");
  logRows.refresh();

  const state = steps()[s.done].state;
  const final = s.done === LAST;
  $("#record-results").innerHTML = `<div class="tx-results">
    <div class="tx-results-lcd"><span class="hw-label">${final ? "최종" : "현재"} 확정 재고 A · B</span><span class="hw-lcd is-large">${state.rows.A.committed}<small>A</small> ${state.rows.B.committed}<small>B</small></span></div>
    <ul class="hw-list">
      <li><span>처음 확정 재고</span><span class="hw-mono">A 10 · B 20</span></li>
      <li><span>커밋한 주문</span><span class="hw-mono">${state.commits} / 2</span></li>
      <li><span>롤백한 주문</span><span class="hw-mono">${state.rollbacks} / 2</span></li>
    </ul>
    <p class="hw-text">${final ? "T2의 미확정 변경을 버리고 T1만 두 행의 감소를 확정했습니다. T2의 주문을 끝내려면 새 트랜잭션으로 다시 시도해야 합니다." : "현재까지 완료한 사건의 결과입니다. 미확정 쓰기는 이 숫자를 아직 바꾸지 않습니다."}</p>
  </div>`;
}

function predict() {
  player.pause();
  quiz = deadlockPrediction(run);
  $("#prediction-dialog").innerHTML = `${dialogHead("T2를 중단 대상으로 선택한 직후")}
  <div class="hw-plate-body">
    <h2 class="hw-title" id="prediction-title">${quiz.question}</h2>
    <ul class="hw-list tx-gap">${quiz.facts.map(([label, value]) => `<li><span>${label}</span><b class="hw-mono">${value}</b></li>`).join("")}</ul>
    <div class="tx-choices">${quiz.options
      .map((o) => `<button class="hw-key" data-answer="${o.id}"><span class="hw-led" style="--led:var(--tx-ok)"></span>${o.label}</button>`)
      .join("")}</div>
    <div id="prediction-feedback" aria-live="polite"></div>
  </div>`;
  $("#prediction-dialog").showModal();
}

side = createSide();
const timelineRows = followRows($("#record-timeline"), { current: (tbody) => tbody.querySelector(`[data-step="${player.state.index}"]`) });
const logRows = followRows($("#record-log"));

bindConsole(player, {
  guard: "input,select,textarea,button,a",
  refresh: render,
  onAction(button) {
    if (button.dataset.answer) {
      for (const b of document.querySelectorAll("[data-answer]")) {
        b.disabled = true;
        b.classList.toggle("is-chosen", b === button);
        b.querySelector(".hw-led").classList.toggle("is-on", b.dataset.answer === quiz.answerId);
      }
      const chosen = quiz.options.find((o) => o.id === button.dataset.answer);
      $("#prediction-feedback").innerHTML = `<div class="hw-section"><p class="hw-heading">${chosen.id === quiz.answerId ? "맞았습니다." : `정답은 B = ${quiz.answerId}입니다.`}</p><p class="hw-text tx-gap">${chosen.feedback}</p><button class="hw-key hw-key--accent tx-gap" data-action="verify">롤백 과정 확인 →</button></div>`;
      return true;
    }
    switch (button.dataset.action) {
      case "predict":
        predict();
        return true;
      case "verify":
        $("#prediction-dialog").close();
        $("#scene").scrollIntoView({ block: "nearest", behavior: "instant" });
        player.move(player.state.index + 1, true);
        return true;
    }
    return false;
  },
});

scene.update(steps()[0], null, { animate: false });
render();
