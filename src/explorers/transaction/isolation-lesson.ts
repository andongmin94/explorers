// Teaching content for the isolation-level lessons (03 REPEATABLE READ,
// 04 write skew): per-event 해설, 핵심 장면, predictions, comparison and 정리.
// Every PostgreSQL statement follows docs 13.2.1–13.2.3 and the SQLSTATE
// appendix (40001 serialization_failure).
import { eul, eun, ga } from "@/lib/josa.ts";
import {
  LEVELS,
  committedValue,
  type IsoClient,
  type IsoRun,
  type IsoState,
  type IsoStep,
  type Level,
  type ScenarioId,
  type Value,
} from "./isolation-engine.ts";
import type { ClientId, Milestone, Quiz, StepText } from "./types.ts";

/** Everything an isolation lesson (03, 04) gives the shared console. */
export interface IsoLesson {
  id: string;
  scenario: ScenarioId;
  modes: Partial<Record<Level, string>>;
  modeLabel: string;
  stageLabel: string;
  screens: [string, string];
  screenValues: (c: IsoClient) => (string | number)[];
  rows: { id: string; label: string }[];
  db: { title: string; sub: string };
  names: Record<ClientId, string>;
  token: (step: Pick<IsoStep, "action" | "row">) => string;
  valueText: (v: Value) => string;
  condition: string;
  rules: Partial<Record<Level, string>>;
  notes: string[];
  legend: string[];
  sources: { title: string; url: string }[];
  describe: (step: IsoStep, run: IsoRun) => StepText;
  milestones: (run: IsoRun) => Milestone[];
  prediction: (step: IsoStep, run: IsoRun) => Quiz | null;
  result: (
    run: IsoRun,
    state: IsoState,
    final: boolean,
  ) => {
    lcd: { label: string; value: number | string; unit: string };
    facts: [string, string][];
    text: string;
  };
  compare: {
    title: string;
    lead: string;
    column: (run: IsoRun) => {
      lcd: string;
      tag: string;
      rows: [ClientId, string][];
      text: string;
    };
    foot: string;
  };
  recap: {
    points: string[];
    recall: {
      id: string;
      question: string;
      answer?: string;
      choices: { label: string; correct?: boolean; why: string }[];
    }[];
  };
}

const DOCS = "https://www.postgresql.org/docs/current";
const SRC = {
  rc: {
    title: "PostgreSQL · Read Committed",
    url: `${DOCS}/transaction-iso.html#XACT-READ-COMMITTED`,
  },
  rr: {
    title: "PostgreSQL · Repeatable Read",
    url: `${DOCS}/transaction-iso.html#XACT-REPEATABLE-READ`,
  },
  ser: {
    title: "PostgreSQL · Serializable",
    url: `${DOCS}/transaction-iso.html#XACT-SERIALIZABLE`,
  },
  retry: { title: "직렬화 실패 처리", url: `${DOCS}/mvcc-serialization-failure-handling.html` },
};

const OK_SQL = (s: IsoStep) => s.sql ?? null;
const onOff = (v: Value) => (v ? "ON" : "OFF");
const DOCTOR: Record<ClientId, string> = { T1: "A", T2: "B" };

/* ------------------------------------------------------------------ */
/* 03 · REPEATABLE READ: the same two decrements, RC vs RR             */
/* ------------------------------------------------------------------ */

function rrStep(step: IsoStep, run: IsoRun): StepText {
  const rr = run.mode === "rr";
  const who = step.client as ClientId;
  // Every event but the start has a client.
  const c = (who ? step.state.clients[who] : null) as IsoClient;
  const retry = c?.attempt > 1;
  const base: StepText = {
    eyebrow: step.index ? `${step.index}번째 사건 · ${who}` : "03 레슨 · 시작 전",
    title: "",
    summary: "",
    goal: "",
    details: [],
    key: "",
    sql: OK_SQL(step),
  };
  switch (step.action) {
    case "initial":
      return {
        ...base,
        title: "더 강한 격리 수준이면 그냥 기다렸다 처리될까?",
        summary: `재고 10개를 두 주문이 1개씩 줄입니다. 이번에는 레슨 01과 달리 숫자 대신 식 UPDATE … SET stock = stock - 1을 보냅니다. 격리 수준은 ${LEVELS[run.mode]}입니다.`,
        goal: "학습 목표: 기다리던 UPDATE가 READ COMMITTED와 REPEATABLE READ에서 각각 어떻게 끝나는지, 40001 뒤에 왜 재시도해야 하는지 설명한다.",
        details: [
          "두 트랜잭션은 먼저 재고를 SELECT로 확인한 뒤 같은 행을 1 줄입니다. 기대하는 최종 재고는 8개입니다.",
        ],
        key: "각 트랜잭션이 어느 시점의 데이터를 보는지 따라가세요.",
      };
    case "begin":
      if (retry)
        return {
          ...base,
          title: `${ga(who)} 새 트랜잭션으로 다시 시도`,
          summary:
            "앱이 같은 작업을 처음부터 다시 실행합니다. 새 트랜잭션이므로 첫 문장에서 새 스냅숏을 잡습니다.",
          details: ["PostgreSQL 문서는 40001을 받으면 트랜잭션 전체를 다시 실행하라고 안내합니다."],
          key: "재시도는 실패한 문장 하나가 아니라 트랜잭션 전체입니다.",
        };
      return {
        ...base,
        title: `${who} 트랜잭션 시작`,
        summary: rr
          ? "REPEATABLE READ는 트랜잭션의 첫 문장이 시작될 때 스냅숏을 하나 잡고, 끝날 때까지 그 스냅숏으로 읽습니다."
          : "READ COMMITTED는 SQL 문마다 그 순간까지 커밋된 데이터를 새로 봅니다.",
        details: [
          rr
            ? "BEGIN만으로는 스냅숏을 잡지 않습니다. 첫 SELECT나 UPDATE가 잡습니다."
            : "BEGIN만으로 재고 행을 잠그지는 않습니다.",
        ],
        key: rr
          ? "스냅숏은 BEGIN이 아니라 첫 문장에서 시작합니다."
          : "스냅숏은 문장마다 새로 잡힙니다.",
      };
    case "select":
      if (retry)
        return {
          ...base,
          title: `${ga(who)} 새 스냅숏에서 재고 ${eul(c.read!)} 읽음`,
          summary: "새 트랜잭션의 첫 문장이 T1의 커밋 이후 스냅숏을 잡습니다.",
          details: ["이번에는 T2의 스냅숏 이후 이 행을 바꾸고 커밋한 트랜잭션이 없습니다."],
          key: "새 스냅숏에는 T1의 커밋이 들어 있습니다.",
        };
      return {
        ...base,
        title: `${ga(who)} 재고 ${eul(c.read!)} 읽음`,
        summary: rr
          ? `${who}의 스냅숏이 이 순간 잡힙니다. 이후 ${who}의 모든 문장은 이 순간의 데이터를 봅니다.`
          : "이 SELECT가 시작된 순간까지 커밋된 재고를 읽습니다. 다음 문장은 다시 새로 봅니다.",
        details: [
          "일반 SELECT는 행을 잠그지 않습니다. 감소는 앱 계산이 아니라 UPDATE가 DB 안에서 합니다.",
        ],
        key:
          who === "T2"
            ? rr
              ? "T2의 스냅숏은 T1이 아무것도 커밋하기 전입니다."
              : "T2가 읽은 10은 다음 UPDATE에 쓰이지 않습니다."
            : "읽은 값은 확인용입니다.",
      };
    case "write":
      return {
        ...base,
        title: `${ga(who)} stock − 1로 ${eul(step.state.rows[step.row!].pending!.value as number)} 쓰고 잠금 유지`,
        summary: `UPDATE가 행을 잠그고 미확정 버전 ${eul(step.state.rows[step.row!].pending!.value as number)} 만듭니다. 확정 재고는 아직 ${committedValue(step.state, step.row!)}입니다.`,
        details: [
          retry
            ? "T2의 스냅숏 이후 이 행을 바꾼 커밋이 없으므로 오류 없이 진행합니다."
            : "일반 UPDATE는 행에 FOR NO KEY UPDATE 잠금을 얻고 COMMIT 또는 ROLLBACK까지 유지합니다.",
        ],
        key: retry
          ? "재시도한 UPDATE는 최신 버전 위에서 실행됩니다."
          : "행 잠금은 트랜잭션이 끝날 때까지 유지됩니다.",
      };
    case "wait":
      return {
        ...base,
        title: "T2의 UPDATE가 T1의 잠금을 기다림",
        summary: "T2도 같은 행을 바꾸려 하므로 T1이 끝날 때까지 DB 안에서 기다립니다.",
        details: [
          rr
            ? "T2는 자기 스냅숏(재고 10)에서 행을 찾았지만, 그 행을 T1이 바꾸는 중입니다."
            : "T2가 보낸 것은 숫자가 아니라 식 stock - 1입니다.",
        ],
        key: "여기까지는 두 격리 수준이 똑같이 진행합니다.",
      };
    case "commit":
      if (who === "T1")
        return {
          ...base,
          title: "T1이 9를 확정하고 잠금 해제",
          summary:
            "확정 재고가 10에서 9로 바뀌고 행 잠금이 풀립니다. 기다리던 T2의 UPDATE는 다음 사건에서 이어집니다.",
          details: ["T1은 행을 잠그기만 한 것이 아니라 실제로 바꾸고 커밋했습니다."],
          key: "T2가 처음 찾은 행 버전은 이제 최신이 아닙니다.",
        };
      return {
        ...base,
        title: rr ? "재시도 후 두 감소 모두 반영 · 최종 8개" : "두 감소 모두 반영 · 최종 8개",
        summary: rr
          ? "T1의 10 → 9와 재시도한 T2의 9 → 8이 확정됐습니다."
          : "T1은 10 → 9, T2는 9 → 8을 확정했습니다. 오류도 재시도도 없었습니다.",
        details: rr
          ? [
              "결과는 READ COMMITTED와 같은 8이지만, 그 사이에 오류 한 번과 재시도가 필요했습니다.",
              "REPEATABLE READ를 쓰는 앱은 40001을 받으면 트랜잭션 전체를 다시 실행해야 합니다.",
            ]
          : [
              "T2의 UPDATE는 스냅숏(10)이 아니라 커밋된 새 버전⁠(9)⁠에서 다시 계산됐습니다. 한 트랜잭션이 두 시점의 데이터를 본 셈입니다.",
            ],
        key: rr
          ? "더 강한 격리 = 한 스냅숏의 일관성 + 앱의 재시도 책임."
          : "같은 입력을 REPEATABLE READ로 실행해 비교하세요.",
      };
    case "resume-write":
      return {
        ...base,
        title: "T2가 새 버전 9에서 다시 계산해 8을 씀",
        summary:
          "READ COMMITTED는 기다린 뒤 갱신된 행 버전에서 WHERE 조건과 stock - 1을 다시 평가합니다.",
        details: [
          "WHERE id = 1이 여전히 참이므로 9 − 1 = 8로 미확정 버전을 만듭니다.",
          "레슨 01과 달리 숫자가 아니라 식을 보냈으므로 감소가 사라지지 않습니다.",
        ],
        key: "READ COMMITTED: 기다린 뒤 새 버전으로 다시 평가합니다.",
      };
    case "error":
      return {
        ...base,
        title: "T2의 UPDATE가 40001 오류로 실패",
        summary:
          "T2의 스냅숏 이후 T1이 이 행을 바꾸고 커밋했습니다. REPEATABLE READ는 새 버전으로 다시 계산하지 않고 오류를 냅니다.",
        details: [
          `ERROR: ${step.error!.message} (SQLSTATE ${step.error!.code})`,
          "T2는 실패 상태가 됩니다. ROLLBACK 전까지 다른 SQL은 모두 거부됩니다.",
        ],
        key: "REPEATABLE READ: 기다린 뒤 다시 평가하지 않고 실패합니다.",
      };
    case "rollback":
      return {
        ...base,
        title: "T2가 ROLLBACK으로 실패한 트랜잭션을 끝냄",
        summary: "실패한 트랜잭션은 더 진행할 수 없습니다. 앱이 ROLLBACK을 보내 끝냅니다.",
        details: [
          "T2는 아무것도 쓰지 못했으므로 버릴 미확정 값은 없습니다. 스냅숏도 함께 사라집니다.",
        ],
        key: "40001 뒤에는 ROLLBACK → 처음부터 재시도.",
      };
  }
  return base;
}

const rrMilestones = (run: IsoRun): Milestone[] =>
  run.mode === "rr"
    ? [
        { index: 4, label: "같은 10", description: "T2의 스냅숏도 재고 10" },
        { index: 6, label: "UPDATE 대기", description: "T2가 T1의 행 잠금을 기다림" },
        { index: 8, label: "갈림길", description: "T2의 UPDATE가 40001로 실패" },
        { index: 11, label: "새 스냅숏", description: "재시도한 T2가 9를 읽음" },
        { index: 13, label: "결과 확인", description: "최종 8 · 오류 1회 · 재시도 1회" },
      ]
    : [
        { index: 4, label: "같은 10", description: "T2도 재고 10을 읽음" },
        { index: 6, label: "UPDATE 대기", description: "T2가 T1의 행 잠금을 기다림" },
        { index: 7, label: "T1 커밋", description: "확정 재고 9 · 잠금 해제" },
        { index: 8, label: "갈림길", description: "T2가 9에서 다시 계산해 8" },
        { index: 9, label: "결과 확인", description: "최종 8 · 오류 없음" },
      ];

function rrPrediction(step: IsoStep, run: IsoRun): Quiz | null {
  const rr = run.mode === "rr";
  if (step.action === "commit" && step.client === "T1") {
    const why = rr
      ? {
          reeval:
            "더 강한 격리가 기다렸다 처리해 줄 것 같지만, 새 버전으로 다시 평가하는 것은 READ COMMITTED의 동작입니다. REPEATABLE READ는 한 트랜잭션이 한 스냅숏만 보게 하므로 스냅숏 밖의 변경 위에 쓰지 않습니다.",
          stale: "PostgreSQL은 T1의 변경을 덮어쓰지 않습니다. 감소 하나를 잃는 대신 오류를 냅니다.",
          error:
            "T2의 스냅숏 이후 T1이 이 행을 바꾸고 커밋했습니다. REPEATABLE READ는 이때 40001 직렬화 오류를 냅니다.",
        }
      : {
          reeval:
            "READ COMMITTED는 기다린 뒤 갱신된 행을 다시 읽어 WHERE와 stock - 1을 다시 평가합니다. 9 − 1 = 8입니다.",
          stale:
            "레슨 01은 앱이 계산한 숫자를 보내서 그랬습니다. 이번에는 식 stock - 1을 보냈으므로 DB가 새 버전에서 다시 계산합니다.",
          error:
            "40001 concurrent update는 REPEATABLE READ 이상에서 납니다. READ COMMITTED는 오류 없이 새 버전으로 진행합니다.",
        };
    return {
      id: "resume",
      label: "T1 커밋 직후",
      target: "기다리던 UPDATE의 결과",
      question: "기다리던 T2의 UPDATE는 어떻게 될까요?",
      facts: [
        ["격리 수준", LEVELS[run.mode]],
        ["현재 확정 재고", `${committedValue(step.state, "1")}개`],
        ["T2가 앞서 읽은 값", String(step.state.clients.T2.read)],
        ["T2가 기다리는 SQL", "SET stock = stock - 1"],
      ],
      options: [
        { id: "reeval", label: "9에서 다시 계산 · 8", feedback: why.reeval },
        { id: "stale", label: "10 기준 · 9를 씀", feedback: why.stale },
        { id: "error", label: "40001 오류로 실패", feedback: why.error },
      ],
      answerId: rr ? "error" : "reeval",
    };
  }
  if (rr && step.action === "begin" && step.state.clients[step.client!].attempt === 2) {
    return {
      id: "retry-read",
      label: "재시도 시작",
      target: "다시 읽을 재고",
      question: "다시 시도한 T2의 SELECT는 재고를 몇으로 볼까요?",
      facts: [
        ["격리 수준", LEVELS.rr],
        ["T2의 이전 시도", "40001 → ROLLBACK"],
        ["T2가 처음 읽은 값", "10"],
      ],
      options: [
        {
          id: "10",
          label: "10",
          feedback:
            "이전 스냅숏은 실패한 트랜잭션과 함께 사라졌습니다. 새 트랜잭션은 첫 문장에서 새 스냅숏을 잡습니다.",
        },
        { id: "9", label: "9", feedback: "새 스냅숏은 T1의 커밋 뒤에 잡히므로 확정된 9를 봅니다." },
        {
          id: "8",
          label: "8",
          feedback:
            "8은 아직 아무도 만들지 않은 값입니다. 실패한 UPDATE는 아무것도 남기지 않았습니다.",
        },
      ],
      answerId: "9",
    };
  }
  return null;
}

const RR: IsoLesson = {
  id: "repeatable-read",
  scenario: "repeatable-read",
  modes: { rc: "READ COMMITTED", rr: "REPEATABLE READ" },
  modeLabel: "격리 수준",
  stageLabel: "스냅숏과 잠금의 흐름",
  screens: ["READ", "TRY"],
  screenValues: (c) => [c.read ?? "—", c.attempt || "—"],
  rows: [{ id: "1", label: "STOCK" }],
  db: { title: "재고 DB", sub: "INVENTORY · ID 1" },
  names: { T1: "T1 · 주문 1", T2: "T2 · 주문 2" },
  token: (step) => (step.action === "select" ? "SELECT" : "UPD −1"),
  valueText: (v) => String(v),
  condition:
    "PostgreSQL · 재고 10에서 두 주문이 각각 UPDATE inventory SET stock = stock - 1 WHERE id = 1 (기대 8). 각 주문은 BEGIN → SELECT → UPDATE → COMMIT, 고정된 사건 순서.",
  rules: {
    rc: "문장마다 새 스냅숏. 기다리던 UPDATE는 커밋된 새 버전에서 WHERE와 SET을 다시 평가합니다.",
    rr: "첫 문장의 스냅숏 하나로 끝까지. 스냅숏 이후 커밋된 변경이 있는 행을 갱신하면 40001로 실패합니다.",
  },
  notes: [
    "REPEATABLE READ의 스냅숏은 BEGIN이 아니라 트랜잭션의 첫 문장(SELECT, UPDATE 등)이 시작될 때 잡힙니다. READ COMMITTED는 문장마다 새로 잡습니다.",
    "REPEATABLE READ에서 기다리던 UPDATE는, 앞 트랜잭션이 행을 바꾸고 커밋하면 ERROR: could not serialize access due to concurrent update(40001)로 실패하고, 롤백하면 그대로 진행합니다.",
    "잠금 해제와 대기 요청의 재개(또는 실패)는 관찰하려고 두 사건으로 나눴습니다. 실제 DB에서는 잠금이 풀리는 즉시 이어집니다.",
    "실제 데이터베이스 연결이나 시간 측정 없이 한 행의 버전 변화를 재현합니다.",
  ],
  legend: [
    "상태 · ACTIVE 진행 중 · WAITING 잠금 대기 · ABORTED 오류로 실패 · ROLLED BACK 롤백 · COMMITTED 커밋",
    "노트북 화면 · READ 마지막 SELECT 결과 · TRY 몇 번째 시도인지",
    "DB 윗면 행 표 · STOCK 확정 재고 · NEW 커밋 전 쓰기 · LOCK 행 잠금 보유자 · WAIT 칸 = 기다리는 UPDATE",
  ],
  sources: [SRC.rc, SRC.rr, SRC.retry],
  describe: rrStep,
  milestones: rrMilestones,
  prediction: rrPrediction,
  result(run, state, final) {
    const v = committedValue(state, "1");
    return {
      lcd: { label: `${final ? "최종" : "현재"} 확정 재고`, value: v as number, unit: "개" },
      facts: [
        ["처음 · 기대", "10개 · 8개"],
        ["직렬화 오류", `${state.errors}회`],
        ["T2 시도", `${state.clients.T2.attempt || 0}회`],
      ],
      text: final
        ? run.mode === "rr"
          ? "T2는 40001을 받고 ROLLBACK한 뒤 다시 시도해 8을 만들었습니다."
          : "T2의 UPDATE가 새 버전에서 다시 계산돼 오류 없이 8이 됐습니다."
        : "마지막 커밋까지 재생해 최종 재고를 확인하세요.",
    };
  },
  compare: {
    title: "기다리던 UPDATE는 어떻게 끝날까?",
    lead: "두 수준 모두 T2의 UPDATE가 T1의 잠금을 기다립니다. 갈림길은 T1이 커밋한 직후, T2가 새 버전으로 다시 평가되는지 스냅숏 밖의 변경이라 실패하는지입니다.",
    column(run) {
      const rr = run.mode === "rr";
      return {
        lcd: `${committedValue(run.steps.at(-1)!.state, "1")}<small>개</small>`,
        tag: rr ? "오류 1회 · 재시도 후 반영" : "오류 없이 반영",
        rows: rr
          ? [
              ["T1", "10 → 9 커밋"],
              ["T2", "대기 → 40001 → ROLLBACK"],
              ["T2", "재시도: 9 읽기 → 8 커밋"],
            ]
          : [
              ["T1", "10 → 9 커밋"],
              ["T2", "대기 → 9에서 다시 평가 → 8 커밋"],
            ],
        text: rr
          ? "한 스냅숏만 보는 대신, 스냅숏 이후 바뀐 행은 쓰지 못하고 앱이 재시도합니다."
          : "기다린 UPDATE가 커밋된 새 버전을 봅니다. 단순 감소에는 맞지만, 한 트랜잭션이 두 시점을 섞어 봅니다.",
      };
    },
    foot: "40001은 재시도하라는 신호입니다. 재시도는 트랜잭션 전체(BEGIN부터)를 다시 실행합니다.",
  },
  recap: {
    points: [
      "READ COMMITTED에서 기다리던 UPDATE는 잠금이 풀리면 새 행 버전에서 WHERE와 SET 식을 다시 평가합니다.",
      "REPEATABLE READ는 첫 문장의 스냅숏 하나로 끝까지 실행합니다. 스냅숏 이후 다른 트랜잭션이 바꾸고 커밋한 행을 갱신하면 40001로 실패합니다.",
      "40001을 받으면 ROLLBACK하고 트랜잭션 전체를 다시 실행합니다. 새 트랜잭션은 새 스냅숏을 잡습니다.",
    ],
    recall: [
      {
        id: "rr-wait",
        question: "REPEATABLE READ에서 기다리던 UPDATE는 앞 트랜잭션이 행을 바꾸고 커밋하면?",
        answer: "40001 오류",
        choices: [
          {
            label: "새 버전으로 다시 계산",
            why: "그것은 READ COMMITTED의 동작입니다. REPEATABLE READ는 스냅숏 밖의 변경 위에 쓰지 않습니다.",
          },
          {
            label: "40001 오류로 실패",
            correct: true,
            why: "could not serialize access due to concurrent update로 실패합니다.",
          },
          {
            label: "40P01 교착 상태",
            why: "40P01은 서로 기다리는 순환이 있을 때입니다. 여기서는 T2만 기다렸습니다.",
          },
        ],
      },
      {
        id: "rr-retry",
        question: "40001을 받은 앱이 할 일은?",
        answer: "ROLLBACK 후 전체 재실행",
        choices: [
          {
            label: "실패한 UPDATE만 다시 보내기",
            why: "실패한 트랜잭션은 ROLLBACK 전까지 어떤 SQL도 실행하지 않습니다. 같은 스냅숏으로는 또 실패합니다.",
          },
          {
            label: "ROLLBACK 후 전체 재실행",
            correct: true,
            why: "새 트랜잭션이 새 스냅숏을 잡아 T1의 커밋을 보고 진행합니다.",
          },
          {
            label: "그대로 COMMIT",
            why: "실패한 트랜잭션의 COMMIT은 ROLLBACK으로 처리됩니다. T2의 감소는 반영되지 않습니다.",
          },
        ],
      },
    ],
  },
};

/* ------------------------------------------------------------------ */
/* 04 · write skew: two on-call doctors, RR vs SERIALIZABLE            */
/* ------------------------------------------------------------------ */

function wsStep(step: IsoStep, run: IsoRun): StepText {
  const ser = run.mode === "ser";
  const who = step.client as ClientId;
  // Every event but the start has a client.
  const c = (who ? step.state.clients[who] : null) as IsoClient;
  const me = (who ? DOCTOR[who] : null) as string;
  const other = me === "A" ? "B" : "A";
  const retry = c?.attempt > 1;
  const base: StepText = {
    eyebrow: step.index
      ? `${step.index}번째 사건 · ${who}${who ? ` · 의사 ${me}` : ""}`
      : "04 레슨 · 시작 전",
    title: "",
    summary: "",
    goal: "",
    details: [],
    key: "",
    sql: OK_SQL(step),
  };
  switch (step.action) {
    case "initial":
      return {
        ...base,
        title: "둘 다 확인했는데, 당직이 0명이 될 수 있을까?",
        summary: `당직 의사 A와 B가 동시에 당직을 빠지려 합니다. 각자 당직 인원을 세어 2명이면 자기 행만 OFF로 바꿉니다. 규칙은 '최소 1명은 당직'. 격리 수준은 ${LEVELS[run.mode]}입니다.`,
        goal: "학습 목표: 서로 다른 행을 쓰는 두 트랜잭션이 REPEATABLE READ에서 규칙을 깨는 이유와, SERIALIZABLE이 이를 막는 방법을 설명한다.",
        details: [
          "T1은 의사 A, T2는 의사 B의 요청입니다. 둘 다 BEGIN → 인원 세기 → 앱 판단 → 자기 행 UPDATE → COMMIT.",
        ],
        key: "각 트랜잭션이 판단에 쓴 행과 실제로 바꾼 행을 구분하세요.",
      };
    case "begin":
      if (retry)
        return {
          ...base,
          title: `${ga(who)} 새 트랜잭션으로 다시 시도`,
          summary:
            "앱이 같은 요청을 처음부터 다시 실행합니다. 새 트랜잭션은 첫 문장에서 새 스냅숏을 잡습니다.",
          details: ["SERIALIZABLE에서도 40001은 재시도하라는 신호입니다."],
          key: "재시도하면 판단도 다시 합니다.",
        };
      return {
        ...base,
        title: `${who} 트랜잭션 시작 · 의사 ${me}`,
        summary: ser
          ? "SERIALIZABLE은 REPEATABLE READ처럼 한 스냅숏으로 읽고, 추가로 트랜잭션 사이의 읽기·쓰기 의존을 추적합니다."
          : "REPEATABLE READ는 첫 문장의 스냅숏 하나로 트랜잭션 전체를 읽습니다.",
        details: ["BEGIN만으로 스냅숏을 잡거나 행을 잠그지는 않습니다."],
        key: ser
          ? "SERIALIZABLE = 차례로 실행한 것과 같은 결과만 커밋."
          : "스냅숏은 첫 문장에서 시작합니다.",
      };
    case "select":
      return {
        ...base,
        title: retry
          ? `${ga(who)} 새 스냅숏에서 당직 ${c.read}명 확인`
          : `${who}(의사 ${me})가 당직 ${c.read}명 확인`,
        summary: retry
          ? "새 스냅숏에는 T1의 커밋이 들어 있습니다."
          : `${who}의 스냅숏이 이 순간 잡힙니다. 이 스냅숏에서는 A와 B 모두 당직입니다.`,
        details: [
          ser
            ? "SERIALIZABLE은 이 읽기를 SIRead 잠금으로 기록합니다. 다른 트랜잭션을 막지는 않고 의존을 추적하는 데만 씁니다."
            : "일반 SELECT는 행을 잠그지 않으므로 다른 트랜잭션이 이 행들을 바꿀 수 있습니다.",
        ],
        key: retry
          ? "A는 이미 OFF로 확정됐습니다."
          : `${who}의 판단 근거는 의사 ${ga(other)} 당직이라는 사실입니다.`,
      };
    case "decide":
      return {
        ...base,
        title:
          c.plan === "off"
            ? `${who} 앱: ${c.read}명이므로 ${ga(me)} 빠져도 됨`
            : `${who} 앱: ${c.read}명뿐이므로 ${eun(me)} 빠질 수 없음`,
        summary:
          c.plan === "off"
            ? `앱이 규칙을 검사합니다. 이 판단은 ${who}의 스냅숏에서 본 ${c.read}명에 기대고 있습니다.`
            : "앱이 규칙에 따라 UPDATE를 보내지 않습니다.",
        details: ["앱 안의 판단이므로 DB에 SQL을 보내지 않습니다."],
        key:
          c.plan === "off"
            ? "판단이 맞으려면 커밋할 때까지 그 사실이 유지돼야 합니다."
            : "이번에는 규칙이 지켜집니다.",
      };
    case "write":
      return {
        ...base,
        title: `${ga(who)} ${eul(me)} OFF로 바꾸고 ${me} 잠금 유지`,
        summary: `UPDATE가 ${me} 행만 잠그고 미확정 값 OFF를 만듭니다.`,
        details: [
          who === "T2"
            ? "A와 다른 행이므로 잠금이 충돌하지 않고 기다리지 않습니다. 같은 행이 아니므로 레슨 03의 concurrent update 오류도 나지 않습니다."
            : "T2의 스냅숏에서는 A가 여전히 당직입니다.",
        ],
        key:
          who === "T2"
            ? "행 잠금은 서로 다른 행 사이의 충돌을 보지 못합니다."
            : "T1이 바꾼 A는 T2가 판단에 쓴 행입니다.",
      };
    case "commit":
      if (who === "T1")
        return {
          ...base,
          title: "T1 커밋 · A의 OFF 확정",
          summary:
            "A의 OFF가 확정되고 A 잠금이 풀립니다. T2는 아직 커밋 전이고, B를 OFF로 바꿔 둔 상태입니다.",
          details: ["T2가 바꾼 B는 T1이 판단에 쓴 행입니다."],
          key: "T2의 COMMIT이 남았습니다.",
        };
      if (retry)
        return {
          ...base,
          title: "규칙 유지 · 당직 1명",
          summary: "T2는 아무것도 바꾸지 않고 커밋합니다. A는 빠졌고 B는 당직으로 남습니다.",
          details: [
            "결과는 T1 다음에 T2를 차례로 실행한 것과 같습니다.",
            "SERIALIZABLE을 쓰는 앱도 40001을 받으면 트랜잭션 전체를 재시도해야 합니다.",
          ],
          key: "SERIALIZABLE: 순서대로 실행한 것과 같은 결과.",
        };
      return {
        ...base,
        title: "두 커밋 모두 성공 · 당직 0명",
        summary:
          "A와 B 모두 OFF로 확정됐습니다. 각 트랜잭션은 규칙을 지켰지만, 합친 결과는 '최소 1명' 규칙을 깹니다. 이것이 쓰기 왜곡(write skew)입니다.",
        details: [
          "REPEATABLE READ는 같은 행의 동시 갱신만 막습니다. 다른 행을 읽고 쓰는 조합은 검사하지 않습니다.",
          "막으려면 SERIALIZABLE을 쓰거나, 읽을 때 SELECT … FOR UPDATE로 판단에 쓴 행을 함께 잠가야 합니다.",
        ],
        key: "같은 입력을 SERIALIZABLE로 실행해 비교하세요.",
      };
    case "commit-error":
      return {
        ...base,
        title: "T2의 COMMIT이 40001로 실패",
        summary:
          "PostgreSQL이 두 트랜잭션 사이의 읽기·쓰기 의존 순환을 찾아 T2를 중단했습니다. T2의 B OFF는 버려지고 B 잠금이 풀립니다.",
        details: [
          `ERROR: ${step.error!.message} (SQLSTATE ${step.error!.code})`,
          "실패한 COMMIT으로 T2는 롤백된 채 끝납니다.",
        ],
        key: "T1은 T2가 읽은 A를, T2는 T1이 읽은 B를 바꿨습니다.",
      };
  }
  return base;
}

const wsMilestones = (run: IsoRun): Milestone[] =>
  run.mode === "ser"
    ? [
        { index: 4, label: "둘 다 2명", description: "두 스냅숏 모두 A·B 당직" },
        { index: 8, label: "다른 행 쓰기", description: "A와 B, 잠금 충돌 없음" },
        { index: 10, label: "갈림길", description: "T2의 COMMIT이 40001로 실패" },
        { index: 12, label: "새 스냅숏", description: "재시도한 T2가 1명을 셈" },
        { index: 14, label: "결과 확인", description: "당직 1명 · 규칙 유지" },
      ]
    : [
        { index: 4, label: "둘 다 2명", description: "두 스냅숏 모두 A·B 당직" },
        { index: 6, label: "두 판단", description: "둘 다 '빠져도 된다'" },
        { index: 8, label: "다른 행 쓰기", description: "A와 B, 잠금 충돌 없음" },
        { index: 9, label: "T1 커밋", description: "A OFF 확정" },
        { index: 10, label: "갈림길", description: "T2도 커밋 · 당직 0명" },
      ];

function wsPrediction(step: IsoStep, run: IsoRun): Quiz | null {
  const ser = run.mode === "ser";
  if (step.action === "commit" && step.client === "T1") {
    const why = ser
      ? {
          zero: "각자의 스냅숏만 보면 규칙이 지켜진 것 같지만, SERIALIZABLE은 두 트랜잭션을 함께 봅니다. 차례로 실행했다면 뒤의 트랜잭션은 1명을 보고 빠지지 않았을 것입니다.",
          fail: "T1은 T2가 읽은 A를, T2는 T1이 읽은 B를 바꿨습니다. 이 읽기·쓰기 의존이 순환하면 어떤 순서로도 같은 결과가 나올 수 없으므로 PostgreSQL이 한쪽을 40001로 중단합니다.",
          wait: "SIRead 잠금은 아무것도 막지 않습니다. T2는 A를 쓰지 않았으므로 기다릴 행 잠금도 없습니다.",
        }
      : {
          zero: "두 트랜잭션은 다른 행을 썼고, 각자의 스냅숏에서는 규칙이 지켜졌습니다. REPEATABLE READ는 이 조합을 검사하지 않으므로 둘 다 커밋되고 당직은 0명이 됩니다.",
          fail: "REPEATABLE READ의 40001은 같은 행을 동시에 갱신할 때 납니다(레슨 03). 여기서는 서로 다른 행을 썼습니다.",
          wait: "T2는 A를 쓰지 않았습니다. 일반 읽기는 잠금을 잡지 않으므로 기다릴 행이 없습니다.",
        };
    return {
      id: "commit",
      label: "T1 커밋 직후",
      target: "T2 커밋의 결과",
      question: "T2가 COMMIT하면 어떻게 될까요?",
      facts: [
        ["격리 수준", LEVELS[run.mode]],
        [
          "확정 · A / B",
          `${onOff(committedValue(step.state, "A"))} / ${onOff(committedValue(step.state, "B"))}`,
        ],
        ["T2가 센 당직", `${step.state.clients.T2.read}명`],
        ["T2의 미확정 쓰기", "B → OFF"],
      ],
      options: [
        { id: "zero", label: "커밋 성공 · 당직 0명", feedback: why.zero },
        { id: "fail", label: "40001로 실패 · 당직 1명", feedback: why.fail },
        { id: "wait", label: "A 잠금 대기", feedback: why.wait },
      ],
      answerId: ser ? "fail" : "zero",
    };
  }
  if (ser && step.action === "begin" && step.state.clients[step.client!].attempt === 2) {
    return {
      id: "retry-count",
      label: "재시도 시작",
      target: "다시 셀 당직 인원",
      question: "다시 시도한 T2는 당직을 몇 명으로 셀까요?",
      facts: [
        ["격리 수준", LEVELS.ser],
        ["T2의 이전 시도", "COMMIT → 40001"],
        ["T2가 처음 센 당직", "2명"],
      ],
      options: [
        {
          id: "2",
          label: "2명",
          feedback:
            "이전 스냅숏은 실패한 트랜잭션과 함께 사라졌습니다. 새 스냅숏에는 T1의 커밋(A OFF)이 들어 있습니다.",
        },
        {
          id: "1",
          label: "1명",
          feedback: "A는 OFF로 확정됐고, B는 T2의 롤백으로 여전히 당직입니다.",
        },
        {
          id: "0",
          label: "0명",
          feedback: "T2가 바꾼 B의 OFF는 롤백으로 버려졌습니다. B는 여전히 당직입니다.",
        },
      ],
      answerId: "1",
    };
  }
  return null;
}

const WS: IsoLesson = {
  id: "write-skew",
  scenario: "write-skew",
  modes: { rr: "REPEATABLE READ", ser: "SERIALIZABLE" },
  modeLabel: "격리 수준",
  stageLabel: "읽기와 쓰기의 의존",
  screens: ["COUNT", "PLAN"],
  screenValues: (c) => [c.read ?? "—", c.plan ? c.plan.toUpperCase() : "—"],
  rows: [
    { id: "A", label: "A" },
    { id: "B", label: "B" },
  ],
  db: { title: "당직 DB", sub: "DOCTORS · ON_CALL" },
  names: { T1: "T1 · 의사 A", T2: "T2 · 의사 B" },
  token: (step) => (step.action === "select" ? "COUNT" : `UPD ${step.row}`),
  valueText: onOff,
  condition:
    "PostgreSQL · 의사 A와 B 모두 당직(on_call = true), 규칙은 최소 1명 당직. 각 요청은 SELECT count(*) FROM doctors WHERE on_call → 2명 이상이면 UPDATE doctors SET on_call = false WHERE name = 자기 이름 → COMMIT. 고정된 사건 순서.",
  rules: {
    rr: "각자 한 스냅숏으로 읽고 자기 행만 씁니다. 같은 행을 동시에 갱신할 때만 40001이 납니다.",
    ser: "스냅숏 읽기 + 읽기·쓰기 의존 추적(SSI). 차례로 실행할 수 없는 조합이면 한쪽을 40001로 중단합니다.",
  },
  notes: [
    "PostgreSQL의 SERIALIZABLE은 SSI(직렬화 가능 스냅숏 격리)입니다. 읽기를 SIRead 잠금으로 기록하지만, 이 잠금은 대기를 만들지 않고 의존을 추적하는 데만 쓰입니다.",
    "이 화면은 두 트랜잭션 사이의 의존 순환만 검사하는 단순 모델이며, 나중에 커밋하는 T2가 COMMIT에서 실패합니다. 실제 PostgreSQL은 실행 순서에 따라 UPDATE나 다른 문장에서 중단할 수도 있습니다.",
    "REPEATABLE READ에서 쓰기 왜곡을 막으려면 판단에 쓴 행을 SELECT … FOR UPDATE로 잠그는 방법도 있습니다.",
    "실제 데이터베이스 연결이나 시간 측정 없이 두 행의 버전 변화를 재현합니다.",
  ],
  legend: [
    "상태 · ACTIVE 진행 중 · ROLLED BACK 롤백 · COMMITTED 커밋",
    "노트북 화면 · COUNT 센 당직 수 · PLAN 앱 판단 (OFF 빠짐, STAY 남음)",
    "DB 윗면 행 표 · ROW A·B의 DUTY 확정 on_call (ON/OFF) · NEW 커밋 전 쓰기 · LOCK 행 잠금 보유자",
  ],
  sources: [SRC.rr, SRC.ser, SRC.retry],
  describe: wsStep,
  milestones: wsMilestones,
  prediction: wsPrediction,
  result(run, state, final) {
    const a = committedValue(state, "A");
    const b = committedValue(state, "B");
    const n = [a, b].filter(Boolean).length;
    return {
      lcd: { label: `${final ? "최종" : "현재"} 당직 인원`, value: n, unit: "명" },
      facts: [
        ["확정 · A / B", `${onOff(a)} / ${onOff(b)}`],
        ["규칙 (최소 1명)", n >= 1 ? "지켜짐" : "깨짐"],
        ["직렬화 오류", `${state.errors}회`],
      ],
      text: final
        ? run.mode === "ser"
          ? "T2가 40001로 중단된 뒤 다시 세어 1명을 보고 당직에 남았습니다."
          : "두 트랜잭션이 각자 규칙을 지켰는데도 당직이 0명이 됐습니다."
        : "마지막 사건까지 재생해 당직 인원을 확인하세요.",
    };
  },
  compare: {
    title: "서로 다른 행을 쓰면 안전할까?",
    lead: "두 트랜잭션은 같은 두 행을 읽고 서로 다른 행을 씁니다. 갈림길은 T2의 COMMIT: 행 잠금으로는 충돌이 없고, SERIALIZABLE만 읽기·쓰기 의존을 함께 검사합니다.",
    column(run) {
      const ser = run.mode === "ser";
      return {
        lcd: `${run.stats.onCall}<small>명</small>`,
        tag: ser ? "규칙 유지 · 오류 1회" : "규칙 깨짐 · 오류 없음",
        rows: ser
          ? [
              ["T1", "2명 확인 → A OFF 커밋"],
              ["T2", "2명 확인 → B OFF → COMMIT 40001"],
              ["T2", "재시도: 1명 → 남음"],
            ]
          : [
              ["T1", "2명 확인 → A OFF 커밋"],
              ["T2", "2명 확인 → B OFF 커밋"],
            ],
        text: ser
          ? "차례로 실행한 결과와 같아지도록 한쪽을 중단하고, 앱이 재시도합니다."
          : "각자의 스냅숏에서는 맞는 판단이었지만, 합친 결과가 규칙을 깹니다.",
      };
    },
    foot: "REPEATABLE READ에서 막으려면 판단에 쓴 행을 SELECT … FOR UPDATE로 함께 잠급니다. SERIALIZABLE은 잠금 대기 없이 검사하는 대신 40001 재시도가 필요합니다.",
  },
  recap: {
    points: [
      "쓰기 왜곡: 두 트랜잭션이 같은 데이터를 읽고 서로 다른 행을 써서, 각자는 맞지만 합치면 규칙이 깨집니다.",
      "REPEATABLE READ는 같은 행의 동시 갱신만 40001로 막고, 다른 행을 쓰는 이 조합은 허용합니다.",
      "SERIALIZABLE은 읽기·쓰기 의존을 추적해 차례로 실행할 수 없는 조합의 한쪽을 40001로 중단합니다. 앱은 재시도해야 합니다.",
    ],
    recall: [
      {
        id: "ws-why",
        question: "REPEATABLE READ에서 두 의사가 모두 빠질 수 있었던 이유는?",
        answer: "다른 행이라 충돌이 없어서",
        choices: [
          {
            label: "다른 행이라 충돌이 없어서",
            correct: true,
            why: "A와 B는 서로 다른 행이므로 잠금도 concurrent update 검사도 걸리지 않습니다.",
          },
          {
            label: "최신 값을 다시 읽어서",
            why: "두 트랜잭션은 각자의 스냅숏을 봤고 다시 읽지 않았습니다.",
          },
          {
            label: "커밋 순서가 잘못돼서",
            why: "순서를 바꿔도 둘 다 커밋됩니다. 문제는 검사하지 않는 조합입니다.",
          },
        ],
      },
      {
        id: "ws-ser",
        question: "SERIALIZABLE이 T2를 중단한 근거는?",
        answer: "읽기·쓰기 의존의 순환",
        choices: [
          {
            label: "같은 행의 동시 갱신",
            why: "A와 B는 다른 행입니다. 그것은 레슨 03의 concurrent update 오류입니다.",
          },
          {
            label: "읽기·쓰기 의존의 순환",
            correct: true,
            why: "T1은 T2가 읽은 A를, T2는 T1이 읽은 B를 바꿨습니다.",
          },
          {
            label: "교착 상태 감지",
            why: "아무도 기다리지 않았습니다. 40P01이 아니라 40001입니다.",
          },
        ],
      },
    ],
  },
};

export const ISOLATION_LESSONS: Readonly<Record<ScenarioId, IsoLesson>> = Object.freeze({
  "repeatable-read": RR,
  "write-skew": WS,
});
