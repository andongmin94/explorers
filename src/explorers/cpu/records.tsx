// 관찰 기록: 실행 시간표 · 사건 기록 · 작업별 지표. The run chart is a
// Swift-Charts-like timeline (capsule lanes, capsule bars in the job colours,
// the accent playhead); the log shows a window of rows around the current one.
import { useRef } from "react";

import { Records } from "@/components/shell/console.tsx";
import { PlateHead } from "@/components/shell/plate.tsx";
import { Led } from "@/components/ui/content.tsx";
import { rowClass, Table, Td, Th } from "@/components/ui/table.tsx";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs.tsx";
import { Label } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import { useRowWindow } from "@/lib/fit.ts";
import { colorOf, number, recipe, stateNames } from "./format.ts";
import { eventLabel } from "./lesson.ts";
import type { Lesson } from "./lessons.ts";
import type { PlaybackSnapshot } from "./playback.ts";
import type { SimResult, Status } from "./types.ts";

export type RecordTab = "timeline" | "log" | "metrics";

const barBase = cn(
  "absolute top-[3px] bottom-[3px] flex min-w-1 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-transparent p-0",
  "bg-[var(--c)] bg-clip-padding font-sans text-caption font-semibold whitespace-nowrap text-white tabular-nums",
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
);
const barKind = {
  run: "",
  ready: "bg-[color-mix(in_srgb,var(--c)_var(--cpu-ready-mix),transparent)] bg-clip-padding",
  io: "[background:repeating-linear-gradient(135deg,color-mix(in_srgb,var(--c)_50%,transparent)_0_3px,color-mix(in_srgb,var(--c)_16%,transparent)_3px_7px)_padding-box] font-medium text-label",
  idle: "[background:repeating-linear-gradient(135deg,var(--fill-1)_0_3px,transparent_3px_7px)_padding-box] font-medium text-label-2 shadow-[inset_0_0_0_1px_var(--separator)]",
};
const swatch = "h-2 w-4 rounded-full";
const laneClass = "relative h-7 rounded-full bg-fill-3 console:h-full console:max-h-7";

export function CpuRecords({
  lesson,
  snap,
  tab,
  onTab,
  selected,
  onSeek,
  onSelect,
}: {
  lesson: Lesson;
  snap: PlaybackSnapshot;
  tab: RecordTab;
  onTab: (tab: RecordTab) => void;
  selected: string | null;
  onSeek: (time: number) => void;
  onSelect: (id: string) => void;
}) {
  const { result, time, frame } = snap;
  const hasIo = lesson.processes.some((p) => p.io.length);
  const entries = (time < 0 ? [] : result.frames.slice(0, time).concat(frame))
    .toReversed()
    .flatMap((f) => f.events.map((e) => ({ t: f.t, e })));

  return (
    <Records aria-label="관찰 기록">
      <Tabs value={tab} onValueChange={(value) => onTab(value as RecordTab)}>
        <PlateHead>
          <TabsList aria-label="관찰 기록">
            <TabsTab value="timeline" data-record="timeline">
              실행 시간표
            </TabsTab>
            <TabsTab value="log" data-record="log">
              사건 기록 <span className="text-label-2 tabular-nums">{entries.length}</span>
            </TabsTab>
            <TabsTab value="metrics" data-record="metrics">
              작업별 지표
            </TabsTab>
          </TabsList>
          <Label className="whitespace-nowrap phone:hidden">기록을 눌러 그 순간으로 이동</Label>
        </PlateHead>
        <TabsPanel value="timeline" className={bodyClass}>
          <Timeline lesson={lesson} snap={snap} hasIo={hasIo} onSeek={onSeek} />
        </TabsPanel>
        <TabsPanel value="log" className={bodyClass}>
          <EventLog entries={entries} snap={snap} onSeek={onSeek} />
        </TabsPanel>
        <TabsPanel value="metrics" className={bodyClass}>
          <Metrics lesson={lesson} snap={snap} selected={selected} onSelect={onSelect} />
        </TabsPanel>
      </Tabs>
    </Records>
  );
}

const bodyClass = cn(
  "px-3.5 pt-3 pb-4 phone:p-3 phone:pb-4",
  "console:m-[4px_10px_10px] console:flex console:min-h-0 console:flex-auto console:flex-col console:overflow-hidden console:rounded-lg console:p-0",
);

function Timeline({
  lesson,
  snap,
  hasIo,
  onSeek,
}: {
  lesson: Lesson;
  snap: PlaybackSnapshot;
  hasIo: boolean;
  onSeek: (time: number) => void;
}) {
  const { result, time, frame } = snap;
  const total = result.stats.makespan;
  const bar = (
    start: number,
    end: number,
    kind: keyof typeof barKind,
    color: string,
    label: string,
    title: string,
  ) => {
    const visibleEnd = Math.min(end, time);
    if (visibleEnd <= start) return null;
    const observed =
      title.replace(`${start}–${end} ms`, `${start}–${visibleEnd} ms`) +
      (visibleEnd < end ? " · 진행 중" : "");
    return (
      <button
        key={`${kind}-${start}`}
        type="button"
        data-time={start}
        title={observed}
        aria-label={observed}
        className={cn(barBase, barKind[kind])}
        style={
          {
            "--c": color,
            left: `${(start / total) * 100}%`,
            width: `${((visibleEnd - start) / total) * 100}%`,
          } as React.CSSProperties
        }
        onClick={() => onSeek(start)}
      >
        {label}
      </button>
    );
  };
  const elapsed = Math.max(0, time);
  const busy = result.frames.slice(0, elapsed).filter((f) => f.running).length;
  return (
    <div className="px-0.5 pt-0.5 pb-1 tabular-nums console:flex console:min-h-0 console:flex-auto console:flex-col console:py-2">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-separator-soft pb-2 text-caption font-medium text-label-2 console:mb-1 console:flex-none console:pb-1.5">
        <span className="inline-flex items-center gap-1.5">
          <i className={cn(swatch, "bg-[var(--p1)]")} />
          CPU 실행
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i
            className={cn(
              swatch,
              "bg-[color-mix(in_srgb,var(--p1)_var(--cpu-ready-mix),transparent)]",
            )}
          />
          준비 큐 대기
        </span>
        {hasIo && (
          <>
            <span className="inline-flex items-center gap-1.5">
              <i
                className={cn(
                  swatch,
                  "bg-[repeating-linear-gradient(135deg,color-mix(in_srgb,var(--p1)_50%,transparent)_0_3px,color-mix(in_srgb,var(--p1)_16%,transparent)_3px_7px)]",
                )}
              />
              입출력 대기
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i
                className={cn(
                  swatch,
                  "bg-[repeating-linear-gradient(135deg,var(--fill-1)_0_3px,transparent_3px_7px)] shadow-[inset_0_0_0_1px_var(--separator)]",
                )}
              />
              CPU 유휴
            </span>
          </>
        )}
        <span className="ms-auto text-label-2 tabular-nums">
          {hasIo
            ? `경과 ${elapsed} ms · CPU 실행 ${busy} ms · 유휴 ${elapsed - busy} ms`
            : `경과 ${elapsed} ms · 완료 ${frame.completed.length}/${lesson.processes.length}`}
        </span>
      </div>
      <div className="overflow-x-auto [scrollbar-color:var(--fill-1)_transparent] [scrollbar-width:thin] console:min-h-0 console:flex-auto console:overflow-hidden">
        <div id="timeline" className="console:h-full">
          <div
            className={cn(
              "relative grid grid-cols-[52px_minmax(560px,1fr)] items-center gap-x-2.5 gap-y-2 pe-3",
              "console:h-full console:grid-cols-[52px_minmax(0,1fr)] console:grid-rows-[22px_repeat(var(--lanes),minmax(0,1fr))] console:gap-x-2.5 console:gap-y-[3px]",
            )}
            style={{ "--lanes": lesson.processes.length + 1 } as React.CSSProperties}
          >
            <Label>ms</Label>
            <div className="relative h-6 console:h-[22px]">
              {Array.from({ length: total + 1 }, (_, t) => (
                <button
                  key={t}
                  type="button"
                  data-time={t}
                  aria-current={t === time ? "true" : undefined}
                  aria-label={`${t}밀리초로 이동`}
                  onClick={() => onSeek(t)}
                  style={{ left: `${(t / total) * 100}%` }}
                  className={cn(
                    "absolute top-px h-[22px] min-w-[22px] -translate-x-1/2 cursor-pointer rounded-full border-0 bg-transparent px-[5px] console:top-0",
                    "font-sans text-caption leading-[22px] font-medium text-label-2 tabular-nums",
                    "hover:bg-fill-3 hover:text-label",
                    "aria-[current=true]:bg-accent aria-[current=true]:font-semibold aria-[current=true]:text-on-accent",
                    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <Label>CPU</Label>
            <div className={laneClass}>
              {result.segments.map((s) =>
                bar(
                  s.start,
                  s.end,
                  s.id ? "run" : "idle",
                  colorOf(s.id),
                  s.id || "유휴",
                  `${s.start}–${s.end} ms · ${s.id || "CPU 유휴"}`,
                ),
              )}
            </div>
            {lesson.processes.map((p) => (
              <ProcessLane key={p.id} id={p.id} result={result} total={total} bar={bar} />
            ))}
            <i
              aria-hidden="true"
              className="pointer-events-none absolute top-[26px] bottom-0 -ml-px w-0.5 rounded-[1px] bg-accent console:top-6"
              style={{ left: `calc(62px + (100% - 74px) * ${Math.max(0, time) / total})` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ProcessLane({
  id,
  result,
  total,
  bar,
}: {
  id: string;
  result: SimResult;
  total: number;
  bar: (
    start: number,
    end: number,
    kind: "run" | "ready" | "io",
    color: string,
    label: string,
    title: string,
  ) => React.ReactNode;
}) {
  const runs: { start: number; end: number; state: Status }[] = [];
  for (let t = 0; t < total; t++) {
    const state = result.frames[t].states[id].status;
    if (!["running", "blocked", "ready"].includes(state)) continue;
    const last = runs.at(-1);
    if (last?.state === state && last.end === t) last.end++;
    else runs.push({ start: t, end: t + 1, state });
  }
  const kind = { running: "run", ready: "ready", blocked: "io" } as const;
  return (
    <>
      <Label>
        <Led color={colorOf(id)} />
        {id}
      </Label>
      <div className={laneClass}>
        {runs.map((s) =>
          bar(
            s.start,
            s.end,
            kind[s.state as "running" | "ready" | "blocked"],
            colorOf(id),
            s.state === "blocked" ? "입출력" : "",
            `${id} · ${s.start}–${s.end} ms · ${stateNames[s.state]}`,
          ),
        )}
      </div>
    </>
  );
}

function EventLog({
  entries,
  snap,
  onSeek,
}: {
  entries: { t: number; e: PlaybackSnapshot["frame"]["events"][number] }[];
  snap: PlaybackSnapshot;
  onSeek: (time: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLTableSectionElement>(null);
  useRowWindow(box, body, [entries.length, snap.time, snap.move]);
  return (
    <div
      ref={box}
      className="max-h-80 overflow-auto console:max-h-none console:min-h-0 console:flex-auto console:overflow-hidden"
    >
      <Table>
        <thead>
          <tr>
            <Th className="w-24">시각</Th>
            <Th className="w-24">작업</Th>
            <Th>일어난 일</Th>
          </tr>
        </thead>
        <tbody ref={body} id="event-log">
          {entries.map(({ t, e }, i) => (
            // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- the time button is the keyboard path
            <tr
              key={`${t}-${i}-${e.type}-${e.id}`}
              data-time={t}
              aria-current={t === snap.time ? "true" : undefined}
              className={rowClass}
              onClick={() => onSeek(t)}
            >
              <Td>
                <button
                  type="button"
                  data-time={t}
                  aria-label={`${t} ms 사건으로 이동`}
                  className="cursor-pointer border-0 bg-transparent p-0 text-control text-inherit tabular-nums focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSeek(t);
                  }}
                >
                  {t} ms
                </button>
              </Td>
              <Td className="whitespace-nowrap">
                <Led color={colorOf(e.id)} className="me-[3px] align-[1px]" /> {e.id || "CPU"}
              </Td>
              <Td>{eventLabel(e, snap.algorithm).replace(`${e.id} `, "")}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

function Metrics({
  lesson,
  snap,
  selected,
  onSelect,
}: {
  lesson: Lesson;
  snap: PlaybackSnapshot;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const frame = snap.frame;
  return (
    <div className="overflow-x-auto">
      <Table>
        <thead>
          <tr>
            <Th>작업 · 눌러서 자세히</Th>
            <Th>남은 CPU</Th>
            <Th title="도착부터 처음 CPU를 받기까지">최초 응답</Th>
            <Th title="준비 큐에서 기다린 누적 시간">대기 시간(준비 큐)</Th>
            <Th title="도착부터 완료까지 · 작업이 끝나면 표시">반환 시간</Th>
          </tr>
        </thead>
        <tbody id="metrics">
          {lesson.processes.map((p) => {
            const s = frame.states[p.id];
            const turnaround =
              s.finishedAt === null
                ? s.arriving
                  ? "도착 중"
                  : s.status === "new"
                    ? "도착 전"
                    : "진행 중"
                : `${s.finishedAt - p.arrival} ms`;
            const remaining =
              s.status === "done"
                ? "완료"
                : `${s.cpuRemaining} ms${s.status === "blocked" ? ` · 입출력 ${s.ioRemaining} ms` : ""}`;
            return (
              // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- the job button is the keyboard path
              <tr
                key={p.id}
                data-process={p.id}
                data-clickable=""
                aria-current={p.id === selected ? "true" : undefined}
                className={rowClass}
                onClick={() => onSelect(p.id)}
              >
                <Td>
                  <button
                    type="button"
                    data-process={p.id}
                    className="inline-flex cursor-pointer items-baseline gap-2 border-0 bg-transparent p-0 text-left text-control text-inherit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(p.id);
                    }}
                  >
                    <Led color={colorOf(p.id)} className="me-[3px] align-[1px]" />
                    <span>
                      <b className="tabular-nums">{p.id}</b> {p.name}
                      <span className="block text-caption text-label-2 tabular-nums console-short:hidden">
                        {p.arrival} ms 도착 · {recipe(p)}
                      </span>
                    </span>
                  </button>
                </Td>
                <Td className="tabular-nums">{remaining}</Td>
                <Td className="tabular-nums">
                  {s.firstRun === null ? "아직 실행 전" : `${number(s.firstRun - p.arrival)} ms`}
                </Td>
                <Td className="tabular-nums">{s.readyWait} ms</Td>
                <Td className="tabular-nums">{turnaround}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
