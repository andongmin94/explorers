import { eul, eun, ga } from "../../shared/josa.js";

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
  "이번 UPDATE는 DB 안에서 stock = stock - 1을 계산합니다. 앞선 갱신 유실 실험의 앱 계산과 다릅니다.",
  "PostgreSQL은 교착 상태를 감지하면 참여 트랜잭션 하나를 ERROR: deadlock detected (40P01)로 중단합니다.",
  "감지·중단·재개를 관찰하기 쉽게 나눴습니다. 실제 DB는 deadlock_timeout(기본 1초)만큼 기다린 뒤 순환을 검사하며, 이 화면은 그 시간을 재지 않습니다.",
  "중단된 트랜잭션의 잠금은 DB가 풀지만, 앱은 오류를 받은 트랜잭션 블록을 ROLLBACK으로 정리하고 필요하면 전체를 다시 실행해야 합니다. 이 실험은 재시도하지 않습니다.",
]);

// Plain-language glossary for the English labels printed in the scene.
export const DEADLOCK_LEGEND = Object.freeze([
  "상태 · ACTIVE 진행 중 · WAITING 잠금 대기 · TO ABORT 중단 대상 · ABORTED 중단됨 · COMMITTED 커밋 완료",
  "노트북 화면 · HOLD 보유한 행 잠금 · WAIT 기다리는 행",
  "UPD A = A 행 UPDATE 요청 · WAIT-FOR 바닥의 선 = 누가 누구를 기다리는지",
]);

export const ORDER_PLAN = Object.freeze({
  opposite: { T1: "A → B", T2: "B → A" },
  same: { T1: "A → B", T2: "A → B" },
});

// Labels stay neutral: the 장면 tab lists them before they happen, so they
// must not give the outcome away. Descriptions show once reached.
const MILESTONES = {
  opposite: [
    { index: 4, label: "각자 첫 잠금", description: "T1은 A, T2는 B 잠금 보유" },
    { index: 6, label: "두 번째 요청", description: "서로의 잠금 해제를 기다리는 순환" },
    { index: 7, label: "DB의 검사", description: "순환을 감지하고 중단 대상 선택" },
    { index: 8, label: "DB의 정리", description: "T2의 쓰기와 잠금·대기 요청 취소" },
    { index: 10, label: "완료", description: "남은 T1이 두 행을 확정" },
  ],
  same: [
    { index: 3, label: "첫 잠금", description: "T1이 A 잠금 보유" },
    { index: 4, label: "두 번째 요청", description: "T2는 잠금 없이 A에서 대기" },
    { index: 6, label: "잠금 해제", description: "T1이 A·B를 확정하고 해제" },
    { index: 7, label: "재개", description: "T2가 A에서 이어서 실행" },
    { index: 9, label: "완료", description: "두 주문 모두 확정" },
  ],
};

export function deadlockMilestones(order = "opposite") {
  return MILESTONES[order];
}

const other = (id) => (id === "T1" ? "T2" : "T1");
const joined = (rows) => rows.join("·");

export function describeDeadlockStep(step) {
  const order = step.order ?? "opposite";
  const same = order === "same";
  const s = step.state;
  const base = {
    eyebrow: step.index ? `${step.index}번째 사건 · ${step.client || "데이터베이스"}` : "02 레슨 · 시작 전",
    sql: step.sql,
    goal: "",
  };
  switch (step.action) {
    case "initial":
      return {
        ...base,
        title: same ? "같은 순서로 잠그면 어떻게 될까?" : "서로 반대 순서로 잠그면 어떻게 될까?",
        summary: same
          ? "T1과 T2 모두 A → B 순서로 두 행의 재고를 1씩 줄입니다. 먼저 얻은 행 잠금을 쥔 채 다음 행을 요청합니다."
          : "T1은 A → B, T2는 B → A 순서로 두 행의 재고를 1씩 줄입니다. 먼저 얻은 행 잠금을 쥔 채 다음 행을 요청합니다.",
        goal: "학습 목표: 행을 잠그는 순서가 두 트랜잭션의 대기와 결과를 어떻게 바꾸는지 설명한다.",
        details: ["처음 확정 재고는 A 10개, B 20개입니다. 각 주문은 두 행을 모두 처리한 뒤 커밋합니다."],
        key: "누가 무엇을 보유하고, 누구 때문에 기다리는지 함께 보세요.",
      };
    case "begin":
      return {
        ...base,
        title: `${step.client} 트랜잭션 시작`,
        summary: "BEGIN만으로 재고 행 잠금을 얻지는 않습니다. UPDATE가 행을 수정하면서 잠금을 얻습니다.",
        details: [`${eun(step.client)} ${ORDER_PLAN[order][step.client]} 순서로 수정할 계획입니다.`],
        key: same ? "두 트랜잭션의 수정 순서가 같습니다." : "두 트랜잭션의 수정 순서가 서로 반대입니다.",
      };
    case "write": {
      const held = s.clients[step.client].held;
      const waiter = s.clients[other(step.client)];
      return {
        ...base,
        title: `${step.client}의 ${step.row} 잠금 보유`,
        summary: `${step.row}의 미확정 값은 ${s.rows[step.row].pending.value}입니다. 확정 재고 ${s.rows[step.row].committed}개는 그대로입니다.`,
        details: [
          "UPDATE로 얻은 행 잠금은 커밋 또는 롤백까지 유지됩니다.",
          waiter.waitingFor
            ? `${eun(other(step.client))} 여전히 ${waiter.waitingFor}에서 기다립니다. ${other(step.client)}에게는 쥔 잠금이 없습니다.`
            : "다른 행은 다른 트랜잭션이 동시에 잠글 수 있습니다.",
        ],
        key:
          held.length === 2
            ? `${ga(step.client)} A와 B를 모두 보유합니다. 이제 커밋할 수 있습니다.`
            : s.clients[other(step.client)].held.length
              ? `현재 T1은 ${joined(s.clients.T1.held)}, T2는 ${joined(s.clients.T2.held)}를 보유합니다. 아직 대기는 없습니다.`
              : `${ga(step.client)} ${eul(step.row)} 보유한 채 다음 요청을 준비합니다.`,
      };
    }
    case "wait": {
      const owner = s.rows[step.row].owner;
      const held = s.clients[step.client].held;
      if (s.deadlocked)
        return {
          ...base,
          title: "T1 ↔ T2 · 순환 대기 완성",
          summary: "T1은 B를 가진 T2를, T2는 A를 가진 T1을 기다립니다. 둘 다 자신이 가진 잠금을 놓지 않아 진행할 수 없습니다.",
          details: [
            "기다리는 동안 먼저 얻은 잠금과 미확정 쓰기는 유지됩니다.",
            "단순히 느린 요청이 아닙니다. 기다림의 방향을 따라가면 원래 트랜잭션으로 돌아오는 순환입니다.",
          ],
          key: "T1 → B → T2 → A → T1의 고리를 확인하세요.",
        };
      return {
        ...base,
        title: `${eun(step.client)} ${ga(step.row)} 풀리기를 기다림`,
        summary: held.length
          ? `${eun(step.client)} ${eul(joined(held))} 보유한 채 ${owner}의 ${step.row} 잠금을 기다립니다. ${eun(owner)} 아직 다음 요청을 진행할 수 있습니다.`
          : `${eun(step.client)} 아무 잠금도 쥐지 않은 채 ${owner}의 ${step.row} 잠금을 기다립니다. ${eun(owner)} 계속 진행할 수 있습니다.`,
        details: [
          held.length
            ? "기다리는 동안 먼저 얻은 잠금과 미확정 쓰기는 유지됩니다."
            : `${eun(step.client)} 아직 아무 행도 잠그지 않았으므로 ${eul(owner)} 막지 않습니다.`,
          "한 방향의 대기만으로는 교착 상태가 아닙니다.",
        ],
        key: held.length
          ? `${step.client}의 대기와 ${step.client}의 ${joined(held)} 보유는 동시에 존재합니다.`
          : "같은 순서로 잠그면 늦게 온 쪽은 첫 행에서 기다립니다.",
      };
    }
    case "detect":
      return {
        ...base,
        title: "DB가 순환을 감지하고 T2를 중단 대상으로 선택",
        summary: "아직 롤백 전 장면이므로 잠금과 미확정 값은 그대로 보입니다.",
        details: [
          "PostgreSQL은 잠금을 deadlock_timeout(기본 1초) 동안 기다린 뒤 순환 검사를 합니다.",
          "어느 쪽이 중단될지는 예측하기 어렵습니다. 여기서는 설명을 위해 T2를 골랐습니다.",
        ],
        key: "감지와 정리를 따로 멈춰 관찰합니다. 다음 사건에서 T2의 효과를 함께 취소합니다.",
      };
    case "rollback":
      return {
        ...base,
        title: "T2 중단·롤백 · 고리가 끊어짐",
        summary:
          "A를 기다리던 T2의 UPDATE가 ERROR: deadlock detected (40P01)로 끝나고, T2의 B 미확정 값과 B 잠금이 사라집니다.",
        details: [
          "T1의 A 잠금과 미확정 9는 유지됩니다. B를 기다리던 T1의 요청은 이제 재개할 수 있습니다.",
          "DB는 T2를 재시도하지 않습니다. 앱이 ROLLBACK으로 정리해야 합니다.",
        ],
        key: "롤백은 값을 확정하는 동작이 아닙니다. 미확정 쓰기와 보유 잠금·대기를 정리합니다.",
      };
    case "resume": {
      const was = step.before.rows[step.row].committed;
      const value = s.rows[step.row].pending.value;
      return {
        ...base,
        title: `기다리던 ${step.client} 요청이 ${step.row}에서 재개`,
        summary: `새 SQL을 보내지 않고 DB에 대기 중이던 UPDATE가 이어집니다. ${ga(step.client)} ${step.row} 잠금을 얻고 확정 값 ${was}에서 1을 뺀 미확정 ${eul(value)} 만듭니다.`,
        details: same
          ? [
              `T1이 커밋한 새 버전 ${was}에서 stock - 1을 다시 평가합니다. T2가 처음 요청할 때의 10이 아닙니다.`,
              "T2는 이제 A를 보유하고 다음 B 요청을 보냅니다.",
            ]
          : [
              `T2의 변경이 버려졌으므로 원래 확정 버전 ${was}에서 1을 빼 ${ga(value)} 됩니다. T2가 커밋했다면 새 버전 ${value}에서 다시 평가해 ${ga(value - 1)} 됐을 것입니다.`,
              "T1은 이제 A와 B 잠금을 모두 보유합니다.",
            ],
        key: same
          ? "대기는 잠금을 쥐지 않은 채 끝났으므로 버릴 작업이 없습니다."
          : "숫자가 같아도 어느 트랜잭션의 쓰기인지 구분하세요.",
      };
    }
    case "commit": {
      const title = `${step.client} 완료 · A ${s.rows.A.committed}개, B ${s.rows.B.committed}개 확정`;
      if (same && step.client === "T1")
        return {
          ...base,
          title,
          summary: "T1의 A·B 쓰기가 함께 확정되고 두 행 잠금이 해제됩니다. A를 기다리던 T2의 UPDATE가 이어서 실행될 수 있습니다.",
          details: ["T2는 아무 잠금도 쥐지 않고 기다렸으므로 순환이 생기지 않았습니다."],
          key: "잠금이 풀리면 기다리던 요청이 새 확정 버전에서 이어집니다.",
        };
      if (same)
        return {
          ...base,
          title,
          summary: "두 주문의 감소가 모두 확정됐습니다. 커밋 2회, 롤백 0회입니다.",
          details: ["같은 순서로 잠그면 늦게 온 쪽은 첫 행에서 기다릴 뿐, 상대가 원하는 잠금을 쥐지 않습니다."],
          key: "같은 순서로 잠그면 대기는 생겨도 교착 상태는 생기지 않습니다.",
        };
      return {
        ...base,
        title,
        summary: "T1의 A·B 쓰기가 함께 확정되고 두 행 잠금이 해제됩니다. T2의 작업은 롤백되어 남지 않습니다.",
        details: [
          "커밋 1회, 롤백 1회입니다. 두 주문이 모두 성공한 결과가 아닙니다.",
          "실무 패턴: SELECT … WHERE id IN ('A', 'B') ORDER BY id FOR UPDATE; 로 필요한 행을 같은 순서로 먼저 잠근 뒤 UPDATE합니다.",
        ],
        key: "순서를 일관되게 유지해 예방하고, 중단 오류가 나면 앱에서 전체 트랜잭션 재시도를 판단합니다.",
      };
    }
  }
}

// Asked after T2's rollback, before T1's waiting UPDATE resumes: B's new
// uncommitted value. On screen B shows only its committed 20 and no pending
// write, so the answer (20 − 1 = 19, T1's write) is not printed beforehand.
// 18 assumes T2's 19 survived; 20 assumes T1's UPDATE was lost too.
export function deadlockPrediction(run) {
  const rollback = run.steps.find((step) => step.action === "rollback");
  if (!rollback) return null;
  const resumed = run.steps[rollback.index + 1].state;
  const committed = rollback.state.rows.B.committed;
  const answer = String(resumed.rows.B.pending.value);
  const stale = String(committed - 2);
  const lost = String(committed);
  const feedback = {
    [answer]: `T2의 ${eun(answer)} 롤백으로 버려졌습니다. 재개된 UPDATE의 stock - 1은 남아 있는 확정 버전 ${committed}에서 다시 평가되어 ${ga(answer)} 됩니다. 숫자는 같아도 이번 ${eun(answer)} T1의 쓰기입니다.`,
    [stale]: `T2의 ${ga(answer)} 남아 있다고 본 답입니다. 롤백으로 그 값은 버려졌으므로 T1은 확정 버전 ${committed}에서 1을 뺍니다. T2가 커밋했다면 ${ga(stale)} 됐을 것입니다.`,
    [lost]: `T1의 UPDATE도 사라진다고 본 답입니다. 중단된 것은 T2뿐이고, 기다리던 T1의 UPDATE는 다시 보낼 필요 없이 이어서 실행되어 ${committed}에서 1을 뺍니다.`,
  };
  return {
    question: "T1의 B UPDATE가 재개되면 B의 미확정 값은?",
    facts: [
      ["B 확정 값", String(committed)],
      ["T2의 B 쓰기", "롤백됨"],
      ["T1이 기다리는 SQL", "SET stock = stock - 1"],
    ],
    // Not in numeric order, so the answer is not always the middle or first.
    options: [stale, lost, answer].map((id) => ({ id, label: id, feedback: feedback[id] })),
    answerId: answer,
  };
}

export const DEADLOCK_RECAP = Object.freeze({
  points: [
    "각자 한 행을 잠근 채 상대의 행을 기다리면 순환 대기가 생기고, 누구도 스스로 진행할 수 없습니다.",
    "PostgreSQL은 순환을 감지하면 한 트랜잭션을 40P01로 중단하고 그 쓰기와 잠금을 버립니다. 앱은 ROLLBACK 후 다시 시도할지 정합니다.",
    "모든 트랜잭션이 같은 순서로 잠그면 늦게 온 쪽은 첫 행에서 기다릴 뿐, 순환이 생기지 않습니다.",
  ],
  recall: [
    {
      id: "aborted-write",
      question: "중단된 트랜잭션의 미확정 쓰기는?",
      choices: [
        { label: "버려진다", correct: true, why: "커밋 전 쓰기는 롤백과 함께 사라집니다." },
        { label: "DB가 다시 실행한다", why: "DB는 재시도하지 않습니다. 앱이 ROLLBACK 후 다시 실행합니다." },
        { label: "확정 값에 1을 더한다", why: "롤백은 보상 계산이 아닙니다. 미확정 값을 버릴 뿐입니다." },
      ],
    },
    {
      id: "same-order",
      question: "T1과 T2가 모두 A → B 순서로 잠그면?",
      choices: [
        { label: "그래도 교착 상태", why: "같은 순서면 T2는 A를 얻기 전까지 아무 잠금도 쥐지 않아 순환이 없습니다." },
        { label: "T2가 기다렸다 진행", correct: true, why: "T2는 잠금 없이 A에서 기다리다 T1이 커밋하면 이어서 실행됩니다." },
        { label: "T2가 즉시 오류", why: "잠금 충돌은 대기일 뿐입니다. 40P01은 순환이 있을 때만 납니다." },
      ],
    },
  ],
});
