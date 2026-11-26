import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CUSTOM,
  PRESETS,
  customQuery,
  parseCustom,
  refsFromText,
  validateCustom,
  type CustomConfig,
} from "../custom.ts";
import { LESSONS, customLesson, extrasFor, runsFor } from "../lessons.ts";
import type { Algorithm, Lesson } from "../types.ts";

const byId = Object.fromEntries(LESSONS.map((lesson) => [lesson.id, lesson]));

/** Every lesson: 2–4 misconceptions, real scene numbers, no unfilled values. */
function checkMisconceptions(lesson: Lesson) {
  const runs = runsFor(lesson);
  const items = lesson.misconceptions(runs, extrasFor(lesson));
  const scenes = lesson.milestones(runs).length;
  assert.ok(items.length >= 2 && items.length <= 4, `${lesson.id}: ${items.length}`);
  assert.equal(new Set(items.map((m) => m.id)).size, items.length, `${lesson.id} ids`);
  for (const m of items) {
    assert.ok(
      Number.isInteger(m.scene) && m.scene! >= 1 && m.scene! <= scenes,
      `${lesson.id}/${m.id} scene ${m.scene}`,
    );
    for (const text of [m.wrong, m.right, m.check]) {
      assert.ok(text.length > 15, `${lesson.id}/${m.id}`);
      assert.doesNotMatch(text, /undefined|NaN|null|\[object/, `${lesson.id}/${m.id}: ${text}`);
      assert.match(text, /[.다]$/, `${lesson.id}/${m.id} ends a sentence: ${text}`);
    }
    // 합니다체 for the correction and the evidence.
    assert.match(m.right, /니다\.$/, `${lesson.id}/${m.id} right`);
    assert.match(m.check, /니다\.$/, `${lesson.id}/${m.id} check`);
  }
  return items;
}

for (const lesson of LESSONS)
  test(`${lesson.id}: misconceptions with their 핵심 장면`, () => void checkMisconceptions(lesson));

test("misconception evidence quotes the engine's numbers", () => {
  const text = (id: string) =>
    checkMisconceptions(byId[id])
      .map((m) => m.check)
      .join(" ");
  assert.match(text("fifo-lru"), /FIFO의 부재 7회는 모두/);
  assert.match(text("fifo-lru"), /3번째 접근까지 부재 3회, 교체 0회/);
  assert.match(
    text("fifo-lru"),
    /4번째에 A가 적중했는데도 FIFO는 5번째에 A를 내보내 6번째 A 접근이 부재/,
  );
  assert.match(text("fifo-lru"), /LRU 6회, FIFO 7회.*LRU 8회, FIFO 8회/);
  assert.match(text("opt"), /A 5번째 · B 6번째 · C 7번째\)을 비교해 C를 내보냈습니다/);
  assert.match(text("opt"), /7번째 접근까지 LRU는 7번 모두 부재, OPT는 부재 5회/);
  assert.match(text("opt"), /OPT의 부재 6회 중 4회는/);
  assert.match(text("belady"), /프레임 3개일 때 부재 9회, 4개일 때 10회/);
  assert.match(text("belady"), /A는 3개 쪽에만 있습니다/);
  assert.match(text("belady"), /프레임 3개 10회 → 4개 8회/);
  assert.match(text("clock"), /4번째 D에서는 비트가 모두 1이라 바늘이 A·B·C의 비트를/);
  assert.match(text("clock"), /5번째 B 적중에서 B의 참조 비트가 0에서 1로/);
  assert.match(text("clock"), /9번째에는 클럭이 B, LRU가 A를 내보냈습니다/);
});

/* ---------- 직접 실험 ---------- */

test("custom input: parse, validate and share through the URL", () => {
  assert.deepEqual(parseCustom("?lesson=custom"), { config: DEFAULT_CUSTOM, errors: [] });
  const config: CustomConfig = { refs: [..."ABHAG"], frames: 2, policies: ["opt", "clock"] };
  assert.deepEqual(parseCustom(`?${customQuery(config)}`), { config, errors: [] });
  assert.deepEqual(refsFromText("a b, c·d"), ["A", "B", "C", "D"]);
  const bad = (refs: string, frames: number, policies: string[]) =>
    validateCustom({ refs: refsFromText(refs), frames, policies });
  assert.deepEqual(bad("", 3, ["fifo", "lru"]), ["접근 순서를 한 번 이상 입력하세요."]);
  assert.match(bad("ABZ1", 3, ["fifo", "lru"])[0], /A부터 H까지만.*Z 1/);
  assert.match(bad("A".repeat(17), 3, ["fifo", "lru"])[0], /16번까지.*17번/);
  assert.match(bad("AB", 0, ["fifo", "lru"])[0], /1개부터 6개까지/);
  assert.match(bad("AB", 7, ["fifo", "lru"])[0], /1개부터 6개까지/);
  assert.match(bad("AB", 3, ["fifo", "fifo"])[0], /두 정책이 같습니다/);
  assert.match(bad("AB", 3, ["fifo", "random"])[0], /FIFO·LRU·OPT·클럭/);
  // A broken link runs the defaults and says why.
  const broken = parseCustom("?lesson=custom&refs=XYZ&frames=9&policies=lru,lru");
  assert.deepEqual(broken.config, DEFAULT_CUSTOM);
  assert.equal(broken.errors.length, 3);
  for (const preset of PRESETS) assert.deepEqual(validateCustom(preset.config), [], preset.id);
});

/** Many inputs: every generated sentence stays filled, and scenes stay valid. */
function* inputs(): Generator<CustomConfig> {
  const strings = [
    "A",
    "AB",
    "AAAA",
    "ABCDEFGH",
    "ABCABCABC",
    "ABCDABEABCDE",
    "HGFEDCBAHGFEDCBA",
    "ABACADAEAFAGAH",
  ];
  const policies: Algorithm[] = ["fifo", "lru", "opt", "clock"];
  for (const s of strings)
    for (let frames = 1; frames <= 6; frames++)
      for (const a of policies)
        for (const b of policies) if (a !== b) yield { refs: [...s], frames, policies: [a, b] };
}

test("custom lesson: the generic text holds for any input", () => {
  const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).filter(Boolean).length;
  let count = 0;
  for (const config of inputs()) {
    const lesson = customLesson(config);
    const runs = runsFor(lesson);
    const extras = extrasFor(lesson);
    const scenes = lesson.milestones(runs);
    const id = `${config.refs.join("")}/${config.frames}/${config.policies}`;
    assert.equal(scenes[0].index, 0, id);
    assert.equal(scenes.at(-1)!.index, config.refs.length, id);
    assert.ok(
      scenes.every((s, i) => i === 0 || s.index > scenes[i - 1].index),
      id,
    );
    const items = checkMisconceptions(lesson);
    assert.equal(items.length, 3, id);
    for (const mode of lesson.modes) {
      const run = runs[mode.id];
      for (const step of run.steps) {
        const d = lesson.describe(step, run, mode);
        assert.doesNotMatch(
          JSON.stringify(d),
          /undefined|NaN|null/,
          `${id} ${mode.id} ${step.index}`,
        );
        assert.ok(sentences(d.body) <= 3, `${id} ${step.index}: ${d.body}`);
        const quiz = lesson.predict(step, run, mode);
        if (quiz) {
          assert.equal(quiz.correctId, step.victim, id);
          assert.ok(
            scenes.some((s) => s.index === quiz.atIndex - 1),
            `${id} quiz follows a scene`,
          );
        }
      }
    }
    const all = JSON.stringify([
      lesson.recap(runs, extras),
      lesson.forkText(runs, extras),
      lesson.compareNote(runs, extras),
      lesson.rules,
    ]);
    assert.doesNotMatch(all, /undefined|NaN|null|\[object/, id);
    // Particles follow the word: never "클럭와", "FIFO과", "OPT을".
    assert.doesNotMatch(
      all + JSON.stringify(items),
      /클럭와|클럭가|클럭를|클럭는|FIFO과|FIFO이|FIFO을|FIFO은|LRU과|LRU을|OPT과|OPT을|OPT은/,
      id,
    );
    const recap = lesson.recap(runs, extras);
    for (const q of recap.recall)
      assert.equal(q.choices.filter((c) => c.correct).length, 1, `${id} ${q.id}`);
    assert.ok(lesson.fork >= 0 && lesson.fork < config.refs.length, id);
    count++;
  }
  assert.ok(count > 300);
});
