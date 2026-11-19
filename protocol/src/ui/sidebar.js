// Protocol picker: a category selector and the 14 protocols, each with an LED
// for learning progress (off: new, amber: in progress, lit: complete).
import { protocolCatalog } from "../lessons/index.js";
import { getLessonCompletion, getLessonStatus } from "../progress.js";
import { translate } from "../i18n.js";
import { icon } from "../../../shared/hw.js";

const PROTOCOL_FILTERS = [
  ["all", "ALL"],
  ["core", "CORE"],
  ["application", "APPLICATION"],
  ["security", "SECURITY"],
];

const STATUS_TEXT = { new: "시작 전", progress: "진행 중", done: "완료" };

function renderSidebar(lessons) {
  const rows = protocolCatalog
    .map((protocol) => {
      const lesson = lessons[protocol.id];
      const status = getLessonStatus(lesson);
      return `<button class="proto" type="button" data-lesson="${protocol.id}" data-group="${protocol.group}" aria-current="false">
        <span class="hw-led status-led is-${status}" data-status="${status}"></span>
        <span class="proto-text"><span class="proto-name">${protocol.name}</span><span class="proto-full">${translate(protocol.full)}</span></span>
        <span class="proto-pct hw-mono" aria-label="${STATUS_TEXT[status]}">${Math.round(getLessonCompletion(lesson) * 100)}%</span>
      </button>`;
    })
    .join("");
  const filters = PROTOCOL_FILTERS.map(([group, label], index) => {
    const count =
      group === "all"
        ? protocolCatalog.length
        : protocolCatalog.filter((protocol) => protocol.group === group).length;
    return `<button type="button" role="tab" aria-selected="${index === 0}" data-group="${group}" title="${count}개">${translate(label)}</button>`;
  }).join("");
  return `
  <aside class="hw-plate pe-picker sidebar" id="protocols" aria-label="${translate("INTERNET PROTOCOLS")}">
    <div class="hw-plate-head">
      <span class="hw-label"><span class="hw-index">P</span> ${translate("INTERNET PROTOCOLS")}</span>
      <button class="hw-key hw-key--sm hw-key--icon drawer-close" type="button" aria-label="${translate("Close the protocol list")}" title="${translate("Close (Esc)")}">${icon("close")}</button>
    </div>
    <div class="pe-picker-body">
      <div class="hw-seg pe-filter" role="tablist" aria-label="분류">${filters}</div>
      <div class="hw-list proto-list">${rows}</div>
    </div>
  </aside>`;
}

function bindSidebar(sidebar, { onSelect }) {
  sidebar.addEventListener("click", (event) => {
    const row = event.target.closest(".proto");
    if (row) onSelect(row.dataset.lesson);
    const filter = event.target.closest(".pe-filter [role=tab]");
    if (filter) {
      sidebar.querySelectorAll(".pe-filter [role=tab]").forEach((tab) =>
        tab.setAttribute("aria-selected", tab === filter),
      );
      const group = filter.dataset.group;
      sidebar.querySelectorAll(".proto").forEach((protoRow) => {
        protoRow.hidden = !(group === "all" || protoRow.dataset.group === group);
      });
    }
  });
}

function updateSidebarProgress(sidebar, lessons) {
  sidebar.querySelectorAll(".proto").forEach((row) => {
    const lesson = lessons[row.dataset.lesson];
    const status = getLessonStatus(lesson);
    const ledElement = row.querySelector(".status-led");
    if (ledElement.dataset.status !== status) {
      ledElement.dataset.status = status;
      ledElement.className = `hw-led status-led is-${status}`;
    }
    const pct = row.querySelector(".proto-pct");
    pct.textContent = `${Math.round(getLessonCompletion(lesson) * 100)}%`;
    pct.setAttribute("aria-label", STATUS_TEXT[status]);
  });
}

function updateSidebar(sidebar, playback, lesson) {
  if (sidebar.dataset.lesson === lesson.id) return;
  sidebar.dataset.lesson = lesson.id;
  sidebar.querySelectorAll(".proto").forEach((row) => {
    const selected = row.dataset.lesson === lesson.id;
    row.setAttribute("aria-current", selected);
    if (selected && row.hidden) {
      // A lesson chosen elsewhere stays visible: fall back to all protocols.
      sidebar.querySelector('.pe-filter [data-group="all"]').click();
    }
  });
}

export { bindSidebar, renderSidebar, updateSidebar, updateSidebarProgress };
