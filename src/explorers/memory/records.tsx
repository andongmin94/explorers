// 관찰 기록: 프레임 기록 · 접근 기록 · 정책별 결과. The frame record is the
// kit's content table turned on its side: accesses are columns, the current
// access is the selected column (accent number in the header, accent tint
// down the column), rows alternate as in the kit. The access log shows a
// window of rows around the current one.
import { useRef } from "react";

import { Records } from "@/components/shell/console.tsx";
import { PlateHead } from "@/components/shell/plate.tsx";
import { rowClass, Table, Td, Th } from "@/components/ui/table.tsx";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs.tsx";
import { Label, Text } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import { useRowWindow } from "@/lib/fit.ts";
import { compulsoryCount } from "./lesson.ts";
import { Outcome, PageChip } from "./parts.tsx";
import type { Playback, PlaybackSnapshot } from "./playback.ts";
import type { Step } from "./types.ts";

export type RecordTab = "history" | "events" | "results";

const bodyClass = (masked: boolean) =>
  cn(
    "overflow-x-auto px-3.5 pt-3 pb-4 phone:p-3 phone:pb-4",
    "console:m-[4px_10px_10px] console:flex console:min-h-0 console:flex-auto console:flex-col console:overflow-hidden console:p-0",
    masked && "invisible",
  );

export function MemoryRecords({
  playback,
  snap,
  tab,
  onTab,
  masked,
}: {
  playback: Playback;
  snap: PlaybackSnapshot;
  tab: RecordTab;
  onTab: (tab: RecordTab) => void;
  masked: boolean;
}) {
  const lesson = playback.lesson;
  return (
    <Records aria-label="관찰 기록">
      <Tabs value={tab} onValueChange={(value) => onTab(value as RecordTab)}>
        <PlateHead>
          <TabsList aria-label="관찰 기록">
            <TabsTab value="history" data-record="history">
              프레임 기록
            </TabsTab>
            <TabsTab value="events" data-record="events">
              접근 기록{" "}
              <span id="event-count" className="text-label-2 tabular-nums">
                {snap.committed}
              </span>
            </TabsTab>
            <TabsTab value="results" data-record="results">
              {lesson.id === "belady" ? "프레임 수별 결과" : "정책별 결과"}
            </TabsTab>
          </TabsList>
          <Label className="whitespace-nowrap phone:hidden">기록을 눌러 그 접근으로 이동</Label>
        </PlateHead>
        <TabsPanel value="history" id="record-history" className={bodyClass(masked)}>
          <History playback={playback} snap={snap} />
        </TabsPanel>
        <TabsPanel value="events" id="record-events" className={bodyClass(masked)}>
          <Events playback={playback} snap={snap} />
        </TabsPanel>
        <TabsPanel value="results" id="record-results" className={bodyClass(masked)}>
          <Results playback={playback} snap={snap} />
        </TabsPanel>
      </Tabs>
    </Records>
  );
}

function History({ playback, snap }: { playback: Playback; snap: PlaybackSnapshot }) {
  const refs = playback.lesson.references;
  const { run, committed } = snap;
  const steps = run.steps;
  const seek = (i: number) => void playback.seek(i);
  const row = (label: string, cell: (s: Step | null, page: string) => React.ReactNode) => (
    <tr key={label} className="group/row">
      <th
        scope="row"
        className={cn(
          "h-8 px-2.5 text-left font-sans text-caption font-medium whitespace-nowrap text-label-2",
          "group-even/row:bg-fill-4",
        )}
      >
        {label}
      </th>
      {refs.map((page, i) => {
        const s = i < committed ? steps[i + 1] : null;
        const current = i + 1 === committed;
        return (
          // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- the column's header key is the keyboard path
          <td
            key={i}
            data-seek={i + 1}
            data-current={current || undefined}
            onClick={() => seek(i + 1)}
            className={cn(
              "h-8 cursor-pointer px-1.5 py-1 text-center align-middle",
              "group-even/row:bg-fill-4 hover:bg-fill-3!",
              current && "bg-sel-strong!",
            )}
          >
            {cell(s, page) ?? (
              <span aria-hidden className="text-label-4">
                ·
              </span>
            )}
          </td>
        );
      })}
    </tr>
  );
  return (
    <Table className="mem-history" data-frames={snap.run.frameCount}>
      <thead>
        <tr>
          <Th className="text-left">접근</Th>
          {refs.map((_, i) => (
            <Th
              key={i}
              aria-current={i + 1 === committed ? "true" : undefined}
              className="group/col text-center"
            >
              <button
                type="button"
                data-seek={i + 1}
                aria-label={`${i + 1}번째 접근으로 이동`}
                onClick={() => seek(i + 1)}
                className={cn(
                  "min-h-[22px] min-w-7 cursor-pointer rounded-full border-0 bg-transparent px-[7px] py-[2px]",
                  "font-sans text-caption font-medium text-label-2 tabular-nums",
                  "hover:text-label focus-visible:ring-focus",
                  "group-aria-[current=true]/col:bg-sel group-aria-[current=true]/col:font-semibold group-aria-[current=true]/col:text-label",
                )}
              >
                {i + 1}
              </button>
            </Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {row("요청", (s, page) => (
          <PageChip page={page} future={!s} />
        ))}
        {Array.from({ length: run.frameCount }, (_, slot) =>
          row(`F${slot}`, (s) =>
            s ? (
              <PageChip
                page={s.frames[slot].page}
                className={cn(
                  s.frames[slot].page &&
                    s.frameIndex === slot &&
                    s.fault &&
                    "shadow-[0_0_0_2px_var(--window),0_0_0_3.5px_var(--pg)]",
                )}
              />
            ) : null,
          ),
        )}
        {row("결과", (s) => (s ? <Outcome step={s} className="text-caption" /> : null))}
      </tbody>
    </Table>
  );
}

/** The 근거 column of the access log. */
function reasonOf(s: Step, algorithm: string) {
  if (s.hit) return "이미 상주";
  if (!s.victim) return "빈 프레임";
  const v = s.before[s.frameIndex];
  switch (algorithm) {
    case "fifo":
      return `적재 순서 가장 앞 · ${v.loadedAt}번째`;
    case "lru":
      return `마지막 접근 가장 이름 · ${v.lastUsedAt}번째`;
    case "opt":
      return v.nextUseAt === null ? "다시 쓰이지 않음" : `다음 접근 가장 늦음 · ${v.nextUseAt}번째`;
    default: {
      const swept = s.events.filter((e) => e.type === "sweep").length;
      return swept ? `비트 ${swept}개 끄고 · 참조 비트 0` : "참조 비트 0";
    }
  }
}

function Events({ playback, snap }: { playback: Playback; snap: PlaybackSnapshot }) {
  const { run, committed, mode } = snap;
  const box = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLTableSectionElement>(null);
  useRowWindow(box, body, [committed, mode.id]);
  const seek = (i: number) => void playback.seek(i);
  return (
    <div ref={box} className="console:min-h-0 console:flex-auto console:overflow-hidden">
      {committed === 0 ? (
        <Text id="events-empty" className="text-label-2">
          페이지에 접근하면 판정과 교체 근거가 기록됩니다.
        </Text>
      ) : (
        <Table id="events-table">
          <thead>
            <tr>
              <Th>접근</Th>
              <Th>페이지</Th>
              <Th>판정</Th>
              <Th>프레임</Th>
              <Th>교체</Th>
              <Th>근거</Th>
            </tr>
          </thead>
          <tbody ref={body} id="events-body">
            {run.steps.slice(1, committed + 1).map((s) => (
              // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- the access button is the keyboard path
              <tr
                key={s.index}
                data-seek={s.index}
                data-clickable=""
                aria-current={s.index === committed ? "true" : undefined}
                onClick={() => seek(s.index)}
                className={rowClass}
              >
                <Td className="align-middle">
                  <button
                    type="button"
                    data-seek={s.index}
                    aria-label={`${s.index}번째 접근으로 이동`}
                    className="cursor-pointer border-0 bg-transparent p-0 text-control text-inherit tabular-nums focus-visible:ring-focus"
                    onClick={(event) => {
                      event.stopPropagation();
                      seek(s.index);
                    }}
                  >
                    {s.index}번째
                  </button>
                </Td>
                <Td className="align-middle">
                  <PageChip page={s.page} />
                </Td>
                <Td className="align-middle">
                  <Outcome step={s} cold />
                </Td>
                <Td className="align-middle">F{s.frameIndex}</Td>
                <Td className="align-middle">{s.victim ? `${s.victim} → ${s.page}` : "—"}</Td>
                <Td className="align-middle">{reasonOf(s, run.algorithm)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

function Results({ playback, snap }: { playback: Playback; snap: PlaybackSnapshot }) {
  const lesson = playback.lesson;
  const at = snap.committed;
  const current = snap.run.steps[at];
  const cold = compulsoryCount(snap.run, at);
  return (
    <div>
      <Table>
        <thead>
          <tr>
            <Th>{lesson.modeLabel}</Th>
            <Th>처리한 접근</Th>
            <Th>페이지 부재</Th>
            <Th>적중</Th>
            <Th>페이지 교체</Th>
            <Th>적중률</Th>
          </tr>
        </thead>
        <tbody>
          {lesson.modes.map((m) => {
            const s = playback.runs[m.id].steps[at];
            return (
              <tr
                key={m.id}
                aria-current={m.id === snap.mode.id ? "true" : undefined}
                className={rowClass}
              >
                <Td>
                  <b>{m.label}</b>
                </Td>
                <Td className="tabular-nums">{s.index}회</Td>
                <Td className="tabular-nums">{s.faults}회</Td>
                <Td className="tabular-nums">{s.hits}회</Td>
                <Td className="tabular-nums">{s.replacements}회</Td>
                <Td className="tabular-nums">
                  {s.index ? `${Math.round((s.hits / s.index) * 100)}%` : "—"}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <Text className="mt-3 text-label-2">
        {at
          ? `${at}번째 접근까지 같은 순서를 두 조건에 적용한 결과입니다. ${snap.mode.label}의 부재 ${current.faults}회 중 ${cold}회는 처음 참조한 강제 부재이고, ${current.faults - current.replacements}회는 빈 프레임에 적재했습니다.`
          : "첫 접근 전에는 적중률을 계산하지 않습니다."}{" "}
        부재와 교체는 같은 횟수가 아닙니다.
      </Text>
    </div>
  );
}
