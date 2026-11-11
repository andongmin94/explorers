import "./styles.css";
import { simulateGit, CONTENTS, RESOLUTIONS, FILE_NAME } from "./engine.js";
import { createGitScene } from "./scene.js";
import { describeStep, MILESTONES, SOURCES, PREDICTION } from "./lesson.js";

const $ = (s) => document.querySelector(s);
const esc = (text) =>
  String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const paths = {
  branch: "M7 3v11a5 5 0 0 0 10 0V9M7 8a5 5 0 0 0 10 0M4 3h6M14 3h6M14 21h6",
  reset: "M4 9a8 8 0 1 1 0 8M4 3v6h6",
  back: "m15 5-7 7 7 7",
  next: "m9 5 7 7-7 7",
  play: "m8 5 11 7-11 7z",
  pause: "M8 5v14M16 5v14",
  moon: "M20 14a8 8 0 0 1-10-10 8 8 0 1 0 10 10Z",
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]}"/></svg>`;
const branch = (name) =>
  `<b class="branch-tag ${name === "main" ? "main" : "feature"}">${name}</b>`;
let choice = null,
  run = simulateGit(),
  index = 0,
  completed = 0,
  busy = false,
  paused = false,
  playing = false,
  guided = true,
  speed = 1,
  revision = 0,
  timer = null,
  phaseState = run.steps[0].state;
const last = 12;
const stateNames = {
  clean: "변경 없음",
  modified: "파일 수정됨",
  staged: "스테이징됨",
  conflict: "충돌 · 해결 필요",
  resolved: "파일 편집 완료",
};
const indexNames = {
  clean: "커밋과 동일",
  staged: "다음 커밋 준비",
  unmerged: "미해결 상태",
};
const stepNames = [
  "시작",
  "분기",
  "파일 수정",
  "스테이징",
  "커밋 C1",
  "main 전환",
  "파일 수정",
  "스테이징",
  "커밋 C2",
  "병합 충돌",
  "해결안 편집",
  "해결안 등록",
  "병합 커밋",
];

$("#app").innerHTML =
  `<header class="app-header"><div class="brand-icon">${icon("branch")}</div><div><h1>Git 탐색기</h1><p>브랜치 분기부터 충돌 해결까지</p></div><div class="scenario-heading"><small>하나의 파일, 서로 다른 두 제목</small><strong>갈라진 작업을 하나의 이력으로</strong></div><button class="button icon-button theme-button" data-action="theme" aria-label="어두운 테마로 전환">${icon("moon")}</button></header>
<main class="workspace">
<aside class="panel setup-panel"><button class="panel-head setup-toggle" data-action="setup" aria-expanded="true" aria-controls="setup-content"><h2>이번 실험</h2><span>접기 ⌄</span></button><div class="setup-content" id="setup-content"><p class="setup-intro">산책 안내의 <b>같은 제목 줄</b>을 두 브랜치에서 다르게 고칩니다.</p><div class="file-label"><span>수정할 파일</span><strong>${FILE_NAME}</strong><small>3줄 중 2번째 줄</small></div><div class="branch-legend"><div>${branch("main")}<span>함께 걷는 산책</span></div><div>${branch("feature/title")}<span>나만의 산책</span></div></div><div class="section-label">핵심 장면 바로 보기</div><nav id="milestones" aria-label="핵심 학습 장면"></nav><div class="setup-tip"><b>관찰할 세 가지</b><p>브랜치가 가리키는 커밋<br/>작업 파일과 스테이징의 차이<br/>병합 커밋의 두 부모</p></div><details class="scope"><summary>실험의 범위</summary><p>로컬 저장소 하나의 고정 시나리오입니다. 원격 저장소·push·rebase는 다루지 않습니다. C0~C3는 이해를 위한 커밋 이름이며 실제 해시가 아닙니다.</p></details></div></aside>
<section class="panel scene-panel"><div class="panel-head"><h2>저장소와 파일의 흐름</h2><div class="step-clock"><b id="step-count">0</b><span>/ 12 사건</span></div></div><div id="git-scene"></div><div class="scene-summary"><div><strong id="state-summary"></strong><span id="head-summary"></span></div><button class="button replay" data-action="replay" disabled>↻ 이번 사건 다시 보기</button></div><div class="transport"><div class="learning-mode"><button role="switch" aria-checked="true" data-action="guided"><i></i>핵심 장면에서 멈추기</button><span id="playback-hint"></span></div><div class="playback-buttons"><button class="button icon-button" data-action="reset" aria-label="처음으로">${icon("reset")}</button><button class="button icon-button" data-action="back" aria-label="이전 사건">${icon("back")}</button><button class="button primary" data-action="play" aria-label="재생">${icon("play")}<span>학습 시작</span></button><button class="button" data-action="next">다음 사건 ${icon("next")}</button><button class="button speed-button" data-action="speed" aria-label="재생 속도 변경">1×</button></div><div class="seek-row"><span>0</span><input id="seek" type="range" min="0" max="12" value="0" step="1" aria-label="현재 사건"/><span>12</span></div></div></section>
<aside class="panel lesson-panel"><div class="panel-head"><h2>단계 해설</h2><span id="lesson-counter">시작 전</span></div><div class="lesson-content"><div class="eyebrow" id="eyebrow"></div><h3 id="lesson-title"></h3><p class="lesson-body" id="lesson-body"></p><div class="command-card"><div><b id="command-label">실행 명령</b><span id="command-kind"></span></div><code id="command"></code></div><div class="phase-note" aria-live="polite"><strong id="phase-title"></strong><p id="phase-body"></p></div><div class="facts" id="facts"></div><ul class="lesson-details" id="lesson-details"></ul><div class="takeaway"><b>기억할 점</b><p id="takeaway"></p></div><button class="button prediction-button" data-action="predict" hidden>병합하면 어떻게 될까? →</button><section class="resolution" id="resolution" hidden aria-labelledby="resolution-heading"><div class="resolution-heading"><span>직접 해결</span><h4 id="resolution-heading">어떤 제목을 남길까요?</h4></div><p>파일에 남길 문장을 선택하세요. Git이 의도를 대신 결정하지는 않습니다.</p><div class="resolution-options">${RESOLUTIONS.map((r) => `<button data-resolution="${r.id}"><b>${esc(r.label)}</b><span>${esc(r.content.trimEnd().split("\n")[1].replace("제목: ", ""))}</span></button>`).join("")}</div><p class="resolution-foot">선택 → 파일 편집 → git add → 병합 커밋</p></section><div class="chosen-resolution" id="chosen-resolution" hidden><span>선택한 해결안</span><b id="chosen-label"></b><button class="text-button" data-action="choose-again">다른 해결안으로 비교 ↗</button></div></div></aside>
<section class="panel records-panel"><div class="record-tabs" role="tablist" aria-label="학습 기록"><button role="tab" id="tab-diff" aria-controls="record-diff" aria-selected="true" data-record="diff">파일 비교</button><button role="tab" id="tab-log" aria-controls="record-log" aria-selected="false" data-record="log" tabindex="-1">사건 기록 <span id="log-count">0</span></button><button role="tab" id="tab-result" aria-controls="record-result" aria-selected="false" data-record="result" tabindex="-1">병합 결과</button><span class="record-hint">번호를 누르면 해당 장면으로 이동</span></div><div id="step-strip" class="step-strip" aria-label="사건 순서"></div><section role="tabpanel" id="record-diff" aria-labelledby="tab-diff"><div class="record-heading"><h3 id="diff-heading"></h3><span id="diff-note"></span></div><div id="diff-grid" class="diff-grid"></div></section><section role="tabpanel" id="record-log" aria-labelledby="tab-log" hidden><div id="event-log"></div></section><section role="tabpanel" id="record-result" aria-labelledby="tab-result" hidden><div id="result"></div></section></section></main>
<footer><span><kbd>Space</kbd> 재생·정지 <kbd>←</kbd><kbd>→</kbd> 사건 이동 <kbd>R</kbd> 처음으로</span><span>학습 근거 ${SOURCES.map((s) => `<a href="${s.url}" target="_blank" rel="noreferrer">${esc(s.title)} ↗</a>`).join(" · ")}</span></footer><dialog id="prediction-dialog" aria-labelledby="prediction-title"></dialog>`;

$(".command-card").after($("#resolution"));

const scene = createGitScene($("#git-scene"), {
  onPhase(phase) {
    phaseState = phase.state;
    renderState(phase.state);
    if (phase.title) $("#phase-title").textContent = phase.title;
    if (phase.body) $("#phase-body").textContent = phase.body;
  },
});
function renderState(state) {
  $("#state-summary").textContent = state.merge
    ? state.status === "conflict"
      ? "충돌 1개 · 병합 커밋은 아직 없습니다"
      : state.index.status === "unmerged"
        ? "파일 편집 완료 · 해결안 등록이 필요합니다"
        : "해결안 등록 완료 · 병합 커밋을 기다립니다"
    : index === 12
      ? "병합 완료 · 두 작업의 이력을 함께 보존"
      : stateNames[state.status];
  $("#head-summary").textContent =
    `HEAD → ${state.currentBranch} → ${state.refs[state.currentBranch]} · 커밋 ${state.commits.length}개`;
  const before = run.steps[index].before;
  const entries = [
    [
      "현재 커밋",
      before.refs[before.currentBranch],
      state.refs[state.currentBranch],
    ],
    [
      "스테이징",
      indexNames[before.index.status],
      indexNames[state.index.status],
    ],
    ["커밋 수", before.commits.length, state.commits.length],
  ];
  $("#facts").innerHTML =
    `<div class="facts-heading"><b>직전 → 현재</b><span>도착한 상태 기준</span></div>${entries.map(([label, a, b]) => `<div class="fact ${a !== b ? "changed" : ""}"><span>${label}</span><small>${a}</small><i>→</i><b>${b}</b></div>`).join("")}`;
}
function render() {
  const step = run.steps[index],
    lesson = describeStep(step);
  $("#step-count").textContent = index;
  $("#seek").value = index;
  $("#seek").setAttribute(
    "aria-valuetext",
    `${index} / 12 사건${busy ? " 처리 중" : ""}`,
  );
  $("#lesson-counter").textContent = index
    ? `${index}번째 사건${busy ? " · 처리 중" : ""}`
    : "시작 전";
  $("#eyebrow").textContent = lesson.eyebrow;
  $("#lesson-title").textContent = lesson.title;
  $("#lesson-body").textContent = lesson.body;
  $("#command-label").textContent = step.command
    ? "실행 명령"
    : "작업 파일 편집";
  $("#command-kind").textContent = step.command ? "Git" : "직접 수정";
  $("#command").textContent =
    step.command ||
    (index === 0
      ? "아직 실행한 명령이 없습니다"
      : index === 10
        ? "충돌 표식을 지우고 선택한 제목을 저장"
        : "welcome.txt의 제목을 수정하고 저장");
  $("#phase-title").textContent = busy ? "사건 처리 중" : step.title;
  $("#phase-body").textContent = lesson.takeaway;
  $("#takeaway").textContent = lesson.takeaway;
  $("#lesson-details").innerHTML = lesson.details
    .map((d) => `<li>${esc(d)}</li>`)
    .join("");
  $("#resolution").hidden = busy || index !== 9;
  $(".lesson-panel").dataset.resolving = String(!busy && index === 9);
  $(".phase-note").hidden = !busy;
  $("#chosen-resolution").hidden = index < 10 || !choice;
  if (choice)
    $("#chosen-label").textContent = RESOLUTIONS.find(
      (r) => r.id === choice,
    ).label;
  $("#prediction-dialog").open && $("#prediction-dialog").close();
  $(".prediction-button").hidden = busy || index !== 8;
  $("#milestones").innerHTML = MILESTONES.map(
    (m, i) =>
      `<button data-seek="${m.index}" class="milestone ${index >= m.index ? "visited" : ""}" ${MILESTONES.filter((n) => n.index <= index).at(-1)?.index === m.index ? 'aria-current="step"' : ""}><b>${i + 1}</b><span>${m.label}</span>${index > m.index ? "<i>✓</i>" : ""}</button>`,
  ).join("");
  renderState(busy ? step.before : step.state);
  renderRecords();
  controls();
}
function controls() {
  const moving = playing || (busy && !paused),
    gated = index === 9 && !busy;
  const play = $('[data-action="play"]');
  play.innerHTML = `${icon(moving ? "pause" : "play")}<span>${moving ? "일시정지" : gated ? "해결안 선택" : index === 12 ? "처음부터 재생" : index ? "이어서 재생" : "학습 시작"}</span>`;
  play.setAttribute(
    "aria-label",
    moving ? "일시정지" : gated ? "해결안 선택" : "재생",
  );
  $('[data-action="next"]').disabled = index === last || busy || gated;
  $('[data-action="back"]').disabled = index === 0;
  $('[data-action="replay"]').disabled = index === 0 || busy;
  $('[data-action="guided"]').setAttribute("aria-checked", String(guided));
  $("#git-scene").setAttribute("aria-busy", String(busy));
  $("#playback-hint").textContent = gated
    ? "오른쪽에서 남길 제목을 선택하세요."
    : busy
      ? paused
        ? "이동과 상태를 함께 멈췄습니다."
        : "파일과 브랜치 표지의 이동을 보세요."
      : index === 12
        ? "병합 커밋 C3의 두 부모를 확인하세요."
        : "다음 사건을 실행하거나 번호로 이동하세요.";
}
function lines(content, highlight = true) {
  return content
    .trimEnd()
    .split("\n")
    .map(
      (line, i) =>
        `<div class="file-line ${highlight && i === 1 ? "emphasis" : ""}"><span>${i + 1}</span><code>${esc(line)}</code></div>`,
    )
    .join("");
}
function renderRecords() {
  $("#log-count").textContent = completed;
  $("#step-strip").innerHTML = run.steps
    .slice(1)
    .map(
      (s) =>
        `<button data-seek="${s.index}" aria-label="${s.index}번째 사건으로 이동" ${index === s.index ? 'aria-current="step"' : ""} class="${s.index <= completed ? "visited" : ""}"><b>${String(s.index).padStart(2, "0")}</b><span>${stepNames[s.index]}</span></button>`,
    )
    .join("");
  const state = run.steps[completed].state,
    compare = completed >= 8;
  $("#diff-heading").textContent = compare
    ? "같은 줄에서 갈라진 두 변경"
    : "커밋 · 작업 파일 · 스테이징";
  $("#diff-note").textContent = compare
    ? "공통 조상 C0를 기준으로 두 변경을 비교합니다."
    : "편집·add·commit이 각각 무엇을 바꾸는지 확인하세요.";
  const snapshots = compare
    ? [
        { title: "공통 조상", tag: "C0", content: CONTENTS.base, cls: "" },
        {
          title: "main 쪽 변경",
          tag: "병합 전 · C2",
          content: CONTENTS.main,
          cls: "main",
        },
        {
          title: "feature/title 쪽 변경",
          tag: "병합 전 · C1",
          content: CONTENTS.feature,
          cls: "feature",
        },
      ]
    : [
        {
          title: "현재 커밋",
          tag: state.refs[state.currentBranch],
          content: state.commits.find(
            (c) => c.id === state.refs[state.currentBranch],
          ).content,
          cls: "",
        },
        {
          title: "작업 파일",
          tag: stateNames[state.status],
          content: state.working,
          cls: state.currentBranch === "main" ? "main" : "feature",
        },
        {
          title: "스테이징",
          tag: indexNames[state.index.status],
          content: state.index.content || "",
          cls: "",
        },
      ];
  $("#diff-grid").innerHTML = snapshots
    .map(
      (p) =>
        `<article class="file-snapshot ${p.cls}"><div><b>${p.title}</b><span>${p.tag}</span></div>${lines(p.content)}</article>`,
    )
    .join("");
  $("#event-log").innerHTML = completed
    ? run.steps
        .slice(1, completed + 1)
        .map(
          (s) =>
            `<button class="log-entry ${s.index === index ? "current" : ""}" data-seek="${s.index}"><b class="event-number">${s.index}</b><span><strong>${esc(s.title)}</strong><code>${esc(s.command || "welcome.txt 직접 편집")}</code></span><small>${s.state.currentBranch}<b>${s.state.refs[s.state.currentBranch]}</b></small></button>`,
        )
        .join("")
    : '<p class="empty-note">재생하면 실행한 명령과 결과가 차례로 쌓입니다.</p>';
  $("#result").innerHTML =
    completed === 12
      ? `<div class="result-top"><div><span>병합 완료</span><h3>갈라진 두 이력, 하나의 병합 커밋</h3><p>${esc(RESOLUTIONS.find((r) => r.id === choice).label)} 해결안을 C3에 저장했습니다.</p></div><strong class="result-commit">C3</strong></div><div class="result-grid"><div><span>부모 커밋</span><b>C2 + C1</b></div><div><span>현재 위치</span><b>main → C3</b></div><div><span>기능 브랜치</span><b>feature/title → C1</b></div><div><span>작업 파일</span><b>변경 없음</b></div></div><div class="result-file">${lines(state.working)}</div><p class="result-note">병합은 기존 커밋을 지우거나 기능 브랜치를 삭제하지 않습니다. 최종 문장은 사람이 선택했고, C3는 두 부모의 이력을 함께 잇습니다.</p><button class="button" data-action="choose-again">다른 제목을 선택해 결과 비교 →</button>`
      : `<div class="result-empty"><b>${state.commits.length}개 커밋 · ${stateNames[state.status]}</b><p>충돌 해결과 스테이징을 마친 뒤 병합 커밋까지 실행하면 최종 결과가 나타납니다.</p><span>파일 편집 → 해결안 등록 → 병합 커밋</span></div>`;
}
function pause() {
  playing = false;
  clearTimeout(timer);
  timer = null;
  paused = busy;
  scene.pause();
  controls();
}
function schedule() {
  clearTimeout(timer);
  if (playing && !busy && index < last)
    timer = setTimeout(() => move(index + 1, true), 560 / speed);
}
async function move(next, motion = false) {
  let target = Math.max(0, Math.min(last, next));
  if (target > 9 && !choice) {
    target = 9;
    playing = false;
  }
  const token = ++revision;
  clearTimeout(timer);
  index = target;
  if (!motion) completed = target;
  busy = motion;
  paused = false;
  render();
  await scene.update(run.steps[index], { animate: motion, speed });
  if (token !== revision) return;
  completed = index;
  busy = false;
  paused = false;
  render();
  if (
    index === last ||
    index === 9 ||
    (playing && guided && [4, 8].includes(index))
  )
    playing = false;
  controls();
  schedule();
}
function jump(next) {
  pause();
  move(next, false);
}
function reset() {
  pause();
  choice = null;
  run = simulateGit();
  completed = 0;
  move(0, false);
}
function play() {
  if (playing || (busy && !paused)) {
    pause();
    return;
  }
  if (index === 9 && !busy) {
    $("#resolution").scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "center",
    });
    $("#resolution button").focus({ preventScroll: true });
    return;
  }
  if (completed === last && !busy) {
    reset();
  }
  playing = true;
  paused = false;
  scene.resume();
  controls();
  schedule();
}
async function replay() {
  const target = index;
  pause();
  await move(target - 1, false);
  await move(target, true);
}
function selectRecord(name) {
  document.querySelectorAll("[data-record]").forEach((b) => {
    const selected = b.dataset.record === name;
    b.setAttribute("aria-selected", String(selected));
    b.tabIndex = selected ? 0 : -1;
  });
  for (const n of ["diff", "log", "result"])
    $(`#record-${n}`).hidden = n !== name;
}
function predict() {
  pause();
  const q = PREDICTION;
  $("#prediction-dialog").innerHTML =
    `<div class="dialog-head"><div><span>실행 전에 예상해 보기</span><h2 id="prediction-title">${esc(q.question)}</h2></div><button class="button icon-button" data-action="close" aria-label="닫기">×</button></div><p class="prediction-context">main → C2 · feature/title → C1<br/>두 브랜치가 같은 제목 줄을 다르게 수정했습니다.</p><div class="prediction-choices">${q.choices.map((c) => `<button class="button" data-answer="${c.id}">${esc(c.text)}</button>`).join("")}</div><div id="prediction-feedback" aria-live="polite"></div>`;
  $("#prediction-dialog").showModal();
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.seek) {
    jump(Number(b.dataset.seek));
    return;
  }
  if (b.dataset.record) {
    selectRecord(b.dataset.record);
    return;
  }
  if (b.dataset.resolution) {
    pause();
    choice = b.dataset.resolution;
    run = simulateGit(choice);
    move(10, true);
    return;
  }
  if (b.dataset.answer) {
    const answer = PREDICTION.choices.find((c) => c.id === b.dataset.answer);
    document.querySelectorAll("[data-answer]").forEach((el) => {
      el.disabled = true;
      el.classList.toggle(
        "correct",
        PREDICTION.choices.find((c) => c.id === el.dataset.answer).correct,
      );
    });
    $("#prediction-feedback").innerHTML =
      `<b>${answer.correct ? "맞았습니다." : "충돌이 나면 병합 커밋은 아직 만들어지지 않습니다."}</b><p>${esc(answer.feedback)}</p><button class="button primary" data-action="verify">병합 실행해서 확인 →</button>`;
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
      reset();
      break;
    case "replay":
      replay();
      break;
    case "speed":
      speed = speed === 1 ? 2 : speed === 2 ? 0.5 : 1;
      b.textContent = `${speed}×`;
      schedule();
      break;
    case "guided":
      guided = !guided;
      controls();
      break;
    case "predict":
      predict();
      break;
    case "close":
      b.closest("dialog").close();
      break;
    case "verify":
      $("#prediction-dialog").close();
      move(9, true);
      break;
    case "choose-again":
      choice = null;
      run = simulateGit();
      jump(9);
      break;
    case "setup": {
      const open = b.getAttribute("aria-expanded") === "true";
      b.setAttribute("aria-expanded", String(!open));
      b.querySelector("span").textContent = open ? "펼치기 ⌄" : "접기 ⌃";
      $("#setup-content").hidden = open;
      break;
    }
    case "theme": {
      const dark = document.documentElement.dataset.theme !== "dark";
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      localStorage.setItem("git-theme", dark ? "dark" : "light");
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
    e.target.closest("input,select,textarea,button,a,summary")
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
  } else if (e.key.toLowerCase() === "r") reset();
});
document.documentElement.dataset.theme =
  localStorage.getItem("git-theme") || "light";
if (document.documentElement.dataset.theme === "dark")
  $('[data-action="theme"]').setAttribute("aria-label", "밝은 테마로 전환");
const compact = matchMedia("(max-width:1099px)");
function syncSetup() {
  $('[data-action="setup"]').setAttribute(
    "aria-expanded",
    String(!compact.matches),
  );
  $("#setup-content").hidden = compact.matches;
  $('[data-action="setup"] span').textContent = compact.matches
    ? "펼치기 ⌄"
    : "접기 ⌃";
}
compact.addEventListener("change", syncSetup);
syncSetup();
const observer = new ResizeObserver(() =>
  $(".workspace").style.setProperty(
    "--stage-height",
    $(".scene-panel").getBoundingClientRect().height + "px",
  ),
);
observer.observe($(".scene-panel"));
render();
scene.update(run.steps[0]);
