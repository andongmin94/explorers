// Reconstructed from the distributed Protocol Explorer JavaScript.
import {
  EASE_OUT_EXPO,
  prefersReducedMotion,
  smoothScrollTo,
} from "./motion.js";
import {
  escapeHtml,
  isolateLtrText,
  localizedUpperCase,
  translate,
} from "../i18n.js";
import { NETWORK_NODE_LABELS } from "../simulation/network-drawing.js";
import {
  SEQUENCE_ANIMATION_TIMINGS,
  buildSequenceLayout,
  formatElapsedTimeBreak,
} from "../simulation/timeline.js";
import { playbackClock } from "../simulation/clock.js";
const SEQUENCE_SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const SEQUENCE_LEFT_PADDING = 78;
const SEQUENCE_RIGHT_PADDING = 30;
const SEQUENCE_MIN_LANE_WIDTH = 124;
const SEQUENCE_LOCK_PATH =
  "M-3.2 -1 V-2.6 a3.2 3.2 0 0 1 6.4 0 V-1 M-4.4 -1 h8.8 v6.4 h-8.8 z";
function renderSequencePanel() {
  return `
  <div class="sequence" data-t-label="Sequence diagram" aria-label="${translate("Sequence diagram")}">
    <div class="seq-head"></div>
    <div class="seq-scroll"><svg class="seq-svg" xmlns="${SEQUENCE_SVG_NAMESPACE}"></svg></div>
  </div>`;
}
const getLifelineName = (lesson, nodeId) =>
  translate((lesson.labels?.[nodeId] ?? NETWORK_NODE_LABELS[nodeId])[0]);
function getLifelineAddress(lesson, nodeId, layout) {
  const address = (lesson.labels?.[nodeId] ?? NETWORK_NODE_LABELS[nodeId])[1];
  return (
    translate(address) ||
    (layout.packets.find((packet) => packet.p.from === nodeId)?.p.row.src ?? "")
  );
}
function renderSequenceArrow(entry, laneX) {
  const { p: packet } = entry;
  const startX = laneX[packet.from];
  const endX = packet.lost
    ? (laneX[packet.from] + laneX[packet.to]) / 2
    : laneX[packet.to];
  const [startY, endY] = [
    entry.ySent,
    packet.lost ? (entry.ySent + entry.yArrived) / 2 : entry.yArrived,
  ];
  const length = Math.hypot(endX - startX, endY - startY);
  const [directionX, directionY] = [
    (endX - startX) / length,
    (endY - startY) / length,
  ];
  const arrowheadLength = packet.lost ? 0 : 9;
  const [lineEndX, lineEndY] = [
    endX - directionX * arrowheadLength,
    endY - directionY * arrowheadLength,
  ];
  let angleDegrees = (Math.atan2(endY - startY, endX - startX) * 180) / Math.PI;
  if (angleDegrees > 90) {
    angleDegrees -= 180;
  }
  if (angleDegrees < -90) {
    angleDegrees += 180;
  }
  const row = packet.row;
  const tooltip = `${isolateLtrText(`#${entry.index + 1} · ${row.time} · ${row.src} → ${row.dst} · ${row.proto}`)} · ${translate(row.info)} · ${isolateLtrText(row.len)}`;
  const arrowhead = packet.lost
    ? `<path class="seq-cross" d="M${endX - 6},${endY - 6} L${endX + 6},${endY + 6} M${endX + 6},${endY - 6} L${endX - 6},${endY + 6}"/>`
    : `<path class="seq-tip" d="M${endX},${endY} L${lineEndX - directionY * 4.5},${lineEndY + directionX * 4.5} L${lineEndX + directionY * 4.5},${lineEndY - directionX * 4.5} Z"/>`;
  return `
    <g class="seq-arrow c-${packet.color}${packet.lost ? " is-lost" : ""}" data-packet="${entry.index}" data-len="${length.toFixed(1)}" data-geo="${[startX, startY, endX, endY, angleDegrees.toFixed(2)].join(" ")}">
      <title>${escapeHtml(tooltip)}</title>
      <text class="seq-time" x="${SEQUENCE_LEFT_PADDING - 14}" y="${startY}">${escapeHtml(row.time)}</text>
      <circle class="seq-dot" cx="${startX}" cy="${startY}" r="2.6"/>
      <line class="seq-line" x1="${startX}" y1="${startY}" x2="${lineEndX}" y2="${lineEndY}"/>
      ${arrowhead}
      <g class="seq-label">
        <rect class="seq-label-bg" y="-17" height="15" rx="2"/>
        ${packet.locked ? `<path class="seq-lock" d="${SEQUENCE_LOCK_PATH}"/>` : ""}
        <text class="seq-label-text" y="-6" text-anchor="middle">${escapeHtml(translate(packet.label))}</text>
      </g>
    </g>`;
}
function renderSequenceNote(entry, laneX, lifelines) {
  const lane = entry.lane;
  const isRightmostLane =
    lane &&
    lifelines.indexOf(lane) === lifelines.length - 1 &&
    lifelines.length > 1;
  const x = lane
    ? laneX[lane]
    : entry.between
      ? (laneX[entry.between[0]] + laneX[entry.between[1]]) / 2
      : laneX[lifelines[0]];
  const side = lane ? (isRightmostLane ? "left" : "right") : "center";
  return `
    <g class="seq-note tone-${entry.e.tone ?? "navy"}" data-note="${entry.index}" data-side="${side}" transform="translate(${x} ${entry.y})">
      ${lane ? '<circle class="seq-note-dot" r="3.5"/>' : ""}
      <rect class="seq-note-bg" y="-10" height="20" rx="2"/>
      <text class="seq-note-text" y="0.5">${escapeHtml(translate(entry.e.text))}</text>
    </g>`;
}
function renderSequenceTimeBreak(entry, width) {
  const wavePath = (y) => {
    let path = `M0 ${y}`;
    for (let x = 0; x < width; x += 12) {
      path += " q3 -3 6 0 q3 3 6 0";
    }
    return path;
  };
  return `
    <g class="seq-break" transform="translate(0 ${entry.y})">
      <rect class="seq-break-band" x="0" y="-15" width="${width}" height="30"/>
      <path class="seq-wave" d="${wavePath(-6)} ${wavePath(6)}"/>
      <g transform="translate(${width / 2} 0)">
        <rect class="seq-break-bg" y="-10" height="20" rx="10"/>
        <text class="seq-break-text" y="0.5" text-anchor="middle">${escapeHtml(translate(formatElapsedTimeBreak(entry.seconds)))}</text>
      </g>
    </g>`;
}
// Separating-axis test: touching edges do not count as overlapping labels.
function polygonsOverlap(firstPolygon, secondPolygon) {
  for (const polygon of [firstPolygon, secondPolygon]) {
    for (let edgeIndex = 0; edgeIndex < polygon.length; edgeIndex++) {
      const [edgeStart, edgeEnd] = [
        polygon[edgeIndex],
        polygon[(edgeIndex + 1) % polygon.length],
      ];
      const [normalX, normalY] = [
        edgeEnd[1] - edgeStart[1],
        edgeStart[0] - edgeEnd[0],
      ];
      const project = (vertices) =>
        vertices.map(([x, y]) => x * normalX + y * normalY);
      const [firstProjection, secondProjection] = [
        project(firstPolygon),
        project(secondPolygon),
      ];
      if (
        Math.max(...firstProjection) <= Math.min(...secondProjection) ||
        Math.max(...secondProjection) <= Math.min(...firstProjection)
      ) {
        return false;
      }
    }
  }
  return true;
}
const rectanglePolygon = (left, top, right, bottom) => [
  [left, top],
  [right, top],
  [right, bottom],
  [left, bottom],
];
function layoutSequenceLabels(svg) {
  const measureText = (element) =>
    element.querySelector("text").getComputedTextLength();
  const noteLabels = [...svg.querySelectorAll(".seq-note")].map((element) => ({
    element,
    width: measureText(element),
  }));
  const arrowLabels = [...svg.querySelectorAll(".seq-arrow")].map((arrow) => ({
    arrow,
    element: arrow.querySelector(".seq-label"),
    width: measureText(arrow.querySelector(".seq-label")),
  }));
  const breakLabels = [...svg.querySelectorAll(".seq-break")].map(
    (element) => ({
      element,
      width: measureText(element),
    }),
  );
  const stepLabels = [...svg.querySelectorAll(".seq-step")].map((element) => ({
    element,
    width: measureText(element),
  }));
  const occupiedPolygons = [...svg.querySelectorAll(".seq-cross")].map(
    (cross) => {
      const [left, top] = cross
        .getAttribute("d")
        .match(/[-\d.]+/g)
        .map(Number);
      return rectanglePolygon(left - 3, top - 3, left + 15, top + 15);
    },
  );
  stepLabels.forEach(({ element, width }) =>
    element.querySelector("line").setAttribute("x1", 12 + width + 10),
  );
  noteLabels.forEach(({ element, width }) => {
    const text = element.querySelector("text");
    const background = element.querySelector("rect");
    const side = element.dataset.side;
    const offsetX =
      side === "right"
        ? 10
        : side === "left"
          ? -10 - width - 16
          : -width / 2 - 8;
    background.setAttribute("x", offsetX);
    background.setAttribute("width", width + 16);
    text.setAttribute("x", offsetX + 8);
    const [x, y] = element
      .getAttribute("transform")
      .match(/[-\d.]+/g)
      .map(Number);
    occupiedPolygons.push(
      rectanglePolygon(x + offsetX, y - 10, x + offsetX + width + 16, y + 10),
    );
  });
  breakLabels.forEach(({ element, width }) => {
    const background = element.querySelector(".seq-break-bg");
    background.setAttribute("x", -width / 2 - 10);
    background.setAttribute("width", width + 20);
  });
  // Place long labels first, then prefer the arrow center with the fewest overlaps.
  arrowLabels.sort((first, second) => second.width - first.width);
  arrowLabels.forEach(({ arrow, element: label, width }) => {
    const text = label.querySelector("text");
    const lock = label.querySelector(".seq-lock");
    const lockWidth = lock ? 14 : 0;
    text.setAttribute("x", lockWidth / 2);
    if (lock) {
      lock.setAttribute("transform", `translate(${-width / 2 - 4} -10)`);
    }
    const background = label.querySelector("rect");
    background.setAttribute("x", -width / 2 - 5 - lockWidth / 2);
    background.setAttribute("width", width + 10 + lockWidth);
    const [startX, startY, endX, endY, angleDegrees] = arrow.dataset.geo
      .split(" ")
      .map(Number);
    const halfWidth = width / 2 + 6 + lockWidth / 2;
    const [cosAngle, sinAngle] = [
      Math.cos((angleDegrees * Math.PI) / 180),
      Math.sin((angleDegrees * Math.PI) / 180),
    ];
    const rotatedCorners = [
      [-halfWidth - 2, -21],
      [halfWidth + 2, -21],
      [halfWidth + 2, 3],
      [-halfWidth - 2, 3],
    ].map(([x, y]) => [
      x * cosAngle - y * sinAngle,
      x * sinAngle + y * cosAngle,
    ]);
    const candidateAt = (fraction) => {
      const [centerX, centerY] = [
        startX + (endX - startX) * fraction,
        startY + (endY - startY) * fraction,
      ];
      return {
        cx: centerX,
        cy: centerY,
        box: rotatedCorners.map(([offsetX, offsetY]) => [
          centerX + offsetX,
          centerY + offsetY,
        ]),
      };
    };
    const arrowLength = Math.hypot(endX - startX, endY - startY);
    const endInset = Math.min(0.45, (halfWidth + 8) / arrowLength);
    const candidates = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.12, 0.88]
      .filter((fraction) => fraction >= endInset && fraction <= 1 - endInset)
      .map(candidateAt);
    const countOverlaps = (candidate) =>
      occupiedPolygons.filter((polygon) =>
        polygonsOverlap(candidate.box, polygon),
      ).length;
    const placement =
      candidates.find((candidate) => !countOverlaps(candidate)) ??
      [...candidates, candidateAt(0.5)].sort(
        (first, second) => countOverlaps(first) - countOverlaps(second),
      )[0];
    occupiedPolygons.push(placement.box);
    label.setAttribute(
      "transform",
      `translate(${placement.cx.toFixed(1)} ${placement.cy.toFixed(1)}) rotate(${angleDegrees})`,
    );
  });
}
function drawSequenceDiagram(panel, lesson) {
  const scrollArea = panel.querySelector(".seq-scroll");
  const svg = panel.querySelector(".seq-svg");
  const layout = buildSequenceLayout(lesson);
  const width = Math.max(
    scrollArea.clientWidth,
    SEQUENCE_LEFT_PADDING +
      SEQUENCE_RIGHT_PADDING +
      layout.lifelines.length * SEQUENCE_MIN_LANE_WIDTH,
  );
  const laneWidth =
    (width - SEQUENCE_LEFT_PADDING - SEQUENCE_RIGHT_PADDING) /
    layout.lifelines.length;
  const laneX = Object.fromEntries(
    layout.lifelines.map((nodeId, index) => [
      nodeId,
      Math.round(SEQUENCE_LEFT_PADDING + laneWidth * (index + 0.5)),
    ]),
  );
  const header = panel.querySelector(".seq-head");
  header.innerHTML =
    `<div class="seq-head-track" style="width:${width}px">` +
    layout.lifelines
      .map(
        (nodeId) =>
          `<span class="seq-who" data-node="${nodeId}" style="left:${laneX[nodeId]}px; max-width:${Math.floor(laneWidth - 10)}px"><b>${escapeHtml(getLifelineName(lesson, nodeId))}</b><i>${escapeHtml(getLifelineAddress(lesson, nodeId, layout))}</i></span>`,
      )
      .join("") +
    "</div>";
  header.style.height = `${Math.max(46, ...[...header.querySelectorAll(".seq-who")].map((heading) => heading.offsetHeight + 6))}px`;
  const lifelineMarkup = layout.lifelines
    .map(
      (nodeId) =>
        `<line class="seq-life" x1="${laneX[nodeId]}" y1="0" x2="${laneX[nodeId]}" y2="${layout.height}"/>`,
    )
    .join("");
  const stepMarkup = layout.steps
    .map(
      (entry) => `
    <g class="seq-step" data-step="${entry.step}" transform="translate(0 ${entry.y})">
      <line class="seq-step-line" x1="10" y1="0" x2="${width - 10}" y2="0"/>
      <text class="seq-step-text" x="12" y="0.5"><tspan class="seq-step-num">${translate(
        "STEP {n}",
        {
          n: entry.step + 1,
        },
      )}</tspan> · ${escapeHtml(localizedUpperCase(translate(lesson.steps[entry.step].title)))}</text>
    </g>`,
    )
    .join("");
  svg.setAttribute("viewBox", `0 0 ${width} ${layout.height}`);
  svg.setAttribute("width", width);
  svg.setAttribute("height", layout.height);
  svg.innerHTML =
    lifelineMarkup +
    layout.breaks
      .map((entry) => renderSequenceTimeBreak(entry, width))
      .join("") +
    stepMarkup +
    layout.notes
      .map((entry) => renderSequenceNote(entry, laneX, layout.lifelines))
      .join("") +
    [
      ...layout.packets.filter((entry) => !entry.p.lost),
      ...layout.packets.filter((entry) => entry.p.lost),
    ]
      .map((entry) => renderSequenceArrow(entry, laneX))
      .join("");
  layoutSequenceLabels(svg);
  panel._layout = layout;
  panel._lesson = lesson;
  panel._width = scrollArea.clientWidth;
  panel.dataset.lesson = lesson.id;
  scrollArea.scrollTop = 0;
  scrollArea.scrollLeft = 0;
  syncSequenceHeaderScroll(panel);
}
const syncSequenceHeaderScroll = (panel) => {
  const headerTrack = panel.querySelector(".seq-head-track");
  if (headerTrack) {
    headerTrack.style.transform = `translateX(${-panel.querySelector(".seq-scroll").scrollLeft}px)`;
  }
};
function refreshSequenceDiagram(panel) {
  if (!panel._lesson || panel.dataset.lesson !== panel._want) {
    return;
  }
  const scrollArea = panel.querySelector(".seq-scroll");
  const scrollTop = scrollArea.scrollTop;
  const svg = panel.querySelector(".seq-svg");
  const drawing = new Map();
  for (const arrow of svg.querySelectorAll(".seq-arrow.is-current")) {
    const animation = arrow.querySelector(".seq-line").getAnimations()[0];
    if (animation) {
      drawing.set(arrow.dataset.packet, {
        time: animation.currentTime ?? 0,
        delay: animation.effect.getTiming().delay,
      });
    }
  }
  svg.getAnimations({ subtree: true }).forEach((animation) => animation.cancel());
  drawSequenceDiagram(panel, panel._lesson);
  if (panel._state) {
    applySequenceState(panel, panel._state, drawing);
  }
  scrollArea.scrollTop = scrollTop;
}
function bindSequenceScrolling(panel) {
  const scrollArea = panel.querySelector(".seq-scroll");
  scrollArea.addEventListener("scroll", () => syncSequenceHeaderScroll(panel), {
    passive: true,
  });
  new ResizeObserver(() => {
    if (Math.abs(scrollArea.clientWidth - panel._width) >= 1) {
      refreshSequenceDiagram(panel);
    }
  }).observe(scrollArea);
}
const getSequenceElementOpacity = (element) =>
  Number(getComputedStyle(element).opacity);
function revealSequenceElement(element, mode, delay) {
  const opacity = getSequenceElementOpacity(element);
  element
    .getAnimations({
      subtree: true,
    })
    .forEach((animation) => animation.cancel());
  element.classList.add("is-shown");
  if (prefersReducedMotion()) {
    return;
  }
  if (mode === "fade" || opacity > 0) {
    element.animate(
      [
        {
          opacity,
        },
        {
          opacity: 1,
        },
      ],
      {
        duration: 260 * (1 - opacity),
        delay: opacity > 0 ? 0 : delay,
        easing: "ease-out",
        fill: "backwards",
      },
    );
    // A mostly visible arrow only needs its fade to finish; a new one still draws.
    if (mode === "fade" || opacity > 0.5) {
      return;
    }
  }
  const line = element.querySelector(".seq-line");
  const length = Number(element.dataset.len);
  const duration =
    mode === "quick"
      ? SEQUENCE_ANIMATION_TIMINGS.quick
      : SEQUENCE_ANIMATION_TIMINGS.draw;
  const animateTracked = (target, keyframes, options) =>
    playbackClock.track(
      target.animate(keyframes, {
        delay,
        fill: "backwards",
        ...options,
      }),
    );
  if (delay) {
    animateTracked(
      element,
      [
        {
          opacity: 0,
        },
        {
          opacity: 1,
        },
      ],
      {
        duration: 1,
      },
    );
  }
  if (element.classList.contains("is-lost")) {
    animateTracked(
      line,
      [
        {
          opacity: 0,
        },
        {
          opacity: 1,
        },
      ],
      {
        duration,
        easing: "ease-out",
      },
    );
  } else {
    animateTracked(
      line,
      [
        {
          strokeDasharray: `${length} ${length}`,
          strokeDashoffset: length,
        },
        {
          strokeDasharray: `${length} ${length}`,
          strokeDashoffset: 0,
        },
      ],
      {
        duration,
        easing: EASE_OUT_EXPO,
      },
    );
  }
  // Labels appear during travel; the arrival tip (or loss mark) follows at 70%.
  animateTracked(
    element.querySelector(".seq-tip, .seq-cross"),
    [
      {
        opacity: 0,
      },
      {
        opacity: 1,
      },
    ],
    {
      duration: 160,
      delay: delay + duration * SEQUENCE_ANIMATION_TIMINGS.tipFraction,
      easing: "ease-out",
    },
  );
  animateTracked(
    element.querySelector(".seq-label"),
    [
      {
        opacity: 0,
      },
      {
        opacity: 1,
      },
    ],
    {
      duration: 240,
      delay: delay + duration * 0.3,
      easing: "ease-out",
    },
  );
}
function hideSequenceElement(element) {
  const opacity = getSequenceElementOpacity(element);
  element
    .getAnimations({
      subtree: true,
    })
    .forEach((animation) => animation.cancel());
  element.classList.remove("is-shown");
  if (!prefersReducedMotion() && opacity > 0) {
    element.animate(
      [
        {
          opacity,
        },
        {
          opacity: 0,
        },
      ],
      {
        duration: 180 * opacity,
        easing: opacity < 1 ? "linear" : "ease-in",
      },
    );
  }
}
function applySequenceState(panel, state, drawingBeforeResize) {
  const svg = panel.querySelector(".seq-svg");
  const layout = panel._layout;
  for (const [nodeId, [, address]] of Object.entries(state.labels ?? {})) {
    const heading = panel.querySelector(`.seq-who[data-node="${nodeId}"] i`);
    const text = translate(address);
    if (heading && heading.textContent !== text) heading.textContent = text;
  }
  const newlyVisible = [];
  let fadeIndex = 0;
  svg.querySelectorAll(".seq-arrow").forEach((arrow) => {
    const packetIndex = Number(arrow.dataset.packet);
    const packetState = state.packets[packetIndex];
    const tip = arrow.querySelector(".seq-tip, .seq-cross");
    tip.style.visibility = !state.started || packetState === "lost" || packetState === "past" ? "visible" : "hidden";
    const visible = !state.started || packetState !== "future";
    const current = state.started && packetState === "current";
    if (visible && !arrow.classList.contains("is-shown")) {
      newlyVisible.push({
        element: arrow,
        current,
        y: layout.packets[packetIndex].yArrived,
      });
    }
    if (!visible && arrow.classList.contains("is-shown")) {
      hideSequenceElement(arrow);
    }
    arrow.classList.toggle("is-current", current);
  });
  const onlyCurrentPackets =
    newlyVisible.length && newlyVisible.every((entry) => entry.current);
  // Current packets draw in send order. Seeking or replaying past packets uses a fade.
  newlyVisible.forEach((entry, index) => {
    const previous = drawingBeforeResize?.get(entry.element.dataset.packet);
    if (drawingBeforeResize && !previous) {
      entry.element.classList.add("is-shown");
      return;
    }
    const quick = layout.packets.find(
      (packet) => packet.index === Number(entry.element.dataset.packet),
    )?.p.quick;
    if (onlyCurrentPackets || previous) {
      revealSequenceElement(
        entry.element,
        quick ? "quick" : "draw",
        previous?.delay ?? index * SEQUENCE_ANIMATION_TIMINGS.stagger,
      );
      if (previous) {
        // Recreate the draw at its original playback time using the new line length.
        entry.element.getAnimations({ subtree: true }).forEach((animation) => {
          animation.currentTime = previous.time;
        });
      }
    } else {
      revealSequenceElement(
        entry.element,
        "fade",
        Math.min(fadeIndex++ * 14, 420),
      );
    }
  });
  svg.querySelectorAll(".seq-note").forEach((note) => {
    const visible =
      !state.started || state.notes[Number(note.dataset.note)] !== "future";
    if (visible && !note.classList.contains("is-shown")) {
      if (drawingBeforeResize) note.classList.add("is-shown");
      else revealSequenceElement(note, "fade", 0);
      newlyVisible.push({
        element: note,
        y: layout.notes[Number(note.dataset.note)].y,
      });
    }
    if (!visible && note.classList.contains("is-shown")) {
      hideSequenceElement(note);
    }
  });
  svg
    .querySelectorAll(".seq-step")
    .forEach((step) =>
      step.classList.toggle(
        "is-active",
        state.started &&
          !state.done &&
          Number(step.dataset.step) === state.activeStep,
      ),
    );
  const scrollArea = panel.querySelector(".seq-scroll");
  if (!state.started) {
    if (newlyVisible.length) {
      return smoothScrollTo(scrollArea, 0);
    }
    return newlyVisible.length;
  }
  const visibleYPositions = [
    ...svg.querySelectorAll(".seq-arrow.is-shown, .seq-note.is-shown"),
  ].map((element) =>
    element.dataset.packet !== undefined
      ? layout.packets[Number(element.dataset.packet)].yArrived
      : layout.notes[Number(element.dataset.note)].y,
  );
  // Follow the latest arrival position so the complete arrow remains in view.
  const latestY = visibleYPositions.length ? Math.max(...visibleYPositions) : 0;
  const viewportHeight = scrollArea.clientHeight;
  if (latestY > scrollArea.scrollTop + viewportHeight - 44) {
    smoothScrollTo(scrollArea, latestY - viewportHeight * 0.62);
  } else if (latestY < scrollArea.scrollTop + 30) {
    smoothScrollTo(scrollArea, latestY - viewportHeight * 0.4);
  }
}
function transitionSequenceLesson(panel, lesson, state) {
  const sections = [
    panel.querySelector(".seq-scroll"),
    panel.querySelector(".seq-head"),
  ];
  panel._want = lesson.id;
  panel._state = state;
  const showLesson = () => {
    if (panel._want === lesson.id) {
      sections.forEach((section) =>
        section.getAnimations().forEach((animation) => animation.cancel()),
      );
      drawSequenceDiagram(panel, lesson);
      applySequenceState(panel, panel._state);
      if (!prefersReducedMotion()) {
        sections.forEach((section) =>
          section.animate(
            [
              {
                opacity: 0,
              },
              {
                opacity: 1,
              },
            ],
            {
              duration: 260,
              easing: "ease-out",
            },
          ),
        );
      }
    }
  };
  if (!panel.dataset.lesson || prefersReducedMotion()) {
    return showLesson();
  }
  sections.forEach((section) => {
    const opacity = Number(getComputedStyle(section).opacity);
    section.getAnimations().forEach((animation) => animation.cancel());
    section.animate(
      [
        {
          opacity,
        },
        {
          opacity: 0,
        },
      ],
      {
        duration: 160 * opacity,
        easing: opacity < 1 ? "linear" : "ease-in",
        fill: "forwards",
      },
    );
  });
  setTimeout(showLesson, 170);
}
function updateSequenceDiagram(panel, state, lesson) {
  panel._state = state;
  if (panel._want !== lesson.id) {
    return transitionSequenceLesson(panel, lesson, state);
  }
  if (panel.dataset.lesson === lesson.id) {
    applySequenceState(panel, state);
  }
}
export {
  bindSequenceScrolling,
  refreshSequenceDiagram,
  renderSequencePanel,
  updateSequenceDiagram,
};
