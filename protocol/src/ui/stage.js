// Reconstructed from the distributed Protocol Explorer JavaScript.
import { translate, translatedElementContent } from "../i18n.js";
import { renderNetworkDiagram } from "../simulation/network-drawing.js";
import { renderSequencePanel } from "./sequence.js";
import { renderPacketInspector } from "./inspector.js";
const SIMULATION_VIEWS = [
  [
    "network",
    "NETWORK",
    '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 1.8 L14 5 L8 8.2 L2 5 Z M2 8.4 L8 11.6 L14 8.4 M2 11.6 L8 14.8 L14 11.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  ],
  [
    "sequence",
    "SEQUENCE",
    '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 1.5 V14.5 M13 1.5 V14.5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 2"/><path d="M3 4.5 L12 6.5 M12 6.5 L9.6 7.4 M12 6.5 L10.2 4.6 M13 9.5 L4 11.5 M4 11.5 L5.8 9.6 M4 11.5 L6.4 12.4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>',
  ],
];

function renderSimulationPanel() {
  const viewButtons = SIMULATION_VIEWS.map(
    ([view, label, icon], index) =>
      `<button type="button" role="tab" data-view="${view}" aria-selected="${index === 0}" class="${index === 0 ? "is-active" : ""}">${icon}<span ${translatedElementContent(label)}</span></button>`,
  ).join("");
  return `
  <section class="panel simulation">
    ${renderNetworkDiagram()}
    ${renderSequencePanel()}
    <div class="view-switch" role="tablist" data-t-label="View" aria-label="${translate("View")}" data-t-title="Switch view (V)" title="${translate("Switch view (V)")}">${viewButtons}<i class="view-indicator"></i></div>
    ${renderPacketInspector()}
  </section>`;
}
const VIEW_STORAGE_KEY = "protocol-explorer:view";

const readSavedView = () => {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY);
  } catch {
    return null;
  }
};

function createViewSwitcher(panel, onViewChange = () => {}) {
  const indicator = panel.querySelector(".view-indicator");
  function selectView(view, persist = true) {
    panel.classList.toggle("is-sequence", view === "sequence");
    panel.querySelectorAll(".view-switch button").forEach((button) => {
      const selected = button.dataset.view === view;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-selected", selected);
      if (selected) {
        indicator.style.left = `${button.offsetLeft}px`;
        indicator.style.width = `${button.offsetWidth}px`;
      }
    });
    onViewChange(view);
    if (persist) {
      try {
        localStorage.setItem(VIEW_STORAGE_KEY, view);
      } catch {}
    }
  }
  panel.querySelector(".view-switch").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (button) {
      selectView(button.dataset.view);
    }
  });
  selectView(readSavedView() === "sequence" ? "sequence" : "network", false);
  requestAnimationFrame(() => indicator.classList.add("is-ready"));
  const positionIndicator = () => {
    const selectedButton = panel.querySelector(".view-switch button.is-active");
    indicator.style.left = `${selectedButton.offsetLeft}px`;
    indicator.style.width = `${selectedButton.offsetWidth}px`;
  };
  const resizeObserver = new ResizeObserver(positionIndicator);
  panel
    .querySelectorAll(".view-switch button")
    .forEach((button) => resizeObserver.observe(button));
  return {
    toggle: () =>
      selectView(
        panel.classList.contains("is-sequence") ? "network" : "sequence",
      ),
    view: () =>
      panel.classList.contains("is-sequence") ? "sequence" : "network",
  };
}
export { createViewSwitcher, renderSimulationPanel };
