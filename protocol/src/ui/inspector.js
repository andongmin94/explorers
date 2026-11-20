// Reconstructed from the distributed Protocol Explorer JavaScript.
import { EASE_OUT_EXPO, prefersReducedMotion, slideContent } from "./motion.js";
import {
  escapeHtml,
  isolateLtrText,
  translate,
  translatedElementContent,
} from "../i18n.js";
import { icon } from "../../../shared/hw.js";
import { paginate, plateTabs } from "../../../shared/fit.js";
import { PACKET_COLORS } from "../simulation/network-drawing.js";
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
  <div class="inspector" hidden role="region" aria-label="${translate("Packet inspector")}">
    <div class="ins-head">
      <span class="hw-led is-on ins-led"></span>
      <span class="ins-badge"></span>
      <div class="ins-title"><b></b><span class="hw-mono hw-muted"></span></div>
      <div class="ins-nav">
        <button class="hw-key hw-key--sm hw-key--icon" type="button" data-ins="prev" aria-label="${translate("Previous packet")}" title="${translate("Previous packet (←)")}">${icon("back")}</button>
        <button class="hw-key hw-key--sm hw-key--icon" type="button" data-ins="next" aria-label="${translate("Next packet")}" title="${translate("Next packet (→)")}">${icon("next")}</button>
        <button class="hw-key hw-key--sm hw-key--icon" type="button" data-ins="close" aria-label="${translate("Close")}" title="${translate("Close (Esc)")}">${icon("close")}</button>
      </div>
    </div>
    <p class="ins-where hw-muted"></p>
    <div class="ins-bar"></div>
    <div class="hw-tabs ins-tabs" role="tablist" aria-label="검사 보기"><button type="button" data-tab="tree" aria-selected="true">필드</button><button type="button" data-tab="hex" aria-selected="false">바이트</button></div>
    <div class="ins-body">
      <div class="ins-tree" data-panel="tree"><div class="ins-rows"></div><p class="ins-field-note hw-muted" aria-live="polite"></p><div class="hw-pager ins-pager" hidden></div></div>
      <div class="ins-hex" data-panel="hex"></div>
    </div>
    <div class="ins-foot hw-muted"><span><i class="eg">${translate("E.G.")}</i> ${translate("an example value: it differs in every real capture")}</span><span><b>··</b> ${translate("bytes the lesson can’t show: encrypted, random, or a file’s contents")}</span></div>
  </div>`;
}

function renderPacketField(field, fieldIndex) {
  const rangeAttributes =
    field.to > field.from
      ? ` data-from="${field.from}" data-to="${field.to}"`
      : "";
  return `
    <div class="ins-field ${[`d${field.depth ?? 0}`, field.heading && "is-heading", field.hidden && "is-hidden", field.inside && "is-inside", field.mono && "is-mono"].filter(Boolean).join(" ")}" data-field="${fieldIndex}"${rangeAttributes}${field.note ? ` tabindex="0" data-note="${escapeHtml(translate(field.note))}"` : ""}>
      <span class="ins-name">${escapeHtml(translate(field.name))}</span>
      <span class="ins-value">${escapeHtml(translate(field.value))}${field.example ? ` <i class="eg" title="${escapeHtml(translate("an example value: it differs in every real capture"))}">${translate("E.G.")}</i>` : ""}</span>
      ${field.note ? `<p class="ins-note">${escapeHtml(translate(field.note))}</p>` : ""}
    </div>`;
}

function renderPacketTree(frame) {
  return frame.layers
    .map((layer) => {
      const fields = frame.fields
        .map((field, index) => [field, index])
        .filter(([field]) => field.layer === layer.id);
      // One flat list of rows (layer heads, then their fields) so the tree can page.
      return `
      <h4 class="ins-layer c-${getPacketLayerColor(layer.id)}" data-layer="${layer.id}"><span>${escapeHtml(translate(layer.name))}</span>${layer.summary ? `<em>${escapeHtml(translate(layer.summary))}</em>` : ""}</h4>
        ${fields.map(([field, index]) => renderPacketField(field, index)).join("")}`;
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
  return `<div class="hx-head" title="·· ${escapeHtml(translate("bytes the lesson can’t show: encrypted, random, or a file’s contents"))}">${translate("BYTES")} <span class="hx-range"></span><span>${translate(
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
  inspector.querySelector(".ins-led").style.setProperty("--led", PACKET_COLORS[packet.color]);
  inspector.querySelector(".ins-badge").textContent = `#${packetIndex + 1}`;
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
  inspector.querySelector(".ins-where").title = notes.join(" · ");
  inspector.querySelector(".ins-title").title = notes.join(" · ");
  inspector.querySelector(".ins-bar").innerHTML = renderPacketLayerBar(frame);
}

function updateInspectorBody(inspector, lesson, packetIndex) {
  const frame = getEncodedLessonPackets(lesson)[packetIndex];
  inspector.querySelector(".ins-rows").innerHTML = renderPacketTree(frame);
  inspector.querySelector(".ins-hex").innerHTML = renderHexDump(frame);
  inspector.querySelector(".ins-tree").scrollTop = 0;
  inspector.querySelector(".ins-hex").scrollTop = 0;
  inspector._frame = frame;
  inspector._pages?.refresh();
  inspector._pages?.show(0);
  fitHexRows(inspector);
}

// On the desktop console the inspector never scrolls: the field tree pages
// (shared/fit.js) and the byte view shows the rows that fit, starting at the
// first field on the tree's current page.
const fitsDesktopConsole = () => matchMedia("(min-width: 1100px) and (min-height: 700px)").matches;

function fitHexRows(inspector) {
  const hex = inspector.querySelector(".ins-hex");
  const rows = [...hex.querySelectorAll(".hx-row")];
  const range = hex.querySelector(".hx-range");
  rows.forEach((row) => row.classList.remove("is-out"));
  if (range) range.textContent = "";
  if (!fitsDesktopConsole() || inspector.hidden || !rows.length) return;
  const style = getComputedStyle(hex);
  const head = hex.querySelector(".hx-head");
  const room =
    hex.clientHeight -
    parseFloat(style.paddingTop) -
    parseFloat(style.paddingBottom) -
    head.offsetHeight -
    parseFloat(getComputedStyle(head).marginBottom);
  const rowHeight = rows[0].getBoundingClientRect().height || 1;
  const fit = Math.max(1, Math.floor(room / rowHeight));
  if (rows.length <= fit) return;
  const firstShown = [...inspector.querySelectorAll(".ins-rows > .ins-field[data-from]")].find(
    (field) => !field.hidden && !field.classList.contains("is-hidden"),
  );
  const firstRow = Math.floor(Number(firstShown?.dataset.from ?? 0) / 16);
  const start = Math.max(0, Math.min(firstRow, rows.length - fit));
  rows.forEach((row, index) => row.classList.toggle("is-out", index < start || index >= start + fit));
  const offset = (n) => n.toString(16).padStart(4, "0");
  if (range) {
    range.textContent = `${offset(start * 16)}–${offset(Math.min((start + fit) * 16, inspector._frame.bytes.length) - 1)}`;
  }
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
      const layerHead = inspector.querySelector(`.ins-layer[data-layer="${segment.dataset.layer}"]`);
      if (fitsDesktopConsole() && inspector._pages) {
        inspector._pages.showItem(layerHead);
        fitHexRows(inspector);
      } else {
        layerHead?.scrollIntoView({
          block: "start",
          behavior: prefersReducedMotion() ? "auto" : "smooth",
        });
      }
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
      if (fitsDesktopConsole()) {
        if (matchedElement?.hidden) inspector._pages?.showItem(matchedElement);
      } else {
        matchedElement?.scrollIntoView({
          block: "nearest",
        });
      }
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
  // In a narrow inspector the field tree and the bytes take turns (tabs);
  // a wide one shows both side by side and the tabs are hidden by CSS.
  plateTabs(inspector, {
    onChange: () => requestAnimationFrame(() => {
      inspector._pages?.refresh();
      fitHexRows(inspector);
    }),
  });
  inspector._pages = paginate(inspector.querySelector(".ins-rows"), {
    label: "필드 쪽",
    pager: inspector.querySelector(".ins-pager"),
  });
  // Paging the tree moves the byte view along (after the pager's own click).
  inspector.querySelector(".ins-pager").addEventListener("click", () => fitHexRows(inspector));
  // On the desktop console a field's note is shown in one line under the
  // tree for the field under the pointer or focus, instead of under every
  // field, so a packet's fields fit on few pages.
  const noteLine = inspector.querySelector(".ins-field-note");
  const showNote = (event) => {
    const field = event.target.closest?.(".ins-field");
    if (!field || !inspector.contains(field)) return;
    noteLine.textContent = field.dataset.note ?? "";
  };
  inspector.addEventListener("mouseover", showNote);
  inspector.addEventListener("focusin", showNote);
  inspector.addEventListener("click", showNote);
  new ResizeObserver(() => fitHexRows(inspector)).observe(inspector.querySelector(".ins-hex"));
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
