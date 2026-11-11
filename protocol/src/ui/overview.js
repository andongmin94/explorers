// Reconstructed from the distributed Protocol Explorer JavaScript.
import { icons } from "./icons.js";
import {
  EASE_OUT_EXPO,
  animateTextChange,
  prefersReducedMotion,
  slideContent,
} from "./motion.js";
import {
  escapeHtml,
  isRtl,
  isolateLtrText,
  localizedUpperCase,
  translate,
  translatedElementContent,
} from "../i18n.js";
import { NETWORK_SHORT_LABELS } from "../simulation/network-drawing.js";
import { getLessonPackets } from "../packets/encode.js";
import { getLessonStatus } from "../progress.js";

const getLocalizedNodeName = (lesson, nodeId) =>
  translate(lesson.labels?.[nodeId]?.[0] ?? NETWORK_SHORT_LABELS[nodeId]);
const PACKET_LOCK_SVG =
  '<svg class="pill-lock" viewBox="0 0 12 14" width="10" height="12" aria-hidden="true"><path d="M3 6.5 V4.5 a3 3 0 0 1 6 0 V6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="1.5" y="6.5" width="9" height="6.5" rx="1.3" fill="currentColor"/></svg>';
const renderFacts = (facts) =>
  facts
    .map(
      ([label, value]) =>
        `<div><dt>${escapeHtml(localizedUpperCase(translate(label)))}</dt><dd>${escapeHtml(translate(value))}</dd></div>`,
    )
    .join("");

function renderOverviewPanel() {
  return `
  <section class="panel overview">
    <div class="panel-head bar">
      <h2 class="panel-title sm"></h2>
      <button class="more" type="button" data-t-label="More" aria-label="${translate("More")}">${icons.dots}</button>
      <button class="back-btn" type="button" hidden>${icons.back}<span ${translatedElementContent("OVERVIEW")}</span></button>
    </div>

    <div class="overview-stage">
      <div class="overview-body" data-view="overview">
        <div class="overview-name">
          <h3></h3>
          <span class="badge"><i></i><span ${translatedElementContent("ACTIVE")}</span></span>
        </div>
        <p class="overview-full"></p>
        <p class="overview-desc"></p>
        <dl class="facts overview-facts"></dl>
      </div>

      <div class="overview-body explain" data-view="step" hidden aria-live="polite">
        <div class="explain-label"></div>
        <h3 class="explain-title"></h3>
        <p class="explain-sub"></p>
        <p class="explain-text"></p>
        <div class="explain-packet">
          <div class="explain-packet-clip">
            <div class="explain-packet-card">
              <div class="explain-packet-inner">
                <div class="explain-packet-head"><b></b><span></span></div>
                <div class="explain-payload"></div>
                <div class="explain-meta"></div>
              </div>
            </div>
          </div>
        </div>
        <dl class="facts explain-facts"></dl>
      </div>
    </div>
  </section>`;
}

function bindOverviewBackButton(panel, onBack) {
  panel.querySelector(".back-btn").addEventListener("click", onBack);
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
  const firstPacketNumber = showPacket
    ? packets.indexOf(
        activeEvent.type === "stream"
          ? activeEvent.packets[0]
          : packets.find((packet) => packet.row === activeEvent.row),
      ) + 1
    : 0;
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
    packet: showPacket
      ? {
          number: firstPacketNumber,
          count: activeEvent.type === "stream" ? activeEvent.packets.length : 1,
          total: packets.length,
          event: activeEvent,
        }
      : null,
  };
}

function updateProtocolOverview(panel, lesson) {
  const overview = panel.querySelector('[data-view="overview"]');
  overview.querySelector("h3").textContent = lesson.name;
  overview.querySelector(".overview-full").textContent = translate(
    lesson.overview.full,
  );
  overview.querySelector(".overview-desc").textContent = translate(
    lesson.overview.description,
  );
  overview.querySelector(".overview-facts").innerHTML = renderFacts(
    lesson.overview.facts,
  );
}

function updateStepExplanation(panel, content) {
  const explanation = panel.querySelector(".explain");
  explanation.classList.toggle("is-done", !!content.done);
  explanation.querySelector(".explain-label").textContent = content.label;
  explanation.querySelector(".explain-title").textContent = localizedUpperCase(
    translate(content.title),
  );
  explanation.querySelector(".explain-sub").textContent = translate(
    content.desc,
  );
  explanation.querySelector(".explain-text").textContent = translate(
    content.text,
  );
  explanation.querySelector(".explain-facts").innerHTML = renderFacts(
    content.facts ?? [],
  );
  explanation.scrollTop = 0;
}

function updatePacketExplanation(panel, packetInfo, lesson) {
  if (!packetInfo) {
    return;
  }
  const card = panel.querySelector(".explain-packet");
  const {
    event,
    number: firstNumber,
    count: packetCount,
    total: totalPackets,
  } = packetInfo;
  card.dataset.color = event.color;
  card.querySelector("b").innerHTML =
    (event.locked ? PACKET_LOCK_SVG : "") + escapeHtml(translate(event.label));
  card.querySelector("span").textContent = localizedUpperCase(
    `${getLocalizedNodeName(lesson, event.from)} ${isRtl() ? "←" : "→"} ${getLocalizedNodeName(lesson, event.to)}`,
  );
  card.querySelector(".explain-payload").textContent = event.payload.map(
    (line) => translate(line),
  ).join(`
`);
  if (event.type === "stream") {
    const lostCount = event.packets.filter((packet) => packet.lost).length;
    const lengths = event.packets.map((packet) => packet.row.len);
    const sizeSummary = lengths.every((length) => length === lengths[0])
      ? `${packetCount} × ${lengths[0]}`
      : lengths.every((length) => length.endsWith(" B"))
        ? `${lengths.map((length) => length.slice(0, -2)).join(" + ")} B`
        : lengths.join(" + ");
    const statusSuffix = lostCount
      ? ` · ${translate(lostCount === 1 ? "1 LOST" : "{n} LOST", {
          n: lostCount,
        })}`
      : event.locked
        ? ` · ${translate("ENCRYPTED")}`
        : "";
    card.querySelector(".explain-meta").textContent = `${translate(
      "PACKETS {from}–{to} OF {total}",
      {
        from: firstNumber,
        to: firstNumber + packetCount - 1,
        total: totalPackets,
      },
    )} · ${isolateLtrText(sizeSummary)}${statusSuffix}`;
  } else {
    const statusSuffix = event.lost
      ? ` · ${translate("LOST ON THE WAY")}`
      : event.locked
        ? ` · ${translate("ENCRYPTED")}`
        : "";
    card.querySelector(".explain-meta").textContent = `${translate(
      "PACKET {n} OF {total}",
      {
        n: firstNumber,
        total: totalPackets,
      },
    )} · ${isolateLtrText(event.row.proto)} · ${isolateLtrText(event.row.len)}${statusSuffix}`;
  }
}

function animatePacketExplanationHeight(panel, updateContent) {
  const card = panel.querySelector(".explain-packet");
  const previousHeight = card.offsetHeight;
  card.getAnimations().forEach((animation) => animation.cancel());
  updateContent();
  const nextHeight = card.offsetHeight;
  if (previousHeight !== nextHeight && !prefersReducedMotion()) {
    card.animate(
      [
        {
          height: `${previousHeight}px`,
        },
        {
          height: `${nextHeight}px`,
        },
      ],
      {
        duration: 420,
        easing: EASE_OUT_EXPO,
      },
    );
  }
}

const refreshPacketExplanation = (panel, state) =>
  state.packet &&
  animatePacketExplanationHeight(panel, () =>
    updatePacketExplanation(panel, state.packet, state.lesson),
  );

function applyOverviewState(panel, state) {
  updateProtocolOverview(panel, state.lesson);
  panel.querySelector('[data-view="overview"]').hidden =
    state.view !== "overview";
  panel.querySelector('[data-view="step"]').hidden = state.view !== "step";
  updateStepExplanation(panel, state.content);
  updatePacketExplanation(panel, state.packet, state.lesson);
  panel
    .querySelector(".explain-packet")
    .classList.toggle("is-open", !!state.packet);
}

function updateOverviewBackButton(panel, showBack) {
  const backButton = panel.querySelector(".back-btn");
  const moreButton = panel.querySelector(".more");
  if (backButton.hidden === showBack) {
    backButton.hidden = !showBack;
    moreButton.hidden = showBack;
    if (!prefersReducedMotion()) {
      (showBack ? backButton : moreButton).animate(
        [
          {
            transform: `translateX(${isRtl() ? -14 : 14}px)`,
            opacity: 0,
          },
          {
            transform: "none",
            opacity: 1,
          },
        ],
        {
          duration: 320,
          easing: EASE_OUT_EXPO,
        },
      );
    }
  }
}

function invalidateOverview(panel) {
  panel._shown = null;
}

function updateOverviewPanel(panel, playback, lesson, lessonOrder = 0) {
  const nextState = buildOverviewState(playback, lesson, lessonOrder);
  const previousState = panel._shown;
  panel._latest = nextState;
  // A transition can finish after several updates; render the latest snapshot.
  const latestState = () => panel._latest;
  animateTextChange(
    panel.querySelector(".panel-title"),
    nextState.title,
    !previousState || nextState.rank >= previousState.rank ? 1 : -1,
  );
  updateOverviewBackButton(panel, nextState.view === "step");
  if (!previousState) {
    applyOverviewState(panel, nextState);
  } else if (nextState.lesson !== previousState.lesson) {
    slideContent(
      panel.querySelector(".overview-stage"),
      () => applyOverviewState(panel, latestState()),
      nextState.order > previousState.order ? 1 : -1,
      32,
    );
  } else if (nextState.view !== previousState.view) {
    slideContent(
      panel.querySelector(".overview-stage"),
      () => applyOverviewState(panel, latestState()),
      nextState.view === "step" ? 1 : -1,
      32,
    );
  } else if (
    nextState.view === "step" &&
    nextState.rank !== previousState.rank
  ) {
    slideContent(
      panel.querySelector(".explain"),
      () => applyOverviewState(panel, latestState()),
      nextState.rank > previousState.rank ? 1 : -1,
    );
  } else if (
    nextState.view === "step" &&
    nextState.packet?.number !== previousState.packet?.number
  ) {
    const card = panel.querySelector(".explain-packet");
    const isReply =
      ["client", "dns"].includes(nextState.packet?.event.to) &&
      nextState.packet?.event.from !== "client";
    if (nextState.packet && previousState.packet) {
      slideContent(
        card.querySelector(".explain-packet-inner"),
        () => refreshPacketExplanation(panel, latestState()),
        isReply ? 1 : -1,
        18,
      );
    } else {
      animatePacketExplanationHeight(panel, () => {
        if (nextState.packet) {
          updatePacketExplanation(panel, nextState.packet, nextState.lesson);
        }
        card.classList.toggle("is-open", !!nextState.packet);
      });
    }
  }
  panel._shown = nextState;
}
export {
  bindOverviewBackButton,
  invalidateOverview,
  renderOverviewPanel,
  updateOverviewPanel,
};
