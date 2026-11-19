// Side plate: the lesson. Before playback it shows the protocol overview; while
// playing it explains the current step and the packet on the wire; the list
// at the bottom jumps to any step and shows each step's state on an LED.
import {
  escapeHtml,
  localizedUpperCase,
  translate,
} from "../i18n.js";
import { animateTextChange, slideContent } from "./motion.js";
import { NETWORK_SHORT_LABELS, PACKET_COLORS } from "../simulation/network-drawing.js";
import { getLessonPackets } from "../packets/encode.js";
import { getLessonStatus } from "../progress.js";
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

// On the desktop console nothing scrolls: the head tabs split the lesson
// (해설) from the step list (단계), and each list pages (shared/fit.js) when
// it does not fit. Items are switched off with data-off, not hidden: the
// pager owns the hidden attribute.
function renderOverviewPanel() {
  return `
  <aside class="hw-plate hw-side overview">
    <div class="hw-plate-head">
      <span class="hw-label"><span class="hw-index">B</span> <span class="panel-title"></span></span>
      <div class="hw-tabs side-tabs" aria-label="해설 보기">
        <button type="button" data-tab="lesson" aria-selected="true">해설</button>
        <button type="button" data-tab="steps">단계</button>
      </div>
      <button class="hw-key hw-key--sm back-btn" type="button" hidden title="${translate("Back to the overview (Esc)")}">${icon("back")}<span>${translate("OVERVIEW")}</span></button>
    </div>
    <div class="hw-plate-body side-body hw-fit" data-panel="lesson">
      <div class="overview-stage hw-fill">
        <div class="overview-body side-pages" data-view="overview">
          <div>
            <span class="hw-label overview-layer"></span>
            <h2 class="hw-title overview-name"></h2>
            <p class="hw-text hw-muted overview-full"></p>
          </div>
          <p class="hw-text overview-desc"></p>
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
      </div>
    </div>
    <div class="hw-plate-body side-body hw-fit steps-body" data-panel="steps" hidden>
      <span class="hw-label steps-label">단계로 이동 <span class="steps-count"></span></span>
      <div class="hw-list steps hw-fill"></div>
    </div>
  </aside>`;
}

function bindOverviewBackButton(panel, onBack, onStep) {
  panel.querySelector(".back-btn").addEventListener("click", onBack);
  panel.querySelector(".steps").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-step]");
    if (button) onStep(Number(button.dataset.step));
  });
  panel._pages = {
    overview: paginate(panel.querySelector('[data-view="overview"]'), { label: "해설 쪽" }),
    step: paginate(panel.querySelector('[data-view="step"]'), { label: "해설 쪽" }),
    steps: paginate(panel.querySelector(".steps"), { label: "단계 쪽" }),
  };
  plateTabs(panel);
}

/** Re-fit the lesson pages; a new step or lesson opens on its first page. */
function refitLessonPages(panel, state) {
  if (!panel._pages) return;
  const key = `${state.lesson.id}:${state.view}:${state.rank}`;
  panel._pages.overview.refresh();
  panel._pages.step.refresh();
  if (panel._pageKey !== key) {
    panel._pageKey = key;
    panel._pages.overview.show(0);
    panel._pages.step.show(0);
  }
}

function buildOverviewState(playback, lesson, lessonOrder) {
  const activeStep = lesson.steps[playback.activeStep];
  const packets = getLessonPackets(lesson);
  const activeEvent = playback.event;
  const showPacket =
    playback.started &&
    !playback.done &&
    (activeEvent?.type === "packet" || activeEvent?.type === "stream") &&
    activeEvent.step === playback.activeStep;
  let firstPacketNumber = showPacket
    ? packets.indexOf(
        activeEvent.type === "stream"
          ? activeEvent.packets[0]
          : packets.find((packet) => packet.row === activeEvent.row),
      ) + 1
    : 0;
  let displayedPacket = activeEvent;
  if (showPacket && playback.running && activeEvent.type === "stream") {
    const firstIndex = firstPacketNumber - 1;
    const sent = activeEvent.packets.findLastIndex(
      (_, i) => playback.packets[firstIndex + i] !== "future",
    );
    displayedPacket = activeEvent.packets[sent];
    firstPacketNumber += sent;
  }
  return {
    lesson,
    order: lessonOrder,
    view: playback.started ? "step" : "overview",
    title: translate(
      playback.started
        ? playback.done
          ? "LESSON SUMMARY"
          : "STEP DETAILS"
        : "PROTOCOL OVERVIEW",
    ),
    rank: playback.started
      ? playback.done
        ? lesson.steps.length
        : playback.activeStep
      : -1,
    content: playback.done
      ? {
          label: translate(
            getLessonStatus(lesson) === "done" ? "LESSON COMPLETE" : "END OF SCENARIO",
          ),
          ...lesson.outro,
          done: true,
        }
      : {
          label: translate("STEP {n} OF {total}", {
            n: playback.activeStep + 1,
            total: lesson.steps.length,
          }),
          title: activeStep.title,
          desc: activeStep.desc,
          text: activeStep.detail,
          facts: activeStep.facts,
        },
    packet:
      showPacket && displayedPacket
        ? {
            number: firstPacketNumber,
            count: displayedPacket.type === "stream" ? displayedPacket.packets.length : 1,
            total: packets.length,
            event: displayedPacket,
            lost: playback.packets[firstPacketNumber - 1] === "lost",
          }
        : null,
  };
}

const OSI_NAMES = ["Physical", "Data Link", "Network", "Transport", "Session", "Presentation", "Application"];

function updateProtocolOverview(panel, lesson) {
  const overview = panel.querySelector('[data-view="overview"]');
  overview.querySelector(".overview-layer").textContent = `L${lesson.layer} · ${translate(OSI_NAMES[lesson.layer - 1])} · ${lesson.steps.length}단계`;
  overview.querySelector(".overview-name").textContent = lesson.name;
  overview.querySelector(".overview-full").textContent = translate(lesson.overview.full);
  overview.querySelector(".overview-desc").textContent = translate(lesson.overview.description);
  overview.querySelector(".overview-facts").innerHTML = renderFacts(lesson.overview.facts);
}

function updateStepExplanation(panel, content) {
  const explanation = panel.querySelector(".explain");
  explanation.classList.toggle("is-done", !!content.done);
  explanation.querySelector(".explain-label").textContent = content.label;
  explanation.querySelector(".explain-title").textContent = localizedUpperCase(translate(content.title));
  explanation.querySelector(".explain-sub").textContent = translate(content.desc);
  explanation.querySelector(".explain-text").textContent = translate(content.text);
  const facts = content.facts ?? [];
  explanation.querySelector(".explain-facts").innerHTML = renderFacts(facts);
  explanation.querySelector(".explain-facts-wrap").toggleAttribute("data-off", !facts.length);
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
  list.innerHTML = lesson.steps
    .map(
      (step, index) =>
        `<button type="button" data-step="${index}"><span class="hw-index">${String(index + 1).padStart(2, "0")}</span><span class="step-title">${escapeHtml(translate(step.title))}</span><span class="hw-led step-led"></span></button>`,
    )
    .join("");
  panel.querySelector(".steps-count").textContent = `· ${lesson.steps.length}단계`;
  list.dataset.lesson = lesson.id;
  panel._pages?.steps.refresh();
}

function updateSteps(panel, playback, lesson) {
  const list = panel.querySelector(".steps");
  if (list.dataset.lesson !== lesson.id) renderSteps(panel, lesson);
  list.querySelectorAll("button").forEach((button, index) => {
    const status = playback.steps[index];
    button.setAttribute("aria-current", status === "active");
    button.dataset.status = status;
    button.querySelector(".step-led").classList.toggle("is-on", status !== "todo");
  });
  const active = list.querySelector('[data-status="active"]');
  if (active && list.dataset.active !== active.dataset.step) {
    list.dataset.active = active.dataset.step;
    panel._pages?.steps.showItem(active);
  }
}

function applyOverviewState(panel, state) {
  updateProtocolOverview(panel, state.lesson);
  panel.querySelector('[data-view="overview"]').hidden = state.view !== "overview";
  panel.querySelector('[data-view="step"]').hidden = state.view !== "step";
  updateStepExplanation(panel, state.content);
  updatePacketExplanation(panel, state.packet, state.lesson);
  refitLessonPages(panel, state);
}

function updateOverviewPanel(panel, playback, lesson, lessonOrder = 0) {
  const nextState = buildOverviewState(playback, lesson, lessonOrder);
  const previousState = panel._shown;
  panel._latest = nextState;
  const latestState = () => panel._latest;
  updateSteps(panel, playback, lesson);
  animateTextChange(
    panel.querySelector(".panel-title"),
    nextState.title,
    !previousState || nextState.rank >= previousState.rank ? 1 : -1,
  );
  panel.querySelector(".back-btn").hidden = nextState.view !== "step";
  const stage = panel.querySelector(".overview-stage");
  if (!previousState) {
    applyOverviewState(panel, nextState);
  } else if (nextState.lesson !== previousState.lesson) {
    slideContent(stage, () => applyOverviewState(panel, latestState()), nextState.order > previousState.order ? 1 : -1, 24);
  } else if (nextState.view !== previousState.view) {
    slideContent(stage, () => applyOverviewState(panel, latestState()), nextState.view === "step" ? 1 : -1, 24);
  } else if (nextState.view === "step" && nextState.rank !== previousState.rank) {
    slideContent(
      panel.querySelector(".explain"),
      () => applyOverviewState(panel, latestState()),
      nextState.rank > previousState.rank ? 1 : -1,
    );
  } else if (
    nextState.view === "step" &&
    (nextState.packet?.number !== previousState.packet?.number ||
      nextState.packet?.lost !== previousState.packet?.lost ||
      nextState.packet?.count !== previousState.packet?.count)
  ) {
    updatePacketExplanation(panel, nextState.packet, nextState.lesson);
  }
  panel._shown = nextState;
}

export { bindOverviewBackButton, renderOverviewPanel, updateOverviewPanel };
