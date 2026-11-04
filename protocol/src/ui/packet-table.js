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
const packetInfoDirectionAttributes = (e) =>
  needsLtrDirection(translate(e)) ? ' dir="ltr" class="is-ltr"' : "";
function renderPacketRows(e) {
  return getLessonPackets(e)
    .map(
      ({ color: t, row: s, lost: a }, n) => `
      <tr data-packet="${n}" class="${a ? "is-lost" : ""}" tabindex="0" hidden>
        <td><span class="step-badge ${t}">${n + 1}</span></td>
        <td><bdi dir="ltr">${escapeHtml(s.time)}</bdi></td>
        <td><bdi dir="ltr">${escapeHtml(s.src)}</bdi></td>
        <td><bdi dir="ltr">${escapeHtml(s.dst)}</bdi></td>
        <td><bdi dir="ltr">${escapeHtml(s.proto)}</bdi></td>
        <td title="${escapeHtml(translate(s.info))}"${packetInfoDirectionAttributes(s.info)}><span ${translatedElementContent(s.info)}</span>${a ? `<span class="lost-chip" ${translatedElementContent("LOST")}</span>` : ""}</td>
        <td><bdi dir="ltr">${escapeHtml(s.len)}</bdi></td>
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
          <tr>${["NO.", "TIME", "SOURCE", "DESTINATION", "PROTOCOL", "INFO", "SIZE"].map((e) => `<th ${translatedElementContent(e)}</th>`).join("")}</tr>
        </thead>
        <tbody class="packet-empty-body"><tr class="packet-empty" hidden><td colspan="7" ${translatedElementContent("No packets on the wire yet.")}</td></tr></tbody>
        <tbody class="packet-rows"></tbody>
      </table>
    </div>
  </section>`;
}
function bindPacketTable(e, t) {
  const s = e.querySelector(".toggle");
  (new ResizeObserver(() => updatePlaybackButtonLayout(s)).observe(s),
    e.addEventListener("click", (a) => {
      const n = a.target.closest("[data-action]");
      n && !n.disabled && t[n.dataset.action]();
      const o = a.target.closest("tr[data-packet]");
      o && !o.hidden && t.inspect(Number(o.dataset.packet));
    }),
    e.addEventListener("keydown", (a) => {
      const n = a.key === "Enter" && a.target.closest("tr[data-packet]");
      n && !n.hidden && t.inspect(Number(n.dataset.packet));
    }));
}
const getVisibleOpacity = (e) =>
  e.hidden ? 0 : Number(getComputedStyle(e).opacity);
function showPacketRow(e, t = 0) {
  const s = getVisibleOpacity(e);
  ((e.dataset.shown = "1"),
    e.getAnimations().forEach((a) => a.cancel()),
    (e.hidden = !1),
    !(prefersReducedMotion() || s === 1) &&
      e.animate(
        [
          {
            opacity: s,
            transform: `translateY(${10 * (1 - s)}px)`,
          },
          {
            opacity: 1,
            transform: "none",
          },
        ],
        {
          duration: 360,
          delay: s > 0 ? 0 : t,
          easing: EASE_OUT_EXPO,
          fill: "backwards",
        },
      ));
}
function hidePacketRow(e) {
  const t = getVisibleOpacity(e),
    s = e.hidden ? "none" : getComputedStyle(e).transform;
  if (
    ((e.dataset.shown = "0"),
    e.getAnimations().forEach((n) => n.cancel()),
    prefersReducedMotion() || t === 0)
  )
    return (e.hidden = !0);
  const a = e.animate(
    [
      {
        opacity: t,
        transform: s,
      },
      {
        opacity: 0,
        transform: s,
      },
    ],
    {
      duration: 180 * t,
      fill: "forwards",
    },
  );
  a.onfinish = () => {
    (e.dataset.shown === "0" && (e.hidden = !0), a.cancel());
  };
}
const renderPacketLegend = (e) =>
  (e.legend ?? [])
    .map(([t, s]) =>
      t
        ? `<span class="legend-item"><i class="legend-dot step-badge ${t}"></i>${escapeHtml(translate(s))}</span>`
        : `<span class="legend-note">${escapeHtml(translate(s))}</span>`,
    )
    .join("");
function setPacketTableLesson(e, t) {
  const s = e.querySelector(".packet-rows"),
    a = e.querySelector(".packet-legend"),
    n = !e.dataset.lesson;
  ((e.dataset.lesson = t.id),
    n
      ? (a.innerHTML = renderPacketLegend(t))
      : slideContent(a, () => (a.innerHTML = renderPacketLegend(t)), 1, 16));
  const o = [...s.children].filter((i) => !i.hidden),
    r = () => {
      e.dataset.lesson === t.id &&
        ((s.innerHTML = renderPacketRows(t)),
        (s.dataset.lesson = t.id),
        (e.querySelector(".packet-scroll").scrollTop = 0),
        e._latest && updatePacketRows(e, e._latest));
    };
  if (!o.length || prefersReducedMotion()) return r();
  (o.forEach(hidePacketRow), setTimeout(r, 200));
}
function updatePacketRows(e, t) {
  if (e.querySelector(".packet-rows").dataset.lesson !== e.dataset.lesson)
    return;
  const s = [...e.querySelectorAll("tr[data-packet]")],
    a = s.map((l, c) => !t.started || t.packets[c] !== "future"),
    n = s.filter((l, c) => a[c] && l.dataset.shown !== "1"),
    o = s.filter((l, c) => !a[c] && l.dataset.shown === "1");
  if (
    (o.forEach(hidePacketRow),
    n.forEach((l, c) =>
      showPacketRow(l, (o.length ? 200 : 0) + (n.length > 1 ? c * 35 : 0)),
    ),
    s.forEach((l, c) =>
      l.classList.toggle("is-current", t.started && t.packets[c] === "current"),
    ),
    t.started && n.length === 1)
  ) {
    const l = e.querySelector(".packet-scroll");
    requestAnimationFrame(() =>
      l.scrollTo({
        top: l.scrollHeight,
        behavior: "smooth",
      }),
    );
  }
  !t.started &&
    n.length &&
    e.querySelector(".packet-scroll").scrollTo({
      top: 0,
      behavior: "smooth",
    });
  const r = e.querySelector(".packet-empty"),
    i = t.started && !a.some(Boolean);
  (i && r.dataset.shown !== "1" && showPacketRow(r, o.length ? 220 : 0),
    !i && r.dataset.shown === "1" && hidePacketRow(r));
}
function updatePacketTable(e, t, s) {
  ((e._latest = t),
    e.dataset.lesson !== s.id
      ? setPacketTableLesson(e, s)
      : updatePacketRows(e, t));
  const a = e.querySelector(".toggle");
  (a.classList.toggle("is-playing", t.playing),
    a.classList.toggle("is-done", t.done && !t.playing),
    animateTextChange(
      a.querySelector(".toggle-label"),
      translate(t.playing ? "PAUSE" : t.done ? "REPLAY" : "PLAY"),
    ),
    (e.querySelector('[data-action="step"]').disabled = t.done),
    (e.querySelector('[data-action="prev"]').disabled = !t.started));
}
function translatePacketTable(e, t) {
  ((e.querySelector(".packet-legend").innerHTML = renderPacketLegend(t)),
    fitPlaybackButton(e),
    e.querySelectorAll("tr[data-packet] td[title]").forEach((s) => {
      const a = translate(s.querySelector("[data-t]").dataset.t);
      s.title = a;
      const n = needsLtrDirection(a);
      (s.classList.toggle("is-ltr", n),
        n ? (s.dir = "ltr") : s.removeAttribute("dir"));
    }));
}
function fitPlaybackButton(e) {
  const t = e.querySelector(".toggle-label"),
    s = t.textContent;
  t.style.minWidth = "";
  const a = Math.max(
    ...["PLAY", "PAUSE", "REPLAY"].map(
      (r) => ((t.textContent = translate(r)), t.scrollWidth),
    ),
  );
  ((t.textContent = s), (t.style.minWidth = `${a}px`));
  const n = e.querySelector(".toggle"),
    o = getComputedStyle(n);
  ((n._need =
    a +
    16 +
    parseFloat(o.columnGap || 12) +
    parseFloat(o.paddingLeft) +
    parseFloat(o.paddingRight) +
    2),
    updatePlaybackButtonLayout(n));
}
const updatePlaybackButtonLayout = (e) =>
  e.classList.toggle(
    "is-iconic",
    getComputedStyle(e).containerType === "inline-size" &&
      e.clientWidth < (e._need ?? 0),
  );
function updatePlaybackSpeedLabel(e, t) {
  animateTextChange(e.querySelector(".speed-label"), `${t}×`);
}
export {
  bindPacketTable,
  fitPlaybackButton,
  renderPacketTable,
  translatePacketTable,
  updatePacketTable,
  updatePlaybackSpeedLabel,
};
