import "./styles.css";
import { REFERENCE_STRING, simulate } from "./engine.js";
import { describeStep, predictionFor, buildMilestones } from "./lesson.js";
import { createMemoryScene } from "./scene.js";

const $ = (selector) => document.querySelector(selector);
const runs = {
  fifo: simulate({ algorithm: "fifo" }),
  lru: simulate({ algorithm: "lru" }),
};
let algorithm = "fifo",
  index = 0,
  committed = 0,
  speed = 1,
  playing = false,
  busy = false,
  motionPaused = false,
  guided = true,
  revision = 0,
  timer = null,
  selectedRecord = "history",
  quiz = null;
const badge = (page, extra = "") =>
  `<b class="page-id ${page?.toLowerCase() || ""} ${extra}">${page || "—"}</b>`;
const icons = {
  play: '<path d="m8 5 11 7-11 7z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  reset: '<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  next: '<path d="m9 5 7 7-7 7"/>',
  moon: '<path d="M20 14a8 8 0 0 1-10-10 8 8 0 1 0 10 10Z"/>',
  compare: '<path d="M4 4v16h16M8 15V9M13 15V5M18 15v-4"/>',
  memory:
    '<rect x="3" y="6" width="18" height="12" rx="1"/><path d="M7 10v4M12 10v4M17 10v4M6 3v3m6-3v3m6-3v3M6 18v3m6-3v3m6-3v3"/>',
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const run = () => runs[algorithm];
const current = () => run().steps[committed];
$("#app").innerHTML = `
<header class="app-header"><div class="brand-icon">${icon("memory")}</div><div><h1>메모리 탐색기</h1><p>보면서 이해하는 운영체제</p></div><div class="scenario-heading"><small>대표 시나리오 02</small><strong>같은 접근, 다른 교체</strong></div><div class="header-actions"><button class="button" data-action="compare">${icon("compare")}<span>FIFO · LRU 비교</span></button><button class="button icon-button" data-action="theme" aria-label="어두운 테마로 전환">${icon("moon")}</button></div></header>
<main class="workspace">
<aside class="panel setup-panel"><button class="panel-head setup-toggle" data-action="setup" aria-expanded="true" aria-controls="setup-content"><h2>실험 조건</h2><span>3개의 프레임 ⌄</span></button><div id="setup-content" class="setup-content">
<div class="section-label">페이지 교체 방식</div><div class="algorithm-toggle" role="group" aria-label="페이지 교체 방식"><button data-algorithm="fifo" aria-pressed="true">FIFO</button><button data-algorithm="lru" aria-pressed="false">LRU</button></div><p id="rule-summary" class="rule-summary"></p>
<div class="section-label">고정된 접근 순서 <b>10회</b></div><div class="reference-sequence" id="reference-sequence"></div><p class="help">번호를 누르면 그 접근까지 처리한 상태를 봅니다.</p>
<div class="order-heading"><h3>프레임별 접근 기록</h3><span>프레임 번호순</span></div><div id="replacement-order" class="replacement-order"></div><p id="order-help" class="help"></p>
<div class="concept-pair"><div><b>페이지</b><span>프로그램이 사용하는 메모리 단위</span></div><div><b>프레임</b><span>페이지 한 개가 들어가는 RAM 자리</span></div></div>
<details class="model-notes"><summary>이 실험의 규칙</summary><ul><li>RAM 프레임은 3개이며 처음에는 모두 비어 있습니다.</li><li>A~E는 디스크에 원본이 있는 읽기 전용 페이지입니다.</li><li>빈 프레임이 있으면 교체 없이 적재합니다.</li><li>내보내는 RAM 사본은 수정되지 않았으므로 디스크에 다시 쓰지 않습니다.</li><li>TLB·수정 페이지·실제 지연 시간은 다루지 않습니다. 1단계는 1번의 페이지 접근입니다.</li></ul></details>
</div></aside>
<section class="panel scene-panel"><div class="panel-head"><h2>페이지가 RAM에 들어오는 과정</h2><b class="step-clock"><span id="step-count">0</span><small>/ 10 접근</small></b></div><ol class="process-strip" id="process-strip" aria-label="한 번의 페이지 접근 과정"></ol><div id="memory-scene"></div><div class="scene-summary"><strong id="access-summary"></strong><button class="replay-access" data-action="replay" title="이번 접근을 처음부터 다시 재생">↻ 다시 보기</button><span id="counts-summary"></span></div><div class="transport"><div class="learning-mode"><button role="switch" aria-checked="true" data-action="guided"><i></i>핵심 장면에서 멈추기</button><span id="playback-hint"></span></div><div class="playback-buttons"><button class="button icon-button" data-action="reset" aria-label="처음으로">${icon("reset")}</button><button class="button icon-button" data-action="back" aria-label="이전 접근">${icon("back")}</button><button class="button primary play-button" data-action="play">${icon("play")}<span>학습 시작</span></button><button class="button" data-action="next">다음 접근 ${icon("next")}</button><button class="button speed-button" data-action="speed" aria-label="재생 속도 변경">1×</button></div><div class="seek-row"><span>0</span><input id="seek" type="range" min="0" max="10" step="1" value="0" aria-label="처리한 페이지 접근 수"/><span>10</span></div></div></section>
<aside class="panel lesson-panel"><div class="panel-head"><h2>단계 해설</h2><span id="lesson-progress"></span></div><nav id="milestones" aria-label="핵심 학습 장면"></nav><div class="lesson-content"><div id="explanation"></div><div class="event-card"><div class="event-card-head"><strong id="event-title"></strong><span id="event-index"></span></div><p id="event-body" aria-live="polite"></p></div><div class="insight"><b>!</b><p id="insight"></p></div><button class="button prediction-button" data-action="predict" hidden>다음 교체, 먼저 맞혀보기 →</button><button class="button primary conclusion-button" data-action="compare" hidden>두 방식의 전체 결과 비교 →</button></div></aside>
<section class="panel records-panel"><div class="record-tabs" role="tablist" aria-label="관찰 기록"><button role="tab" id="tab-history" aria-controls="record-history" aria-selected="true" data-record="history">프레임 기록</button><button role="tab" id="tab-events" aria-controls="record-events" aria-selected="false" data-record="events" tabindex="-1">접근 기록 <span id="event-count"></span></button><button role="tab" id="tab-results" aria-controls="record-results" aria-selected="false" data-record="results" tabindex="-1">누적 결과</button><span class="record-hint">기록을 눌러 그 접근으로 이동</span></div><section id="record-history" role="tabpanel" aria-labelledby="tab-history"><div class="history-legend"><span>각 접근을 처리한 뒤의 RAM</span><span><i class="hit-mark"></i>적중 <i class="fault-mark"></i>부재</span></div><div class="history-wrap" id="frame-history"></div></section><section id="record-events" role="tabpanel" aria-labelledby="tab-events" hidden><div id="access-log" class="access-log"></div></section><section id="record-results" role="tabpanel" aria-labelledby="tab-results" hidden><div id="result-metrics"></div></section></section>
</main><footer><span>조작: <kbd>Space</kbd> 재생·정지 <kbd>←</kbd><kbd>→</kbd> 접근 이동 <kbd>R</kbd> 처음으로</span><span>학습 근거 <a href="https://pages.cs.wisc.edu/~remzi/OSTEP/vm-beyondphys.pdf" target="_blank" rel="noreferrer">OSTEP 21장 ↗</a> · <a href="https://pages.cs.wisc.edu/~remzi/OSTEP/vm-beyondphys-policy.pdf" target="_blank" rel="noreferrer">22장 ↗</a></span></footer>
<dialog id="prediction-dialog" aria-labelledby="prediction-title"></dialog><dialog id="comparison-dialog" aria-labelledby="comparison-title"></dialog>`;

const scene = createMemoryScene($("#memory-scene"), {
  onPhase(phase) {
    renderProcess(phase.kind);
    $("#event-title").textContent = phase.title;
    $("#event-body").textContent = phase.body;
    $("#event-index").textContent = index ? `${index}번째 접근` : "시작 전";
  },
});

function renderProcess(kind = "ready") {
  const step = run().steps[index];
  const position = {
    ready: -1,
    lookup: 0,
    hit: 1,
    miss: 1,
    select: 2,
    evict: 2,
    load: 3,
    retry: 4,
    read: 4,
    access: 4,
  }[kind];
  const decided = position >= 1;
  const labels = [
    "조회",
    decided && step.index ? (step.hit ? "적중" : "부재") : "판정",
    "프레임 선택",
    "SSD 적재",
    ({ retry: "접근 재시도", read: "값 전달 중", access: "접근 완료" })[kind] || "CPU 읽기",
  ];
  $("#process-strip").innerHTML = labels
    .map((label, i) => {
      const skipped = decided && step.hit && (i === 2 || i === 3);
      const active = i === position;
      return `<li class="${skipped ? "skipped" : active ? "active" : i < position ? "done" : ""}" ${active ? 'aria-current="step"' : ""}><b>${skipped ? "—" : i < position ? "✓" : i + 1}</b><span>${label}${skipped ? "<small>생략</small>" : ""}</span></li>`;
    })
    .join("");
}
function renderControls() {
  const moving = playing || (busy && !motionPaused);
  $('[data-action="play"]').innerHTML =
    `${icon(moving ? "pause" : "play")}<span>${moving ? "일시정지" : index === 10 ? "다시 재생" : index === 0 ? "학습 시작" : "이어서 재생"}</span>`;
  $('[data-action="play"]').setAttribute(
    "aria-label",
    moving ? "일시정지" : "재생",
  );
  $('[data-action="back"]').disabled = index === 0;
  $('[data-action="next"]').disabled = busy || index === REFERENCE_STRING.length;
  $('[data-action="replay"]').disabled = index === 0 || busy;
  $('[data-action="guided"]').setAttribute("aria-checked", String(guided));
  $("#memory-scene").setAttribute("aria-busy", String(busy));
  $("#playback-hint").textContent = busy
    ? motionPaused
      ? "이동을 멈췄습니다."
      : "한 접근 안의 사건을 순서대로 보여 줍니다."
    : index === 10
      ? "10번의 접근 완료 · 결과를 비교해 보세요."
      : playing
        ? "다음 접근을 준비합니다."
        : guided
          ? "핵심 장면을 읽고 이어서 재생하세요."
          : "전체 과정을 연속으로 재생합니다.";
}
function render() {
  const step = current(),
    lesson = describeStep(
      run().steps[busy && index < 10 ? index : committed],
      run(),
    );
  $("#step-count").textContent = index;
  $("#seek").value = index;
  $("#seek").setAttribute(
    "aria-valuetext",
    `${index}번의 페이지 접근, 전체 10번`,
  );
  document
    .querySelectorAll("[data-algorithm]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.algorithm === algorithm)),
    );
  $("#rule-summary").innerHTML =
    algorithm === "fifo"
      ? "<b>가장 먼저 들어온 페이지</b>를 내보냅니다. 적중해도 적재 순서는 바뀌지 않습니다."
      : "<b>가장 오래 사용하지 않은 페이지</b>를 내보냅니다. 적중하면 최근 사용 순서를 갱신합니다.";
  $("#reference-sequence").innerHTML = REFERENCE_STRING.map(
    (page, i) =>
      `<button data-seek="${i + 1}" class="reference ${i < committed ? "visited" : ""} ${i + 1 === index ? "current" : ""}" aria-label="${i + 1}번째, 페이지 ${page} 접근 후로 이동"><small>${i + 1}</small>${badge(page)}</button>`,
  ).join("");
  const occupied = step.frames.filter((frame) => frame.page !== null);
  $("#replacement-order").innerHTML = occupied.length
    ? occupied
        .map((f) => `<div class="order-item"><small>F${f.slot}</small>${badge(f.page)}<span>적재 <b>${f.loadedAt}번째</b></span><span>최근 접근 <b>${f.lastUsedAt}번째</b></span></div>`)
        .join("")
    : '<p class="empty-note">RAM이 비어 있습니다.</p>';
  $("#order-help").textContent = busy
    ? "직전 접근 완료 기준입니다. 이번 접근을 마치면 갱신됩니다."
    : algorithm === "fifo"
      ? "FIFO는 적재 차례를 비교합니다. 가장 작은 수를 찾아보세요."
      : "LRU는 최근 접근 차례를 비교합니다. 가장 작은 수를 찾아보세요.";
  $("#access-summary").innerHTML = busy
    ? "접근 처리 중"
    : step.index === 0
      ? "첫 페이지 A를 기다립니다."
      : `${badge(step.page)} ${step.hit ? "RAM 적중" : "페이지 부재"}${step.victim ? ` · ${step.victim} 교체` : ""}`;
  $("#counts-summary").textContent =
    `부재 ${step.faults} · 적중 ${step.hits} · 교체 ${step.replacements}`;
  const concept = busy
    ? `페이지 ${run().steps[index].page}의 테이블 항목과 프레임을 확인하세요. CPU가 값을 돌려받으면 이번 접근이 끝납니다.`
    : lesson.body;
  $("#explanation").innerHTML =
    `<span class="eyebrow">${busy ? `${index} / 10번째 접근 · 처리 중 · ${algorithm.toUpperCase()}` : lesson.eyebrow}</span><h3>${lesson.title}</h3><p>${concept}</p>`;
  $("#event-title").textContent = lesson.eventTitle;
  $("#event-body").textContent = lesson.eventBody;
  $("#event-index").textContent = step.index
    ? `${step.index}번째 접근`
    : "시작 전";
  $("#insight").textContent = lesson.insight;
  $('[data-action="predict"]').hidden =
    busy || !run().steps[index + 1] || !predictionFor(run().steps[index + 1]);
  $(".conclusion-button").hidden = index !== 10 || busy;
  const milestones = buildMilestones(run());
  const chapter = milestones.findIndex((m) => m.index === lesson.chapterId);
  $("#lesson-progress").textContent =
    `${Math.max(0, chapter) + 1} / ${milestones.length}`;
  $("#milestones").innerHTML = milestones
    .map(
      (m, i) =>
        `<button data-seek="${m.index}" class="milestone ${i === chapter ? "active" : ""}" aria-label="${i + 1}. ${m.title}" ${i === chapter ? 'aria-current="step"' : ""} title="${m.title} · ${m.index === 0 ? "시작" : `${m.index}번째 접근`}"><b>${i + 1}</b><span>${["개념", "빈 칸", "재사용", "교체", "영향", "비교"][i]}</span></button>`,
    )
    .join("");
  if (!busy) renderProcess(index ? "access" : "ready");
  renderRecords();
  renderControls();
}
function renderRecords() {
  const rows = [
    ["요청", (_, i) => badge(REFERENCE_STRING[i])],
    ...Array.from({ length: 3 }, (_, slot) => [
      `프레임 ${slot}`,
      (s) => (s ? badge(s.frames[slot].page) : ""),
    ]),
    [
      "결과",
      (s) =>
        s
          ? `<span class="result-tag ${s.hit ? "hit" : "fault"}">${s.hit ? "적중" : "부재"}</span>`
          : "",
    ],
  ];
  $("#frame-history").innerHTML =
    `<table class="history-table"><thead><tr><th>접근</th>${REFERENCE_STRING.map((_, i) => `<th class="${i + 1 === committed ? "selected" : ""}"><button data-seek="${i + 1}" aria-label="${i + 1}번째 접근으로 이동">${i + 1}</button></th>`).join("")}</tr></thead><tbody>${rows.map(([label, cell]) => `<tr><th>${label}</th>${REFERENCE_STRING.map((_, i) => `<td class="${i + 1 === committed ? "selected" : ""} ${i >= committed ? "future" : ""}">${cell(i < committed ? run().steps[i + 1] : null, i)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  $("#event-count").textContent = `${committed}회`;
  $("#access-log").innerHTML = committed
    ? `<table class="log-table"><thead><tr><th>접근</th><th>페이지</th><th>판정</th><th>프레임</th><th>교체</th><th>이번 접근의 근거</th></tr></thead><tbody>${run()
        .steps.slice(1, committed + 1)
        .map(
          (s) =>
            `<tr><td><button data-seek="${s.index}">${s.index}번째 ↗</button></td><td>${badge(s.page)}</td><td><span class="result-tag ${s.hit ? "hit" : "fault"}">${s.hit ? "적중" : "부재"}</span></td><td>F${s.frameIndex}</td><td>${s.victim ? `${s.victim} → ${s.page}` : "—"}</td><td>${s.hit ? "이미 상주" : !s.victim ? "빈 프레임" : algorithm === "fifo" ? `가장 이른 적재 · ${s.before[s.frameIndex].loadedAt}번째` : `가장 오래된 접근 · ${s.before[s.frameIndex].lastUsedAt}번째`}</td></tr>`,
        )
        .join("")}</tbody></table>`
    : '<p class="empty-note">페이지에 접근하면 판정과 교체 근거가 기록됩니다.</p>';
  const s = current();
  $("#result-metrics").innerHTML = `<div class="metric-grid">${[
    ["처리한 접근", s.index, "회"],
    ["페이지 부재", s.faults, "회"],
    ["RAM 적중", s.hits, "회"],
    ["페이지 교체", s.replacements, "회"],
  ]
    .map(
      ([label, value, unit]) =>
        `<div><span>${label}</span><strong>${value}<small>${unit}</small></strong></div>`,
    )
    .join(
      "",
    )}</div><p class="metric-explanation">${s.index ? `적중률 ${Math.round((s.hits / s.index) * 100)}% · 부재 ${s.faults}회 중 ${s.faults - s.replacements}회는 빈 프레임에 적재했습니다.` : "첫 접근 전에는 적중률을 계산하지 않습니다."} 부재와 교체는 같은 횟수가 아닙니다.</p>`;
}
function pause() {
  playing = false;
  clearTimeout(timer);
  motionPaused = busy;
  scene.pause();
  renderControls();
}
function schedule() {
  clearTimeout(timer);
  if (playing && !busy)
    timer = setTimeout(() => navigate(index + 1, true), 700 / speed);
}
async function navigate(target, animate = false) {
  clearTimeout(timer);
  const token = ++revision,
    previous = run().steps[committed];
  target = Math.max(0, Math.min(10, target));
  const sequential = animate && target === committed + 1;
  index = target;
  busy = sequential;
  motionPaused = false;
  if (!sequential) committed = target;
  render();
  await scene.update(run().steps[target], previous, {
    animate: sequential,
    duration: 1000 / speed,
  });
  if (token !== revision) return;
  busy = false;
  committed = target;
  motionPaused = false;
  render();
  if (
    target === 10 ||
    (guided && buildMilestones(run()).some((m) => m.index === target))
  )
    playing = false;
  renderControls();
  schedule();
}
async function togglePlay() {
  if (playing || (busy && !motionPaused)) return pause();
  if (index === 10 && !busy) await navigate(0);
  playing = true;
  motionPaused = false;
  scene.resume();
  renderControls();
  if (!busy) schedule();
}
function nextAccess() {
  if (busy || index === REFERENCE_STRING.length) return;
  pause();
  return navigate(index + 1, true);
}
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
function showPrediction() {
  quiz = predictionFor(run().steps[index + 1]);
  if (!quiz) return;
  pause();
  $("#prediction-dialog").innerHTML =
    `<div class="dialog-head"><span>다음 접근을 먼저 예측하기</span><button class="button icon-button" data-close="prediction-dialog" aria-label="닫기">×</button></div><div class="dialog-content"><span class="eyebrow">${algorithm.toUpperCase()} · ${quiz.atIndex}번째 접근</span><h2 id="prediction-title">${quiz.question}</h2><p>${quiz.rule}</p><div class="prediction-choices">${quiz.choices.map((c) => `<button class="button choice" data-answer="${c.id}">${badge(c.id)}<strong>${c.label}</strong><small>${c.detail}</small></button>`).join("")}</div><div id="prediction-feedback" aria-live="polite"></div><button class="button primary" data-action="reveal" hidden>실제 교체를 보며 확인 →</button></div>`;
  $("#prediction-dialog").showModal();
}
function answer(id) {
  document.querySelectorAll("[data-answer]").forEach((b) => {
    b.disabled = true;
    b.classList.toggle("correct", b.dataset.answer === quiz.correctId);
    b.classList.toggle(
      "incorrect",
      b.dataset.answer === id && id !== quiz.correctId,
    );
  });
  $("#prediction-feedback").innerHTML =
    `<strong>${id === quiz.correctId ? "맞았습니다." : "다음 희생자는 " + quiz.correctId + "입니다."}</strong><p>${quiz.explanation}</p>`;
  $('[data-action="reveal"]').hidden = false;
}
function showComparison() {
  pause();
  $("#comparison-dialog").innerHTML =
    `<div class="dialog-head"><span>같은 10번의 접근 · 같은 3개 프레임</span><button class="button icon-button" data-close="comparison-dialog" aria-label="닫기">×</button></div><div class="dialog-content"><span class="eyebrow">전체 실행 결과</span><h2 id="comparison-title">기준 하나가 다음 적중을 바꿉니다</h2><div class="comparison-grid">${Object.entries(
      runs,
    )
      .map(
        ([name, r]) =>
          `<section class="comparison-card"><h3>${name.toUpperCase()}</h3><p>${name === "fifo" ? "먼저 적재된 페이지부터" : "오래 사용하지 않은 페이지부터"}</p><strong class="fault-total">${r.stats.faults}<small>회 부재</small></strong><dl><div><dt>RAM 적중</dt><dd>${r.stats.hits}회</dd></div><div><dt>페이지 교체</dt><dd>${r.stats.replacements}회</dd></div><div><dt>적중률</dt><dd>${Math.round(r.stats.hitRate * 100)}%</dd></div></dl><div class="comparison-trace">${r.steps
            .slice(1)
            .map(
              (s) =>
                `<span class="${s.hit ? "hit" : "fault"}" title="${s.index}번째 ${s.page}: ${s.hit ? "적중" : "부재"}">${s.page}<small>${s.hit ? "적중" : "부재"}</small></span>`,
            )
            .join("")}</div></section>`,
      )
      .join(
        "",
      )}</div><div class="comparison-insight"><strong>갈림길은 4번째 A 적중입니다.</strong><p>FIFO는 A의 최초 적재 순서를 유지합니다. LRU는 A를 가장 최근에 사용한 페이지로 바꿉니다. 5번째 D를 넣을 때 FIFO는 A, LRU는 B를 내보내므로 6번째 A 접근이 각각 부재와 적중으로 갈립니다.</p><p>이 접근 순서에서는 LRU의 부재가 1회 적습니다. 모든 접근 순서에서 항상 같은 차이가 나는 것은 아니며, 이 화면은 실제 실행 시간을 측정하지 않습니다.</p></div><button class="button primary" data-action="turning-point">4번째 접근으로 돌아가 비교 →</button></div>`;
  $("#comparison-dialog").showModal();
}
function changeTheme() {
  const dark = document.documentElement.dataset.theme !== "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  localStorage.setItem("memory-explorer-theme", dark ? "dark" : "light");
  $('[data-action="theme"]').setAttribute(
    "aria-label",
    dark ? "밝은 테마로 전환" : "어두운 테마로 전환",
  );
}
$("#app").addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.close) {
    $("#" + button.dataset.close).close();
    return;
  }
  if (button.dataset.answer) {
    answer(button.dataset.answer);
    return;
  }
  if (button.dataset.record) {
    selectRecord(button.dataset.record);
    return;
  }
  if (button.dataset.seek !== undefined) {
    pause();
    await navigate(Number(button.dataset.seek));
    return;
  }
  if (button.dataset.algorithm) {
    pause();
    algorithm = button.dataset.algorithm;
    await navigate(index);
    return;
  }
  switch (button.dataset.action) {
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
      const target = index;
      pause();
      await navigate(target - 1);
      await navigate(target, true);
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
      button.textContent = speed + "×";
      schedule();
      break;
    case "theme":
      changeTheme();
      break;
    case "setup": {
      const open = button.getAttribute("aria-expanded") !== "true";
      button.setAttribute("aria-expanded", String(open));
      $("#setup-content").hidden = !open;
      break;
    }
    case "predict":
      showPrediction();
      break;
    case "reveal":
      $("#prediction-dialog").close();
      $("#memory-scene").focus({ preventScroll: true });
      $("#memory-scene").scrollIntoView({ block: "center", behavior: "instant" });
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
$(".record-tabs").addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const names = ["history", "events", "results"],
    i = names.indexOf(selectedRecord);
  selectRecord(
    event.key === "Home"
      ? names[0]
      : event.key === "End"
        ? names[2]
        : names[(i + (event.key === "ArrowLeft" ? 2 : 1)) % 3],
    true,
  );
  event.preventDefault();
});
document.addEventListener("keydown", (event) => {
  if (
    document.querySelector("dialog[open]") ||
    event.target.matches("input,button,select,textarea")
  )
    return;
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
  } else if (event.key.toLowerCase() === "r") {
    pause();
    navigate(0);
  }
});
for (const dialog of document.querySelectorAll("dialog"))
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
if (localStorage.getItem("memory-explorer-theme") === "dark") changeTheme();
if (matchMedia("(max-width:1099px)").matches) {
  $('[data-action="setup"]').setAttribute("aria-expanded", "false");
  $("#setup-content").hidden = true;
}
const panelObserver = new ResizeObserver(() =>
  $(".workspace").style.setProperty(
    "--stage-height",
    $(".scene-panel").getBoundingClientRect().height + "px",
  ),
);
panelObserver.observe($(".scene-panel"));
render();
scene.update(current(), null, { animate: false });
