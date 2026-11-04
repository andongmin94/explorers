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
  needsLtrDirection,
  translate,
  translatedElementContent,
} from "../i18n.js";
import { getLessonPackets } from "../packets/encode.js";
const packetInfoDirectionAttributes = (info) =>
  needsLtrDirection(translate(info)) ? ' dir="ltr" class="is-ltr"' : "";

function renderPacketRows(lesson) {
  return getLessonPackets(lesson)
    .map(
      ({ color, row, lost }, index) => `
      <tr data-packet="${index}" class="${lost ? "is-lost" : ""}" tabindex="0" hidden>
        <td><span class="step-badge ${color}">${index + 1}</span></td>
        <td><bdi dir="ltr">${escapeHtml(row.time)}</bdi></td>
        <td><bdi dir="ltr">${escapeHtml(row.src)}</bdi></td>
        <td><bdi dir="ltr">${escapeHtml(row.dst)}</bdi></td>
        <td><bdi dir="ltr">${escapeHtml(row.proto)}</bdi></td>
        <td title="${escapeHtml(translate(row.info))}"${packetInfoDirectionAttributes(row.info)}><span ${translatedElementContent(row.info)}</span>${lost ? `<span class="lost-chip" ${translatedElementContent("LOST")}</span>` : ""}</td>
        <td><bdi dir="ltr">${escapeHtml(row.len)}</bdi></td>
      </tr>`,
    )
    .join("");
}

function renderPacketTable() {
  return `
  <section class="panel packets">
    <div class="panel-head bar">
      <h2 class="panel-title sm" ${translatedElementContent("PACKET FLOW")}</h2>
      <div class="packet-legend" data-t-label="Colour key" aria-label="${translate("Colour key")}"></div>
      <div class="packet-actions">
        <button class="btn speed" type="button" data-action="speed" data-t-title="Playback speed" title="${translate("Playback speed")}"><span class="speed-label">1×</span></button>
        <button class="btn icon" type="button" data-action="prev" data-t-title="Previous step (←)" title="${translate("Previous step (←)")}" data-t-label="Previous step" aria-label="${translate("Previous step")}">
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M7.8 1.8 L3.6 6 L7.8 10.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="btn primary toggle" type="button" data-action="toggle" data-t-title="Play / pause (Space)" title="${translate("Play / pause (Space)")}">
          <span class="toggle-icon">
            <svg class="icon-playpause" viewBox="0 0 12 14" width="12" height="14" aria-hidden="true"><path class="pp-a"/><path class="pp-b"/></svg>
            ${icons.reset.replace("<svg", '<svg class="icon-replay"')}
          </span>
          <span class="toggle-label"></span>
        </button>
        <button class="btn" type="button" data-action="step" data-t-title="One packet at a time" title="${translate("One packet at a time")}"><span ${translatedElementContent("STEP")}</span></button>
        <button class="btn" type="button" data-action="reset" data-t-title="Back to the overview (Esc)" title="${translate("Back to the overview (Esc)")}" data-t-label="Reset" aria-label="${translate("Reset")}">${icons.reset}<span class="btn-text" ${translatedElementContent("RESET")}</span></button>
      </div>
    </div>
    <div class="packet-scroll">
      <table class="packet-table">
        <colgroup>
          <col style="width:75px"><col style="width:125px"><col style="width:161px"><col style="width:165px">
          <col style="width:129px"><col><col style="width:86px">
        </colgroup>
        <thead>
          <tr>${["NO.", "TIME", "SOURCE", "DESTINATION", "PROTOCOL", "INFO", "SIZE"].map((label) => `<th ${translatedElementContent(label)}</th>`).join("")}</tr>
        </thead>
        <tbody class="packet-empty-body"><tr class="packet-empty" hidden><td colspan="7" ${translatedElementContent("No packets on the wire yet.")}</td></tr></tbody>
        <tbody class="packet-rows"></tbody>
      </table>
    </div>
  </section>`;
}

function bindPacketTable(panel, actions) {
  const toggleButton = panel.querySelector(".toggle");
  new ResizeObserver(() => updatePlaybackButtonLayout(toggleButton)).observe(
    toggleButton,
  );
  panel.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (button && !button.disabled) {
      actions[button.dataset.action]();
    }
    const packetRow = event.target.closest("tr[data-packet]");
    if (packetRow && !packetRow.hidden) {
      actions.inspect(Number(packetRow.dataset.packet));
    }
  });
  panel.addEventListener("keydown", (event) => {
    const packetRow =
      event.key === "Enter" && event.target.closest("tr[data-packet]");
    if (packetRow && !packetRow.hidden) {
      actions.inspect(Number(packetRow.dataset.packet));
    }
  });
}
const getVisibleOpacity = (element) =>
  element.hidden ? 0 : Number(getComputedStyle(element).opacity);

function showPacketRow(row, delay = 0) {
  const opacity = getVisibleOpacity(row);
  row.dataset.shown = "1";
  row.getAnimations().forEach((animation) => animation.cancel());
  row.hidden = false;
  if (!(prefersReducedMotion() || opacity === 1)) {
    row.animate(
      [
        {
          opacity,
          transform: `translateY(${10 * (1 - opacity)}px)`,
        },
        {
          opacity: 1,
          transform: "none",
        },
      ],
      {
        duration: 360,
        delay: opacity > 0 ? 0 : delay,
        easing: EASE_OUT_EXPO,
        fill: "backwards",
      },
    );
  }
}

function hidePacketRow(row) {
  const opacity = getVisibleOpacity(row);
  const transform = row.hidden ? "none" : getComputedStyle(row).transform;
  row.dataset.shown = "0";
  row.getAnimations().forEach((animation) => animation.cancel());
  if (prefersReducedMotion() || opacity === 0) {
    return (row.hidden = true);
  }
  const exitAnimation = row.animate(
    [
      {
        opacity,
        transform,
      },
      {
        opacity: 0,
        transform,
      },
    ],
    {
      duration: 180 * opacity,
      fill: "forwards",
    },
  );
  exitAnimation.onfinish = () => {
    if (row.dataset.shown === "0") {
      row.hidden = true;
    }
    exitAnimation.cancel();
  };
}
const renderPacketLegend = (lesson) =>
  (lesson.legend ?? [])
    .map(([color, label]) =>
      color
        ? `<span class="legend-item"><i class="legend-dot step-badge ${color}"></i>${escapeHtml(translate(label))}</span>`
        : `<span class="legend-note">${escapeHtml(translate(label))}</span>`,
    )
    .join("");

function setPacketTableLesson(panel, lesson) {
  const rowsContainer = panel.querySelector(".packet-rows");
  const legend = panel.querySelector(".packet-legend");
  const isFirstRender = !panel.dataset.lesson;
  panel.dataset.lesson = lesson.id;
  if (isFirstRender) {
    legend.innerHTML = renderPacketLegend(lesson);
  } else {
    slideContent(
      legend,
      () => (legend.innerHTML = renderPacketLegend(lesson)),
      1,
      16,
    );
  }
  const visibleRows = [...rowsContainer.children].filter((row) => !row.hidden);
  const replaceRows = () => {
    // The old rows may still be fading out after another lesson was selected.
    if (panel.dataset.lesson === lesson.id) {
      rowsContainer.innerHTML = renderPacketRows(lesson);
      rowsContainer.dataset.lesson = lesson.id;
      panel.querySelector(".packet-scroll").scrollTop = 0;
      if (panel._latest) {
        updatePacketRows(panel, panel._latest);
      }
    }
  };
  if (!visibleRows.length || prefersReducedMotion()) {
    return replaceRows();
  }
  visibleRows.forEach(hidePacketRow);
  setTimeout(replaceRows, 200);
}

function updatePacketRows(panel, playback) {
  if (
    panel.querySelector(".packet-rows").dataset.lesson !== panel.dataset.lesson
  ) {
    return;
  }
  const rows = [...panel.querySelectorAll("tr[data-packet]")];
  const shouldShow = rows.map(
    (row, index) => !playback.started || playback.packets[index] !== "future",
  );
  const enteringRows = rows.filter(
    (row, index) => shouldShow[index] && row.dataset.shown !== "1",
  );
  const leavingRows = rows.filter(
    (row, index) => !shouldShow[index] && row.dataset.shown === "1",
  );
  leavingRows.forEach(hidePacketRow);
  enteringRows.forEach((row, index) =>
    showPacketRow(
      row,
      (leavingRows.length ? 200 : 0) +
        (enteringRows.length > 1 ? index * 35 : 0),
    ),
  );
  rows.forEach((row, index) =>
    row.classList.toggle(
      "is-current",
      playback.started && playback.packets[index] === "current",
    ),
  );
  if (playback.started && enteringRows.length === 1) {
    const scrollContainer = panel.querySelector(".packet-scroll");
    requestAnimationFrame(() =>
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: "smooth",
      }),
    );
  }
  if (!playback.started && enteringRows.length) {
    panel.querySelector(".packet-scroll").scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }
  const emptyMessage = panel.querySelector(".packet-empty");
  const showEmptyMessage = playback.started && !shouldShow.some(Boolean);
  if (showEmptyMessage && emptyMessage.dataset.shown !== "1") {
    showPacketRow(emptyMessage, leavingRows.length ? 220 : 0);
  }
  if (!showEmptyMessage && emptyMessage.dataset.shown === "1") {
    hidePacketRow(emptyMessage);
  }
}

function updatePacketTable(panel, playback, lesson) {
  panel._latest = playback;
  if (panel.dataset.lesson !== lesson.id) {
    setPacketTableLesson(panel, lesson);
  } else {
    updatePacketRows(panel, playback);
  }
  const toggleButton = panel.querySelector(".toggle");
  toggleButton.classList.toggle("is-playing", playback.playing);
  toggleButton.classList.toggle("is-done", playback.done && !playback.playing);
  animateTextChange(
    toggleButton.querySelector(".toggle-label"),
    translate(playback.playing ? "PAUSE" : playback.done ? "REPLAY" : "PLAY"),
  );
  panel.querySelector('[data-action="step"]').disabled = playback.done;
  panel.querySelector('[data-action="prev"]').disabled = !playback.started;
}

function translatePacketTable(panel, lesson) {
  panel.querySelector(".packet-legend").innerHTML = renderPacketLegend(lesson);
  fitPlaybackButton(panel);
  panel.querySelectorAll("tr[data-packet] td[title]").forEach((cell) => {
    const translatedInfo = translate(cell.querySelector("[data-t]").dataset.t);
    cell.title = translatedInfo;
    const forceLtr = needsLtrDirection(translatedInfo);
    cell.classList.toggle("is-ltr", forceLtr);
    if (forceLtr) {
      cell.dir = "ltr";
    } else {
      cell.removeAttribute("dir");
    }
  });
}

function fitPlaybackButton(panel) {
  const labelElement = panel.querySelector(".toggle-label");
  const currentLabel = labelElement.textContent;
  labelElement.style.minWidth = "";
  const maxLabelWidth = Math.max(
    ...["PLAY", "PAUSE", "REPLAY"].map((label) => {
      labelElement.textContent = translate(label);
      return labelElement.scrollWidth;
    }),
  );
  labelElement.textContent = currentLabel;
  labelElement.style.minWidth = `${maxLabelWidth}px`;
  const toggleButton = panel.querySelector(".toggle");
  const buttonStyle = getComputedStyle(toggleButton);
  toggleButton._need =
    maxLabelWidth +
    16 +
    parseFloat(buttonStyle.columnGap || 12) +
    parseFloat(buttonStyle.paddingLeft) +
    parseFloat(buttonStyle.paddingRight) +
    2;
  updatePlaybackButtonLayout(toggleButton);
}
const updatePlaybackButtonLayout = (toggleButton) =>
  toggleButton.classList.toggle(
    "is-iconic",
    getComputedStyle(toggleButton).containerType === "inline-size" &&
      toggleButton.clientWidth < (toggleButton._need ?? 0),
  );

function updatePlaybackSpeedLabel(panel, speed) {
  animateTextChange(panel.querySelector(".speed-label"), `${speed}×`);
}
export {
  bindPacketTable,
  fitPlaybackButton,
  renderPacketTable,
  translatePacketTable,
  updatePacketTable,
  updatePlaybackSpeedLabel,
};
