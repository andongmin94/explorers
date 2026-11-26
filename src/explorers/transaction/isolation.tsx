// Lessons 03 (REPEATABLE READ) and 04 (write skew) on index.html?lesson=…:
// the same console as lessons 01–02, driven by isolation-engine.ts and the
// content in isolation-lesson.ts.
import { useRef } from "react";

import { Table, Td, Th } from "@/components/ui/table.tsx";
import { Label, Text } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import {
  LEVELS,
  committedValue,
  simulateIsolation,
  type IsoRun,
  type IsoState,
  type IsoStep,
  type Level,
  type ScenarioId,
} from "./isolation-engine.ts";
import { ISOLATION_LESSONS } from "./isolation-lesson.ts";
import { isolationMisconceptions } from "./misconceptions.ts";
import { createIsolationScene } from "./isolation-scene.ts";
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

const ACTIONS: Record<IsoStep["action"], string> = {
  initial: "시작 전",
  begin: "시작",
  select: "읽기",
  decide: "앱 판단",
  write: "쓰기",
  wait: "잠금 대기",
  "resume-write": "쓰기 재개",
  error: "오류 40001",
  commit: "커밋",
  "commit-error": "커밋 실패 40001",
  rollback: "롤백",
};
const IDS: ClientId[] = ["T1", "T2"];
const asStep = (step: TxStep) => step as unknown as IsoStep;

export function isolationPage(lessonId: ScenarioId): TxPage {
  const L = ISOLATION_LESSONS[lessonId];
  const modes = Object.keys(L.modes) as Level[];
  const runs = Object.fromEntries(
    modes.map((m) => [m, simulateIsolation({ scenario: L.scenario, mode: m })]),
  ) as Record<string, IsoRun>;
  const misconceptions = Object.fromEntries(
    modes.map((m) => [m, isolationMisconceptions(runs[m])]),
  ) as Record<string, ReturnType<typeof isolationMisconceptions>>;
  const rowIds = L.rows.map((r) => r.id);
  const single = rowIds.length === 1;
  const text = L.valueText;
  const committedText = (state: IsoState) =>
    single
      ? text(committedValue(state, rowIds[0]))
      : rowIds.map((id) => `${id} ${text(committedValue(state, id))}`).join(" · ");
  const lockCell = (state: IsoState) => {
    const owners = rowIds.filter((id) => state.rows[id].owner);
    if (!owners.length) return <span className={quietText}>—</span>;
    return owners.map((id, i) =>
      single ? (
        <TxId key={id} id={state.rows[id].owner!} />
      ) : (
        <span
          key={id}
          className={cn(
            "inline-flex items-center gap-[5px] whitespace-nowrap",
            i < owners.length - 1 && "me-3",
          )}
        >
          {id} <TxId id={state.rows[id].owner!} />
        </span>
      ),
    );
  };
  const cellValue = (step: IsoStep) => {
    const c = step.state.clients[step.client!];
    switch (step.action) {
      case "select":
        return c.read;
      case "decide":
        return c.plan!.toUpperCase();
      case "write":
      case "resume-write":
        return text(step.state.rows[step.row!].pending!.value);
      default:
        return null;
    }
  };

  function Timeline({ snap, steps, onSeek }: RecordProps) {
    const box = useRef<HTMLDivElement>(null);
    useFollowRows(box, [snap.mode, snap.index, snap.done], {
      current: (tbody) => tbody.querySelector(`[data-step="${snap.index}"]`),
    });
    return (
      <div ref={box} id="record-timeline" className={recordBodyClass}>
        <Table className={cn(tableClass, "console:table-fixed")}>
          {timelineCols([10, 27, 27, 18, 18])}
          <thead>
            <tr>
              <Th>사건</Th>
              <Th>{L.names.T1}</Th>
              <Th>{L.names.T2}</Th>
              <Th>확정 값</Th>
              <Th>행 잠금</Th>
            </tr>
          </thead>
          <tbody>
            {steps.slice(1).map((s) => {
              const step = asStep(s);
              if (step.index > snap.done) return <FutureRow key={step.index} index={step.index} />;
              const cell = (id: ClientId) => {
                if (step.client !== id) return <Td />;
                const value = cellValue(step);
                const alert = ["wait", "error", "commit-error"].includes(step.action);
                return (
                  <Td className={cn("truncate", alert && alertText)}>
                    <TxId id={id} /> {ACTIONS[step.action]}
                    {value !== null && (
                      <>
                        {" "}
                        <b className="tabular-nums">{value}</b>
                      </>
                    )}
                  </Td>
                );
              };
              return (
                <SeekRow
                  key={step.index}
                  index={step.index}
                  step
                  current={step.index === snap.index}
                  onSeek={onSeek}
                >
                  {cell("T1")}
                  {cell("T2")}
                  <Td className="truncate tabular-nums">{committedText(step.state)}</Td>
                  <Td className="truncate">{lockCell(step.state)}</Td>
                </SeekRow>
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
    const kind = (step: IsoStep) =>
      step.action === "decide"
        ? "앱 판단"
        : step.action === "resume-write"
          ? "SQL 재개"
          : step.action === "error"
            ? "SQL 재개 · 오류"
            : step.action === "commit-error"
              ? "새 SQL · 오류"
              : "새 SQL";
    const counts = {
      sql: done.filter((x) => x.sql && !["resume-write", "error"].includes(x.action)).length,
      app: done.filter((x) => x.action === "decide").length,
      errors: done.filter((x) => x.error).length,
    };
    return (
      <div ref={box} id="record-log" className={recordBodyClass}>
        {!done.length ? (
          <Text id="log-empty" className="text-label-2 console:m-3">
            사건을 진행하면 보낸 SQL, 앱 판단, 대기 SQL의 재개와 DB 오류가 차례로 기록됩니다.
          </Text>
        ) : (
          <>
            <Label as="p" id="log-sum" className="mb-1.5 flex console:mx-3 console:mt-2">
              새 SQL {counts.sql}건{counts.app ? ` · 앱 판단 ${counts.app}건` : ""} · DB 오류{" "}
              {counts.errors}건
            </Label>
            <Table id="log-table" className={tableClass}>
              <thead>
                <tr>
                  <Th>사건</Th>
                  <Th>주체</Th>
                  <Th>종류</Th>
                  <Th>SQL</Th>
                  <Th>DB 결과</Th>
                </tr>
              </thead>
              <tbody>
                {done.map((step) => {
                  const c = step.state.clients[step.client!];
                  const detail = step.sql || `${L.screens[0]} ${c.read} → ${c.plan!.toUpperCase()}`;
                  return (
                    <SeekRow
                      key={step.index}
                      index={step.index}
                      current={step.index === snap.index}
                      onSeek={onSeek}
                    >
                      <Td>
                        <TxId id={step.client!} />
                      </Td>
                      <Td>{kind(step)}</Td>
                      <Td>
                        <Code>{detail}</Code>
                      </Td>
                      <Td className="whitespace-nowrap tabular-nums">
                        {step.error ? (
                          <span className={alertText}>ERROR {step.error.code}</span>
                        ) : (
                          `확정 ${committedText(step.state)}`
                        )}
                      </Td>
                    </SeekRow>
                  );
                })}
              </tbody>
            </Table>
          </>
        )}
      </div>
    );
  }

  function Results({ mode, snap, steps }: RecordProps) {
    const state = asStep(steps[snap.done]).state;
    const final = snap.done === snap.last;
    const r = L.result(runs[mode], state, final);
    return (
      <ResultsBlock
        label={r.lcd.label}
        lcd={[[r.lcd.value, r.lcd.unit]]}
        facts={r.facts}
        text={r.text}
      />
    );
  }

  const changes = (raw: unknown): [string, string][] => {
    const s = raw as IsoState;
    return [
      ...rowIds.flatMap((id): [string, string][] => [
        [single ? "확정 값" : `${id} 확정`, text(committedValue(s, id))],
        [
          single ? "미확정 값" : `${id} 미확정`,
          s.rows[id].pending
            ? `${s.rows[id].pending!.client} · ${text(s.rows[id].pending!.value)}`
            : "없음",
        ],
        [single ? "잠금 보유" : `${id} 잠금`, s.rows[id].owner || "없음"],
      ]),
      ["대기 요청", IDS.filter((id) => s.clients[id].waitingFor).join(", ") || "없음"],
      [
        "오류",
        IDS.filter((id) => s.clients[id].error)
          .map((id) => `${id} · ${s.clients[id].error!.code}`)
          .join(", ") || "없음",
      ],
    ];
  };

  // "8<small>개</small>" → [["8", "개"]]
  const lcdParts = (html: string): [string, string][] => {
    const [value, unit = ""] = html.split("<small>");
    return [[value, unit.replace("</small>", "")]];
  };

  return {
    lessonId,
    modes,
    modeLabels: L.modes as Record<string, string>,
    modeField: L.modeLabel,
    modeAria: L.modeLabel,
    modeAttr: "mode",
    runs,
    stageLabel: L.stageLabel,
    stageTag: (mode) => LEVELS[mode as Level],
    createScene: (host, onPhase) =>
      createIsolationScene(host, L, {
        onPhase: onPhase as (report: PhaseReport<IsoState>) => void,
      }),
    sceneLabel: `두 트랜잭션이 ${L.db.title}에 보내는 SQL과 행 잠금, 커밋된 값의 변화`,
    describe: (step, mode) => L.describe(asStep(step), runs[mode]),
    busyTitle: (step) => `${step.client} · ${ACTIONS[asStep(step).action]}`,
    busyHint: "장면의 현재 상태를 보며 이번 사건을 따라가세요.",
    milestones: (mode) => L.milestones(runs[mode]),
    hideUnseenMilestones: true,
    stopAt: (mode, i) =>
      L.milestones(runs[mode]).some((m) => m.index === i) ||
      Boolean(L.prediction(runs[mode].steps[i], runs[mode])),
    prediction: (step, mode) => L.prediction(asStep(step), runs[mode]),
    predictionKey: (mode, quiz) => `${mode}:${quiz.id}`,
    predictionTarget: (quiz) => quiz.target!,
    predictionWhere: (quiz) => quiz.label!,
    wrongAnswer: (quiz) => quiz.options.find((o) => o.id === quiz.answerId)!.label,
    hideEmptySql: true,
    changes,
    noChange: "DB 상태는 바뀌지 않았습니다.",
    scope: {
      ruleLabel: "선택한 수준",
      rules: L.rules as Record<string, string>,
      condition: L.condition,
      notes: L.notes,
      legend: L.legend,
    },
    recap: L.recap,
    misconceptions: (mode) => misconceptions[mode],
    sources: L.sources,
    resultsTab: "결과",
    Timeline,
    Log,
    Results,
    comparison: {
      title: L.compare.title,
      lead: L.compare.lead,
      columns: () =>
        modes.map((m) => {
          const col = L.compare.column(runs[m]);
          return {
            mode: m,
            label: L.modes[m]!,
            lcd: lcdParts(col.lcd),
            tag: col.tag,
            rows: col.rows,
            text: col.text,
          };
        }),
      foot: L.compare.foot,
    },
  };
}
