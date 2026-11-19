// Lessons 03 (REPEATABLE READ) and 04 (write skew) on index.html?lesson=…:
// the same console as lessons 01–02, driven by isolation-engine.js and the
// content in isolation-lesson.js.
import "../../shared/theme.css";
import "../../shared/hw.css";
import "./styles.css";
import "../../shared/switcher.js";
import "../../shared/iso.js";
import { LABELS, bindRecap, progressHtml, recapHtml } from "../../shared/lesson-kit.js";
import { LEVELS, committedValue, simulateIsolation } from "./isolation-engine.js";
import { ISOLATION_LESSONS } from "./isolation-lesson.js";
import { createIsolationScene } from "./isolation-scene.js";
import { lessonById } from "./lessons.js";
import {
  $,
  $$,
  bindConsole,
  createPlayer,
  createRecap,
  createSide,
  deck,
  dialogHead,
  escape,
  followRows,
  footer,
  lessonProgress,
  mountLessonRail,
  nextLessonOf,
  pad,
  recordsHead,
  sideHead,
  sidePanel,
  stage,
  syncControls,
  topbar,
  tx,
} from "./console.js";

const ACTIONS = {
  initial: "시작 전",
  begin: "시작",
  select: "읽기",
  decide: "앱 판단",
  write: "쓰기",
  wait: "잠금 대기",
  "resume-write": "쓰기 재개",
  error: "오류 40001",
  commit: "커밋",
  "commit-error": "커밋 실패 40001",
  rollback: "롤백",
};

export function start(lessonId) {
  const L = ISOLATION_LESSONS[lessonId];
  const modes = Object.keys(L.modes);
  const runs = Object.fromEntries(modes.map((m) => [m, simulateIsolation({ scenario: L.scenario, mode: m })]));
  const progress = lessonProgress(lessonId, { scenes: 5, recall: L.recap.recall.length });
  const rowIds = L.rows.map((r) => r.id);
  const single = rowIds.length === 1;
  let mode = modes[0];
  let quiz = null;
  let status = "";
  let phaseBody = "";
  const run = () => runs[mode];
  const steps = () => run().steps;
  const last = () => steps().length - 1;
  const text = L.valueText;
  const committedText = (state) => (single ? text(committedValue(state, rowIds[0])) : rowIds.map((id) => `${id} ${text(committedValue(state, id))}`).join(" · "));
  const lockText = (state) => {
    const owners = rowIds.filter((id) => state.rows[id].owner).map((id) => (single ? tx(state.rows[id].owner) : `${id} ${tx(state.rows[id].owner)}`));
    return owners.length ? owners.join(" ") : '<span class="hw-muted">—</span>';
  };

  $("#app").outerHTML = `<div class="hw-page tx-page">
    ${topbar({ lessonId, compare: true })}
    <main class="hw-console">
      ${stage({ label: L.stageLabel, sceneId: "scene", total: last(), tag: LEVELS[mode] })}
      ${deck({
        total: last(),
        before: `<div class="hw-field">
          <span class="hw-label">${L.modeLabel}</span>
          <div class="hw-seg" role="group" aria-label="${L.modeLabel}">${modes
            .map((id) => `<button data-mode="${id}" aria-pressed="${id === mode}">${L.modes[id]}</button>`)
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
            <button class="hw-key tx-wide" data-action="predict" hidden></button>
            <button class="hw-key hw-key--accent tx-wide" data-action="compare" data-role="conclusion" hidden>${LABELS.compareEnd}</button>
          </div>`,
        )}
        ${sidePanel("scenes", `<div class="hw-fill hw-list tx-milestones" id="milestones" aria-label="${LABELS.jumpToScene}"></div>`)}
        ${sidePanel(
          "scope",
          `<div class="hw-fill tx-pages" id="scope-pages">
            <div class="hw-section tx-fact"><span class="hw-label">선택한 수준 · <span id="rule-mode"></span></span><p class="hw-text" id="rule-summary"></p></div>
            <div class="hw-section tx-fact"><span class="hw-label">실험 조건</span><p class="hw-text">${escape(L.condition)}</p></div>
            ${L.notes.map((t, i) => `<div class="hw-section tx-fact"><span class="hw-label">모델 ${pad(i + 1)}</span><p class="hw-text">${escape(t)}</p></div>`).join("")}
            <div class="hw-section tx-fact"><span class="hw-label">장면 표시</span><ul class="tx-details">${L.legend.map((t) => `<li>${escape(t)}</li>`).join("")}</ul></div>
          </div>`,
        )}
      </aside>
      <section class="hw-plate hw-records" aria-label="관찰 기록">
        ${recordsHead([["timeline", "실행 순서"], ["log", `사건 기록 <span class="hw-mono" id="log-count"></span>`], ["results", "결과"]])}
        <div class="hw-plate-body hw-scroll" id="record-timeline" role="tabpanel" aria-labelledby="tab-timeline" data-record-panel="timeline">
          <table class="hw-table tx-table"><thead><tr><th>사건</th><th>${L.names.T1}</th><th>${L.names.T2}</th><th>확정 값</th><th>행 잠금</th></tr></thead><tbody></tbody></table>
        </div>
        <div class="hw-plate-body hw-scroll" id="record-log" role="tabpanel" aria-labelledby="tab-log" data-record-panel="log" hidden>
          <p class="hw-text hw-muted" id="log-empty">사건을 진행하면 보낸 SQL, 앱 판단, 대기 SQL의 재개와 DB 오류가 차례로 기록됩니다.</p>
          <p class="hw-label tx-log-sum" id="log-sum"></p>
          <table class="hw-table tx-table" id="log-table"><thead><tr><th>사건</th><th>주체</th><th>종류</th><th>SQL</th><th>DB 결과</th></tr></thead><tbody></tbody></table>
        </div>
        <div class="hw-plate-body" id="record-results" role="tabpanel" aria-labelledby="tab-results" data-record-panel="results" hidden></div>
      </section>
    </main>
    ${footer(L.sources)}
    <dialog class="hw-dialog" id="prediction-dialog" aria-labelledby="prediction-title"></dialog>
    <dialog class="hw-dialog" id="comparison-dialog" aria-labelledby="comparison-title"></dialog>
  </div>`;
  document.title = `${lessonById(lessonId).name} · 트랜잭션 탐색기`;

  let player;
  let side;
  let lessonKey = "";
  const scene = createIsolationScene($("#scene"), L, {
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

  const predictionAt = (i) => L.prediction(steps()[i], run());
  player = createPlayer({
    steps,
    scene,
    render,
    stopAt: (i) => L.milestones(run()).some((m) => m.index === i) || Boolean(predictionAt(i)),
  });

  function syncLength() {
    const total = last();
    $("#seek").max = total;
    $(".hw-seek > .hw-label:last-child").textContent = total;
    $("#step-count + small").textContent = `/ ${pad(total)} 사건`;
    $("#stage-tag").textContent = LEVELS[mode];
  }

  function renderChanges(step, state) {
    const values = (s) => [
      ...rowIds.flatMap((id) => [
        [single ? "확정 값" : `${id} 확정`, text(committedValue(s, id))],
        [single ? "미확정 값" : `${id} 미확정`, s.rows[id].pending ? `${s.rows[id].pending.client} · ${text(s.rows[id].pending.value)}` : "없음"],
        [single ? "잠금 보유" : `${id} 잠금`, s.rows[id].owner || "없음"],
      ]),
      ["대기 요청", ["T1", "T2"].filter((id) => s.clients[id].waitingFor).join(", ") || "없음"],
      ["오류", ["T1", "T2"].filter((id) => s.clients[id].error).map((id) => `${id} · ${s.clients[id].error.code}`).join(", ") || "없음"],
    ];
    const before = values(step.before);
    const changed = values(state)
      .map(([label, now], i) => [label, before[i][1], now])
      .filter(([, was, now]) => was !== now);
    $("#changes").classList.toggle("tx-off", !step.index);
    $("#changes").innerHTML = `<span class="hw-label">DB 상태 · 직전 → 현재</span>${
      changed.length
        ? `<ul class="hw-list tx-changes">${changed.map(([label, was, now]) => `<li><span>${label}</span><span class="hw-mono"><span class="hw-muted">${was}</span> → <b>${now}</b></span></li>`).join("")}</ul>`
        : `<p class="hw-text hw-muted tx-gap">DB 상태는 바뀌지 않았습니다.</p>`
    }`;
  }

  function render() {
    const s = player.state;
    const step = steps()[s.done];
    const lessonStep = s.busy ? steps()[s.index] : step;
    const lesson = L.describe(lessonStep, run());
    for (const b of $$("[data-mode]:not([data-close])")) b.setAttribute("aria-pressed", String(b.dataset.mode === mode));
    $("#rule-summary").textContent = L.rules[mode];
    $("#rule-mode").textContent = L.modes[mode];
    const milestones = L.milestones(run());
    const sceneAt = s.busy ? -1 : milestones.findIndex((m) => m.index === lessonStep.index);
    if (sceneAt >= 0) progress.markScene(sceneAt + 1);
    const conclusion = s.done === last() && !s.busy;
    $("#eyebrow").textContent = s.busy
      ? `${s.index}번째 사건 · 처리 중`
      : sceneAt >= 0 ? `${LABELS.scene} ${sceneAt + 1}/${milestones.length} · ${lesson.eyebrow}` : lesson.eyebrow;
    $("#lesson-title").textContent = s.busy ? `${lessonStep.client} · ${ACTIONS[lessonStep.action]} 처리 중` : lesson.title;
    $("#lesson-summary").textContent = s.busy ? phaseBody || "장면의 현재 상태를 보며 이번 사건을 따라가세요." : lesson.summary;
    $("#lesson-goal").textContent = lesson.goal;
    $("#lesson-goal").classList.toggle("tx-off", s.busy || !lesson.goal);
    const sql = lessonStep.sql;
    $("#event-section").classList.toggle("tx-off", lessonStep.index === 0 || conclusion || !sql);
    $("#lesson-details").classList.toggle("tx-off", lessonStep.index === 0);
    $("#current-sql").hidden = !sql;
    $("#current-sql").textContent = sql || "";
    $("#lesson-details").innerHTML = s.busy ? "" : lesson.details.map((t) => `<li>${escape(t)}</li>`).join("");
    renderChanges(lessonStep, s.busy ? lessonStep.before : step.state);
    if (conclusion) $("#changes").classList.add("tx-off");
    $("#lesson-key").textContent = lesson.key;
    $("#key-section").classList.toggle("tx-off", s.busy || conclusion);
    recapView.show(conclusion);
    const pending = s.busy ? null : L.prediction(step, run());
    const predictKey = $('[data-action="predict"]');
    predictKey.hidden = !pending;
    if (pending) predictKey.textContent = LABELS.predict(pending.target);
    $('[data-role="conclusion"]').hidden = !conclusion;
    $("#cta").hidden = !pending && !conclusion;
    const active = milestones.findLastIndex((m) => m.index <= s.index);
    // A 핵심 장면 not reached yet shows only where it is, not what happens there.
    $("#milestones").innerHTML = milestones
      .map((m, i) => {
        const seen = s.done >= m.index;
        return `<button data-seek="${m.index}"${i === active ? ' aria-current="true"' : ""}><span class="hw-index">${pad(i + 1)}</span><span class="tx-grow">${seen ? `${m.label}<span class="hw-muted tx-desc"> · ${m.description}</span>` : `<span class="hw-muted">${m.index}번째 사건에서 확인</span>`}</span><span class="hw-mono hw-muted">#${pad(m.index)}</span></button>`;
      })
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

  const cellValue = (step) => {
    const c = step.state.clients[step.client];
    switch (step.action) {
      case "select":
        return c.read;
      case "decide":
        return c.plan.toUpperCase();
      case "write":
      case "resume-write":
        return text(step.state.rows[step.row].pending.value);
      default:
        return null;
    }
  };

  function renderRecords() {
    const s = player.state;
    const all = steps().slice(1);
    $("#record-timeline tbody").innerHTML = all
      .map((step) => {
        const reached = step.index <= s.done;
        const head = reached
          ? `<button class="tx-seek" data-seek="${step.index}" aria-label="${step.index}번째 사건으로 이동">${pad(step.index)}</button>`
          : `<span class="hw-muted hw-mono">${pad(step.index)}</span>`;
        if (!reached) return `<tr class="is-future" data-step="${step.index}"><td>${head}</td><td colspan="4" class="hw-muted">·</td></tr>`;
        const cell = (id) => {
          if (step.client !== id) return "<td></td>";
          const value = cellValue(step);
          const alert = ["wait", "error", "commit-error"].includes(step.action);
          return `<td class="${alert ? "tx-wait" : ""}">${tx(id)} ${ACTIONS[step.action]}${value !== null ? ` <b class="hw-mono">${value}</b>` : ""}</td>`;
        };
        return `<tr data-row-seek="${step.index}" data-step="${step.index}"${step.index === s.index ? ' aria-current="true"' : ""}><td>${head}</td>${cell("T1")}${cell("T2")}<td class="hw-mono">${committedText(step.state)}</td><td>${lockText(step.state)}</td></tr>`;
      })
      .join("");
    timelineRows.refresh();

    const done = all.slice(0, s.done);
    const kind = (step) => (step.action === "decide" ? "앱 판단" : step.action === "resume-write" ? "SQL 재개" : step.action === "error" ? "SQL 재개 · 오류" : step.action === "commit-error" ? "새 SQL · 오류" : "새 SQL");
    const counts = { sql: done.filter((x) => x.sql && !["resume-write", "error"].includes(x.action)).length, app: done.filter((x) => x.action === "decide").length, errors: done.filter((x) => x.error).length };
    $("#log-count").textContent = done.length || "";
    $("#log-empty").hidden = done.length > 0;
    $("#log-sum").hidden = $("#log-table").hidden = !done.length;
    $("#log-sum").textContent = `새 SQL ${counts.sql}건${counts.app ? ` · 앱 판단 ${counts.app}건` : ""} · DB 오류 ${counts.errors}건`;
    $("#log-table tbody").innerHTML = done
      .map((step) => {
        const c = step.state.clients[step.client];
        const detail = step.sql || `${L.screens[0]} ${c.read} → ${c.plan.toUpperCase()}`;
        const result = step.error ? `<span class="tx-wait">ERROR ${step.error.code}</span>` : `확정 ${committedText(step.state)}`;
        return `<tr data-row-seek="${step.index}"${step.index === s.index ? ' aria-current="true"' : ""}><td><button class="tx-seek" data-seek="${step.index}" aria-label="${step.index}번째 사건으로 이동">${pad(step.index)}</button></td><td>${tx(step.client)}</td><td>${kind(step)}</td><td><code class="tx-code">${escape(detail)}</code></td><td class="hw-mono tx-nowrap">${result}</td></tr>`;
      })
      .join("");
    logRows.refresh();

    const state = steps()[s.done].state;
    const final = s.done === last();
    const r = L.result(run(), state, final);
    $("#record-results").innerHTML = `<div class="tx-results">
      <div class="tx-results-lcd"><span class="hw-label">${r.lcd.label}</span><span class="hw-lcd is-large">${r.lcd.value}<small>${r.lcd.unit}</small></span></div>
      <ul class="hw-list">${r.facts.map(([label, value]) => `<li><span>${label}</span><span class="hw-mono">${value}</span></li>`).join("")}</ul>
      <p class="hw-text">${r.text}</p>
    </div>`;
  }

  function showComparison() {
    player.pause();
    progress.markCompared();
    $("#comparison-dialog").innerHTML = `${dialogHead(`${LABELS.compare} · ${LABELS.compareSub}`)}
    <div class="hw-plate-body">
      <h2 class="hw-title" id="comparison-title">${L.compare.title}</h2>
      <p class="hw-text tx-gap">${L.compare.lead}</p>
      <div class="tx-compare">${modes
        .map((m) => {
          const col = L.compare.column(runs[m]);
          return `<section class="tx-compare-col">
            <span class="hw-label">${L.modes[m]}</span>
            <div class="tx-compare-lcd"><span class="hw-lcd is-large">${col.lcd}</span><span class="hw-label">${col.tag}</span></div>
            <ul class="hw-list">${col.rows.map(([id, t]) => `<li>${tx(id)}<span>${escape(t)}</span></li>`).join("")}</ul>
            <p class="hw-text">${col.text}</p>
            <button class="hw-key" data-mode="${m}" data-close="true">${LABELS.replayMode} →</button>
          </section>`;
        })
        .join("")}</div>
      <p class="hw-text hw-muted tx-foot">${escape(L.compare.foot)}</p>
    </div>`;
    $("#comparison-dialog").showModal();
  }

  function showPrediction() {
    player.pause();
    quiz = L.prediction(steps()[player.state.done], run());
    if (!quiz) return;
    $("#prediction-dialog").innerHTML = `${dialogHead(`${LABELS.predictTitle} · ${quiz.label}`)}
    <div class="hw-plate-body">
      <h2 class="hw-title" id="prediction-title">${quiz.question}</h2>
      <ul class="hw-list tx-gap">${quiz.facts.map(([label, value]) => `<li><span>${label}</span><b class="hw-mono">${escape(value)}</b></li>`).join("")}</ul>
      <div class="tx-choices">${quiz.options.map((o) => `<button class="hw-key" data-answer="${o.id}"><span class="hw-led" style="--led:var(--tx-ok)"></span>${o.label}</button>`).join("")}</div>
      <div id="prediction-feedback" aria-live="polite"></div>
    </div>`;
    $("#prediction-dialog").showModal();
  }

  mountLessonRail(lessonId, progress);
  side = createSide();
  const recapView = createRecap($("#lesson-pages"), { id: "transaction", recap: L.recap, progress, side, recapHtml, bindRecap, progressHtml, next: nextLessonOf(lessonId) });
  const timelineRows = followRows($("#record-timeline"), { current: (tbody) => tbody.querySelector(`[data-step="${player.state.index}"]`) });
  const logRows = followRows($("#record-log"));

  bindConsole(player, {
    guard: "input,select,textarea,button,a",
    refresh: render,
    onAction(button) {
      if (button.dataset.mode) {
        // The runs differ in length: rewind before switching so no render
        // reads past the end of the shorter run.
        player.pause();
        Object.assign(player.state, { index: 0, done: 0, busy: false });
        mode = button.dataset.mode;
        syncLength();
        player.restart();
        if (button.dataset.close) button.closest("dialog").close();
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
        progress.markPrediction(`${mode}:${quiz.id}`, correct);
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
