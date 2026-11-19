// Reconstructed from the distributed Protocol Explorer JavaScript.
import { translate } from "../i18n.js";
import { createEndpointDisplay, ftpServerPort } from "./endpoint-display.js";
import {
  NETWORK_FOCUS_GROUPS,
  NETWORK_LANES,
  NETWORK_NODE_BOUNDS,
  NETWORK_NODE_CENTERS,
  NETWORK_NODE_LABELS,
  NETWORK_NODE_RADII,
  NETWORK_NOTE_ANCHORS,
  NETWORK_ROUTES,
  PACKET_COLORS,
  SCREEN_WIDTH,
} from "./network-drawing.js";
import { fitScene, labelScale as watchLabelScale, token } from "../../../shared/iso-kit.js";
import { animateWithClock, waitWithClock } from "./clock.js";
import { SEQUENCE_ANIMATION_TIMINGS } from "./timeline.js";
const NETWORK_SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const PACKET_PIXELS_PER_MILLISECOND = 0.21;
const PACKET_HOP_PAUSE_MS = 140;
const PACKET_ARRIVAL = { fade: 180, hold: 150 };
const PACKET_LOSS = { drop: 520, hold: 500, fade: 250 };
const URL_TYPING_INTERVAL_MS = 55;
const CAMERA_MOVE_DURATION_MS = 1100;
// The camera frames a focus group with fitScene(): devices and their callout
// labels fill CAMERA_FILL of the stage. Close-ups never zoom past
// CAMERA_MAX_ZOOM (CSS px per user unit; the laptop alone may go closer so its
// address bar stays readable) or below CAMERA_MIN_WIDTH user units across.
const CAMERA_FILL = 0.88;
const CAMERA_MIN_WIDTH = 470;
const CAMERA_MAX_ZOOM = { client: 1.7, default: 1.3 };
const LABEL_MAX_SCALE = 2.2;
const URL_VISIBLE_CAMERA_FRAMES = ["client"];
const PACKET_TRAIL_OFFSETS = [10, 20, 30];
const NETWORK_NOTE_HOLD_MS = 1500;
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
// A lane is a polyline of screen points; positions are fractions of its length.
const getLineLength = (points) =>
  points
    .slice(1)
    .reduce(
      (sum, [x, y], index) =>
        sum + Math.hypot(x - points[index][0], y - points[index][1]),
      0,
    );
function interpolateLinePoint(points, progress) {
  let remaining = Math.max(0, Math.min(1, progress)) * getLineLength(points);
  for (let index = 1; index < points.length; index++) {
    const [startX, startY] = points[index - 1];
    const [endX, endY] = points[index];
    const segment = Math.hypot(endX - startX, endY - startY);
    if (remaining <= segment || index === points.length - 1) {
      const t = segment ? Math.min(1, remaining / segment) : 1;
      return { x: startX + (endX - startX) * t, y: startY + (endY - startY) * t, index };
    }
    remaining -= segment;
  }
  return { x: points[0][0], y: points[0][1], index: 1 };
}
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
  const linkElements = Object.fromEntries(
    [...networkSvg.querySelectorAll(".link")].map((linkElement) => [
      linkElement.dataset.link,
      linkElement,
    ]),
  );
  // Draw-in: every stroked part of the idle cable is measured as length 1.
  const linkStrokes = Object.fromEntries(
    Object.entries(linkElements).map(([linkId, linkElement]) => {
      const paths = [...linkElement.querySelectorAll(".link-cable path:not(.iso-cable-head)")];
      paths.forEach((path) => path.setAttribute("pathLength", "1"));
      return [linkId, { paths, plugs: [...linkElement.querySelectorAll(".link-cable .iso-cable-plug")] }];
    }),
  );
  const nodeElements = Object.fromEntries(
    [...networkSvg.querySelectorAll(".node")].map((nodeElement) => [
      nodeElement.dataset.node,
      nodeElement,
    ]),
  );
  const endpointDisplay = createEndpointDisplay(nodeElements, networkSvg);
  let currentLessonId;
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
  // Callout labels never render under their minimum size (shared labelScale);
  // packet tags and notes follow the same factor when they are created.
  watchLabelScale(networkSvg, { max: LABEL_MAX_SCALE });
  let annotationScale = 1;
  const stageAspect = () => {
    const { width, height } = networkSvg.getBoundingClientRect();
    return width && height ? width / height : 16 / 10;
  };
  function updateAnnotationScale(viewBox) {
    const { width, height } = networkSvg.getBoundingClientRect();
    networkSvg.classList.toggle("compact-network", width > 0 && width <= 540);
    if (!width || !height) return;
    const scale = Math.min(width / viewBox[2], height / viewBox[3]);
    // Packet tags and notes render at their CSS size (payload text 11.5 → ≥ 12 px)
    // whatever the zoom: smaller in close-ups, larger when the scene is small.
    annotationScale = Math.min(LABEL_MAX_SCALE, Math.max(0.75, 1.05 / scale));
  }
  // Callouts above / below devices, or beside them on a short wide stage.
  const WIDE_STAGE_ASPECT = 2.4;
  let labelLayout = "tall";
  function updateLabelLayout(aspect) {
    labelLayout = aspect > WIDE_STAGE_ASPECT ? "wide" : "tall";
    networkSvg.classList.toggle("is-wide-labels", labelLayout === "wide");
  }
  /** A callout label box in user units, grown by the label scale k about its origin. */
  function labelBox(nodeId, k) {
    const label = nodeElements[nodeId].querySelector(`.node-label[data-layout="${labelLayout}"] .iso-callout-label`);
    const bounds = label.getBBox();
    const [ox, oy] = (label.style.transformOrigin || "0px 0px").split(" ").map(parseFloat);
    return [
      ox + (bounds.x - ox) * k,
      oy + (bounds.y - oy) * k,
      bounds.width * k,
      bounds.height * k,
    ];
  }
  function setCameraFrame(frameName) {
    cameraFrame = frameName;
    urlBar.classList.toggle(
      "is-away",
      !URL_VISIBLE_CAMERA_FRAMES.includes(frameName),
    );
  }
  /** Frame the lesson's devices in a named focus group with fitScene(). */
  function calculateViewBox(frameName) {
    const ids = NETWORK_FOCUS_GROUPS[frameName].filter((nodeId) => lessonNodes.includes(nodeId));
    if (!ids.length) return currentViewBox;
    const points = ids.flatMap((nodeId) => NETWORK_NODE_BOUNDS[nodeId]);
    const aspect = stageAspect();
    updateLabelLayout(aspect);
    const { width } = networkSvg.getBoundingClientRect();
    const fit = (k) => {
      let viewBox = fitScene(points, {
        stageAspect: aspect,
        fill: CAMERA_FILL,
        pad: 6,
        labels: ids.map((nodeId) => labelBox(nodeId, k)),
      })
        .split(" ")
        .map(Number);
      const minWidth = Math.max(CAMERA_MIN_WIDTH, width / (CAMERA_MAX_ZOOM[frameName] ?? CAMERA_MAX_ZOOM.default));
      if (viewBox[2] < minWidth) {
        const grow = minWidth / viewBox[2];
        viewBox = [
          viewBox[0] + (viewBox[2] * (1 - grow)) / 2,
          viewBox[1] + (viewBox[3] * (1 - grow)) / 2,
          viewBox[2] * grow,
          viewBox[3] * grow,
        ];
      }
      return viewBox;
    };
    // Labels grow when the scene is drawn small: fit once, then refit with
    // the label scale that frame will have.
    let viewBox = fit(1);
    if (width) {
      const k = Math.min(LABEL_MAX_SCALE, Math.max(1, viewBox[2] / width));
      if (k > 1.01) viewBox = fit(k);
    }
    return viewBox;
  }
  function setViewBox(viewBox) {
    // A hidden or zero-sized scene has no camera to fit; keep the last view.
    if (!viewBox.every(Number.isFinite)) return;
    currentViewBox = viewBox;
    updateAnnotationScale(viewBox);
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
  function setLinkProgress(linkId, progress) {
    const { paths, plugs } = linkStrokes[linkId];
    const shown = progress > 0.01;
    linkElements[linkId].style.visibility = shown ? "" : "hidden";
    const complete = progress >= 0.999;
    paths.forEach((path) => {
      path.style.strokeDasharray = complete ? "" : "1 1";
      path.style.strokeDashoffset = complete ? "" : String(1 - progress);
    });
    plugs.forEach((plug, index) => {
      plug.style.opacity = index === 0 ? (shown ? 1 : 0) : complete ? 1 : 0;
    });
  }
  async function animateLink(linkId, visible, cancellation, delay = 0) {
    setLinkProgress(linkId, visible ? 0 : 1);
    if (delay) {
      await waitWithClock(delay, cancellation);
    }
    await animateWithClock(visible ? 520 : 300, cancellation, (progress) =>
      setLinkProgress(
        linkId,
        visible ? easeOutCubic(progress) : 1 - easeInCubic(progress),
      ),
    );
  }
  // visibleLanes holds the links (both directions) whose two devices are shown.
  function updateLanes(cancellation, delay = 0) {
    for (const [linkId, linkElement] of Object.entries(linkElements)) {
      const { from: fromNode, to: toNode } = linkElement.dataset;
      const visible = visibleNodes.has(fromNode) && visibleNodes.has(toNode);
      const changed = visible !== visibleLanes.has(linkId);
      if (visible) {
        visibleLanes.add(linkId);
      } else {
        visibleLanes.delete(linkId);
      }
      if (cancellation) {
        if (changed) {
          animateLink(linkId, visible, cancellation, delay);
        }
      } else {
        setLinkProgress(linkId, visible ? 1 : 0);
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
    { at: nodeId, text: text, tone = "navy", devicesAfter },
    cancellation,
  ) {
    if (devicesAfter?.certificate === "verified") {
      bounceNode(nodeId, cancellation);
      await animateWithClock(2200, cancellation, progress => {
        networkSvg.dataset.certChecks = String(Math.min(3, 1 + Math.floor(progress * 4)));
      });
      return;
    }
    if (currentLessonId === "dns" && text === "CACHED · TTL 3600 S") {
      await waitWithClock(NETWORK_NOTE_HOLD_MS, cancellation);
      return;
    }
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
  // The conductor a packet travels on lights up (accent, with a running pulse).
  function setLaneActive(laneId, color) {
    laneElements[laneId].classList.toggle("is-active", !!color);
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
    // An arrival ring on the floor around the device's footprint.
    const [centerX, centerY] = NETWORK_NODE_CENTERS[nodeId];
    const radius = NETWORK_NODE_RADII[nodeId];
    const pulseElement = createNetworkSvgElement(
      "ellipse",
      {
        cx: centerX,
        cy: centerY,
        fill: "none",
        stroke: PACKET_COLORS[color],
        "stroke-width": 2,
        class: "pulse-ring",
      },
      pulseLayer,
    );
    await animateWithClock(700, cancellation, (progress) => {
      const r = radius * (0.8 + progress * 0.7);
      pulseElement.setAttribute("rx", r);
      pulseElement.setAttribute("ry", r / 2);
      pulseElement.setAttribute("opacity", 0.7 * (1 - progress));
    });
    pulseElement.remove();
  }
  /** Build a packet marker, trailing dots, and its translated payload label. */
  function createPacketVisual(color, label, payload = [], locked = false) {
    const translatedLabel = translate(label);
    const translatedPayload = payload.map((fieldText) => translate(fieldText));
    // A few fading marks on the floor behind the token.
    const trail = PACKET_TRAIL_OFFSETS.map((trailOffset, index) =>
      createNetworkSvgElement(
        "ellipse",
        {
          rx: 4.4 - index,
          ry: 2.2 - index * 0.5,
          fill: PACKET_COLORS[color],
          opacity: 0.45 - index * 0.12,
          class: "packet-trail",
        },
        packetLayer,
      ),
    );
    const packetGroup = createNetworkSvgElement(
      "g",
      {
        class: `packet c-${color}`,
      },
      packetLayer,
    );
    // The packet itself: a kit token in the packet's colour, on the floor.
    const tokenHolder = createNetworkSvgElement("g", { class: "packet-token" }, packetGroup);
    tokenHolder.innerHTML = token({ color: PACKET_COLORS[color], text: "", size: 1.25, h: 0.55 });
    const lineHeight = 15;
    const lockWidth = locked ? 14 : 0;
    const payloadHeight = translatedPayload.length
      ? translatedPayload.length * lineHeight + 9
      : 0;
    const tagGroup = createNetworkSvgElement(
      "g",
      {
        class: `packet-tag ${color}`,
        transform: `translate(0 -22) scale(${annotationScale.toFixed(3)})`,
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
      row,
    },
    cancellation,
    onArrival,
    onLoss,
    mode,
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
    const appearTime = quick ? 140 : 220;
    const hopPause = quick ? 40 : PACKET_HOP_PAUSE_MS;
    const travelTimes = activeRoute.map((laneId, index) => {
      const fraction = index === lossLaneIndex ? 0.55 : 1;
      return getLineLength(NETWORK_LANES[laneId]) * fraction / pixelsPerMillisecond;
    });
    let flightScale = 1, endScale = 1;
    if (mode === "sequence") {
      const timing = SEQUENCE_ANIMATION_TIMINGS;
      const drawTime = quick ? timing.quick : timing.draw;
      const totalFlight = travelTimes.reduce((sum, ms) => sum + ms, appearTime) + (activeRoute.length - 1) * hopPause;
      flightScale = drawTime * timing.tipFraction / totalFlight;
      const ending = lost ? PACKET_LOSS : PACKET_ARRIVAL;
      const endDuration = Object.values(ending).reduce((sum, ms) => sum + ms, 0);
      endScale = drawTime * (1 - timing.tipFraction) / endDuration;
    }
    activeRoute.forEach((laneId) => acquireLane(laneId, color));
    const port = currentLessonId === "ftp" ? ftpServerPort({ from: fromNode, row }) : null;
    const visual = createPacketVisual(color, port ? `${translate(label)} · ${port}` : label, payload, locked);
    const startPosition = interpolateLinePoint(NETWORK_LANES[route[0]], 0);
    visual.trail.forEach((trailElement) => {
      trailElement.setAttribute("cx", startPosition.x);
      trailElement.setAttribute("cy", startPosition.y);
    });
    await animateWithClock(appearTime * flightScale, cancellation, (progress) =>
      positionPacket(visual.g, startPosition, easeOutBack(progress)),
    );
    let currentPosition = startPosition;
    for (const [laneIndex, laneId] of activeRoute.entries()) {
      if (cancellation.cancelled) {
        return;
      }
      const laneCoordinates = NETWORK_LANES[laneId];
      const destinationFraction = laneIndex === lossLaneIndex ? 0.55 : 1;
      await animateWithClock(
        travelTimes[laneIndex] * flightScale,
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
        onLoss?.();
        return dropPacket(visual, currentPosition, activeRoute, cancellation, endScale);
      }
      bounceNode(laneId.split(">")[1], cancellation);
      if (laneIndex < route.length - 1) {
        await waitWithClock(hopPause * flightScale, cancellation);
      }
    }
    onArrival?.();
    pulseNode(toNode, color, cancellation);
    await animateWithClock(PACKET_ARRIVAL.fade * endScale, cancellation, (progress) => {
      positionPacket(visual.g, currentPosition, 1 - easeInCubic(progress));
      visual.trail.forEach((trailElement) =>
        trailElement.setAttribute("opacity", 0.3 * (1 - progress)),
      );
    });
    if (cancellation.cancelled) return;
    visual.g.remove();
    visual.trail.forEach((trailElement) => trailElement.remove());
    route.forEach(releaseLane);
    await waitWithClock(PACKET_ARRIVAL.hold * endScale, cancellation);
  }
  async function animatePacketStream(
    { packets: packets, spacing = 480 },
    cancellation,
    onPacketState,
    mode,
  ) {
    const packetAnimations = [];
    for (const [index, packet] of packets.entries()) {
      if (cancellation.cancelled) {
        return;
      }
      onPacketState(index, "current");
      packetAnimations.push(animatePacket(packet, cancellation,
        () => onPacketState(index, "past"),
        () => onPacketState(index, "lost"),
        mode,
      ));
      if (index < packets.length - 1) {
        await waitWithClock(mode === "sequence" ? SEQUENCE_ANIMATION_TIMINGS.stagger : spacing, cancellation);
      }
    }
    await Promise.all(packetAnimations);
  }
  async function dropPacket(visual, position, activeRoute, cancellation, endScale) {
    const crossElement = createNetworkSvgElement(
      "path",
      {
        class: "drop-cross",
        d: "M-6,-6 L6,6 M6,-6 L-6,6",
        transform: `translate(${position.x} ${position.y})`,
      },
      packetLayer,
    );
    await animateWithClock(PACKET_LOSS.drop * endScale, cancellation, (progress) => {
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
    if (cancellation.cancelled) return;
    visual.g.remove();
    visual.trail.forEach((trailElement) => trailElement.remove());
    activeRoute.forEach(releaseLane);
    await waitWithClock(PACKET_LOSS.hold * endScale, cancellation);
    await animateWithClock(
      PACKET_LOSS.fade * endScale,
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
        ...nodeElement.querySelectorAll(".node-name"),
        ...nodeElement.querySelectorAll(".node-ip"),
      ];
      const textIndex = (index) => (index < textElements.length / 2 ? 0 : 1);
      textElements.forEach((textElement, index) => {
        if (!textElement || textElement.textContent === labelTexts[textIndex(index)]) {
          return;
        }
        textElement.getAnimations().forEach((animation) => animation.cancel());
        textElement.textContent = labelTexts[textIndex(index)];
        if (visibleNodes.has(nodeId) && nodeElement.style.opacity !== "0") {
          textElement.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
        }
      });
    }
  }
  function setUrlText(text, secure) {
    urlBar.classList.toggle("is-secure", !!secure);
    urlText.textContent = text;
    // The bar spans the laptop screen; the check mark sits at its right end.
    urlCheck.setAttribute("transform", `translate(${(SCREEN_WIDTH - 15).toFixed(1)} 0)`);
    urlBox.dataset.width = SCREEN_WIDTH;
  }
  async function typeUrl(text, secure, cancellation) {
    setUrlText(text, secure);
    urlText.textContent = "";
    urlCaret.setAttribute("x", 15);
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
      urlCaret.setAttribute("x", 15.5 + urlText.getComputedTextLength());
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
  Object.keys(linkElements).forEach((linkId) => setLinkProgress(linkId, 0));
  return {
    run(event, cancellation, onArrival, onPacketState, mode) {
      switch (event.type) {
        case "packet":
          return animatePacket(event, cancellation, () => {
            onPacketState(0, "past");
            onArrival();
          }, () => onPacketState(0, "lost"), mode);
        case "stream":
          return animatePacketStream(event, cancellation, onPacketState, mode);
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
    setDevices(lessonId, state, event, running) {
      currentLessonId = lessonId;
      networkSvg.dataset.lesson = lessonId;
      const packet = event?.type === "stream" ? event.packets[0] : event;
      endpointDisplay.update(lessonId, state, lessonId === "ftp" && running ? ftpServerPort(packet) : null);
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
      for (const linkId of Object.keys(linkElements)) {
        const visible = visibleLanes.has(linkId);
        if (visible !== previousSnapshot.lanes.has(linkId)) {
          animateLink(linkId, visible, cancellation, visible ? laneDelay : 0);
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
    clear(immediate = false) {
      delete networkSvg.dataset.certChecks;
      for (const element of [...packetLayer.children, ...noteLayer.children]) {
        if (immediate) {
          element.remove();
          continue;
        }
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
