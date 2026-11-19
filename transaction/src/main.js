import "../../shared/theme.css";
import "../../shared/hw.css";
import "./styles.css";
import "../../shared/switcher.js";
import "../../shared/iso.js";
import { simulate } from "./engine.js";
import { describeEventLog, describeStep, buildMilestones, predictionFor, MODEL_NOTES, SOURCES } from "./lesson.js";
import { createTransactionScene } from "./scene.js";
import {
  $,
  $$,
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

const runs = { naive: simulate({ mode: "naive" }), locked: simulate({ mode: "locked" }) };
const TOTAL = 11;
let mode = "naive";
let quiz = null;
let status = "";
let phaseBody = "";
const run = () => runs[mode];
const steps = () => run().steps;
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
const MODES = { naive: "일반 SELECT", locked: "SELECT FOR UPDATE" };
const RULES = {
  naive: "읽은 값은 앱에 남습니다. 이후 UPDATE가 잠금을 기다려도 앱의 계산은 자동으로 바뀌지 않습니다.",
  locked: "값을 읽을 때부터 행을 보호합니다. 다른 FOR UPDATE는 앞선 커밋 뒤의 값을 읽습니다.",
};

$("#app").outerHTML = `<div class="hw-page tx-page">
  ${topbar({ page: 0, context: { label: "대표 시나리오", title: "같은 재고, 두 개의 주문" }, compare: true })}
  <main class="hw-console">
    ${stage({ label: "요청과 잠금의 흐름", sceneId: "scene", total: TOTAL })}
    ${deck({
      total: TOTAL,
      before: `<div class="hw-field">
        <span class="hw-label">값을 읽는 방법</span>
        <div class="hw-seg" role="group" aria-label="읽기 잠금 방식">${Object.entries(MODES)
          .map(([id, label]) => `<button data-mode="${id}" aria-pressed="${id === mode}">${label}</button>`)
          .join("")}</div>
      </div>`,
    })}
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
          <button class="hw-key tx-wide" data-action="predict" hidden>대기 다음의 결과, 맞혀보기 →</button>
          <button class="hw-key hw-key--accent tx-wide" data-action="compare" data-role="conclusion" hidden>전체 실행 결과 비교 →</button>
        </div>`,
      )}
      ${sidePanel("scenes", `<div class="hw-fill hw-list tx-milestones" id="milestones" aria-label="핵심 장면으로 이동"></div>`)}
      ${sidePanel(
        "scope",
        `<div class="hw-fill tx-pages" id="scope-pages">
          <div class="hw-section tx-fact"><span class="hw-label">선택한 방식 · <span id="rule-mode"></span></span><p class="hw-text" id="rule-summary"></p></div>
          <div class="hw-section tx-fact"><span class="hw-label">데이터베이스</span><p class="hw-text">PostgreSQL · READ COMMITTED · 고정된 사건 순서</p></div>
          <div class="hw-section tx-fact"><span class="hw-label">목표</span><p class="hw-text">두 주문이 각각 1개 감소 · 10 − 1 − 1 = 8</p></div>
          <div class="hw-section tx-fact"><span class="hw-label">한 주문</span><p class="hw-text">읽기 → 앱에서 −1 계산 → 계산한 숫자로 UPDATE → COMMIT</p></div>
          ${[...MODEL_NOTES, "실제 데이터베이스 연결이나 실행 시간 측정 없이 한 행의 상태 변화를 재현합니다."]
            .map((t, i) => `<div class="hw-section tx-fact"><span class="hw-label">모델 ${pad(i + 1)}</span><p class="hw-text">${t}</p></div>`)
            .join("")}
        </div>`,
      )}
    </aside>
    <section class="hw-plate hw-records" aria-label="관찰 기록">
      ${recordsHead([["timeline", "실행 순서"], ["log", `사건 기록 <span class="hw-mono" id="log-count"></span>`], ["results", "재고 결과"]])}
      <div class="hw-plate-body hw-scroll" id="record-timeline" role="tabpanel" aria-labelledby="tab-timeline" data-record-panel="timeline">
        <table class="hw-table tx-table"><thead><tr><th>사건</th><th>T1 · 주문 1</th><th>T2 · 주문 2</th><th>확정 재고</th><th>행 잠금</th></tr></thead><tbody></tbody></table>
      </div>
      <div class="hw-plate-body hw-scroll" id="record-log" role="tabpanel" aria-labelledby="tab-log" data-record-panel="log" hidden>
        <p class="hw-text hw-muted" id="log-empty">사건을 진행하면 요청과 계산, 대기 중이던 SQL의 재개가 차례로 기록됩니다.</p>
        <p class="hw-label tx-log-sum" id="log-sum"></p>
        <table class="hw-table tx-table" id="log-table"><thead><tr><th>사건</th><th>주체</th><th>종류</th><th>SQL · 계산</th><th>DB 결과</th></tr></thead><tbody></tbody></table>
      </div>
      <div class="hw-plate-body" id="record-results" role="tabpanel" aria-labelledby="tab-results" data-record-panel="results" hidden></div>
    </section>
  </main>
  ${footer(SOURCES)}
  <dialog class="hw-dialog" id="prediction-dialog" aria-labelledby="prediction-title"></dialog>
  <dialog class="hw-dialog" id="comparison-dialog" aria-labelledby="comparison-title"></dialog>
</div>`;

let player;
let side;
let lessonKey = "";
const scene = createTransactionScene($("#scene"), {
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
  stopAt: (i) => buildMilestones(run()).some((m) => m.index === i) || Boolean(predictionFor(steps()[i], run())),
});

function renderChanges(step, state) {
  const values = (s) => [
    ["확정 재고", `${s.committedStock}개`],
    ["미확정 값", s.uncommitted ? `${s.uncommitted.client} · ${s.uncommitted.stock}` : "없음"],
    ["잠금 보유", s.rowLock.owner || "없음"],
    ["대기 요청", s.rowLock.waiting.length ? `${s.rowLock.waiting.join(", ")}${s.rowLock.owner ? " · 잠금 대기" : " · 재개 가능"}` : "없음"],
  ];
  const before = values(step.before);
  const changed = values(state).filter(([, value], i) => value !== before[i][1]);
  $("#changes").classList.toggle("tx-off", !step.index);
  $("#changes").innerHTML = `<span class="hw-label">DB 상태 · 직전 → 현재</span>${
    changed.length
      ? `<ul class="hw-list tx-changes">${changed
          .map(([label, value]) => `<li><span>${label}</span><span class="hw-mono"><span class="hw-muted">${before.find(([l]) => l === label)[1]}</span> → <b>${value}</b></span></li>`)
          .join("")}</ul>`
      : `<p class="hw-text hw-muted tx-gap">DB 상태는 바뀌지 않았습니다.</p>`
  }`;
}

function render() {
  const s = player.state;
  const step = steps()[s.done];
  const lessonStep = s.busy ? steps()[s.index] : step;
  const lesson = describeStep(lessonStep, run());
  for (const b of $$("[data-mode]:not([data-close])")) b.setAttribute("aria-pressed", String(b.dataset.mode === mode));
  $("#rule-summary").textContent = RULES[mode];
  $("#rule-mode").textContent = MODES[mode];
  $("#eyebrow").textContent = s.busy ? `${s.index}번째 사건 · 처리 중` : lesson.eyebrow;
  $("#lesson-title").textContent = s.busy ? `${lessonStep.client} · ${actions[lessonStep.action]} 처리 중` : lesson.title;
  $("#lesson-summary").textContent = s.busy ? phaseBody || "장면의 현재 상태를 보며 이번 사건을 따라가세요." : lesson.summary;
  const sql = s.busy ? steps()[s.index].sql : step.sql;
  $("#event-section").classList.toggle("tx-off", lessonStep.index === 0);
  $("#lesson-details").classList.toggle("tx-off", lessonStep.index === 0);
  $("#current-sql").hidden = !sql;
  $("#current-sql").textContent = sql || "";
  $("#lesson-details").innerHTML = s.busy ? "" : lesson.details.map((t) => `<li>${t}</li>`).join("");
  renderChanges(lessonStep, s.busy ? lessonStep.before : step.state);
  $("#takeaway").textContent = lesson.takeaway;
  $("#takeaway-section").classList.toggle("tx-off", s.busy);
  const predict = !s.busy && Boolean(predictionFor(step, run()));
  const conclusion = s.done === TOTAL && !s.busy;
  $('[data-action="predict"]').hidden = !predict;
  $('[data-role="conclusion"]').hidden = !conclusion;
  $("#cta").hidden = !predict && !conclusion;
  const milestones = buildMilestones(run());
  const active = milestones.findLastIndex((m) => m.index <= s.index);
  $("#milestones").innerHTML = milestones
    .map(
      (m, i) =>
        `<button data-seek="${m.index}"${i === active ? ' aria-current="true"' : ""} title="${escape(s.done >= m.index ? m.description : `${m.index}번째 사건에서 확인`)}"><span class="hw-index">${pad(i + 1)}</span><span class="tx-grow">${m.label}${s.done >= m.index ? `<span class="hw-muted tx-desc"> · ${m.description}</span>` : ""}</span><span class="hw-mono hw-muted">#${pad(m.index)}</span></button>`,
    )
    .join("");
  const key = `${mode}:${s.index}`;
  side.refresh("lesson-pages", { reset: key !== lessonKey });
  lessonKey = key;
  side.refresh("milestones", { item: $("#milestones [aria-current]") });
  side.refresh("scope-pages");
  renderRecords();
  if (!s.busy) phaseBody = "";
  syncControls(player, { sceneEl: $("#scene"), status });
}

function renderRecords() {
  const s = player.state;
  const all = steps().slice(1);
  const valueOf = (step, id) => {
    const c = step.state.clients[id];
    if (["read", "resume-read"].includes(step.action)) return c.localRead;
    if (["write", "resume-write", "calculate"].includes(step.action)) return c.localWrite;
    return null;
  };
  const rows = all
    .map((step) => {
      const reached = step.index <= s.done;
      const head = reached
        ? `<button class="tx-seek" data-seek="${step.index}" aria-label="${step.index}번째 사건으로 이동">${pad(step.index)}</button>`
        : `<span class="hw-muted hw-mono">${pad(step.index)}</span>`;
      if (!reached) return `<tr class="is-future" data-step="${step.index}"><td>${head}</td><td colspan="4" class="hw-muted">·</td></tr>`;
      const cell = (id) => {
        if (step.client !== id) return "<td></td>";
        const value = valueOf(step, id);
        return `<td class="${step.action === "wait" ? "tx-wait" : ""}">${tx(id)} ${actions[step.action]}${value !== null ? ` <b class="hw-mono">${value}</b>` : ""}</td>`;
      };
      return `<tr data-row-seek="${step.index}" data-step="${step.index}"${step.index === s.index ? ' aria-current="true"' : ""}><td>${head}</td>${cell("T1")}${cell("T2")}<td class="hw-mono">${step.state.committedStock}</td><td>${step.state.rowLock.owner ? tx(step.state.rowLock.owner) : '<span class="hw-muted">—</span>'}</td></tr>`;
    })
    .join("");
  $("#record-timeline tbody").innerHTML = rows;
  timelineRows.refresh();

  const { entries, counts } = describeEventLog(all.slice(0, s.done));
  $("#log-count").textContent = entries.length || "";
  $("#log-empty").hidden = entries.length > 0;
  $("#log-sum").hidden = $("#log-table").hidden = !entries.length;
  $("#log-sum").textContent = `새 SQL ${counts.sql}건 · 앱 계산 ${counts.calculate}건 · SQL 재개 ${counts.resume}건`;
  $("#log-table tbody").innerHTML = entries
        .map(({ step, kind, origin }) => {
          const c = step.state.clients[step.client];
          const label = kind === "sql" ? `새 SQL · ${actions[step.action]}` : kind === "resume" ? `SQL 재개 · ${step.action === "resume-read" ? "읽기" : "쓰기"}` : "앱 계산";
          const detail = step.sql || `${c.localRead} − 1 = ${c.localWrite}`;
          const link = kind === "resume" ? `<button class="tx-link" data-origin="${origin}">↖ ${origin}번 원요청 · 잠금 대기 시작</button>` : "";
          return `<tr data-row-seek="${step.index}"${step.index === s.index ? ' aria-current="true"' : ""}><td><button class="tx-seek" data-seek="${step.index}" aria-label="${step.index}번째 사건으로 이동">${pad(step.index)}</button></td><td>${tx(step.client)}</td><td>${label}${link}</td><td><code class="tx-code">${escape(detail)}</code></td><td class="hw-mono tx-nowrap">확정 ${step.state.committedStock}<span class="hw-muted"> · ${step.state.uncommitted ? `미확정 ${step.state.uncommitted.stock}` : "미확정 없음"}</span></td></tr>`;
        })
    .join("");
  logRows.refresh();

  const state = steps()[s.done].state;
  const final = s.done === TOTAL;
  $("#record-results").innerHTML = `<div class="tx-results">
    <div class="tx-results-lcd"><span class="hw-label">${final ? "최종" : "현재"} 확정 재고</span><span class="hw-lcd is-large">${state.committedStock}<small>개</small></span></div>
    <ul class="hw-list">
      <li><span>처음 재고</span><span class="hw-mono">10개</span></li>
      <li><span>기대하는 최종 재고</span><span class="hw-mono">8개</span></li>
      <li><span>완료한 트랜잭션</span><span class="hw-mono">${state.completedTransactions} / 2</span></li>
    </ul>
    <p class="hw-text">${final ? (mode === "naive" ? "두 트랜잭션이 모두 커밋했지만 재고 감소는 한 번만 남았습니다." : "T1의 10 → 9, T2의 9 → 8이 모두 반영됐습니다.") : "이 값은 현재까지 완료한 사건의 결과입니다. 마지막 커밋까지 재생해 최종 재고를 확인하세요."}</p>
  </div>`;
}

function showComparison() {
  player.pause();
  $("#comparison-dialog").innerHTML = `${dialogHead("같은 10개 · 같은 두 주문")}
  <div class="hw-plate-body">
    <h2 class="hw-title" id="comparison-title">잠금은 언제 시작해야 할까?</h2>
    <p class="hw-text tx-gap">두 방식 모두 UPDATE가 행을 잠급니다. 차이는 T2가 계산에 사용할 값을 언제 읽는지입니다.</p>
    <div class="tx-compare">${["naive", "locked"]
      .map((m) => {
        const final = runs[m].stats.actualStock;
        return `<section class="tx-compare-col">
          <span class="hw-label">${MODES[m]}</span>
          <div class="tx-compare-lcd"><span class="hw-lcd is-large">${final}<small>개</small></span><span class="hw-label">${m === "naive" ? "감소 1회 유실" : "감소 2회 모두 반영"}</span></div>
          <ul class="hw-list">
            <li>${tx("T1")}<span>읽기 <b class="hw-mono">10</b> → 커밋 <b class="hw-mono">9</b></span></li>
            <li>${tx("T2")}<span>읽기 <b class="hw-mono">${m === "naive" ? 10 : 9}</b> → 커밋 <b class="hw-mono">${final}</b></span></li>
          </ul>
          <p class="hw-text">${m === "naive" ? "T2는 먼저 읽은 10으로 계산한 9를 씁니다. 쓰기 잠금을 기다려도 이 숫자는 바뀌지 않습니다." : "T2의 읽기가 T1의 커밋을 기다립니다. 갱신된 9를 읽고 8을 계산합니다."}</p>
          <button class="hw-key" data-mode="${m}" data-close="true">이 방식으로 다시 보기 →</button>
        </section>`;
      })
      .join("")}</div>
    <p class="hw-text hw-muted tx-foot">SET stock = stock - 1처럼 DB 안에서 한 문장으로 감소시키는 방법은 이 실험의 분리된 읽기·계산·쓰기와 다릅니다.</p>
  </div>`;
  $("#comparison-dialog").showModal();
}

function showPrediction() {
  player.pause();
  const state = steps()[player.state.done].state;
  quiz = predictionFor(steps()[player.state.done], run());
  if (!quiz) return;
  $("#prediction-dialog").innerHTML = `${dialogHead("현재 상태로 다음 사건 예측")}
  <div class="hw-plate-body">
    <h2 class="hw-title" id="prediction-title">${quiz.question}</h2>
    <ul class="hw-list tx-gap">
      <li><span>확정 재고</span><b class="hw-mono">${state.committedStock}</b></li>
      <li><span>T2가 읽은 값</span><b class="hw-mono">${state.clients.T2.localRead ?? "아직 없음"}</b></li>
      <li><span>T2의 계산</span><b class="hw-mono">${state.clients.T2.localWrite ?? "아직 없음"}</b></li>
    </ul>
    <div class="tx-choices">${quiz.options.map((o) => `<button class="hw-key" data-answer="${o.id}"><span class="hw-led" style="--led:var(--tx-ok)"></span>${o.label}</button>`).join("")}</div>
    <div id="prediction-feedback" aria-live="polite"></div>
  </div>`;
  $("#prediction-dialog").showModal();
}

side = createSide();
const timelineRows = followRows($("#record-timeline"), { current: (tbody) => tbody.querySelector(`[data-step="${player.state.index}"]`) });
const logRows = followRows($("#record-log"));

bindConsole(player, {
  guard: "input,select,textarea,button",
  refresh: render,
  onAction(button) {
    if (button.dataset.mode) {
      mode = button.dataset.mode;
      player.restart();
      if (button.dataset.close) button.closest("dialog").close();
      return true;
    }
    if (button.dataset.origin) {
      const origin = button.dataset.origin;
      player.jump(Number(origin)).then(() => $(`#record-log [data-seek="${origin}"]`)?.focus());
      return true;
    }
    if (button.dataset.answer) {
      const correct = button.dataset.answer === quiz.answerId;
      for (const b of $$("[data-answer]")) {
        b.disabled = true;
        b.classList.toggle("is-chosen", b === button);
        b.querySelector(".hw-led").classList.toggle("is-on", b.dataset.answer === quiz.answerId);
      }
      $("#prediction-feedback").innerHTML = `<div class="hw-section"><p class="hw-heading">${correct ? "맞았습니다." : "현재 값의 차이를 다시 살펴보세요."}</p><p class="hw-text tx-gap">${quiz.explanation}</p><button class="hw-key hw-key--accent tx-gap" data-action="verify">실제 요청 재개 보기 →</button></div>`;
      return true;
    }
    switch (button.dataset.action) {
      case "compare":
        showComparison();
        return true;
      case "predict":
        showPrediction();
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
