// Side plate: the lesson, in the shared learning model. Before playback the
// start screen asks the scenario question (목표); while playing it explains
// the current step and the packet on the wire (설명); at the end it is 정리.
// What each view shows is decided in ../lesson-view.js (also: what a pending
// prediction hides). The 장면 tab jumps to any step and marks the 핵심 장면.
import { escapeHtml, translate } from "../i18n.js";
import { animateTextChange, slideContent } from "./motion.js";
import { NETWORK_SHORT_LABELS, PACKET_COLORS } from "../simulation/network-drawing.js";
import { getKeySteps } from "../quiz.js";
import { buildOverviewState, stepListTitle } from "../lesson-view.js";
import { protocolCatalog } from "../lessons/index.js";
import { LABELS, bindRecap, nextExperiment } from "../../../shared/lesson-kit.js";
import { icon } from "../../../shared/hw.js";
import { paginate, plateTabs } from "../../../shared/fit.js";

const getLocalizedNodeName = (lesson, nodeId) =>
  translate(lesson.labels?.[nodeId]?.[0] ?? NETWORK_SHORT_LABELS[nodeId]);

const renderFacts = (facts) =>
  facts
    .map(
      ([label, value]) =>
        `<div><dt class="hw-label">${escapeHtml(translate(label))}</dt><dd>${escapeHtml(translate(value))}</dd></div>`,
    )
    .join("");

/**
 * Set a paragraph's text. The pager (shared/fit.js) splits a tall paragraph
 * into one sibling per sentence; drop those parts first so no stale sentence
 * stays behind.
 */
function setText(element, text) {
  let next = element.nextElementSibling;
  while (next?.dataset.split === "cont" && next.className === element.className) {
    const part = next;
    next = next.nextElementSibling;
    part.remove();
  }
  delete element.dataset.split;
  element.textContent = text;
}

// On the desktop console nothing scrolls: the head tabs split the lesson
// (해설) from the step list (장면), and each view pages (shared/fit.js) when
// it does not fit. Items are switched off with data-off, not hidden: the
// pager owns the hidden attribute.
function renderOverviewPanel() {
  return `
  <aside class="hw-plate hw-side overview">
    <div class="hw-plate-head">
      <span class="hw-label"><span class="hw-index">B</span> <span class="panel-title"></span></span>
      <div class="hw-tabs side-tabs" aria-label="해설 보기">
        <button type="button" data-tab="lesson" aria-selected="true">${LABELS.explainTab}</button>
        <button type="button" data-tab="steps">${LABELS.scenesTab}</button>
      </div>
      <button class="hw-key hw-key--sm back-btn" type="button" hidden title="처음으로 (R)">${icon("back")}<span>처음</span></button>
    </div>
    <div class="hw-plate-body side-body hw-fit" data-panel="lesson">
      <div class="overview-stage hw-fill">
        <div class="overview-body side-pages" data-view="overview">
          <div>
            <span class="hw-label overview-layer"></span>
            <h2 class="hw-title overview-question"></h2>
            <p class="hw-text overview-setup"></p>
          </div>
          <p class="hw-text overview-goal"></p>
          <div>
            <span class="hw-label overview-reference"></span>
            <p class="hw-text hw-muted overview-desc"></p>
          </div>
          <dl class="facts overview-facts"></dl>
        </div>
        <div class="overview-body explain side-pages" data-view="step" hidden aria-live="polite">
          <div>
            <span class="hw-label explain-label"></span>
            <h2 class="hw-title explain-title"></h2>
            <p class="hw-text hw-muted explain-sub"></p>
          </div>
          <p class="hw-text explain-text"></p>
          <div class="explain-packet" data-off>
            <span class="hw-label explain-packet-meta"></span>
            <div class="explain-packet-head"><span class="hw-led is-on explain-packet-led"></span><b class="explain-packet-name"></b><span class="hw-mono hw-muted explain-packet-route"></span></div>
            <pre class="hw-note explain-payload"></pre>
          </div>
          <dl class="facts explain-facts explain-facts-wrap"></dl>
        </div>
        <div class="overview-body recap side-pages hw-recap" data-view="recap" hidden></div>
      </div>
    </div>
    <div class="hw-plate-body side-body hw-fit steps-body" data-panel="steps" hidden>
      <span class="hw-label steps-label">${LABELS.jumpToScene} <span class="steps-count"></span></span>
      <div class="hw-list steps hw-fill"></div>
    </div>
    <div class="hw-plate-foot pe-recap-foot" hidden></div>
  </aside>`;
}

/**
 * onBack: back to the start screen; onStep(index): jump to a step;
 * onNextLesson(id): open another protocol; recallProgress(lesson): the
 * progress adapter bindRecap marks answers in.
 */
function bindOverviewBackButton(panel, onBack, onStep, { onNextLesson, recallProgress, onRecall } = {}) {
  panel.querySelector(".back-btn").addEventListener("click", onBack);
  panel.querySelector(".steps").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-step]");
    if (button) onStep(Number(button.dataset.step));
  });
  panel.querySelector(".pe-recap-foot").addEventListener("click", (event) => {
    const next = event.target.closest("[data-next-lesson]");
    if (next) onNextLesson?.(next.dataset.nextLesson);
  });
  panel._recap = { recallProgress, onRecall };
  panel._pages = {
    overview: paginate(panel.querySelector('[data-view="overview"]'), { label: "해설 쪽" }),
    step: paginate(panel.querySelector('[data-view="step"]'), { label: "해설 쪽" }),
    recap: paginate(panel.querySelector('[data-view="recap"]'), { label: "정리 쪽" }),
    steps: paginate(panel.querySelector(".steps"), { label: "장면 쪽" }),
  };
  plateTabs(panel);
}

/** Re-fit the lesson pages; a new step or lesson opens on its first page. */
function refitLessonPages(panel, state) {
  if (!panel._pages) return;
  const key = `${state.lesson.id}:${state.view}:${state.rank}:${state.held}`;
  panel._pages.overview.refresh();
  panel._pages.step.refresh();
  panel._pages.recap.refresh();
  if (panel._pageKey !== key) {
    panel._pageKey = key;
    panel._pages.overview.show(0);
    panel._pages.step.show(0);
    panel._pages.recap.show(0);
  }
}

function updateProtocolOverview(panel, overview) {
  const view = panel.querySelector('[data-view="overview"]');
  view.querySelector(".overview-layer").textContent = overview.layer;
  view.querySelector(".overview-question").textContent = overview.question;
  setText(view.querySelector(".overview-setup"), overview.setup);
  setText(view.querySelector(".overview-goal"), overview.goal);
  view.querySelector(".overview-reference").textContent = overview.reference;
  setText(view.querySelector(".overview-desc"), overview.description);
  view.querySelector(".overview-facts").innerHTML = renderFacts(overview.facts);
}

function updateStepExplanation(panel, content) {
  const explanation = panel.querySelector(".explain");
  if (!content) return;
  explanation.classList.toggle("is-held", content.hold);
  explanation.querySelector(".explain-label").textContent = content.label;
  explanation.querySelector(".explain-title").textContent = content.hold
    ? content.title
    : translate(content.title);
  const sub = explanation.querySelector(".explain-sub");
  sub.textContent = translate(content.desc);
  sub.hidden = !content.desc;
  setText(explanation.querySelector(".explain-text"), translate(content.text));
  explanation.querySelector(".explain-facts").innerHTML = renderFacts(content.facts);
  explanation.querySelector(".explain-facts-wrap").toggleAttribute("data-off", !content.facts.length);
}

/** Progress line for one lesson (the shared .hw-progress markup, without a comparison). */
function progressLine(summary) {
  if (!summary) return "";
  const parts = [`${LABELS.scene} ${summary.scenesSeen}/${summary.scenesTotal}`];
  if (summary.predictionsAnswered) parts.push(`예측 ${summary.predictionsRight}/${summary.predictionsAnswered}`);
  if (summary.recallTotal) parts.push(`${LABELS.recall} ${summary.recallRight}/${summary.recallTotal}`);
  const total = summary.scenesTotal + summary.recallTotal;
  const got = summary.scenesSeen + summary.recallRight;
  const dots = Array.from({ length: total }, (_, i) => `<i class="${i < got ? "is-on" : ""}"></i>`).join("");
  return `<div class="hw-progress"><span class="hw-meter" aria-hidden="true">${dots}</span><span class="hw-label">${escapeHtml(LABELS.progress)} · ${escapeHtml(parts.join(" · "))}</span></div>`;
}

/** The 정리 view: header, 핵심 정리, 확인 문제 (bindRecap markup), progress, next. */
function updateRecap(panel, state, summary) {
  const view = panel.querySelector(".recap");
  const { recap, lesson } = state;
  if (!recap) return;
  if (view.dataset.lesson !== lesson.id) {
    view.dataset.lesson = lesson.id;
    const index = protocolCatalog.findIndex((protocol) => protocol.id === lesson.id);
    const nextProtocol = protocolCatalog[index + 1];
    const experiment = nextExperiment("protocol");
    const next = nextProtocol
      ? `<button class="hw-key hw-key--sm hw-key--accent" type="button" data-next-lesson="${nextProtocol.id}">다음 프로토콜: ${escapeHtml(nextProtocol.name)} →</button>`
      : `<a class="hw-key hw-key--sm hw-key--accent" href="${escapeHtml(experiment.href)}">다음 실험: ${escapeHtml(experiment.title)} →</a>`;
    const questions = recap.recall
      .map(
        (q) => `<div class="hw-recall" data-recall="${escapeHtml(q.id)}">
          <span class="hw-label">${LABELS.recall}</span>
          <p class="hw-text hw-recall-q">${escapeHtml(q.question)}</p>
          <div class="hw-list hw-recall-choices">${q.choices
            .map((c, i) => `<button type="button" data-choice="${i}">${escapeHtml(c.label)}</button>`)
            .join("")}</div>
          <p class="hw-note hw-recall-why" hidden></p>
        </div>`,
      )
      .join("");
    view.innerHTML = `
      <div>
        <span class="hw-label">${escapeHtml(recap.label)}</span>
        <h2 class="hw-title">${escapeHtml(translate(recap.title))}</h2>
        <p class="hw-text hw-muted">${escapeHtml(translate(recap.desc))}</p>
      </div>
      <div class="hw-recap-foot recap-progress"></div>
      <div>
        <span class="hw-label">${LABELS.recapPoints}</span>
        <ul class="hw-list hw-recap-points">${recap.points.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
      </div>
      ${questions}`;
    panel.querySelector(".pe-recap-foot").innerHTML = next;
    const { recallProgress, onRecall } = panel._recap ?? {};
    bindRecap(view, {
      recall: recap.recall,
      progress: recallProgress?.(lesson),
      onAnswer: () => {
        onRecall?.(lesson);
        panel._pages?.recap.refresh();
      },
    });
  }
  view.querySelector(".recap-progress").innerHTML = progressLine(summary);
}

function updatePacketExplanation(panel, packetInfo, lesson) {
  const section = panel.querySelector(".explain-packet");
  section.toggleAttribute("data-off", !packetInfo);
  if (!packetInfo) return refitLessonPages(panel, panel._latest);
  const { event, number: firstNumber, count: packetCount, total: totalPackets } = packetInfo;
  section.querySelector(".explain-packet-led").style.setProperty("--led", PACKET_COLORS[event.color]);
  section.querySelector(".explain-packet-name").textContent =
    `${event.locked ? "🔒 " : ""}${translate(event.label)}`;
  section.querySelector(".explain-packet-route").textContent =
    `${getLocalizedNodeName(lesson, event.from)} → ${getLocalizedNodeName(lesson, event.to)}`;
  section.querySelector(".explain-payload").textContent = event.payload
    .map((line) => translate(line))
    .join("\n");
  let meta;
  if (event.type === "stream") {
    const lostCount = event.packets.filter((packet) => packet.lost).length;
    const lengths = event.packets.map((packet) => packet.row.len);
    const sizeSummary = lengths.every((length) => length === lengths[0])
      ? `${packetCount} × ${lengths[0]}`
      : lengths.every((length) => length.endsWith(" B"))
        ? `${lengths.map((length) => length.slice(0, -2)).join(" + ")} B`
        : lengths.join(" + ");
    const suffix = lostCount
      ? ` · ${translate(lostCount === 1 ? "1 LOST" : "{n} LOST", { n: lostCount })}`
      : event.locked
        ? ` · ${translate("ENCRYPTED")}`
        : "";
    meta = `${translate("PACKETS {from}–{to} OF {total}", {
      from: firstNumber,
      to: firstNumber + packetCount - 1,
      total: totalPackets,
    })} · ${sizeSummary}${suffix}`;
  } else {
    const suffix = packetInfo.lost
      ? ` · ${translate("LOST ON THE WAY")}`
      : event.locked
        ? ` · ${translate("ENCRYPTED")}`
        : "";
    meta = `${translate("PACKET {n} OF {total}", { n: firstNumber, total: totalPackets })} · ${event.row.proto} · ${event.row.len}${suffix}`;
  }
  section.querySelector(".explain-packet-meta").textContent = meta;
  refitLessonPages(panel, panel._latest);
}

function renderSteps(panel, lesson) {
  const list = panel.querySelector(".steps");
  const keys = getKeySteps(lesson);
  list.innerHTML = lesson.steps
    .map(
      (step, index) =>
        `<button type="button" data-step="${index}"${keys.includes(index) ? " data-key" : ""}><span class="hw-index">${String(index + 1).padStart(2, "0")}</span><span class="step-title"></span>${keys.includes(index) ? `<span class="hw-tag step-key-tag">${LABELS.scene}</span>` : ""}<span class="hw-led step-led"></span></button>`,
    )
    .join("");
  panel.querySelector(".steps-count").textContent = `· ${keys.length}곳 / ${lesson.steps.length}단계`;
  list.dataset.lesson = lesson.id;
}

function updateSteps(panel, playback, lesson, pending) {
  const list = panel.querySelector(".steps");
  const fresh = list.dataset.lesson !== lesson.id;
  if (fresh) renderSteps(panel, lesson);
  list.querySelectorAll("button").forEach((button, index) => {
    const status = playback.steps[index];
    button.setAttribute("aria-current", status === "active");
    button.dataset.status = status;
    button.querySelector(".step-led").classList.toggle("is-on", status !== "todo");
    const title = stepListTitle(lesson, index, pending, status);
    const titleElement = button.querySelector(".step-title");
    if (titleElement.textContent !== title) titleElement.textContent = title;
  });
  if (fresh) panel._pages?.steps.refresh();
  const active = list.querySelector('[data-status="active"]');
  if (active && list.dataset.active !== active.dataset.step) {
    list.dataset.active = active.dataset.step;
    panel._pages?.steps.showItem(active);
  }
}

function applyOverviewState(panel, state) {
  updateProtocolOverview(panel, state.overview);
  for (const view of ["overview", "step", "recap"]) {
    panel.querySelector(`[data-view="${view}"]`).hidden = state.view !== view;
  }
  panel.querySelector(".pe-recap-foot").hidden = state.view !== "recap";
  updateStepExplanation(panel, state.content);
  updateRecap(panel, state, panel._summary);
  updatePacketExplanation(panel, state.packet, state.lesson);
  refitLessonPages(panel, state);
}

/**
 * options.pending: the prediction still hiding its answer (getPendingQuiz);
 * options.summary: progress counts for the 정리 line.
 */
function updateOverviewPanel(panel, playback, lesson, lessonOrder = 0, { pending = null, summary = null } = {}) {
  const nextState = buildOverviewState(playback, lesson, lessonOrder, { pending });
  const previousState = panel._shown;
  panel._latest = nextState;
  panel._summary = summary;
  const latestState = () => panel._latest;
  updateSteps(panel, playback, lesson, pending);
  animateTextChange(
    panel.querySelector(".panel-title"),
    nextState.title,
    !previousState || nextState.rank >= previousState.rank ? 1 : -1,
  );
  panel.querySelector(".back-btn").hidden = nextState.view === "overview";
  const stage = panel.querySelector(".overview-stage");
  if (!previousState) {
    applyOverviewState(panel, nextState);
  } else if (nextState.lesson !== previousState.lesson) {
    slideContent(stage, () => applyOverviewState(panel, latestState()), nextState.order > previousState.order ? 1 : -1, 24);
  } else if (nextState.view !== previousState.view) {
    slideContent(stage, () => applyOverviewState(panel, latestState()), nextState.rank > previousState.rank ? 1 : -1, 24);
  } else if (nextState.view === "step" && nextState.rank !== previousState.rank) {
    slideContent(
      panel.querySelector(".explain"),
      () => applyOverviewState(panel, latestState()),
      nextState.rank > previousState.rank ? 1 : -1,
    );
  } else if (nextState.held !== previousState.held || nextState.view === "overview") {
    // A prediction was answered (or its packet passed): open the step; or
    // the start screen's facts change with the pending question.
    applyOverviewState(panel, nextState);
  } else if (
    nextState.view === "step" &&
    (nextState.packet?.number !== previousState.packet?.number ||
      nextState.packet?.lost !== previousState.packet?.lost ||
      nextState.packet?.count !== previousState.packet?.count)
  ) {
    updatePacketExplanation(panel, nextState.packet, nextState.lesson);
  } else if (nextState.view === "recap") {
    updateRecap(panel, nextState, summary);
  }
  panel._shown = nextState;
}

export { bindOverviewBackButton, renderOverviewPanel, updateOverviewPanel };
