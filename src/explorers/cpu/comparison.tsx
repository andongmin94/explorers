// 비교 for the CPU: both methods on the same jobs — two run charts, six
// metrics (the better value in bold) and the 갈림길 note; RR adds the
// quantum sweep. On the desktop the table sits left, runs and note right.
import { ComparisonSheet, SheetSection } from "@/components/learning/comparison.tsx";
import { Note } from "@/components/ui/content.tsx";
import { SheetTitle } from "@/components/ui/sheet.tsx";
import { Table, Td, Th, rowClass } from "@/components/ui/table.tsx";
import { Heading, Label, Title } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import { colorOf, keepUnits, number } from "./format.ts";
import { josa } from "./josa.ts";
import { METHODS, lessonRuns, type Lesson } from "./lessons.ts";
import type { Algorithm, SimResult, Stats } from "./types.ts";

type Key =
  | "averageResponse"
  | "averageWaiting"
  | "averageTurnaround"
  | "makespan"
  | "utilization"
  | "contextSwitches";
const ROWS: [string, string, Key, string][] = [
  ["평균 최초 응답", "도착 → 첫 CPU 실행", "averageResponse", "ms"],
  ["평균 대기 시간(준비 큐)", "준비 큐에서 기다린 시간", "averageWaiting", "ms"],
  ["평균 반환 시간", "도착 → 완료", "averageTurnaround", "ms"],
  ["전체 완료 시각", "모든 작업이 끝난 시각", "makespan", "ms"],
  ["CPU 활용률", "실행 시간 ÷ 전체 시간", "utilization", "%"],
  ["문맥 교환", "서로 다른 작업 사이의 전환(작업 전환)", "contextSwitches", "회"],
];

export function CpuComparison({
  lesson,
  open,
  onOpenChange,
  algorithm,
  quantum,
  onTryOther,
}: {
  lesson: Lesson;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  algorithm: Algorithm;
  quantum: number;
  onTryOther: (other: Algorithm) => void;
}) {
  const hasIo = lesson.processes.some((p) => p.io.length);
  const other = lesson.methods.find((m) => m !== algorithm)!;
  const runs = open ? lessonRuns(lesson, quantum) : null;
  const methodLabel = (m: Algorithm) => (m === "rr" ? `RR · ${quantum} ms` : METHODS[m].label);
  return (
    <ComparisonSheet
      open={open}
      onOpenChange={onOpenChange}
      otherLabel={`${josa(METHODS[other].label, "으로")} 다시 보기`}
      onTryOther={() => onTryOther(other)}
      className="cpu-compare console:w-[min(980px,calc(100vw-48px))]"
      bodyClassName={cn(
        "console:grid console:grid-cols-2 console:grid-rows-[auto_auto_1fr] console:items-start console:gap-x-7 console:gap-y-0",
        "console:[&>div:nth-child(1)]:[grid-area:1/1/2/3] console:[&>div:nth-child(2)]:[grid-area:2/2]",
        "console:[&>div:nth-child(3)]:[grid-area:2/1/4/2] console:[&>div:nth-child(3)]:pt-4 console:[&>div:nth-child(4)]:[grid-area:3/2]",
      )}
    >
      {runs && (
        <Body
          lesson={lesson}
          runs={runs}
          labels={lesson.methods.map(methodLabel)}
          hasIo={hasIo}
          quantum={quantum}
        />
      )}
    </ComparisonSheet>
  );
}

function Body({
  lesson,
  runs,
  labels,
  hasIo,
  quantum,
}: {
  lesson: Lesson;
  runs: Record<Algorithm, SimResult>;
  labels: string[];
  hasIo: boolean;
  quantum: number;
}) {
  const [a, b] = lesson.methods.map((m) => runs[m]);
  const scale = Math.max(a.stats.makespan, b.stats.makespan);
  const summary = lesson.content.compare(runs, { quantum, processes: lesson.processes });
  // Without I/O the CPU never idles: utilization is 100% in both runs.
  const rows = ROWS.filter(([, , key]) => hasIo || key !== "utilization");
  const better = (key: Key, x: number, y: number) => {
    if (x === y) return ["", ""];
    const higherIsBetter = key === "utilization";
    const xWins = higherIsBetter ? x > y : x < y;
    return xWins ? ["font-bold", ""] : ["", "font-bold"];
  };
  return (
    <>
      <SheetSection>
        <SheetTitle render={<Title id="comparison-title" className="mt-1.5" />}>
          {lesson.question}
        </SheetTitle>
      </SheetSection>
      <SheetSection className="grid grid-cols-[72px_minmax(0,1fr)_44px] items-center gap-x-3 gap-y-2.5">
        {[a, b].map((run, i) => (
          <Lane key={labels[i]} label={labels[i]} run={run} scale={scale} />
        ))}
      </SheetSection>
      <SheetSection className="overflow-x-auto">
        <Table>
          <thead>
            <tr>
              <Th>지표</Th>
              <Th>{labels[0]}</Th>
              <Th>{labels[1]}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([title, description, key, unit]) => {
              const [betterA, betterB] = better(
                key,
                a.stats[key as keyof Stats] as number,
                b.stats[key as keyof Stats] as number,
              );
              return (
                <tr key={key} className={rowClass}>
                  <Td>
                    {title}
                    <span className="block text-caption text-label-2">{description}</span>
                  </Td>
                  <Td className={cn("tabular-nums", betterA)}>
                    {number(a.stats[key])}
                    {unit}
                  </Td>
                  <Td className={cn("tabular-nums", betterB)}>
                    {number(b.stats[key])}
                    {unit}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </SheetSection>
      <SheetSection>
        <Note accent className="[&_p]:m-0 [&_p+p]:mt-1.5">
          <div>
            <Heading>{keepUnits(summary.head)}</Heading>
            <p>{keepUnits(summary.body)}</p>
            {summary.caveat && <p className="text-label-2">{keepUnits(summary.caveat)}</p>}
          </div>
        </Note>
        {summary.extra && (
          // The sweep marks the current quantum in <b>; the text is ours (lessons.ts).
          <p
            className="mt-1.5 text-caption text-label-2 keep-all"
            // oxlint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: keepUnits(summary.extra) }}
          />
        )}
      </SheetSection>
    </>
  );
}

function Lane({ label, run, scale }: { label: string; run: SimResult; scale: number }) {
  return (
    <>
      <Label>{label}</Label>
      <div className="@container relative h-7 rounded-full bg-fill-3">
        {run.segments.map((s) => (
          <span
            key={s.start}
            title={`${s.start}–${s.end} ms · ${s.id || "유휴"}`}
            className={cn(
              "absolute top-[3px] bottom-[3px] flex min-w-1 items-center justify-center overflow-hidden rounded-full border border-transparent bg-clip-padding",
              "font-sans text-caption font-semibold whitespace-nowrap text-white tabular-nums @max-[320px]:text-transparent",
              s.id
                ? "bg-[var(--c)]"
                : "[background:repeating-linear-gradient(135deg,var(--fill-1)_0_3px,transparent_3px_7px)_padding-box] font-medium text-label-2 shadow-[inset_0_0_0_1px_var(--separator)]",
            )}
            style={
              {
                "--c": colorOf(s.id),
                left: `${(s.start / scale) * 100}%`,
                width: `${((s.end - s.start) / scale) * 100}%`,
              } as React.CSSProperties
            }
          >
            {s.end - s.start >= 2 ? s.id || "유휴" : ""}
          </span>
        ))}
      </div>
      <span className="text-right text-caption font-semibold text-label-2 tabular-nums">
        {run.stats.makespan} ms
      </span>
    </>
  );
}
