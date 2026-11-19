import "../../shared/theme.css";
import "../../shared/hw.css";
import "./styles.css";
import "../../shared/switcher.js";
import "../../shared/iso.js";
import { LABELS, bindRecap, createProgress, progressHtml, recapHtml } from "../../shared/lesson-kit.js";
import { ORDERS, simulateDeadlock } from "./deadlock-engine.js";
import {
  describeDeadlockStep,
  deadlockMilestones,
  deadlockPrediction,
  DEADLOCK_LEGEND,
  DEADLOCK_NOTES,
  DEADLOCK_RECAP,
  DEADLOCK_SOURCES,
  ORDER_PLAN,
} from "./deadlock-lesson.js";
import { createDeadlockScene } from "./deadlock-scene.js";
import {
  $,
  $$,
  bindConsole,
  createRecap,
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

const runs = { opposite: simulateDeadlock({ order: "opposite" }), same: simulateDeadlock({ order: "same" }) };
const progress = createProgress("deadlock", { scenes: 5, recall: DEADLOCK_RECAP.recall.length });
let order = "opposite";
let quiz = null;
const run = () => runs[order];
const steps = () => run().steps;
const last = () => steps().length - 1;
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
// Record groups, shown only once the learner has reached them.
const GROUPS = {
  opposite: { 1: "01 · 잠금 확보", 5: "02 · 교착 상태", 8: "03 · 해소와 확정" },
  same: { 1: "01 · 잠금 확보", 4: "02 · 한 방향 대기", 7: "03 · 재개와 확정" },
};
const plan = (o) => `T1 ${ORDER_PLAN[o].T1} · T2 ${ORDER_PLAN[o].T2}`;

$("#app").outerHTML = `<div class="hw-page tx-page">
  ${topbar({ page: 1, context: { label: LABELS.scenario, title: "두 행을 줄이는 두 주문" }, compare: true })}
  <main class="hw-console">
    ${stage({ label: "잠금과 대기의 연결", sceneId: "scene", total: last() })}
    ${deck({
      total: last(),
      before: `<div class="hw-field">
        <span class="hw-label">잠그는 순서</span>
        <div class="hw-seg" role="group" aria-label="행을 잠그는 순서">${Object.entries(ORDERS)
          .map(([id, label]) => `<button data-order="${id}" aria-pressed="${id === order}">${label}</button>`)
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
          <button class="hw-key tx-wide" data-action="predict" hidden>${LABELS.predict("재개 후 B의 값")}</button>
          <button class="hw-key hw-key--accent tx-wide" data-action="compare" data-role="conclusion" hidden>${LABELS.compareEnd}</button>
        </div>`,
      )}
      ${sidePanel("scenes", `<div class="hw-fill hw-list tx-milestones" id="milestones" aria-label="${LABELS.jumpToScene}"></div>`)}
      ${sidePanel(
        "scope",
        `<div class="hw-fill tx-pages" id="scope-pages">
          <div class="hw-section tx-fact"><span class="hw-label">잠그는 순서 · <span id="rule-order"></span></span><p class="hw-text" id="rule-summary"></p></div>
          <div class="hw-section tx-fact"><span class="hw-label">실험 조건</span><p class="hw-text">PostgreSQL · READ COMMITTED · 고정된 사건 순서. 처음 확정 재고 A 10 · B 20, 각 UPDATE는 그 행의 stock − 1.</p></div>
          ${DEADLOCK_NOTES.map((t, i) => `<div class="hw-section tx-fact"><span class="hw-label">모델 ${pad(i + 1)}</span><p class="hw-text">${t}</p></div>`).join("")}
          <div class="hw-section tx-fact"><span class="hw-label">장면 표시</span><ul class="tx-details">${DEADLOCK_LEGEND.map((t) => `<li>${t}</li>`).join("")}</ul></div>
        </div>`,
      )}
    </aside>
    <section class="hw-plate hw-records" aria-label="관찰 기록">
      ${recordsHead([["timeline", "실행 순서"], ["log", `사건 기록 <span class="hw-mono" id="log-count"></span>`], ["results", "재고 결과"]])}
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
  <dialog class="hw-dialog" id="comparison-dialog" aria-labelledby="comparison-title"></dialog>
</div>`;

const RULES = {
  opposite: "T1은 A부터, T2는 B부터 잠급니다. 첫 잠금을 놓지 않은 채 상대가 잠근 행을 요청합니다.",
  same: "두 트랜잭션 모두 A부터 잠급니다. 늦게 온 쪽은 첫 행에서 기다립니다.",
};

let player;
let side;
let lessonKey = "";
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
  stopAt: (i) => deadlockMilestones(order).some((m) => m.index === i),
});

/** The two runs have different lengths: keep the seek range and counters in step. */
function syncLength() {
  const total = last();
  const seek = $("#seek");
  seek.max = total;
  $(".hw-seek > .hw-label:last-child").textContent = total;
  $("#step-count + small").textContent = `/ ${pad(total)} 사건`;
}

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
  const milestones = deadlockMilestones(order);
  const sceneAt = s.busy ? -1 : milestones.findIndex((m) => m.index === step.index);
  if (sceneAt >= 0) progress.markScene(sceneAt + 1);
  const conclusion = s.done === last() && !s.busy;
  for (const b of $$("[data-order]:not([data-close])")) b.setAttribute("aria-pressed", String(b.dataset.order === order));
  $("#rule-order").textContent = ORDERS[order];
  $("#rule-summary").textContent = RULES[order];
  $("#eyebrow").textContent = s.busy
    ? `${s.index}번째 사건 · 처리 중`
    : sceneAt >= 0 ? `${LABELS.scene} ${sceneAt + 1}/${milestones.length} · ${lesson.eyebrow}` : lesson.eyebrow;
  $("#lesson-title").textContent = s.busy ? `${step.client || "DB"} · ${actions[step.action]} 처리 중` : lesson.title;
  $("#lesson-summary").textContent = s.busy ? phaseBody || "현재 장면의 잠금과 재고 변화를 따라가세요." : lesson.summary;
  $("#lesson-goal").textContent = lesson.goal;
  $("#lesson-goal").classList.toggle("tx-off", s.busy || !lesson.goal);
  $("#event-section").classList.toggle("tx-off", step.index === 0 || conclusion);
  $("#lesson-details").classList.toggle("tx-off", step.index === 0);
  $("#current-sql").hidden = !step.sql;
  $("#current-sql").textContent = step.sql || "";
  $("#lesson-details").innerHTML = s.busy ? "" : lesson.details.map((t) => `<li>${t}</li>`).join("");
  renderChanges(step, s.busy ? step.before : step.state);
  if (conclusion) $("#changes").classList.add("tx-off");
  $("#lesson-key").textContent = lesson.key;
  $("#key-section").classList.toggle("tx-off", s.busy || conclusion);
  recapView.show(conclusion);
  const predict = !s.busy && step.action === "rollback" && Boolean(deadlockPrediction(run()));
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
  const key = `${order}:${s.index}`;
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
  const groups = GROUPS[order];
  const body = all
    .map((step) => {
      const reached = step.index <= s.done;
      const group = groups[step.index] && reached ? `<tr class="tx-group"><th colspan="5">${groups[step.index]}</th></tr>` : "";
      const head = reached
        ? `<button class="tx-seek" data-seek="${step.index}" aria-label="${step.index}번째 사건으로 이동">${pad(step.index)}</button>`
        : `<span class="hw-muted hw-mono">${pad(step.index)}</span>`;
      if (!reached) return `<tr class="is-future" data-step="${step.index}"><td>${head}</td><td colspan="4" class="hw-muted">·</td></tr>`;
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
  const final = s.done === last();
  const ending =
    order === "same"
      ? "T2는 A에서 기다렸다가 이어서 실행했습니다. 두 주문의 감소가 모두 확정됐습니다."
      : "T2의 미확정 변경을 버리고 T1만 두 행의 감소를 확정했습니다. T2의 주문을 끝내려면 새 트랜잭션으로 다시 시도해야 합니다.";
  $("#record-results").innerHTML = `<div class="tx-results">
    <div class="tx-results-lcd"><span class="hw-label">${final ? "최종" : "현재"} 확정 재고 A · B</span><span class="hw-lcd is-large">${state.rows.A.committed}<small>A</small> ${state.rows.B.committed}<small>B</small></span></div>
    <ul class="hw-list">
      <li><span>처음 확정 재고</span><span class="hw-mono">A 10 · B 20</span></li>
      <li><span>커밋한 주문</span><span class="hw-mono">${state.commits} / 2</span></li>
      <li><span>롤백한 주문</span><span class="hw-mono">${state.rollbacks} / 2</span></li>
    </ul>
    <p class="hw-text">${final ? ending : "현재까지 완료한 사건의 결과입니다. 미확정 쓰기는 이 숫자를 아직 바꾸지 않습니다."}</p>
  </div>`;
}

function showComparison() {
  player.pause();
  progress.markCompared();
  const columns = {
    opposite: {
      verdict: "커밋 1 · 롤백 1",
      t1: "A → B · 커밋",
      t2: "B → A · 40P01로 중단",
      text: "T2가 B를 쥔 채 A를 기다리고, T1은 A를 쥔 채 B를 기다립니다. DB가 한쪽을 중단해야 고리가 풀립니다.",
    },
    same: {
      verdict: "커밋 2 · 롤백 0",
      t1: "A → B · 커밋",
      t2: "A 대기 → A → B · 커밋",
      text: "T2는 아무 잠금도 쥐지 않은 채 A에서 기다립니다. T1이 커밋하면 새 값에서 이어서 실행됩니다.",
    },
  };
  $("#comparison-dialog").innerHTML = `${dialogHead(`${LABELS.compare} · ${LABELS.compareSub}`)}
  <div class="hw-plate-body">
    <h2 class="hw-title" id="comparison-title">잠그는 순서만 바꾸면 무엇이 달라질까?</h2>
    <p class="hw-text tx-gap">두 실행 모두 같은 A 10 · B 20에서 같은 UPDATE를 보냅니다. 갈림길은 T2가 처음 잠그는 행입니다. B를 먼저 잡으면 순환이 생기고, A를 먼저 요청하면 기다리기만 합니다.</p>
    <div class="tx-compare">${Object.keys(ORDERS)
      .map((o) => {
        const c = columns[o];
        const { A, B } = runs[o].stats.finalStocks;
        return `<section class="tx-compare-col">
          <span class="hw-label">${ORDERS[o]} · ${plan(o)}</span>
          <div class="tx-compare-lcd"><span class="hw-lcd is-large">${A}<small>A</small> ${B}<small>B</small></span><span class="hw-label">${c.verdict}</span></div>
          <ul class="hw-list">
            <li>${tx("T1")}<span>${c.t1}</span></li>
            <li>${tx("T2")}<span>${c.t2}</span></li>
          </ul>
          <p class="hw-text">${c.text}</p>
          <button class="hw-key" data-order="${o}" data-close="true">${LABELS.replayMode} →</button>
        </section>`;
      })
      .join("")}</div>
  </div>`;
  $("#comparison-dialog").showModal();
}

function predict() {
  player.pause();
  quiz = deadlockPrediction(run());
  if (!quiz) return;
  $("#prediction-dialog").innerHTML = `${dialogHead(`${LABELS.predictTitle} · T2 롤백 직후`)}
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
const recapView = createRecap($("#lesson-pages"), { id: "deadlock", recap: DEADLOCK_RECAP, progress, side, recapHtml, bindRecap, progressHtml });
const timelineRows = followRows($("#record-timeline"), { current: (tbody) => tbody.querySelector(`[data-step="${player.state.index}"]`) });
const logRows = followRows($("#record-log"));

bindConsole(player, {
  guard: "input,select,textarea,button,a",
  refresh: render,
  onAction(button) {
    if (button.dataset.order) {
      // The runs differ in length: rewind before switching so no render reads
      // past the end of the shorter run.
      player.pause();
      Object.assign(player.state, { index: 0, done: 0, busy: false });
      order = button.dataset.order;
      syncLength();
      player.restart();
      if (button.dataset.close) button.closest("dialog").close();
      return true;
    }
    if (button.dataset.answer) {
      for (const b of document.querySelectorAll("[data-answer]")) {
        b.disabled = true;
        b.classList.toggle("is-chosen", b === button);
        b.querySelector(".hw-led").classList.toggle("is-on", b.dataset.answer === quiz.answerId);
      }
      const chosen = quiz.options.find((o) => o.id === button.dataset.answer);
      const correct = chosen.id === quiz.answerId;
      progress.markPrediction(order, correct);
      $("#prediction-feedback").innerHTML = `<div class="hw-section"><p class="hw-heading">${correct ? LABELS.correct : LABELS.wrong(quiz.answerId)}</p><p class="hw-text tx-gap">${chosen.feedback}</p><button class="hw-key hw-key--accent tx-gap" data-action="verify">${LABELS.reveal}</button></div>`;
      return true;
    }
    switch (button.dataset.action) {
      case "compare":
        showComparison();
        return true;
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
