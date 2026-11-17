// Reconstructed from the distributed Protocol Explorer JavaScript.
import { translate } from "../i18n.js";

// Device geometry uses an isometric ground plane. Height is subtracted from SVG
// y so that positive model heights rise above the plane.
const ISO_COS = Math.cos(Math.PI / 6);
const ISO_SIN = 0.5;
const ISO_STROKE_COLOR = "var(--k-line-1b3fae)";
/** Create a local model-to-SVG projection anchored at the given screen point. */
function createIsometricProjection(originX, originY) {
  return (localX, localY, height = 0) => [
    originX + (localX - localY) * ISO_COS,
    originY + (localX + localY) * ISO_SIN - height,
  ];
}
const formatSvgPoint = ([pointX, pointY]) =>
  `${pointX.toFixed(2)},${pointY.toFixed(2)}`;
const svgPolygon = (points, attributes = "") =>
  `<polygon points="${points.map(formatSvgPoint).join(" ")}" ${attributes}/>`;
const svgPolyline = (points, attributes = "") =>
  `<polyline points="${points.map(formatSvgPoint).join(" ")}" fill="none" ${attributes}/>`;
/** Return 2D drawing planes for the three visible faces of an isometric box. */
function createBoxFaces(
  project,
  originX,
  originY,
  baseHeight,
  width,
  depth,
  height,
) {
  return {
    top: (faceX, faceY) =>
      project(originX + faceX, originY + faceY, baseHeight + height),
    left: (faceX, faceHeight) =>
      project(originX + faceX, originY + depth, baseHeight + faceHeight),
    right: (faceX, faceHeight) =>
      project(
        originX + width,
        originY + depth - faceX,
        baseHeight + faceHeight,
      ),
  };
}
const isometricRectangle = (
  project,
  originX,
  originY,
  width,
  depth,
  attributes = "",
) =>
  svgPolygon(
    [
      project(originX, originY),
      project(originX + width, originY),
      project(originX + width, originY + depth),
      project(originX, originY + depth),
    ],
    attributes,
  );
function isometricCircle(project, centerX, centerY, radius, attributes = "") {
  const points = [];
  for (let segmentIndex = 0; segmentIndex < 28; segmentIndex++) {
    const angle = (segmentIndex / 28) * Math.PI * 2;
    points.push(
      project(
        centerX + radius * Math.cos(angle),
        centerY + radius * Math.sin(angle),
      ),
    );
  }
  return svgPolygon(points, attributes);
}
function isometricBox(
  project,
  originX,
  originY,
  baseHeight,
  width,
  depth,
  height,
  style = {},
) {
  const {
    top: topFill = "var(--k-fill-f4f7fe)",
    left: leftFill = "var(--k-fill-e5edfc)",
    right: rightFill = "var(--k-fill-d0def8)",
    stroke: strokeColor = ISO_STROKE_COLOR,
    sw: strokeWidth = 1.7,
  } = style;
  const outlineAttributes = `stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round"`;
  return [
    svgPolygon(
      [
        project(originX, originY, baseHeight + height),
        project(originX + width, originY, baseHeight + height),
        project(originX + width, originY + depth, baseHeight + height),
        project(originX, originY + depth, baseHeight + height),
      ],
      `fill="${topFill}" ${outlineAttributes}`,
    ),
    svgPolygon(
      [
        project(originX, originY + depth, baseHeight),
        project(originX + width, originY + depth, baseHeight),
        project(originX + width, originY + depth, baseHeight + height),
        project(originX, originY + depth, baseHeight + height),
      ],
      `fill="${leftFill}" ${outlineAttributes}`,
    ),
    svgPolygon(
      [
        project(originX + width, originY + depth, baseHeight),
        project(originX + width, originY, baseHeight),
        project(originX + width, originY, baseHeight + height),
        project(originX + width, originY + depth, baseHeight + height),
      ],
      `fill="${rightFill}" ${outlineAttributes}`,
    ),
  ].join("");
}
function isometricGrid(
  project,
  originX,
  originY,
  width,
  depth,
  spacing,
  attributes,
) {
  let markup = "";
  for (let offsetX = spacing; offsetX < width; offsetX += spacing) {
    markup += svgPolyline(
      [
        project(originX + offsetX, originY),
        project(originX + offsetX, originY + depth),
      ],
      attributes,
    );
  }
  for (let offsetY = spacing; offsetY < depth; offsetY += spacing) {
    markup += svgPolyline(
      [
        project(originX, originY + offsetY),
        project(originX + width, originY + offsetY),
      ],
      attributes,
    );
  }
  return markup;
}
const ISO_STROKE = `stroke="${ISO_STROKE_COLOR}"`;
const ISO_OUTLINE = `${ISO_STROKE} stroke-width="1.3" stroke-linejoin="round"`;
const ISO_FACE_GRADIENTS = {
  top: "url(#face-top)",
  left: "url(#face-left)",
  right: "url(#face-right)",
};
const isometricShadow = (
  project,
  originX,
  originY,
  width,
  depth,
  shadowLength,
) =>
  svgPolygon(
    [
      project(originX + width, originY),
      project(originX + width + shadowLength, originY),
      project(originX + width + shadowLength, originY + depth),
      project(originX + width, originY + depth),
    ],
    'class="iso-shadow"',
  );
function drawRouter(originX, originY) {
  const project = createIsometricProjection(originX, originY);
  const bodyWidth = 70;
  const bodyDepth = 70;
  const bodyHeight = 33;
  const faces = createBoxFaces(
    project,
    0,
    0,
    0,
    bodyWidth,
    bodyDepth,
    bodyHeight,
  );
  let markup = isometricShadow(project, 0, 0, bodyWidth, bodyDepth, 34);
  markup += isometricBox(project, 0, 0, 0, bodyWidth, bodyDepth, bodyHeight, {
    ...ISO_FACE_GRADIENTS,
    sw: 2.2,
  });
  const topPorts = [
    [9, 7],
    [19.5, 5],
    [28, 7],
    [39, 5],
  ];
  for (const [portX, portWidth] of topPorts) {
    markup += isometricRectangle(
      faces.top,
      portX,
      30.5,
      portWidth,
      5,
      `fill="var(--k-fill-a9c0ee)" ${ISO_STROKE} stroke-width="1.5"`,
    );
  }
  markup += isometricRectangle(
    faces.top,
    30,
    32,
    3,
    2,
    `fill="${ISO_STROKE_COLOR}" stroke="none"`,
  );
  const leftFace = faces.left;
  markup += isometricCircle(
    leftFace,
    9.5,
    17,
    5,
    `fill="none" ${ISO_STROKE} stroke-width="2.6"`,
  );
  markup += isometricRectangle(
    leftFace,
    17,
    13,
    3.6,
    8,
    `fill="${ISO_STROKE_COLOR}" stroke="none"`,
  );
  markup += isometricRectangle(
    leftFace,
    15.5,
    20,
    6.6,
    2,
    `fill="${ISO_STROKE_COLOR}" stroke="none"`,
  );
  markup += isometricRectangle(
    leftFace,
    15.5,
    11.5,
    6.6,
    2,
    `fill="${ISO_STROKE_COLOR}" stroke="none"`,
  );
  markup += isometricRectangle(
    leftFace,
    30,
    8,
    13,
    11,
    `fill="var(--k-fill-f4f7fe)" ${ISO_STROKE} stroke-width="2"`,
  );
  const rightFace = faces.right;
  markup += isometricRectangle(
    rightFace,
    9,
    9,
    52,
    15,
    `fill="var(--k-fill-e8effd)" ${ISO_STROKE} stroke-width="2"`,
  );
  markup += isometricRectangle(
    rightFace,
    13,
    12,
    44,
    9,
    `fill="var(--k-fill-c4d5f6)" ${ISO_OUTLINE}`,
  );
  for (let ventIndex = 0; ventIndex < 3; ventIndex++) {
    markup += svgPolyline(
      [
        rightFace(16, 14 + ventIndex * 2.6),
        rightFace(54, 14 + ventIndex * 2.6),
      ],
      'stroke="var(--k-line-8ea9e2)" stroke-width="0.9"',
    );
  }
  const [antennaX, antennaY] = faces.top(16, 8);
  markup += `<ellipse cx="${antennaX}" cy="${antennaY}" rx="5.2" ry="2.8" fill="var(--k-fill-c9d8f6)" ${ISO_STROKE} stroke-width="1.5"/>`;
  markup += `<path d="M${antennaX - 3.2},${antennaY} L${antennaX - 1.4},${antennaY - 40} L${antennaX + 1.4},${antennaY - 40} L${antennaX + 3.2},${antennaY} Z" fill="var(--k-fill-c9d8f6)" ${ISO_STROKE} stroke-width="1.6" stroke-linejoin="round"/>`;
  markup += `<circle cx="${antennaX}" cy="${antennaY - 43.5}" r="4" fill="var(--k-fill-f4f7fe)" ${ISO_STROKE} stroke-width="1.8"/>`;
  return `<g class="device router">${markup}</g>`;
}
function drawDnsServer(originX, originY) {
  const project = createIsometricProjection(originX, originY);
  const bodyWidth = 40.5;
  const bodyDepth = 40.5;
  const slabHeight = 13.6;
  const slabGap = 2.9;
  let markup = isometricShadow(project, 0, 0, bodyWidth, bodyDepth, 30);
  markup += isometricBox(
    project,
    1.5,
    1.5,
    0,
    bodyWidth - 3,
    bodyDepth - 3,
    slabHeight * 3 + slabGap * 2,
    {
      top: "var(--k-fill-2f55c2)",
      left: "var(--k-fill-2f55c2)",
      right: "var(--k-fill-24479f)",
    },
  );
  for (let slabIndex = 0; slabIndex < 3; slabIndex++) {
    const baseHeight = slabIndex * (slabHeight + slabGap);
    const faces = createBoxFaces(
      project,
      0,
      0,
      baseHeight,
      bodyWidth,
      bodyDepth,
      slabHeight,
    );
    markup += isometricBox(
      project,
      0,
      0,
      baseHeight,
      bodyWidth,
      bodyDepth,
      slabHeight,
      {
        ...ISO_FACE_GRADIENTS,
        sw: 1.9,
      },
    );
    if (slabIndex === 0) {
      markup += isometricRectangle(
        faces.left,
        4,
        3.8,
        7,
        5.6,
        `fill="var(--k-fill-5ed6ea)" ${ISO_OUTLINE}`,
      );
      markup += isometricRectangle(
        faces.left,
        13,
        3.8,
        9,
        5.6,
        `fill="var(--k-fill-d7e3fa)" ${ISO_OUTLINE}`,
      );
      markup += isometricRectangle(
        faces.left,
        24,
        3.8,
        6,
        5.6,
        `fill="var(--k-fill-5ed6ea)" ${ISO_OUTLINE}`,
      );
    } else {
      markup += isometricRectangle(
        faces.left,
        4,
        3.8,
        27,
        5.6,
        `fill="var(--k-fill-5ed6ea)" ${ISO_OUTLINE}`,
      );
      markup += isometricRectangle(
        faces.left,
        4,
        3.8,
        9,
        5.6,
        'fill="var(--k-fill-a6eef6)" stroke="none"',
      );
    }
    markup += isometricRectangle(
      faces.right,
      4,
      3.8,
      32,
      5.6,
      `fill="var(--k-fill-9fbcf0)" ${ISO_OUTLINE}`,
    );
    if (slabIndex === 2) {
      markup += isometricRectangle(
        faces.top,
        8.5,
        8.5,
        23.5,
        23.5,
        `fill="var(--k-fill-dfe8fb)" ${ISO_STROKE} stroke-width="1.6"`,
      );
      markup += isometricGrid(
        faces.top,
        8.5,
        8.5,
        23.5,
        23.5,
        2.6,
        'stroke="var(--k-line-7d9be0)" stroke-width="0.6"',
      );
    }
  }
  return `<g class="device dns">${markup}</g>`;
}
function drawWebServer(originX, originY) {
  const project = createIsometricProjection(originX, originY);
  const bodyWidth = 56.6;
  const bodyDepth = 56.6;
  const bodyHeight = 70;
  const faces = createBoxFaces(
    project,
    0,
    0,
    0,
    bodyWidth,
    bodyDepth,
    bodyHeight,
  );
  let markup = isometricShadow(project, 0, 0, bodyWidth, bodyDepth, 40);
  markup += isometricBox(project, 0, 0, 0, bodyWidth, bodyDepth, bodyHeight, {
    top: "url(#face-top)",
    left: "var(--k-fill-f4f8ff)",
    right: "url(#face-right)",
    sw: 2.3,
  });
  markup += isometricRectangle(
    faces.top,
    10,
    10,
    37,
    37,
    `fill="var(--k-fill-c9d8f4)" ${ISO_STROKE} stroke-width="1.2"`,
  );
  for (let ventOffset = 2.2; ventOffset < 37; ventOffset += 2.2) {
    markup += svgPolyline(
      [faces.top(10 + ventOffset, 10), faces.top(10 + ventOffset, 47)],
      'stroke="var(--k-line-9db5e6)" stroke-width="0.7"',
    );
  }
  const leftFace = faces.left;
  for (let bayIndex = 0; bayIndex < 3; bayIndex++) {
    const bayHeight = 6 + bayIndex * 20.5;
    markup += isometricRectangle(
      leftFace,
      4.5,
      bayHeight,
      47.5,
      17,
      `fill="var(--k-fill-f5f8ff)" ${ISO_STROKE} stroke-width="2"`,
    );
    markup += isometricRectangle(
      leftFace,
      7.5,
      bayHeight + 3,
      41.5,
      11,
      `fill="var(--k-fill-e3ebfc)" ${ISO_OUTLINE}`,
    );
    const ports = [
      [10, 5],
      [16, 3],
      [21, 3],
      [36, 3.4],
    ];
    for (const [portX, portWidth] of ports) {
      markup += isometricRectangle(
        leftFace,
        portX,
        bayHeight + 5,
        portWidth,
        7,
        'fill="var(--k-fill-3d63c9)" stroke="none"',
      );
    }
    markup += isometricRectangle(
      leftFace,
      26,
      bayHeight + 6,
      7,
      5,
      'fill="var(--k-fill-a7bff0)" stroke="none"',
    );
  }
  const rightFace = faces.right;
  const circuitAttributes = `fill="none" ${ISO_STROKE} stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"`;
  markup += isometricRectangle(
    rightFace,
    8,
    34,
    40,
    27,
    `fill="var(--k-fill-c7d8f7)" ${circuitAttributes}`,
  );
  markup += svgPolyline(
    [rightFace(8, 52), rightFace(30, 52), rightFace(30, 46), rightFace(48, 46)],
    circuitAttributes,
  );
  markup += svgPolyline(
    [rightFace(14, 40), rightFace(26, 40), rightFace(26, 34)],
    circuitAttributes,
  );
  markup += svgPolyline(
    [rightFace(36, 61), rightFace(36, 54), rightFace(44, 54)],
    circuitAttributes,
  );
  markup += isometricRectangle(
    rightFace,
    8,
    9,
    16,
    15,
    `fill="var(--k-fill-c7d8f7)" ${circuitAttributes}`,
  );
  markup += isometricRectangle(
    rightFace,
    30,
    9,
    16,
    15,
    `fill="var(--k-fill-c7d8f7)" ${circuitAttributes}`,
  );
  markup += svgPolyline(
    [rightFace(30, 19), rightFace(36, 19), rightFace(36, 24)],
    circuitAttributes,
  );
  markup += `<circle cx="${rightFace(47, 1)[0]}" cy="${rightFace(47, 1)[1]}" r="2.6" fill="${ISO_STROKE_COLOR}"/>`;
  return `<g class="device web">${markup}</g>`;
}
function drawClientLaptop(originX, originY) {
  const project = createIsometricProjection(originX, originY);
  const baseWidth = 56;
  const baseDepth = 86;
  const baseHeight = 5;
  const faces = createBoxFaces(
    project,
    0,
    0,
    0,
    baseWidth,
    baseDepth,
    baseHeight,
  );
  let markup = isometricShadow(project, -4, 0, baseWidth + 4, baseDepth, 30);
  markup += svgPolygon(
    [
      project(-4, baseDepth),
      project(baseWidth, baseDepth),
      project(baseWidth + 10, baseDepth + 8),
      project(-4, baseDepth + 8),
    ],
    'class="iso-shadow"',
  );
  const screenHeight = 64;
  const screenTilt = 3;
  const screenOffsetY = 3;
  const screenWidth = 82;
  // The screen tilts independently of the keyboard's ground-plane projection.
  const createScreenProjection = (screenOffsetX) => (screenX, screenZ) =>
    project(
      screenOffsetX - (screenTilt * screenZ) / screenHeight,
      screenOffsetY + screenWidth - screenX,
      baseHeight + screenZ,
    );
  const backScreen = createScreenProjection(-7);
  const frontScreen = createScreenProjection(0);
  const screenRectangle = (project, screenX, screenY, width, height) => [
    project(screenX, screenY),
    project(screenX + width, screenY),
    project(screenX + width, screenY + height),
    project(screenX, screenY + height),
  ];
  markup += svgPolygon(
    screenRectangle(backScreen, 0, 0, screenWidth, screenHeight),
    `fill="var(--k-fill-e2ebfc)" ${ISO_STROKE} stroke-width="2" stroke-linejoin="round"`,
  );
  markup += svgPolygon(
    [
      backScreen(0, 0),
      frontScreen(0, 0),
      frontScreen(0, screenHeight),
      backScreen(0, screenHeight),
    ],
    `fill="var(--k-fill-cddcf8)" ${ISO_STROKE} stroke-width="1.6" stroke-linejoin="round"`,
  );
  markup += svgPolygon(
    [
      backScreen(0, screenHeight),
      frontScreen(0, screenHeight),
      frontScreen(screenWidth, screenHeight),
      backScreen(screenWidth, screenHeight),
    ],
    `fill="var(--k-fill-cddcf8)" ${ISO_STROKE} stroke-width="1.6" stroke-linejoin="round"`,
  );
  markup += svgPolygon(
    screenRectangle(frontScreen, 0, 0, screenWidth, screenHeight),
    `fill="var(--k-fill-f4f7fe)" ${ISO_STROKE} stroke-width="2" stroke-linejoin="round"`,
  );
  markup += svgPolygon(
    screenRectangle(frontScreen, 4.5, 5, screenWidth - 9, screenHeight - 9.5),
    `fill="var(--k-fill-dce6fb)" ${ISO_STROKE} stroke-width="1.5" stroke-linejoin="round"`,
  );
  markup += svgPolygon(
    screenRectangle(frontScreen, 4.5, screenHeight - 14, screenWidth - 9, 9.5),
    `fill="var(--k-fill-f2f6fe)" ${ISO_STROKE} stroke-width="1.2" stroke-linejoin="round"`,
  );
  markup += svgPolyline(
    [frontScreen(9, screenHeight - 9.3), frontScreen(24, screenHeight - 9.3)],
    'stroke="var(--k-line-9db5e8)" stroke-width="2.2" stroke-linecap="round"',
  );
  markup += '<g class="screen-content">';
  markup += svgPolygon(
    screenRectangle(frontScreen, 10, 13, 22, 24),
    'fill="var(--k-fill-a9c0ec)" stroke="none"',
  );
  for (let lineIndex = 0; lineIndex < 4; lineIndex++) {
    markup += svgPolyline(
      [
        frontScreen(38, 33 - lineIndex * 6),
        frontScreen(68, 33 - lineIndex * 6),
      ],
      'stroke="var(--k-line-a9c0ec)" stroke-width="3.2" stroke-linecap="round" pathLength="1"',
    );
  }
  markup += "</g>";
  markup += isometricBox(project, 0, 0, 0, baseWidth, baseDepth, baseHeight, {
    top: "var(--k-fill-f5f8ff)",
    left: "var(--k-fill-dfe8fc)",
    right: "var(--k-fill-cddcf8)",
    sw: 2.1,
  });
  const keyboardFace = faces.top;
  markup += isometricRectangle(
    keyboardFace,
    6,
    9,
    27,
    68,
    `fill="var(--k-fill-dce7fb)" ${ISO_STROKE} stroke-width="1.6"`,
  );
  for (let keyColumnX = 6 + 5.4; keyColumnX < 33; keyColumnX += 5.4) {
    markup += svgPolyline(
      [keyboardFace(keyColumnX, 9), keyboardFace(keyColumnX, 77)],
      `stroke="${ISO_STROKE_COLOR}" stroke-width="0.9"`,
    );
  }
  for (let keyRowY = 9 + 4.85; keyRowY < 77; keyRowY += 4.85) {
    markup += svgPolyline(
      [keyboardFace(6, keyRowY), keyboardFace(33, keyRowY)],
      `stroke="${ISO_STROKE_COLOR}" stroke-width="0.9"`,
    );
  }
  markup += isometricRectangle(
    keyboardFace,
    38,
    28,
    13,
    30,
    `fill="var(--k-fill-c3d4f5)" ${ISO_OUTLINE}`,
  );
  return `<g class="device laptop">${markup}</g>`;
}
function drawInternetCloud(originX, originY) {
  const lobes = [
    [-60, 10, 21],
    [-32, -16, 20],
    [-6, -36, 17],
    [22, -36, 26],
    [46, -16, 20],
    [58, 3, 22],
    [40, 22, 24],
    [-24, 24, 24],
    [8, 2, 32],
    [-20, 6, 26],
  ];
  const renderCloudCircles = (attributes, translateX = 0, translateY = 0) =>
    lobes
      .map(
        ([offsetX, offsetY, radius]) =>
          `<circle cx="${originX + offsetX + translateX}" cy="${originY + offsetY + translateY}" r="${radius}" ${attributes}/>`,
      )
      .join("");
  const globeX = originX + 20;
  const globeY = originY;
  const globeRadius = 19.5;
  return `<g class="device cloud">
    <clipPath id="cloud-clip">${renderCloudCircles("")}</clipPath>
    <ellipse cx="${originX + 12}" cy="${originY + 44}" rx="80" ry="10" class="iso-shadow round"/>
    ${renderCloudCircles(`fill="var(--k-fill-fdfdff)" ${ISO_STROKE} stroke-width="4.6"`)}
    <g clip-path="url(#cloud-clip)">
      ${renderCloudCircles('fill="var(--k-fill-e3eaf8)"')}
      ${renderCloudCircles('fill="var(--k-fill-fdfdff)"', 3, -4)}
    </g>
    <g fill="none" ${ISO_STROKE} stroke-width="2.4" stroke-linecap="round">
      <circle cx="${globeX}" cy="${globeY}" r="${globeRadius}" fill="var(--k-fill-fdfdff)"/>
      <ellipse cx="${globeX}" cy="${globeY}" rx="8.5" ry="${globeRadius}"/>
      <line x1="${globeX}" y1="${globeY - globeRadius}" x2="${globeX}" y2="${globeY + globeRadius}"/>
      <path d="M${globeX - globeRadius},${globeY} H${globeX + globeRadius}"/>
      <path d="M${globeX - 16},${globeY - 10} Q${globeX},${globeY - 5} ${globeX + 16},${globeY - 10} M${globeX - 16},${globeY + 10} Q${globeX},${globeY + 15} ${globeX + 16},${globeY + 10}"/>
    </g>
  </g>`;
}
const NETWORK_VIEWBOX = [45, 66, 810, 490];
const NETWORK_GRID_CENTER = [450, 311];
const NETWORK_BACKGROUND_BOUNDS =
  'x="-500" y="-500" width="1900" height="1500"';
const PACKET_COLORS = {
  idle: "var(--k-line-bccae6)",
  navy: "#0b3aa8",
  blue: "#1f6fe8",
  green: "#12a56b",
  amber: "#f2ac0a",
  violet: "#7656e0",
  teal: "#0e95a3",
  slate: "#5d6f95",
};
/** Offset opposite directions perpendicular to a shared link to avoid overlap. */
function createBidirectionalLanes(
  fromNode,
  toNode,
  [startX, startY],
  [endX, endY],
  separation = 5.5,
) {
  const distance = Math.hypot(endX - startX, endY - startY);
  const offsetX = (-(endY - startY) / distance) * separation;
  const offsetY = ((endX - startX) / distance) * separation;
  return {
    [`${fromNode}>${toNode}`]: [
      startX + offsetX,
      startY + offsetY,
      endX + offsetX,
      endY + offsetY,
    ],
    [`${toNode}>${fromNode}`]: [
      endX - offsetX,
      endY - offsetY,
      startX - offsetX,
      startY - offsetY,
    ],
  };
}
// Each lane is [startX, startY, endX, endY] in the network SVG's coordinates.
const NETWORK_LANES = {
  "client>router": [262, 430, 371, 383],
  "router>client": [376, 355, 268, 403],
  "router>internet": [508.4, 357.1, 668.4, 434.8],
  "internet>router": [663.6, 444.6, 503.6, 366.9],
  "internet>dns": [690, 418, 690, 231],
  "dns>internet": [712, 229, 712, 404],
  "internet>web": [776, 418, 776, 254],
  "web>internet": [797, 264, 797, 438],
  ...createBidirectionalLanes("internet", "root", [799, 432], [928, 316]),
  ...createBidirectionalLanes("internet", "tld", [812, 457], [968, 440]),
  ...createBidirectionalLanes("internet", "auth", [796, 492], [925, 580]),
  ...createBidirectionalLanes("internet", "mx", [812, 455], [956, 395]),
};
// Logical packet endpoints expand to the physical lanes traversed in order.
const NETWORK_ROUTES = {
  "client>dns": ["client>router", "router>internet", "internet>dns"],
  "dns>client": ["dns>internet", "internet>router", "router>client"],
  "client>web": ["client>router", "router>internet", "internet>web"],
  "web>client": ["web>internet", "internet>router", "router>client"],
  "dns>root": ["dns>internet", "internet>root"],
  "root>dns": ["root>internet", "internet>dns"],
  "dns>tld": ["dns>internet", "internet>tld"],
  "tld>dns": ["tld>internet", "internet>dns"],
  "dns>auth": ["dns>internet", "internet>auth"],
  "auth>dns": ["auth>internet", "internet>dns"],
  "client>router": ["client>router"],
  "router>client": ["router>client"],
  "client>internet": ["client>router", "router>internet"],
  "internet>client": ["internet>router", "router>client"],
  "router>web": ["router>internet", "internet>web"],
  "web>router": ["web>internet", "internet>router"],
  "web>dns": ["web>internet", "internet>dns"],
  "dns>web": ["dns>internet", "internet>web"],
  "web>mx": ["web>internet", "internet>mx"],
  "mx>web": ["mx>internet", "internet>web"],
};
const NETWORK_NODE_LABELS = {
  internet: ["Internet", ""],
  client: ["Client", "192.168.1.10"],
  router: ["Router", "192.168.1.1"],
  dns: ["DNS Resolver", "8.8.8.8"],
  web: ["Web Server", "203.0.113.10"],
  root: ["Root Server", "198.41.0.4"],
  tld: [".com TLD Server", "192.5.6.30"],
  auth: ["Authoritative Server", "198.51.100.53"],
  mx: ["Mail Server", "198.51.100.25"],
};
const NETWORK_SHORT_LABELS = {
  client: "Client",
  router: "Router",
  dns: "DNS Resolver",
  internet: "Internet",
  web: "Web Server",
  root: "Root Server",
  tld: ".com Server",
  auth: "Authoritative",
  mx: "Mail Server",
};
const INTERNET_POSITION = [728, 460];
const DNS_POSITION = [701, 185];
const WEB_SERVER_POSITION = [812, 203];
const ROOT_SERVER_POSITION = [960, 300];
const TLD_SERVER_POSITION = [1005, 430];
const AUTH_SERVER_POSITION = [960, 575];
const MAIL_SERVER_POSITION = [1010, 380];
const NETWORK_NODE_CENTERS = {
  client: [214, 446],
  dns: [701, 180],
  router: [440, 360],
  internet: [732, 458],
  web: [812, 206],
  root: [960, 296],
  tld: [1005, 426],
  auth: [960, 571],
  mx: [1010, 378],
};
const NETWORK_NOTE_ANCHORS = {
  client: {
    x: 205,
    y: 372,
    side: "top",
  },
  router: {
    x: 440,
    y: 290,
    side: "top",
  },
  web: {
    x: 758,
    y: 200,
    side: "left",
  },
  dns: {
    x: 662,
    y: 212,
    side: "left",
  },
  internet: {
    x: 732,
    y: 396,
    side: "top",
  },
  mx: {
    x: 955,
    y: 345,
    side: "left",
  },
};
const NETWORK_FOCUS_GROUPS = {
  client: ["client"],
  local: ["client", "router"],
  lookup: ["client", "router", "internet", "dns"],
  root: ["client", "router", "internet", "dns", "root"],
  tld: ["client", "router", "internet", "dns", "root", "tld"],
  path: ["client", "router", "internet", "web"],
  mailhost: ["client", "router", "internet", "dns", "web"],
  servers: ["internet", "dns", "web", "mx"],
  full: [
    "client",
    "router",
    "dns",
    "internet",
    "web",
    "root",
    "tld",
    "auth",
    "mx",
  ],
};
const renderNodeLabel = (
  positionX,
  positionY,
  name,
  address,
  textAnchor = "start",
  scaleOrigin = "left-bottom",
) =>
  `<g class="node-label" data-origin="${scaleOrigin}"><text class="node-name" x="${positionX}" y="${positionY}" text-anchor="${textAnchor}">${translate(name)}</text>` +
  (address
    ? `<text class="node-ip" x="${positionX}" y="${positionY + 18}" text-anchor="${textAnchor}">${address}</text>`
    : "") +
  "</g>";
function renderNetworkDefs() {
  const renderArrowMarker = (
    color,
  ) => `<marker id="head-${color}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6.2" markerHeight="6.2" orient="auto-start-reverse">
       <path d="M0,0.6 L10,5 L0,9.4 Z" fill="${PACKET_COLORS[color]}"/></marker>`;
  return `<defs>
    ${Object.keys(PACKET_COLORS).map(renderArrowMarker).join("")}
    <pattern id="iso-grid" width="62.354" height="36" patternUnits="userSpaceOnUse" x="9" y="4">
      <path d="M0,0 L62.354,36 M62.354,0 L0,36" stroke="var(--k-line-e4eaf5)" stroke-width="1"/>
    </pattern>
    <!-- the grid fades into the panel towards the edges -->
    <radialGradient id="grid-vignette" gradientUnits="userSpaceOnUse" cx="${NETWORK_GRID_CENTER[0]}" cy="${NETWORK_GRID_CENTER[1]}" r="560">
      <stop offset="0" stop-color="var(--k-fill-fefeff)" stop-opacity="0"/>
      <stop offset="0.6" stop-color="var(--k-fill-fefeff)" stop-opacity="0.4"/>
      <stop offset="1" stop-color="var(--k-fill-fefeff)" stop-opacity="1"/>
    </radialGradient>
    <!-- soft ground shadows, darkest against the device -->
    <linearGradient id="shadow-fade" x1="0" y1="0.25" x2="1" y2="0.75">
      <stop offset="0" stop-color="var(--k-shadow-8d9ab3)" stop-opacity="0.3"/>
      <stop offset="1" stop-color="var(--k-shadow-8d9ab3)" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="shadow-round">
      <stop offset="0" stop-color="var(--k-shadow-8d9ab3)" stop-opacity="0.26"/>
      <stop offset="1" stop-color="var(--k-shadow-8d9ab3)" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="face-top" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="var(--k-fill-f8fbff)"/><stop offset="1" stop-color="var(--k-fill-e6eefc)"/>
    </linearGradient>
    <linearGradient id="face-left" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="var(--k-fill-eff5ff)"/><stop offset="1" stop-color="var(--k-fill-dae5fb)"/>
    </linearGradient>
    <linearGradient id="face-right" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="var(--k-fill-e0eafc)"/><stop offset="1" stop-color="var(--k-fill-c7d7f6)"/>
    </linearGradient>
  </defs>`;
}
const URL_BAR_SVG = `
  <g class="url-holder" transform="translate(60 334)"><g class="url-bar">
    <path d="M128 26 L140 58" class="url-leader"/>
    <rect class="url-box" width="168" height="26" rx="3"/>
    <g class="url-globe" transform="translate(9 6)">
      <circle cx="7" cy="7" r="6"/><ellipse cx="7" cy="7" rx="2.6" ry="6"/><path d="M1.4 5h11.2M1.4 9h11.2"/>
    </g>
    <g class="url-lock" transform="translate(10 5)">
      <path d="M3 7 V4.6 a3.5 3.5 0 0 1 7 0 V7"/><rect x="1" y="7" width="11" height="8" rx="1.6"/>
    </g>
    <text class="url-text" x="29" y="17.5"></text>
    <rect class="url-caret" x="29" y="6.5" width="1.6" height="13"/>
    <path class="url-check" d="M0 13.5 l3.5 3.5 l6.5 -7" pathLength="1"/>
  </g></g>`;
const renderNetworkNode = (nodeId, markup) =>
  `<g class="node" data-node="${nodeId}">${markup}</g>`;
/** Render the static scene; network-animation.js controls its nodes and layers. */
function renderNetworkDiagram() {
  const lanesMarkup = Object.entries(NETWORK_LANES)
    .map(([laneId, coordinates]) => {
      const [startX, startY, endX, endY] = coordinates.map((coordinate) =>
        coordinate.toFixed(1),
      );
      return `<path class="lane" data-lane="${laneId}" d="M${startX},${startY} L${endX},${endY}" marker-end="url(#head-idle)"/>`;
    })
    .join("");
  return `
  <svg class="network is-booting" viewBox="${NETWORK_VIEWBOX.join(" ")}" preserveAspectRatio="xMidYMid meet" data-t-label="Network diagram" aria-label="${translate("Network diagram")}">
    ${renderNetworkDefs()}
    <rect ${NETWORK_BACKGROUND_BOUNDS} fill="url(#iso-grid)"/>
    <rect ${NETWORK_BACKGROUND_BOUNDS} fill="url(#grid-vignette)"/>
    <g class="lanes">${lanesMarkup}</g>
    <g class="pulse-layer"></g>
    ${renderNetworkNode("internet", drawInternetCloud(...INTERNET_POSITION) + renderNodeLabel(INTERNET_POSITION[0] - 2, 524, ...NETWORK_NODE_LABELS.internet, "start", "center-top"))}
    ${renderNetworkNode("client", drawClientLaptop(240, 446) + renderNodeLabel(73, 494, ...NETWORK_NODE_LABELS.client, "start", "right-top") + URL_BAR_SVG)}
    ${renderNetworkNode("router", drawRouter(440, 339) + renderNodeLabel(407, 426, ...NETWORK_NODE_LABELS.router, "start", "left-top"))}
    ${renderNetworkNode("dns", drawDnsServer(...DNS_POSITION) + renderNodeLabel(654, 160, ...NETWORK_NODE_LABELS.dns, "end", "right-bottom"))}
    ${renderNetworkNode("web", drawWebServer(...WEB_SERVER_POSITION) + renderNodeLabel(773, 106, ...NETWORK_NODE_LABELS.web))}
    ${renderNetworkNode("root", drawDnsServer(...ROOT_SERVER_POSITION) + renderNodeLabel(925, 228, ...NETWORK_NODE_LABELS.root))}
    ${renderNetworkNode("tld", drawDnsServer(...TLD_SERVER_POSITION) + renderNodeLabel(970, 360, ...NETWORK_NODE_LABELS.tld))}
    ${renderNetworkNode("auth", drawDnsServer(...AUTH_SERVER_POSITION) + renderNodeLabel(925, 505, ...NETWORK_NODE_LABELS.auth))}
    ${renderNetworkNode("mx", drawWebServer(...MAIL_SERVER_POSITION) + renderNodeLabel(968, 286, ...NETWORK_NODE_LABELS.mx))}
    <g class="packet-layer"></g>
    <g class="note-layer"></g>
  </svg>`;
}
export {
  NETWORK_FOCUS_GROUPS,
  NETWORK_LANES,
  NETWORK_NODE_CENTERS,
  NETWORK_NODE_LABELS,
  NETWORK_NOTE_ANCHORS,
  NETWORK_ROUTES,
  NETWORK_SHORT_LABELS,
  PACKET_COLORS,
  renderNetworkDiagram,
};
