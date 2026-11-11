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
const getPacketLayerColor = (layerId) =>
  PACKET_LAYER_COLORS[layerId] ?? "violet";
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

function renderPacketField(field, fieldIndex) {
  const rangeAttributes =
    field.to > field.from
      ? ` data-from="${field.from}" data-to="${field.to}"`
      : "";
  return `
    <div class="ins-field ${[`d${field.depth ?? 0}`, field.heading && "is-heading", field.hidden && "is-hidden", field.inside && "is-inside", field.mono && "is-mono"].filter(Boolean).join(" ")}" data-field="${fieldIndex}"${rangeAttributes}>
      <span class="ins-name">${escapeHtml(translate(field.name))}</span>
      <span class="ins-value">${escapeHtml(translate(field.value))}${field.example ? ` <i class="eg">${translate("E.G.")}</i>` : ""}</span>
      ${field.note ? `<p class="ins-note">${escapeHtml(translate(field.note))}</p>` : ""}
    </div>`;
}

function renderPacketTree(frame) {
  return frame.layers
    .map((layer) => {
      const fields = frame.fields
        .map((field, index) => [field, index])
        .filter(([field]) => field.layer === layer.id);
      return `
      <section class="ins-layer c-${getPacketLayerColor(layer.id)}" data-layer="${layer.id}">
        <h4><span>${escapeHtml(translate(layer.name))}</span>${layer.summary ? `<em>${escapeHtml(translate(layer.summary))}</em>` : ""}</h4>
        ${fields.map(([field, index]) => renderPacketField(field, index)).join("")}
        
      </section>`;
    })
    .join("");
}

function renderHexDump(frame) {
  // null marks encrypted, random or omitted content; never display it as zero.
  const layerAtOffset = (offset) =>
    frame.layers.find((layer) => offset >= layer.from && offset < layer.to)
      ?.id ?? "pad";
  const rows = [];
  for (let rowOffset = 0; rowOffset < frame.bytes.length; rowOffset += 16) {
    const bytes = frame.bytes.slice(rowOffset, rowOffset + 16);
    const hexCells = bytes
      .map(
        (byte, index) =>
          `<span class="hx c-${getPacketLayerColor(layerAtOffset(rowOffset + index))}${byte === null ? " is-unknown" : ""}" data-i="${rowOffset + index}">${byte === null ? "··" : byte.toString(16).padStart(2, "0")}</span>`,
      )
      .join("");
    const asciiCells = bytes
      .map(
        (byte, index) =>
          `<span class="as${byte === null ? " is-unknown" : ""}" data-i="${rowOffset + index}">${byte === null ? "·" : byte >= 32 && byte < 127 ? escapeHtml(String.fromCharCode(byte)) : "."}</span>`,
      )
      .join("");
    rows.push(
      `<div class="hx-row"><span class="hx-at">${rowOffset.toString(16).padStart(4, "0")}</span><span class="hx-bytes">${hexCells}</span><span class="hx-text">${asciiCells}</span></div>`,
    );
  }
  return `<div class="hx-head">${translate("BYTES")} <span>${translate(
    "{n} in this frame",
    {
      n: frame.bytes.length,
    },
  )}</span></div>${rows.join("")}`;
}

function renderPacketLayerBar(frame) {
  const totalBytes = frame.bytes.length;
  return frame.layers
    .map((layer) => {
      const length = layer.to - layer.from;
      return `<span class="ins-seg c-${getPacketLayerColor(layer.id)}" data-layer="${layer.id}" style="flex:${Math.max(length, totalBytes * 0.045)}" title="${escapeHtml(translate(layer.name))}"><b>${escapeHtml(translate(PACKET_LAYER_NAMES[layer.id] ?? layer.name.split(" ·")[0]))}</b><i>${length}</i></span>`;
    })
    .join("");
}

function updatePacketInspector(inspector, lesson, packetIndex, lost) {
  updateInspectorHeader(inspector, lesson, packetIndex, lost);
  updateInspectorBody(inspector, lesson, packetIndex);
}

function updateInspectorHeader(inspector, lesson, packetIndex, lost) {
  const frame = getEncodedLessonPackets(lesson)[packetIndex];
  const packet = getLessonPackets(lesson)[packetIndex];
  const row = packet.row;
  inspector.dataset.index = packetIndex;
  const badge = inspector.querySelector(".ins-badge");
  badge.className = `ins-badge step-badge ${packet.color}`;
  badge.textContent = packetIndex + 1;
  inspector.querySelector(".ins-title b").textContent = translate(packet.label);
  inspector.querySelector(".ins-title span").textContent = isolateLtrText(
    `${row.time} · ${row.src} → ${row.dst} · ${row.proto} · ${row.len}`,
  );
  const notes = [translate(frame.at)];
  if (frame.segments > 1) {
    notes.push(
      translate(
        "This row stands for {n} TCP segments carrying a {size}-byte message; the first segment is shown",
        {
          n: frame.segments,
          size: frame.messageLength.toLocaleString(translate("en-US")),
        },
      ),
    );
  }
  if (lost) {
    notes.push(translate("This packet was lost on the way"));
  }
  inspector.querySelector(".ins-where").textContent = notes.join(" · ");
  inspector.querySelector(".ins-bar").innerHTML = renderPacketLayerBar(frame);
}

function updateInspectorBody(inspector, lesson, packetIndex) {
  const frame = getEncodedLessonPackets(lesson)[packetIndex];
  inspector.querySelector(".ins-tree").innerHTML = renderPacketTree(frame);
  inspector.querySelector(".ins-hex").innerHTML = renderHexDump(frame);
  inspector.querySelector(".ins-tree").scrollTop = 0;
  inspector.querySelector(".ins-hex").scrollTop = 0;
  inspector._frame = frame;
}

function highlightPacketBytes(inspector, startOffset, endOffset, fieldElement) {
  inspector
    .querySelectorAll(".is-lit")
    .forEach((highlighted) => highlighted.classList.remove("is-lit"));
  if (startOffset !== undefined) {
    for (let offset = startOffset; offset < endOffset; offset++) {
      inspector
        .querySelectorAll(`[data-i="${offset}"]`)
        .forEach((byteElement) => byteElement.classList.add("is-lit"));
    }
    fieldElement?.classList.add("is-lit");
  }
}

function bindInspectorEvents(inspector, actions) {
  inspector.addEventListener("click", (event) => {
    const button = event.target.closest("[data-ins]");
    if (button) {
      actions[button.dataset.ins]();
    }
    const segment = event.target.closest(".ins-seg");
    if (segment) {
      inspector
        .querySelector(`.ins-layer[data-layer="${segment.dataset.layer}"]`)
        ?.scrollIntoView({
          block: "start",
          behavior: prefersReducedMotion() ? "auto" : "smooth",
        });
    }
  });
  inspector.addEventListener("mouseover", (event) => {
    const fieldElement = event.target.closest(".ins-field[data-from]");
    if (fieldElement) {
      return highlightPacketBytes(
        inspector,
        Number(fieldElement.dataset.from),
        Number(fieldElement.dataset.to),
        fieldElement,
      );
    }
    const byteElement = event.target.closest("[data-i]");
    if (byteElement && inspector._frame) {
      const offset = Number(byteElement.dataset.i);
      // Fields overlap (a header contains smaller fields); select the tightest range.
      const matchingFields = inspector._frame.fields
        .map((candidate, index) => [candidate, index])
        .filter(
          ([candidate]) => offset >= candidate.from && offset < candidate.to,
        )
        .sort(
          (left, right) =>
            left[0].to - left[0].from - (right[0].to - right[0].from),
        );
      if (!matchingFields.length) {
        return highlightPacketBytes(inspector, offset, offset + 1);
      }
      const [field, fieldIndex] = matchingFields[0];
      const matchedElement = inspector.querySelector(
        `.ins-field[data-field="${fieldIndex}"]`,
      );
      highlightPacketBytes(inspector, field.from, field.to, matchedElement);
      matchedElement?.scrollIntoView({
        block: "nearest",
      });
    }
  });
  inspector.addEventListener("mouseleave", () =>
    highlightPacketBytes(inspector),
  );
}
/** Keep the byte view, field tree and selected packet synchronized. */

function createPacketInspector(
  inspector,
  { visible: getVisibleIndices, isLost, onChange },
) {
  let currentLesson = null;
  const isOpen = () =>
    !inspector.hidden && !inspector.classList.contains("is-closing");
  function open(lesson, packetIndex) {
    currentLesson = lesson;
    const wasOpen = isOpen();
    inspector.getAnimations().forEach((animation) => animation.cancel());
    inspector.classList.remove("is-closing");
    inspector.hidden = false;
    updatePacketInspector(inspector, lesson, packetIndex, isLost(packetIndex));
    if (!wasOpen && !prefersReducedMotion()) {
      inspector.animate(
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
      );
    }
    onChange(packetIndex);
  }
  function close() {
    if (!inspector.hidden) {
      onChange(null);
      if (prefersReducedMotion()) {
        return (inspector.hidden = true);
      }
      inspector.classList.add("is-closing");
      inspector.getAnimations().forEach((animation) => animation.cancel());
      inspector.animate(
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
        if (inspector.classList.contains("is-closing")) {
          inspector.classList.remove("is-closing");
          inspector.hidden = true;
        }
      };
    }
  }
  function step(direction) {
    if (!isOpen()) {
      return;
    }
    const visibleIndices = getVisibleIndices();
    const currentIndex = visibleIndices.indexOf(
      Number(inspector.dataset.index),
    );
    const nextPacketIndex = visibleIndices[currentIndex + direction];
    if (nextPacketIndex !== undefined) {
      inspector.dataset.index = nextPacketIndex;
      updateInspectorHeader(inspector, currentLesson, nextPacketIndex, isLost(nextPacketIndex));
      slideContent(
        inspector.querySelector(".ins-body"),
        () =>
          inspector.dataset.index === String(nextPacketIndex) &&
          updateInspectorBody(inspector, currentLesson, nextPacketIndex),
        direction,
        14,
      );
      onChange(nextPacketIndex);
    }
  }
  bindInspectorEvents(inspector, {
    prev: () => step(-1),
    next: () => step(1),
    close,
  });
  return {
    open,
    close,
    step,
    isOpen,
    index: () => (isOpen() ? Number(inspector.dataset.index) : null),
  };
}
export { createPacketInspector, renderPacketInspector };
