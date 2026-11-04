// Reconstructed from the distributed Protocol Explorer JavaScript.
import { EASE_OUT_EXPO, prefersReducedMotion, slideContent } from "./motion.js";
import {
  escapeHtml,
  isolateLtrText,
  translate,
  translatedElementContent,
} from "../i18n.js";
import {
  getEncodedLessonPackets,
  getLessonPackets,
} from "../packets/encode.js";
const PACKET_LAYER_COLORS = {
  eth: "slate",
  arp: "amber",
  ip: "blue",
  tcp: "green",
  udp: "green",
  icmp: "amber",
  tls: "teal",
  pad: "grey",
};
const getPacketLayerColor = (e) => PACKET_LAYER_COLORS[e] ?? "violet";
const PACKET_LAYER_NAMES = {
  eth: "Ethernet",
  arp: "ARP",
  ip: "IPv4",
  tcp: "TCP",
  udp: "UDP",
  icmp: "ICMP",
  pad: "Padding",
  tls: "TLS",
};
function renderPacketInspector() {
  return `
  <div class="inspector" hidden data-t-label="Packet inspector" aria-label="${translate("Packet inspector")}">
    <div class="ins-head">
      <span class="ins-badge step-badge"></span>
      <div class="ins-title"><b></b><span></span></div>
      <div class="ins-nav">
        <button type="button" data-ins="prev" data-t-label="Previous packet" aria-label="${translate("Previous packet")}" data-t-title="Previous packet (←)" title="${translate("Previous packet (←)")}">‹</button>
        <button type="button" data-ins="next" data-t-label="Next packet" aria-label="${translate("Next packet")}" data-t-title="Next packet (→)" title="${translate("Next packet (→)")}">›</button>
        <button type="button" data-ins="close" data-t-label="Close" aria-label="${translate("Close")}" data-t-title="Close (Esc)" title="${translate("Close (Esc)")}">✕</button>
      </div>
    </div>
    <div class="ins-where"></div>
    <div class="ins-bar"></div>
    <div class="ins-body">
      <div class="ins-tree"></div>
      <div class="ins-hex"></div>
    </div>
    <div class="ins-foot"><span><i class="eg" ${translatedElementContent("E.G.")}</i> <span ${translatedElementContent("an example value: it differs in every real capture")}</span></span><span><b>··</b> <span ${translatedElementContent("bytes the lesson can’t show: encrypted, random, or a file’s contents")}</span></span></div>
  </div>`;
}
function renderPacketField(e, t) {
  const s = e.to > e.from ? ` data-from="${e.from}" data-to="${e.to}"` : "";
  return `
    <div class="ins-field ${[`d${e.depth ?? 0}`, e.heading && "is-heading", e.hidden && "is-hidden", e.inside && "is-inside", e.mono && "is-mono"].filter(Boolean).join(" ")}" data-field="${t}"${s}>
      <span class="ins-name">${escapeHtml(translate(e.name))}</span>
      <span class="ins-value">${escapeHtml(translate(e.value))}${e.example ? ` <i class="eg">${translate("E.G.")}</i>` : ""}</span>
      ${e.note ? `<p class="ins-note">${escapeHtml(translate(e.note))}</p>` : ""}
    </div>`;
}
function renderPacketTree(e) {
  return e.layers
    .map((t) => {
      const s = e.fields
          .map((n, o) => [n, o])
          .filter(([n]) => n.layer === t.id),
        a = t.to - t.from;
      return `
      <section class="ins-layer c-${getPacketLayerColor(t.id)}" data-layer="${t.id}">
        <h4><span>${escapeHtml(translate(t.name))}</span>${t.summary ? `<em>${escapeHtml(translate(t.summary))}</em>` : ""}</h4>
        ${s.map(([n, o]) => renderPacketField(n, o)).join("")}
        
      </section>`;
    })
    .join("");
}
function renderHexDump(e) {
  const t = (a) => e.layers.find((n) => a >= n.from && a < n.to)?.id ?? "pad",
    s = [];
  for (let a = 0; a < e.bytes.length; a += 16) {
    const n = e.bytes.slice(a, a + 16),
      o = n
        .map(
          (i, l) =>
            `<span class="hx c-${getPacketLayerColor(t(a + l))}${i === null ? " is-unknown" : ""}" data-i="${a + l}">${i === null ? "··" : i.toString(16).padStart(2, "0")}</span>`,
        )
        .join(""),
      r = n
        .map(
          (i, l) =>
            `<span class="as${i === null ? " is-unknown" : ""}" data-i="${a + l}">${i === null ? "·" : i >= 32 && i < 127 ? escapeHtml(String.fromCharCode(i)) : "."}</span>`,
        )
        .join("");
    s.push(
      `<div class="hx-row"><span class="hx-at">${a.toString(16).padStart(4, "0")}</span><span class="hx-bytes">${o}</span><span class="hx-text">${r}</span></div>`,
    );
  }
  return `<div class="hx-head">${translate("BYTES")} <span>${translate(
    "{n} in this frame",
    {
      n: e.bytes.length,
    },
  )}</span></div>${s.join("")}`;
}
function renderPacketLayerBar(e) {
  const t = e.bytes.length;
  return e.layers
    .map((s) => {
      const a = s.to - s.from;
      return `<span class="ins-seg c-${getPacketLayerColor(s.id)}" data-layer="${s.id}" style="flex:${Math.max(a, t * 0.045)}" title="${escapeHtml(translate(s.name))}"><b>${escapeHtml(translate(PACKET_LAYER_NAMES[s.id] ?? s.name.split(" ·")[0]))}</b><i>${a}</i></span>`;
    })
    .join("");
}
function updatePacketInspector(e, t, s) {
  (updateInspectorHeader(e, t, s), updateInspectorBody(e, t, s));
}
function updateInspectorHeader(e, t, s) {
  const a = getEncodedLessonPackets(t)[s],
    n = getLessonPackets(t)[s],
    o = n.row;
  e.dataset.index = s;
  const r = e.querySelector(".ins-badge");
  ((r.className = `ins-badge step-badge ${n.color}`),
    (r.textContent = s + 1),
    (e.querySelector(".ins-title b").textContent = translate(n.label)),
    (e.querySelector(".ins-title span").textContent = isolateLtrText(
      `${o.time} · ${o.src} → ${o.dst} · ${o.proto} · ${o.len}`,
    )));
  const i = [translate(a.at)];
  (a.segments > 1 &&
    i.push(
      translate(
        "This row stands for {n} TCP segments carrying a {size}-byte message; the first segment is shown",
        {
          n: a.segments,
          size: a.messageLength.toLocaleString(translate("en-US")),
        },
      ),
    ),
    n.lost && i.push(translate("This packet was lost on the way")),
    (e.querySelector(".ins-where").textContent = i.join(" · ")),
    (e.querySelector(".ins-bar").innerHTML = renderPacketLayerBar(a)));
}
function updateInspectorBody(e, t, s) {
  const a = getEncodedLessonPackets(t)[s];
  ((e.querySelector(".ins-tree").innerHTML = renderPacketTree(a)),
    (e.querySelector(".ins-hex").innerHTML = renderHexDump(a)),
    (e.querySelector(".ins-tree").scrollTop = 0),
    (e.querySelector(".ins-hex").scrollTop = 0),
    (e._frame = a));
}
function highlightPacketBytes(e, t, s, a) {
  if (
    (e.querySelectorAll(".is-lit").forEach((n) => n.classList.remove("is-lit")),
    t !== void 0)
  ) {
    for (let n = t; n < s; n++)
      e.querySelectorAll(`[data-i="${n}"]`).forEach((o) =>
        o.classList.add("is-lit"),
      );
    a?.classList.add("is-lit");
  }
}
function bindInspectorEvents(e, t) {
  (e.addEventListener("click", (s) => {
    const a = s.target.closest("[data-ins]");
    a && t[a.dataset.ins]();
    const n = s.target.closest(".ins-seg");
    n &&
      e
        .querySelector(`.ins-layer[data-layer="${n.dataset.layer}"]`)
        ?.scrollIntoView({
          block: "start",
          behavior: prefersReducedMotion() ? "auto" : "smooth",
        });
  }),
    e.addEventListener("mouseover", (s) => {
      const a = s.target.closest(".ins-field[data-from]");
      if (a)
        return highlightPacketBytes(
          e,
          Number(a.dataset.from),
          Number(a.dataset.to),
          a,
        );
      const n = s.target.closest("[data-i]");
      if (n && e._frame) {
        const o = Number(n.dataset.i),
          r = e._frame.fields
            .map((h, d) => [h, d])
            .filter(([h]) => o >= h.from && o < h.to)
            .sort((h, d) => h[0].to - h[0].from - (d[0].to - d[0].from));
        if (!r.length) return highlightPacketBytes(e, o, o + 1);
        const [i, l] = r[0],
          c = e.querySelector(`.ins-field[data-field="${l}"]`);
        (highlightPacketBytes(e, i.from, i.to, c),
          c?.scrollIntoView({
            block: "nearest",
          }));
      }
    }),
    e.addEventListener("mouseleave", () => highlightPacketBytes(e)));
}
function createPacketInspector(e, { visible: t, onChange: s }) {
  let a = null;
  const n = () => !e.hidden && !e.classList.contains("is-closing");
  function o(l, c) {
    a = l;
    const h = n();
    (e.getAnimations().forEach((d) => d.cancel()),
      e.classList.remove("is-closing"),
      (e.hidden = !1),
      updatePacketInspector(e, l, c),
      !h &&
        !prefersReducedMotion() &&
        e.animate(
          [
            {
              opacity: 0,
              transform: "translateY(26px)",
            },
            {
              opacity: 1,
              transform: "none",
            },
          ],
          {
            duration: 320,
            easing: EASE_OUT_EXPO,
          },
        ),
      s(c));
  }
  function r() {
    if (!e.hidden) {
      if ((s(null), prefersReducedMotion())) return (e.hidden = !0);
      (e.classList.add("is-closing"),
        e.getAnimations().forEach((l) => l.cancel()),
        (e.animate(
          [
            {
              opacity: 1,
              transform: "none",
            },
            {
              opacity: 0,
              transform: "translateY(18px)",
            },
          ],
          {
            duration: 200,
            easing: "ease-in",
          },
        ).onfinish = () => {
          e.classList.contains("is-closing") &&
            (e.classList.remove("is-closing"), (e.hidden = !0));
        }));
    }
  }
  function i(l) {
    if (!n()) return;
    const c = t(),
      h = c.indexOf(Number(e.dataset.index)),
      d = c[h + l];
    d !== void 0 &&
      ((e.dataset.index = d),
      updateInspectorHeader(e, a, d),
      slideContent(
        e.querySelector(".ins-body"),
        () => e.dataset.index === String(d) && updateInspectorBody(e, a, d),
        l,
        14,
      ),
      s(d));
  }
  return (
    bindInspectorEvents(e, {
      prev: () => i(-1),
      next: () => i(1),
      close: r,
    }),
    {
      open: o,
      close: r,
      step: i,
      isOpen: n,
      index: () => (n() ? Number(e.dataset.index) : null),
    }
  );
}
export { createPacketInspector, renderPacketInspector };
