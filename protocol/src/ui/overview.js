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
const getLocalizedNodeName = (e, t) =>
  translate(e.labels?.[t]?.[0] ?? NETWORK_SHORT_LABELS[t]);
const PACKET_LOCK_SVG =
  '<svg class="pill-lock" viewBox="0 0 12 14" width="10" height="12" aria-hidden="true"><path d="M3 6.5 V4.5 a3 3 0 0 1 6 0 V6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="1.5" y="6.5" width="9" height="6.5" rx="1.3" fill="currentColor"/></svg>';
const renderFacts = (e) =>
  e
    .map(
      ([t, s]) =>
        `<div><dt>${escapeHtml(localizedUpperCase(translate(t)))}</dt><dd>${escapeHtml(translate(s))}</dd></div>`,
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
function bindOverviewBackButton(e, t) {
  e.querySelector(".back-btn").addEventListener("click", t);
}
function buildOverviewState(e, t, s) {
  const a = t.steps[e.activeStep],
    n = getLessonPackets(t),
    o = e.event,
    r =
      e.started &&
      !e.done &&
      (o?.type === "packet" || o?.type === "stream") &&
      o.step === e.activeStep,
    i = r
      ? n.indexOf(
          o.type === "stream" ? o.packets[0] : n.find((l) => l.row === o.row),
        ) + 1
      : 0;
  return {
    lesson: t,
    order: s,
    view: e.started ? "step" : "overview",
    title: translate(
      e.started
        ? e.done
          ? "LESSON SUMMARY"
          : "STEP DETAILS"
        : "PROTOCOL OVERVIEW",
    ),
    rank: e.started ? (e.done ? t.steps.length : e.activeStep) : -1,
    content: e.done
      ? {
          label: translate("LESSON COMPLETE"),
          ...t.outro,
          done: !0,
        }
      : {
          label: translate("STEP {n} OF {total}", {
            n: e.activeStep + 1,
            total: t.steps.length,
          }),
          title: a.title,
          desc: a.desc,
          text: a.detail,
          facts: a.facts,
        },
    packet: r
      ? {
          number: i,
          count: o.type === "stream" ? o.packets.length : 1,
          total: n.length,
          event: o,
        }
      : null,
  };
}
function updateProtocolOverview(e, t) {
  const s = e.querySelector('[data-view="overview"]');
  ((s.querySelector("h3").textContent = t.name),
    (s.querySelector(".overview-full").textContent = translate(
      t.overview.full,
    )),
    (s.querySelector(".overview-desc").textContent = translate(
      t.overview.description,
    )),
    (s.querySelector(".overview-facts").innerHTML = renderFacts(
      t.overview.facts,
    )));
}
function updateStepExplanation(e, t) {
  const s = e.querySelector(".explain");
  (s.classList.toggle("is-done", !!t.done),
    (s.querySelector(".explain-label").textContent = t.label),
    (s.querySelector(".explain-title").textContent = localizedUpperCase(
      translate(t.title),
    )),
    (s.querySelector(".explain-sub").textContent = translate(t.desc)),
    (s.querySelector(".explain-text").textContent = translate(t.text)),
    (s.querySelector(".explain-facts").innerHTML = renderFacts(t.facts ?? [])),
    (s.scrollTop = 0));
}
function updatePacketExplanation(e, t, s) {
  if (!t) return;
  const a = e.querySelector(".explain-packet"),
    { event: n, number: o, count: r, total: i } = t;
  if (
    ((a.dataset.color = n.color),
    (a.querySelector("b").innerHTML =
      (n.locked ? PACKET_LOCK_SVG : "") + escapeHtml(translate(n.label))),
    (a.querySelector("span").textContent = localizedUpperCase(
      `${getLocalizedNodeName(s, n.from)} ${isRtl() ? "←" : "→"} ${getLocalizedNodeName(s, n.to)}`,
    )),
    (a.querySelector(".explain-payload").textContent = n.payload.map((l) =>
      translate(l),
    ).join(`
`)),
    n.type === "stream")
  ) {
    const l = n.packets.filter((y) => y.lost).length,
      c = n.packets.map((y) => y.row.len),
      h = c.every((y) => y === c[0])
        ? `${r} × ${c[0]}`
        : c.every((y) => y.endsWith(" B"))
          ? `${c.map((y) => y.slice(0, -2)).join(" + ")} B`
          : c.join(" + "),
      d = l
        ? ` · ${translate(l === 1 ? "1 LOST" : "{n} LOST", {
            n: l,
          })}`
        : n.locked
          ? ` · ${translate("ENCRYPTED")}`
          : "";
    a.querySelector(".explain-meta").textContent = `${translate(
      "PACKETS {from}–{to} OF {total}",
      {
        from: o,
        to: o + r - 1,
        total: i,
      },
    )} · ${isolateLtrText(h)}${d}`;
  } else {
    const l = n.lost
      ? ` · ${translate("LOST ON THE WAY")}`
      : n.locked
        ? ` · ${translate("ENCRYPTED")}`
        : "";
    a.querySelector(".explain-meta").textContent = `${translate(
      "PACKET {n} OF {total}",
      {
        n: o,
        total: i,
      },
    )} · ${isolateLtrText(n.row.proto)} · ${isolateLtrText(n.row.len)}${l}`;
  }
}
function animatePacketExplanationHeight(e, t) {
  const s = e.querySelector(".explain-packet"),
    a = s.offsetHeight;
  (s.getAnimations().forEach((o) => o.cancel()), t());
  const n = s.offsetHeight;
  a !== n &&
    !prefersReducedMotion() &&
    s.animate(
      [
        {
          height: `${a}px`,
        },
        {
          height: `${n}px`,
        },
      ],
      {
        duration: 420,
        easing: EASE_OUT_EXPO,
      },
    );
}
const refreshPacketExplanation = (e, t) =>
  t.packet &&
  animatePacketExplanationHeight(e, () =>
    updatePacketExplanation(e, t.packet, t.lesson),
  );
function applyOverviewState(e, t) {
  (updateProtocolOverview(e, t.lesson),
    (e.querySelector('[data-view="overview"]').hidden = t.view !== "overview"),
    (e.querySelector('[data-view="step"]').hidden = t.view !== "step"),
    updateStepExplanation(e, t.content),
    updatePacketExplanation(e, t.packet, t.lesson),
    e.querySelector(".explain-packet").classList.toggle("is-open", !!t.packet));
}
function updateOverviewBackButton(e, t) {
  const s = e.querySelector(".back-btn"),
    a = e.querySelector(".more");
  s.hidden === t &&
    ((s.hidden = !t),
    (a.hidden = t),
    prefersReducedMotion() ||
      (t ? s : a).animate(
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
      ));
}
function invalidateOverview(e) {
  e._shown = null;
}
function updateOverviewPanel(e, t, s, a = 0) {
  const n = buildOverviewState(t, s, a),
    o = e._shown;
  e._latest = n;
  const r = () => e._latest;
  if (
    (animateTextChange(
      e.querySelector(".panel-title"),
      n.title,
      !o || n.rank >= o.rank ? 1 : -1,
    ),
    updateOverviewBackButton(e, n.view === "step"),
    !o)
  )
    applyOverviewState(e, n);
  else if (n.lesson !== o.lesson)
    slideContent(
      e.querySelector(".overview-stage"),
      () => applyOverviewState(e, r()),
      n.order > o.order ? 1 : -1,
      32,
    );
  else if (n.view !== o.view)
    slideContent(
      e.querySelector(".overview-stage"),
      () => applyOverviewState(e, r()),
      n.view === "step" ? 1 : -1,
      32,
    );
  else if (n.view === "step" && n.rank !== o.rank)
    slideContent(
      e.querySelector(".explain"),
      () => applyOverviewState(e, r()),
      n.rank > o.rank ? 1 : -1,
    );
  else if (n.view === "step" && n.packet?.number !== o.packet?.number) {
    const i = e.querySelector(".explain-packet"),
      l =
        ["client", "dns"].includes(n.packet?.event.to) &&
        n.packet?.event.from !== "client";
    n.packet && o.packet
      ? slideContent(
          i.querySelector(".explain-packet-inner"),
          () => refreshPacketExplanation(e, r()),
          l ? 1 : -1,
          18,
        )
      : animatePacketExplanationHeight(e, () => {
          (n.packet && updatePacketExplanation(e, n.packet, n.lesson),
            i.classList.toggle("is-open", !!n.packet));
        });
  }
  e._shown = n;
}
export {
  bindOverviewBackButton,
  invalidateOverview,
  renderOverviewPanel,
  updateOverviewPanel,
};
