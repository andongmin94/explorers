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
  const e = SIMULATION_VIEWS.map(
    ([t, s, a], n) =>
      `<button type="button" role="tab" data-view="${t}" aria-selected="${n === 0}" class="${n === 0 ? "is-active" : ""}">${a}<span ${translatedElementContent(s)}</span></button>`,
  ).join("");
  return `
  <section class="panel simulation">
    ${renderNetworkDiagram()}
    ${renderSequencePanel()}
    <div class="view-switch" role="tablist" data-t-label="View" aria-label="${translate("View")}" data-t-title="Switch view (V)" title="${translate("Switch view (V)")}">${e}<i class="view-indicator"></i></div>
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
function createViewSwitcher(e, t = () => {}) {
  const s = e.querySelector(".view-indicator");
  function a(r, i = !0) {
    if (
      (e.classList.toggle("is-sequence", r === "sequence"),
      e.querySelectorAll(".view-switch button").forEach((l) => {
        const c = l.dataset.view === r;
        (l.classList.toggle("is-active", c),
          l.setAttribute("aria-selected", c),
          c &&
            ((s.style.left = `${l.offsetLeft}px`),
            (s.style.width = `${l.offsetWidth}px`)));
      }),
      t(r),
      i)
    )
      try {
        localStorage.setItem(VIEW_STORAGE_KEY, r);
      } catch {}
  }
  (e.querySelector(".view-switch").addEventListener("click", (r) => {
    const i = r.target.closest("button");
    i && a(i.dataset.view);
  }),
    a(readSavedView() === "sequence" ? "sequence" : "network", !1),
    requestAnimationFrame(() => s.classList.add("is-ready")));
  const n = () => {
      const r = e.querySelector(".view-switch button.is-active");
      ((s.style.left = `${r.offsetLeft}px`),
        (s.style.width = `${r.offsetWidth}px`));
    },
    o = new ResizeObserver(n);
  return (
    e.querySelectorAll(".view-switch button").forEach((r) => o.observe(r)),
    {
      toggle: () =>
        a(e.classList.contains("is-sequence") ? "network" : "sequence"),
      view: () =>
        e.classList.contains("is-sequence") ? "sequence" : "network",
    }
  );
}
export { createViewSwitcher, renderSimulationPanel };
