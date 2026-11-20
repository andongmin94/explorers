// Lesson 01 · 갱신 유실 (index.html, no ?lesson): plain SELECT or SELECT …
// FOR UPDATE before an app-computed UPDATE.
import { useRef } from "react";

import { Table, Td, Th } from "@/components/ui/table.tsx";
import { Label, Text } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import { simulate, type Mode, type Run, type State, type Step } from "./engine.ts";
import {
  MODEL_NOTES,
  RECAP,
  SCENE_LEGEND,
  SOURCES,
  buildMilestones,
  describeEventLog,
  describeStep,
  predictionFor,
} from "./lesson.ts";
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
import { createTransactionScene } from "./scene.ts";
import type { PhaseReport } from "./stage.ts";

const runs: Record<Mode, Run> = {
  naive: simulate({ mode: "naive" }),
  locked: simulate({ mode: "locked" }),
};
const ACTIONS: Record<Step["action"], string> = {
  initial: "시작 전",
  begin: "시작",
  read: "읽기",
  calculate: "앱 계산",
  write: "쓰기",
  wait: "잠금 대기",
  commit: "커밋",
  "resume-read": "읽기 재개",
  "resume-write": "쓰기 재개",
};
const MODES: Record<Mode, string> = { naive: "일반 SELECT", locked: "SELECT FOR UPDATE" };
const RULES: Record<Mode, string> = {
  naive: "읽은 값은 앱의 로컬 값으로 남고, 앱이 계산한 숫자를 UPDATE에 넣습니다.",
  locked:
    "값을 읽을 때부터 행을 보호합니다. 뒤에 온 FOR UPDATE는 앞 트랜잭션이 커밋한 값을 읽습니다.",
};

const asStep = (step: TxStep) => step as unknown as Step;
const run = (mode: string) => runs[mode as Mode];

function Timeline({ snap, steps, onSeek }: RecordProps) {
  const box = useRef<HTMLDivElement>(null);
  useFollowRows(box, [snap.mode, snap.index, snap.done], {
    current: (tbody) => tbody.querySelector(`[data-step="${snap.index}"]`),
  });
  const valueOf = (step: Step, id: "T1" | "T2") => {
    const c = step.state.clients[id];
    if (["read", "resume-read"].includes(step.action)) return c.localRead;
    if (["write", "resume-write", "calculate"].includes(step.action)) return c.localWrite;
    return null;
  };
  return (
    <div ref={box} id="record-timeline" className={recordBodyClass}>
      <Table className={cn(tableClass, "console:table-fixed")}>
        {timelineCols([10, 27, 27, 18, 18])}
        <thead>
          <tr>
            <Th>사건</Th>
            <Th>T1 · 주문 1</Th>
            <Th>T2 · 주문 2</Th>
            <Th>확정 재고</Th>
            <Th>행 잠금</Th>
          </tr>
        </thead>
        <tbody>
          {steps.slice(1).map((s) => {
            const step = asStep(s);
            if (step.index > snap.done) return <FutureRow key={step.index} index={step.index} />;
            const cell = (id: "T1" | "T2") => {
              if (step.client !== id) return <Td />;
              const value = valueOf(step, id);
              return (
                <Td className={cn("truncate", step.action === "wait" && alertText)}>
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
                <Td className="tabular-nums">{step.state.committedStock}</Td>
                <Td>
                  {step.state.rowLock.owner ? (
                    <TxId id={step.state.rowLock.owner} />
                  ) : (
                    <span className={quietText}>—</span>
                  )}
                </Td>
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
  const { entries, counts } = describeEventLog(steps.slice(1, snap.done + 1).map(asStep));
  return (
    <div ref={box} id="record-log" className={recordBodyClass}>
      {!entries.length ? (
        <Text id="log-empty" className="text-label-2 console:m-3">
          사건을 진행하면 요청과 계산, 대기 중이던 SQL의 재개가 차례로 기록됩니다.
        </Text>
      ) : (
        <>
          <Label as="p" id="log-sum" className="mb-1.5 flex console:mx-3 console:mt-2">
            새 SQL {counts.sql}건 · 앱 계산 {counts.calculate}건 · SQL 재개 {counts.resume}건
          </Label>
          <Table id="log-table" className={tableClass}>
            <thead>
              <tr>
                <Th>사건</Th>
                <Th>주체</Th>
                <Th>종류</Th>
                <Th>SQL · 계산</Th>
                <Th>DB 결과</Th>
              </tr>
            </thead>
            <tbody>
              {entries.map(({ step, kind, origin }) => {
                const c = step.state.clients[step.client!];
                const label =
                  kind === "sql"
                    ? `새 SQL · ${ACTIONS[step.action]}`
                    : kind === "resume"
                      ? `SQL 재개 · ${step.action === "resume-read" ? "읽기" : "쓰기"}`
                      : "앱 계산";
                const detail = step.sql || `${c.localRead} − 1 = ${c.localWrite}`;
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
                    <Td>
                      {label}
                      {kind === "resume" && origin !== null && (
                        <button
                          type="button"
                          data-origin={origin}
                          className={cn(
                            "mt-1 -mb-0.5 block cursor-pointer rounded-md border-0 bg-transparent p-0 text-left font-sans text-caption text-label-2 hover:text-accent-text",
                            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
                            "[tr[aria-current=true]_&]:text-inherit [tr[aria-current=true]_&]:opacity-78",
                          )}
                          onClick={(event) => {
                            event.stopPropagation();
                            void onSeek(origin);
                            requestAnimationFrame(() =>
                              document
                                .querySelector<HTMLElement>(`#record-log [data-seek="${origin}"]`)
                                ?.focus(),
                            );
                          }}
                        >
                          ↖ {origin}번 원요청 · 잠금 대기 시작
                        </button>
                      )}
                    </Td>
                    <Td>
                      <Code>{detail}</Code>
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums">
                      확정 {step.state.committedStock}
                      <span className={quietText}>
                        {" "}
                        ·{" "}
                        {step.state.uncommitted
                          ? `미확정 ${step.state.uncommitted.stock}`
                          : "미확정 없음"}
                      </span>
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
  return (
    <ResultsBlock
      label={`${final ? "최종" : "현재"} 확정 재고`}
      lcd={[[state.committedStock, "개"]]}
      facts={[
        ["처음 재고", "10개"],
        ["기대하는 최종 재고", "8개"],
        ["완료한 트랜잭션", `${state.completedTransactions} / 2`],
      ]}
      text={
        final
          ? mode === "naive"
            ? "두 트랜잭션이 모두 커밋했지만 재고 감소는 한 번만 남았습니다."
            : "T1의 10 → 9, T2의 9 → 8이 모두 반영됐습니다."
          : "이 값은 현재까지 완료한 사건의 결과입니다. 마지막 커밋까지 재생해 최종 재고를 확인하세요."
      }
    />
  );
}

const changes = (raw: unknown): [string, string][] => {
  const s = raw as State;
  return [
    ["확정 재고", `${s.committedStock}개`],
    ["미확정 값", s.uncommitted ? `${s.uncommitted.client} · ${s.uncommitted.stock}` : "없음"],
    ["잠금 보유", s.rowLock.owner || "없음"],
    [
      "대기 요청",
      s.rowLock.waiting.length
        ? `${s.rowLock.waiting.join(", ")}${s.rowLock.owner ? " · 잠금 대기" : " · 재개 가능"}`
        : "없음",
    ],
  ];
};

const code =
  "rounded-[5px] bg-fill-2 px-[5px] py-px font-mono text-label [font-variant-ligatures:none]";

export const lostUpdatePage: TxPage = {
  lessonId: "lost-update",
  modes: ["naive", "locked"],
  modeLabels: MODES,
  modeField: "값을 읽는 방법",
  modeAria: "읽기 잠금 방식",
  modeAttr: "mode",
  runs,
  stageLabel: "요청과 잠금의 흐름",
  stageTag: () => "READ COMMITTED",
  createScene: (host, onPhase) =>
    createTransactionScene(host, { onPhase: onPhase as (report: PhaseReport<State>) => void }),
  sceneLabel: "두 클라이언트와 재고 DB 사이의 SQL 요청과 행 잠금",
  describe: (step, mode) => describeStep(asStep(step), run(mode)),
  busyTitle: (step) => `${step.client} · ${ACTIONS[asStep(step).action]}`,
  busyHint: "장면의 현재 상태를 보며 이번 사건을 따라가세요.",
  milestones: (mode) => buildMilestones(run(mode)),
  hideUnseenMilestones: false,
  stopAt: (mode, i) =>
    buildMilestones(run(mode)).some((m) => m.index === i) ||
    Boolean(predictionFor(run(mode).steps[i], run(mode))),
  prediction: (step, mode) => predictionFor(asStep(step), run(mode)),
  predictionKey: (mode) => mode,
  predictionTarget: () => "최종 재고",
  predictionWhere: () => "T1 커밋 직후",
  wrongAnswer: (quiz) => quiz.options.find((o) => o.id === quiz.answerId)!.label,
  hideEmptySql: false,
  changes,
  noChange: "DB 상태는 바뀌지 않았습니다.",
  scope: {
    ruleLabel: "선택한 방식",
    rules: RULES,
    condition:
      "PostgreSQL · READ COMMITTED · 고정된 사건 순서. 재고 10에서 두 주문이 각각 1개 감소(기대 8). 한 주문은 읽기 → 앱에서 −1 → 계산한 숫자로 UPDATE → COMMIT.",
    notes: [...MODEL_NOTES],
    legend: [...SCENE_LEGEND],
  },
  recap: { points: [...RECAP.points], recall: [...RECAP.recall] },
  sources: [...SOURCES],
  resultsTab: "재고 결과",
  Timeline,
  Log,
  Results,
  comparison: {
    title: "잠금은 언제 시작해야 할까?",
    lead: "두 방식 모두 UPDATE가 행을 잠급니다. 차이는 T2가 계산에 사용할 값을 언제 읽는지입니다.",
    columns: () =>
      (["naive", "locked"] as Mode[]).map((m) => {
        const final = runs[m].stats.actualStock;
        return {
          mode: m,
          label: MODES[m],
          lcd: [[final, "개"]],
          tag: m === "naive" ? "감소 1회 유실" : "감소 2회 모두 반영",
          rows: [
            [
              "T1",
              <>
                읽기 <b className="tabular-nums">10</b> → 커밋 <b className="tabular-nums">9</b>
              </>,
            ],
            [
              "T2",
              <>
                읽기 <b className="tabular-nums">{m === "naive" ? 10 : 9}</b> → 커밋{" "}
                <b className="tabular-nums">{final}</b>
              </>,
            ],
          ],
          text:
            m === "naive"
              ? "T2는 먼저 읽은 10으로 계산한 9를 씁니다. 쓰기 잠금을 기다려도 이 숫자는 바뀌지 않습니다."
              : "T2의 읽기가 T1의 커밋을 기다립니다. 갱신된 9를 읽고 8을 계산합니다.",
        };
      }),
    foot: (
      <>
        다른 해법 · 원자적 UPDATE <code className={code}>SET stock = stock - 1</code>은 대기 후 새
        버전에서 다시 계산해 8 · 낙관적 검사 <code className={code}>WHERE stock = 10</code>이면 T2의
        UPDATE가 0행 → 앱이 다시 시도 · REPEATABLE READ에서는 T2의 UPDATE가 40001 직렬화 오류로
        실패합니다.
      </>
    ),
  },
};
