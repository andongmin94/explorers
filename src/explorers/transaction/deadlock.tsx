// Lesson 02 · 교착 상태 (deadlock.html): the two transactions lock rows A
// and B in opposite or in the same order.
import { Fragment, useRef } from "react";

import { Table, Td, Th } from "@/components/ui/table.tsx";
import { Text } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import {
  ORDERS,
  simulateDeadlock,
  type DeadlockRun,
  type DeadlockState,
  type DeadlockStep,
  type Order,
  type RowId,
} from "./deadlock-engine.ts";
import {
  DEADLOCK_LEGEND,
  DEADLOCK_NOTES,
  DEADLOCK_RECAP,
  DEADLOCK_SOURCES,
  ORDER_PLAN,
  deadlockMilestones,
  deadlockPrediction,
  describeDeadlockStep,
} from "./deadlock-lesson.ts";
import { createDeadlockScene } from "./deadlock-scene.ts";
import type { RecordProps, TxPage, TxStep } from "./page.ts";
import {
  alertText,
  Code,
  FutureRow,
  quietText,
  SeekRow,
  tableClass,
  TxId,
  useFollowRows,
} from "./parts.tsx";
import { recordBodyClass } from "./records.tsx";
import { ResultsBlock, timelineCols } from "./results.tsx";
import type { PhaseReport } from "./stage.ts";
import type { ClientId } from "./types.ts";

const runs: Record<Order, DeadlockRun> = {
  opposite: simulateDeadlock({ order: "opposite" }),
  same: simulateDeadlock({ order: "same" }),
};
const ACTIONS: Record<DeadlockStep["action"], string> = {
  initial: "시작 전",
  begin: "시작",
  write: "쓰기",
  wait: "잠금 대기",
  detect: "교착 감지",
  rollback: "중단·롤백",
  resume: "쓰기 재개",
  commit: "커밋",
};
// Record groups, shown only once the learner has reached them.
const GROUPS: Record<Order, Record<number, string>> = {
  opposite: { 1: "01 · 잠금 확보", 5: "02 · 교착 상태", 8: "03 · 해소와 확정" },
  same: { 1: "01 · 잠금 확보", 4: "02 · 한 방향 대기", 7: "03 · 재개와 확정" },
};
const RULES: Record<Order, string> = {
  opposite: "T1은 A부터, T2는 B부터 잠급니다. 첫 잠금을 놓지 않은 채 상대가 잠근 행을 요청합니다.",
  same: "두 트랜잭션 모두 A부터 잠급니다. 늦게 온 쪽은 첫 행에서 기다립니다.",
};
const plan = (o: Order) => `T1 ${ORDER_PLAN[o].T1} · T2 ${ORDER_PLAN[o].T2}`;
const asStep = (step: TxStep) => step as unknown as DeadlockStep;
const IDS: ClientId[] = ["T1", "T2"];

function Timeline({ mode, snap, steps, onSeek }: RecordProps) {
  const box = useRef<HTMLDivElement>(null);
  useFollowRows(box, [snap.mode, snap.index, snap.done], {
    current: (tbody) => tbody.querySelector(`[data-step="${snap.index}"]`),
  });
  const actorText = (step: DeadlockStep, id: ClientId) => {
    if (step.action === "detect") return id === step.state.victim ? "중단 대상" : "대기 유지";
    if (step.client === id)
      return `${ACTIONS[step.action]}${step.row && step.action !== "rollback" ? ` ${step.row}` : ""}`;
    const c = step.state.clients[id];
    if (c.waitingFor)
      return `${step.state.rows[c.waitingFor].owner ? "잠금 대기" : "재개 가능"} ${c.waitingFor}`;
    return {
      idle: "—",
      active: "진행 중",
      committed: "커밋 완료",
      aborted: "중단됨 (ROLLBACK 필요)",
      waiting: "",
    }[c.status];
  };
  const blocked = (step: DeadlockStep, id: ClientId) => {
    const row = step.state.clients[id].waitingFor;
    return Boolean(row && step.state.rows[row].owner);
  };
  const rowCell = (step: DeadlockStep, row: RowId) => {
    const r = step.state.rows[row];
    return (
      <Td className="truncate whitespace-nowrap">
        {r.owner ? <TxId id={r.owner} /> : <span className={quietText}>잠금 없음 ·</span>}{" "}
        <span className="tabular-nums">
          확정 {r.committed}
          <span className={quietText}>
            {" "}
            · {r.pending ? `미확정 ${r.pending.value}` : "미확정 없음"}
          </span>
        </span>
      </Td>
    );
  };
  const groups = GROUPS[mode as Order];
  return (
    <div ref={box} id="record-timeline" className={recordBodyClass}>
      <Table className={cn(tableClass, "console:table-fixed")}>
        {timelineCols([9, 15, 15, 30.5, 30.5])}
        <thead>
          <tr>
            <Th>사건</Th>
            <Th>T1 · 주문 1</Th>
            <Th>T2 · 주문 2</Th>
            <Th>행 A</Th>
            <Th>행 B</Th>
          </tr>
        </thead>
        <tbody>
          {steps.slice(1).map((s) => {
            const step = asStep(s);
            const reached = step.index <= snap.done;
            if (!reached) return <FutureRow key={step.index} index={step.index} />;
            const actor = (id: ClientId) => (
              <Td
                className={cn(
                  "truncate",
                  blocked(step, id) ? alertText : step.client === id ? "" : quietText,
                )}
              >
                {actorText(step, id)}
              </Td>
            );
            return (
              <Fragment key={step.index}>
                {groups[step.index] && (
                  <tr>
                    <th
                      colSpan={5}
                      className="px-2.5 pt-3.5 pb-1 text-left text-caption font-semibold text-accent-text"
                    >
                      {groups[step.index]}
                    </th>
                  </tr>
                )}
                <SeekRow
                  index={step.index}
                  step
                  current={step.index === snap.index}
                  onSeek={onSeek}
                >
                  {actor("T1")}
                  {actor("T2")}
                  {rowCell(step, "A")}
                  {rowCell(step, "B")}
                </SeekRow>
              </Fragment>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}

function Log({ snap, steps, onSeek }: RecordProps) {
  const box = useRef<HTMLDivElement>(null);
  useFollowRows(box, [snap.mode, snap.index, snap.done]);
  const done = steps.slice(1, snap.done + 1).map(asStep);
  return (
    <div ref={box} id="record-log" className={recordBodyClass}>
      {!done.length ? (
        <Text id="log-empty" className="text-label-2 console:m-3">
          재생하면 각 요청과 잠금의 결과가 쌓입니다.
        </Text>
      ) : (
        <Table id="log-table" className={tableClass}>
          <thead>
            <tr>
              <Th>사건</Th>
              <Th>주체</Th>
              <Th>일어난 일</Th>
              <Th>SQL · DB 동작</Th>
              <Th>잠금</Th>
            </tr>
          </thead>
          <tbody>
            {done.map((step) => (
              <SeekRow
                key={step.index}
                index={step.index}
                current={step.index === snap.index}
                onSeek={onSeek}
              >
                <Td>
                  <TxId id={step.client ?? "DB"} />
                </Td>
                <Td>{describeDeadlockStep(step).title}</Td>
                <Td>
                  <Code>
                    {step.sql ||
                      (step.action === "rollback"
                        ? "T2의 A UPDATE → ERROR: deadlock detected (40P01)"
                        : "DB가 대기 관계의 순환을 확인")}
                  </Code>
                </Td>
                <Td className="whitespace-nowrap tabular-nums">
                  A {step.state.rows.A.owner || "—"} · B {step.state.rows.B.owner || "—"}
                </Td>
              </SeekRow>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

function Results({ mode, snap, steps }: RecordProps) {
  const state = asStep(steps[snap.done]).state;
  const final = snap.done === snap.last;
  const ending =
    mode === "same"
      ? "T2는 A에서 기다렸다가 이어서 실행했습니다. 두 주문의 감소가 모두 확정됐습니다."
      : "T2의 미확정 변경을 버리고 T1만 두 행의 감소를 확정했습니다. T2의 주문을 끝내려면 새 트랜잭션으로 다시 시도해야 합니다.";
  return (
    <ResultsBlock
      label={`${final ? "최종" : "현재"} 확정 재고 A · B`}
      lcd={[
        [state.rows.A.committed, "A"],
        [state.rows.B.committed, "B"],
      ]}
      facts={[
        ["처음 확정 재고", "A 10 · B 20"],
        ["커밋한 주문", `${state.commits} / 2`],
        ["롤백한 주문", `${state.rollbacks} / 2`],
      ]}
      text={
        final
          ? ending
          : "현재까지 완료한 사건의 결과입니다. 미확정 쓰기는 이 숫자를 아직 바꾸지 않습니다."
      }
    />
  );
}

const changes = (raw: unknown): [string, string][] => {
  const s = raw as DeadlockState;
  return [
    ...(["A", "B"] as RowId[]).flatMap((row): [string, string][] => [
      [`${row} 확정`, String(s.rows[row].committed)],
      [
        `${row} 미확정`,
        s.rows[row].pending
          ? `${s.rows[row].pending!.client} · ${s.rows[row].pending!.value}`
          : "없음",
      ],
      [`${row} 보유`, s.rows[row].owner || "없음"],
    ]),
    [
      "대기 요청",
      IDS.filter((id) => s.clients[id].waitingFor)
        .map((id) => {
          const row = s.clients[id].waitingFor!;
          return `${id} → ${row}${s.rows[row].owner ? "" : " (재개 가능)"}`;
        })
        .join(" / ") || "없음",
    ],
  ];
};

const COLUMNS: Record<Order, { verdict: string; t1: string; t2: string; text: string }> = {
  opposite: {
    verdict: "커밋 1 · 롤백 1",
    t1: "A → B · 커밋",
    t2: "B → A · 40P01로 중단",
    text: "T2가 B를 쥔 채 A를 기다리고, T1은 A를 쥔 채 B를 기다립니다. DB가 한쪽을 중단해야 고리가 풀립니다.",
  },
  same: {
    verdict: "커밋 2 · 롤백 0",
    t1: "A → B · 커밋",
    t2: "A 대기 → A → B · 커밋",
    text: "T2는 아무 잠금도 쥐지 않은 채 A에서 기다립니다. T1이 커밋하면 새 값에서 이어서 실행됩니다.",
  },
};

export const deadlockPage: TxPage = {
  lessonId: "deadlock",
  modes: ["opposite", "same"],
  modeLabels: ORDERS,
  modeField: "잠그는 순서",
  modeAria: "행을 잠그는 순서",
  modeAttr: "order",
  runs,
  stageLabel: "잠금과 대기의 연결",
  stageTag: () => "READ COMMITTED",
  createScene: (host, onPhase) =>
    createDeadlockScene(host, {
      onPhase: onPhase as (report: PhaseReport<DeadlockState>) => void,
    }),
  sceneLabel: "두 클라이언트가 재고 행 A와 B의 잠금을 서로 기다리는 장면",
  describe: (step) => describeDeadlockStep(asStep(step)),
  busyTitle: (step) => `${step.client || "DB"} · ${ACTIONS[asStep(step).action]}`,
  busyHint: "현재 장면의 잠금과 재고 변화를 따라가세요.",
  milestones: (mode) => deadlockMilestones(mode as Order),
  hideUnseenMilestones: false,
  stopAt: (mode, i) => deadlockMilestones(mode as Order).some((m) => m.index === i),
  prediction: (step, mode) =>
    step.action === "rollback" ? deadlockPrediction(runs[mode as Order]) : null,
  predictionKey: (mode) => mode,
  predictionTarget: () => "재개 후 B의 값",
  predictionWhere: () => "T2 롤백 직후",
  wrongAnswer: (quiz) => quiz.answerId,
  hideEmptySql: false,
  changes,
  noChange: "잠금과 재고는 바뀌지 않았습니다.",
  scope: {
    ruleLabel: "잠그는 순서",
    rules: RULES,
    condition:
      "PostgreSQL · READ COMMITTED · 고정된 사건 순서. 처음 확정 재고 A 10 · B 20, 각 UPDATE는 그 행의 stock − 1.",
    notes: [...DEADLOCK_NOTES],
    legend: [...DEADLOCK_LEGEND],
  },
  recap: { points: [...DEADLOCK_RECAP.points], recall: [...DEADLOCK_RECAP.recall] },
  sources: [...DEADLOCK_SOURCES],
  resultsTab: "재고 결과",
  Timeline,
  Log,
  Results,
  comparison: {
    title: "잠그는 순서만 바꾸면 무엇이 달라질까?",
    lead: "두 실행 모두 같은 A 10 · B 20에서 같은 UPDATE를 보냅니다. 갈림길은 T2가 처음 잠그는 행입니다. B를 먼저 잡으면 순환이 생기고, A를 먼저 요청하면 기다리기만 합니다.",
    columns: () =>
      (Object.keys(ORDERS) as Order[]).map((o) => {
        const c = COLUMNS[o];
        const { A, B } = runs[o].stats.finalStocks;
        return {
          mode: o,
          label: `${ORDERS[o]} · ${plan(o)}`,
          lcd: [
            [A, "A"],
            [B, "B"],
          ],
          tag: c.verdict,
          rows: [
            ["T1", c.t1],
            ["T2", c.t2],
          ],
          text: c.text,
        };
      }),
  },
};
