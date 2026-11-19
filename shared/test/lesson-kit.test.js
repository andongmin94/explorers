import test from "node:test";
import assert from "node:assert/strict";
import { createProgress, nextExperiment, LABELS } from "../lesson-kit.js";
import { josa, ga, eul, ro } from "../josa.js";

function store() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
}

test("progress counts scenes, comparison and recall, and persists", () => {
  const s = store();
  const p = createProgress("cpu", { scenes: 2, recall: 1, store: s });
  p.markScene(0);
  p.markScene(0);
  p.markPrediction("a", true);
  p.markPrediction("a", false);
  assert.deepEqual(
    { seen: p.summary().scenesSeen, right: p.summary().predictionsRight, done: p.summary().done },
    { seen: 1, right: 1, done: false },
  );
  p.markScene(1);
  p.markCompared();
  p.markRecall("r", false);
  assert.equal(p.summary().done, false);
  p.markRecall("r", true);
  assert.equal(p.summary().done, true);
  const again = createProgress("cpu", { scenes: 2, recall: 1, store: s });
  assert.equal(again.summary().done, true);
  assert.equal(createProgress("memory", { scenes: 1, store: s }).summary().scenesSeen, 0);
});

test("experiment order wraps", () => {
  assert.equal(nextExperiment("transaction").id, "disk");
  assert.equal(nextExperiment("git").id, "protocol");
  assert.equal(LABELS.wrong("8"), "정답은 8입니다.");
});

test("josa after Hangul, digits and Latin", () => {
  assert.equal(ga("T1"), "T1이");
  assert.equal(ga("T2"), "T2가");
  assert.equal(eul("9"), "9를");
  assert.equal(eul("10"), "10을");
  assert.equal(eul("재고"), "재고를");
  assert.equal(ga("값"), "값이");
  assert.equal(ro("CYL"), "CYL로");
  assert.equal(ro("FCFS"), "FCFS로");
  assert.equal(ro("1"), "1로");
  assert.equal(ro("3"), "3으로");
  assert.equal(ro("길"), "길로");
  assert.equal(ro("밖"), "밖으로");
  assert.equal(josa("P1", "은/는"), "P1은");
});

test("lesson status and rail helpers", async () => {
  const { lessonStatus, lessonId } = await import("../lesson-kit.js");
  const { currentLesson, lessonHref, nextLesson } = await import("../lesson-rail.js");
  const s = store();
  const id = lessonId("cpu", "sjf", "rr");
  assert.equal(id, "cpu:sjf");
  assert.equal(lessonId("cpu", "rr", "rr"), "cpu");
  assert.equal(lessonStatus(id, { store: s }).status, "new");
  const p = createProgress(id, { scenes: 1, recall: 0, compare: false, store: s });
  assert.equal(lessonStatus(id, { store: s }).status, "new");
  p.markScene("a");
  assert.deepEqual(lessonStatus(id, { store: s }), { status: "done", ratio: 1 });
  const lessons = [{ id: "rr", name: "RR" }, { id: "sjf", name: "SJF" }, { id: "x", name: "X", href: "x.html" }];
  assert.equal(currentLesson(lessons, "?lesson=sjf").id, "sjf");
  assert.equal(currentLesson(lessons, "?lesson=nope").id, "rr");
  assert.equal(lessonHref(lessons, lessons[0]), "./");
  assert.equal(lessonHref(lessons, lessons[1]), "./?lesson=sjf");
  assert.deepEqual(nextLesson(lessons, "sjf"), { href: "x.html", title: "X" });
  assert.equal(nextLesson(lessons, "x"), null);
});
