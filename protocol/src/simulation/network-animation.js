// Reconstructed from the distributed Protocol Explorer JavaScript.
import { translate } from "../i18n.js";
import {
  NETWORK_FOCUS_GROUPS,
  NETWORK_LANES,
  NETWORK_NODE_CENTERS,
  NETWORK_NODE_LABELS,
  NETWORK_NOTE_ANCHORS,
  NETWORK_ROUTES,
  PACKET_COLORS,
} from "./network-drawing.js";
import { animateWithClock, waitWithClock } from "./clock.js";
const NETWORK_SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const PACKET_PIXELS_PER_MILLISECOND = 0.21;
const PACKET_HOP_PAUSE_MS = 140;
const URL_TYPING_INTERVAL_MS = 55;
const CAMERA_MOVE_DURATION_MS = 1100;
const CAMERA_CONTENT_PADDING = 14;
const CAMERA_MIN_WIDTH = 470;
const URL_VISIBLE_CAMERA_FRAMES = ["client"];
const PACKET_TRAIL_OFFSETS = [10, 20, 30];
const NETWORK_NOTE_HOLD_MS = 1500;
const NETWORK_LABEL_SCALE_WIDTH = 700;
const NETWORK_MAX_LABEL_SCALE = 1.8;
const URL_BAR_SCALE_ORIGIN = [140, 58];
const URL_BAR_POSITION = [60, 334];
const WIDE_CHARACTER_PATTERN =
  /[\u1100-\u115f\u2e80-\u303e\u3041-\u33ff\u3400-\u4dbf\u4e00-\u9fff\ua960-\ua97f\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/;
const estimateTextUnits = (text) =>
  [...text].reduce(
    (units, character) =>
      units +
      (WIDE_CHARACTER_PATTERN.test(character)
        ? 2
        : BIDI_CONTROL_PATTERN.test(character)
          ? 0
          : 1),
    0,
  );
const BIDI_CONTROL_PATTERN = /[\u200e\u200f\u2066-\u2069]/;
const RTL_CHARACTER_PATTERN = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefc]/;
const measureSvgTextWidth = (textElement, minimumWidth, padding = 0) =>
  Math.max(minimumWidth, textElement.getComputedTextLength() + padding);
const easeInOutCubic = (progress) =>
  progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - (-2 * progress + 2) ** 3 / 2;
const easeOutBack = (progress) =>
  1 + 2.2 * (progress - 1) ** 3 + 1.2 * (progress - 1) ** 2;
const easeOutCubic = (progress) => 1 - (1 - progress) ** 3;
const easeInCubic = (progress) => progress * progress * progress;
function createNetworkSvgElement(tagName, attributes, parent) {
  const element = document.createElementNS(NETWORK_SVG_NAMESPACE, tagName);
  for (const [attribute, value] of Object.entries(attributes)) {
    element.setAttribute(attribute, value);
  }
  parent?.appendChild(element);
  return element;
}
const interpolateLinePoint = ([startX, startY, endX, endY], progress) => ({
  x: startX + (endX - startX) * progress,
  y: startY + (endY - startY) * progress,
});
const getLineLength = ([startX, startY, endX, endY]) =>
  Math.hypot(endX - startX, endY - startY);
/**
 * Animate lesson events over the static network SVG.
 * Clock-driven work receives a shared cancellation token from the lesson player.
 * The player calls clear() when changing events to remove transient visuals.
 */
function createNetworkAnimation(networkSvg) {
  const laneElements = Object.fromEntries(
    [...networkSvg.querySelectorAll(".lane")].map((laneElement) => [
      laneElement.dataset.lane,
      laneElement,
    ]),
  );
  const nodeElements = Object.fromEntries(
    [...networkSvg.querySelectorAll(".node")].map((nodeElement) => [
      nodeElement.dataset.node,
      nodeElement,
    ]),
  );
  const packetLayer = networkSvg.querySelector(".packet-layer");
  const pulseLayer = networkSvg.querySelector(".pulse-layer");
  const noteLayer = networkSvg.querySelector(".note-layer");
  const urlBar = networkSvg.querySelector(".url-bar");
  const urlBox = urlBar.querySelector(".url-box");
  const urlText = urlBar.querySelector(".url-text");
  const urlCaret = urlBar.querySelector(".url-caret");
  const urlCheck = urlBar.querySelector(".url-check");
  const pageElements = [...networkSvg.querySelectorAll(".screen-content > *")];
  const visibleNodes = new Set();
  const visibleLanes = new Set();
  let lessonNodes = Object.keys(nodeElements);
  let pageVisible = true;
  let hasMorphed = false;
  let cameraFrame = "full";
  let currentViewBox = networkSvg
    .getAttribute("viewBox")
    .split(" ")
    .map(Number);
  const nodeLabelElements = [...networkSvg.querySelectorAll(".node-label")];
  const urlHolder = networkSvg.querySelector(".url-holder");
  let labelScale = 1;
  let annotationScale = 1;
  function scaleNodeLabel(labelElement) {
    labelElement.removeAttribute("transform");
    if (labelScale === 1) {
      return;
    }
    const bounds = labelElement.getBBox();
    const [horizontalOrigin, verticalOrigin] =
      labelElement.dataset.origin.split("-");
    const anchorX =
      horizontalOrigin === "left"
        ? bounds.x
        : horizontalOrigin === "right"
          ? bounds.x + bounds.width
          : bounds.x + bounds.width / 2;
    const anchorY =
      verticalOrigin === "top" ? bounds.y : bounds.y + bounds.height;
    labelElement.setAttribute(
      "transform",
      `translate(${anchorX.toFixed(1)} ${anchorY.toFixed(1)}) scale(${labelScale.toFixed(3)}) translate(${(-anchorX).toFixed(1)} ${(-anchorY).toFixed(1)})`,
    );
  }
  // Keep labels legible when the same SVG is shown in a narrow viewport.
  function updateResponsiveScale() {
    const viewportWidth = networkSvg.getBoundingClientRect().width;
    const nextLabelScale = viewportWidth
      ? Math.min(
          NETWORK_MAX_LABEL_SCALE,
          Math.max(1, NETWORK_LABEL_SCALE_WIDTH / viewportWidth),
        )
      : 1;
    if (Math.abs(nextLabelScale - labelScale) < 0.01) {
      return;
    }
    labelScale = nextLabelScale;
    annotationScale = 1 + (nextLabelScale - 1) * 0.6;
    networkSvg.classList.toggle("is-scaled", nextLabelScale > 1);
    nodeLabelElements.forEach(scaleNodeLabel);
    const [originX, originY] = URL_BAR_SCALE_ORIGIN;
    urlHolder.setAttribute(
      "transform",
      `translate(${URL_BAR_POSITION[0] + originX} ${URL_BAR_POSITION[1] + originY}) scale(${annotationScale.toFixed(3)}) translate(${-originX} ${-originY})`,
    );
  }
  function getTransformedBounds(element) {
    const bounds = element.getBBox();
    const matrix = element.transform?.baseVal.consolidate()?.matrix;
    return matrix
      ? {
          x: matrix.a * bounds.x + matrix.e,
          y: matrix.d * bounds.y + matrix.f,
          width: matrix.a * bounds.width,
          height: matrix.d * bounds.height,
        }
      : bounds;
  }
  function getNodeBounds(nodeId, includeUrl) {
    if (includeUrl) {
      return nodeElements[nodeId].getBBox();
    }
    const childBounds = [...nodeElements[nodeId].children]
      .filter((childElement) => !childElement.classList.contains("url-holder"))
      .map(getTransformedBounds);
    const minimumX = Math.min(...childBounds.map((bounds) => bounds.x));
    const minimumY = Math.min(...childBounds.map((bounds) => bounds.y));
    return {
      x: minimumX,
      y: minimumY,
      width:
        Math.max(...childBounds.map((bounds) => bounds.x + bounds.width)) -
        minimumX,
      height:
        Math.max(...childBounds.map((bounds) => bounds.y + bounds.height)) -
        minimumY,
    };
  }
  function setCameraFrame(frameName) {
    cameraFrame = frameName;
    urlBar.classList.toggle(
      "is-away",
      !URL_VISIBLE_CAMERA_FRAMES.includes(frameName),
    );
  }
  /** Fit the visible nodes in a named focus group, preserving viewport aspect. */
  function calculateViewBox(frameName) {
    const nodeBounds = NETWORK_FOCUS_GROUPS[frameName]
      .filter((nodeId) => lessonNodes.includes(nodeId))
      .map((nodeId) =>
        getNodeBounds(nodeId, URL_VISIBLE_CAMERA_FRAMES.includes(frameName)),
      );
    const minimumX =
      Math.min(...nodeBounds.map((bounds) => bounds.x)) -
      CAMERA_CONTENT_PADDING;
    const minimumY =
      Math.min(...nodeBounds.map((bounds) => bounds.y)) -
      CAMERA_CONTENT_PADDING;
    const contentWidth =
      Math.max(...nodeBounds.map((bounds) => bounds.x + bounds.width)) +
      CAMERA_CONTENT_PADDING -
      minimumX;
    const contentHeight =
      Math.max(...nodeBounds.map((bounds) => bounds.y + bounds.height)) +
      CAMERA_CONTENT_PADDING -
      minimumY;
    const { width: viewportWidth, height: viewportHeight } =
      networkSvg.getBoundingClientRect();
    const fitScale = Math.min(
      viewportWidth / contentWidth,
      viewportHeight / contentHeight,
      viewportWidth / CAMERA_MIN_WIDTH,
    );
    return [
      minimumX + contentWidth / 2 - viewportWidth / fitScale / 2,
      minimumY + contentHeight / 2 - viewportHeight / fitScale / 2,
      viewportWidth / fitScale,
      viewportHeight / fitScale,
    ];
  }
  function setViewBox(viewBox) {
    currentViewBox = viewBox;
    networkSvg.setAttribute(
      "viewBox",
      viewBox.map((coordinate) => coordinate.toFixed(2)).join(" "),
    );
  }
  let cameraCancellation = {
    cancelled: false,
  };
  // Camera moves have their own token so a resize/new move can interrupt only
  // camera interpolation while still respecting cancellation of the lesson.
  async function animateViewBox(targetViewBox, duration, cancellation) {
    cameraCancellation.cancelled = true;
    const ownCancellation = (cameraCancellation = {
      cancelled: false,
    });
    const startingViewBox = currentViewBox;
    await animateWithClock(
      duration,
      {
        get cancelled() {
          return cancellation.cancelled || ownCancellation.cancelled;
        },
      },
      (progress) => {
        const easedProgress = easeInOutCubic(progress);
        setViewBox(
          startingViewBox.map(
            (coordinate, index) =>
              coordinate + (targetViewBox[index] - coordinate) * easedProgress,
          ),
        );
      },
    );
  }
  function animateCamera(frameName, cancellation) {
    setCameraFrame(frameName);
    return animateViewBox(
      calculateViewBox(frameName),
      CAMERA_MOVE_DURATION_MS,
      cancellation,
    );
  }
  function updateCameraForResize() {
    cameraCancellation.cancelled = true;
    updateResponsiveScale();
    setViewBox(calculateViewBox(cameraFrame));
  }
  new ResizeObserver(updateCameraForResize).observe(networkSvg);
  function setNodeVisible(nodeId, visible) {
    const nodeElement = nodeElements[nodeId];
    if (visible) {
      visibleNodes.add(nodeId);
    } else {
      visibleNodes.delete(nodeId);
    }
    nodeElement.style.opacity = visible ? 1 : 0;
    nodeElement.removeAttribute("transform");
  }
  async function showNode(
    nodeId,
    cancellation,
    { delay = 0, ring = true } = {},
  ) {
    const nodeElement = nodeElements[nodeId];
    visibleNodes.add(nodeId);
    nodeElement.style.opacity = 0;
    if (delay) {
      await waitWithClock(delay, cancellation);
    }
    await animateWithClock(650, cancellation, (progress) => {
      nodeElement.setAttribute(
        "transform",
        `translate(0 ${(-46 * (1 - easeOutBack(progress))).toFixed(2)})`,
      );
      nodeElement.style.opacity = Math.min(1, progress * 2.4);
    });
    if (!cancellation.cancelled) {
      nodeElement.removeAttribute("transform");
      if (ring) {
        pulseNode(nodeId, "navy", cancellation);
      }
    }
  }
  async function hideNode(nodeId, cancellation, delay = 0) {
    const nodeElement = nodeElements[nodeId];
    visibleNodes.delete(nodeId);
    nodeElement.style.opacity = 1;
    if (delay) {
      await waitWithClock(delay, cancellation);
    }
    await animateWithClock(380, cancellation, (progress) => {
      nodeElement.setAttribute(
        "transform",
        `translate(0 ${(-30 * easeInCubic(progress)).toFixed(2)})`,
      );
      nodeElement.style.opacity = 1 - progress;
    });
    if (!cancellation.cancelled) {
      nodeElement.removeAttribute("transform");
      nodeElement.style.opacity = 0;
    }
  }
  function bounceNode(nodeId, cancellation) {
    const nodeElement = nodeElements[nodeId];
    animateWithClock(340, cancellation, (progress) => {
      if (progress < 1) {
        nodeElement.setAttribute(
          "transform",
          `translate(0 ${(-5 * Math.sin(Math.PI * progress)).toFixed(2)})`,
        );
      } else {
        nodeElement.removeAttribute("transform");
      }
    });
  }
  function setLaneProgress(laneId, progress) {
    const [startX, startY] = NETWORK_LANES[laneId];
    const endpoint = interpolateLinePoint(NETWORK_LANES[laneId], progress);
    laneElements[laneId].setAttribute(
      "d",
      `M${startX},${startY} L${endpoint.x.toFixed(1)},${endpoint.y.toFixed(1)}`,
    );
    laneElements[laneId].style.visibility = progress > 0.01 ? "" : "hidden";
  }
  async function animateLane(laneId, visible, cancellation, delay = 0) {
    setLaneProgress(laneId, visible ? 0 : 1);
    if (delay) {
      await waitWithClock(delay, cancellation);
    }
    await animateWithClock(visible ? 520 : 300, cancellation, (progress) =>
      setLaneProgress(
        laneId,
        visible ? easeOutCubic(progress) : 1 - easeInCubic(progress),
      ),
    );
  }
  function updateLanes(cancellation, delay = 0) {
    for (const laneId of Object.keys(laneElements)) {
      const [fromNode, toNode] = laneId.split(">");
      const visible = visibleNodes.has(fromNode) && visibleNodes.has(toNode);
      const changed = visible !== visibleLanes.has(laneId);
      if (visible) {
        visibleLanes.add(laneId);
      } else {
        visibleLanes.delete(laneId);
      }
      if (cancellation) {
        if (changed) {
          animateLane(laneId, visible, cancellation, delay);
        }
      } else {
        setLaneProgress(laneId, visible ? 1 : 0);
      }
    }
  }
  function setPageVisible(visible) {
    pageVisible = visible;
    pageElements.forEach((element) => {
      element.style.opacity = visible ? 1 : 0;
      element.style.strokeDasharray = element.tagName === "polyline" ? 1 : "";
      element.style.strokeDashoffset =
        element.tagName === "polyline" ? (visible ? 0 : 1) : "";
    });
  }
  async function animatePage(visible, cancellation, delay = 0) {
    setPageVisible(!visible);
    pageVisible = visible;
    if (delay) {
      await waitWithClock(delay, cancellation);
    }
    const orderedElements = visible
      ? pageElements
      : [...pageElements].reverse();
    for (const element of orderedElements) {
      if (cancellation.cancelled) {
        return;
      }
      const isPolyline = element.tagName === "polyline";
      element.style.opacity = 1;
      await animateWithClock(visible ? 240 : 110, cancellation, (progress) => {
        const opacity = visible ? easeOutCubic(progress) : 1 - progress;
        if (isPolyline) {
          element.style.strokeDashoffset = 1 - opacity;
        } else {
          element.style.opacity = opacity;
        }
      });
      if (!visible) {
        element.style.opacity = 0;
      }
    }
  }
  async function showNodes(nodeIds, frameName, cancellation) {
    const cameraAnimation = animateCamera(frameName, cancellation);
    await waitWithClock(CAMERA_MOVE_DURATION_MS * 0.45, cancellation);
    for (const [index, nodeId] of nodeIds.entries()) {
      if (cancellation.cancelled) {
        return;
      }
      const nodeAnimation = showNode(nodeId, cancellation);
      if (index === nodeIds.length - 1) {
        await nodeAnimation;
      } else {
        await waitWithClock(200, cancellation);
      }
    }
    if (!cancellation.cancelled) {
      updateLanes(cancellation);
      await cameraAnimation;
      await waitWithClock(300, cancellation);
    }
  }
  async function focusNodes(
    { nodes: nodeIds, frame: frameName },
    cancellation,
  ) {
    const removedNodeIds = Object.keys(nodeElements).filter(
      (nodeId) => visibleNodes.has(nodeId) && !nodeIds.includes(nodeId),
    );
    removedNodeIds.forEach((nodeId) => visibleNodes.delete(nodeId));
    updateLanes(cancellation);
    animatePage(false, cancellation);
    removedNodeIds.forEach((nodeId, index) =>
      hideNode(nodeId, cancellation, 120 + index * 70),
    );
    await waitWithClock(250, cancellation);
    await animateCamera(frameName, cancellation);
    await waitWithClock(250, cancellation);
  }
  async function showNote(
    { at: nodeId, text: text, tone = "navy" },
    cancellation,
  ) {
    const {
      x: anchorX,
      y: anchorY,
      side: anchorSide,
    } = NETWORK_NOTE_ANCHORS[nodeId] ?? {
      x: NETWORK_NODE_CENTERS[nodeId][0],
      y: NETWORK_NODE_CENTERS[nodeId][1],
      side: "top",
    };
    const translatedText = translate(text);
    const noteContainer = createNetworkSvgElement(
      "g",
      {
        transform: `translate(${anchorX} ${anchorY}) scale(${annotationScale.toFixed(3)})`,
      },
      noteLayer,
    );
    const noteGroup = createNetworkSvgElement(
      "g",
      {
        class: `note ${tone}`,
      },
      noteContainer,
    );
    const textElement = createNetworkSvgElement(
      "text",
      {
        class: "note-text",
        "dominant-baseline": "central",
      },
      noteGroup,
    );
    textElement.textContent = translatedText;
    const noteWidth =
      measureSvgTextWidth(
        textElement,
        estimateTextUnits(translatedText) * 7.4,
        3,
      ) + 30;
    const [noteX, noteY] =
      anchorSide === "left" ? [-noteWidth - 9, -13] : [-noteWidth / 2, -38];
    const boxPath =
      anchorSide === "left"
        ? `M${noteX},${noteY} h${noteWidth} v8 l8,5 l-8,5 v8 h${-noteWidth} z`
        : `M${noteX},${noteY} h${noteWidth} v26 h${-noteWidth / 2 + 7} l-7,8 l-7,-8 h${-noteWidth / 2 + 7} z`;
    textElement.setAttribute("x", noteX + 23);
    textElement.setAttribute("y", noteY + 13);
    noteGroup.insertBefore(
      createNetworkSvgElement("circle", {
        class: "note-dot",
        cx: noteX + 13,
        cy: noteY + 13,
        r: 3.5,
      }),
      textElement,
    );
    noteGroup.insertBefore(
      createNetworkSvgElement("path", {
        class: "note-box",
        d: boxPath,
      }),
      noteGroup.firstChild,
    );
    bounceNode(nodeId, cancellation);
    await animateWithClock(320, cancellation, (progress) =>
      noteGroup.setAttribute(
        "transform",
        `scale(${easeOutBack(progress).toFixed(3)})`,
      ),
    );
    await waitWithClock(NETWORK_NOTE_HOLD_MS, cancellation);
    await animateWithClock(200, cancellation, (progress) => {
      noteGroup.setAttribute(
        "transform",
        `scale(${(1 - easeInCubic(progress) * 0.3).toFixed(3)})`,
      );
      noteGroup.style.opacity = 1 - progress;
    });
    noteContainer.remove();
  }
  function setLaneActive(laneId, color) {
    const laneElement = laneElements[laneId];
    laneElement.classList.toggle("is-active", !!color);
    laneElement.style.stroke = color ? PACKET_COLORS[color] : "";
    laneElement.setAttribute("marker-end", `url(#head-${color || "idle"})`);
  }
  // Streams can put several packets on one lane at once. Keep it highlighted
  // until the last packet using that lane releases it.
  const activeLaneCounts = {};
  function acquireLane(laneId, color) {
    activeLaneCounts[laneId] = (activeLaneCounts[laneId] ?? 0) + 1;
    setLaneActive(laneId, color);
  }
  function releaseLane(laneId) {
    activeLaneCounts[laneId] = Math.max(0, (activeLaneCounts[laneId] ?? 0) - 1);
    if (!activeLaneCounts[laneId]) {
      setLaneActive(laneId);
    }
  }
  async function pulseNode(nodeId, color, cancellation) {
    const [centerX, centerY] = NETWORK_NODE_CENTERS[nodeId];
    const pulseElement = createNetworkSvgElement(
      "circle",
      {
        cx: centerX,
        cy: centerY,
        fill: "none",
        stroke: PACKET_COLORS[color],
        "stroke-width": 2,
      },
      pulseLayer,
    );
    await animateWithClock(700, cancellation, (progress) => {
      pulseElement.setAttribute("r", 14 + progress * 46);
      pulseElement.setAttribute("opacity", 0.6 * (1 - progress));
    });
    pulseElement.remove();
  }
  /** Build a packet marker, trailing dots, and its translated payload label. */
  function createPacketVisual(color, label, payload = [], locked = false) {
    const translatedLabel = translate(label);
    const translatedPayload = payload.map((fieldText) => translate(fieldText));
    const trail = PACKET_TRAIL_OFFSETS.map((trailOffset, index) =>
      createNetworkSvgElement(
        "circle",
        {
          r: 3.6 - index,
          fill: PACKET_COLORS[color],
          opacity: 0.45 - index * 0.12,
        },
        packetLayer,
      ),
    );
    const packetGroup = createNetworkSvgElement(
      "g",
      {
        class: "packet",
      },
      packetLayer,
    );
    createNetworkSvgElement(
      "circle",
      {
        r: 13,
        fill: PACKET_COLORS[color],
        opacity: 0.18,
      },
      packetGroup,
    );
    createNetworkSvgElement(
      "circle",
      {
        r: 6,
        fill: PACKET_COLORS[color],
        stroke: "var(--panel)",
        "stroke-width": 2,
      },
      packetGroup,
    );
    const lineHeight = 15;
    const lockWidth = locked ? 14 : 0;
    const payloadHeight = translatedPayload.length
      ? translatedPayload.length * lineHeight + 9
      : 0;
    const tagGroup = createNetworkSvgElement(
      "g",
      {
        class: `packet-tag ${color}`,
        transform: `translate(0 -16) scale(${annotationScale.toFixed(3)})`,
      },
      packetGroup,
    );
    const payloadElements = translatedPayload.map((fieldText, index) => {
      const textElement = createNetworkSvgElement(
        "text",
        {
          y: -payloadHeight + 6 + index * lineHeight,
          "dominant-baseline": "hanging",
          class: "packet-field",
        },
        tagGroup,
      );
      textElement.textContent = fieldText;
      return textElement;
    });
    const labelElement = createNetworkSvgElement(
      "text",
      {
        "text-anchor": "middle",
        "dominant-baseline": "central",
        x: lockWidth / 2,
        y: -payloadHeight - 10.5,
        class: "packet-label",
      },
      tagGroup,
    );
    labelElement.textContent = translatedLabel;
    const labelWidth = measureSvgTextWidth(
      labelElement,
      estimateTextUnits(translatedLabel) * 7.6,
    );
    const tagWidth = Math.max(
      labelWidth + 16 + lockWidth,
      ...payloadElements.map(
        (textElement, index) =>
          measureSvgTextWidth(
            textElement,
            estimateTextUnits(translatedPayload[index]) * 6.2,
          ) + 16,
      ),
    );
    payloadElements.forEach((textElement, index) => {
      const isRtlText = RTL_CHARACTER_PATTERN.test(translatedPayload[index]);
      textElement.setAttribute(
        "x",
        isRtlText ? tagWidth / 2 - 8 : -tagWidth / 2 + 8,
      );
      if (isRtlText) {
        textElement.setAttribute("text-anchor", "end");
      }
    });
    tagGroup.insertBefore(
      createNetworkSvgElement("rect", {
        x: -tagWidth / 2,
        y: -payloadHeight - 22,
        width: tagWidth,
        height: 22,
        rx: 3,
        fill: PACKET_COLORS[color],
      }),
      labelElement,
    );
    if (payloadHeight) {
      tagGroup.insertBefore(
        createNetworkSvgElement("rect", {
          x: -tagWidth / 2,
          y: -payloadHeight - 4,
          width: tagWidth,
          height: payloadHeight + 4,
          rx: 3,
          class: "packet-body",
          stroke: PACKET_COLORS[color],
        }),
        tagGroup.firstChild,
      );
    }
    if (locked) {
      const lockX = -labelWidth / 2 - 4;
      createNetworkSvgElement(
        "path",
        {
          class: "packet-lock",
          d: `M${lockX - 6},${-payloadHeight - 10} v-2.4 a3,3 0 0 1 6,0 v2.4 M${lockX - 7.5},${-payloadHeight - 10} h9 v6.5 h-9 z`,
        },
        tagGroup,
      );
    }
    return {
      g: packetGroup,
      trail: trail,
    };
  }
  const positionPacket = (packetElement, position, scale = 1) =>
    packetElement.setAttribute(
      "transform",
      `translate(${position.x.toFixed(1)} ${position.y.toFixed(1)}) scale(${scale.toFixed(3)})`,
    );
  /** Traverse the route hop by hop, or drop at 55% of the first internet lane. */
  async function animatePacket(
    {
      from: fromNode,
      to: toNode,
      color: color,
      label: label,
      payload: payload,
      locked: locked,
      lost: lost,
      quick: quick,
    },
    cancellation,
  ) {
    const route = NETWORK_ROUTES[`${fromNode}>${toNode}`];
    const pixelsPerMillisecond = quick
      ? PACKET_PIXELS_PER_MILLISECOND * 2.4
      : PACKET_PIXELS_PER_MILLISECOND;
    const lossLaneIndex = lost
      ? route.findIndex((laneId) => laneId.includes("internet"))
      : -1;
    const activeRoute = route.filter(
      (laneId, index) => lossLaneIndex < 0 || index <= lossLaneIndex,
    );
    activeRoute.forEach((laneId) => acquireLane(laneId, color));
    const visual = createPacketVisual(color, label, payload, locked);
    const startPosition = interpolateLinePoint(NETWORK_LANES[route[0]], 0);
    await animateWithClock(quick ? 140 : 220, cancellation, (progress) =>
      positionPacket(visual.g, startPosition, easeOutBack(progress)),
    );
    let currentPosition = startPosition;
    for (const [laneIndex, laneId] of route.entries()) {
      if (cancellation.cancelled) {
        return;
      }
      const laneCoordinates = NETWORK_LANES[laneId];
      const destinationFraction = laneIndex === lossLaneIndex ? 0.55 : 1;
      await animateWithClock(
        (getLineLength(laneCoordinates) * destinationFraction) /
          pixelsPerMillisecond,
        cancellation,
        (progress) => {
          currentPosition = interpolateLinePoint(
            laneCoordinates,
            progress * destinationFraction,
          );
          positionPacket(visual.g, currentPosition);
          visual.trail.forEach((trailElement, index) => {
            const trailPosition = interpolateLinePoint(
              laneCoordinates,
              Math.max(
                0,
                progress * destinationFraction -
                  PACKET_TRAIL_OFFSETS[index] / getLineLength(laneCoordinates),
              ),
            );
            trailElement.setAttribute("cx", trailPosition.x);
            trailElement.setAttribute("cy", trailPosition.y);
          });
        },
      );
      if (cancellation.cancelled) {
        return;
      }
      if (laneIndex === lossLaneIndex) {
        return dropPacket(visual, currentPosition, activeRoute, cancellation);
      }
      bounceNode(laneId.split(">")[1], cancellation);
      if (laneIndex < route.length - 1) {
        await waitWithClock(quick ? 40 : PACKET_HOP_PAUSE_MS, cancellation);
      }
    }
    pulseNode(toNode, color, cancellation);
    await animateWithClock(180, cancellation, (progress) => {
      positionPacket(visual.g, currentPosition, 1 - easeInCubic(progress));
      visual.trail.forEach((trailElement) =>
        trailElement.setAttribute("opacity", 0.3 * (1 - progress)),
      );
    });
    visual.g.remove();
    visual.trail.forEach((trailElement) => trailElement.remove());
    route.forEach(releaseLane);
    await waitWithClock(150, cancellation);
  }
  async function animatePacketStream(
    { packets: packets, spacing = 480 },
    cancellation,
  ) {
    const packetAnimations = [];
    for (const [index, packet] of packets.entries()) {
      if (cancellation.cancelled) {
        return;
      }
      packetAnimations.push(animatePacket(packet, cancellation));
      if (index < packets.length - 1) {
        await waitWithClock(spacing, cancellation);
      }
    }
    await Promise.all(packetAnimations);
  }
  async function dropPacket(visual, position, activeRoute, cancellation) {
    const crossElement = createNetworkSvgElement(
      "path",
      {
        class: "drop-cross",
        d: "M-6,-6 L6,6 M6,-6 L-6,6",
        transform: `translate(${position.x} ${position.y})`,
      },
      packetLayer,
    );
    await animateWithClock(520, cancellation, (progress) => {
      positionPacket(
        visual.g,
        {
          x: position.x,
          y: position.y + 26 * easeInCubic(progress),
        },
        1 - 0.4 * progress,
      );
      visual.g.style.opacity = 1 - progress;
      visual.trail.forEach((trailElement) =>
        trailElement.setAttribute("opacity", 0.3 * (1 - progress)),
      );
      crossElement.setAttribute(
        "transform",
        `translate(${position.x} ${position.y}) scale(${easeOutBack(Math.min(1, progress * 2)).toFixed(3)})`,
      );
    });
    visual.g.remove();
    visual.trail.forEach((trailElement) => trailElement.remove());
    activeRoute.forEach(releaseLane);
    await waitWithClock(500, cancellation);
    await animateWithClock(
      250,
      cancellation,
      (progress) => (crossElement.style.opacity = 1 - progress),
    );
    crossElement.remove();
  }
  let labelOverrides = {};
  function updateNodeLabels(overrides) {
    labelOverrides = overrides;
    for (const [nodeId, nodeElement] of Object.entries(nodeElements)) {
      const [name, address] = overrides[nodeId] ?? NETWORK_NODE_LABELS[nodeId];
      const labelTexts = [translate(name), translate(address)];
      const textElements = [
        nodeElement.querySelector(".node-name"),
        nodeElement.querySelector(".node-ip"),
      ];
      const labelElement = nodeElement.querySelector(".node-label");
      textElements.forEach((textElement, index) => {
        if (!textElement || textElement.textContent === labelTexts[index]) {
          return;
        }
        textElement.getAnimations().forEach((animation) => animation.cancel());
        textElement.textContent = labelTexts[index];
        scaleNodeLabel(labelElement);
        if (visibleNodes.has(nodeId) && nodeElement.style.opacity !== "0") {
          textElement.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
        }
      });
    }
  }
  function setUrlText(text, secure) {
    urlBar.classList.toggle("is-secure", !!secure);
    urlText.textContent = text;
    const textWidth = urlText.getComputedTextLength();
    urlBox.setAttribute("width", (textWidth + 58).toFixed(1));
    urlCheck.setAttribute(
      "transform",
      `translate(${(textWidth + 38).toFixed(1)} 0)`,
    );
  }
  async function typeUrl(text, secure, cancellation) {
    setUrlText(text, secure);
    urlText.textContent = "";
    urlCaret.setAttribute("x", 29);
    urlBar.classList.add("is-visible", "is-typing");
    await waitWithClock(400, cancellation);
    for (
      let characterCount = 1;
      characterCount <= text.length;
      characterCount++
    ) {
      if (cancellation.cancelled) {
        return;
      }
      urlText.textContent = text.slice(0, characterCount);
      urlCaret.setAttribute("x", 30 + urlText.getComputedTextLength());
      await waitWithClock(URL_TYPING_INTERVAL_MS, cancellation);
    }
    if (!cancellation.cancelled) {
      urlBar.classList.remove("is-typing");
      bounceNode("client", cancellation);
      await waitWithClock(500, cancellation);
    }
  }
  async function renderPage(cancellation) {
    await waitWithClock(200, cancellation);
    await animatePage(true, cancellation);
    if (!cancellation.cancelled) {
      urlBar.classList.add("is-loaded");
      pulseNode("client", "green", cancellation);
      await waitWithClock(500, cancellation);
    }
  }
  function clearUrl() {
    urlBar.classList.remove("is-visible", "is-typing", "is-loaded");
    urlText.textContent = "";
  }
  Object.keys(laneElements).forEach((laneId) => setLaneProgress(laneId, 0));
  return {
    run(event, cancellation) {
      switch (event.type) {
        case "packet":
          return animatePacket(event, cancellation);
        case "stream":
          return animatePacketStream(event, cancellation);
        case "type-url":
          return typeUrl(event.text, event.secure, cancellation);
        case "focus":
          return focusNodes(event, cancellation);
        case "show":
          return showNodes(event.nodes, event.frame, cancellation);
        case "camera":
          return animateCamera(event.frame, cancellation);
        case "render":
          return renderPage(cancellation);
        case "note":
          return showNote(event, cancellation);
        default:
          return Promise.resolve();
      }
    },
    retext() {
      updateNodeLabels(labelOverrides);
    },
    setLabels(labels) {
      if (labels !== labelOverrides) updateNodeLabels(labels);
    },
    overview(nodeIds, labels = {}) {
      lessonNodes = nodeIds;
      updateNodeLabels(labels);
      Object.keys(nodeElements).forEach((nodeId) =>
        setNodeVisible(nodeId, lessonNodes.includes(nodeId)),
      );
      updateLanes();
      clearUrl();
      setPageVisible(true);
      setCameraFrame("full");
      updateCameraForResize();
    },
    // Apply final event state without animation when stepping or changing views.
    apply(event) {
      if (event.type === "focus") {
        Object.keys(nodeElements).forEach((nodeId) =>
          setNodeVisible(nodeId, event.nodes.includes(nodeId)),
        );
        updateLanes();
        clearUrl();
        setPageVisible(false);
        setCameraFrame(event.frame);
        updateCameraForResize();
      }
      if (event.type === "type-url") {
        setUrlText(event.text, event.secure);
        urlBar.classList.add("is-visible");
      }
      if (event.type === "show") {
        event.nodes.forEach((nodeId) => setNodeVisible(nodeId, true));
        updateLanes();
      }
      if (event.type === "show" || event.type === "camera") {
        setCameraFrame(event.frame);
        updateCameraForResize();
      }
      if (event.type === "render") {
        setPageVisible(true);
        urlBar.classList.add("is-loaded");
      }
    },
    snapshot() {
      return {
        view: currentViewBox,
        visible: new Set(visibleNodes),
        lanes: new Set(visibleLanes),
        page: pageVisible,
        fresh: !hasMorphed,
      };
    },
    // Animate from a captured previous scene to the state already applied above.
    morph(previousSnapshot, cancellation) {
      hasMorphed = true;
      networkSvg.classList.remove("is-booting");
      const addedNodes = NETWORK_FOCUS_GROUPS.full.filter(
        (nodeId) =>
          visibleNodes.has(nodeId) && !previousSnapshot.visible.has(nodeId),
      );
      const removedNodes = [...previousSnapshot.visible].filter(
        (nodeId) => !visibleNodes.has(nodeId),
      );
      if (!previousSnapshot.fresh) {
        const targetViewBox = currentViewBox;
        setViewBox(previousSnapshot.view);
        animateViewBox(
          targetViewBox,
          CAMERA_MOVE_DURATION_MS * 0.8,
          cancellation,
        );
      }
      removedNodes.forEach((nodeId, index) =>
        hideNode(nodeId, cancellation, index * 60),
      );
      addedNodes.forEach((nodeId, index) =>
        showNode(nodeId, cancellation, {
          delay: (previousSnapshot.fresh ? 150 : 250) + index * 110,
          ring: false,
        }),
      );
      const laneDelay = addedNodes.length ? 500 + addedNodes.length * 110 : 0;
      for (const laneId of Object.keys(laneElements)) {
        const visible = visibleLanes.has(laneId);
        if (visible !== previousSnapshot.lanes.has(laneId)) {
          animateLane(laneId, visible, cancellation, visible ? laneDelay : 0);
        }
      }
      if (pageVisible !== previousSnapshot.page) {
        animatePage(
          pageVisible,
          cancellation,
          pageVisible ? laneDelay + 200 : 0,
        );
      }
    },
    clear() {
      for (const element of [...packetLayer.children, ...noteLayer.children]) {
        element.animate(
          [
            {
              opacity: 1,
            },
            {
              opacity: 0,
            },
          ],
          {
            duration: 160,
          },
        ).onfinish = () => element.remove();
      }
      pulseLayer.replaceChildren();
      Object.keys(laneElements).forEach((laneId) => {
        activeLaneCounts[laneId] = 0;
        setLaneActive(laneId);
      });
    },
  };
}
export { createNetworkAnimation };
