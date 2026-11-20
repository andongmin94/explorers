// Stage plate: one scene that shows either the isometric network or the
// sequence diagram. Both views read the same playback and share packet flights.
import { translate } from "../i18n.js";
import { renderNetworkDiagram } from "../simulation/network-drawing.js";
import { renderSequencePanel } from "./sequence.js";

const SIMULATION_VIEWS = [
  ["network", "NETWORK"],
  ["sequence", "SEQUENCE"],
];

function renderSimulationPanel() {
  const viewButtons = SIMULATION_VIEWS.map(
    ([view, label], index) =>
      `<button type="button" role="tab" data-view="${view}" aria-selected="${index === 0}">${translate(label)}</button>`,
  ).join("");
  return `
  <section class="hw-plate hw-stage pe-stage">
    <div class="hw-plate-head">
      <span class="hw-label"><span class="hw-index">A</span> 통신 장면</span>
      <div class="hw-seg view-switch" role="tablist" aria-label="${translate("View")}" title="${translate("Switch view (V)")}">${viewButtons}</div>
      <span class="hw-lcd stage-lcd" aria-hidden="true"><span class="stage-lcd-value">--</span><small class="stage-lcd-unit">단계</small></span>
    </div>
    <div class="hw-scene pe-scene simulation">
      ${renderNetworkDiagram()}
      ${renderSequencePanel()}
    </div>
    <div class="hw-plate-foot stage-foot" aria-live="polite"><span class="hw-led stage-led"></span><span class="stage-status"></span></div>
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

function createViewSwitcher(stage, onViewChange = () => {}) {
  const scene = stage.querySelector(".simulation");
  function selectView(view, persist = true) {
    scene.classList.toggle("is-sequence", view === "sequence");
    stage.querySelectorAll(".view-switch button").forEach((button) =>
      button.setAttribute("aria-selected", button.dataset.view === view),
    );
    onViewChange(view);
    if (persist) {
      try {
        localStorage.setItem(VIEW_STORAGE_KEY, view);
      } catch {}
    }
  }
  stage.querySelector(".view-switch").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (button) selectView(button.dataset.view);
  });
  selectView(readSavedView() === "sequence" ? "sequence" : "network", false);
  return {
    toggle: () =>
      selectView(scene.classList.contains("is-sequence") ? "network" : "sequence"),
    view: () => (scene.classList.contains("is-sequence") ? "sequence" : "network"),
  };
}

export { createViewSwitcher, renderSimulationPanel };
