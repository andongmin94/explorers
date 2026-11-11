import assert from "node:assert/strict";
import test from "node:test";
import { createLessonPlayer } from "../src/simulation/player.js";
import { animateWithClock, playbackClock } from "../src/simulation/clock.js";
import { lessonsById } from "../src/lessons/index.js";

test("DHCP assigns the address on ACK completion and restores it when seeking", async () => {
  let finish, state;
  const renderer = {
    clear() {}, snapshot() {}, overview() {}, morph() {}, apply() {},
    run: () => new Promise((resolve) => { finish = resolve; }),
  };
  const player = createLessonPlayer(lessonsById.dhcp, renderer, (s) => { state = s; });
  const go = async (index) => {
    player.jump(index);
    player.pause();
    await Promise.resolve();
    return state.labels.client[1];
  };
  try {
    assert.equal(await go(4), "Unassigned (0.0.0.0)");
    assert.equal(state.event.label, "ACK");
    finish();
    await new Promise(setImmediate);
    assert.equal(state.labels.client[1], "192.168.1.10/24");
    assert.equal(await go(5), "192.168.1.10/24");
    assert.equal(await go(2), "Unassigned (0.0.0.0)");
    player.reset();
    await Promise.resolve();
    assert.equal(state.labels.client[1], "Unassigned (0.0.0.0)");
  } finally {
    player.dispose();
  }
});

test("a file close reaches the data port without closing FTP control; seeking restores both ports", async () => {
  let finish, arrive, state;
  const renderer = {
    clear() {}, snapshot() {}, overview() {}, morph() {}, apply() {},
    run: (_event, _token, landed) => new Promise((resolve) => { finish = resolve; arrive = landed; }),
  };
  const player = createLessonPlayer(lessonsById.ftp, renderer, (snapshot) => { state = snapshot; });
  try {
    player.jump(4);
    player.pause();
    await Promise.resolve();
    assert.equal(state.event.type, "stream");
    assert.equal(state.devices.data, "open");
    finish();
    await new Promise(setImmediate);
    player.step();
    await Promise.resolve();
    assert.equal(state.event.label, "FIN");
    assert.equal(state.devices.data, "open");
    arrive();
    await Promise.resolve();
    assert.equal(state.devices.data, "closed");
    assert.equal(state.devices.control, "open");
    player.jump(2);
    player.pause();
    await Promise.resolve();
    assert.equal(state.devices.data, "unset");
    player.reset();
    await Promise.resolve();
    assert.equal(state.devices.control, "waiting");
  } finally { player.dispose(); }
});

test("jumping to the HTTP ending credits only the step that actually finishes", async (t) => {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const saved = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value),
    },
  });
  t.after(() => {
    if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
    else delete globalThis.localStorage;
  });
  const { getLessonCompletion, getLessonStatus, recordLessonProgress } =
    await import("../src/progress.js");
  const lesson = lessonsById.http;
  let state;
  const renderer = { clear() {}, snapshot() {}, overview() {}, morph() {}, apply() {}, run() {} };
  const player = createLessonPlayer(lesson, renderer, (snapshot) => {
    state = snapshot;
    recordLessonProgress(lesson, snapshot);
  });
  try {
    player.jump(4);
    player.pause();
    await new Promise(setImmediate);
    assert.equal(getLessonCompletion(lesson), 0);
    player.step();
    await new Promise(setImmediate);
    assert.equal(state.done, true);
    assert.deepEqual(state.steps, ["todo", "todo", "todo", "todo", "done"]);
    assert.equal(getLessonCompletion(lesson), 1 / 5);
    assert.equal(getLessonStatus(lesson), "progress");
    assert.deepEqual(JSON.parse(saved.get("protocol-explorer:progress:v1")).http.seen, [4]);

    player.reset();
    await new Promise(setImmediate);
    assert.equal(getLessonCompletion(lesson), 1 / 5);
    do {
      player.step();
      await new Promise(setImmediate);
    } while (!state.done);
    assert.equal(getLessonCompletion(lesson), 1);
    assert.equal(getLessonStatus(lesson), "done");
  } finally {
    player.dispose();
  }
});

test("reset and disposal prevent a pending animation from advancing the lesson", async () => {
  const lesson = {
    nodes: ["client", "web"],
    start: { nodes: ["client"] },
    steps: [{ events: [{ type: "packet", from: "client", to: "web" }] }],
  };
  const pending = [];
  const states = [];
  const renderer = {
    clear() {},
    snapshot: () => ({}),
    overview() {},
    morph() {},
    apply() {},
    run: (event, token) =>
      new Promise((resolve) => pending.push({ event, token, resolve })),
  };
  const player = createLessonPlayer(lesson, renderer, (state) =>
    states.push(state),
  );
  try {
    player.reset();
    await Promise.resolve();
    assert.equal(states.at(-1).started, false);

    player.step();
    await Promise.resolve();
    assert.equal(states.at(-1).running, true);
    assert.equal(pending[0].event.type, "focus");

    player.reset();
    await Promise.resolve();
    assert.equal(pending[0].token.cancelled, true);
    const resetState = states.at(-1);
    pending[0].resolve();
    await new Promise(setImmediate);
    assert.equal(states.at(-1), resetState);
    assert.equal(resetState.started, false);

    player.step();
    pending[1].resolve();
    await new Promise(setImmediate);
    player.step();
    pending[2].resolve();
    await new Promise(setImmediate);
    assert.equal(states.at(-1).done, true);
    assert.deepEqual(states.at(-1).steps, ["done"]);

    player.reset();
    player.step();
    await Promise.resolve();
    const notificationCount = states.length;
    player.dispose();
    assert.equal(pending[3].token.cancelled, true);
    pending[3].resolve();
    await new Promise(setImmediate);
    assert.equal(states.length, notificationCount);
  } finally {
    player.dispose();
  }
});

test("the playback clock respects pause, speed and cancellation", async () => {
  const originalFrame = globalThis.requestAnimationFrame;
  const frames = [];
  const progress = [];
  globalThis.requestAnimationFrame = (callback) => frames.push(callback);
  playbackClock.setSpeed(1);
  playbackClock.resume();
  try {
    const token = { cancelled: false };
    const finished = animateWithClock(100, token, (value) =>
      progress.push(value),
    );
    frames.shift()(0);
    frames.shift()(25);
    playbackClock.pause();
    frames.shift()(75);
    assert.deepEqual(progress, [0, 0.25, 0.25]);
    playbackClock.setSpeed(2);
    playbackClock.resume();
    frames.shift()(100);
    frames.shift()(125);
    await finished;
    assert.deepEqual(progress, [0, 0.25, 0.25, 0.75, 1]);

    const cancelled = { cancelled: false };
    const cancelledProgress = [];
    const stopped = animateWithClock(100, cancelled, (value) =>
      cancelledProgress.push(value),
    );
    cancelled.cancelled = true;
    frames.shift()(150);
    await stopped;
    assert.deepEqual(cancelledProgress, []);
  } finally {
    playbackClock.setSpeed(1);
    playbackClock.resume();
    if (originalFrame) globalThis.requestAnimationFrame = originalFrame;
    else delete globalThis.requestAnimationFrame;
  }
});
