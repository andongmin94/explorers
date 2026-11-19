export const SOURCES = Object.freeze([
  {
    title: "PostgreSQL · Read Committed",
    url: "https://www.postgresql.org/docs/current/transaction-iso.html#XACT-READ-COMMITTED",
  },
  {
    title: "PostgreSQL · 행 잠금",
    url: "https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS",
  },
]);

export const MODEL_NOTES = Object.freeze([
  "PostgreSQL의 READ COMMITTED에서 재고 한 행을 다룹니다. 두 트랜잭션은 각각 재고를 1 줄이려 합니다.",
  "SELECT 결과를 앱이 기억하고 1을 뺀 숫자를 UPDATE에 넣습니다. SET stock = stock - 1이었다면 READ COMMITTED가 대기 후 새 행 버전에서 식을 다시 평가해 8이 됩니다.",
  "확정 재고와 아직 커밋하지 않은 값을 구분합니다. 화면의 버전 번호는 설명용이며 PostgreSQL의 실제 트랜잭션 ID가 아닙니다.",
  "일반 SELECT는 행 쓰기 잠금에 막히지 않습니다. 일반 UPDATE는 FOR NO KEY UPDATE, SELECT … FOR UPDATE는 FOR UPDATE 잠금을 얻습니다. 두 모드는 서로 충돌하므로 어느 방식이든 T2가 기다리고, 잠금은 COMMIT까지 유지됩니다.",
  "잠금 해제와 대기 요청의 재개는 관찰하려고 두 사건으로 나눴습니다. 실제 DB에서는 잠금이 풀리는 즉시 재개됩니다.",
  "사건 기록은 DB에 보낸 SQL, 앱에서 한 계산, 잠금을 기다리던 SQL의 재개를 각각 셉니다. 재개 사건에서 처음 대기한 요청을 다시 볼 수 있습니다.",
]);

// Plain-language glossary for the English labels printed in the scene.
export const SCENE_LEGEND = Object.freeze([
  "상태 · IDLE 시작 전 · ACTIVE 진행 중 · WAITING 잠금 대기 · COMMITTED 커밋 완료",
  "노트북 화면 · READ 앱이 읽은 값 · CALC 앱이 계산한 값",
  "DB 윗면 · LOCK 행 잠금 보유자 (FREE = 잠금 없음) · STOCK 확정 재고 · PENDING 커밋 전 쓰기",
]);

export function describeEventLog(steps) {
  const counts = { sql: 0, calculate: 0, resume: 0 };
  const waiting = new Map();
  const entries = steps.map((step) => {
    const kind = step.action.startsWith("resume-")
      ? "resume"
      : step.action === "calculate" ? "calculate" : "sql";
    const origin = kind === "resume" ? waiting.get(step.client) : null;
    if (step.action === "wait") waiting.set(step.client, step.index);
    if (kind === "resume") waiting.delete(step.client);
    counts[kind]++;
    return { step, kind, origin };
  });
  return { entries, counts };
}

export function describeStep(step, run) {
  const locked = run.mode === "locked";
  const who = step.client;
  const current = who ? step.state.clients[who] : null;
  const base = {
    eyebrow:
      step.index === 0 ? "대표 시나리오" : `${step.index}번째 사건 · ${who}`,
    title: "",
    summary: "",
    details: [],
    takeaway: "",
    sql: step.sql,
  };
  switch (step.action) {
    case "initial":
      return {
        ...base,
        title: "두 번 줄였는데, 재고는 몇 개일까?",
        summary:
          "재고 10개를 두 클라이언트가 각각 1개씩 줄입니다. 기대하는 최종 재고는 8개입니다.",
        details: [
          "각 클라이언트는 자신의 트랜잭션에서 읽기 → 앱 계산 → 쓰기 → 커밋을 수행합니다.",
          locked
            ? "이번에는 값을 읽을 때부터 FOR UPDATE로 행을 잠급니다."
            : "이번에는 일반 SELECT로 읽은 뒤, 앱이 계산한 숫자를 나중에 씁니다.",
        ],
        takeaway:
          "앱이 기억하는 값, DB의 미확정 값, 커밋된 값을 따로 따라가세요.",
      };
    case "begin":
      return {
        ...base,
        title: `${who} 트랜잭션 시작`,
        summary:
          "READ COMMITTED로 실행합니다. BEGIN만으로 이 재고 행을 잠그지는 않습니다.",
        details: [
          "일반 SELECT는 명령 시작 시점에 커밋된 버전을 읽습니다. 자기 트랜잭션의 앞선 쓰기는 커밋 전에도 읽을 수 있습니다.",
        ],
        takeaway: "트랜잭션을 시작한 것과 재고 행을 잠근 것은 다릅니다.",
      };
    case "read":
      return {
        ...base,
        title: `${who}가 재고 ${current.localRead}을 읽음`,
        summary: locked
          ? "FOR UPDATE가 행 잠금을 얻고 10을 반환합니다. T1이 끝날 때까지 다른 쓰기나 잠금 요청은 기다립니다."
          : `${who} 앱에 10이 전달됩니다. 일반 SELECT는 이 행을 쓰기용으로 잠그지 않습니다.`,
        details: [
          locked
            ? "일반 SELECT까지 차단하는 것은 아닙니다. 같은 행을 수정하거나 충돌하는 잠금을 얻으려는 요청을 막습니다."
            : "읽은 결과는 앱의 로컬 값입니다. DB가 나중에 바뀌어도 자동으로 갱신되지 않습니다.",
        ],
        takeaway: locked
          ? "계산에 사용할 값을 읽을 때부터 행을 보호합니다."
          : "두 앱이 같은 10을 읽을 수 있습니다.",
      };
    case "calculate":
      return {
        ...base,
        title: `${who} 앱에서 ${current.localRead} − 1 = ${current.localWrite}`,
        summary:
          "계산은 앱의 로컬 값으로 합니다. 이 사건에서는 DB에 SQL을 보내지 않습니다.",
        details: [
          `다음 UPDATE에 넣을 숫자는 ${current.localWrite}입니다.`,
          !locked && who === "T2"
            ? "T1이 9를 쓰는 중이어도 T2가 앞서 읽은 로컬 값은 10 그대로입니다."
            : "아직 계산만 했으므로 DB 재고 버전은 바뀌지 않습니다.",
        ],
        takeaway: "계산 결과와 DB에 저장된 값은 별개입니다.",
      };
    case "write":
      return {
        ...base,
        title: `${who}가 ${current.localWrite}을 쓰고 잠금 유지`,
        summary: `미확정 버전은 ${current.localWrite}이지만, 커밋된 재고는 아직 ${step.state.committedStock}입니다.`,
        details: [
          locked
            ? "읽을 때 얻은 FOR UPDATE 잠금을 계속 보유합니다."
            : "일반 UPDATE도 행 쓰기 잠금을 얻습니다 (FOR NO KEY UPDATE). 잠금 없이 덮어쓰는 상황이 아닙니다.",
          "자기 트랜잭션은 이 쓰기를 볼 수 있지만, 다른 트랜잭션의 일반 SELECT에는 아직 보이지 않습니다.",
        ],
        takeaway: "UPDATE가 끝나도 COMMIT 전까지 행 잠금은 유지됩니다.",
      };
    case "wait":
      return {
        ...base,
        title: locked ? "T2는 읽기 전에 대기" : "T2의 UPDATE도 잠금을 기다림",
        summary: locked
          ? "T1이 행을 잠갔으므로 T2의 SELECT FOR UPDATE가 멈춥니다. T2에는 아직 읽은 값이 없습니다."
          : "T1의 UPDATE가 행을 잠갔으므로 T2의 UPDATE가 대기합니다. 잠금이 풀리면 이 UPDATE는 무엇을 쓸까요?",
        details: [
          locked
            ? "T1이 쥔 FOR UPDATE 잠금과 T2가 요청한 FOR UPDATE 잠금이 충돌합니다."
            : "T1이 쥔 FOR NO KEY UPDATE 잠금과 T2의 UPDATE가 요청한 같은 잠금이 충돌합니다.",
          "대기 중인 SQL은 T1이 커밋하여 잠금을 놓으면 이어서 실행됩니다. 새로운 쿼리를 다시 보내는 과정이 아닙니다.",
        ],
        takeaway: locked
          ? "읽기 자체가 기다리므로 아직 계산할 값이 없습니다."
          : "T2의 UPDATE는 DB 안에서 잠금이 풀리기를 기다립니다.",
      };
    case "resume-read":
      return {
        ...base,
        title: "T2가 잠금을 얻고 갱신된 9를 읽음",
        summary:
          "대기하던 SELECT FOR UPDATE가 이어집니다. T1이 커밋한 버전을 잠그고 9를 반환합니다.",
        details: [
          "READ COMMITTED에서 대기 후 갱신된 행이 WHERE id = 1 조건을 계속 만족하므로 그 행을 반환합니다.",
          "T2의 첫 읽기 결과는 9입니다. 이전에 10을 읽고 다시 읽은 것이 아닙니다.",
        ],
        takeaway: "T2는 9에서 1을 빼므로 다음 쓰기는 8입니다.",
      };
    case "resume-write":
      return {
        ...base,
        title: "T2가 기다린 뒤에도 9를 씀",
        summary:
          "대기하던 UPDATE는 갱신된 행에 적용되지만, SET stock = 9라는 요청은 바뀌지 않습니다.",
        details: [
          "WHERE id = 1은 여전히 참입니다. DB가 앱의 10 − 1 계산을 9 − 1로 다시 수행하지는 않습니다.",
          "T2가 행 잠금을 얻어 새 미확정 버전 9를 만듭니다. T1의 감소 효과 하나가 사라집니다.",
          "SET stock = stock - 1이었다면 READ COMMITTED가 대기 후 새 행 버전(9)에서 식을 다시 평가해 8을 썼을 것입니다.",
        ],
        takeaway:
          "행 잠금이 있어도, 읽기와 쓰기 사이의 오래된 계산은 남을 수 있습니다.",
      };
    case "commit":
      if (who === "T1") {
        return {
          ...base,
          title: "T1이 9를 확정하고 잠금 해제",
          summary:
            "커밋된 재고가 10에서 9로 바뀝니다. T1의 미확정 버전이 확정되고 행 잠금을 놓습니다.",
          details: [
            locked
            ? "다음 사건에서 대기하던 SELECT FOR UPDATE가 재개됩니다. T2가 커밋한 뒤의 최종 재고를 예측하세요."
            : "다음 사건에서 대기하던 UPDATE가 재개됩니다. T2가 커밋한 뒤의 최종 재고를 예측하세요.",
          ],
          takeaway:
            "관찰하려고 잠금 해제와 재개를 두 사건으로 나눴습니다. 실제 DB에서는 잠금이 풀리는 즉시 재개됩니다.",
        };
      }
      return {
        ...base,
        title: locked
          ? "두 감소 모두 반영 · 최종 8개"
          : "감소 한 번 유실 · 최종 9개",
        summary: locked
          ? "T1은 10 → 9, T2는 9 → 8을 확정했습니다. 두 트랜잭션의 의도가 모두 반영됩니다."
          : "두 트랜잭션 모두 커밋했지만 10 → 9 한 번만 반영됐습니다. 이것이 이 시나리오의 갱신 유실입니다.",
        details: [
          locked
            ? "차이는 쓰기에 잠금이 있느냐가 아니라, 읽기부터 보호했느냐입니다."
            : "두 모드 모두 UPDATE는 잠금을 얻습니다. 일반 읽기 후 앱에서 만든 오래된 숫자가 문제였습니다.",
          "SET stock = stock - 1처럼 DB 안에서 감소시키면 대기 후 새 행 버전에서 식을 다시 평가하므로, 일반 UPDATE만으로도 8이 됩니다.",
        ],
        takeaway: locked
          ? "읽기 → 계산 → 쓰기를 같은 행 잠금으로 보호했습니다."
          : "SELECT FOR UPDATE 모드에서 T2가 언제 값을 얻는지 비교하세요.",
      };
  }
}

export function buildMilestones(run) {
  const locked = run.mode === "locked";
  return [
    {
      index: 3,
      label: "첫 읽기",
      description: locked ? "T1이 행을 잠그고 10을 읽음" : "T1이 10을 읽음",
    },
    {
      index: 4,
      label: locked ? "읽기 대기" : "같은 값",
      description: locked ? "T2의 읽기는 잠금을 기다림" : "T2도 10을 기억함",
    },
    {
      index: 6,
      label: "미확정 쓰기",
      description: "T1의 9와 확정 재고 10을 구분",
    },
    {
      index: locked ? 8 : 10,
      label: "차이가 나는 순간",
      description: locked
        ? "T2가 9를 읽고 계산을 시작"
        : "T2가 오래된 계산 결과 9를 씀",
    },
    {
      index: 11,
      label: "결과 확인",
      description: locked ? "최종 8 · 감소 2회 반영" : "최종 9 · 감소 1회 유실",
    },
  ];
}

// Asked at T1's commit, before the waiting request resumes: the final stock
// after T2 commits (9 with a plain read, 8 with FOR UPDATE). The facts shown
// never include T2's computed number, so the answer is not printed beforehand.
export function predictionFor(step, run) {
  if (step.action !== "commit" || step.client !== "T1") return null;
  const locked = run.mode === "locked";
  const t2 = step.state.clients.T2;
  const feedback = locked
    ? {
        8: "T2의 읽기 자체가 T1의 커밋을 기다렸으므로 확정된 9를 읽고 8을 씁니다. 대기가 계산보다 먼저 일어났기 때문입니다.",
        9: "T2가 10을 읽었다면 9가 됐을 것입니다. 하지만 FOR UPDATE 읽기가 T1의 커밋까지 기다렸으므로 T2는 아직 아무 값도 읽지 않았습니다.",
        10: "T1의 9는 이미 확정됐습니다. T2가 그 위에서 1을 더 빼므로 10으로 돌아가지 않습니다.",
      }
    : {
        8: "기다리면 최신 값으로 다시 계산될 것 같지만 그렇지 않습니다. T2의 UPDATE에는 앱이 10 − 1로 만든 숫자 9가 이미 들어 있고, DB는 그 숫자를 그대로 씁니다.",
        9: "잠금 대기는 쓰기 순서만 정합니다. T2는 앱이 10으로 계산한 9를 그대로 써서 커밋하므로 감소 한 번이 사라집니다.",
        10: "T1의 9는 이미 확정됐고 취소되지 않습니다. T2도 숫자를 써서 커밋하므로 10으로 돌아가지 않습니다.",
      };
  return {
    question: "T2가 커밋한 뒤 최종 확정 재고는 몇 개일까요?",
    facts: [
      ["현재 확정 재고", `${step.state.committedStock}개`],
      ["T2가 읽은 값", String(t2.localRead ?? "아직 없음")],
      ["T2가 기다리는 SQL", locked ? "SELECT … FOR UPDATE" : "UPDATE (앱이 계산한 숫자)"],
    ],
    options: ["8", "9", "10"].map((id) => ({ id, label: `${id}개`, feedback: feedback[id] })),
    answerId: String(run.stats.actualStock),
  };
}
