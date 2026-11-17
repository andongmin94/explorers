// All physical parts use one orthographic camera: 30° on each ground axis.
const COS = Math.sqrt(3) / 2;
const SIN = 0.5;
const number = (value) => Number(value.toFixed(2));
const project = (origin, u, v, z = 0) => [
  origin.x + (u - v) * COS,
  origin.y + (u + v) * SIN - z,
];
const points = (vertices) =>
  vertices.map(([x, y]) => `${number(x)},${number(y)}`).join(" ");

function face(origin, vertices, className, attributes = "") {
  return `<polygon class="${className}" points="${points(vertices.map((vertex) => project(origin, ...vertex)))}" ${attributes}/>`;
}

function box(origin, { u0, u1, v0, v1, z0, z1 }, prefix = "device") {
  return [
    face(
      origin,
      [
        [u0, v1, z1],
        [u1, v1, z1],
        [u1, v1, z0],
        [u0, v1, z0],
      ],
      `${prefix}-front`,
    ),
    face(
      origin,
      [
        [u1, v0, z1],
        [u1, v1, z1],
        [u1, v1, z0],
        [u1, v0, z0],
      ],
      `${prefix}-side`,
    ),
    face(
      origin,
      [
        [u0, v0, z1],
        [u1, v0, z1],
        [u1, v1, z1],
        [u0, v1, z1],
      ],
      `${prefix}-top`,
    ),
  ].join("");
}

function line(origin, vertices, className = "device-trace") {
  return `<polyline class="${className}" points="${points(vertices.map((vertex) => project(origin, ...vertex)))}" fill="none"/>`;
}

function shadow(origin, corners, dx = 5, dy = 4) {
  return `<polygon class="device-shadow" points="${points(
    corners.map((vertex) => {
      const [x, y] = project(origin, ...vertex);
      return [x + dx, y + dy];
    }),
  )}"/>`;
}

function engraving(origin, u, v, z, text, size) {
  const [x, y] = project(origin, u, v, z);
  return `<text class="device-engraving" transform="matrix(${COS} ${SIN} ${-COS} ${SIN} ${number(x)} ${number(y)})" x="0" y="${number(size * 0.32)}" text-anchor="middle" font-size="${number(size)}">${text}</text>`;
}

function bolt(origin, u, v, z, radius = 2.2) {
  const [x, y] = project(origin, u, v, z);
  return `<g transform="matrix(${COS} ${SIN} ${-COS} ${SIN} ${number(x)} ${number(y)})"><circle class="device-bolt" r="${radius}"/><path class="device-trace" d="M${-radius * 0.55} 0H${radius * 0.55}" fill="none"/></g>`;
}

export function cpuDrawing({ x, y, width }) {
  const origin = { x, y: y + 10 };
  const socket = (width * 0.88) / (4 * COS);
  const chip = (width * 0.7) / (4 * COS);
  const die = chip * 0.53;
  const chipHeight = 19;
  const pins = [];

  for (let edge = 0; edge < 4; edge++) {
    for (let index = 0; index < 7; index++) {
      const center = chip * (-0.78 + index * 0.26);
      const half = chip * 0.055;
      const inner = chip * 0.94;
      const outer = socket * 0.92;
      let bounds;
      if (edge === 0)
        bounds = { u0: inner, u1: outer, v0: center - half, v1: center + half };
      if (edge === 1)
        bounds = {
          u0: -outer,
          u1: -inner,
          v0: center - half,
          v1: center + half,
        };
      if (edge === 2)
        bounds = { u0: center - half, u1: center + half, v0: inner, v1: outer };
      if (edge === 3)
        bounds = {
          u0: center - half,
          u1: center + half,
          v0: -outer,
          v1: -inner,
        };
      pins.push(
        `<g class="device-metal">${box(origin, { ...bounds, z0: 0, z1: 2 })}</g>`,
      );
    }
  }

  const traces = [-1, 1]
    .flatMap((sign) =>
      [-0.52, 0, 0.52].flatMap((offset) => [
        line(origin, [
          [sign * chip * 0.92, offset * chip, chipHeight + 0.2],
          [sign * chip * 0.72, offset * chip, chipHeight + 0.2],
          [sign * chip * 0.72, offset * die, chipHeight + 0.2],
          [sign * die, offset * die, chipHeight + 0.2],
        ]),
        line(origin, [
          [offset * chip, sign * chip * 0.92, chipHeight + 0.2],
          [offset * chip, sign * chip * 0.72, chipHeight + 0.2],
          [offset * die, sign * chip * 0.72, chipHeight + 0.2],
          [offset * die, sign * die, chipHeight + 0.2],
        ]),
      ]),
    )
    .join("");

  const back = project(origin, -chip, -chip, chipHeight);
  return `<g class="scene-chip">
    ${shadow(
      origin,
      [
        [-socket, -socket, -6],
        [socket, -socket, -6],
        [socket, socket, -6],
        [-socket, socket, -6],
      ],
      width * 0.025,
      4,
    )}
    <g class="device-socket">${box(origin, { u0: -socket, u1: socket, v0: -socket, v1: socket, z0: -6, z1: 0 })}</g>
    ${[-1, 1].flatMap((u) => [-1, 1].map((v) => bolt(origin, u * socket * 0.85, v * socket * 0.85, 0.4, 1.7))).join("")}
    ${pins.join("")}
    ${box(origin, { u0: -chip, u1: chip, v0: -chip, v1: chip, z0: 0, z1: chipHeight })}
    ${traces}
    ${face(
      origin,
      [
        [-die, -die, chipHeight + 0.5],
        [die, -die, chipHeight + 0.5],
        [die, die, chipHeight + 0.5],
        [-die, die, chipHeight + 0.5],
      ],
      "cpu-die",
    )}
    ${engraving(origin, 0, 0, chipHeight + 1, "CPU", Math.max(15, width * 0.095))}
    ${face(
      origin,
      [
        [-chip * 0.93, chip * 0.93, chipHeight + 0.6],
        [-chip * 0.93, chip * 0.7, chipHeight + 0.6],
        [-chip * 0.7, chip * 0.93, chipHeight + 0.6],
      ],
      "device-port",
    )}
    <path class="cpu-dock" d="M${number(back[0])} ${number(back[1] - 15)}V${number(back[1] - 2)}"/>
  </g>`;
}

export function memoryDrawing({ x, y, width, height }) {
  const length = (width * 0.78) / COS;
  const boardHeight = height - 27 - length * SIN;
  const thickness = 4 / COS;
  const origin = { x: x + 6, y: y + height - 18 };
  const base = {
    u0: -2 / COS,
    u1: 12 / COS,
    v0: -length - 3,
    v1: 3,
    z0: -5,
    z1: 0,
  };
  const chips = Array.from({ length: 4 }, (_, index) => {
    const start = -length * 0.93 + index * length * 0.23;
    return box(
      origin,
      {
        u0: thickness,
        u1: thickness + 5 / COS,
        v0: start,
        v1: start + length * 0.155,
        z0: boardHeight * 0.24,
        z1: boardHeight * 0.82,
      },
      "memory-chip",
    );
  }).join("");
  const contacts = Array.from({ length: 18 }, (_, index) => {
    const start = -length * 0.96 + index * length * 0.052;
    return face(
      origin,
      [
        [thickness + 0.2, start, 0.7],
        [thickness + 0.2, start + length * 0.032, 0.7],
        [thickness + 0.2, start + length * 0.032, 5],
        [thickness + 0.2, start, 5],
      ],
      "device-contact",
    );
  }).join("");

  return `<g class="scene-memory">
    ${shadow(
      origin,
      [
        [base.u0, base.v0, -5],
        [base.u1, base.v0, -5],
        [base.u1, base.v1, -5],
        [base.u0, base.v1, -5],
      ],
      width * 0.025,
      3,
    )}
    <g class="device-socket">${box(origin, base)}</g>
    ${face(
      origin,
      [
        [0, -length - 1, 0.2],
        [thickness + 1, -length - 1, 0.2],
        [thickness + 1, 1, 0.2],
        [0, 1, 0.2],
      ],
      "device-port",
    )}
    ${box(origin, { u0: 0, u1: thickness, v0: -length, v1: 0, z0: 0, z1: boardHeight })}
    ${line(origin, [
      [thickness + 0.1, -length * 0.98, boardHeight * 0.12],
      [thickness + 0.1, -length * 0.02, boardHeight * 0.12],
    ])}
    ${contacts}
    ${chips}
    ${[-length - 2, -1].map((v) => box(origin, { u0: -1 / COS, u1: 11 / COS, v0: v, v1: v + 3, z0: 0, z1: 7 })).join("")}
  </g>`;
}

export function ssdDrawing({ x, y, width }) {
  const total = (width * 0.94) / COS;
  const long = (total * 1.7) / 2.7 / 2;
  const short = total / 2.7 / 2;
  const depth = Math.min(12, width * 0.075);
  const origin = { x, y: y + depth };
  const top = depth;
  const label = { u: long * 0.73, v: short * 0.69 };
  const connectorV = short * 0.56;

  return `<g class="scene-ssd">
    ${shadow(
      origin,
      [
        [-long, -short, 0],
        [long, -short, 0],
        [long, short, 0],
        [-long, short, 0],
      ],
      width * 0.025,
      4,
    )}
    ${box(origin, { u0: -long, u1: long, v0: -short, v1: short, z0: 0, z1: top })}
    ${line(
      origin,
      [
        [-long * 0.95, -short * 0.95, top + 0.2],
        [long * 0.95, -short * 0.95, top + 0.2],
        [long * 0.95, short * 0.95, top + 0.2],
        [-long * 0.95, short * 0.95, top + 0.2],
        [-long * 0.95, -short * 0.95, top + 0.2],
      ],
      "device-edge",
    )}
    ${face(
      origin,
      [
        [-label.u, -label.v, top + 0.4],
        [label.u, -label.v, top + 0.4],
        [label.u, label.v, top + 0.4],
        [-label.u, label.v, top + 0.4],
      ],
      "ssd-label",
    )}
    ${engraving(origin, -long * 0.04, 0, top + 0.8, "SSD", Math.max(15, width * 0.115))}
    ${[-1, 1].flatMap((u) => [-1, 1].map((v) => bolt(origin, u * long * 0.84, v * short * 0.81, top + 0.5, 2))).join("")}
    ${face(
      origin,
      [
        [long + 0.1, -connectorV, depth * 0.22],
        [long + 0.1, connectorV, depth * 0.22],
        [long + 0.1, connectorV, depth * 0.73],
        [long + 0.1, -connectorV, depth * 0.73],
      ],
      "device-port",
    )}
    ${Array.from({ length: 6 }, (_, index) => {
      const v = -connectorV * 0.82 + index * connectorV * 0.328;
      return line(
        origin,
        [
          [long + 0.2, v, depth * 0.28],
          [long + 0.2, v, depth * 0.64],
        ],
        "ssd-contact",
      );
    }).join("")}
  </g>`;
}
