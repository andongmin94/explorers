// The TypeScript kit must draw exactly what the vanilla kit draws, so a
// ported scene looks the same as the page it replaces.
import assert from "node:assert/strict";
import test from "node:test";

import * as js from "../../../shared/iso-kit.js";
import * as ts from "../iso/kit.ts";

const calls: [string, unknown[]][] = [
  ["box", [{ x: 1, y: 2, z: 0, w: 3, d: 2, h: 1, fill: ts.MAT.metal }]],
  ["chip", [{ x: 9.3, y: 3.8, size: 4.8, label: "CPU", sub: "RR" }]],
  [
    "queueRail",
    [{ x: 0, y: 6, slots: 3, pitch: 1.6, exit: "end", label: "READY", numbers: false }],
  ],
  ["tray", [{ x: 1.4, y: 10.4, slots: 3, pitch: 1.5, d: 2, mat: ts.MAT.plastic, numbers: false }]],
  ["ssd", [{ x: 10.5, y: -3.5, w: 4.6, d: 3, label: "I/O" }]],
  ["bin", [{ x: 16.6, y: 5.2, w: 4.2, d: 3, capacity: 4, label: "DONE" }]],
  ["ramStick", [{ x: 0, y: 0, length: 6, chips: 4 }]],
  ["tableModule", [{ x: 0, y: 0, rows: 4, cols: 2, headers: ["page", "frame"] }]],
  ["hdd", [{ x: 0, y: 0 }]],
  ["server", [{ x: 0, y: 0, units: 3, lit: 2 }]],
  ["laptop", [{ x: 0, y: 0, screen: "GET /" }]],
  ["module", [{ x: 0, y: 0, label: "M", sub: "s" }]],
  [
    "cable",
    [
      [
        [1, 1],
        [1, 5],
        [6, 5],
      ],
      { arrow: true, width: 6 },
    ],
  ],
  [
    "floorPath",
    [
      [
        [0, 0],
        [4, 0],
      ],
      { dashed: true },
    ],
  ],
  ["floor", [{ x: -20, y: -20, w: 62, d: 52 }]],
  ["token", [{ id: "P1", color: "var(--p1)" }]],
  ["led", [{ x: 1, y: 2, z: 0.4, on: true }]],
  ["callout", [{ x: 1, y: 2, z: 0.3, dx: 20, dy: -40, title: "준비 큐", sub: "FIFO" }]],
  [
    "fitScene",
    [
      [
        [0, 0, 0],
        [10, 0, 0],
        [10, 8, 1],
      ],
      { stageAspect: 1.6, fill: 0.9, labels: [[0, 0, 40, 20]] },
    ],
  ],
  ["defs", []],
];

test("every kit builder returns the same SVG as shared/iso-kit.js", () => {
  for (const [name, args] of calls) {
    const a = (js as unknown as Record<string, (...a: unknown[]) => unknown>)[name](...args);
    const b = (ts as unknown as Record<string, (...a: unknown[]) => unknown>)[name](...args);
    assert.deepEqual(b, a, name);
  }
});
