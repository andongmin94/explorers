// 비교 for the disk: both methods on the same eight requests — total head
// travel, the same seek graph small, the order (edges in parentheses), what
// the method does, and the 갈림길 note.
import { ComparisonSheet, SheetSection } from "@/components/learning/comparison.tsx";
import { Note, Readout } from "@/components/ui/content.tsx";
import { SheetTitle } from "@/components/ui/sheet.tsx";
import { Index, Label, Text, Title } from "@/components/ui/typography.tsx";
import { INITIAL_HEAD, routePoints } from "./engine.ts";
import { fix, ro } from "./format.ts";
import type { Lesson } from "./lessons.ts";
import { N } from "./playback.ts";
import type { Algorithm, Run } from "./types.ts";

export function DiskComparison({
  lesson,
  open,
  onOpenChange,
  algorithm,
  onTryOther,
}: {
  lesson: Lesson;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  algorithm: Algorithm;
  onTryOther: (other: Algorithm) => void;
}) {
  const other = lesson.algorithms.find((a) => a !== algorithm)!;
  return (
    <ComparisonSheet
      open={open}
      onOpenChange={onOpenChange}
      otherLabel={`${fix(ro(lesson.names[other]!))} 다시 보기`}
      onTryOther={() => onTryOther(other)}
      className="console:w-[min(760px,calc(100vw-48px))]"
    >
      {open && (
        <>
          <SheetSection>
            <Label>
              요청 {N}개 · 시작 {INITIAL_HEAD}
            </Label>
            <SheetTitle render={<Title id="comparison-title" className="mt-1.5" />}>
              {fix(lesson.lessonAt(lesson.algorithms[0], 0).title)}
            </SheetTitle>
          </SheetSection>
          <SheetSection className="grid grid-cols-2 gap-x-6 phone:grid-cols-1 phone:gap-y-3.5 phone:[&>section+section]:border-t phone:[&>section+section]:border-separator-soft phone:[&>section+section]:pt-3.5 min-[760px]:[&>section+section]:border-l min-[760px]:[&>section+section]:border-separator-soft min-[760px]:[&>section+section]:ps-6">
            {lesson.algorithms.map((name, i) => (
              <Method
                key={name}
                lesson={lesson}
                name={name}
                run={lesson.runs[name]}
                number={i + 1}
              />
            ))}
          </SheetSection>
          <SheetSection>
            <Note accent as="p">
              {fix(lesson.compareNote())}
            </Note>
          </SheetSection>
        </>
      )}
    </ComparisonSheet>
  );
}

function Method({
  lesson,
  name,
  run,
  number,
}: {
  lesson: Lesson;
  name: Algorithm;
  run: Run;
  number: number;
}) {
  const order = run.steps
    .slice(1)
    .flatMap((s) => [...s.via!.map((v) => `(${v})`), s.request!.cylinder]);
  return (
    <section className="grid content-start justify-items-start gap-3" data-method={name}>
      <Label>
        <Index>{String(number).padStart(2, "0")}</Index> {fix(lesson.names[name]!)} ·{" "}
        {lesson.ruleShort[name]}
      </Label>
      <Readout large>
        {run.total}
        <small>CYL</small>
      </Readout>
      <MiniPath run={run} />
      <p className="m-0 text-caption text-balance text-label-2 tabular-nums">
        {INITIAL_HEAD} → {order.join(" → ")}
      </p>
      <Text className="min-h-[3.4em]">
        {fix(`${lesson.compareStory[name]} ${lesson.compareExtra(name)}`)}
      </Text>
    </section>
  );
}

/** The same seek graph as the records screen: order across, cylinder down. */
function MiniPath({ run }: { run: Run }) {
  const w = 300;
  const h = 132;
  const x = (k: number) => 10 + k * ((w - 20) / N);
  const y = (c: number) => 8 + (c / 199) * (h - 16);
  const pts = routePoints(run.steps)
    .map(([c, k]) => `${x(k).toFixed(1)},${y(c).toFixed(1)}`)
    .join(" ");
  return (
    <div className="w-full tabular-nums">
      <div className="mb-1.5 flex min-h-[22px] items-center gap-3">
        <Label>헤드 이동 경로</Label>
        <Label className="ms-auto font-medium">실린더 0 → 199 ↓</Label>
      </div>
      <svg
        className="block h-auto w-full overflow-visible"
        viewBox={`0 0 ${w} ${h}`}
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- an inline SVG chart, named for screen readers
        role="img"
        aria-label={`${run.order.join(", ")} 순서의 헤드 이동 경로`}
      >
        {[0, 50, 100, 150, 199].map((c) => (
          <line
            key={c}
            x1="4"
            y1={y(c)}
            x2={w - 4}
            y2={y(c)}
            className="stroke-[var(--separator)] [stroke-width:1]"
          />
        ))}
        <polyline
          points={pts}
          className="fill-none stroke-[var(--accent)] [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2.5]"
        />
        {run.steps.map((s) => (
          <circle
            key={s.index}
            cx={x(s.index).toFixed(1)}
            cy={y(s.state.head).toFixed(1)}
            r="2.8"
            className="fill-[var(--accent-text)] stroke-[var(--window)] [stroke-width:1.5]"
          />
        ))}
      </svg>
    </div>
  );
}
