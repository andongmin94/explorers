// 학습 기록: 사건 기록 · 커밋 이력 · 병합 결과. Tables show a window of rows
// around the current one (nothing scrolls on the console). The event log's
// columns are sized once from every event of the run, so revealing an event
// never shifts them.
import { ArrowRightIcon } from "lucide-react";
import { useRef, useState } from "react";

import { Records } from "@/components/shell/console.tsx";
import { PlateHead } from "@/components/shell/plate.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Led } from "@/components/ui/content.tsx";
import { rowClass, Table, Td, Th } from "@/components/ui/table.tsx";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs.tsx";
import { Label, Text } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import { useRowWindow } from "@/lib/fit.ts";
import { LABELS } from "@/lib/lesson-kit.ts";
import { RESOLUTIONS } from "./engine.ts";
import { pad, titleOf } from "./format.ts";
import type { Lesson } from "./lesson-model.ts";
import type { Playback, PlaybackSnapshot } from "./playback.ts";
import type { GitState, Run } from "./types.ts";

export type RecordTab = "log" | "commits" | "result";

/** A row header: a secondary label on the row, aligned with its cells and striped with them. */
export function RowTh({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      scope="row"
      className={cn(
        "static border-b-0 py-[5px] pr-3 pl-2.5 text-left align-top font-sans text-caption font-semibold whitespace-nowrap text-label-2",
        className,
      )}
      {...props}
    />
  );
}

const bodyClass = cn(
  "px-3.5 pt-3 pb-4 phone:p-3 phone:pb-4",
  "console:m-[4px_10px_10px] console:flex console:min-h-0 console:flex-auto console:flex-col console:overflow-hidden console:rounded-lg console:p-0",
);

/** Widths for the command and HEAD columns from every event of the run (lengths only). */
function logColumns(run: Run) {
  const cmd = Math.max(...run.steps.map((s) => (s.command || "직접 편집").length));
  const head = Math.max(
    ...run.steps.map(
      (s) => `${s.state.currentBranch} → ${s.state.refs[s.state.currentBranch]}`.length,
    ),
  );
  return {
    "--git-col-cmd": `${(cmd * 0.6 + 2).toFixed(1)}em`,
    "--git-col-head": `${(head * 0.62 + 2).toFixed(1)}em`,
  } as React.CSSProperties;
}

export function GitRecords({
  lesson,
  playback,
  snap,
  tab,
  onTab,
  onCompare,
}: {
  lesson: Lesson;
  playback: Playback;
  snap: PlaybackSnapshot;
  tab: RecordTab;
  onTab: (tab: RecordTab) => void;
  onCompare: () => void;
}) {
  return (
    <Records aria-label="학습 기록">
      <Tabs value={tab} onValueChange={(value) => onTab(value as RecordTab)}>
        <PlateHead className="phone:overflow-hidden">
          <TabsList aria-label="학습 기록">
            <TabsTab value="log" data-record="log">
              사건 기록
            </TabsTab>
            <TabsTab value="commits" data-record="commits">
              커밋 이력
            </TabsTab>
            <TabsTab value="result" data-record="result">
              병합 결과
            </TabsTab>
          </TabsList>
          {tab === "log" && (
            <Label className="whitespace-nowrap phone:hidden">행을 눌러 그 순간으로 이동</Label>
          )}
        </PlateHead>
        <TabsPanel value="log" id="record-log" className={bodyClass}>
          <EventLog playback={playback} snap={snap} />
        </TabsPanel>
        <TabsPanel value="commits" id="record-commits" className={bodyClass}>
          <CommitLog lesson={lesson} snap={snap} />
        </TabsPanel>
        <TabsPanel
          value="result"
          id="record-result"
          className={cn(bodyClass, "console:px-[18px] console:pt-1 console:pb-2.5")}
        >
          <Result lesson={lesson} playback={playback} snap={snap} onCompare={onCompare} />
        </TabsPanel>
      </Tabs>
    </Records>
  );
}

const rowsBox =
  "max-h-80 overflow-auto console:max-h-none console:min-h-0 console:flex-auto console:overflow-hidden stacked:pb-3 [@media(max-height:699px)]:pb-3";

function EventLog({ playback, snap }: { playback: Playback; snap: PlaybackSnapshot }) {
  const box = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLTableSectionElement>(null);
  // Sized once, from the run the page opened with (as the vanilla sizeLogColumns()).
  const [columns] = useState(() => logColumns(snap.run));
  const { run, index, completed } = snap;
  useRowWindow(box, body, [run, index, completed]);
  return (
    <div ref={box} className={rowsBox}>
      <Table className="git-log table-fixed" style={columns}>
        <colgroup>
          <col className="w-[3.6em]" />
          <col className="w-[var(--git-col-cmd,30%)] phone:w-[42%]" />
          <col />
          <col className="w-[var(--git-col-head,22%)] phone:hidden" />
        </colgroup>
        <thead>
          <tr>
            <Th>#</Th>
            <Th>명령</Th>
            <Th>일어난 일</Th>
            <Th className="phone:hidden">HEAD</Th>
          </tr>
        </thead>
        <tbody ref={body} id="log-rows">
          {run.steps.map((s) => {
            const st = s.state;
            // Events not yet played show only their number: a future command or
            // title would answer the open prediction ("git add", "두 부모").
            const future = s.index > completed;
            const command = future ? "…" : s.command || (s.index ? "직접 편집" : "—");
            return (
              // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-noninteractive-element-interactions -- a row is a moment you can jump to, by click or Enter/Space (as the vanilla log)
              <tr
                key={s.index}
                data-time={s.index}
                tabIndex={0}
                aria-current={s.index === index ? "true" : undefined}
                className={cn(
                  rowClass,
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                  future && "is-future [&>td]:text-label-2",
                )}
                onClick={() => playback.jump(s.index)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  playback.jump(s.index);
                }}
              >
                <Td className="font-mono">{pad(s.index)}</Td>
                <Td>
                  {s.command && !future ? (
                    <code className="font-mono text-caption">{command}</code>
                  ) : (
                    command
                  )}
                </Td>
                <Td className="[overflow-wrap:anywhere]">{future ? "" : s.title}</Td>
                <Td className="font-mono phone:hidden">
                  {future ? "" : `${st.currentBranch} → ${st.refs[st.currentBranch]}`}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}

function CommitLog({ lesson, snap }: { lesson: Lesson; snap: PlaybackSnapshot }) {
  const box = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLTableSectionElement>(null);
  const state = snap.run.steps[snap.completed].state;
  useRowWindow(box, body, [state]);
  const colorOf = (c: GitState["commits"][number]) =>
    c.parents.length === 0 ? "base" : c.branch === "main" ? "main" : "feature";
  return (
    <div ref={box} className={rowsBox}>
      <Table>
        <thead>
          <tr>
            <Th>커밋</Th>
            <Th>부모</Th>
            <Th>브랜치</Th>
            <Th>메시지</Th>
            <Th>{lesson.commitColumn.label}</Th>
          </tr>
        </thead>
        <tbody ref={body} id="commit-rows">
          {state.commits.map((c) => (
            <tr key={c.id} className={cn(rowClass, c.orphan && "is-future [&>td]:text-label-2")}>
              <Td className="font-mono whitespace-nowrap">
                <Led color={`var(--git-${colorOf(c)})`} className="me-[3px] align-[1px]" /> {c.id}
              </Td>
              <Td className="font-mono">{c.parents.join(" + ") || "없음"}</Td>
              <Td className="font-mono">{c.orphan ? "없음" : c.branch}</Td>
              <Td>{c.message}</Td>
              <Td>{lesson.commitColumn.value(c.content)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

const resultGrid =
  "grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-start gap-7 phone:grid-cols-1 console:items-center console:gap-6";
const resultTd = "px-2.5 py-[5px] align-top font-mono keep-all console:py-[5px]";

/** 병합 결과: what the finished lesson left in the repository. */
function Result({
  lesson,
  playback,
  snap,
  onCompare,
}: {
  lesson: Lesson;
  playback: Playback;
  snap: PlaybackSnapshot;
  onCompare: () => void;
}) {
  const { run, completed, choice } = snap;
  const last = run.steps.length - 1;
  const state = run.steps[completed].state;
  if (completed !== last)
    return (
      <Text className="text-label-2">
        {state.commits.length}개 커밋 · 레슨을 끝까지 마치면 최종 결과가 나타납니다.
      </Text>
    );
  const rows = (list: [string, string][]) => (
    <Table>
      <tbody>
        {list.map(([th, td]) => (
          <tr key={th} className="even:[&>*]:bg-fill-4">
            <RowTh>{th}</RowTh>
            <td className={resultTd}>{td}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
  if (lesson.gate) {
    const chosen = RESOLUTIONS.find((r) => r.id === choice);
    if (!chosen) return null;
    return (
      <div className={resultGrid}>
        <div>
          <Label>병합 완료 · 갈라진 두 이력, 하나의 병합 커밋</Label>
          <Text className="mt-2.5">
            ‘{chosen.label}’ 해결안을 C3에 기록했습니다. 최종 제목은{" "}
            <strong>{titleOf(state.working)}</strong>입니다.
          </Text>
          <Text className="text-label-2">병합은 기존 커밋과 브랜치를 지우지 않습니다.</Text>
          <Button
            variant="filled"
            size="sm"
            data-action="choose-again"
            className="mt-2.5"
            onClick={() => playback.chooseAgain()}
          >
            다른 제목으로 결과 비교
            <ArrowRightIcon aria-hidden="true" />
          </Button>
        </div>
        {rows([
          ["부모 커밋", "C2 + C1"],
          ["현재 위치", "main → C3"],
          ["기능 브랜치", "feature/title → C1"],
          ["C2와 다른 줄", chosen.id === "ours" ? "0" : "1"],
        ])}
      </div>
    );
  }
  const summary = lesson.result![choice!];
  const merge = state.commits.find((c) => c.parents.length === 2);
  const orphan = state.commits.find((c) => c.orphan);
  return (
    <div className={resultGrid}>
      <div>
        <Label>{summary.headline}</Label>
        <Text className="mt-2.5">{summary.text}</Text>
        <Button
          variant="filled"
          size="sm"
          data-action="compare"
          className="mt-2.5"
          onClick={onCompare}
        >
          {LABELS.compareEnd}
        </Button>
      </div>
      {rows([
        ["병합 커밋", merge ? `${merge.id} · ${merge.parents.join(" + ")}` : "없음"],
        ["현재 위치", `main → ${state.refs.main}`],
        ["기능 브랜치", `feature/title → ${state.refs["feature/title"]}`],
        ["커밋 수", `${state.commits.length}${orphan ? ` (${orphan.id}은 브랜치 밖)` : ""}`],
      ])}
    </div>
  );
}
