// 관찰 기록: 헤드 이동 경로 · 요청 기록 · 누적 결과. The route is a seek graph
// (processing order across, cylinder 0–199 down) whose stops are keys; the
// log shows a window of rows around the current one; the sweep lessons draw
// each request's wait at its cylinder (03 adds the worst wait under a stream).
import { useRef } from "react";

import { Records } from "@/components/shell/console.tsx";
import { PlateHead } from "@/components/shell/plate.tsx";
import { rowClass, Table, Td, Th } from "@/components/ui/table.tsx";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs.tsx";
import { Label, Text } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import { useRowWindow } from "@/lib/fit.ts";
import { REQUESTS, routePoints } from "./engine.ts";
import type { Lesson } from "./lessons.ts";
import { N, type PlaybackSnapshot } from "./playback.ts";
import type { Step } from "./types.ts";

export type RecordTab = "path" | "log" | "results";

const panelClass = cn(
  "px-2.5 pt-1 pb-2.5",
  "console:flex console:min-h-0 console:flex-auto console:flex-col console:overflow-hidden",
);
const chartClass =
  "px-3 pt-2 pb-1.5 tabular-nums console:flex console:min-h-0 console:flex-auto console:flex-col";
const chartHeadClass =
  "flex min-h-[22px] items-center gap-3 [&>:last-child:not(:first-child)]:ms-auto [&>:last-child:not(:first-child)]:font-medium [&_b]:font-semibold [&_b]:text-label";
const plotClass =
  "relative mt-[18px] mr-[22px] mb-3.5 ml-9 h-40 console:h-auto console:min-h-[72px] console:flex-auto";
const plotSvgClass = "absolute inset-0 size-full overflow-visible";
const gridLine = "stroke-[var(--separator)] [stroke-width:1] [vector-effect:non-scaling-stroke]";
const axisClass =
  "relative mr-[22px] ml-9 h-4 text-caption leading-4 text-label-2 [&>span]:absolute [&>span]:left-[var(--x)] [&>span]:-translate-x-1/2 [&>span]:whitespace-nowrap";

export function DiskRecords({
  lesson,
  snap,
  tab,
  onTab,
  onSeek,
}: {
  lesson: Lesson;
  snap: PlaybackSnapshot;
  tab: RecordTab;
  onTab: (tab: RecordTab) => void;
  onSeek: (index: number) => void;
}) {
  const seen = snap.run.steps.slice(0, snap.committed + 1);
  return (
    <Records aria-label="관찰 기록">
      <Tabs value={tab} onValueChange={(value) => onTab(value as RecordTab)}>
        <PlateHead>
          <TabsList aria-label="관찰 기록">
            <TabsTab value="path" data-record="path">
              헤드 이동 경로
            </TabsTab>
            <TabsTab value="log" data-record="log">
              요청 기록{" "}
              <span id="log-count" className="text-label-2 tabular-nums">
                {snap.committed}
              </span>
            </TabsTab>
            <TabsTab value="results" data-record="results">
              누적 결과
            </TabsTab>
          </TabsList>
          <Label className="whitespace-nowrap phone:hidden">
            완료한 요청을 눌러 그 순간으로 이동
          </Label>
        </PlateHead>
        <TabsPanel value="path" id="record-path" className={panelClass}>
          <RouteChart lesson={lesson} snap={snap} seen={seen} onSeek={onSeek} />
        </TabsPanel>
        <TabsPanel value="log" id="record-log" className={panelClass}>
          <RequestLog snap={snap} seen={seen} onSeek={onSeek} />
        </TabsPanel>
        <TabsPanel value="results" id="record-results" className={panelClass}>
          {lesson.waits ? (
            <WaitChart lesson={lesson} snap={snap} seen={seen} />
          ) : (
            <Metrics snap={snap} seen={seen} />
          )}
        </TabsPanel>
      </Tabs>
    </Records>
  );
}

const px = (k: number) => ((k / N) * 100).toFixed(2);
const py = (c: number) => ((c / 199) * 100).toFixed(2);
const TICKS = [0, 50, 100, 150, 199];

// A stop's label sits in a free corner next to its dot: on the left, on the
// vertical side away from the line arriving from the previous stop (the first
// stop uses the right, away from the line leaving it), so no line crosses it.
function labelPlace(seen: Step[], i: number) {
  const c = seen[i].state.head;
  const prev = seen[i - 1];
  const other = prev ?? seen[i + 1];
  const above = other ? other.state.head > c : true;
  return { left: Boolean(prev), above };
}

/** Head route: order across, cylinder 0–199 down. Each stop seeks to that moment. */
function RouteChart({
  lesson,
  snap,
  seen,
  onSeek,
}: {
  lesson: Lesson;
  snap: PlaybackSnapshot;
  seen: Step[];
  onSeek: (index: number) => void;
}) {
  const { committed, algorithm } = snap;
  const route = routePoints(snap.run.steps, committed);
  return (
    <div className={chartClass}>
      <div className={chartHeadClass}>
        <Label>
          <b>{lesson.names[algorithm]}</b>
          {committed} / {N} 요청 · 실린더 0 위, 199 아래
        </Label>
        <Label>
          {committed < N ? "처리한 요청만 표시" : `누적 ${seen[committed].state.total}칸`}
        </Label>
      </div>
      <div className={plotClass}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          className={plotSvgClass}
        >
          {TICKS.map((c) => (
            <line key={`r${c}`} className={gridLine} x1="0" y1={py(c)} x2="100" y2={py(c)} />
          ))}
          {Array.from({ length: N + 1 }, (_, k) => (
            <line
              key={`c${k}`}
              className={cn(gridLine, "stroke-[var(--separator-soft)]")}
              x1={px(k)}
              y1="0"
              x2={px(k)}
              y2="100"
            />
          ))}
          <polyline
            className="fill-none stroke-[var(--accent)] [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2.5] [vector-effect:non-scaling-stroke]"
            points={route.map(([c, k]) => `${px(k)},${py(c)}`).join(" ")}
          />
        </svg>
        {[0, 100, 199].map((c) => (
          <span
            key={c}
            className="absolute top-[var(--y)] right-[calc(100%+10px)] -translate-y-1/2 text-caption leading-none whitespace-nowrap text-label-2"
            style={{ "--y": `${py(c)}%` } as React.CSSProperties}
          >
            {c}
          </span>
        ))}
        {seen.map((s, i) => {
          const place = labelPlace(seen, i);
          const current = s.index === committed;
          return (
            <button
              key={s.index}
              type="button"
              data-seek={s.index}
              aria-current={current ? "true" : undefined}
              aria-label={`${s.index ? `${s.index}번째 요청, 헤드 ${s.state.head}` : "시작, 헤드 53"}으로 이동`}
              onClick={() => onSeek(s.index)}
              style={
                { "--x": `${px(s.index)}%`, "--y": `${py(s.state.head)}%` } as React.CSSProperties
              }
              className={cn(
                "group/stop absolute top-[var(--y)] left-[var(--x)] size-5 -translate-1/2 cursor-pointer rounded-full border-0 bg-transparent p-0 text-caption whitespace-nowrap text-label outline-none",
              )}
            >
              <i
                className={cn(
                  "absolute inset-[5px] rounded-full bg-accent-text shadow-[0_0_0_2px_var(--window)] group-hover/stop:inset-1",
                  "group-focus-visible/stop:shadow-[0_0_0_2px_var(--window),0_0_0_4px_var(--accent-text)]",
                  current &&
                    "inset-[3px]! bg-accent shadow-[0_0_0_2px_var(--window),0_0_0_3px_var(--accent-text)]",
                )}
              />
              <span
                className={cn(
                  "absolute flex items-baseline gap-1 leading-none",
                  place.left ? "right-[17px]" : "left-[17px]",
                  place.above ? "bottom-3" : "top-3",
                  current &&
                    cn(
                      "rounded-full bg-accent px-[7px] py-[3px] text-on-accent",
                      place.above ? "-mb-[3px]" : "-mt-[3px]",
                    ),
                )}
              >
                <b className={cn("font-semibold", !current && "group-hover/stop:text-accent-text")}>
                  {s.state.head}
                </b>
                {s.index > 0 && (
                  <small
                    className={cn(
                      "text-caption font-medium",
                      current ? "text-inherit opacity-72" : "text-label-2",
                    )}
                  >
                    +{s.distance}
                  </small>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <div
        aria-hidden="true"
        className={cn(
          axisClass,
          "[&>span:first-child]:translate-x-0 [&>span:last-child]:-translate-x-full",
        )}
      >
        {Array.from({ length: N + 1 }, (_, k) => (
          <span key={k} style={{ "--x": `${px(k)}%` } as React.CSSProperties}>
            {k ? `${k}번째` : "시작"}
          </span>
        ))}
      </div>
    </div>
  );
}

function RequestLog({
  snap,
  seen,
  onSeek,
}: {
  snap: PlaybackSnapshot;
  seen: Step[];
  onSeek: (index: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLTableSectionElement>(null);
  const { committed } = snap;
  useRowWindow(box, body, [committed, snap.algorithm]);
  return (
    <div ref={box} className="console:min-h-0 console:flex-auto console:overflow-hidden">
      {committed === 0 && (
        <Text id="log-empty" className="py-2 text-label-2">
          요청을 처리하면 선택 순서와 이동 거리가 기록됩니다.
        </Text>
      )}
      <Table id="log-table" hidden={committed === 0}>
        <thead>
          <tr>
            <Th>처리 순서</Th>
            <Th>원래 요청</Th>
            <Th>헤드 이동</Th>
            <Th>이번 거리</Th>
            <Th>누적 거리</Th>
          </tr>
        </thead>
        <tbody ref={body}>
          {seen.slice(1).map((s) => (
            // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- the order button is the keyboard path
            <tr
              key={s.index}
              data-seek-row={s.index}
              data-clickable=""
              aria-current={s.index === committed ? "true" : undefined}
              className={rowClass}
              onClick={() => onSeek(s.index)}
            >
              <Td>
                <button
                  type="button"
                  data-seek={s.index}
                  className="cursor-pointer border-0 bg-transparent p-0 text-control font-semibold text-inherit underline decoration-[var(--separator)] underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSeek(s.index);
                  }}
                >
                  {s.index}번째
                </button>
              </Td>
              <Td>요청 {s.request!.id}</Td>
              <Td>
                {s.before.head} → {s.state.head}
              </Td>
              <Td>{s.distance}칸</Td>
              <Td>{s.state.total}칸</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

/** Lesson 01: requests served, the average move and the longest single move. */
function Metrics({ snap, seen }: { snap: PlaybackSnapshot; seen: Step[] }) {
  const { committed } = snap;
  const s = seen[committed].state;
  const longest = Math.max(0, ...seen.slice(1).map((x) => x.distance));
  const metrics: [string, string, string][] = [
    ["처리한 요청", String(committed), `/ ${N}`],
    ["요청당 평균 이동", committed ? (s.total / committed).toFixed(1) : "—", "칸"],
    ["가장 긴 한 번 이동", committed ? String(longest) : "—", "칸"],
  ];
  return (
    <div className="px-3 pt-2">
      <dl className="m-0 flex flex-wrap gap-x-12 gap-y-4">
        {metrics.map(([label, value, unit]) => (
          <div key={label} className="grid gap-1">
            <Label as="dt">{label}</Label>
            <dd className="m-0 text-large leading-[1.1] font-bold tabular-nums">
              {value}
              <small className="ms-1 text-caption font-medium text-label-2">{unit}</small>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2.5 text-caption leading-[1.6] text-label-2 keep-all">
        {committed === N
          ? "같은 요청 전체를 처리한 결과입니다. 결과 비교에서 이동 경로와 합계를 함께 확인하세요."
          : "현재까지 완료한 요청의 결과입니다. 누적 이동 거리는 장면의 표시창에 있습니다."}
      </p>
    </div>
  );
}

// Sweep lessons: wait per request (head travel until it is served), drawn at
// its cylinder. Lesson 03 adds, at the end, the worst wait under a steady
// stream of requests (SCAN depends on the position, C-SCAN does not).
function WaitChart({
  lesson,
  snap,
  seen,
}: {
  lesson: Lesson;
  snap: PlaybackSnapshot;
  seen: Step[];
}) {
  const { committed, algorithm } = snap;
  const runs = lesson.runs;
  const served = seen
    .slice(1)
    .map((s) => ({ c: s.request!.cylinder, wait: s.state.total, now: s.index === committed }));
  const end = committed === N;
  const worstWait = lesson.worstWait;
  const worst = end && worstWait ? REQUESTS.map((c) => ({ c, w: worstWait(algorithm, c) })) : [];
  const top = Math.max(
    ...lesson.algorithms.map((a) => runs[a].total),
    ...(worstWait ? REQUESTS.flatMap((c) => lesson.algorithms.map((a) => worstWait(a, c))) : []),
  );
  const cx = (c: number) => ((c / 199) * 100).toFixed(2);
  const wy = (w: number) => (100 - (w / (top * 1.1)) * 100).toFixed(2);
  // A worst wait that is the same everywhere (C-SCAN) is one line, one label.
  const flat = worst.length > 0 && worst.every((x) => x.w === worst[0].w);
  const waits = served.map((x) => x.wait);
  // 65/67 and 122/124 sit close together: print their labels to either side.
  const side = (c: number) => {
    const near = REQUESTS.find((o) => o !== c && Math.abs(o - c) < 8);
    return near === undefined ? null : c < near ? "l" : "r";
  };
  const labelShift = (c: number | null, edge = false) => {
    const s = c === null ? null : side(c);
    return edge
      ? "-translate-x-full"
      : s === "l"
        ? "translate-x-[calc(-100%-2px)]"
        : s === "r"
          ? "translate-x-[2px]"
          : "-translate-x-1/2";
  };
  const labelBase =
    "absolute top-[var(--y)] left-[var(--x)] -translate-y-[calc(100%+4px)] text-caption leading-none font-medium whitespace-nowrap text-label-2 [text-shadow:0_0_2px_var(--window),0_0_4px_var(--window),0_0_6px_var(--window)]";
  const at = (x: string, y: string) => ({ "--x": `${x}%`, "--y": `${y}%` }) as React.CSSProperties;
  return (
    <div className={chartClass}>
      <div className={chartHeadClass}>
        <Label>
          <b>{lesson.names[algorithm]}</b>
          {committed} / {N} 요청 · 요청 실린더별 대기(칸)
        </Label>
        <Label>
          {committed ? `대기 ${Math.min(...waits)}–${Math.max(...waits)}칸` : "처리한 요청만 표시"}
          {worst.length > 0 && (
            <>
              {" · "}
              <i className="me-1 inline-block w-3.5 border-t-2 border-dashed border-sys-red align-middle" />
              최악(계속 도착)
            </>
          )}
        </Label>
      </div>
      <div className={cn(plotClass, "mt-[22px]")}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          className={plotSvgClass}
        >
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line key={f} className={gridLine} x1="0" y1={wy(top * f)} x2="100" y2={wy(top * f)} />
          ))}
          {served.map((x) => (
            <line
              key={x.c}
              className={cn(
                "[stroke-width:8] [vector-effect:non-scaling-stroke]",
                x.now ? "stroke-[var(--accent)]" : "stroke-[var(--label-3)]",
              )}
              x1={cx(x.c)}
              y1="100"
              x2={cx(x.c)}
              y2={wy(x.wait)}
            />
          ))}
          {(flat ? [{ c: -1, w: worst[0].w }] : worst).map((x) => (
            <line
              key={x.c}
              className="stroke-[var(--sys-red)] [stroke-dasharray:4_3] [stroke-width:2] [vector-effect:non-scaling-stroke]"
              x1={flat ? "0" : (+cx(x.c) - 2.2).toFixed(2)}
              y1={wy(x.w)}
              x2={flat ? "100" : (+cx(x.c) + 2.2).toFixed(2)}
              y2={wy(x.w)}
            />
          ))}
        </svg>
        {served.map((x) => (
          <span
            key={x.c}
            className={cn(labelBase, labelShift(x.c), x.now && "font-bold text-label")}
            style={at(cx(x.c), wy(x.wait))}
          >
            {x.wait}
          </span>
        ))}
        {flat && (
          <span
            className={cn(labelBase, labelShift(null, true), "font-semibold text-sys-red")}
            style={at("100", wy(worst[0].w))}
          >
            어느 위치든 {worst[0].w}
          </span>
        )}
        {(flat ? [] : worst).map((x) => (
          <span
            key={x.c}
            className={cn(labelBase, labelShift(x.c), "font-semibold text-sys-red")}
            style={at(cx(x.c), wy(x.w))}
          >
            {x.w}
          </span>
        ))}
      </div>
      <div aria-hidden="true" className={axisClass}>
        {REQUESTS.toSorted((a, b) => a - b).map((c, i, all) => (
          <span
            key={c}
            className={
              side(c) === "l"
                ? "translate-x-[calc(-100%-1px)]!"
                : side(c) === "r"
                  ? "translate-x-px!"
                  : i === all.length - 1
                    ? "-translate-x-full!"
                    : undefined
            }
            style={{ "--x": `${cx(c)}%` } as React.CSSProperties}
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}
