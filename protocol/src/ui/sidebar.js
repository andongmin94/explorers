// Reconstructed from the distributed Protocol Explorer JavaScript.
import { protocolCatalog } from "../lessons/index.js";
import { icons } from "./icons.js";
import { getLessonStatus } from "../progress.js";
import {
  EASE_OUT_EXPO,
  prefersReducedMotion,
  smoothScrollTo,
} from "./motion.js";
import { translate, translatedElementContent } from "../i18n.js";
const PROTOCOL_FILTERS = [
  ["all", "ALL"],
  ["core", "CORE"],
  ["application", "APPLICATION"],
  ["security", "SECURITY"],
];
function renderLessonSteps(e) {
  return `<div class="steps-wrap"><div class="steps-clip"><ol class="steps">${e.steps
    .map(
      (s, a) => `
      <li class="step" data-step="${a}" style="--i:${a}">
        <button class="step-btn" type="button">
          <span class="step-num"><span>${a + 1}</span>${icons.check.replace("<path", '<path pathLength="1"')}</span>
          <span class="step-text">
            <span class="step-title" ${translatedElementContent(s.title, !0)}</span>
            <span class="step-desc" ${translatedElementContent(s.desc)}</span>
          </span>
        </button>
      </li>`,
    )
    .join("")}</ol></div></div>`;
}
function renderSidebar(e) {
  const t = protocolCatalog
      .map((a) => {
        const n = e[a.id];
        return `
      <li class="proto ${n ? "has-lesson" : ""}" data-group="${a.group}" ${n ? `data-lesson="${a.id}"` : ""}>
        <button class="proto-row" type="button" aria-expanded="false">
          <span class="status-dot ${getLessonStatus(n)}" data-status="${getLessonStatus(n)}"></span>
          <span class="proto-text">
            <span class="proto-name">${a.name}</span>
            <span class="proto-full" ${translatedElementContent(a.full)}</span>
          </span>
          <span class="proto-chev">${icons.chevron}</span>
        </button>
        ${n ? renderLessonSteps(n) : ""}
      </li>`;
      })
      .join(""),
    s = PROTOCOL_FILTERS.map(([a, n], o) => {
      const r =
        a === "all"
          ? protocolCatalog.length
          : protocolCatalog.filter((i) => i.group === a).length;
      return `<button class="tab ${o === 0 ? "is-active" : ""}" type="button" role="tab" aria-selected="${o === 0}" data-group="${a}">
      <span ${translatedElementContent(n)}</span><span class="tab-count">${r}</span>
    </button>`;
    }).join("");
  return `
  <aside class="panel sidebar" id="protocols">
    <div class="panel-head">
      <h2 class="panel-title" ${translatedElementContent("INTERNET PROTOCOLS")}</h2>
      <button class="more" type="button" data-t-label="More" aria-label="${translate("More")}">${icons.dots}</button>
      <button class="drawer-close" type="button" data-t-label="Close the protocol list" aria-label="${translate("Close the protocol list")}" data-t-title="Close (Esc)" title="${translate("Close (Esc)")}">${icons.close}</button>
    </div>
    <div class="tabs" role="tablist">${s}<span class="tab-indicator"></span></div>
    <ul class="proto-list">${t}</ul>
  </aside>`;
}
function positionFilterIndicator(e) {
  const t = e.querySelector(".tab.is-active"),
    s = e.querySelector(".tab-indicator");
  ((s.style.left = `${t.offsetLeft}px`),
    (s.style.width = `${t.offsetWidth}px`));
}
const FILTER_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";
const getElementScale = (e) =>
  e.getBoundingClientRect().height / e.offsetHeight || 1;
function animateRemovedProtocol(e, t, { rect: s, opacity: a }, n) {
  const o = e.getBoundingClientRect(),
    r = t.cloneNode(!0);
  (r.classList.add("proto-ghost"),
    r.removeAttribute("data-lesson"),
    (r.dataset.ghostOf = t.querySelector(".proto-name").textContent),
    Object.assign(r.style, {
      top: `${(s.top - o.top) / n + e.scrollTop}px`,
      left: `${(s.left - o.left) / n}px`,
      width: `${t.offsetWidth}px`,
    }),
    e.appendChild(r),
    (r.animate(
      [
        {
          opacity: a,
        },
        {
          opacity: 0,
        },
      ],
      {
        duration: 60 + 110 * a,
        easing: "ease-in",
        fill: "forwards",
      },
    ).onfinish = () => r.remove()));
}
function filterProtocols(e, t) {
  const s = e.querySelector(".proto-list"),
    a = [...s.querySelectorAll(":scope > .proto:not(.proto-ghost)")],
    n = getElementScale(s),
    o = prefersReducedMotion(),
    r = new Map();
  for (const h of a) {
    if (h.hidden) continue;
    const d = h.getBoundingClientRect();
    r.set(h, {
      rect: d,
      top: d.top,
      opacity: Number(getComputedStyle(h).opacity),
      moving: h.getAnimations().length > 0,
    });
  }
  let i = 0;
  for (const h of a)
    !(t === "all" || h.dataset.group === t) &&
      !h.hidden &&
      !o &&
      (animateRemovedProtocol(s, h, r.get(h), n), i++);
  for (const h of a)
    (h.getAnimations().forEach((d) => d.cancel()),
      (h.hidden = !(t === "all" || h.dataset.group === t)));
  if (o) return;
  const l = [];
  for (const h of a) {
    const d = r.get(h);
    if (h.hidden || !d) continue;
    const y = h.getBoundingClientRect();
    l.push([Math.min(d.top, y.top), Math.max(d.top, y.top) + y.height]);
  }
  let c = 0;
  for (const h of a) {
    if (h.hidden) continue;
    const d = r.get(h);
    if (d) {
      const y = (d.top - h.getBoundingClientRect().top) / n;
      if (Math.abs(y) < 0.5 && d.opacity >= 1) continue;
      h.animate(
        [
          {
            transform: `translateY(${y}px)`,
            opacity: d.opacity,
          },
          {
            transform: "none",
            opacity: 1,
          },
        ],
        {
          duration: 360,
          delay: d.moving || !i ? 0 : 90,
          easing: FILTER_EASING,
          fill: "backwards",
        },
      );
    } else {
      const y = h.getBoundingClientRect(),
        w = l.some(
          ([k, g]) => k < y.bottom - 4 && g > y.top + 4 && g - k > y.height + 8,
        );
      h.animate(
        [
          {
            opacity: 0,
            transform: "translateY(8px)",
          },
          {
            opacity: 1,
            transform: "none",
          },
        ],
        {
          duration: 300,
          delay: (w ? 250 : i ? 150 : 70) + c++ * 22,
          easing: EASE_OUT_EXPO,
          fill: "backwards",
        },
      );
    }
  }
}
function bindSidebar(e, { onStep: t, onSelect: s }) {
  positionFilterIndicator(e);
  const a = new ResizeObserver(() => positionFilterIndicator(e));
  (e.querySelectorAll(".tabs, .tab").forEach((n) => a.observe(n)),
    document.fonts.ready.then(() => {
      (positionFilterIndicator(e),
        e.querySelector(".tabs").classList.add("is-ready"));
    }),
    e.addEventListener("click", (n) => {
      const o = n.target.closest(".proto.is-open .step-btn");
      o && t(Number(o.parentElement.dataset.step));
      const r = n.target.closest(".proto.has-lesson > .proto-row");
      r && s(r.parentElement.dataset.lesson);
      const i = n.target.closest(".tab");
      i &&
        !i.classList.contains("is-active") &&
        (e.querySelectorAll(".tab").forEach((l) => {
          (l.classList.toggle("is-active", l === i),
            l.setAttribute("aria-selected", l === i));
        }),
        positionFilterIndicator(e),
        filterProtocols(e, i.dataset.group));
    }));
}
function setSidebarLesson(e, t) {
  const s = !e.dataset.lesson;
  e.dataset.lesson = t;
  for (const n of e.querySelectorAll(".proto.has-lesson")) {
    const o = n.dataset.lesson === t;
    o !== n.classList.contains("is-open") &&
      (o &&
        (n.classList.add("instant"),
        n.querySelectorAll(".step").forEach((r) => {
          (r.classList.remove("is-active", "is-done"),
            r.style.removeProperty("--delay"));
        }),
        n.offsetWidth,
        n.classList.remove("instant")),
      n.classList.toggle("is-active", o),
      n.classList.toggle("is-open", o),
      n.querySelector(".proto-row").setAttribute("aria-expanded", o));
  }
  const a = e.querySelector(`.proto[data-lesson="${t}"]`);
  s ||
    setTimeout(
      () =>
        e.dataset.lesson === t &&
        scrollProtocolIntoView(e.querySelector(".proto-list"), a),
      460,
    );
}
function scrollProtocolIntoView(e, t) {
  const s = getElementScale(e),
    a = e.getBoundingClientRect(),
    n = t.getBoundingClientRect(),
    o = (n.top - a.top) / s + e.scrollTop,
    r = n.height / s,
    i = e.clientHeight,
    l = 8;
  r + 2 * l > i || o < e.scrollTop + l
    ? smoothScrollTo(e, o - l)
    : o + r > e.scrollTop + i - l && smoothScrollTo(e, o + r - i + l);
}
function updateSidebarProgress(e, t) {
  e.querySelectorAll(".proto[data-lesson]").forEach((s) => {
    const a = s.querySelector(".status-dot"),
      n = getLessonStatus(t[s.dataset.lesson]);
    a.dataset.status !== n &&
      ((a.dataset.status = n),
      (a.className = `status-dot ${n}`),
      prefersReducedMotion() || (a.offsetWidth, a.classList.add("is-changed")));
  });
}
function updateSidebar(e, t, s) {
  e.dataset.lesson !== s.id && setSidebarLesson(e, s.id);
  const a = [...e.querySelectorAll(`.proto[data-lesson="${s.id}"] .step`)],
    n = a.filter(
      (r, i) => t.steps[i] === "done" && !r.classList.contains("is-done"),
    ),
    o = a
      .filter(
        (r, i) => t.steps[i] !== "done" && r.classList.contains("is-done"),
      )
      .reverse();
  (a.forEach((r) => r.style.setProperty("--delay", "0ms")),
    n.forEach((r, i) => r.style.setProperty("--delay", `${i * 90}ms`)),
    o.forEach((r, i) => r.style.setProperty("--delay", `${i * 50}ms`)),
    a.forEach((r, i) => {
      (t.steps[i] === "active" &&
        !r.classList.contains("is-active") &&
        r.style.setProperty("--delay", `${n.length * 90}ms`),
        r.classList.toggle("is-active", t.steps[i] === "active"),
        r.classList.toggle("is-done", t.steps[i] === "done"));
    }));
}
export { bindSidebar, renderSidebar, updateSidebar, updateSidebarProgress };
