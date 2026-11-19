// Records plate: the packet table, synced to playback, with the packet
// inspector opening as a second column beside it.
import { EASE_OUT_EXPO, prefersReducedMotion, slideContent } from "./motion.js";
import { escapeHtml, translate } from "../i18n.js";
import { getLessonPackets } from "../packets/encode.js";
import { PACKET_COLORS } from "../simulation/network-drawing.js";
import { renderPacketInspector } from "./inspector.js";

function renderPacketRows(lesson) {
  return getLessonPackets(lesson)
    .map(
      ({ color, row, lost }, index) => `
      <tr data-packet="${index}" tabindex="0" hidden>
        <td class="hw-mono pk-no"><span class="hw-led is-on" style="--led:${PACKET_COLORS[color]}"></span>${index + 1}</td>
        <td class="hw-mono">${escapeHtml(row.time)}</td>
        <td class="hw-mono">${escapeHtml(row.src)}</td>
        <td class="hw-mono">${escapeHtml(row.dst)}</td>
        <td class="hw-mono">${escapeHtml(row.proto)}</td>
        <td class="pk-info" title="${escapeHtml(translate(row.info))}"><span>${escapeHtml(translate(row.info))}</span>${lost ? `<span class="hw-tag lost-tag">${translate("LOST")}</span>` : ""}</td>
        <td class="hw-mono pk-len">${escapeHtml(row.len)}</td>
      </tr>`,
    )
    .join("");
}

function renderPacketTable() {
  const headings = ["NO.", "TIME", "SOURCE", "DESTINATION", "PROTOCOL", "INFO", "SIZE"]
    .map((label) => `<th>${translate(label)}</th>`)
    .join("");
  return `
  <section class="hw-plate hw-records packets">
    <div class="hw-plate-head">
      <span class="hw-label"><span class="hw-index">C</span> ${translate("PACKET FLOW")}</span>
      <div class="packet-legend" aria-label="${translate("Colour key")}"></div>
      <span class="hw-label records-hint">행을 누르면 바이트를 봅니다</span>
    </div>
    <div class="records-body">
      <div class="hw-scroll packet-scroll">
        <table class="hw-table packet-table">
          <colgroup><col class="c-no"><col class="c-time"><col class="c-addr"><col class="c-addr"><col class="c-proto"><col><col class="c-len"></colgroup>
          <thead><tr>${headings}</tr></thead>
          <tbody class="packet-empty-body"><tr class="packet-empty" hidden><td colspan="7">${translate("No packets on the wire yet.")}</td></tr></tbody>
          <tbody class="packet-rows"></tbody>
        </table>
      </div>
      ${renderPacketInspector()}
    </div>
  </section>`;
}

// On the desktop console the table never scrolls: it shows the window of
// sent packets that fits, ending at the newest one (or around the packet
// being inspected). Rows outside the window get .is-out; the hidden
// attribute stays reserved for packets that are not on the wire yet.
const fitsDesktopConsole = () => matchMedia("(min-width: 1100px) and (min-height: 700px)").matches;

function fitPacketRows(panel) {
  const box = panel.querySelector(".packet-scroll");
  const rows = [...box.querySelectorAll("tbody tr")];
  rows.forEach((row) => row.classList.remove("is-out"));
  if (!fitsDesktopConsole()) return;
  const shown = rows.filter((row) => !row.hidden);
  if (!shown.length) return;
  const head = box.querySelector("thead").getBoundingClientRect().height;
  const style = getComputedStyle(box);
  const room = box.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - head - 2;
  const rowHeight = Math.max(...shown.slice(0, 3).map((row) => row.getBoundingClientRect().height), 1);
  const fit = Math.max(1, Math.floor(room / rowHeight));
  if (shown.length <= fit) return;
  const inspected = shown.indexOf(box.querySelector("tr.is-inspected"));
  let start = shown.length - fit;
  if (inspected >= 0 && inspected < start) start = Math.max(0, inspected - Math.floor(fit * 0.4));
  shown.forEach((row, index) => row.classList.toggle("is-out", index < start || index >= start + fit));
}

function bindPacketTable(panel, { inspect }) {
  new ResizeObserver(() => fitPacketRows(panel)).observe(panel.querySelector(".packet-scroll"));
  panel.querySelector(".packet-scroll").addEventListener("click", (event) => {
    const packetRow = event.target.closest("tr[data-packet]");
    if (packetRow && !packetRow.hidden) inspect(Number(packetRow.dataset.packet));
  });
  panel.querySelector(".packet-scroll").addEventListener("keydown", (event) => {
    const packetRow = event.key === "Enter" && event.target.closest("tr[data-packet]");
    if (packetRow && !packetRow.hidden) inspect(Number(packetRow.dataset.packet));
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
      [{ opacity }, { opacity: 1 }],
      { duration: 320, delay: opacity > 0 ? 0 : delay, easing: EASE_OUT_EXPO, fill: "backwards" },
    );
  }
}

function hidePacketRow(row) {
  const opacity = getVisibleOpacity(row);
  row.dataset.shown = "0";
  row.getAnimations().forEach((animation) => animation.cancel());
  if (prefersReducedMotion() || opacity === 0) {
    row.hidden = true;
    return;
  }
  const exit = row.animate([{ opacity }, { opacity: 0 }], { duration: 180 * opacity, fill: "forwards" });
  exit.onfinish = () => {
    if (row.dataset.shown === "0") row.hidden = true;
    exit.cancel();
    const panel = row.closest(".packets");
    if (panel) fitPacketRows(panel);
  };
}

const renderPacketLegend = (lesson) =>
  (lesson.legend ?? [])
    .map(([color, label]) =>
      color
        ? `<span class="legend-item"><span class="hw-led is-on" style="--led:${PACKET_COLORS[color]}"></span>${escapeHtml(translate(label))}</span>`
        : `<span class="legend-note">${escapeHtml(translate(label))}</span>`,
    )
    .join("");

function setPacketTableLesson(panel, lesson) {
  const rowsContainer = panel.querySelector(".packet-rows");
  const legend = panel.querySelector(".packet-legend");
  const isFirstRender = !panel.dataset.lesson;
  panel.dataset.lesson = lesson.id;
  if (isFirstRender) legend.innerHTML = renderPacketLegend(lesson);
  else slideContent(legend, () => (legend.innerHTML = renderPacketLegend(lesson)), 1, 16);
  const visibleRows = [...rowsContainer.children].filter((row) => !row.hidden);
  const replaceRows = () => {
    // The old rows may still be fading out after another lesson was selected.
    if (panel.dataset.lesson === lesson.id) {
      rowsContainer.innerHTML = renderPacketRows(lesson);
      rowsContainer.dataset.lesson = lesson.id;
      panel.querySelector(".packet-scroll").scrollTop = 0;
      if (panel._latest) updatePacketRows(panel, panel._latest);
    }
  };
  if (!visibleRows.length || prefersReducedMotion()) return replaceRows();
  visibleRows.forEach(hidePacketRow);
  setTimeout(replaceRows, 200);
}

function updatePacketRows(panel, playback) {
  if (panel.querySelector(".packet-rows").dataset.lesson !== panel.dataset.lesson) return;
  const rows = [...panel.querySelectorAll("tr[data-packet]")];
  const shouldShow = rows.map((row, index) => !playback.started || playback.packets[index] !== "future");
  const entering = rows.filter((row, index) => shouldShow[index] && row.dataset.shown !== "1");
  const leaving = rows.filter((row, index) => !shouldShow[index] && row.dataset.shown === "1");
  leaving.forEach(hidePacketRow);
  entering.forEach((row, index) =>
    showPacketRow(row, (leaving.length ? 200 : 0) + (entering.length > 1 ? index * 35 : 0)),
  );
  rows.forEach((row, index) => {
    const current = playback.started && playback.packets[index] === "current";
    row.setAttribute("aria-current", current);
    row.classList.toggle("is-current", current);
    row.classList.toggle("is-lost", playback.packets[index] === "lost");
  });
  const scrollContainer = panel.querySelector(".packet-scroll");
  if (playback.started && entering.length === 1) {
    requestAnimationFrame(() =>
      scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: "smooth" }),
    );
  }
  if (!playback.started && entering.length) scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
  const empty = panel.querySelector(".packet-empty");
  const showEmpty = playback.started && !shouldShow.some(Boolean);
  if (showEmpty && empty.dataset.shown !== "1") showPacketRow(empty, leaving.length ? 220 : 0);
  if (!showEmpty && empty.dataset.shown === "1") hidePacketRow(empty);
  fitPacketRows(panel);
}

function updatePacketTable(panel, playback, lesson) {
  panel._latest = playback;
  if (panel.dataset.lesson !== lesson.id) setPacketTableLesson(panel, lesson);
  else updatePacketRows(panel, playback);
}

export { bindPacketTable, fitPacketRows, renderPacketTable, updatePacketTable };
