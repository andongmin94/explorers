import "../../shared/theme.css";
import "../../shared/hw.css";
import "./styles.css";
import "../../shared/switcher.js";
import "../../shared/iso.js";
import { bindSliders, icon, syncSlider } from "../../shared/hw.js";
import { paginate, plateTabs, rowWindow } from "../../shared/fit.js";
import { REFERENCE_STRING, simulate } from "./engine.js";
import { buildMilestones, describeStep, predictionFor } from "./lesson.js";
import { createMemoryScene, pageColor } from "./scene.js";
import { countFaults } from "./policies.js";

const $ = (selector) => document.querySelector(selector);
const TOTAL = REFERENCE_STRING.length;
const runs = { fifo: simulate({ algorithm: "fifo" }), lru: simulate({ algorithm: "lru" }) };
let algorithm = "fifo",
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

const run = () => runs[algorithm];
const current = () => run().steps[committed];
const policyName = (name) => name.toUpperCase();
const chipFor = (page) => (page ? `<span class="mem-pg" style="--pg:${pageColor(page)}">${page}</span>` : `<span class="mem-pg is-empty">—</span>`);
const outcome = (step) =>
  `<span class="mem-outcome ${step.hit ? "is-hit" : "is-fault"}"><span class="hw-led is-on"></span>${step.hit ? "적중" : "부재"}</span>`;
const STAGES = ["조회", "판정", "프레임 선택", "적재", "CPU 읽기"];
const MILESTONE_SHORT = ["개념", "빈 칸", "재사용", "교체", "영향", "비교"];
const RULES = {
  fifo: "가장 먼저 들어온 페이지를 내보냅니다. 적중해도 적재 순서는 바뀌지 않습니다.",
  lru: "가장 오래 사용하지 않은 페이지를 내보냅니다. 적중하면 최근 사용 순서를 갱신합니다.",
};

$("#app").outerHTML = `
<div class="hw-page">
  <header class="hw-topbar">
    <div class="hw-brand"><h1>메모리 탐색기</h1><p>보면서 이해하는 운영체제</p></div>
    <div class="hw-context"><span class="hw-label"><span class="hw-index">02</span> 대표 시나리오</span><strong>같은 접근, 다른 교체</strong></div>
    <div class="hw-actions">
      <button class="hw-key hw-key--sm" data-action="compare">${icon("compare")}<span class="mem-hide-sm">FIFO · LRU </span>비교</button>
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
        <span class="hw-label">교체 방식</span>
        <div class="hw-seg" role="group" aria-label="페이지 교체 방식">
          <button data-algorithm="fifo" aria-pressed="true">FIFO</button><button data-algorithm="lru" aria-pressed="false">LRU</button>
        </div>
      </div>
      <div class="hw-field mem-sequence-field">
        <span class="hw-label">접근 순서 <span class="hw-muted">· 눌러서 이동</span></span>
        <div class="hw-seg mem-sequence" id="sequence" role="group" aria-label="고정된 접근 순서 10회"></div>
      </div>
      <div class="hw-field mem-transport-field">
        <span class="hw-label">재생</span>
        <div class="hw-transport">
          <button class="hw-key hw-key--icon" data-action="reset" aria-label="처음으로">${icon("reset")}</button>
          <button class="hw-key hw-key--icon" data-action="back" aria-label="이전 접근">${icon("back")}</button>
          <button class="hw-key hw-key--accent mem-play" data-action="play"></button>
          <button class="hw-key" data-action="next">다음 접근${icon("next")}</button>
          <button class="hw-key hw-key--icon" data-action="replay" aria-label="이번 접근 다시 보기" title="이번 접근 다시 보기">${icon("replay")}</button>
          <button class="hw-key hw-key--icon hw-mono" data-action="speed" aria-label="재생 속도 1배">1×</button>
        </div>
      </div>
      <div class="hw-seek">
        <span class="hw-label">0</span>
        <input class="hw-slider" id="seek" type="range" min="0" max="${TOTAL}" step="1" value="0" aria-label="처리한 페이지 접근 수" />
        <span class="hw-label">${TOTAL}</span>
      </div>
      <button class="hw-switch" role="switch" aria-checked="true" data-action="guided">핵심 장면에서 멈추기</button>
    </section>

    <aside class="hw-plate hw-side" aria-labelledby="lesson-label">
      <div class="hw-plate-head mem-side-head">
        <span class="hw-label" id="lesson-label"><span class="hw-index">B</span><span class="visually-hidden">학습 패널</span></span>
        <div class="hw-tabs" role="tablist" aria-labelledby="lesson-label">
          <button type="button" data-tab="now" aria-selected="true">해설</button>
          <button type="button" data-tab="frames">프레임</button>
          <button type="button" data-tab="scenes">장면</button>
          <button type="button" data-tab="rules">규칙</button>
        </div>
      </div>
      <div class="hw-plate-body hw-fit" data-panel="now">
        <div class="hw-fill mem-pages" id="now-pages">
          <div>
            <span class="hw-label" id="eyebrow"></span>
            <h2 class="hw-title mem-gap-sm" id="lesson-title"></h2>
            <p class="hw-text mem-gap-sm" id="lesson-body"></p>
          </div>
          <div>
            <span class="hw-label" id="event-title"></span>
            <p class="hw-text mem-gap-sm" id="event-body" aria-live="polite"></p>
          </div>
          <div><div class="hw-note hw-note--accent" id="insight"></div></div>
        </div>
        <div class="mem-side-foot">
          <button class="hw-key" data-action="predict">다음 접근 맞혀보기 →</button>
          <button class="hw-key hw-key--accent" data-action="compare" id="conclusion">전체 결과 비교 →</button>
          <div class="hw-pager" id="now-pager"></div>
        </div>
      </div>
      <div class="hw-plate-body hw-fit" data-panel="frames" hidden>
        <span class="hw-label">지금 RAM의 프레임</span>
        <span class="hw-label hw-muted mem-frames-note" id="frames-note"></span>
        <ul class="hw-list hw-fill mem-gap-sm" id="frame-list"></ul>
      </div>
      <div class="hw-plate-body hw-fit" data-panel="scenes" hidden>
        <span class="hw-label">핵심 장면으로 이동 <span class="hw-muted" id="lesson-progress"></span></span>
        <div class="hw-list hw-fill mem-gap-sm" id="milestones"></div>
      </div>
      <div class="hw-plate-body hw-fit" data-panel="rules" hidden>
        <span class="hw-label">이 실험의 규칙과 용어</span>
        <dl class="hw-list hw-fill mem-gap-sm mem-rules" id="rules">
          <div><dt>가상 주소</dt><dd>프로그램이 보는 주소. 실제 RAM 위치와 따로 매겨집니다.</dd></div>
          <div><dt>페이지</dt><dd>가상 주소 공간을 같은 크기로 나눈 단위. A~E 다섯 개</dd></div>
          <div><dt>프레임</dt><dd>RAM을 같은 크기로 나눈 칸. F0~F2</dd></div>
          <div><dt>페이지 테이블</dt><dd>페이지마다 상주 여부와 프레임 번호를 적은 표</dd></div>
          <div><dt>MMU</dt><dd>주소 변환 장치. 접근마다 페이지 테이블로 가상 주소를 RAM 주소로 바꿉니다.</dd></div>
          <div><dt>상주·미상주</dt><dd>페이지가 지금 RAM 프레임에 있으면 상주, 없으면 미상주(—)</dd></div>
          <div><dt>적중</dt><dd>상주 페이지에 접근. 운영체제 없이 MMU만으로 끝납니다.</dd></div>
          <div><dt>페이지 부재</dt><dd>page fault. 미상주 페이지에 접근해 운영체제가 저장장치에서 읽어 옵니다.</dd></div>
          <div><dt>부재 비용</dt><dd>RAM 접근은 약 100ns, 저장장치 읽기는 SSD 수십 µs 이상·HDD 수 ms. 그동안 프로세스는 기다립니다.</dd></div>
          <div><dt>강제 부재</dt><dd>초기 부재(cold miss). 빈 RAM을 처음 채울 때의 부재로, 교체가 없습니다.</dd></div>
          <div><dt>교체</dt><dd>빈 프레임이 없을 때 한 페이지를 내보내고 그 프레임을 재사용하는 일</dd></div>
          <div><dt>적중률</dt><dd>적중 횟수 ÷ 전체 접근 횟수</dd></div>
          <div><dt>FIFO</dt><dd>${RULES.fifo}</dd></div>
          <div><dt>LRU</dt><dd>${RULES.lru}</dd></div>
          <div><dt>LRU 근사</dt><dd>실제로는 접근 순서 대신 참조 비트만 기록되고, 운영체제가 클럭 알고리즘 등으로 근사합니다. 이 화면은 정확한 LRU입니다.</dd></div>
          <div><dt>OPT(MIN)</dt><dd>앞으로 가장 늦게 쓰일 페이지를 내보내는 이론상 최적 정책. 미래를 알아야 해 기준선으로만 씁니다.</dd></div>
          <div><dt>시작</dt><dd>RAM 프레임 3개는 처음에 모두 비어 있습니다.</dd></div>
          <div><dt>원본</dt><dd>A~E는 저장장치(SSD)에 원본이 있는 읽기 전용 페이지입니다.</dd></div>
          <div><dt>빈 칸</dt><dd>빈 프레임이 있으면 교체 없이 적재합니다.</dd></div>
          <div><dt>쓰기</dt><dd>내보내는 사본은 수정되지 않아 저장장치에 다시 쓰지 않습니다.</dd></div>
          <div><dt>범위</dt><dd>TLB·수정 페이지·실제 지연 시간은 다루지 않습니다. 1단계는 1번의 접근입니다.</dd></div>
        </dl>
      </div>
    </aside>

    <section class="hw-plate hw-records" aria-label="관찰 기록">
      <div class="hw-plate-head">
        <div class="hw-tabs" role="tablist" aria-label="관찰 기록">
          <button role="tab" id="tab-history" aria-controls="record-history" aria-selected="true" data-record="history">프레임 기록</button>
          <button role="tab" id="tab-events" aria-controls="record-events" aria-selected="false" data-record="events" tabindex="-1">접근 기록 <span class="hw-mono hw-muted" id="event-count"></span></button>
          <button role="tab" id="tab-results" aria-controls="record-results" aria-selected="false" data-record="results" tabindex="-1">정책별 누적</button>
        </div>
        <span class="hw-label mem-hide-sm">기록을 눌러 그 접근으로 이동</span>
      </div>
      <div class="hw-plate-body hw-scroll" id="record-history" role="tabpanel" aria-labelledby="tab-history"></div>
      <div class="hw-plate-body hw-scroll mem-events-box" id="record-events" role="tabpanel" aria-labelledby="tab-events" hidden>
        <p class="hw-text hw-muted" id="events-empty">페이지에 접근하면 판정과 교체 근거가 기록됩니다.</p>
        <table class="hw-table" id="events-table"><thead><tr><th>접근</th><th>페이지</th><th>판정</th><th>프레임</th><th>교체</th><th>이번 접근의 근거</th></tr></thead><tbody id="events-body"></tbody></table>
      </div>
      <div class="hw-plate-body hw-scroll" id="record-results" role="tabpanel" aria-labelledby="tab-results" hidden></div>
    </section>
  </main>

  <footer class="hw-footer">
    <span>조작: <kbd>Space</kbd> 재생·정지 <kbd>←</kbd><kbd>→</kbd> 접근 이동 <kbd>R</kbd> 처음으로</span>
    <span>학습 근거 <a href="https://pages.cs.wisc.edu/~remzi/OSTEP/vm-beyondphys.pdf" target="_blank" rel="noreferrer">OSTEP 21장 ↗</a> · <a href="https://pages.cs.wisc.edu/~remzi/OSTEP/vm-beyondphys-policy.pdf" target="_blank" rel="noreferrer">22장 ↗</a></span>
  </footer>

  <dialog class="hw-dialog" id="prediction-dialog" aria-labelledby="prediction-title"></dialog>
  <dialog class="hw-dialog" id="comparison-dialog" aria-labelledby="comparison-title"></dialog>
</div>`;

const app = $(".hw-page");
// Nothing scrolls on a desktop console: the side panel is tabbed, long
// content is split into pages and the event log shows a window of rows.
const sidePanel = plateTabs($(".hw-side"));
const nowPager = paginate($("#now-pages"), { label: "해설", pager: $("#now-pager") });
const framesPager = paginate($("#frame-list"), { label: "프레임" });
const scenePager = paginate($("#milestones"), { label: "장면" });
paginate($("#rules"), { label: "규칙" });
const eventsWindow = rowWindow($("#record-events"), $("#events-body"), { current: () => $("#events-body tr[aria-current]") });
let nowText = "",
  shownChapter = null;
// Changed explanation text starts again on its first page.
function refreshNow() {
  const text = $("#now-pages").textContent;
  nowPager.refresh();
  if (text !== nowText) nowPager.show(0);
  nowText = text;
}
const scene = createMemoryScene($("#memory-scene"), {
  onPhase(phase) {
    renderStages(phase.kind);
    $("#status-text").textContent = phase.title;
    $("#status-led").dataset.kind = phase.kind;
    $("#status-led").classList.toggle("is-on", phase.kind !== "ready");
    if (busy) {
      $("#event-title").textContent = `${index}번째 접근 · 처리 중`;
      $("#event-body").textContent = phase.body;
      refreshNow();
    }
  },
});

/* ---------- Rendering ---------- */

function renderStages(kind = "ready") {
  const step = run().steps[index];
  const position = { ready: -1, lookup: 0, hit: 1, miss: 1, select: 2, evict: 2, load: 3, retry: 4, read: 4, access: 5 }[kind];
  const decided = position >= 1 && step.index;
  $("#stages").innerHTML = STAGES.map((label, i) => {
    const text = i === 1 && decided ? (step.hit ? "적중" : "부재") : i === 4 && kind === "retry" ? "재시도" : label;
    const skipped = decided && step.hit && (i === 2 || i === 3);
    const state = skipped ? "is-skipped" : i === position ? "is-active" : i < position ? "is-done" : "";
    return `<li class="${state}"${i === position ? ' aria-current="step"' : ""}><span class="hw-led${i === position ? " is-on" : ""}"></span>${text}${skipped ? '<span class="visually-hidden"> (생략)</span>' : ""}</li>`;
  }).join("");
}

function renderControls() {
  const moving = playing || (busy && !motionPaused);
  const play = $('[data-action="play"]');
  play.innerHTML = `${icon(moving ? "pause" : "play")}${moving ? "일시정지" : index === TOTAL && !busy ? "다시 재생" : index === 0 ? "학습 시작" : "이어서 재생"}`;
  play.setAttribute("aria-label", moving ? "일시정지" : "재생");
  $('[data-action="back"]').disabled = index === 0;
  $('[data-action="next"]').disabled = busy || index === TOTAL;
  $('[data-action="replay"]').disabled = index === 0 || busy;
  $('[data-action="guided"]').setAttribute("aria-checked", String(guided));
  $("#memory-scene").setAttribute("aria-busy", String(busy));
}

function render() {
  const step = current();
  const lesson = describeStep(run().steps[busy && index < TOTAL ? index : committed], run());
  const seek = $("#seek");
  seek.value = index;
  seek.setAttribute("aria-valuetext", `${index}번의 페이지 접근, 전체 ${TOTAL}번`);
  syncSlider(seek);

  $("#lcd-step").innerHTML = `${String(index).padStart(2, "0")}<small>/ ${TOTAL} 접근</small>`;
  $("#lcd-counts").innerHTML = `${step.faults}<small>부재</small> ${step.hits}<small>적중</small>`;

  document.querySelectorAll("[data-algorithm]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.algorithm === algorithm)));
  $("#sequence").innerHTML = REFERENCE_STRING.map(
    (page, i) =>
      `<button data-seek="${i + 1}" aria-pressed="${i + 1 === index}" class="${i < committed ? "is-visited" : ""}" style="--pg:${pageColor(page)}" aria-label="${i + 1}번째, 페이지 ${page} 접근 후로 이동"><small>${i + 1}</small><b>${page}</b></button>`,
  ).join("");

  $("#eyebrow").textContent = busy ? `${index} / ${TOTAL}번째 접근 · 처리 중 · ${policyName(algorithm)}` : lesson.eyebrow;
  $("#lesson-title").textContent = lesson.title;
  $("#lesson-body").textContent = busy
    ? `페이지 ${run().steps[index].page}의 테이블 항목과 프레임을 확인하세요. CPU가 값을 돌려받으면 이번 접근이 끝납니다.`
    : lesson.body;
  if (!busy) {
    $("#event-title").textContent = lesson.eventTitle;
    $("#event-body").textContent = lesson.eventBody;
  }
  $("#insight").textContent = lesson.insight;

  const occupied = step.frames.filter((frame) => frame.page !== null);
  const key = algorithm === "fifo" ? "loadedAt" : "lastUsedAt";
  $("#frames-note").textContent = busy ? "직전 접근 기준" : algorithm === "fifo" ? "적재 번호가 가장 작은 페이지가 다음 교체" : "최근 접근 번호가 가장 작은 페이지가 다음 교체";
  $("#frame-list").innerHTML = occupied.length
    ? occupied
        .map(
          (f) =>
            `<li><span class="hw-label mem-slot-id">F${f.slot}</span>${chipFor(f.page)}<span class="mem-frame-nums"><span class="${key === "loadedAt" ? "is-key" : ""}">적재 <b class="hw-mono">${f.loadedAt}</b></span><span class="${key === "lastUsedAt" ? "is-key" : ""}">최근 접근 <b class="hw-mono">${f.lastUsedAt}</b></span></span></li>`,
        )
        .join("")
    : '<li class="hw-muted">RAM이 비어 있습니다.</li>';

  const nextQuiz = !busy && run().steps[index + 1] ? predictionFor(run().steps[index + 1], run()) : null;
  const showPredict = Boolean(nextQuiz);
  if (nextQuiz) $('[data-action="predict"]').textContent = nextQuiz.kind === "outcome" ? "적중일까 부재일까 맞혀보기 →" : "다음 교체 맞혀보기 →";
  const showConclusion = index === TOTAL && !busy;
  $('[data-action="predict"]').hidden = !showPredict;
  $("#conclusion").hidden = !showConclusion;

  const milestones = buildMilestones(run());
  const chapter = milestones.findIndex((m) => m.index === lesson.chapterId);
  $("#lesson-progress").textContent = `· ${Math.max(0, chapter) + 1} / ${milestones.length}`;
  $("#milestones").innerHTML = milestones
    .map(
      (m, i) =>
        `<button data-seek="${m.index}"${i === chapter ? ' aria-current="true"' : ""}><span class="hw-index">${String(i + 1).padStart(2, "0")}</span>${m.title}<span class="hw-mono hw-muted mem-end">${m.index === 0 ? "시작" : `${m.index}번째`}</span></button>`,
    )
    .join("");
  $("#milestones").setAttribute("aria-label", milestones.map((m, i) => `${i + 1}. ${MILESTONE_SHORT[i]}`).join(", "));
  scenePager.refresh();
  if (chapter !== shownChapter) scenePager.showItem($("#milestones").children[(shownChapter = chapter) < 0 ? 0 : chapter]);
  framesPager.refresh();
  refreshNow();

  if (!busy) renderStages(index ? "access" : "ready");
  renderRecords();
  renderControls();
}

function renderRecords() {
  const steps = run().steps;
  const head = REFERENCE_STRING.map(
    (_, i) => `<th${i + 1 === committed ? ' aria-current="true"' : ""}><button class="mem-col-key" data-seek="${i + 1}" aria-label="${i + 1}번째 접근으로 이동">${i + 1}</button></th>`,
  ).join("");
  const row = (label, cell) =>
    `<tr><th scope="row">${label}</th>${REFERENCE_STRING.map((page, i) => {
      const s = i < committed ? steps[i + 1] : null;
      return `<td data-seek="${i + 1}" class="${i + 1 === committed ? "is-current" : ""} ${s ? "" : "is-future"}">${cell(s, page)}</td>`;
    }).join("")}</tr>`;
  $("#record-history").innerHTML = `<table class="hw-table mem-history">
    <thead><tr><th>접근</th>${head}</tr></thead>
    <tbody>
      ${row("요청", (s, page) => (s ? chipFor(page) : `<span class="hw-mono hw-muted">${page}</span>`))}
      ${[0, 1, 2].map((slot) => row(`F${slot}`, (s) => (s ? (s.frames[slot].page ? `<span class="${s.frameIndex === slot && s.fault ? "mem-new" : ""}">${chipFor(s.frames[slot].page)}</span>` : chipFor(null)) : ""))).join("")}
      ${row("결과", (s) => (s ? outcome(s) : ""))}
    </tbody></table>`;

  $("#event-count").textContent = `${committed}`;
  $("#events-empty").hidden = committed > 0;
  $("#events-table").hidden = committed === 0;
  $("#events-body").innerHTML = steps
        .slice(1, committed + 1)
        .map(
          (s) =>
            `<tr data-seek="${s.index}"${s.index === committed ? ' aria-current="true"' : ""}><td class="hw-mono"><button class="mem-row-key" data-seek="${s.index}" aria-label="${s.index}번째 접근으로 이동">${s.index}번째</button></td><td>${chipFor(s.page)}</td><td>${outcome(s)}</td><td class="hw-mono">F${s.frameIndex}</td><td class="hw-mono">${s.victim ? `${s.victim} → ${s.page}` : "—"}</td><td>${s.hit ? "이미 상주" : !s.victim ? "빈 프레임" : algorithm === "fifo" ? `가장 이른 적재 · ${s.before[s.frameIndex].loadedAt}번째` : `가장 오래된 접근 · ${s.before[s.frameIndex].lastUsedAt}번째`}</td></tr>`,
        )
        .join("");
  eventsWindow.refresh();

  const at = committed;
  $("#record-results").innerHTML = `<table class="hw-table">
    <thead><tr><th>정책</th><th>처리한 접근</th><th>페이지 부재</th><th>적중</th><th>페이지 교체</th><th>적중률</th></tr></thead>
    <tbody>${Object.entries(runs)
      .map(([name, r]) => {
        const s = r.steps[at];
        return `<tr${name === algorithm ? ' aria-current="true"' : ""}><td><b>${policyName(name)}</b></td><td class="hw-mono">${s.index}회</td><td class="hw-mono">${s.faults}회</td><td class="hw-mono">${s.hits}회</td><td class="hw-mono">${s.replacements}회</td><td class="hw-mono">${s.index ? `${Math.round((s.hits / s.index) * 100)}%` : "—"}</td></tr>`;
      })
      .join("")}</tbody></table>
    <p class="hw-text hw-muted mem-gap-md">${at ? `${at}번째 접근까지 같은 순서를 두 정책에 적용한 결과입니다. ${policyName(algorithm)}의 부재 ${current().faults}회 중 ${current().faults - current().replacements}회는 빈 프레임에 적재했습니다.` : "첫 접근 전에는 적중률을 계산하지 않습니다."} 부재와 교체는 같은 횟수가 아닙니다.</p>`;
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
  await scene.update(run().steps[target], previous, { animate: sequential, speed, paused: startPaused, algorithm });
  if (token !== revision) return;
  busy = false;
  committed = target;
  motionPaused = false;
  render();
  if (target === TOTAL || (guided && buildMilestones(run()).some((m) => m.index === target))) playing = false;
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
  quiz = predictionFor(run().steps[index + 1], run());
  if (!quiz) return;
  pause();
  $("#prediction-dialog").innerHTML = `${dialogHead("다음 접근을 먼저 예측하기", "prediction-dialog")}
    <div class="hw-plate-body">
      <span class="hw-label"><span class="hw-index">${policyName(algorithm)}</span> ${quiz.atIndex}번째 접근</span>
      <h2 class="hw-title mem-gap-sm" id="prediction-title">${quiz.question}</h2>
      <p class="hw-text hw-muted mem-gap-sm">${quiz.rule}</p>
      <p class="hw-label mem-gap-sm mem-history-line">지금까지의 접근 · ${quiz.history.map((page, i) => `<span class="hw-mono">${i + 1}</span>${chipFor(page)}`).join(" ")}</p>
      <div class="hw-list mem-gap-md mem-choices">${quiz.choices
        .map((c) => `<button data-answer="${c.id}">${quiz.kind === "outcome" ? `<span class="mem-outcome ${c.id === "hit" ? "is-hit" : "is-fault"}"><span class="hw-led is-on"></span></span>` : chipFor(c.id)}<span class="mem-choice-text"><span>${c.label}</span><span class="hw-label" data-detail="${c.detail}">${quiz.kind === "outcome" ? c.detail : `F${c.slot}`}</span></span><span class="mem-verdict mem-end"></span></button>`)
        .join("")}</div>
      <div id="prediction-feedback" class="mem-gap-md" aria-live="polite"></div>
      <div class="mem-dialog-actions"><button class="hw-key hw-key--accent" data-action="reveal" hidden>실제 ${quiz.kind === "outcome" ? "접근" : "교체"}을 보며 확인 →</button></div>
    </div>`;
  $("#prediction-dialog").showModal();
}
function answer(id) {
  document.querySelectorAll("[data-answer]").forEach((b) => {
    b.disabled = true;
    const correct = b.dataset.answer === quiz.correctId;
    const wrong = b.dataset.answer === id && !correct;
    b.classList.toggle("is-correct", correct);
    b.classList.toggle("is-wrong", wrong);
    b.querySelector(".mem-verdict").textContent = correct ? "정답" : wrong ? "선택" : "";
    // The evidence (load and last-access order) is shown once the learner has committed.
    const detail = b.querySelector("[data-detail]");
    detail.textContent = detail.dataset.detail;
  });
  $("#prediction-feedback").innerHTML = `<div class="hw-note ${id === quiz.correctId ? "hw-note--accent" : ""}"><p class="hw-text"><b>${id === quiz.correctId ? "맞았습니다." : quiz.kind === "outcome" ? `실제로는 ${quiz.correctId === "hit" ? "적중" : "부재"}입니다.` : `다음 교체 대상은 ${quiz.correctId}입니다.`}</b> ${quiz.explanation}</p></div>`;
  $('[data-action="reveal"]').hidden = false;
  $('[data-action="reveal"]').focus();
}

function showComparison() {
  pause();
  const opt = countFaults(REFERENCE_STRING, 3, "opt");
  $("#comparison-dialog").innerHTML = `${dialogHead(`같은 ${TOTAL}번의 접근 · 같은 3개 프레임`, "comparison-dialog")}
    <div class="hw-plate-body">
      <span class="hw-label">전체 실행 결과</span>
      <h2 class="hw-title mem-gap-sm" id="comparison-title">기준 하나가 다음 적중을 바꿉니다</h2>
      ${Object.entries(runs)
        .map(
          ([name, r]) => `<div class="hw-section mem-compare">
            <div class="mem-compare-head">
              <span class="hw-label"><span class="hw-index">${policyName(name)}</span> ${name === "fifo" ? "먼저 적재된 페이지부터" : "오래 사용하지 않은 페이지부터"}</span>
              <span class="hw-lcd">${r.stats.faults}<small>부재</small> ${r.stats.hits}<small>적중</small> ${r.stats.replacements}<small>교체</small></span>
            </div>
            <ol class="mem-trace" aria-label="${policyName(name)} 접근별 결과">${r.steps
              .slice(1)
              .map((s) => `<li class="${s.hit ? "is-hit" : "is-fault"}" title="${s.index}번째 ${s.page}: ${s.hit ? "적중" : "부재"}">${chipFor(s.page)}<span class="hw-led is-on"></span><span class="visually-hidden">${s.hit ? "적중" : "부재"}</span></li>`)
              .join("")}</ol>
          </div>`,
        )
        .join("")}
      <div class="hw-section">
        <p class="hw-text"><b>갈림길은 4번째 A 적중입니다.</b> FIFO는 A의 최초 적재 순서를 유지하고, LRU는 A의 마지막 접근을 4번째로 기록합니다. 5번째 D를 넣을 때 FIFO는 A, LRU는 B를 내보내므로 6번째 A 접근이 각각 부재와 적중으로 갈립니다.</p>
        <p class="hw-text hw-muted mem-gap-sm">이 접근 순서에서는 LRU의 부재가 ${runs.fifo.stats.faults - runs.lru.stats.faults}회 적습니다. 기준선인 OPT(MIN)는 부재 ${opt.faults}회입니다. 모든 접근 순서에서 같은 차이가 나는 것은 아니며, 이 화면은 실제 실행 시간을 측정하지 않습니다.</p>
        <p class="mem-legend hw-label mem-gap-sm"><span class="mem-outcome is-hit"><span class="hw-led is-on"></span>적중</span><span class="mem-outcome is-fault"><span class="hw-led is-on"></span>부재</span></p>
      </div>
      <div class="mem-dialog-actions"><button class="hw-key hw-key--accent" data-action="turning-point">4번째 접근으로 돌아가 비교 →</button></div>
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
  if (target.dataset.close) return $("#" + target.dataset.close).close();
  if (target.dataset.answer) return answer(target.dataset.answer);
  if (target.dataset.record) return selectRecord(target.dataset.record);
  if (target.dataset.seek !== undefined) {
    if (target.closest("#milestones")) sidePanel.select("now");
    pause();
    await navigate(Number(target.dataset.seek));
    return;
  }
  if (target.dataset.algorithm) {
    if (target.dataset.algorithm === algorithm) return;
    algorithm = target.dataset.algorithm;
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
      await navigate(4);
      break;
  }
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
  if (document.querySelector("dialog[open]") || event.target.matches("input,button,select,textarea,summary")) return;
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
render();
scene.update(current(), null, { animate: false, algorithm });
