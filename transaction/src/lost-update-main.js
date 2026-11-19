import "../../shared/theme.css";
import "../../shared/hw.css";
import "./styles.css";
import "../../shared/switcher.js";
import "../../shared/iso.js";
import { simulate } from "./engine.js";
// Lesson 01 · 갱신 유실 (index.html, no ?lesson).
import { LABELS, bindRecap, progressHtml, recapHtml } from "../../shared/lesson-kit.js";
import { describeEventLog, describeStep, buildMilestones, predictionFor, MODEL_NOTES, RECAP, SCENE_LEGEND, SOURCES } from "./lesson.js";
import { createTransactionScene } from "./scene.js";
import {
  $,
  $$,
  bindConsole,
  createRecap,
  createSide,
  followRows,
  lessonProgress,
  mountLessonRail,
  nextLessonOf,
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

export function start() {

const runs = { naive: simulate({ mode: "naive" }), locked: simulate({ mode: "locked" }) };
const TOTAL = 11;
const LESSON = "lost-update";
const progress = lessonProgress(LESSON, { scenes: 5, recall: RECAP.recall.length });
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
  naive: "읽은 값은 앱의 로컬 값으로 남고, 앱이 계산한 숫자를 UPDATE에 넣습니다.",
  locked: "값을 읽을 때부터 행을 보호합니다. 뒤에 온 FOR UPDATE는 앞 트랜잭션이 커밋한 값을 읽습니다.",
};

$("#app").outerHTML = `<div class="hw-page tx-page">
  ${topbar({ lessonId: LESSON, compare: true })}
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
          <p class="hw-text" id="lesson-goal"></p>
          <div class="hw-section" id="event-section">
            <span class="hw-label">이번 사건</span>
            <code class="tx-sql" id="current-sql"></code>
          </div>
          <ul class="tx-details" id="lesson-details"></ul>
          <div class="hw-section" id="changes"></div>
          <div class="hw-section" id="key-section"><p class="hw-note hw-note--accent"><span class="hw-label">${LABELS.key}</span> <span id="lesson-key"></span></p></div>
        </div>`,
        `<div class="tx-cta" id="cta">
          <button class="hw-key tx-wide" data-action="predict" hidden>${LABELS.predict("최종 재고")}</button>
          <button class="hw-key hw-key--accent tx-wide" data-action="compare" data-role="conclusion" hidden>${LABELS.compareEnd}</button>
        </div>`,
      )}
      ${sidePanel("scenes", `<div class="hw-fill hw-list tx-milestones" id="milestones" aria-label="${LABELS.jumpToScene}"></div>`)}
      ${sidePanel(
        "scope",
        `<div class="hw-fill tx-pages" id="scope-pages">
          <div class="hw-section tx-fact"><span class="hw-label">선택한 방식 · <span id="rule-mode"></span></span><p class="hw-text" id="rule-summary"></p></div>
          <div class="hw-section tx-fact"><span class="hw-label">실험 조건</span><p class="hw-text">PostgreSQL · READ COMMITTED · 고정된 사건 순서. 재고 10에서 두 주문이 각각 1개 감소(기대 8). 한 주문은 읽기 → 앱에서 −1 → 계산한 숫자로 UPDATE → COMMIT.</p></div>
          ${MODEL_NOTES.map((t, i) => `<div class="hw-section tx-fact"><span class="hw-label">모델 ${pad(i + 1)}</span><p class="hw-text">${t}</p></div>`).join("")}
          <div class="hw-section tx-fact"><span class="hw-label">장면 표시</span><ul class="tx-details">${SCENE_LEGEND.map((t) => `<li>${t}</li>`).join("")}</ul></div>
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
  const milestones = buildMilestones(run());
  const sceneAt = s.busy ? -1 : milestones.findIndex((m) => m.index === lessonStep.index);
  if (sceneAt >= 0) progress.markScene(sceneAt + 1);
  const conclusion = s.done === TOTAL && !s.busy;
  $("#eyebrow").textContent = s.busy
    ? `${s.index}번째 사건 · 처리 중`
    : sceneAt >= 0 ? `${LABELS.scene} ${sceneAt + 1}/${milestones.length} · ${lesson.eyebrow}` : lesson.eyebrow;
  $("#lesson-title").textContent = s.busy ? `${lessonStep.client} · ${actions[lessonStep.action]} 처리 중` : lesson.title;
  $("#lesson-summary").textContent = s.busy ? phaseBody || "장면의 현재 상태를 보며 이번 사건을 따라가세요." : lesson.summary;
  $("#lesson-goal").textContent = lesson.goal;
  $("#lesson-goal").classList.toggle("tx-off", s.busy || !lesson.goal);
  const sql = s.busy ? steps()[s.index].sql : step.sql;
  $("#event-section").classList.toggle("tx-off", lessonStep.index === 0 || conclusion);
  $("#lesson-details").classList.toggle("tx-off", lessonStep.index === 0);
  $("#current-sql").hidden = !sql;
  $("#current-sql").textContent = sql || "";
  $("#lesson-details").innerHTML = s.busy ? "" : lesson.details.map((t) => `<li>${t}</li>`).join("");
  renderChanges(lessonStep, s.busy ? lessonStep.before : step.state);
  if (conclusion) $("#changes").classList.add("tx-off");
  $("#lesson-key").textContent = lesson.key;
  $("#key-section").classList.toggle("tx-off", s.busy || conclusion);
  recapView.show(conclusion);
  const predict = !s.busy && Boolean(predictionFor(step, run()));
  $('[data-action="predict"]').hidden = !predict;
  $('[data-role="conclusion"]').hidden = !conclusion;
  $("#cta").hidden = !predict && !conclusion;
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
  progress.markCompared();
  $("#comparison-dialog").innerHTML = `${dialogHead(`${LABELS.compare} · ${LABELS.compareSub}`)}
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
          <button class="hw-key" data-mode="${m}" data-close="true">${LABELS.replayMode} →</button>
        </section>`;
      })
      .join("")}</div>
    <p class="hw-text hw-muted tx-foot">다른 해법 · 원자적 UPDATE <code>SET stock = stock - 1</code>은 대기 후 새 버전에서 다시 계산해 8 · 낙관적 검사 <code>WHERE stock = 10</code>이면 T2의 UPDATE가 0행 → 앱이 다시 시도 · REPEATABLE READ에서는 T2의 UPDATE가 40001 직렬화 오류로 실패합니다.</p>
  </div>`;
  $("#comparison-dialog").showModal();
}

function showPrediction() {
  player.pause();
  quiz = predictionFor(steps()[player.state.done], run());
  if (!quiz) return;
  $("#prediction-dialog").innerHTML = `${dialogHead(`${LABELS.predictTitle} · T1 커밋 직후`)}
  <div class="hw-plate-body">
    <h2 class="hw-title" id="prediction-title">${quiz.question}</h2>
    <ul class="hw-list tx-gap">${quiz.facts.map(([label, value]) => `<li><span>${label}</span><b class="hw-mono">${escape(value)}</b></li>`).join("")}</ul>
    <div class="tx-choices">${quiz.options.map((o) => `<button class="hw-key" data-answer="${o.id}"><span class="hw-led" style="--led:var(--tx-ok)"></span>${o.label}</button>`).join("")}</div>
    <div id="prediction-feedback" aria-live="polite"></div>
  </div>`;
  $("#prediction-dialog").showModal();
}

mountLessonRail(LESSON, progress);
side = createSide();
const recapView = createRecap($("#lesson-pages"), { id: "transaction", recap: RECAP, progress, side, recapHtml, bindRecap, progressHtml, next: nextLessonOf(LESSON) });
const timelineRows = followRows($("#record-timeline"), { current: (tbody) => tbody.querySelector(`[data-step="${player.state.index}"]`) });
const logRows = followRows($("#record-log"));

bindConsole(player, {
  guard: "input,select,textarea,button,a",
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
      const chosen = quiz.options.find((o) => o.id === button.dataset.answer);
      progress.markPrediction(mode, correct);
      $("#prediction-feedback").innerHTML = `<div class="hw-section"><p class="hw-heading">${correct ? LABELS.correct : LABELS.wrong(quiz.options.find((o) => o.id === quiz.answerId).label)}</p><p class="hw-text tx-gap">${chosen.feedback}</p><button class="hw-key hw-key--accent tx-gap" data-action="verify">${LABELS.reveal}</button></div>`;
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
}
