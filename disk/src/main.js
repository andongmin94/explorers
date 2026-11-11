import "./styles.css";
import { simulate, REQUESTS } from "./engine.js";
import { createDiskScene } from "./scene.js";

const $ = (s) => document.querySelector(s);
const runs = { fcfs: simulate("fcfs"), sstf: simulate("sstf") };
let algorithm = "fcfs",
  index = 0,
  committed = 0,
  busy = false,
  paused = false,
  resumeAutomatically = false,
  playing = false,
  guided = true,
  speed = 1,
  timer = null,
  revision = 0,
  record = "path";
const run = () => runs[algorithm],
  current = () => run().steps[committed];
const names = { fcfs: "FCFS · 도착 순서", sstf: "SSTF · 가까운 순서" };
$("#app").innerHTML =
  `<header class="app-header"><div class="brand-icon"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9 16 3l13 6v14l-13 6-13-6Z M3 9l13 6 13-6M16 15v14"/><ellipse cx="16" cy="9" rx="5" ry="2"/></svg></div><div><h1>디스크 스케줄링 탐색기</h1><p>보면서 이해하는 운영체제</p></div><div class="scenario-heading"><small>대표 시나리오 04</small><strong>같은 요청, 다른 이동 거리</strong></div><div class="header-actions"><button class="button" data-action="compare">두 방식 비교</button><button class="button icon-button" data-action="theme" aria-label="어두운 테마로 전환">◐</button></div></header><main class="workspace"><aside class="panel setup-panel"><button class="panel-head setup-toggle" data-action="setup" aria-expanded="true" aria-controls="setup-content"><h2>실험 조건</h2><span>8개 요청 ⌄</span></button><div id="setup-content" class="setup-content"><span class="eyebrow">다음 요청을 고르는 기준</span><div class="mode-toggle" role="group" aria-label="스케줄링 알고리즘"><button data-algorithm="fcfs" aria-pressed="true"><strong>FCFS</strong><span>먼저 도착한 요청부터</span></button><button data-algorithm="sstf" aria-pressed="false"><strong>SSTF</strong><span>현재 헤드에서 가까운 요청부터</span></button></div><p id="rule-summary" class="rule-summary"></p><div class="initial-position"><span>헤드 시작 위치</span><strong>53<small>번 실린더</small></strong></div><div class="section-label">처음 도착한 순서</div><div class="input-list">${REQUESTS.map((n, i) => `<span><small>${i + 1}</small>${n}</span>`).join("")}</div><div class="section-label">한 요청의 세 단계</div><ol class="recipe"><li><b>1</b><span><strong>선택</strong>어떤 요청을 먼저 처리할까?</span></li><li><b>2</b><span><strong>탐색</strong>헤드를 목표 트랙으로 이동</span></li><li><b>3</b><span><strong>도착</strong>이동 거리를 누적하고 완료</span></li></ol><details class="model-notes"><summary>이 실험의 범위</summary><ul><li>실린더 0–199, 처음 헤드 53, 요청 8개가 모두 시작 전에 도착한 고정 예제입니다.</li><li>이동 거리는 실린더 번호 차이입니다. 회전 대기·전송 시간·실제 탐색 시간은 계산하지 않습니다.</li><li>헤드가 움직이는 HDD 모델입니다. SSD에는 같은 기계적 탐색이 없습니다.</li><li>실제 디스크의 논리 블록 주소와 물리 위치 배치는 단순히 대응하지 않을 수 있습니다.</li><li>SSTF의 거리가 같으면 먼저 도착한 요청을 선택합니다.</li></ul></details></div></aside><section class="panel scene-panel"><div class="panel-head"><h2>요청 선택과 헤드 이동</h2><b class="step-clock"><span id="step-count">0</span><small>/ 8 요청</small></b></div><div id="disk-scene" class="disk-scene" tabindex="-1"></div><div class="scene-summary"><strong id="state-summary"></strong><button class="button replay-button" data-action="replay" disabled>↻ 이번 요청 다시 보기</button><span id="pending-count"></span></div><div class="transport"><div class="learning-mode"><button role="switch" aria-checked="true" data-action="guided"><i></i>요청마다 멈추기</button><span id="playback-hint"></span></div><div class="playback-buttons"><button class="button icon-button" data-action="reset" aria-label="처음으로">↺</button><button class="button icon-button" data-action="back" aria-label="이전 요청">‹</button><button class="button primary" data-action="play" aria-label="재생">▶ 학습 시작</button><button class="button" data-action="next">다음 요청 ›</button><button class="button" data-action="speed" aria-label="재생 속도 변경">1×</button></div><div class="seek-row"><span>0</span><input id="seek" type="range" min="0" max="8" step="1" value="0" aria-label="처리한 요청 수"/><span>8</span></div></div></section><aside class="panel lesson-panel"><div class="panel-head"><h2>단계 해설</h2><span id="lesson-mode"></span></div><nav id="milestones" aria-label="핵심 학습 장면"></nav><div class="lesson-content"><div class="explanation"><span class="eyebrow" id="eyebrow"></span><h3 id="lesson-title"></h3><p id="lesson-body"></p></div><article class="event-card"><div class="event-card-head"><strong id="event-title"></strong><span id="event-number"></span></div><p id="event-body" aria-live="polite"></p><div id="distance-equation" class="distance-equation"></div></article><div id="candidate-list"></div><div class="insight"><b>!</b><p id="takeaway"></p></div><button class="button prediction-button" data-action="predict">다음 선택, 맞혀보기 →</button><button class="button primary conclusion-button" data-action="compare" hidden>전체 이동 거리 비교 →</button></div></aside><section class="panel records-panel"><div class="record-tabs" role="tablist" aria-label="관찰 기록"><button role="tab" aria-selected="true" id="tab-path" aria-controls="record-path" data-record="path">헤드 이동 경로</button><button role="tab" aria-selected="false" id="tab-log" aria-controls="record-log" data-record="log" tabindex="-1">처리 기록 <span id="log-count">0</span></button><button role="tab" aria-selected="false" id="tab-results" aria-controls="record-results" data-record="results" tabindex="-1">누적 결과</button><span>완료한 요청 버튼으로 다시 관찰</span></div><section id="record-path" role="tabpanel" aria-labelledby="tab-path"><div class="plot-heading"><span>가로: 실린더 위치 · 세로: 처리 순서</span><span>선택 순서가 경로를 바꿉니다.</span></div><div id="path-chart"></div></section><section id="record-log" role="tabpanel" aria-labelledby="tab-log" hidden><div id="request-log"></div></section><section id="record-results" role="tabpanel" aria-labelledby="tab-results" hidden><div id="result-metrics"></div></section></section></main><footer><span><kbd>Space</kbd> 재생·정지 <kbd>←</kbd><kbd>→</kbd> 요청 이동 <kbd>R</kbd> 처음으로</span><a href="https://pages.cs.wisc.edu/~remzi/OSTEP/file-disks.pdf" target="_blank" rel="noreferrer">학습 근거 · OSTEP: Hard Disk Drives ↗</a></footer><dialog id="comparison-dialog" aria-labelledby="comparison-title"></dialog><dialog id="prediction-dialog" aria-labelledby="prediction-title"></dialog>`;

const scene = createDiskScene($("#disk-scene"), (phase) => {
  $("#event-title").textContent = phase.title;
  if (phase.body) $("#event-body").textContent = phase.body;
  if (busy && phase.body) $("#lesson-body").textContent = phase.body;
  $("#state-summary").textContent =
    `헤드 ${phase.state.head} · 누적 ${phase.state.total}칸`;
  $("#pending-count").textContent = `남은 요청 ${phase.state.pending.length}개`;
});
function controls() {
  const moving = playing || (busy && !paused);
  $('[data-action="play"]').textContent = moving
    ? "Ⅱ 일시정지"
    : committed === 8 && !busy
      ? "▶ 다시 재생"
      : index
        ? "▶ 이어서 재생"
        : "▶ 학습 시작";
  $('[data-action="play"]').setAttribute(
    "aria-label",
    moving ? "일시정지" : "재생",
  );
  $('[data-action="next"]').disabled = index === 8 || busy;
  $('[data-action="back"]').disabled = index === 0;
  $('[data-action="replay"]').disabled = index === 0 || busy;
  $('[data-action="guided"]').setAttribute("aria-checked", String(guided));
  $("#disk-scene").setAttribute("aria-busy", String(busy));
  $("#playback-hint").textContent = busy
    ? paused
      ? "요청과 헤드를 멈췄습니다."
      : "요청 → 헤드 → 누적 거리를 따라가세요."
    : index === 8
      ? "모든 요청 완료 · 두 방식을 비교하세요."
      : "현재 위치에서 다음 요청을 선택합니다.";
}
function render() {
  const step = current(),
    state = step.state,
    target = run().steps[index];
  $("#step-count").textContent = index;
  $("#seek").value = index;
  $("#seek").setAttribute(
    "aria-valuetext",
    `${index} / 8 요청${busy ? " 처리 중" : " 완료"}`,
  );
  document
    .querySelectorAll("[data-algorithm]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.algorithm === algorithm)),
    );
  $("#rule-summary").textContent =
    algorithm === "fcfs"
      ? "도착한 순서를 지킵니다. 헤드에서 멀리 있어도 먼저 들어온 요청을 먼저 처리합니다."
      : "현재 헤드에서 거리가 가장 짧은 요청을 고릅니다. 한 요청을 마칠 때마다 거리를 다시 비교합니다.";
  $("#lesson-mode").textContent = names[algorithm];
  $("#state-summary").textContent =
    `헤드 ${state.head} · 누적 ${state.total}칸`;
  $("#pending-count").textContent =
    `${busy ? "직전 완료 기준 · " : ""}남은 요청 ${state.pending.length}개`;
  $("#eyebrow").textContent = index
    ? `${index}번째 요청${busy ? " · 처리 중" : " · 처리 완료"}`
    : "대표 시나리오";
  $("#lesson-title").textContent = busy
    ? `요청 ${target.request.id} · ${target.request.cylinder}번 처리 중`
    : index === 0
      ? "어떤 순서가 덜 움직일까?"
      : index === 8
        ? `모든 요청 완료 · ${state.total}칸`
        : `${step.before.head} → ${state.head}, ${step.distance}칸 이동`;
  $("#lesson-body").textContent = busy
    ? "선택된 요청이 컨트롤러에 도착하면 헤드가 움직입니다."
    : index === 0
      ? "헤드는 53번에서 시작합니다. 같은 8개 요청도 무엇을 먼저 고르느냐에 따라 이동 거리가 달라집니다."
      : index === 8
        ? `${algorithm === "fcfs" ? "도착 순서" : "현재 위치에서 가까운 순서"}로 8개 요청을 모두 처리했습니다. 이동 거리는 ${state.total}칸입니다.`
        : algorithm === "fcfs"
          ? `요청 ${step.request.id}는 남은 요청 중 가장 먼저 도착했습니다. 이동 거리가 ${step.distance}칸이어도 도착 순서를 따릅니다.`
          : `직전 헤드 ${step.before.head}에서 가장 가까운 요청이 ${state.head}번이었습니다. 다음 선택은 새 위치 ${state.head}를 기준으로 합니다.`;
  $("#event-title").textContent = index
    ? `요청 ${target.request.id} · ${names[algorithm].split(" · ")[0]}`
    : "헤드 53 · 요청 8개 대기";
  $("#event-number").textContent = index ? `${index} / 8` : "시작 전";
  $("#event-body").textContent = index
    ? "헤드가 도착한 뒤 이번 이동 거리를 합산합니다."
    : "실린더 번호는 위치입니다. 53번에서 98번으로 가면 |98 − 53| = 45칸 움직입니다.";
  $("#distance-equation").innerHTML = step.index
    ? `<span>이번 이동</span><strong>|${step.state.head} − ${step.before.head}| = ${step.distance}</strong><span>누적 이동</span><strong>${step.before.total} + ${step.distance} = ${state.total}</strong>`
    : "<span>비교할 지표</span><strong>이동한 실린더 수의 합</strong>";
  $("#distance-equation").hidden = busy;
  $("#candidate-list").innerHTML = busy
    ? ""
    : state.pending.length
      ? `<div class="section-label">지금 헤드 ${state.head}에서 남은 요청까지</div><div class="candidate-grid">${state.pending.map((r) => `<span><b>${r.cylinder}</b><small>${Math.abs(r.cylinder - state.head)}칸</small></span>`).join("")}</div><p class="candidate-note">도착 순서로 표시 · ${algorithm === "fcfs" ? "FCFS는 거리가 아니라 순서로 선택" : "SSTF는 이 거리 중 최솟값을 선택"}</p>`
      : "";
  $("#takeaway").textContent =
    algorithm === "fcfs"
      ? "FCFS는 순서를 지키지만, 먼 요청 사이를 왕복할 수 있습니다."
      : "SSTF가 이 예제에서는 덜 움직입니다. 새 요청이 계속 가까이 들어오면 먼 요청이 오래 기다릴 수 있지만, 이 고정 예제에서는 모두 완료됩니다.";
  $('[data-action="predict"]').hidden = busy || committed === 8;
  $(".conclusion-button").hidden = committed !== 8;
  $("#milestones").innerHTML = [
    { n: 0, label: "시작" },
    { n: 1, label: "첫 선택" },
    { n: 3, label: "방향 변화" },
    { n: 8, label: "결과" },
  ]
    .map(
      (m) =>
        `<button data-seek="${m.n}" ${m.n === index ? 'aria-current="step"' : ""}><b>${m.n}</b><span>${m.label}</span></button>`,
    )
    .join("");
  renderRecords();
  controls();
}
function renderRecords() {
  const seen = run().steps.slice(0, committed + 1),
    plotWidth = Math.max(320, $(".records-panel").clientWidth - 28),
    x = (n) => 42 + (n / 199) * (plotWidth - 80),
    y = (n) => 45 + n * 31;
  $("#path-chart").innerHTML =
    `<svg class="path-plot" viewBox="0 0 ${plotWidth} 340" role="img" aria-label="완료한 요청의 헤드 이동 경로"><title>${seen.map((s) => s.state.head).join(" → ")}</title>${[0, 50, 100, 150, 199].map((n) => `<line class="plot-grid" x1="${x(n)}" y1="35" x2="${x(n)}" y2="310"/><text class="plot-axis" x="${x(n)}" y="23" text-anchor="middle">${n}</text>`).join("")}<polyline class="plot-line" points="${seen.map((s) => `${x(s.state.head)},${y(s.index)}`).join(" ")}"/>${Array.from({ length: 9 }, (_, i) => `<text class="plot-axis" x="25" y="${y(i) + 4}" text-anchor="middle">${i === 0 ? "시작" : i}</text>`).join("")}${seen.map((s) => `<g class="plot-point ${s.index === committed ? "current" : ""}"><circle cx="${x(s.state.head)}" cy="${y(s.index)}" r="6"/><text x="${x(s.state.head) + (s.state.head > 175 ? -12 : 12)}" y="${y(s.index) + 4}" text-anchor="${s.state.head > 175 ? "end" : "start"}">${s.state.head}</text></g>`).join("")}</svg><div class="path-jumps">${seen.map((s) => `<button class="button" data-seek="${s.index}" aria-label="${s.index}번째 요청으로 이동">${s.index === 0 ? "시작" : s.index + "번째"} <b>${s.state.head}</b></button>`).join("")}</div>`;
  $("#log-count").textContent = committed;
  $("#request-log").innerHTML = committed
    ? `<div class="log-wrap"><table><thead><tr><th>처리 순서</th><th>원래 요청</th><th>헤드 이동</th><th>이번 거리</th><th>누적 거리</th></tr></thead><tbody>${seen
        .slice(1)
        .map(
          (s) =>
            `<tr><td><button data-seek="${s.index}">${s.index}번째</button></td><td>요청 ${s.request.id}</td><td>${s.before.head} → ${s.state.head}</td><td>${s.distance}칸</td><td>${s.state.total}칸</td></tr>`,
        )
        .join("")}</tbody></table></div>`
    : '<p class="empty-note">요청을 처리하면 선택 순서와 이동 거리가 기록됩니다.</p>';
  const s = current().state;
  $("#result-metrics").innerHTML =
    `<div class="metrics"><div><span>처리한 요청</span><b>${committed}<small>/ 8</small></b></div><div><span>현재 헤드</span><b>${s.head}</b></div><div><span>누적 이동 거리</span><b>${s.total}<small>칸</small></b></div><div><span>요청당 평균 이동</span><b>${committed ? (s.total / committed).toFixed(1) : "—"}<small>칸</small></b></div></div><p class="result-note">${committed === 8 ? "같은 요청 전체를 처리한 결과입니다. 두 방식 비교에서 이동 경로와 합계를 함께 확인하세요." : "현재까지 완료한 요청의 결과입니다. 미래 요청의 이동 거리는 아직 포함하지 않습니다."}</p>`;
}
function pause() {
  playing = false;
  clearTimeout(timer);
  paused = busy;
  scene.pause();
  controls();
}
function schedule() {
  clearTimeout(timer);
  if (playing && !busy && index < 8)
    timer = setTimeout(() => move(index + 1, true), 480 / speed);
}
async function move(next, motion = false) {
  const token = ++revision;
  clearTimeout(timer);
  index = Math.max(0, Math.min(8, next));
  busy = motion;
  paused = false;
  resumeAutomatically = playing;
  if (motion) render();
  await scene.update(run().steps[index], { motion, speed, algorithm });
  if (token !== revision) return;
  committed = index;
  busy = false;
  paused = false;
  render();
  if (index === 8 || (guided && playing)) playing = false;
  controls();
  schedule();
}
function jump(next) {
  pause();
  move(next, false);
}
async function replay() {
  const target = index;
  pause();
  await move(target - 1, false);
  await move(target, true);
}
function play() {
  if (playing || (busy && !paused)) {
    pause();
    return;
  }
  if (busy && paused && !resumeAutomatically) {
    paused = false;
    scene.resume();
    controls();
    return;
  }
  if (committed === 8 && !busy) {
    committed = 0;
    index = 0;
    scene.update(current());
    render();
  }
  playing = true;
  paused = false;
  scene.resume();
  controls();
  schedule();
}
function changeAlgorithm(name) {
  pause();
  revision++;
  algorithm = name;
  index = committed = 0;
  busy = paused = false;
  scene.update(current());
  render();
}
function selectRecord(name) {
  record = name;
  document.querySelectorAll("[data-record]").forEach((b) => {
    const yes = b.dataset.record === name;
    b.setAttribute("aria-selected", String(yes));
    b.tabIndex = yes ? 0 : -1;
  });
  for (const id of ["path", "log", "results"])
    $(`#record-${id}`).hidden = id !== name;
}
function comparison() {
  pause();
  $("#comparison-dialog").innerHTML =
    `<div class="dialog-heading"><div><span class="eyebrow">같은 요청 8개 · 같은 시작점 53</span><h2 id="comparison-title">순서가 바꾸는 이동 거리</h2></div><button class="button icon-button" data-action="close" aria-label="닫기">×</button></div><div class="comparison-grid">${Object.entries(
      runs,
    )
      .map(
        ([name, r]) =>
          `<article><h3>${names[name]}</h3><strong class="comparison-total">${r.total}<small>칸</small></strong><p class="order-story">53 → ${r.order.join(" → ")}</p><p>${name === "fcfs" ? "먼 요청과 가까운 요청을 도착 순서대로 오가며 크게 왕복합니다." : "현재 위치에서 가까운 요청을 고르며 이 요청 묶음의 이동을 줄입니다."}</p><button class="button" data-algorithm="${name}" data-close="true">이 방식으로 다시 보기 →</button></article>`,
      )
      .join(
        "",
      )}</div><p class="comparison-foot">이 예제에서 SSTF는 ${runs.fcfs.total - runs.sstf.total}칸 덜 이동합니다. 이동 거리 비교이며 실제 응답 시간이나 모든 입력에서의 최적성을 뜻하지 않습니다.</p>`;
  $("#comparison-dialog").showModal();
}
function prediction() {
  pause();
  const next = run().steps[committed + 1];
  if (!next) return;
  const options = current().state.pending;
  $("#prediction-dialog").innerHTML =
    `<div class="dialog-heading"><div><span class="eyebrow">${names[algorithm]} · 현재 헤드 ${current().state.head}</span><h2 id="prediction-title">다음에 어느 요청을 고를까요?</h2></div><button class="button icon-button" data-action="close" aria-label="닫기">×</button></div><p class="dialog-intro">${algorithm === "fcfs" ? "도착 순서" : "현재 헤드와의 거리"}를 근거로 선택하세요. 버튼은 원래 도착 순서로 놓여 있습니다.</p><div class="prediction-choices">${options.map((r) => `<button class="button" data-answer="${r.id}"><small>요청 ${r.id}</small><strong>${r.cylinder}</strong><span>${Math.abs(r.cylinder - current().state.head)}칸 거리</span></button>`).join("")}</div><div id="prediction-feedback" aria-live="polite"></div>`;
  $("#prediction-dialog").showModal();
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.algorithm) {
    changeAlgorithm(b.dataset.algorithm);
    if (b.dataset.close) b.closest("dialog").close();
    return;
  }
  if (b.dataset.seek !== undefined) {
    jump(Number(b.dataset.seek));
    return;
  }
  if (b.dataset.record) {
    selectRecord(b.dataset.record);
    return;
  }
  if (b.dataset.answer) {
    const next = run().steps[committed + 1],
      correct = Number(b.dataset.answer) === next.request.id;
    document.querySelectorAll("[data-answer]").forEach((x) => {
      x.disabled = true;
      x.classList.toggle(
        "correct",
        Number(x.dataset.answer) === next.request.id,
      );
    });
    $("#prediction-feedback").innerHTML =
      `<strong>${correct ? "맞았습니다." : "선택 기준을 다시 확인하세요."}</strong><p>${next.request.cylinder}번을 고릅니다. ${algorithm === "fcfs" ? "남은 요청 중 먼저 도착했기 때문입니다." : `현재 ${next.before.head}에서 ${next.distance}칸으로 가장 가깝습니다.`}</p><button class="button primary" data-action="verify">실제 이동으로 확인 →</button>`;
    return;
  }
  switch (b.dataset.action) {
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
      scene.setSpeed(speed);
      b.textContent = `${speed}×`;
      schedule();
      break;
    case "guided":
      guided = !guided;
      controls();
      break;
    case "compare":
      comparison();
      break;
    case "predict":
      prediction();
      break;
    case "verify":
      $("#prediction-dialog").close();
      $("#disk-scene").focus({ preventScroll: true });
      $("#disk-scene").scrollIntoView({ block: "nearest", behavior: "instant" });
      move(index + 1, true);
      break;
    case "close":
      b.closest("dialog").close();
      break;
    case "setup": {
      const open = b.getAttribute("aria-expanded") === "true";
      b.setAttribute("aria-expanded", String(!open));
      $("#setup-content").hidden = open;
      break;
    }
    case "theme": {
      const dark = document.documentElement.dataset.theme !== "dark";
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      localStorage.setItem("disk-theme", dark ? "dark" : "light");
      b.setAttribute(
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
    e.target.closest("button,input,select,textarea")
  )
    return;
  if (e.code === "Space") {
    e.preventDefault();
    play();
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    jump(index + 1);
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    jump(index - 1);
  } else if (e.key.toLowerCase() === "r") jump(0);
});
document.documentElement.dataset.theme =
  localStorage.getItem("disk-theme") || "light";
if (document.documentElement.dataset.theme === "dark")
  $('[data-action="theme"]').setAttribute("aria-label", "밝은 테마로 전환");
if (matchMedia("(max-width:1099px)").matches) {
  $('[data-action="setup"]').setAttribute("aria-expanded", "false");
  $("#setup-content").hidden = true;
}
new ResizeObserver(() =>
  $(".workspace").style.setProperty(
    "--stage-height",
    $(".scene-panel").getBoundingClientRect().height + "px",
  ),
).observe($(".scene-panel"));
scene.update(current());
render();
selectRecord(record);
