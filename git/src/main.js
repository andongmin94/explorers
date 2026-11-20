import "../../shared/theme.css";
import "../../shared/hw.css";
import "./styles.css";
import "../../shared/switcher.js";
import "../../shared/iso.js";
import { bindSliders, icon, syncSlider } from "../../shared/hw.js";
import { paginate, plateTabs, rowWindow } from "../../shared/fit.js";
import { RESOLUTIONS, FILE_NAME, lineKinds } from "./engine.js";
import { createGitScene } from "./scene.js";
import { LABELS, createProgress, recapHtml, bindRecap, progressHtml } from "../../shared/lesson-kit.js";
import { currentLesson, mountRail, nextLesson, progressIdFor } from "../../shared/lesson-rail.js";
import { LESSONS } from "./lessons.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (text) =>
  String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const pad = (n) => String(n).padStart(2, "0");

/* The lesson this page runs (?lesson=…, the bare page opens the first). */
const lesson = currentLesson(LESSONS);
const lessonNumber = pad(LESSONS.indexOf(lesson) + 1);
const GATE = lesson.gate?.step ?? -1;

let choice = lesson.defaultVariant,
  run = lesson.simulate(choice),
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
const lastIndex = () => run.steps.length - 1;
const guidedStops = () => lesson.guidedStops(choice);
const progress = createProgress(progressIdFor("git", LESSONS, lesson.id), {
  scenes: lesson.sceneTotal,
  recall: lesson.recap.recall.length,
});
// Predictions answered or passed by: their step then shows what answers them.
const settled = new Set();
const pendingAt = (i) => lesson.hasPrediction(i, choice) && !settled.has(i);
let needsRender = false;

const indexNames = {
  clean: "커밋과 같음",
  staged: "다음 커밋 준비",
  unmerged: "미해결 세 버전",
  comparing: "세 버전 기록 중",
};
const indexLabel = (state, pending = false) =>
  state.merge && state.index.status === "staged"
    ? "해결 등록 완료"
    : pending && state.index.status === "unmerged"
      ? "stage 1·2·3"
      : indexNames[state.index.status];
const titleOf = (content) => content.split("\n").find((line) => line.startsWith("제목:"))?.replace(/^제목:\s*/, "") ?? "";
const headCommit = (state) => state.commits.find((c) => c.id === state.refs[state.currentBranch]);

/* ---------------------------------------------------------------- markup */

$("#app").outerHTML = `
<div class="hw-page git-page">
  <header class="hw-topbar">
    <div class="hw-brand"><h1>Git 탐색기</h1><p>브랜치와 병합</p></div>
    <div class="hw-context"><span class="hw-label"><span class="hw-index">${lessonNumber}</span> 레슨</span><strong>${esc(lesson.title)}</strong></div>
    <div class="hw-actions">
      <button class="hw-key hw-key--sm" data-action="compare">${icon("compare")}<span>${esc(lesson.compareLabel)}</span></button>
      <button class="hw-key hw-key--sm hw-key--icon" data-action="theme" aria-label="어두운 테마로 전환">${icon("moon")}</button>
    </div>
  </header>

  <main class="hw-console">
    <section class="hw-plate hw-stage" aria-labelledby="stage-label">
      <div class="hw-plate-head">
        <span class="hw-label" id="stage-label"><span class="hw-index">A</span> 파일과 저장소</span>
        <span class="hw-tag">${FILE_NAME}</span>
        <span class="hw-lcd" aria-label="현재 사건"><span id="step-count">00</span><small id="step-total"></small></span>
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
      <div class="hw-seek"><span class="hw-label">00</span><input id="seek" class="hw-slider" type="range" min="0" max="${lastIndex()}" step="1" value="0" aria-label="현재 사건"/><span class="hw-label" id="seek-end"></span></div>
      <div class="git-deck-foot">
        <button class="hw-switch" role="switch" aria-checked="true" data-action="guided">${LABELS.guided}</button>
        <span class="hw-muted" id="playback-hint"></span>
      </div>
    </section>

    <aside class="hw-plate hw-side" aria-labelledby="lesson-title">
      <div class="hw-plate-head">
        <span class="hw-label"><span class="hw-index">B</span> <span id="lesson-counter">시작 전</span></span>
        <div class="hw-tabs" aria-label="사건 해설 보기">
          <button type="button" data-tab="now" aria-selected="true">${LABELS.explainTab}</button>
          <button type="button" data-tab="scenes">${LABELS.scenesTab}</button>
          <button type="button" data-tab="change">변화</button>
          <button type="button" data-tab="scope">${LABELS.scopeTab}</button>
        </div>
      </div>
      <div class="hw-plate-body hw-fit" data-panel="now" aria-label="이번 사건 해설">
        <div class="hw-fill git-pages" id="now-pages">
          <div class="git-intro">
            <span class="hw-label" id="eyebrow"></span>
            <h2 class="hw-title git-lesson-title" id="lesson-title"></h2>
            <p class="hw-text git-lesson-body" id="lesson-body"></p>
            <p class="git-command" id="command-line"><span class="hw-label" id="command-label"></span><code class="hw-mono" id="command"></code></p>
          </div>
          <p class="hw-text git-goal" id="goal"></p>
          <div id="resolution">
            <span class="hw-label"><span class="hw-index">!</span> 직접 해결 · 파일에 남길 제목은?</span>
            <div class="hw-list git-choices">${RESOLUTIONS.map((r, i) => `<button data-resolution="${r.id}"><span class="hw-index">${pad(i + 1)}</span><span class="git-choice"><span>${esc(r.label)}</span><span class="hw-muted">${esc(titleOf(r.content))}</span></span></button>`).join("")}</div>
          </div>
          <div id="chosen">
            <span class="hw-label" id="chosen-head">선택한 해결안</span>
            <div class="git-chosen"><strong id="chosen-label"></strong><button class="hw-key hw-key--sm" data-action="choose-again">다른 해결안으로</button></div>
          </div>
          <div class="git-terminal" id="terminal"><span class="hw-label">터미널 출력</span><pre class="hw-mono" id="terminal-text"></pre></div>
          <p class="hw-note hw-note--accent" id="takeaway"><span><span class="hw-label git-key-label">${LABELS.key}</span><span id="takeaway-text"></span></span></p>
          <div id="predict-section">
            <button class="hw-key git-wide" data-action="predict"><span id="predict-label"></span></button>
          </div>
        </div>
      </div>
      <div class="hw-plate-body hw-fit" data-panel="scenes" aria-label="${LABELS.scene}" hidden>
        <span class="hw-label git-pages-label">${LABELS.jumpToScene}</span>
        <div class="hw-fill hw-list git-milestones" id="milestones"></div>
      </div>
      <div class="hw-plate-body hw-fit" data-panel="change" aria-label="직전과 현재 비교" hidden>
        <div class="hw-fill git-pages" id="change-pages">
          <div>
            <span class="hw-label">${LABELS.now} 사건 · 직전 → 현재</span>
            <table class="hw-table git-facts"><tbody id="facts"></tbody></table>
          </div>
        </div>
      </div>
      <div class="hw-plate-body hw-fit" data-panel="scope" aria-label="용어와 모델의 범위" hidden>
        <dl class="hw-fill git-glossary" id="glossary">${lesson.scope.map(([term, text]) => `<div><dt>${esc(term)}</dt><dd class="hw-text">${esc(text)}</dd></div>`).join("")}</dl>
      </div>
    </aside>

    <section class="hw-plate hw-records">
      <div class="hw-plate-head">
        <div class="hw-tabs" role="tablist" aria-label="학습 기록">
          <button role="tab" id="tab-log" aria-controls="record-log" aria-selected="true" data-record="log">사건 기록</button>
          <button role="tab" id="tab-commits" aria-controls="record-commits" aria-selected="false" data-record="commits" tabindex="-1">커밋 이력</button>
          <button role="tab" id="tab-result" aria-controls="record-result" aria-selected="false" data-record="result" tabindex="-1">병합 결과</button>
        </div>
        <span class="hw-label git-records-hint">행을 눌러 그 순간으로 이동</span>
      </div>
      <div class="hw-plate-body hw-scroll" role="tabpanel" id="record-log" aria-labelledby="tab-log">
        <div class="git-rows"><table class="hw-table git-log"><thead><tr><th>#</th><th>명령</th><th>일어난 일</th><th>HEAD</th></tr></thead><tbody id="log-rows"></tbody></table></div>
      </div>
      <div class="hw-plate-body hw-scroll" role="tabpanel" id="record-commits" aria-labelledby="tab-commits" hidden>
        <div class="git-rows"><table class="hw-table"><thead><tr><th>커밋</th><th>부모</th><th>브랜치</th><th>메시지</th><th>${esc(lesson.commitColumn.label)}</th></tr></thead><tbody id="commit-rows"></tbody></table></div>
      </div>
      <div class="hw-plate-body" role="tabpanel" id="record-result" aria-labelledby="tab-result" hidden></div>
    </section>
  </main>

  <footer class="hw-footer">
    <span>조작: <kbd>Space</kbd> 재생·정지 <kbd>←</kbd><kbd>→</kbd> 사건 이동 <kbd>R</kbd> 처음으로</span>
    <span>학습 근거 ${lesson.sources.map((s) => `<a href="${s.url}" target="_blank" rel="noreferrer">${esc(s.title)}</a>`).join(" · ")}</span>
  </footer>
  <dialog class="hw-dialog" id="prediction-dialog" aria-labelledby="prediction-title"></dialog>
  <dialog class="hw-dialog git-compare" id="compare-dialog" aria-labelledby="compare-title"></dialog>
</div>`;

const rail = mountRail({ explorer: "git", title: "Git 브랜치와 병합", lessons: LESSONS, current: lesson.id });
rail.watch(progress);

/* ---------------------------------------------------------------- fit */

// On the desktop console nothing scrolls: the lesson is split into tabs and
// pages, the records show a window of rows around the current one.
const desktop = matchMedia("(min-width: 1100px) and (min-height: 700px)");
const fragment = (html) => document.createRange().createContextualFragment(html).firstElementChild;
const now = {
  intro: $(".git-intro"),
  goal: $("#goal"),
  resolution: $("#resolution"),
  chosen: $("#chosen"),
  terminal: $("#terminal"),
  takeaway: $("#takeaway"),
  predict: $("#predict-section"),
};
const facts = $("#change-pages").firstElementChild;
const sideTabs = plateTabs($(".hw-side"));
const nowPages = paginate($("#now-pages"), { label: "해설 쪽" });
const changePages = paginate($("#change-pages"), { label: "변화 쪽" });
const scenePages = paginate($("#milestones"), { label: "장면 쪽" });
const scopePages = paginate($("#glossary"), { label: "범위 쪽" });

// 정리: built once; its sections become items of the 해설 pages at the end.
// It links to the next lesson; the last lesson links to the next experiment.
const recapRoot = fragment(
  recapHtml({
    id: "git",
    points: lesson.recap.points,
    recall: lesson.recap.recall,
    progress,
    next: nextLesson(LESSONS, lesson.id),
  }),
);
bindRecap(recapRoot, {
  recall: lesson.recap.recall,
  progress,
  onAnswer(q) {
    // The answer note just appeared: re-fit and show its page.
    const item = whyItems.get(q.id);
    nowPages.refresh();
    if (item?.isConnected) nowPages.showItem(item);
  },
});
const recapFoot = recapRoot.querySelector(".hw-recap-foot");
// Each answer note is its own page item, so a question never outgrows a page
// on a short window (bindRecap keeps its reference to the note). Wrapped,
// because fit.js would unhide a hidden direct item.
const whyItems = new Map();
for (const why of recapRoot.querySelectorAll(".hw-recall-why")) {
  const box = why.closest("[data-recall]");
  const item = fragment('<div class="git-recall-after"></div>');
  box.after(item);
  item.append(why);
  whyItems.set(box.dataset.recall, item);
}
const recapItems = [...recapRoot.children];
progress.onChange((s) => recapFoot.querySelector(".hw-progress")?.replaceWith(fragment(progressHtml(s))));
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
  layout: lesson.layout,
  onPhase(next) {
    phase = next;
    renderState(next.state);
  },
});

/** One snapshot as LCD lines, each in the colour of whoever wrote it. */
function fileLines(content, head) {
  const headLines = head?.trimEnd().split("\n") ?? [];
  const lines = lineKinds(content, lesson.layout.versions);
  return lines
    .map(({ text, kind, auto }, i) => {
      const cls = kind === "marker" ? "is-marker" : `is-${kind}`;
      const autoTag = auto ? '<span class="git-auto">자동 병합</span>' : "";
      const changed = head != null && lines.length === headLines.length && text !== headLines[i];
      return `<li class="${cls} ${changed ? "is-changed" : ""}"><span class="git-ln">${i + 1}</span><span>${esc(text)}${autoTag}</span></li>`;
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
        return `<li class="is-${scene.kindOf(content)}"><span class="git-ln">${n}</span><span><span class="git-stage-name">${label} ${state.merge?.[key] ?? ""}</span>${esc(titleOf(content))}</span></li>`;
      })
      .join("");
    const heading = state.index.status === "comparing" ? "인덱스 · 세 버전 기록 중" : "인덱스 · stage 1·2·3";
    idx = `<div class="git-well-col"><span class="git-well-head">${heading}</span><ol>${rows || '<li class="git-well-empty"><span class="git-ln"></span><span>…</span></li>'}</ol></div>`;
  } else {
    idx = `<div class="git-well-col"><span class="git-well-head">인덱스</span><ol>${fileLines(state.index.content, head.content)}</ol></div>`;
  }
  const commit = `<div class="git-well-col"><span class="git-well-head">HEAD 커밋 ${esc(head.id)}</span><ol>${fileLines(head.content)}</ol></div>`;
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
  return [lesson.status(state, { index, last: lastIndex(), pending: pendingAt(index), variant: choice })];
}

function renderState(state) {
  renderWell(state);
  const [title, body] = statusLine(state);
  $("#status").innerHTML = `${esc(title)}${body ? `<span class="hw-muted"> — ${esc(body)}</span>` : ""}`;
  const led = $("#status-led");
  // While prediction 10 (lesson 03) is open the LED does not say "still unresolved".
  const hide = pendingAt(index) && state.status === "resolved";
  const conflict = !hide && (state.status === "conflict" || state.index.status === "unmerged" || state.index.status === "comparing");
  led.classList.toggle("is-on", busy || conflict);
  led.style.setProperty("--led", conflict ? "var(--git-conflict)" : "var(--accent)");
  const before = run.steps[index].before;
  const rows = [
    ["현재 커밋", before.refs[before.currentBranch], state.refs[state.currentBranch]],
    ["인덱스", indexLabel(before, hide), indexLabel(state, hide)],
    ["커밋 수", before.commits.length, state.commits.length],
  ];
  $("#facts").innerHTML = rows
    .map(([label, a, b]) => `<tr class="${a !== b ? "is-changed" : ""}"><th scope="row">${label}</th><td class="hw-muted">${esc(a)}</td><td>${esc(b)}</td></tr>`)
    .join("");
}

/* ---------------------------------------------------------------- render */

function render() {
  const last = lastIndex();
  const step = run.steps[index];
  const pending = pendingAt(index);
  const text = lesson.describeStep(step, { pending, variant: choice });
  const ended = index === last && !busy && completed === last;
  $("#step-count").textContent = pad(index);
  $("#step-total").textContent = `/ ${pad(last)} 사건`;
  $("#seek-end").textContent = pad(last);
  const seek = $("#seek");
  seek.max = last;
  seek.value = index;
  seek.setAttribute("aria-valuetext", `${index} / ${last} 사건${busy ? " 처리 중" : ""}`);
  syncSlider(seek);
  $("#lesson-counter").textContent = index ? `${pad(index)} / ${pad(last)}${busy ? " · 처리 중" : ""}` : "시작 전";
  $("#eyebrow").textContent = ended ? `${LABELS.recap} · ${text.eyebrow}` : text.eyebrow;
  $("#lesson-title").textContent = text.title;
  $("#lesson-body").textContent = text.body;
  now.goal.textContent = text.goal ?? "";
  // At the end the 정리 takes the room: the title stays, the step text goes.
  $("#command-line").hidden = index === 0 || ended;
  $("#lesson-body").hidden = ended;
  $("#command-label").textContent = step.command ? "실행 명령" : "작업 트리 편집";
  $("#command").textContent = step.command || lesson.editNote(step);
  $("#command").classList.toggle("is-git", Boolean(step.command));
  $("#command").classList.toggle("hw-mono", Boolean(step.command));
  now.takeaway.querySelector("#takeaway-text").textContent = text.takeaway ?? "";
  // Terminal output: one page item per paragraph (split at blank lines), so a
  // long git status continues on the next page instead of being cut.
  const chunks = (text.terminal ?? []).join("\n").split(/\n\n+/).filter(Boolean);
  now.terminal.querySelector("pre").textContent = chunks[0] ?? "";
  const termMore = chunks.slice(1).map((chunk) => {
    const el = fragment('<div class="git-terminal git-term-more"><pre class="hw-mono"></pre></div>');
    el.firstChild.textContent = chunk;
    return el;
  });
  now.terminal.classList.toggle("has-more", termMore.length > 0);
  const prediction = pending && lesson.predictionAt(index, choice);
  if (prediction) now.predict.querySelector("#predict-label").textContent = LABELS.predict(prediction.target);
  $("#git-scene").dataset.focus = text.focus;
  // Which variant is playing: lesson 03 names the chosen resolution; the others
  // show it only once the learner switched to the second method.
  const variant = lesson.variants.find((v) => v.id === choice);
  const showVariant = lesson.gate ? index >= GATE + 1 && !ended && choice : choice !== lesson.defaultVariant && index > lesson.fork && !ended;
  if (variant) now.chosen.querySelector("#chosen-label").textContent = variant.label;
  now.chosen.querySelector("#chosen-head").textContent = lesson.gate ? "선택한 해결안" : "보고 있는 방식";
  const again = now.chosen.querySelector('[data-action="choose-again"]');
  again.textContent = lesson.gate ? "다른 해결안으로" : LABELS.backToFork;
  if ($("#prediction-dialog").open) $("#prediction-dialog").close();
  $("#now-pages").replaceChildren(
    ...[
      now.intro,
      text.goal && now.goal,
      !busy && index === GATE && now.resolution,
      showVariant && now.chosen,
      text.terminal && now.terminal,
      ...(text.terminal ? termMore : []),
      text.takeaway && !ended && now.takeaway,
      !busy && prediction && now.predict,
      ...(ended ? recapItems : []),
    ].filter(Boolean),
  );
  $("#change-pages").replaceChildren(
    facts,
    ...text.details.map((d) => fragment(`<p class="git-detail"><span class="hw-led is-on"></span><span>${esc(d)}</span></p>`)),
  );
  const milestones = lesson.milestones(choice);
  const reached = milestones.filter((m) => m.index <= index).at(-1)?.index;
  $("#milestones").innerHTML = milestones
    .map(
      (m, i) =>
        `<button data-seek="${m.index}"${reached === m.index ? ' aria-current="true"' : ""}><span class="hw-index">${pad(i + 1)}</span>${esc(m.label)}<span class="hw-mono hw-muted git-push">${index > m.index ? "✓ " : ""}${pad(m.index)}</span></button>`,
    )
    .join("");
  renderState(busy ? step.before : step.state);
  renderRecords();
  controls();
  nowPages.refresh();
  changePages.refresh();
  scenePages.refresh();
  scopePages.refresh();
  if (shownIndex !== index) {
    // A new moment opens on its first page.
    shownIndex = index;
    nowPages.show(0);
    changePages.show(0);
  }
}

function controls() {
  const last = lastIndex();
  const moving = playing || (busy && !paused);
  const gated = index === GATE && !busy;
  const play = $('[data-action="play"]');
  let label = index ? LABELS.resume : LABELS.start;
  if (moving) label = LABELS.pause;
  else if (gated) label = "해결안 선택";
  else if (completed === last) label = LABELS.replay;
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
        ? lesson.gate
          ? "병합 커밋 C3의 두 부모를 확인하세요."
          : `‘${lesson.compareLabel}’에서 다른 방식과 견주어 보세요.`
        : "다음 사건을 실행하거나 기록에서 바로 이동하세요.";
}

function renderRecords() {
  const last = lastIndex();
  $("#log-rows").innerHTML = run.steps
    .map((s) => {
      const st = s.state;
      // Events not yet played show only their number: a future command or
      // title would answer the open prediction ("git add", "두 부모").
      const future = s.index > completed;
      const command = future ? "…" : s.command || (s.index ? "직접 편집" : "—");
      return `<tr data-time="${s.index}" tabindex="0"${s.index === index ? ' aria-current="true"' : ""} class="${future ? "is-future" : ""}"><td class="hw-mono">${pad(s.index)}</td><td>${s.command && !future ? `<code class="hw-mono">${esc(command)}</code>` : esc(command)}</td><td>${future ? "" : esc(s.title)}</td><td class="hw-mono">${future ? "" : `${esc(st.currentBranch)} → ${esc(st.refs[st.currentBranch])}`}</td></tr>`;
    })
    .join("");
  logRows.refresh();

  const state = run.steps[completed].state;
  const colorOf = (c) => (c.parents.length === 0 ? "base" : c.branch === "main" ? "main" : "feature");
  $("#commit-rows").innerHTML = state.commits
    .map(
      (c) =>
        `<tr${c.orphan ? ' class="is-future"' : ""}><td class="hw-mono"><span class="hw-led is-on" style="--led:var(--git-${colorOf(c)})"></span> ${esc(c.id)}</td><td class="hw-mono">${c.parents.join(" + ") || "없음"}</td><td class="hw-mono">${c.orphan ? "없음" : esc(c.branch)}</td><td>${esc(c.message)}</td><td>${esc(lesson.commitColumn.value(c.content))}</td></tr>`,
    )
    .join("");
  commitRows.refresh();

  $("#record-result").innerHTML = completed === last ? resultHtml(state) : `<p class="hw-text hw-muted">${state.commits.length}개 커밋 · 레슨을 끝까지 마치면 최종 결과가 나타납니다.</p>`;
}

/** 병합 결과: what the finished lesson left in the repository. */
function resultHtml(state) {
  if (lesson.gate) {
    const chosen = RESOLUTIONS.find((r) => r.id === choice);
    if (!chosen) return "";
    return `<div class="git-result">
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
    </div>`;
  }
  const summary = lesson.result[choice];
  const merge = state.commits.find((c) => c.parents.length === 2);
  const orphan = state.commits.find((c) => c.orphan);
  return `<div class="git-result">
    <div>
      <span class="hw-label">${esc(summary.headline)}</span>
      <p class="hw-text git-gap">${esc(summary.text)}</p>
      <button class="hw-key hw-key--sm git-gap" data-action="compare">${esc(LABELS.compareEnd)}</button>
    </div>
    <table class="hw-table"><tbody>
      <tr><th scope="row">병합 커밋</th><td class="hw-mono">${merge ? `${esc(merge.id)} · ${merge.parents.join(" + ")}` : "없음"}</td></tr>
      <tr><th scope="row">현재 위치</th><td class="hw-mono">main → ${esc(state.refs.main)}</td></tr>
      <tr><th scope="row">기능 브랜치</th><td class="hw-mono">feature/title → ${esc(state.refs["feature/title"])}</td></tr>
      <tr><th scope="row">커밋 수</th><td class="hw-mono">${state.commits.length}${orphan ? ` (${esc(orphan.id)}은 브랜치 밖)` : ""}</td></tr>
    </tbody></table>
  </div>`;
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
  if (playing && !busy && index < lastIndex()) timer = setTimeout(() => move(index + 1, true), 560 / speed);
}
async function move(next, motion = false) {
  let target = Math.max(0, Math.min(lastIndex(), next));
  if (lesson.gate && target > GATE && !choice) {
    target = GATE;
    playing = false;
  }
  // Moving past a prediction's step without answering it skips it.
  for (const k of lesson.predictionSteps) if (k < target) settled.add(k);
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
  // Progress counts the 핵심 장면 of the lesson's main path.
  if (lesson.guidedStops(lesson.defaultVariant).includes(index) && (lesson.gate || choice === lesson.defaultVariant)) progress.markScene(index);
  render();
  if (index === lastIndex() || index === GATE || (playing && guided && guidedStops().includes(index))) playing = false;
  controls();
  schedule();
}
function jump(next) {
  pause();
  move(next, false);
}
function reset() {
  pause();
  choice = lesson.defaultVariant;
  run = lesson.simulate(choice);
  completed = 0;
  settled.clear();
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
  if (index === GATE && !busy) {
    showResolutionChoices();
    return;
  }
  if (completed === lastIndex() && !busy) reset();
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
/** Play the other method from the fork: lesson 03's resolutions, the others' variants. */
async function playVariant(id) {
  pause();
  choice = id;
  run = lesson.simulate(choice);
  // Predictions after the fork are worded for one method: ask them again.
  for (const k of lesson.predictionSteps) if (k > lesson.fork) settled.delete(k);
  if (lesson.gate) return move(lesson.gate.resume, true);
  await move(lesson.fork, false);
  await move(lesson.fork + 1, true);
}
function chooseAgain() {
  if (!lesson.gate) return jump(lesson.fork);
  choice = null;
  run = lesson.simulate(choice);
  // Prediction 11 is worded for the chosen sentence: ask it again.
  for (const k of lesson.gate.recheck) settled.delete(k);
  jump(GATE);
  showResolutionChoices();
}
function selectRecord(name) {
  for (const b of $$("[data-record]")) {
    const selected = b.dataset.record === name;
    b.setAttribute("aria-selected", String(selected));
    b.tabIndex = selected ? 0 : -1;
  }
  for (const n of ["log", "commits", "result"]) $(`#record-${n}`).hidden = n !== name;
  $(".git-records-hint").hidden = name !== "log";
}

/* ---------------------------------------------------------------- dialogs */

const dialogHead = (id, eyebrow, title) =>
  `<div class="hw-plate-head"><div class="git-dialog-title"><span class="hw-label">${eyebrow}</span><h2 class="hw-title" id="${id}">${esc(title)}</h2></div><button class="hw-key hw-key--sm hw-key--icon" data-action="close" aria-label="닫기">${icon("close")}</button></div>`;

let prediction = null;
function predict() {
  pause();
  const q = (prediction = lesson.predictionAt(index, choice));
  if (!q) return;
  $("#prediction-dialog").innerHTML = `${dialogHead("prediction-title", LABELS.predictTitle, q.question)}
    <div class="hw-plate-body">
      <p class="hw-text">${esc(q.context)}</p>
      <div class="git-answers">${q.choices.map((c, i) => `<button class="hw-key" data-answer="${c.id}"><span class="hw-index">${pad(i + 1)}</span>${esc(c.text)}</button>`).join("")}</div>
      <div id="prediction-feedback" aria-live="polite"></div>
    </div>`;
  $("#prediction-dialog").showModal();
}
function answer(id) {
  const q = prediction;
  const picked = q.choices.find((c) => c.id === id);
  for (const el of $$("[data-answer]")) {
    const c = q.choices.find((x) => x.id === el.dataset.answer);
    el.disabled = true;
    if (c.correct) el.insertAdjacentHTML("beforeend", '<span class="hw-led is-on git-push"></span>');
    else if (c.id === id) el.insertAdjacentHTML("beforeend", '<span class="hw-led is-on git-push" style="--led:var(--git-conflict)"></span>');
  }
  const { verdict, why } = lesson.feedback(q, id);
  $("#prediction-feedback").innerHTML = `<div class="hw-section git-feedback"><p class="hw-text"><strong>${esc(verdict)}</strong> ${esc(why)}</p><button class="hw-key hw-key--accent git-gap" data-action="verify">${esc(q.verify.label)}</button></div>`;
  progress.markPrediction(`${q.index}`, picked.correct);
  // The step behind the dialog may now show what answers the question.
  settled.add(q.index);
  needsRender = true;
}
$("#prediction-dialog").addEventListener("close", () => {
  if (!needsRender) return;
  needsRender = false;
  render();
});
function verify() {
  const q = prediction;
  needsRender = false;
  $("#prediction-dialog").close();
  if (q.verify.step === index) {
    // The answer is this step's own output (git status): reveal it here.
    render();
    sideTabs.select("now");
    nowPages.showItem(now.terminal);
    return;
  }
  move(q.verify.step, true);
}

/** Lesson 03: the three resolutions side by side. */
function resolutionsHtml() {
  const final = (id) => lesson.simulate(id).steps.at(-1).state;
  const head = lesson.simulate("both").steps[8].state.commits.find((c) => c.id === "C2");
  return `${dialogHead("compare-title", "해결안 비교", "세 해결안의 병합 결과")}
    <div class="hw-plate-body">
      <p class="hw-text">세 해결안 모두 C2와 C1을 부모로 갖는 C3를 만듭니다. 달라지는 것은 C3에 담기는 제목 줄입니다.</p>
      <table class="hw-table git-gap"><thead><tr><th>해결안</th><th>C3의 제목 줄</th><th>C2와 다른 줄</th><th></th></tr></thead><tbody>
        ${RESOLUTIONS.map((r) => {
          const diff = final(r.id).commits.find((c) => c.id === "C3").content === head.content ? 0 : 1;
          return `<tr${r.id === choice ? ' aria-current="true"' : ""}><td>${esc(r.label)}<div class="hw-muted">${esc(r.description)}</div></td><td>${esc(titleOf(r.content))}</td><td class="hw-mono">${diff}</td><td><button class="hw-key hw-key--sm" data-compare="${r.id}">${r.id === choice ? "다시 보기" : "이 해결안으로"}</button></td></tr>`;
        }).join("")}
      </tbody></table>
    </div>`;
}

/** Lessons 01 and 04: the two methods as two columns, one row per aspect. */
function methodsHtml(c) {
  const replay = (v) =>
    `<button class="hw-key hw-key--sm${v === choice ? " hw-key--accent" : ""}" data-compare="${v}">${LABELS.replayMode}</button>`;
  return `${dialogHead("compare-title", `${LABELS.compare} · ${LABELS.compareSub}`, c.title)}
    <div class="hw-plate-body">
      <p class="hw-text">${esc(c.fork)}</p>
      <table class="hw-table git-gap git-compare-table"><thead><tr><th></th>${c.columns.map((col) => `<th${col.variant === choice ? ' aria-current="true"' : ""}>${esc(col.label)}</th>`).join("")}</tr></thead><tbody>
        ${c.rows.map((row, i) => `<tr><th scope="row">${esc(row)}</th>${c.columns.map((col) => `<td>${esc(col.values[i])}</td>`).join("")}</tr>`).join("")}
        <tr><th scope="row"></th>${c.columns.map((col) => `<td>${replay(col.variant)}</td>`).join("")}</tr>
      </tbody></table>
      <button class="hw-key hw-key--sm git-gap" data-action="fork">${LABELS.backToFork}</button>
    </div>`;
}

/** Lesson 02: per line, what two tips alone decide vs what C0 lets Git decide. */
function basesHtml(c) {
  const value = (line) => line.split(": ")[1] ?? line;
  const changed = c.lines.filter((l) => l.ours !== l.theirs || l.base !== l.ours);
  return `${dialogHead("compare-title", `${LABELS.compare} · ${LABELS.compareSub}`, c.title)}
    <div class="hw-plate-body">
      <p class="hw-text">${esc(c.fork)}</p>
      <table class="hw-table git-gap git-compare-table"><thead><tr><th>줄</th><th>C2 · main</th><th>C1 · feature</th><th>두 끝만 비교</th><th>C0와 함께 비교</th></tr></thead><tbody>
        ${changed
          .map((l) => {
            const who = l.ours === l.base ? "feature" : "main";
            return `<tr><th scope="row">${esc(l.label)}</th><td>${esc(value(l.ours))}</td><td>${esc(value(l.theirs))}</td><td>? 누가 바꿨는지 모름</td><td>${esc(value(l.threeWay))} · C0 대비 ${who}만 바꿈</td></tr>`;
          })
          .join("")}
        <tr><th scope="row">결과</th><td colspan="2" class="hw-muted">같은 두 끝</td><td>사람이 ${changed.length}줄을 정해야 함</td><td>병합 커밋 C3를 바로 만듦</td></tr>
      </tbody></table>
      <p class="hw-note git-gap">${esc(c.note)}</p>
      <div class="git-gap"><button class="hw-key hw-key--sm hw-key--accent" data-compare="${lesson.defaultVariant}">${LABELS.replayMode}</button> <button class="hw-key hw-key--sm" data-action="fork">${LABELS.backToFork}</button></div>
    </div>`;
}

function compare() {
  pause();
  progress.markCompared();
  const c = lesson.comparison;
  $("#compare-dialog").innerHTML = lesson.gate ? resolutionsHtml() : c.lines ? basesHtml(c) : methodsHtml(c);
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
  if (b.dataset.resolution) return playVariant(b.dataset.resolution);
  if (b.dataset.answer) return answer(b.dataset.answer);
  if (b.dataset.compare) {
    $("#compare-dialog").close();
    return playVariant(b.dataset.compare);
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
      verify();
      break;
    case "choose-again":
      chooseAgain();
      break;
    case "fork":
      $("#compare-dialog").close();
      jump(lesson.fork);
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
$(".hw-records .hw-tabs").addEventListener("keydown", (e) => {
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
  if (document.querySelector("dialog[open]") || document.querySelector(".is-rail-open") || e.target.closest?.("input,select,textarea,button,a,summary,tr[data-time]")) return;
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

// Deep link to a moment: ?lesson=conflict&step=12&choice=both (add &animate to play into it).
const query = new URLSearchParams(location.search);
if (lesson.variants.some((v) => v.id === query.get("choice"))) {
  choice = query.get("choice");
  run = lesson.simulate(choice);
}
const startAt = Number(query.get("step"));
if (startAt > 0) {
  if (query.has("animate")) move(startAt - 1, false).then(() => move(startAt, true));
  else move(startAt, false);
}
