import "../../shared/theme.css";
import "../../shared/hw.css";
import "./styles.css";
import "../../shared/switcher.js";
import "../../shared/iso.js";
import { bindSliders, icon, syncSlider } from "../../shared/hw.js";
import { paginate, plateTabs, rowWindow } from "../../shared/fit.js";
import { LABELS, bindRecap, createProgress, progressHtml, recapHtml } from "../../shared/lesson-kit.js";
import { currentLesson, mountRail, nextLesson, progressIdFor } from "../../shared/lesson-rail.js";
import { compulsoryCount, victimHintsVisible } from "./lesson.js";
import { CRITERION, LESSONS, POLICY, RULES, extrasFor, runsFor } from "./lessons.js";
import { createMemoryScene, pageColor } from "./scene.js";

const $ = (selector) => document.querySelector(selector);

// One page runs one lesson, chosen by ?lesson=… (the first lesson is the bare page).
const LESSON = currentLesson(LESSONS);
const LESSON_NO = String(LESSONS.indexOf(LESSON) + 1).padStart(2, "0");
const REFS = LESSON.references;
const TOTAL = REFS.length;
const MODES = LESSON.modes;
const runs = runsFor(LESSON);
const EXTRAS = extrasFor(LESSON);
const MILESTONES = LESSON.milestones(runs);
const RECAP = LESSON.recap(runs, EXTRAS);
const progress = createProgress(progressIdFor("memory", LESSONS, LESSON.id), { scenes: MILESTONES.length, recall: RECAP.recall.length });
let mode = MODES[0].id,
  index = 0,
  committed = 0,
  speed = 1,
  playing = false,
  busy = false,
  motionPaused = false,
  resumeAutomatically = false,
  guided = true,
  revision = 0,
  timer = null,
  selectedRecord = "history",
  quiz = null;
// Predictions answered in this session, by quiz id ("fifo-5"): their hints may show.
const answered = new Set();

const modeOf = (id = mode) => MODES.find((m) => m.id === id);
const run = () => runs[mode];
const algorithm = () => modeOf().algorithm;
const current = () => run().steps[committed];
const policyName = (id) => modeOf(id).label;
const chipFor = (page) => (page ? `<span class="mem-pg" style="--pg:${pageColor(page)}">${page}</span>` : `<span class="mem-pg is-empty">—</span>`);
const outcome = (step, cold = false) =>
  `<span class="mem-outcome ${step.hit ? "is-hit" : "is-fault"}"><span class="hw-led is-on"></span>${step.hit ? "적중" : cold && step.compulsory ? "강제 부재" : "부재"}</span>`;
const STAGES = ["조회", "판정", "프레임 선택", "적재", "CPU 읽기"];
const TERMS = [
  ["가상 주소", "프로그램이 보는 주소. 실제 RAM 위치와 따로 매겨집니다."],
  ["페이지", "가상 주소 공간을 같은 크기로 나눈 단위. A~E 다섯 개"],
  ["프레임", "RAM을 같은 크기로 나눈 칸. 프레임 0부터 번호를 매깁니다(F0, F1 …)."],
  ["페이지 테이블", "페이지마다 상주 여부와 프레임 번호를 적은 표"],
  ["MMU", "주소 변환 장치. 접근마다 페이지 테이블로 가상 주소를 RAM 주소로 바꿉니다."],
  ["상주·미상주", "페이지가 지금 RAM 프레임에 있으면 상주, 없으면 미상주(—)"],
  ["적중", "상주 페이지에 접근. 저장장치를 읽지 않습니다."],
  ["페이지 부재", "page fault. 미상주 페이지에 접근해 운영체제가 저장장치에서 읽어 옵니다."],
  ["부재 비용", "RAM 접근은 약 100ns, 저장장치 읽기는 SSD 수십 µs 이상·HDD 수 ms. 그동안 프로세스는 기다립니다."],
  ["강제 부재", "compulsory miss. 그 페이지를 처음 참조할 때의 부재. RAM이 가득 차 있으면 교체도 일어날 수 있습니다."],
  ["용량 부재", "capacity miss. 프레임이 모자라 내보냈던 페이지를 다시 읽는 부재"],
  ["교체", "빈 프레임이 없을 때 한 페이지를 내보내고 그 프레임을 재사용하는 일"],
  ["적중률", "적중 횟수 ÷ 전체 접근 횟수"],
  ["FIFO", RULES.fifo],
  ["LRU", RULES.lru],
  ["OPT(MIN)", "앞으로 가장 늦게 쓰일 페이지를 내보내는 이론상 최적 정책. 미래를 알아야 해 기준선으로만 씁니다."],
  ["참조 비트", "use bit. 페이지에 접근하면 하드웨어가 1로 켜는 비트. 운영체제는 이 비트로 LRU를 근사합니다."],
  ["클럭", `second chance. ${RULES.clock}`],
  ["Belady의 모순", "Belady's anomaly. FIFO에서 프레임을 늘렸는데 부재가 늘어나는 현상"],
  ["스택 알고리즘", "프레임 n개일 때 RAM의 페이지가 n+1개일 때도 늘 RAM에 있는 정책. LRU와 OPT가 그렇고, Belady의 모순이 없습니다."],
];
const MODEL_RULES = [
  ...LESSON.rules,
  ["원본", "A~E는 저장장치(SSD)에 원본이 있는 읽기 전용 페이지입니다."],
  ["빈 칸", "빈 프레임이 있으면 교체 없이 적재합니다."],
  ["쓰기", "내보내는 사본은 수정되지 않아 저장장치에 다시 쓰지 않습니다."],
  ["제외", "TLB·수정 페이지는 다루지 않습니다. 시뮬레이션은 지연 시간을 재지 않습니다. 한 번 넘기면 한 번의 접근입니다."],
];
const dl = (rows) => rows.map(([term, text]) => `<div><dt>${term}</dt><dd>${text}</dd></div>`).join("");

document.title = `메모리 탐색기 · ${LESSON.name}`;
$("#app").outerHTML = `
<div class="hw-page">
  <header class="hw-topbar">
    <div class="hw-brand"><h1>메모리 탐색기</h1><p>보면서 이해하는 운영체제</p></div>
    <div class="hw-context"><span class="hw-label"><span class="hw-index">${LESSON_NO}</span> 레슨</span><strong>${LESSON.name}</strong></div>
    <div class="hw-actions">
      <button class="hw-key hw-key--sm" data-action="compare">${icon("compare")}<span>두 방식 비교</span></button>
      <button class="hw-key hw-key--sm hw-key--icon" data-action="theme" aria-label="어두운 테마로 전환">${icon("moon")}</button>
    </div>
  </header>

  <main class="hw-console">
    <section class="hw-plate hw-stage" aria-labelledby="stage-label">
      <div class="hw-plate-head mem-stage-head">
        <span class="hw-label" id="stage-label"><span class="hw-index">A</span> 페이지 접근</span>
        <ol class="mem-stages" id="stages" aria-label="한 번의 페이지 접근 과정"></ol>
        <div class="mem-lcds">
          <span class="hw-lcd" id="lcd-step" aria-label="처리한 접근 수"></span>
          <span class="hw-lcd" id="lcd-counts" aria-label="부재와 적중 횟수"></span>
        </div>
      </div>
      <div class="hw-scene" id="memory-scene" tabindex="-1" role="group"></div>
      <div class="hw-plate-foot"><span class="hw-led" id="status-led"></span><span id="status-text"></span></div>
    </section>

    <section class="hw-plate hw-deck" aria-label="조작">
      <div class="hw-field mem-policy-field">
        <span class="hw-label">${LESSON.modeLabel}</span>
        <div class="hw-seg" role="group" aria-label="${LESSON.modeLabel}">
          ${MODES.map((m, i) => `<button data-mode="${m.id}" aria-pressed="${i === 0}">${m.label}</button>`).join("")}
        </div>
      </div>
      <div class="hw-field mem-sequence-field">
        <span class="hw-label">접근 순서 <span class="hw-muted">· 눌러서 이동</span></span>
        <div class="hw-seg mem-sequence" id="sequence" role="group" aria-label="고정된 접근 순서 ${TOTAL}회" style="--n:${TOTAL}"></div>
      </div>
      <div class="hw-field mem-transport-field">
        <span class="hw-label">재생</span>
        <div class="hw-transport">
          <button class="hw-key hw-key--icon" data-action="reset" aria-label="처음으로">${icon("reset")}</button>
          <button class="hw-key hw-key--icon" data-action="back" aria-label="이전 접근">${icon("back")}</button>
          <button class="hw-key hw-key--accent mem-play" data-action="play"></button>
          <button class="hw-key" data-action="next">다음 접근${icon("next")}</button>
          <button class="hw-key hw-key--icon" data-action="replay" aria-label="이번 접근 다시 보기" title="이번 접근 다시 보기">${icon("replay")}</button>
          <button class="hw-key hw-key--icon mem-num" data-action="speed" aria-label="재생 속도 1배">1×</button>
        </div>
      </div>
      <div class="hw-seek">
        <span class="hw-label">0</span>
        <input class="hw-slider" id="seek" type="range" min="0" max="${TOTAL}" step="1" value="0" aria-label="처리한 페이지 접근 수" />
        <span class="hw-label">${TOTAL}</span>
      </div>
      <button class="hw-switch" role="switch" aria-checked="true" data-action="guided">${LABELS.guided}</button>
    </section>

    <aside class="hw-plate hw-side" aria-labelledby="lesson-label">
      <div class="hw-plate-head mem-side-head">
        <span class="hw-label" id="lesson-label"><span class="hw-index">B</span><span class="visually-hidden">학습 패널</span></span>
        <div class="hw-tabs" role="tablist" aria-labelledby="lesson-label">
          <button type="button" data-tab="now" aria-selected="true">${LABELS.explainTab}</button>
          <button type="button" data-tab="scenes">${LABELS.scenesTab}</button>
          <button type="button" data-tab="frames">프레임</button>
          <button type="button" data-tab="scope">${LABELS.scopeTab}</button>
        </div>
      </div>
      <div class="hw-plate-body hw-fit" data-panel="now">
        <div class="hw-fill mem-pages" id="now-pages">
          <div>
            <span class="hw-label" id="eyebrow"></span>
            <h2 class="hw-title mem-gap-sm" id="lesson-title"></h2>
            <p class="hw-text mem-gap-sm" id="lesson-body" aria-live="polite"></p>
            <p class="hw-text mem-gap-sm mem-goal" id="lesson-goal"></p>
          </div>
          <div id="event-block">
            <span class="hw-label" id="event-title"></span>
            <p class="mem-ram-line mem-gap-sm" id="event-ram"></p>
          </div>
          <div id="key-block"><div class="hw-note hw-note--accent"><p class="hw-text"><b>${LABELS.key}</b> <span id="insight"></span></p></div></div>
        </div>
        <div class="mem-side-foot">
          <button class="hw-key" data-action="predict"></button>
          <button class="hw-key hw-key--accent" data-action="compare" id="conclusion">${LABELS.compareEnd}</button>
          <div class="hw-pager" id="now-pager"></div>
        </div>
      </div>
      <div class="hw-plate-body hw-fit" data-panel="scenes" hidden>
        <span class="hw-label">${LABELS.jumpToScene}</span>
        <div class="hw-list hw-fill mem-gap-sm" id="milestones"></div>
        <div class="mem-gap-sm" id="scene-progress"></div>
      </div>
      <div class="hw-plate-body hw-fit" data-panel="frames" hidden>
        <span class="hw-label">지금 RAM의 프레임</span>
        <span class="hw-label hw-muted mem-frames-note" id="frames-note"></span>
        <ul class="hw-list hw-fill mem-gap-sm" id="frame-list"></ul>
      </div>
      <div class="hw-plate-body hw-fit" data-panel="scope" hidden>
        <div class="hw-seg mem-scope-seg" role="group" aria-label="범위">
          <button type="button" data-scope="terms" aria-pressed="true">용어</button><button type="button" data-scope="rules" aria-pressed="false">이 실험의 규칙</button>
        </div>
        <dl class="hw-list hw-fill mem-gap-sm mem-rules" id="terms" aria-label="용어">${dl(TERMS)}</dl>
        <dl class="hw-list hw-fill mem-gap-sm mem-rules" id="rules" aria-label="이 실험의 규칙" hidden>${dl(MODEL_RULES)}</dl>
      </div>
    </aside>

    <section class="hw-plate hw-records" aria-label="관찰 기록">
      <div class="hw-plate-head">
        <div class="hw-tabs" role="tablist" aria-label="관찰 기록">
          <button role="tab" id="tab-history" aria-controls="record-history" aria-selected="true" data-record="history">프레임 기록</button>
          <button role="tab" id="tab-events" aria-controls="record-events" aria-selected="false" data-record="events" tabindex="-1">접근 기록 <span class="hw-muted mem-num" id="event-count"></span></button>
          <button role="tab" id="tab-results" aria-controls="record-results" aria-selected="false" data-record="results" tabindex="-1">${LESSON.id === "belady" ? "프레임 수별 결과" : "정책별 결과"}</button>
        </div>
        <span class="hw-label mem-hide-sm">기록을 눌러 그 접근으로 이동</span>
      </div>
      <div class="hw-plate-body hw-scroll" id="record-history" role="tabpanel" aria-labelledby="tab-history"></div>
      <div class="hw-plate-body hw-scroll mem-events-box" id="record-events" role="tabpanel" aria-labelledby="tab-events" hidden>
        <p class="hw-text hw-muted" id="events-empty">페이지에 접근하면 판정과 교체 근거가 기록됩니다.</p>
        <table class="hw-table" id="events-table"><thead><tr><th>접근</th><th>페이지</th><th>판정</th><th>프레임</th><th>교체</th><th>근거</th></tr></thead><tbody id="events-body"></tbody></table>
      </div>
      <div class="hw-plate-body hw-scroll" id="record-results" role="tabpanel" aria-labelledby="tab-results" hidden></div>
    </section>
  </main>

  <footer class="hw-footer">
    <span>조작: <kbd>Space</kbd> 재생·정지 <kbd>←</kbd><kbd>→</kbd> 접근 이동 <kbd>R</kbd> 처음으로</span>
    <span>학습 근거 <a href="https://pages.cs.wisc.edu/~remzi/OSTEP/vm-beyondphys.pdf" target="_blank" rel="noreferrer">OSTEP 21장 ↗</a> · <a href="https://pages.cs.wisc.edu/~remzi/OSTEP/vm-beyondphys-policy.pdf" target="_blank" rel="noreferrer">22장 ↗</a> · Silberschatz 10.4</span>
  </footer>

  <dialog class="hw-dialog" id="prediction-dialog" aria-labelledby="prediction-title"></dialog>
  <dialog class="hw-dialog" id="comparison-dialog" aria-labelledby="comparison-title"></dialog>
</div>`;

const app = $(".hw-page");
// The lesson rail: this explorer's lessons with their progress LEDs.
const rail = mountRail({ explorer: "memory", title: "페이지 교체", lessons: LESSONS, current: LESSON.id });
rail.watch(progress);
// Nothing scrolls on a desktop console: the side panel is tabbed, long
// content is split into pages and the event log shows a window of rows.
const sidePanel = plateTabs($(".hw-side"));
const nowPager = paginate($("#now-pages"), { label: "해설", pager: $("#now-pager") });
const framesPager = paginate($("#frame-list"), { label: "프레임" });
const scenePager = paginate($("#milestones"), { label: LABELS.scenesTab });
paginate($("#terms"), { label: "용어" });
paginate($("#rules"), { label: "규칙" });
const eventsWindow = rowWindow($("#record-events"), $("#events-body"), { current: () => $("#events-body tr[aria-current]") });
let nowText = "",
  shownChapter = null,
  recapShownFor = null;
// Changed explanation text starts again on its first page.
function refreshNow() {
  const text = $("#now-pages").textContent;
  nowPager.refresh();
  if (text !== nowText) nowPager.show(0);
  nowText = text;
}
const scene = createMemoryScene($("#memory-scene"), {
  frameCount: modeOf().frameCount,
  onPhase(phase) {
    renderStages(phase.kind);
    $("#status-text").textContent = phase.title;
    $("#status-led").dataset.kind = phase.kind;
    $("#status-led").classList.toggle("is-on", phase.kind !== "ready");
    if (busy) {
      $("#lesson-body").textContent = phase.body;
      refreshNow();
    }
  },
});

function renderProgress() {
  const html = progressHtml(progress.summary());
  $("#scene-progress").innerHTML = html;
  document.querySelectorAll("#now-pages .hw-progress").forEach((el) => (el.outerHTML = html));
}
progress.onChange(renderProgress);

/* ---------- Rendering ---------- */

function renderStages(kind = "ready") {
  const step = run().steps[index];
  const position = { ready: -1, lookup: 0, hit: 1, miss: 1, select: 2, evict: 2, load: 3, retry: 4, read: 4, access: 5 }[kind];
  const decided = position >= 1 && step.index;
  $("#stages").innerHTML = STAGES.map((label, i) => {
    const text = i === 1 && decided ? (step.hit ? "적중" : "부재") : i === 4 && kind === "retry" ? "재시도" : label;
    const skipped = decided && step.hit && (i === 2 || i === 3);
    const state = skipped ? "is-skipped" : i === position ? "is-active" : i < position ? "is-done" : "";
    // Status dots as in the lesson rail: ring (to come), half (now), filled (done).
    const dot = skipped ? "is-new" : i === position ? "is-progress" : i < position ? "is-done" : "is-new";
    return `<li class="${state}"${i === position ? ' aria-current="step"' : ""}><span class="hw-led ${dot}"></span>${text}${skipped ? '<span class="visually-hidden"> (생략)</span>' : ""}</li>`;
  }).join("");
}

function renderControls() {
  const moving = playing || (busy && !motionPaused);
  const play = $('[data-action="play"]');
  play.innerHTML = `${icon(moving ? "pause" : "play")}${moving ? LABELS.pause : index === TOTAL && !busy ? LABELS.replay : index === 0 ? LABELS.start : LABELS.resume}`;
  play.setAttribute("aria-label", moving ? LABELS.pause : "재생");
  $('[data-action="back"]').disabled = index === 0;
  $('[data-action="next"]').disabled = busy || index === TOTAL;
  $('[data-action="replay"]').disabled = index === 0 || busy;
  $('[data-action="guided"]').setAttribute("aria-checked", String(guided));
  $("#memory-scene").setAttribute("aria-busy", String(busy));
}

/** The 정리 sections join the 해설 pages at the end; built once per visit. */
function renderRecap(show) {
  const key = show ? mode : null;
  if (key === recapShownFor) return;
  recapShownFor = key;
  document.querySelectorAll("#now-pages > .mem-recap-part").forEach((el) => el.remove());
  if (!show) return;
  const holder = document.createElement("div");
  holder.innerHTML = recapHtml({ id: "memory", points: RECAP.points, recall: RECAP.recall, progress, next: nextLesson(LESSONS, LESSON.id) });
  const parts = [...holder.firstElementChild.children];
  parts.forEach((el) => el.classList.add("mem-recap-part"));
  parts[0].querySelector(".hw-label").textContent = `${LABELS.recap} · ${LABELS.recapPoints}`;
  $("#now-pages").append(...parts);
  bindRecap($("#now-pages"), {
    recall: RECAP.recall,
    progress,
    onAnswer(question) {
      // Keep the learner on the question they answered.
      const box = $(`#now-pages [data-recall="${question.id}"]`);
      nowPager.refresh();
      nowPager.showItem(box);
      nowText = $("#now-pages").textContent;
    },
  });
}

/** What each policy compares, as shown in the 프레임 tab for one frame. */
function frameNumbers(f, hints, step) {
  const alg = algorithm();
  const cell = (on, label, value) => `<span class="${hints && on ? "is-key" : ""}">${label} <b class="hw-mono">${value}</b></span>`;
  if (alg === "opt") return cell(false, "적재", f.loadedAt) + cell(true, "다음 접근", f.nextUseAt ?? "없음");
  if (alg === "clock") return cell(false, "적재", f.loadedAt) + `<span class="is-key">참조 비트 <b class="hw-mono">${f.ref ? 1 : 0}</b></span>${step.hand === f.slot ? '<span class="is-key">▲ 바늘</span>' : ""}`;
  return cell(alg === "fifo", "적재", f.loadedAt) + cell(alg === "lru", "마지막 접근", f.lastUsedAt);
}
const NEXT_NOTE = {
  fifo: "적재 순서가 가장 앞선 페이지가 다음 교체",
  lru: "마지막 접근이 가장 이른 페이지가 다음 교체",
  opt: "다음 접근이 가장 늦은 페이지가 다음 교체",
  clock: "바늘부터 돌며 참조 비트 0인 페이지에서 멈춥니다",
};

function render() {
  const step = current();
  const shown = run().steps[busy && index < TOTAL ? index : committed];
  const lesson = LESSON.describe(shown, run(), modeOf());
  const seek = $("#seek");
  seek.value = index;
  seek.setAttribute("aria-valuetext", `${index}번의 페이지 접근, 전체 ${TOTAL}번`);
  syncSlider(seek);

  $("#lcd-step").innerHTML = `${index}<small>/ ${TOTAL} 접근</small>`;
  $("#lcd-counts").innerHTML = `${step.faults}<small>부재</small> ${step.hits}<small>적중</small>`;

  document.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
  $("#sequence").innerHTML = REFS.map(
    (page, i) =>
      `<button data-seek="${i + 1}" aria-pressed="${i + 1 === index}" class="${i < committed ? "is-visited" : ""}" style="--pg:${pageColor(page)}" aria-label="${i + 1}번째, 페이지 ${page} 접근 후로 이동"><small>${i + 1}</small><b>${page}</b></button>`,
  ).join("");

  // 설명: eyebrow, title, body, 이번 접근 (직전 → 현재), 핵심.
  $("#eyebrow").textContent = busy ? `${index}번째 접근 · 처리 중 · ${policyName()}` : lesson.eyebrow;
  $("#lesson-title").textContent = lesson.title;
  if (!busy) $("#lesson-body").textContent = lesson.body;
  $("#lesson-goal").textContent = busy ? "" : lesson.goal;
  $("#lesson-goal").hidden = busy || !lesson.goal;
  // paginate() owns `hidden` on the page blocks; a class takes a block out.
  $("#event-block").classList.toggle("mem-off", busy || shown.index === 0);
  $("#event-title").textContent = `${LABELS.now} 접근 · ${lesson.eventTitle}`;
  $("#event-ram").innerHTML = shown.index
    ? `<span class="hw-label">직전</span>${shown.before.map((f) => chipFor(f.page)).join("")}<span class="hw-label">→ 현재</span>${shown.frames.map((f) => chipFor(f.page)).join("")}`
    : "";
  $("#key-block").classList.toggle("mem-off", busy);
  $("#insight").textContent = lesson.key;
  renderRecap(index === TOTAL && !busy);

  const nextQuiz = !busy && run().steps[index + 1] ? LESSON.predict(run().steps[index + 1], run(), modeOf()) : null;
  const open = $("#prediction-dialog").open ? quiz : null;
  const hints = victimHintsVisible({ nextQuiz: open ?? nextQuiz, answered: answered.has((open ?? nextQuiz)?.id), busy });
  scene.setHints(hints);

  const occupied = step.frames.filter((frame) => frame.page !== null);
  $("#frames-note").textContent = busy
    ? "직전 접근 기준"
    : !hints
      ? "예측을 마치면 다음 교체 순서를 표시합니다."
      : occupied.length < step.frames.length
        ? "빈 프레임이 있어 교체하지 않습니다."
        : NEXT_NOTE[algorithm()];
  $("#frame-list").innerHTML = occupied.length
    ? occupied
        .map((f) => `<li><span class="hw-label mem-slot-id">F${f.slot}</span>${chipFor(f.page)}<span class="mem-frame-nums">${frameNumbers(f, hints, step)}</span></li>`)
        .join("")
    : '<li class="hw-muted">RAM이 비어 있습니다.</li>';

  const predict = $('[data-action="predict"]');
  if (nextQuiz) predict.textContent = LABELS.predict(nextQuiz.kind === "outcome" ? `${nextQuiz.atIndex}번째 ${nextQuiz.page}의 결과` : "내보낼 페이지");
  predict.hidden = !nextQuiz;
  $("#conclusion").hidden = !(index === TOTAL && !busy);

  const chapter = MILESTONES.findIndex((m) => m.index === lesson.chapterId);
  $("#milestones").innerHTML = MILESTONES.map(
    (m, i) =>
      `<button data-seek="${m.index}"${i === chapter ? ' aria-current="true"' : ""}><span class="hw-index">${String(i + 1).padStart(2, "0")}</span>${m.title}<span class="hw-muted mem-end mem-num">${m.index === 0 ? "시작" : `${m.index}번째`}</span></button>`,
  ).join("");
  scenePager.refresh();
  if (chapter !== shownChapter) scenePager.showItem($("#milestones").children[(shownChapter = chapter) < 0 ? 0 : chapter]);
  framesPager.refresh();
  refreshNow();

  if (!busy) renderStages(index ? "access" : "ready");
  renderRecords();
  renderControls();
}

/** The 근거 column of the access log. */
function reasonOf(s) {
  if (s.hit) return "이미 상주";
  if (!s.victim) return "빈 프레임";
  const v = s.before[s.frameIndex];
  switch (algorithm()) {
    case "fifo":
      return `적재 순서 가장 앞 · ${v.loadedAt}번째`;
    case "lru":
      return `마지막 접근 가장 이름 · ${v.lastUsedAt}번째`;
    case "opt":
      return v.nextUseAt === null ? "다시 쓰이지 않음" : `다음 접근 가장 늦음 · ${v.nextUseAt}번째`;
    default: {
      const swept = s.events.filter((e) => e.type === "sweep").length;
      return swept ? `비트 ${swept}개 끄고 · 참조 비트 0` : "참조 비트 0";
    }
  }
}

function renderRecords() {
  const steps = run().steps;
  const slots = run().frameCount;
  const head = REFS.map(
    (_, i) => `<th${i + 1 === committed ? ' aria-current="true"' : ""}><button class="mem-col-key" data-seek="${i + 1}" aria-label="${i + 1}번째 접근으로 이동">${i + 1}</button></th>`,
  ).join("");
  const row = (label, cell) =>
    `<tr><th scope="row">${label}</th>${REFS.map((page, i) => {
      const s = i < committed ? steps[i + 1] : null;
      return `<td data-seek="${i + 1}" class="${i + 1 === committed ? "is-current" : ""} ${s ? "" : "is-future"}">${cell(s, page)}</td>`;
    }).join("")}</tr>`;
  $("#record-history").innerHTML = `<table class="hw-table mem-history" style="--cols:${TOTAL}" data-frames="${slots}">
    <thead><tr><th>접근</th>${head}</tr></thead>
    <tbody>
      ${row("요청", (s, page) => (s ? chipFor(page) : `<span class="mem-pg is-future">${page}</span>`))}
      ${Array.from({ length: slots }, (_, slot) => row(`F${slot}`, (s) => (s ? (s.frames[slot].page ? `<span class="${s.frameIndex === slot && s.fault ? "mem-new" : ""}">${chipFor(s.frames[slot].page)}</span>` : chipFor(null)) : ""))).join("")}
      ${row("결과", (s) => (s ? outcome(s) : ""))}
    </tbody></table>`;

  $("#event-count").textContent = `${committed}`;
  $("#events-empty").hidden = committed > 0;
  $("#events-table").hidden = committed === 0;
  $("#events-body").innerHTML = steps
    .slice(1, committed + 1)
    .map(
      (s) =>
        `<tr data-seek="${s.index}"${s.index === committed ? ' aria-current="true"' : ""}><td><button class="mem-row-key" data-seek="${s.index}" aria-label="${s.index}번째 접근으로 이동">${s.index}번째</button></td><td>${chipFor(s.page)}</td><td>${outcome(s, true)}</td><td>F${s.frameIndex}</td><td>${s.victim ? `${s.victim} → ${s.page}` : "—"}</td><td>${reasonOf(s)}</td></tr>`,
    )
    .join("");
  eventsWindow.refresh();

  const at = committed;
  const cold = compulsoryCount(run(), at);
  $("#record-results").innerHTML = `<table class="hw-table">
    <thead><tr><th>${LESSON.modeLabel}</th><th>처리한 접근</th><th>페이지 부재</th><th>적중</th><th>페이지 교체</th><th>적중률</th></tr></thead>
    <tbody>${MODES.map((m) => {
      const s = runs[m.id].steps[at];
      return `<tr${m.id === mode ? ' aria-current="true"' : ""}><td><b>${m.label}</b></td><td class="mem-num">${s.index}회</td><td class="mem-num">${s.faults}회</td><td class="mem-num">${s.hits}회</td><td class="mem-num">${s.replacements}회</td><td class="mem-num">${s.index ? `${Math.round((s.hits / s.index) * 100)}%` : "—"}</td></tr>`;
    }).join("")}</tbody></table>
    <p class="hw-text hw-muted mem-gap-md">${at ? `${at}번째 접근까지 같은 순서를 두 조건에 적용한 결과입니다. ${policyName()}의 부재 ${current().faults}회 중 ${cold}회는 처음 참조한 강제 부재이고, ${current().faults - current().replacements}회는 빈 프레임에 적재했습니다.` : "첫 접근 전에는 적중률을 계산하지 않습니다."} 부재와 교체는 같은 횟수가 아닙니다.</p>`;
}

/* ---------- Playback ---------- */

function pause() {
  playing = false;
  clearTimeout(timer);
  motionPaused = busy;
  scene.pause();
  renderControls();
}
function schedule() {
  clearTimeout(timer);
  if (playing && !busy) timer = setTimeout(() => navigate(index + 1, true), 700 / speed);
}
async function navigate(target, animate = false, startPaused = false) {
  clearTimeout(timer);
  const token = ++revision;
  const previous = run().steps[committed];
  target = Math.max(0, Math.min(TOTAL, target));
  const sequential = animate && target === committed + 1;
  index = target;
  busy = sequential;
  if (!startPaused) resumeAutomatically = playing;
  motionPaused = startPaused;
  if (!sequential) committed = target;
  render();
  await scene.update(run().steps[target], previous, { animate: sequential, speed, paused: startPaused, algorithm: algorithm() });
  if (token !== revision) return;
  busy = false;
  committed = target;
  motionPaused = false;
  render();
  const stop = MILESTONES.some((m) => m.index === target);
  if (stop) progress.markScene(target);
  if (target === TOTAL || (guided && stop)) playing = false;
  renderControls();
  schedule();
}
async function togglePlay() {
  if (playing || (busy && !motionPaused)) return pause();
  if (index === TOTAL && !busy) await navigate(0);
  playing = !busy || resumeAutomatically;
  motionPaused = false;
  scene.resume();
  renderControls();
  if (!busy) schedule();
}
function nextAccess() {
  if (busy || index === TOTAL) return;
  pause();
  return navigate(index + 1, true);
}

/* ---------- Records, dialogs, theme ---------- */

function selectRecord(name, focus = false) {
  selectedRecord = name;
  document.querySelectorAll("[data-record]").forEach((b) => {
    const selected = b.dataset.record === name;
    b.setAttribute("aria-selected", String(selected));
    b.tabIndex = selected ? 0 : -1;
    $("#record-" + b.dataset.record).hidden = !selected;
    if (selected && focus) b.focus();
  });
}

const dialogHead = (label, id) =>
  `<div class="hw-plate-head"><span class="hw-label">${label}</span><button class="hw-key hw-key--sm hw-key--icon" data-close="${id}" aria-label="닫기">${icon("close")}</button></div>`;

function showPrediction() {
  quiz = LESSON.predict(run().steps[index + 1], run(), modeOf());
  if (!quiz) return;
  pause();
  const outcomeQuiz = quiz.kind === "outcome";
  $("#prediction-dialog").innerHTML = `${dialogHead(LABELS.predictTitle, "prediction-dialog")}
    <div class="hw-plate-body">
      <span class="hw-label"><span class="hw-index">${policyName()}</span> ${quiz.atIndex}번째 접근</span>
      <h2 class="hw-title mem-gap-sm" id="prediction-title">${quiz.question}</h2>
      <p class="hw-text hw-muted mem-gap-sm">${quiz.rule}</p>
      <p class="hw-label mem-gap-sm mem-history-line">지금까지의 접근 · ${quiz.history.map((page, i) => `<span class="mem-num">${i + 1}</span>${chipFor(page)}`).join(" ")}</p>
      ${algorithm() === "opt" ? `<p class="hw-label mem-gap-sm mem-history-line">OPT가 아는 앞으로의 접근 · ${REFS.slice(quiz.atIndex).map((page, i) => `<span class="mem-num">${quiz.atIndex + i + 1}</span>${chipFor(page)}`).join(" ")}</p>` : ""}
      <div class="hw-list mem-gap-md mem-choices">${quiz.choices
        .map(
          (c) =>
            `<button data-answer="${c.id}">${outcomeQuiz ? `<span class="mem-outcome ${c.label === "적중" ? "is-hit" : "is-fault"}"><span class="hw-led is-on"></span></span>` : chipFor(c.id)}<span class="mem-choice-text"><span>${c.label}</span><span class="hw-label" data-detail="${c.detail}">${outcomeQuiz ? c.detail : `F${c.slot}`}</span></span><span class="mem-verdict mem-end"></span></button>`,
        )
        .join("")}</div>
      <div id="prediction-feedback" class="mem-gap-md" aria-live="polite"></div>
      <div class="mem-dialog-actions"><button class="hw-key hw-key--accent" data-action="reveal" hidden>${LABELS.reveal}</button></div>
    </div>`;
  // While the result is asked, what is in RAM would answer it: mask it.
  app.classList.toggle("mem-masked", outcomeQuiz);
  $("#prediction-dialog").showModal();
  render();
}
function answer(id) {
  const chosen = quiz.choices.find((c) => c.id === id);
  const right = quiz.choices.find((c) => c.correct);
  document.querySelectorAll("[data-answer]").forEach((b) => {
    b.disabled = true;
    const correct = b.dataset.answer === right.id;
    const wrong = b.dataset.answer === id && !correct;
    b.classList.toggle("is-correct", correct);
    b.classList.toggle("is-wrong", wrong);
    b.querySelector(".mem-verdict").textContent = correct ? "정답" : wrong ? "선택" : "";
    // The evidence is shown once the learner has committed.
    const detail = b.querySelector("[data-detail]");
    detail.textContent = detail.dataset.detail;
  });
  const ok = chosen.correct;
  $("#prediction-feedback").innerHTML = `<div class="hw-note ${ok ? "hw-note--accent" : ""}"><p class="hw-text"><b>${ok ? LABELS.correct : LABELS.wrong(quiz.answer)}</b> ${chosen.why}${ok ? "" : ` ${right.why}`}</p></div>`;
  answered.add(quiz.id);
  progress.markPrediction(quiz.id, ok);
  app.classList.remove("mem-masked");
  $('[data-action="reveal"]').hidden = false;
  $('[data-action="reveal"]').focus();
  render();
}

function showComparison() {
  pause();
  progress.markCompared();
  const frames = [...new Set(MODES.map((m) => m.frameCount))].map((n) => `${n}개`).join("와 ");
  $("#comparison-dialog").innerHTML = `${dialogHead(`${LABELS.compareSub} · ${TOTAL}번의 접근 · 프레임 ${frames}`, "comparison-dialog")}
    <div class="hw-plate-body">
      <h2 class="hw-title" id="comparison-title">${LABELS.compare}</h2>
      <div class="mem-compare-grid">${MODES.map((m) => {
        const r = runs[m.id];
        const sub = LESSON.id === "belady" ? `${POLICY[m.algorithm]} · 같은 정책, 프레임 ${m.frameCount}개` : CRITERION[m.algorithm];
        return `<div class="mem-compare">
            <span class="hw-label"><span class="hw-index">${m.label}</span> ${sub}</span>
            <span class="hw-lcd mem-gap-sm">${r.stats.faults}<small>부재</small> ${r.stats.hits}<small>적중</small> ${r.stats.replacements}<small>교체</small></span>
            <ol class="mem-trace" aria-label="${m.label} 접근별 결과">${r.steps
              .slice(1)
              .map((s) => `<li class="${s.hit ? "is-hit" : "is-fault"}" title="${s.index}번째 ${s.page}: ${s.hit ? "적중" : "부재"}">${chipFor(s.page)}<span class="hw-led is-on"></span><span class="visually-hidden">${s.hit ? "적중" : "부재"}</span></li>`)
              .join("")}</ol>
            <button class="hw-key hw-key--sm mem-gap-md" data-replay-mode="${m.id}">${LABELS.replayMode}</button>
          </div>`;
      }).join("")}</div>
      <div class="hw-section">
        <p class="hw-text">${LESSON.forkText(runs, EXTRAS)}</p>
        <p class="hw-text hw-muted mem-gap-sm">${LESSON.compareNote(runs, EXTRAS)}</p>
        <p class="mem-legend hw-label mem-gap-sm"><span class="mem-outcome is-hit"><span class="hw-led is-on"></span>적중</span><span class="mem-outcome is-fault"><span class="hw-led is-on"></span>부재</span></p>
      </div>
      <div class="mem-dialog-actions"><button class="hw-key hw-key--accent" data-action="turning-point">${LABELS.backToFork} →</button></div>
    </div>`;
  $("#comparison-dialog").showModal();
}

function changeTheme() {
  const dark = document.documentElement.dataset.theme !== "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  localStorage.setItem("memory-explorer-theme", dark ? "dark" : "light");
  const key = $('[data-action="theme"]');
  key.setAttribute("aria-label", dark ? "밝은 테마로 전환" : "어두운 테마로 전환");
  key.innerHTML = icon(dark ? "sun" : "moon");
}
function focusScene() {
  const host = $("#memory-scene");
  host.focus({ preventScroll: true });
  host.scrollIntoView({ block: "center", behavior: "instant" });
}

/* ---------- Events ---------- */

app.addEventListener("click", async (event) => {
  const target = event.target.closest("button, [data-seek]");
  if (!target || target.disabled) return;
  if (target.closest("[data-recall]")) return; // bindRecap handles these
  if (target.closest(".hw-rail")) return; // lesson rail: plain links and its own close key
  if (target.dataset.close) return $("#" + target.dataset.close).close();
  if (target.dataset.answer) return answer(target.dataset.answer);
  if (target.dataset.record) return selectRecord(target.dataset.record);
  if (target.dataset.scope) {
    document.querySelectorAll("[data-scope]").forEach((b) => b.setAttribute("aria-pressed", String(b === target)));
    $("#terms").hidden = target.dataset.scope !== "terms";
    $("#rules").hidden = target.dataset.scope !== "rules";
    return;
  }
  if (target.dataset.replayMode) {
    $("#comparison-dialog").close();
    pause();
    mode = target.dataset.replayMode;
    await navigate(0);
    return;
  }
  if (target.dataset.seek !== undefined) {
    if (target.closest("#milestones")) sidePanel.select("now");
    pause();
    await navigate(Number(target.dataset.seek));
    return;
  }
  if (target.dataset.mode) {
    if (target.dataset.mode === mode) return;
    mode = target.dataset.mode;
    await navigate(index, busy, motionPaused);
    return;
  }
  switch (target.dataset.action) {
    case "play":
      await togglePlay();
      break;
    case "reset":
      pause();
      await navigate(0);
      break;
    case "back":
      pause();
      await navigate(index - 1);
      break;
    case "replay": {
      const at = index;
      pause();
      await navigate(at - 1);
      await navigate(at, true);
      break;
    }
    case "next":
      await nextAccess();
      break;
    case "guided":
      guided = !guided;
      renderControls();
      break;
    case "speed":
      speed = speed === 1 ? 2 : speed === 2 ? 0.5 : 1;
      target.textContent = `${speed}×`;
      target.setAttribute("aria-label", `재생 속도 ${speed}배`);
      scene.setSpeed(speed);
      schedule();
      break;
    case "theme":
      changeTheme();
      break;
    case "predict":
      showPrediction();
      break;
    case "reveal":
      $("#prediction-dialog").close();
      focusScene();
      await navigate(quiz.atIndex, true);
      break;
    case "compare":
      showComparison();
      break;
    case "turning-point":
      $("#comparison-dialog").close();
      pause();
      await navigate(LESSON.fork);
      break;
  }
});
$("#prediction-dialog").addEventListener("close", () => {
  app.classList.remove("mem-masked");
  render();
});
$("#seek").addEventListener("input", () => {
  pause();
  navigate(Number($("#seek").value));
});
$(".hw-records .hw-tabs").addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const names = ["history", "events", "results"];
  const i = names.indexOf(selectedRecord);
  selectRecord(
    event.key === "Home" ? names[0] : event.key === "End" ? names[2] : names[(i + (event.key === "ArrowLeft" ? 2 : 1)) % 3],
    true,
  );
  event.preventDefault();
});
document.addEventListener("keydown", (event) => {
  if (document.querySelector("dialog[open]") || app.classList.contains("is-rail-open") || event.target.matches("input,button,select,textarea,summary,a")) return;
  if (event.code === "Space") {
    event.preventDefault();
    togglePlay();
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    if (!event.repeat) nextAccess();
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    pause();
    navigate(index - 1);
  } else if (event.key.toLowerCase() === "r" && !event.ctrlKey && !event.metaKey) {
    pause();
    navigate(0);
  }
});
for (const dialog of document.querySelectorAll("dialog"))
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });

if (localStorage.getItem("memory-explorer-theme") === "dark") changeTheme();
bindSliders(app);
renderProgress();
render();
progress.markScene(0);
scene.update(current(), null, { animate: false, algorithm: algorithm() });
