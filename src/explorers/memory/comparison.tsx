// 비교 for the memory explorer: the same accesses under both conditions in
// two columns (counts, a hit/fault trace, "이 방식으로 다시 보기"), the 갈림길
// sentence and "갈림길로 돌아가기 →".
import { Button } from "@/components/ui/button.tsx";
import { Readout } from "@/components/ui/content.tsx";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFoot,
  SheetHead,
  SheetSection,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import { Index, Label, Text, Title } from "@/components/ui/typography.tsx";
import { LABELS } from "@/lib/lesson-kit.ts";
import { CRITERION, POLICY } from "./lessons.ts";
import { OutcomeLed, PageChip } from "./parts.tsx";
import type { Playback } from "./playback.ts";

export function MemoryComparison({
  playback,
  open,
  onOpenChange,
  onReplayMode,
  onTurningPoint,
}: {
  playback: Playback;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReplayMode: (id: string) => void;
  onTurningPoint: () => void;
}) {
  const lesson = playback.lesson;
  const { runs, extras, total } = playback;
  const frames = [...new Set(lesson.modes.map((m) => m.frameCount))]
    .map((n) => `${n}개`)
    .join("와 ");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-labelledby="comparison-title">
        <SheetHead>
          <Label>
            {LABELS.compareSub} · {total}번의 접근 · 프레임 {frames}
          </Label>
        </SheetHead>
        <div className="flex min-h-0 flex-auto flex-col">
          <SheetBody>
            <SheetSection>
              <SheetTitle render={<Title id="comparison-title" />}>{LABELS.compare}</SheetTitle>
              <div className="mt-3 grid grid-cols-2 gap-[18px] phone:grid-cols-1">
                {lesson.modes.map((m) => {
                  const r = runs[m.id];
                  const sub =
                    lesson.id === "belady"
                      ? `${POLICY[m.algorithm]} · 같은 정책, 프레임 ${m.frameCount}개`
                      : CRITERION[m.algorithm];
                  return (
                    <div key={m.id} className="flex min-w-0 flex-col items-start">
                      <Label>
                        <Index>{m.label}</Index> {sub}
                      </Label>
                      <Readout className="mt-1.5">
                        {r.stats.faults}
                        <small>부재</small> {r.stats.hits}
                        <small>적중</small> {r.stats.replacements}
                        <small>교체</small>
                      </Readout>
                      <ol
                        aria-label={`${m.label} 접근별 결과`}
                        className="m-0 mt-3 grid w-full list-none grid-cols-5 gap-1 p-0"
                      >
                        {r.steps.slice(1).map((s) => (
                          <li
                            key={s.index}
                            title={`${s.index}번째 ${s.page}: ${s.hit ? "적중" : "부재"}`}
                            className="grid justify-items-center gap-1.5"
                          >
                            <PageChip page={s.page} />
                            <OutcomeLed hit={Boolean(s.hit)} />
                            <span className="sr-only">{s.hit ? "적중" : "부재"}</span>
                          </li>
                        ))}
                      </ol>
                      <Button
                        variant="filled"
                        size="sm"
                        data-replay-mode={m.id}
                        className="mt-3"
                        onClick={() => onReplayMode(m.id)}
                      >
                        {LABELS.replayMode}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </SheetSection>
            <SheetSection className="mt-4! border-t border-separator-soft pt-3.5!">
              <Text
                // The 갈림길 sentence marks its lead in <b>; the text is ours (lessons.ts).
                // oxlint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: lesson.forkText(runs, extras) }}
              />
              <Text className="mt-1.5 text-label-2">{lesson.compareNote(runs, extras)}</Text>
              <Label as="p" className="mt-1.5 gap-4">
                <span className="inline-flex items-center gap-[7px]">
                  <OutcomeLed hit />
                  적중
                </span>
                <span className="inline-flex items-center gap-[7px]">
                  <OutcomeLed hit={false} />
                  부재
                </span>
              </Label>
            </SheetSection>
          </SheetBody>
          <SheetFoot>
            <Button variant="primary" data-action="turning-point" onClick={onTurningPoint}>
              {LABELS.backToFork} →
            </Button>
          </SheetFoot>
        </div>
      </SheetContent>
    </Sheet>
  );
}
