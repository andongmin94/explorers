import assert from "node:assert/strict";
import test from "node:test";
import type { Misconception } from "@/lib/lesson-kit.ts";
import { deadlockMilestones } from "../deadlock-lesson.ts";
import { simulateDeadlock } from "../deadlock-engine.ts";
import { simulate } from "../engine.ts";
import { simulateIsolation, type Level } from "../isolation-engine.ts";
import { ISOLATION_LESSONS } from "../isolation-lesson.ts";
import { buildMilestones } from "../lesson.ts";
import {
  deadlockMisconceptions,
  isolationMisconceptions,
  lostUpdateMisconceptions,
} from "../misconceptions.ts";

/** Every lesson's every mode: its misconceptions and how many 핵심 장면 it has. */
function cases(): [string, Misconception[], number][] {
  const out: [string, Misconception[], number][] = [];
  for (const mode of ["naive", "locked"] as const) {
    const run = simulate({ mode });
    out.push([`lost-update:${mode}`, lostUpdateMisconceptions(run), buildMilestones(run).length]);
  }
  for (const order of ["opposite", "same"] as const) {
    const run = simulateDeadlock({ order });
    out.push([`deadlock:${order}`, deadlockMisconceptions(run), deadlockMilestones(order).length]);
  }
  for (const lesson of Object.values(ISOLATION_LESSONS))
    for (const mode of Object.keys(lesson.modes) as Level[]) {
      const run = simulateIsolation({ scenario: lesson.scenario, mode });
      out.push([
        `${lesson.id}:${mode}`,
        isolationMisconceptions(run),
        lesson.milestones(run).length,
      ]);
    }
  return out;
}

test("every lesson and mode sets 2–4 misconceptions right at a 핵심 장면 that exists", () => {
  const all = cases();
  assert.equal(all.length, 8);
  for (const [name, items, scenes] of all) {
    assert.ok(items.length >= 2 && items.length <= 4, `${name}: ${items.length} items`);
    assert.equal(new Set(items.map((m) => m.id)).size, items.length, `${name}: unique ids`);
    for (const item of items) {
      assert.ok(Number.isInteger(item.scene), `${name}/${item.id}: scene`);
      assert.ok(
        item.scene! >= 1 && item.scene! <= scenes,
        `${name}/${item.id}: scene ${item.scene}`,
      );
      for (const text of [item.wrong, item.right, item.check])
        assert.ok(
          text.length > 10 && !/undefined|NaN|null/.test(text),
          `${name}/${item.id}: ${text}`,
        );
    }
  }
});

test("checks read their numbers from the run", () => {
  const naive = lostUpdateMisconceptions(simulate({ mode: "naive" }));
  assert.match(naive.find((m) => m.id === "tx-protects")!.check, /최종 재고는 9개.*기대한 8개/);
  assert.match(
    naive.find((m) => m.id === "wait-recomputes")!.check,
    /재고 9\) 뒤에.*10 − 1로 만든 9를/,
  );
  const locked = lostUpdateMisconceptions(simulate({ mode: "locked" }));
  assert.match(
    locked.find((m) => m.id === "for-update-reads-only")!.check,
    /T1의 잠금.*9를 읽습니다/,
  );
  assert.match(
    locked.find((m) => m.id === "uncommitted-visible")!.check,
    /9를 쓴 뒤에도 확정 재고는 10개/,
  );

  const opposite = deadlockMisconceptions(simulateDeadlock({ order: "opposite" }));
  assert.match(opposite.find((m) => m.id === "db-prevents")!.check, /T2를 중단 대상으로/);
  assert.match(
    opposite.find((m) => m.id === "db-retries")!.check,
    /A 9개, B 19개 · 커밋 1 · 롤백 1/,
  );
  const same = deadlockMisconceptions(simulateDeadlock({ order: "same" }));
  assert.match(
    same.find((m) => m.id === "locks-mean-deadlock")!.check,
    /아무 잠금도 쥐지 않은 채 A를 기다리고.*커밋 2 · 롤백 0/,
  );
  assert.match(same.find((m) => m.id === "stale-expression")!.check, /A 9에서 1을 빼 8을/);

  const rr = isolationMisconceptions(
    simulateIsolation({ scenario: "repeatable-read", mode: "rr" }),
  );
  assert.match(rr.find((m) => m.id === "rr-waits-and-merges")!.check, /40001/);
  assert.match(
    rr.find((m) => m.id === "rr-retry-statement")!.check,
    /9를 읽습니다\(처음 시도에서는 10\)/,
  );
  const rc = isolationMisconceptions(
    simulateIsolation({ scenario: "repeatable-read", mode: "rc" }),
  );
  assert.match(rc.find((m) => m.id === "rc-repeatable")!.check, /10을 봤지만.*9에서 계산해 8을/);
  const ws = isolationMisconceptions(simulateIsolation({ scenario: "write-skew", mode: "rr" }));
  assert.match(ws.find((m) => m.id === "rr-prevents-all")!.check, /오류 0회.*당직이 0명/);
  const ser = isolationMisconceptions(simulateIsolation({ scenario: "write-skew", mode: "ser" }));
  assert.match(ser.find((m) => m.id === "ser-no-errors")!.check, /당직 1명.*최종 당직은 1명/);
});
