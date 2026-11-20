// 비교: lesson 03 compares its three resolutions (해결안 비교); 01 and 04 put
// their two methods in two columns; 02 sets two tips alone against a
// comparison with the common ancestor C0, line by line.
import { Button } from "@/components/ui/button.tsx";
import { Note } from "@/components/ui/content.tsx";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHead,
  SheetSection,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import { rowClass, Table, Td, Th } from "@/components/ui/table.tsx";
import { Index, Label, Text, Title } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import { LABELS } from "@/lib/lesson-kit.ts";
import { RESOLUTIONS } from "./engine.ts";
import { keepFlags, titleOf } from "./format.ts";
import type { BasesComparison, Lesson, MethodsComparison } from "./lesson-model.ts";
import { RowTh } from "./records.tsx";

const cellClass = "align-top [overflow-wrap:anywhere] keep-all";

export function GitComparison({
  lesson,
  open,
  onOpenChange,
  choice,
  onPlay,
  onFork,
}: {
  lesson: Lesson;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  choice: string | null;
  /** "이 방식으로 다시 보기" / "이 해결안으로": play that variant from the fork. */
  onPlay: (variant: string) => void;
  /** "갈림길로 돌아가기". */
  onFork: () => void;
}) {
  const c = lesson.comparison;
  const eyebrow = lesson.gate ? "해결안 비교" : `${LABELS.compare} · ${LABELS.compareSub}`;
  const title = lesson.gate ? "세 해결안의 병합 결과" : c!.title;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-labelledby="compare-title" className="git-compare">
        <SheetHead>
          <div className="grid gap-1 py-1">
            <Label>
              <Index>C</Index> {eyebrow}
            </Label>
            <SheetTitle render={<Title id="compare-title" />}>{keepFlags(title)}</SheetTitle>
          </div>
        </SheetHead>
        <SheetBody>
          {open &&
            (lesson.gate ? (
              <Resolutions lesson={lesson} choice={choice} onPlay={onPlay} />
            ) : "lines" in c! ? (
              <Bases lesson={lesson} c={c} onPlay={onPlay} onFork={onFork} />
            ) : (
              <Methods c={c!} choice={choice} onPlay={onPlay} onFork={onFork} />
            ))}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

/** Lesson 03: the three resolutions side by side. */
function Resolutions({
  lesson,
  choice,
  onPlay,
}: {
  lesson: Lesson;
  choice: string | null;
  onPlay: (variant: string) => void;
}) {
  const final = (id: string) => lesson.simulate(id).steps.at(-1)!.state;
  const head = lesson.simulate("both").steps[8].state.commits.find((c) => c.id === "C2")!;
  return (
    <>
      <SheetSection>
        <Text>
          세 해결안 모두 C2와 C1을 부모로 갖는 C3를 만듭니다. 달라지는 것은 C3에 담기는 제목
          줄입니다.
        </Text>
      </SheetSection>
      <SheetSection className="overflow-x-auto">
        <Table>
          <thead>
            <tr>
              <Th>해결안</Th>
              <Th>C3의 제목 줄</Th>
              <Th>C2와 다른 줄</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {RESOLUTIONS.map((r) => {
              const diff =
                final(r.id).commits.find((c) => c.id === "C3")!.content === head.content ? 0 : 1;
              return (
                <tr
                  key={r.id}
                  className={rowClass}
                  aria-current={r.id === choice ? "true" : undefined}
                >
                  <Td className={cellClass}>
                    {r.label}
                    <span className="block text-caption text-label-2">{r.description}</span>
                  </Td>
                  <Td className={cellClass}>{titleOf(r.content)}</Td>
                  <Td className="font-mono">{diff}</Td>
                  <Td>
                    <Button
                      variant="filled"
                      size="sm"
                      data-compare={r.id}
                      onClick={() => onPlay(r.id)}
                    >
                      {r.id === choice ? "다시 보기" : "이 해결안으로"}
                    </Button>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </SheetSection>
    </>
  );
}

/** Lessons 01 and 04: the two methods as two columns, one row per aspect. */
function Methods({
  c,
  choice,
  onPlay,
  onFork,
}: {
  c: MethodsComparison;
  choice: string | null;
  onPlay: (variant: string) => void;
  onFork: () => void;
}) {
  return (
    <>
      <SheetSection>
        <Text>{keepFlags(c.fork)}</Text>
      </SheetSection>
      <SheetSection className="overflow-x-auto">
        <Table className="git-compare-table">
          <thead>
            <tr>
              <Th />
              {c.columns.map((col) => (
                <Th
                  key={col.variant}
                  aria-current={col.variant === choice ? "true" : undefined}
                  className="aria-[current=true]:text-accent-text"
                >
                  {col.label}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {c.rows.map((row, i) => (
              <tr key={row} className="even:[&>*]:bg-fill-4">
                <RowTh>{row}</RowTh>
                {c.columns.map((col) => (
                  <Td key={col.variant} className={cellClass}>
                    {col.values[i]}
                  </Td>
                ))}
              </tr>
            ))}
            <tr>
              <RowTh />
              {c.columns.map((col) => (
                <Td key={col.variant}>
                  <Button
                    variant={col.variant === choice ? "primary" : "filled"}
                    size="sm"
                    data-compare={col.variant}
                    onClick={() => onPlay(col.variant)}
                  >
                    {LABELS.replayMode}
                  </Button>
                </Td>
              ))}
            </tr>
          </tbody>
        </Table>
        <Button variant="filled" size="sm" data-action="fork" className="mt-4" onClick={onFork}>
          {LABELS.backToFork}
        </Button>
      </SheetSection>
    </>
  );
}

/** Lesson 02: per line, what two tips alone decide vs what C0 lets Git decide. */
function Bases({
  lesson,
  c,
  onPlay,
  onFork,
}: {
  lesson: Lesson;
  c: BasesComparison;
  onPlay: (variant: string) => void;
  onFork: () => void;
}) {
  const value = (line: string | null) => line?.split(": ")[1] ?? line ?? "";
  const changed = c.lines.filter((l) => l.ours !== l.theirs || l.base !== l.ours);
  return (
    <>
      <SheetSection>
        <Text>{keepFlags(c.fork)}</Text>
      </SheetSection>
      <SheetSection className="overflow-x-auto">
        <Table className="git-compare-table">
          <thead>
            <tr>
              <Th>줄</Th>
              <Th>C2 · main</Th>
              <Th>C1 · feature</Th>
              <Th>두 끝만 비교</Th>
              <Th>C0와 함께 비교</Th>
            </tr>
          </thead>
          <tbody>
            {changed.map((l) => {
              const who = l.ours === l.base ? "feature" : "main";
              return (
                <tr key={l.label} className="even:[&>*]:bg-fill-4">
                  <RowTh>{l.label}</RowTh>
                  <Td className={cellClass}>{value(l.ours)}</Td>
                  <Td className={cellClass}>{value(l.theirs)}</Td>
                  <Td className={cellClass}>? 누가 바꿨는지 모름</Td>
                  <Td className={cellClass}>
                    {value(l.threeWay)} · C0 대비 {who}만 바꿈
                  </Td>
                </tr>
              );
            })}
            <tr className={cn(changed.length % 2 === 1 && "[&>*]:bg-fill-4")}>
              <RowTh>결과</RowTh>
              <Td colSpan={2} className={cn(cellClass, "text-label-2")}>
                같은 두 끝
              </Td>
              <Td className={cellClass}>사람이 {changed.length}줄을 정해야 함</Td>
              <Td className={cellClass}>병합 커밋 C3를 바로 만듦</Td>
            </tr>
          </tbody>
        </Table>
        <Note as="p" className="mt-2.5">
          {keepFlags(c.note)}
        </Note>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Button
            variant="filled"
            size="sm"
            data-compare={lesson.defaultVariant!}
            onClick={() => onPlay(lesson.defaultVariant!)}
          >
            {LABELS.replayMode}
          </Button>
          <Button variant="filled" size="sm" data-action="fork" onClick={onFork}>
            {LABELS.backToFork}
          </Button>
        </div>
      </SheetSection>
    </>
  );
}
