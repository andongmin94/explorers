import "../../shared/theme.css";
import "../../shared/hw.css";
import "./styles.css";
import "../../shared/switcher.js";
import "../../shared/iso.js";
import { bindSliders, icon, syncSlider } from "../../shared/hw.js";
import { paginate, plateTabs, rowWindow } from "../../shared/fit.js";
import { simulateGit, RESOLUTIONS, FILE_NAME } from "./engine.js";
import { createGitScene, contentKind } from "./scene.js";
import { describeStep, MILESTONES, SOURCES, PREDICTION } from "./lesson.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (text) =>
  String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const pad = (n) => String(n).padStart(2, "0");

let choice = null,
  run = simulateGit(),
  index = 0,
  completed = 0,
  busy = false,
  paused = false,
  playing = false,
  resumeAutomatically = false,
  guided = true,
  speed = 1,
  revision = 0,
  timer = null,
  phase = null;
const last = 12;

const stateNames = {
  clean: "변경 없음 · 작업 트리, 인덱스, HEAD 커밋이 같습니다",
  modified: "작업 트리만 수정됨 · 아직 git add 전입니다",
  staged: "인덱스에 준비됨 · 아직 커밋 전입니다",
  conflict: "충돌 1곳 · 병합 커밋은 아직 없습니다",
  resolved: "파일 편집 완료 · 인덱스에는 아직 세 버전이 있습니다",
};
const indexNames = {
  clean: "커밋과 같음",
  staged: "다음 커밋 준비",
  unmerged: "미해결 세 버전",
  comparing: "세 버전 대조 중",
};
const indexLabel = (state) =>
  state.merge && state.index.status === "staged" ? "해결 등록 완료" : indexNames[state.index.status];
const titleOf = (content) => content.split("\n").find((line) => line.startsWith("제목:"))?.replace(/^제목:\s*/, "") ?? "";
const headCommit = (state) => state.commits.find((c) => c.id === state.refs[state.currentBranch]);

const glossary = [
  ["작업 트리", "디스크에서 직접 편집하는 파일입니다. 저장해도 Git 이력은 바뀌지 않습니다."],
  ["인덱스 (스테이징)", "다음 커밋에 담을 스냅샷입니다. git add가 작업 트리의 내용을 여기에 복사합니다."],
  ["커밋", "인덱스 스냅샷과 부모 커밋을 함께 기록한 이력의 한 지점입니다."],
  ["브랜치", "커밋 하나를 가리키는 이동 가능한 이름입니다. 커밋하면 현재 브랜치가 앞으로 이동합니다."],
  ["HEAD", "지금 작업 중인 브랜치를 가리킵니다. 이 시나리오에서 HEAD는 항상 브랜치를 거쳐 커밋을 가리킵니다."],
  ["충돌", "두 브랜치가 공통 조상에서 같은 줄을 다르게 바꿔 자동 병합이 멈춘 상태입니다."],
  [
    "모델의 범위",
    "로컬 저장소 하나, 브랜치 두 개, 파일 하나, 텍스트 충돌 하나의 고정 시나리오입니다. 원격 저장소·push·pull·rebase·fast-forward는 다루지 않습니다. C0–C3는 실제 해시가 아닌 이름이고, 장치 사이의 이동은 저장 상태의 변화를 나타낼 뿐 Git 내부 구조나 처리 시간이 아닙니다.",
  ],
];

/* ---------------------------------------------------------------- markup */

$("#app").outerHTML = `
<div class="hw-page git-page">
  <header class="hw-topbar">
    <div class="hw-brand"><h1>Git 탐색기</h1><p>브랜치 분기부터 충돌 해결까지</p></div>
    <div class="hw-context"><span class="hw-label"><span class="hw-index">01</span> 하나의 파일, 서로 다른 두 제목</span><strong>갈라진 작업을 하나의 이력으로</strong></div>
    <div class="hw-actions">
      <button class="hw-key hw-key--sm" data-action="compare">${icon("compare")}<span>해결안 비교</span></button>
      <button class="hw-key hw-key--sm hw-key--icon" data-action="theme" aria-label="어두운 테마로 전환">${icon("moon")}</button>
    </div>
  </header>

  <main class="hw-console">
    <section class="hw-plate hw-stage" aria-labelledby="stage-label">
      <div class="hw-plate-head">
        <span class="hw-label" id="stage-label"><span class="hw-index">A</span> 파일과 저장소</span>
        <span class="hw-tag">${FILE_NAME}</span>
        <span class="hw-lcd" aria-label="현재 사건"><span id="step-count">00</span><small>/ 12 사건</small></span>
      </div>
      <div class="hw-scene" id="git-scene"></div>
      <div class="hw-screen git-well" id="well" aria-label="welcome.txt 내용"></div>
      <div class="hw-plate-foot" aria-live="polite"><span class="hw-led" id="status-led"></span><span id="status"></span></div>
    </section>

    <section class="hw-plate hw-deck" aria-label="재생 조작">
      <div class="hw-field">
        <span class="hw-label">재생</span>
        <div class="hw-transport">
          <button class="hw-key hw-key--icon" data-action="reset" aria-label="처음으로">${icon("reset")}</button>
          <button class="hw-key hw-key--icon" data-action="back" aria-label="이전 사건">${icon("back")}</button>
          <button class="hw-key hw-key--accent git-play" data-action="play"></button>
          <button class="hw-key" data-action="next">다음 사건${icon("next")}</button>
          <button class="hw-key hw-key--icon" data-action="replay" aria-label="이번 사건 다시 보기">${icon("replay")}</button>
          <button class="hw-key hw-key--icon hw-mono" data-action="speed" aria-label="재생 속도 1배">1×</button>
        </div>
      </div>
      <div class="hw-seek"><span class="hw-label">00</span><input id="seek" class="hw-slider" type="range" min="0" max="12" step="1" value="0" aria-label="현재 사건"/><span class="hw-label">12</span></div>
      <div class="git-deck-foot">
        <button class="hw-switch" role="switch" aria-checked="true" data-action="guided">핵심 장면에서 멈추기</button>
        <span class="hw-muted" id="playback-hint"></span>
      </div>
    </section>

    <aside class="hw-plate hw-side" aria-labelledby="lesson-title">
      <div class="hw-plate-head">
        <span class="hw-label"><span class="hw-index">B</span> <span id="lesson-counter">시작 전</span></span>
        <div class="hw-tabs" aria-label="단계 해설 보기">
          <button type="button" data-tab="now" aria-selected="true">해설</button>
          <button type="button" data-tab="change">변화</button>
          <button type="button" data-tab="scenes">장면</button>
        </div>
      </div>
      <div class="hw-plate-body hw-fit" data-panel="now" aria-label="이번 사건 해설">
        <div class="hw-fill git-pages" id="now-pages">
          <div class="git-intro">
            <span class="hw-label" id="eyebrow"></span>
            <h2 class="hw-title git-lesson-title" id="lesson-title"></h2>
            <p class="hw-text git-lesson-body" id="lesson-body"></p>
            <p class="git-command"><span class="hw-label" id="command-label"></span><code class="hw-mono" id="command"></code></p>
          </div>
          <div id="resolution">
            <span class="hw-label"><span class="hw-index">!</span> 직접 해결 · 파일에 남길 제목은?</span>
            <div class="hw-list git-choices">${RESOLUTIONS.map((r, i) => `<button data-resolution="${r.id}"><span class="hw-index">${pad(i + 1)}</span><span class="git-choice"><span>${esc(r.label)}</span><span class="hw-muted">${esc(titleOf(r.content))}</span></span></button>`).join("")}</div>
          </div>
          <div id="chosen">
            <span class="hw-label">선택한 해결안</span>
            <div class="git-chosen"><strong id="chosen-label"></strong><button class="hw-key hw-key--sm" data-action="choose-again">다른 해결안으로</button></div>
          </div>
          <div class="hw-note hw-note--accent" id="takeaway"></div>
          <div id="predict-section">
            <button class="hw-key git-wide" data-action="predict">병합하면 어떻게 될까? 먼저 맞혀보기${icon("arrow")}</button>
          </div>
        </div>
      </div>
      <div class="hw-plate-body hw-fit" data-panel="change" aria-label="직전과 현재 비교" hidden>
        <div class="hw-fill git-pages" id="change-pages">
          <div>
            <span class="hw-label">직전 → 현재</span>
            <table class="hw-table git-facts"><tbody id="facts"></tbody></table>
          </div>
        </div>
      </div>
      <div class="hw-plate-body hw-fit" data-panel="scenes" aria-label="핵심 장면" hidden>
        <span class="hw-label git-pages-label">핵심 장면으로 이동</span>
        <div class="hw-fill hw-list git-milestones" id="milestones"></div>
      </div>
    </aside>

    <section class="hw-plate hw-records">
      <div class="hw-plate-head">
        <div class="hw-tabs" role="tablist" aria-label="학습 기록">
          <button role="tab" id="tab-log" aria-controls="record-log" aria-selected="true" data-record="log">사건 기록</button>
          <button role="tab" id="tab-commits" aria-controls="record-commits" aria-selected="false" data-record="commits" tabindex="-1">커밋 이력</button>
          <button role="tab" id="tab-result" aria-controls="record-result" aria-selected="false" data-record="result" tabindex="-1">병합 결과</button>
          <button role="tab" id="tab-terms" aria-controls="record-terms" aria-selected="false" data-record="terms" tabindex="-1">용어와 범위</button>
        </div>
        <span class="hw-label git-records-hint">행을 눌러 그 순간으로 이동</span>
      </div>
      <div class="hw-plate-body hw-scroll" role="tabpanel" id="record-log" aria-labelledby="tab-log">
        <div class="git-rows"><table class="hw-table git-log"><thead><tr><th>#</th><th>명령</th><th>일어난 일</th><th>HEAD</th></tr></thead><tbody id="log-rows"></tbody></table></div>
      </div>
      <div class="hw-plate-body hw-scroll" role="tabpanel" id="record-commits" aria-labelledby="tab-commits" hidden>
        <div class="git-rows"><table class="hw-table"><thead><tr><th>커밋</th><th>부모</th><th>브랜치</th><th>메시지</th><th>제목 줄</th></tr></thead><tbody id="commit-rows"></tbody></table></div>
      </div>
      <div class="hw-plate-body" role="tabpanel" id="record-result" aria-labelledby="tab-result" hidden></div>
      <div class="hw-plate-body git-terms-body" role="tabpanel" id="record-terms" aria-labelledby="tab-terms" hidden>
        <dl class="git-glossary" id="glossary">${glossary.map(([term, text]) => `<div><dt>${esc(term)}</dt><dd class="hw-text">${esc(text)}</dd></div>`).join("")}</dl>
      </div>
    </section>
  </main>

  <footer class="hw-footer">
    <span>조작: <kbd>Space</kbd> 재생·정지 <kbd>←</kbd><kbd>→</kbd> 사건 이동 <kbd>R</kbd> 처음으로</span>
    <span>학습 근거 ${SOURCES.map((s) => `<a href="${s.url}" target="_blank" rel="noreferrer">${esc(s.title)}</a>`).join(" · ")}</span>
  </footer>
  <dialog class="hw-dialog" id="prediction-dialog" aria-labelledby="prediction-title"></dialog>
  <dialog class="hw-dialog" id="compare-dialog" aria-labelledby="compare-title"></dialog>
</div>`;

/* ---------------------------------------------------------------- fit */

// On the desktop console nothing scrolls: the lesson is split into tabs and
// pages, the records show a window of rows around the current one.
const desktop = matchMedia("(min-width: 1100px) and (min-height: 700px)");
const fragment = (html) => document.createRange().createContextualFragment(html).firstElementChild;
const now = {
  intro: $(".git-intro"),
  resolution: $("#resolution"),
  chosen: $("#chosen"),
  takeaway: $("#takeaway"),
  predict: $("#predict-section"),
};
const facts = $("#change-pages").firstElementChild;
const sideTabs = plateTabs($(".hw-side"));
const nowPages = paginate($("#now-pages"), { label: "해설 쪽" });
const changePages = paginate($("#change-pages"), { label: "변화 쪽" });
const scenePages = paginate($("#milestones"), { label: "장면 쪽" });
paginate($("#glossary"), { label: "용어 쪽" });
const logRows = rowWindow($("#record-log .git-rows"), $("#log-rows"), { current: () => $("#log-rows tr[aria-current]") });
const commitRows = rowWindow($("#record-commits .git-rows"), $("#commit-rows"));
let shownIndex = -1;
// Row heights settle once the web fonts are in.
document.fonts?.ready.then(() => {
  logRows.refresh();
  commitRows.refresh();
});

/* ---------------------------------------------------------------- scene */

const scene = createGitScene($("#git-scene"), {
  onPhase(next) {
    phase = next;
    renderState(next.state);
  },
});

/** Working tree, index and HEAD commit as text, in the stage's LCD well. */
function fileLines(content, head) {
  const headLines = head?.trimEnd().split("\n") ?? [];
  const lines = content.trimEnd().split("\n");
  const kind = contentKind(content);
  let side = null; // inside a conflict: the ours (main) or theirs (feature) half
  return lines
    .map((line, i) => {
      const marker = /^(<<<<<<<|=======|>>>>>>>)/.exec(line)?.[1];
      if (marker) side = { "<<<<<<<": "main", "=======": "feature", ">>>>>>>": null }[marker];
      let cls = marker ? "is-marker" : line.startsWith("제목:") ? "" : "is-plain";
      if (!marker && line.startsWith("제목:")) cls = `is-${kind === "conflict" ? side : kind}`;
      const changed = head != null && lines.length === headLines.length && line !== headLines[i];
      return `<li class="${cls} ${changed ? "is-changed" : ""}"><span class="git-ln">${i + 1}</span><span>${esc(line)}</span></li>`;
    })
    .join("");
}
function renderWell(state) {
  const head = headCommit(state);
  const work = `<div class="git-well-col"><span class="git-well-head">작업 트리</span><ol>${fileLines(state.working, head.content)}</ol></div>`;
  let idx;
  if (state.index.stages) {
    const rows = [
      ["1", "base", "공통 조상"],
      ["2", "ours", "현재 main"],
      ["3", "theirs", "가져올 쪽"],
    ]
      .filter(([, key]) => state.index.stages[key])
      .map(([n, key, label]) => {
        const content = state.index.stages[key];
        return `<li class="is-${contentKind(content)}"><span class="git-ln">${n}</span><span><span class="git-stage-name">${label} ${state.merge?.[key] ?? ""}</span>${esc(titleOf(content))}</span></li>`;
      })
      .join("");
    const heading = state.index.status === "comparing" ? "인덱스 · 세 버전 대조 중" : "인덱스 · stage 1·2·3";
    idx = `<div class="git-well-col"><span class="git-well-head">${heading}</span><ol>${rows || '<li class="git-well-empty"><span class="git-ln"></span><span>…</span></li>'}</ol></div>`;
  } else {
    idx = `<div class="git-well-col"><span class="git-well-head">인덱스</span><ol>${fileLines(state.index.content, head.content)}</ol></div>`;
  }
  const commit = `<div class="git-well-col"><span class="git-well-head">HEAD 커밋 ${head.id}</span><ol>${fileLines(head.content)}</ol></div>`;
  $("#well").innerHTML = work + idx + commit;
  fitWell();
}
/** Beside a short scene the well drops the lines that never change. */
function fitWell() {
  const well = $("#well");
  well.classList.remove("is-compact", "is-tight");
  if (!desktop.matches) return;
  if (well.scrollHeight > well.clientHeight + 1) well.classList.add("is-compact");
  if (well.scrollHeight > well.clientHeight + 1) well.classList.add("is-tight");
}
new ResizeObserver(fitWell).observe($(".hw-stage"));

function statusLine(state) {
  if (busy && phase && phase.kind !== "complete") return [phase.title, phase.body];
  if (state.merge) {
    if (state.status === "conflict") return [stateNames.conflict];
    if (state.index.status === "unmerged") return [stateNames.resolved];
    return ["해결 등록 완료 · 병합 커밋을 기다립니다"];
  }
  if (index === last) return ["병합 완료 · 두 작업의 이력을 함께 보존했습니다"];
  return [stateNames[state.status]];
}

function renderState(state) {
  renderWell(state);
  const [title, body] = statusLine(state);
  $("#status").innerHTML = `${esc(title)}${body ? `<span class="hw-muted"> — ${esc(body)}</span>` : ""}`;
  const led = $("#status-led");
  const conflict = state.status === "conflict" || state.index.status === "unmerged" || state.index.status === "comparing";
  led.classList.toggle("is-on", busy || conflict);
  led.style.setProperty("--led", conflict ? "var(--git-conflict)" : "var(--accent)");
  const before = run.steps[index].before;
  const rows = [
    ["현재 커밋", before.refs[before.currentBranch], state.refs[state.currentBranch]],
    ["인덱스", indexLabel(before), indexLabel(state)],
    ["커밋 수", before.commits.length, state.commits.length],
  ];
  $("#facts").innerHTML = rows
    .map(([label, a, b]) => `<tr class="${a !== b ? "is-changed" : ""}"><th scope="row">${label}</th><td class="hw-muted">${esc(a)}</td><td>${esc(b)}</td></tr>`)
    .join("");
}

/* ---------------------------------------------------------------- render */

function render() {
  const step = run.steps[index];
  const lesson = describeStep(step);
  $("#step-count").textContent = pad(index);
  const seek = $("#seek");
  seek.value = index;
  seek.setAttribute("aria-valuetext", `${index} / 12 사건${busy ? " 처리 중" : ""}`);
  syncSlider(seek);
  $("#lesson-counter").textContent = index ? `${pad(index)} / 12${busy ? " · 처리 중" : ""}` : "시작 전";
  $("#eyebrow").textContent = lesson.eyebrow;
  $("#lesson-title").textContent = lesson.title;
  $("#lesson-body").textContent = lesson.body;
  $("#command-label").textContent = step.command ? "실행 명령" : index === 0 ? "명령" : "작업 파일 편집";
  $("#command").textContent =
    step.command ||
    (index === 0 ? "아직 실행한 명령이 없습니다" : index === 10 ? "충돌 표시를 지우고 선택한 제목을 저장" : `${FILE_NAME}의 제목을 수정하고 저장`);
  $("#command").classList.toggle("is-git", Boolean(step.command));
  $("#takeaway").textContent = lesson.takeaway;
  $("#git-scene").dataset.focus = lesson.focus;
  if (choice) now.chosen.querySelector("#chosen-label").textContent = RESOLUTIONS.find((r) => r.id === choice).label;
  if ($("#prediction-dialog").open) $("#prediction-dialog").close();
  $("#now-pages").replaceChildren(
    ...[
      now.intro,
      !busy && index === 9 && now.resolution,
      index >= 10 && choice && now.chosen,
      now.takeaway,
      !busy && index === 8 && now.predict,
    ].filter(Boolean),
  );
  $("#change-pages").replaceChildren(
    facts,
    ...lesson.details.map((d) => fragment(`<p class="git-detail"><span class="hw-led is-on"></span><span>${esc(d)}</span></p>`)),
  );
  const reached = MILESTONES.filter((m) => m.index <= index).at(-1)?.index;
  $("#milestones").innerHTML = MILESTONES.map(
    (m, i) =>
      `<button data-seek="${m.index}"${reached === m.index ? ' aria-current="true"' : ""}><span class="hw-index">${pad(i + 1)}</span>${esc(m.label)}<span class="hw-mono hw-muted git-push">${index > m.index ? "✓ " : ""}${pad(m.index)}</span></button>`,
  ).join("");
  renderState(busy ? step.before : step.state);
  renderRecords();
  controls();
  nowPages.refresh();
  changePages.refresh();
  scenePages.refresh();
  if (shownIndex !== index) {
    // A new moment opens on its first page.
    shownIndex = index;
    nowPages.show(0);
    changePages.show(0);
  }
}

function controls() {
  const moving = playing || (busy && !paused);
  const gated = index === 9 && !busy;
  const play = $('[data-action="play"]');
  let label = index ? "이어서 재생" : "학습 시작";
  if (moving) label = "일시정지";
  else if (gated) label = "해결안 선택";
  else if (completed === last) label = "처음부터 재생";
  play.innerHTML = `${icon(moving ? "pause" : "play")}<span>${label}</span>`;
  play.setAttribute("aria-label", label);
  $('[data-action="next"]').disabled = index === last || busy || gated;
  $('[data-action="back"]').disabled = index === 0;
  $('[data-action="replay"]').disabled = index === 0 || busy;
  $('[data-action="guided"]').setAttribute("aria-checked", String(guided));
  $("#git-scene").setAttribute("aria-busy", String(busy));
  $("#playback-hint").textContent = gated
    ? "‘해결안 선택’을 눌러 파일에 남길 제목을 고르세요."
    : busy
      ? paused
        ? "이동과 상태를 함께 멈췄습니다."
        : "스냅샷과 브랜치 표지의 이동을 보세요."
      : index === last
        ? "병합 커밋 C3의 두 부모를 확인하세요."
        : "다음 사건을 실행하거나 기록에서 바로 이동하세요.";
}

function renderRecords() {
  $("#log-rows").innerHTML = run.steps
    .map((s) => {
      const st = s.state;
      const future = s.index > completed;
      return `<tr data-time="${s.index}" tabindex="0"${s.index === index ? ' aria-current="true"' : ""} class="${future ? "is-future" : ""}"><td class="hw-mono">${pad(s.index)}</td><td><code class="hw-mono">${esc(s.command || (s.index ? "직접 편집" : "—"))}</code></td><td>${esc(s.title)}</td><td class="hw-mono">${future ? "" : `${esc(st.currentBranch)} → ${st.refs[st.currentBranch]}`}</td></tr>`;
    })
    .join("");
  logRows.refresh();

  const state = run.steps[completed].state;
  $("#commit-rows").innerHTML = state.commits
    .map(
      (c) =>
        `<tr><td class="hw-mono"><span class="hw-led is-on" style="--led:var(--git-${c.id === "C0" ? "base" : c.branch === "main" ? "main" : "feature"})"></span> ${c.id}</td><td class="hw-mono">${c.parents.join(" + ") || "없음"}</td><td class="hw-mono">${esc(c.branch)}</td><td>${esc(c.message)}</td><td>${esc(titleOf(c.content))}</td></tr>`,
    )
    .join("");
  commitRows.refresh();

  const chosen = RESOLUTIONS.find((r) => r.id === choice);
  $("#record-result").innerHTML =
    completed === last && chosen
      ? `<div class="git-result">
          <div>
            <span class="hw-label">병합 완료 · 갈라진 두 이력, 하나의 병합 커밋</span>
            <p class="hw-text git-gap">‘${esc(chosen.label)}’ 해결안을 C3에 기록했습니다. 최종 제목은 <strong>${esc(titleOf(state.working))}</strong>입니다.</p>
            <p class="hw-text hw-muted">병합은 기존 커밋과 브랜치를 지우지 않습니다.</p>
            <button class="hw-key hw-key--sm git-gap" data-action="choose-again">다른 제목으로 결과 비교${icon("arrow")}</button>
          </div>
          <table class="hw-table"><tbody>
            <tr><th scope="row">부모 커밋</th><td class="hw-mono">C2 + C1</td></tr>
            <tr><th scope="row">현재 위치</th><td class="hw-mono">main → C3</td></tr>
            <tr><th scope="row">기능 브랜치</th><td class="hw-mono">feature/title → C1</td></tr>
            <tr><th scope="row">C2와 다른 줄</th><td class="hw-mono">${chosen.id === "ours" ? "0" : "1"}</td></tr>
          </tbody></table>
        </div>`
      : `<p class="hw-text hw-muted">${state.commits.length}개 커밋 · 충돌을 해결하고 병합 커밋까지 실행하면 최종 결과가 나타납니다. (파일 편집 → 해결안 등록 → 병합 커밋)</p>`;
}

/* ---------------------------------------------------------------- flow */

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
  if (playing && !busy && index < last) timer = setTimeout(() => move(index + 1, true), 560 / speed);
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
  resumeAutomatically = playing;
  paused = false;
  phase = null;
  render();
  await scene.update(run.steps[index], { animate: motion, speed });
  if (token !== revision) return;
  completed = index;
  busy = false;
  paused = false;
  render();
  if (index === last || index === 9 || (playing && guided && [4, 8].includes(index))) playing = false;
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
function showResolutionChoices() {
  const panel = now.resolution;
  if (!panel.isConnected) return;
  sideTabs.select("now");
  nowPages.showItem(panel);
  if (!desktop.matches) panel.scrollIntoView({ behavior: "instant", block: "center" });
  panel.querySelector("button").focus({ preventScroll: true });
}
function play() {
  if (playing || (busy && !paused)) {
    pause();
    return;
  }
  if (index === 9 && !busy) {
    showResolutionChoices();
    return;
  }
  if (completed === last && !busy) reset();
  playing = busy ? resumeAutomatically : true;
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
function resolveWith(id) {
  pause();
  choice = id;
  run = simulateGit(choice);
  move(10, true);
}
function chooseAgain() {
  choice = null;
  run = simulateGit();
  jump(9);
  showResolutionChoices();
}
function selectRecord(name) {
  for (const b of $$("[data-record]")) {
    const selected = b.dataset.record === name;
    b.setAttribute("aria-selected", String(selected));
    b.tabIndex = selected ? 0 : -1;
  }
  for (const n of ["log", "commits", "result", "terms"]) $(`#record-${n}`).hidden = n !== name;
  $(".git-records-hint").hidden = name !== "log";
}

/* ---------------------------------------------------------------- dialogs */

const dialogHead = (id, eyebrow, title) =>
  `<div class="hw-plate-head"><div class="git-dialog-title"><span class="hw-label">${eyebrow}</span><h2 class="hw-title" id="${id}">${esc(title)}</h2></div><button class="hw-key hw-key--sm hw-key--icon" data-action="close" aria-label="닫기">${icon("close")}</button></div>`;

function predict() {
  pause();
  const q = PREDICTION;
  $("#prediction-dialog").innerHTML = `${dialogHead("prediction-title", "실행 전에 예상해 보기", q.question)}
    <div class="hw-plate-body">
      <p class="hw-text">main → C2, feature/title → C1. 두 브랜치가 같은 제목 줄을 다르게 수정했습니다.</p>
      <div class="git-answers">${q.choices.map((c, i) => `<button class="hw-key" data-answer="${c.id}"><span class="hw-index">${pad(i + 1)}</span>${esc(c.text)}</button>`).join("")}</div>
      <div id="prediction-feedback" aria-live="polite"></div>
    </div>`;
  $("#prediction-dialog").showModal();
}
function answer(id) {
  const picked = PREDICTION.choices.find((c) => c.id === id);
  for (const el of $$("[data-answer]")) {
    const c = PREDICTION.choices.find((x) => x.id === el.dataset.answer);
    el.disabled = true;
    if (c.correct) el.insertAdjacentHTML("beforeend", '<span class="hw-led is-on git-push"></span>');
    else if (c.id === id) el.insertAdjacentHTML("beforeend", '<span class="hw-led is-on git-push" style="--led:var(--git-conflict)"></span>');
  }
  $("#prediction-feedback").innerHTML = `<div class="hw-section git-feedback"><p class="hw-text"><strong>${picked.correct ? "맞았습니다." : "충돌이 나면 병합 커밋은 아직 만들어지지 않습니다."}</strong> ${esc(picked.feedback)}</p><button class="hw-key hw-key--accent git-gap" data-action="verify">병합 실행해서 확인${icon("arrow")}</button></div>`;
}

function compare() {
  pause();
  const head = run.steps[8].state.commits.find((c) => c.id === "C2");
  $("#compare-dialog").innerHTML = `${dialogHead("compare-title", "해결안 비교", "세 해결안의 병합 결과")}
    <div class="hw-plate-body">
      <p class="hw-text">세 해결안 모두 C2와 C1을 부모로 갖는 C3를 만듭니다. 달라지는 것은 C3에 담기는 제목 줄입니다.</p>
      <table class="hw-table git-gap"><thead><tr><th>해결안</th><th>C3의 제목 줄</th><th>C2와 다른 줄</th><th></th></tr></thead><tbody>
        ${RESOLUTIONS.map((r) => {
          const final = simulateGit(r.id).steps[last].state;
          const diff = final.commits.find((c) => c.id === "C3").content === head.content ? 0 : 1;
          return `<tr${r.id === choice ? ' aria-current="true"' : ""}><td>${esc(r.label)}<div class="hw-muted">${esc(r.description)}</div></td><td>${esc(titleOf(r.content))}</td><td class="hw-mono">${diff}</td><td><button class="hw-key hw-key--sm" data-compare="${r.id}">${r.id === choice ? "다시 보기" : "이 해결안으로"}</button></td></tr>`;
        }).join("")}
      </tbody></table>
    </div>`;
  $("#compare-dialog").showModal();
}

/* ---------------------------------------------------------------- events */

document.addEventListener("click", (e) => {
  const row = e.target.closest("tr[data-time]");
  if (row) {
    jump(Number(row.dataset.time));
    return;
  }
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.seek) return jump(Number(b.dataset.seek));
  if (b.dataset.record) return selectRecord(b.dataset.record);
  if (b.dataset.resolution) return resolveWith(b.dataset.resolution);
  if (b.dataset.answer) return answer(b.dataset.answer);
  if (b.dataset.compare) {
    $("#compare-dialog").close();
    return resolveWith(b.dataset.compare);
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
      b.setAttribute("aria-label", `재생 속도 ${speed}배`);
      scene.setSpeed(speed);
      schedule();
      break;
    case "guided":
      guided = !guided;
      controls();
      break;
    case "predict":
      predict();
      break;
    case "compare":
      compare();
      break;
    case "close":
      b.closest("dialog").close();
      break;
    case "verify":
      $("#prediction-dialog").close();
      move(9, true);
      break;
    case "choose-again":
      chooseAgain();
      break;
    case "theme": {
      const dark = document.documentElement.dataset.theme !== "dark";
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      localStorage.setItem("git-theme", dark ? "dark" : "light");
      syncThemeKey();
      break;
    }
  }
});
$("#seek").addEventListener("input", (e) => jump(Number(e.target.value)));
$(".hw-tabs").addEventListener("keydown", (e) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
  const tabs = $$("[data-record]");
  const at = tabs.indexOf(document.activeElement);
  if (at < 0) return;
  e.preventDefault();
  const next =
    e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : (at + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  tabs[next].focus();
  selectRecord(tabs[next].dataset.record);
});
$("#record-log").addEventListener("keydown", (e) => {
  const row = e.target.closest("tr[data-time]");
  if (!row || (e.key !== "Enter" && e.key !== " ")) return;
  e.preventDefault();
  jump(Number(row.dataset.time));
});
document.addEventListener("keydown", (e) => {
  if (document.querySelector("dialog[open]") || e.target.closest?.("input,select,textarea,button,a,summary,tr[data-time]")) return;
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

function syncThemeKey() {
  const dark = document.documentElement.dataset.theme === "dark";
  const key = $('[data-action="theme"]');
  key.innerHTML = icon(dark ? "sun" : "moon");
  key.setAttribute("aria-label", dark ? "밝은 테마로 전환" : "어두운 테마로 전환");
}
document.documentElement.dataset.theme = localStorage.getItem("git-theme") || "light";
syncThemeKey();
bindSliders(document);
render();
scene.update(run.steps[0]);

// Deep link to a moment: ?step=12&choice=both (add &animate to play into it).
const query = new URLSearchParams(location.search);
if (RESOLUTIONS.some((r) => r.id === query.get("choice"))) {
  choice = query.get("choice");
  run = simulateGit(choice);
}
const startAt = Number(query.get("step"));
if (startAt > 0) {
  if (query.has("animate")) move(startAt - 1, false).then(() => move(startAt, true));
  else move(startAt, false);
}
