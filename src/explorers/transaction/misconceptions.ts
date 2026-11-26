// 오개념 바로잡기 for the four transaction lessons (docs/DESIGN.md → Learning
// model). Each item names a belief learners commonly hold, the precise
// statement (PostgreSQL docs 13.2 Transaction Isolation and 13.3 Explicit
// Locking; Berenson et al., "A Critique of ANSI SQL Isolation Levels", 1995)
// and what this run shows. `check` reads its numbers from the engine run at
// the 핵심 장면 named by `scene` (1-based, in that mode's milestone list), so
// it cannot drift from the scene. Every mode lists only what its own run
// demonstrates.
import type { Misconception } from "@/lib/lesson-kit.ts";
import { eul } from "@/lib/josa.ts";
import { buildMilestones } from "./lesson.ts";
import { deadlockMilestones } from "./deadlock-lesson.ts";
import type { DeadlockRun } from "./deadlock-engine.ts";
import type { Run } from "./engine.ts";
import { committedValue, type IsoRun } from "./isolation-engine.ts";
import { ISOLATION_LESSONS } from "./isolation-lesson.ts";

/** The state at the end of 핵심 장면 `scene` (1-based). */
function sceneStep<S extends { index: number }>(
  steps: S[],
  milestones: { index: number }[],
  scene: number,
) {
  return steps[milestones[scene - 1].index];
}

/* ----- 01 · 갱신 유실 ----- */

export function lostUpdateMisconceptions(run: Run): Misconception[] {
  const milestones = buildMilestones(run);
  const locked = run.mode === "locked";
  const { initialStock, expectedStock, actualStock } = run.stats;
  const uncommitted = sceneStep(run.steps, milestones, 3).state;
  const items: Misconception[] = [
    {
      id: "tx-protects",
      wrong: "트랜잭션으로 묶으면 갱신 유실은 자동으로 막힌다.",
      right:
        "READ COMMITTED 트랜잭션도 일반 SELECT로 읽은 값을 앱에서 계산해 쓰면 다른 트랜잭션의 감소를 덮어씁니다. 읽기부터 SELECT … FOR UPDATE로 잠그거나, SET stock = stock - 1처럼 DB 안에서 계산해야 합니다.",
      check: locked
        ? `읽기부터 FOR UPDATE로 잠그자 재고 ${initialStock}개에서 두 감소가 모두 반영돼 최종 ${actualStock}개입니다.`
        : `두 트랜잭션 모두 커밋했지만 최종 재고는 ${actualStock}개입니다. 기대한 ${expectedStock}개보다 ${actualStock - expectedStock}개 많아, 감소 ${run.stats.lostDecrements}번이 사라졌습니다.`,
      scene: 5,
    },
    {
      id: "uncommitted-visible",
      wrong: "UPDATE가 끝나면 다른 트랜잭션도 바로 새 값을 본다.",
      right:
        "커밋 전 쓰기는 미확정 버전입니다. 쓴 트랜잭션 자신만 보고, 다른 트랜잭션의 일반 SELECT는 커밋된 값을 읽습니다(PostgreSQL은 dirty read를 허용하지 않습니다).",
      check: `T1이 ${eul(uncommitted.uncommitted!.stock)} 쓴 뒤에도 확정 재고는 ${uncommitted.committedStock}개 그대로입니다.`,
      scene: 3,
    },
  ];
  if (locked) {
    const waitState = sceneStep(run.steps, milestones, 2).state;
    const read = sceneStep(run.steps, milestones, 4).state.clients.T2.localRead;
    items.push({
      id: "for-update-reads-only",
      wrong: "SELECT … FOR UPDATE는 값을 읽기만 하고, 잠그는 것은 UPDATE다.",
      right:
        "FOR UPDATE는 읽은 행에 행 잠금을 걸어, 같은 행의 FOR UPDATE·UPDATE·DELETE를 커밋이나 롤백까지 기다리게 합니다. 일반 SELECT는 막지 않습니다.",
      check: `T2의 SELECT … FOR UPDATE가 ${waitState.rowLock.owner}의 잠금 때문에 기다리고, 잠금이 풀린 뒤에야 ${eul(read!)} 읽습니다.`,
      scene: 2,
    });
  } else {
    const resumed = sceneStep(run.steps, milestones, 4);
    items.push({
      id: "wait-recomputes",
      wrong: "잠금을 기다렸다 실행되면 DB가 최신 값으로 다시 계산해 준다.",
      right:
        "대기 후 DB가 다시 평가하는 것은 SQL 안의 식과 WHERE 조건뿐입니다. 앱이 미리 계산해 보낸 숫자는 그대로 씁니다.",
      check: `T2는 T1의 커밋(재고 ${resumed.before.committedStock}) 뒤에 재개됐지만, 앱이 ${resumed.state.clients.T2.localRead} − 1로 만든 ${eul(resumed.state.clients.T2.localWrite!)} 그대로 썼습니다.`,
      scene: 4,
    });
  }
  return items;
}

/* ----- 02 · 교착 상태 ----- */

export function deadlockMisconceptions(run: DeadlockRun): Misconception[] {
  const milestones = deadlockMilestones(run.order);
  if (run.order === "same") {
    const waiting = sceneStep(run.steps, milestones, 2).state;
    const resumed = sceneStep(run.steps, milestones, 4);
    return [
      {
        id: "locks-mean-deadlock",
        wrong: "잠금을 쓰는 트랜잭션 둘이 겹치면 교착 상태는 반드시 생긴다.",
        right:
          "교착 상태는 서로 상대가 쥔 잠금을 기다리는 순환이 있어야 생깁니다. 모든 트랜잭션이 같은 순서로 잠그면 늦게 온 쪽은 기다릴 뿐입니다.",
        check: `T2는 ${waiting.clients.T2.held.length ? `${eul(waiting.clients.T2.held.join("·"))} 쥔` : "아무 잠금도 쥐지 않은"} 채 ${eul(waiting.clients.T2.waitingFor!)} 기다리고, 끝에는 커밋 ${run.stats.commits} · 롤백 ${run.stats.rollbacks}입니다.`,
        scene: 2,
      },
      {
        id: "one-way-wait",
        wrong: "트랜잭션이 잠금을 기다리고 있으면 교착 상태다.",
        right:
          "한쪽만 기다리는 것은 평범한 잠금 대기입니다. 잠금을 쥔 쪽이 커밋하거나 롤백하면 기다리던 요청이 이어서 실행됩니다.",
        check: `T1이 A·B를 확정하고 잠금을 놓자, 기다리던 T2가 오류 없이 재개됩니다.`,
        scene: 3,
      },
      {
        id: "stale-expression",
        wrong: "기다리던 UPDATE는 처음 요청한 순간의 값으로 계산된다.",
        right:
          "SET stock = stock - 1은 잠금을 얻은 뒤 최신 확정 버전에서 식을 평가합니다(READ COMMITTED).",
        check: `재개된 T2는 T1이 확정한 A ${resumed.before.rows.A.committed}에서 1을 빼 ${eul(resumed.state.rows.A.pending!.value)} 만듭니다.`,
        scene: 4,
      },
    ];
  }
  const cycle = sceneStep(run.steps, milestones, 2).state;
  const detected = sceneStep(run.steps, milestones, 3).state;
  const { A, B } = run.stats.finalStocks;
  return [
    {
      id: "waiter-releases",
      wrong: "잠금을 기다리는 동안에는 이미 얻은 잠금을 내려놓는다.",
      right:
        "대기 중에도 먼저 얻은 행 잠금과 미확정 쓰기는 커밋이나 롤백까지 유지됩니다. 그래서 서로를 기다리는 순환이 생길 수 있습니다.",
      check: `T1은 ${eul(cycle.clients.T1.held.join("·"))} 쥔 채 ${eul(cycle.clients.T1.waitingFor!)}, T2는 ${eul(cycle.clients.T2.held.join("·"))} 쥔 채 ${eul(cycle.clients.T2.waitingFor!)} 기다립니다.`,
      scene: 2,
    },
    {
      id: "db-prevents",
      wrong: "DB가 교착 상태를 미리 막아 주거나, 생기면 두 트랜잭션이 영원히 멈춘다.",
      right:
        "PostgreSQL은 교착 상태를 미리 막지 않습니다. 대기가 deadlock_timeout을 넘으면 순환을 검사해 참여한 트랜잭션 하나를 40P01 오류로 중단하고, 나머지는 계속 진행합니다.",
      check: `순환이 생긴 뒤 DB가 ${eul(detected.victim!)} 중단 대상으로 골랐고, 남은 트랜잭션이 끝까지 실행됩니다.`,
      scene: 3,
    },
    {
      id: "db-retries",
      wrong: "중단된 트랜잭션은 DB가 알아서 다시 실행한다.",
      right:
        "DB는 중단한 트랜잭션의 미확정 쓰기와 잠금을 버릴 뿐 재시도하지 않습니다. 앱이 ROLLBACK으로 정리하고 트랜잭션 전체를 다시 실행할지 정합니다.",
      check: `최종 A ${A}개, B ${B}개 · 커밋 ${run.stats.commits} · 롤백 ${run.stats.rollbacks}: 중단된 주문의 감소는 남지 않았습니다.`,
      scene: 5,
    },
  ];
}

/* ----- 03 · 직렬화 오류, 04 · 쓰기 왜곡 ----- */

export function isolationMisconceptions(run: IsoRun): Misconception[] {
  const lesson = ISOLATION_LESSONS[run.scenario];
  const milestones = lesson.milestones(run);
  const at = (scene: number) => sceneStep(run.steps, milestones, scene);
  if (run.scenario === "repeatable-read") {
    if (run.mode === "rc") {
      const recomputed = at(4);
      return [
        {
          id: "rc-repeatable",
          wrong: "READ COMMITTED에서도 한 트랜잭션 안에서는 다시 읽어도 같은 값이 나온다.",
          right:
            "READ COMMITTED는 문장마다 새 스냅숏을 잡습니다. 그 사이 다른 트랜잭션이 커밋하면 같은 트랜잭션의 다음 문장은 새 값을 봅니다(반복 불가능 읽기).",
          check: `T2의 SELECT는 ${eul(recomputed.state.clients.T2.read!)} 봤지만, 같은 트랜잭션의 UPDATE는 T1이 커밋한 ${committedValue(recomputed.before, "1")}에서 계산해 ${eul(recomputed.state.rows["1"].pending!.value as number)} 만들었습니다.`,
          scene: 4,
        },
        {
          id: "rc-wait-fails",
          wrong: "다른 트랜잭션이 바꾼 행을 기다렸다 갱신하면 오류가 난다.",
          right:
            "READ COMMITTED는 기다린 뒤 커밋된 새 행 버전에서 WHERE와 SET 식을 다시 평가해 그대로 진행합니다. 40001은 REPEATABLE READ 이상에서 납니다.",
          check: `직렬화 오류 ${run.stats.errors}회, 최종 재고 ${run.stats.finals["1"]}개로 두 감소가 모두 반영됐습니다.`,
          scene: 5,
        },
      ];
    }
    const failed = at(3);
    const retried = at(4);
    return [
      {
        id: "rr-waits-and-merges",
        wrong: "더 강한 격리 수준이면 기다렸다가 최신 값으로 알아서 처리해 준다.",
        right:
          "REPEATABLE READ는 한 트랜잭션이 한 스냅숏만 보게 합니다. 스냅숏 이후 다른 트랜잭션이 바꾸고 커밋한 행을 갱신하려 하면 다시 계산하지 않고 40001로 실패합니다.",
        check: `T1의 커밋 뒤 재개된 T2의 UPDATE가 SQLSTATE ${failed.error!.code}로 실패했습니다.`,
        scene: 3,
      },
      {
        id: "rr-retry-statement",
        wrong: "40001이 나면 실패한 문장만 다시 보내면 된다.",
        right:
          "실패한 트랜잭션은 ROLLBACK 전까지 어떤 SQL도 실행하지 못하고, 같은 스냅숏으로는 다시 실패합니다. 트랜잭션 전체를 새로 시작해야 새 스냅숏을 봅니다.",
        check: `ROLLBACK 후 새로 시작한 T2의 SELECT가 ${eul(retried.state.clients.T2.read!)} 읽습니다(처음 시도에서는 ${at(1).state.clients.T2.read}).`,
        scene: 4,
      },
      {
        id: "rr-snapshot-at-begin",
        wrong: "REPEATABLE READ의 스냅숏은 BEGIN을 실행한 순간 잡힌다.",
        right:
          "스냅숏은 BEGIN이 아니라 트랜잭션의 첫 문장(SELECT, UPDATE 등)이 시작될 때 잡힙니다.",
        check: `T2의 스냅숏은 첫 SELECT 시점에 잡혀 재고 ${eul(at(1).state.clients.T2.read!)} 봅니다.`,
        scene: 1,
      },
    ];
  }
  // write skew
  if (run.mode === "rr") {
    const writes = at(3).state;
    return [
      {
        id: "rr-prevents-all",
        wrong: "REPEATABLE READ면 모든 동시성 이상 현상이 막힌다.",
        right:
          "PostgreSQL의 REPEATABLE READ(스냅숏 격리)는 같은 행의 동시 갱신은 막지만, 같은 데이터를 읽고 서로 다른 행을 쓰는 쓰기 왜곡(write skew)은 허용합니다(Berenson 외, 1995).",
        check: `두 트랜잭션 모두 오류 ${run.stats.errors}회로 커밋했고, 당직이 ${run.stats.onCall}명이 됐습니다(규칙: 최소 1명).`,
        scene: 5,
      },
      {
        id: "different-rows-safe",
        wrong: "서로 다른 행을 쓰면 충돌이 없으니 안전하다.",
        right:
          "행 잠금과 동시 갱신 검사는 같은 행만 봅니다. 판단에 쓴 행을 다른 트랜잭션이 바꾸면, 쓴 행이 달라도 합친 결과가 규칙을 깰 수 있습니다.",
        check: `T1은 ${writes.rows.A.owner === "T1" ? "A" : "B"}, T2는 ${writes.rows.B.owner === "T2" ? "B" : "A"}만 잠가 아무도 기다리지 않았습니다.`,
        scene: 3,
      },
      {
        id: "select-protects",
        wrong: "SELECT로 확인한 사실은 커밋할 때까지 그대로 유지된다.",
        right:
          "일반 SELECT는 행을 잠그지 않습니다. 판단 근거를 지키려면 SELECT … FOR UPDATE로 함께 잠그거나 SERIALIZABLE을 씁니다.",
        check: `T1은 당직 ${at(2).state.clients.T1.read}명, T2도 ${at(2).state.clients.T2.read}명을 보고 둘 다 '빠져도 된다'고 판단했습니다.`,
        scene: 2,
      },
    ];
  }
  const failed = at(3);
  const retried = at(4);
  return [
    {
      id: "ser-uses-locks",
      wrong: "SERIALIZABLE은 잠금으로 서로를 기다리게 해서 이상 현상을 막는다.",
      right:
        "PostgreSQL의 SERIALIZABLE(SSI)은 읽기를 SIRead 잠금으로 기록할 뿐 대기를 만들지 않습니다. 차례로 실행할 수 없는 읽기·쓰기 의존 순환을 찾으면 한 트랜잭션을 40001로 중단합니다.",
      check: `아무도 기다리지 않았고, T2의 COMMIT이 SQLSTATE ${failed.error!.code}로 실패했습니다.`,
      scene: 3,
    },
    {
      id: "ser-no-errors",
      wrong: "SERIALIZABLE을 쓰면 앱은 동시성 오류를 신경 쓰지 않아도 된다.",
      right:
        "SERIALIZABLE은 직렬화 실패를 40001 오류로 돌려줍니다. 앱이 트랜잭션 전체를 재시도해야 결과가 반영됩니다.",
      check: `재시도한 T2가 당직 ${retried.state.clients.T2.read}명을 보고 남기로 해, 최종 당직은 ${run.stats.onCall}명입니다.`,
      scene: 4,
    },
  ];
}
