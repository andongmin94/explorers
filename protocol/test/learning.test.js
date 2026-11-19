import assert from "node:assert/strict";
import test from "node:test";
import { lessonsById, protocolCatalog } from "../src/lessons/index.js";
import { learning } from "../src/lessons/learning.js";
import { getLessonPackets } from "../src/packets/encode.js";
import {
  getGuidedStops,
  getKeySteps,
  getLessonQuizzes,
  getPacketPositions,
  getPendingQuiz,
} from "../src/quiz.js";
import { HOLD_TITLE, buildOverviewState, visibleLessonText } from "../src/lesson-view.js";
import { createLessonPlayer } from "../src/simulation/player.js";
import { translate } from "../src/i18n.js";

/** Frames that jump far ahead, so the player's waits finish at once. */
function fastFrames() {
  const original = globalThis.requestAnimationFrame;
  let now = 0;
  globalThis.requestAnimationFrame = (callback) => setImmediate(() => callback((now += 5000)));
  return () => {
    if (original) globalThis.requestAnimationFrame = original;
    else delete globalThis.requestAnimationFrame;
  };
}

/** The player's event list (a focus event first), as createLessonPlayer builds it. */
const playerEvents = (lesson) => [
  { type: "focus", step: 0 },
  ...lesson.steps.flatMap((step, stepIndex) => step.events.map((event) => ({ ...event, step: stepIndex }))),
];

/** Playback just before `packet` leaves, after `lastEvent` (player index) ran. */
function snapshotBefore(lesson, packet, { activeStep, event = null }) {
  const count = getLessonPackets(lesson).length;
  return {
    started: true,
    done: false,
    playing: false,
    running: false,
    activeStep,
    event,
    packets: Array.from({ length: count }, (_, i) => (i < packet ? "past" : "future")),
  };
}

/** The moments a learner sees a pending prediction: the guided stop, and a paused jump to the step. */
function pendingMoments(lesson, quiz) {
  const events = playerEvents(lesson);
  const where = getPacketPositions(lesson)[quiz.packet];
  const moments = [];
  if (where.k === 0) {
    const before = events[where.event - 1];
    moments.push(["guided stop", snapshotBefore(lesson, quiz.packet, { activeStep: before.step, event: before.type === "focus" ? null : before })]);
  } else {
    moments.push(["inside the stream", snapshotBefore(lesson, quiz.packet, { activeStep: where.step, event: events[where.event] })]);
  }
  const firstOfStep = getPacketPositions(lesson).findIndex((p) => p.step === quiz.step);
  if (firstOfStep === quiz.packet) {
    moments.push(["paused jump to the step", snapshotBefore(lesson, quiz.packet, { activeStep: quiz.step })]);
  }
  if (quiz.packet === 0) moments.push(["start screen", { ...snapshotBefore(lesson, 0, { activeStep: 0 }), started: false }]);
  return moments;
}

for (const lesson of Object.values(lessonsById)) {
  test(`${lesson.id}: nothing in the 해설 tab gives a pending prediction away`, () => {
    for (const quiz of getLessonQuizzes(lesson)) {
      const right = quiz.choices.find((c) => c.correct);
      // The value and its description, when they are specific enough to search for.
      // What an earlier packet already showed (the packet table has it too) is observation, not a leak.
      const seen = getLessonPackets(lesson)
        .slice(0, quiz.packet)
        .flatMap((p) => [p.row?.info ?? "", ...(p.payload ?? []).map((line) => translate(line))])
        .join("\n");
      const needles = [quiz.answer, right.text].filter((s) => s.length >= 3 && !quiz.prompt.includes(s) && !seen.includes(s));
      for (const [moment, playback] of pendingMoments(lesson, quiz)) {
        const pending = getPendingQuiz(lesson, playback);
        assert.equal(pending?.packet, quiz.packet, `${lesson.id} #${quiz.packet} ${moment}: the question is pending`);
        const state = buildOverviewState(playback, lesson, 0, { pending });
        const text = visibleLessonText(state);
        for (const needle of needles) {
          assert.ok(!text.includes(needle), `${lesson.id} #${quiz.packet} ${moment}: "${needle}" is visible:\n${text}`);
        }
      }
    }
  });
}

test("the quiz's step is held: title and description only as a placeholder, no facts", () => {
  const tcp = lessonsById.tcp;
  const quiz = getLessonQuizzes(tcp).find((q) => q.packet === 4);
  const playback = snapshotBefore(tcp, 4, { activeStep: quiz.step });
  const held = buildOverviewState(playback, tcp, 0, { pending: getPendingQuiz(tcp, playback) });
  assert.equal(held.held, true);
  assert.equal(held.content.title, HOLD_TITLE);
  assert.deepEqual(held.content.facts, []);
  assert.doesNotMatch(visibleLessonText(held), /79/);
  // Answered: the same moment shows the step in full.
  const answered = getPendingQuiz(tcp, playback, new Set([4]));
  assert.equal(answered, null);
  const open = buildOverviewState(playback, tcp, 0, { pending: answered });
  assert.equal(open.content.title, tcp.steps[quiz.step].title);
  assert.match(visibleLessonText(open), /79/);
});

test("guided playback stops before each predicted packet and plays on when resumed", async () => {
  const restore = fastFrames();
  try {
  for (const lesson of Object.values(lessonsById)) {
    const stops = getGuidedStops(lesson);
    let state;
    const renderer = { clear() {}, snapshot() {}, overview() {}, morph() {}, apply() {}, run: () => Promise.resolve() };
    const player = createLessonPlayer(lesson, renderer, (s) => (state = s), { stopBefore: (i) => stops.events.has(i) });
    const heldAt = [];
    try {
      player.play();
      for (let guard = 0; guard < 400; guard++) {
        await new Promise(setImmediate);
        if (state?.done) break;
        if (state && !state.playing && state.held) {
          heldAt.push(state.packets.indexOf("future"));
          player.play();
        }
      }
      assert.ok(state.done, `${lesson.id}: reaches the end`);
      const expected = getLessonQuizzes(lesson)
        .filter((q) => getPacketPositions(lesson)[q.packet].k === 0)
        .map((q) => q.packet);
      assert.deepEqual(heldAt, expected, `${lesson.id}: held before every predicted packet, once`);
    } finally {
      player.dispose();
    }
  }
  } finally {
    restore();
  }
});

test("a guided stop is not repeated after a step jump to it, and a single event never holds", async () => {
  const lesson = lessonsById.dhcp;
  const stops = getGuidedStops(lesson);
  let state;
  const renderer = { clear() {}, snapshot() {}, overview() {}, morph() {}, apply() {}, run: () => Promise.resolve() };
  const player = createLessonPlayer(lesson, renderer, (s) => (state = s), { stopBefore: (i) => stops.events.has(i) });
  const restore = fastFrames();
  try {
    player.jump(2, { paused: true }); // step 3: OFFER is its first event
    await new Promise(setImmediate);
    player.play();
    await new Promise(setImmediate);
    assert.notEqual(state.packets[1], "future", "OFFER plays at once after the jump");
    player.reset();
    await new Promise(setImmediate);
    player.step(); // focus
    await new Promise(setImmediate);
    for (let i = 0; i < 3; i++) {
      player.step();
      await new Promise(setImmediate);
    }
    assert.equal(state.held, false);
    assert.notEqual(state.packets[0], "future", "stepping runs DISCOVER without a hold");
  } finally {
    restore();
    player.dispose();
  }
});

test("실제로 확인 plays through the hold before its own packet, then the next stop still holds", async () => {
  const lesson = lessonsById.tcp; // predictions on packets 1 and 2, back to back
  const stops = getGuidedStops(lesson);
  const where = getPacketPositions(lesson);
  let state;
  const renderer = { clear() {}, snapshot() {}, overview() {}, morph() {}, apply() {}, run: () => Promise.resolve() };
  const player = createLessonPlayer(lesson, renderer, (s) => (state = s), { stopBefore: (i) => stops.events.has(i) });
  const restore = fastFrames();
  const settle = async () => {
    await new Promise(setImmediate);
    for (let i = 0; i < 200 && state?.playing; i++) await new Promise(setImmediate);
  };
  try {
    player.play();
    await settle();
    assert.equal(state.held, true);
    assert.equal(state.packets.indexOf("future"), 1, "held before SYN-ACK");
    // Reveal packet 1, as the quiz does after an answer, and pause once it is past.
    player.play({ release: where[1].event });
    for (let i = 0; i < 50 && state.packets[1] === "future"; i++) await new Promise(setImmediate);
    await settle();
    assert.notEqual(state.packets[1], "future");
    assert.equal(state.packets[2], "future", "held again before the ACK");
    assert.equal(state.held, true);
  } finally {
    restore();
    player.dispose();
  }
});

test("every lesson has a start question, a goal, 2–3 recap points and 1–2 recall questions with a why per choice", () => {
  for (const { id } of protocolCatalog) {
    const info = learning[id];
    assert.ok(info, `${id} has learning data`);
    assert.match(info.question, /\?$/, `${id}: the start title is a question`);
    assert.ok(info.setup && info.goal, `${id}: setup and goal`);
    assert.ok(info.points.length >= 2 && info.points.length <= 3, `${id}: 2–3 points`);
    assert.ok(info.recall.length >= 1 && info.recall.length <= 2, `${id}: 1–2 recall questions`);
    for (const q of info.recall) {
      assert.equal(q.choices.filter((c) => c.correct).length, 1, `${id} ${q.id}: one right choice`);
      for (const c of q.choices) assert.ok(c.why?.length > 10, `${id} ${q.id}: ${c.label} has a why`);
    }
    // The start screen sets the scene without naming a prediction's answer.
    for (const quiz of getLessonQuizzes(lessonsById[id])) {
      for (const text of [info.question, info.setup, info.goal]) {
        assert.ok(!text.includes(quiz.answer) || quiz.answer.length < 4, `${id}: start text names "${quiz.answer}"`);
      }
    }
  }
});

test("핵심 장면 are the steps with a prediction, 1–6 per lesson", () => {
  for (const lesson of Object.values(lessonsById)) {
    const keys = getKeySteps(lesson);
    assert.ok(keys.length >= 1 && keys.length <= 6, `${lesson.id}: ${keys.length} key scenes`);
    for (const quiz of getLessonQuizzes(lesson)) assert.ok(keys.includes(quiz.step));
  }
  assert.equal(translate("STEP {n} OF {total}", { n: 1, total: 5 }), "단계 1/5");
});
