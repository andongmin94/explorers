export const DEADLOCK_SOURCES = Object.freeze([
  {
    title: "PostgreSQL · 교착 상태",
    url: "https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-DEADLOCKS",
  },
  {
    title: "PostgreSQL · 트랜잭션과 롤백",
    url: "https://www.postgresql.org/docs/current/tutorial-transactions.html",
  },
]);

export const DEADLOCK_NOTES = Object.freeze([
  "재고 행 A·B와 트랜잭션 T1·T2를 다룹니다. T1은 A→B, T2는 B→A 순서로 각각 1개씩 감소시키려 합니다.",
  "이번 UPDATE는 DB 안에서 stock = stock - 1을 계산합니다. 앞선 갱신 유실 실험의 앱 계산과 다릅니다.",
  "PostgreSQL은 교착 상태를 감지하면 참여 트랜잭션 하나를 중단합니다. 여기서는 설명을 위해 T2를 중단 대상으로 고정했습니다. 실제로 어느 쪽이 중단될지는 예측할 수 없으므로, 특정 쪽이 선택된다고 가정하면 안 됩니다.",
  "감지·중단·재개를 관찰하기 쉽게 나눴습니다. 실제 DB는 deadlock_timeout(기본 1초)만큼 기다린 뒤 순환을 검사하며, 이 화면은 그 시간을 재지 않습니다.",
  "T2의 중단은 DB가 수행합니다. 앱은 오류를 처리하고 실패한 트랜잭션 블록을 ROLLBACK으로 정리한 뒤 필요하면 전체 트랜잭션을 다시 실행해야 합니다. 이 실험은 재시도하지 않습니다.",
  "예방 · 모든 트랜잭션이 같은 순서로 행을 잠급니다. 예: SELECT … FROM inventory WHERE id IN ('A', 'B') ORDER BY id FOR UPDATE; 로 먼저 잠근 뒤 UPDATE합니다.",
]);

// Plain-language glossary for the English labels printed in the scene.
export const DEADLOCK_LEGEND = Object.freeze([
  "상태 · ACTIVE 진행 중 · WAITING 잠금 대기 · TO ABORT 중단 대상 · ABORTED 중단됨 · COMMITTED 커밋 완료",
  "노트북 화면 · HOLD 보유한 행 잠금 · WAIT 기다리는 행",
  "UPD A = A 행 UPDATE 요청 · WAIT-FOR 바닥의 선 = 누가 누구를 기다리는지",
]);

export const DEADLOCK_MILESTONES = Object.freeze([
  { index: 4, label: "나눠 보유", description: "T1은 A, T2는 B 잠금 보유" },
  { index: 6, label: "순환 대기", description: "서로의 잠금 해제를 기다림" },
  { index: 7, label: "DB 감지", description: "순환을 감지하고 중단 대상 선택" },
  { index: 8, label: "중단·롤백", description: "T2의 쓰기와 잠금·대기 요청 취소" },
  { index: 10, label: "완료", description: "남은 T1이 두 행을 확정" },
]);

export function describeDeadlockStep(step) {
  const base = {
    eyebrow: step.index
      ? `${step.index}번째 사건 · ${step.client || "데이터베이스"}`
      : "교착 상태 시나리오",
    sql: step.sql,
  };
  switch (step.action) {
    case "initial":
      return {
        ...base,
        title: "순서가 반대면, 서로 멈출 수 있습니다",
        summary:
          "T1은 A→B, T2는 B→A 순서로 재고를 줄이려 합니다. 먼저 얻은 행 잠금을 쥔 채 다음 행을 요청합니다.",
        details: [
          "처음 확정 재고는 A 10개, B 20개입니다.",
          "각 주문은 두 행을 모두 처리한 뒤 커밋하려고 합니다.",
        ],
        takeaway: "누가 무엇을 보유하고, 누구 때문에 기다리는지 함께 보세요.",
      };
    case "begin":
      return {
        ...base,
        title: `${step.client} 트랜잭션 시작`,
        summary:
          "BEGIN만으로 재고 행 잠금을 얻지는 않습니다. UPDATE가 행을 수정하면서 잠금을 얻습니다.",
        details: [
          step.client === "T1"
            ? "T1은 A를 먼저, B를 나중에 수정할 계획입니다."
            : "T2는 B를 먼저, A를 나중에 수정할 계획입니다.",
        ],
        takeaway: "행을 수정하는 순서가 서로 반대입니다.",
      };
    case "write":
      return {
        ...base,
        title: `${step.client}의 ${step.row} 잠금 보유`,
        summary: `${step.row}의 미확정 값은 ${step.state.rows[step.row].pending.value}입니다. 확정 재고 ${step.state.rows[step.row].committed}개는 그대로입니다.`,
        details: [
          "UPDATE로 얻은 행 잠금은 커밋 또는 롤백까지 유지됩니다.",
          "다른 행은 다른 트랜잭션이 동시에 잠글 수 있습니다.",
        ],
        takeaway:
          step.client === "T1"
            ? "T1이 A를 보유한 채 다음 B 요청을 준비합니다."
            : "현재 T1은 A, T2는 B를 보유합니다. 아직 대기는 없습니다.",
      };
    case "wait": {
      const owner = step.state.rows[step.row].owner;
      return {
        ...base,
        title: step.state.deadlocked
          ? "T1 ↔ T2 · 순환 대기 완성"
          : `${step.client}은 ${step.row}가 풀리기를 기다림`,
        summary: step.state.deadlocked
          ? "T1은 B를 가진 T2를, T2는 A를 가진 T1을 기다립니다. 둘 다 자신이 가진 잠금을 놓지 않아 진행할 수 없습니다."
          : `${step.client}은 A를 보유한 채 ${owner}의 B 잠금을 기다립니다. T2는 아직 다음 요청을 진행할 수 있습니다.`,
        details: [
          "기다리는 동안 먼저 얻은 잠금과 미확정 쓰기는 유지됩니다.",
          step.state.deadlocked
            ? "단순히 느린 요청이 아닙니다. 기다림의 방향을 따라가면 원래 트랜잭션으로 돌아오는 순환입니다."
            : "한 방향의 대기만으로는 교착 상태가 아닙니다.",
        ],
        takeaway: step.state.deadlocked
          ? "T1 → B → T2 → A → T1의 고리를 확인하세요."
          : "T1의 대기와 T1의 A 보유는 동시에 존재합니다.",
      };
    }
    case "detect":
      return {
        ...base,
        title: "DB가 순환을 감지하고 T2를 중단 대상으로 선택",
        summary:
          "이 실험에서는 T2를 중단합니다. 아직 롤백 전 장면이므로 잠금과 미확정 값은 그대로 보입니다.",
        details: [
          "PostgreSQL은 잠금을 deadlock_timeout(기본 1초) 동안 기다린 트랜잭션에서 순환 검사를 시작합니다.",
          "순환을 찾은 쪽이 보통 자기 트랜잭션을 중단합니다. 실제로 어느 쪽이 중단될지는 예측할 수 없으므로, 특정 쪽이 선택된다고 가정하면 안 됩니다. 여기서 T2로 고정한 것은 설명을 위해서입니다.",
        ],
        takeaway:
          "감지와 정리를 따로 멈춰 관찰합니다. 다음 장면에서 T2의 효과를 함께 취소합니다.",
      };
    case "rollback":
      return {
        ...base,
        title: "T2 중단·롤백 · 고리가 끊어짐",
        summary:
          "A를 기다리던 T2의 UPDATE가 ERROR: deadlock detected (40P01)로 끝납니다. T2의 B 미확정 19를 버리고 B 잠금을 놓습니다. B의 확정 재고는 처음부터 20개였습니다.",
        details: [
          "T1의 A 잠금과 미확정 9는 유지됩니다. T1 전체를 함께 되돌리는 것이 아닙니다.",
          "T1의 B 요청은 재개 가능해졌지만, 아직 B 잠금을 얻은 것은 아닙니다.",
          "T2는 중단된 상태입니다. 앱이 ROLLBACK으로 정리해야 하며, DB가 T2를 자동으로 재시도하지 않습니다.",
        ],
        takeaway:
          "롤백은 값을 확정하는 동작이 아닙니다. 미확정 쓰기와 보유 잠금·대기를 정리합니다.",
      };
    case "resume":
      return {
        ...base,
        title: "기다리던 T1 요청이 B에서 재개",
        summary:
          "새 SQL을 보내지 않고 DB에 대기 중이던 UPDATE가 이어집니다. T1이 B 잠금을 얻고 확정 값 20에서 1을 뺀 미확정 19를 만듭니다.",
        details: [
          "stock = stock - 1이므로 대기 후 최신 확정값(20)에서 다시 계산해 19가 됩니다. T2가 커밋했다면 18이 됐을 것입니다.",
          "T1은 이제 A와 B 잠금을 모두 보유합니다.",
          "T2가 만들었던 19는 이미 버렸습니다. 지금 B의 19는 T1이 새로 만든 미확정 값입니다.",
        ],
        takeaway: "숫자가 같아도 어느 트랜잭션의 쓰기인지 구분하세요.",
      };
    case "commit":
      return {
        ...base,
        title: "T1 완료 · A 9개, B 19개 확정",
        summary:
          "T1의 A·B 쓰기가 함께 확정되고 두 행 잠금이 해제됩니다. T2의 작업은 롤백되어 남지 않습니다.",
        details: [
          "커밋 1회, 롤백 1회입니다. 두 주문이 모두 성공한 결과가 아닙니다.",
          "두 트랜잭션이 모두 A→B처럼 같은 순서로 잠금을 얻으면 이 교착 순환을 피할 수 있습니다.",
          "실무 패턴: SELECT … WHERE id IN ('A', 'B') ORDER BY id FOR UPDATE; 로 필요한 행을 같은 순서로 먼저 잠근 뒤 UPDATE합니다.",
        ],
        takeaway:
          "순서를 일관되게 유지해 예방하고, 중단 오류가 나면 앱에서 전체 트랜잭션 재시도를 판단합니다.",
      };
  }
}

// Asked at detection, before T2 is aborted: B's committed value once T2's work
// is undone. The answer comes from the run, so it tracks the engine.
export function deadlockPrediction(run) {
  const detect = run.steps.find((step) => step.action === "detect");
  const after = run.steps[detect.index + 1].state;
  const answer = String(after.rows.B.committed);
  const pending = detect.state.rows.B.pending.value;
  const feedback = {
    [answer]: `B의 확정 값은 처음부터 ${answer}이었습니다. T2의 ${pending}는 커밋 전이었으므로 버려질 뿐입니다. B를 기다리던 T1의 UPDATE는 다시 보낼 필요 없이 그대로 이어서 실행됩니다.`,
    [pending]: `${pending}는 T2가 쓴 미확정 값입니다. 중단된 트랜잭션의 쓰기는 확정되지 않으므로 B는 ${answer} 그대로입니다.`,
    [Number(answer) + 1]: `롤백은 1을 다시 더하는 보상 계산이 아닙니다. 확정되지 않은 ${pending}를 버릴 뿐이므로 B는 ${answer} 그대로입니다.`,
  };
  return {
    question: "T2가 중단·롤백된 직후, B의 확정 재고는?",
    facts: [
      ["T1이 쓴 A", `${detect.state.rows.A.pending.value} · 미확정`],
      ["T2가 쓴 B", `${pending} · 미확정`],
      ["T1", "B 잠금 대기 중"],
    ],
    // Not in numeric order, so the answer is not always the middle or first.
    options: [Number(answer) + 1, pending, Number(answer)].map(String).map((id) => ({ id, label: `B = ${id}`, feedback: feedback[id] })),
    answerId: answer,
  };
}
